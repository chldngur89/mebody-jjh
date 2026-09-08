# MEBODY 앱 플로우 검증 계획

> 기준일: 2026-09-01
> 대상: `mebody-jjh` (32문항 앱). 홈페이지(`mebody-server`)는 별도.

## 0. 전제 — 지금 상태

계획을 세우기 전에 확인한 사실입니다.

| 항목 | 상태 |
|---|---|
| DB (개발계) | `APPLY_NOW.sql` 적용 완료. 하드닝 17건 · 저니 12건 통과 |
| 배포본 | **로컬과 다름.** 저니·적립은 있으나 15분 루틴 4축·주문·구독배수·디자인 토큰은 미배포 |
| 미커밋 | 17개 |

**따라서 1단계는 커밋·재배포입니다.** 배포본이 로컬과 다른 상태로 화면을 검증하면 무엇을 본 것인지 알 수 없습니다.

## 1. 이미 자동 검증된 것 — 다시 하지 않습니다

사람이 눈으로 볼 필요가 없는 영역입니다. 코드가 바뀌면 이것부터 돌립니다.

```bash
npm run verify:journey-rules   # 103건 — 규칙·타이머·비교·루틴 (DB 불필요)
npm run verify:hardening       #  17건 — 보안 구멍 + 앱 동작 유지
npm run verify:journey-db      #  12건 — 저니 카탈로그 · anon 차단
npm run verify:e2e             #  40건 — 회원·비회원 전 흐름 (롤백, 데이터 안 남음)
npm run build                  # 번들
```

이 5개가 **회귀 감지선**입니다. 화면 검증 전에 항상 먼저 통과시킵니다.

커버되는 것: 미션 배정 규칙 · 피드백 반영 · 적립 금액과 중복 차단 · 주문 차감·환불 ·
구독 배수 · RLS 격리 · 원장 정합성 · 재측정 비교 · 15분 루틴 조합 · 리포트 집계.

## 2. 사람이 눈으로 봐야 하는 것

로직이 아니라 **화면이 그려지는가**입니다. 자동화로 대체할 수 없습니다.

### 2-A. 비회원 (제가 할 수 있음)

| # | 경로 | 합격 기준 |
|---|---|---|
| 1 | 랜딩 → 동의 → 안내 → 32문항 | 문항이 끊김 없이 진행, 뒤로가기 정상 |
| 2 | 완주 → 분석 → 결과 | 코드 4자·캐릭터·4축 그래프 표시 |
| 3 | 결과 새로고침 | 같은 결과 유지 (조회 RPC 동작) |
| 4 | 결과 → 코드 플랜 CTA | 비로그인이면 회원가입 화면으로 |
| 5 | 코드 플랜 미리보기 → 15분 루틴 | **목 → 어깨 → 골반 → 하체 5단계, 총 15분** |
| 6 | 결과 하단 스토어 | 상품 3개, 가격 표시 |
| 7 | 콘솔 | `42501` · `permission denied` 0건 |

### 2-B. 회원 (제가 못 함 — 로그인 필요)

**비밀번호 입력은 제 규칙상 불가하고, 관리자 링크 우회도 환경이 차단했습니다.**
로그인만 해주시면 이후는 제가 진행할 수 있습니다.

| # | 경로 | 합격 기준 |
|---|---|---|
| 1 | 회원가입 → 32문항 완주 | 결과가 계정에 저장 (`user_id` 채워짐) |
| 2 | 결과 → `14일 관리 시작하기` | Journey Intro 진입, **관리 우선순위 1·2순위 표시** |
| 3 | 시작하기 → 오늘의 미션 | Day 1 미션 배정, 1순위 축 콘텐츠 |
| 4 | 미션 시작 → 타이머 | 카운트다운 동작, 단계 자동 전환 |
| 5 | 완료 → 피드백 시트 | **적립 금액(1~7원) + 총 적립금 표시** |
| 6 | 같은 미션 재완료 | "이미 적립됨", 금액 안 늘어남 |
| 7 | 피드백 저장 후 다음 날 | 강도·콘텐츠가 바뀜 |
| 8 | 마이페이지 | 저니 진행 카드 표시 |
| 9 | 결과 하단 스토어 | **내 적립금 + 상품별 적립금 적용가** |
| 10 | 코드 플랜 | 수행률이 `MISSION · DAY N / 14`로 표시 |

### 2-C. 디자인 (제가 할 수 있음)

오늘 토큰을 바꿨으므로 전 화면을 훑어야 합니다.

| 확인 | 합격 기준 |
|---|---|
| 배경 | 크림 `#FAFAF0` 단색. 민트 그라데이션 잔존 없음 |
| 데스크톱 프레임 | 844px 고정, 테두리 보임, **내부 스크롤 동작** |
| 모바일 | 프레임 없음, 전체화면 |
| 화면별 | 랜딩·동의·안내·문항·분석·결과·코드플랜·가이드·마이페이지·멤버십·결제·저니 6종 |

## 3. 순서

```
1) 커밋 + 재배포          ← 지금 배포본이 로컬과 달라 이것부터
2) 자동 검증 5종 통과
3) 비회원 화면 (2-A)      ← 제가 진행
4) 디자인 훑기 (2-C)      ← 제가 진행
5) 로그인                 ← 직접 해주셔야 함
6) 회원 화면 (2-B)        ← 로그인 후 제가 진행
```

3·4는 5를 기다릴 필요가 없습니다. 병행 가능합니다.

## 4. 아직 확인할 수 없는 것

기능 자체가 없어 검증 대상이 아닌 항목입니다. 계획에서 제외합니다.

| 항목 | 이유 |
|---|---|
| 동작 이미지 렌더 | 이미지 23개 전부 비어 있음 |
| 상품 이미지 | 3개 전부 비어 있음 |
| 결제 승인 | 결제사 미정. 주문은 `PENDING`까지만 |
| 알림·리마인더 | 미구현 |
| Day 7·14 리포트 실데이터 | 14일을 실제로 보내야 함 — 날짜 조작 없이는 불가 |

Day 7·14는 `user_journeys.started_at` 을 과거로 바꿔 앞당길 수 있습니다.
운영계에서는 하지 않고 개발계에서만 씁니다.

```sql
UPDATE public.user_journeys
   SET started_at = now() - interval '6 days'
 WHERE user_id = '<uid>' AND status = 'active';
```

## 4-A. 검증 중 발견해 고친 버그 (2026-09-01)

**비회원이 결과 화면에서 새로고침하면 결과가 사라지고 랜딩으로 튕겼습니다.**
README 의 "비회원은 현재 탭 sessionStorage 에 결과 ID 를 보관한다"와 어긋납니다.

원인은 스택 트레이스로 특정했습니다.

```
로드 44ms 후
  resetAnonymousState (src/App.tsx:182)
  ← onAuthStateChange 콜백 (src/App.tsx:443)
  ← @supabase/supabase-js
```

