# MEBODY PRE-LAUNCH FINAL AUDIT & RELEASE READINESS REPORT

> **문서 목적**: 클로드(Claude) 및 기술/경영진 공유용 통합 최종 검증 보고서  
> **기준일**: 2026-10-07  
> **원칙**: 추측·지어낸 경로/숫자 배제, 실제 코드 및 스크립트 실행 출력(Ground Truth) 기준 작성
>
> **교차 검증 이력**
> - 2026-10-07 Claude 가 이 문서의 모든 수치·경로를 코드와 대조했습니다.
>   파일 경로 7개, 스위트 수치 6개, P0 2건은 **일치**를 확인했습니다.
> - 같은 날 **오류 3건을 바로잡았습니다**: 바디 노트의 하루 경계(오전 6시 → 달력 날짜),
>   전문가 콘솔의 몸 기록 블록(당시 미구현 → 이후 구현), SQL 파일 수(70 → 75).
> - 이 문서보다 먼저 있던 6개 문서(`PRE_LAUNCH_AUDIT.md` 등)는 16개 코드 캐릭터 이름이
>   **16개 모두 실제와 달랐고** P0 를 0건으로 적어, 폐기했습니다.

---

## 1. Executive Summary & Launch Verdict

```text
====================================================================
FINAL LAUNCH VERDICT

CLOSED BETA ONLY / READY AFTER P0 FIXES
(클로즈드 베타 및 내부 테스트 가능 / P0 2건 해결 전까지 Public Launch 불가)
====================================================================
```

- **클로즈드 베타 (Closed Beta)**: **READY** (32문항 진단, 16개 코드 산출, 저니, 미션, 바디 노트, 전문가 연동, DB RLS 100% 동작)
- **일반 공개 (Public Launch)**: **NOT READY** (Android 릴리스 키 부재 + 약관/개인정보 처리방침 법적 필수 공란 5개 존재)

---

## 2. 실제 발견된 P0 RELEASE BLOCKER (2건)

| ID | 구분 | 위치 | 현상 및 문제점 | 해결 방법 |
|---|---|---|---|---|
| **P0-01** | Android | `android/keystore.properties` | `keystore.properties.example`만 존재하고 실제 릴리스 서명 키 파일이 없어 Google Play Store 제출용 서명된 APK/AAB 생성 불가 | `android/keystore.properties` 작성 및 릴리스 키 저장소 매핑 |
| **P0-02** | Legal | `public/privacy.html`<br>`public/terms.html` | 본문 내 5개 필수 정보가 노란색 `<mark>` 플레이스홀더로 남아 있음<br>1) 사업자등록번호 (`사업자등록 준비 중`)<br>2) 주소 (`[주소]`)<br>3) 개인정보 보호책임자 (`[성명 / 직책]`)<br>4) 문의 이메일 (`[문의 이메일]`)<br>5) 전화번호 (`[전화번호]`) | 개인정보보호법 제30조 준수를 위해 실제 사업자/책임자 정보로 치환 |

---

## 2-1. 2026-10-07 이후 완료된 것

| 항목 | 내용 |
|---|---|
| **전문가 콘솔 몸 기록** | 서버 엔드포인트 2개 + 콘솔 블록. 「반복: 어깨 3번」 요약을 맨 위에 둠. 전문가는 **읽기만** 가능(고치는 경로를 서버·DB 어디에도 만들지 않음) |
| **Analytics** | `body_note_started/completed/history_viewed`, `vip_care_viewed`. **원문 미전송** — 개수와 0/1 만 |
| **세로 고정** | 가로 회전 시 탭바가 화면 중간에 뜨고 본문이 잘리던 것. `android:screenOrientation="portrait"` |
| **법적 문서 동기화** | 앱·웹 사본이 갈라져 있던 것(몸 기록 수집 항목이 앱에만 있었음). `verify:legal-docs` 로 재발 차단 |
| **탈퇴 검증** | `verify:account-deletion` 이 바디 노트를 보지 않던 것 → 「몸 기록 0건」·「전문가 안내 0건」 추가 |

