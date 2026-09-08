-- ===========================================================================
-- MEBODY — 리디자인 지원 (미션 달력 · 주간/월간 챌린지 · 마켓 카테고리 · 내 상태)
--
-- 1) 미션 탭 달력   : 공통 스트레칭을 어느 날 했는지. **새 테이블 없이** 적립 원장에서 읽는다.
-- 2) 주간/월간 챌린지: HTML 의 PERFECT CHALLENGE. EXP 대신 적립금으로 지급.
-- 3) 마켓 카테고리  : products.category
-- 4) 내 상태        : 키·몸무게, 적립 내역
--
-- 선행: 020~036 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 원장 CHECK 확장 — 주간·월간 챌린지 적립
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS user_rewards_entry_type_check;
ALTER TABLE public.user_rewards ADD  CONSTRAINT user_rewards_entry_type_check CHECK (entry_type IN
  ('earn_mission','earn_journey','earn_routine','earn_routine_bonus','earn_purchase',
   'earn_weekly','earn_monthly','earn_subscription','spend_order','refund_order','expire'));

ALTER TABLE public.user_rewards DROP CONSTRAINT IF EXISTS user_rewards_sign_check;
ALTER TABLE public.user_rewards ADD  CONSTRAINT user_rewards_sign_check CHECK (
  (entry_type IN ('earn_mission','earn_journey','earn_routine','earn_routine_bonus',
                  'earn_purchase','earn_weekly','earn_monthly','earn_subscription','refund_order') AND amount > 0)
  OR (entry_type IN ('spend_order','expire') AND amount < 0)
);

-- ---------------------------------------------------------------------------
-- 2) 공통 스트레칭 수행 이력
--
--    새 테이블을 만들지 않는다. 기본 주사위 적립(earn_routine)이 이미 하루 1행이고
--    그 날짜가 곧 "그날 했다" 는 사실이다.
--    날짜는 memo 의 service_day 를 우선하되, 없으면 created_at 으로 되계산한다
--    (source_id 가 같은 기준으로 만들어져 둘은 항상 일치한다).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.routine_service_day(p_row public.user_rewards)
RETURNS date
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(p_row.memo, '')::jsonb ->> 'service_day',
    public.mebody_service_day(p_row.created_at)::text
  )::date;
$$;

CREATE OR REPLACE FUNCTION public.routine_history(p_from date, p_to date)
RETURNS TABLE (service_day date, base_amount integer, bonus_amount integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_to < p_from OR p_to - p_from > 400 THEN
    RAISE EXCEPTION 'invalid range' USING ERRCODE = '22023';
  END IF;

  -- 실제로 수행한 날만 돌려준다. 화면에서 달력 칸을 만들 때 이 집합만 있으면 된다.
  RETURN QUERY
  SELECT r.day,
         COALESCE(sum(r.amount) FILTER (WHERE r.entry_type = 'earn_routine'), 0)::int,
         COALESCE(sum(r.amount) FILTER (WHERE r.entry_type = 'earn_routine_bonus'), 0)::int
    FROM (
      SELECT public.routine_service_day(x) AS day, x.entry_type, x.amount
        FROM public.user_rewards x
       WHERE x.user_id = v_user
         AND x.entry_type IN ('earn_routine', 'earn_routine_bonus')
    ) r
   WHERE r.day BETWEEN p_from AND p_to
   GROUP BY r.day
   ORDER BY r.day;
END $$;

-- ---------------------------------------------------------------------------
-- 3) 주간 · 월간 챌린지 규칙
--    금액은 여기 값이라 코드 수정 없이 운영에서 바꿀 수 있다.
-- ---------------------------------------------------------------------------
INSERT INTO public.reward_rules
  (code, name, display_label, disclosure, min_amount, max_amount, fixed_amount, is_active)
