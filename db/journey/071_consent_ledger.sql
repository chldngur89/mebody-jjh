-- ===========================================================================
-- MEBODY — 동의 원장 (2026-09-22 UX 감사 P1-1)
--
-- ※ db/journey 폴더의 071 입니다.
--
-- WHY
--   지금은 user_profiles 에 시각만 있습니다 — terms_agreed_at · privacy_agreed_at ·
--   marketing_agreed_at. 이것으로는 "언제 눌렀나" 만 알고 **"무엇에 동의했나" 를 모릅니다.**
--
--   문서를 고치면 그 시각이 어느 판(version)에 대한 동의였는지 알 수 없게 됩니다.
--   실제로 이 프로젝트는 약관·개인정보처리방침 본문을 한 번 교체했고, 앞으로 사업자 정보가
--   채워지면 또 바뀝니다. 그때 기존 동의가 무엇에 대한 것이었는지 입증할 방법이 없습니다.
--
--   또 지금 구조는 **덮어쓰기**입니다. 철회하고 다시 동의하면 앞의 기록이 사라집니다.
--
-- 그래서 append-only 원장을 둡니다. 한 줄이 한 번의 행위입니다.
--
-- 기존 컬럼을 지우지 않습니다.
--   user_profiles 의 네 컬럼은 그대로 둡니다. 앱·서버·탈퇴 함수가 이미 읽고 있고,
--   "지금 동의 상태인가" 를 한 번에 보는 데는 그쪽이 빠릅니다.
--   원장은 **증적**이고 컬럼은 **현재 상태**입니다. 둘의 역할이 다릅니다.
--
-- 비회원도 남길 수 있게 합니다.
--   32문항 앞의 의료 비진단 동의는 로그인 전에 일어납니다. 감사가 "비회원 진단 동의도
--   서버 증적이 확인되지 않았다" 고 지적한 부분입니다. user_id 를 NULL 로 두고
--   익명 세션 키로 남깁니다. 나중에 그 사람이 가입하면 link_anonymous_consents() 로 잇습니다.
--
-- 선행: 055 적용 완료 (user_profiles 동의 컬럼)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.user_consents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 회원이면 프로필 id. 비회원 단계의 동의는 NULL 입니다.
  -- 탈퇴하면 사람은 지워지되 "동의를 받고 서비스했다" 는 사실은 남아야 하므로 SET NULL 입니다.
  user_id        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  -- 비회원 단계를 잇는 값. 앱이 만드는 임시 키이고 사람을 식별하지 않습니다.
  -- user_id 가 있으면 보통 NULL 입니다.
  session_key    text,

  consent_type   text NOT NULL CHECK (consent_type IN (
                   'terms',              -- 이용약관
                   'privacy',            -- 개인정보처리방침
                   'marketing',          -- 광고·마케팅 수신
                   'health_disclaimer',  -- 의료 진단이 아님을 확인 (32문항 앞)
                   'analytics',          -- 이용 통계·광고 개인화 (쿠키 배너)
                   'professional_share'  -- 전문가에게 내 기록을 보여주기
                 )),

  -- 어느 판에 동의했나. 문서를 고치면 이 값을 올립니다.
  -- 판을 모르는 과거 기록은 'unknown' 으로 둡니다 — NULL 로 두면 "안 받았다" 와 섞입니다.
  policy_version text NOT NULL DEFAULT 'unknown',

  -- 어느 화면에서 눌렀나. 같은 동의를 앱과 홈페이지 양쪽에서 받습니다.
  channel        text NOT NULL CHECK (channel IN ('app', 'web', 'admin', 'server')),

  agreed_at      timestamptz NOT NULL DEFAULT now(),
  -- 철회는 같은 줄을 고치지 않고 revoked_at 을 찍습니다. 다시 동의하면 새 줄입니다.
  revoked_at     timestamptz,

  created_at     timestamptz NOT NULL DEFAULT now(),

  -- 회원 기록이면 user_id 가, 비회원 기록이면 session_key 가 있어야 합니다.
  -- 둘 다 없으면 누구의 동의인지 모르는 줄이 됩니다.
  CONSTRAINT user_consents_subject_present
    CHECK (user_id IS NOT NULL OR session_key IS NOT NULL)
);

