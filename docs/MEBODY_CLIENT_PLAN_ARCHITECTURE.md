# MEBODY Client Plan Architecture

작성 기준: 2026-09-19 운영 DB 실측 + 실제 코드. 기존 감사 문서와 어긋나는 부분은 코드를 따랐다.

> 기존 `MEBODY_PRODUCT_AUDIT.md` 는 public 테이블을 37개로 적었다. 현재는 **36개**다.
> `questions_archive` 가 마이그레이션 050 으로 삭제됐다.

---

## 1. 한 줄 결론

**Client Plan 이라는 새 도메인을 세울 필요가 없다. `user_journeys` 가 이미 Client Plan 이다.**

이름만 다르고 담고 있는 것이 같다. 새 테이블을 세우면 저니와 이중 관리가 되고, 지금 112개 규칙
테스트로 보호되는 흐름이 깨진다.

---

## 2. 현재 구조

### 2.1 데이터 흐름

```
questions(32행)
   │  fetchQuestions()  is_active AND question_set='mebody_v1_32'
   ↓
questionnaire_responses            ← 응답·계산된 코드·축 점수·아이덴티티
   │  save_questionnaire_response() / get_questionnaire_response()
   ↓
body_code_content(16행)            ← 캐릭터·아이덴티티·공유·케어 전략
body_code_result_sections(96행)    ← 코드 플랜 상세
result_guide(4행)                  ← 자세 사용 설명서
   ↓
user_journeys                      ← 14일 관리 인스턴스
   │  journey_templates.day_plan + selectDailyMissions()
   ↓
user_missions                      ← 날짜·슬롯별 배정된 미션
   │  immediate_action_content(23행) + journey_content_tags(23행)
   ↓
journey_mission_feedback           ← 느낌·난이도·메모
journey_reports                    ← 주간 리포트 / 중간 점검 (payload jsonb)
   ↓
user_rewards                       ← 적립금 원장
```

### 2.2 기능별 상태

| 기능 | 상태 | 현재 위치 | 재사용 |
|---|---|---|---|
| 32문항 questionnaire | WORKING | `questions`, `src/api/questionnaire.ts` | 그대로 |
| 4축 점수 | WORKING | `src/utils/bodyCodeCalculator.ts`, `question_choice_scores` | 그대로 |
| 16 body code | WORKING | `body_code_content` | 그대로 |
| result / identity / character | WORKING | `src/components/home/resultData.tsx` | 그대로 |
| result sections | WORKING | `body_code_result_sections` | 그대로 |
| priority (축 우선순위) | WORKING | `buildAxisPriority()` → `user_journeys.axis_priority` | 그대로 |
| immediate action | WORKING | `immediate_action_content` + 축·불편 매핑 2종 | 그대로 |
| care strategy | WORKING | `body_code_content.strategy_*` | 그대로 |
| journey | WORKING | `user_journeys`, 저니 화면 6개 | **확장 대상** |
| daily mission | WORKING | `user_missions`, `selectDailyMissions()` | **확장 대상** |
| mission completion | WORKING | `startMission`/`completeMission`/`skipMission` | 그대로 |
| feedback | WORKING | `journey_mission_feedback` | 그대로 |
| progress | WORKING | `fetchTodayProgressSummary`, `calculateDayProgress` | 그대로 |
| reassessment | WORKING | `fetchJourneyComparison`, `journeyCompare.ts` | 그대로 |
| auth | WORKING | Supabase Auth + 서버 가입 경로 | 그대로 |
| my page | WORKING | `StatusScreen`, `StatusSections` | 그대로 |
| membership | PARTIAL | 해지·안내는 동작, 실결제 미연동(dev 어댑터) | 그대로 |
| share | WORKING | `src/lib/share.ts`, 코드만 전달 | 그대로 |
| analytics | UI_ONLY | `src/lib/analytics.ts` 인터페이스만, 외부 SDK 없음 | **전문가 지표에 필요** |
| Supabase schema | WORKING | 36 테이블, RLS 전부 활성 | 부분 확장 |
| content library | PARTIAL | `immediate_action_content` 23행이 정본. 결과 콘텐츠 3종은 역할 중복 | **확장 대상** |

---

## 3. 목표 구조

