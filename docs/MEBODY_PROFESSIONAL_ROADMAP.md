# MEBODY Professional Roadmap

> **진행 현황 (2026-09-22)**
>
> | Phase | 상태 | 마이그레이션 | 검증 |
> |---|---|---|---|
> | 0 기반 | 완료 | `052`·`053` | 24건 |
> | 1 계정·초대·결과 | 완료 | — | 61건에 포함 |
> | 2 수행 데이터 | 완료 | `056` | 61건에 포함 |
> | 3 미션 배정 | 완료 | `059`·`060` | 61건에 포함 |
> | 4 규칙 엔진 초안 | 미착수 | | |
> | 5 주의 대시보드 | 미착수 | | |
>
> **문서와 다르게 간 것 두 가지.**
>
> 1. Phase 2 의 `DB CHANGE` 는 "테이블 추가 없음" 이라고 적혀 있지만, 같은 Phase 의 지표
>    "주간 활성 전문가 비율" 은 전문가별 행이 있어야 셀 수 있다. `analytics_events`(054)는
>    개인 식별 값을 일부러 넣지 않는 테이블이라 쓸 수 없어서 `professional_activity_log` 를 더했다.
>    로드맵 쪽이 틀렸다.
>
> 2. Phase 3 의 "먼저 정할 것 — 전문가 배정 미션이 적립금 대상인가" 는 `057` 의 월 상한(49원)이
>    답을 만들었다. 전문가가 미션을 몇 개 만들든 그 고객의 한 달 무료 적립은 49원을 넘지 못한다.
>    그래서 예외를 두지 않았다 — 예외를 두면 고객이 트레이너 숙제를 할수록 손해 보는 구조가 된다.
>
> **Phase 4 로 가기 전에**: Phase 1~3 의 분석 이벤트가 아직 서버 쪽 2개(`invite_sent`,
> `professional_result_viewed`)를 쏘지 않는다. 각 Phase 의 FAILURE CONDITION 을 판단할 숫자가
> 없으면 멈출지 말지를 정할 수 없다.

작성 기준: 2026-09-19. 사용자 결정: 전문가 화면은 서버 관리자 콘솔, 퍼스널 트레이너 먼저.

---

## Phase 조정과 이유

브리프의 Phase 0~5 를 대체로 따르되 **두 가지를 바꿨다.**

1. **결과 열람 권한 설계를 Phase 0 으로 올렸다.** 브리프는 Phase 1 에 두었다. 하지만 이번 세션에서
   `questionnaire_responses` 를 막 잠갔고(044·045), 전문가에게 열어주는 방식을 잘못 정하면
   381행이 다시 새던 상태로 돌아간다. 관계 테이블보다 "어떻게 열 것인가" 가 먼저다.

2. **Phase 0 앞에 운영 필수 항목을 끝낸다.** 약관 본문이 아직 플레이스홀더다. AdSense·Play 심사에
   걸리는 항목이라 전문가 기능보다 먼저다. 심사를 통과하지 못한 제품 위에 B2B 를 얹을 수 없다.

---

## Phase 0 — 기반

### WHY
전문가에게 고객 데이터를 여는 방식을 먼저 정하고 검증한다. 여기가 이번 확장에서 가장 위험하다.

### 선행
약관·개인정보처리방침 본문, 결과 설명 강화, 14일 알림. (진행 중)

### DB CHANGE
`052_professional_core.sql` — `user_profiles.role` 에 `PROFESSIONAL` 값 추가,
`professionals`·`professional_clients` 두 테이블, `current_professional_id()` 헬퍼, RLS 정책.
`053_professional_client_read.sql` — `get_client_response()`.

### EXISTING REUSE
`current_seller_id()` 를 그대로 본떠 `current_professional_id()` 를 만든다.
`products` 의 소유자 RLS 패턴을 그대로 쓴다.

### SECURITY
새 테이블은 `REVOKE ALL FROM anon, authenticated` 후 필요한 것만 GRANT.
새 함수는 `REVOKE ALL FROM PUBLIC` 먼저. (041·048 의 교훈)

### TEST
`verify:professional` 신규. 관계 없음·초대 중·동의 전·해지 후·다른 전문가의 고객 모두 0행.
기존 23개 스위트 회귀.

