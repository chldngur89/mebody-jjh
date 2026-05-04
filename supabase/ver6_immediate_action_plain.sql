-- Ver6 immediate action data generated from doc/ver6/MEBODY_immediate_action_master_v1.xlsx

-- Run the whole file in Supabase SQL editor.
-- Plain reload version. Safe because it deletes Ver6 master rows before insert.

BEGIN;


CREATE TABLE IF NOT EXISTS public.immediate_action_discomfort_mapping (
  mapping_id text PRIMARY KEY,
  discomfort_part_key text NOT NULL,
  discomfort_part_label text NOT NULL,
  side_input text NOT NULL,
  side_label text NOT NULL,
  release_content_key text NOT NULL,
  stretch_content_key text NOT NULL,
  display_name text NOT NULL,
  priority_source text NOT NULL DEFAULT 'discomfort',
  dev_note text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.immediate_action_axis_mapping (
  axis_mapping_id text PRIMARY KEY,
  axis_no integer NOT NULL,
  axis_key text NOT NULL,
  direction_key text NOT NULL,
  direction_label text NOT NULL,
  percentage_source text NOT NULL,
  release_content_key text NOT NULL,
  stretch_content_key text NOT NULL,
  display_name text NOT NULL,
  priority_source text NOT NULL DEFAULT 'axis',
  dev_note text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(axis_key, direction_key)
);

CREATE TABLE IF NOT EXISTS public.immediate_action_content (
  id text PRIMARY KEY,
  content_key text NOT NULL UNIQUE,
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
  caution text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 999,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_immediate_action_discomfort_lookup
  ON public.immediate_action_discomfort_mapping(discomfort_part_key, side_input)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_immediate_action_axis_lookup
  ON public.immediate_action_axis_mapping(axis_key, direction_key)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_immediate_action_content_sort
  ON public.immediate_action_content(sort_order);



-- Ensure the 53-question A-1 precheck matches Ver6 immediate action mapping keys.
ALTER TABLE public.questions
  ALTER COLUMN axis TYPE text,
  ALTER COLUMN question_text TYPE text,
  ALTER COLUMN option_1 TYPE text,
  ALTER COLUMN option_2 TYPE text,
  ALTER COLUMN option_3 TYPE text,
  ALTER COLUMN answer_type TYPE text;

UPDATE public.questions
SET
  axis = 'discomfort_area',
  question_text = '가장 불편함을 느끼는 부위 선택 (최대 2곳)',
  option_1 = '① 목 / 어깨 / 등 상부 / 허리 / 골반·엉덩이 / 무릎 / 종아리·발목 / 발바닥',
  option_2 = '② 없음 / 그냥 궁금해서',
  option_3 = '-',
  answer_type = 'multi',
  max_select = 2,
  is_precheck = true,
  is_scored = false,
  is_active = true,
  updated_at = now()
WHERE question_code = 'A-1';


-- Clean reload Ver6 immediate action master data before inserting.
DELETE FROM public.immediate_action_discomfort_mapping;
DELETE FROM public.immediate_action_axis_mapping;
DELETE FROM public.immediate_action_content;


INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_001', 'neck', '목', 'right', '오른쪽', 'neck_right', 'neck_right', '오른쪽 목 근육 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_002', 'neck', '목', 'left', '왼쪽', 'neck_left', 'neck_left', '왼쪽 목 근육 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_003', 'neck', '목', 'both', '양쪽', 'neck_right|neck_left', 'neck_right|neck_left', '양쪽 목 근육 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_004', 'neck', '목', 'unknown', '양쪽', 'neck_right|neck_left', 'neck_right|neck_left', '양쪽 목 근육 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_005', 'shoulder', '어깨', 'right', '오른쪽', 'shoulder_right', 'shoulder_right', '오른쪽 어깨 근육 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_006', 'shoulder', '어깨', 'left', '왼쪽', 'shoulder_left', 'shoulder_left', '왼쪽 어깨 근육 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_007', 'shoulder', '어깨', 'both', '양쪽', 'shoulder_right|shoulder_left', 'shoulder_right|shoulder_left', '양쪽 어깨 근육 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_008', 'shoulder', '어깨', 'unknown', '양쪽', 'shoulder_right|shoulder_left', 'shoulder_right|shoulder_left', '양쪽 어깨 근육 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_009', 'upper_back', '등 상부', 'right', '오른쪽', 'back_both', 'back_both', '오른쪽 등 상부 근육 관리', 'discomfort', '현재 콘텐츠가 양쪽 공통으로 1개만 존재', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_010', 'upper_back', '등 상부', 'left', '왼쪽', 'back_both', 'back_both', '왼쪽 등 상부 근육 관리', 'discomfort', '현재 콘텐츠가 양쪽 공통으로 1개만 존재', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_011', 'upper_back', '등 상부', 'both', '양쪽', 'back_both', 'back_both', '양쪽 등 상부 근육 관리', 'discomfort', '현재 콘텐츠가 양쪽 공통으로 1개만 존재', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_012', 'upper_back', '등 상부', 'unknown', '양쪽', 'back_both', 'back_both', '양쪽 등 상부 근육 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_013', 'waist', '허리', 'right', '오른쪽', 'waist_right', 'waist_right', '오른쪽 허리 근육 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_014', 'waist', '허리', 'left', '왼쪽', 'waist_left', 'waist_left', '왼쪽 허리 근육 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_015', 'waist', '허리', 'both', '양쪽', 'waist_right|waist_left', 'waist_right|waist_left', '양쪽 허리 근육 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_016', 'waist', '허리', 'unknown', '양쪽', 'waist_right|waist_left', 'waist_right|waist_left', '양쪽 허리 근육 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_017', 'pelvis', '골반·엉덩이', 'right', '오른쪽', 'pelvis_right', 'pelvis_right', '오른쪽 골반·엉덩이 근육 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_018', 'pelvis', '골반·엉덩이', 'left', '왼쪽', 'pelvis_left', 'pelvis_left', '왼쪽 골반·엉덩이 근육 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_019', 'pelvis', '골반·엉덩이', 'both', '양쪽', 'pelvis_right|pelvis_left', 'pelvis_right|pelvis_left', '양쪽 골반·엉덩이 근육 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_020', 'pelvis', '골반·엉덩이', 'unknown', '양쪽', 'pelvis_right|pelvis_left', 'pelvis_right|pelvis_left', '양쪽 골반·엉덩이 근육 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_021', 'knee', '무릎', 'right', '오른쪽', 'knee_right', 'knee_right', '오른쪽 무릎 주변 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_022', 'knee', '무릎', 'left', '왼쪽', 'knee_left', 'knee_left', '왼쪽 무릎 주변 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_023', 'knee', '무릎', 'both', '양쪽', 'knee_right|knee_left', 'knee_right|knee_left', '양쪽 무릎 주변 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_024', 'knee', '무릎', 'unknown', '양쪽', 'knee_right|knee_left', 'knee_right|knee_left', '양쪽 무릎 주변 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_025', 'ankle', '종아리·발목', 'right', '오른쪽', 'ankle_right', 'ankle_right', '오른쪽 종아리·발목 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_026', 'ankle', '종아리·발목', 'left', '왼쪽', 'ankle_left', 'ankle_left', '왼쪽 종아리·발목 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_027', 'ankle', '종아리·발목', 'both', '양쪽', 'ankle_right|ankle_left', 'ankle_right|ankle_left', '양쪽 종아리·발목 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_028', 'ankle', '종아리·발목', 'unknown', '양쪽', 'ankle_right|ankle_left', 'ankle_right|ankle_left', '양쪽 종아리·발목 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_029', 'foot', '발바닥', 'right', '오른쪽', 'foot_right', 'foot_right', '오른쪽 발바닥 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_030', 'foot', '발바닥', 'left', '왼쪽', 'foot_left', 'foot_left', '왼쪽 발바닥 관리', 'discomfort', '', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_031', 'foot', '발바닥', 'both', '양쪽', 'foot_right|foot_left', 'foot_right|foot_left', '양쪽 발바닥 관리', 'discomfort', '오른쪽+왼쪽 콘텐츠를 순서대로 호출', true);

INSERT INTO public.immediate_action_discomfort_mapping (mapping_id, discomfort_part_key, discomfort_part_label, side_input, side_label, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('DM_032', 'foot', '발바닥', 'unknown', '양쪽', 'foot_right|foot_left', 'foot_right|foot_left', '양쪽 발바닥 관리', 'discomfort', '잘 모르겠다 선택 시 양쪽 기본 플랜', true);


INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('AM_001', 1, 'neck', 'F', '목 앞 / 거북목', 'axis_1_percent', 'axis_1F', 'axis_1F', '목 앞쪽 경향 관리', 'axis', '흉쇄유돌근 양쪽 콘텐츠 호출', true);

INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('AM_002', 1, 'neck', 'C', '목 중립 / 일자목', 'axis_1_percent', 'axis_1C', 'axis_1C', '목 중립 경향 관리', 'axis', '상부승모근 양쪽 콘텐츠 호출', true);

INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('AM_003', 2, 'shoulder', 'R', '오른쪽 어깨 높음', 'axis_2_percent', 'axis_2R', 'axis_2R', '오른쪽 어깨 높음 관리', 'axis', '', true);

INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('AM_004', 2, 'shoulder', 'L', '왼쪽 어깨 높음', 'axis_2_percent', 'axis_2L', 'axis_2L', '왼쪽 어깨 높음 관리', 'axis', '', true);

INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('AM_005', 3, 'pelvis', 'R', '골반 오른쪽 회전', 'axis_3_percent', 'axis_3R', 'axis_3R', '골반 오른쪽 회전 관리', 'axis', '양쪽 둔근 이완 + 상체 오른쪽 회전 스트레칭', true);

INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('AM_006', 3, 'pelvis', 'L', '골반 왼쪽 회전', 'axis_3_percent', 'axis_3L', 'axis_3L', '골반 왼쪽 회전 관리', 'axis', '양쪽 둔근 이완 + 상체 왼쪽 회전 스트레칭', true);

INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('AM_007', 4, 'lower', 'S', '하체 뻣뻣', 'axis_4_percent', 'axis_4S', 'axis_4S', '하체 뻣뻣 경향 관리', 'axis', '햄스트링/대퇴사두근 이완 + 스트레칭', true);

INSERT INTO public.immediate_action_axis_mapping (axis_mapping_id, axis_no, axis_key, direction_key, direction_label, percentage_source, release_content_key, stretch_content_key, display_name, priority_source, dev_note, is_active)
VALUES
  ('AM_008', 4, 'lower', 'F', '하체 유연', 'axis_4_percent', 'axis_4F', 'axis_4F', '하체 유연 경향 관리', 'axis', '과한 스트레칭보다 가벼운 이완 + 안정화 안내 문구 권장', true);


INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_001', 'neck_right', 'body_part', '목 근육 관리', '상부승모근', 'right', '오른쪽 목-어깨 연결부 이완', '1. 편하게 앉는다 / 2. 고개를 왼쪽으로 기울인다 / 3. 고개를 오른쪽으로 살짝 돌린다 / 4. 왼손 손바닥이나 손가락으로 단단한 부위를 부드럽게 문지른다', '손', 90, '오른쪽 목-어깨 연결부 스트레칭', '1. 오른손을 오른쪽 엉덩이 밑에 넣고 앉는다(어깨 고정) / 2. 왼손으로 머리 오른쪽 뒤쪽을 잡는다 / 3. 고개를 왼쪽 대각선 아래로 천천히 숙인다', 30, 3, '저림이나 찌릿한 느낌 오면 즉시 중단', 1);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_002', 'neck_left', 'body_part', '목 근육 관리', '상부승모근', 'left', '왼쪽 목-어깨 연결부 이완', '1. 편하게 앉는다 / 2. 고개를 오른쪽으로 기울인다 / 3. 고개를 왼쪽으로 살짝 돌린다 / 4. 오른손 손바닥이나 손가락으로 단단한 부위를 부드럽게 문지른다', '손', 90, '왼쪽 목-어깨 연결부 스트레칭', '1. 왼손을 왼쪽 엉덩이 밑에 넣고 앉는다(어깨 고정) / 2. 오른손으로 머리 왼쪽 뒤쪽을 잡는다 / 3. 고개를 오른쪽 대각선 아래로 천천히 숙인다', 30, 3, '저림이나 찌릿한 느낌 오면 즉시 중단', 2);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_003', 'shoulder_right', 'body_part', '어깨 근육 관리', '대원근/광배근', 'right', '오른쪽 겨드랑이 뒤쪽 이완', '1. 오른쪽을 아래로 옆으로 눕는다 / 2. 오른팔을 머리 위로 쭉 뻗어 겨드랑이를 연다 / 3. 폼롤러를 오른쪽 겨드랑이 뒤쪽(팔과 날개뼈 사이)에 둔다 / 4. 단단한 부위를 찾아 멈춘다', '폼롤러/마사지볼', 90, '오른팔 위로 올려 당기기', '1. 서거나 앉은 자세에서 오른팔을 머리 위로 올려 팔꿈치를 굽힌다 / 2. 왼손으로 오른쪽 손목을 잡는다 / 3. 오른팔을 왼쪽 위 방향으로 끌어당기며 상체도 왼쪽으로 살짝 기울인다', 30, 3, '어깨 관절에서 날카로운 통증 시 즉시 중단', 3);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_004', 'shoulder_left', 'body_part', '어깨 근육 관리', '대원근/광배근', 'left', '왼쪽 겨드랑이 뒤쪽 이완', '1. 왼쪽을 아래로 옆으로 눕는다 / 2. 왼팔을 머리 위로 쭉 뻗어 겨드랑이를 연다 / 3. 폼롤러를 왼쪽 겨드랑이 뒤쪽(팔과 날개뼈 사이)에 둔다 / 4. 단단한 부위를 찾아 멈춘다', '폼롤러/마사지볼', 90, '왼팔 위로 올려 당기기', '1. 서거나 앉은 자세에서 왼팔을 머리 위로 올려 팔꿈치를 굽힌다 / 2. 오른손으로 왼쪽 손목을 잡는다 / 3. 왼팔을 오른쪽 위 방향으로 끌어당기며 상체도 오른쪽으로 살짝 기울인다', 30, 3, '어깨 관절에서 날카로운 통증 시 즉시 중단', 4);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_005', 'back_both', 'body_part', '등 근육 관리', '기립근', 'both', '등 기립근 폼롤러 이완', '1. 바닥에 등 대고 눕고 무릎을 세운다 / 2. 폼롤러를 날개뼈 아래쪽 등에 둔다 / 3. 양손을 머리 뒤에 받치고 천천히 위아래로 굴린다 / 4. 단단한 지점에서 멈춰 머문다 (흉추까지만 / 요추 직접 압박 금지)', '폼롤러', 90, '흉요추 굴곡+신전 순환', '[굴곡] 1. 바닥에 누워 무릎 세우기 / 2. 숨을 내쉬며 등을 바닥에 누르듯 말기 → 5초 유지 / [신전] 3. 숨을 들이쉬며 흉추를 위로 들어 올리듯 활처럼 펴기 → 5초 유지 (요추5번 과신전 금지 / 흉추 신전 강조 / 복직근 상부 당김 느낌 목표)', 30, 3, '허리(요추)를 꺾는 느낌이 아닌 등(흉추)을 여는 느낌으로 / 요추 직접 폼롤러 금지', 5);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_006', 'waist_right', 'body_part', '허리 근육 관리', '요방형근', 'right', '오른쪽 요방형근 이완', '1. 바닥에 눕거나 벽에 기댄다 / 2. 마사지볼을 오른쪽 허리 옆구리 뒤쪽에 둔다(척추뼈 바로 위 금지) / 3. 오른쪽 갈비뼈 아래~골반 위 사이 단단한 부위를 찾는다 / 4. 천천히 체중을 싣는다', '마사지볼', 90, '오른쪽 옆구리 늘리기', '1. 의자에 앉거나 선다 / 2. 오른팔을 머리 위로 올린다 / 3. 상체를 왼쪽으로 천천히 기울인다 / 4. 왼손으로 의자 옆이나 허벅지를 잡아 고정하면 더 효과적', 30, 3, '척추뼈 직접 압박 금지 / 너무 강하게 누르지 않기(신장 위치)', 6);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_007', 'waist_left', 'body_part', '허리 근육 관리', '요방형근', 'left', '왼쪽 요방형근 이완', '1. 바닥에 눕거나 벽에 기댄다 / 2. 마사지볼을 왼쪽 허리 옆구리 뒤쪽에 둔다(척추뼈 바로 위 금지) / 3. 왼쪽 갈비뼈 아래~골반 위 사이 단단한 부위를 찾는다 / 4. 천천히 체중을 싣는다', '마사지볼', 90, '왼쪽 옆구리 늘리기', '1. 의자에 앉거나 선다 / 2. 왼팔을 머리 위로 올린다 / 3. 상체를 오른쪽으로 천천히 기울인다 / 4. 오른손으로 의자 옆이나 허벅지를 잡아 고정', 30, 3, '척추뼈 직접 압박 금지 / 너무 강하게 누르지 않기(신장 위치)', 7);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_008', 'pelvis_right', 'body_part', '골반 근육 관리', '둔근', 'right', '오른쪽 둔근 이완', '1. 폼롤러 위에 오른쪽 엉덩이를 올리고 앉는다 / 2. 오른쪽 엉덩이 바깥쪽·중앙·깊은 곳을 조금씩 탐색한다 / 3. 단단하거나 묵직한 지점에서 멈추고 천천히 체중을 싣는다', '폼롤러/마사지볼', 90, '오른쪽 둔근 스트레칭', '1. 의자에 앉아 오른쪽 발목을 왼쪽 무릎 위에 올린다(숫자 4 모양) / 2. 등을 세운 상태를 유지한다(허리 둥글게 말지 않기) / 3. 상체를 앞으로 살짝 숙인다 / 4. 오른손을 오른쪽 무릎에 올려 지그시 누른다', 30, 3, '꼬리뼈 직접 압박 금지 / 다리 저림 오면 위치 이동', 8);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_009', 'pelvis_left', 'body_part', '골반 근육 관리', '둔근', 'left', '왼쪽 둔근 이완', '1. 폼롤러 위에 왼쪽 엉덩이를 올리고 앉는다 / 2. 왼쪽 엉덩이 바깥쪽·중앙·깊은 곳을 조금씩 탐색한다 / 3. 단단하거나 묵직한 지점에서 멈추고 천천히 체중을 싣는다', '폼롤러/마사지볼', 90, '왼쪽 둔근 스트레칭', '1. 의자에 앉아 왼쪽 발목을 오른쪽 무릎 위에 올린다(숫자 4 모양) / 2. 등을 세운 상태를 유지한다 / 3. 상체를 앞으로 살짝 숙인다 / 4. 왼손을 왼쪽 무릎에 올려 지그시 누른다', 30, 3, '꼬리뼈 직접 압박 금지 / 다리 저림 오면 위치 이동', 9);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_010', 'knee_right', 'body_part', '무릎 근육 관리', '대퇴사두근/햄스트링', 'right', '오른쪽 대퇴사두근/햄스트링 이완', '1. 오른쪽 허벅지 앞쪽은 손/팔꿈치/폼롤러로 위쪽부터 무릎 위까지 부드럽게 풀어준다 / 2. 오른쪽 허벅지 뒤쪽은 폼롤러나 마사지볼을 두고 엉덩이 아래부터 무릎 위까지 천천히 굴린다 / 3. 단단한 지점에서 멈춰 호흡한다', '손/폼롤러/마사지볼', 90, '오른쪽 대퇴사두근/햄스트링 스트레칭', '1. 대퇴사두근: 벽이나 의자를 잡고 오른쪽 발등/발목을 잡아 허벅지 앞쪽을 늘린다 / 2. 햄스트링: 의자에 앉아 오른쪽 다리를 앞으로 뻗고 등을 세운 채 상체를 숙인다 / 3. 당김은 편안한 범위에서 유지한다', 30, 3, '무릎 앞/뒤를 직접 강하게 압박하지 않기 / 허리를 과하게 꺾거나 둥글게 말지 않기', 10);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_011', 'knee_left', 'body_part', '무릎 근육 관리', '대퇴사두근/햄스트링', 'left', '왼쪽 대퇴사두근/햄스트링 이완', '1. 왼쪽 허벅지 앞쪽은 손/팔꿈치/폼롤러로 위쪽부터 무릎 위까지 부드럽게 풀어준다 / 2. 왼쪽 허벅지 뒤쪽은 폼롤러나 마사지볼을 두고 엉덩이 아래부터 무릎 위까지 천천히 굴린다 / 3. 단단한 지점에서 멈춰 호흡한다', '손/폼롤러/마사지볼', 90, '왼쪽 대퇴사두근/햄스트링 스트레칭', '1. 대퇴사두근: 벽이나 의자를 잡고 왼쪽 발등/발목을 잡아 허벅지 앞쪽을 늘린다 / 2. 햄스트링: 의자에 앉아 왼쪽 다리를 앞으로 뻗고 등을 세운 채 상체를 숙인다 / 3. 당김은 편안한 범위에서 유지한다', 30, 3, '무릎 앞/뒤를 직접 강하게 압박하지 않기 / 허리를 과하게 꺾거나 둥글게 말지 않기', 11);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_012', 'ankle_right', 'body_part', '발목 근육 관리', '종아리(비복근/가자미근)', 'right', '오른쪽 종아리 이완', '1. 의자에 앉아 오른쪽 다리를 왼쪽 무릎 위에 올린다 / 2. 양손 엄지로 오른쪽 종아리 전체를 위에서 아래로 눌러 내려간다 / 3. 가장 단단한 지점에서 멈춘다', '손/폼롤러', 90, '오른쪽 종아리 스트레칭(비복근)', '1. 벽 앞에 서서 오른쪽 다리를 뒤로 한 걸음 뺀다 / 2. 오른쪽 무릎을 편 채 오른쪽 뒤꿈치를 바닥에 고정한다 / 3. 왼쪽 무릎을 살짝 굽히며 몸을 앞으로 보낸다', 30, 3, '정강이뼈 옆이 아닌 종아리 뒤쪽이 타겟 / 발목 안팎으로 틀지 말기', 12);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_013', 'ankle_left', 'body_part', '발목 근육 관리', '종아리(비복근/가자미근)', 'left', '왼쪽 종아리 이완', '1. 의자에 앉아 왼쪽 다리를 오른쪽 무릎 위에 올린다 / 2. 양손 엄지로 왼쪽 종아리 전체를 위에서 아래로 눌러 내려간다 / 3. 가장 단단한 지점에서 멈춘다', '손/폼롤러', 90, '왼쪽 종아리 스트레칭(비복근)', '1. 벽 앞에 서서 왼쪽 다리를 뒤로 한 걸음 뺀다 / 2. 왼쪽 무릎을 편 채 왼쪽 뒤꿈치를 바닥에 고정한다 / 3. 오른쪽 무릎을 살짝 굽히며 몸을 앞으로 보낸다', 30, 3, '정강이뼈 옆이 아닌 종아리 뒤쪽이 타겟 / 발목 안팎으로 틀지 말기', 13);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_014', 'foot_right', 'body_part', '발바닥 근육 관리', '족저근막', 'right', '오른쪽 발바닥 이완', '1. 의자에 앉아 오른발 아래 마사지볼을 놓는다 / 2. 발가락 아래 → 발바닥 중앙 → 뒤꿈치 앞쪽 순서로 천천히 굴린다 / 3. 가장 단단하고 뻐근한 지점에서 멈춘다', '마사지볼/테니스볼', 90, '오른쪽 발바닥 스트레칭', '1. 의자에 앉아 오른발을 왼쪽 무릎 위에 올린다 / 2. 왼손으로 오른쪽 뒤꿈치를 잡아 고정한다 / 3. 오른손으로 오른쪽 발가락 전체를 잡고 몸쪽으로 천천히 젖힌다', 30, 3, '뒤꿈치 뼈 직접 압박 피하기 / 선 자세에서 하면 강도 세짐 주의', 14);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_015', 'foot_left', 'body_part', '발바닥 근육 관리', '족저근막', 'left', '왼쪽 발바닥 이완', '1. 의자에 앉아 왼발 아래 마사지볼을 놓는다 / 2. 발가락 아래 → 발바닥 중앙 → 뒤꿈치 앞쪽 순서로 천천히 굴린다 / 3. 가장 단단하고 뻐근한 지점에서 멈춘다', '마사지볼/테니스볼', 90, '왼쪽 발바닥 스트레칭', '1. 의자에 앉아 왼발을 오른쪽 무릎 위에 올린다 / 2. 오른손으로 왼쪽 뒤꿈치를 잡아 고정한다 / 3. 왼손으로 왼쪽 발가락 전체를 잡고 몸쪽으로 천천히 젖힌다', 30, 3, '뒤꿈치 뼈 직접 압박 피하기 / 선 자세에서 하면 강도 세짐 주의', 15);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_016', 'axis_1F', 'axis', '목 앞쪽 경향 관리', '흉쇄유돌근', 'both', '흉쇄유돌근 이완(양쪽)', '1. 편하게 앉는다 / 2. 고개를 왼쪽으로 살짝 기울이고 오른쪽으로 살짝 돌린다 / 3. 오른쪽 귀 아래~쇄골 연결 근육을 엄지와 검지로 부드럽게 잡는다 / 4. 살살 문지른다 / 5. 반대쪽도 동일하게 진행', '손', 90, '흉쇄유돌근 스트레칭(양쪽)', '1. 왼손을 오른쪽 쇄골 위에 올리고 오른손으로 위를 살짝 눌러 고정한다 / 2. 고개를 왼쪽으로 기울이고 오른쪽으로 살짝 돌린다 / 3. 오른쪽 목 앞쪽이 당기면 유지한다 / 4. 반대쪽도 동일하게 진행', 30, 3, '맥박 뛰는 목 앞쪽 혈관 강하게 누르지 않기 / 어지러움 느껴지면 즉시 중단', 16);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_017', 'axis_1C', 'axis', '목 중립 경향 관리', '상부승모근', 'both', '상부승모근 이완(양쪽)', '1. 편하게 앉는다 / 2. 고개를 왼쪽으로 기울이고 오른쪽으로 살짝 돌린다 / 3. 왼손으로 오른쪽 목-어깨 사이 단단한 부위를 부드럽게 문지른다 / 4. 반대쪽도 동일하게 진행', '손', 90, '상부승모근 스트레칭(양쪽)', '1. 오른손을 오른쪽 엉덩이 밑에 넣고 앉는다 / 2. 왼손으로 머리 오른쪽 뒤쪽을 잡는다 / 3. 고개를 왼쪽 대각선 아래로 천천히 숙인다 / 4. 반대쪽도 동일하게 진행', 30, 3, '저림이나 찌릿한 느낌 오면 즉시 중단', 17);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_018', 'axis_2R', 'axis', '오른쪽 어깨 높음 관리', '대원근/광배근', 'right', '오른쪽 대원근/광배근 이완', '1. 오른쪽을 아래로 옆으로 눕는다 / 2. 오른팔을 머리 위로 뻗어 겨드랑이를 연다 / 3. 폼롤러를 오른쪽 겨드랑이 뒤쪽(팔과 날개뼈 사이)에 둔다 / 4. 단단한 지점에서 멈춘다', '폼롤러/마사지볼', 90, '오른쪽 대원근/광배근 스트레칭', '1. 오른팔을 머리 위로 올려 팔꿈치를 굽힌다 / 2. 왼손으로 오른쪽 손목을 잡는다 / 3. 오른팔을 왼쪽 위 방향으로 당기며 상체도 왼쪽으로 살짝 기울인다', 30, 3, '겨드랑이 앞쪽 혈관/신경 부위는 피하기 / 날카로운 통증 시 중단', 18);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_019', 'axis_2L', 'axis', '왼쪽 어깨 높음 관리', '대원근/광배근', 'left', '왼쪽 대원근/광배근 이완', '1. 왼쪽을 아래로 옆으로 눕는다 / 2. 왼팔을 머리 위로 뻗어 겨드랑이를 연다 / 3. 폼롤러를 왼쪽 겨드랑이 뒤쪽(팔과 날개뼈 사이)에 둔다 / 4. 단단한 지점에서 멈춘다', '폼롤러/마사지볼', 90, '왼쪽 대원근/광배근 스트레칭', '1. 왼팔을 머리 위로 올려 팔꿈치를 굽힌다 / 2. 오른손으로 왼쪽 손목을 잡는다 / 3. 왼팔을 오른쪽 위 방향으로 당기며 상체도 오른쪽으로 살짝 기울인다', 30, 3, '겨드랑이 앞쪽 혈관/신경 부위는 피하기 / 날카로운 통증 시 중단', 19);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_020', 'axis_3R', 'axis', '골반 오른쪽 회전 관리', '둔근(양쪽)', 'both', '둔근 이완(양쪽/오른쪽 먼저)', '1. 폼롤러 위에 오른쪽 엉덩이를 올리고 앉는다 / 2. 단단한 지점에서 10초 → 왼쪽으로 이동 / 3. 양쪽 모두 진행', '폼롤러/마사지볼', 90, '상체 오른쪽 회전 스트레칭', '1. 의자에 바르게 앉아 양발을 바닥에 고정한다 / 2. 양손으로 의자 오른쪽을 잡는다 / 3. 숨을 내쉬며 가슴 전체를 오른쪽으로 천천히 돌린다 / 4. 10초 유지 후 정면으로 돌아온다 / 5. 6회 반복', 30, 3, '골반은 정면 고정 / 가슴만 돌리는 느낌으로', 20);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_021', 'axis_3L', 'axis', '골반 왼쪽 회전 관리', '둔근(양쪽)', 'both', '둔근 이완(양쪽/왼쪽 먼저)', '1. 폼롤러 위에 왼쪽 엉덩이를 올리고 앉는다 / 2. 단단한 지점에서 10초 → 오른쪽으로 이동 / 3. 양쪽 모두 진행', '폼롤러/마사지볼', 90, '상체 왼쪽 회전 스트레칭', '1. 의자에 바르게 앉아 양발을 바닥에 고정한다 / 2. 양손으로 의자 왼쪽을 잡는다 / 3. 숨을 내쉬며 가슴 전체를 왼쪽으로 천천히 돌린다 / 4. 10초 유지 후 정면으로 돌아온다 / 5. 6회 반복', 30, 3, '골반은 정면 고정 / 가슴만 돌리는 느낌으로', 21);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_022', 'axis_4S', 'axis', '하체 뻣뻣 경향 관리', '햄스트링/대퇴사두근', 'both', '햄스트링 이완(양쪽)', '1. 바닥에 앉아 한쪽 허벅지 뒤 아래에 폼롤러를 둔다 / 2. 양손을 뒤쪽 바닥에 짚어 몸을 살짝 든다 / 3. 엉덩이 아래~무릎 위쪽까지 천천히 굴린다 / 4. 양쪽 모두 진행', '폼롤러', 90, '대퇴사두근 스트레칭(양쪽)', '1. 한 손으로 벽이나 의자를 잡고 선다 / 2. 반대 손으로 발등이나 발목을 잡는다 / 3. 무릎을 굽혀 발뒤꿈치를 엉덩이 쪽으로 당긴다 / 4. 양쪽 모두 진행', 30, 3, '무릎 뒤 오금 직접 강하게 압박 금지 / 허리 꺾임 주의', 22);

