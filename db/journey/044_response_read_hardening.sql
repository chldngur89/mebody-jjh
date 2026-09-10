-- ===========================================================================
-- MEBODY — 남의 진단 결과가 통째로 읽히는 문제 차단
--
-- 운영 DB 실측(적용 전):
--   · SELECT 정책이 두 개 다 넓다.
--       questionnaire_responses_select_anon  TO anon          USING (user_id IS NULL)
--       questionnaire_responses_select_own   TO authenticated USING (auth.uid()=user_id OR user_id IS NULL)
--     → **비회원이든 로그인 사용자든 id 를 몰라도 비회원 결과 전체를 읽는다.**
--       전체 399행 중 381행이 그대로 조회되고 32문항 answers 원문이 다 나온다.
--   · UPDATE 정책 questionnaire_responses_update_scoped 도 USING (user_id IS NULL OR ...)
--     → 위에서 id 를 긁어와 **남의 비회원 응답을 덮어쓸 수 있다.**
--   · INSERT 정책 "questionnaire_responses insert" 가 WITH CHECK (true)
--     → user_id 를 남의 것으로 적어 넣을 수 있다.
--
-- ★ 읽기 권한만 회수하면 저장이 깨진다 (실측으로 확인함)
--   `UPDATE ... WHERE id = $1` 은 WHERE 절이 컬럼을 읽으므로 SELECT 권한을 함께 요구한다.
--   anon 의 SELECT 를 회수한 채로 UPDATE 를 시키면 42501 이 난다.
--   그래서 저장을 SECURITY DEFINER 함수로 옮긴다. 읽기와 쓰기 둘 다 함수 한 곳으로만 나가고,
--   **id 를 아는 사람만 자기 결과 한 행**을 다룰 수 있다. 목록 조회(열거)는 불가능해진다.
--
-- 함께 배포해야 하는 앱 변경 (없으면 저장이 깨진다):
--   · src/api/questionnaire.ts  → save_questionnaire_response RPC
--   · src/api/account.ts        → claim_questionnaire_response / get_questionnaire_response RPC
--   · src/api/journey.ts        → get_questionnaire_response RPC
--   세 파일 모두 RPC 가 없으면 예전 경로로 폴백하므로 적용 순서는 상관없다.
--
-- 선행: 020~043 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 쓰기 통로 — 저장은 이 함수로만
--
--    비회원은 자기 결과의 uuid 를 알고 있다. 그 uuid 가 곧 열쇠다.
--    uuid 는 앱이 crypto.randomUUID() 로 만들어 추측할 수 없고,
--    이제 목록 조회가 막히므로 남의 uuid 를 알아낼 방법이 없다.
-- ---------------------------------------------------------------------------
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
  v_uid   uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION '결과 id 가 필요합니다' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('draft', 'completed') THEN
    RAISE EXCEPTION '허용되지 않는 status: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT r.user_id INTO v_owner
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

  -- 주인이 있는 행은 그 사람만 고친다. 비회원 행은 uuid 를 아는 사람이 주인이다.
  IF v_owner IS NOT NULL AND v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION '이 결과를 수정할 권한이 없습니다' USING ERRCODE = '42501';
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
  '진단 응답 저장(없으면 insert, 있으면 update). user_id 는 클라이언트 값을 믿지 않고 auth.uid() 로 정한다. 남의 결과는 42501.';

-- 로그인 직후 비회원 결과를 내 것으로 붙이는 경로 (account.ts attachQuestionnaireResultToUser)
CREATE OR REPLACE FUNCTION public.claim_questionnaire_response(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_id IS NULL THEN RETURN false; END IF;

  UPDATE public.questionnaire_responses
     SET user_id = v_uid, updated_at = now()
   WHERE id = p_id
     AND user_id IS NULL;          -- 이미 주인이 있으면 건드리지 않는다

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.claim_questionnaire_response(uuid) IS
  '주인 없는 결과를 로그인한 본인 것으로 귀속. 이미 주인이 있으면 false 를 돌려주고 아무것도 하지 않는다.';

-- ---------------------------------------------------------------------------
-- 2) 읽기 통로 — 이미 있는 함수 하나로만
-- ---------------------------------------------------------------------------
-- get_questionnaire_response(p_id) 는 이미 있다(SECURITY DEFINER).
-- id 로 한 행만 돌려주고 user_id 는 반환하지 않으며 남의 회원 결과는 0행이다.
COMMENT ON FUNCTION public.get_questionnaire_response(uuid) IS
  '결과 한 행 조회. 비회원의 유일한 읽기 통로다(테이블 직접 SELECT 는 044 에서 회수). user_id 는 돌려주지 않는다.';

