-- ===========================================================================
-- MEBODY — 다른 제품의 잔재 테이블 정리
--
-- ※ db/journey 폴더의 061 입니다.
--
-- ── 지우는 것과 남기는 것
-- 40개 테이블을 전수 조사해서, 앱·서버·홈페이지 어디에서도 부르지 않는 것만 고릅니다.
--
--   prompts           13행 · 참조 0곳 — 다른 제품의 잔재
--   sere_contents      3행 · 참조 0곳 — 다른 제품의 잔재
--   body_bti_results   0행 · 리포지터리 파일만 있고 부르는 곳 0곳
--
-- ── 지우지 않는 것 (처음에 같이 지우려다 멈춘 것)
--   missions, user_mission_progress
--   → 행은 0이지만 **살아 있는 경로가 씁니다**: GET /api/me/missions.
--     홈페이지의 「미션 진행」 카드가 그걸 부릅니다. 테이블만 지우면 그 화면이 500 입니다.
--     저니 도메인(user_missions)이 대체한 옛 구조가 맞지만, 치우려면 서버 코드와
--     홈페이지 카드를 먼저 걷어내야 합니다. 그건 062 에서 따로 합니다.
--     "안 쓰는 것 같다" 와 "안 쓴다" 는 다릅니다.
--
-- ── 되돌리기
-- 전체 행을 db/journey/backup_legacy_tables_061.sql 에 INSERT 문으로 떠 두었습니다.
-- 컬럼 정의도 주석으로 같이 적어 두었습니다. 되살리려면 CREATE TABLE 을 먼저 만들고
-- 그 파일을 실행합니다.
--
-- 선행: 백업 파일 확인
-- ===========================================================================

-- 지우기 전에 한 번 더 셉니다. 예상과 다르면 손을 멈추고 확인해야 합니다.
SELECT 'prompts' AS 테이블, count(*) AS 행수 FROM public.prompts
UNION ALL SELECT 'sere_contents', count(*) FROM public.sere_contents
UNION ALL SELECT 'body_bti_results', count(*) FROM public.body_bti_results;

DROP TABLE IF EXISTS public.prompts;
DROP TABLE IF EXISTS public.sere_contents;
DROP TABLE IF EXISTS public.body_bti_results;

-- ---------------------------------------------------------------------------
-- 확인 — 셋 다 사라졌고, 남겨야 할 것은 그대로여야 합니다.
-- ---------------------------------------------------------------------------
SELECT tablename AS "남아 있으면 안 되는 것"
  FROM pg_tables WHERE schemaname='public'
   AND tablename IN ('prompts', 'sere_contents', 'body_bti_results');

SELECT tablename AS "남아 있어야 하는 것"
  FROM pg_tables WHERE schemaname='public'
   AND tablename IN ('missions', 'user_mission_progress', 'user_missions', 'user_journeys')
 ORDER BY tablename;
