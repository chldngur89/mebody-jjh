-- ===========================================================================
-- MEBODY — 주문 이후 흐름(배송·취소) + 보상형 광고 서버 검증(SSV)
--
-- 확인한 현재 상태:
--   · orders.status 는 **결제 상태**(PENDING/PAID/CANCELED/FAILED)만 있고
--     배송이 어디까지 갔는지 담을 곳이 없다.
--   · cancel_order(앱용)는 PAID 주문을 거부한다("paid order cannot be canceled here").
--     결제까지 끝난 주문을 취소할 방법이 아예 없었다.
--   · 보상형 광고 보너스는 앱이 claim_routine_bonus_reward() 를 직접 부른다.
--     광고를 실제로 봤는지 **서버가 확인하지 않는다**(클라이언트를 믿는 구조).
--   · user_rewards 제약:
--       entry_type IN (earn_*, spend_order, refund_order, expire)
--       earn_*/refund_order 는 amount > 0, spend_order/expire 는 amount < 0
--       UNIQUE(user_id, entry_type, source_id)
--     → 적립을 되돌릴 때 음수 earn_purchase 는 넣을 수 없다. expire 를 쓴다.
--
-- 이 파일이 하는 일:
--   1) orders 에 배송 상태·송장 컬럼
--   2) 배송 상태 변경 (판매자·관리자 → 서버 전용 함수)
--   3) 결제 완료 주문 취소 (서버 전용). 적립금 환불 + 구매적립 회수까지 한 번에
--   4) 보상형 광고 SSV 콜백 원장 + 서버가 보너스를 지급하는 함수
--   5) 적립 내역 라벨 정리
--
-- 선행: 020~041 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 배송 상태
--
--    결제 상태(status)와 배송 상태(fulfillment_status)는 다른 축이다.
--    결제가 안 끝난 주문은 배송이 시작될 수 없으므로 기본값은 NONE 이다.
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'NONE';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_carrier text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_no text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_fulfillment_status_check
  CHECK (fulfillment_status IN ('NONE', 'PREPARING', 'SHIPPED', 'DELIVERED'));

COMMENT ON COLUMN public.orders.fulfillment_status IS
  '배송 단계. 결제 상태(status)와 별개 축이다. NONE→PREPARING→SHIPPED→DELIVERED 로만 나아간다.';

/**
 * 배송 상태 변경 — 서버(판매자·관리자 콘솔)만.
 * 되돌리기는 막는다. 잘못 눌러 배송완료를 취소하는 일이 생기면 데이터가 사실과 달라진다.
 */
