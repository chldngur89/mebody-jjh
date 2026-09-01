-- MEBODY — 현재 DB 에 지금 적용할 전체 (하드닝 + Journey)
--
-- 실사용자가 없는 상태이므로 한 번에 적용합니다.
-- 각 원본 파일과 내용이 같으며, 재실행해도 안전합니다.
--
-- 포함
--   200  RLS 전면 활성화 + anon 쓰기 권한 회수 (보안 구멍 차단)
--   210  응답 전체 열람 정책 제거 + 조회 RPC
--   020~032  Journey · 적립금 · 주문 · 멤버십
--
-- 적용 후 확인
--   npm run verify:hardening
--   npm run verify:journey-db
--
-- 되돌리기
--   Journey 만: db/journey/099_rollback.sql
--   하드닝: db/hardening/RUNBOOK.md 의 롤백 SQL


-- ############ 200_dev_rls_fix.sql ###############################
-- MEBODY — 개발계 보안 하드닝 (앱 코드 변경 없이 적용 가능한 부분)
--
-- 2026-08-29 개발계 점검에서 확인된 문제:
--
--   1) body_code_content   RLS 꺼짐 + anon DELETE 권한
--      → 브라우저 번들에 실려 나가는 공개 anon 키로 결과 콘텐츠 16행 삭제 가능
--   2) admin_audit_logs    RLS 꺼짐 + anon 전체 권한
--      → 감사 로그 열람·위조·삭제 가능
--   3) questionnaire_responses  "Allow anonymous access ... FOR ALL USING (true)"
--      → 남의 응답 380행 열람·수정·삭제 가능
--   4) public 전 테이블에 anon INSERT/UPDATE/DELETE 권한이 부여되어 있음
--
-- 이 파일은 (1)(2)(4) 와 (3) 중 "읽기 제한을 제외한" 부분을 고칩니다.
-- (3) 의 anon 읽기 차단은 앱이 RPC 로 읽도록 바꿔야 하므로 210 에서 따로 다룹니다.
--
-- 적용해도 현재 앱 동작은 그대로입니다. 콘텐츠 조회는 SELECT 만 쓰고,
-- 설문 저장은 INSERT/UPDATE 만 쓰기 때문입니다.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) 모든 테이블 RLS 활성화 + anon/authenticated 권한 전면 회수 후 재부여
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT relname FROM pg_class
            WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.relname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) 콘텐츠 · 카탈로그 — 읽기만 재부여
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'questions','question_choice_scores','body_code_content','body_code_next_page',
    'body_code_result_sections','result_guide','app_content','app_images',
    'immediate_action_content','immediate_action_axis_mapping','immediate_action_discomfort_mapping'
  ] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_public_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
                   t || '_public_read', t);
  END LOOP;
END $$;

GRANT SELECT ON public.products TO anon, authenticated;
DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products
  FOR SELECT TO anon, authenticated USING (status = 'ACTIVE');

-- ---------------------------------------------------------------------------
-- 3) 사용자 프로필 — 본인 행만
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) 설문 응답 — 위험한 "FOR ALL USING (true)" 정책 제거
--
--    비회원 진단이 계속 동작해야 하므로 INSERT/UPDATE 는 유지합니다.
--    읽기 차단은 210 에서 앱 변경과 함께 적용합니다.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow anonymous access to questionnaire_responses" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "questionnaire_responses update" ON public.questionnaire_responses;

GRANT SELECT, INSERT, UPDATE ON public.questionnaire_responses TO anon, authenticated;

DROP POLICY IF EXISTS questionnaire_responses_update_scoped ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_update_scoped ON public.questionnaire_responses
  FOR UPDATE TO anon, authenticated
  -- 주인이 없는 행이거나 본인 행만. 남의 완료 결과는 수정할 수 없다.
  USING (user_id IS NULL OR auth.uid() = user_id)
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5) 서버 전용 테이블 — 클라이언트 권한 없음 (service_role 만 접근)
--    admin_audit_logs / missions / user_mission_progress / body_bti_results
--    위 1)에서 이미 회수했고 정책도 부여하지 않는다.
-- ---------------------------------------------------------------------------

COMMIT;


-- ############ 210_response_read_lock.sql ########################
-- MEBODY — 설문 응답 읽기 제한 (1단계: 회원 응답 보호)
--
-- 200 을 적용해도 아래 정책이 남아 남의 응답을 전부 읽을 수 있습니다.
--   "questionnaire_responses read"  FOR SELECT USING (true)   → 380행 전부 열람
--
-- 여기서는 회원 응답을 먼저 보호합니다. 비회원 응답 열거까지 막으려면
-- INSERT 도 RPC 로 바꿔야 하므로 220 에서 앱 변경과 함께 진행합니다.
--
-- 왜 SELECT 정책을 완전히 지우면 안 되는가
--   앱은 insert(...).select().single() 로 저장합니다. 이는 INSERT ... RETURNING 이고,
--   RETURNING 은 반환 행을 읽을 SELECT 권한을 요구합니다.
--   SELECT 정책을 모두 지우면 비회원 진단 저장 자체가 42501 로 실패합니다.
--   (드라이런에서 실제로 재현했습니다)

BEGIN;

