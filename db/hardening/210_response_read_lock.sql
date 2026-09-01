-- MEBODY — 설문 응답 읽기 제한 (1단계: 회원 응답 보호)
--
-- 200 을 적용해도 아래 정책이 남아 남의 응답을 전부 읽을 수 있습니다.
--   "questionnaire_responses read"  FOR SELECT USING (true)   → 380행 전부 열람
--
-- 여기서는 회원 응답을 먼저 보호합니다. 비회원 응답 열거까지 막으려면
-- INSERT 도 RPC 로 바꿔야 하므로 220 에서 앱 변경과 함께 진행합니다.
--
-- 왜 SELECT 정책을 완전히 지우면 안 되는가
--   앱은 insert(...).select().single() 로 저장합니다. 이는 INSERT ... RETURNING 이고,
--   RETURNING 은 반환 행을 읽을 SELECT 권한을 요구합니다.
--   SELECT 정책을 모두 지우면 비회원 진단 저장 자체가 42501 로 실패합니다.
--   (드라이런에서 실제로 재현했습니다)

BEGIN;

-- UUID 를 아는 경우에만 한 행을 돌려주는 조회 함수. 앱이 우선 사용합니다.
CREATE OR REPLACE FUNCTION public.get_questionnaire_response(p_id uuid)
RETURNS TABLE (
  id uuid, answers jsonb, calculated_code varchar, status text,
  primary_identity text, scoring_meta jsonb,
  created_at timestamptz, updated_at timestamptz, completed_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.id, r.answers, r.calculated_code, r.status,
         r.primary_identity, r.scoring_meta,
         r.created_at, r.updated_at, r.completed_at
    FROM public.questionnaire_responses r
   WHERE r.id = p_id
     AND (r.user_id IS NULL OR r.user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_questionnaire_response(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_questionnaire_response(uuid) TO anon, authenticated;

-- 전체 열람을 허용하던 정책 제거
DROP POLICY IF EXISTS "questionnaire_responses read" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "Users can view own responses" ON public.questionnaire_responses;

-- 비회원: 주인이 없는 행만 읽을 수 있다.
--   회원의 완료 결과(user_id 있음)는 더 이상 보이지 않는다.
--   INSERT ... RETURNING 이 동작하려면 이 정책이 필요하다.
DROP POLICY IF EXISTS questionnaire_responses_select_anon ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_select_anon ON public.questionnaire_responses
  FOR SELECT TO anon USING (user_id IS NULL);

-- 로그인 사용자: 본인 행 + 아직 귀속되지 않은 행(로그인 직후 귀속 처리에 필요)
DROP POLICY IF EXISTS questionnaire_responses_select_own ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_select_own ON public.questionnaire_responses
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

COMMIT;

-- 남은 위험
--   비회원 응답(user_id IS NULL)은 여전히 열거 가능합니다.
--   답변과 계산된 코드만 있고 이름·이메일·사용자 ID 는 없지만, 완전한 차단은 아닙니다.
--   220 에서 INSERT 를 RPC 로 바꾸면 이 정책도 제거할 수 있습니다.
