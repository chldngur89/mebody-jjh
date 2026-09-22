-- ===========================================================================
-- MEBODY — 가입 동의 시각 저장
--
-- ※ db/journey 폴더의 055 입니다.
--
-- 왜 필요한가: 가입 화면에 "개인정보처리방침과 이용약관에 동의합니다" 체크박스가 있는데
-- **동의했다는 사실이 어디에도 남지 않습니다.** 지금 DB 에는 marketing_opt_in 하나뿐입니다.
-- 개인정보보호법은 수집·이용 동의를 받은 사실을 입증할 수 있어야 한다고 봅니다.
-- 분쟁이 생기면 "동의를 받았다" 를 증명할 방법이 없습니다.
--
-- 무엇을 하나: user_profiles 에 동의 시각 세 개를 더합니다. 컬럼 추가뿐이고
-- 정책·권한은 건드리지 않습니다. 기존 8행은 NULL 로 남습니다(그때는 기록하지 않았으므로).
--
-- 비회원이 진단 전에 누르는 동의는 여기에 담기지 않습니다.
--   그 시점에는 계정이 없어 붙일 곳이 없고, questionnaire_responses 에 담으려면
--   044·045 로 잠근 저장 함수의 시그니처를 바꿔야 합니다. 그건 047 에서 겪은
--   함수 중복 사고와 같은 위험이 있어 따로 다룹니다.
--
-- 선행: 054 적용 완료
-- ===========================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS terms_agreed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_agreed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_agreed_at timestamptz;

COMMENT ON COLUMN public.user_profiles.terms_agreed_at IS
  '이용약관에 동의한 시각. NULL 이면 기록을 남기기 전에 가입한 계정이다.';
COMMENT ON COLUMN public.user_profiles.privacy_agreed_at IS
  '개인정보처리방침에 동의한 시각. NULL 이면 기록을 남기기 전에 가입한 계정이다.';
COMMENT ON COLUMN public.user_profiles.marketing_agreed_at IS
  '마케팅 수신에 동의한 시각. 선택 항목이라 동의하지 않으면 NULL 이다.';

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT column_name AS 컬럼, data_type AS 형, is_nullable AS "NULL 허용"
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'user_profiles'
   AND column_name IN ('terms_agreed_at', 'privacy_agreed_at', 'marketing_agreed_at', 'marketing_opt_in')
 ORDER BY column_name;

SELECT count(*)::int AS "동의 기록이 없는 기존 계정"
  FROM public.user_profiles WHERE terms_agreed_at IS NULL AND deleted_at IS NULL;