-- UUID 를 아는 경우에만 한 행을 돌려주는 조회 함수. 앱이 우선 사용합니다.
CREATE OR REPLACE FUNCTION public.get_questionnaire_response(p_id uuid)
RETURNS TABLE (
  id uuid, answers jsonb, calculated_code varchar, status text,
  primary_identity text, scoring_meta jsonb,
  created_at timestamptz, updated_at timestamptz, completed_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.id, r.answers, r.calculated_code, r.status,
         r.primary_identity, r.scoring_meta,
         r.created_at, r.updated_at, r.completed_at
    FROM public.questionnaire_responses r
   WHERE r.id = p_id
     AND (r.user_id IS NULL OR r.user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_questionnaire_response(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_questionnaire_response(uuid) TO anon, authenticated;

-- 전체 열람을 허용하던 정책 제거
DROP POLICY IF EXISTS "questionnaire_responses read" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "Users can view own responses" ON public.questionnaire_responses;

-- 비회원: 주인이 없는 행만 읽을 수 있다.
--   회원의 완료 결과(user_id 있음)는 더 이상 보이지 않는다.
--   INSERT ... RETURNING 이 동작하려면 이 정책이 필요하다.
DROP POLICY IF EXISTS questionnaire_responses_select_anon ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_select_anon ON public.questionnaire_responses
  FOR SELECT TO anon USING (user_id IS NULL);

-- 로그인 사용자: 본인 행 + 아직 귀속되지 않은 행(로그인 직후 귀속 처리에 필요)
DROP POLICY IF EXISTS questionnaire_responses_select_own ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_select_own ON public.questionnaire_responses
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

COMMIT;

-- 남은 위험
--   비회원 응답(user_id IS NULL)은 여전히 열거 가능합니다.
--   답변과 계산된 코드만 있고 이름·이메일·사용자 ID 는 없지만, 완전한 차단은 아닙니다.
--   220 에서 INSERT 를 RPC 로 바꾸면 이 정책도 제거할 수 있습니다.


-- ############ 024_combined.sql ##################################
-- MEBODY Journey — 전체 합본 (020~032)
--
-- Supabase SQL Editor 에 이 파일 하나만 붙여넣어 실행하면 됩니다.
-- 개별 파일과 내용이 같으며, 재실행해도 안전합니다.
-- 되돌리려면 099_rollback.sql 을 사용합니다.
--
-- 포함 내용
--   020~023  Journey 스키마 · RLS · 시드 (신규 테이블 6개)
--   030      동작 이미지 컬럼 (immediate_action_content 에 컬럼 2개 추가, 값은 NULL)
--   031      적립금 통합 원장 (적립·사용·환불·소멸을 부호로 기록)
--   032      멤버십 · 주문 · 적립금 차감 (등급별 적립 배수 포함)
--
-- 사전 점검 완료 (롤백되는 트랜잭션 안에서 실제 DB 대상):
--   스키마·RLS 20건 / 미션 생성 17건 / 리워드 17건 / 주문·차감 21건 / 합본·롤백 8건
--   * 금액은 서버 함수만 결정하며 클라이언트는 원장·주문에 쓸 수 없음
--   * 주문 취소 시 적립금이 환불 엔트리로 복구되고 이중 환불이 없음
--   * 잔액 초과·음수 사용 요청은 서버에서 잘림, 동시 주문은 사용자 단위 락으로 직렬화


-- ===== 020_journey_schema.sql ==============================
-- MEBODY Journey — 신규 테이블 6개
--
-- 원칙
--   * 기존 테이블의 컬럼·행·제약을 변경하지 않는다.
--   * missions / user_mission_progress (Spring JPA 매핑) 은 건드리지 않는다.
--   * 미션 콘텐츠 본문은 immediate_action_content(23행) 를 그대로 재사용한다.
--
-- 적용: Supabase SQL Editor 에서 020 → 021 → 022 → 023 순서로 실행.
-- 재실행 안전(idempotent).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- supabase_v1_foundation.sql 에서 이미 만들었지만 단독 실행 대비
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- 1) journey_templates — 카탈로그
--    16개 코드별 프로그램을 하드코딩하지 않는다. Day 슬롯 "규칙"만 담는다.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journey_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  duration_days integer NOT NULL DEFAULT 14,
  day_plan      jsonb NOT NULL DEFAULT '{"days":[]}'::jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.journey_templates IS
  'Journey 템플릿. day_plan 은 Day별 슬롯 규칙(axis_rank/mission_type)만 담고, 실제 콘텐츠는 런타임에 조합한다.';

DROP TRIGGER IF EXISTS journey_templates_updated_at ON public.journey_templates;
CREATE TRIGGER journey_templates_updated_at
BEFORE UPDATE ON public.journey_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 2) journey_content_tags — 카탈로그
--    immediate_action_content 에 추천 규칙이 필요한 메타를 붙인다.
--    본문(이완/스트레칭 텍스트)은 여기에 복사하지 않는다.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journey_content_tags (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key       text NOT NULL UNIQUE,
  axis_key          text,
  direction_key     text,
  body_part_key     text,
  mission_type      text NOT NULL DEFAULT 'combo',
  difficulty        integer NOT NULL DEFAULT 2,
  base_duration_sec integer NOT NULL DEFAULT 180,
  equipment         text[] NOT NULL DEFAULT '{}',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey_content_tags_axis_check
    CHECK (axis_key IS NULL OR axis_key IN ('neck','shoulder','pelvis','lower')),
  CONSTRAINT journey_content_tags_type_check
    CHECK (mission_type IN ('release','stretch','combo')),
  CONSTRAINT journey_content_tags_difficulty_check
    CHECK (difficulty BETWEEN 1 AND 3)
);

COMMENT ON TABLE public.journey_content_tags IS
  'immediate_action_content.content_key 에 축/방향/부위/난이도/도구 메타를 붙인 추천 입력 테이블. 본문은 immediate_action_content 가 정본.';
COMMENT ON COLUMN public.journey_content_tags.difficulty IS
  '1=맨손, 2=소도구(마사지볼 등) 또는 맨손 대체 가능, 3=폼롤러 필수. 원본 데이터의 강도 정보가 없어 도구 부담을 대리 지표로 사용한다.';
COMMENT ON COLUMN public.journey_content_tags.mission_type IS
  '콘텐츠가 제공할 수 있는 형태. 원본 23행은 모두 이완+스트레칭을 가지므로 combo. 배정 시점의 형태는 user_missions.mission_type 이다.';
COMMENT ON COLUMN public.journey_content_tags.base_duration_sec IS
  'combo 기준 180초 = 이완 90초 + 스트레칭 30초 x 3세트.';

CREATE INDEX IF NOT EXISTS journey_content_tags_axis_idx
  ON public.journey_content_tags (axis_key, direction_key) WHERE is_active;
CREATE INDEX IF NOT EXISTS journey_content_tags_body_part_idx
  ON public.journey_content_tags (body_part_key) WHERE is_active;

DROP TRIGGER IF EXISTS journey_content_tags_updated_at ON public.journey_content_tags;
CREATE TRIGGER journey_content_tags_updated_at
BEFORE UPDATE ON public.journey_content_tags
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- content_key 를 안정적인 조인 키로 쓰기 위한 UNIQUE 인덱스.
-- 기존 테이블에 인덱스를 "추가"만 하며 컬럼/행은 변경하지 않는다.
-- 중복이 있으면 실패하므로 먼저 확인:
--   SELECT content_key, count(*) FROM public.immediate_action_content
--   GROUP BY 1 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS immediate_action_content_content_key_uidx
  ON public.immediate_action_content (content_key);


-- ---------------------------------------------------------------------------
-- 3) user_journeys — 사용자가 시작한 Journey 1건
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_journeys (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  questionnaire_response_id uuid REFERENCES public.questionnaire_responses(id) ON DELETE SET NULL,
  template_code             text NOT NULL DEFAULT 'starter_14d',
  body_code                 text,
  axis_priority             jsonb NOT NULL DEFAULT '[]'::jsonb,
  status                    text NOT NULL DEFAULT 'active',
  current_day               integer NOT NULL DEFAULT 1,
  started_at                timestamptz NOT NULL DEFAULT now(),
  last_active_at            timestamptz NOT NULL DEFAULT now(),
  completed_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_journeys_status_check
    CHECK (status IN ('active','completed','abandoned')),
  CONSTRAINT user_journeys_current_day_check
    CHECK (current_day BETWEEN 1 AND 60)
);

