-- ===========================================================================
-- MEBODY — 보상형 광고 보너스 주사위 (하루 1회, 무료 회원만)
--
-- 구조: 완료하면 기본 주사위(1~6원)를 광고 없이 그냥 준다.
--       그 뒤에 "광고 보고 한 번 더"를 선택지로 둔다. 강제하지 않는다.
--       → AdMob 보상형 정책(자발적 선택)에 맞고, 광고를 안 봐도 이탈하지 않는다.
--
-- 유료 회원은 광고가 없으므로 이 보너스도 없다. 대신 적립 2배를 받는다.
-- 화면에서 숨기는 것만으로는 부족해 함수에서 직접 막는다.
--
-- 부정 사용 한계(알고 쓰는 것):
--   AdMob 서버 사이드 검증(SSV)은 콜백을 받을 서버가 필요한데 지금은 없다.
--   그래서 v1 은 클라이언트가 "광고를 다 봤다"고 알려주는 것을 믿는다.
--   다만 **하루 1회 + 최대 6원** 이라 악용해도 상한이 하루 6원이다.
--   SSV 가 필요해지면 Supabase Edge Function 을 콜백으로 두고
--   이 함수에 검증 토큰 인자를 추가하면 된다.
--
-- 선행: 020~035 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 원장 CHECK 확장
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS user_rewards_entry_type_check;
ALTER TABLE public.user_rewards ADD  CONSTRAINT user_rewards_entry_type_check CHECK (entry_type IN
  ('earn_mission','earn_journey','earn_routine','earn_routine_bonus','earn_purchase',
   'earn_subscription','spend_order','refund_order','expire'));

ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS user_rewards_sign_check;
ALTER TABLE public.user_rewards ADD  CONSTRAINT user_rewards_sign_check CHECK (
  (entry_type IN ('earn_mission','earn_journey','earn_routine','earn_routine_bonus',
                  'earn_purchase','earn_subscription','refund_order') AND amount > 0)
  OR (entry_type IN ('spend_order','expire') AND amount < 0)
);

-- ---------------------------------------------------------------------------
-- 2) 보너스 규칙 — 기본 주사위와 같은 1~6 균등
-- ---------------------------------------------------------------------------
INSERT INTO public.reward_rules
  (code, name, display_label, disclosure, min_amount, max_amount, weights, is_active)
VALUES (
  'routine_bonus_dice',
  '광고 보너스 주사위',
  '광고 보고 한 번 더 · 최대 6원',
  '공통 스트레칭을 완료한 무료 회원이 광고를 끝까지 시청하면 주사위를 한 번 더 굴려 1~6원이 추가 적립됩니다. 각 눈이 나올 확률은 1/6로 같습니다. 하루 1회이며, 하루의 기준은 한국시간 오전 5시입니다. 광고 시청은 선택이며, 보지 않아도 기본 적립은 그대로 받습니다.',
  1, 6,
  '{"1":1,"2":1,"3":1,"4":1,"5":1,"6":1}'::jsonb,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  display_label = EXCLUDED.display_label,
  disclosure    = EXCLUDED.disclosure,
  min_amount    = EXCLUDED.min_amount,
  max_amount    = EXCLUDED.max_amount,
  weights       = EXCLUDED.weights,
  is_active     = EXCLUDED.is_active;

-- ---------------------------------------------------------------------------
-- 3) 보너스 지급
--    조건: 로그인 · 무료 회원 · 오늘 기본 적립을 이미 받았을 것 · 하루 1회
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_routine_bonus_reward()
RETURNS TABLE (dice integer, amount integer, already_claimed boolean, balance integer, service_day date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_day    date;
  v_source uuid;
  v_base   uuid;
  v_prev   public.user_rewards;
  v_dice   integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  -- 유료 회원은 광고가 없으므로 보너스도 없다.
  IF public.has_active_subscription(v_user) THEN
    RAISE EXCEPTION 'membership has no ads' USING ERRCODE = '42501';
  END IF;

  v_day    := public.mebody_service_day();
  v_source := md5(v_user::text || ':routine_bonus:' || v_day::text)::uuid;
  v_base   := md5(v_user::text || ':routine:' || v_day::text)::uuid;

  PERFORM pg_advisory_xact_lock(hashtext('mebody_routine_bonus'), hashtext(v_user::text));

  -- 기본 적립을 받지 않았다면 보너스만 먼저 받을 수 없다.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_rewards
     WHERE user_id = v_user AND entry_type = 'earn_routine' AND source_id = v_base
  ) THEN
    RAISE EXCEPTION 'complete the routine first' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_prev
    FROM public.user_rewards
   WHERE user_id = v_user AND entry_type = 'earn_routine_bonus' AND source_id = v_source;

  IF FOUND THEN
    RETURN QUERY SELECT
      COALESCE((v_prev.memo)::jsonb ->> 'dice', v_prev.amount::text)::int,
      v_prev.amount, true, public.reward_balance(v_user), v_day;
    RETURN;
  END IF;

  v_dice := public.draw_reward_amount('routine_bonus_dice');
  IF v_dice < 1 THEN v_dice := 1; END IF;
  IF v_dice > 6 THEN v_dice := 6; END IF;

  -- 보너스는 무료 회원 전용이므로 등급 배수를 곱하지 않는다(항상 1.0배).
  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, memo)
  VALUES
    (v_user, 'earn_routine_bonus', 'routine_bonus_dice', v_dice, 'free', 'routine', v_source,
     jsonb_build_object('dice', v_dice, 'service_day', v_day, 'source', 'rewarded_ad')::text);

  RETURN QUERY SELECT v_dice, v_dice, false, public.reward_balance(v_user), v_day;
END $$;

-- ---------------------------------------------------------------------------
-- 4) 오늘 보너스를 받을 수 있는 상태인지 (버튼 노출 판단용, 적립하지 않음)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.today_routine_bonus()
RETURNS TABLE (eligible boolean, claimed boolean, dice integer, amount integer, reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_day  date;
  v_row  public.user_rewards;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  IF public.has_active_subscription(v_user) THEN
    RETURN QUERY SELECT false, false, NULL::int, NULL::int, 'membership';
    RETURN;
  END IF;

  v_day := public.mebody_service_day();

  SELECT * INTO v_row
    FROM public.user_rewards
   WHERE user_id = v_user AND entry_type = 'earn_routine_bonus'
     AND source_id = md5(v_user::text || ':routine_bonus:' || v_day::text)::uuid;

  IF FOUND THEN
    RETURN QUERY SELECT false, true,
      COALESCE((v_row.memo)::jsonb ->> 'dice', v_row.amount::text)::int,
      v_row.amount, 'claimed';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_rewards
     WHERE user_id = v_user AND entry_type = 'earn_routine'
       AND source_id = md5(v_user::text || ':routine:' || v_day::text)::uuid
  ) THEN
    RETURN QUERY SELECT false, false, NULL::int, NULL::int, 'routine_not_done';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, false, NULL::int, NULL::int, 'ready';
END $$;

-- ---------------------------------------------------------------------------
-- 5) 권한
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.claim_routine_bonus_reward() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.today_routine_bonus()        FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_routine_bonus_reward() TO authenticated;
GRANT EXECUTE ON FUNCTION public.today_routine_bonus()        TO authenticated;
