-- ===========================================================================
-- MEBODY 개발계 — 검증이 남긴 테스트 데이터 정리 (2026-09-02 기준)
--
-- Supabase SQL Editor 에 통째로 붙여 한 번 실행하면 됩니다.
--
-- 안전장치: 지운 뒤 응답 수가 380 이 아니면 스스로 예외를 던져 **자동 롤백**합니다.
-- (에디터는 중간 SELECT 를 보여주지 않으므로 사람이 눈으로 확인할 수 없습니다.
--  그래서 확인을 SQL 안에 넣었습니다.)
--
-- ID 를 나열하지 않고 "흔적(signature)" 으로 지웁니다.
-- 검증을 더 돌려 행이 늘어나도 이 파일을 고치지 않고 다시 쓸 수 있습니다.
-- ===========================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1) 저니 · 미션 · 적립
--    개발계에는 실사용 저니가 없습니다. 전부 검증으로 생긴 것입니다.
--    (적립 원장을 남겨두면 잔액이 어긋나 다음 검증이 오염됩니다)
-- ---------------------------------------------------------------------------
DELETE FROM public.journey_mission_feedback;
DELETE FROM public.journey_reports;
DELETE FROM public.user_rewards;
DELETE FROM public.user_missions;
DELETE FROM public.user_journeys;

-- ---------------------------------------------------------------------------
-- 2) verify-hardening 스크립트가 남긴 초안/결과
--    (스크립트는 이제 서비스 롤로 스스로 정리합니다. 과거 잔여분만 지웁니다)
-- ---------------------------------------------------------------------------
DELETE FROM public.questionnaire_responses
WHERE answers->>'__qa' = 'verify-hardening';

-- ---------------------------------------------------------------------------
-- 3) 앱의 [임시] 32문항 채우고 결과 보기 버튼이 만든 행
--    32문항이 전부 '②' 인 것만 지웁니다. 실제 사용자가 이렇게 답할 가능성은
--    사실상 없지만, 안전하게 검증 시작일 이후로 한정합니다.
-- ---------------------------------------------------------------------------
DELETE FROM public.questionnaire_responses
WHERE question_version = 'mebody_v1_32'
  AND jsonb_typeof(answers) = 'object'
  AND (SELECT count(*) FROM jsonb_each_text(answers)) = 32
  AND NOT EXISTS (SELECT 1 FROM jsonb_each_text(answers) WHERE value <> '②')
  AND created_at > timestamptz '2026-08-26';

-- ---------------------------------------------------------------------------
-- 4) 안전장치 — 380 이 아니면 예외를 던져 트랜잭션 전체를 되돌립니다.
--    (예상과 다른 데이터를 지우고 커밋해 버리는 사고를 막습니다)
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.questionnaire_responses;
  IF v_n <> 380 THEN
    RAISE EXCEPTION '정리 후 응답 수가 380 이 아니라 % 입니다. 아무것도 지우지 않고 되돌립니다.', v_n;
  END IF;
  RAISE NOTICE '정리 완료 — 응답 % 행', v_n;
END $$;

COMMIT;

-- 실행 후 확인용 (선택)
SELECT
  (SELECT count(*) FROM public.questionnaire_responses) AS responses,
  (SELECT count(*) FROM public.user_journeys)           AS journeys,
  (SELECT count(*) FROM public.user_missions)           AS missions,
  (SELECT count(*) FROM public.user_rewards)            AS rewards;