Supabase 는 비로그인 방문자에게도 구독 직후 `INITIAL_SESSION`(session=null)을 발생시킵니다.
콜백이 이벤트 종류를 보지 않고 `resetAnonymousState()` 를 호출해,
`bootstrap()` 이 복원한 결과를 44ms 만에 덮어썼습니다.

조치: 실제 로그아웃(`SIGNED_OUT`)일 때만 초기화하도록 변경.

확인한 세 가지 동작:

| 상황 | 기대 | 결과 |
|---|---|---|
| 결과 화면에서 새로고침 | 결과 유지 | **유지됨** (`FRRS`, sessionStorage·URL 보존) |
| 로그아웃 | 랜딩으로 초기화 | **초기화됨** (sessionStorage 비워짐) |
| sessionStorage 없이 공유 URL 진입 | 랜딩 | **랜딩** (README 정책 유지) |

## 5. 회귀 기준선

아래가 깨지면 배포하지 않습니다.

- 32문항 설문 / 4축·16코드 계산 / 결과 저장 / 결과 페이지
- 즉시 액션 1·2순위 카드와 상세 모달
- 코드 플랜 (`journeyProgress` 미전달 시 `0% → 탭 → 50% → ACTION DETAIL`)
- 로그인·회원가입 / 마이페이지
- Spring 서버 없이 진단·결과가 동작

## §4-B 회원 플로우 검증에서 찾은 버그 (2026-09-02)

### B-1. 로그인 상태에서 앱 전체가 멈춤 — supabase 인증 락 데드락 (심각)
- **증상**: 로그인 상태로 접속하면 `supabase.auth.getSession()` 이 영원히 끝나지 않고,
  세션을 기다리는 모든 PostgREST 쿼리가 함께 멈춘다. 문항은 번들 스냅샷으로 폴백되고
  진단 제출은 "분석 중" 에서 무한 대기. 비회원은 정상이라 지금까지 검증에서 안 잡혔다.
- **원인**: `App.tsx` 의 `onAuthStateChange` 콜백이 `async` 이고 내부에서
  `upsertProfileFromUser` / `attachQuestionnaireResultToUser` / `fetchLatestCompletedResultForUser`
  를 `await` 했다. supabase-js 는 이 콜백을 자체 인증 락(`navigator.locks`) 안에서 실행하므로,
  콜백 안의 supabase 호출이 같은 락에 재진입해 데드락이 난다.
- **확인**: `navigator.locks.query()` → `lock:sb-<ref>-auth-token` 이 exclusive 로 잡힌 채 해제되지 않음.
  `/auth/v1` 네트워크 요청 0건(네트워크 문제가 아님). 토큰은 만료 전이었음.
- **수정**: 콜백은 동기 state 갱신만 하고, DB 작업은 `setTimeout(..., 0)` 으로 락 밖에서 실행.
- **수정 후**: `getSession()` 0ms, `questions` 쿼리 181ms, 잡힌 락 0개.

### B-2. 저니 화면 전체 흰 화면 — `BRAND_PAGE_BG` import 누락
- **증상**: 14일 저니 진입 시 흰 화면. `ReferenceError: BRAND_PAGE_BG is not defined`
  (`journey/journeyShared.tsx:32`).
- **원인**: 브랜드 토큰 교체 때 이 파일만 import 가 빠졌다. 프로젝트에 TypeScript 가 설치돼
  있지 않아(=`tsconfig` 없음, `.tsx` 타입체크 불가) 빌드가 통과해 버렸다.
- **수정**: import 추가. 전 파일 대상 미import 토큰 스캔도 함께 수행(다른 누락 없음).
- **남은 리스크**: 같은 종류의 오류(정의되지 않은 식별자)를 빌드가 못 잡는다.
  TypeScript + `@types/react` 도입 및 `tsc --noEmit` 을 CI 에 추가하는 것을 권장.

### B-3. 검증이 남긴 실데이터
- `questionnaire_responses` 3건(383행), `user_journeys` 1건, `user_missions` 1건.
- 정리 SQL: `db/cleanup/CLEAN_TEST_ROWS.sql` (실행 시 380행 복구).
- 정리 전까지 `npm run verify:e2e` 는 "본인 결과 조회", "저니 생성" 2건이 실패한다.

## §5 공통 스트레칭 / 내 코드 미션 분리 + 주사위 적립 (2026-09-02)

### 5-1. 화면 문구 재정의
결과 이후 화면을 두 갈래로 분명히 나눴다.

| 구분 | 정체 | 화면 |
|---|---|---|
| 공통 스트레칭 | 누구나 4축(목→어깨→골반→하체)을 같은 순서로 전부 한다. 코드에 따라 달라지는 것은 **순서가 아니라 세트 수**뿐이다. | 코드 플랜의 `COMMON · STEP 1` + `COMMON 매일 하는 공통 스트레칭` |
| 내 코드 미션 | 코드(FRRS 등)와 관리 우선순위에 맞춰 **하루 한 가지씩** 배정된다. | 14일 관리(저니). 코드 플랜에는 `MY CODE MISSION · DAY n/14` 수행률만 표시 |

주의: 공통 스트레칭의 **순서 노출(먼저/다음 두 가지)은 여전히 개인 축 우선순위로 정렬**된다.
"모두가 같은 동작을 한다"는 뜻이지 "모두에게 같은 순서로 보인다"는 뜻은 아니므로,
문구를 `공통 1 / 공통 2`, `공통 스트레칭 · 먼저 할 두 가지`로 잡아 과장이 되지 않게 했다.

### 5-2. 주사위 적립 (`db/journey/033_daily_routine_reward.sql`)
- 완료 → 서버가 1~6 을 굴려 그 숫자만큼 적립. **눈과 금액은 전부 서버가 정한다**(클라이언트 값 불신).
- **하루 1회.** 하루의 경계는 **한국시간 오전 5시** (`mebody_service_day()`).
- 하루 1회 강제는 새 테이블 없이 기존 `user_rewards_once_per_event UNIQUE (user_id, entry_type, source_id)` 로 한다.
  `source_id = md5(user_id || ':routine:' || service_day)::uuid` 라서 같은 날 두 번째 INSERT 가 DB 레벨에서 막힌다.
- 구독 등급 배수(`reward_multiplier_for`)가 있으면 `적립액 = 주사위 눈 × 배수`. 눈과 금액을 따로 반환해 화면에서 구분해 보여준다.
- 고지(`reward_rules.disclosure`): "각 눈이 나올 확률은 1/6로 같습니다. 하루 1회이며, 하루의 기준은 한국시간 오전 5시입니다."
  표시 최대값 6원이 **실제 도달 가능**한지 검증에 포함했다(표시광고법 거짓·과장 방지).
- 미적용 환경에서는 함수 없음(42883/PGRST202)을 감지해 "적립 기능을 준비 중입니다"로 조용히 떨어진다. 완료 기록은 그대로 저장된다.
- 적립은 회원만. 비회원에게는 안내만 노출한다.

