-- ===========================================================================
-- MEBODY — 040 권한 구멍 메우기 (payments / user_addresses)
--
-- 무엇이 잘못됐나:
--   Supabase 는 public 스키마의 **새 테이블에 기본으로 anon·authenticated 에게
--   GRANT ALL** 을 겁니다(default privileges). 040 은 payments 에 대해
--   `REVOKE INSERT, UPDATE, DELETE` 만 했고, user_addresses 는 필요한 권한을
--   GRANT 하기만 했습니다. 그래서 **TRUNCATE 가 남았습니다.**
--
--   TRUNCATE 는 **RLS 정책을 적용받지 않습니다.**
--   → 로그인한 아무나 `TRUNCATE public.payments` 로 결제 원장 전체를 지울 수 있었습니다.
--     (실제로 롤백 트랜잭션에서 authenticated 로 TRUNCATE 가 성공하는 걸 확인했습니다)
--     user_addresses 는 orders.address_id FK 덕분에 우연히 막혔을 뿐, 권한은 열려 있었습니다.
--
-- 다른 테이블 43개 조합은 전부 정상입니다(기존 마이그레이션들은 REVOKE ALL 을 먼저 했습니다).
--
-- 이 파일이 하는 일:
--   두 테이블의 권한을 **전부 회수하고 필요한 것만 다시 부여**합니다.
--   앞으로 새 테이블을 만들 때도 이 순서(REVOKE ALL → GRANT 필요한 것)를 지켜야 합니다.
--
-- 선행: 040 적용 완료
-- ===========================================================================

-- payments — 앱은 자기 결제 내역을 "읽기만" 합니다. 쓰기·삭제는 서버(postgres/service_role)만.
REVOKE ALL ON public.payments FROM anon, authenticated;
GRANT SELECT ON public.payments TO authenticated;

-- user_addresses — 본인 배송지는 직접 관리합니다(RLS 로 본인 행만). 단 TRUNCATE 는 없습니다.
REVOKE ALL ON public.user_addresses FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_addresses TO authenticated;

-- ---------------------------------------------------------------------------
-- 확인 — TRUNCATE 가 남아 있으면 안 됩니다
-- ---------------------------------------------------------------------------
SELECT table_name AS 테이블, grantee AS 역할,
       string_agg(privilege_type, ',' ORDER BY privilege_type) AS 권한
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND table_name IN ('payments', 'user_addresses')
   AND grantee IN ('anon', 'authenticated')
 GROUP BY table_name, grantee
 ORDER BY table_name, grantee;

-- public 스키마 전체에서 anon·authenticated 에게 TRUNCATE 가 열린 테이블 (0행이어야 합니다)
SELECT table_name AS 테이블, grantee AS 역할
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND grantee IN ('anon', 'authenticated')
   AND privilege_type = 'TRUNCATE'
 ORDER BY table_name, grantee;
