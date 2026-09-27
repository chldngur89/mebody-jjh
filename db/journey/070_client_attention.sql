-- ===========================================================================
-- MEBODY — 오늘 확인할 고객만 추리는 목록 (전문가 확장 Phase 5)
--
-- ※ db/journey 폴더의 070 입니다.
--
-- WHY
--   고객이 20명이 되면 20명을 다 들여다볼 수 없습니다. 전문가가 콘솔을 열었을 때
--   "오늘 손이 필요한 사람" 만 위에 올려 줍니다. 나머지는 잘 굴러가고 있다는 뜻입니다.
--
-- 새 테이블이 없습니다. 전부 이미 쌓고 있는 기록에서 계산합니다.
--   미활동   → user_journeys.last_active_at
--   힘들다   → journey_mission_feedback.difficulty = 'HARD'
--   수행률   → user_missions.status
--   종료임박 → journey_current_day(id) vs journey_templates.duration_days
--
-- 통과 조건은 053 · 056 · 059 와 **똑같습니다.** 조건을 새로 쓰지 않고 복제합니다.
--   1. 호출자가 활성 전문가인가        (current_professional_id() IS NOT NULL)
--   2. 그 고객과의 관계가 ACTIVE 인가   (professional_clients.status)
--   3. 고객이 동의했는가               (consented_at IS NOT NULL)
--   관계가 없는 고객은 애초에 후보군에 들어오지 않습니다. 인자를 받지 않으므로
--   "남의 고객 id 를 넣어 본다" 는 시도 자체가 불가능합니다.
--
-- 의료 표현을 쓰지 않습니다.
--   여기서 말하는 "주의" 는 **운영 신호**입니다 — 연락이 끊겼다, 수행이 밀렸다.
--   몸 상태에 대한 판단이 아닙니다. 그래서 플래그 이름도 증상이 아니라 행동으로 씁니다
--   (inactive · low_completion · hard_streak · ending_soon · not_started).
--   MEBODY 는 의료기기가 아니고, 전문가 확장에서도 그 선을 넘지 않습니다.
--
-- 반환하지 않는 것: 이메일, 전화번호, 32문항 답변 원문, 체형 코드.
--   목록은 "누구를 볼지" 만 정합니다. 내용은 기존 get_client_journey_summary() 로 봅니다.
--   client_user_id 는 이미 고객 목록(ProfessionalService.listClients)이 주고 있는 값이라
--   여기서 더 여는 것이 없습니다.
--
-- 로드맵과 다른 점 하나: not_started 를 더했습니다.
--   로드맵의 신호 4개에는 없지만, **동의까지 해 놓고 아직 루틴을 시작하지 않은 고객**이
--   전문가가 가장 먼저 연락해야 할 사람입니다. 새 데이터 없이 판별되고(저니 0건),
--   이걸 빼면 그 사람은 어느 목록에도 안 잡혀 영영 방치됩니다.
--
-- 선행: 052 · 053 · 056 · 059 · 060 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 기준값을 함수로 빼 둡니다.
--
-- 앱의 재시작 규칙(src/utils/journeyRules.ts 의 RESTART_THRESHOLD_DAYS = 3)과
-- 미활동 기준을 **일부러 같은 3일로 맞췄습니다.** 앱이 "쉬었다 오셨네요" 하고 가벼운
-- 미션을 내주는 시점과, 전문가 목록에 뜨는 시점이 어긋나면 두 화면이 서로 다른 말을
-- 하게 됩니다. 한쪽을 바꾸면 다른 쪽도 같이 바꿔야 합니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attention_thresholds()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'inactive_days',        3,    -- journeyRules.ts RESTART_THRESHOLD_DAYS 와 같은 값
    'window_days',          7,    -- 피드백·수행률을 보는 기간
    'hard_feedback_count',  2,    -- 이 횟수 이상이면 "어렵다" 가 반복된 것
    'low_completion_rate',  0.5,  -- 기간 내 완료율이 이 미만이면 밀린 것
    'min_sample',           3,    -- 표본이 이보다 적으면 수행률을 판단하지 않는다
    'ending_soon_days',     2     -- 남은 일수가 이하이면 마무리 대화를 할 때
  );
