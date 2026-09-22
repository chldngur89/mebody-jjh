-- ===========================================================================
-- MEBODY — 옛 진단 응답 정리
--
-- ※ 번호 주의: db/v1 에도 051 이 있습니다(에러 로그 정책). 이 파일은 db/journey 쪽입니다.
--
-- 지울 것 (실측):
--   v2_40           224건  2026-02-05 ~ 04-26   전부 비회원
--   v3_49_precheck  120건  2026-04-28 ~ 07-23   회원 6건 포함
--   버전 없음          8건  2026-05-03 ~ 05-04   전부 비회원, 답변 49~50개
--                   ----
--                   352건
--
--   버전 없는 8건은 답변 수(49~50개)로 보아 v3_49_precheck 과 같은 시기의 것입니다.
--   버전만 안 찍혔을 뿐 같은 옛 문항 세트라 함께 지웁니다.
--
-- 남길 것: mebody_v1_32 68건. 지금 쓰는 32문항 응답입니다.
--
-- 확인한 것:
--   · 이 응답들을 가리키는 저니 0건. (user_journeys 는 ON DELETE SET NULL 이라
--     설령 있어도 저니는 남고 연결만 끊깁니다)
--   · 회원 6건은 chldngur89@gmail.com 것입니다. 지우면 그 계정의 결과 기록이 0건이 됩니다.
--     다만 user_profiles.body_bti_code 에 FRRS 가 따로 남아 있어, 앱은 코드만으로
--     결과 화면을 그리는 경로(resultData 의 applyCodeOnlyFallback)로 계속 보여줍니다.
--     사라지는 것은 그때의 답변 원문과 축 상세입니다.
--
-- 되살리려면: db/journey/backup_legacy_questionnaire_responses.sql 을 실행하십시오.
--   지우기 직전에 352행을 전부 INSERT 문으로 떠두었습니다.
--
-- 선행: 050 적용 완료
-- ===========================================================================

DO $$
DECLARE
  v_before  integer;
  v_keep    integer;
  v_removed integer;
  v_after   integer;
BEGIN
  SELECT count(*) INTO v_before FROM public.questionnaire_responses;
  SELECT count(*) INTO v_keep   FROM public.questionnaire_responses WHERE question_version = 'mebody_v1_32';

  IF v_keep = 0 THEN
    RAISE EXCEPTION '지금 쓰는 mebody_v1_32 응답이 0건입니다. 무언가 잘못됐으니 멈춥니다.';
  END IF;

  DELETE FROM public.questionnaire_responses
   WHERE question_version IS NULL
      OR question_version <> 'mebody_v1_32';
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  SELECT count(*) INTO v_after FROM public.questionnaire_responses;

  IF v_after <> v_keep THEN
    RAISE EXCEPTION '남은 응답이 %건인데 mebody_v1_32 는 %건입니다. 되돌립니다.', v_after, v_keep;
  END IF;

  RAISE NOTICE '옛 응답 %건을 지웠습니다. 남은 응답 %건(전부 mebody_v1_32).', v_removed, v_after;
END $$;

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT coalesce(question_version, '(없음)') AS 문항버전,
       count(*)::int AS 건수,
       count(user_id)::int AS 회원귀속
  FROM public.questionnaire_responses
 GROUP BY 1 ORDER BY 2 DESC;

SELECT count(*)::int AS "저니(그대로 남아야)" FROM public.user_journeys;
