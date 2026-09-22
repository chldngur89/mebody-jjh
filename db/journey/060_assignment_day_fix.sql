-- ===========================================================================
-- MEBODY — 배정이 "고객이 오늘 보는 날" 에 붙게 고친다
--
-- ※ db/journey 폴더의 060 입니다. 059 를 적용한 뒤에 돌립니다.
--
-- ── 무엇이 틀렸나
-- 059 의 assign_client_mission() 은 붙일 날을 user_journeys.current_day 에서 읽었습니다.
-- 그런데 **앱은 그 컬럼을 보지 않습니다.** started_at 으로 매번 계산합니다
-- (src/utils/journeyRules.ts 의 computeCurrentDay — 한국시간 기준 경과일 + 1, 템플릿 기간으로 상한).
--
-- current_day 는 앱이 가끔 touchJourney() 로 갱신하는 값이라 뒤처져 있습니다.
-- 실측: 시작 13일 전인 고객의 current_day 는 10, 앱 화면은 DAY 14 였습니다.
-- 그 상태로 배정하면 미션이 10일차에 붙고 **고객은 영영 보지 못합니다.**
-- 배정했는데 안 보이는 것이 제일 나쁩니다 — 전문가는 보냈다고 믿고 고객은 받은 적이 없습니다.
--
-- ── 어떻게 고치나
-- 앱과 똑같은 계산을 SQL 에 둡니다. 같은 규칙이 두 군데 있게 되지만, 이 경우는 한쪽이
-- 앱이고 한쪽이 DB 라 합칠 수가 없습니다. 대신 이름을 붙여 두어 다음 사람이 짝을 찾게 합니다.
--
-- 선행: 059 적용 완료
-- ===========================================================================

/**
 * 저니의 "오늘 며칠차" — 앱의 computeCurrentDay() 와 같은 규칙.
 *
 * 한국시간 기준으로 날짜가 몇 번 바뀌었는지를 세고 1 을 더합니다. 시작일이 1일차입니다.
 * 템플릿 기간을 넘지 않습니다. 앱 쪽을 고치면 여기도 같이 고쳐야 합니다.
 */
CREATE OR REPLACE FUNCTION public.journey_current_day(p_journey_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_started  timestamptz;
  v_template text;
  v_days     integer;
  v_elapsed  integer;
BEGIN
  SELECT j.started_at, j.template_code INTO v_started, v_template
    FROM public.user_journeys j WHERE j.id = p_journey_id;

  IF v_started IS NULL THEN RETURN 1; END IF;

  SELECT coalesce(t.duration_days, 14) INTO v_days
    FROM public.journey_templates t WHERE t.code = v_template;
  v_days := coalesce(v_days, 14);

  -- 한국시간 기준 "날짜가 몇 번 바뀌었나". 시각이 아니라 날짜로 셉니다.
  v_elapsed := (date(now() AT TIME ZONE 'Asia/Seoul') - date(v_started AT TIME ZONE 'Asia/Seoul'));

  RETURN least(greatest(v_elapsed + 1, 1), v_days);
END $$;

COMMENT ON FUNCTION public.journey_current_day(uuid) IS
  '저니의 오늘 며칠차. 앱 src/utils/journeyRules.ts 의 computeCurrentDay() 와 같은 규칙이어야 한다. user_journeys.current_day 컬럼은 뒤처질 수 있어 쓰지 않는다.';

REVOKE ALL ON FUNCTION public.journey_current_day(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.journey_current_day(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- assign_client_mission — 붙이는 날만 바뀝니다. 나머지 규칙은 059 그대로입니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_client_mission(
  p_client_user_id uuid,
  p_content_key    text,
  p_note           text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pro     uuid := public.current_professional_id();
  v_journey public.user_journeys%ROWTYPE;
  v_content public.immediate_action_content%ROWTYPE;
  v_day     integer;
  v_today   integer;
  v_slot    integer;
  v_mission uuid;
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF v_pro IS NULL THEN
    RAISE EXCEPTION '전문가 계정만 배정할 수 있습니다' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.professional_clients pc
     WHERE pc.professional_id = v_pro
       AND pc.client_user_id  = p_client_user_id
       AND pc.status          = 'ACTIVE'
       AND pc.consented_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION '내 고객이 아니거나 아직 동의하지 않았습니다' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_content FROM public.immediate_action_content WHERE content_key = p_content_key;
  IF v_content.content_key IS NULL THEN
    RAISE EXCEPTION '없는 콘텐츠입니다' USING ERRCODE = '22023';
  END IF;

  IF length(coalesce(v_note, '')) > 200 THEN
    RAISE EXCEPTION '메모는 200자까지입니다' USING ERRCODE = '22001';
  END IF;

  SELECT * INTO v_journey
    FROM public.user_journeys j
   WHERE j.user_id = p_client_user_id AND j.status = 'active'
   ORDER BY j.last_active_at DESC NULLS LAST, j.started_at DESC
   LIMIT 1;

  IF v_journey.id IS NULL THEN
    RAISE EXCEPTION '고객이 진행 중인 루틴이 없습니다' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_today
    FROM public.user_missions m
   WHERE m.user_id = p_client_user_id
     AND m.assigned_by = v_pro
     AND m.created_at >= date_trunc('day', (now() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul';

  IF v_today >= 3 THEN
    RAISE EXCEPTION '한 고객에게 하루 3개까지 배정할 수 있습니다' USING ERRCODE = '54000';
  END IF;

  -- ★ 여기가 바뀐 곳. current_day 컬럼이 아니라 앱과 같은 계산을 씁니다.
  v_day := public.journey_current_day(v_journey.id);

  SELECT coalesce(max(m.slot_no), 0) + 1 INTO v_slot
    FROM public.user_missions m
   WHERE m.user_journey_id = v_journey.id AND m.day_no = v_day;

  INSERT INTO public.user_missions
    (user_journey_id, user_id, day_no, slot_no, content_key, mission_type,
     planned_duration_sec, difficulty, source_rule, status, assigned_by, prescription)
  VALUES
    (v_journey.id, p_client_user_id, v_day, v_slot, p_content_key, 'combo',
     coalesce(v_content.release_duration_sec, 180), 1, 'professional', 'scheduled', v_pro,
     jsonb_build_object('note', v_note, 'assigned_at', now()))
  RETURNING id INTO v_mission;

  INSERT INTO public.professional_activity_log (professional_id, client_user_id, event)
  VALUES (v_pro, p_client_user_id, 'assignment_created');

  RETURN v_mission;
END $$;

-- ---------------------------------------------------------------------------
-- 확인 — 진행 중인 저니의 저장값과 실제 계산이 얼마나 벌어져 있는지
-- ---------------------------------------------------------------------------
SELECT id, started_at::date AS 시작일, current_day AS "저장된 값",
       public.journey_current_day(id) AS "실제 오늘",
       current_day = public.journey_current_day(id) AS 일치
  FROM public.user_journeys WHERE status = 'active';