COMMENT ON COLUMN public.user_journeys.axis_priority IS
  '시작 시점 관리 우선순위 스냅샷. [{"rank":1,"axis":"pelvis","direction":"R","percent":72}, ...]. 진행 중 재진단이 있어도 14일 프로그램이 흔들리지 않게 고정한다.';
COMMENT ON COLUMN public.user_journeys.questionnaire_response_id IS
  '로컬 결과(local-result-*)는 UUID 가 아니므로 연결할 수 없다. Journey 는 로그인 필수이며 DB 에 저장된 결과만 연결한다.';

-- 사용자당 진행 중 Journey 는 1개
CREATE UNIQUE INDEX IF NOT EXISTS user_journeys_one_active_uidx
  ON public.user_journeys (user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS user_journeys_user_idx
  ON public.user_journeys (user_id, started_at DESC);

DROP TRIGGER IF EXISTS user_journeys_updated_at ON public.user_journeys;
CREATE TRIGGER user_journeys_updated_at
BEFORE UPDATE ON public.user_journeys
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 4) user_missions — Day/슬롯에 배정된 미션 인스턴스
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_missions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_journey_id      uuid NOT NULL REFERENCES public.user_journeys(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_no               integer NOT NULL,
  slot_no              integer NOT NULL DEFAULT 1,
  content_key          text NOT NULL,
  mission_type         text NOT NULL DEFAULT 'combo',
  planned_duration_sec integer NOT NULL DEFAULT 180,
  difficulty           integer NOT NULL DEFAULT 2,
  source_rule          text,
  status               text NOT NULL DEFAULT 'scheduled',
  started_at           timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_missions_status_check
    CHECK (status IN ('scheduled','started','completed','skipped')),
  CONSTRAINT user_missions_type_check
    CHECK (mission_type IN ('release','stretch','combo')),
  CONSTRAINT user_missions_difficulty_check
    CHECK (difficulty BETWEEN 1 AND 3),
  CONSTRAINT user_missions_day_slot_uniq
    UNIQUE (user_journey_id, day_no, slot_no)
);

COMMENT ON COLUMN public.user_missions.source_rule IS
  '이 미션이 나온 이유: axis_p1 | axis_p2 | substitute | restart. 추천 결과 추적용.';
COMMENT ON COLUMN public.user_missions.user_id IS
  'RLS 단순화를 위한 비정규화. user_journeys.user_id 와 항상 같아야 한다.';

CREATE INDEX IF NOT EXISTS user_missions_journey_day_idx
  ON public.user_missions (user_journey_id, day_no, slot_no);
CREATE INDEX IF NOT EXISTS user_missions_user_completed_idx
  ON public.user_missions (user_id, completed_at DESC);

DROP TRIGGER IF EXISTS user_missions_updated_at ON public.user_missions;
CREATE TRIGGER user_missions_updated_at
BEFORE UPDATE ON public.user_missions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 5) journey_mission_feedback — 미션 1건당 피드백 1건
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journey_mission_feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_mission_id uuid NOT NULL UNIQUE REFERENCES public.user_missions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feeling         text NOT NULL,
  difficulty      text NOT NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey_mission_feedback_feeling_check
    CHECK (feeling IN ('BETTER','SAME','UNCOMFORTABLE')),
  CONSTRAINT journey_mission_feedback_difficulty_check
    CHECK (difficulty IN ('EASY','GOOD','HARD'))
);