### 5-3. 검증 결과
- `npm run verify:routine-reward` — **27개 통과** (트랜잭션 안에서 033 적용 후 ROLLBACK, 데이터 미잔류)
  - 하루 경계 4건: 04:59 KST→전날 / 05:00 KST→당일 / 23:59→당일 / 다음날 04:00→여전히 전날
  - 주사위 분포 3000회: 1~6 전부 출현, 각 눈 15.9~17.6%
  - 하루 1회: 2회차 `already_claimed=true`, 잔액 불변, 같은 눈 반환, 원장 1행
  - 다음 날 재적립 가능 / 음수 적립 거부(23514) / 같은 날 중복 INSERT 거부(23505)
  - 비회원 적립·조회 차단(42501)
- 브라우저(실 Supabase, 로그인 상태): 문구 분리 반영 확인, 주사위 3×3 격자 1~6 눈 렌더 확인,
  RPC 미배포 폴백 확인.

### 5-4. 남은 것
- `033` 을 개발계에 적용해야 실제 적립이 동작한다(현재 미적용).
- 적용 후 브라우저에서 "완료 → 주사위 → n원 적립" 및 "같은 날 두 번째 완료" 재확인 필요.

### 5-5. 단계 타이머 (수동 체크 → 자동 완료)
공통 스트레칭의 각 단계를 `이 단계 완료` 수동 버튼에서 **미션 화면과 같은 카운트다운**으로 바꿨다.

- `시작하기` → 그 단계의 시간(예: 3:00)이 초 단위로 줄어들고, 진행 막대가 함께 찬다.
- **0 이 되면 자동으로 완료 체크**된다. 완료 처리는 감소 타이머가 아니라 별도 effect 에서 한다
  (`JourneyMissionScreen` 과 같은 방식 — setState 업데이터 안에서 부작용을 일으키지 않는다).
- `일시정지` / `이어서 하기` 지원. 완료를 해제하면 타이머가 처음 시간으로 되돌아간다.
- 타이머를 기다리기 어려운 경우를 위해 `타이머 없이 완료 처리` 를 아래에 작게 남겼다.
- 단계 시간은 `careRoutine` 이 계산한 실제 값을 쓴다(3:00 / 3:00 / 3:30 / 4:00 / 1:30 = 15분).

**브라우저 검증 (실 Supabase, 로그인 상태, FRRS)**
- 5단계 시간 표시: `03:00 / 03:00 / 03:30 / 04:00 / 01:30` — 합계 15분 일치
- 카운트다운: 03:00 → 02:59 → 02:57 (1초 간격)
- 자동 완료: 마지막 단계(1:30)를 끝까지 돌려 0 도달 → `완료함` 으로 자동 전환,
  완료 버튼 `(0/5)` → `(1/5)`, localStorage 에 `{"done":["finish-5"]}` 저장 확인
- 일시정지 후 `이어서 하기` 재개: 02:43 → 02:41
- 완료 해제 시 타이머 초기화: 01:30 으로 복귀

### 5-6. 가용 시간(5분/15분)이 실제로 동작하게 수정
`15분` 을 눌러도 아무 일이 없던 문제. 원인이 **두 개**였다.

1. `ensureDayMissions` 는 멱등이라 오늘 미션이 이미 있으면 `availableMinutes` 를 통째로 무시했다.
2. 더 근본적으로, `022_seed_journey_template.sql` 의 **모든 일반 Day 가 슬롯 1개**다.
   `selectDailyMissions` 는 슬롯을 순회하며 예산이 모자라면 `break` 할 뿐이라,
   가용 시간은 미션을 **줄이기만 할 뿐 늘릴 수가 없었다**. 15분은 새 Day 에서도 효과가 없었다.

**수정**
- `journeyRules.ts` — 슬롯을 다 채운 뒤 남는 예산만큼 다음 우선순위 축을 더 배정한다
  (`source_rule='extra_time'`, 남은 시간 `MIN_EXTRA_MISSION_SEC=150` 미만이면 중단).
  리포트·재측정 날(`kind !== 'normal'`)과 Restart 는 구성이 정해져 있어 늘리지 않는다.
- `api/journey.ts` — `replanDayMissions` 신규. 사용자가 직접 시간을 바꿨을 때만 오늘 미션을 다시 짠다.
  **이미 `started`/`completed` 인 미션이 하나라도 있으면 진행 기록이 사라지므로 다시 짜지 않고** 이유를 반환한다.
- `user_missions` 는 하드닝으로 **DELETE 권한이 회수**돼 있다(42501). 그래서 지우지 않고
  `(user_journey_id, day_no, slot_no)` UNIQUE 로 **upsert** 하고 남는 슬롯은 `skipped` 로 내린다.
  **새 SQL 이 필요 없다.** `skipped` 는 화면·진행률에서 제외한다.
- `JourneyTodayScreen` — 결과를 문구로 알린다. 기존 안내("다음 날 미션부터 반영됩니다")는
  실제 동작과 달랐으므로 교체했다.

**브라우저 검증 (실 Supabase, 로그인, FRRS, DAY 1)**
- 15분 → 미션 **4개** / 5분 → **1개** / 다시 15분 → **4개**, 안내 "15분에 맞춰 오늘 미션을 다시 배정했습니다."
- 완료된 미션이 있는 상태에서 15분 클릭 → 재배정 안 하고
  "이미 시작한 미션이 있어 오늘 미션은 그대로 둡니다." 노출
- `npm run verify:journey-rules` **112개 통과** (5분/15분 비교, extra_time 표기, 콘텐츠 중복 없음,
  총 시간 900초 이내, Day 7 은 늘지 않음 등 9건 신규)

## §6 무료/유료 분리 (2026-09-02)

### 6-1. 잠금은 RLS 에 있다
`startJourney` 는 클라이언트가 `user_journeys` 를 직접 INSERT 하고 RLS 는 소유자만 봤다.
화면에서 버튼을 숨겨도 API 로 우회되므로, 자격 판정을 **INSERT 정책 안**에 넣었다.

`db/journey/034_entitlement.sql`
- `has_active_subscription(uuid)` — `reward_multiplier_for` 와 **같은 조건**을 쓴다
  (어긋나면 "배수는 붙는데 저니는 못 만든다" 는 모순이 생긴다)
- `subscription_tier(uuid)` — free / basic / pro
- `can_start_journey(uuid)` — 저니 이력 0건이면 무료 허용, 이후 구독 필요.
  **SECURITY DEFINER 필수** (RLS 안에서 같은 테이블을 조회하면 재귀)
- `journey_entitlement()` — 화면용 묶음 조회
- 정책: `WITH CHECK (auth.uid() = user_id AND public.can_start_journey(auth.uid()))`

