-- MEBODY Journey — RLS 정책
--
-- 배경: questionnaire_responses 는 현재 anon 키로 전 행이 읽힌다(2026-08-27 실측).
--       Journey 테이블에서는 이 패턴을 반복하지 않는다.
--
--   카탈로그 2개  : anon/authenticated 읽기 전용
--   사용자 4개    : authenticated 본인 행만, anon 은 권한 0
--
-- 재실행 안전(idempotent).

BEGIN;

-- ---------------------------------------------------------------------------
-- 카탈로그: 읽기 전용 공개
-- ---------------------------------------------------------------------------
ALTER TABLE public.journey_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_content_tags ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.journey_templates    FROM anon, authenticated;
REVOKE ALL ON public.journey_content_tags FROM anon, authenticated;
GRANT SELECT ON public.journey_templates    TO anon, authenticated;
GRANT SELECT ON public.journey_content_tags TO anon, authenticated;

DROP POLICY IF EXISTS journey_templates_read ON public.journey_templates;
CREATE POLICY journey_templates_read ON public.journey_templates
  FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS journey_content_tags_read ON public.journey_content_tags;
CREATE POLICY journey_content_tags_read ON public.journey_content_tags
  FOR SELECT TO anon, authenticated USING (is_active);


-- ---------------------------------------------------------------------------
-- 사용자 데이터: 본인 행만. anon 전면 차단.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_journeys            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_mission_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_reports          ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_journeys            FROM anon, authenticated;
REVOKE ALL ON public.user_missions            FROM anon, authenticated;
REVOKE ALL ON public.journey_mission_feedback FROM anon, authenticated;
REVOKE ALL ON public.journey_reports          FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.user_journeys            TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_missions            TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.journey_mission_feedback TO authenticated;
GRANT SELECT, INSERT         ON public.journey_reports          TO authenticated;
-- DELETE 는 부여하지 않는다. 이력은 지우지 않고 status 로 관리한다.

DROP POLICY IF EXISTS user_journeys_select_own ON public.user_journeys;
CREATE POLICY user_journeys_select_own ON public.user_journeys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_journeys_insert_own ON public.user_journeys;
CREATE POLICY user_journeys_insert_own ON public.user_journeys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_journeys_update_own ON public.user_journeys;
CREATE POLICY user_journeys_update_own ON public.user_journeys
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


DROP POLICY IF EXISTS user_missions_select_own ON public.user_missions;
CREATE POLICY user_missions_select_own ON public.user_missions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_missions_insert_own ON public.user_missions;
CREATE POLICY user_missions_insert_own ON public.user_missions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_missions_update_own ON public.user_missions;
CREATE POLICY user_missions_update_own ON public.user_missions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


DROP POLICY IF EXISTS journey_mission_feedback_select_own ON public.journey_mission_feedback;
CREATE POLICY journey_mission_feedback_select_own ON public.journey_mission_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS journey_mission_feedback_insert_own ON public.journey_mission_feedback;
CREATE POLICY journey_mission_feedback_insert_own ON public.journey_mission_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS journey_mission_feedback_update_own ON public.journey_mission_feedback;
CREATE POLICY journey_mission_feedback_update_own ON public.journey_mission_feedback
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


DROP POLICY IF EXISTS journey_reports_select_own ON public.journey_reports;
CREATE POLICY journey_reports_select_own ON public.journey_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS journey_reports_insert_own ON public.journey_reports;
CREATE POLICY journey_reports_insert_own ON public.journey_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

COMMIT;


-- ---------------------------------------------------------------------------
-- 배포 직후 반드시 확인 (anon 키로 실행)
--   GET /rest/v1/journey_templates      -> 1행
--   GET /rest/v1/journey_content_tags   -> 23행
--   GET /rest/v1/user_journeys          -> [] (빈 배열이어야 함)
--   GET /rest/v1/user_missions          -> []
--   GET /rest/v1/journey_mission_feedback -> []
--   GET /rest/v1/journey_reports        -> []
-- ---------------------------------------------------------------------------
