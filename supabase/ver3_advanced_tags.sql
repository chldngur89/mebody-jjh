-- mebody Ver3 minimal schema
-- 실행 위치: Supabase SQL Editor
-- 목표:
--   1) 새 테이블을 만들지 않는다.
--   2) questionnaire_responses 컬럼 몇 개만 추가한다.
--   3) 심화 3문항 문구는 기존 app_content JSON 키를 재사용한다.

BEGIN;

ALTER TABLE public.questionnaire_responses
  ADD COLUMN IF NOT EXISTS deep_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (deep_status IN ('not_started', 'previewed', 'in_progress', 'completed', 'retest_required')),
  ADD COLUMN IF NOT EXISTS advanced_preview_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS advanced_confirmed_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS advanced_followup_answers JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 기존 app_content 테이블이 있으면, 심화 3문항 정의를 JSON 1건으로 저장
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'app_content'
  ) THEN
    INSERT INTO public.app_content (key, value_json)
    VALUES (
      'advanced_tag_followups',
      '{
        "sitting-driven": {
          "title": "앉는 생활 영향",
          "questions": [
            { "order": 1, "question": "하루 4시간 이상 연속으로 앉아있나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 2, "question": "앉아서 모니터나 책을 볼 때 고개를 푹 숙이는 패턴을 오래 유지하나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 3, "question": "일주일에 땀이 날 정도의 하체/코어 운동을 1회 미만으로 하시나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" }
          ]
        },
        "work-dominant": {
          "title": "작업 비대칭",
          "questions": [
            { "order": 1, "question": "하루 중 한쪽 팔이나 손만 유독 반복해서 쓰거나, 한쪽 어깨에만 무게를 싣는 동작이 많나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 2, "question": "업무나 작업 시 고개나 몸통을 정면이 아닌 특정 한쪽 방향으로 계속 틀어놓고 유지하나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 3, "question": "서서 일할 때 항상 같은 쪽 다리에 체중을 싣거나, 앉아 있을 때 한쪽 다리만 유독 많이 쓰나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" }
          ]
        },
        "compensatory-neck": {
          "title": "목의 억지 보상",
          "questions": [
            { "order": 1, "question": "듀얼 모니터나 넓은 화면 등 고개와 시선을 빈번하게 이리저리 옮겨야 하는 환경인가요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 2, "question": "스마트폰/서류를 고개 숙여 보다가 다시 정면을 보는 등 위아래 시선 이동이 끊임없이 반복되나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 3, "question": "한 자세로 고정되기보다 사람을 응대하며 몸과 고개 방향을 수시로 트는 편인가요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" }
          ]
        },
        "ankle-limited": {
          "title": "발목 움직임 제한",
          "questions": [
            { "order": 1, "question": "두 발을 모으고 완전히 쪼그려 앉을 때, 뒤꿈치가 바닥에서 붕 뜨나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 2, "question": "계단을 내려갈 때 무릎이나 발목이 뻣뻣해서 몸이 쿵쿵 울리거나 엉거주춤해지나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 3, "question": "스쿼트(앉았다 일어서기)를 할 때, 상체가 앞으로 심하게 쏟아질 것 같나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" }
          ]
        },
        "hip-rotation-asymmetry": {
          "title": "고관절 회전 비대칭 의심",
          "questions": [
            { "order": 1, "question": "바닥에 양반다리를 하고 앉았을 때, 왼쪽과 오른쪽 무릎의 높이 차이가 명확하게 나나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 2, "question": "다리를 꼴 때, 특정 한쪽 다리를 위로 올리는 것만 압도적으로 편한가요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 3, "question": "짝다리를 짚을 때, 항상 같은 쪽 다리에 체중을 싣는 것이 편한가요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" }
          ]
        },
        "anterior-leaning-strategy": {
          "title": "앞쪽 주도 전략",
          "questions": [
            { "order": 1, "question": "서 있을 때 체중이 발가락 쪽으로 더 쏠리는 편인가요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 2, "question": "가만히 서 있으면 아랫배를 내밀고 버티는 자세가 더 편한가요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 3, "question": "오래 서 있으면 허리 아래나 앞사타구니가 먼저 뻐근해지나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" }
          ]
        },
        "posterior-leaning-strategy": {
          "title": "뒤쪽 주도 전략",
          "questions": [
            { "order": 1, "question": "서 있을 때 체중이 뒤꿈치 쪽으로 더 쏠리는 편인가요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 2, "question": "다리를 펴고 앉으면 허리가 쉽게 굽거나 뒤로 말리는 편인가요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" },
            { "order": 3, "question": "상체를 숙일 때 뒤허벅지가 심하게 당겨 움직임이 제한되나요?", "option_1": "① 예", "option_2": "② 보통 / 모르겠다", "option_3": "③ 아니오" }
          ]
        },
        "global-stiff-strategy": {
          "title": "전후면 동시 과긴장",
          "questions": [
            { "order": 1, "question": "허리 숙일 때 뒤허벅지 당김 vs 서서 배 낼 때 앞사타구니 팽팽함 중 어느 쪽이 평소 더 강한가요?", "option_1": "① 앞쪽 사타구니", "option_2": "② 둘 다 비슷하게 심함", "option_3": "③ 뒤쪽 허벅지" },
            { "order": 2, "question": "바닥에 다리 펴고 앉기 힘듦 vs 한 발로 서서 반대 무릎 가슴으로 당기기 힘듦 중 어느 쪽인가요?", "option_1": "① 앞쪽 무릎 당기기", "option_2": "② 둘 다 비슷하게 심함", "option_3": "③ 뒤쪽 다리 펴고 앉기" },
            { "order": 3, "question": "계단 오를 때 앞사타구니 묵직함 vs 걷다 멈출 때 뒤꿈치/종아리 뻣뻣함 중 어느 쪽인가요?", "option_1": "① 앞쪽 사타구니", "option_2": "② 둘 다 비슷하게 심함", "option_3": "③ 뒤쪽 종아리" }
          ]
        }
      }'::jsonb
    )
    ON CONFLICT (key) DO UPDATE SET
      value_text = NULL,
      value_json = EXCLUDED.value_json,
      updated_at = now();
  END IF;
END $$;

COMMIT;
