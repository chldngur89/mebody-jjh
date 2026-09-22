-- ===========================================================================
-- MEBODY — 061 이 지운 테이블을 참조하던 탈퇴 함수를 고친다
--
-- ※ db/journey 폴더의 064 입니다. **061 적용 직후 바로 돌려야 합니다.**
--
-- ── 무엇이 깨졌나
-- 061 에서 body_bti_results 를 지웠습니다. 앱·서버 코드 어디에서도 부르지 않는다고 확인했는데,
-- **DB 함수는 훑지 않았습니다.** prepare_account_deletion() 이 그 테이블을 DELETE 하고 있었고,
-- 테이블이 사라지면서 함수 전체가 실패했습니다.
--
-- 겉으로는 이렇게 보입니다:
--   DELETE /api/account → 503 "탈퇴에 필요한 DB 변경이 아직 적용되지 않았습니다"
-- 서버가 "함수 없음" 과 "함수 안의 테이블 없음" 을 같은 메시지로 처리해서, 046 이 안 된 것처럼
-- 보였습니다. 실제로는 046 은 적용돼 있고 안쪽이 부러진 것입니다.
--
-- **탈퇴는 법적 의무가 걸린 기능입니다.** 이걸 깬 채로 두면 안 됩니다.
--
-- ── 무엇을 배웠나
-- 테이블을 지우기 전에는 코드만 보면 안 되고 **DB 함수·뷰·트리거까지** 훑어야 합니다.
-- 이번에 전수 조사해 보니 지운 5개를 참조하는 것은 이 함수 하나뿐이었습니다.
-- 그 조사를 verify:hardening 에 넣어 다음에는 자동으로 걸리게 합니다.
--
-- ── 고치는 방법
-- body_bti_results 삭제 줄을 뺍니다. 그 테이블은 0행이었고 이제 없으므로, 지울 것도 없습니다.
-- 반환값의 deleted 항목은 모양을 유지하되 무엇을 지웠는지 정직하게 적습니다.
--
-- 선행: 061 적용 완료
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.prepare_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_products integer;
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

  -- 예전에는 여기서 body_bti_results 를 지웠습니다. 061 에서 그 테이블 자체를 없앴습니다
  -- (0행 · 참조 0곳). 지울 것이 없어져서 줄을 뺍니다.
  --
  -- 나머지는 auth.users 삭제의 외래키 CASCADE 가 지웁니다. 주문·결제는 SET NULL 로
  -- 남습니다(046) — 전자상거래법상 보존 대상이라 일부러 남기는 것입니다.

  SELECT count(*) INTO v_orders   FROM public.orders   WHERE user_id = v_uid;
  SELECT count(*) INTO v_payments FROM public.payments WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'ready', true,
    -- 모양은 유지합니다(앱이 읽습니다). 지금은 함수가 따로 지우는 것이 없습니다.
    'deleted', jsonb_build_object(),
    'kept', jsonb_build_object('orders', v_orders, 'payments', v_payments),
    'note', '주문·결제 기록은 전자상거래법에 따라 보관 기간 동안 남고, 구매자 정보는 끊깁니다.'
  );
END;
$$;

COMMENT ON FUNCTION public.prepare_account_deletion() IS
  '탈퇴 준비. 판매자 상품을 막고, 남을 거래 기록 수를 돌려준다. 실제 삭제는 auth.users 삭제의 CASCADE 가 한다.';

-- ---------------------------------------------------------------------------
-- 확인 — 지운 테이블을 참조하는 함수가 하나도 없어야 합니다.
-- ---------------------------------------------------------------------------
SELECT p.proname AS "지운 테이블을 아직 참조하는 함수"
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND (p.prosrc ~ '\mprompts\M'
     OR p.prosrc ~ '\msere_contents\M'
     OR p.prosrc ~ '\mbody_bti_results\M'
     OR p.prosrc ~ '\muser_mission_progress\M'
     OR p.prosrc ~ '(?<!user_)\mmissions\M');