$$;

REVOKE ALL ON FUNCTION public.attention_thresholds() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attention_thresholds() TO authenticated, service_role;

COMMENT ON FUNCTION public.attention_thresholds() IS
  '주의 목록 기준값. inactive_days 는 앱 journeyRules.ts 의 RESTART_THRESHOLD_DAYS 와 맞춘다.';

-- ---------------------------------------------------------------------------
-- get_client_attention_list() — 내 고객 중 오늘 볼 사람
--
-- 인자가 없습니다. auth.uid() → current_professional_id() 로 자기 자신만 봅니다.
--
-- 왜 jsonb 한 덩어리인가: 056 과 같은 이유입니다. 목록과 총원을 따로 부르면
-- 그 사이에 동의가 철회됐을 때 "12명 중 15명" 같은 숫자가 나옵니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_client_attention_list()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pro    uuid  := public.current_professional_id();
  v_th     jsonb := public.attention_thresholds();
  v_win    int   := (v_th->>'window_days')::int;
  v_total  int;
  v_rows   jsonb;
BEGIN
  IF v_pro IS NULL THEN
    RETURN NULL;  -- 전문가가 아니면 아무것도 알려주지 않습니다(056 과 같은 처리).
  END IF;

  WITH mine AS (
    -- 053 · 056 · 059 와 똑같은 세 조건. 여기서 걸러진 사람은 아래 어디에도 안 나옵니다.
    SELECT pc.client_user_id AS uid
      FROM public.professional_clients pc
     WHERE pc.professional_id = v_pro
       AND pc.status          = 'ACTIVE'
       AND pc.consented_at   IS NOT NULL
       AND pc.client_user_id IS NOT NULL
  ),
  journey AS (
    -- 고객마다 저니 한 건. 진행 중이면 그것, 없으면 마지막 것 (056 의 정렬과 동일).
    SELECT DISTINCT ON (j.user_id)
           j.user_id, j.id, j.status, j.last_active_at, j.template_code
      FROM public.user_journeys j
      JOIN mine m ON m.uid = j.user_id
     ORDER BY j.user_id,
              (j.status = 'active') DESC,
              j.last_active_at DESC NULLS LAST,
              j.started_at DESC
  ),
  -- 각 저니의 "오늘이 며칠째인가". 아래 창(window)의 기준점입니다.
  today AS (
    SELECT jn.user_id, jn.id AS journey_id,
           CASE WHEN jn.status = 'active' THEN public.journey_current_day(jn.id) END AS day_no
      FROM journey jn
  ),
  -- 최근 기간의 수행률. scheduled 는 "아직 안 한 것" 이므로 분모에 넣습니다.
  --
  -- 창을 **day_no 로 잡습니다. created_at 이 아닙니다.**
  --   created_at 은 "행이 쓰인 시각" 이지 "그 미션이 어느 날 것인가" 가 아닙니다.
  --   replanDayMissions 가 슬롯을 다시 쓰거나, 사용자가 3일차를 5일차에 늦게 열거나,
  --   데이터를 옮겨 넣으면 둘이 어긋납니다. day_no 는 어떤 경우에도 그 미션의 날짜입니다.
  --
  -- 오늘(day_no = 현재일)은 뺍니다. 아침에 막 연 사람이 0% 로 잡히면 안 됩니다.
  perf AS (
    SELECT td.user_id,
           count(*)                                       AS planned,
           count(*) FILTER (WHERE um.status = 'completed') AS done
      FROM today td
      JOIN public.user_missions um ON um.user_journey_id = td.journey_id
     WHERE td.day_no IS NOT NULL
       AND um.day_no BETWEEN greatest(1, td.day_no - v_win) AND (td.day_no - 1)
       AND um.status <> 'skipped'   -- 규칙이 내려놓은 슬롯은 고객 탓이 아닙니다
     GROUP BY td.user_id
  ),
  -- "어렵다" 도 같은 창에서 셉니다. 피드백은 미션에 달리므로 미션의 day_no 를 씁니다.
  hard AS (
    SELECT td.user_id, count(*) AS hard_count
      FROM today td
      JOIN public.user_missions um ON um.user_journey_id = td.journey_id
      JOIN public.journey_mission_feedback f ON f.user_mission_id = um.id
     WHERE f.difficulty = 'HARD'
       AND td.day_no IS NOT NULL
       AND um.day_no BETWEEN greatest(1, td.day_no - v_win) AND td.day_no
     GROUP BY td.user_id
  )
  SELECT count(*)::int,
         coalesce(jsonb_agg(x ORDER BY x->>'priority', x->>'sort_key') FILTER (WHERE x IS NOT NULL), '[]'::jsonb)
    INTO v_total, v_rows
    FROM mine m
    LEFT JOIN journey jn ON jn.user_id = m.uid
    LEFT JOIN perf   pf ON pf.user_id  = m.uid
    LEFT JOIN hard   hd ON hd.user_id  = m.uid
    LEFT JOIN public.user_profiles up ON up.id = m.uid
    LEFT JOIN public.journey_templates t ON t.code = jn.template_code
    CROSS JOIN LATERAL (
      SELECT
        -- 아직 시작 안 함: 저니가 아예 없거나, 있던 저니를 그만둔 뒤 새로 안 시작함
        (jn.id IS NULL OR jn.status <> 'active')                                  AS f_not_started,
        -- 미활동: 마지막으로 앱을 열어 그날 미션을 받은 날로부터 며칠 지났나 (KST 기준 날짜 차)
        (jn.status = 'active' AND jn.last_active_at IS NOT NULL
         AND ((now() AT TIME ZONE 'Asia/Seoul')::date - (jn.last_active_at AT TIME ZONE 'Asia/Seoul')::date)
             >= (v_th->>'inactive_days')::int)                                     AS f_inactive,
        -- 수행률: 표본이 min_sample 이상일 때만 판단합니다.
        (coalesce(pf.planned, 0) >= (v_th->>'min_sample')::int
         AND pf.done::numeric / pf.planned < (v_th->>'low_completion_rate')::numeric) AS f_low,
        (coalesce(hd.hard_count, 0) >= (v_th->>'hard_feedback_count')::int)        AS f_hard,
        (jn.status = 'active' AND t.duration_days IS NOT NULL
         AND (t.duration_days - public.journey_current_day(jn.id))
             BETWEEN 0 AND (v_th->>'ending_soon_days')::int)                       AS f_ending
    ) fl
    CROSS JOIN LATERAL (
      SELECT CASE WHEN NOT (fl.f_not_started OR fl.f_inactive OR fl.f_low OR fl.f_hard OR fl.f_ending)
                  THEN NULL  -- 플래그가 하나도 없으면 목록에 올리지 않습니다.
             ELSE jsonb_build_object(
               'client_user_id', m.uid,
               'display_name',   coalesce(up.display_name, '(이름 없음)'),
               'journey_id',     jn.id,
               'day_no',         CASE WHEN jn.status = 'active' THEN public.journey_current_day(jn.id) END,
               'duration_days',  t.duration_days,
               'last_active_at', jn.last_active_at,
               'days_inactive',  CASE WHEN jn.last_active_at IS NOT NULL
                                 THEN (now() AT TIME ZONE 'Asia/Seoul')::date
                                      - (jn.last_active_at AT TIME ZONE 'Asia/Seoul')::date END,
               'planned',        coalesce(pf.planned, 0),
               'completed',      coalesce(pf.done, 0),
               'hard_count',     coalesce(hd.hard_count, 0),
               'flags',          (SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM unnest(ARRAY[
                                   CASE WHEN fl.f_not_started THEN 'not_started'    END,
                                   CASE WHEN fl.f_inactive    THEN 'inactive'       END,
                                   CASE WHEN fl.f_low         THEN 'low_completion' END,
                                   CASE WHEN fl.f_hard        THEN 'hard_streak'    END,
                                   CASE WHEN fl.f_ending      THEN 'ending_soon'    END
                                 ]) AS v WHERE v IS NOT NULL),
               -- 급한 순서. 연락이 끊긴 쪽이 먼저고, 마무리 대화는 맨 뒤입니다.
               'priority',       CASE WHEN fl.f_inactive    THEN 1
                                      WHEN fl.f_not_started THEN 2
                                      WHEN fl.f_low         THEN 3
                                      WHEN fl.f_hard        THEN 4
                                      ELSE 5 END,
               -- 같은 순위 안에서는 오래 방치된 사람이 위로. 이름은 마지막 가름끈입니다.
               'sort_key',       lpad((9999 - coalesce(
                                   (now() AT TIME ZONE 'Asia/Seoul')::date
                                   - (jn.last_active_at AT TIME ZONE 'Asia/Seoul')::date, 9999))::text, 4, '0')
                                 || coalesce(up.display_name, '')
             ) END AS x
    ) built;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'thresholds',   v_th,
    'total',        v_total,                    -- 동의한 내 고객 전체
    'attention',    jsonb_array_length(v_rows),  -- 그중 오늘 볼 사람
    'clients',      v_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_attention_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_attention_list() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_client_attention_list() FROM anon;

