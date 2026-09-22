-- ===========================================================================
-- MEBODY — 에러 기록 테이블을 아무나 비울 수 있던 문제
--
-- 증상: app_error_log 에 anon·authenticated 가 TRUNCATE 를 갖고 있습니다.
--       **TRUNCATE 는 RLS 를 우회합니다.** 정책이 아무리 잘 짜여 있어도
--       방문자 누구나 에러 기록 전체를 한 줄로 날릴 수 있습니다.
--
-- 원인: db/v1/050_app_error_log.sql 이 테이블만 만들고 권한을 정하지 않았습니다.
--       Supabase 는 public 스키마의 새 테이블에 기본으로 GRANT ALL 을 줍니다.
--       040 에서 payments·user_addresses 에 똑같은 일이 있었고 041 로 막았습니다.
--       이번에는 그 뒤에 추가된 테이블이라 같은 구멍이 다시 생겼습니다.
--
-- 고침: 전부 회수하고 필요한 것만 돌려줍니다.
--       · INSERT — 앱이 오류를 남기는 경로 (정책 app_error_log_insert_any)
--       · SELECT — 관리자가 읽는 경로 (정책 app_error_log_select_admin).
--                  정책이 authenticated 전용이라 anon 에게는 주지 않습니다.
--       DELETE·UPDATE·TRUNCATE 는 아무도 갖지 않습니다. 정리는 service_role 로 합니다.
--
-- 선행: db/v1/050_app_error_log.sql 적용 완료
-- ===========================================================================

REVOKE ALL ON public.app_error_log FROM anon, authenticated;

GRANT INSERT         ON public.app_error_log TO anon, authenticated;
GRANT SELECT         ON public.app_error_log TO authenticated;
GRANT ALL PRIVILEGES ON public.app_error_log TO service_role;

-- ---------------------------------------------------------------------------
-- 확인 — TRUNCATE 가 사라져야 합니다
-- ---------------------------------------------------------------------------
SELECT grantee AS 역할, string_agg(privilege_type, ',' ORDER BY privilege_type) AS 권한
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'app_error_log'
   AND grantee IN ('anon', 'authenticated')
 GROUP BY grantee ORDER BY grantee;

SELECT count(*) AS "앱 역할에 TRUNCATE 가 열린 테이블(0이어야)"
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND privilege_type = 'TRUNCATE'
   AND grantee IN ('anon', 'authenticated');
