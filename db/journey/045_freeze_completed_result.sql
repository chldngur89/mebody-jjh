-- ===========================================================================
-- MEBODY — 제출이 끝난 결과는 더 이상 바뀌지 않는다
--
-- 044 로 목록 조회는 막았지만, **result id 를 아는 사람은 결과를 덮어쓸 수 있었습니다.**
-- 실측(익명 키, 운영):
--   POST /rest/v1/rpc/save_questionnaire_response {p_id: <남의 id>, p_calculated_code: 'CLLF', ...}
--     → 200. 코드가 FRRS 에서 CLLF 로 바뀌고 32문항 답변이 통째로 교체됨.
--
-- id 는 앱 주소창(?result=...)에 그대로 보입니다. 결과 화면 URL 을 그대로 복사해
-- 보내는 사람이 있을 수밖에 없으므로, id 가 새더라도 **고쳐지지는 않아야** 합니다.
--
-- 이 파일이 하는 일:
--   status = 'completed' 인 행은 save_questionnaire_response 로 쓰기가 되지 않습니다.
--   단, 같은 결과를 다시 보내는 요청은 오류 대신 그냥 통과시킵니다(아무것도 쓰지 않음).
--   앱이 저장 실패로 판단해 한 번 더 보내는 경로가 있기 때문입니다
--   (App.tsx persistAnalysisResult 의 재시도, 그리고 제출 직후 늦게 도착하는 임시저장).
--
-- 곁들여 고쳐지는 것: 제출 뒤 늦게 도착한 임시저장이 완료된 결과를 draft 로
--   되돌리던 문제도 함께 사라집니다.
--
-- 재측정은 영향이 없습니다. 새 진단은 새 id 로 새 행을 만듭니다.
--
-- 선행: 044 적용 완료
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.save_questionnaire_response(
  p_id               uuid,
  p_answers          jsonb,
  p_status           text        DEFAULT 'draft',
  p_calculated_code  text        DEFAULT NULL,
  p_completed_at     timestamptz DEFAULT NULL,
  p_question_version text        DEFAULT NULL,
  p_primary_identity text        DEFAULT NULL,
  p_scoring_meta     jsonb       DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_status text;
  v_code   text;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION '결과 id 가 필요합니다' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('draft', 'completed') THEN
    RAISE EXCEPTION '허용되지 않는 status: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT r.user_id, r.status, r.calculated_code
    INTO v_owner, v_status, v_code
    FROM public.questionnaire_responses r
   WHERE r.id = p_id
     FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.questionnaire_responses
      (id, user_id, answers, status, calculated_code, completed_at,
       question_version, primary_identity, scoring_meta, updated_at)
    VALUES
      (p_id, v_uid, coalesce(p_answers, '{}'::jsonb), p_status, p_calculated_code, p_completed_at,
       p_question_version, p_primary_identity, coalesce(p_scoring_meta, '{}'::jsonb), now());
    RETURN p_id;
  END IF;

  -- 주인이 있는 행은 그 사람만 건드린다. 비회원 행은 uuid 를 아는 사람이 주인이다.
  IF v_owner IS NOT NULL AND v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION '이 결과를 수정할 권한이 없습니다' USING ERRCODE = '42501';
  END IF;

  -- ★ 제출이 끝난 결과는 확정본이다.
  IF v_status = 'completed' THEN
    IF p_calculated_code IS NOT NULL AND p_calculated_code IS DISTINCT FROM v_code THEN
      RAISE EXCEPTION '이미 제출된 결과는 수정할 수 없습니다' USING ERRCODE = '42501';
    END IF;
    -- 같은 결과의 재전송. 오류로 만들지 않고 아무것도 쓰지 않은 채 끝낸다.
    RETURN p_id;
  END IF;

  UPDATE public.questionnaire_responses r
     SET answers          = coalesce(p_answers, r.answers),
         status           = p_status,
         calculated_code  = coalesce(p_calculated_code, r.calculated_code),
         completed_at     = coalesce(p_completed_at, r.completed_at),
         question_version = coalesce(p_question_version, r.question_version),
         primary_identity = coalesce(p_primary_identity, r.primary_identity),
         scoring_meta     = coalesce(p_scoring_meta, r.scoring_meta),
         -- 비회원으로 풀다가 로그인하고 제출하면 그때 주인이 정해진다
         user_id          = coalesce(r.user_id, v_uid),
         updated_at       = now()
   WHERE r.id = p_id;

  RETURN p_id;
END;
$$;

COMMENT ON FUNCTION public.save_questionnaire_response(uuid, jsonb, text, text, timestamptz, text, text, jsonb) IS
  '진단 응답 저장(없으면 insert, 있으면 update). user_id 는 auth.uid() 로 정한다. 남의 결과는 42501. 제출이 끝난 결과(status=completed)는 더 이상 바뀌지 않는다.';

-- CREATE OR REPLACE 는 권한을 유지하지만, 시그니처가 같은지 확인 겸 다시 정리한다.
REVOKE ALL ON FUNCTION public.save_questionnaire_response(uuid, jsonb, text, text, timestamptz, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_questionnaire_response(uuid, jsonb, text, text, timestamptz, text, text, jsonb) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT has_function_privilege('anon', 'public.save_questionnaire_response(uuid,jsonb,text,text,timestamptz,text,text,jsonb)', 'EXECUTE') AS "익명_저장RPC(true여야)",
       has_table_privilege('anon', 'public.questionnaire_responses', 'SELECT') AS "익명_읽기(false여야)",
       has_table_privilege('anon', 'public.questionnaire_responses', 'UPDATE') AS "익명_수정(false여야)";
