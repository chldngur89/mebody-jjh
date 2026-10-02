-- ===========================================================================
-- 073 — 하루 경계를 한국시간 오전 5시 → 오전 6시로
--
-- 왜
--   · 경계 시각은 운영 판단입니다. 5시는 너무 이르다고 판단해 6시로 옮깁니다.
--   · 그리고 **그 사실을 화면에 적습니다.** 072 가 문구를 짧게 고치면서 경계가
--     어디에도 적히지 않게 됐습니다. 금액·확률과 달리 이건 숨길 이유가 없습니다.
--     "오늘 이미 받았다" 는 말을 들은 사용자가 언제 다시 되는지 알 길이 없었습니다.
--
-- 안전한가
--   mebody_service_day() 는 IMMUTABLE 입니다. IMMUTABLE 함수의 정의를 바꾸면
--   그 함수로 만든 **인덱스나 생성 컬럼이 조용히 깨집니다** — 저장된 값은 옛 정의로
--   계산됐는데 질의는 새 정의로 찾기 때문입니다.
--   확인했습니다: 이 함수는 함수 본문 안에서만 쓰이고 인덱스·생성 컬럼·제약에는
--   쓰이지 않습니다. 그래서 정의를 바꿔도 깨질 인덱스가 없습니다.
--
-- 한 번 지나가는 경계 효과
--   이미 쌓인 user_rewards 의 source_id 는 **적립 당시의 날짜로 굳어 있습니다**
--   (md5(user || ':routine:' || service_day)). 다시 계산하지 않습니다.
--   그래서 적용 후 딱 한 번, 한국시간 05:00~05:59 사이에는 service_day 가 전날로
--   잡혀 "어제 굴린 것" 이 오늘 것으로 보입니다. 그 한 시간이 지나면 정상입니다.
--   과거 기록을 고쳐 쓰는 것보다 한 시간의 어긋남이 낫습니다 — 원장은 사실의 기록이고,
--   나중 규칙으로 과거를 다시 쓰면 그게 더 큰 거짓말이 됩니다.
--
-- 적용: psql "$SUPABASE_DB_URL" -f db/journey/073_service_day_six_am.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 경계 시각
--    예) 2026-09-02 05:59 KST → 2026-09-01
--        2026-09-02 06:00 KST → 2026-09-02
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mebody_service_day(p_at timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT ((p_at AT TIME ZONE 'Asia/Seoul') - interval '6 hours')::date;
$$;

COMMENT ON FUNCTION public.mebody_service_day(timestamptz) IS
  'MEBODY 하루 경계. 한국시간 오전 6시에 날짜가 바뀝니다(073 에서 5시 → 6시).';

-- ---------------------------------------------------------------------------
-- 2) 경계를 화면에도 적습니다
--
--    매일 하는 것은 주사위 하나뿐이라 거기에만 적습니다. 보상형은 기본 적립을 마친
--    뒤에만 열리므로 같은 하루를 따릅니다 — 한 줄을 더 붙이면 잔소리가 됩니다.
--    확률과 상한은 여전히 말하지 않습니다(072 참고).
-- ---------------------------------------------------------------------------
UPDATE public.reward_rules SET disclosure =
  '주사위를 굴리면 적립금이 쌓여요. 매일 오전 6시(한국 시간)에 새로 굴릴 수 있고, '
  '모은 적립금은 마켓에서 쓰실 수 있습니다.'
WHERE code = 'daily_routine_dice';

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_txt text; v_n int;
BEGIN
  -- 경계가 실제로 6시인지. 05:59 는 전날, 06:00 은 당일이어야 합니다.
  IF public.mebody_service_day('2026-09-02 05:59:59+09'::timestamptz) <> '2026-09-01'::date THEN
    RAISE EXCEPTION '073 실패: 05:59 KST 가 전날로 잡히지 않습니다';
  END IF;
  IF public.mebody_service_day('2026-09-02 06:00:00+09'::timestamptz) <> '2026-09-02'::date THEN
    RAISE EXCEPTION '073 실패: 06:00 KST 가 당일로 잡히지 않습니다';
  END IF;
  IF public.mebody_service_day('2026-09-02 23:59:59+09'::timestamptz) <> '2026-09-02'::date THEN
    RAISE EXCEPTION '073 실패: 23:59 KST 가 당일로 잡히지 않습니다';
  END IF;

  -- 경계가 문구에 적혀 있는지.
  SELECT disclosure INTO v_txt FROM public.reward_rules WHERE code = 'daily_routine_dice';
  IF v_txt NOT LIKE '%오전 6시%' THEN
    RAISE EXCEPTION '073 실패: 주사위 고지에 오전 6시가 없습니다';
  END IF;

  -- 옛 시각이 남아 있으면 안 됩니다 — 화면과 실제가 달라집니다.
  SELECT count(*) INTO v_n FROM public.reward_rules
   WHERE is_active AND disclosure LIKE '%오전 5시%';
  IF v_n > 0 THEN
    RAISE EXCEPTION '073 실패: 옛 "오전 5시" 문구가 %개 남아 있습니다', v_n;
  END IF;

  -- 072 가 세운 것들이 그대로인지 — 이 파일이 되돌리면 안 됩니다.
  IF public.reward_monthly_cap() <> 150 THEN
    RAISE EXCEPTION '073 실패: 월 예산이 150원이 아닙니다';
  END IF;
  SELECT count(*) INTO v_n FROM public.reward_rules
   WHERE is_active AND (disclosure LIKE '%1/6%' OR disclosure LIKE '%확률%');
  IF v_n > 0 THEN
    RAISE EXCEPTION '073 실패: 확률 문구가 %개 되살아났습니다', v_n;
  END IF;

  RAISE NOTICE '073 완료 — 하루 경계 오전 6시, 고지에 반영';
END $$;
