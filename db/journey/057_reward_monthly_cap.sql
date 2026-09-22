-- ===========================================================================
-- MEBODY — 적립금을 "진짜 랜덤" 으로 바꾸고 월 상한을 건다
--
-- ※ db/journey 폴더의 057 입니다.
--
-- ── 무엇을 바꾸는가
-- 지금은 한 사람이 한 달에 평균 482원, 최대 750원까지 쌓을 수 있습니다.
-- 이걸 **평균 42원 · 상한 49원**으로 내립니다.
--
-- ── 어떻게 정직하게 줄이는가
-- 금액만 깎으면 주사위가 거짓말을 합니다. 지금 화면은 1~6 눈을 보여주고 그 눈이 곧 원이었는데,
-- 최대가 2원이 되면 "6" 을 띄우고 2원을 주게 되어 눈이 아무 뜻도 없게 됩니다.
--
-- 그래서 **눈과 금액을 분리**합니다. 주사위는 그대로 1~6 이 고르게 나오고(진짜 난수),
-- 눈마다 얼마인지는 payout 표로 정합니다. 6이 나오면 실제로 제일 좋은 결과입니다.
--
--     매일 루틴 주사위   1·2·3·4눈 → 0원   5눈 → 1원   6눈 → 2원
--     보너스 주사위      1~5눈 → 0원      6눈 → 1원
--     매일 미션          0원 75% · 1원 22% · 2원 3%
--
-- 사용자가 보는 것은 여전히 "굴려서 나온 결과" 이고, 실제로도 그렇습니다.
-- 다만 **줄 수 없는 금액을 암시하지 않습니다.** 그게 "랜덤처럼 보이게" 와 "속이기" 의 경계입니다.
--
-- ── 상한은 어디서 막는가
-- 청구 함수 여섯 개를 각각 고치면 언젠가 하나를 빠뜨립니다. 그래서 **user_rewards 에
-- BEFORE INSERT 트리거**를 답니다. 어떤 경로로 들어오든 그 달의 남은 한도를 넘지 못합니다.
-- 청구 함수도 같이 고쳐서 화면에 맞는 숫자를 돌려주게 하지만, 보증은 트리거가 합니다.
--
-- ── 구매 적립은 상한에서 제외합니다
-- purchase_cashback 은 돈을 쓴 것에 대한 환원이지 공짜로 주는 것이 아닙니다.
-- 무료 적립(미션·주사위·챌린지)만 묶습니다. 생각이 다르시면 아래 v_capped 조건 한 줄입니다.
--
-- ── 꽝도 기록합니다
-- 0원도 행으로 남깁니다. 남기지 않으면 "오늘 이미 굴렸다" 를 판정할 근거가 사라져
-- 꽝이 나온 날은 몇 번이고 다시 굴릴 수 있게 됩니다. 그래서 amount <> 0 제약을 풉니다.
--
-- 선행: 031 · 033 · 036 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 꽝(0원)도 남길 수 있게 — 적립은 0 이상, 사용은 음수
-- ---------------------------------------------------------------------------
-- 실제 이름은 user_rewards_amount_check(amount <> 0) 과 user_rewards_sign_check(부호) 입니다.
-- 둘 다 걷어내고 하나로 다시 겁니다.
ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS user_rewards_amount_check;
ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS user_rewards_sign_check;
ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS user_rewards_amount_sign_check;

ALTER TABLE public.user_rewards ADD CONSTRAINT user_rewards_amount_sign_check CHECK (
  (entry_type IN ('earn_mission','earn_journey','earn_routine','earn_routine_bonus',
                  'earn_purchase','earn_weekly','earn_monthly','earn_subscription','refund_order')
   AND amount >= 0)
  OR (entry_type IN ('spend_order','expire') AND amount < 0)
);

COMMENT ON COLUMN public.user_rewards.amount IS
  '적립은 0 이상(0 = 굴렸지만 꽝), 사용·소멸은 음수. 꽝을 남기지 않으면 "오늘 이미 굴렸다"를 판정할 수 없다.';