CREATE OR REPLACE FUNCTION public.set_order_fulfillment_admin(
  p_order    uuid,
  p_status   text,
  p_carrier  text DEFAULT NULL,
  p_tracking text DEFAULT NULL
)
RETURNS TABLE(order_id uuid, fulfillment_status text, tracking_carrier text, tracking_no text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
  v_rank  int;
  v_next  int;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = '42704';
  END IF;
  IF v_order.status <> 'PAID' THEN
    RAISE EXCEPTION 'only paid orders can be shipped (order is %)', v_order.status USING ERRCODE = '22023';
  END IF;

  v_rank := CASE v_order.fulfillment_status
              WHEN 'NONE' THEN 0 WHEN 'PREPARING' THEN 1 WHEN 'SHIPPED' THEN 2 WHEN 'DELIVERED' THEN 3 END;
  v_next := CASE p_status
              WHEN 'NONE' THEN 0 WHEN 'PREPARING' THEN 1 WHEN 'SHIPPED' THEN 2 WHEN 'DELIVERED' THEN 3 END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'unknown fulfillment status: %', p_status USING ERRCODE = '22023';
  END IF;
  IF v_next < v_rank THEN
    RAISE EXCEPTION 'fulfillment cannot go backwards (% → %)', v_order.fulfillment_status, p_status
      USING ERRCODE = '22023';
  END IF;
  -- 발송 처리에는 송장이 있어야 한다. 송장 없는 '배송중' 은 고객이 확인할 방법이 없다.
  IF v_next >= 2 AND COALESCE(NULLIF(btrim(COALESCE(p_tracking, v_order.tracking_no, '')), ''), '') = '' THEN
    RAISE EXCEPTION 'tracking number required to ship' USING ERRCODE = '22023';
  END IF;

  -- 우측 참조를 테이블로 한정한다. RETURNS TABLE 의 출력 이름과 컬럼 이름이 같아서
  -- 한정하지 않으면 plpgsql 이 어느 쪽인지 몰라 42702(ambiguous)로 실패한다.
  UPDATE public.orders
     SET fulfillment_status = p_status,
         tracking_carrier = COALESCE(NULLIF(btrim(COALESCE(p_carrier, '')), ''), orders.tracking_carrier),
         tracking_no      = COALESCE(NULLIF(btrim(COALESCE(p_tracking, '')), ''), orders.tracking_no),
         shipped_at   = CASE WHEN p_status = 'SHIPPED'   AND orders.shipped_at   IS NULL THEN now() ELSE orders.shipped_at END,
         delivered_at = CASE WHEN p_status = 'DELIVERED' AND orders.delivered_at IS NULL THEN now() ELSE orders.delivered_at END
   WHERE orders.id = p_order;

  RETURN QUERY
    SELECT o.id, o.fulfillment_status, o.tracking_carrier, o.tracking_no
      FROM public.orders o WHERE o.id = p_order;
END $$;

-- ---------------------------------------------------------------------------
-- 2) 결제 완료 주문 취소 — 서버 전용
--
--    적립금 정산을 한 트랜잭션에서 같이 처리한다:
--      · 주문에 쓴 적립금 → refund_order 로 돌려준다
--      · 지급된 구매 적립(5%) → expire 로 회수한다
--        (음수 earn_purchase 는 제약이 막으므로 expire 를 쓴다)
--    배송이 시작된 뒤에는 취소할 수 없다 — 그건 반품이고 다른 절차다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_paid_order_admin(
  p_order  uuid,
  p_user   uuid,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(order_id uuid, refunded integer, clawed_back integer, balance integer, was_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   public.orders;
  v_earned  integer := 0;
  v_refund  integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user::text));

  SELECT * INTO v_order FROM public.orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = '42704';
  END IF;
  IF v_order.user_id IS DISTINCT FROM p_user THEN
    RAISE EXCEPTION 'order belongs to another user' USING ERRCODE = '42501';
  END IF;

  IF v_order.status = 'CANCELED' THEN
    RETURN QUERY SELECT v_order.id, 0, 0, public.reward_balance(p_user), false;
    RETURN;
  END IF;
  IF v_order.status <> 'PAID' THEN
    RAISE EXCEPTION 'order is % and cannot be canceled here', v_order.status USING ERRCODE = '22023';
  END IF;
  IF v_order.fulfillment_status NOT IN ('NONE', 'PREPARING') THEN
    RAISE EXCEPTION 'already shipped (%) — use a return instead', v_order.fulfillment_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
     SET status = 'CANCELED', canceled_at = now()
   WHERE orders.id = p_order;

  -- payments.order_id 로 한정한다. RETURNS TABLE 의 출력 이름이 order_id 라서
  -- 한정하지 않으면 42702(ambiguous)로 실패한다(위 UPDATE 와 같은 이유).
  UPDATE public.payments SET status = 'CANCELED'
   WHERE payments.order_id = p_order AND payments.status = 'APPROVED';

  -- 쓴 적립금 돌려주기
  IF v_order.reward_used > 0 THEN
    INSERT INTO public.user_rewards
      (user_id, entry_type, amount, issue_type, source_type, source_id, memo)
    VALUES
      (p_user, 'refund_order', v_order.reward_used, 'free', 'order', p_order,
       COALESCE(p_reason, '주문 취소로 복구'))
    ON CONFLICT (user_id, entry_type, source_id) DO NOTHING;
    v_refund := v_order.reward_used;
  END IF;

  -- 지급된 구매 적립 회수
  SELECT r.amount INTO v_earned
    FROM public.user_rewards r
   WHERE r.user_id = p_user AND r.entry_type = 'earn_purchase' AND r.source_id = p_order;

  IF COALESCE(v_earned, 0) > 0 THEN
    INSERT INTO public.user_rewards
      (user_id, entry_type, amount, issue_type, source_type, source_id, memo)
    VALUES
      (p_user, 'expire', -v_earned, 'free', 'order', p_order, '주문 취소로 구매 적립 회수')
    ON CONFLICT (user_id, entry_type, source_id) DO NOTHING;
  END IF;

  RETURN QUERY SELECT p_order, v_refund, COALESCE(v_earned, 0), public.reward_balance(p_user), true;