**권한에서 한 번 틀릴 뻔한 것**: RLS 정책식은 **호출자 권한**으로 평가된다.
`can_start_journey` 를 `authenticated` 에서 회수하면 정상 사용자의 첫 저니 INSERT 까지
permission denied 로 막힌다. 그래서 이 함수만 열어 두고, 함수 안에서
`auth.uid() IS DISTINCT FROM p_user` 를 확인해 남의 자격은 못 보게 했다.

### 6-2. 앱
- `src/api/entitlement.ts` 신규 — 034 미적용이면 **전부 무료·허용으로 폴백**(화면이 죽지 않게)
- `startJourney` 가 `42501` 을 만나면 `NEEDS_SUBSCRIPTION` 을 반환. 화면은 실패가 아니라 결제 안내를 띄운다
- 주 결제 지점은 `JourneyNextScreen`(첫 저니 완주 후). `App.openJourneyIntro` 에서도 선제 차단
- `src/components/AdSlot.tsx` 신규 — 유료면 **아무것도 렌더하지 않는다**. 결과 페이지 하단 1곳
- 적립 문구는 "미션 완료 보상" 으로만 쓴다. "광고 보상" 표기는 AdSense 인센티브 정책 위반

### 6-3. 검증
- `npm run verify:entitlement` — **25개 통과** (034 적용 후 ROLLBACK, 데이터 미잔류)
  - 무구독 첫 저니 INSERT 성공 / 두 번째 42501 거부 / 구독 후 다시 성공
  - 만료된 구독은 free 취급, INSERT 거부
  - `has_active_subscription` 과 `reward_multiplier_for` 판정 일치(활성 1.5배·해지 1.0배)
  - 타인 uid 로 `can_start_journey` 물으면 false, 내부 함수 직접 호출 차단(42501), 비회원 전부 차단
- 브라우저: 034 미적용 폴백에서 광고 슬롯 정상 노출, 콘솔 오류 없음

### 6-4. TypeScript 도입 — 같은 사고 재발 방지
`BRAND_PAGE_BG`, `AXIS_GREEN_THEME`, `FREE_OPEN_ENTITLEMENT` 가 **세 번** import 누락으로
런타임에서 터졌다. 빌드(esbuild)는 이걸 못 잡는다. `typescript` + `@types/react`
+ `tsconfig.json` 을 넣고 게이트를 만들었다.

- `npm run typecheck` — 전체 (`tsc --noEmit`)
- `npm run verify:types` — **정의되지 않은 이름(TS2304/TS2552)만 실패로 처리**, 나머지는 경고
  (전체 0 을 당장 요구하면 게이트로 쓸 수 없어서. 현재 정의되지 않은 이름 **0건**)

**남은 기존 타입 오류 4건** (이번 작업과 무관, 별도 정리 필요):
1. `CodeDetailsScreen.tsx:115` — 유니온 한쪽에 `calculated_code` 가 없다. 런타임 undefined 가능
2. `MissionFeedbackSheet.tsx:203,204` — 세터가 콜백 시그니처보다 좁다
3. `QuestionnaireScreen.tsx:274` — `AnswerValue` 가 `string[]` 일 수 있는데 `string` 으로 넘긴다

## §7 회원 플로우 실측 + 요금제 단일화 (2026-09-04)

### 7-1. 로그인 상태 실측 (실 Supabase, wh.choi@mebody.net)
| 항목 | 결과 |
|---|---|
| 주사위 적립 | 화면 `주사위 4 · 4원 적립!` = 원장 `dice:4, amount:4, multiplier:1.0` **일치** |
| 같은 날 재시도 | 원장 **1행 유지**, 같은 눈 재표시, 잔액 불변 |
| 첫 저니 무료 | `첫 14일 무료` 배지 → 무구독인데 저니 **정상 생성** → `journey_count:1, can_start:false` 전환 |
| 두 번째 저니 | **UI 우회 API 직접 INSERT 도 42501 차단** / 정상 경로는 결제 화면으로 이동 |

### 7-2. 발견한 버그 — 결제 버튼이 동작하지 않는다
`activateSubscription` 은 `user_subscriptions` 에 INSERT 하는데, `authenticated` 에게는
**SELECT 권한만** 있다. 그래서 `이 요금제로 진행` 은 항상 42501 로 실패하고,
현재 **아무도 유료 전환을 할 수 없다.**

보안상으로는 이 권한 구성이 맞다 — 클라이언트가 스스로에게 구독을 부여할 수 있으면 안 된다.
권한을 여는 것이 답이 아니라, 구독 활성화는 **결제사 웹훅 → 서버 측**에서 이뤄져야 한다.
`CheckoutScreen` 의 "테스트 모드 결제" 설계가 하드닝과 충돌한다. **미해결.**

이 때문에 "구독하면 저니가 다시 열린다" 는 라이브 앱에서 확인하지 못했다.
DB 레벨(`verify:entitlement`)에서는 통과했지만, 앱으로는 구독을 만들 수 없어 실측 불가.

### 7-3. 요금제 단일화 + 구매 5% 적립 (`035_single_plan_and_purchase_reward.sql`)
- `basic_monthly` 를 **`mebody 멤버십` ₩5,900** 단일 요금제로. 적립 배수 **1.5 → 2.0**
- `pro_monthly` 는 **비활성만** 한다(삭제 아님 — `user_subscriptions.plan_code` 가 참조)
- **구매 5% 적립** 신설: `claim_purchase_reward(order_id)`
  - 멤버십 회원의 `PAID` 주문에 대해 1회만
  - `orders.total_krw` 는 이미 적립금 차감 후 금액이므로 **현금 결제분에만** 적립된다
  - 무료 회원은 0%, 0원이면 원장에 남기지 않는다
- 앱: **`selectedPlanCode` 기본값이 `pro_monthly` 였다** — 그대로 뒀으면 결제가 깨졌다. `basic_monthly` 로 수정.
  `FALLBACK_PLANS` 단일화, 혜택 문구 교체, 추천 배지 기준 수정
- `npm run verify:plan-cashback` — **22개 통과** (롤백, 데이터 미잔류)

### 7-4. 광고 선행작업
- **AdMob 이 아니라 AdSense** — MEBODY 는 웹앱(Vite SPA)이라 AdMob SDK 가 동작하지 않는다
- `privacy.html` 에 **7. 쿠키 및 광고 식별자** 신설 (기존 7항 → 8항).
  Google 광고 설정·aboutads.info 옵트아웃 링크, 멤버십은 광고 쿠키 미사용 명시
- `src/components/CookieConsent.tsx` 신규 — **거부가 기본값**.
  동의 전에는 `data-ad-personalized="0"`(비개인화), 동의 시 `"1"`.
  유료 회원에게는 배너를 띄우지 않는다(광고가 없으므로)
- 브라우저 실측: 동의 전 `개인화 0` → `모두 동의` → `개인화 1`, 배너 사라짐, localStorage 저장 확인

## §8 AdMob 광고 + 보상형 보너스 (2026-09-04)