COMMENT ON FUNCTION public.get_client_attention_list() IS
  '전문가 자신의 동의 고객 중 오늘 확인이 필요한 사람만. 인자 없음 — auth.uid() 로만 범위가 정해진다.';

-- ---------------------------------------------------------------------------
-- 지표 — "주의 목록에서 시작된 개입 비율"
--
-- 로드맵이 정한 Phase 5 의 지표입니다. 목록을 열기만 하고 아무도 안 건드리면
-- 그 화면은 쓸모가 없다는 뜻이므로, 「열었다」와 「배정했다」를 같이 세야 합니다.
-- 「열었다」를 남길 자리가 없어서 event 값을 하나 넓힙니다.
--
-- 068 이 invite_sent 를 넓힌 것과 같은 방식입니다. 기존 값은 전부 그대로 둡니다.
-- attention_viewed 는 고객 한 명이 아니라 목록 전체를 본 기록이므로
-- client_user_id 가 NULL 입니다 — 056 에서 이 컬럼을 nullable 로 둔 것이 여기서 쓰입니다.
-- ---------------------------------------------------------------------------
ALTER TABLE public.professional_activity_log
  DROP CONSTRAINT IF EXISTS professional_activity_log_event_check;

ALTER TABLE public.professional_activity_log
  ADD CONSTRAINT professional_activity_log_event_check
  CHECK (event IN ('client_opened', 'activity_viewed', 'assignment_created',
                   'assignment_cancelled', 'invite_sent', 'attention_viewed'));

-- ---------------------------------------------------------------------------
-- 확인 — 적용 후 아래가 전부 t 여야 합니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_ok boolean;
BEGIN
  SELECT has_function_privilege('authenticated', 'public.get_client_attention_list()', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.get_client_attention_list()', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.attention_thresholds()', 'EXECUTE')
    INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION '070 실패: 함수 권한이 의도와 다릅니다 (anon 에게 열려 있으면 안 됩니다)';
  END IF;

  -- 전문가가 아닌 사람이 부르면 NULL 이어야 합니다. 지금 세션은 전문가가 아닙니다.
  IF public.get_client_attention_list() IS NOT NULL THEN
    RAISE EXCEPTION '070 실패: 전문가가 아닌 호출자에게 결과가 나왔습니다';
  END IF;

  RAISE NOTICE '070 OK — 주의 목록 함수와 기준값이 준비되었습니다.';
END;
$$;
