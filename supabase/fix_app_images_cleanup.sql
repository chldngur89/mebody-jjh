-- app_images 점검/정리 SQL
-- 실행 위치: Supabase SQL Editor

-- 1) 현재 이미지 URL 상태 확인
SELECT key, url
FROM app_images
WHERE key LIKE 'character_%' OR key = 'body_types_image'
ORDER BY key;

-- 2) 샘플 placeholder URL 정리 (있으면 삭제)
DELETE FROM app_images
WHERE (key LIKE 'character_%' OR key = 'body_types_image')
  AND url ILIKE '%your-bucket.supabase.co%';

-- 3) 상대 경로로 들어간 잘못된 값 정리 (선택)
-- 필요 시 주석 해제 후 실행
-- DELETE FROM app_images
-- WHERE (key LIKE 'character_%' OR key = 'body_types_image')
--   AND url LIKE '/%';