### 8-1. 웹앱을 네이티브 앱으로 감쌌다 (Capacitor)
AdMob SDK 는 Android/iOS 네이티브에서만 동작한다. PWA(`manifest.json` + `sw.js`)는
홈 화면에서 앱처럼 보이지만 실행 주체가 브라우저라 AdMob 이 로드되지 않는다.
그래서 Capacitor 로 감쌌다. **웹 코드는 그대로 두고 `dist` 를 앱이 로드한다.**

- `capacitor.config.ts` — appId `net.mebody.app`, webDir `dist`, AdMob 앱 ID 주입
- `android/` 생성 (`npx cap add android`)
- **`AndroidManifest.xml` 에 `com.google.android.gms.ads.APPLICATION_ID` 를 직접 추가했다.**
  이게 없으면 AdMob 초기화 시 앱이 즉시 종료된다. Capacitor 가 자동으로 넣어주지 않는다.

### 8-2. 광고 계층 (`src/lib/ads.ts`)
하나의 인터페이스로 네이티브/웹을 모두 다룬다.
- `isNativeApp()` 이 false 면 **광고를 아예 시도하지 않는다**. 웹에서는 자사 프로모션이 나간다.
- 광고 단위 ID 는 `.env` 로 주입. 없으면 **Google 공식 테스트 단위**로 떨어진다.
  실 단위로 개발 중 테스트하면 무효 트래픽 정책 위반이 되므로 이 폴백이 안전장치다.
- 배너는 `result_bottom` / `routine` 두 자리. 네이티브에서는 웹뷰 위에 겹쳐 그려지므로
  `AdSlot` 이 그만큼(64px) 여백만 남기고 콘텐츠를 밀어준다.

### 8-3. 보상형 보너스 (`036_routine_bonus_reward.sql`)
사용자 원안은 "완료 누르기 전에 광고" 였으나 두 가지 이유로 바꿨다.
1. **AdMob 보상형은 자발적 선택이어야 한다.** 강제하면 정책 위반.
2. 매일 광고를 봐야 1~6원이면 대부분 그냥 안 한다.

바꾼 구조: **기본은 광고 없이 지급, 광고는 보너스.**
```
완료 → 주사위 1~6원 (광고 없음)  →  [광고 보고 한 번 더] (선택)  →  +1~6원
```
- 하루 최대 12원. 유료 회원은 버튼이 안 보이고 **함수에서도 거부**한다(`42501`)
- 기본 적립을 먼저 받아야 보너스를 요청할 수 있다
- 보너스에는 등급 배수를 곱하지 않는다(무료 전용이므로 항상 1.0배)

**알고 쓰는 한계**: AdMob 서버 사이드 검증(SSV)은 콜백을 받을 서버가 필요한데 지금 없다.
v1 은 클라이언트가 "다 봤다"고 알리는 것을 믿는다. **하루 1회 · 최대 6원**이라 악용 상한이
하루 6원이다. 필요해지면 Supabase Edge Function 을 콜백으로 두고 검증 토큰 인자를 추가하면 된다.

### 8-4. 검증
- `npm run verify:routine-bonus` — **22개 통과** (롤백, 데이터 미잔류)
  - 기본 적립 전 보너스 요청 거부 / 기본→보너스 순서 / 잔액 = 기본+보너스 / 하루 최대 12원
  - 하루 1회(2회차 already_claimed, 원장 1행) / 다음 날 재수령 가능
  - **유료 회원은 함수에서 거부** / 비회원 전부 차단
  - 고지에 "선택", "보지 않아도 기본 적립은 받는다" 포함
- 브라우저(웹): `isNativeApp()=false` → 보너스 버튼 미노출, 테스트 단위 폴백, 루틴 배너 자리 정상

### 8-5. 남은 것
- AdMob 광고 단위 3개 생성 후 `.env` 에 주입 (`VITE_ADMOB_*`)
- Android SDK 설치 후 실기기/에뮬레이터에서 배너·보상형 실제 노출 확인 — **미검증**
- iOS 플랫폼 추가 (`npx cap add ios`, Xcode 필요)
- 앱 내 구독 판매 시 스토어 수수료 15~30% — 웹 결제와 분리 검토 필요

### 8-6. 에뮬레이터 실측 — AdMob 배너가 실제로 떴다 (2026-09-04)
Android SDK · Studio 가 이미 설치돼 있어 APK 를 굽고 에뮬레이터(Medium_Phone)에서 확인했다.

**빌드에서 막힌 것**: 시스템 JDK 가 26 이라 Gradle 이 `Unsupported class file major version 70` 으로
실패했다. Android Studio 내장 JDK 21 을 `JAVA_HOME` 으로 고정해 해결.
`npm run app:apk` 에 그 경로를 박아뒀다.

**확인된 것**
- 앱이 네이티브로 기동 (`net.mebody.app/.MainActivity`), 쿠키 배너 정상
- `Capacitor/AdMob|BannerExecutor` → `bannerAdLoaded` → `bannerAdImpression`
- 화면 하단에 `Test Ad · This is a 320x50 test ad.` **실제 노출**

**고친 버그 — 배너가 콘텐츠를 가렸다**
AdMob 배너는 웹뷰 "위에" 겹쳐 그려진다. `AdSlot` 이 흐름 안에 64px 자리를 비워도
배너는 화면 최하단에 고정되므로 소용이 없었다(루틴 텍스트를 덮었다).
→ `bannerAdSizeChanged` 로 실제 높이를 받아 `--mebody-ad-inset` CSS 변수에 넣고
`body { padding-bottom: var(--mebody-ad-inset) }` 로 전역 여백을 준다.
네이티브에서 `AdSlot` 은 아무것도 그리지 않는다. 재빌드 후 상품 카드가 안 가리는 것 확인.

**아직 확인 못 한 것**
- 보상형 광고 실제 재생 — 로그인 + 공통 스트레칭 완료 + 기본 적립까지 마쳐야 버튼이 뜬다
- iOS (`npx cap add ios` 미실행)
- 실 광고 단위(현재 Google 테스트 단위)

## §9 진입 플로우 정리 (2026-09-04)

### 9-1. 공통 스트레칭은 항상 접힌 채로 시작
확인해보니 `routineOpen` 은 원래 `useState(false)` 로 **이미 접혀 있었다.**
에뮬레이터에서 펼쳐져 보였던 것은 검증 중 좌표 탭이 헤더를 눌렀기 때문이다.

다만 **완료한 뒤에는 계속 펼쳐진 채로 남는** 문제가 있었다. 5단계가 길어서
아래의 14일 관리 진입 카드가 한참 밀린다. 주사위 적립이 끝나고 2.2초 뒤 자동으로 접는다.
단, 광고 보너스 버튼이 떠 있으면 그건 보여줘야 하므로 접지 않는다
(`bonusEligibleRef` — setTimeout 안에서 최신 값을 봐야 해서 ref 로 들고 있다).