END $$;

-- ---------------------------------------------------------------------------
-- 3) 보상형 광고 서버 검증(SSV)
--
--    지금은 앱이 "광고 다 봤다" 고 말하면 그대로 지급한다.
--    AdMob 은 광고를 실제로 끝까지 본 경우에만 우리 서버로 콜백을 보내고,
--    그 요청에 ECDSA 서명이 붙는다. 서버가 서명을 검증하고 지급하면
--    앱을 믿지 않아도 된다.
--
--    콜백 원장을 따로 두는 이유: 같은 거래(transaction_id)가 재전송돼도
--    두 번 지급되지 않게 하고, 나중에 대사할 근거를 남기기 위해서다.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_reward_callbacks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider       text NOT NULL DEFAULT 'admob',
  transaction_id text NOT NULL,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ad_unit        text,
  reward_item    text,
  reward_amount  integer,
  custom_data    text,
  status         text NOT NULL CHECK (status IN ('GRANTED', 'ALREADY', 'REJECTED')),
  reason         text,
  raw            text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_reward_callbacks_txn_key UNIQUE (provider, transaction_id)
);

CREATE INDEX IF NOT EXISTS ad_reward_callbacks_user_idx
  ON public.ad_reward_callbacks (user_id, created_at DESC);

ALTER TABLE public.ad_reward_callbacks ENABLE ROW LEVEL SECURITY;

-- 앱은 이 원장을 볼 필요가 없다. 서버(postgres/service_role)만 다룬다.
-- ★ REVOKE ALL 을 먼저 한다 — Supabase 기본 GRANT ALL 에 TRUNCATE 가 딸려오고,
--   TRUNCATE 는 RLS 를 적용받지 않는다(041 에서 겪은 문제).
REVOKE ALL ON public.ad_reward_callbacks FROM anon, authenticated;

COMMENT ON TABLE public.ad_reward_callbacks IS
  'AdMob 보상형 광고 서버 검증(SSV) 콜백 원장. UNIQUE(provider, transaction_id) 로 재전송 중복 지급을 막는다.';

/**
 * 서버가 보상형 보너스를 지급한다.
 *
 * 규칙은 앱용 claim_routine_bonus_reward() 와 같다:
 *   · 유료 회원은 광고가 없으므로 보너스도 없다
 *   · 기본 적립(공통 스트레칭)을 받은 뒤에만
 *   · 하루 한 번 (source_id 가 사용자+날짜로 결정된다)
 * 같은 슬롯을 쓰므로 앱 경로와 서버 경로가 겹쳐도 두 번 지급되지 않는다.
 */