### METRIC
없음. 기반 작업이다.

### FAILURE CONDITION
`verify:response-hardening` 27건 중 하나라도 깨지면 설계를 되돌린다.

---

## Phase 1 — 전문가 계정 · 초대 · 결과 열람

### WHY
전문가가 고객의 MEBODY 결과를 실제 상담에서 쓰는지 확인한다. 이게 아니면 나머지는 의미가 없다.

### BUSINESS HYPOTHESIS
퍼스널 트레이너는 신규 고객 첫 상담에서 MEBODY 체형 결과를 실제로 열어 본다.

### USER FLOW
전문가 계정 발급(관리자) → 콘솔에서 초대 링크 생성 → 카카오톡 전달 →
고객이 링크 열기 → 로그인/가입 → 동의 → (결과 없으면) 32문항 → 결과 →
전문가 콘솔에서 고객 결과 확인

### EXISTING REUSE
- 가입·승인 경로 전체 (`PublicAuthService`, 34개 검증)
- 비회원 결과 귀속 `claim_questionnaire_response()` (044 에서 만듦)
- 결과 콘텐츠 `body_code_content` 16행
- 관리자 콘솔 셸과 탭 구조

### DB CHANGE
Phase 0 에서 끝. 추가 없음.

### API CHANGE
`POST /api/professional/clients/invite` 초대 생성
`GET  /api/professional/clients` 내 고객 목록
`GET  /api/professional/clients/{id}` 고객 결과 1건
`POST /api/public/professional/accept` 고객이 동의 (앱에서 호출)

### UI CHANGE
- 서버 콘솔: 「고객」 탭 — 목록, 초대 링크 만들기, 고객 상세
- 앱: `?invite=<token>` 진입 시 동의 화면 한 장. **기존 화면은 건드리지 않는다**

### FILES
`mebody-server/.../professional/{controller,service,dto}` (신규)
`static/index.html`, `static/assets/web.js` (탭 추가)
`mebody-jjh/src/App.tsx` 부트스트랩에 `invite` 파라미터 (공유 `ref`/`code` 와 같은 자리)
`mebody-jjh/src/components/ProfessionalConsentScreen.tsx` (신규)

### SECURITY
초대 토큰은 추측 불가·1회용·7일 만료. 동의 없이는 0행.

### ANALYTICS
`invite_sent`, `invite_opened`, `invite_accepted`, `assessment_started`,
`assessment_completed`, `professional_result_viewed`

지금 `src/lib/analytics.ts` 는 인터페이스만 있고 실제로 보내지 않는다.
**Phase 1 에서 최소 수집기를 붙이지 않으면 가설을 검증할 수 없다.** 서버 이벤트 테이블 1개로 시작한다.

### PRIMARY METRIC
`professional_result_viewed` / `invite_sent` — 초대한 고객 중 결과까지 본 비율

### SECONDARY METRIC
`invite_opened`/`invite_sent`, `assessment_completed`/`invite_accepted`

### FAILURE CONDITION
트레이너 5명에게 2주를 주고 `professional_result_viewed` 가 초대의 30% 미만이면 멈춘다.
결과를 안 본다는 것은 상담에 쓰지 않는다는 뜻이고, Phase 2 이후는 전부 그 위에 얹히는 기능이다.

---

## Phase 2 — 수행 데이터 열람

### WHY
전문가가 고객의 수행 내역을 반복해서 확인하는지 본다. 한 번 보고 마는지, 습관이 되는지.

### BUSINESS HYPOTHESIS
트레이너는 세션 사이에 고객의 미션 수행 기록을 주 1회 이상 확인한다.

### EXISTING REUSE
`user_missions.status`, `journey_mission_feedback`, `fetchTodayProgressSummary()`,
`calculateDayProgress()`, `fetchJourneyComparison()` — **새 계산이 없다.**

### DB CHANGE
`get_client_journey_summary(p_client_user_id)` 함수 1개. 테이블 추가 없음.

### UI CHANGE
고객 상세에 활동 타임라인과 진행률.

### ANALYTICS
`professional_client_opened`, `professional_activity_viewed`, `weekly_professional_active`