VALUES
  ('weekly_challenge', '주간 완주 보너스', '한 주 7일 완주 20원',
   '월요일부터 일요일까지 7일 모두 공통 스트레칭을 완료하면 20원이 추가 적립됩니다. 한 주에 1회만 지급되며, 하루의 기준은 한국시간 오전 5시입니다.',
   NULL, NULL, 20, true),
  ('monthly_challenge', '월간 완주 보너스', '한 달 20일 이상 50원',
   '한 달에 20일 이상 공통 스트레칭을 완료하면 50원이 추가 적립됩니다. 한 달에 1회만 지급되며, 하루의 기준은 한국시간 오전 5시입니다.',
   NULL, NULL, 50, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, display_label = EXCLUDED.display_label,
  disclosure = EXCLUDED.disclosure, fixed_amount = EXCLUDED.fixed_amount,
  is_active = EXCLUDED.is_active;

/** 이번 주(월요일 시작) 완료 일수 */
CREATE OR REPLACE FUNCTION public.routine_week_progress(p_user uuid, p_at timestamptz DEFAULT now())
RETURNS TABLE (week_start date, done_days integer, required integer)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := date_trunc('week', public.mebody_service_day(p_at))::date;
BEGIN
  RETURN QUERY
  SELECT v_start,
         (SELECT count(DISTINCT public.routine_service_day(x))::int
            FROM public.user_rewards x
           WHERE x.user_id = p_user AND x.entry_type = 'earn_routine'
             AND public.routine_service_day(x) BETWEEN v_start AND v_start + 6),
         7;
END $$;

/** 이번 달 완료 일수 */
CREATE OR REPLACE FUNCTION public.routine_month_progress(p_user uuid, p_at timestamptz DEFAULT now())
RETURNS TABLE (month_start date, done_days integer, required integer)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := date_trunc('month', public.mebody_service_day(p_at))::date;
BEGIN
  RETURN QUERY
  SELECT v_start,
         (SELECT count(DISTINCT public.routine_service_day(x))::int
            FROM public.user_rewards x
           WHERE x.user_id = p_user AND x.entry_type = 'earn_routine'
             AND public.routine_service_day(x) >= v_start
             AND public.routine_service_day(x) < (v_start + interval '1 month')::date),
         20;
END $$;

/** 주간 챌린지 지급 — 한 주 1회 */
CREATE OR REPLACE FUNCTION public.claim_weekly_challenge()
RETURNS TABLE (amount integer, already_claimed boolean, done_days integer, required integer, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_prog   record;
  v_source uuid;
  v_prev   integer;
  v_amount integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_prog FROM public.routine_week_progress(v_user);
  v_source := md5(v_user::text || ':weekly:' || v_prog.week_start::text)::uuid;

  PERFORM pg_advisory_xact_lock(hashtext('mebody_weekly'), hashtext(v_user::text));

  SELECT r.amount INTO v_prev FROM public.user_rewards r
   WHERE r.user_id = v_user AND r.entry_type = 'earn_weekly' AND r.source_id = v_source;
  IF v_prev IS NOT NULL THEN
    RETURN QUERY SELECT v_prev, true, v_prog.done_days, v_prog.required, public.reward_balance(v_user);
    RETURN;
  END IF;

  IF v_prog.done_days < v_prog.required THEN
    RETURN QUERY SELECT 0, false, v_prog.done_days, v_prog.required, public.reward_balance(v_user);
    RETURN;
  END IF;

  SELECT fixed_amount INTO v_amount FROM public.reward_rules WHERE code = 'weekly_challenge' AND is_active;
  v_amount := COALESCE(v_amount, 0);
  IF v_amount <= 0 THEN
    RETURN QUERY SELECT 0, false, v_prog.done_days, v_prog.required, public.reward_balance(v_user);
    RETURN;
  END IF;

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, memo)
  VALUES (v_user, 'earn_weekly', 'weekly_challenge', v_amount, 'free', 'routine', v_source,
          jsonb_build_object('week_start', v_prog.week_start)::text);

  RETURN QUERY SELECT v_amount, false, v_prog.done_days, v_prog.required, public.reward_balance(v_user);
END $$;

/** 월간 챌린지 지급 — 한 달 1회 */
CREATE OR REPLACE FUNCTION public.claim_monthly_challenge()
RETURNS TABLE (amount integer, already_claimed boolean, done_days integer, required integer, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_prog   record;
  v_source uuid;
  v_prev   integer;
  v_amount integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_prog FROM public.routine_month_progress(v_user);
  v_source := md5(v_user::text || ':monthly:' || v_prog.month_start::text)::uuid;

  PERFORM pg_advisory_xact_lock(hashtext('mebody_monthly'), hashtext(v_user::text));

  SELECT r.amount INTO v_prev FROM public.user_rewards r
   WHERE r.user_id = v_user AND r.entry_type = 'earn_monthly' AND r.source_id = v_source;
  IF v_prev IS NOT NULL THEN
    RETURN QUERY SELECT v_prev, true, v_prog.done_days, v_prog.required, public.reward_balance(v_user);
    RETURN;
  END IF;

  IF v_prog.done_days < v_prog.required THEN
    RETURN QUERY SELECT 0, false, v_prog.done_days, v_prog.required, public.reward_balance(v_user);
    RETURN;
  END IF;

  SELECT fixed_amount INTO v_amount FROM public.reward_rules WHERE code = 'monthly_challenge' AND is_active;
  v_amount := COALESCE(v_amount, 0);
  IF v_amount <= 0 THEN
    RETURN QUERY SELECT 0, false, v_prog.done_days, v_prog.required, public.reward_balance(v_user);
    RETURN;
  END IF;

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, memo)
  VALUES (v_user, 'earn_monthly', 'monthly_challenge', v_amount, 'free', 'routine', v_source,
          jsonb_build_object('month_start', v_prog.month_start)::text);

  RETURN QUERY SELECT v_amount, false, v_prog.done_days, v_prog.required, public.reward_balance(v_user);
END $$;

/** 화면용 묶음 조회 (적립하지 않음) */
CREATE OR REPLACE FUNCTION public.routine_challenge_status()
RETURNS TABLE (week_start date, week_done integer, week_required integer, week_claimed boolean,
               month_start date, month_done integer, month_required integer, month_claimed boolean)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  w record; m record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO w FROM public.routine_week_progress(v_user);
  SELECT * INTO m FROM public.routine_month_progress(v_user);

  RETURN QUERY SELECT
    w.week_start, w.done_days, w.required,
    EXISTS (SELECT 1 FROM public.user_rewards r WHERE r.user_id = v_user
              AND r.entry_type = 'earn_weekly'
              AND r.source_id = md5(v_user::text || ':weekly:' || w.week_start::text)::uuid),
    m.month_start, m.done_days, m.required,
    EXISTS (SELECT 1 FROM public.user_rewards r WHERE r.user_id = v_user
              AND r.entry_type = 'earn_monthly'
              AND r.source_id = md5(v_user::text || ':monthly:' || m.month_start::text)::uuid);
END $$;

-- ---------------------------------------------------------------------------
-- 4) 적립 내역 — 내 상태 탭에서 "무엇으로 얼마 쌓였는지" 보여준다
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reward_history(p_limit integer DEFAULT 30)
RETURNS TABLE (id uuid, entry_type text, label text, amount integer, created_at timestamptz)
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

  RETURN QUERY
  SELECT r.id, r.entry_type,
         CASE r.entry_type
           WHEN 'earn_routine'       THEN '공통 스트레칭'
           WHEN 'earn_routine_bonus' THEN '광고 보너스'
           WHEN 'earn_mission'       THEN '오늘의 미션'
           WHEN 'earn_journey'       THEN '14일 완주'
           WHEN 'earn_weekly'        THEN '주간 완주'
           WHEN 'earn_monthly'       THEN '월간 완주'
           WHEN 'earn_purchase'      THEN '구매 적립'
           WHEN 'earn_subscription'  THEN '멤버십 적립'
           WHEN 'spend_order'        THEN '주문 사용'
           WHEN 'refund_order'       THEN '주문 취소 환불'
           WHEN 'expire'             THEN '소멸'
           ELSE r.entry_type
         END,
         r.amount, r.created_at
    FROM public.user_rewards r
   WHERE r.user_id = v_user
   ORDER BY r.created_at DESC
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 200));
END $$;

