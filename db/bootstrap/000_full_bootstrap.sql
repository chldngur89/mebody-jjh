-- MEBODY — 새 Supabase 프로젝트 원클릭 부트스트랩
--
-- 빈 프로젝트에 이 파일 하나만 붙여넣어 실행하면 전체가 세워집니다.
--
-- 순서가 중요합니다
--   110 스키마 → 130 콘텐츠 시드 → 120 RLS → 024 Journey
--   120 은 public 전 테이블의 anon/authenticated 권한을 회수하므로
--   자체 권한을 설정하는 Journey(024) 보다 먼저 와야 합니다.
--
-- 이 파일은 `npm run db:extract` 로 언제든 최신 콘텐츠 기준으로 다시 만들 수 있습니다.
--
-- 옮기지 않는 것: questionnaire_responses, user_profiles (운영계는 비어서 시작)
-- 별도 작업: Storage `images` 버킷 복사 (캐릭터 16 · 축 4 · 체형맵 1)


-- ############ 110_app_schema.sql ################################
-- MEBODY — 앱 스키마 (개발계에서 추출, 2026-08-29)
--
-- 새 Supabase 프로젝트를 운영계로 세울 때 이 파일부터 실행합니다.
-- 저장소에 DDL 이 없던 테이블(콘솔에서 만든 것)까지 전부 포함합니다.
-- RLS 정책은 여기 없습니다. 120_rls.sql 에서 처음부터 올바르게 설정합니다.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;


-- ===== questions =====
CREATE TABLE IF NOT EXISTS public.questions (
  id serial NOT NULL,
  question_number integer,
  axis text NOT NULL,
  question_text text NOT NULL,
  option_1 text NOT NULL,
  option_2 text NOT NULL,
  option_3 text NOT NULL,
  created_at timestamptz DEFAULT now(),
  weight_a integer DEFAULT 1,
  weight_b integer DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  question_code text NOT NULL,
  sort_order integer NOT NULL,
  question_version text DEFAULT 'v3_49_precheck'::text NOT NULL,
  is_precheck boolean DEFAULT false NOT NULL,
  is_scored boolean DEFAULT true NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  answer_type text DEFAULT 'single'::text NOT NULL,
  max_select integer,
  question_set text DEFAULT 'v3_full'::text,
  media_type text,
  media_url text,
  title text,
  part text,
  instruction text,
  guide_text text,
  axis_anchor text,
  axis_priority integer,
  CONSTRAINT questions_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS questions_question_code_key ON public.questions USING btree (question_code);
CREATE INDEX IF NOT EXISTS idx_questions_axis ON public.questions USING btree (axis);
CREATE INDEX IF NOT EXISTS questions_set_active_idx ON public.questions USING btree (question_set, is_active, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS questions_code_set_uidx ON public.questions USING btree (question_code, question_set);

-- ===== question_choice_scores =====
CREATE TABLE IF NOT EXISTS public.question_choice_scores (
  id bigint NOT NULL,
  question_set text DEFAULT 'mebody_v1_32'::text NOT NULL,
  question_code text NOT NULL,
  choice text NOT NULL,
  choice_summary text,
  axis text,
  direction text,
  axis_weight integer DEFAULT 0 NOT NULL,
  axis_anchor text,
  axis_priority integer,
  score_recovery integer DEFAULT 0 NOT NULL,
  score_strength integer DEFAULT 0 NOT NULL,
  score_mobility integer DEFAULT 0 NOT NULL,
  score_balance integer DEFAULT 0 NOT NULL,
  identity_anchor text,
  aux_tag text,
  display_order integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT question_choice_scores_question_set_question_code_choice_key UNIQUE (question_set, question_code, choice),
  CONSTRAINT question_choice_scores_pkey PRIMARY KEY (id),
  CONSTRAINT question_choice_scores_choice_check CHECK ((choice = ANY (ARRAY['①'::text, '②'::text, '③'::text])))
);
CREATE INDEX IF NOT EXISTS question_choice_scores_set_idx ON public.question_choice_scores USING btree (question_set, question_code);

-- ===== questionnaire_responses =====
CREATE TABLE IF NOT EXISTS public.questionnaire_responses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  answers jsonb DEFAULT '{}'::jsonb NOT NULL,
  calculated_code varchar(4),
  status text DEFAULT 'draft'::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  deep_status text DEFAULT 'not_started'::text NOT NULL,
  advanced_preview_tags jsonb DEFAULT '[]'::jsonb NOT NULL,
  advanced_confirmed_tags jsonb DEFAULT '[]'::jsonb NOT NULL,
  advanced_followup_answers jsonb DEFAULT '{}'::jsonb NOT NULL,
  question_version text,
  primary_identity text,
  scoring_meta jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT questionnaire_responses_pkey PRIMARY KEY (id),
  CONSTRAINT questionnaire_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT questionnaire_responses_deep_status_check CHECK ((deep_status = ANY (ARRAY['not_started'::text, 'previewed'::text, 'in_progress'::text, 'completed'::text, 'retest_required'::text]))),
  CONSTRAINT questionnaire_responses_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'completed'::text])))
);
CREATE INDEX IF NOT EXISTS idx_responses_user_status ON public.questionnaire_responses USING btree (user_id, status);
CREATE INDEX IF NOT EXISTS idx_responses_created ON public.questionnaire_responses USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS questionnaire_responses_user_id_idx ON public.questionnaire_responses USING btree (user_id, completed_at DESC);

-- ===== body_code_content =====
CREATE TABLE IF NOT EXISTS public.body_code_content (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  body_code varchar(4) NOT NULL,
  character_name text,
  description text,
  neck_result varchar(1),
  shoulder_result varchar(1),
  pelvis_result varchar(1),
  flexibility_result varchar(1),
  lifestyle_tips jsonb DEFAULT '[]'::jsonb,
  exercises jsonb DEFAULT '[]'::jsonb,
  health_products jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT body_code_content_body_code_key UNIQUE (body_code),
  CONSTRAINT body_code_content_pkey PRIMARY KEY (id)
);

-- ===== body_code_next_page =====
CREATE TABLE IF NOT EXISTS public.body_code_next_page (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  body_code text NOT NULL,
  title text NOT NULL,
  sections jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT body_code_next_page_body_code_key UNIQUE (body_code),
  CONSTRAINT body_code_next_page_pkey PRIMARY KEY (id)
);

-- ===== body_code_result_sections =====
CREATE TABLE IF NOT EXISTS public.body_code_result_sections (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  body_code text NOT NULL,
  section_key text NOT NULL,
  title text NOT NULL,
  content text DEFAULT ''::text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT body_code_result_sections_body_code_section_key_key UNIQUE (body_code, section_key),
  CONSTRAINT body_code_result_sections_pkey PRIMARY KEY (id)
);

-- ===== result_guide =====
CREATE TABLE IF NOT EXISTS public.result_guide (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  body_code text,
  title text NOT NULL,
  sections jsonb DEFAULT '[]'::jsonb NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT result_guide_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS result_guide_common_one ON public.result_guide USING btree ((1)) WHERE (body_code IS NULL);

-- ===== app_content =====
CREATE TABLE IF NOT EXISTS public.app_content (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  key text NOT NULL,
  value_text text,
  value_json jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT app_content_key_key UNIQUE (key),
  CONSTRAINT app_content_pkey PRIMARY KEY (id),
  CONSTRAINT app_content_value_check CHECK (((value_text IS NOT NULL) OR (value_json IS NOT NULL)))
);

-- ===== app_images =====
CREATE TABLE IF NOT EXISTS public.app_images (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  key text NOT NULL,
  url text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT app_images_key_key UNIQUE (key),
  CONSTRAINT app_images_pkey PRIMARY KEY (id)
);

-- ===== immediate_action_content =====
CREATE TABLE IF NOT EXISTS public.immediate_action_content (
  id text NOT NULL,
  content_key text NOT NULL,
  category_type text NOT NULL,
  display_name text NOT NULL,
  target_muscle text NOT NULL,
  direction text NOT NULL,
  release_title text NOT NULL,
  release_content text NOT NULL,
  release_tool text NOT NULL,
  release_duration_sec integer,
  stretch_title text NOT NULL,
  stretch_content text NOT NULL,
  stretch_duration_sec integer,
  sets integer,
  caution text DEFAULT ''::text NOT NULL,
  sort_order integer DEFAULT 999 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT immediate_action_content_content_key_key UNIQUE (content_key),
  CONSTRAINT immediate_action_content_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_immediate_action_content_sort ON public.immediate_action_content USING btree (sort_order);

-- ===== immediate_action_axis_mapping =====
CREATE TABLE IF NOT EXISTS public.immediate_action_axis_mapping (
  axis_mapping_id text NOT NULL,
  axis_no integer NOT NULL,
  axis_key text NOT NULL,
  direction_key text NOT NULL,
  direction_label text NOT NULL,
  percentage_source text NOT NULL,
  release_content_key text NOT NULL,
  stretch_content_key text NOT NULL,
  display_name text NOT NULL,
  priority_source text DEFAULT 'axis'::text NOT NULL,
  dev_note text DEFAULT ''::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT immediate_action_axis_mapping_axis_key_direction_key_key UNIQUE (axis_key, direction_key),
  CONSTRAINT immediate_action_axis_mapping_pkey PRIMARY KEY (axis_mapping_id)
);
CREATE INDEX IF NOT EXISTS idx_immediate_action_axis_lookup ON public.immediate_action_axis_mapping USING btree (axis_key, direction_key) WHERE (is_active = true);

-- ===== immediate_action_discomfort_mapping =====
CREATE TABLE IF NOT EXISTS public.immediate_action_discomfort_mapping (
  mapping_id text NOT NULL,
  discomfort_part_key text NOT NULL,
  discomfort_part_label text NOT NULL,
  side_input text NOT NULL,
  side_label text NOT NULL,
  release_content_key text NOT NULL,
  stretch_content_key text NOT NULL,
  display_name text NOT NULL,
  priority_source text DEFAULT 'discomfort'::text NOT NULL,
  dev_note text DEFAULT ''::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT immediate_action_discomfort_mapping_pkey PRIMARY KEY (mapping_id)
);
CREATE INDEX IF NOT EXISTS idx_immediate_action_discomfort_lookup ON public.immediate_action_discomfort_mapping USING btree (discomfort_part_key, side_input) WHERE (is_active = true);

-- ===== user_profiles =====
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid NOT NULL,
  email text,
  display_name text,
  marketing_opt_in boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  auth_user_id uuid,
  name text,
  nickname text,
  phone text,
  role text DEFAULT 'MEMBER'::text NOT NULL,
  status text DEFAULT 'ACTIVE'::text NOT NULL,
  grade text DEFAULT 'BASIC'::text NOT NULL,
  body_bti_code text,
  body_bti_title text,
  body_bti_description text,
  mission_achievement_rate numeric DEFAULT 0 NOT NULL,
  deleted_at timestamptz,
  CONSTRAINT user_profiles_auth_user_id_key UNIQUE (auth_user_id),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_profiles_grade_check CHECK ((grade = ANY (ARRAY['BASIC'::text, 'BRONZE'::text, 'SILVER'::text, 'GOLD'::text, 'VIP'::text]))),
  CONSTRAINT user_profiles_role_check CHECK ((role = ANY (ARRAY['MEMBER'::text, 'SELLER'::text, 'ADMIN'::text]))),
  CONSTRAINT user_profiles_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'PENDING'::text, 'SUSPENDED'::text, 'DELETED'::text])))
);
CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON public.user_profiles USING btree (role);
CREATE INDEX IF NOT EXISTS user_profiles_status_idx ON public.user_profiles USING btree (status);
CREATE INDEX IF NOT EXISTS user_profiles_grade_idx ON public.user_profiles USING btree (grade);
CREATE INDEX IF NOT EXISTS user_profiles_created_at_idx ON public.user_profiles USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS user_profiles_deleted_at_idx ON public.user_profiles USING btree (deleted_at);

-- ===== products =====
CREATE TABLE IF NOT EXISTS public.products (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  seller_id uuid,
  name text NOT NULL,
  description text,
  price numeric,
  image_url text,
  status text DEFAULT 'DRAFT'::text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT products_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'SOLD_OUT'::text, 'ARCHIVED'::text])))
);
CREATE INDEX IF NOT EXISTS products_status_idx ON public.products USING btree (status);
CREATE INDEX IF NOT EXISTS products_seller_id_idx ON public.products USING btree (seller_id);

-- ===== missions =====
CREATE TABLE IF NOT EXISTS public.missions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  description text,
  target_count integer DEFAULT 1 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT missions_pkey PRIMARY KEY (id)
);

