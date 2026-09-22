-- ===========================================================================
-- MEBODY — 주소 없이 주문하면 실패하던 문제
--
-- 증상: 앱에서 배송지를 고르지 않고 주문하면 주문이 조용히 실패합니다.
--       (api/orders.ts 의 createOrder 가 null 을 돌려주고 화면은 이유를 모릅니다)
--
-- 원인: create_order 오버로드가 두 개 남아 있습니다.
--         create_order(p_items jsonb, p_reward_to_use integer DEFAULT 0)              ← 040 이전
--         create_order(p_items jsonb, p_reward_to_use integer DEFAULT 0,
--                      p_address_id uuid DEFAULT NULL)                                ← 040
--       인자 두 개로 부르면 둘 다 후보가 되어 PostgreSQL 이 42725(ambiguous)를 냅니다.
--       040 이 새 버전을 만들면서 옛 버전을 지우지 않았습니다. 제가 놓친 것입니다.
--
-- 고침: 옛 2인자 버전을 지웁니다. 남는 3인자 버전은 p_address_id 기본값이 NULL 이라
--       인자 두 개로 불러도 그대로 동작합니다. 앱은 고칠 것이 없습니다.
--
-- 선행: 040 적용 완료
-- ===========================================================================

DROP FUNCTION IF EXISTS public.create_order(jsonb, integer);

-- ---------------------------------------------------------------------------
-- 확인 — 하나만 남아야 합니다
-- ---------------------------------------------------------------------------
SELECT p.oid::regprocedure::text AS 남은_함수
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'create_order'
 ORDER BY 1;