-- ---------------------------------------------------------------------------
-- 2) 눈 → 금액 표
-- ---------------------------------------------------------------------------
ALTER TABLE public.reward_rules ADD COLUMN IF NOT EXISTS payout jsonb;

COMMENT ON COLUMN public.reward_rules.payout IS
  '뽑은 값(주사위 눈)을 실제 적립액으로 바꾸는 표. 비어 있으면 뽑은 값이 곧 금액이다. 눈과 금액을 나눠야 화면이 거짓말하지 않는다.';

CREATE OR REPLACE FUNCTION public.reward_payout_for(p_code text, p_draw integer)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_payout jsonb;
BEGIN
  SELECT r.payout INTO v_payout FROM public.reward_rules r WHERE r.code = p_code AND r.is_active;
  IF v_payout IS NULL THEN
    RETURN GREATEST(0, COALESCE(p_draw, 0));  -- 표가 없으면 뽑은 값이 곧 금액(예전 방식)
  END IF;
  RETURN GREATEST(0, COALESCE((v_payout ->> p_draw::text)::int, 0));
END $$;

COMMENT ON FUNCTION public.reward_payout_for(text, integer) IS
  '주사위 눈 하나를 적립액으로 바꾼다. 눈은 그대로 보여주고 금액만 이 표가 정한다.';

-- ---------------------------------------------------------------------------
-- 3) 월 상한
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reward_monthly_cap()
RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 49 $$;

COMMENT ON FUNCTION public.reward_monthly_cap() IS
  '무료 적립의 한 달 상한(원). 구매 적립은 제외. 이 값 하나만 바꾸면 전체 상한이 바뀐다.';

