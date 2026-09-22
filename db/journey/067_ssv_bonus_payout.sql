-- ===========================================================================
-- MEBODY — 057 이 빠뜨린 적립 경로를 맞춘다 (AdMob SSV)
--
-- ※ db/journey 폴더의 067 입니다.
--
-- ── 무엇이 어긋났나
-- 057 에서 청구 함수 세 개(미션·루틴 주사위·보너스 주사위)를 눈→금액 표로 바꿨습니다.
-- 그런데 **네 번째 경로를 빠뜨렸습니다**: grant_routine_bonus_admin().
-- AdMob 보상형 광고의 서버 검증(SSV)이 부르는 함수이고, 여전히 눈을 그대로 금액으로 씁니다.
--
--     v_dice := draw_reward_amount('routine_bonus_dice');   -- 1~6
--     INSERT ... amount = v_dice                            -- 최대 6원
--
-- 앱 경로는 6눈에 1원인데 SSV 경로는 6눈에 6원입니다. 같은 보너스가 경로에 따라 6배 다릅니다.
-- verify:fulfillment 이 "주사위 6 · 6원" 으로 이걸 드러냈습니다.
--
-- 월 상한 트리거가 있어서 한 달 총액은 49원을 넘지 않습니다. 그래서 큰 사고는 아니지만,
-- **고지한 것과 다른 금액을 주는 것**이라 맞춰야 합니다. 고지에는 "6눈일 때만 1원" 이라고 적혀 있습니다.
--
-- ── 교훈
-- 함수를 바꿀 때는 같은 rule_code 를 쓰는 함수를 전부 찾아야 합니다. 이번에 그 검사를
-- verify:reward-cap 에 넣어, 앞으로는 경로가 갈리면 자동으로 걸리게 합니다.
--
-- 선행: 057 적용 완료
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.grant_routine_bonus_admin(p_user uuid)
RETURNS TABLE(dice integer, amount integer, already_claimed boolean, balance integer, service_day date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_day    date;
  v_source uuid;
  v_base   uuid;
  v_prev   public.user_rewards;
  v_dice   integer;
  v_amount integer;
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'user required' USING ERRCODE = '22023';
  END IF;

  v_day    := public.mebody_service_day();
  v_source := md5(p_user::text || ':routine_bonus:' || v_day::text)::uuid;
  v_base   := md5(p_user::text || ':routine:' || v_day::text)::uuid;

  PERFORM pg_advisory_xact_lock(hashtext('mebody_routine_bonus'), hashtext(p_user::text));

  -- 기본 적립을 받지 않았다면 보너스만 먼저 줄 수 없습니다(앱 경로와 같은 규칙).
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

  -- ★ 여기가 바뀐 곳. 눈을 금액으로 쓰지 않고 표를 거칩니다(앱 경로와 같게).
  v_amount := public.reward_payout_for('routine_bonus_dice', v_dice);
  v_amount := LEAST(v_amount, public.reward_remaining_this_month(p_user));

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, memo)
  VALUES
    (p_user, 'earn_routine_bonus', 'routine_bonus_dice', v_amount, 'free', 'routine', v_source,
     jsonb_build_object('dice', v_dice, 'service_day', v_day, 'source', 'admob_ssv')::text);

  RETURN QUERY SELECT v_dice, v_amount, false, public.reward_balance(p_user), v_day;
END $$;

COMMENT ON FUNCTION public.grant_routine_bonus_admin(uuid) IS
  'AdMob SSV 가 부르는 보너스 지급. 앱 경로(claim_routine_bonus_reward)와 같은 눈→금액 표와 월 상한을 쓴다.';

-- ---------------------------------------------------------------------------
-- 확인 — payout 표가 있는 규칙을 쓰면서 표를 거치지 않는 함수가 있는지
--
--   payout 표가 있는 규칙(주사위류)은 눈과 금액이 다릅니다. 그런 규칙을 쓰면서
--   reward_payout_for 를 안 부르면 그 경로는 눈을 그대로 금액으로 씁니다 — 지금 고친 사고입니다.
--
--   반대로 fixed_amount 만 있는 규칙(journey_complete·weekly·monthly)은 표가 없어서
--   draw_reward_amount 의 반환이 곧 금액입니다. 그건 정상이라 여기서 걸러냅니다.
-- ---------------------------------------------------------------------------
WITH payout_rules AS (
  SELECT code FROM public.reward_rules WHERE payout IS NOT NULL
)
SELECT p.proname AS "표를 거치지 않는 적립 경로"
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname <> 'draw_reward_amount'
   AND p.prosrc NOT LIKE '%reward_payout_for%'
   AND EXISTS (SELECT 1 FROM payout_rules r WHERE p.prosrc LIKE '%' || r.code || '%');
