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
