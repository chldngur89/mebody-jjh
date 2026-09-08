-- ===========================================================================
-- MEBODY — 공통 스트레칭 완료 주사위 적립 (하루 1회)
--
-- · 완료를 누르면 서버가 1~6 을 굴려 그 숫자만큼 적립합니다.
-- · 하루 1회. 하루의 경계는 한국시간 오전 5시입니다.
--   (05:00 KST 이전은 전날로 칩니다. 새벽에 하는 사람이 하루를 두 번 받지 않게.)
-- · 주사위 눈과 적립 원장은 서버에서만 결정됩니다. 클라이언트 값은 신뢰하지 않습니다.
-- · 하루 1회 강제는 새 테이블 없이 기존
--   user_rewards_once_per_event UNIQUE (user_id, entry_type, source_id) 로 합니다.
--   source_id 를 "사용자 + 서비스 날짜" 의 결정적 UUID 로 만들면 두 번째 INSERT 가 막힙니다.
--
-- 선행: 020~032 적용 완료 (특히 031_rewards.sql)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 원장이 새 적립 종류를 받도록 CHECK 확장
--    기존 제약을 지우고 같은 이름으로 다시 만듭니다(값만 추가).
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS user_rewards_entry_type_check;
ALTER TABLE public.user_rewards ADD  CONSTRAINT user_rewards_entry_type_check CHECK (entry_type IN
  ('earn_mission','earn_journey','earn_routine','earn_subscription','spend_order','refund_order','expire'));

ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS user_rewards_source_type_check;
ALTER TABLE public.user_rewards ADD  CONSTRAINT user_rewards_source_type_check CHECK (source_type IN
  ('mission','journey','routine','subscription','order','system'));

ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS user_rewards_sign_check;
ALTER TABLE public.user_rewards ADD  CONSTRAINT user_rewards_sign_check CHECK (
  (entry_type IN ('earn_mission','earn_journey','earn_routine','earn_subscription','refund_order') AND amount > 0)
  OR (entry_type IN ('spend_order','expire') AND amount < 0)
);

-- ---------------------------------------------------------------------------
-- 2) 주사위 규칙 — 1~6 균등
--    weights 가 균등하므로 draw_reward_amount 가 실제 주사위와 같은 분포를 냅니다.
--    disclosure 는 화면에 그대로 노출합니다(표시광고 고지).
-- ---------------------------------------------------------------------------
INSERT INTO public.reward_rules
  (code, name, display_label, disclosure, min_amount, max_amount, weights, is_active)
VALUES (
  'daily_routine_dice',
  '공통 스트레칭 주사위',
  '주사위 굴려 최대 6원',
  '공통 스트레칭을 완료하면 주사위를 굴려 1~6원이 적립됩니다. 각 눈이 나올 확률은 1/6로 같습니다. 하루 1회이며, 하루의 기준은 한국시간 오전 5시입니다.',
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
-- 3) 서비스 날짜 — 한국시간 오전 5시 경계
--    예) 2026-09-02 04:59 KST → 2026-09-01
--        2026-09-02 05:00 KST → 2026-09-02
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mebody_service_day(p_at timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT ((p_at AT TIME ZONE 'Asia/Seoul') - interval '5 hours')::date;
$$;

COMMENT ON FUNCTION public.mebody_service_day(timestamptz) IS
  'MEBODY 하루 경계. 한국시간 오전 5시에 날짜가 바뀝니다.';

-- ---------------------------------------------------------------------------
-- 4) 주사위 적립 — 본인, 하루 1회
--    반환: dice(눈 1~6), amount(실제 적립액 = 눈 x 등급배수),
--          already_claimed(오늘 이미 받았는지), balance, service_day
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_routine_reward()
RETURNS TABLE (dice integer, amount integer, already_claimed boolean, balance integer,
               multiplier numeric, service_day date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- 사용자 + 서비스 날짜로 결정적 UUID. 같은 날 두 번째 INSERT 는 UNIQUE 로 막힙니다.
  v_source := md5(v_user::text || ':routine:' || v_day::text)::uuid;

  -- 같은 사용자의 동시 클릭 직렬화 (더블클릭·중복 요청 대비)
  PERFORM pg_advisory_xact_lock(hashtext('mebody_routine_reward'), hashtext(v_user::text));

  SELECT * INTO v_prev
    FROM public.user_rewards
   WHERE user_id = v_user AND entry_type = 'earn_routine' AND source_id = v_source;

  IF FOUND THEN
    -- 이미 받은 날이면 그때의 눈을 그대로 돌려줘 화면이 같은 숫자를 보여줍니다.
    RETURN QUERY SELECT
      COALESCE((v_prev.memo)::jsonb ->> 'dice', v_prev.amount::text)::int,
      v_prev.amount, true, public.reward_balance(v_user), 1.0::numeric, v_day;
    RETURN;
  END IF;

  v_dice   := public.draw_reward_amount('daily_routine_dice');
  IF v_dice < 1 THEN v_dice := 1; END IF;
  IF v_dice > 6 THEN v_dice := 6; END IF;

  v_mult   := public.reward_multiplier_for(v_user);
  v_amount := GREATEST(1, round(v_dice * v_mult)::int);

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, memo)
  VALUES
    (v_user, 'earn_routine', 'daily_routine_dice', v_amount, 'free', 'routine', v_source,
     jsonb_build_object('dice', v_dice, 'multiplier', v_mult, 'service_day', v_day)::text);

  RETURN QUERY SELECT v_dice, v_amount, false, public.reward_balance(v_user), v_mult, v_day;
END $$;

-- ---------------------------------------------------------------------------
-- 5) 오늘 이미 받았는지 조회 (화면 진입 시 버튼 상태 결정용, 적립하지 않음)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.today_routine_reward()
RETURNS TABLE (claimed boolean, dice integer, amount integer, service_day date)
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

  v_day := public.mebody_service_day();

  SELECT * INTO v_row
    FROM public.user_rewards
   WHERE user_id = v_user AND entry_type = 'earn_routine'
     AND source_id = md5(v_user::text || ':routine:' || v_day::text)::uuid;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::int, NULL::int, v_day;
    RETURN;
  END IF;

  RETURN QUERY SELECT true,
    COALESCE((v_row.memo)::jsonb ->> 'dice', v_row.amount::text)::int,
    v_row.amount, v_day;
END $$;

-- ---------------------------------------------------------------------------
-- 6) 권한 — 함수는 기본으로 PUBLIC 에 EXECUTE 가 붙으므로 PUBLIC 부터 회수합니다.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.mebody_service_day(timestamptz)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_daily_routine_reward()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.today_routine_reward()              FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_daily_routine_reward() TO authenticated;
GRANT EXECUTE ON FUNCTION public.today_routine_reward()       TO authenticated;