CREATE OR REPLACE FUNCTION public.grant_routine_bonus_admin(p_user uuid)
RETURNS TABLE(dice integer, amount integer, already_claimed boolean, balance integer, service_day date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day    date;
  v_source uuid;
  v_base   uuid;
  v_prev   public.user_rewards;
  v_dice   integer;
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'user required' USING ERRCODE = '22023';
  END IF;
  IF public.has_active_subscription(p_user) THEN
    RAISE EXCEPTION 'membership has no ads' USING ERRCODE = '42501';
  END IF;

  v_day    := public.mebody_service_day();
  v_source := md5(p_user::text || ':routine_bonus:' || v_day::text)::uuid;
  v_base   := md5(p_user::text || ':routine:' || v_day::text)::uuid;

  PERFORM pg_advisory_xact_lock(hashtext('mebody_routine_bonus'), hashtext(p_user::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.user_rewards
     WHERE user_id = p_user AND entry_type = 'earn_routine' AND source_id = v_base
  ) THEN
    RAISE EXCEPTION 'complete the routine first' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_prev
    FROM public.user_rewards
   WHERE user_id = p_user AND entry_type = 'earn_routine_bonus' AND source_id = v_source;

  IF FOUND THEN
    RETURN QUERY SELECT
      COALESCE((v_prev.memo)::jsonb ->> 'dice', v_prev.amount::text)::int,
      v_prev.amount, true, public.reward_balance(p_user), v_day;
    RETURN;
  END IF;

  v_dice := public.draw_reward_amount('routine_bonus_dice');
  IF v_dice < 1 THEN v_dice := 1; END IF;
  IF v_dice > 6 THEN v_dice := 6; END IF;

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, memo)
  VALUES
    (p_user, 'earn_routine_bonus', 'routine_bonus_dice', v_dice, 'free', 'routine', v_source,
     jsonb_build_object('dice', v_dice, 'service_day', v_day, 'source', 'admob_ssv')::text);

  RETURN QUERY SELECT v_dice, v_dice, false, public.reward_balance(p_user), v_day;
END $$;

-- ---------------------------------------------------------------------------
-- 4) 적립 내역 라벨 정리
--
--    · 'earn_routine_bonus' 라벨이 '광고 보너스' 였다. 적립을 광고 시청의 대가로
--      표기하면 AdMob 인센티브 정책과 충돌한다. 보상은 **미션 완료**의 결과로만
--      표기한다 → '추가 보너스'
--    · 취소로 회수된 적립이 '소멸' 로 보이면 무슨 일이 있었는지 알 수 없다.
--      주문에서 온 expire 는 '구매 적립 회수' 로 구분한다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reward_history(p_limit integer DEFAULT 30)
RETURNS TABLE(id uuid, entry_type text, label text, amount integer, created_at timestamptz)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT r.id, r.entry_type,
         CASE
           WHEN r.entry_type = 'earn_routine'       THEN '공통 스트레칭'
           WHEN r.entry_type = 'earn_routine_bonus' THEN '추가 보너스'
           WHEN r.entry_type = 'earn_mission'       THEN '오늘의 미션'
           WHEN r.entry_type = 'earn_journey'       THEN '14일 완주'
           WHEN r.entry_type = 'earn_weekly'        THEN '주간 완주'
           WHEN r.entry_type = 'earn_monthly'       THEN '월간 완주'
           WHEN r.entry_type = 'earn_purchase'      THEN '구매 적립'
           WHEN r.entry_type = 'earn_subscription'  THEN '멤버십 적립'
           WHEN r.entry_type = 'spend_order'        THEN '주문 사용'
           WHEN r.entry_type = 'refund_order'       THEN '주문 취소 환불'
           WHEN r.entry_type = 'expire' AND r.source_type = 'order' THEN '구매 적립 회수'
           WHEN r.entry_type = 'expire'             THEN '소멸'
           ELSE r.entry_type
         END,
         r.amount, r.created_at
    FROM public.user_rewards r
   WHERE r.user_id = v_user
   ORDER BY r.created_at DESC
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 200));
END $$;

-- ---------------------------------------------------------------------------
-- 5) 권한 — 새 함수는 앱에서 부를 수 없어야 한다
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_order_fulfillment_admin(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_paid_order_admin(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_routine_bonus_admin(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.set_order_fulfillment_admin(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_paid_order_admin(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_routine_bonus_admin(uuid) TO service_role;

-- reward_history 는 앱이 부르는 함수다(기존과 동일).
REVOKE ALL ON FUNCTION public.reward_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reward_history(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) 서버 배포 후 마지막 조이기 (지금은 실행하지 말 것)
--
--    SSV 가 켜지면 앱이 직접 보너스를 청구할 이유가 없다. 아래를 실행하면
--    보상형 보너스는 **광고를 실제로 본 경우에만**(AdMob 서명 검증) 지급된다.
--    서버가 배포되고 SSV 콜백이 실제로 들어오는 걸 확인한 뒤에 실행한다.
--    (지금 실행하면 서버 없이 쓰는 환경에서 보너스를 아예 못 받는다)
--
--    REVOKE ALL ON FUNCTION public.claim_routine_bonus_reward() FROM PUBLIC, anon, authenticated;
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 7) 확인
-- ---------------------------------------------------------------------------
SELECT p.proname AS 함수,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS "앱에서_호출가능",
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS "서버에서_호출가능"
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('set_order_fulfillment_admin', 'cancel_paid_order_admin',
                     'grant_routine_bonus_admin', 'reward_history')
 ORDER BY p.proname;

SELECT column_name AS 컬럼, data_type AS 타입
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'orders'
   AND column_name IN ('fulfillment_status', 'tracking_carrier', 'tracking_no', 'shipped_at', 'delivered_at')
 ORDER BY column_name;

SELECT grantee AS 역할, string_agg(privilege_type, ',' ORDER BY privilege_type) AS 권한
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'ad_reward_callbacks'
   AND grantee IN ('anon', 'authenticated')
 GROUP BY grantee;
