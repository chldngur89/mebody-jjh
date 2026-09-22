-- ===========================================================================
-- MEBODY — 전문가가 자기 고객의 "수행 기록" 을 읽는 통로 (전문가 확장 Phase 2)
--
-- ※ db/journey 폴더의 056 입니다.
--
-- 053 이 "몸이 어떤 상태인가"(체형 코드)를 열었다면, 여기는 "그래서 뭘 했는가"
-- (미션 수행률·최근 활동·피드백)를 엽니다. 트레이너가 세션 사이에 보는 것이 이쪽입니다.
--
-- 통과 조건은 053 과 **똑같습니다.** 조건을 한 벌 더 쓰지 않고 같은 모양으로 복제합니다.
--   1. 호출자가 활성 전문가인가        (current_professional_id() IS NOT NULL)
--   2. 그 고객과의 관계가 ACTIVE 인가   (professional_clients.status)
--   3. 고객이 동의했는가               (consented_at IS NOT NULL)
--
--   하나라도 어긋나면 **오류가 아니라 빈 결과**입니다. 오류가 갈리면 관계 여부를 떠볼 수 있습니다.
--
-- 왜 jsonb 한 덩어리인가:
--   진행률(스칼라)·일자별 타임라인(배열)·피드백(배열)이 한 화면에 같이 나옵니다.
--   TABLE 로 쪼개면 호출이 세 번이 되고, 그 사이에 고객이 동의를 거두면 화면 절반은
--   옛 데이터, 절반은 빈 값이 됩니다. 한 번에 한 시점을 읽습니다.
--
-- 반환하지 않는 것: user_id, 이메일, 전화번호, 32문항 답변 원문.
--   053 과 같은 원칙입니다. 전문가에게 필요한 건 수행 기록이지 신상이 아닙니다.
--
-- 읽기는 새 테이블 없이 기존 user_journeys · user_missions · journey_mission_feedback 만 씁니다.
--
-- 다만 **작은 로그 테이블 하나를 더합니다.** 로드맵의 Phase 2 는 "테이블 추가 없음" 이라고
-- 적어 두었는데, 같은 문서의 지표가 "주간 활성 전문가 비율 — 한 주에 고객 화면을 한 번이라도
-- 연 전문가 / 전체 전문가" 입니다. 이 숫자는 **전문가별 행**이 있어야 셀 수 있습니다.
-- analytics_events 는 개인 식별 값을 일부러 넣지 않는 테이블(054)이라 여기에 쓸 수 없습니다.
-- 그래서 전문가 활동만 따로 남깁니다. 로드맵 쪽이 틀렸고, 이 파일이 맞습니다.
--
-- 선행: 052 · 053 적용 완료
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_client_journey_summary(p_client_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pro     uuid := public.current_professional_id();
  v_journey public.user_journeys%ROWTYPE;
  v_result  jsonb;
BEGIN
  IF v_pro IS NULL OR p_client_user_id IS NULL THEN
    RETURN NULL;  -- 전문가가 아니면 아무것도 알려주지 않습니다.
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.professional_clients pc
     WHERE pc.professional_id = v_pro
       AND pc.client_user_id  = p_client_user_id
       AND pc.status          = 'ACTIVE'
       AND pc.consented_at IS NOT NULL
  ) THEN
    RETURN NULL;  -- 내 고객이 아니거나 아직 동의 전입니다.
  END IF;

  -- 가장 최근 저니 한 건. 진행 중인 것이 있으면 그것, 없으면 마지막으로 하던 것.
  SELECT * INTO v_journey
    FROM public.user_journeys j
   WHERE j.user_id = p_client_user_id
   ORDER BY (j.status = 'active') DESC, j.last_active_at DESC NULLS LAST, j.started_at DESC
   LIMIT 1;

  IF v_journey.id IS NULL THEN
    -- 관계는 맞는데 아직 루틴을 시작하지 않은 고객입니다. 권한 없음과 구분해야 하므로
    -- NULL 이 아니라 "없다" 를 명시해서 돌려줍니다.
    RETURN jsonb_build_object('has_journey', false);
  END IF;

  SELECT jsonb_build_object(
    'has_journey', true,
    'journey', jsonb_build_object(
      'template_code', v_journey.template_code,
      'body_code',     v_journey.body_code,
      'status',        v_journey.status,
      'current_day',   v_journey.current_day,
      'total_days',    coalesce((SELECT t.duration_days FROM public.journey_templates t
                                  WHERE t.code = v_journey.template_code), 14),
      'started_at',    v_journey.started_at,
      'last_active_at',v_journey.last_active_at,
      'completed_at',  v_journey.completed_at
    ),
    'progress', (
      SELECT jsonb_build_object(
        'total',     count(*),
        'completed', count(*) FILTER (WHERE m.status = 'completed'),
        'skipped',   count(*) FILTER (WHERE m.status = 'skipped'),
        'scheduled', count(*) FILTER (WHERE m.status IN ('scheduled', 'started')),
        -- 배정된 것 중 실제로 한 비율. 0 으로 나누지 않게 NULLIF 를 씁니다.
        'rate', round(
          100.0 * count(*) FILTER (WHERE m.status = 'completed')
                / NULLIF(count(*), 0)
        )
      )
      FROM public.user_missions m WHERE m.user_journey_id = v_journey.id
    ),
    -- 일자별 타임라인. 최근 14일치만. 화면이 보여주는 만큼만 내보냅니다.
    'days', coalesce((
      SELECT jsonb_agg(d ORDER BY (d->>'day_no')::int)
        FROM (
          SELECT jsonb_build_object(
                   'day_no',    m.day_no,
                   'planned',   count(*),
                   'completed', count(*) FILTER (WHERE m.status = 'completed'),
                   'skipped',   count(*) FILTER (WHERE m.status = 'skipped'),
                   'last_at',   max(m.completed_at)
                 ) AS d
            FROM public.user_missions m
           WHERE m.user_journey_id = v_journey.id
           GROUP BY m.day_no
           ORDER BY m.day_no DESC
           LIMIT 14
        ) t
    ), '[]'::jsonb),
    -- 최근 피드백 10건. 고객이 직접 남긴 말이라 상담에서 가장 쓸모 있습니다.
    'feedback', coalesce((
      SELECT jsonb_agg(f ORDER BY (f->>'created_at') DESC)
        FROM (
          SELECT jsonb_build_object(
                   'day_no',     m.day_no,
                   'feeling',    fb.feeling,
                   'difficulty', fb.difficulty,
                   'note',       fb.note,
                   'created_at', fb.created_at
                 ) AS f
            FROM public.journey_mission_feedback fb
            JOIN public.user_missions m ON m.id = fb.user_mission_id
           WHERE m.user_journey_id = v_journey.id
           ORDER BY fb.created_at DESC
           LIMIT 10
        ) t
    ), '[]'::jsonb),
    'last_activity_at', (
      SELECT max(m.completed_at) FROM public.user_missions m
       WHERE m.user_journey_id = v_journey.id AND m.status = 'completed'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_client_journey_summary(uuid) IS
  '전문가가 자기 고객의 수행 기록(진행률·일자별·피드백)을 읽는 유일한 통로. 관계가 ACTIVE 이고 동의가 있어야 한다. 아니면 NULL. user_id·연락처·문항 답변은 돌려주지 않는다.';

-- CREATE FUNCTION 은 PUBLIC 에 EXECUTE 를 준다. 044·053 에서와 같은 이유로 먼저 걷어낸다.
-- Supabase 의 기본 권한은 anon 에게도 개별로 주므로 그것도 따로 회수한다.
REVOKE ALL ON FUNCTION public.get_client_journey_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_journey_summary(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_client_journey_summary(uuid) FROM anon;

-- ---------------------------------------------------------------------------
-- 전문가 활동 로그 — "주간 활성 전문가" 를 세기 위한 최소 기록
--
-- 남기는 것: 누가(전문가) · 누구를(고객) · 무엇을(열람 종류) · 언제.
-- 남기지 않는 것: 무엇을 보았는지의 내용. 화면에 뜬 값은 기록하지 않습니다.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professional_activity_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  -- 고객이 탈퇴해도 "언제 몇 번 봤는가" 는 남아야 지표가 흔들리지 않습니다.
  client_user_id  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  event           text NOT NULL CHECK (event IN ('client_opened', 'activity_viewed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS professional_activity_log_week_idx
  ON public.professional_activity_log (created_at DESC, professional_id);

COMMENT ON TABLE public.professional_activity_log IS
  '전문가가 고객 화면을 연 기록. 주간 활성 전문가 비율을 세는 용도. 본 내용은 남기지 않는다.';

ALTER TABLE public.professional_activity_log ENABLE ROW LEVEL SECURITY;

-- 전문가는 자기 기록만 봅니다. 쓰기는 서버(서비스 롤)만 합니다 — 앱이 직접 쓰면
-- 지표를 원하는 대로 부풀릴 수 있습니다.
DROP POLICY IF EXISTS professional_activity_log_read ON public.professional_activity_log;
CREATE POLICY professional_activity_log_read ON public.professional_activity_log
  FOR SELECT TO authenticated
  USING (professional_id = public.current_professional_id() OR public.current_user_role() = 'ADMIN');

-- Supabase 기본값은 GRANT ALL 이고 거기에는 TRUNCATE 가 들어 있습니다.
-- **TRUNCATE 는 RLS 를 우회합니다.** 041(payments)·048(app_error_log)·052·054 와 같은 이유로 걷어냅니다.
REVOKE ALL ON public.professional_activity_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.professional_activity_log TO authenticated;

-- 180일 지나면 지웁니다. 지표를 세는 데 그보다 오래된 기록은 필요 없습니다(054 와 같은 기준).
CREATE OR REPLACE FUNCTION public.purge_professional_activity_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.professional_activity_log WHERE created_at < now() - interval '180 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_professional_activity_log() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_professional_activity_log() TO service_role;

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT has_function_privilege('authenticated', 'public.get_client_journey_summary(uuid)', 'EXECUTE') AS "회원_실행(true여야)",
       has_function_privilege('anon', 'public.get_client_journey_summary(uuid)', 'EXECUTE')          AS "익명_실행(false여야)";

-- 저니 테이블 정책은 손대지 않았습니다.
SELECT tablename AS 테이블, policyname AS 정책, cmd AS 동작
  FROM pg_policies
 WHERE tablename IN ('user_journeys', 'user_missions', 'journey_mission_feedback')
 ORDER BY tablename, cmd, policyname;

-- 활동 로그에 익명·회원의 쓰기 권한이 남아 있으면 안 됩니다.
SELECT has_table_privilege('anon', 'public.professional_activity_log', 'INSERT')          AS "익명_쓰기(false여야)",
       has_table_privilege('authenticated', 'public.professional_activity_log', 'INSERT') AS "회원_쓰기(false여야)",
       has_table_privilege('authenticated', 'public.professional_activity_log', 'TRUNCATE') AS "회원_TRUNCATE(false여야)",
       has_table_privilege('authenticated', 'public.professional_activity_log', 'SELECT')  AS "회원_읽기(true여야)";