### PRIMARY METRIC
주간 활성 전문가 비율 — 한 주에 고객 화면을 한 번이라도 연 전문가 / 전체 전문가

### FAILURE CONDITION
4주간 주간 활성이 40% 미만이면 Phase 3 을 보류하고 왜 안 보는지 듣는다.

---

## Phase 3 — 개입

### WHY
전문가가 MEBODY 를 통해 고객에게 실제 행동을 배정하는지 본다.

### BUSINESS HYPOTHESIS
트레이너는 세션 밖에서 고객에게 과제를 배정하고, 고객은 그것을 수행한다.

### DB CHANGE
`054_client_plan_source.sql` — `user_journeys` 에 `plan_source`·`professional_id`·`goal`,
`user_missions` 에 `assigned_by`·`prescription` jsonb.
`055_content_library_scope.sql` — `immediate_action_content` 에 `creator_type`·`visibility`.

### 먼저 정할 것
**전문가가 배정한 미션이 적립금 대상인가.** `claim_mission_reward` 가 미션 완료로 적립금을 준다.
전문가가 미션을 만들 수 있게 되는 순간 발급 경로가 열린다. 설계에서 명시적으로 정하고 검증한다.

### UI CHANGE
고객 상세에 미션 추가·메모. 앱의 오늘 화면은 **그대로 둔다.** 배정 출처가 무엇이든 같은 목록에 뜬다.

### ANALYTICS
`professional_assignment_created`, `client_assignment_started`, `client_assignment_completed`

### PRIMARY METRIC
배정 완료율 — `client_assignment_completed` / `professional_assignment_created`

### FAILURE CONDITION
배정 완료율이 30% 미만이면 배정이 고객에게 닿지 않는 것이다. 알림 없이는 어렵다는 신호이므로
알림을 먼저 붙인다.

---

## Phase 4 — 추천 · AI 초안

### WHY
MEBODY 가 전문가의 Plan 작성 시간을 줄이는지 본다.

### EXISTING REUSE
`selectDailyMissions()` 가 이미 규칙 기반 추천 엔진이다(112 테스트). **AI 없이 Phase 4 의 절반이 된다.**

### 순서
1. 규칙 엔진이 만든 Plan 초안을 전문가 콘솔에 보여주고 편집하게 한다 (AI 없음)
2. 그래도 시간이 안 줄면 그때 AI 를 얹는다

### AI 를 넣을 자리
콘텐츠 선택이 아니라 **설명과 요약**이다. "왜 이 순서인가" 를 고객 언어로 쓰는 일,
2주치 수행 기록을 전문가에게 3줄로 요약하는 일. 운동 처방 자체는 승인된 콘텐츠 안에서 규칙이 고른다.

### SECURITY
`plan_source` 에 `AI_DRAFT` 를 더한다. 전문가가 승인해야 `PROFESSIONAL` 이 되고, 승인 전 초안은
고객에게 보이지 않는다.

### PRIMARY METRIC
Plan 작성 소요 시간 (초안 제공 전후 비교)

### FAILURE CONDITION
초안을 쓰지 않고 처음부터 직접 만드는 전문가가 절반을 넘으면 추천 품질이 문제다.

---

## Phase 5 — 주의 대시보드

### WHY
고객이 늘면 전부 들여다볼 수 없다. 오늘 확인할 사람만 보여준다.

### 지금 데이터로 가능한가 — 가능하다
- 3일 미활동 → `user_journeys.last_active_at` + `daysSince()`
- HARD 피드백 반복 → `journey_mission_feedback.difficulty`
- 낮은 수행률 → `user_missions.status` 집계
- 저니 종료 임박 → `current_day` vs `duration_days`

**새 데이터가 필요 없다.** 집계 쿼리 하나다.

### PRIMARY METRIC
주의 목록에서 시작된 개입 비율

---

## 브리프의 질문 15개에 대한 답

**1. 몇 % 를 재사용할 수 있나**
테이블 36개 중 EXTEND 6개, 신규 2개, 나머지 28개는 그대로다. 저니·미션·피드백·진행률·콘텐츠·
추천 엔진·인증·결과 계산은 손대지 않는다. 새로 만드는 것은 전문가 화면과 관계·권한이다.
**데이터 모델 기준 90% 이상, 앱 화면 기준 100%** 다. 서버는 컨트롤러 한 묶음이 는다.