CREATE INDEX IF NOT EXISTS journey_mission_feedback_user_idx
  ON public.journey_mission_feedback (user_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- 6) journey_reports — Day 7 Weekly Report / Day 14 Progress Check
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journey_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_journey_id uuid NOT NULL REFERENCES public.user_journeys(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type     text NOT NULL,
  day_no          integer NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey_reports_type_check
    CHECK (report_type IN ('weekly','progress_check')),
  CONSTRAINT journey_reports_uniq
    UNIQUE (user_journey_id, report_type, day_no)
);

COMMENT ON TABLE public.journey_reports IS
  'WeeklyReport 와 ProgressCheck 는 저장 구조가 같아 report_type 으로 구분한다.';

CREATE INDEX IF NOT EXISTS journey_reports_user_idx
  ON public.journey_reports (user_id, created_at DESC);

COMMIT;


-- ===== 021_journey_rls.sql =================================
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


-- ===== 022_seed_journey_template.sql =======================
-- MEBODY Journey — starter_14d 템플릿 시드
--
-- 16개 코드별 프로그램을 하드코딩하지 않는다.
-- 여기에는 "Day N 에 P1축/P2축 미션을 몇 개 배치할지"만 있고,
-- 어떤 콘텐츠가 나올지는 런타임에 journey_content_tags + 피드백으로 결정된다.
--
--   홀수일  -> P1축(가장 뚜렷한 축) 1개
--   짝수일  -> P2축 1개
--   Day 7   -> P1 이완 + P2 스트레칭 + Weekly Report
--   Day 14  -> P1 + P2 + Progress Check
--
-- 재실행 안전: code 충돌 시 갱신.

INSERT INTO public.journey_templates (code, name, description, duration_days, day_plan, is_active)
VALUES (
  'starter_14d',
  '14일 스타터 저니',
  '결과에서 확인한 관리 우선순위 1·2축을 하루 한 가지씩 짧게 관리하는 2주 프로그램입니다.',
  14,
  '{
  "version": 1,
  "base_difficulty": {
    "1-4": 1,
    "5-10": 2,
    "11-14": 3
  },
  "days": [
    {
      "day": 1,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 2,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 3,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 4,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 5,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 6,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 7,
      "kind": "weekly_report",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "release"
        },
        {
          "slot_no": 2,
          "axis_rank": 2,
          "mission_type": "stretch"
        }
      ]
    },
    {
      "day": 8,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 9,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 10,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 11,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 12,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 13,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 14,
      "kind": "progress_check",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        },
        {
          "slot_no": 2,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    }
  ]
}'::jsonb,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  duration_days = EXCLUDED.duration_days,
  day_plan      = EXCLUDED.day_plan,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();


-- ===== 023_seed_journey_content_tags.sql ===================
-- MEBODY Journey — journey_content_tags 시드 (23행)
--
-- immediate_action_content 23행에 추천 규칙이 쓸 메타를 붙인다.
-- 본문(이완/스트레칭 텍스트, 주의사항)은 복사하지 않고 immediate_action_content 를 조회한다.
--
-- difficulty 산출 근거 (원본에 강도 정보가 없어 도구 부담을 대리 지표로 사용):
--   1 = 맨손만            (손)
--   2 = 맨손 대체 가능 또는 소도구 (손/폼롤러, 손/폼롤러/마사지볼, 마사지볼, 마사지볼/테니스볼)
--   3 = 폼롤러 필요        (폼롤러, 폼롤러/마사지볼)
--
-- base_duration_sec = 180 = 이완 90초 + 스트레칭 30초 x 3세트 (원본 23행 전부 동일 규격)
--
-- 재실행 안전: content_key 충돌 시 갱신.

INSERT INTO public.journey_content_tags
  (content_key, axis_key, direction_key, body_part_key, mission_type, difficulty, base_duration_sec, equipment, is_active)
