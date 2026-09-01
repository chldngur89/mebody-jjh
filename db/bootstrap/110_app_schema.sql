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