```
                    Client Profile
                          │
           ┌──────────────┴──────────────┐
    전문가 없음                      전문가 연결
           │                              │
   selectDailyMissions()          Trainer / Physio
   (이미 있음, 112 테스트)         (Plan 편집·미션 배정)
           └──────────────┬──────────────┘
                          ↓
            user_journeys  ← Client Plan
                          ↓
            user_missions  ← Today
                          ↓
      journey_mission_feedback / journey_reports
                          ↓
                      Progress
```

두 경로가 **같은 테이블에 쓴다.** 고객 화면은 누가 배정했는지 몰라도 하나의 흐름으로 수행한다.
구분이 필요한 곳은 `user_missions.source_rule` 하나다.

---

## 4. Client Profile

| 영역 | 항목 | 현재 위치 | 판정 |
|---|---|---|---|
| BODY | questionnaire, body code, axis scores | `questionnaire_responses` | EXISTING |
| BODY | body priorities | `user_journeys.axis_priority` (스냅샷) | EXISTING |
| BODY | reassessment history | 같은 사용자의 여러 `questionnaire_responses` | EXISTING |
| BODY | 키·몸무게 | `user_profiles.height_cm`, `weight_kg` | EXISTING (UI 미연결) |
| EXERCISE | available time | `JourneyTodayScreen` 의 화면 상태 (저장 안 됨) | **EXTEND** |
| EXERCISE | goal, experience, days, equipment | 없음 | **NEW** |
| EXERCISE | exercise history | `user_missions` 완료 이력으로 근사 가능 | EXISTING |
| RECOVERY | sleep, fatigue, condition | 없음 | **NEW** (체크인 엔진) |
| NUTRITION / SUPPLEMENT | 전부 | 없음 | **FUTURE** |
| BEHAVIOR | mission completion, adherence | `user_missions.status` + `mission_achievement_rate` | EXISTING |
| BEHAVIOR | feedback | `journey_mission_feedback` | EXISTING |
| BEHAVIOR | streak, inactivity | `user_journeys.last_active_at`, `daysSince()` | EXISTING |
| PROFESSIONAL | assigned trainer | 없음 | **NEW** (`professional_clients`) |
| PROFESSIONAL | notes, assigned program | 없음 | **NEW** |

**지금 당장 필요한 것은 EXERCISE 의 available time 하나다.** 이미 화면에 있는데 저장만 안 한다.
나머지 NEW 는 체크인 엔진(§6)으로 한꺼번에 받는 쪽이 테이블을 덜 만든다.

---

## 5. Client Plan — `user_journeys` 확장

### 지금 컬럼

```
id, user_id, questionnaire_response_id, template_code, body_code,
axis_priority(jsonb), status, current_day,
started_at, last_active_at, completed_at, created_at, updated_at
```

목표 개념 중 Goal / Journey / Weekly Structure / Mission / Progress 가 이미 다 들어 있다.
`template_code` → `journey_templates.day_plan` 이 Weekly Structure 다.

### 더할 것 (EXTEND, 3컬럼)

| 컬럼 | 값 | 이유 |
|---|---|---|
| `plan_source` | `MEBODY_ENGINE` \| `PROFESSIONAL` | 누가 만든 Plan 인지 |
| `professional_id` | nullable uuid → `professionals.id` | 누가 관리하는지 |
| `goal` | nullable text | 전문가가 적는 목표. 엔진 Plan 은 null |

`plan_source` 기본값은 `MEBODY_ENGINE` 이다. 기존 2행은 그대로 유효하다.

### 하지 않을 것

- `client_plans` 새 테이블 — 저니와 1:1 이라 두 곳을 맞춰야 한다
- `goal` 을 별도 테이블로 — 지금은 한 줄이면 된다
- Plan 과 Journey 분리 — 14일이 끝나면 새 저니를 시작한다. Plan 의 생애가 저니의 생애와 같다

---

## 6. Check-in — `journey_reports` 재사용

```
journey_reports: id, user_journey_id, user_id, report_type, day_no, payload(jsonb), created_at
```

`report_type` 으로 주간 리포트와 중간 점검을 이미 구분하고 있고 **내용은 payload jsonb** 다.
수면·컨디션·영양 체크인을 여기에 `report_type='CHECKIN_SLEEP'` 처럼 넣으면 테이블이 늘지 않는다.

### 32문항 구조를 재사용해야 하는가 — 하지 않는다

