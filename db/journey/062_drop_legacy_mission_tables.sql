-- ===========================================================================
-- MEBODY — 저니가 대체한 옛 미션 테이블 정리
--
-- ※ db/journey 폴더의 062 입니다. **서버 코드를 먼저 고친 뒤에** 돌립니다.
--
-- ── 순서가 중요합니다
-- 061 을 쓸 때 이 둘도 같이 지우려다 멈췄습니다. 행은 0이지만 살아 있는 경로
-- (GET /api/me/missions, 홈페이지 「미션 진행」 카드)가 읽고 있었기 때문입니다.
-- 테이블만 먼저 지웠으면 그 화면이 500 이 났습니다.
--
-- 그래서 서버를 먼저 고쳤습니다.
--   · MissionService 가 user_mission_progress 대신 **user_missions** 를 읽습니다.
--     덤으로, 늘 "0% · 미션 없음" 만 보이던 카드가 실제 숫자를 보여주게 됐습니다.
--   · Mission · UserMissionProgress · BodyBtiResult 엔티티와 리포지터리 6개 파일을 걷어냈습니다.
--     서로만 참조하는 닫힌 고리였습니다.
--
-- 이 마이그레이션은 **그 배포가 끝난 뒤에** 돌려야 합니다. 옛 코드가 아직 떠 있는데
-- 테이블을 지우면 그 인스턴스가 500 을 냅니다.
--
-- ── 되돌리기
-- 두 테이블 모두 0행이라 되살릴 데이터가 없습니다. 컬럼 정의는
-- db/journey/backup_legacy_tables_061.sql 끝에 주석으로 적어 두었습니다.
--
-- 선행: 061 적용 + 서버 재배포(MissionService 교체본)
-- ===========================================================================

-- 지우기 전에 셉니다. 0이 아니면 손을 멈추고 확인해야 합니다.
SELECT 'missions' AS 테이블, count(*) AS 행수 FROM public.missions
UNION ALL SELECT 'user_mission_progress', count(*) FROM public.user_mission_progress;

DROP TABLE IF EXISTS public.user_mission_progress;
DROP TABLE IF EXISTS public.missions;

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT tablename AS "남아 있으면 안 되는 것"
  FROM pg_tables WHERE schemaname='public' AND tablename IN ('missions', 'user_mission_progress');

-- 진짜 미션은 그대로여야 합니다.
SELECT count(*) AS "user_missions 행수" FROM public.user_missions;