**2. Client Plan 이라는 새 도메인이 필요한가**
필요 없다. `user_journeys` 에 3컬럼을 더하면 된다.

**3. Journey 와 Client Plan 의 역할 차이**
차이가 없다. Plan 의 생애가 저니의 생애와 같다. 14일이 끝나면 새 저니를 시작한다.

**4. 가장 위험한 기존 기능**
`questionnaire_responses` 의 RLS. 044·045 로 막 잠갔다. 전문가에게 열어주려고 테이블 정책을
넓히면 381행이 다시 새던 상태로 돌아간다. 반드시 SECURITY DEFINER 함수로만 연다.

**5. 최소 신규 테이블**
2개. `professionals`, `professional_clients`. 초대는 관계 테이블에 흡수한다.

**6. questionnaire 구조를 Check-in 에 재사용해야 하나**
하지 않는다. 32문항은 1회성·채점 결합이고 체크인은 반복·무채점이다.
`journey_reports.payload` jsonb 가 이미 맞는 그릇이다.

**7. 현재 Mission 구조가 Professional Assignment 까지 확장되나**
된다. `source_rule` 이 이미 배정 이유를 담는다. 값 하나와 컬럼 둘을 더하면 된다.
다만 `planned_duration_sec`·`difficulty` 만 있어 세트·횟수·중량이 없다. `prescription` jsonb 가 필요하다.

**8. AI 없이 어디까지 되나**
Phase 3 까지 전부, Phase 4 의 절반. `selectDailyMissions()` 가 이미 규칙 기반 추천 엔진이다.

**9. AI 를 처음 넣을 가장 가치 있는 지점**
Plan 설명 생성과 수행 기록 요약. 콘텐츠 선택이 아니다. 설명은 매번 손으로 쓰기 번거롭고,
틀려도 안전하며, 전문가가 바로 고칠 수 있다.

**10. PT 와 Physio 를 같은 Core 로 못 담는 부분**
미션의 처방 표현이다. PT 는 세트·횟수·중량, Physio 는 유지 시간·통증 척도를 쓴다.
`prescription` jsonb 한 컬럼으로 둘 다 담는다. 타입별 테이블은 만들지 않는다.
그 밖에 의료 표현 가이드라인과 전문가 평가 기록은 Physio 전용이라 모듈로 나중에 뗀다.

**11. 지금 절대 건드리지 말아야 할 부분**
`questionnaire_responses` 의 RLS 정책, `save_questionnaire_response()`,
`selectDailyMissions()` 와 그 112개 테스트, 32문항 점수 계산.
전문가 기능은 이것들 **바깥에** 붙인다.

**12. 가장 작은 Professional MVP**
전문가 계정 + 초대 링크 + 고객 결과 한 화면. 그 이상은 Phase 2 다.

**13. 트레이너 5명에게 테스트하려면**
Phase 0 + Phase 1 + **최소 이벤트 수집기**. 지금 analytics 는 인터페이스만 있어 아무것도 보내지
않는다. 이게 없으면 "썼는가" 를 물어볼 수밖에 없고 그건 검증이 아니다.

**14. B2C 경험이 복잡해질 위험**
초대 동의 화면 한 장이 늘어날 뿐이다. 전문가가 없는 사용자에게는 아무것도 바뀌지 않는다.
전문가 화면은 서버 콘솔에 있어 앱 번들에 들어가지 않는다.
**단, 오늘 화면에 전문가 배정 미션이 섞이면 그때부터는 복잡해진다.** Phase 3 에서 표시를 정해야 한다.

**15. 전문가 기능이 실패해도 B2C 가 살아남나**
살아남는다. 전문가 테이블 2개를 지우고 저니의 3컬럼을 무시하면 지금 상태 그대로다.
고객 데이터는 전부 기존 테이블에 있고 `plan_source` 기본값이 `MEBODY_ENGINE` 이라
전문가 없는 경로가 항상 정상 경로다.
