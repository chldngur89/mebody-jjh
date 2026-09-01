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
