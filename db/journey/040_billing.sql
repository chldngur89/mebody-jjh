-- ===========================================================================
-- MEBODY — 결제 골격 (앱에서 결제, 등록은 서버에서)
--
-- 확인한 현재 상태(운영 DB 직접 조회):
--   · user_subscriptions : authenticated 에 **SELECT 권한만**, 정책도 select 하나뿐
--     → src/api/account.ts 의 activateSubscription() upsert 는 **항상 42501 로 실패**한다.
--       권한이 맞고 클라이언트 코드가 틀렸다. 앱에서 구독을 직접 쓸 수 있으면
--       누구나 공짜로 멤버십을 켤 수 있기 때문이다.
--   · orders : authenticated 에 SELECT 만. create_order(SECURITY DEFINER)가 PENDING 까지 만든다.
--     **PENDING → PAID 로 바꾸는 게 아무것도 없다.** 그래서 claim_purchase_reward(5% 적립)를
--     영원히 받을 수 없다.
--   · payments / 배송지 테이블 없음. 구독 0건, 주문 0건.
--   · has_active_subscription 은 current_period_end > now() 를 보므로 **만료는 자동**이다(크론 불필요).
--   · user_subscriptions 는 UNIQUE(user_id) — 사용자당 한 행.
--
-- 이 파일이 하는 일:
--   1) payments 원장 — 결제 승인 기록. UNIQUE(provider, provider_txn_id) 로 중복 승인 차단
--   2) user_addresses — 배송지 (실물 배송 주문에 필요)
--   3) orders 에 배송지 참조와 배송지 스냅샷 추가
--   4) **서버 전용** 상태 변경 함수 4개.
--      authenticated·anon 에서 EXECUTE 를 회수한다 → PostgREST 로 호출할 수 없다.
--      Spring(=postgres 롤)만 부른다.
--
-- 결제 수단 자체는 여기 없다. 사업자등록·PG/스토어 계약 전이라
-- 서버의 어댑터(DevPaymentGateway / TossPaymentGateway / PlayBillingGateway)가 담당한다.
--
-- 선행: 020~039 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) payments — 결제 승인 원장
--
--    멱등성의 근거가 되는 테이블이다. 같은 결제건(provider + 거래ID)이 두 번 들어오면
--    UNIQUE 가 막는다. 네트워크 재시도나 사용자의 더블탭으로 구독이 두 번 켜지는 걸 막는다.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- dev = 사업자등록 전 개발용 어댑터. 운영에서는 서버가 이 값을 만들지 못하게 막는다.
  provider         text NOT NULL CHECK (provider IN ('dev', 'toss', 'google_play')),
  provider_txn_id  text NOT NULL,
  kind             text NOT NULL CHECK (kind IN ('subscription', 'order')),
  order_id         uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  plan_code        text REFERENCES public.membership_plans(code),
  amount_krw       integer NOT NULL CHECK (amount_krw >= 0),
  status           text NOT NULL DEFAULT 'APPROVED'
                     CHECK (status IN ('APPROVED', 'CANCELED', 'FAILED')),
  raw              jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- 구독 결제면 plan_code 가, 주문 결제면 order_id 가 있어야 한다. 섞이면 안 된다.
  CONSTRAINT payments_target_check CHECK (
    (kind = 'order'        AND order_id IS NOT NULL AND plan_code IS NULL)
    OR (kind = 'subscription' AND plan_code IS NOT NULL AND order_id IS NULL)
  ),
  CONSTRAINT payments_provider_txn_key UNIQUE (provider, provider_txn_id)
);