COMMENT ON TABLE public.user_consents IS
  '동의 원장. append-only — 한 줄이 한 번의 행위다. 고치지 않고 새 줄을 쌓는다. 현재 상태는 user_profiles 쪽을 본다.';
COMMENT ON COLUMN public.user_consents.policy_version IS
  '동의한 문서의 판. 문서 본문을 고치면 올린다. 모르는 과거 기록은 unknown.';

CREATE INDEX IF NOT EXISTS user_consents_user_idx
  ON public.user_consents (user_id, consent_type, agreed_at DESC);
CREATE INDEX IF NOT EXISTS user_consents_session_idx
  ON public.user_consents (session_key) WHERE session_key IS NOT NULL;

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- 본인은 자기 동의 기록을 봅니다. 관리자도 봅니다(분쟁 확인).
DROP POLICY IF EXISTS user_consents_read_own ON public.user_consents;
CREATE POLICY user_consents_read_own ON public.user_consents
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT p.id FROM public.user_profiles p
                WHERE p.auth_user_id = auth.uid() OR p.id = auth.uid() LIMIT 1)
    OR public.current_user_role() = 'ADMIN'
  );

-- Supabase 기본값은 GRANT ALL 이고 거기에 TRUNCATE 가 들어 있습니다.
-- **TRUNCATE 는 RLS 를 우회합니다.** 041·048·052·054·056 과 같은 이유로 걷어냅니다.
-- 원장은 증적이므로 UPDATE·DELETE 도 주지 않습니다. 쓰기는 서버만 합니다.
REVOKE ALL ON public.user_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_consents TO authenticated;

