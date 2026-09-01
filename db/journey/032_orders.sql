-- MEBODY — 멤버십 · 주문 · 적립금 차감
--
-- README 는 membership_plans / user_subscriptions 를 앱이 쓴다고 적고 있지만
-- 실제 DB 에는 두 테이블이 없어 CheckoutScreen 의 구독 활성화가 실패해 왔습니다.
-- 여기서 함께 만듭니다.
--
-- 결제 승인은 아직 붙이지 않습니다(결제사 미정).
-- 주문은 PENDING 으로 생성되고, 결제 연동 시 PAID 로 전이시키면 됩니다.
--
-- 적립금 차감은 반드시 서버에서 원자적으로 수행합니다.
--   포인트만 빠지고 결제가 실패하면 사용자 돈이 사라지므로,
--   주문 생성과 차감을 한 트랜잭션에 묶고 취소 시 환불 엔트리로 복구합니다.

BEGIN;

-- ---------------------------------------------------------------------------
-- 멤버십 플랜 — 등급별 적립 배수 포함
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,
  name              text NOT NULL,
  description       text,
  billing_cycle     text NOT NULL DEFAULT 'monthly',
  price_krw         integer NOT NULL DEFAULT 0,
  -- 미션 적립에 곱해지는 배수. 1.0 = 혜택 없음
  reward_multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membership_plans_cycle_check CHECK (billing_cycle IN ('monthly','yearly','one_time')),
  CONSTRAINT membership_plans_multiplier_check CHECK (reward_multiplier >= 1.0 AND reward_multiplier <= 10.0)
);

DROP TRIGGER IF EXISTS membership_plans_updated_at ON public.membership_plans;
CREATE TRIGGER membership_plans_updated_at
BEFORE UPDATE ON public.membership_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code             text NOT NULL REFERENCES public.membership_plans(code),
  status                text NOT NULL DEFAULT 'active',
  started_at            timestamptz NOT NULL DEFAULT now(),
  current_period_end    timestamptz,
  cancel_at_period_end  boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_status_check
    CHECK (status IN ('trialing','active','past_due','canceled'))
);

CREATE INDEX IF NOT EXISTS user_subscriptions_user_idx ON public.user_subscriptions (user_id, status);

DROP TRIGGER IF EXISTS user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 주문
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'PENDING',
  subtotal_krw   integer NOT NULL CHECK (subtotal_krw >= 0),
  -- 사용한 적립금. 원장의 spend_order 엔트리 금액과 절댓값이 같아야 한다.
  reward_used    integer NOT NULL DEFAULT 0 CHECK (reward_used >= 0),
  total_krw      integer NOT NULL CHECK (total_krw >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  paid_at        timestamptz,
  canceled_at    timestamptz,
  CONSTRAINT orders_status_check CHECK (status IN ('PENDING','PAID','CANCELED','FAILED')),
  CONSTRAINT orders_total_check CHECK (total_krw = subtotal_krw - reward_used)
);

CREATE INDEX IF NOT EXISTS orders_user_idx ON public.orders (user_id, created_at DESC);

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES public.products(id) ON DELETE SET NULL,
  -- 주문 시점 값을 복사해 둔다. 상품 가격이 바뀌어도 과거 주문은 그대로여야 한다.
  name        text NOT NULL,
  unit_price  integer NOT NULL CHECK (unit_price >= 0),
  quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- 주문 생성 + 적립금 차감 (원자적)
