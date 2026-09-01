-- MEBODY — RLS 정책 (운영계 기준)
--
-- 개발계 정책을 그대로 복사하지 않습니다. 개발계에는 아래 구멍이 있었습니다.
--
--   body_code_content        RLS 꺼짐 + anon DELETE 권한 → 공개 키로 콘텐츠 16행 삭제 가능
--   admin_audit_logs         RLS 꺼짐 + anon 전체 권한   → 감사 로그 열람·위조·삭제 가능
--   questionnaire_responses  "FOR ALL USING (true)" 정책 → 남의 응답 380행 열람·수정·삭제 가능
--   전 테이블                anon 에 INSERT/UPDATE/DELETE 권한이 부여되어 있음
--
-- anon 키는 브라우저 번들에 실려 나가는 공개 키입니다. 비밀이 아닙니다.
-- 여기서는 필요한 권한만 명시적으로 부여합니다.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) 기본 정리 — 공개 스키마 전체에서 anon/authenticated 쓰기 권한을 회수
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT relname FROM pg_class
            WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.relname);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 1) 콘텐츠 · 카탈로그 — 누구나 읽기, 쓰기는 서비스 역할만
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'questions','question_choice_scores','body_code_content','body_code_next_page',
    'body_code_result_sections','result_guide','app_content','app_images',
    'immediate_action_content','immediate_action_axis_mapping','immediate_action_discomfort_mapping'
  ] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_public_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
                   t || '_public_read', t);
  END LOOP;
END $$;

-- 상품은 판매 중인 것만 공개
GRANT SELECT ON public.products TO anon, authenticated;
DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products
  FOR SELECT TO anon, authenticated USING (status = 'ACTIVE');

-- ---------------------------------------------------------------------------
-- 2) 사용자 프로필 — 본인 행만
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR auth.uid() = auth_user_id);

DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id OR auth.uid() = auth_user_id);

DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = id OR auth.uid() = auth_user_id);

-- ---------------------------------------------------------------------------
-- 3) 설문 응답 — 가장 조심해야 할 테이블
--
-- 비회원도 진단할 수 있어야 하므로 INSERT 는 열어야 합니다.
-- 다만 "남의 응답을 읽거나 고치는 것"은 반드시 막아야 합니다.
--
--   INSERT : anon 은 user_id 가 NULL 인 행만 생성 가능
--   UPDATE : 로그인 사용자는 본인 행만. 비회원 초안 갱신은 아래 RPC 로만.
--   SELECT : 로그인 사용자는 본인 행만. 비회원 조회는 아래 RPC 로만.
--
-- 비회원은 자기 응답의 UUID 를 알고 있습니다(생성 시 받음). 그 UUID 를 아는 사람만
-- 읽고 쓸 수 있게 SECURITY DEFINER 함수로 좁혀서 노출합니다.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.questionnaire_responses TO authenticated;
GRANT INSERT ON public.questionnaire_responses TO anon;

DROP POLICY IF EXISTS questionnaire_responses_select_own ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_select_own ON public.questionnaire_responses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS questionnaire_responses_insert_anon ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_insert_anon ON public.questionnaire_responses
  FOR INSERT TO anon WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS questionnaire_responses_insert_own ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_insert_own ON public.questionnaire_responses
  FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS questionnaire_responses_update_own ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_update_own ON public.questionnaire_responses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 비회원 조회: UUID 를 아는 경우에만 한 행을 돌려준다.
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
     -- 로그인 사용자는 본인 것만. 비회원 응답은 UUID 를 아는 사람만.
     AND (r.user_id IS NULL OR r.user_id = auth.uid());
$$;

-- 비회원 초안 갱신: UUID 를 아는 경우에만, 아직 주인이 없는 행에 한해.
CREATE OR REPLACE FUNCTION public.update_anonymous_response(p_id uuid, p_patch jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE public.questionnaire_responses r
     SET answers        = COALESCE((p_patch->'answers')::jsonb, r.answers),
         calculated_code= COALESCE(p_patch->>'calculated_code', r.calculated_code),
         status         = COALESCE(p_patch->>'status', r.status),
         primary_identity = COALESCE(p_patch->>'primary_identity', r.primary_identity),
         scoring_meta   = COALESCE((p_patch->'scoring_meta')::jsonb, r.scoring_meta),
         question_version = COALESCE(p_patch->>'question_version', r.question_version),
         completed_at   = COALESCE((p_patch->>'completed_at')::timestamptz, r.completed_at),
         updated_at     = now()
   WHERE r.id = p_id AND r.user_id IS NULL
  RETURNING r.id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.get_questionnaire_response(uuid)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_anonymous_response(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_questionnaire_response(uuid)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_anonymous_response(uuid, jsonb) TO anon;

-- ---------------------------------------------------------------------------
-- 4) 서버 전용 테이블 — 클라이언트 접근 없음 (Spring 은 service_role 로 접근)
--    admin_audit_logs / missions / user_mission_progress / body_bti_results
--    권한을 주지 않으므로 정책도 필요 없습니다.
-- ---------------------------------------------------------------------------

COMMIT;

-- ---------------------------------------------------------------------------
-- 적용 후 확인 (anon 키로)
--   GET /rest/v1/questionnaire_responses  -> [] 또는 permission denied
--   GET /rest/v1/body_code_content        -> 16행 (읽기만)
--   DELETE /rest/v1/body_code_content     -> 거부
--   GET /rest/v1/admin_audit_logs         -> 거부
-- ---------------------------------------------------------------------------
