-- ===========================================================================
-- MEBODY — 전문가가 자기 고객의 결과를 읽는 유일한 통로
--
-- ※ db/journey 폴더의 053 입니다.
--
-- 왜 함수인가:
--   questionnaire_responses 의 SELECT 정책을 넓히면 044 를 되돌리는 셈입니다.
--   044 적용 전 실측: 전체 399행 중 381행이 id 없이 읽혔고 32문항 답변 원문이 그대로 나왔습니다.
--   그래서 **테이블 정책은 손대지 않고** 함수 하나만 더 엽니다.
--
-- 통과 조건 세 가지를 모두 만족해야 합니다:
--   1. 호출자가 활성 전문가인가            (current_professional_id() IS NOT NULL)
--   2. 그 고객과의 관계가 ACTIVE 인가       (professional_clients.status)
--   3. 고객이 동의했는가                   (consented_at IS NOT NULL)
--
--   하나라도 어긋나면 **오류가 아니라 0행**입니다. 오류가 갈리면 관계 여부를 떠볼 수 있습니다.
--
-- 반환하지 않는 것: user_id, 이메일, 전화번호.
--   get_questionnaire_response 와 같은 원칙입니다. 전문가에게 필요한 건 몸 상태지 연락처가 아닙니다.
--
-- 선행: 052 적용 완료
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_client_response(p_client_user_id uuid)
RETURNS TABLE (
  client_user_id   uuid,
  calculated_code  varchar,
  primary_identity text,
  scoring_meta     jsonb,
  completed_at     timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pro uuid := public.current_professional_id();
BEGIN
  IF v_pro IS NULL OR p_client_user_id IS NULL THEN
    RETURN;  -- 0행. 전문가가 아니면 아무것도 알려주지 않습니다.
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.professional_clients pc
     WHERE pc.professional_id = v_pro
       AND pc.client_user_id  = p_client_user_id
       AND pc.status          = 'ACTIVE'
       AND pc.consented_at IS NOT NULL
  ) THEN
    RETURN;  -- 0행. 내 고객이 아니거나 아직 동의 전입니다.
  END IF;

  RETURN QUERY
  SELECT p_client_user_id,
         r.calculated_code,
         r.primary_identity,
         r.scoring_meta,
         r.completed_at
    FROM public.questionnaire_responses r
   WHERE r.user_id = p_client_user_id
     AND r.status = 'completed'
     AND r.calculated_code IS NOT NULL
   ORDER BY r.completed_at DESC NULLS LAST, r.created_at DESC
   LIMIT 1;  -- 가장 최근 결과 한 건. 과거 이력은 Phase 2 에서 따로 엽니다.
END;
$$;

COMMENT ON FUNCTION public.get_client_response(uuid) IS
  '전문가가 자기 고객의 최신 결과를 읽는 유일한 통로. 관계가 ACTIVE 이고 동의가 있어야 한다. 아니면 0행. user_id·연락처는 돌려주지 않는다.';

-- CREATE FUNCTION 은 PUBLIC 에 EXECUTE 를 준다. 044 에서와 같은 이유로 먼저 걷어낸다.
REVOKE ALL ON FUNCTION public.get_client_response(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_response(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_client_response(uuid) FROM anon;

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT has_function_privilege('authenticated', 'public.get_client_response(uuid)', 'EXECUTE') AS "회원_실행(true여야)",
       has_function_privilege('anon', 'public.get_client_response(uuid)', 'EXECUTE')          AS "익명_실행(false여야)";

-- questionnaire_responses 정책은 그대로여야 합니다 (044 상태 유지 확인)
SELECT policyname AS 정책, cmd AS 동작, roles::text AS 역할
  FROM pg_policies WHERE tablename = 'questionnaire_responses' ORDER BY cmd, policyname;