--
--   p_items: [{"product_id":"...","quantity":1}, ...]
--   p_reward_to_use: 사용할 적립금. 잔액과 주문금액을 넘지 못한다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(p_items jsonb, p_reward_to_use integer DEFAULT 0)
RETURNS TABLE (order_id uuid, subtotal integer, reward_used integer, total integer, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_order    uuid;
  v_subtotal integer := 0;
  v_use      integer;
  v_balance  integer;
  v_item     jsonb;
  v_product  public.products;
  v_qty      integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'no items' USING ERRCODE = '22023';
  END IF;

  -- 같은 사용자의 동시 주문을 직렬화한다. 두 탭에서 동시에 쓰면 잔액이 음수가 될 수 있다.
  PERFORM pg_advisory_xact_lock(hashtext(v_user::text));

  v_order := gen_random_uuid();

  -- 1단계: 상품을 검증하고 소계를 계산한다.
  --   order_items 는 orders 를 참조하므로 orders 행을 먼저 만들어야 한다.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM public.products
     WHERE id = (v_item->>'product_id')::uuid AND status = 'ACTIVE';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'product not available: %', v_item->>'product_id' USING ERRCODE = '22023';
    END IF;
    IF v_product.price IS NULL THEN
      RAISE EXCEPTION 'product has no price: %', v_product.name USING ERRCODE = '22023';
    END IF;

    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));
    v_subtotal := v_subtotal + (v_product.price::int * v_qty);
  END LOOP;

  v_balance := public.reward_balance(v_user);
  -- 사용 가능한 만큼만 쓴다. 음수·초과 요청은 여기서 잘린다.
  v_use := LEAST(GREATEST(COALESCE(p_reward_to_use, 0), 0), v_balance, v_subtotal);

  -- 2단계: 주문 행을 만든다.
  INSERT INTO public.orders (id, user_id, status, subtotal_krw, reward_used, total_krw)
  VALUES (v_order, v_user, 'PENDING', v_subtotal, v_use, v_subtotal - v_use);

  -- 3단계: 품목을 기록한다. 주문 시점 가격을 복사해 둔다.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM public.products
     WHERE id = (v_item->>'product_id')::uuid AND status = 'ACTIVE';
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));

    INSERT INTO public.order_items (order_id, product_id, name, unit_price, quantity)
    VALUES (v_order, v_product.id, v_product.name, v_product.price::int, v_qty);
  END LOOP;

  IF v_use > 0 THEN
    INSERT INTO public.user_rewards
      (user_id, entry_type, amount, issue_type, source_type, source_id, memo)
    VALUES
      (v_user, 'spend_order', -v_use, 'free', 'order', v_order, '상품 주문에 사용');
  END IF;

  RETURN QUERY SELECT v_order, v_subtotal, v_use, v_subtotal - v_use, public.reward_balance(v_user);
END $$;

-- ---------------------------------------------------------------------------
-- 주문 취소 + 적립금 환불
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
RETURNS TABLE (refunded integer, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_order public.orders;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user::text));

  SELECT * INTO v_order FROM public.orders
   WHERE id = p_order_id AND user_id = v_user FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = '42501';
  END IF;
  IF v_order.status = 'CANCELED' THEN
    RETURN QUERY SELECT 0, public.reward_balance(v_user);
    RETURN;
  END IF;
  IF v_order.status = 'PAID' THEN
    RAISE EXCEPTION 'paid order cannot be canceled here' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders SET status = 'CANCELED', canceled_at = now() WHERE id = p_order_id;

  IF v_order.reward_used > 0 THEN
    INSERT INTO public.user_rewards
      (user_id, entry_type, amount, issue_type, source_type, source_id, memo)
    VALUES
      (v_user, 'refund_order', v_order.reward_used, 'free', 'order', p_order_id, '주문 취소로 복구')
    ON CONFLICT (user_id, entry_type, source_id) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_order.reward_used, public.reward_balance(v_user);
END $$;

-- ---------------------------------------------------------------------------
-- 권한 · RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.membership_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items         ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.membership_plans   FROM anon, authenticated;
REVOKE ALL ON public.user_subscriptions FROM anon, authenticated;
REVOKE ALL ON public.orders             FROM anon, authenticated;
REVOKE ALL ON public.order_items        FROM anon, authenticated;

GRANT SELECT ON public.membership_plans TO anon, authenticated;
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;

DROP POLICY IF EXISTS membership_plans_read ON public.membership_plans;
CREATE POLICY membership_plans_read ON public.membership_plans
  FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS user_subscriptions_select_own ON public.user_subscriptions;
CREATE POLICY user_subscriptions_select_own ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS order_items_select_own ON public.order_items;
CREATE POLICY order_items_select_own ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

REVOKE ALL ON FUNCTION public.create_order(jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_order(uuid)           FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid)           TO authenticated;

-- ---------------------------------------------------------------------------
-- 시드 — 가격과 배수는 운영에서 조정합니다
-- ---------------------------------------------------------------------------
INSERT INTO public.membership_plans (code, name, description, billing_cycle, price_krw, reward_multiplier, sort_order)
VALUES
  ('basic_monthly', 'Basic Monthly', '결과 저장, 히스토리 조회, 재방문 빠른 결과', 'monthly', 5900, 1.5, 1),
  ('pro_monthly',   'Pro Monthly',   'Basic + 심화 리포트 + 루틴 우선순위',        'monthly', 12900, 2.0, 2)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  billing_cycle = EXCLUDED.billing_cycle, price_krw = EXCLUDED.price_krw,
  reward_multiplier = EXCLUDED.reward_multiplier, sort_order = EXCLUDED.sort_order, updated_at = now();

COMMIT;
