-- ===========================================================================
-- MEBODY — 계정 탈퇴
--
-- 왜 필요한가: 탈퇴 경로가 아예 없었습니다. 개인정보보호법상 파기 요구에 응할 방법이 없고,
-- Play 스토어와 AdSense 도 계정 삭제 경로를 요구합니다.
--
-- ★ 그냥 계정을 지우면 결제 기록이 함께 사라집니다 (이 파일이 먼저 고치는 것)
--   orders / payments / user_subscriptions 가 auth.users 에 **ON DELETE CASCADE** 로
--   걸려 있습니다. 인증 계정을 지우는 순간 전자상거래법상 5년 보존 대상인 거래 기록이
--   같이 지워집니다. 그래서 이 세 테이블만 ON DELETE SET NULL 로 바꿉니다.
--   탈퇴하면 "누가 샀는지" 는 끊기고 "무엇이 언제 얼마에 팔렸는지" 는 남습니다.
--
-- 나머지는 이미 CASCADE 로 걸려 있어 인증 계정을 지우면 따라 지워집니다:
--   questionnaire_responses, user_journeys, journey_reports, journey_mission_feedback,
--   user_missions, user_rewards, user_addresses, user_profiles
--   (user_mission_progress 는 user_profiles 를 타고 함께 지워집니다)
--
-- 예외 하나: body_bti_results 는 user_profiles 에 SET NULL 이라 행이 남습니다.
--   진단 결과 사본이라 남길 이유가 없어 아래 함수가 직접 지웁니다.
--
-- 순서: 앱 → 서버 DELETE /api/account → (1) prepare_account_deletion() 로 정리·검사
--       → (2) 서비스 롤로 auth.users 삭제 → CASCADE 가 나머지를 지웁니다.
--       인증 계정 삭제가 마지막이라, 중간에 실패하면 계정은 그대로 남습니다.
--
-- 선행: 045 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 거래 기록이 계정과 함께 지워지지 않게
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders             ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.payments           ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.user_subscriptions ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.orders             DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE public.orders             ADD  CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.payments           DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE public.payments           ADD  CONSTRAINT payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_fkey;
ALTER TABLE public.user_subscriptions ADD  CONSTRAINT user_subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 조회 정책은 auth.uid() = user_id 라서, user_id 가 NULL 이 되면 아무에게도 보이지 않습니다.
-- 관리자 화면은 서비스 롤로 읽으므로 그대로 보입니다.

-- ---------------------------------------------------------------------------
-- 2) 탈퇴 준비 — 막아야 할 것을 막고, CASCADE 가 닿지 않는 것을 지운다
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_products integer;
  v_rows     integer;
  v_orders   integer;
  v_payments integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다' USING ERRCODE = '42501';
  END IF;

  -- 판매자가 상품을 남긴 채 사라지면 그 상품의 주문을 받을 사람이 없어집니다.
  SELECT count(*) INTO v_products FROM public.products WHERE seller_id = v_uid;
  IF v_products > 0 THEN
    RAISE EXCEPTION '등록한 상품이 %건 남아 있어 탈퇴할 수 없습니다. 상품을 먼저 정리해주세요.', v_products
      USING ERRCODE = '42501';
  END IF;

  -- CASCADE 가 닿지 않는 것(user_profiles 에 SET NULL 로 걸려 있어 행이 남습니다)
  DELETE FROM public.body_bti_results WHERE user_id = v_uid;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- 남을 거래 기록을 세어 확인 화면에 그대로 보여줍니다.
  SELECT count(*) INTO v_orders   FROM public.orders   WHERE user_id = v_uid;
  SELECT count(*) INTO v_payments FROM public.payments WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'ready', true,
    'deleted', jsonb_build_object('body_bti_results', v_rows),
    'kept', jsonb_build_object('orders', v_orders, 'payments', v_payments),
    'note', '주문·결제 기록은 전자상거래법에 따라 보관 기간 동안 남고, 구매자 정보는 끊깁니다.'
  );
END;
$$;

COMMENT ON FUNCTION public.prepare_account_deletion() IS
  '탈퇴 전 정리와 검사. 실제 삭제는 서버가 auth.users 를 지우면 CASCADE 로 일어난다. 거래 기록은 SET NULL 로 남는다.';

-- CREATE FUNCTION 은 PUBLIC 에 EXECUTE 를 준다. 044 에서와 같은 이유로 먼저 걷어낸다.
REVOKE ALL ON FUNCTION public.prepare_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.prepare_account_deletion() FROM anon;

-- ---------------------------------------------------------------------------
-- 3) 확인
-- ---------------------------------------------------------------------------
SELECT c.conrelid::regclass::text AS 테이블,
       CASE c.confdeltype WHEN 'c' THEN 'CASCADE(위험)' WHEN 'n' THEN 'SET NULL' ELSE c.confdeltype::text END AS "계정 삭제 시"
  FROM pg_constraint c
 WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass
   AND c.conrelid IN ('public.orders'::regclass, 'public.payments'::regclass, 'public.user_subscriptions'::regclass)
 ORDER BY 1;

SELECT has_function_privilege('authenticated', 'public.prepare_account_deletion()', 'EXECUTE') AS "회원_실행(true여야)",
       has_function_privilege('anon', 'public.prepare_account_deletion()', 'EXECUTE')          AS "익명_실행(false여야)";