INSERT INTO public.immediate_action_content (id, content_key, category_type, display_name, target_muscle, direction, release_title, release_content, release_tool, release_duration_sec, stretch_title, stretch_content, stretch_duration_sec, sets, caution, sort_order)
VALUES
  ('AC_023', 'axis_4F', 'axis', '하체 유연 경향 관리', '햄스트링/대퇴사두근', 'both', '허벅지 전체 가볍게 이완(양쪽)', '1. 의자에 앉는다 / 2. 양손으로 허벅지를 위에서 아래로 가볍게 주무른다 / 3. 앞쪽 → 옆쪽 → 뒤쪽 순서로 전체적으로 풀어주는 느낌 / 4. 양쪽 모두 진행', '손', 90, '의자 앉아 무릎 들기(활성화)', '1. 의자에 바르게 앉아 양발 바닥에 고정한다 / 2. 한쪽 무릎을 천천히 10cm 들어 올린다 / 3. 3초 유지 후 천천히 내린다 / 4. 양쪽 번갈아 진행 / 10회×2세트', 30, 3, '빠르게 하지 말고 천천히 근육에 집중하며 진행', 23);



ALTER TABLE public.immediate_action_discomfort_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immediate_action_axis_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immediate_action_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read immediate action discomfort" ON public.immediate_action_discomfort_mapping;
DROP POLICY IF EXISTS "Public read immediate action axis" ON public.immediate_action_axis_mapping;
DROP POLICY IF EXISTS "Public read immediate action content" ON public.immediate_action_content;

CREATE POLICY "Public read immediate action discomfort"
ON public.immediate_action_discomfort_mapping FOR SELECT
USING (is_active = true);

CREATE POLICY "Public read immediate action axis"
ON public.immediate_action_axis_mapping FOR SELECT
USING (is_active = true);

CREATE POLICY "Public read immediate action content"
ON public.immediate_action_content FOR SELECT
USING (true);

GRANT SELECT ON public.immediate_action_discomfort_mapping TO anon, authenticated;
GRANT SELECT ON public.immediate_action_axis_mapping TO anon, authenticated;
GRANT SELECT ON public.immediate_action_content TO anon, authenticated;


COMMIT;


-- Verification queries
SELECT
  (SELECT count(*) FROM public.immediate_action_discomfort_mapping WHERE is_active = true) AS discomfort_mapping_count,
  (SELECT count(*) FROM public.immediate_action_axis_mapping WHERE is_active = true) AS axis_mapping_count,
  (SELECT count(*) FROM public.immediate_action_content) AS action_content_count;

SELECT question_code, axis, question_text, option_1, option_2, option_3, answer_type, max_select, is_precheck, is_scored
FROM public.questions
WHERE question_code = 'A-1';

