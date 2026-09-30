-- ===========================================================================
-- MEBODY — 주사위 적립 재설계 + 고지 문구 (2026-09-30)
--
-- ※ db/journey 폴더의 072 입니다.
--
-- WHAT
--   · 눈이 곧 금액입니다. 1눈 1원 … 6눈 6원.
--   · 하루 2번 굴립니다 — 1번은 루틴을 마치면, 1번은 광고를 본 뒤.
--   · 눈은 고르게 나오지 않습니다. 낮은 눈이 훨씬 자주 나옵니다.
--   · 한 달 예산 150원. 가까워지면 조용히 낮은 눈으로 몰립니다.
--
-- 확률표
--   1눈 27.33%   2눈 27.33%   3눈 27.33%   4눈 9%   5눈 6%   6눈 3%
--   → 한 번 평균 2.48원 → 하루 2번 4.96원 → 한 달 149원 (예산 150원 안)
--
-- **기존 함수의 구조를 바꾸지 않습니다.**
--   앞선 초안에서 세 함수를 새로 쓰다가 반환 컬럼·entry_type·source 소금·
--   원장 컬럼·멤버십 배수·월 잔여 한도를 통째로 빠뜨렸습니다. 그대로 적용했다면
--   적립 원장이 어긋나고 잔액이 틀어졌을 겁니다.
--   이 파일은 057·067 의 본문을 그대로 두고 **주사위를 뽑는 한 줄만** 바꿉니다.
--     draw_reward_amount(code)  →  draw_weighted_dice(reward_squeeze_for(user))
--
--   바꾸는 함수는 셋입니다. 하나라도 빠지면 경로마다 다른 확률이 됩니다.
--     claim_daily_routine_reward()   앱 · 기본 굴리기
--     claim_routine_bonus_reward()   앱 · 광고를 본 굴리기(SSV 꺼짐일 때)
--     grant_routine_bonus_admin()    서버 · 광고를 본 굴리기(SSV 켜짐일 때)
--
-- 화면에 확률·상한·예산을 적지 않습니다.
--   가중치를 두면 "각각 1/6 확률로 고르게" 는 사실이 아니게 됩니다. 그래서 지웁니다.
--   확률을 적으면 표를 손볼 때마다 문구가 또 어긋나므로 아예 말하지 않습니다.
--   남기는 고지: 보상형의 "보지 않아도 기본 적립은 그대로" — AdMob 인센티브 광고
--   정책이 요구하는 것이고, 빼면 계정이 위험합니다.
--
-- 선행: 057 · 058 · 063 · 066 · 067 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 월 예산 49원 → 150원 (내부 값. 화면에 고지하지 않습니다)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reward_monthly_cap()
RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 150 $$;

COMMENT ON FUNCTION public.reward_monthly_cap() IS
  '무료 적립의 한 달 상한. 내부 예산이며 화면에 고지하지 않는다.';

-- ---------------------------------------------------------------------------
-- 지급표 — 눈이 곧 금액
-- ---------------------------------------------------------------------------
UPDATE public.reward_rules
   SET payout = '{"1":1,"2":2,"3":3,"4":4,"5":5,"6":6}'::jsonb,
       max_amount = 6
 WHERE code IN ('daily_routine_dice', 'routine_bonus_dice');

-- ---------------------------------------------------------------------------
-- draw_weighted_dice() — 확률표로 눈 하나를 뽑습니다.
--
--   p_squeeze  0 = 평소, 1 = 예산 소진 임박. 그 사이는 두 표를 섞습니다.
--
-- 가중치는 3000 기준 정수입니다. 소수로 두면 합이 딱 안 맞습니다.
--   평소        1·2·3 각 820(27.33%)  4:270(9%)  5:180(6%)  6:90(3%)
--   최대로 조임 1:2700(90%) 2:180(6%) 3:60(2%) 4:30(1%) 5:21(0.7%) 6:9(0.3%)
--
-- 조인 상태에서도 **모든 눈이 0 보다 큰 확률**을 갖습니다. 완전히 막으면 같은 눈만
-- 반복해서 나와 금방 알아챕니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.draw_weighted_dice(p_squeeze numeric DEFAULT 0)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'public'
AS $$
DECLARE
  v_sq    numeric := GREATEST(0, LEAST(1, COALESCE(p_squeeze, 0)));
  v_base  int[] := ARRAY[820, 820, 820, 270, 180, 90];
  v_tight int[] := ARRAY[2700, 180, 60, 30, 21, 9];
  v_w     numeric[] := ARRAY[]::numeric[];
  v_face  int;
  v_total numeric := 0;
  v_roll  numeric;
  v_acc   numeric := 0;
BEGIN
  FOR v_face IN 1..6 LOOP
    v_w := v_w || (v_base[v_face] * (1 - v_sq) + v_tight[v_face] * v_sq);
    v_total := v_total + v_w[v_face];
  END LOOP;

  v_roll := random() * v_total;
  FOR v_face IN 1..6 LOOP
    v_acc := v_acc + v_w[v_face];
    IF v_roll <= v_acc THEN RETURN v_face; END IF;
  END LOOP;
  RETURN 6;
