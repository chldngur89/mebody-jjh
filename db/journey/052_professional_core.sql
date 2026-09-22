-- ===========================================================================
-- MEBODY — 전문가(트레이너·물리치료사) 기반
--
-- ※ 번호 주의: db/v1 에도 050·051 이 있습니다. 이 파일은 db/journey 쪽입니다.
--
-- 무엇을 만드나:
--   professionals          전문가. user_profiles 와 1:1
--   professional_clients   전문가 ↔ 고객. 초대와 관계를 한 행으로 다룹니다
--   current_professional_id()  RLS 에서 "나는 어느 전문가인가" 를 판정
--
-- 왜 이 모양인가:
--   판매자(SELLER) 모델이 이미 같은 일을 하고 있습니다. 역할 CHECK, current_seller_id(),
--   소유자 RLS, 관리자 콘솔 탭, 검증 22건이 다 돕니다. 전문가는 그 패턴을 한 벌 더 뜬 것입니다.
--   새 인증 체계나 별도 콘솔을 만들지 않습니다.
--
--   초대 전용 테이블을 만들지 않습니다. professional_clients 에 status='INVITED' 와
--   invite_token 으로 흡수합니다. 고객이 링크를 열어 동의하면 같은 행이 ACTIVE 가 됩니다.
--   따로 두면 "초대했는데 관계가 없는" 중간 상태가 생깁니다.
--
-- ★ 고객 데이터 접근은 이 파일에 없습니다.
--   questionnaire_responses 의 정책은 **건드리지 않습니다.** 044·045 로 막 잠근 자리이고,
--   넓히면 전체 399행 중 381행이 id 없이 읽히던 상태로 돌아갑니다.
--   전문가 열람은 053 의 SECURITY DEFINER 함수로만 나갑니다.
--
-- 선행: 051 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 역할에 PROFESSIONAL 추가
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role = ANY (ARRAY['MEMBER'::text, 'SELLER'::text, 'ADMIN'::text, 'PROFESSIONAL'::text]));

-- ---------------------------------------------------------------------------
-- 2) 전문가
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professionals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id uuid NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('PERSONAL_TRAINER', 'PHYSIO')),
  display_name    text,
  status          text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.professionals IS
  '전문가. user_profiles 와 1:1. 자격·소개는 여기에 두고 user_profiles 에는 role 만 둔다(일반 회원에게 빈 컬럼을 늘리지 않으려고).';

-- ---------------------------------------------------------------------------
-- 3) 전문가 ↔ 고객 (초대 포함)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professional_clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  -- 수락 전에는 누구인지 모릅니다. 그래서 nullable 입니다.
  client_user_id  uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  invite_token    text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED', 'ACTIVE', 'REVOKED')),
  invited_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  -- 고객이 "내 결과를 보여주겠다" 를 누른 시각. 이 값이 없으면 아무것도 보이지 않습니다.
  consented_at    timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS professional_clients_pair_idx
  ON public.professional_clients (professional_id, client_user_id)
  WHERE client_user_id IS NOT NULL;

COMMENT ON TABLE public.professional_clients IS
  '전문가와 고객의 관계. 초대(INVITED)와 수락(ACTIVE)과 해지(REVOKED)가 한 행이다. consented_at 이 없으면 전문가는 아무것도 볼 수 없다.';

-- ---------------------------------------------------------------------------
-- 4) RLS 헬퍼 — current_seller_id() 와 같은 모양
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_professional_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  SELECT pr.id INTO v_id
    FROM public.professionals pr
    JOIN public.user_profiles p ON p.id = pr.user_profile_id
   WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
     AND p.role = 'PROFESSIONAL'
     AND pr.status = 'ACTIVE'
   LIMIT 1;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.current_professional_id() IS
  'RLS 에서 쓰는 헬퍼. 지금 로그인한 사람이 활성 전문가면 그 id, 아니면 NULL.';

-- ---------------------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.professionals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS professionals_read_own ON public.professionals;
CREATE POLICY professionals_read_own ON public.professionals
  FOR SELECT TO authenticated
  USING (id = public.current_professional_id() OR public.current_user_role() = 'ADMIN');

-- 전문가 승인은 사람이 합니다. 앱에서 스스로 전문가가 될 수 없습니다.
DROP POLICY IF EXISTS professionals_admin_write ON public.professionals;
CREATE POLICY professionals_admin_write ON public.professionals
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS professional_clients_read ON public.professional_clients;
CREATE POLICY professional_clients_read ON public.professional_clients
  FOR SELECT TO authenticated
  USING (
    professional_id = public.current_professional_id()
    OR client_user_id = auth.uid()
    OR public.current_user_role() = 'ADMIN'
  );

-- 전문가는 자기 초대만 만듭니다.
DROP POLICY IF EXISTS professional_clients_invite ON public.professional_clients;
CREATE POLICY professional_clients_invite ON public.professional_clients
  FOR INSERT TO authenticated
  WITH CHECK (professional_id = public.current_professional_id());

-- 고객은 자기 행(수락·해지)만, 전문가는 자기 초대만 고칩니다.
DROP POLICY IF EXISTS professional_clients_update ON public.professional_clients;
CREATE POLICY professional_clients_update ON public.professional_clients
  FOR UPDATE TO authenticated
  USING (professional_id = public.current_professional_id() OR client_user_id = auth.uid())
  WITH CHECK (professional_id = public.current_professional_id() OR client_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6) 권한 — Supabase 기본값(GRANT ALL)을 그대로 두면 안 됩니다
--
--    기본값에는 TRUNCATE 가 들어 있고 **TRUNCATE 는 RLS 를 우회합니다.**
--    041(payments)·048(app_error_log)에서 같은 일이 있었습니다.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.professionals        FROM anon, authenticated;
REVOKE ALL ON public.professional_clients FROM anon, authenticated;

GRANT SELECT                 ON public.professionals        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.professional_clients TO authenticated;
GRANT ALL PRIVILEGES         ON public.professionals        TO service_role;
GRANT ALL PRIVILEGES         ON public.professional_clients TO service_role;

REVOKE ALL ON FUNCTION public.current_professional_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_professional_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.current_professional_id() FROM anon;

-- ---------------------------------------------------------------------------
-- 7) 확인
-- ---------------------------------------------------------------------------
SELECT grantee AS 역할, table_name AS 테이블,
       string_agg(privilege_type, ',' ORDER BY privilege_type) AS 권한
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name IN ('professionals', 'professional_clients')
   AND grantee IN ('anon', 'authenticated')
 GROUP BY 1, 2 ORDER BY 2, 1;

SELECT count(*)::int AS "앱 역할에 TRUNCATE 가 열린 테이블(0이어야)"
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND privilege_type = 'TRUNCATE'
   AND grantee IN ('anon', 'authenticated');