### 9-2. 코드가 있으면 32문항을 건너뛴다
`startOrResumeDiagnosis` 신설. 랜딩의 기본 CTA 가 이걸 쓴다.
- `questionnaireId ?? latestResultId` 가 있으면 → **결과 화면으로 직행**
- 없으면 → 기존대로 동의 → 축 소개 → 32문항
- 버튼 문구도 바뀐다: `내 체형 코드 결과 보기` / `내 체형 코드 분석 시작하기`

로그인 회원은 bootstrap 이 `latestResultId` 를 채우므로 자동으로 건너뛴다.
비회원도 이 브라우저에서 이미 진단했으면 `questionnaireId` 로 건너뛴다.

**재측정 경로를 잃지 않도록** `ResultScreen` 에 `32문항 다시 측정하기` 를 추가했다
(`onRemeasure` → `startNewDiagnosis`). 기존 경로(마이페이지, JourneyIntro 의 "진단 다시 하기",
JourneyNext 의 재측정)는 그대로 `startNewDiagnosis` 를 쓴다 — 이건 항상 문항부터 간다.

### 9-3. 브라우저 실측
| 상태 | 버튼 문구 | 눌렀을 때 |
|---|---|---|
| 로그인 + 결과 있음 | `내 체형 코드 결과 보기` | 동의·문항 **건너뛰고** 결과(FRRS)로 직행 |
| 결과 화면 | `32문항 다시 측정하기` | 동의 화면으로 이동 |
| 로그아웃 + 기록 없음 | `내 체형 코드 분석 시작하기` | 동의 화면으로 이동 |

## §10 타입 오류 정리 + 랜딩 버튼 통일 (2026-09-04)

### 10-1. 남아 있던 타입 오류 4건을 전부 고쳤다
| 위치 | 원인 | 수정 |
|---|---|---|
| `api/questionnaire.ts` `fetchQuestionnaireResult` | `responseData` 가 `Record<string, unknown>` 이라 spread 결과에서 `calculated_code` 등 알려진 필드가 타입에서 사라졌다. `CodeDetailsScreen:115` 의 오류는 여기서 파생된 것 | 반환 타입을 `QuestionnaireResponse` 로 명시. `String(x ?? '')` 도 보강 |
| `MissionFeedbackSheet:203,204` | `OptionGroup<T>` 에 세터를 그대로 넘기니 `SetStateAction` 때문에 T 가 `string` 으로 넓어졌다 | `onChange={(v) => setFeeling(v)}` 로 감싸 옵션 타입에서만 추론 |
| `QuestionnaireScreen:274` | `AnswerMap` 은 레거시 다중선택 때문에 `string[]` 도 허용하는데 `QuestionCard` 는 `string` 만 받는다 | 배열이면 첫 값을 쓰도록 정규화 |

**앞서 "런타임 undefined 가능성"이라고 한 것은 과장이었다.** 호출부가 `String(x ?? '')`
로 감싸고 있어 실제로는 안전했다. 타입 정보가 없어 확인이 불가능했던 것이 문제였다.

수정 중 `lib/ads.ts` 에서 1건이 새로 잡혔다 — `addListener('bannerAdSizeChanged', ...)` 를
문자열로 호출했는데 enum(`BannerAdPluginEvents.SizeChanged`)을 써야 오버로드가 맞는다.
타입체크를 켰기에 잡힌 것이다.

**`npm run verify:types` 를 전체 게이트로 승격**했다. 이제 타입 오류가 하나라도 있으면 실패한다.
(도입 당시엔 기존 4건 때문에 "정의되지 않은 이름"만 게이트로 삼았다.)

### 10-2. 로그인 시 랜딩 버튼 하나로
로그인 상태에서 `내 체형 코드 분석 시작하기` 와 `지난 결과 · 오늘의 미션 보기` 가
사실상 같은 곳으로 가서 버튼이 두 개 보였다.

- `unifiedForMember = isLoggedIn && hasExistingCode` 이면 보조 버튼을 숨기고
  주 버튼을 **`내 코드 · 오늘의 관리 이어서 하기`** 하나로 합친다
- 결과 ID 가 아직 없고 코드만 저장된 회원은 문항이 아니라 **내 페이지**로 보낸다

**브라우저 실측**: 로그인 상태 → 버튼 1개(`내 코드 · 오늘의 관리 이어서 하기`),
`지난 결과` 버튼 없음, 눌렀을 때 `?result=...` 결과 화면(FRRS)으로 직행.

## §11 P1 — 디자인 시스템 이식 + 5탭 셸 + 홈 (2026-09-04)

### 11-1. 디자인 시스템
시안 CSS(503줄·클래스 112개)를 프리미티브로 옮겼다. `src/components/ui/`
`Card` `PageTitle` `SectionHeading` `CTA` `AxisTrack` `ProgressTrack` `Chip` `DirectionCard`

`src/theme/brand.ts` 에 색 외의 형태값도 정본화했다 — `SHELL`(430px·상단바 58·탭바 72),
`TYPE`(제목 34px/초록/ls -1px, eyebrow, 섹션번호), `GAUGE`, `SURFACE`, `BRAND_CARD_BORDER`.

**폰트를 시안과 맞췄다.** 14개 파일에 흩어져 있던 `"SUIT Variable"` 인라인을 전부 걷어내고
`index.css` 의 `--mebody-font: Arial, "Noto Sans KR", sans-serif` 한 곳에서 정한다.

**01·02 번호는 사용자 요청으로 없앴다.** 대신 그 섹션이 어디로 이어지는지 알려주는
소제목(`kicker`)을 쓴다 — `내 상태` `미션` `가이드` `마켓` `루틴`.

### 11-2. 셸 · 탭바 · 광고 배너
`AppShell` + `TopBar` + `TabBar`. 탭은 홈/미션/루틴/마켓/내 상태.

**배너는 화면 맨 아래, 탭바가 그 위**(사용자 지시). `showBanner({margin: 0})` 로 바닥에 붙이고
탭바는 `bottom: var(--mebody-ad-inset)` 로 배너 높이만큼 올라간다.

두 번 고쳤다.
1. 처음엔 배너를 탭바 위(`margin: 72`)에 뒀는데 에뮬레이터에서 배너가 **탭 아이콘을 덮었다**.
2. 탭바가 `position:absolute` 라 부모 높이가 콘텐츠를 따라 늘어나면 화면 밖으로 밀렸다
   (실측: 뷰포트 812인데 탭바 bottom 2874). 시안대로 `position:fixed` + `translateX(-50%)` 로 교체.

**실측**: 배너 없을 때 탭바 bottom 812(= 뷰포트 바닥), 배너 50px 주입 시 762(정확히 50px 상승).

### 11-3. 홈 탭
`ResultScreen`(1249줄)의 데이터 로직을 `home/resultData.tsx` 로 분리하고,
`home/HomeScreen.tsx` 를 시안 구성으로 새로 썼다 — hero → 움직임 경향 → 4축(`AxisTrack`)
→ 공통 스트레칭 진입 → 자세 사용 설명서 → 상품 2개 → 광고 → direction-card.

