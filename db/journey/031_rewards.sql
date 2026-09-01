-- MEBODY — 적립금 (통합 원장)
--
-- 원칙
--   1) 금액은 항상 서버(Postgres 함수)가 정한다. 클라이언트는 원장에 직접 쓸 수 없다.
--   2) 적립·사용·환불·소멸을 한 원장에 부호 있는 금액으로 기록한다. 잔액 = SUM(amount).
--   3) 무상 발행(미션/완주)과 유상 발행(구독 대가)을 구분해 기록한다.
--      정산·정책 대응 시 성격이 다르므로 나중에 나누려면 이력을 복원할 수 없다.
--
-- 지급 구조
--   earn_mission       : 미션 1건 완료당 1~7원 가중 추첨 (기대값 약 3원)
--   earn_journey       : 14일 저니 완료 시 50원 고정
--   earn_subscription  : 구독 등급별 지급 (선택)
--   구독 등급 배수      : membership_plans.reward_multiplier 로 미션 적립을 배수 적용
--
-- 사용
--   spend_order        : 상품 결제에 사용 (음수)
--   refund_order       : 주문 취소·결제 실패 시 복구 (양수)
--   expire             : 유효기간 소멸 (음수)

BEGIN;

-- ---------------------------------------------------------------------------
-- 지급 규칙 (확률 고지를 위해 공개 읽기)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  display_label text NOT NULL,
  disclosure    text NOT NULL,
  min_amount    integer,
  max_amount    integer,
  fixed_amount  integer,
  weights       jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reward_rules_shape_check
    CHECK (fixed_amount IS NOT NULL OR weights IS NOT NULL)
);

COMMENT ON COLUMN public.reward_rules.disclosure IS
  '사용자에게 보여줄 확률·조건 고지 문구. 경품/할인 운영 시 고지 의무가 있어 화면에 노출합니다.';

DROP TRIGGER IF EXISTS reward_rules_updated_at ON public.reward_rules;
CREATE TRIGGER reward_rules_updated_at
BEFORE UPDATE ON public.reward_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 통합 원장 — 서버 함수로만 기록된다
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type      text NOT NULL,
  rule_code       text,
  -- 적립은 양수, 사용·소멸은 음수. 잔액은 SUM(amount).
  amount          integer NOT NULL CHECK (amount <> 0),
  -- 무상(마일리지) / 유상(구독 대가) 구분. 정산 성격이 달라 발행 시점에 남긴다.
  issue_type      text NOT NULL DEFAULT 'free',
  source_type     text NOT NULL,
  source_id       uuid NOT NULL,
  user_journey_id uuid REFERENCES public.user_journeys(id) ON DELETE SET NULL,
  memo            text,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_rewards_entry_type_check CHECK (entry_type IN
    ('earn_mission','earn_journey','earn_subscription','spend_order','refund_order','expire')),
  CONSTRAINT user_rewards_issue_type_check CHECK (issue_type IN ('free','paid')),
  CONSTRAINT user_rewards_source_type_check CHECK (source_type IN
    ('mission','journey','subscription','order','system')),
  -- 적립은 양수, 사용/소멸은 음수여야 한다
  CONSTRAINT user_rewards_sign_check CHECK (
    (entry_type IN ('earn_mission','earn_journey','earn_subscription','refund_order') AND amount > 0)
    OR (entry_type IN ('spend_order','expire') AND amount < 0)
  ),
  -- 같은 사건으로 두 번 기록되지 않는다
  CONSTRAINT user_rewards_once_per_event UNIQUE (user_id, entry_type, source_id)
);

CREATE INDEX IF NOT EXISTS user_rewards_user_idx ON public.user_rewards (user_id, created_at DESC);

COMMENT ON TABLE public.user_rewards IS
  '적립금 통합 원장. 잔액은 SUM(amount). 클라이언트는 INSERT 권한이 없고 SECURITY DEFINER 함수로만 기록된다.';

-- ---------------------------------------------------------------------------
-- 잔액 조회 (함수 내부·화면 공용)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reward_balance(p_user uuid)
RETURNS integer
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE(sum(amount), 0)::int FROM public.user_rewards WHERE user_id = p_user;
$$;

-- ---------------------------------------------------------------------------
-- 추첨 — 가중치 기반. 서버에서만 실행된다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.draw_reward_amount(p_code text)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rule   public.reward_rules;
  v_total  numeric := 0;
  v_pick   numeric;
  v_acc    numeric := 0;
  v_key    text;
  v_weight numeric;
BEGIN
  SELECT * INTO v_rule FROM public.reward_rules WHERE code = p_code AND is_active;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_rule.fixed_amount IS NOT NULL THEN RETURN v_rule.fixed_amount; END IF;

  SELECT COALESCE(sum(value::numeric), 0) INTO v_total FROM jsonb_each_text(v_rule.weights);
  IF v_total <= 0 THEN RETURN COALESCE(v_rule.min_amount, 0); END IF;

  v_pick := random() * v_total;
  FOR v_key, v_weight IN
    SELECT key, value::numeric FROM jsonb_each_text(v_rule.weights) ORDER BY key::int
  LOOP
    v_acc := v_acc + v_weight;
    IF v_pick <= v_acc THEN RETURN v_key::int; END IF;
  END LOOP;

  RETURN COALESCE(v_rule.max_amount, 0);
END $$;