-- ---------------------------------------------------------------------------
-- 5) 마켓 카테고리
-- ---------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text;

UPDATE public.products SET category = 'release'  WHERE category IS NULL AND name ILIKE '%폼롤러%';
UPDATE public.products SET category = 'release'  WHERE category IS NULL AND name ILIKE '%마사지볼%';
UPDATE public.products SET category = 'stretch'  WHERE category IS NULL AND name ILIKE '%밴드%';
UPDATE public.products SET category = 'support'  WHERE category IS NULL;

COMMENT ON COLUMN public.products.category IS
  '마켓 카테고리: release(셀프 이완) | strength(근력) | stretch(스트레칭) | support(보조 용품) | food(보조 식품)';

-- ---------------------------------------------------------------------------
-- 6) 내 상태 — 키·몸무게
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS height_cm numeric;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS weight_kg numeric;

-- ---------------------------------------------------------------------------
-- 7) 권한 — 함수는 기본으로 PUBLIC 에 EXECUTE 가 붙으므로 PUBLIC 부터 회수한다.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.routine_service_day(public.user_rewards)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.routine_week_progress(uuid, timestamptz)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.routine_month_progress(uuid, timestamptz)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.routine_history(date, date)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.routine_challenge_status()                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_weekly_challenge()                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_monthly_challenge()                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_history(integer)                        FROM PUBLIC, anon, authenticated;

-- routine_service_day 는 routine_history 안에서 쓰이지만 SQL 함수라 호출자 권한이 필요하다.
GRANT EXECUTE ON FUNCTION public.routine_service_day(public.user_rewards) TO authenticated;
GRANT EXECUTE ON FUNCTION public.routine_history(date, date)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.routine_challenge_status()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_weekly_challenge()                TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_monthly_challenge()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.reward_history(integer)                 TO authenticated;
