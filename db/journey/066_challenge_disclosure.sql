-- ===========================================================================
-- MEBODY — 주간·월간 챌린지 고지에 "오전 5시 기준" 을 되살린다
--
-- ※ db/journey 폴더의 066 입니다.
--
-- 057 에서 금액을 내리며 고지 문구를 새로 썼는데, 원래 있던 "하루의 경계는 오전 5시" 가
-- 주간·월간 규칙에서 빠졌습니다. 챌린지는 "며칠 했는가" 로 판정하므로 하루의 경계가
-- 언제인지가 조건의 일부입니다. 그게 없으면 사용자는 자기가 며칠 했는지 셀 수 없습니다.
--
-- 기존 검증(verify:redesign)이 정확히 그 문장을 검사하고 있었고, 제가 지우는 바람에
-- 실패로 드러났습니다. 057·063 과 같은 종류의 누락입니다.
--
-- 금액과 규칙은 바꾸지 않습니다. 말만 되돌립니다.
-- ===========================================================================

UPDATE public.reward_rules SET
  disclosure = '한 주에 7일을 모두 마치면 2원이 적립됩니다. 하루의 경계는 오전 5시입니다. '
            || '무료 적립은 한 달 49원을 넘지 않습니다.',
  updated_at = now()
WHERE code = 'weekly_challenge';

UPDATE public.reward_rules SET
  disclosure = '한 달에 20일 이상 마치면 3원이 적립됩니다. 하루의 경계는 오전 5시입니다. '
            || '무료 적립은 한 달 49원을 넘지 않습니다.',
  updated_at = now()
WHERE code = 'monthly_challenge';

UPDATE public.reward_rules SET
  disclosure = '14일 루틴을 완주하면 3원이 적립됩니다. 하루의 경계는 오전 5시입니다. '
            || '무료 적립은 한 달 49원을 넘지 않습니다.',
  updated_at = now()
WHERE code = 'journey_complete';

-- ---------------------------------------------------------------------------
-- 확인 — 활성 규칙의 고지에 필요한 것이 다 들어 있는지
-- ---------------------------------------------------------------------------
SELECT code AS 규칙,
       fixed_amount AS 고정,
       disclosure LIKE '%오전 5시%' AS "하루 경계",
       disclosure LIKE '%한 달%'    AS "월 상한"
  FROM public.reward_rules
 WHERE is_active AND code IN ('weekly_challenge', 'monthly_challenge', 'journey_complete')
 ORDER BY code;
