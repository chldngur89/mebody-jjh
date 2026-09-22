# MEBODY Next Roadmap

감사일: 2026-09-19  
순서는 출시 안전→베타 측정→데이터 이후 개발→외부 기준 실험→현재 만들지 않을 항목으로 고정한다.

## 1. 국내 Android 베타 출시 차단 항목

### P0-1. 법적 문서와 동의 증적

- WHY: 배포 문서가 플레이스홀더이고 현재 동의를 증명할 수 없다.
- WHAT: 실제 privacy/terms, versioned consent ledger, 진단 안전 동의와 가입 약관 동의를 구분해 저장.
- FILES: `public/privacy.html`, `public/terms.html`, `ConsentScreen.tsx`, `AuthScreen.tsx`, 서버 static legal, 신규 consent API.
- DB: append-only `user_consents` 또는 동등 구조; type/version/agreed_at/channel/user 또는 anonymous correlation.
- RISK: 법률 검토 없이 개발 문구를 확정본으로 오인.
- TEST: 문서 version과 저장 row 일치, 거부 시 보호 데이터 미저장, 재동의.
- METRIC: version/time/channel 누락 0건.

### P0-2. 안전 중단 응답

- WHY: 통증·어지럼 사용자가 임의 답변을 강요받는다.
- WHAT: 지정 동작 문항에 중단 선택, 점수 제외, 결과에 안전 안내.
- FILES: `QuestionCard.tsx`, `QuestionnaireScreen.tsx`, `bodyCodeCalculator.ts`, 질문 schema/API.
- DB: stopped codes 또는 답변 상태를 저장하는 명시 필드/표현.
- RISK: 기존 32문항 계산/완료 조건 회귀.
- TEST: 모든 안전 문항 stop, 계산 제외, 저장/복구/재측정.
- METRIC: stop flow 완료율, stop 후 강제 답변 0.

### P0-3. 계정 lifecycle

- WHY: 소유 확인·휴대폰 복구·삭제가 불완전하다.
- WHAT: email verify 활성화, SMS 전까지 phone 가입 숨김, public approve 제거, reset, 재인증 계정 삭제와 외부 삭제 페이지.
- FILES: `AuthScreen.tsx`, `signup.ts`, Spring auth/account controller/service, `StatusSections.tsx`.
- DB: 현재 `prepare_account_deletion()`을 서버 transaction 흐름에 연결; 거래 보존 검증.
- RISK: 기존 미확인/alias 계정 migration과 접근 상실.
- TEST: 가입→확인→로그인→reset→삭제, 기존 계정 호환.
- METRIC: 확인 완료율, recovery 성공률, 삭제 실패율.

### P0-4. 운영 서버와 release 환경

- WHY: 공개 서버가 404이고 local release base가 localhost다.
- WHAT: 서버 재배포, Android release env/CI, health/auth/error endpoints, CORS.
- FILES: deployment config, `.env.example`, Capacitor/Gradle variant, 운영 runbook.
- DB: migration history를 실제 적용 상태와 일치시키고 신규 환경 재현.
- RISK: secret 유출, 잘못된 backend로 release.
- TEST: 산출 APK에서 실제 hostname 확인, health/auth read-only smoke, rollback rehearsal.
- METRIC: 배포 성공률, API availability, config mismatch 0.

### P0-5. 결제·광고 숨김

- WHY: 구매 token과 광고가 release 준비가 되지 않았다.
- WHAT: 제한 베타에서 membership checkout, product pay, ads/reward를 feature flag로 숨김.
- FILES: `MembershipScreen.tsx`, `CheckoutScreen.tsx`, market/cart, `ads.ts`, entitlement/config.
- DB: 없음.
- RISK: 숨긴 UI의 진입 링크가 남음.
- TEST: 전체 route/search에서 결제·테스트 광고 노출 0.
- METRIC: 미완성 결제 클릭/테스트 광고 노출 0.

### P0-6. Android 실기기 release gate

- WHY: 시스템 back과 lifecycle이 웹 테스트만으로 보장되지 않는다.
- WHAT: Android 2개 버전 이상에서 back/forward, keyboard, process kill, offline, rotation, deep/share link matrix.
- FILES: QA 문서와 CI artifact metadata. 필요 시 navigation/manifest.
- DB: 테스트 계정은 격리 환경만 사용.
- RISK: WebView/browser history 차이.
- TEST: `MEBODY_RELEASE_READINESS.md` 시나리오 전부.
- METRIC: P0 재현 0, crash-free sessions 목표 정의.

## 2. 베타 측정을 위해 필요한 기능

### P1-1. Consent-aware analytics

- WHY: 현재 베타 결과를 판단할 데이터가 없다.
- WHAT: 핵심 퍼널/오류/return 이벤트, 중복 방지, session/acquisition/experiment 연결, dashboard.
- FILES: `analytics.ts`, route/complete call sites, privacy/cookie UI.
- DB: event warehouse 또는 vendor schema; 원문 답변 금지.
- RISK: PII와 건강 관련 응답 유출.
- TEST: event contract, duplicate/retry, consent, PII scanner.
- METRIC: 누락 <2%, 중복 <1%, PII 0.

### P1-2. 오류와 빈 상태 분리