CREATE INDEX IF NOT EXISTS payments_user_idx ON public.payments (user_id, created_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select_own ON public.payments;
CREATE POLICY payments_select_own ON public.payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 읽기만. 쓰기는 서버(postgres/service_role)만.
--
-- ★ REVOKE ALL 을 **먼저** 한다. Supabase 는 public 스키마의 새 테이블에 기본으로
--   anon·authenticated 에게 GRANT ALL 을 걸어두기 때문이다. 필요한 것만 골라
--   REVOKE 하면 TRUNCATE 가 남고, **TRUNCATE 는 RLS 를 적용받지 않아서**
--   로그인한 아무나 원장 전체를 지울 수 있게 된다.
REVOKE ALL ON public.payments FROM anon, authenticated;
GRANT SELECT ON public.payments TO authenticated;

COMMENT ON TABLE public.payments IS
  '결제 승인 원장. UNIQUE(provider, provider_txn_id) 가 중복 승인을 막는다. 쓰기는 서버만.';

-- ---------------------------------------------------------------------------
-- 2) user_addresses — 배송지
--
--    실물 상품 배송에 필요하다. 개인정보라 본인만 읽고 쓴다.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       text,
  recipient   text NOT NULL,
  phone       text NOT NULL,
  postcode    text NOT NULL,
  address1    text NOT NULL,
  address2    text,
  memo        text,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 기본 배송지는 사용자당 최대 하나.
CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_one_default
  ON public.user_addresses (user_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS user_addresses_user_idx ON public.user_addresses (user_id, created_at DESC);

DROP TRIGGER IF EXISTS user_addresses_updated_at ON public.user_addresses;
CREATE TRIGGER user_addresses_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_addresses_select_own ON public.user_addresses;
CREATE POLICY user_addresses_select_own ON public.user_addresses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_addresses_insert_own ON public.user_addresses;
CREATE POLICY user_addresses_insert_own ON public.user_addresses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_addresses_update_own ON public.user_addresses;
CREATE POLICY user_addresses_update_own ON public.user_addresses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_addresses_delete_own ON public.user_addresses;
CREATE POLICY user_addresses_delete_own ON public.user_addresses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 여기도 REVOKE ALL 이 먼저다(위와 같은 이유).
REVOKE ALL ON public.user_addresses FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_addresses TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) orders 확장
--
--    shipping_snapshot 을 따로 두는 이유: 배송지는 나중에 수정·삭제될 수 있는데,
--    주문서에는 **그때 보낸 주소**가 남아야 한다.
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address_id uuid
  REFERENCES public.user_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_snapshot jsonb;

COMMENT ON COLUMN public.orders.shipping_snapshot IS
  '주문 시점의 배송지 사본. user_addresses 가 바뀌어도 주문 내역은 그대로 남아야 한다.';

-- ---------------------------------------------------------------------------
-- 4) 서버 전용 상태 변경 함수
--
--    ★ 이 함수들은 authenticated 에서 EXECUTE 를 회수한다.
--      034 의 can_start_journey 는 RLS 정책이 호출자 권한으로 평가되므로
--      authenticated 에게 줘야 했지만, 이건 정반대다 —
--      앱이 부를 수 있으면 공짜 멤버십과 공짜 주문이 된다.
-- ---------------------------------------------------------------------------