VALUES
  ('neck_right', NULL, 'R', 'neck', 'combo', 1, 180, '{"손"}'::text[], true),
  ('neck_left', NULL, 'L', 'neck', 'combo', 1, 180, '{"손"}'::text[], true),
  ('shoulder_right', NULL, 'R', 'shoulder', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('shoulder_left', NULL, 'L', 'shoulder', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('back_both', NULL, 'both', 'back', 'combo', 3, 180, '{"폼롤러"}'::text[], true),
  ('waist_right', NULL, 'R', 'waist', 'combo', 2, 180, '{"마사지볼"}'::text[], true),
  ('waist_left', NULL, 'L', 'waist', 'combo', 2, 180, '{"마사지볼"}'::text[], true),
  ('pelvis_right', NULL, 'R', 'pelvis', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('pelvis_left', NULL, 'L', 'pelvis', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('knee_right', NULL, 'R', 'knee', 'combo', 2, 180, '{"손","폼롤러","마사지볼"}'::text[], true),
  ('knee_left', NULL, 'L', 'knee', 'combo', 2, 180, '{"손","폼롤러","마사지볼"}'::text[], true),
  ('ankle_right', NULL, 'R', 'ankle', 'combo', 2, 180, '{"손","폼롤러"}'::text[], true),
  ('ankle_left', NULL, 'L', 'ankle', 'combo', 2, 180, '{"손","폼롤러"}'::text[], true),
  ('foot_right', NULL, 'R', 'foot', 'combo', 2, 180, '{"마사지볼","테니스볼"}'::text[], true),
  ('foot_left', NULL, 'L', 'foot', 'combo', 2, 180, '{"마사지볼","테니스볼"}'::text[], true),
  ('axis_1F', 'neck', 'F', 'neck', 'combo', 1, 180, '{"손"}'::text[], true),
  ('axis_1C', 'neck', 'C', 'neck', 'combo', 1, 180, '{"손"}'::text[], true),
  ('axis_2R', 'shoulder', 'R', 'shoulder', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('axis_2L', 'shoulder', 'L', 'shoulder', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('axis_3R', 'pelvis', 'R', 'pelvis', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('axis_3L', 'pelvis', 'L', 'pelvis', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('axis_4S', 'lower', 'S', 'lower', 'combo', 3, 180, '{"폼롤러"}'::text[], true),
  ('axis_4F', 'lower', 'F', 'lower', 'combo', 1, 180, '{"손"}'::text[], true)
ON CONFLICT (content_key) DO UPDATE SET
  axis_key          = EXCLUDED.axis_key,
  direction_key     = EXCLUDED.direction_key,
  body_part_key     = EXCLUDED.body_part_key,
  mission_type      = EXCLUDED.mission_type,
  difficulty        = EXCLUDED.difficulty,
  base_duration_sec = EXCLUDED.base_duration_sec,
  equipment         = EXCLUDED.equipment,
  is_active         = EXCLUDED.is_active,
  updated_at        = now();


-- 검증
--   SELECT count(*) FROM public.journey_content_tags;                       -- 23
--   SELECT count(*) FROM public.journey_content_tags WHERE axis_key IS NOT NULL;  -- 8
--   SELECT t.content_key FROM public.journey_content_tags t
--     LEFT JOIN public.immediate_action_content c USING (content_key)
--    WHERE c.content_key IS NULL;                                           -- 0행이어야 함


-- ===== 030_action_media.sql ================================
-- MEBODY — 동작 이미지 컬럼
--
-- 가이드가 전부 텍스트라 "귀 아래~쇄골 연결 근육을 엄지와 검지로 잡는다" 같은
-- 지시를 글로만 읽고 따라 하기 어렵습니다. 이미지를 붙일 자리를 먼저 만듭니다.
--
-- 컬럼만 추가하며 기존 컬럼과 행은 변경하지 않습니다. 값은 전부 NULL 로 시작하고,
-- NULL 이면 화면은 지금과 똑같이 텍스트만 보여줍니다.

BEGIN;

ALTER TABLE public.immediate_action_content
  ADD COLUMN IF NOT EXISTS release_image_url text,
  ADD COLUMN IF NOT EXISTS stretch_image_url text;

COMMENT ON COLUMN public.immediate_action_content.release_image_url IS
  '이완 동작 이미지. Storage 경로 또는 전체 URL. 권장 경로: actions/{content_key}_release.png';
COMMENT ON COLUMN public.immediate_action_content.stretch_image_url IS
  '스트레칭 동작 이미지. 권장 경로: actions/{content_key}_stretch.png';

COMMIT;

-- 업로드 방법
--   1) Supabase Storage 의 images 버킷에 actions/ 폴더를 만들고 이미지를 올립니다.
--   2) 아래처럼 경로만 넣으면 앱이 공개 URL 로 변환합니다(전체 URL 을 넣어도 됩니다).
--
--   UPDATE public.immediate_action_content
--      SET release_image_url = 'actions/' || content_key || '_release.png',
--          stretch_image_url = 'actions/' || content_key || '_stretch.png';
--
--   특정 동작만 넣으려면:
--   UPDATE public.immediate_action_content
--      SET release_image_url = 'actions/axis_1F_release.png'
--    WHERE content_key = 'axis_1F';


-- ===== 031_rewards.sql =====================================
-- MEBODY — 적립금 (통합 원장)
--
-- 원칙
--   1) 금액은 항상 서버(Postgres 함수)가 정한다. 클라이언트는 원장에 직접 쓸 수 없다.
--   2) 적립·사용·환불·소멸을 한 원장에 부호 있는 금액으로 기록한다. 잔액 = SUM(amount).
--   3) 무상 발행(미션/완주)과 유상 발행(구독 대가)을 구분해 기록한다.
--      정산·정책 대응 시 성격이 다르므로 나중에 나누려면 이력을 복원할 수 없다.
--
-- 지급 구조
--   earn_mission       : 미션 1건 완료당 1~7원 가중 추첨 (기대값 약 3원)
--   earn_journey       : 14일 저니 완료 시 50원 고정
--   earn_subscription  : 구독 등급별 지급 (선택)
--   구독 등급 배수      : membership_plans.reward_multiplier 로 미션 적립을 배수 적용
--
-- 사용
--   spend_order        : 상품 결제에 사용 (음수)
--   refund_order       : 주문 취소·결제 실패 시 복구 (양수)
--   expire             : 유효기간 소멸 (음수)

BEGIN;

-- ---------------------------------------------------------------------------
-- 지급 규칙 (확률 고지를 위해 공개 읽기)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  display_label text NOT NULL,
  disclosure    text NOT NULL,
  min_amount    integer,
  max_amount    integer,
  fixed_amount  integer,
  weights       jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reward_rules_shape_check
    CHECK (fixed_amount IS NOT NULL OR weights IS NOT NULL)
);

COMMENT ON COLUMN public.reward_rules.disclosure IS
  '사용자에게 보여줄 확률·조건 고지 문구. 경품/할인 운영 시 고지 의무가 있어 화면에 노출합니다.';

DROP TRIGGER IF EXISTS reward_rules_updated_at ON public.reward_rules;
CREATE TRIGGER reward_rules_updated_at
BEFORE UPDATE ON public.reward_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 통합 원장 — 서버 함수로만 기록된다
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type      text NOT NULL,
  rule_code       text,
  -- 적립은 양수, 사용·소멸은 음수. 잔액은 SUM(amount).
  amount          integer NOT NULL CHECK (amount <> 0),
  -- 무상(마일리지) / 유상(구독 대가) 구분. 정산 성격이 달라 발행 시점에 남긴다.
  issue_type      text NOT NULL DEFAULT 'free',
  source_type     text NOT NULL,
  source_id       uuid NOT NULL,
  user_journey_id uuid REFERENCES public.user_journeys(id) ON DELETE SET NULL,
  memo            text,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_rewards_entry_type_check CHECK (entry_type IN
    ('earn_mission','earn_journey','earn_subscription','spend_order','refund_order','expire')),
  CONSTRAINT user_rewards_issue_type_check CHECK (issue_type IN ('free','paid')),
  CONSTRAINT user_rewards_source_type_check CHECK (source_type IN
    ('mission','journey','subscription','order','system')),
  -- 적립은 양수, 사용/소멸은 음수여야 한다
  CONSTRAINT user_rewards_sign_check CHECK (
    (entry_type IN ('earn_mission','earn_journey','earn_subscription','refund_order') AND amount > 0)
    OR (entry_type IN ('spend_order','expire') AND amount < 0)
  ),
  -- 같은 사건으로 두 번 기록되지 않는다
  CONSTRAINT user_rewards_once_per_event UNIQUE (user_id, entry_type, source_id)
);

CREATE INDEX IF NOT EXISTS user_rewards_user_idx ON public.user_rewards (user_id, created_at DESC);

COMMENT ON TABLE public.user_rewards IS
  '적립금 통합 원장. 잔액은 SUM(amount). 클라이언트는 INSERT 권한이 없고 SECURITY DEFINER 함수로만 기록된다.';

-- ---------------------------------------------------------------------------
-- 잔액 조회 (함수 내부·화면 공용)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reward_balance(p_user uuid)
RETURNS integer
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE(sum(amount), 0)::int FROM public.user_rewards WHERE user_id = p_user;
$$;

-- ---------------------------------------------------------------------------
-- 추첨 — 가중치 기반. 서버에서만 실행된다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.draw_reward_amount(p_code text)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rule   public.reward_rules;
  v_total  numeric := 0;
  v_pick   numeric;
  v_acc    numeric := 0;
  v_key    text;
  v_weight numeric;
BEGIN
  SELECT * INTO v_rule FROM public.reward_rules WHERE code = p_code AND is_active;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_rule.fixed_amount IS NOT NULL THEN RETURN v_rule.fixed_amount; END IF;

  SELECT COALESCE(sum(value::numeric), 0) INTO v_total FROM jsonb_each_text(v_rule.weights);
  IF v_total <= 0 THEN RETURN COALESCE(v_rule.min_amount, 0); END IF;

  v_pick := random() * v_total;
  FOR v_key, v_weight IN
    SELECT key, value::numeric FROM jsonb_each_text(v_rule.weights) ORDER BY key::int
  LOOP
    v_acc := v_acc + v_weight;
    IF v_pick <= v_acc THEN RETURN v_key::int; END IF;
  END LOOP;

  RETURN COALESCE(v_rule.max_amount, 0);
END $$;

-- ---------------------------------------------------------------------------
-- 구독 등급 적립 배수 — 활성 구독이 없으면 1.0
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reward_multiplier_for(p_user uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  v_multiplier numeric;
BEGIN
  SELECT p.reward_multiplier INTO v_multiplier
    FROM public.user_subscriptions s
    JOIN public.membership_plans p ON p.code = s.plan_code
   WHERE s.user_id = p_user
     AND s.status IN ('trialing', 'active')
     AND (s.current_period_end IS NULL OR s.current_period_end > now())
   ORDER BY p.reward_multiplier DESC
   LIMIT 1;

  RETURN COALESCE(v_multiplier, 1.0);
EXCEPTION
  WHEN undefined_table THEN RETURN 1.0;
END $$;

-- ---------------------------------------------------------------------------
-- 미션 완료 적립 — 본인의 완료된 미션에 대해 1회만
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_mission_reward(p_mission_id uuid)
RETURNS TABLE (amount integer, already_claimed boolean, balance integer, multiplier numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  v_base := public.draw_reward_amount('daily_mission');
  v_mult := public.reward_multiplier_for(v_user);
  v_amount := GREATEST(1, round(v_base * v_mult)::int);

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, user_journey_id, memo)
  VALUES
    (v_user, 'earn_mission', 'daily_mission', v_amount, 'free', 'mission', p_mission_id, v_journey,
     CASE WHEN v_mult <> 1.0 THEN format('기본 %s원 x 등급 %s배', v_base, v_mult) ELSE NULL END);

  RETURN QUERY SELECT v_amount, false, public.reward_balance(v_user), v_mult;
END $$;

-- ---------------------------------------------------------------------------
-- 저니 완주 적립 — 완료된 본인 저니에 대해 1회만
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_journey_reward(p_journey_id uuid)
RETURNS TABLE (amount integer, already_claimed boolean, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_ok     boolean;
  v_amount integer;
  v_prev   integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT true INTO v_ok
    FROM public.user_journeys j
   WHERE j.id = p_journey_id AND j.user_id = v_user AND j.status = 'completed';

  IF v_ok IS NULL THEN
    RAISE EXCEPTION 'journey not completed or not owned' USING ERRCODE = '42501';
  END IF;

  SELECT r.amount INTO v_prev
    FROM public.user_rewards r
   WHERE r.user_id = v_user AND r.entry_type = 'earn_journey' AND r.source_id = p_journey_id;

  IF v_prev IS NOT NULL THEN
    RETURN QUERY SELECT v_prev, true, public.reward_balance(v_user);
    RETURN;
  END IF;

  v_amount := public.draw_reward_amount('journey_complete');

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, user_journey_id)
  VALUES
    (v_user, 'earn_journey', 'journey_complete', v_amount, 'free', 'journey', p_journey_id, p_journey_id);

  RETURN QUERY SELECT v_amount, false, public.reward_balance(v_user);
END $$;

-- ---------------------------------------------------------------------------
-- 권한 · RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.reward_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reward_rules FROM anon, authenticated;
REVOKE ALL ON public.user_rewards FROM anon, authenticated;

GRANT SELECT ON public.reward_rules TO anon, authenticated;
GRANT SELECT ON public.user_rewards TO authenticated;

DROP POLICY IF EXISTS reward_rules_read ON public.reward_rules;
CREATE POLICY reward_rules_read ON public.reward_rules
  FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS user_rewards_select_own ON public.user_rewards;
CREATE POLICY user_rewards_select_own ON public.user_rewards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Postgres 는 함수 EXECUTE 를 기본으로 PUBLIC 에 부여한다.
-- anon/authenticated 만 REVOKE 하면 PUBLIC 경유로 여전히 호출된다. 반드시 PUBLIC 부터 회수한다.
REVOKE ALL ON FUNCTION public.draw_reward_amount(text)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_multiplier_for(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_balance(uuid)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_mission_reward(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_journey_reward(uuid)    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_mission_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_journey_reward(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 시드
-- ---------------------------------------------------------------------------
INSERT INTO public.reward_rules (code, name, display_label, disclosure, min_amount, max_amount, weights)
VALUES (
  'daily_mission', '미션 완료 적립', '오늘의 적립',
  '미션을 완료하면 1~7원이 무작위로 적립됩니다. (1원 24%, 2원 22%, 3원 18%, 4원 14%, 5원 10%, 6원 7%, 7원 5%) 구독 등급에 따라 배수가 적용될 수 있습니다.',
  1, 7, '{"1":24,"2":22,"3":18,"4":14,"5":10,"6":7,"7":5}'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, display_label = EXCLUDED.display_label, disclosure = EXCLUDED.disclosure,
  min_amount = EXCLUDED.min_amount, max_amount = EXCLUDED.max_amount,
  weights = EXCLUDED.weights, updated_at = now();

INSERT INTO public.reward_rules (code, name, display_label, disclosure, fixed_amount)
VALUES (
  'journey_complete', '14일 완주 보너스', '완주 보너스',
  '14일 저니를 완료하면 50원이 적립됩니다.', 50
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, display_label = EXCLUDED.display_label, disclosure = EXCLUDED.disclosure,
  fixed_amount = EXCLUDED.fixed_amount, updated_at = now();

COMMIT;


-- ===== 032_orders.sql ======================================
-- MEBODY — 멤버십 · 주문 · 적립금 차감
--
-- README 는 membership_plans / user_subscriptions 를 앱이 쓴다고 적고 있지만
-- 실제 DB 에는 두 테이블이 없어 CheckoutScreen 의 구독 활성화가 실패해 왔습니다.
-- 여기서 함께 만듭니다.
--
-- 결제 승인은 아직 붙이지 않습니다(결제사 미정).
-- 주문은 PENDING 으로 생성되고, 결제 연동 시 PAID 로 전이시키면 됩니다.
--
-- 적립금 차감은 반드시 서버에서 원자적으로 수행합니다.
--   포인트만 빠지고 결제가 실패하면 사용자 돈이 사라지므로,
--   주문 생성과 차감을 한 트랜잭션에 묶고 취소 시 환불 엔트리로 복구합니다.

BEGIN;

-- ---------------------------------------------------------------------------
-- 멤버십 플랜 — 등급별 적립 배수 포함
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,
  name              text NOT NULL,
  description       text,
  billing_cycle     text NOT NULL DEFAULT 'monthly',
  price_krw         integer NOT NULL DEFAULT 0,
  -- 미션 적립에 곱해지는 배수. 1.0 = 혜택 없음
  reward_multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membership_plans_cycle_check CHECK (billing_cycle IN ('monthly','yearly','one_time')),
  CONSTRAINT membership_plans_multiplier_check CHECK (reward_multiplier >= 1.0 AND reward_multiplier <= 10.0)
);

DROP TRIGGER IF EXISTS membership_plans_updated_at ON public.membership_plans;
CREATE TRIGGER membership_plans_updated_at
BEFORE UPDATE ON public.membership_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code             text NOT NULL REFERENCES public.membership_plans(code),
  status                text NOT NULL DEFAULT 'active',
  started_at            timestamptz NOT NULL DEFAULT now(),
  current_period_end    timestamptz,
  cancel_at_period_end  boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_status_check
    CHECK (status IN ('trialing','active','past_due','canceled'))
);

CREATE INDEX IF NOT EXISTS user_subscriptions_user_idx ON public.user_subscriptions (user_id, status);

DROP TRIGGER IF EXISTS user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 주문
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'PENDING',
  subtotal_krw   integer NOT NULL CHECK (subtotal_krw >= 0),
  -- 사용한 적립금. 원장의 spend_order 엔트리 금액과 절댓값이 같아야 한다.
  reward_used    integer NOT NULL DEFAULT 0 CHECK (reward_used >= 0),
  total_krw      integer NOT NULL CHECK (total_krw >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  paid_at        timestamptz,
  canceled_at    timestamptz,
  CONSTRAINT orders_status_check CHECK (status IN ('PENDING','PAID','CANCELED','FAILED')),
  CONSTRAINT orders_total_check CHECK (total_krw = subtotal_krw - reward_used)
);

CREATE INDEX IF NOT EXISTS orders_user_idx ON public.orders (user_id, created_at DESC);

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES public.products(id) ON DELETE SET NULL,
  -- 주문 시점 값을 복사해 둔다. 상품 가격이 바뀌어도 과거 주문은 그대로여야 한다.
  name        text NOT NULL,
  unit_price  integer NOT NULL CHECK (unit_price >= 0),
  quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- 주문 생성 + 적립금 차감 (원자적)
--
--   p_items: [{"product_id":"...","quantity":1}, ...]
--   p_reward_to_use: 사용할 적립금. 잔액과 주문금액을 넘지 못한다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(p_items jsonb, p_reward_to_use integer DEFAULT 0)
RETURNS TABLE (order_id uuid, subtotal integer, reward_used integer, total integer, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_order    uuid;
  v_subtotal integer := 0;
  v_use      integer;
  v_balance  integer;
  v_item     jsonb;
  v_product  public.products;
  v_qty      integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'no items' USING ERRCODE = '22023';
  END IF;

  -- 같은 사용자의 동시 주문을 직렬화한다. 두 탭에서 동시에 쓰면 잔액이 음수가 될 수 있다.
  PERFORM pg_advisory_xact_lock(hashtext(v_user::text));

  v_order := gen_random_uuid();

  -- 1단계: 상품을 검증하고 소계를 계산한다.
  --   order_items 는 orders 를 참조하므로 orders 행을 먼저 만들어야 한다.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM public.products
     WHERE id = (v_item->>'product_id')::uuid AND status = 'ACTIVE';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'product not available: %', v_item->>'product_id' USING ERRCODE = '22023';
    END IF;
    IF v_product.price IS NULL THEN
      RAISE EXCEPTION 'product has no price: %', v_product.name USING ERRCODE = '22023';
    END IF;

    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));
    v_subtotal := v_subtotal + (v_product.price::int * v_qty);
  END LOOP;

  v_balance := public.reward_balance(v_user);
  -- 사용 가능한 만큼만 쓴다. 음수·초과 요청은 여기서 잘린다.
  v_use := LEAST(GREATEST(COALESCE(p_reward_to_use, 0), 0), v_balance, v_subtotal);

  -- 2단계: 주문 행을 만든다.
  INSERT INTO public.orders (id, user_id, status, subtotal_krw, reward_used, total_krw)
  VALUES (v_order, v_user, 'PENDING', v_subtotal, v_use, v_subtotal - v_use);

  -- 3단계: 품목을 기록한다. 주문 시점 가격을 복사해 둔다.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM public.products
     WHERE id = (v_item->>'product_id')::uuid AND status = 'ACTIVE';
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));

    INSERT INTO public.order_items (order_id, product_id, name, unit_price, quantity)
    VALUES (v_order, v_product.id, v_product.name, v_product.price::int, v_qty);
  END LOOP;

  IF v_use > 0 THEN
    INSERT INTO public.user_rewards
      (user_id, entry_type, amount, issue_type, source_type, source_id, memo)
    VALUES
      (v_user, 'spend_order', -v_use, 'free', 'order', v_order, '상품 주문에 사용');
  END IF;

  RETURN QUERY SELECT v_order, v_subtotal, v_use, v_subtotal - v_use, public.reward_balance(v_user);
END $$;

-- ---------------------------------------------------------------------------
-- 주문 취소 + 적립금 환불
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
RETURNS TABLE (refunded integer, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_order public.orders;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user::text));

  SELECT * INTO v_order FROM public.orders
   WHERE id = p_order_id AND user_id = v_user FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = '42501';
  END IF;
  IF v_order.status = 'CANCELED' THEN
    RETURN QUERY SELECT 0, public.reward_balance(v_user);
    RETURN;
  END IF;
  IF v_order.status = 'PAID' THEN
    RAISE EXCEPTION 'paid order cannot be canceled here' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders SET status = 'CANCELED', canceled_at = now() WHERE id = p_order_id;

  IF v_order.reward_used > 0 THEN
    INSERT INTO public.user_rewards
      (user_id, entry_type, amount, issue_type, source_type, source_id, memo)
    VALUES
      (v_user, 'refund_order', v_order.reward_used, 'free', 'order', p_order_id, '주문 취소로 복구')
    ON CONFLICT (user_id, entry_type, source_id) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_order.reward_used, public.reward_balance(v_user);
END $$;

-- ---------------------------------------------------------------------------
-- 권한 · RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.membership_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items         ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.membership_plans   FROM anon, authenticated;
REVOKE ALL ON public.user_subscriptions FROM anon, authenticated;
REVOKE ALL ON public.orders             FROM anon, authenticated;
REVOKE ALL ON public.order_items        FROM anon, authenticated;

GRANT SELECT ON public.membership_plans TO anon, authenticated;
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;

DROP POLICY IF EXISTS membership_plans_read ON public.membership_plans;
CREATE POLICY membership_plans_read ON public.membership_plans
  FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS user_subscriptions_select_own ON public.user_subscriptions;
CREATE POLICY user_subscriptions_select_own ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS order_items_select_own ON public.order_items;
CREATE POLICY order_items_select_own ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

REVOKE ALL ON FUNCTION public.create_order(jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_order(uuid)           FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid)           TO authenticated;

-- ---------------------------------------------------------------------------
-- 시드 — 가격과 배수는 운영에서 조정합니다
-- ---------------------------------------------------------------------------
INSERT INTO public.membership_plans (code, name, description, billing_cycle, price_krw, reward_multiplier, sort_order)
VALUES
  ('basic_monthly', 'Basic Monthly', '결과 저장, 히스토리 조회, 재방문 빠른 결과', 'monthly', 5900, 1.5, 1),
  ('pro_monthly',   'Pro Monthly',   'Basic + 심화 리포트 + 루틴 우선순위',        'monthly', 12900, 2.0, 2)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  billing_cycle = EXCLUDED.billing_cycle, price_krw = EXCLUDED.price_krw,
  reward_multiplier = EXCLUDED.reward_multiplier, sort_order = EXCLUDED.sort_order, updated_at = now();

COMMIT;