-- ===== user_mission_progress =====
CREATE TABLE IF NOT EXISTS public.user_mission_progress (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  mission_id uuid,
  current_count integer DEFAULT 0 NOT NULL,
  target_count integer DEFAULT 1 NOT NULL,
  achievement_rate numeric DEFAULT 0 NOT NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT user_mission_progress_user_id_mission_id_key UNIQUE (user_id, mission_id),
  CONSTRAINT user_mission_progress_pkey PRIMARY KEY (id),
  CONSTRAINT user_mission_progress_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  CONSTRAINT user_mission_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS user_mission_progress_user_id_idx ON public.user_mission_progress USING btree (user_id);

-- ===== body_bti_results =====
CREATE TABLE IF NOT EXISTS public.body_bti_results (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  code text NOT NULL,
  title text,
  description text,
  score_json jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT body_bti_results_pkey PRIMARY KEY (id),
  CONSTRAINT body_bti_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS body_bti_results_user_id_created_at_idx ON public.body_bti_results USING btree (user_id, created_at DESC);

-- ===== admin_audit_logs =====
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  admin_user_id uuid,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT admin_audit_logs_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES user_profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_user_id_idx ON public.admin_audit_logs USING btree (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx ON public.admin_audit_logs USING btree (target_type, target_id, created_at DESC);

-- ===== 트리거 =====
DROP TRIGGER IF EXISTS app_content_updated_at ON public.app_content;
CREATE TRIGGER app_content_updated_at BEFORE UPDATE ON public.app_content FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS app_images_updated_at ON public.app_images;
CREATE TRIGGER app_images_updated_at BEFORE UPDATE ON public.app_images FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS update_body_code_content_updated_at ON public.body_code_content;
CREATE TRIGGER update_body_code_content_updated_at BEFORE UPDATE ON public.body_code_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS body_code_result_sections_updated_at ON public.body_code_result_sections;
CREATE TRIGGER body_code_result_sections_updated_at BEFORE UPDATE ON public.body_code_result_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS update_questionnaire_responses_updated_at ON public.questionnaire_responses;
CREATE TRIGGER update_questionnaire_responses_updated_at BEFORE UPDATE ON public.questionnaire_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS result_guide_updated_at ON public.result_guide;
CREATE TRIGGER result_guide_updated_at BEFORE UPDATE ON public.result_guide FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS user_mission_progress_updated_at ON public.user_mission_progress;
CREATE TRIGGER user_mission_progress_updated_at BEFORE UPDATE ON public.user_mission_progress FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;


-- ############ 130_seed_content.sql ##############################
-- MEBODY — 콘텐츠 시드 (개발계에서 추출, 2026-08-29)
--
-- 콘텐츠·문항·매핑만 옮깁니다. 사용자 데이터(questionnaire_responses, user_profiles)는 옮기지 않습니다.
-- 재실행 안전: 기본키 충돌 시 갱신합니다.

BEGIN;


-- ===== questions (85행) =====
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (1, 1, 'shoulder', '거울 정면 힘 빼고 섰을 때 어깨 높이', '① 오른쪽 어깨가 더 올라가 보인다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼쪽 어깨가 더 올라가 보인다', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '1', 5, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (2, 2, 'pelvis', '편하게 서서 골반 앞라인 관찰', '① 왼쪽 골반 앞라인이 더 앞으로 나와 보인다 → R', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 오른쪽 골반 앞라인이 더 앞으로 나와 보인다 → L', '2026-02-05T23:18:53.482Z', 4, 4, '2026-07-24T05:53:07.037Z', '2', 6, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (3, 3, 'pelvis', '발을 11자로 맞추고 골반 앞라인 관찰', '① 왼쪽 골반 앞라인이 더 앞으로 나와 보인다 → R', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 오른쪽 골반 앞라인이 더 앞으로 나와 보인다 → L', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '3', 7, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (4, 4, 'pelvis', '서서 골반 앞쪽 뼈 직접 확인', '① 오른쪽 뼈가 왼쪽보다 더 앞으로 나온 느낌 → R', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼쪽 뼈가 오른쪽보다 더 앞으로 나온 느낌 → L', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '4', 8, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (5, 5, 'neck', '옆모습 사진: 귀-어깨 선', '① 귀가 어깨보다 확실히 앞으로 나와 있다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 귀가 어깨와 거의 같은 선이거나 약간 뒤에 있다', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '5', 9, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (6, 6, 'shoulder', '정면 사진 목-어깨 라인 길이 비교', '① 오른쪽 귀밑~어깨 라인이 더 짧아 보인다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼쪽 귀밑~어깨 라인이 더 짧아 보인다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '6', 10, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (7, 7, 'anterior_pelvic_tilt', '벽 허리 공간 확인', '① 허리와 벽 사이 공간이 손이 쉽게 들어갈 만큼 크다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 허리와 벽 사이 공간이 거의 없거나 손이 빡빡하게 들어간다', '2026-02-05T23:18:53.482Z', 4, 4, '2026-07-24T05:53:07.037Z', '7', 11, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (8, 8, 'neck', '벽 정렬: 뒤통수 닿음', '① 뒤통수가 벽에 잘 안 닿는다(턱이 앞으로/위로 가기 쉽다)', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 뒤통수·등·골반이 비교적 자연스럽게 같이 닿는다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '8', 12, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (9, 9, 'lower_body', '발목 무릎-벽 테스트 10cm', '① 10cm에서 뒤꿈치가 들리거나 무릎이 안 닿는다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 10cm에서 비교적 쉽게 닿는다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '9', 13, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (10, 10, 'lower_body', '발목 접힘 반복 체크 (5cm 고정)', '① 뒤꿈치가 들리거나 무릎이 앞으로 잘 못 간다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 비교적 잘 된다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '10', 14, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (11, 11, 'shoulder', '팔 살짝 들어(약 30도) 어깨 으쓱 비교', '① 오른쪽 어깨가 더 으쓱 올라가 보인다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼쪽 어깨가 더 으쓱 올라가 보인다', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '11', 15, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (12, 12, 'shoulder', '으쓱 3번 했을 때 더 먼저/더 크게 올라가는 쪽', '① 오른쪽이 더 먼저/더 크게 올라간다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼쪽이 더 먼저/더 크게 올라간다', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '12', 16, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (13, 13, 'neck', '턱 당기기 10초', '① 3~5초도 힘들고 앞목/턱밑이 금방 힘들어진다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 10초가 비교적 편하고 목이 길게 유지된다', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '13', 17, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (14, 14, 'neck', '목 앞쪽 스트레칭 편안함', '① 목 앞쪽이 뻣뻣하거나 당겨서 잘 안 된다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 목 앞쪽이 비교적 잘 늘어나고 편하다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '14', 18, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (15, 15, 'neck', '고개 좌우 돌리기 비교', '① 양쪽 다 잘 안 돌아가거나 뻣뻣하다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 양쪽 다 비교적 잘 돌아가고 편하다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '15', 19, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (16, 16, 'shoulder', '목 옆~어깨선 가볍게 스트레치 시 더 빡빡한 쪽', '① 오른쪽이 더 빡빡하게 느껴진다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼쪽이 더 빡빡하게 느껴진다', '2026-02-05T23:18:53.482Z', 1, 1, '2026-07-24T05:53:07.037Z', '16', 20, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (17, 17, 'shoulder', '무의식적으로 힘이 더 들어가는 어깨', '① 오른쪽 어깨에 힘이 더 들어가는 편이다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼쪽 어깨에 힘이 더 들어가는 편이다', '2026-02-05T23:18:53.482Z', 1, 1, '2026-07-24T05:53:07.037Z', '17', 21, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (18, 18, 'lower_body', '한발 서기 10초 (무릎 자연스럽게)', '① 10초 안에 발을 내리거나 몸이 크게 흔들린다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 양쪽 다 비교적 안정적으로 10초 가능하다', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '18', 22, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (19, 19, 'lower_body', '무릎 펴고 한발 서기 — 전체 안정성', '① 양쪽 다 골반이 빠지거나 발목이 크게 흔들려 버티기 어렵다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 양쪽 다 비교적 안정적으로 10초 가능하다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '19', 23, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (20, 20, 'lower_body', '무릎 펴고 한발 서기 — 좌우 비대칭', '① 한쪽은 되는데 한쪽은 확연히 안 되거나 흔들림 차이가 크다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 양쪽이 비슷한 수준이다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '20', 24, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (21, 21, 'lower_body', '완전 쪼그려 앉기 5초', '① 거의 불가하거나 뒤꿈치가 많이 뜬다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 비교적 편하게 5초 가능하다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '21', 25, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (22, 22, 'lower_body', '힙힌지 전략 5회', '① 허리가 먼저 둥글게 말리거나 허리로 접히는 느낌이 강하다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 허리 말림이 적고 엉덩이 접힘으로 숙이는 느낌이 난다', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '22', 26, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (23, 23, 'anterior_pelvic_tilt', '런지 앞사타구니 늘리기', '① 뒤쪽 다리 앞사타구니가 강하게 뻣뻣하고 자세 유지가 어렵다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 비교적 편하게 늘어난다', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '23', 27, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (24, 24, 'anterior_pelvic_tilt', '허벅지 앞 늘리기', '① 발꿈치가 엉덩이 쪽으로 잘 안 오고 강하게 뻣뻣하다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 비교적 잘 오고 편하다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '24', 28, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (25, 25, 'posterior_pelvic_tilt', '햄스트링 텐션 확인', '① 뒤허벅지/엉덩이 아래가 빨리 강하게 뻣뻣해져 많이 못 숙인다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 비교적 잘 숙여지고 뻣뻣함이 심하지 않다', '2026-02-05T23:18:53.482Z', 4, 4, '2026-07-24T05:53:07.037Z', '25', 29, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (26, 26, 'neck', '의자에 앉아 등받이 붙이고 옆모습 사진', '① 귀가 어깨보다 확실히 앞으로 나와 있다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 귀가 어깨와 비슷하거나 약간 뒤에 있다', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '26', 30, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (27, 27, 'pelvis', '의자에 앉아 상체 좌우 회전 비교', '① 오른쪽으로 더 잘 돌아가고 편하다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼쪽으로 더 잘 돌아가고 편하다', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '27', 31, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (28, 28, 'lower_body', '의자 4자 자세', '① 무릎이 많이 떠서 자세가 불편하거나 뻣뻣하다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 비교적 편하고 무릎이 잘 내려간다', '2026-02-05T23:18:53.482Z', 1, 1, '2026-07-24T05:53:07.037Z', '28', 32, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (29, 29, 'pelvis', '딱딱한 의자: 좌골 압력', '① 오른쪽 좌골 쪽 압력이 더 강하게 느껴진다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼쪽 좌골 쪽 압력이 더 강하게 느껴진다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '29', 33, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (30, 30, 'posterior_pelvic_tilt', '바닥에 다리 펴고 앉기', '① 다리를 펴고 앉으면 골반이 뒤로 말리고 허리를 세우기 어렵다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 다리를 펴고 앉아도 허리를 비교적 세울 수 있다', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '30', 34, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (31, 31, 'lower_body', '나비자세', '① 무릎이 많이 뜨고 불편해서 자세 유지가 어렵다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 무릎이 비교적 잘 내려가고 편하다', '2026-02-05T23:18:53.482Z', 1, 1, '2026-07-24T05:53:07.037Z', '31', 35, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (32, 32, 'posterior_pelvic_tilt', '누워서 무릎 가슴 당기기', '① 무릎이 가슴 쪽으로 잘 안 올라오고 엉덩이 뒤쪽이 뻣뻣하다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 잘 올라오고 비교적 편하다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '32', 36, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (33, 33, 'lower_body', '누워서 무릎 안쪽으로 눕히기', '① 한쪽이 확연히 덜 눕혀지거나 뻣뻣하다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 양쪽이 비슷하게 눕혀진다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '33', 37, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (34, 34, 'pelvis', '바로 누워 힘 빼기: 발끝이 더 바깥으로 향하는 쪽', '① 오른발 끝이 더 바깥으로 돌아가 있다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼발 끝이 더 바깥으로 돌아가 있다', '2026-02-05T23:18:53.482Z', 1, 1, '2026-07-24T05:53:07.037Z', '34', 38, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (35, 35, 'lower_body', '계단 내려갈 때 안정감', '① 계단을 내려갈 때 무릎이 안으로 쏠리거나 엉덩이가 흔들리는 느낌이 난다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 계단을 내려갈 때 비교적 안정적으로 버텨진다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '35', 39, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (36, 36, 'anterior_pelvic_tilt', '오래 서있으면 허리 뒤쪽이 묵직해진다', '① 30분 이상 서있으면 허리 뒤쪽이 묵직하거나 피로한 느낌이 자주 난다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 오래 서있어도 허리보다 다른 곳이 먼저 피로해진다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '36', 40, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (37, 37, 'posterior_pelvic_tilt', '앉았다가 일어설 때 허리가 바로 안 펴진다', '① 앉았다가 일어서면 허리가 바로 안 펴지고 잠깐 구부정한 상태가 된다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 앉았다가 일어서도 허리가 비교적 바로 펴진다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '37', 41, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (38, 38, 'neck', '평소 휴대폰 볼 때 목 위치', '① 턱이 화면 쪽으로 나가고 목이 많이 숙여지는 편이다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 휴대폰을 눈높이 쪽으로 올려 목이 크게 숙여지지 않는 편이다', '2026-02-05T23:18:53.482Z', 1, 1, '2026-07-24T05:53:07.037Z', '38', 42, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (39, 39, 'sitting_driven', '하루 앉아있는 시간', '① 하루 6시간 이상 앉아있는 날이 주 4일 이상이다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 하루 6시간 미만으로 앉아있는 날이 더 많다', '2026-02-05T23:18:53.482Z', 2, 2, '2026-07-24T05:53:07.037Z', '39', 43, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (40, 40, 'sitting_driven', '오래 앉아있다가 처음 일어설 때', '① 엉덩이/허벅지/허리 쪽이 움직임이 무겁거나 잘 안 풀리는 느낌이 자주 난다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 별로 그런 느낌이 없다', '2026-02-05T23:18:53.482Z', 3, 3, '2026-07-24T05:53:07.037Z', '40', 44, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (81, NULL, 'discomfort_area', '가장 불편함을 느끼는 부위 선택 (최대 2곳)', '① 목 / 어깨 / 등 상부 / 허리 / 골반·엉덩이 / 무릎 / 종아리·발목 / 발바닥', '② 없음 / 그냥 궁금해서', '-', '2026-04-29T01:38:22.507Z', 0, 0, '2026-07-24T05:53:07.037Z', 'A-1', 1, 'v3_49_precheck', true, false, false, 'multi', 2, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (82, NULL, 'discomfort_area', '얼마나 자주 느끼시나요?', '① 항상 불편하다', '② 특정 동작이나 자세에서만', '③ 가끔 불편하다', '2026-04-29T01:38:22.507Z', 0, 0, '2026-07-24T05:53:07.037Z', 'A-2', 2, 'v3_49_precheck', true, false, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (83, NULL, 'discomfort_area', '어느 쪽이 더 불편한가요?', '① 오른쪽', '② 양쪽 비슷하게 / 잘 모르겠다', '③ 왼쪽', '2026-04-29T01:38:22.507Z', 0, 0, '2026-07-24T05:53:07.037Z', 'A-3', 3, 'v3_49_precheck', true, false, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (84, NULL, 'red_flag', '운동 전 안전 확인 — 해당하는 것이 있으면 선택해 주세요', '① 팔이나 다리로 저림 또는 전기 오는 느낌이 있다 / 밤에 자다가 불편함으로 깬 적이 최근 있다 / 최근 갑자기 불편함이 심해졌다', '② 해당 없음', '-', '2026-04-29T01:38:22.507Z', 0, 0, '2026-07-24T05:53:07.037Z', 'B-1', 4, 'v3_49_precheck', true, false, false, 'multi', 3, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (125, 41, 'sitting_driven', '앉아서 화면 볼 때 자세 습관', '① 등받이에 기대거나 한쪽으로 기울거나 다리를 꼬는 자세가 자주 나온다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 비교적 바르게 앉는 편이다', '2026-04-29T01:38:22.507Z', 2, 2, '2026-07-24T05:53:07.037Z', '41', 45, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (126, 42, 'work_dominant', '작업 후 한쪽 어깨/목이 더 뭉친다', '① 컴퓨터 작업이나 반복 작업 후 오른쪽 어깨/목이 왼쪽보다 확연히 더 뭉치거나 피로해진다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼쪽 어깨/목이 오른쪽보다 확연히 더 뭉치거나 피로해진다', '2026-04-29T01:38:22.507Z', 2, 2, '2026-07-24T05:53:07.037Z', '42', 46, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (127, 43, 'work_dominant', '고개/몸통 방향 고정', '① 업무나 작업 시 고개나 몸통을 특정 한쪽 방향으로 계속 틀어놓는 경우가 많다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 정면을 보거나 양방향을 고루 쓰는 편이다', '2026-04-29T01:38:22.507Z', 2, 2, '2026-07-24T05:53:07.037Z', '43', 47, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (128, 44, 'work_dominant', '서서 일할 때 체중 싣는 쪽', '① 서서 일하거나 기다릴 때 항상 같은 쪽 다리에 체중을 싣는 편이다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 양쪽을 고루 쓰거나 별로 그런 습관이 없다', '2026-04-29T01:38:22.507Z', 2, 2, '2026-07-24T05:53:07.037Z', '44', 48, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (129, 45, 'shoulder', '가방/옷 끈이 자주 흘러내리는 쪽', '① 오른쪽에서 더 자주 흘러내린다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼쪽에서 더 자주 흘러내린다', '2026-04-29T01:38:22.507Z', 1, 1, '2026-07-24T05:53:07.037Z', '45', 49, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (130, 46, 'shoulder', '팔짱 낄 때 위로 올라오는 팔', '① 오른팔이 위로 올라온다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼팔이 위로 올라온다', '2026-04-29T01:38:22.507Z', 1, 1, '2026-07-24T05:53:07.037Z', '46', 50, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (131, 47, 'pelvis', '바지/치마가 자꾸 한쪽으로 돌아간다', '① 바지나 치마가 자꾸 오른쪽으로 돌아가 있는 편이다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 바지나 치마가 자꾸 왼쪽으로 돌아가 있는 편이다', '2026-04-29T01:38:22.507Z', 1, 1, '2026-07-24T05:53:07.037Z', '47', 51, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (132, 48, 'pelvis', '신발 뒤축/밑창 마모 방향', '① 오른쪽 신발이 왼쪽보다 더 빨리/더 많이 닳는 편이다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼쪽 신발이 오른쪽보다 더 빨리/더 많이 닳는 편이다', '2026-04-29T01:38:22.507Z', 2, 2, '2026-07-24T05:53:07.037Z', '48', 52, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (133, 49, 'pelvis', '앉아서 다리 꼬기: 더 편한 위쪽 다리', '① 오른다리가 위로 오는 게 더 편하다', '② 잘 모르겠다 / 상황에 따라 다르다', '③ 왼다리가 위로 오는 게 더 편하다', '2026-04-29T01:38:22.507Z', 1, 1, '2026-07-24T05:53:07.037Z', '49', 53, 'v3_49_precheck', false, true, false, 'single', NULL, 'v3_full', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (134, 1, 'none', '최근 규칙적으로 운동하고 있나요?', '일주일에 3회 이상 한다', '일주일에 1~2회 정도 한다', '거의 하지 않는다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T06:10:34.498Z', 'A1', 1, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '운동 빈도', 'A', '최근 3개월을 기준으로 답합니다.', '[보조] 최근 반복적인 운동 자극을 받고 있는지 확인합니다. 운동 빈도만으로 근력을 판단하지 않으며 A10의 실제 기능 수행과 함께 해석합니다.', 'None', NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (135, 2, 'none', '충분히 잤다고 느껴도 몸이 개운하지 않은 날이 자주 있나요?', '자주 그렇다', '가끔 그렇다', '거의 그렇지 않다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'A2', 2, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '수면 후 회복감', 'A', '최근 한 달의 평소 상태를 기준으로 답합니다.', '[핵심] 질환이나 수면장애를 판단하는 문항이 아니라, 사용자가 느끼는 수면 후 회복감을 확인합니다. 생활 리듬·업무량·스트레스의 영향을 함께 고려합니다.', 'None', NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (136, 3, 'flexibility', '오래 앉아 있다가 일어날 때 몸은 어떤가요?', '몸이 무겁고 뻣뻣해서 바로 움직이기 어렵다', '상황에 따라 다르다', '비교적 바로 편하게 움직일 수 있다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'A3', 3, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '오래 앉은 뒤 움직임', 'A', '최근 한 달 동안 오래 앉아 있다가 처음 일어설 때의 경험을 기준으로 답합니다.', '[보조] 오래 앉은 뒤 몸이 다시 움직일 준비를 하는 속도와 뻣뻣함을 함께 확인합니다. 환경 영향을 받으므로 단독 판정에는 사용하지 않습니다.', 'Supporting', 3)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (137, 4, 'none', '평소보다 많이 움직인 다음 날 몸은 어떤가요?', '다음 날까지 몸이 무겁고 피로가 오래간다', '활동량이나 상황에 따라 다르다', '비교적 잘 회복되는 편이다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'A4', 4, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '활동 후 회복', 'A', '최근 한 달 동안 오래 걷거나 운동한 다음 날의 경험을 기준으로 답합니다.', '[핵심] 일상 활동 뒤 회복 속도를 직접 확인합니다. 활동량·수면·업무량에 따라 달라질 수 있으므로 A2·A5와 함께 해석합니다.', 'None', NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (138, 5, 'none', '바쁘거나 긴장되는 일이 끝난 뒤에도 몸의 힘이 쉽게 풀리지 않는 편인가요?', '몸의 긴장이 오래 남는 편이다', '상황에 따라 다르다', '비교적 쉽게 편안해지는 편이다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'A5', 5, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '긴장 후 이완', 'A', '최근 한 달의 평소 상태를 기준으로 답합니다.', '[핵심] 자율신경 질환을 판단하지 않고, 긴장 상황이 끝난 뒤 주관적으로 편안한 상태로 전환되는 경험을 확인합니다.', 'None', NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (139, 6, 'none', '계단을 내려갈 때 어떤가요?', '손잡이를 자주 잡거나 불안해서 조심스럽게 내려간다', '상황에 따라 다르거나 잘 모르겠다', '특별한 불안감 없이 자연스럽게 내려간다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'A6', 6, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '계단 내려가기', 'A', '평소 계단을 내려갈 때의 경험을 기준으로 답합니다. 일부러 계단에서 검사하지 않아도 됩니다.', '[핵심] 계단 하강에서 체중을 받아내는 힘과 중심 조절의 일상적 어려움을 확인합니다.', 'None', NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (140, 7, 'flexibility', '평소 몸을 움직일 때 어떤 느낌이 가장 가까운가요?', '몸이 뻣뻣해서 원하는 만큼 움직이기 어렵다', '특별히 불편하거나 이상한 느낌은 없다', '몸은 잘 움직이지만 힘이 잘 모이지 않거나 자세를 오래 유지하기 어렵다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'A7', 7, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '전반적인 몸의 느낌', 'A', '평소 전반적인 몸의 느낌을 기준으로 답합니다.', '[보조] 전반적인 특성을 ‘뻣뻣함’과 ‘잘 움직이지만 안정적으로 유지하기 어려움’으로 나눕니다. 실제 동작 문항과 같은 방향일 때 의미가 커집니다.', 'Supporting', 3)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (141, 8, 'neck', '평소 목이나 어깨가 뻐근해서 자주 주무르거나 스트레칭을 하나요?', '거의 매일 한다', '가끔 한다', '거의 하지 않는다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'A8', 8, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '목·어깨 피로 경험', 'A', '최근 한 달을 기준으로 답합니다.', '[해설·동점 참고] 업무환경·스트레스·수면의 영향을 많이 받으므로 축과 아이덴티티 점수에는 직접 반영하지 않습니다. 목·어깨 피로 해설과 결과 동점 시 참고 태그로만 사용합니다.', 'Tie tag', 99)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (142, 9, 'shoulder', '한쪽 어깨에 가방을 메면 어느 쪽에서 더 자주 흘러내리나요?', '오른쪽 어깨에서 더 자주 흘러내린다', '양쪽이 비슷하거나 잘 모르겠다', '왼쪽 어깨에서 더 자주 흘러내린다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'A9', 9, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '가방 흘러내림', 'A', '평소 비슷한 형태의 가방을 멜 때를 기준으로 답합니다.', '환경 영향이 큰 보조', 'Supporting', 3)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (143, 10, 'none', '의자에서 10번 연속으로 일어났다가 앉아보세요. 어떤가요?', '팔을 짚어야 하거나 10번 하기 어렵다', '할 수 있지만 뒤로 갈수록 힘들거나 자세가 흐트러진다', '비교적 일정하게 10번 할 수 있다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'A10', 10, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '의자 10회 일어나기', 'A', '팔걸이 없는 안정적인 의자에서 팔을 가슴 앞에 모으고 10회 반복합니다. 통증·어지럼이 생기면 즉시 중단합니다.', '[핵심] 하체 근력, 근지구력, 체간 유지 능력이 함께 필요한 일상 기능 문항입니다. 통증 때문에 수행하지 못한 경우 점수 대신 중단 태그를 기록합니다.', 'None', NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (144, 11, 'shoulder', '편하게 섰을 때 어느 쪽 어깨가 더 높아 보이나요?', '오른쪽 어깨가 더 높다', '비슷하거나 잘 모르겠다', '왼쪽 어깨가 더 높다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'B1', 11, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '어깨 높이', 'B', '정면 거울이나 사진에서 양팔과 어깨 힘을 빼고 평소 자세 그대로 확인합니다.', '[핵심 앵커] 정적 선 자세의 어깨 높이 방향을 확인하는 2축 핵심 앵커입니다.', 'Primary', 1)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (145, 12, 'pelvis', '편하게 섰을 때 어느 쪽 골반 앞부분이 더 앞으로 나와 보이나요?', '왼쪽 골반이 더 앞으로 보인다', '비슷하거나 잘 모르겠다', '오른쪽 골반이 더 앞으로 보인다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'B2', 12, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '편안한 골반 방향', 'B', '양손 검지를 좌우 골반 앞쪽 돌출부에 가볍게 대거나 정면 사진으로 비교합니다.', '[핵심 앵커] 편안한 선 자세에서 골반 앞부분의 좌우 앞뒤 차이를 확인합니다. 왼쪽이 앞으로 보이면 3축 R, 오른쪽이 앞으로 보이면 3축 L로 계산합니다.', 'Primary', 1)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (146, 13, 'pelvis', '양쪽 발끝을 정면으로 맞추고 섰을 때 골반 방향은 어떤가요?', '왼쪽 골반이 더 앞으로 보인다', '비슷하거나 잘 모르겠다', '오른쪽 골반이 더 앞으로 보인다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'B3', 13, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '발 정렬 후 골반 방향', 'B', '발을 어깨너비로 두고 발끝을 11자로 맞춘 뒤 B2와 같은 방법으로 확인합니다.', '[앵커 보조] 발 방향의 영향을 줄인 상태에서도 골반 방향이 유지되는지 확인합니다.', 'Secondary', 2)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (147, 14, 'neck', '옆모습에서 귀는 어깨보다 앞으로 나와 있나요?', '귀가 어깨보다 앞으로 나와 있다', '애매하거나 잘 모르겠다', '귀와 어깨가 비슷한 선에 있다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'B4', 14, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '선 자세 귀 위치', 'B', '옆에서 평소 자세를 촬영하거나 거울로 확인합니다. 턱과 가슴을 일부러 고치지 않습니다.', '[핵심 앵커] 평소 머리를 몸통보다 앞에서 사용하는 경향을 확인합니다. 서기와 앉기 결과가 같으면 1축 확신도가 높아집니다.', 'Primary', 1)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (148, 15, 'shoulder', '어깨를 천천히 으쓱 올렸을 때 어느 쪽이 먼저 또는 더 높이 올라가나요?', '오른쪽이 더 먼저 또는 높이 올라간다', '비슷하거나 잘 모르겠다', '왼쪽이 더 먼저 또는 높이 올라간다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'B5', 15, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '어깨 으쓱 비대칭', 'B', '양팔은 몸 옆에 편하게 두고 통증 없는 범위에서 양쪽 어깨를 천천히 으쓱합니다.', '기능 앵커', 'Primary', 1)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (149, 16, 'pelvis', '자주 신는 신발은 어느 쪽이 더 많이 닳았나요?', '오른쪽 신발이 더 많이 닳았다', '비슷하거나 잘 모르겠다', '왼쪽 신발이 더 많이 닳았다', '2026-07-24T05:53:07.037Z', 0, 0, '2026-07-24T05:53:07.037Z', 'B6', 16, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '신발 밑창 마모', 'B', '최근 자주 신은 비슷한 종류의 신발 밑창을 좌우 비교합니다.', '[저가중치 보조] 보행과 서기에서 반복되는 좌우 체중 사용의 누적 흔적입니다. 신발 종류의 영향을 받아 보조로만 사용합니다.', 'Supporting', 3)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (150, 17, 'shoulder', '양팔을 앞에서 위로 천천히 올릴 때 어느 쪽 어깨가 귀 쪽으로 더 먼저 올라가나요?', '오른쪽 어깨가 더 먼저 또는 더 많이 올라간다', '양쪽이 비슷하거나 잘 모르겠다', '왼쪽 어깨가 더 먼저 또는 더 많이 올라간다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'C1', 17, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '팔 올림 시 어깨 상승', 'C', '정면을 보고 서서 양팔을 앞으로 천천히 올립니다. 통증 없는 범위에서 확인합니다.', '[기능 보조] 팔을 올리는 동안 어느 쪽 견갑대가 먼저 상승하는지 확인합니다. B5와 다른 동작에서 2축을 교차 확인합니다.', 'Secondary', 2)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (151, 18, 'flexibility', '발을 벽에서 약 10cm 떨어뜨리고 무릎을 벽 쪽으로 움직여보세요.', '무릎이 벽에 닿기 어렵거나 뒤꿈치가 들린다', '닿기는 하지만 뻣뻣하거나 한쪽이 더 어렵다', '양쪽 모두 비교적 편하게 닿는다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'C2', 18, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '발목 벽 닿기', 'C', '맨발로 벽을 향해 서서 엄지발가락 끝과 벽 사이를 약 10cm로 맞춥니다. 뒤꿈치를 바닥에 붙인 채 무릎을 두 번째 발가락 방향으로 벽에 닿도록 움직이고 양쪽을 각각 확인합니다. 통증이 있으면 중단합니다.', '[핵심] 10cm 기준의 무릎-벽 닿기에서 발목 배굴 가동성과 하체가 체중을 받아들이는 움직임 여유를 확인합니다. 발 크기·발 정렬·통증의 영향을 받을 수 있으므로 양쪽 차이와 다른 하체 문항을 함께 해석합니다.', 'Secondary', 2)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (152, 19, 'none', '한 발로 15초 동안 서보세요. 어떤가요?', '발을 자주 내리거나 크게 움직여야 한다', '유지할 수 있지만 몸이 많이 흔들린다', '비교적 안정적으로 유지할 수 있다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'C3', 19, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '한발 서기', 'C', '벽 가까이에서 맨발로 한쪽씩 시행합니다. 넘어질 위험이 있으면 즉시 발을 내립니다.', '[핵심] 발부터 체간까지 한쪽 지지 상태에서의 협응과 균형을 확인합니다.', 'None', NULL)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (153, 20, 'flexibility', '엉덩이를 뒤로 보내면서 상체를 숙여보세요.', '엉덩이보다 허리가 먼저 굽거나 뒤허벅지가 많이 당긴다', '허리와 엉덩이가 함께 움직여 잘 모르겠다', '엉덩이가 자연스럽게 접히면서 숙여진다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'C4', 20, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '힙힌지', 'C', '무릎은 살짝 풀고 엉덩이를 뒤로 보내며 상체를 숙입니다. 통증 없는 범위에서 시행합니다.', '[핵심 앵커] 고관절을 사용해 몸을 접는 능력과 허리·골반·고관절의 협응을 확인합니다.', 'Primary', 1)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (154, 21, 'flexibility', '무릎을 편 상태에서 천천히 상체를 숙여보세요.', '손이 무릎 아래로 잘 내려가지 않거나 많이 당긴다', '손이 정강이 또는 발목 정도까지 내려간다', '손이 바닥 가까이 비교적 편하게 내려간다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'C5', 21, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '서서 전굴', 'C', '양발을 편하게 두고 반동 없이 천천히 숙입니다. 통증이나 어지럼이 생기면 중단합니다.', '[핵심] 뒤허벅지·종아리·골반·허리 움직임이 결합된 후방사슬의 유연성 경향을 확인합니다.', 'Primary', 1)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (155, 22, 'neck', '의자에 편하게 앉았을 때 귀 위치는 어떤가요?', '귀가 어깨보다 앞으로 나와 있다', '애매하거나 잘 모르겠다', '귀와 어깨가 비슷한 선에 있다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'C6', 22, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '앉은 자세 귀 위치', 'C', '엉덩이를 의자에 편하게 두고 평소 앉는 자세를 옆에서 확인합니다.', '[앵커] 좌식 환경에서 나타나는 머리 위치를 확인합니다. B4와 같은 방향이면 지속 패턴으로 해석합니다.', 'Primary', 1)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (156, 23, 'neck', '턱을 살짝 뒤로 당긴 상태를 10초 동안 유지해보세요.', '10초 유지하기 어렵다', '10초는 가능하지만 불편하거나 힘이 많이 들어간다', '큰 불편 없이 편하게 10초 유지할 수 있다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'C7', 23, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '턱 당기기 유지', 'C', '목을 뒤로 젖히지 말고 턱만 가볍게 뒤로 당깁니다. 통증·어지럼이 생기면 즉시 중단합니다.', '[기능 보조] 머리를 중심 위치로 가져오고 유지하는 능력을 확인합니다. ②는 방향 점수 없이 불편감 태그로 저장합니다.', 'Secondary', 2)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (157, 24, 'pelvis', '앉아서 상체를 천천히 돌릴 때 어느 쪽이 더 편한가요?', '오른쪽으로 돌리는 것이 더 편하다', '비슷하거나 잘 모르겠다', '왼쪽으로 돌리는 것이 더 편하다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'C8', 24, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '앉은 몸통 회전', 'C', '양발을 바닥에 두고 골반이 크게 움직이지 않도록 한 뒤 좌우로 천천히 돌립니다.', '몸통 회전 기능', 'Secondary', 2)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (158, 25, 'pelvis', '의자에 편하게 앉았을 때 어느 쪽 엉덩이에 체중이 더 실리나요?', '오른쪽 엉덩이에 더 많이 실린다', '비슷하거나 잘 모르겠다', '왼쪽 엉덩이에 더 많이 실린다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'C9', 25, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '앉은 체중 편향', 'C', '평소처럼 20~30초 앉은 뒤 양쪽 엉덩이 아래 압력 차이를 느껴봅니다.', '[기능 보조] 앉은 자세의 좌우 체중 편향을 확인합니다. 다른 골반 문항과 같은 방향일 때 축 결과를 강화합니다.', 'Secondary', 2)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (159, 26, 'neck', '베개 없이 바로 누우면 어떤 느낌이 가장 가까운가요?', '목이 불편해서 바로 베개를 베고 싶다', '잘 모르겠거나 약간 어색하지만 유지할 수 있다', '베개 없이도 비교적 편하다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'D1', 26, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '바로 누운 베개 필요감', 'D', '단단하고 평평한 곳에 바로 누워 평소처럼 힘을 뺍니다.', '[기능 보조] 목 정렬뿐 아니라 흉추 형태·어깨 두께·평소 베개 습관의 영향도 받으므로 다른 목 문항과 함께 해석합니다.', 'Supporting', 3)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (160, 27, 'flexibility', '편하게 누웠을 때 허리와 바닥 사이 공간은 어떤가요?', '허리 아래 공간이 비교적 크다', '잘 모르겠거나 중간 정도이다', '허리가 바닥에 비교적 가깝다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'D2', 27, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '누운 허리 공간', 'D', '바로 누워 힘을 빼고 손을 허리 아래에 가볍게 넣어 공간을 느껴봅니다.', '[저가중치 보조] 누운 자세에서 허리와 골반이 쉬고 있는 전체 패턴입니다. 다양한 영향을 받아 보조점수로만 사용합니다.', 'Supporting', 3)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (161, 28, 'pelvis', '편하게 누웠을 때 어느 발이 더 바깥쪽으로 벌어지나요?', '오른발이 더 바깥쪽으로 벌어진다', '비슷하거나 잘 모르겠다', '왼발이 더 바깥쪽으로 벌어진다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'D3', 28, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '누운 발 벌어짐', 'D', '바로 누워 다리 힘을 빼고 발끝 방향을 좌우 비교합니다.', '[저가중치 보조] 누운 상태에서 다리가 어느 방향으로 더 편하게 놓이는지 확인합니다. 복합 영향을 받아 보조로만 사용합니다.', 'Supporting', 3)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (162, 29, 'pelvis', '양쪽 무릎을 세운 뒤, 무릎을 한쪽씩 안쪽으로 내려보세요. 어느 쪽이 더 뻣뻣한가요?', '오른쪽 무릎이 덜 내려가거나 더 뻣뻣하다', '양쪽이 비슷하거나 잘 모르겠다', '왼쪽 무릎이 덜 내려가거나 더 뻣뻣하다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'D4', 29, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '고관절 안쪽 내리기', 'D', '양발을 바닥에 두고 무릎을 세운 뒤 한쪽 무릎씩 몸 안쪽으로 천천히 내려봅니다.', '[기능 보조] 고관절 회전과 골반·허리의 동반 움직임에서 나타나는 좌우 차이를 확인합니다.', 'Secondary', 2)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (163, 30, 'flexibility', '누워서 왼쪽과 오른쪽 무릎을 한쪽씩 가슴 쪽으로 당겨보세요. 전체적으로 어떤가요?', '양쪽 모두 잘 올라오지 않거나 많이 뻣뻣하다', '한쪽만 더 뻣뻣하거나 양쪽 차이가 느껴진다', '양쪽 모두 비교적 편하게 올라온다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'D5', 30, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '무릎 가슴 당기기 전체', 'D', '바로 누워 한쪽 무릎씩 천천히 가슴 쪽으로 당깁니다. 양쪽을 같은 방식으로 확인합니다.', '[저가중치 보조] 양쪽 고관절 굴곡의 전체적인 여유를 확인합니다. 한쪽만 제한되면 축 점수는 0점으로 두고 D6에서 좌우 차이를 기록합니다.', 'Supporting', 3)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (164, 31, 'pelvis', '같은 동작에서 어느 쪽 무릎이 가슴 쪽으로 더 편하게 올라오나요?', '오른쪽 무릎이 더 편하게 올라온다', '양쪽이 비슷하거나 잘 모르겠다', '왼쪽 무릎이 더 편하게 올라온다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'D6', 31, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '무릎 가슴 당기기 좌우', 'D', 'D5와 같은 자세에서 추가 동작 없이 좌우 차이만 비교합니다.', '좌우 고관절 굴곡의 상대적 차이를 확인합니다. 여러 구조의 영향을 받으므로 저가중치 보조로 사용하며 파일럿 결과에 따라 태그 전용으로 전환할 수 있습니다.', 'Supporting', 3)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;
INSERT INTO public.questions (id, question_number, axis, question_text, option_1, option_2, option_3, created_at, weight_a, weight_b, updated_at, question_code, sort_order, question_version, is_precheck, is_scored, is_active, answer_type, max_select, question_set, media_type, media_url, title, part, instruction, guide_text, axis_anchor, axis_priority) VALUES (165, 32, 'flexibility', '다리를 앞으로 펴고 바닥에 앉았을 때 어떤가요?', '무릎을 굽히지 않으면 허리를 세우기 어렵다', '앉을 수 있지만 뒤허벅지가 많이 당긴다', '다리를 편 상태에서도 비교적 편하게 허리를 세울 수 있다', '2026-07-24T05:54:04.426Z', 0, 0, '2026-07-24T05:54:04.426Z', 'D7', 32, 'mebody_v1_32', false, true, true, 'single', NULL, 'mebody_v1_32', NULL, NULL, '장좌 자세', 'D', '누운 검사 종료 후 한 번만 일어나 양다리를 편 상태로 앉아 허리를 편하게 세워봅니다. 통증이나 저림이 생기면 중단합니다.', '햄스트링 유연성, 골반 움직임, 앉은 자세에서 허리를 세우는 능력을 함께 확인합니다. 바닥 파트의 마지막에 배치해 자세 전환을 한 번으로 줄입니다.', 'Primary', 1)
  ON CONFLICT (id) DO UPDATE SET question_number = EXCLUDED.question_number, axis = EXCLUDED.axis, question_text = EXCLUDED.question_text, option_1 = EXCLUDED.option_1, option_2 = EXCLUDED.option_2, option_3 = EXCLUDED.option_3, created_at = EXCLUDED.created_at, weight_a = EXCLUDED.weight_a, weight_b = EXCLUDED.weight_b, updated_at = EXCLUDED.updated_at, question_code = EXCLUDED.question_code, sort_order = EXCLUDED.sort_order, question_version = EXCLUDED.question_version, is_precheck = EXCLUDED.is_precheck, is_scored = EXCLUDED.is_scored, is_active = EXCLUDED.is_active, answer_type = EXCLUDED.answer_type, max_select = EXCLUDED.max_select, question_set = EXCLUDED.question_set, media_type = EXCLUDED.media_type, media_url = EXCLUDED.media_url, title = EXCLUDED.title, part = EXCLUDED.part, instruction = EXCLUDED.instruction, guide_text = EXCLUDED.guide_text, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority;

-- ===== question_choice_scores (96행) =====
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('1', 'mebody_v1_32', 'A1', '①', '일주일에 3회 이상 한다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 1, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('2', 'mebody_v1_32', 'A1', '②', '일주일에 1~2회 정도 한다', NULL, NULL, 0, 'None', NULL, 0, 1, 0, 0, '근력 보완형:Supporting', NULL, 1, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('3', 'mebody_v1_32', 'A1', '③', '거의 하지 않는다', NULL, NULL, 0, 'None', NULL, 0, 2, 0, 0, '근력 보완형:Supporting', NULL, 1, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('4', 'mebody_v1_32', 'A2', '①', '자주 그렇다', NULL, NULL, 0, 'None', NULL, 3, 0, 0, 0, '회복 우선형:Primary', '수면 후 회복감 낮음', 2, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('5', 'mebody_v1_32', 'A2', '②', '가끔 그렇다', NULL, NULL, 0, 'None', NULL, 1, 0, 0, 0, '회복 우선형:Primary', '수면 후 회복감 변동', 2, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('6', 'mebody_v1_32', 'A2', '③', '거의 그렇지 않다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 2, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('7', 'mebody_v1_32', 'A3', '①', '몸이 무겁고 뻣뻣해서 바로 움직이기 어렵다', 'flexibility', 'S', 1, 'Supporting', 3, 2, 0, 1, 0, '회복 우선형:Supporting / 움직임 제한형:Supporting', NULL, 3, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('8', 'mebody_v1_32', 'A3', '②', '상황에 따라 다르다', NULL, NULL, 0, 'None', NULL, 1, 0, 0, 0, '회복 우선형:Supporting', NULL, 3, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('9', 'mebody_v1_32', 'A3', '③', '비교적 바로 편하게 움직일 수 있다', 'flexibility', 'F', 1, 'Supporting', 3, 0, 0, 0, 0, 'None', NULL, 3, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('10', 'mebody_v1_32', 'A4', '①', '다음 날까지 몸이 무겁고 피로가 오래간다', NULL, NULL, 0, 'None', NULL, 3, 0, 0, 0, '회복 우선형:Primary', '활동 후 회복 지연', 4, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('11', 'mebody_v1_32', 'A4', '②', '활동량이나 상황에 따라 다르다', NULL, NULL, 0, 'None', NULL, 1, 0, 0, 0, '회복 우선형:Primary', NULL, 4, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('12', 'mebody_v1_32', 'A4', '③', '비교적 잘 회복되는 편이다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 4, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('13', 'mebody_v1_32', 'A5', '①', '몸의 긴장이 오래 남는 편이다', NULL, NULL, 0, 'None', NULL, 3, 0, 0, 0, '회복 우선형:Primary', '긴장 후 이완 지연', 5, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('14', 'mebody_v1_32', 'A5', '②', '상황에 따라 다르다', NULL, NULL, 0, 'None', NULL, 1, 0, 0, 0, '회복 우선형:Primary', NULL, 5, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('15', 'mebody_v1_32', 'A5', '③', '비교적 쉽게 편안해지는 편이다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 5, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('16', 'mebody_v1_32', 'A6', '①', '손잡이를 자주 잡거나 불안해서 조심스럽게 내려간다', NULL, NULL, 0, 'None', NULL, 0, 1, 0, 3, '근력 보완형:Secondary / 밸런스 개선형:Primary', '계단 불안/손잡이', 6, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('17', 'mebody_v1_32', 'A6', '②', '상황에 따라 다르거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 1, '밸런스 개선형:Primary', NULL, 6, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('18', 'mebody_v1_32', 'A6', '③', '특별한 불안감 없이 자연스럽게 내려간다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 6, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('19', 'mebody_v1_32', 'A7', '①', '몸이 뻣뻣해서 원하는 만큼 움직이기 어렵다', 'flexibility', 'S', 1, 'Supporting', 3, 0, 0, 1, 0, '움직임 제한형:Supporting', NULL, 7, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('20', 'mebody_v1_32', 'A7', '②', '특별히 불편하거나 이상한 느낌은 없다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 7, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('21', 'mebody_v1_32', 'A7', '③', '몸은 잘 움직이지만 힘이 잘 모이지 않거나 자세를 오래 유지하기 어렵다', 'flexibility', 'F', 1, 'Supporting', 3, 0, 0, 0, 1, '밸런스 개선형:Supporting', '유연-불안정 자각', 7, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('22', 'mebody_v1_32', 'A8', '①', '거의 매일 한다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', '목·어깨 피로 높음', 8, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('23', 'mebody_v1_32', 'A8', '②', '가끔 한다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', '목·어깨 피로 보통', 8, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('24', 'mebody_v1_32', 'A8', '③', '거의 하지 않는다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', '목·어깨 피로 낮음', 8, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('25', 'mebody_v1_32', 'A9', '①', '오른쪽 어깨에서 더 자주 흘러내린다', 'shoulder', 'R', 2, 'Supporting', 3, 0, 0, 0, 0, 'None', '가방 흘러내림', 9, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('26', 'mebody_v1_32', 'A9', '②', '양쪽이 비슷하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 9, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('27', 'mebody_v1_32', 'A9', '③', '왼쪽 어깨에서 더 자주 흘러내린다', 'shoulder', 'L', 2, 'Supporting', 3, 0, 0, 0, 0, 'None', '가방 흘러내림', 9, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('28', 'mebody_v1_32', 'A10', '①', '팔을 짚어야 하거나 10번 하기 어렵다', NULL, NULL, 0, 'None', NULL, 0, 3, 0, 0, '근력 보완형:Primary', '수행 제한', 10, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('29', 'mebody_v1_32', 'A10', '②', '할 수 있지만 뒤로 갈수록 힘들거나 자세가 흐트러진다', NULL, NULL, 0, 'None', NULL, 0, 1, 0, 0, '근력 보완형:Primary', '후반 피로', 10, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('30', 'mebody_v1_32', 'A10', '③', '비교적 일정하게 10번 할 수 있다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 10, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('31', 'mebody_v1_32', 'B1', '①', '오른쪽 어깨가 더 높다', 'shoulder', 'R', 3, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 11, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('32', 'mebody_v1_32', 'B1', '②', '비슷하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 11, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('33', 'mebody_v1_32', 'B1', '③', '왼쪽 어깨가 더 높다', 'shoulder', 'L', 3, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 11, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('34', 'mebody_v1_32', 'B2', '①', '왼쪽 골반이 더 앞으로 보인다', 'pelvis', 'R', 4, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 12, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('35', 'mebody_v1_32', 'B2', '②', '비슷하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 12, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('36', 'mebody_v1_32', 'B2', '③', '오른쪽 골반이 더 앞으로 보인다', 'pelvis', 'L', 4, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 12, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('37', 'mebody_v1_32', 'B3', '①', '왼쪽 골반이 더 앞으로 보인다', 'pelvis', 'R', 3, 'Secondary', 2, 0, 0, 0, 0, 'None', NULL, 13, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('38', 'mebody_v1_32', 'B3', '②', '비슷하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 13, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('39', 'mebody_v1_32', 'B3', '③', '오른쪽 골반이 더 앞으로 보인다', 'pelvis', 'L', 3, 'Secondary', 2, 0, 0, 0, 0, 'None', NULL, 13, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('40', 'mebody_v1_32', 'B4', '①', '귀가 어깨보다 앞으로 나와 있다', 'neck', 'F', 3, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 14, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('41', 'mebody_v1_32', 'B4', '②', '애매하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 14, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('42', 'mebody_v1_32', 'B4', '③', '귀와 어깨가 비슷한 선에 있다', 'neck', 'C', 3, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 14, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('43', 'mebody_v1_32', 'B5', '①', '오른쪽이 더 먼저 또는 높이 올라간다', 'shoulder', 'R', 3, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 15, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('44', 'mebody_v1_32', 'B5', '②', '비슷하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 15, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('45', 'mebody_v1_32', 'B5', '③', '왼쪽이 더 먼저 또는 높이 올라간다', 'shoulder', 'L', 3, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 15, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('46', 'mebody_v1_32', 'B6', '①', '오른쪽 신발이 더 많이 닳았다', 'pelvis', 'R', 1, 'Supporting', 3, 0, 0, 0, 0, 'None', NULL, 16, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('47', 'mebody_v1_32', 'B6', '②', '비슷하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 16, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('48', 'mebody_v1_32', 'B6', '③', '왼쪽 신발이 더 많이 닳았다', 'pelvis', 'L', 1, 'Supporting', 3, 0, 0, 0, 0, 'None', NULL, 16, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('49', 'mebody_v1_32', 'C1', '①', '오른쪽 어깨가 더 먼저 또는 더 많이 올라간다', 'shoulder', 'R', 2, 'Secondary', 2, 0, 0, 0, 0, 'None', NULL, 17, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('50', 'mebody_v1_32', 'C1', '②', '양쪽이 비슷하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 17, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('51', 'mebody_v1_32', 'C1', '③', '왼쪽 어깨가 더 먼저 또는 더 많이 올라간다', 'shoulder', 'L', 2, 'Secondary', 2, 0, 0, 0, 0, 'None', NULL, 17, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('52', 'mebody_v1_32', 'C2', '①', '무릎이 벽에 닿기 어렵거나 뒤꿈치가 들린다', 'flexibility', 'S', 2, 'Secondary', 2, 0, 0, 3, 0, '움직임 제한형:Primary', NULL, 18, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('53', 'mebody_v1_32', 'C2', '②', '닿기는 하지만 뻣뻣하거나 한쪽이 더 어렵다', NULL, NULL, 0, 'None', NULL, 0, 0, 1, 0, '움직임 제한형:Primary', NULL, 18, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('54', 'mebody_v1_32', 'C2', '③', '양쪽 모두 비교적 편하게 닿는다', 'flexibility', 'F', 2, 'Secondary', 2, 0, 0, 0, 0, 'None', NULL, 18, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('55', 'mebody_v1_32', 'C3', '①', '발을 자주 내리거나 크게 움직여야 한다', NULL, NULL, 0, 'None', NULL, 0, 1, 0, 3, '근력 보완형:Secondary / 밸런스 개선형:Primary', '균형 수행 제한', 19, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('56', 'mebody_v1_32', 'C3', '②', '유지할 수 있지만 몸이 많이 흔들린다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 1, '밸런스 개선형:Primary', '흔들림', 19, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('57', 'mebody_v1_32', 'C3', '③', '비교적 안정적으로 유지할 수 있다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 19, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('58', 'mebody_v1_32', 'C4', '①', '엉덩이보다 허리가 먼저 굽거나 뒤허벅지가 많이 당긴다', 'flexibility', 'S', 3, 'Primary', 1, 0, 0, 0, 1, '밸런스 개선형:Secondary', NULL, 20, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('59', 'mebody_v1_32', 'C4', '②', '허리와 엉덩이가 함께 움직여 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 20, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('60', 'mebody_v1_32', 'C4', '③', '엉덩이가 자연스럽게 접히면서 숙여진다', 'flexibility', 'F', 3, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 20, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('61', 'mebody_v1_32', 'C5', '①', '손이 무릎 아래로 잘 내려가지 않거나 많이 당긴다', 'flexibility', 'S', 3, 'Primary', 1, 0, 0, 3, 0, '움직임 제한형:Primary', NULL, 21, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('62', 'mebody_v1_32', 'C5', '②', '손이 정강이 또는 발목 정도까지 내려간다', NULL, NULL, 0, 'None', NULL, 0, 0, 1, 0, '움직임 제한형:Primary', NULL, 21, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('63', 'mebody_v1_32', 'C5', '③', '손이 바닥 가까이 비교적 편하게 내려간다', 'flexibility', 'F', 3, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 21, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('64', 'mebody_v1_32', 'C6', '①', '귀가 어깨보다 앞으로 나와 있다', 'neck', 'F', 3, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 22, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('65', 'mebody_v1_32', 'C6', '②', '애매하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 22, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('66', 'mebody_v1_32', 'C6', '③', '귀와 어깨가 비슷한 선에 있다', 'neck', 'C', 3, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 22, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('67', 'mebody_v1_32', 'C7', '①', '10초 유지하기 어렵다', 'neck', 'F', 2, 'Secondary', 2, 0, 0, 1, 0, '움직임 제한형:Secondary', NULL, 23, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('68', 'mebody_v1_32', 'C7', '②', '10초는 가능하지만 불편하거나 힘이 많이 들어간다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', '목 중심 자세 불편감', 23, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('69', 'mebody_v1_32', 'C7', '③', '큰 불편 없이 편하게 10초 유지할 수 있다', 'neck', 'C', 2, 'Secondary', 2, 0, 0, 0, 0, 'None', NULL, 23, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('70', 'mebody_v1_32', 'C8', '①', '오른쪽으로 돌리는 것이 더 편하다', 'pelvis', 'R', 2, 'Secondary', 2, 0, 0, 0, 0, 'None', NULL, 24, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('71', 'mebody_v1_32', 'C8', '②', '비슷하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 24, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('72', 'mebody_v1_32', 'C8', '③', '왼쪽으로 돌리는 것이 더 편하다', 'pelvis', 'L', 2, 'Secondary', 2, 0, 0, 0, 0, 'None', NULL, 24, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('73', 'mebody_v1_32', 'C9', '①', '오른쪽 엉덩이에 더 많이 실린다', 'pelvis', 'R', 2, 'Secondary', 2, 0, 0, 0, 0, 'None', NULL, 25, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('74', 'mebody_v1_32', 'C9', '②', '비슷하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 25, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('75', 'mebody_v1_32', 'C9', '③', '왼쪽 엉덩이에 더 많이 실린다', 'pelvis', 'L', 2, 'Secondary', 2, 0, 0, 0, 0, 'None', NULL, 25, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('76', 'mebody_v1_32', 'D1', '①', '목이 불편해서 바로 베개를 베고 싶다', 'neck', 'F', 2, 'Supporting', 3, 0, 0, 0, 0, 'None', NULL, 26, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('77', 'mebody_v1_32', 'D1', '②', '잘 모르겠거나 약간 어색하지만 유지할 수 있다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 26, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('78', 'mebody_v1_32', 'D1', '③', '베개 없이도 비교적 편하다', 'neck', 'C', 2, 'Supporting', 3, 0, 0, 0, 0, 'None', NULL, 26, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('79', 'mebody_v1_32', 'D2', '①', '허리 아래 공간이 비교적 크다', 'flexibility', 'S', 1, 'Supporting', 3, 0, 0, 1, 0, '움직임 제한형:Supporting', NULL, 27, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('80', 'mebody_v1_32', 'D2', '②', '잘 모르겠거나 중간 정도이다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 27, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('81', 'mebody_v1_32', 'D2', '③', '허리가 바닥에 비교적 가깝다', 'flexibility', 'F', 1, 'Supporting', 3, 0, 0, 0, 0, 'None', NULL, 27, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('82', 'mebody_v1_32', 'D3', '①', '오른발이 더 바깥쪽으로 벌어진다', 'pelvis', 'R', 1, 'Supporting', 3, 0, 0, 0, 0, 'None', NULL, 28, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('83', 'mebody_v1_32', 'D3', '②', '비슷하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 28, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('84', 'mebody_v1_32', 'D3', '③', '왼발이 더 바깥쪽으로 벌어진다', 'pelvis', 'L', 1, 'Supporting', 3, 0, 0, 0, 0, 'None', NULL, 28, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('85', 'mebody_v1_32', 'D4', '①', '오른쪽 무릎이 덜 내려가거나 더 뻣뻣하다', 'pelvis', 'R', 2, 'Secondary', 2, 0, 0, 0, 1, '밸런스 개선형:Supporting', NULL, 29, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('86', 'mebody_v1_32', 'D4', '②', '양쪽이 비슷하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 29, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('87', 'mebody_v1_32', 'D4', '③', '왼쪽 무릎이 덜 내려가거나 더 뻣뻣하다', 'pelvis', 'L', 2, 'Secondary', 2, 0, 0, 0, 1, '밸런스 개선형:Supporting', NULL, 29, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('88', 'mebody_v1_32', 'D5', '①', '양쪽 모두 잘 올라오지 않거나 많이 뻣뻣하다', 'flexibility', 'S', 1, 'Supporting', 3, 0, 0, 1, 0, '움직임 제한형:Supporting', NULL, 30, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('89', 'mebody_v1_32', 'D5', '②', '한쪽만 더 뻣뻣하거나 양쪽 차이가 느껴진다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', '고관절 굴곡 좌우 차이', 30, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('90', 'mebody_v1_32', 'D5', '③', '양쪽 모두 비교적 편하게 올라온다', 'flexibility', 'F', 1, 'Supporting', 3, 0, 0, 0, 0, 'None', NULL, 30, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('91', 'mebody_v1_32', 'D6', '①', '오른쪽 무릎이 더 편하게 올라온다', 'pelvis', 'L', 1, 'Supporting', 3, 0, 0, 0, 0, 'None', NULL, 31, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('92', 'mebody_v1_32', 'D6', '②', '양쪽이 비슷하거나 잘 모르겠다', NULL, NULL, 0, 'None', NULL, 0, 0, 0, 0, 'None', NULL, 31, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('93', 'mebody_v1_32', 'D6', '③', '왼쪽 무릎이 더 편하게 올라온다', 'pelvis', 'R', 1, 'Supporting', 3, 0, 0, 0, 0, 'None', NULL, 31, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('94', 'mebody_v1_32', 'D7', '①', '무릎을 굽히지 않으면 허리를 세우기 어렵다', 'flexibility', 'S', 3, 'Primary', 1, 0, 0, 3, 0, '움직임 제한형:Primary', NULL, 32, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('95', 'mebody_v1_32', 'D7', '②', '앉을 수 있지만 뒤허벅지가 많이 당긴다', NULL, NULL, 0, 'None', NULL, 0, 0, 1, 0, '움직임 제한형:Primary', NULL, 32, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.question_choice_scores (id, question_set, question_code, choice, choice_summary, axis, direction, axis_weight, axis_anchor, axis_priority, score_recovery, score_strength, score_mobility, score_balance, identity_anchor, aux_tag, display_order, created_at, updated_at) VALUES ('96', 'mebody_v1_32', 'D7', '③', '다리를 편 상태에서도 비교적 편하게 허리를 세울 수 있다', 'flexibility', 'F', 3, 'Primary', 1, 0, 0, 0, 0, 'None', NULL, 32, '2026-07-24T05:54:33.456Z', '2026-07-24T05:54:33.456Z')
  ON CONFLICT (id) DO UPDATE SET question_set = EXCLUDED.question_set, question_code = EXCLUDED.question_code, choice = EXCLUDED.choice, choice_summary = EXCLUDED.choice_summary, axis = EXCLUDED.axis, direction = EXCLUDED.direction, axis_weight = EXCLUDED.axis_weight, axis_anchor = EXCLUDED.axis_anchor, axis_priority = EXCLUDED.axis_priority, score_recovery = EXCLUDED.score_recovery, score_strength = EXCLUDED.score_strength, score_mobility = EXCLUDED.score_mobility, score_balance = EXCLUDED.score_balance, identity_anchor = EXCLUDED.identity_anchor, aux_tag = EXCLUDED.aux_tag, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;

-- ===== body_code_content (16행) =====
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('0a4a94ee-46ea-4180-936e-44148da83822', 'FRRF', '기대면 흐르는 젤리인간', '목 앞으로 쏠림, 오른쪽 어깨 높음, 오른쪽 골반 회전, 하체 유연', 'F', 'R', 'R', 'F', '["모니터 높이를 눈높이에 맞추세요","오른쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"거북목 교정","title":"목 스트레칭","duration":"5분"},{"desc":"어깨 높이 조정","title":"오른쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 오른쪽으로 회전된 경우 지원","name":"오른쪽 쿠션"},{"desc":"어깨 불균형 교정","name":"스트레칭 밴드"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('0c6c023f-fcc2-4344-b409-400a4af649b0', 'CLLF', '출렁이는 물침대', '목 중앙, 왼쪽 어깨 높음, 왼쪽 골반 회전, 하체 유연', 'C', 'L', 'L', 'F', '["모니터 높이를 눈높이에 맞추세요","왼쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"목 유지력 강화","title":"목 스트레칭","duration":"3분"},{"desc":"어깨 높이 조정","title":"왼쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 왼쪽으로 회전된 경우 지원","name":"왼쪽 쿠션"},{"desc":"어깨 불균형 교정","name":"스트레칭 밴드"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('1061e06c-ecc7-4d8a-a021-92db8626b132', 'CRRF', '오뚝이', '목 중앙, 오른쪽 어깨 높음, 오른쪽 골반 회전, 하체 유연', 'C', 'R', 'R', 'F', '["모니터 높이를 눈높이에 맞추세요","오른쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"목 유지력 강화","title":"목 스트레칭","duration":"3분"},{"desc":"어깨 높이 조정","title":"오른쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 오른쪽으로 회전된 경우 지원","name":"오른쪽 쿠션"},{"desc":"어깨 불균형 교정","name":"스트레칭 밴드"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('290bc8ed-1046-44f7-a429-35150b5bd51d', 'FLRS', '으쓱 고정 목각병정', '목 앞으로 쏠림, 왼쪽 어깨 높음, 오른쪽 골반 회전, 하체 경직', 'F', 'L', 'R', 'S', '["모니터 높이를 눈높이에 맞추세요","오른쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"거북목 교정","title":"목 스트레칭","duration":"5분"},{"desc":"어깨 높이 조정","title":"왼쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 오른쪽으로 회전된 경우 지원","name":"오른쪽 쿠션"},{"desc":"목 긴장 완화","name":"폼롤러"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('410ea048-e1c5-4f0b-b015-d56b76cabaac', 'CLLS', '한쪽 뿌리 소나무', '목 중앙, 왼쪽 어깨 높음, 왼쪽 골반 회전, 하체 경직', 'C', 'L', 'L', 'S', '["모니터 높이를 눈높이에 맞추세요","왼쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"목 유지력 강화","title":"목 스트레칭","duration":"3분"},{"desc":"어깨 높이 조정","title":"왼쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 왼쪽으로 회전된 경우 지원","name":"왼쪽 쿠션"},{"desc":"하체 근육 완화","name":"폼롤러"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('463cbf2b-4d39-4378-87c9-9e100532b84c', 'FLLF', '녹아내리는 소프트콘', '목 앞으로 쏠림, 왼쪽 어깨 높음, 왼쪽 골반 회전, 하체 유연', 'F', 'L', 'L', 'F', '["모니터 높이를 눈높이에 맞추세요","왼쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"거북목 교정","title":"목 스트레칭","duration":"5분"},{"desc":"어깨 높이 조정","title":"왼쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 왼쪽으로 회전된 경우 지원","name":"왼쪽 쿠션"},{"desc":"어깨 불균형 교정","name":"스트레칭 밴드"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('670b0929-6554-45cc-834b-c2768b3f1ead', 'FRLS', '되배기 금속 스프링', '목 앞으로 쏠림, 오른쪽 어깨 높음, 왼쪽 골반 회전, 하체 경직', 'F', 'R', 'L', 'S', '["모니터 높이를 눈높이에 맞추세요","왼쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"거북목 교정","title":"목 스트레칭","duration":"5분"},{"desc":"어깨 높이 조정","title":"오른쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 왼쪽으로 회전된 경우 지원","name":"왼쪽 쿠션"},{"desc":"목 긴장 완화","name":"폼롤러"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('6ed04954-b600-47c4-8498-d52de231e6dd', 'FRLF', '회전 많은 풍선인형', '목 앞으로 쏠림, 오른쪽 어깨 높음, 왼쪽 골반 회전, 하체 유연', 'F', 'R', 'L', 'F', '["모니터 높이를 눈높이에 맞추세요","왼쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"거북목 교정","title":"목 스트레칭","duration":"5분"},{"desc":"어깨 높이 조정","title":"오른쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 왼쪽으로 회전된 경우 지원","name":"왼쪽 쿠션"},{"desc":"어깨 불균형 교정","name":"스트레칭 밴드"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('9044b04c-d2ff-4a83-ae41-a25b40214cdf', 'FLLS', '한쪽에 박힌 발톱', '목 앞으로 쏠림, 왼쪽 어깨 높음, 왼쪽 골반 회전, 하체 경직', 'F', 'L', 'L', 'S', '["모니터 높이를 눈높이에 맞추세요","왼쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"거북목 교정","title":"목 스트레칭","duration":"5분"},{"desc":"어깨 높이 조정","title":"왼쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 왼쪽으로 회전된 경우 지원","name":"왼쪽 쿠션"},{"desc":"목 긴장 완화","name":"폼롤러"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('9565f837-573a-402f-a039-7fdbdee07e88', 'CRRS', '닻', '목 중앙, 오른쪽 어깨 높음, 오른쪽 골반 회전, 하체 경직', 'C', 'R', 'R', 'S', '["모니터 높이를 눈높이에 맞추세요","오른쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"목 유지력 강화","title":"목 스트레칭","duration":"3분"},{"desc":"어깨 높이 조정","title":"오른쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 오른쪽으로 회전된 경우 지원","name":"오른쪽 쿠션"},{"desc":"하체 근육 완화","name":"폼롤러"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('9effb511-d1da-4b3c-bf70-c5bba2847db8', 'CRLF', '중심 귀찮은 문어', '목 중앙, 오른쪽 어깨 높음, 왼쪽 골반 회전, 하체 유연', 'C', 'R', 'L', 'F', '["모니터 높이를 눈높이에 맞추세요","왼쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"목 유지력 강화","title":"목 스트레칭","duration":"3분"},{"desc":"어깨 높이 조정","title":"오른쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 왼쪽으로 회전된 경우 지원","name":"왼쪽 쿠션"},{"desc":"어깨 불균형 교정","name":"스트레칭 밴드"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('c3ba4a95-50c6-4cf6-bcc8-d9eeb27398d5', 'CRLS', '큐브 탑', '목 중앙, 오른쪽 어깨 높음, 왼쪽 골반 회전, 하체 경직', 'C', 'R', 'L', 'S', '["모니터 높이를 눈높이에 맞추세요","왼쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"목 유지력 강화","title":"목 스트레칭","duration":"3분"},{"desc":"어깨 높이 조정","title":"오른쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 왼쪽으로 회전된 경우 지원","name":"왼쪽 쿠션"},{"desc":"하체 근육 완화","name":"폼롤러"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('c82d911d-8c8f-49fa-a389-74ed4b4df2ca', 'CLRF', '아슬아슬 젠가 탑', '목 중앙, 왼쪽 어깨 높음, 오른쪽 골반 회전, 하체 유연', 'C', 'L', 'R', 'F', '["모니터 높이를 눈높이에 맞추세요","오른쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"목 유지력 강화","title":"목 스트레칭","duration":"3분"},{"desc":"어깨 높이 조정","title":"왼쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 오른쪽으로 회전된 경우 지원","name":"오른쪽 쿠션"},{"desc":"어깨 불균형 교정","name":"스트레칭 밴드"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('ca3fd952-440e-4575-ab0a-2ac09d5b3e84', 'CLRS', '엇갈려 잠긴 나무인형', '목 중앙, 왼쪽 어깨 높음, 오른쪽 골반 회전, 하체 경직', 'C', 'L', 'R', 'S', '["모니터 높이를 눈높이에 맞추세요","오른쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"목 유지력 강화","title":"목 스트레칭","duration":"3분"},{"desc":"어깨 높이 조정","title":"왼쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 오른쪽으로 회전된 경우 지원","name":"오른쪽 쿠션"},{"desc":"하체 근육 완화","name":"폼롤러"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('d817ab3a-df2e-4d3a-8d95-168fcbe858a4', 'FLRF', '리듬은 좋은데 금방 시치는 갈대', '목 앞으로 쏠림, 왼쪽 어깨 높음, 오른쪽 골반 회전, 하체 유연', 'F', 'L', 'R', 'F', '["모니터 높이를 눈높이에 맞추세요","오른쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"거북목 교정","title":"목 스트레칭","duration":"5분"},{"desc":"어깨 높이 조정","title":"왼쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 오른쪽으로 회전된 경우 지원","name":"오른쪽 쿠션"},{"desc":"어깨 불균형 교정","name":"스트레칭 밴드"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_content (id, body_code, character_name, description, neck_result, shoulder_result, pelvis_result, flexibility_result, lifestyle_tips, exercises, health_products, created_at, updated_at) VALUES ('eb754771-736d-44dd-bf12-7163864d4b0b', 'FRRS', '암사가는 잠금 로봇', '목 앞으로 쏠림, 오른쪽 어깨 높음, 오른쪽 골반 회전, 하체 경직', 'F', 'R', 'R', 'S', '["모니터 높이를 눈높이에 맞추세요","오른쪽 골반을 지원하는 쿠션 사용"]'::jsonb, '[{"desc":"거북목 교정","title":"목 스트레칭","duration":"5분"},{"desc":"어깨 높이 조정","title":"오른쪽 어깨 균형 운동","duration":"7분"}]'::jsonb, '[{"desc":"골반이 오른쪽으로 회전된 경우 지원","name":"오른쪽 쿠션"},{"desc":"목 긴장 완화","name":"폼롤러"}]'::jsonb, '2026-02-05T23:20:05.587Z', '2026-02-06T05:17:41.949Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, character_name = EXCLUDED.character_name, description = EXCLUDED.description, neck_result = EXCLUDED.neck_result, shoulder_result = EXCLUDED.shoulder_result, pelvis_result = EXCLUDED.pelvis_result, flexibility_result = EXCLUDED.flexibility_result, lifestyle_tips = EXCLUDED.lifestyle_tips, exercises = EXCLUDED.exercises, health_products = EXCLUDED.health_products, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;

-- ===== body_code_next_page (1행) =====
INSERT INTO public.body_code_next_page (id, body_code, title, sections, created_at, updated_at) VALUES ('d81a4478-ed63-4d72-a3a0-b2fee79ac7be', 'FRRS', 'FRRS 맞춤 가이드', '[{"title":"이 체형의 특징","content":"몸이 뻣뻣하고(Lock) 머리가 몸보다 앞서 나가는 경향이 있습니다."},{"title":"추천 습관","content":"**50% Rule**로 목·어깨에 머무는 시간을 줄여보세요."}]'::jsonb, '2026-02-24T07:41:33.073Z', '2026-02-24T07:41:33.073Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, title = EXCLUDED.title, sections = EXCLUDED.sections, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;

-- ===== body_code_result_sections (96행) =====
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('025ff9e1-32cc-49dc-8502-2c08af250094', 'FLRF', '1', '한눈에 보는 내 코드', '목: 전방 (F) – 고개 앞
어깨: 왼쪽 높음 (L) – 좌측 어깨 높음
골반: 오른쪽 회전 (R) – 우측 골반 회전
하체: 유연 (F) – 유연형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('0a09fc62-8ae5-4930-91c6-0db3a395810d', 'CLRS', '5', '무료 10~15분 자가 루틴', '**이완:** 좌측 목-어깨 연결부, 우측 골반 앞/옆(장요근/TFL), 목 앞쪽(SCM)
**강화:** 오른쪽 날개뼈 내리기, 수건으로 목 커브 만들기, 누워서 왼쪽 발바닥 당기기
**루틴(10~14분):** 이완 60초·60초·45초, 강화 8회×2·8회×2·12회×2', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('0a5ee3f3-3e69-44a5-bbe0-cd3908ad1476', 'FRLF', '5', '무료 10~15분 자가 루틴', '**이완:** 우측 어깨 위쪽(승모근), 좌측 골반 옆면(TFL), 종아리
**강화:** 목 버티기(경추 등척성), 누워서 왼쪽 발바닥 당기기(90/90), 한 발로 인사하기(싱글레그 데드리프트)
**루틴(12~15분):** 이완 45초·60초, 스트레칭 종아리 45초, 강화 10초×5·8회×2·6회×2', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('0d1798fc-0394-463a-8767-9ec08a4035bf', 'FLLS', '3', '공감 포인트', '서 있을 때 왼쪽 다리에만 체중을 싣고 꼼짝 않음, 골반 회전이 굳어서 몸을 돌릴 때 통째로 돌아감, 몸이 앞으로 쏠린 상태로 단단히 버팀.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('0ec59363-8764-47e4-b9b8-6e7cc18a08fb', 'FLRS', '0', '내 체형 코드(FLRS)에 대해서 알아보기', '당신의 체형 코드는 **FLRS**입니다. (으쓱 고정 목각병정)

왼쪽 어깨를 으쓱 올려 목을 딱딱하게 고정하고, 몸통 회전이 뻣뻣해 마치 나무로 깎은 병정처럼 움직이기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('0f97be5d-3f03-4d0f-bfef-3b8cac2e4553', 'FRRS', '3', '공감 포인트', '서 있을 때 한쪽 다리에 체중이 실리기, 무릎을 꽉 잠그는 게 편함, 화면 볼 때 턱이 나옴, 회전 움직임이 뻣뻣하게 느껴짐 등이 해당될 수 있습니다.', 3, '2026-02-24T07:41:33.073Z', '2026-02-24T07:41:33.073Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('1039fc2f-9f91-4d20-a608-79516e7d75de', 'FRLF', '3', '공감 포인트', '골반이 돌아가면서 배를 앞으로 내미는 자세, 발목을 자주 삐끗하거나 한쪽 신발 밑창만 빨리 닳음, 한 자세를 오래 유지하기 어려울 수 있습니다.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('1069b10d-3650-4216-ba97-45ae8c46793e', 'CLRF', '2', '이해 포인트', '**유연하지만 젠가처럼 정렬이 어긋나** 언제 무너질지 모르게 **아슬아슬한** 패턴입니다. 버티는 힘이 약해 흔들리고 비틀린 자세가 편해 그대로 늘어져 있기 쉽습니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('10a82b5e-cf77-45e4-bfdf-731d9e0270d7', 'CRRF', '1', '한눈에 보는 내 코드', '목: 중앙 (C) – 고개 꼿꼿
어깨: 오른쪽 높음 (R) – 우측 어깨 높음
골반: 오른쪽 회전 (R) – 우측 골반 회전
하체: 유연 (F) – 유연형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('12660bee-7b95-4d3f-9797-987bdc99560f', 'FRLS', '3', '공감 포인트', '한쪽 옆구리가 항상 묵직하고 당기는 느낌, 걸을 때 양팔이 흔들리는 범위가 다름, 몸을 돌릴 때 삐걱거림이 있을 수 있습니다.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('1efb0939-0d7d-42aa-847b-efda66a061ab', 'FRRF', '3', '공감 포인트', '서 있을 때 무릎을 뒤로 끝까지 밀어 뼈에 기대는 습관, 소파나 의자에서 한쪽으로 몸이 툭 빠지며 기댐, 고개가 앞으로 나가지만 관절이 유연해 불편함을 늦게 알아차릴 수 있습니다.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('1f16d3b0-ee59-4640-962c-f9d236184314', 'CRRF', '4', '지금 주의하면 좋은 자세', '계단 오를 때 한쪽 다리만 주로 사용하기, 무거운 크로스백(목과 승모근 압박), 고개 푹 숙이고 스마트폰 보기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('1f5fc912-94ad-4197-b635-437c623f2d21', 'FRRS', '2', '이해 포인트', '**단단하게 버티며 균형 잡기**가 **부드럽게 풀기**보다 익숙한 패턴일 수 있습니다. 이 경향이 목·어깨 긴장이나 한쪽 다리 선호로 이어질 수 있어요.', 2, '2026-02-24T07:41:33.073Z', '2026-02-24T07:41:33.073Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('22671a70-dd41-455d-a5c6-1e95d99be70c', 'CLLS', '1', '한눈에 보는 내 코드', '목: 중앙 (C) – 고개 꼿꼿
어깨: 왼쪽 높음 (L) – 좌측 어깨 높음
골반: 왼쪽 회전 (L) – 좌측 골반 회전
하체: 경직 (S) – 강직형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('2493d102-4276-429c-9ca7-cfff37eb00f9', 'FLRF', '3', '공감 포인트', '자세가 한쪽으로 기울어도 근육이 잡아주지 못해 툭 쳐짐, 몸이 비틀려 있어도 힘을 주기보다 관절을 늘려서 버팀, 오래 서 있으면 허리나 골반이 흘러내리는 느낌.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('25b7b972-3c86-431d-b597-bbc65e33c429', 'FRLF', '0', '내 체형 코드(FRLF)에 대해서 알아보기', '당신의 체형 코드는 **FRLF**입니다. (회전 많은 풍선인형)

바람 인형처럼 유연하게 잘 움직이지만, 중심축을 잡지 못해 골반과 어깨가 제멋대로 회전하며 흔들리기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('2dc081e1-041d-4961-81c3-674b628aed22', 'CRLS', '1', '한눈에 보는 내 코드', '목: 중앙 (C) – 고개 꼿꼿
어깨: 오른쪽 높음 (R) – 우측 어깨 높음
골반: 왼쪽 회전 (L) – 좌측 골반 회전
하체: 경직 (S) – 강직형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('335ed0cf-7634-47cd-81eb-6e1b29753226', 'CRRS', '3', '공감 포인트', '정수리나 눈 주변이 묵직하게 조여오는 느낌, 고개를 뒤로 젖히는 동작이 뻣뻣하고 잘 안 됨, 겉보기엔 반듯해 보이지만 속은 꽉 잠겨 있음.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('373add1d-ef9d-40bb-a349-35c5aee72411', 'CRRF', '3', '공감 포인트', '중심 잡기가 귀찮아서 몸을 ''툭'' 하고 한쪽으로 기대버림, 목이 불안정해서 어깨를 으쓱하며 버티려고 함, 한 자세를 오래 유지하기 어려울 수 있습니다.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('38a0f0b3-a31f-45cd-ba3f-841cc3595fe0', 'CLRS', '0', '내 체형 코드(CLRS)에 대해서 알아보기', '당신의 체형 코드는 **CLRS**입니다. (엇갈려 잠긴 나무인형)

어깨는 왼쪽, 골반은 오른쪽으로 서로 엇갈린 채 나무처럼 단단하게 잠겨(Lock) 있어 움직임이 부자연스럽기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('3b17afb3-9540-4336-9ba7-588dbc94d514', 'FLLS', '0', '내 체형 코드(FLLS)에 대해서 알아보기', '당신의 체형 코드는 **FLLS**입니다. (한쪽에 박힌 말뚝)

체중을 왼발에 ''말뚝''처럼 깊게 박아두고, 몸이 전체적으로 왼쪽으로 쏠린 채 단단하게 굳어있기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('3cbf51e8-cad3-44de-a721-db91352b654c', 'CRLF', '4', '지금 주의하면 좋은 자세', '무릎을 뒤로 꽉 펴고 서 있기, 안정성 없이 유연성만 믿고 과하게 꺾기, 목을 좌우로 우두둑 소리 내며 꺾기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('3d6b427c-aaf3-460b-89c7-2faac649fa46', 'CRLF', '0', '내 체형 코드(CRLF)에 대해서 알아보기', '당신의 체형 코드는 **CRLF**입니다. (중심 귀찮은 문어)

뼈대가 단단하게 잡아주는 느낌 없이, 문어처럼 흐느적거리며 관절을 이리저리 꺾어서 몸을 지탱하기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('3d7349c3-fda1-4b4e-a924-7eb0fa231031', 'FLRS', '5', '무료 10~15분 자가 루틴', '**이완:** 좌측 목-어깨 연결부(승모근), 좌측 목 앞쪽(SCM), 우측 골반 앞/옆(장요근/TFL)
**강화:** 오른쪽 날개뼈 내리기, 뒷목 버티기, 누워서 왼쪽 발바닥 당기기
**루틴(10~14분):** 이완 60초·45초, 스트레칭 갈비뼈 심호흡 6회, 강화 12회×2·10초×5·8회×2', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('3e4f578f-4aa7-4172-9759-5b2723f8069f', 'FRRS', '4', '지금 주의하면 좋은 자세', '무릎 꽉 잠그고 서 있기, 한쪽 힙만 밀어내기, 화면 볼 때 턱 내밀기, 한 방향으로만 다리 꼬기, 어깨·팔 근육만 과하게 쓰기 등을 줄여보세요.', 4, '2026-02-24T07:41:33.073Z', '2026-02-24T07:41:33.073Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('40aa5829-8bbb-41fb-8d23-467907718013', 'CLRF', '4', '지금 주의하면 좋은 자세', '허리나 목을 과하게 꺾는 요가 동작, 왼쪽 다리 꼬기(비틀림 심화), 높은 베개 베고 자기(목 스트레스 증가).', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('4667edb6-41ac-48fe-9f0e-5c5e4ccf8ee0', 'CLLF', '5', '무료 10~15분 자가 루틴', '**이완·스트레칭 (Release)**
• 좌측 목 앞쪽 (SCM): 목 안정화 방해 요인
• 좌측 골반 옆면 (TFL): 옆으로 빠지는 골반
• 종아리: 흔들리는 발목

**강화 (Strengthen)**
• 목 버티기 (경추 등척성): 목 근육 강화
• 발바닥 아치 만들기: 발바닥 힘으로 중심 잡기
• 한 발로 버티기 (싱글레그 스탠스): 왼쪽 다리로 서서 골반 수평 유지

**루틴 (12~15분)**
이완: 좌측 목 앞쪽 60초
이완: 좌측 골반 옆면 60초
스트레칭: 종아리 45초
강화: 목 버티기 10초×5
강화: 발바닥 아치 만들기 20초×3
강화: 왼쪽 다리로 한 발 버티기 20초×3', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('48ad132f-c01b-410c-89e4-4179b999aa1f', 'FLLF', '2', '이해 포인트', '**체중을 실면 스르륵 무너지고** 뼈와 관절이 버티지 못해 **녹아내리듯 기대는** 패턴입니다. 힘을 주기보다 축 늘어뜨리는 경향이 있습니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('50ff6e0f-2c1d-4e5b-8325-89282999b5d7', 'FRLS', '0', '내 체형 코드(FRLS)에 대해서 알아보기', '당신의 체형 코드는 **FRLS**입니다. (꽈배기 금속 스프링)

상체는 오른쪽, 하체는 왼쪽으로 꼬여 있는데, 몸이 단단해서 마치 팽팽하게 감긴 스프링 같기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('51e412d3-0da0-422f-9def-e94746c0a0b9', 'CLRS', '1', '한눈에 보는 내 코드', '목: 중앙 (C) – 고개 꼿꼿
어깨: 왼쪽 높음 (L) – 좌측 어깨 높음
골반: 오른쪽 회전 (R) – 우측 골반 회전
하체: 경직 (S) – 강직형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('52f6ab3a-ba02-439a-be60-4d49ffc78742', 'FRLS', '5', '무료 10~15분 자가 루틴', '**이완:** 우측 옆구리 뒤쪽(요방형근), 좌측 엉덩이 깊은 곳(이상근), 우측 목 빗근(SCM)
**강화:** 누워서 왼쪽 발바닥 당기기(90/90), 대각선 줄다리기(크로스 프레스), 왼쪽 Y자 들기
**루틴(12~15분):** 이완 60초+60초, 스트레칭 몸통 좌측 회전 6회, 강화 8회×2·10회×2·10회×2', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('541f02b2-5426-4849-af6d-e494bbb2dc0a', 'CRRF', '5', '무료 10~15분 자가 루틴', '**이완:** 우측 골반 옆면(TFL), 우측 어깨 위쪽, 종아리
**강화:** 엎드려서 무릎 접기(햄스트링 컬), 목 버티기(경추 등척성), 한 발로 버티기
**루틴(12~15분):** 이완 45초·60초·45초, 강화 10초×5·10회×2·20초×3', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('561a0a22-2760-4b73-a013-b9879083c707', 'CRLF', '2', '이해 포인트', '**뼈대가 잡아주는 느낌 없이** 문어처럼 **흐느적거리며 관절을 꺾어** 몸을 지탱하는 패턴입니다. 한 자세를 오래 유지하기 어렵고 몸통이 제멋대로 돌아가는 느낌이 듭니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('595bfe72-4ead-4155-9f5f-71e1cfd50d44', 'CRRS', '1', '한눈에 보는 내 코드', '목: 중앙 (C) – 고개 꼿꼿
어깨: 오른쪽 높음 (R) – 우측 어깨 높음
골반: 오른쪽 회전 (R) – 우측 골반 회전
하체: 경직 (S) – 강직형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('59cd1d7c-d799-42db-bd86-0d80ad149f47', 'CRRF', '0', '내 체형 코드(CRRF)에 대해서 알아보기', '당신의 체형 코드는 **CRRF**입니다. (오뚝이)

목이 가늘고 힘이 없어 머리 무게를 감당하기 힘들고, 긴장을 풀면 오뚝이처럼 한쪽으로 기우뚱거리기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('5c581e22-2112-4536-876a-21dffe08eb93', 'FRLF', '1', '한눈에 보는 내 코드', '목: 전방 (F) – 고개 앞
어깨: 오른쪽 높음 (R) – 우측 어깨 높음
골반: 왼쪽 회전 (L) – 좌측 골반 회전
하체: 유연 (F) – 유연형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('5de49051-dc3d-4523-99d5-9b2d526a2712', 'CRLS', '4', '지금 주의하면 좋은 자세', '다리 꼬기(특히 왼쪽 다리 위로), 의자에 앉아 몸통만 돌려 뒤에 있는 물건 집기, 턱을 과하게 당겨 목을 일자로 만들기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('5f73f180-8771-4db9-8aaa-db789cbc5ff1', 'FRLS', '2', '이해 포인트', '**몸통 빨래짜기**처럼 어깨와 골반이 서로 반대를 보고 있어 몸이 비틀림이 굳어진 패턴입니다. 상체는 오른쪽, 하체는 왼쪽으로 꼬여 단단하게 잠겨 있습니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('66d3765a-9957-4166-9e85-5127136ca4eb', 'CRLF', '5', '무료 10~15분 자가 루틴', '**이완:** 좌측 골반 옆면(TFL), 목 앞쪽(SCM), 종아리
**강화:** 목 버티기(경추 등척성), 한 발로 인사하기(싱글레그 데드리프트), 누워서 왼쪽 발바닥 당기기
**루틴(12~15분):** 이완 60초·60초, 스트레칭 종아리 45초, 강화 10초×5·8회×2·6회×2', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('69067210-194b-4079-9e40-b3fb5b1db048', 'FRRF', '4', '지금 주의하면 좋은 자세', '무릎을 뒤로 끝까지 튕기며 서 있는 자세, 발목을 잡아주지 못하는 푹신한 신발이나 높은 굽, 한쪽 엉덩이만 걸치고 앉기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('74990f65-45d1-46ba-b10d-cc72a40e1b2d', 'FLLF', '5', '무료 10~15분 자가 루틴', '**이완:** 좌측 골반 옆면(TFL), 좌측 가슴 앞쪽(소흉근), 좌측 골반 앞쪽(장요근)
**강화:** 오른쪽 옆구리 조이기, 좌측 무릎 접기(햄스트링 컬), 한 발로 인사하기(싱글레그 데드리프트)
**루틴(12~15분):** 이완 60초·60초, 스트레칭 좌측 가슴 45초, 강화 12회×2·10회×2·6회×2', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('82a1842c-dcb0-40f2-a8ad-29a3b23a1229', 'CRLS', '3', '공감 포인트', '거울을 보면 대칭 같지만 움직이면 삐걱거림, 오래 앉아 있으면 허리 뒤쪽이 빵빵하게 부풀어 오르는 느낌, 몸을 돌리는 동작이 둔하고 범위가 좁음.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('897ade3b-94e1-4e0c-b0ef-3d2db04fb05a', 'CRLS', '5', '무료 10~15분 자가 루틴', '**이완:** 등 허리 연결부(흉요근막), 좌측 엉덩이 깊은 곳(이상근), 목 앞쪽(SCM)
**강화:** 누워서 왼쪽 발바닥 당기기(90/90), 오른쪽 날개뼈 내리기, 대각선 밀기(크로스 프레스)
**루틴(12~15분):** 이완 60초·60초·45초, 강화 8회×2·10회×2·12회×2', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('8a77976a-c0b5-41e5-be13-b8264d93f323', 'FLLF', '3', '공감 포인트', '어디든 기대고 싶어 하고 한쪽으로 스르륵 몸을 기댐, 몸이 앞으로 쏠려 있는데 힘을 주기보다 축 늘어뜨림, 몸을 돌리기보다 옆으로 무너지는 자세가 먼저 나옴.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('92944813-e5c5-4b29-a590-88406fd42a45', 'CLRF', '5', '무료 10~15분 자가 루틴', '**이완:** 우측 골반 옆면(TFL), 우측 어깨 위쪽, 종아리
**강화:** 엎드려서 무릎 접기(햄스트링 컬), 목 버티기(경추 등척성), 엎드려 버티기(플랭크)
**루틴(15분 내):** 이완 60초·45초, 스트레칭 종아리 45초, 강화 10초×5·10회×2·20초×3', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('92ae641f-6516-4566-bd12-64c67fe1ec48', 'CLLF', '1', '한눈에 보는 내 코드', '목: 중앙 (C) – 고개 꼿꼿
어깨: 왼쪽 높음 (L) – 좌측 어깨 높음
골반: 왼쪽 회전 (L) – 좌측 골반 회전
하체: 유연 (F) – 유연형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('98f2ae42-ae25-4d50-9d10-6fabf83edc3a', 'FRRS', '5', '무료 10~15분 자가 루틴', '**목표**: 버티기만 하는 패턴 → 부드럽게 움직이고 다시 잡는 패턴

1단계(3분): 종아리·허벅지 앞쪽 가볍게 풀기
2단계(3분): 골반·허리 회전 움직임 넣기
3단계(3분): 어깨·목 이완
4단계(3분): 전신 호흡·정리

(차후 영상 촬영 후 자가 루틴 사진·영상 첨부 예정)', 5, '2026-02-24T07:41:33.073Z', '2026-02-24T07:41:33.073Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('992a13d6-9c35-4fca-9e62-ead92ccccb39', 'FRRF', '2', '이해 포인트', '**말랑말랑한 관절**로 **흐르듯 기대는** 패턴입니다. 스스로 버티기보다 어딘가에 기대는 것을 좋아해, 무릎을 뒤로 밀어 뼈에 기대거나 한쪽으로 몸이 빠지며 기대는 경향이 있습니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('9d6a5c13-a766-4379-b581-8c94391c69e9', 'FRRF', '1', '한눈에 보는 내 코드', '목: 전방 (F) – 고개 앞
어깨: 오른쪽 높음 (R) – 우측 어깨 높음
골반: 오른쪽 회전 (R) – 우측 골반 회전
하체: 유연 (F) – 유연형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('a09cddce-2843-406c-8c33-667791878bca', 'CRRS', '4', '지금 주의하면 좋은 자세', '턱 당기기 과도하게(이미 목이 1자이므로 스트레스 증가), 스마트폰 내려다보기(눈높이 필수), 오른쪽으로 짝다리 짚기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('a15ca793-a11b-4219-a73f-6013826c0759', 'CRLS', '0', '내 체형 코드(CRLS)에 대해서 알아보기', '당신의 체형 코드는 **CRLS**입니다. (큐브 탑)

겉보기엔 반듯한 탑처럼 보이지만, 자세히 보면 큐브의 위아래 층이 서로 반대 방향으로 엇갈린 채 꽉 껴있기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('a1fdc257-83c8-4cdf-85a2-244d37d33583', 'CRRS', '5', '무료 10~15분 자가 루틴', '**이완:** 목 앞쪽 근육(SCM), 좌측 골반 옆면(TFL), 우측 어깨 위쪽(승모근)
**강화:** 수건으로 목 커브 만들기, 누워서 왼쪽 발바닥 당기기, 오른쪽 날개뼈 내리기
**루틴(10~15분):** 이완 60초·60초·45초, 강화 8회×2·8회×2·12회×2', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('a41a4012-e986-4cfb-922d-ebca7eaf003c', 'FLRF', '5', '무료 10~15분 자가 루틴', '**이완:** 좌측 어깨 위쪽, 우측 옆구리 뒤쪽(요방형근), 종아리
**강화:** 한 발로 버티기(싱글레그 스탠스), 옆구리 들어 올리기(사이드 플랭크), 밴드 당기기(로우)
**루틴(12~15분):** 이완 45초·60초, 스트레칭 종아리 45초, 강화 20초×3·15초×3·12회×2', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('a6402b40-0564-4f41-afc4-240ddb9cf8dd', 'FRLF', '4', '지금 주의하면 좋은 자세', '중심 잡기 없이 유연성만 늘리는 과한 스트레칭, 골반을 비틀고 한 발로 짝다리 버티기, 목을 습관적으로 우두둑 꺾기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('a7579553-5c2b-44d5-8b4a-36f2df120113', 'CLLS', '3', '공감 포인트', '목·어깨·허리·무릎의 불편감이 왼쪽에만 집중됨, 허리와 목이 일자로 펴져 있어 충격 흡수가 안 됨, 사진을 찍으면 몸이 왼쪽으로 기울어 있음.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('a79e7549-62fd-4615-93f6-661ff6797b81', 'CRRS', '0', '내 체형 코드(CRRS)에 대해서 알아보기', '당신의 체형 코드는 **CRRS**입니다. (닻)

목은 꼿꼿하게 서 있고 골반은 한쪽에 닻을 내린 배처럼 묵직하게 고정되어, 충격을 흡수하지 못하고 그대로 받기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('aa799152-6641-4781-8142-bd28eeda20d9', 'CRRF', '2', '이해 포인트', '**목이 가늘어 머리 무게를 감당하기 힘들고** 긴장을 풀면 **오뚝이처럼 한쪽으로 기우뚱**거리는 패턴입니다. 특정 근육만 과하게 써서 금방 피로해질 수 있습니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('ac33d0f3-457e-43ba-88d2-78db9e2ecaea', 'FLLF', '0', '내 체형 코드(FLLF)에 대해서 알아보기', '당신의 체형 코드는 **FLLF**입니다. (녹아내리는 소프트콘)

체중을 실으면 아이스크림처럼 몸이 스르륵 무너지고, 뼈와 관절이 체중을 버티지 못해 녹아내리듯 기대기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('b2428483-3e25-4b4e-b4da-b0570e808a4d', 'FLLF', '4', '지금 주의하면 좋은 자세', '소파 팔걸이에 한쪽 옆구리 기대기, 무릎을 뒤로 꽉 펴서 관절에 매달려 서기, 가방을 항상 매던 쪽(왼쪽)으로만 메기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('b6134032-a849-4bdb-8f54-6f7a12f1741c', 'CLLS', '0', '내 체형 코드(CLLS)에 대해서 알아보기', '당신의 체형 코드는 **CLLS**입니다. (한쪽 뿌리 소나무)

왼쪽 다리에 뿌리를 깊게 내린 소나무처럼 체중이 한쪽에 쏠려 있고, 그쪽으로 과도한 스트레스가 집중되기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('b66ebe5e-09ad-4104-8988-c85553607505', 'CLRS', '4', '지금 주의하면 좋은 자세', '왼손으로 턱 괴기, 왼쪽 어깨로 가방 메기, 몸통 회전 없이 허리로만 돌리기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('b7adc695-5ab1-4ff3-a2d7-08ec3a0bc289', 'FLRF', '4', '지금 주의하면 좋은 자세', '다리를 쭉 뻗고 발목을 교차해 얹어놓기, 한쪽 팔로만 무거운 장바구니 들기, 근력 운동 없이 유연성 스트레칭만 하기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('b981059a-00eb-4ed7-b447-3842b4b6e375', 'FLLS', '2', '이해 포인트', '**체중을 왼발에 말뚝처럼 박아두고** 왼쪽으로 쏠린 채 **단단하게 굳어 있는** 패턴입니다. 골반 회전이 굳어 통째로 돌아가는 느낌이 듭니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('b9c13f2a-3f52-4496-9f89-087bcea6cde1', 'CLRF', '3', '공감 포인트', '유연해서 잘 움직이지만 버티는 힘이 약해 흔들림, 한자리에 가만히 서 있지 못함, 비틀린 자세가 편해서 그 상태로 늘어져 있음.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('bacb39e3-bf9a-4208-8864-7a99532bfc93', 'FRRF', '0', '내 체형 코드(FRRF)에 대해서 알아보기', '당신의 체형 코드는 **FRRF**입니다. (기대면 흐르는 젤리인간)

관절이 말랑말랑해서 스스로 서 있기보다 어딘가에 ''흐르듯'' 기대는 것을 좋아하기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('c02c08af-f061-46ae-a710-33290af82712', 'FLRS', '3', '공감 포인트', '왼쪽 어깨를 귀에 붙일 듯 올려서 목을 받침, 목이 몸통보다 앞으로 툭 튀어나와 있음, 몸을 돌릴 때 부드럽지 않고 통나무처럼 뻣뻣하게 돌아감.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('c10c936c-6699-41fa-8052-515e11d4ddbe', 'FLLF', '1', '한눈에 보는 내 코드', '목: 전방 (F) – 고개 앞
어깨: 왼쪽 높음 (L) – 좌측 어깨 높음
골반: 왼쪽 회전 (L) – 좌측 골반 회전
하체: 유연 (F) – 유연형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('c2ed3ba4-9274-4a40-ade8-518408049a00', 'FLRF', '2', '이해 포인트', '**유연하지만 코어 힘이 약해** 한 자세로 있으면 금방 지쳐 옆으로 쓰러지는 패턴입니다. 근육이 자세를 잡아주지 못해 툭 쳐지는 느낌이 들 수 있습니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('ce3f2542-a70a-45c5-9d8d-7e8d0dcd7ee0', 'FLRS', '4', '지금 주의하면 좋은 자세', '왼손으로 턱 괴기(왼쪽 어깨 더 올라감), 왼쪽 어깨로만 가방 메기, 의자에 앉아 몸통만 뒤로 비틀어 보기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('ce87ce0b-97d3-486b-9a7e-06f1b42dabaa', 'CLRS', '2', '이해 포인트', '**어깨는 왼쪽, 골반은 오른쪽**으로 **엇갈린 채 나무처럼 잠겨** 있는 패턴입니다. 상체와 하체가 서로 다른 방향을 보고 굳어 움직임이 뚝뚝 끊깁니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('ced36147-522b-497c-8001-dc921ff3a59f', 'CRRS', '2', '이해 포인트', '**목은 꼿꼿하고 골반은 한쪽에 닻을 내린** 듯 묵직하게 고정된 패턴입니다. 충격을 흡수하지 못하고 그대로 받아 속이 꽉 잠겨 있습니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('cf271171-7412-40b0-8a06-bce034d5b38d', 'CLRS', '3', '공감 포인트', '상체와 하체가 서로 다른 방향을 보고 굳어 있음, 움직임이 뚝뚝 끊기고 제한적임, 양쪽 어깨 높이 차이가 눈에 띔.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('cf7b207d-4a21-4636-a6da-3e68804df27a', 'CLLS', '2', '이해 포인트', '**왼쪽 다리에 뿌리 내린 소나무**처럼 **체중이 한쪽에 쏠려** 그쪽으로 스트레스가 집중되는 패턴입니다. 목·어깨·허리·무릎 불편감이 왼쪽에만 집중될 수 있습니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('d2c171e0-63a7-4e11-b9ce-7a76bd7a422c', 'FLRS', '2', '이해 포인트', '**왼쪽 어깨를 올려 목을 고정**하고 **몸통 회전이 뻣뻣한** 패턴입니다. 통나무처럼 굳어 있어 부드럽게 돌아가기 어렵습니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('d82cb7b5-019d-430f-9e7b-eab4446a0fec', 'FRRF', '5', '무료 10~15분 자가 루틴', '**이완:** 우측 골반 앞/옆(TFL/장요근), 종아리, 가슴 앞쪽(소흉근)
**강화:** 발바닥 아치 만들기, 엎드려서 무릎 접기(햄스트링 컬), 왼쪽으로 꽃게 걸음(사이드 스텝)
**루틴(12~15분):** 이완 종아리 60초·우측 골반 앞쪽 60초, 스트레칭 가슴 45초, 강화 각 20초×3·10회×2·12보×2', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('daf8f295-2942-482e-aee3-befea324f761', 'CRLF', '1', '한눈에 보는 내 코드', '목: 중앙 (C) – 고개 꼿꼿
어깨: 오른쪽 높음 (R) – 우측 어깨 높음
골반: 왼쪽 회전 (L) – 좌측 골반 회전
하체: 유연 (F) – 유연형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('dc5b96ff-f9f2-48bb-808c-b4491696f749', 'CLLF', '4', '지금 주의하면 좋은 자세', '**피하면 좋은 것:** 목을 습관적으로 꺾는 스트레칭, 왼쪽으로만 기대서기(관절 손상 주의), 한쪽으로만 메는 크로스백(목 압박)', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('de5a4f7c-d755-4e8b-8f2e-d2d859d47bde', 'FLRS', '1', '한눈에 보는 내 코드', '목: 전방 (F) – 고개 앞
어깨: 왼쪽 높음 (L) – 좌측 어깨 높음
골반: 오른쪽 회전 (R) – 우측 골반 회전
하체: 경직 (S) – 강직형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('e1ec2451-0d3e-4fff-a673-c7cc10759885', 'CLLF', '2', '이해 포인트', '왼쪽에 체중을 실으면 **물침대처럼 쑥 꺼지고**, 걸을 때마다 목과 몸통이 **출렁거리며 안정을 찾지 못하는** 패턴입니다. 유연한 만큼 버티는 힘이 약해 한쪽으로 기울어지기 쉽습니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('e5e927fb-31cf-47c7-9bd3-1ffdd18154cd', 'CLLS', '5', '무료 10~15분 자가 루틴', '**이완:** 좌측 옆구리(요방형근), 좌측 목-어깨 연결부, 목 앞쪽(SCM)
**강화:** 누워서 오른쪽 발바닥 당기기(90/90), 왼쪽 날개뼈 내리기, 오른쪽 옆구리 조이기
**루틴(15분):** 이완 60초·60초·45초, 강화 8회×2·12회×2·12회×2', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('e67bdb71-a97f-4a90-b87f-13b3d05c7604', 'FLLS', '5', '무료 10~15분 자가 루틴', '**이완:** 좌측 엉덩이 깊은 곳(이상근), 좌측 허벅지 뒤쪽(햄스트링), 좌측 옆구리(요방형근)
**강화:** 오른쪽으로 꽃게 걸음(사이드 스텝), 누워서 오른쪽 발바닥 당기기(90/90), 왼쪽 Y자 들기
**루틴(12~15분):** 이완 60초·60초, 스트레칭 몸통 우측 회전 6회, 강화 12보×2·8회×2·10회×2', 5, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('eb8113b0-f6f7-4823-9edc-05bb7c6e3017', 'FRRS', '1', '한눈에 보는 내 코드', '목은 앞으로 나와 보이기 쉬운 편(F)
오른쪽 어깨가 올라가 보일 수 있음(R)
몸 중심(골반/허리 아래)이 오른쪽으로 돌아가 보일 수 있음(R)
하체는 뻣뻣·단단하게 버티는 편(S)', 1, '2026-02-24T07:41:33.073Z', '2026-02-24T07:41:33.073Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('eb8c96ec-1a07-4e1e-9c06-0506ce187c20', 'FRLS', '1', '한눈에 보는 내 코드', '목: 전방 (F) – 고개 앞
어깨: 오른쪽 높음 (R) – 우측 어깨 높음
골반: 왼쪽 회전 (L) – 좌측 골반 회전
하체: 경직 (S) – 강직형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('efdb40e1-a20b-4ccc-b87a-aa46b6f844db', 'FLLS', '4', '지금 주의하면 좋은 자세', '왼쪽으로만 짝다리 짚기(절대 고정), 소파에 앉을 때 왼쪽 엉덩이로만 앉기, 몸을 왼쪽으로 비틀며 물건 들기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('f178c35d-807c-4a90-b759-05bab64388db', 'CRLF', '3', '공감 포인트', '한 자세를 오래 유지 못 하고 꼼지락거림, 팔꿈치나 무릎을 과하게 꺾어서(Locking) 버팀, 몸통이 내 의지와 상관없이 제멋대로 돌아가는 느낌.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('f2f9793e-adfc-4a7e-8457-14b2319b5f35', 'CLLF', '3', '공감 포인트', '왼쪽 다리에 체중을 실으면 몸이 푹 꺼지는 느낌이 들 수 있습니다. 뛸 때 머리가 덜렁거려 손으로 잡고 싶고, 왼쪽 신발 끈이 자주 풀리거나 신발 혀가 돌아가는 경험이 있을 수 있습니다.', 3, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('f35e79b0-a344-46c8-abe9-41f287d68333', 'CRLS', '2', '이해 포인트', '**겉보기엔 반듯한 탑**이지만 **위아래 층이 엇갈린 채 꽉 껴 있는** 패턴입니다. 거울에선 대칭 같지만 움직이면 삐걱거립니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('f5513ee8-7b34-4b50-adc7-1b3775268f91', 'CLLS', '4', '지금 주의하면 좋은 자세', '왼손으로 턱 괴기(절대 금지), 왼쪽 다리 꼬기(절대 금지), 고개 푹 숙이고 스마트폰 보기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('f86c1029-091f-4bf4-8d93-47a90edaa7fd', 'FRRS', '0', '내 체형 코드(FRRS)에 대해서 알아보기', '당신의 체형 코드는 **FRRS**입니다. 이 코드는 4가지 축(목·어깨·골반·하체)에서의 움직임 경향을 요약한 것입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-24T07:41:33.073Z', '2026-02-24T07:41:33.073Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('f8d7e191-ce3e-49c1-bb0f-9b495e632ef5', 'CLRF', '1', '한눈에 보는 내 코드', '목: 중앙 (C) – 고개 꼿꼿
어깨: 왼쪽 높음 (L) – 좌측 어깨 높음
골반: 오른쪽 회전 (R) – 우측 골반 회전
하체: 유연 (F) – 유연형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('f98ac403-3602-4927-860d-b0a17649e477', 'FLRF', '0', '내 체형 코드(FLRF)에 대해서 알아보기', '당신의 체형 코드는 **FLRF**입니다. (리듬은 좋은데 금방 지치는 갈대)

유연해서 이리저리 잘 휘어지지만, 뿌리(코어) 힘이 약해 한 자세로 있으면 금방 지쳐서 옆으로 쓰러지기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('f9c658f6-9f9b-4176-a65a-89de87751eec', 'CLRF', '0', '내 체형 코드(CLRF)에 대해서 알아보기', '당신의 체형 코드는 **CLRF**입니다. (아슬아슬 젠가 탑)

몸이 유연하지만 블록이 비뚤게 쌓인 젠가처럼 정렬이 어긋나 있어, 언제 무너질지 모르게 아슬아슬하기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('fa133e21-c40e-4272-851c-2097d09feb9a', 'FRLS', '4', '지금 주의하면 좋은 자세', '왼쪽 다리 위로 꼬기(골반 비틀림 고정), 몸통을 한쪽으로 비틀고 앉아 노트북 보기, 몸이 비틀린 상태에서 무거운 물건 들기.', 4, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('fa3d226c-7646-45a5-b594-2664345b3f44', 'FRLF', '2', '이해 포인트', '**움직임은 크지만 딱 멈추는 ''유지''가 안 되는** 패턴입니다. 유연한 만큼 중심을 잡지 못해 골반과 어깨가 제멋대로 회전하며 흔들립니다.', 2, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('fc28a898-baa3-4e27-ba3d-3afadca76bc6', 'CLLF', '0', '내 체형 코드(CLLF)에 대해서 알아보기', '당신의 체형 코드는 **CLLF**입니다. (출렁이는 물침대)

왼쪽에 체중을 실으면 물침대처럼 쑥 꺼지고, 걸을 때마다 목과 몸통이 출렁거리며 안정을 찾지 못하기 때문입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.body_code_result_sections (id, body_code, section_key, title, content, sort_order, created_at, updated_at) VALUES ('fe5d7cf1-e181-4bc3-a82a-7c7c4045a831', 'FLLS', '1', '한눈에 보는 내 코드', '목: 전방 (F) – 고개 앞
어깨: 왼쪽 높음 (L) – 좌측 어깨 높음
골반: 왼쪽 회전 (L) – 좌측 골반 회전
하체: 경직 (S) – 강직형', 1, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, section_key = EXCLUDED.section_key, title = EXCLUDED.title, content = EXCLUDED.content, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;

-- ===== result_guide (4행) =====
INSERT INTO public.result_guide (id, body_code, title, sections, sort_order, created_at, updated_at) VALUES ('8debf5ca-6026-43f7-913c-460af0725ff6', NULL, 'mebody 자세 사용 설명서 (공통)', '[{"title":"핵심 원칙","content":"완벽한 자세보다 중요한 건, 나쁜 자세를 안 하는 것이 아니라 **오래 머무르지 않는 것**입니다. 우리는 로봇이 아니기 때문에 자세가 흐트러질 수 있습니다. 괜찮습니다. 중요한 건 \"지금 내가 이렇게 앉아/서 있구나\" 하고 알아차리는 것입니다. 같은 자세를 오래 반복하면 몸의 조직이 늘어난 상태로 굳어질 수 있어요. (= 크리프 Creep 현상)"},{"title":"MEBODY 50% Rule","content":"**알아차리기** – 무의식 자세를 인식하기\n**절반으로 줄이기** – 예: 다리 꼬기 10번 → 5번\n**반대 방향으로 환기하기** – 잠깐 일어나기 / 반대로 움직이기"},{"title":"줄여야 할 4가지 습관","content":"**1) 다리 꼬기** – 꼬아도 괜찮지만 오래 유지하지 않기 (예: 5분 안에 풀기)\n**2) 짝다리** – 한쪽 다리에만 기대지 말고, 가끔 양발에 체중 나누기\n**3) 한쪽 가방 메기** – 가능하면 백팩, 아니면 번갈아 메기\n**4) 고개 숙여 스마트폰 보기** – 핸드폰을 눈높이 쪽으로 올리고, 고개는 덜 숙이기"},{"title":"오늘의 목표","content":"\"나쁜 자세를 없애기\"가 아니라, \"나쁜 자세에 머무는 시간을 줄이기\""}]'::jsonb, 0, '2026-02-24T02:13:41.241Z', '2026-02-24T02:13:41.241Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, title = EXCLUDED.title, sections = EXCLUDED.sections, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.result_guide (id, body_code, title, sections, sort_order, created_at, updated_at) VALUES ('a9ec6202-eb42-4a77-ae56-249c7090288a', 'FRRS', 'FRRS 맞춤 자세 가이드', '[{"title":"이 체형에게 추천","content":"목을 중앙에 두는 습관을 **50% Rule**로 줄여보세요."},{"title":"주의할 점","content":"한 자세를 오래 유지하지 마세요."}]'::jsonb, 0, '2026-02-25T08:45:06.004Z', '2026-02-25T08:45:06.004Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, title = EXCLUDED.title, sections = EXCLUDED.sections, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.result_guide (id, body_code, title, sections, sort_order, created_at, updated_at) VALUES ('d6958a2a-b45a-46c9-ba34-b61ee9373e0c', 'FRRS', 'FRRS 맞춤 자세 가이드', '[{"title":"이 체형에게 추천","content":"목을 중앙에 두는 습관을 **50% Rule**로 줄여보세요."},{"title":"주의할 점","content":"한 자세를 오래 유지하지 마세요."}]'::jsonb, 0, '2026-02-24T07:41:33.073Z', '2026-02-24T07:41:33.073Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, title = EXCLUDED.title, sections = EXCLUDED.sections, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.result_guide (id, body_code, title, sections, sort_order, created_at, updated_at) VALUES ('d969b07c-5cca-4e5d-8043-397f276acad7', 'FRRS', 'FRRS 맞춤 자세 가이드', '[{"title":"이 체형에게 추천","content":"목을 중앙에 두는 습관을 **50% Rule**로 줄여보세요."},{"title":"주의할 점","content":"한 자세를 오래 유지하지 마세요."}]'::jsonb, 0, '2026-02-24T02:13:41.241Z', '2026-02-24T02:13:41.241Z')
  ON CONFLICT (id) DO UPDATE SET body_code = EXCLUDED.body_code, title = EXCLUDED.title, sections = EXCLUDED.sections, sort_order = EXCLUDED.sort_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;

-- ===== app_content (1행) =====
INSERT INTO public.app_content (id, key, value_text, value_json, created_at, updated_at) VALUES ('3b51bd53-e36f-42b7-b481-2b0c00794606', 'advanced_tag_followups', NULL, '{"sitting-driven":{"title":"앉는 생활 영향","questions":[{"order":1,"option_1":"① 예","option_2":"② 보통 / 모르겠다","option_3":"③ 아니오","question":"하루 4시간 이상 연속으로 앉아있나요?"},{"order":2,"option_1":"① 예","option_2":"② 보통 / 모르겠다","option_3":"③ 아니오","question":"앉아서 모니터나 책을 볼 때 고개를 푹 숙이는 패턴을 오래 유지하나요?"},{"order":3,"option_1":"① 예","option_2":"② 보통 / 모르겠다","option_3":"③ 아니오","question":"일주일에 땀이 날 정도의 하체/코어 운동을 1회 미만으로 하시나요?"}]}}'::jsonb, '2026-03-09T06:03:39.804Z', '2026-03-09T06:03:39.804Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, value_text = EXCLUDED.value_text, value_json = EXCLUDED.value_json, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;

-- ===== app_images (21행) =====
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('0e3d3030-3f27-4426-9b8b-b8044a5e2ffa', 'axis_flexibility', '/axis-icons/axis-flexibility.png', '4축 하체 아이콘', '2026-02-24T02:13:41.241Z', '2026-02-24T02:13:41.241Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('1c2a1eb7-e548-4064-a1dc-cf8b83ea8cea', 'character_CLRF', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/CLRF.png', 'CLRF 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('1ceed965-2af4-4e52-a54d-8db948b92734', 'character_FLLF', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/FLLF.png', 'FLLF 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('28ac6435-09bb-448d-bd22-079e3c6d7059', 'axis_shoulder', '/axis-icons/axis-shoulder.png', '2축 어깨 아이콘', '2026-02-24T02:13:41.241Z', '2026-02-24T02:13:41.241Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('32cf20a0-f779-4850-b08c-f416285a108a', 'character_FRLS', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/FRLS.png', 'FRLS 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('3c5b147a-a91a-4014-9f07-708dff72117e', 'character_CRLF', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/CRLF.png', 'CRLF 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('432fdd0d-60d0-4544-a992-f09ad8325e04', 'character_CLLF', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/CLLF.png', 'CLLF 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('578a2de4-fb88-4636-9253-9e5981677ec8', 'character_CLRS', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/CLRS.png', 'CLRS 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('5c20285f-c052-45e2-8ef4-e5f0eae29491', 'character_CRRF', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/CRRF.png', 'CRRF 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('6079f932-5e2d-4d81-8725-e7bc4a194090', 'character_CLLS', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/CLLS.png', 'CLLS 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('74700639-da78-43d0-a112-a89b935e85cb', 'character_FRRS', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/FRRS.png', 'FRRS 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('7540498b-1cf3-46aa-b65f-857d41e4a427', 'character_FRRF', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/FRRF.png', 'FRRF 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('7daf2fa8-7c43-494d-a88d-67a39c1b90cd', 'character_FRLF', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/FRLF.png', 'FRLF 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('84c6a86f-cf11-468f-a5ff-e695151d6bc8', 'axis_neck', '/axis-icons/axis-neck.png', '1축 목 아이콘', '2026-02-24T02:13:41.241Z', '2026-02-24T02:13:41.241Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('90f06824-fa9e-4dd3-8089-bdbe22073dbc', 'character_CRRS', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/CRRS.png', 'CRRS 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('a438a7bb-2866-4177-887a-5d905e3dc060', 'body_types_image', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/body-types/bodyTypesImage.png', '16가지 체형 한눈에 보기', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('bc92a43c-8534-4558-ac7a-cb5b0c459cea', 'character_FLLS', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/FLLS.png', 'FLLS 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('be4d5f4e-d290-428e-b500-94b583afd194', 'character_CRLS', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/CRLS.png', 'CRLS 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('c44f5cd4-0484-4a3e-82b5-6f15a08996d7', 'character_FLRF', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/FLRF.png', 'FLRF 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('cc6f8f85-c5af-4ea0-bd2d-bb539c289dcd', 'axis_pelvis', '/axis-icons/axis-pelvis.png', '3축 골반 아이콘', '2026-02-24T02:13:41.241Z', '2026-02-24T02:13:41.241Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.app_images (id, key, url, description, created_at, updated_at) VALUES ('e7a6e9ee-b90d-4b33-80df-1bf31e62b97a', 'character_FLRS', 'https://ubylshiqilznifpmbkyu.supabase.co/storage/v1/object/public/images/characters/FLRS.png', 'FLRS 캐릭터', '2026-02-24T02:13:41.241Z', '2026-03-05T05:07:16.833Z')
  ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, url = EXCLUDED.url, description = EXCLUDED.description, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;

-- ===== immediate_action_content (23행) =====
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_001', 'neck_right', 'body_part', '목 근육 관리', '상부승모근', 'right', '오른쪽 목-어깨 연결부 이완', '1. 편하게 앉는다 / 2. 고개를 왼쪽으로 기울인다 / 3. 고개를 오른쪽으로 살짝 돌린다 / 4. 왼손 손바닥이나 손가락으로 단단한 부위를 부드럽게 문지른다', '손', 90, '오른쪽 목-어깨 연결부 스트레칭', '1. 오른손을 오른쪽 엉덩이 밑에 넣고 앉는다(어깨 고정) / 2. 왼손으로 머리 오른쪽 뒤쪽을 잡는다 / 3. 고개를 왼쪽 대각선 아래로 천천히 숙인다', 30, 3, '저림이나 찌릿한 느낌 오면 즉시 중단', 1, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_002', 'neck_left', 'body_part', '목 근육 관리', '상부승모근', 'left', '왼쪽 목-어깨 연결부 이완', '1. 편하게 앉는다 / 2. 고개를 오른쪽으로 기울인다 / 3. 고개를 왼쪽으로 살짝 돌린다 / 4. 오른손 손바닥이나 손가락으로 단단한 부위를 부드럽게 문지른다', '손', 90, '왼쪽 목-어깨 연결부 스트레칭', '1. 왼손을 왼쪽 엉덩이 밑에 넣고 앉는다(어깨 고정) / 2. 오른손으로 머리 왼쪽 뒤쪽을 잡는다 / 3. 고개를 오른쪽 대각선 아래로 천천히 숙인다', 30, 3, '저림이나 찌릿한 느낌 오면 즉시 중단', 2, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_003', 'shoulder_right', 'body_part', '어깨 근육 관리', '대원근/광배근', 'right', '오른쪽 겨드랑이 뒤쪽 이완', '1. 오른쪽을 아래로 옆으로 눕는다 / 2. 오른팔을 머리 위로 쭉 뻗어 겨드랑이를 연다 / 3. 폼롤러를 오른쪽 겨드랑이 뒤쪽(팔과 날개뼈 사이)에 둔다 / 4. 단단한 부위를 찾아 멈춘다', '폼롤러/마사지볼', 90, '오른팔 위로 올려 당기기', '1. 서거나 앉은 자세에서 오른팔을 머리 위로 올려 팔꿈치를 굽힌다 / 2. 왼손으로 오른쪽 손목을 잡는다 / 3. 오른팔을 왼쪽 위 방향으로 끌어당기며 상체도 왼쪽으로 살짝 기울인다', 30, 3, '어깨 관절에서 날카로운 통증 시 즉시 중단', 3, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_004', 'shoulder_left', 'body_part', '어깨 근육 관리', '대원근/광배근', 'left', '왼쪽 겨드랑이 뒤쪽 이완', '1. 왼쪽을 아래로 옆으로 눕는다 / 2. 왼팔을 머리 위로 쭉 뻗어 겨드랑이를 연다 / 3. 폼롤러를 왼쪽 겨드랑이 뒤쪽(팔과 날개뼈 사이)에 둔다 / 4. 단단한 부위를 찾아 멈춘다', '폼롤러/마사지볼', 90, '왼팔 위로 올려 당기기', '1. 서거나 앉은 자세에서 왼팔을 머리 위로 올려 팔꿈치를 굽힌다 / 2. 오른손으로 왼쪽 손목을 잡는다 / 3. 왼팔을 오른쪽 위 방향으로 끌어당기며 상체도 오른쪽으로 살짝 기울인다', 30, 3, '어깨 관절에서 날카로운 통증 시 즉시 중단', 4, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_005', 'back_both', 'body_part', '등 근육 관리', '기립근', 'both', '등 기립근 폼롤러 이완', '1. 바닥에 등 대고 눕고 무릎을 세운다 / 2. 폼롤러를 날개뼈 아래쪽 등에 둔다 / 3. 양손을 머리 뒤에 받치고 천천히 위아래로 굴린다 / 4. 단단한 지점에서 멈춰 머문다 (흉추까지만 / 요추 직접 압박 금지)', '폼롤러', 90, '흉요추 굴곡+신전 순환', '[굴곡] 1. 바닥에 누워 무릎 세우기 / 2. 숨을 내쉬며 등을 바닥에 누르듯 말기 → 5초 유지 / [신전] 3. 숨을 들이쉬며 흉추를 위로 들어 올리듯 활처럼 펴기 → 5초 유지 (요추5번 과신전 금지 / 흉추 신전 강조 / 복직근 상부 당김 느낌 목표)', 30, 3, '허리(요추)를 꺾는 느낌이 아닌 등(흉추)을 여는 느낌으로 / 요추 직접 폼롤러 금지', 5, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_006', 'waist_right', 'body_part', '허리 근육 관리', '요방형근', 'right', '오른쪽 요방형근 이완', '1. 바닥에 눕거나 벽에 기댄다 / 2. 마사지볼을 오른쪽 허리 옆구리 뒤쪽에 둔다(척추뼈 바로 위 금지) / 3. 오른쪽 갈비뼈 아래~골반 위 사이 단단한 부위를 찾는다 / 4. 천천히 체중을 싣는다', '마사지볼', 90, '오른쪽 옆구리 늘리기', '1. 의자에 앉거나 선다 / 2. 오른팔을 머리 위로 올린다 / 3. 상체를 왼쪽으로 천천히 기울인다 / 4. 왼손으로 의자 옆이나 허벅지를 잡아 고정하면 더 효과적', 30, 3, '척추뼈 직접 압박 금지 / 너무 강하게 누르지 않기(신장 위치)', 6, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_007', 'waist_left', 'body_part', '허리 근육 관리', '요방형근', 'left', '왼쪽 요방형근 이완', '1. 바닥에 눕거나 벽에 기댄다 / 2. 마사지볼을 왼쪽 허리 옆구리 뒤쪽에 둔다(척추뼈 바로 위 금지) / 3. 왼쪽 갈비뼈 아래~골반 위 사이 단단한 부위를 찾는다 / 4. 천천히 체중을 싣는다', '마사지볼', 90, '왼쪽 옆구리 늘리기', '1. 의자에 앉거나 선다 / 2. 왼팔을 머리 위로 올린다 / 3. 상체를 오른쪽으로 천천히 기울인다 / 4. 오른손으로 의자 옆이나 허벅지를 잡아 고정', 30, 3, '척추뼈 직접 압박 금지 / 너무 강하게 누르지 않기(신장 위치)', 7, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_008', 'pelvis_right', 'body_part', '골반 근육 관리', '둔근', 'right', '오른쪽 둔근 이완', '1. 폼롤러 위에 오른쪽 엉덩이를 올리고 앉는다 / 2. 오른쪽 엉덩이 바깥쪽·중앙·깊은 곳을 조금씩 탐색한다 / 3. 단단하거나 묵직한 지점에서 멈추고 천천히 체중을 싣는다', '폼롤러/마사지볼', 90, '오른쪽 둔근 스트레칭', '1. 의자에 앉아 오른쪽 발목을 왼쪽 무릎 위에 올린다(숫자 4 모양) / 2. 등을 세운 상태를 유지한다(허리 둥글게 말지 않기) / 3. 상체를 앞으로 살짝 숙인다 / 4. 오른손을 오른쪽 무릎에 올려 지그시 누른다', 30, 3, '꼬리뼈 직접 압박 금지 / 다리 저림 오면 위치 이동', 8, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_009', 'pelvis_left', 'body_part', '골반 근육 관리', '둔근', 'left', '왼쪽 둔근 이완', '1. 폼롤러 위에 왼쪽 엉덩이를 올리고 앉는다 / 2. 왼쪽 엉덩이 바깥쪽·중앙·깊은 곳을 조금씩 탐색한다 / 3. 단단하거나 묵직한 지점에서 멈추고 천천히 체중을 싣는다', '폼롤러/마사지볼', 90, '왼쪽 둔근 스트레칭', '1. 의자에 앉아 왼쪽 발목을 오른쪽 무릎 위에 올린다(숫자 4 모양) / 2. 등을 세운 상태를 유지한다 / 3. 상체를 앞으로 살짝 숙인다 / 4. 왼손을 왼쪽 무릎에 올려 지그시 누른다', 30, 3, '꼬리뼈 직접 압박 금지 / 다리 저림 오면 위치 이동', 9, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_010', 'knee_right', 'body_part', '무릎 근육 관리', '대퇴사두근/햄스트링', 'right', '오른쪽 대퇴사두근/햄스트링 이완', '1. 오른쪽 허벅지 앞쪽은 손/팔꿈치/폼롤러로 위쪽부터 무릎 위까지 부드럽게 풀어준다 / 2. 오른쪽 허벅지 뒤쪽은 폼롤러나 마사지볼을 두고 엉덩이 아래부터 무릎 위까지 천천히 굴린다 / 3. 단단한 지점에서 멈춰 호흡한다', '손/폼롤러/마사지볼', 90, '오른쪽 대퇴사두근/햄스트링 스트레칭', '1. 대퇴사두근: 벽이나 의자를 잡고 오른쪽 발등/발목을 잡아 허벅지 앞쪽을 늘린다 / 2. 햄스트링: 의자에 앉아 오른쪽 다리를 앞으로 뻗고 등을 세운 채 상체를 숙인다 / 3. 당김은 편안한 범위에서 유지한다', 30, 3, '무릎 앞/뒤를 직접 강하게 압박하지 않기 / 허리를 과하게 꺾거나 둥글게 말지 않기', 10, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_011', 'knee_left', 'body_part', '무릎 근육 관리', '대퇴사두근/햄스트링', 'left', '왼쪽 대퇴사두근/햄스트링 이완', '1. 왼쪽 허벅지 앞쪽은 손/팔꿈치/폼롤러로 위쪽부터 무릎 위까지 부드럽게 풀어준다 / 2. 왼쪽 허벅지 뒤쪽은 폼롤러나 마사지볼을 두고 엉덩이 아래부터 무릎 위까지 천천히 굴린다 / 3. 단단한 지점에서 멈춰 호흡한다', '손/폼롤러/마사지볼', 90, '왼쪽 대퇴사두근/햄스트링 스트레칭', '1. 대퇴사두근: 벽이나 의자를 잡고 왼쪽 발등/발목을 잡아 허벅지 앞쪽을 늘린다 / 2. 햄스트링: 의자에 앉아 왼쪽 다리를 앞으로 뻗고 등을 세운 채 상체를 숙인다 / 3. 당김은 편안한 범위에서 유지한다', 30, 3, '무릎 앞/뒤를 직접 강하게 압박하지 않기 / 허리를 과하게 꺾거나 둥글게 말지 않기', 11, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_012', 'ankle_right', 'body_part', '발목 근육 관리', '종아리(비복근/가자미근)', 'right', '오른쪽 종아리 이완', '1. 의자에 앉아 오른쪽 다리를 왼쪽 무릎 위에 올린다 / 2. 양손 엄지로 오른쪽 종아리 전체를 위에서 아래로 눌러 내려간다 / 3. 가장 단단한 지점에서 멈춘다', '손/폼롤러', 90, '오른쪽 종아리 스트레칭(비복근)', '1. 벽 앞에 서서 오른쪽 다리를 뒤로 한 걸음 뺀다 / 2. 오른쪽 무릎을 편 채 오른쪽 뒤꿈치를 바닥에 고정한다 / 3. 왼쪽 무릎을 살짝 굽히며 몸을 앞으로 보낸다', 30, 3, '정강이뼈 옆이 아닌 종아리 뒤쪽이 타겟 / 발목 안팎으로 틀지 말기', 12, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_013', 'ankle_left', 'body_part', '발목 근육 관리', '종아리(비복근/가자미근)', 'left', '왼쪽 종아리 이완', '1. 의자에 앉아 왼쪽 다리를 오른쪽 무릎 위에 올린다 / 2. 양손 엄지로 왼쪽 종아리 전체를 위에서 아래로 눌러 내려간다 / 3. 가장 단단한 지점에서 멈춘다', '손/폼롤러', 90, '왼쪽 종아리 스트레칭(비복근)', '1. 벽 앞에 서서 왼쪽 다리를 뒤로 한 걸음 뺀다 / 2. 왼쪽 무릎을 편 채 왼쪽 뒤꿈치를 바닥에 고정한다 / 3. 오른쪽 무릎을 살짝 굽히며 몸을 앞으로 보낸다', 30, 3, '정강이뼈 옆이 아닌 종아리 뒤쪽이 타겟 / 발목 안팎으로 틀지 말기', 13, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_014', 'foot_right', 'body_part', '발바닥 근육 관리', '족저근막', 'right', '오른쪽 발바닥 이완', '1. 의자에 앉아 오른발 아래 마사지볼을 놓는다 / 2. 발가락 아래 → 발바닥 중앙 → 뒤꿈치 앞쪽 순서로 천천히 굴린다 / 3. 가장 단단하고 뻐근한 지점에서 멈춘다', '마사지볼/테니스볼', 90, '오른쪽 발바닥 스트레칭', '1. 의자에 앉아 오른발을 왼쪽 무릎 위에 올린다 / 2. 왼손으로 오른쪽 뒤꿈치를 잡아 고정한다 / 3. 오른손으로 오른쪽 발가락 전체를 잡고 몸쪽으로 천천히 젖힌다', 30, 3, '뒤꿈치 뼈 직접 압박 피하기 / 선 자세에서 하면 강도 세짐 주의', 14, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_015', 'foot_left', 'body_part', '발바닥 근육 관리', '족저근막', 'left', '왼쪽 발바닥 이완', '1. 의자에 앉아 왼발 아래 마사지볼을 놓는다 / 2. 발가락 아래 → 발바닥 중앙 → 뒤꿈치 앞쪽 순서로 천천히 굴린다 / 3. 가장 단단하고 뻐근한 지점에서 멈춘다', '마사지볼/테니스볼', 90, '왼쪽 발바닥 스트레칭', '1. 의자에 앉아 왼발을 오른쪽 무릎 위에 올린다 / 2. 오른손으로 왼쪽 뒤꿈치를 잡아 고정한다 / 3. 왼손으로 왼쪽 발가락 전체를 잡고 몸쪽으로 천천히 젖힌다', 30, 3, '뒤꿈치 뼈 직접 압박 피하기 / 선 자세에서 하면 강도 세짐 주의', 15, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_016', 'axis_1F', 'axis', '목 앞쪽 경향 관리', '흉쇄유돌근', 'both', '흉쇄유돌근 이완(양쪽)', '1. 편하게 앉는다 / 2. 고개를 왼쪽으로 살짝 기울이고 오른쪽으로 살짝 돌린다 / 3. 오른쪽 귀 아래~쇄골 연결 근육을 엄지와 검지로 부드럽게 잡는다 / 4. 살살 문지른다 / 5. 반대쪽도 동일하게 진행', '손', 90, '흉쇄유돌근 스트레칭(양쪽)', '1. 왼손을 오른쪽 쇄골 위에 올리고 오른손으로 위를 살짝 눌러 고정한다 / 2. 고개를 왼쪽으로 기울이고 오른쪽으로 살짝 돌린다 / 3. 오른쪽 목 앞쪽이 당기면 유지한다 / 4. 반대쪽도 동일하게 진행', 30, 3, '맥박 뛰는 목 앞쪽 혈관 강하게 누르지 않기 / 어지러움 느껴지면 즉시 중단', 16, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_017', 'axis_1C', 'axis', '목 중립 경향 관리', '상부승모근', 'both', '상부승모근 이완(양쪽)', '1. 편하게 앉는다 / 2. 고개를 왼쪽으로 기울이고 오른쪽으로 살짝 돌린다 / 3. 왼손으로 오른쪽 목-어깨 사이 단단한 부위를 부드럽게 문지른다 / 4. 반대쪽도 동일하게 진행', '손', 90, '상부승모근 스트레칭(양쪽)', '1. 오른손을 오른쪽 엉덩이 밑에 넣고 앉는다 / 2. 왼손으로 머리 오른쪽 뒤쪽을 잡는다 / 3. 고개를 왼쪽 대각선 아래로 천천히 숙인다 / 4. 반대쪽도 동일하게 진행', 30, 3, '저림이나 찌릿한 느낌 오면 즉시 중단', 17, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_018', 'axis_2R', 'axis', '오른쪽 어깨 높음 관리', '대원근/광배근', 'right', '오른쪽 대원근/광배근 이완', '1. 오른쪽을 아래로 옆으로 눕는다 / 2. 오른팔을 머리 위로 뻗어 겨드랑이를 연다 / 3. 폼롤러를 오른쪽 겨드랑이 뒤쪽(팔과 날개뼈 사이)에 둔다 / 4. 단단한 지점에서 멈춘다', '폼롤러/마사지볼', 90, '오른쪽 대원근/광배근 스트레칭', '1. 오른팔을 머리 위로 올려 팔꿈치를 굽힌다 / 2. 왼손으로 오른쪽 손목을 잡는다 / 3. 오른팔을 왼쪽 위 방향으로 당기며 상체도 왼쪽으로 살짝 기울인다', 30, 3, '겨드랑이 앞쪽 혈관/신경 부위는 피하기 / 날카로운 통증 시 중단', 18, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_019', 'axis_2L', 'axis', '왼쪽 어깨 높음 관리', '대원근/광배근', 'left', '왼쪽 대원근/광배근 이완', '1. 왼쪽을 아래로 옆으로 눕는다 / 2. 왼팔을 머리 위로 뻗어 겨드랑이를 연다 / 3. 폼롤러를 왼쪽 겨드랑이 뒤쪽(팔과 날개뼈 사이)에 둔다 / 4. 단단한 지점에서 멈춘다', '폼롤러/마사지볼', 90, '왼쪽 대원근/광배근 스트레칭', '1. 왼팔을 머리 위로 올려 팔꿈치를 굽힌다 / 2. 오른손으로 왼쪽 손목을 잡는다 / 3. 왼팔을 오른쪽 위 방향으로 당기며 상체도 오른쪽으로 살짝 기울인다', 30, 3, '겨드랑이 앞쪽 혈관/신경 부위는 피하기 / 날카로운 통증 시 중단', 19, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_020', 'axis_3R', 'axis', '골반 오른쪽 회전 관리', '둔근(양쪽)', 'both', '둔근 이완(양쪽/오른쪽 먼저)', '1. 폼롤러 위에 오른쪽 엉덩이를 올리고 앉는다 / 2. 단단한 지점에서 10초 → 왼쪽으로 이동 / 3. 양쪽 모두 진행', '폼롤러/마사지볼', 90, '상체 오른쪽 회전 스트레칭', '1. 의자에 바르게 앉아 양발을 바닥에 고정한다 / 2. 양손으로 의자 오른쪽을 잡는다 / 3. 숨을 내쉬며 가슴 전체를 오른쪽으로 천천히 돌린다 / 4. 10초 유지 후 정면으로 돌아온다 / 5. 6회 반복', 30, 3, '골반은 정면 고정 / 가슴만 돌리는 느낌으로', 20, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_021', 'axis_3L', 'axis', '골반 왼쪽 회전 관리', '둔근(양쪽)', 'both', '둔근 이완(양쪽/왼쪽 먼저)', '1. 폼롤러 위에 왼쪽 엉덩이를 올리고 앉는다 / 2. 단단한 지점에서 10초 → 오른쪽으로 이동 / 3. 양쪽 모두 진행', '폼롤러/마사지볼', 90, '상체 왼쪽 회전 스트레칭', '1. 의자에 바르게 앉아 양발을 바닥에 고정한다 / 2. 양손으로 의자 왼쪽을 잡는다 / 3. 숨을 내쉬며 가슴 전체를 왼쪽으로 천천히 돌린다 / 4. 10초 유지 후 정면으로 돌아온다 / 5. 6회 반복', 30, 3, '골반은 정면 고정 / 가슴만 돌리는 느낌으로', 21, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_022', 'axis_4S', 'axis', '하체 뻣뻣 경향 관리', '햄스트링/대퇴사두근', 'both', '햄스트링 이완(양쪽)', '1. 바닥에 앉아 한쪽 허벅지 뒤 아래에 폼롤러를 둔다 / 2. 양손을 뒤쪽 바닥에 짚어 몸을 살짝 든다 / 3. 엉덩이 아래~무릎 위쪽까지 천천히 굴린다 / 4. 양쪽 모두 진행', '폼롤러', 90, '대퇴사두근 스트레칭(양쪽)', '1. 한 손으로 벽이나 의자를 잡고 선다 / 2. 반대 손으로 발등이나 발목을 잡는다 / 3. 무릎을 굽혀 발뒤꿈치를 엉덩이 쪽으로 당긴다 / 4. 양쪽 모두 진행', 30, 3, '무릎 뒤 오금 직접 강하게 압박 금지 / 허리 꺾임 주의', 22, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order, updated_at) VALUES ('AC_023', 'axis_4F', 'axis', '하체 유연 경향 관리', '햄스트링/대퇴사두근', 'both', '허벅지 전체 가볍게 이완(양쪽)', '1. 의자에 앉는다 / 2. 양손으로 허벅지를 위에서 아래로 가볍게 주무른다 / 3. 앞쪽 → 옆쪽 → 뒤쪽 순서로 전체적으로 풀어주는 느낌 / 4. 양쪽 모두 진행', '손', 90, '의자 앉아 무릎 들기(활성화)', '1. 의자에 바르게 앉아 양발 바닥에 고정한다 / 2. 한쪽 무릎을 천천히 10cm 들어 올린다 / 3. 3초 유지 후 천천히 내린다 / 4. 양쪽 번갈아 진행 / 10회×2세트', 30, 3, '빠르게 하지 말고 천천히 근육에 집중하며 진행', 23, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (id) DO UPDATE SET content_key = EXCLUDED.content_key, category_type = EXCLUDED.category_type, display_name = EXCLUDED.display_name, target_muscle = EXCLUDED.target_muscle, direction = EXCLUDED.direction, release_title = EXCLUDED.release_title, release_content = EXCLUDED.release_content, release_tool = EXCLUDED.release_tool, release_duration_sec = EXCLUDED.release_duration_sec, stretch_title = EXCLUDED.stretch_title, stretch_content = EXCLUDED.stretch_content, stretch_duration_sec = EXCLUDED.stretch_duration_sec, sets = EXCLUDED.sets, caution = EXCLUDED.caution, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at;

-- ===== immediate_action_axis_mapping (8행) =====
INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('AM_001', 1, 'neck', 'F', '목 앞 / 거북목', 'axis_1_percent', 'axis_1F', 'axis_1F', '목 앞쪽 경향 관리', 'axis', '흉쇄유돌근 양쪽 콘텐츠 호출', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (axis_mapping_id) DO UPDATE SET axis_no = EXCLUDED.axis_no, axis_key = EXCLUDED.axis_key, direction_key = EXCLUDED.direction_key, direction_label = EXCLUDED.direction_label, percentage_source = EXCLUDED.percentage_source, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('AM_002', 1, 'neck', 'C', '목 중립 / 일자목', 'axis_1_percent', 'axis_1C', 'axis_1C', '목 중립 경향 관리', 'axis', '상부승모근 양쪽 콘텐츠 호출', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (axis_mapping_id) DO UPDATE SET axis_no = EXCLUDED.axis_no, axis_key = EXCLUDED.axis_key, direction_key = EXCLUDED.direction_key, direction_label = EXCLUDED.direction_label, percentage_source = EXCLUDED.percentage_source, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('AM_003', 2, 'shoulder', 'R', '오른쪽 어깨 높음', 'axis_2_percent', 'axis_2R', 'axis_2R', '오른쪽 어깨 높음 관리', 'axis', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (axis_mapping_id) DO UPDATE SET axis_no = EXCLUDED.axis_no, axis_key = EXCLUDED.axis_key, direction_key = EXCLUDED.direction_key, direction_label = EXCLUDED.direction_label, percentage_source = EXCLUDED.percentage_source, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('AM_004', 2, 'shoulder', 'L', '왼쪽 어깨 높음', 'axis_2_percent', 'axis_2L', 'axis_2L', '왼쪽 어깨 높음 관리', 'axis', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (axis_mapping_id) DO UPDATE SET axis_no = EXCLUDED.axis_no, axis_key = EXCLUDED.axis_key, direction_key = EXCLUDED.direction_key, direction_label = EXCLUDED.direction_label, percentage_source = EXCLUDED.percentage_source, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('AM_005', 3, 'pelvis', 'R', '골반 오른쪽 회전', 'axis_3_percent', 'axis_3R', 'axis_3R', '골반 오른쪽 회전 관리', 'axis', '양쪽 둔근 이완 + 상체 오른쪽 회전 스트레칭', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (axis_mapping_id) DO UPDATE SET axis_no = EXCLUDED.axis_no, axis_key = EXCLUDED.axis_key, direction_key = EXCLUDED.direction_key, direction_label = EXCLUDED.direction_label, percentage_source = EXCLUDED.percentage_source, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('AM_006', 3, 'pelvis', 'L', '골반 왼쪽 회전', 'axis_3_percent', 'axis_3L', 'axis_3L', '골반 왼쪽 회전 관리', 'axis', '양쪽 둔근 이완 + 상체 왼쪽 회전 스트레칭', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (axis_mapping_id) DO UPDATE SET axis_no = EXCLUDED.axis_no, axis_key = EXCLUDED.axis_key, direction_key = EXCLUDED.direction_key, direction_label = EXCLUDED.direction_label, percentage_source = EXCLUDED.percentage_source, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('AM_007', 4, 'lower', 'S', '하체 뻣뻣', 'axis_4_percent', 'axis_4S', 'axis_4S', '하체 뻣뻣 경향 관리', 'axis', '햄스트링/대퇴사두근 이완 + 스트레칭', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (axis_mapping_id) DO UPDATE SET axis_no = EXCLUDED.axis_no, axis_key = EXCLUDED.axis_key, direction_key = EXCLUDED.direction_key, direction_label = EXCLUDED.direction_label, percentage_source = EXCLUDED.percentage_source, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('AM_008', 4, 'lower', 'F', '하체 유연', 'axis_4_percent', 'axis_4F', 'axis_4F', '하체 유연 경향 관리', 'axis', '과한 스트레칭보다 가벼운 이완 + 안정화 안내 문구 권장', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (axis_mapping_id) DO UPDATE SET axis_no = EXCLUDED.axis_no, axis_key = EXCLUDED.axis_key, direction_key = EXCLUDED.direction_key, direction_label = EXCLUDED.direction_label, percentage_source = EXCLUDED.percentage_source, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;

-- ===== immediate_action_discomfort_mapping (32행) =====
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_001', 'neck', '목', 'right', '오른쪽', 'neck_right', 'neck_right', '오른쪽 목 근육 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_002', 'neck', '목', 'left', '왼쪽', 'neck_left', 'neck_left', '왼쪽 목 근육 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_003', 'neck', '목', 'both', '양쪽', 'neck_right|neck_left', 'neck_right|neck_left', '양쪽 목 근육 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_004', 'neck', '목', 'unknown', '양쪽', 'neck_right|neck_left', 'neck_right|neck_left', '양쪽 목 근육 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_005', 'shoulder', '어깨', 'right', '오른쪽', 'shoulder_right', 'shoulder_right', '오른쪽 어깨 근육 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_006', 'shoulder', '어깨', 'left', '왼쪽', 'shoulder_left', 'shoulder_left', '왼쪽 어깨 근육 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_007', 'shoulder', '어깨', 'both', '양쪽', 'shoulder_right|shoulder_left', 'shoulder_right|shoulder_left', '양쪽 어깨 근육 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_008', 'shoulder', '어깨', 'unknown', '양쪽', 'shoulder_right|shoulder_left', 'shoulder_right|shoulder_left', '양쪽 어깨 근육 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_009', 'upper_back', '등 상부', 'right', '오른쪽', 'back_both', 'back_both', '오른쪽 등 상부 근육 관리', 'discomfort', '현재 콘텐츠가 양쪽 공통으로 1개만 존재', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_010', 'upper_back', '등 상부', 'left', '왼쪽', 'back_both', 'back_both', '왼쪽 등 상부 근육 관리', 'discomfort', '현재 콘텐츠가 양쪽 공통으로 1개만 존재', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_011', 'upper_back', '등 상부', 'both', '양쪽', 'back_both', 'back_both', '양쪽 등 상부 근육 관리', 'discomfort', '현재 콘텐츠가 양쪽 공통으로 1개만 존재', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_012', 'upper_back', '등 상부', 'unknown', '양쪽', 'back_both', 'back_both', '양쪽 등 상부 근육 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_013', 'waist', '허리', 'right', '오른쪽', 'waist_right', 'waist_right', '오른쪽 허리 근육 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_014', 'waist', '허리', 'left', '왼쪽', 'waist_left', 'waist_left', '왼쪽 허리 근육 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_015', 'waist', '허리', 'both', '양쪽', 'waist_right|waist_left', 'waist_right|waist_left', '양쪽 허리 근육 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_016', 'waist', '허리', 'unknown', '양쪽', 'waist_right|waist_left', 'waist_right|waist_left', '양쪽 허리 근육 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_017', 'pelvis', '골반·엉덩이', 'right', '오른쪽', 'pelvis_right', 'pelvis_right', '오른쪽 골반·엉덩이 근육 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_018', 'pelvis', '골반·엉덩이', 'left', '왼쪽', 'pelvis_left', 'pelvis_left', '왼쪽 골반·엉덩이 근육 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_019', 'pelvis', '골반·엉덩이', 'both', '양쪽', 'pelvis_right|pelvis_left', 'pelvis_right|pelvis_left', '양쪽 골반·엉덩이 근육 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_020', 'pelvis', '골반·엉덩이', 'unknown', '양쪽', 'pelvis_right|pelvis_left', 'pelvis_right|pelvis_left', '양쪽 골반·엉덩이 근육 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_021', 'knee', '무릎', 'right', '오른쪽', 'knee_right', 'knee_right', '오른쪽 무릎 주변 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_022', 'knee', '무릎', 'left', '왼쪽', 'knee_left', 'knee_left', '왼쪽 무릎 주변 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_023', 'knee', '무릎', 'both', '양쪽', 'knee_right|knee_left', 'knee_right|knee_left', '양쪽 무릎 주변 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_024', 'knee', '무릎', 'unknown', '양쪽', 'knee_right|knee_left', 'knee_right|knee_left', '양쪽 무릎 주변 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_025', 'ankle', '종아리·발목', 'right', '오른쪽', 'ankle_right', 'ankle_right', '오른쪽 종아리·발목 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_026', 'ankle', '종아리·발목', 'left', '왼쪽', 'ankle_left', 'ankle_left', '왼쪽 종아리·발목 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_027', 'ankle', '종아리·발목', 'both', '양쪽', 'ankle_right|ankle_left', 'ankle_right|ankle_left', '양쪽 종아리·발목 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_028', 'ankle', '종아리·발목', 'unknown', '양쪽', 'ankle_right|ankle_left', 'ankle_right|ankle_left', '양쪽 종아리·발목 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_029', 'foot', '발바닥', 'right', '오른쪽', 'foot_right', 'foot_right', '오른쪽 발바닥 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_030', 'foot', '발바닥', 'left', '왼쪽', 'foot_left', 'foot_left', '왼쪽 발바닥 관리', 'discomfort', '', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_031', 'foot', '발바닥', 'both', '양쪽', 'foot_right|foot_left', 'foot_right|foot_left', '양쪽 발바닥 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;
INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active, updated_at) VALUES ('DM_032', 'foot', '발바닥', 'unknown', '양쪽', 'foot_right|foot_left', 'foot_right|foot_left', '양쪽 발바닥 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true, '2026-05-04T04:54:13.369Z')
  ON CONFLICT (mapping_id) DO UPDATE SET discomfort_part_key = EXCLUDED.discomfort_part_key, discomfort_part_label = EXCLUDED.discomfort_part_label, side_input = EXCLUDED.side_input, side_label = EXCLUDED.side_label, release_content_key = EXCLUDED.release_content_key, stretch_content_key = EXCLUDED.stretch_content_key, display_name = EXCLUDED.display_name, priority_source = EXCLUDED.priority_source, dev_note = EXCLUDED.dev_note, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;

-- ===== products (3행) =====
INSERT INTO public.products (id, seller_id, name, description, price, image_url, status, created_at, updated_at) VALUES ('0af19d5b-6957-4635-bbdf-02bd24430d64', NULL, '마사지볼 듀오', '작은 부위 이완과 셀프 케어에 활용할 수 있는 마사지볼 세트입니다.', '15000', NULL, 'ACTIVE', '2026-05-06T04:09:46.794Z', '2026-05-06T04:09:46.794Z')
  ON CONFLICT (id) DO UPDATE SET seller_id = EXCLUDED.seller_id, name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price, image_url = EXCLUDED.image_url, status = EXCLUDED.status, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.products (id, seller_id, name, description, price, image_url, status, created_at, updated_at) VALUES ('2fe18664-5b24-4bb3-9ce7-21b4bf1f78c3', NULL, '밸런스 스트레칭 밴드', '15분 케어 루틴에서 움직임 범위를 확인하기 좋은 밴드입니다.', '19000', NULL, 'ACTIVE', '2026-05-06T04:09:46.794Z', '2026-05-06T04:09:46.794Z')
  ON CONFLICT (id) DO UPDATE SET seller_id = EXCLUDED.seller_id, name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price, image_url = EXCLUDED.image_url, status = EXCLUDED.status, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
INSERT INTO public.products (id, seller_id, name, description, price, image_url, status, created_at, updated_at) VALUES ('c524008b-0acf-4b1d-9385-96cf1aa46c13', NULL, 'MEBODY 폼롤러', '목·어깨·골반 루틴 전후에 쓰기 좋은 기본 회복 도구입니다.', '29000', NULL, 'ACTIVE', '2026-05-06T04:09:46.794Z', '2026-05-06T04:09:46.794Z')
  ON CONFLICT (id) DO UPDATE SET seller_id = EXCLUDED.seller_id, name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price, image_url = EXCLUDED.image_url, status = EXCLUDED.status, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;

COMMIT;


-- ############ 120_rls.sql #######################################
-- MEBODY — RLS 정책 (운영계 기준)
--
-- 개발계 정책을 그대로 복사하지 않습니다. 개발계에는 아래 구멍이 있었습니다.
--
--   body_code_content        RLS 꺼짐 + anon DELETE 권한 → 공개 키로 콘텐츠 16행 삭제 가능
--   admin_audit_logs         RLS 꺼짐 + anon 전체 권한   → 감사 로그 열람·위조·삭제 가능
--   questionnaire_responses  "FOR ALL USING (true)" 정책 → 남의 응답 380행 열람·수정·삭제 가능
--   전 테이블                anon 에 INSERT/UPDATE/DELETE 권한이 부여되어 있음
--
-- anon 키는 브라우저 번들에 실려 나가는 공개 키입니다. 비밀이 아닙니다.
-- 여기서는 필요한 권한만 명시적으로 부여합니다.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) 기본 정리 — 공개 스키마 전체에서 anon/authenticated 쓰기 권한을 회수
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT relname FROM pg_class
            WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.relname);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 1) 콘텐츠 · 카탈로그 — 누구나 읽기, 쓰기는 서비스 역할만
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

-- 상품은 판매 중인 것만 공개
GRANT SELECT ON public.products TO anon, authenticated;
DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products
  FOR SELECT TO anon, authenticated USING (status = 'ACTIVE');

-- ---------------------------------------------------------------------------
-- 2) 사용자 프로필 — 본인 행만
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR auth.uid() = auth_user_id);

DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id OR auth.uid() = auth_user_id);

DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = id OR auth.uid() = auth_user_id);

-- ---------------------------------------------------------------------------
-- 3) 설문 응답 — 가장 조심해야 할 테이블
--
-- 비회원도 진단할 수 있어야 하므로 INSERT 는 열어야 합니다.
-- 다만 "남의 응답을 읽거나 고치는 것"은 반드시 막아야 합니다.
--
--   INSERT : anon 은 user_id 가 NULL 인 행만 생성 가능
--   UPDATE : 로그인 사용자는 본인 행만. 비회원 초안 갱신은 아래 RPC 로만.
--   SELECT : 로그인 사용자는 본인 행만. 비회원 조회는 아래 RPC 로만.
--
-- 비회원은 자기 응답의 UUID 를 알고 있습니다(생성 시 받음). 그 UUID 를 아는 사람만
-- 읽고 쓸 수 있게 SECURITY DEFINER 함수로 좁혀서 노출합니다.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.questionnaire_responses TO authenticated;
GRANT INSERT ON public.questionnaire_responses TO anon;

DROP POLICY IF EXISTS questionnaire_responses_select_own ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_select_own ON public.questionnaire_responses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS questionnaire_responses_insert_anon ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_insert_anon ON public.questionnaire_responses
  FOR INSERT TO anon WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS questionnaire_responses_insert_own ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_insert_own ON public.questionnaire_responses
  FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS questionnaire_responses_update_own ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_update_own ON public.questionnaire_responses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 비회원 조회: UUID 를 아는 경우에만 한 행을 돌려준다.
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
     -- 로그인 사용자는 본인 것만. 비회원 응답은 UUID 를 아는 사람만.
     AND (r.user_id IS NULL OR r.user_id = auth.uid());
$$;

-- 비회원 초안 갱신: UUID 를 아는 경우에만, 아직 주인이 없는 행에 한해.
CREATE OR REPLACE FUNCTION public.update_anonymous_response(p_id uuid, p_patch jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE public.questionnaire_responses r
     SET answers        = COALESCE((p_patch->'answers')::jsonb, r.answers),
         calculated_code= COALESCE(p_patch->>'calculated_code', r.calculated_code),
         status         = COALESCE(p_patch->>'status', r.status),
         primary_identity = COALESCE(p_patch->>'primary_identity', r.primary_identity),
         scoring_meta   = COALESCE((p_patch->'scoring_meta')::jsonb, r.scoring_meta),
         question_version = COALESCE(p_patch->>'question_version', r.question_version),
         completed_at   = COALESCE((p_patch->>'completed_at')::timestamptz, r.completed_at),
         updated_at     = now()
   WHERE r.id = p_id AND r.user_id IS NULL
  RETURNING r.id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.get_questionnaire_response(uuid)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_anonymous_response(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_questionnaire_response(uuid)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_anonymous_response(uuid, jsonb) TO anon;

-- ---------------------------------------------------------------------------
-- 4) 서버 전용 테이블 — 클라이언트 접근 없음 (Spring 은 service_role 로 접근)
--    admin_audit_logs / missions / user_mission_progress / body_bti_results
--    권한을 주지 않으므로 정책도 필요 없습니다.
-- ---------------------------------------------------------------------------

COMMIT;

-- ---------------------------------------------------------------------------
-- 적용 후 확인 (anon 키로)
--   GET /rest/v1/questionnaire_responses  -> [] 또는 permission denied
--   GET /rest/v1/body_code_content        -> 16행 (읽기만)
--   DELETE /rest/v1/body_code_content     -> 거부
--   GET /rest/v1/admin_audit_logs         -> 거부
-- ---------------------------------------------------------------------------


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