### 11-4. 이미지 로딩 6배 개선
**측정**: 캐릭터 이미지 요청이 **1684ms** 에야 시작됐다. 이미지 자체는 빠른데(0ms),
결과 조회 2회(`questionnaire_responses` + `body_code_content`)가 모두 끝나야 화면이
그려지기 때문이었다.

`resolveCharacterImageUrl` 은 **bodyCode 만 있으면 URL 을 만든다**(`getCharacterStorageUrl`).
그래서 코드를 아는 순간 `preloadCharacterImage()` 로 미리 받고, 로딩 중에도 hero 를 그린다.

**결과: 1684ms → 268ms.**

### 11-5. 내 페이지를 내 상태 탭으로 통일 + 미사용 화면 삭제
같은 내용을 두 화면이 다르게 보여주고 있었다. `status/StatusScreen.tsx` 로 합쳤다
(레벨 없음 → 적립금 + 14일 관리 진행률, `ProgressTrack` 은 시안의 `.status-exp-track`).

- `openMyPage()` → 셸의 `status` 탭
- 로그인 부트스트랩(코드만 있는 회원) → `status` 탭
- "임시 로그인" 미리보기 → **홈**(실제 로그인과 같은 화면)
- **삭제: `ResultScreen.tsx`(1249줄), `MyPageScreen.tsx`(992줄)** = 2,241줄. `Screen` 유니온에서 `myPage` 제거

### 11-6. 검증
- 타입 0건 / 112 · 12 · 17 · 27 · 22 · 25 · 22 · 41 **전부 통과**
- **E2E 를 자기완결적으로 고쳤다.** 계정에 기존 저니가 있으면 `can_start_journey` 가 false 라
  "저니 생성" 부터 막혔다. 트랜잭션 안에서 저니·구독을 비우고 시작하도록 바꿨다(ROLLBACK 되므로 무해)
- 브라우저: 5탭 이동, 내 페이지 → 내 상태 탭, 홈 폴백(`questionnaireId ?? latestResultId`),
  캐릭터 이미지 표시, 콘솔 오류 없음

## §12 P2·P3 — 미션 · 루틴 탭 + 죽은 화면 정리 (2026-09-04)

### 12-1. 037_redesign.sql
`db/journey/037_redesign.sql` — **검증 26건 통과**(트랜잭션 롤백, 데이터 미잔류).
- `routine_history(from,to)` — **새 테이블 없이** 적립 원장에서 수행 이력을 읽는다.
  기본 주사위 적립(`earn_routine`)이 이미 하루 1행이고 그 날짜가 곧 "그날 했다"는 사실이다.
  날짜는 `memo.service_day` 우선, 없으면 `created_at` 으로 되계산(`routine_service_day`).
- `routine_challenge_status` / `claim_weekly_challenge` / `claim_monthly_challenge`
  — 주간 7일 20원, 월간 20일 50원. 금액은 `reward_rules` 값이라 코드 수정 없이 조정된다.
- `reward_history(limit)` — 내 상태 탭의 적립 내역. `entry_type` 을 한글 라벨로 변환.
- `products.category`, `user_profiles.height_cm/weight_kg`

**작성 중 세 번 고쳤다**: `generate_series` 가 timestamptz 를 돌려줘 반환 타입이 안 맞았고
(수행한 날만 반환하도록 단순화), 테스트 쪽에서 `$1` 이 uuid/text 로 동시 추론돼 42P08,
`auth.users` 를 authenticated 롤로 조회해 42501 이 났다. 뒤 둘은 제품이 아니라 테스트 오류다.

### 12-2. 미션 · 루틴 탭
- `mission/MissionScreen.tsx` — 오늘의 미션(공통 스트레칭) + 주간 7일 도트 + 한 달 달력.
  공통 스트레칭 블록은 `codePlanShared` 를 재작성하지 않고 **`variant="routineOnly"`** 로 재사용
  (2200줄 파일에서 해당 `<section>` 을 변수로 빼고 분기만 추가)
- `routine/RoutineTab.tsx` — 무료 잠금 / 첫 14일 무료 / 진행 중 3분기.
  **실제 차단은 RLS(`can_start_journey`)가 한다.** 화면은 안내만 한다
- `StatusScreen` — 관리 기록(주·월) + **적립 내역** 추가

### 12-3. 이번에 잡은 버그 — 조용히 실패한 편집
미션 탭을 눌렀더니 탭바가 사라지고 옛 Code Plan 화면이 나왔다.
`App.tsx` 의 `onTabChange` 가 여전히 미션·루틴을 옛 화면으로 가로채고 있었다.
**그 블록을 지우려던 python 치환이 앵커 불일치로 no-op 이었는데 `assert` 가 없어 조용히 넘어갔고,
빌드도 타입체크도 통과했다.** 재발 방지로 이후 치환에는 전부 `assert` 를 걸고
편집 후 `grep` 으로 반영을 확인했다.

### 12-4. 죽은 화면 정리
탭 라우팅이 정리되자 `codePlan` · `guideCommon` · `guideDetails` 가 서로만 참조하는
고립 덩어리가 됐고, 랜딩의 코드플랜 모달도 도달 불가가 됐다
(회원은 버튼이 하나로 합쳐져 `showQuickResult` 가 항상 false).

**삭제: `CodePlanScreen` · `CommonGuideScreen` · `CodeDetailsScreen` · `CodePlanFullscreenModal`
= 1,022줄.** `Screen` 유니온에서 3개 제거, `?ui=` 허용 목록에서 `codePlan` 제거,
`landingCodePlanModalOpen` · `codePlanPreviewMode` 상태 제거.
`codePlanShared.tsx` 는 **남긴다** — 미션 탭이 쓴다.

P1 의 2,241줄과 합쳐 **총 3,263줄**이 정리됐다.

### 12-5. 검증
- 타입 0건 / 112 · 12 · 17 · 27 · 22 · 25 · 22 · **26** · 41 **전부 통과**
- 브라우저(037 미적용): 5탭이 모두 셸 안에서 열리고 탭바가 유지된다.
  미션 탭은 달력·챌린지가 0으로 비어 보이되 깨지지 않는다(의도한 폴백).
  루틴 탭은 체험 소진 상태라 잠금 카드가 뜬다

### 12-6. 남은 것
- **마켓 탭** — 사용자가 Claude Design 의 `Mebody Market.dc.html` 을 지정했으나
  세 경로(DesignSync `/design-login` 불가 · 인앱 브라우저 미로그인 · Chrome 확장 미연결)가
  모두 막혀 아직 못 읽었다. 받기 전까지 자리표시자 유지
- **037 적용** — 미적용이라 달력·챌린지·적립 내역이 비어 있다
- **앱 실화면** — 에뮬레이터가 메모리 부족으로 앱을 죽여 네이티브 확인은 못 했다

