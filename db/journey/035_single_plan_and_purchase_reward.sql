-- ===========================================================================
-- MEBODY — 요금제 단일화 + 구매 5% 적립
--
-- 1) 요금제를 ₩5,900 하나로 정리한다. Pro 는 지우지 않고 비활성만 한다
--    (user_subscriptions 가 plan_code 로 참조하므로 지우면 이력이 깨진다).
-- 2) 단일 요금제이므로 Pro 가 갖던 적립 배수 2.0 을 그대로 내린다.
-- 3) 멤버가 결과 페이지에서 상품을 사면 결제액의 5% 를 적립한다.
--    구독료를 정당화하는 실질 혜택은 주사위 배수가 아니라 이쪽이다.
--    (주사위는 2.0배로도 한 달 최대 약 360원이지만,
--     30,000원짜리 하나만 사도 5% = 1,500원이다)
--
-- 선행: 020~034 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 요금제 단일화
-- ---------------------------------------------------------------------------
UPDATE public.membership_plans
   SET name              = 'mebody 멤버십',
       description       = '14일 관리 무제한 · 광고 없이 이용 · 적립 2배 · 상품 구매 5% 적립',
       reward_multiplier = 2.0,
       is_active         = true,
       sort_order        = 1,
       updated_at        = now()
 WHERE code = 'basic_monthly';

-- Pro 는 비활성. 화면에서 사라지고 신규 가입도 막히지만,
-- 과거 구독 이력의 FK 는 그대로 유지된다.
UPDATE public.membership_plans
   SET is_active = false, updated_at = now()
 WHERE code = 'pro_monthly';

-- ---------------------------------------------------------------------------
-- 2) 원장이 구매 적립을 받도록 CHECK 확장
--    source_type 'order' 는 이미 허용돼 있다. entry_type 만 추가한다.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS user_rewards_entry_type_check;
ALTER TABLE public.user_rewards ADD  CONSTRAINT user_rewards_entry_type_check CHECK (entry_type IN
  ('earn_mission','earn_journey','earn_routine','earn_purchase','earn_subscription',
   'spend_order','refund_order','expire'));

ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS user_rewards_sign_check;
ALTER TABLE public.user_rewards ADD  CONSTRAINT user_rewards_sign_check CHECK (
  (entry_type IN ('earn_mission','earn_journey','earn_routine','earn_purchase',
                  'earn_subscription','refund_order') AND amount > 0)
  OR (entry_type IN ('spend_order','expire') AND amount < 0)
);

-- ---------------------------------------------------------------------------
-- 3) 구매 적립 규칙 — 비율은 reward_rules 로 운영에서 바꿀 수 있게 둔다.
--    reward_rules 는 정액/가중치만 지원하므로 "5" 를 퍼센트로 해석해 쓴다.
-- ---------------------------------------------------------------------------
INSERT INTO public.reward_rules
  (code, name, display_label, disclosure, min_amount, max_amount, fixed_amount, is_active)
VALUES (
  'purchase_cashback',
  '상품 구매 적립',
  '멤버십 구매 적립 5%',
  '멤버십 회원이 mebody 에서 상품을 구매하면 실제 결제 금액(적립금 사용분 제외)의 5%가 적립됩니다. 적립금은 다음 구매에 사용할 수 있으며, 주문을 취소하면 함께 회수됩니다.',
  NULL, NULL,
  5,          -- 퍼센트
  true
)
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  display_label = EXCLUDED.display_label,
  disclosure    = EXCLUDED.disclosure,
  fixed_amount  = EXCLUDED.fixed_amount,
  is_active     = EXCLUDED.is_active;

-- ---------------------------------------------------------------------------
-- 4) 적립 비율 조회 — 비회원/무료 회원은 0%
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_cashback_percent(p_user uuid)
RETURNS integer
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pct integer;
BEGIN
  IF p_user IS NULL THEN RETURN 0; END IF;
  IF NOT public.has_active_subscription(p_user) THEN RETURN 0; END IF;

  SELECT fixed_amount INTO v_pct
    FROM public.reward_rules WHERE code = 'purchase_cashback' AND is_active;

  RETURN COALESCE(v_pct, 0);
END $$;

-- ---------------------------------------------------------------------------
-- 5) 구매 적립 지급 — 본인의 결제 완료 주문에 대해 1회만
--    적립금으로 깎은 금액에는 적립하지 않는다(현금 결제분 = total_krw 에만).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_purchase_reward(p_order_id uuid)
RETURNS TABLE (amount integer, percent integer, already_claimed boolean, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_paid  integer;
  v_pct   integer;
  v_amt   integer;
  v_prev  integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  -- 본인의 결제 완료 주문인지 확인한다.
  -- orders 는 total_krw = subtotal_krw - reward_used 제약이 있으므로
  -- total_krw 자체가 이미 "적립금 차감 후 실제 결제액" 이다. 다시 빼면 안 된다.
  SELECT o.total_krw
    INTO v_paid
    FROM public.orders o
   WHERE o.id = p_order_id
     AND o.user_id = v_user
     AND o.status = 'PAID';

  IF v_paid IS NULL THEN
    RAISE EXCEPTION 'order not found or not payable' USING ERRCODE = '42501';
  END IF;

  -- 같은 주문에 두 번 지급하지 않는다 (UNIQUE 로도 막히지만 먼저 확인해 알려준다)
  SELECT r.amount INTO v_prev
    FROM public.user_rewards r
   WHERE r.user_id = v_user AND r.entry_type = 'earn_purchase' AND r.source_id = p_order_id;

  IF v_prev IS NOT NULL THEN
    RETURN QUERY SELECT v_prev, public.purchase_cashback_percent(v_user), true, public.reward_balance(v_user);
    RETURN;
  END IF;

  v_pct := public.purchase_cashback_percent(v_user);
  v_amt := floor(v_paid * v_pct / 100.0)::int;

  IF v_amt <= 0 THEN
    -- 무료 회원이거나 금액이 작아 1원도 안 되면 원장에 남기지 않는다.
    RETURN QUERY SELECT 0, v_pct, false, public.reward_balance(v_user);
    RETURN;
  END IF;

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, memo)
  VALUES
    (v_user, 'earn_purchase', 'purchase_cashback', v_amt, 'free', 'order', p_order_id,
     format('결제 %s원의 %s%%', v_paid, v_pct));

  RETURN QUERY SELECT v_amt, v_pct, false, public.reward_balance(v_user);
END $$;

-- ---------------------------------------------------------------------------
-- 6) 권한
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.purchase_cashback_percent(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_purchase_reward(uuid)     FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_purchase_reward(uuid) TO authenticated;