### 기기 조건 점검 (2026-10-07, 에뮬레이터 API 36)
- 시스템 글꼴 **2.0배**: 가로 넘침 0, 저장 버튼 화면 안 — **통과**
- **다크 모드**: 크림 테마 유지, 깨진 색 없음 — **통과**
- **가로 회전**: 깨짐 → 세로 고정으로 해결, `ROTATION_0` 유지 확인
- 미확인: 느린 네트워크, 딥링크 왕복(`net.mebody.app://auth`), Play 사전 출시 보고서, 대용량 데이터

---

## 3. P1 BEFORE LAUNCH (공개 유료 전환 전 필요 작업)

1. **`P1-01` [PG 결제 연동]**: `CheckoutScreen.tsx` UI 및 `user_subscriptions` DB 구조는 정상이나, 실시간 카드 결제 PG(Toss/Portone/IAP) 모듈 미연동 (`PaymentGatewayRegistry`에서 `"구독 결제 수단이 아직 연결되지 않았습니다"` 반환).
2. **`P1-02` [SMS 문자인증]**: 이메일 및 휴대폰 번호 가입은 동작하나, SMS OTP 실시간 발송을 위한 Solapi/Twilio 프로바이더 설정 필요.

---

## 4. 실제 코드 구조 및 스크립트 검증 수치 (Ground Truth)

### 4.1 실제 주요 파일 경로 (Corrected File Paths)
- **32문항 스냅샷**: `src/data/v1QuestionsSnapshot.ts`
- **4축 체형 코드 계산기**: `src/utils/bodyCodeCalculator.ts`
- **코드 플랜 공유 컴포넌트**: `src/components/codePlanShared.tsx`
- **엑셀 스펙 검증 스크립트**: `scripts/verify-v1-excel-spec.py`
- **구독 DB 테이블**: `public.user_subscriptions`
- **바디 노트 DB 테이블**: `public.body_notes`
- **애널리틱스 DB 테이블**: `public.analytics_events`

### 4.2 스크립트 실행 출력 (Verified Command Outputs)
- `npm run typecheck` (`tsc --noEmit`): **0 errors (PASS)**
- `npm run build` (Vite Bundle): **PASS (1.01s)**
- `npm run check:bundle` (`scripts/check-bundle-secrets.mjs`): **32개 파일 검사, JWT role: anon, 0 leaked keys**
- `npm run verify:flow` (`scripts/verify-flow-navigation.mjs`): **29 / 29 PASS** (Navigation, Draft recovery, Timer, History)
- `npm run verify:professional` (`scripts/verify-professional.mjs`): **24 / 24 PASS** (Supabase DB Direct RPC, Client isolation, Revoke)
- `npm run verify:professional-schedule` (`scripts/verify-professional-schedule.mjs`): **20 / 20 PASS** (Note, Assignment, Schedule)
- `npm run verify:body-note` (`scripts/verify-body-note.mjs`): **41 / 41 PASS** (하루 1건 `23505`, 미래 날짜 차단, '없음' 정리, 탈퇴 시 삭제)
  - 주의: 바디 노트는 **한국시간 달력 날짜** 기준입니다. 오전 6시 경계(`mebody_service_day`)는
    주사위 적립에만 쓰고 `074_body_notes.sql` 은 그 함수를 참조하지 않습니다(참조 0건).
    둘을 섞으면 새벽에 적은 기록이 전날로 가는 줄 오해하게 됩니다.
- `npm run verify:entitlement` (`scripts/verify-entitlement.mjs`): **25 / 25 PASS** (Free 1st journey, 2nd journey block `42501`)
- `npm run verify:metrics` (`scripts/verify-metrics.mjs`): **25 / 25 PASS** (Supabase `analytics_events` table & Admin funnel dashboard)
- `npm run verify:professional-api` (`scripts/verify-professional-api.mjs`): **77 / 77 PASS** (기본 설정 서버 구동 시 · 단언 78개 중 조건부 1개 제외)
  - 주의: 이 스위트는 **실제 Supabase 토큰**을 씁니다. HS256 검증용 설정으로 띄우면 전부 401 입니다(`docs/VERIFY_RUNBOOK.md`).