## §13 마켓 탭 + 037 적용 확인 (2026-09-04)

### 13-1. 037 적용 확인
사용자가 SQL Editor 에서 적용. 실 DB 에서 확인:
- 함수 8개 전부 존재(`routine_service_day` `routine_history` `routine_week_progress`
  `routine_month_progress` `routine_challenge_status` `claim_weekly_challenge`
  `claim_monthly_challenge` `reward_history`)
- 챌린지 규칙 주간 20원 / 월간 50원 활성
- `products.category` = `release:2 stretch:1`, `user_profiles.height_cm/weight_kg` 존재
- 브라우저에서 RPC 실호출 정상 — `reward_history` 가 "14일 완주 50원" 을 돌려줌

### 13-2. 마켓 탭 — 시안을 어떻게 읽었나
`Mebody Market.dc.html` 을 DesignSync 로 못 읽었다(`/design-login` 이 비대화형 세션에서 불가).
사용자가 `~/Downloads/Mebody Market.html` 로 내려줬는데, 이건 **번들 페이지**라
내용이 4.79MB 한 줄에 압축돼 있어 정적으로 읽히지 않았다.

→ `public/` 에 임시 복사해 **dev 서버로 띄우고 브라우저에서 렌더된 DOM 을 읽었다.**
구조·문구·computed style(프로모 배너 `radius 22 / shadow rgba(0,70,40,.2) 0 12px 30px`)을
그대로 뽑았고, 확인 후 임시 파일은 지웠다.

### 13-3. 구현 (`market/MarketScreen.tsx`)
시안 "1a 마켓 홈" 의 구성: 검색바 · 프로모션 배너 · 카테고리 아이콘 그리드 · 상품 그리드.
- 시안의 **하단탭·장바구니 FAB 는 넣지 않았다** — 우리 셸의 `TabBar` 가 이미 담당한다
- 시안의 카테고리는 8개지만 `products` 는 3행뿐이라 **값이 있는 것만** 노출한다.
  없는 카테고리를 있는 척하지 않는다
- 멤버십이면 상품마다 **구매 5% 적립 금액**을 계산해 보여준다
  (`purchase_cashback` 은 035 에서 구현·검증됐는데 화면에 안 보이고 있었다)
- 구매 버튼은 **비활성**이다. 결제 연동 전이라 누를 수 있으면 거짓말이 된다.
  하단에 그 이유를 적었다
- `products.category` 를 읽도록 `fetchStoreProducts` 의 select 와 `StoreProduct` 를 확장

### 13-4. 검증
- 타입 0건 / 112 · 12 · 17 · 27 · 22 · 25 · 22 · 26 · 41 **전부 통과**
- 브라우저: 마켓 탭 진입 → 상품 3개 + 실제 카테고리 라벨,
  `셀프 이완` 필터 3→2, 검색 "마사지" → 1개(마사지볼 듀오), 탭바 유지

## §14 홈 추천 검증 + 판매자 역할 · 마켓 상품 (2026-09-04)

### 14-1. 홈 추천은 마켓과 같은 테이블이다 — 검증됨
`HomeScreen` 의 "결과에 맞는 용품" 2개와 마켓 탭 상품은 **둘 다 `products` 테이블**에서 온다
(`fetchStoreProducts` → `buildStoreItems`). 브라우저에서 대조:
DB `MEBODY 폼롤러(release) / 밸런스 스트레칭 밴드(stretch) / 마사지볼 듀오(release)`
= 홈에 뜬 `MEBODY 폼롤러 / 밸런스 스트레칭 밴드`. **일치.**

→ **서버에서 상품을 올리면 앱 홈·마켓에 그대로 뜬다.** 읽기 경로는 이미 연결돼 있다.

### 14-2. 역할 관리 — 확인 결과 "정의만 있고 동작하지 않았다"
| 확인 항목 | 결과 |
|---|---|
| `UserRole` enum (Spring) | MEMBER / SELLER / ADMIN **정의됨** |
| `user_profiles.role` 실제 값 | ADMIN 2, MEMBER 2 — **SELLER 0명** |
| `products` RLS | **읽기 정책만 2개**(ACTIVE 공개). 쓰기 정책 0개 |
| `products` 권한 | anon·authenticated 모두 **SELECT 만** |
| Spring `ProductController` | **GET 만** (목록·상세). 등록·수정 API 없음 |
| Spring `SellerController` | `/dashboard` GET 뿐 |
| `AdminController` | 상품 관련 엔드포인트 **없음** |

즉 **판매자도 관리자도 상품을 올릴 수 없는 상태**였다. seller_id 도 3행 모두 NULL.

### 14-3. `038_seller_and_products.sql`
- **판매자 계정**: `user_profiles.id` 가 `auth.users(id)` FK 라 프로필만 새로 못 만든다.
  진단 0·적립 0 인 순수 샘플 계정 `sample.member@mebody.test` 를 SELLER 로 지정했다.
  진짜 판매자는 나중에 Auth 계정을 만들고 `UPDATE ... SET role='SELLER'` 한 줄이면 된다
- **역할 판정**: `current_user_role()` / `current_seller_id()` (SECURITY DEFINER)
- **상품 관리 정책**: 관리자는 전부, 판매자는 **자기 seller_id 것만**.
  판매자는 자기 상품을 상태와 무관하게 읽는다(DRAFT 확인용)
- `authenticated` 에 INSERT/UPDATE/DELETE 부여, anon 은 읽기만 유지
- **샘플 상품 12개 추가** — 시안의 카테고리 5종을 채운다(기존 3 + 12 = 15).
  가격은 시안 값 그대로. 이미지가 없어 화면은 "제품 이미지" 자리표시자를 보여준다
- 이름 중복 시 건너뛰므로 **여러 번 실행해도 안전**

### 14-4. 검증 — `npm run verify:seller` **21건 통과** (롤백)
- 판매자 지정 / 카테고리 5종 / 15개 / 미귀속 0개 / 두 번 돌려도 15개 그대로
- 역할 판정: 회원 MEMBER · 관리자 ADMIN · 판매자 SELLER
- 쓰기: 회원 등록 불가(42501)·수정 0행 / 관리자 등록·수정 가능 /
  판매자 자기 것 등록 가능, **남의 seller_id 로는 42501**
- 비회원 등록·삭제 차단, 읽기는 가능
- 앱이 쓰는 select 컬럼과 카테고리 전부 존재

### 14-5. 남은 것 — 서버에 상품 등록 API 가 없다
038 은 **DB 레벨**에서 판매자·관리자가 상품을 관리할 수 있게 연다.
하지만 Spring 쪽에 등록/수정 API 가 없고 `Product` 엔티티에 `category` 필드도 없다.
지금 상품을 올리려면 SQL 이나 Supabase 대시보드를 써야 한다.
관리자 화면에서 올리려면 별도 작업이 필요하다.