-- ---------------------------------------------------------------------------
-- record_consent() — 한 줄 남기기 (서버 전용)
--
-- 왜 함수인가: 원장에 INSERT 권한을 아무에게도 주지 않았습니다. 앱이 직접 쓸 수 있으면
-- 받지 않은 동의를 남길 수 있고, 그러면 증적의 의미가 없어집니다.
--
-- 같은 종류·같은 판을 다시 눌러도 새 줄을 쌓습니다. 재동의도 사실이므로 남깁니다.
-- 다만 **같은 1초 안의 중복은 접습니다** — 버튼을 두 번 누른 것이지 두 번 동의한 게 아닙니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_consent(
  p_user_id        uuid,
  p_session_key    text,
  p_consent_type   text,
  p_policy_version text,
  p_channel        text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_user_id IS NULL AND (p_session_key IS NULL OR p_session_key = '') THEN
    RAISE EXCEPTION 'record_consent: user_id 와 session_key 가 모두 없습니다';
  END IF;

  -- 반복 클릭 접기. 같은 주체·종류·판이 1초 안에 또 오면 앞의 것을 돌려줍니다.
  SELECT c.id INTO v_id
    FROM public.user_consents c
   WHERE c.consent_type = p_consent_type
     AND c.policy_version = coalesce(p_policy_version, 'unknown')
     AND c.revoked_at IS NULL
     AND c.agreed_at > now() - interval '1 second'
     AND ((p_user_id IS NOT NULL AND c.user_id = p_user_id)
       OR (p_user_id IS NULL AND c.session_key = p_session_key))
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.user_consents
    (user_id, session_key, consent_type, policy_version, channel)
  VALUES
    (p_user_id,
     CASE WHEN p_user_id IS NULL THEN p_session_key END,  -- 회원 기록에는 세션 키를 남기지 않습니다
     p_consent_type,
     coalesce(nullif(p_policy_version, ''), 'unknown'),
     coalesce(nullif(p_channel, ''), 'server'))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_consent(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_consent(uuid, text, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- revoke_consent() — 철회를 찍습니다. 줄을 지우지 않습니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_consent(p_user_id uuid, p_consent_type text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_n integer;
BEGIN
  UPDATE public.user_consents
     SET revoked_at = now()
   WHERE user_id = p_user_id
     AND consent_type = p_consent_type
     AND revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_consent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_consent(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- link_anonymous_consents() — 비회원 때 누른 동의를 가입한 계정에 잇습니다.
--
-- 32문항 앞의 의료 비진단 확인은 로그인 전에 일어납니다. 그 사람이 나중에 가입하면
-- 같은 사람의 행위였다는 것을 이어 둡니다. session_key 는 지웁니다 — 이은 뒤에는
-- 그 키를 남겨 둘 이유가 없고, 남기면 회원과 익명 세션을 잇는 값이 계속 남습니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_anonymous_consents(p_user_id uuid, p_session_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_n integer;
BEGIN
  IF p_user_id IS NULL OR p_session_key IS NULL OR p_session_key = '' THEN
    RETURN 0;
  END IF;
  UPDATE public.user_consents
     SET user_id = p_user_id, session_key = NULL
   WHERE session_key = p_session_key
     AND user_id IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.link_anonymous_consents(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_anonymous_consents(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 탈퇴와의 관계
--
-- 064 가 prepare_account_deletion() 을 정리해 두었습니다. 여기서 원장을 지우지 않습니다.
--   · user_id 는 FK ON DELETE SET NULL 로 저절로 떨어집니다 (사람은 사라짐)
--   · "어느 판에 언제 동의를 받고 서비스했다" 는 사실은 남습니다 (분쟁 대비)
-- 남는 줄에는 user_id · session_key 둘 다 NULL 이므로 누구인지 알 수 없습니다.
--
-- 다만 CHECK (user_id IS NOT NULL OR session_key IS NOT NULL) 은 **INSERT 때만** 봅니다.
-- FK 가 SET NULL 로 바꾸는 것은 CHECK 를 다시 평가하므로 여기서 걸립니다.
-- 그래서 CHECK 를 NOT VALID 로 두는 대신, 탈퇴 시 세션 키 자리에 표식을 남깁니다.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_consents
  DROP CONSTRAINT IF EXISTS user_consents_subject_present;

-- 표식이 들어갈 수 있게 조건을 넓힙니다. 탈퇴로 주체가 사라진 줄은 'deleted' 를 갖습니다.
ALTER TABLE public.user_consents
  ADD CONSTRAINT user_consents_subject_present
  CHECK (user_id IS NOT NULL OR session_key IS NOT NULL OR revoked_at IS NOT NULL);

-- 사람이 지워질 때 주체 자리를 비우고 흔적만 남깁니다.
CREATE OR REPLACE FUNCTION public.anonymize_consents_on_profile_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.user_consents
     SET user_id = NULL, session_key = NULL, revoked_at = coalesce(revoked_at, now())
   WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS user_consents_anonymize ON public.user_profiles;
CREATE TRIGGER user_consents_anonymize
  BEFORE DELETE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.anonymize_consents_on_profile_delete();

-- ---------------------------------------------------------------------------
-- 확인 — 적용 후 아래가 전부 통과해야 합니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_ok boolean;
BEGIN
  SELECT NOT has_table_privilege('anon', 'public.user_consents', 'SELECT')
     AND NOT has_table_privilege('authenticated', 'public.user_consents', 'INSERT')
     AND NOT has_table_privilege('authenticated', 'public.user_consents', 'TRUNCATE')
     AND has_table_privilege('authenticated', 'public.user_consents', 'SELECT')
     AND NOT has_function_privilege('anon', 'public.record_consent(uuid,text,text,text,text)', 'EXECUTE')
     AND NOT has_function_privilege('authenticated', 'public.record_consent(uuid,text,text,text,text)', 'EXECUTE')
    INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION '071 실패: 권한이 의도와 다릅니다 (앱이 원장에 직접 쓸 수 있으면 증적이 무의미합니다)';
  END IF;

  RAISE NOTICE '071 OK — 동의 원장이 준비되었습니다.';
END;
$$;
