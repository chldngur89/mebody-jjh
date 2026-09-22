-- ===========================================================================
-- MEBODY — 월 상한 트리거가 memo 를 깨뜨리던 것을 고친다
--
-- ※ db/journey 폴더의 065 입니다. 057 적용 뒤에 돌립니다.
--
-- ── 무엇이 깨졌나
-- 057 의 상한 트리거가 금액을 깎을 때 memo 에 설명을 덧붙였습니다.
--
--     NEW.memo := coalesce(NEW.memo,'') || ' [월상한 49원 적용: 2→0]'
--
-- 그런데 **주사위 적립의 memo 는 JSON 문자열입니다.**
--
--     {"dice": 6, "service_day": "2026-09-22"}
--
-- 평문을 뒤에 붙이면 JSON 이 깨집니다.
--
--     {"dice": 6, "service_day": "2026-09-22"} [월상한 49원 적용: 2→0]
--
-- 그리고 claim_daily_routine_reward · claim_routine_bonus_reward 는 "이미 받은 날" 을
-- 판정할 때 그 memo 를 `(v_prev.memo)::jsonb ->> 'dice'` 로 읽습니다.
-- 즉 **상한에 닿은 사람이 다음에 주사위 화면을 열면 그 자리에서 실패합니다.**
--
-- 실측: invalid input syntax for type json — Expected end of input, but found "[".
-- verify:fulfillment 이 이걸 잡아냈습니다.
--
-- ── 고치는 방법
-- memo 가 JSON 이면 **키를 하나 넣고**, 아니면 예전처럼 평문을 덧붙입니다.
-- 어느 쪽이든 읽는 쪽이 깨지지 않습니다.
--
-- ── 이미 깨진 행이 있으면
-- 아래에서 찾아 고칩니다. 상한이 걸린 적이 있어야 생기는 일이라 지금은 없을 수 있습니다.
--
-- 선행: 057 적용 완료
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.enforce_reward_monthly_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_remaining integer;
  v_note      jsonb;
BEGIN
  IF NEW.entry_type NOT IN ('earn_mission','earn_journey','earn_routine',
                            'earn_routine_bonus','earn_weekly','earn_monthly','earn_subscription') THEN
    RETURN NEW;
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RETURN NEW;  -- 꽝은 그대로 남깁니다(오늘 굴렸다는 기록).
  END IF;

  v_remaining := public.reward_remaining_this_month(NEW.user_id);

  IF NEW.amount > v_remaining THEN
    -- memo 가 JSON 이면 키로 넣습니다. 평문을 덧붙이면 JSON 이 깨지고,
    -- 그 memo 를 읽는 주사위 청구 함수가 다음 호출에서 실패합니다.
    BEGIN
      v_note := NEW.memo::jsonb;
      v_note := v_note || jsonb_build_object(
        'monthly_cap', public.reward_monthly_cap(),
        'capped_from', NEW.amount,
        'capped_to',   v_remaining);
      NEW.memo := v_note::text;
    EXCEPTION WHEN others THEN
      -- JSON 이 아니면(비어 있거나 평문) 예전처럼 뒤에 적습니다.
      NEW.memo := nullif(coalesce(NEW.memo, ''), '')
        || format('%s[월상한 %s원 적용: %s→%s]',
                  CASE WHEN coalesce(NEW.memo, '') = '' THEN '' ELSE ' ' END,
                  public.reward_monthly_cap(), NEW.amount, v_remaining);
    END;

    NEW.amount := v_remaining;
  END IF;

  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 이미 깨진 memo 복구 — JSON 으로 시작하는데 파싱이 안 되는 행
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_row   record;
  v_fixed integer := 0;
BEGIN
  FOR v_row IN
    SELECT id, memo FROM public.user_rewards
     WHERE memo LIKE '{%' AND memo LIKE '%[월상한%'
  LOOP
    BEGIN
      PERFORM v_row.memo::jsonb;   -- 파싱되면 건드리지 않습니다
    EXCEPTION WHEN others THEN
      -- 덧붙은 평문을 떼고 같은 내용을 키로 옮깁니다.
      UPDATE public.user_rewards
         SET memo = (regexp_replace(v_row.memo, '\s*\[월상한[^\]]*\]', '', 'g')::jsonb
                     || jsonb_build_object('monthly_cap', public.reward_monthly_cap()))::text
       WHERE id = v_row.id;
      v_fixed := v_fixed + 1;
    END;
  END LOOP;
  RAISE NOTICE '깨진 memo 복구: %건', v_fixed;
END $$;

-- ---------------------------------------------------------------------------
-- 확인 — JSON 으로 시작하는 memo 는 모두 파싱되어야 합니다.
-- ---------------------------------------------------------------------------
SELECT count(*) AS "JSON 으로 시작하는 memo"
  FROM public.user_rewards WHERE memo LIKE '{%';

SELECT count(*) AS "그중 파싱 실패 (0이어야)"
  FROM public.user_rewards r
 WHERE r.memo LIKE '{%'
   AND NOT (r.memo ~ '^\s*\{.*\}\s*$');