| | 32문항 questionnaire | 반복 체크인 |
|---|---|---|
| 횟수 | 생애 몇 번 | 매일·매주 |
| 목적 | 코드 산출 | 상태 기록 |
| 채점 | `question_choice_scores` 96행과 결합 | 채점 없음 |
| 문항 | 고정 32개 | 전문가가 바꿈 |

억지로 한 테이블에 넣으면 `question_set` 이 계속 늘고, 이번에 정리한 옛 문항 문제가 그대로 재발한다.
**문항 정의는 `journey_templates` 처럼 jsonb 템플릿으로, 응답은 `journey_reports.payload` 로** 받는다.

---

## 7. Plan Source 추적

`user_missions.source_rule` 이 이미 배정 이유를 담는다.

```ts
type MissionSourceRule = 'axis_p1' | 'axis_p2' | 'substitute' | 'restart' | 'extra_time'
```

전문가 배정은 값 하나를 더한다.

```ts
| 'professional'
```

누가 배정했는지까지 알아야 하면 `user_missions.assigned_by`(nullable uuid) 한 컬럼을 더한다.
`source_rule='professional'` 이면서 `assigned_by` 가 채워진다.

**적립금 주의**: `claim_mission_reward` 가 미션 완료로 적립금을 준다. 전문가가 미션을 만들 수 있게
되는 순간 적립금 발급 경로가 열린다. Phase 3 에서 전문가 배정 미션의 적립 대상 여부를 먼저 정한다.

---

## 8. 추천 엔진 — 이미 있다

`src/utils/journeyRules.ts` 의 `selectDailyMissions()` 가 브리프의 Recommendation Engine 이다.

**입력**: dayNo, dayPlan, axisPriority, contentTags, feedback, recentContentKeys,
availableMinutes, lastActiveAt
**출력**: `PlannedMission[]` (content_key, mission_type, duration, difficulty, source_rule)

규칙 기반이고 AI 가 없다. 승인된 콘텐츠(`immediate_action_content` 23행) 안에서만 고른다.
브리프가 요구한 V1 구조와 같다. 112개 테스트가 지키고 있다.

### 향후 AI 를 넣을 자리

```
Client Data → selectDailyMissions() → Plan Draft → [AI 설명 생성] → 전문가 검토 → 승인 → Client Plan
```

AI 가 운동을 자유롭게 처방하지 않는다. **콘텐츠 선택은 규칙이 하고, AI 는 설명과 요약만 한다.**
안전상 이 경계를 코드 구조로 못 박는다. `plan_source` 에 `AI_DRAFT` 를 더하고, 전문가가 승인해야
`PROFESSIONAL` 로 바뀌게 하면 승인 전 Plan 이 고객에게 노출되지 않는다.

---

## 9. 콘텐츠 라이브러리

| 테이블 | 행 | 역할 | 판정 |
|---|---|---|---|
| `immediate_action_content` | 23 | 이완·스트레칭 콘텐츠 정본 | **KEEP + EXTEND** |
| `journey_content_tags` | 23 | 축·방향 태그 | KEEP |
| `immediate_action_axis_mapping` | 8 | 축 → 콘텐츠 | KEEP |
| `immediate_action_discomfort_mapping` | 32 | 불편 → 콘텐츠 | KEEP |
| `body_code_content` | 16 | 코드별 캐릭터·전략 | KEEP |
| `body_code_result_sections` | 96 | 코드 플랜 상세 | KEEP (감사 문서가 역할 중복 지적) |
| `result_guide` | 4 | 자세 사용 설명서 | KEEP |
| `sere_contents` | 3 | 참조 0곳 | **DEPRECATE 후보** |
| `prompts` | 13 | 참조 0곳, 다른 제품 잔재 | **DEPRECATE 후보** |

### `immediate_action_content` 확장 (EXTEND, 2컬럼)

| 컬럼 | 값 | 이유 |
|---|---|---|
| `creator_type` | `MEBODY` \| `PROFESSIONAL` | 누가 만든 콘텐츠인지 |
| `visibility` | `PUBLIC` \| `PROFESSIONAL_ONLY` | 전문가가 만든 것을 전체 공개하지 않기 위해 |

전문가별 라이브러리를 따로 만들지 않는다. **한 테이블에 태그로 구분한다.**
`creator_type='PROFESSIONAL'` 인 콘텐츠는 그 전문가의 고객에게만 보인다.