END;
$$;

REVOKE ALL ON FUNCTION public.draw_weighted_dice(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.draw_weighted_dice(numeric) TO service_role;

COMMENT ON FUNCTION public.draw_weighted_dice(numeric) IS
  '주사위 눈을 확률표로 뽑는다. squeeze 가 오를수록 낮은 눈으로 몰린다. 확률은 고지하지 않는다.';

-- ---------------------------------------------------------------------------
-- reward_squeeze_for() — 남은 예산이 절반 밑으로 내려가면 조이기 시작합니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reward_squeeze_for(p_user uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.reward_monthly_cap() <= 0 THEN 1
    ELSE GREATEST(0, LEAST(1,
      1 - (public.reward_remaining_this_month(p_user)::numeric
           / (public.reward_monthly_cap()::numeric * 0.5))))
  END
$$;

REVOKE ALL ON FUNCTION public.reward_squeeze_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reward_squeeze_for(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- ① 앱 · 기본 굴리기 — 057 본문 그대로, 주사위 뽑는 줄만 교체
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_routine_reward()
RETURNS TABLE(dice integer, amount integer, already_claimed boolean, balance integer, multiplier numeric, service_day date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_day    date;
  v_source uuid;
  v_prev   public.user_rewards;
  v_dice   integer;
  v_mult   numeric;
  v_amount integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  v_day := public.mebody_service_day();
  v_source := md5(v_user::text || ':routine:' || v_day::text)::uuid;

  PERFORM pg_advisory_xact_lock(hashtext('mebody_routine_reward'), hashtext(v_user::text));

  SELECT * INTO v_prev
    FROM public.user_rewards
   WHERE user_id = v_user AND entry_type = 'earn_routine' AND source_id = v_source;

  IF FOUND THEN
    RETURN QUERY SELECT
      COALESCE((v_prev.memo)::jsonb ->> 'dice', v_prev.amount::text)::int,
      v_prev.amount, true, public.reward_balance(v_user), 1.0::numeric, v_day;
    RETURN;
  END IF;

  -- ★ 바뀐 곳: 고른 추첨 → 가중 추첨(예산이 줄수록 낮은 눈으로).
  v_dice := public.draw_weighted_dice(public.reward_squeeze_for(v_user));

  v_mult   := public.reward_multiplier_for(v_user);
  v_amount := GREATEST(0, round(public.reward_payout_for('daily_routine_dice', v_dice) * v_mult)::int);
  v_amount := LEAST(v_amount, public.reward_remaining_this_month(v_user));

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, memo)
  VALUES
    (v_user, 'earn_routine', 'daily_routine_dice', v_amount, 'free', 'routine', v_source,
     jsonb_build_object('dice', v_dice, 'multiplier', v_mult, 'service_day', v_day)::text);

  RETURN QUERY SELECT v_dice, v_amount, false, public.reward_balance(v_user), v_mult, v_day;
END $$;

-- ---------------------------------------------------------------------------
-- ② 앱 · 광고를 본 굴리기 (SSV 꺼짐일 때) — 057 본문 그대로
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_routine_bonus_reward()
RETURNS TABLE(dice integer, amount integer, already_claimed boolean, balance integer, service_day date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_day    date;
  v_source uuid;
  v_base   uuid;
  v_prev   public.user_rewards;
  v_dice   integer;
  v_amount integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  IF public.has_active_subscription(v_user) THEN
    RAISE EXCEPTION 'membership has no ads' USING ERRCODE = '42501';
  END IF;

  v_day    := public.mebody_service_day();
  v_source := md5(v_user::text || ':routine_bonus:' || v_day::text)::uuid;
  v_base   := md5(v_user::text || ':routine:' || v_day::text)::uuid;

  PERFORM pg_advisory_xact_lock(hashtext('mebody_routine_bonus'), hashtext(v_user::text));

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

  -- ★ 바뀐 곳
  v_dice := public.draw_weighted_dice(public.reward_squeeze_for(v_user));

  -- 보너스는 등급 배수를 곱하지 않습니다(무료 회원 전용).
  v_amount := public.reward_payout_for('routine_bonus_dice', v_dice);
  v_amount := LEAST(v_amount, public.reward_remaining_this_month(v_user));

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, memo)
  VALUES
    (v_user, 'earn_routine_bonus', 'routine_bonus_dice', v_amount, 'free', 'routine', v_source,
     jsonb_build_object('dice', v_dice, 'service_day', v_day, 'source', 'rewarded_ad')::text);

  RETURN QUERY SELECT v_dice, v_amount, false, public.reward_balance(v_user), v_day;
END $$;

-- ---------------------------------------------------------------------------
-- ③ 서버 · 광고를 본 굴리기 (SSV 켜짐일 때) — 067 본문 그대로
-- ---------------------------------------------------------------------------
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

  -- ★ 바뀐 곳
  v_dice := public.draw_weighted_dice(public.reward_squeeze_for(p_user));

  v_amount := public.reward_payout_for('routine_bonus_dice', v_dice);
  v_amount := LEAST(v_amount, public.reward_remaining_this_month(p_user));

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, memo)
  VALUES
    (p_user, 'earn_routine_bonus', 'routine_bonus_dice', v_amount, 'free', 'routine', v_source,
     jsonb_build_object('dice', v_dice, 'service_day', v_day, 'source', 'admob_ssv')::text);

  RETURN QUERY SELECT v_dice, v_amount, false, public.reward_balance(p_user), v_day;
END $$;

-- ---------------------------------------------------------------------------
-- 고지 문구 — 확률도 상한도 말하지 않습니다.
-- ---------------------------------------------------------------------------
UPDATE public.reward_rules SET disclosure =
  '주사위를 굴리면 적립금이 쌓여요. 모은 적립금은 마켓에서 쓰실 수 있습니다.'
WHERE code = 'daily_routine_dice';

-- 보상형만 한 줄이 더 붙습니다. "보지 않아도 기본 적립은 그대로" 는 AdMob 인센티브 광고
-- 정책이 요구하는 고지라 뺄 수 없습니다 — 빼면 계정이 위험합니다.
UPDATE public.reward_rules SET disclosure =
  '광고를 보면 주사위를 한 번 더 굴릴 수 있어요. '
  '보고 싶을 때만 보세요 — 보지 않아도 기본 적립은 그대로 받습니다.'
WHERE code = 'routine_bonus_dice';

UPDATE public.reward_rules SET disclosure =
  '미션을 마치면 적립금이 쌓여요. 모은 적립금은 마켓에서 쓰실 수 있습니다.'
WHERE code = 'daily_mission';

UPDATE public.reward_rules SET disclosure =
  '14일 루틴을 끝까지 마치면 적립금을 드려요. 모은 적립금은 마켓에서 쓰실 수 있습니다.'
WHERE code = 'journey_complete';

UPDATE public.reward_rules SET disclosure =
  '한 달에 20일 이상 마치면 적립금을 드려요. 모은 적립금은 마켓에서 쓰실 수 있습니다.'
WHERE code = 'monthly_challenge';

UPDATE public.reward_rules SET disclosure =
  '한 주에 7일을 모두 마치면 적립금을 드려요. 모은 적립금은 마켓에서 쓰실 수 있습니다.'
WHERE code = 'weekly_challenge';

UPDATE public.reward_rules SET disclosure =
  '멤버십 회원이 mebody 에서 상품을 사면 실제 결제 금액의 5%를 적립해 드려요(적립금으로 낸 몫은 빼고 계산합니다). '
  '모은 적립금은 다음 구매에 쓰실 수 있고, 주문을 취소하면 함께 돌아갑니다.'
WHERE code = 'purchase_cashback';

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_txt text; v_n int;
BEGIN
  IF public.reward_monthly_cap() <> 150 THEN
    RAISE EXCEPTION '072 실패: 월 예산이 150원이 아닙니다';
  END IF;

  IF (SELECT payout FROM public.reward_rules WHERE code = 'daily_routine_dice')
     <> '{"1":1,"2":2,"3":3,"4":4,"5":5,"6":6}'::jsonb THEN
    RAISE EXCEPTION '072 실패: 지급표가 눈=금액이 아닙니다';
  END IF;

  -- 사실이 아니게 된 옛 문구가 남아 있으면 안 됩니다.
  SELECT count(*) INTO v_n FROM public.reward_rules
   WHERE is_active AND (disclosure LIKE '%1/6%' OR disclosure LIKE '%한 달 49원%');
  IF v_n > 0 THEN
    RAISE EXCEPTION '072 실패: 옛 확률·상한 문구가 %개 남아 있습니다', v_n;
  END IF;

  -- AdMob 정책 고지는 남아야 합니다.
  SELECT disclosure INTO v_txt FROM public.reward_rules WHERE code = 'routine_bonus_dice';
  IF v_txt NOT LIKE '%보지 않아도%' THEN
    RAISE EXCEPTION '072 실패: 보상형의 "보지 않아도 기본 적립" 고지가 빠졌습니다';
  END IF;

  -- 세 경로가 모두 가중 추첨을 쓰는지. 하나라도 빠지면 경로마다 확률이 달라집니다.
  FOR v_txt IN
    SELECT p.proname FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND p.proname IN ('claim_daily_routine_reward','claim_routine_bonus_reward','grant_routine_bonus_admin')
       AND p.prosrc NOT LIKE '%draw_weighted_dice%'
  LOOP
    RAISE EXCEPTION '072 실패: %() 가 아직 옛 추첨을 씁니다', v_txt;
  END LOOP;

  RAISE NOTICE '072 OK — 눈=금액, 하루 2번, 예산 150원, 세 경로 모두 가중 추첨.';
END;
$$;