-- ---------------------------------------------------------------------------
-- 구독 등급 적립 배수 — 활성 구독이 없으면 1.0
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reward_multiplier_for(p_user uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  v_multiplier numeric;
BEGIN
  SELECT p.reward_multiplier INTO v_multiplier
    FROM public.user_subscriptions s
    JOIN public.membership_plans p ON p.code = s.plan_code
   WHERE s.user_id = p_user
     AND s.status IN ('trialing', 'active')
     AND (s.current_period_end IS NULL OR s.current_period_end > now())
   ORDER BY p.reward_multiplier DESC
   LIMIT 1;

  RETURN COALESCE(v_multiplier, 1.0);
EXCEPTION
  WHEN undefined_table THEN RETURN 1.0;
END $$;

-- ---------------------------------------------------------------------------
-- 미션 완료 적립 — 본인의 완료된 미션에 대해 1회만
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_mission_reward(p_mission_id uuid)
RETURNS TABLE (amount integer, already_claimed boolean, balance integer, multiplier numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_journey uuid;
  v_base    integer;
  v_amount  integer;
  v_mult    numeric;
  v_prev    integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT m.user_journey_id INTO v_journey
    FROM public.user_missions m
   WHERE m.id = p_mission_id AND m.user_id = v_user AND m.status = 'completed';

  IF v_journey IS NULL THEN
    RAISE EXCEPTION 'mission not completed or not owned' USING ERRCODE = '42501';
  END IF;

  SELECT r.amount INTO v_prev
    FROM public.user_rewards r
   WHERE r.user_id = v_user AND r.entry_type = 'earn_mission' AND r.source_id = p_mission_id;

  IF v_prev IS NOT NULL THEN
    RETURN QUERY SELECT v_prev, true, public.reward_balance(v_user), 1.0::numeric;
    RETURN;
  END IF;

  v_base := public.draw_reward_amount('daily_mission');
  v_mult := public.reward_multiplier_for(v_user);
  v_amount := GREATEST(1, round(v_base * v_mult)::int);

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, user_journey_id, memo)
  VALUES
    (v_user, 'earn_mission', 'daily_mission', v_amount, 'free', 'mission', p_mission_id, v_journey,
     CASE WHEN v_mult <> 1.0 THEN format('기본 %s원 x 등급 %s배', v_base, v_mult) ELSE NULL END);

  RETURN QUERY SELECT v_amount, false, public.reward_balance(v_user), v_mult;
END $$;

-- ---------------------------------------------------------------------------
-- 저니 완주 적립 — 완료된 본인 저니에 대해 1회만
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_journey_reward(p_journey_id uuid)
RETURNS TABLE (amount integer, already_claimed boolean, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_ok     boolean;
  v_amount integer;
  v_prev   integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT true INTO v_ok
    FROM public.user_journeys j
   WHERE j.id = p_journey_id AND j.user_id = v_user AND j.status = 'completed';

  IF v_ok IS NULL THEN
    RAISE EXCEPTION 'journey not completed or not owned' USING ERRCODE = '42501';
  END IF;

  SELECT r.amount INTO v_prev
    FROM public.user_rewards r
   WHERE r.user_id = v_user AND r.entry_type = 'earn_journey' AND r.source_id = p_journey_id;

  IF v_prev IS NOT NULL THEN
    RETURN QUERY SELECT v_prev, true, public.reward_balance(v_user);
    RETURN;
  END IF;

  v_amount := public.draw_reward_amount('journey_complete');

  INSERT INTO public.user_rewards
    (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, user_journey_id)
  VALUES
    (v_user, 'earn_journey', 'journey_complete', v_amount, 'free', 'journey', p_journey_id, p_journey_id);

  RETURN QUERY SELECT v_amount, false, public.reward_balance(v_user);
END $$;

-- ---------------------------------------------------------------------------
-- 권한 · RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.reward_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reward_rules FROM anon, authenticated;
REVOKE ALL ON public.user_rewards FROM anon, authenticated;

GRANT SELECT ON public.reward_rules TO anon, authenticated;
GRANT SELECT ON public.user_rewards TO authenticated;

DROP POLICY IF EXISTS reward_rules_read ON public.reward_rules;
CREATE POLICY reward_rules_read ON public.reward_rules
  FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS user_rewards_select_own ON public.user_rewards;
CREATE POLICY user_rewards_select_own ON public.user_rewards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Postgres 는 함수 EXECUTE 를 기본으로 PUBLIC 에 부여한다.
-- anon/authenticated 만 REVOKE 하면 PUBLIC 경유로 여전히 호출된다. 반드시 PUBLIC 부터 회수한다.
REVOKE ALL ON FUNCTION public.draw_reward_amount(text)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_multiplier_for(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_balance(uuid)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_mission_reward(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_journey_reward(uuid)    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_mission_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_journey_reward(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 시드
-- ---------------------------------------------------------------------------
INSERT INTO public.reward_rules (code, name, display_label, disclosure, min_amount, max_amount, weights)
VALUES (
  'daily_mission', '미션 완료 적립', '오늘의 적립',
  '미션을 완료하면 1~7원이 무작위로 적립됩니다. (1원 24%, 2원 22%, 3원 18%, 4원 14%, 5원 10%, 6원 7%, 7원 5%) 구독 등급에 따라 배수가 적용될 수 있습니다.',
  1, 7, '{"1":24,"2":22,"3":18,"4":14,"5":10,"6":7,"7":5}'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, display_label = EXCLUDED.display_label, disclosure = EXCLUDED.disclosure,
  min_amount = EXCLUDED.min_amount, max_amount = EXCLUDED.max_amount,
  weights = EXCLUDED.weights, updated_at = now();

INSERT INTO public.reward_rules (code, name, display_label, disclosure, fixed_amount)
VALUES (
  'journey_complete', '14일 완주 보너스', '완주 보너스',
  '14일 저니를 완료하면 50원이 적립됩니다.', 50
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, display_label = EXCLUDED.display_label, disclosure = EXCLUDED.disclosure,
  fixed_amount = EXCLUDED.fixed_amount, updated_at = now();

COMMIT;