-- ---------------------------------------------------------------------------
-- 3) 정책 정리 — 넓게 열린 것들을 좁힌다
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS questionnaire_responses_select_anon ON public.questionnaire_responses;
DROP POLICY IF EXISTS "Allow anonymous read access to questionnaire_responses" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "questionnaire_responses read" ON public.questionnaire_responses;

-- 로그인 사용자도 자기 결과만 본다 (기존 정책의 `OR user_id IS NULL` 제거)
DROP POLICY IF EXISTS questionnaire_responses_select_own ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_select_own ON public.questionnaire_responses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 남의 비회원 응답 덮어쓰기 차단. 로그인 사용자는 자기 행만(기존 "Users can update own responses").
DROP POLICY IF EXISTS questionnaire_responses_update_scoped ON public.questionnaire_responses;

-- WITH CHECK (true) 라 남의 user_id 를 적어 넣을 수 있던 INSERT 정책 교체
DROP POLICY IF EXISTS "questionnaire_responses insert" ON public.questionnaire_responses;
DROP POLICY IF EXISTS questionnaire_responses_insert_scoped ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_insert_scoped ON public.questionnaire_responses
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4) 권한 — anon 은 읽지도 고치지도 못한다
--
--    INSERT 는 남긴다. 새 행을 만드는 것뿐이라 남의 데이터에 닿지 않고,
--    RPC 가 아직 없는 앱 버전이 돌아가는 동안의 폴백 경로다.
-- ---------------------------------------------------------------------------
REVOKE SELECT, UPDATE ON public.questionnaire_responses FROM anon;

-- CREATE FUNCTION 은 PUBLIC 에 EXECUTE 를 자동으로 준다. PUBLIC 을 먼저 걷어내지 않으면
-- anon 에서만 회수해도 PUBLIC 을 통해 그대로 실행할 수 있다.
REVOKE ALL ON FUNCTION public.get_questionnaire_response(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_questionnaire_response(uuid, jsonb, text, text, timestamptz, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_questionnaire_response(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_questionnaire_response(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_questionnaire_response(uuid, jsonb, text, text, timestamptz, text, text, jsonb) TO anon, authenticated, service_role;
-- 귀속은 로그인 사용자만.
-- Supabase 는 public 스키마의 새 함수에 ALTER DEFAULT PRIVILEGES 로 anon 에게도 EXECUTE 를 준다.
-- PUBLIC 회수만으로는 anon 의 개별 권한이 남으므로 anon 을 따로 한 번 더 걷어낸다.
GRANT EXECUTE ON FUNCTION public.claim_questionnaire_response(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_questionnaire_response(uuid) FROM anon;

-- ---------------------------------------------------------------------------
-- 5) 확인
-- ---------------------------------------------------------------------------
SELECT grantee AS 역할, string_agg(privilege_type, ',' ORDER BY privilege_type) AS 권한
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'questionnaire_responses'
   AND grantee IN ('anon', 'authenticated')
 GROUP BY grantee ORDER BY grantee;

SELECT policyname AS 정책, cmd AS 동작, roles::text AS 역할, qual AS 조건, with_check AS 검사
  FROM pg_policies WHERE tablename = 'questionnaire_responses' ORDER BY cmd, policyname;

-- 역할을 바꿔 세어보는 방식은 쓸 수 없다. SELECT 를 회수해서 그 조회 자체가 막히기 때문이다.
SELECT has_table_privilege('anon', 'public.questionnaire_responses', 'SELECT') AS "익명_읽기(false여야)",
       has_table_privilege('anon', 'public.questionnaire_responses', 'UPDATE') AS "익명_수정(false여야)",
       has_table_privilege('anon', 'public.questionnaire_responses', 'INSERT') AS "익명_생성(true여야)",
       has_function_privilege('anon', 'public.get_questionnaire_response(uuid)', 'EXECUTE')  AS "익명_조회RPC(true여야)",
       has_function_privilege('anon', 'public.save_questionnaire_response(uuid,jsonb,text,text,timestamptz,text,text,jsonb)', 'EXECUTE') AS "익명_저장RPC(true여야)",
       has_function_privilege('anon', 'public.claim_questionnaire_response(uuid)', 'EXECUTE') AS "익명_귀속RPC(false여야)";