/** 이번 달에 이미 받은 무료 적립 합계. 달의 경계는 서비스 기준일(KST)을 따른다. */
CREATE OR REPLACE FUNCTION public.reward_earned_this_month(p_user uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(sum(r.amount), 0)::int
    FROM public.user_rewards r
   WHERE r.user_id = p_user
     AND r.entry_type IN ('earn_mission','earn_journey','earn_routine',
                          'earn_routine_bonus','earn_weekly','earn_monthly','earn_subscription')
     AND r.created_at >= date_trunc('month', (now() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul'
$$;

CREATE OR REPLACE FUNCTION public.reward_remaining_this_month(p_user uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT GREATEST(0, public.reward_monthly_cap() - public.reward_earned_this_month(p_user))
$$;

/**
 * 화면이 쓰는 창구. **인자가 없습니다** — 본인 것만 볼 수 있습니다.
 *
 * 위의 두 함수는 p_user 를 받습니다. 그대로 회원에게 열어 주면 남의 id 를 넣어
 * "그 사람이 이번 달에 얼마 받았는지" 를 읽을 수 있습니다. 그래서 인자 있는 쪽은
 * 서버(서비스 롤)와 트리거만 쓰고, 회원에게는 이 함수만 엽니다.
 */
CREATE OR REPLACE FUNCTION public.my_reward_month_status()
RETURNS TABLE(cap integer, earned integer, remaining integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  RETURN QUERY SELECT public.reward_monthly_cap(),
                      public.reward_earned_this_month(v_user),
                      public.reward_remaining_this_month(v_user);
END $$;

COMMENT ON FUNCTION public.my_reward_month_status() IS
  '내 이번 달 적립 현황. 인자가 없어 남의 것을 볼 수 없다.';

REVOKE ALL ON FUNCTION public.reward_monthly_cap() FROM PUBLIC;
-- 인자를 받는 두 함수는 남의 적립액을 읽을 수 있으므로 회원에게 열지 않습니다.
REVOKE ALL ON FUNCTION public.reward_earned_this_month(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_remaining_this_month(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_reward_month_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reward_monthly_cap() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reward_earned_this_month(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reward_remaining_this_month(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.my_reward_month_status() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) 상한을 실제로 보증하는 트리거
--
--    청구 함수를 하나씩 고치는 대신 여기 한 곳에서 막습니다. 새 적립 경로가 생겨도
--    이 트리거를 지나가야 하므로 상한이 저절로 지켜집니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_reward_monthly_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_remaining integer;
BEGIN
  -- 상한에 묶이는 것: 공짜로 주는 적립만. 구매 환원·환불·사용은 그대로 둡니다.
  IF NEW.entry_type NOT IN ('earn_mission','earn_journey','earn_routine',
                            'earn_routine_bonus','earn_weekly','earn_monthly','earn_subscription') THEN
    RETURN NEW;
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RETURN NEW;  -- 꽝은 그대로 남깁니다(오늘 굴렸다는 기록).
  END IF;

  v_remaining := public.reward_remaining_this_month(NEW.user_id);

  IF NEW.amount > v_remaining THEN
    -- 남은 한도만큼만 줍니다. 0 이면 0원 행으로 남아 "굴렸지만 한도" 가 기록됩니다.
    NEW.memo := COALESCE(NEW.memo, '') ||
      format(' [월상한 %s원 적용: %s→%s]', public.reward_monthly_cap(), NEW.amount, v_remaining);
    NEW.amount := v_remaining;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS user_rewards_monthly_cap ON public.user_rewards;
CREATE TRIGGER user_rewards_monthly_cap
  BEFORE INSERT ON public.user_rewards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reward_monthly_cap();

COMMENT ON FUNCTION public.enforce_reward_monthly_cap() IS
  '무료 적립이 월 상한을 넘지 못하게 한다. 청구 함수를 빠뜨려도 여기서 막히는 것이 요점이다.';

-- ---------------------------------------------------------------------------
-- 5) 규칙 값 교체 — 눈은 고르게, 금액은 작게
-- ---------------------------------------------------------------------------
UPDATE public.reward_rules SET
  weights = '{"1":1,"2":1,"3":1,"4":1,"5":1,"6":1}'::jsonb,
  payout  = '{"1":0,"2":0,"3":0,"4":0,"5":1,"6":2}'::jsonb,
  min_amount = 0, max_amount = 2,
  disclosure = '주사위 눈은 1~6이 각각 1/6 확률로 고르게 나옵니다. 5눈은 1원, 6눈은 2원이고 나머지 눈은 적립이 없습니다. 하루 1회이며 다음 굴리기는 오전 5시에 열립니다. 무료 적립은 한 달 49원을 넘지 않습니다.',
  updated_at = now()
WHERE code = 'daily_routine_dice';

UPDATE public.reward_rules SET
  weights = '{"1":1,"2":1,"3":1,"4":1,"5":1,"6":1}'::jsonb,
  payout  = '{"1":0,"2":0,"3":0,"4":0,"5":0,"6":1}'::jsonb,
  min_amount = 0, max_amount = 1,
  disclosure = '주사위 눈은 1~6이 각각 1/6 확률로 고르게 나옵니다. 6눈일 때만 1원이 적립됩니다. 하루 1회이며 다음 굴리기는 오전 5시에 열립니다. 무료 적립은 한 달 49원을 넘지 않습니다.',
  updated_at = now()
WHERE code = 'routine_bonus_dice';

UPDATE public.reward_rules SET
  weights = '{"0":75,"1":22,"2":3}'::jsonb,
  payout  = NULL,
  min_amount = 0, max_amount = 2,
  disclosure = '미션을 마치면 확률에 따라 적립됩니다. 100번 중 22번은 1원, 3번은 2원이고 나머지 75번은 적립이 없습니다. 무료 적립은 한 달 49원을 넘지 않습니다.',
  updated_at = now()
WHERE code = 'daily_mission';

UPDATE public.reward_rules SET fixed_amount = 2, min_amount = 2, max_amount = 2,
  disclosure = '주간 챌린지를 마치면 2원이 적립됩니다. 무료 적립은 한 달 49원을 넘지 않습니다.', updated_at = now()
WHERE code = 'weekly_challenge';

UPDATE public.reward_rules SET fixed_amount = 3, min_amount = 3, max_amount = 3,
  disclosure = '월간 챌린지를 마치면 3원이 적립됩니다. 무료 적립은 한 달 49원을 넘지 않습니다.', updated_at = now()
WHERE code = 'monthly_challenge';

UPDATE public.reward_rules SET fixed_amount = 3, min_amount = 3, max_amount = 3,
  disclosure = '14일 루틴을 완주하면 3원이 적립됩니다. 무료 적립은 한 달 49원을 넘지 않습니다.', updated_at = now()
WHERE code = 'journey_complete';

-- purchase_cashback 은 건드리지 않습니다. 돈을 쓴 것에 대한 환원이라 상한에서도 제외합니다.

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT code AS 규칙, min_amount AS 최소, max_amount AS 최대, fixed_amount AS 고정,
       weights::text AS 눈분포, payout::text AS "눈→원"
  FROM public.reward_rules ORDER BY code;

SELECT public.reward_monthly_cap() AS "월상한(49여야)";

SELECT tgname AS 트리거, tgenabled AS 상태
  FROM pg_trigger WHERE tgrelid = 'public.user_rewards'::regclass AND NOT tgisinternal;

-- ---------------------------------------------------------------------------
-- 6) 청구 함수 — 눈과 금액을 나누고, 화면에 맞는 숫자를 돌려준다
--
--    상한 보증은 위의 트리거가 합니다. 여기서 한 번 더 계산하는 이유는 함수가
--    "얼마 받았다" 를 돌려줘야 하는데, 트리거가 깎은 값을 모르면 화면이 틀린 숫자를
--    보여주기 때문입니다. 그래서 같은 값을 미리 계산해 넣고 그대로 돌려줍니다.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_mission_reward(p_mission_id uuid)
RETURNS TABLE(amount integer, already_claimed boolean, balance integer, multiplier numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_journey uuid;
  v_base    integer;
  v_amount  integer;
  v_mult    numeric;
  v_prev    integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT m.user_journey_id INTO v_journey
    FROM public.user_missions m
   WHERE m.id = p_mission_id AND m.user_id = v_user AND m.status = 'completed';

  IF v_journey IS NULL THEN
    RAISE EXCEPTION 'mission not completed or not owned' USING ERRCODE = '42501';
  END IF;

  SELECT r.amount INTO v_prev
    FROM public.user_rewards r
   WHERE r.user_id = v_user AND r.entry_type = 'earn_mission' AND r.source_id = p_mission_id;

  IF v_prev IS NOT NULL THEN
    RETURN QUERY SELECT v_prev, true, public.reward_balance(v_user), 1.0::numeric;
    RETURN;
  END IF;

  v_base := public.reward_payout_for('daily_mission', public.draw_reward_amount('daily_mission'));
  v_mult := public.reward_multiplier_for(v_user);
  -- 예전에는 GREATEST(1, ...) 로 최소 1원을 보장했습니다. 이제 0원(꽝)이 정상이라 걷어냅니다.
  v_amount := GREATEST(0, round(v_base * v_mult)::int);
  v_amount := LEAST(v_amount, public.reward_remaining_this_month(v_user));

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, user_journey_id, memo)
  VALUES
    (v_user, 'earn_mission', 'daily_mission', v_amount, 'free', 'mission', p_mission_id, v_journey,
     CASE WHEN v_mult <> 1.0 THEN format('기본 %s원 x 등급 %s배', v_base, v_mult) ELSE NULL END);

  RETURN QUERY SELECT v_amount, false, public.reward_balance(v_user), v_mult;
END $$;

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

  -- 눈은 1~6 이 고르게. 화면이 보여주는 것은 이 값입니다.
  v_dice := public.draw_reward_amount('daily_routine_dice');
  IF v_dice < 1 THEN v_dice := 1; END IF;
  IF v_dice > 6 THEN v_dice := 6; END IF;

  -- 금액은 눈에 따라 따로 정합니다. 6이 나오면 실제로 제일 좋은 결과입니다.
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

  v_dice := public.draw_reward_amount('routine_bonus_dice');
  IF v_dice < 1 THEN v_dice := 1; END IF;
  IF v_dice > 6 THEN v_dice := 6; END IF;

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
