-- MEBODY — 개발계 보안 하드닝 (앱 코드 변경 없이 적용 가능한 부분)
--
-- 2026-08-29 개발계 점검에서 확인된 문제:
--
--   1) body_code_content   RLS 꺼짐 + anon DELETE 권한
--      → 브라우저 번들에 실려 나가는 공개 anon 키로 결과 콘텐츠 16행 삭제 가능
--   2) admin_audit_logs    RLS 꺼짐 + anon 전체 권한
--      → 감사 로그 열람·위조·삭제 가능
--   3) questionnaire_responses  "Allow anonymous access ... FOR ALL USING (true)"
--      → 남의 응답 380행 열람·수정·삭제 가능
--   4) public 전 테이블에 anon INSERT/UPDATE/DELETE 권한이 부여되어 있음
--
-- 이 파일은 (1)(2)(4) 와 (3) 중 "읽기 제한을 제외한" 부분을 고칩니다.
-- (3) 의 anon 읽기 차단은 앱이 RPC 로 읽도록 바꿔야 하므로 210 에서 따로 다룹니다.
--
-- 적용해도 현재 앱 동작은 그대로입니다. 콘텐츠 조회는 SELECT 만 쓰고,
-- 설문 저장은 INSERT/UPDATE 만 쓰기 때문입니다.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) 모든 테이블 RLS 활성화 + anon/authenticated 권한 전면 회수 후 재부여
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT relname FROM pg_class
            WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.relname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) 콘텐츠 · 카탈로그 — 읽기만 재부여
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

GRANT SELECT ON public.products TO anon, authenticated;
DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products
  FOR SELECT TO anon, authenticated USING (status = 'ACTIVE');

-- ---------------------------------------------------------------------------
-- 3) 사용자 프로필 — 본인 행만
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) 설문 응답 — 위험한 "FOR ALL USING (true)" 정책 제거
--
--    비회원 진단이 계속 동작해야 하므로 INSERT/UPDATE 는 유지합니다.
--    읽기 차단은 210 에서 앱 변경과 함께 적용합니다.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow anonymous access to questionnaire_responses" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "questionnaire_responses update" ON public.questionnaire_responses;

GRANT SELECT, INSERT, UPDATE ON public.questionnaire_responses TO anon, authenticated;

DROP POLICY IF EXISTS questionnaire_responses_update_scoped ON public.questionnaire_responses;
CREATE POLICY questionnaire_responses_update_scoped ON public.questionnaire_responses
  FOR UPDATE TO anon, authenticated
  -- 주인이 없는 행이거나 본인 행만. 남의 완료 결과는 수정할 수 없다.
  USING (user_id IS NULL OR auth.uid() = user_id)
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5) 서버 전용 테이블 — 클라이언트 권한 없음 (service_role 만 접근)
--    admin_audit_logs / missions / user_mission_progress / body_bti_results
--    위 1)에서 이미 회수했고 정책도 부여하지 않는다.
-- ---------------------------------------------------------------------------

COMMIT;