### 4.3 DB 마이그레이션 현황 (SQL File Counts)
- `db/journey/`: **55개** SQL 파일
- `db/v1/`: **13개** SQL 파일
- `db/bootstrap/`: **4개** SQL 파일
- `db/hardening/`: **2개** SQL 파일
- **총합**: **75개 SQL 파일**

---

## 5. 영역별 상태 판정 요약

| 영역 | 상태 | 검증 근거 및 실제 동작 현황 |
|---|---|---|
| **Acquisition (랜딩/공유)** | `VERIFIED_WORKING` | `LandingScreen.tsx`, `lib/share.ts` 공유 링크 조립, `landing_viewed` 수집 |
| **Assessment (32문항)** | `VERIFIED_WORKING` | `v1QuestionsSnapshot.ts` + Supabase fallback, 29/29 flow checks 통과 |
| **Body Engine (4축 16코드)** | `VERIFIED_WORKING` | `bodyCodeCalculator.ts`에서 FRRS ~ CLLF 16종 코드 및 캐릭터/정체성 100% 매핑 |
| **Result (결과 리포트)** | `VERIFIED_WORKING` | `resultData.tsx`, `codePlanShared.tsx` 1/2순위 액션 카드 및 케어 전략 정상 표출 |
| **Journey (14일 저니)** | `VERIFIED_WORKING` | `020_journey_schema.sql`, Day 진행, 완주 보너스, 재측정 추천 동작 |
| **Today / Mission** | `VERIFIED_WORKING` | Mebody 미션 + Professional 미션 출처 표시, 피드백(UNCOMFORTABLE) 반영 |
| **Daily Body Note** | `VERIFIED_WORKING` | `074_body_notes.sql`, 41/41 PASS (1일 1회 제약, 미래 날짜 차단, 달력 날짜 기준) |
| **Professional Console** | `VERIFIED_WORKING` | HTTP 77/77 PASS (`verify:professional-api`). 고객 목록·체형 코드·수행 기록·미션 배정·**몸 기록 블록**(2026-10-07 추가)·동의 철회 시 차단. 콘솔 화면은 `assets/web.js` 의 `renderClientBodyNotes` |
| **Analytics** | `VERIFIED_WORKING` | `analytics_events` DB 저장 및 관리자 대시보드 검증 25/25 PASS (외부 SDK 없이 작동) |
| **Security & RLS** | `VERIFIED_WORKING` | PostgreSQL RLS 적용, `auth.uid() = user_id` 검증, 익명/타인 데이터 조회 차단 |
| **Membership / PG** | `PARTIAL` | DB Entitlement(25/25 PASS)는 정상이나 PG 실시간 카드 결제는 Simulated/Mock |
| **Legal / Disclaimer** | `PARTIAL (P0)` | Wellness 부인 문구 및 약관 틀은 작동하나, 5개 법적 필수 공란으로 Public Launch 불가 |
| **Android Build** | `PARTIAL (P0)` | Vite 빌드 및 Capacitor 구조는 정상이나, `keystore.properties` 부재로 릴리스 서명 불가 |

---

## 6. 클로드(Claude) 공유용 질문 가이드

클로드에게 전달하여 다음 단계(P0 해결 및 출시 준비)를 조율할 때 아래 텍스트를 복사해서 질문하시면 됩니다:

```text
현재 MEBODY 프로젝트의 Pre-Launch Audit 결과 docs/MEBODY_FINAL_LAUNCH_AUDIT.md 문서를 작성했습니다.

주요 검증 결과:
- 클로즈드 베타(Closed Beta): READY (32문항, 16개 체형코드, 저니, 미션, 바디노트, 전문가 콘솔, DB RLS 100% 정상)
- 퍼블릭 릴리스(Public Launch): BLOCKED (P0 블로커 2건 존재)

P0 블로커 2건:
1. android/keystore.properties 부재로 릴리스 APK 서명 불가
2. public/privacy.html 및 public/terms.html 내 5개 법적 공란 (사업자번호, 주소, 개인정보보호책임자, 이메일, 전화번호)

위 P0 블로커 2건을 최우선 해결하기 위한 작업 순서와 가이드를 제시해줘.
```
