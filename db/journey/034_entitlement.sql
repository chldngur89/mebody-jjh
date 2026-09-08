-- ===========================================================================
-- MEBODY — 무료/유료 자격(entitlement) 판정
--
-- 정책: 14일 저니는 유료 기능이되, **첫 저니 1회는 무료**로 끝까지 경험시킨다.
--       두 번째 저니부터 활성 구독이 필요하다.
--
-- 왜 DB 에서 막는가:
--   startJourney 는 클라이언트가 user_journeys 를 직접 INSERT 하고
--   RLS 는 auth.uid() = user_id 만 본다. 화면에서 버튼을 숨겨도 API 로 우회된다.
--   따라서 자격 판정은 RLS 의 WITH CHECK 안에 있어야 한다.
--
-- 선행: 020~033 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 활성 구독 여부
--    reward_multiplier_for 와 **같은 조건**을 쓴다. 두 곳이 어긋나면
--    "적립 배수는 붙는데 저니는 못 만든다" 같은 모순이 생긴다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM public.user_subscriptions s
      JOIN public.membership_plans p ON p.code = s.plan_code
     WHERE s.user_id = p_user
       AND s.status IN ('trialing', 'active')
       AND (s.current_period_end IS NULL OR s.current_period_end > now())
       AND p.is_active
  );
EXCEPTION
  -- 구독 테이블이 아직 없는 환경에서도 앱이 죽지 않게 한다(무료로 취급).
  WHEN undefined_table THEN RETURN false;
END $$;

-- ---------------------------------------------------------------------------
-- 2) 등급 — 화면 표시·리포트 게이팅 공용
--    같은 사용자에게 여러 구독이 있으면 배수가 높은 쪽을 등급으로 본다
--    (reward_multiplier_for 의 ORDER BY 와 같은 기준).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.subscription_tier(p_user uuid)
RETURNS text
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF p_user IS NULL THEN RETURN 'free'; END IF;

  SELECT s.plan_code INTO v_code
    FROM public.user_subscriptions s
    JOIN public.membership_plans p ON p.code = s.plan_code
   WHERE s.user_id = p_user
     AND s.status IN ('trialing', 'active')
     AND (s.current_period_end IS NULL OR s.current_period_end > now())
     AND p.is_active
   ORDER BY p.reward_multiplier DESC
   LIMIT 1;

  IF v_code IS NULL THEN RETURN 'free'; END IF;
  IF v_code LIKE 'pro%' THEN RETURN 'pro'; END IF;
  RETURN 'basic';
EXCEPTION
  WHEN undefined_table THEN RETURN 'free';
END $$;

-- ---------------------------------------------------------------------------
-- 3) 저니를 새로 시작할 수 있는가
--    저니 이력이 0건이면(=첫 저니) 무료로 허용, 그 뒤로는 구독 필요.
--
--    SECURITY DEFINER 여야 한다. RLS 정책 안에서 같은 테이블(user_journeys)을
--    조회하면 그 조회에 다시 RLS 가 걸려 재귀한다. DEFINER 는 RLS 를 우회한다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_start_journey(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user IS NULL THEN RETURN false; END IF;

  -- RLS 정책식은 호출자 권한으로 평가되므로 이 함수는 authenticated 에 열려 있다.
  -- 남의 구독 상태를 떠보는 데 쓰이지 않도록 본인만 판정한다.
  IF auth.uid() IS DISTINCT FROM p_user THEN RETURN false; END IF;

  -- 첫 저니는 무료
  IF NOT EXISTS (SELECT 1 FROM public.user_journeys WHERE user_id = p_user) THEN
    RETURN true;
  END IF;

  RETURN public.has_active_subscription(p_user);
END $$;

COMMENT ON FUNCTION public.can_start_journey(uuid) IS
  '첫 저니 1회는 무료, 이후에는 활성 구독 필요. user_journeys INSERT 정책이 이 함수를 쓴다.';

-- ---------------------------------------------------------------------------
-- 4) 무료 체험을 이미 썼는지 (화면 안내용)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.journey_entitlement()
RETURNS TABLE (tier text, is_paid boolean, can_start boolean, journey_count integer)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY SELECT
    public.subscription_tier(v_user),
    public.has_active_subscription(v_user),
    public.can_start_journey(v_user),
    (SELECT count(*)::int FROM public.user_journeys WHERE user_id = v_user);
END $$;

-- ---------------------------------------------------------------------------
-- 5) INSERT 정책 교체 — 여기가 실제 잠금 장치다
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS user_journeys_insert_own ON public.user_journeys;
CREATE POLICY user_journeys_insert_own ON public.user_journeys
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_start_journey(auth.uid()));

-- user_missions 는 따로 막지 않는다. user_journey_id FK 가 있어
-- 저니를 만들지 못하면 미션도 만들 수 없다.

-- ---------------------------------------------------------------------------
-- 6) 권한 — 함수는 기본으로 PUBLIC 에 EXECUTE 가 붙으므로 PUBLIC 부터 회수한다.
--    can_start_journey 는 RLS 정책식이 **호출자 권한**으로 평가하므로 반드시 열어야 한다
--    (닫으면 정상 사용자의 첫 저니 INSERT 까지 permission denied 로 막힌다).
--    본인만 판정하도록 함수 안에서 auth.uid() 를 확인한다.
--    has_active_subscription / subscription_tier 는 DEFINER 함수 안에서만 불리므로 닫아 둔다.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.subscription_tier(uuid)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_start_journey(uuid)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_entitlement()         FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.can_start_journey(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.journey_entitlement()   TO authenticated;