- WHY: API 장애가 “데이터 없음/무료”처럼 보일 수 있다.
- WHAT: auth/Journey/result/billing fetch에 error code, retry, status banner.
- FILES: 각 API wrapper와 Status/Journey/Market 화면, `reportError.ts`.
- DB: error log code 확장 또는 backend observability.
- RISK: 과도한 경고로 사용자 불안.
- TEST: offline/401/403/timeout/5xx.
- METRIC: recoverable error retry success, silent empty 0.

### P1-3. 첫 가치 funnel 정리

- WHY: 32문항 후 결과에서 여러 행동이 경쟁한다.
- WHAT: first action을 정의하고 결과 상단 CTA 하나를 계측 가능하게 배치.
- FILES: `HomeScreen.tsx`, result components.
- DB: 없음.
- RISK: 상세 결과 발견성 감소.
- TEST: accessibility/back/scroll, analytics event.
- METRIC: result→first action completion.

## 3. 베타 데이터 이후 개발할 항목

### P2-1. reminder와 streak

- WHY: D1/D7 이탈 지점이 확인될 때만 필요하다.
- WHAT: 사용자 선택 시간 알림과 부담 없는 연속 기록.
- FILES/DB: notification preference, schedule, streak aggregate.
- RISK: 권한 피로·죄책감 유도.
- TEST: timezone, opt-out, missed day.
- METRIC: D7 uplift와 notification disable rate.

### P2-2. 진행 calendar/graph

- WHY: 장기 사용자에게 변화 가시성을 제공.
- WHAT: 14일 completion과 feedback 추세 최소 graph.
- FILES/DB: Journey report/status, 기존 기록 집계 우선.
- RISK: 설문 변화가 치료 효과처럼 읽힘.
- TEST: 중립 문구, 누락일, 재측정 비교.
- METRIC: report view→next mission, D14.

### P2-3. 장바구니 복귀 맥락

- WHY: 상품→장바구니→back이 상품 대신 market으로 간다.
- WHAT: cart entry source/product id를 route에 보존.
- FILES: `flowNavigation.ts`, `App.tsx`, cart/product.
- DB: 없음.
- RISK: history branch 복잡도.
- TEST: market/product/cart 모든 진입 조합과 Android back.
- METRIC: cart abandonment와 product return.

## 4. 외부 벤치마크 기반 실험

- **결과 직후 3분 행동** — WHY: 첫 행동이 분산된다. WHAT: 현재 구조와 단일 CTA A/B. FILES: Home/result. DB: assignment/event만. RISK: 상세 발견성. TEST: route/accessibility/event. METRIC: first action completion.
- **feedback 변화 설명** — WHY: 개인화가 사용자에게 보이지 않는다. WHAT: “내일 강도/시간/동작 변화” 표시. FILES: mission feedback/today. DB: 기존 feedback 사용. RISK: 과도한 확정 표현. TEST: HARD/EASY/UNCOMFORTABLE. METRIC: feedback submit과 다음날 return.
- **reminder/streak opt-in** — WHY: 반복 동기 후보. WHAT: opt-in 시간 알림과 부담 없는 streak. FILES: native notification/settings. DB: preference. RISK: 권한 피로. TEST: timezone/opt-out. METRIC: D7과 disable rate.
- **무료 범위와 paywall 시점** — WHY: 현재 무료 Journey 범위의 전환 근거가 없다. WHAT: Play Billing 완성 후 무료 전체와 3일 preview 비교. FILES: entitlement/paywall/checkout. DB: experiment assignment. RISK: 신뢰·환불. TEST: purchase/restore/cancel. METRIC: conversion과 Day 3.
- **공유 landing CTA** — WHY: 공유→시작 연결을 측정할 수 없다. WHAT: 예상 시간/무료 CTA variant. FILES: landing/share. DB: event only. RISK: clickbait. TEST: ref 유지와 privacy. METRIC: shared open→start→complete.

각 가설·표본·판정 규칙은 [MEBODY_EXPERIMENT_BACKLOG.md](./MEBODY_EXPERIMENT_BACKLOG.md)에 정의했다.

## 5. 현재 만들지 않을 항목

### P3

- **AI coach/chat** — WHY: 규칙 추천 실패 데이터가 없다. WHAT: 보류. FILES/DB: 없음. RISK: 의료 조언·비용. TEST/METRIC: 베타 feedback에서 설명 불충분 비율을 먼저 측정.
- **커뮤니티/피드** — WHY: 핵심 retention 검증 전 운영 비용이 크다. WHAT: 보류. FILES/DB: 없음. RISK: moderation/privacy. TEST/METRIC: 공유·루틴 retention 수요를 먼저 측정.
- **Health Connect** — WHY: 현재 핵심 가치에 필수 아님. WHAT: 보류. FILES/DB: 없음. RISK: 권한·민감 건강 데이터. TEST/METRIC: 기록 자동화 요청률을 먼저 측정.
- **custom routine marketplace** — WHY: 기본 Journey 완주율이 없다. WHAT: 보류. FILES/DB: 없음. RISK: 선택 피로·콘텐츠 QA. TEST/METRIC: 기본 루틴 completion을 먼저 측정.
- **의료 진단/교정 판정** — WHY: 제품 범위와 안전 기준에 맞지 않는다. WHAT: 만들지 않음. FILES/DB: 해당 없음. RISK: 의료 오인. TEST: 금칙어/claim review. METRIC: 위험 claim 0.
- **iOS 동시 출시** — WHY: Android 안정화 전 범위가 커진다. WHAT: 보류. FILES/DB: 없음. RISK: QA 분산. TEST/METRIC: Android release gate와 D7 확보 후 재판정.