/** 결제 승인 기록. 이미 있는 거래면 기존 행을 그대로 돌려준다(멱등). */
CREATE OR REPLACE FUNCTION public.record_payment_admin(
  p_user     uuid,
  p_provider text,
  p_txn      text,
  p_kind     text,
  p_amount   integer,
  p_order    uuid DEFAULT NULL,
  p_plan     text DEFAULT NULL,
  p_raw      jsonb DEFAULT NULL
)
RETURNS TABLE(payment_id uuid, was_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.payments;
  v_id uuid;
BEGIN
  SELECT * INTO v_existing FROM public.payments
   WHERE provider = p_provider AND provider_txn_id = p_txn;

  IF FOUND THEN
    -- 같은 거래를 다른 사용자 것으로 재사용하려는 시도는 막는다.
    IF v_existing.user_id IS DISTINCT FROM p_user THEN
      RAISE EXCEPTION 'payment belongs to another user' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY SELECT v_existing.id, false;
    RETURN;
  END IF;

  INSERT INTO public.payments (user_id, provider, provider_txn_id, kind, order_id, plan_code, amount_krw, raw)
  VALUES (p_user, p_provider, p_txn, p_kind, p_order, p_plan, p_amount, p_raw)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, true;
END $$;

/**
 * 구독 활성화. 사용자당 한 행(UNIQUE(user_id))이므로 있으면 연장한다.
 * 아직 안 끝난 구독이 남아 있으면 그 종료일부터 이어 붙인다 — 결제한 기간을 잃지 않게.
 */
CREATE OR REPLACE FUNCTION public.activate_subscription_admin(
  p_user uuid,
  p_plan text,
  p_days integer DEFAULT 30
)
RETURNS TABLE(subscription_id uuid, plan_code text, status text, current_period_end timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    uuid;
  v_from  timestamptz;
  v_end   timestamptz;
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'user required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.membership_plans WHERE code = p_plan AND is_active) THEN
    RAISE EXCEPTION 'plan not available: %', p_plan USING ERRCODE = '22023';
  END IF;

  SELECT s.id, s.current_period_end INTO v_id, v_from
    FROM public.user_subscriptions s WHERE s.user_id = p_user;

  v_end := GREATEST(COALESCE(v_from, now()), now()) + make_interval(days => GREATEST(1, p_days));

  IF v_id IS NULL THEN
    INSERT INTO public.user_subscriptions
      (user_id, plan_code, status, started_at, current_period_end, cancel_at_period_end)
    VALUES (p_user, p_plan, 'active', now(), v_end, false)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.user_subscriptions s
       SET plan_code = p_plan,
           status = 'active',
           current_period_end = v_end,
           cancel_at_period_end = false,
           updated_at = now()
     WHERE s.id = v_id;
  END IF;

  RETURN QUERY
    SELECT s.id, s.plan_code, s.status, s.current_period_end
      FROM public.user_subscriptions s WHERE s.id = v_id;
END $$;

/**
 * 해지. 기본은 **기간 만료 시 해지**(이미 낸 돈만큼은 쓴다).
 * p_immediate 를 주면 즉시 종료한다(환불 처리는 결제사 쪽 일이다).
 */
CREATE OR REPLACE FUNCTION public.cancel_subscription_admin(
  p_user      uuid,
  p_immediate boolean DEFAULT false
)
RETURNS TABLE(status text, cancel_at_period_end boolean, current_period_end timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions s WHERE s.user_id = p_user) THEN
    RAISE EXCEPTION 'subscription not found' USING ERRCODE = '42704';
  END IF;

  UPDATE public.user_subscriptions s
     SET status = CASE WHEN p_immediate THEN 'canceled' ELSE s.status END,
         current_period_end = CASE WHEN p_immediate THEN now() ELSE s.current_period_end END,
         cancel_at_period_end = true,
         updated_at = now()
   WHERE s.user_id = p_user;

  RETURN QUERY
    SELECT s.status, s.cancel_at_period_end, s.current_period_end
      FROM public.user_subscriptions s WHERE s.user_id = p_user;
END $$;

/**
 * 주문을 결제 완료로 바꾼다.
 * **금액을 대조한다** — 5만원짜리 주문을 100원 결제로 통과시킬 수 없게.
 * 이미 PAID 면 아무것도 하지 않고 알려준다(멱등).
 */
CREATE OR REPLACE FUNCTION public.mark_order_paid_admin(
  p_order   uuid,
  p_payment uuid
)
RETURNS TABLE(order_id uuid, status text, total_krw integer, was_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   public.orders;
  v_payment public.payments;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = '42704';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = '42704';
  END IF;

  IF v_payment.user_id IS DISTINCT FROM v_order.user_id THEN
    RAISE EXCEPTION 'payment does not belong to this order owner' USING ERRCODE = '42501';
  END IF;
  IF v_payment.kind <> 'order' OR v_payment.order_id IS DISTINCT FROM p_order THEN
    RAISE EXCEPTION 'payment is not for this order' USING ERRCODE = '22023';
  END IF;
  IF v_payment.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'payment is not approved' USING ERRCODE = '22023';
  END IF;
  IF v_payment.amount_krw <> v_order.total_krw THEN
    RAISE EXCEPTION 'amount mismatch: paid % but order total is %',
      v_payment.amount_krw, v_order.total_krw USING ERRCODE = '22023';
  END IF;

  IF v_order.status = 'PAID' THEN
    RETURN QUERY SELECT v_order.id, v_order.status, v_order.total_krw, false;
    RETURN;
  END IF;
  IF v_order.status <> 'PENDING' THEN
    RAISE EXCEPTION 'order is % and cannot be paid', v_order.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders SET status = 'PAID', paid_at = now() WHERE id = p_order;

  RETURN QUERY SELECT p_order, 'PAID'::text, v_order.total_krw, true;
END $$;

-- ---------------------------------------------------------------------------
-- 4-1) create_order 에 배송지 붙이기
--
--     기존 create_order(jsonb, integer) 는 배송지를 받지 않았고, 앱은 orders 를
--     UPDATE 할 수 없으므로 나중에 채워 넣을 방법도 없다.
--     세 번째 인자를 기본값과 함께 추가한다 — 인자 2개로 부르던 기존 호출은 그대로 동작한다.
--     (기본값 있는 인자를 덧붙이는 건 CREATE OR REPLACE 로 안 되므로 DROP 후 다시 만든다)
--
--     본문은 기존 함수 그대로이고, 배송지 검증과 스냅샷 복사만 더했다.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_order(jsonb, integer);

CREATE OR REPLACE FUNCTION public.create_order(
  p_items          jsonb,
  p_reward_to_use  integer DEFAULT 0,
  p_address_id     uuid DEFAULT NULL
)
RETURNS TABLE(order_id uuid, subtotal integer, reward_used integer, total integer, balance integer)
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
  v_addr     public.user_addresses;
  v_snapshot jsonb := NULL;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'no items' USING ERRCODE = '22023';
  END IF;

  -- 배송지를 줬다면 **내 배송지여야 한다.**
  IF p_address_id IS NOT NULL THEN
    SELECT * INTO v_addr FROM public.user_addresses
     WHERE id = p_address_id AND user_id = v_user;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'address not found' USING ERRCODE = '42501';
    END IF;
    -- 주문 시점의 사본. 나중에 배송지를 고치거나 지워도 주문 내역은 그대로 남는다.
    v_snapshot := jsonb_build_object(
      'recipient', v_addr.recipient,
      'phone',     v_addr.phone,
      'postcode',  v_addr.postcode,
      'address1',  v_addr.address1,
      'address2',  COALESCE(v_addr.address2, ''),
      'memo',      COALESCE(v_addr.memo, '')
    );
  END IF;

  -- 같은 사용자의 동시 주문을 직렬화한다. 두 탭에서 동시에 쓰면 잔액이 음수가 될 수 있다.
  PERFORM pg_advisory_xact_lock(hashtext(v_user::text));

  v_order := gen_random_uuid();

  -- 1단계: 상품을 검증하고 소계를 계산한다.
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
  INSERT INTO public.orders
    (id, user_id, status, subtotal_krw, reward_used, total_krw, address_id, shipping_snapshot)
  VALUES
    (v_order, v_user, 'PENDING', v_subtotal, v_use, v_subtotal - v_use, p_address_id, v_snapshot);

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

REVOKE ALL ON FUNCTION public.create_order(jsonb, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, integer, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) 권한 — 앱에서는 위 함수를 부를 수 없어야 한다
--
--    PostgREST 는 public 스키마의 함수를 authenticated 에게 그대로 노출한다.
--    기본 GRANT 가 PUBLIC 에 걸리므로 **명시적으로 회수**해야 한다.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.record_payment_admin(uuid, text, text, text, integer, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_subscription_admin(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_subscription_admin(uuid, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_order_paid_admin(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_payment_admin(uuid, text, text, text, integer, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_subscription_admin(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_subscription_admin(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_order_paid_admin(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) 확인
-- ---------------------------------------------------------------------------

-- 앱(authenticated)이 부를 수 있으면 안 되는 함수들 — 전부 false 여야 한다
SELECT p.proname AS 함수,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS "앱에서_호출가능",
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS "서버에서_호출가능"
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('record_payment_admin', 'activate_subscription_admin',
                     'cancel_subscription_admin', 'mark_order_paid_admin')
 ORDER BY p.proname;

-- 새 테이블 권한
SELECT table_name AS 테이블, grantee AS 역할,
       string_agg(privilege_type, ',' ORDER BY privilege_type) AS 권한
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND table_name IN ('payments', 'user_addresses')
   AND grantee IN ('anon', 'authenticated')
 GROUP BY table_name, grantee
 ORDER BY table_name, grantee;
