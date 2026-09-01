-- MEBODY Journey — starter_14d 템플릿 시드
--
-- 16개 코드별 프로그램을 하드코딩하지 않는다.
-- 여기에는 "Day N 에 P1축/P2축 미션을 몇 개 배치할지"만 있고,
-- 어떤 콘텐츠가 나올지는 런타임에 journey_content_tags + 피드백으로 결정된다.
--
--   홀수일  -> P1축(가장 뚜렷한 축) 1개
--   짝수일  -> P2축 1개
--   Day 7   -> P1 이완 + P2 스트레칭 + Weekly Report
--   Day 14  -> P1 + P2 + Progress Check
--
-- 재실행 안전: code 충돌 시 갱신.

INSERT INTO public.journey_templates (code, name, description, duration_days, day_plan, is_active)
VALUES (
  'starter_14d',
  '14일 스타터 저니',
  '결과에서 확인한 관리 우선순위 1·2축을 하루 한 가지씩 짧게 관리하는 2주 프로그램입니다.',
  14,
  '{
  "version": 1,
  "base_difficulty": {
    "1-4": 1,
    "5-10": 2,
    "11-14": 3
  },
  "days": [
    {
      "day": 1,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 2,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 3,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 4,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 5,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 6,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 7,
      "kind": "weekly_report",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "release"
        },
        {
          "slot_no": 2,
          "axis_rank": 2,
          "mission_type": "stretch"
        }
      ]
    },
    {
      "day": 8,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 9,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 10,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 11,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 12,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 13,
      "kind": "normal",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        }
      ]
    },
    {
      "day": 14,
      "kind": "progress_check",
      "slots": [
        {
          "slot_no": 1,
          "axis_rank": 1,
          "mission_type": "combo"
        },
        {
          "slot_no": 2,
          "axis_rank": 2,
          "mission_type": "combo"
        }
      ]
    }
  ]
}'::jsonb,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  duration_days = EXCLUDED.duration_days,
  day_plan      = EXCLUDED.day_plan,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();
