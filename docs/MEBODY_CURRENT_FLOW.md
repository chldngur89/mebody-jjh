# MEBODY Current Flow

감사일: 2026-09-19  
기준: 현재 코드와 적용 DB. 문서에만 있고 실행 경로가 없는 단계는 구현으로 세지 않았다.

## 전체 흐름

`유입 → 랜딩 → 안전/개인정보 동의 → 안내 → 32문항 → 분석/저장 → 결과 → 오늘 행동·15분 루틴 → 14일 루틴 → 미션 → 피드백 → 주간/14일 리포트 → 재측정 → 다음 루틴`

보조 흐름은 `로그인/가입`, `내 상태`, `멤버십`, `마켓/장바구니`, `공유`다. 결제·광고·계정 삭제·운영 분석은 배포 가능한 종단 간 흐름이 아니다.

## 화면·데이터 지도

| 단계 | Screen/Component | 입력→출력 | API/DB | 다음 행동 | 상태 |
|---|---|---|---|---|---|
| 유입 | `LandingScreen` | ref/share code→시작 CTA | URL params | 동의/이어하기/기존 결과 | WORKING |
| 동의 | `ConsentScreen` | 안전·법적 체크 2개→진행 허용 | 저장 없음 | 소개 | UI ONLY |
| 소개 | `DiagnosisIntroScreen` | 4축 설명→시작 | 없음 | 문항 | WORKING |
| 설문 | `QuestionnaireScreen` | 32 답변→draft | `save_questionnaire_response`, local progress | 분석 | WORKING, 안전 중단 BROKEN |
| 분석 | `AnalyzingScreen`/App | 답변→code/identity/scoring meta | questionnaire response RPC | 결과 | WORKING, 서버 실패 fallback 있음 |
| 결과 | `HomeScreen` | result id/code→상세·전략·행동 | response/content/result tables | 미션/루틴/공유/재측정 | WORKING |
| 즉시 행동 | `MissionScreen` | 결과 축→15분 care steps | action mapping/content, reward RPC | 완료/적립 | WORKING 코드 기준 |
| 루틴 진입 | `RoutineTab`, `JourneyIntroScreen` | 결과·시간·entitlement→14일 plan | journey entitlement/template | 오늘 | WORKING 코드 기준 |
| 오늘 | `JourneyTodayScreen` | journey/day/feedback→missions | user journeys/missions | 수행/리포트 | WORKING 코드 기준 |
| 수행 | `JourneyMissionScreen` | timer/steps→완료·feedback | feedback/reward | 오늘 | WORKING 코드 기준 |
| 리포트 | `JourneyReportScreen` | 1~7/1~14 기록→summary | journey reports | 다음 | WORKING 코드 기준 |
| 다음 | `JourneyNextScreen` | 완료율·불편·난이도→재측정/다음 루틴 | journey rules | 재측정/구독 | WORKING 코드 기준 |
| 로그인/가입 | `AuthScreen` | email/phone/password→session | Spring signup 또는 Supabase fallback | 원래 화면 | PARTIAL; 배포 API 없음 |
| 내 상태 | `StatusScreen` | profile/orders/subscription/history | Supabase + Spring billing | 수정/해지/과거 결과 | PARTIAL; 탈퇴 없음 |
| 멤버십 | `MembershipScreen` | plan/entitlement→checkout | membership plans | checkout | PARTIAL |
| 결제 | `CheckoutScreen` | plan→임시 token verify | Spring billing | membership | BROKEN/비활성 |
| 마켓 | `MarketScreen`/cart/product | code/category→cart/order | products/orders | 결제 | PARTIAL; 결제 서버 없음 |
| 공유 | `ResultShareCard` | body code→link/card | URL `ref`,`code` | 신규 랜딩 | WORKING UI, 측정 없음 |

## 중요 시나리오

### A. 신규 비회원

코드상 32문항 draft를 익명 RPC로 저장하고 완료 시 로컬 계산을 즉시 만들며, 서버 저장이 15초 안에 끝나지 않으면 로컬 결과를 보여주고 다시 저장 버튼을 제공한다. 비회원 마지막 result id는 localStorage에 남는다. 적용 DB에는 익명 INSERT와 보호 RPC가 있고 익명 SELECT grant는 없다.

이번 감사에서는 운영 DB 변경 금지 때문에 새 응답을 만들지 않았다. 따라서 실제 완주는 `CODE_VERIFIED`, DB 쓰기 종단 간은 `UNVERIFIED`다.

### B. 비회원→가입

결과 claim 로직은 있다. 그러나 결과 저장 목적 auth는 휴대폰을 기본 입력 방식으로 잡고, 배포 앱에는 API base가 없어 휴대폰 가입이 명시적으로 실패한다. 이메일 fallback은 Supabase 확인 메일 경로를 탄다. 이 시나리오는 현재 배포에서 **BROKEN**으로 본다.

### C. 기존 회원

session recovery, 최근 결과, 내 상태, 루틴, 미션/피드백 코드가 존재한다. 서버 기반 주문/구독 기능은 공개 서버 부재로 사용할 수 없다. 계정이 필요한 실제 실행은 `UNVERIFIED`다.

### D. 재진단

새 id로 결과를 만들고 과거 측정 3회와 직전 비교를 표시한다. 완료 결과를 덮어쓰지 못하도록 적용 DB RPC가 보호한다. `CODE_VERIFIED`/`SCHEMA_VERIFIED`다.

### E. 공유 유입

공유 URL은 `ref=share`와 공개 body code만 담고 result id·응답·점수는 넣지 않는다. 신규 사용자는 랜딩→설문으로 간다. 분석 이벤트는 전송되지 않는다.

### F. 중간 이탈

- 설문: 문항 index/답변/draft id를 localStorage에서 복구한다.
- 미션 timer: 남은 시간과 시작 상태를 복구한다.
- 로그인: 진입 당시 return/success screen을 history에 포함한다.
- 결제: 실 결제가 없으므로 중단/복구를 검증할 수 없다.

## 뒤로가기 검증표

| 진입→화면 | 화면 버튼 기대/결과 | 브라우저 back | 상태 |
|---|---|---|---|
| 랜딩→동의 | 랜딩 복귀 | 실제 back/forward 재현 | PASS `REPRODUCED` |
| 동의→소개 | 동의 복귀 | history route 복원 | PASS `CODE_VERIFIED` |
| 소개→문항 1 | 소개 복귀 | question index route | PASS `CODE_VERIFIED` |
| 문항 N→N-1 | 이전 문항·답변 유지 | 각 문항별 history entry | PASS `CODE_VERIFIED` |
| 문항 완료→결과 | 32개 문항 history를 한 번에 접고 진입 부모로 복귀 | offset 로직 자동검증 | PASS `CODE_VERIFIED` |
| 어느 화면→로그인 | 원래 화면 복귀 | `authSuccess` 복원 | PASS 코드, 계정 실행 `UNVERIFIED` |
| 홈/내 상태→멤버십 | 진입 화면 복귀 | return screen 보존 | PASS `CODE_VERIFIED` |
| 멤버십→체크아웃 | 멤버십 복귀 | history back | PASS 코드, 결제 `UNVERIFIED` |
| 마켓→상품 | 마켓 탭 복귀 | product id route 포함 | PASS `CODE_VERIFIED` |
| 마켓/상품→장바구니 | 마켓 복귀 | fallback 고정 | PARTIAL: 상품에서 장바구니로 간 뒤 뒤로는 상품이 아니라 마켓으로 감 |
| 루틴 탭→루틴 소개/오늘 | 진입 화면 복귀 | return screen | PASS 코드, 계정 실행 `UNVERIFIED` |
| 오늘→미션 | 오늘 복귀 | active mission 없으면 today로 보정 | PASS `CODE_VERIFIED` |
| 오늘→리포트→다음 | 오늘 복귀 | fallback today | PASS `CODE_VERIFIED` |
| 탭 내부 | 탭 전환, 홈은 맨 위 | browser history에도 탭 entry | PASS `CODE_VERIFIED` |
| 로그아웃 후 과거 history | 랜딩 유지 | flow session 교체 | PASS 자동검증 |
| Android hardware back | WebView popstate 기대 | 실제 기기 미실행 | `UNVERIFIED` |

장바구니 복귀는 현재 `CartScreen.onBack`이 항상 `result/market`으로 고정되어 상품 상세에서 진입한 맥락을 잃는다. 데이터 유실은 아니나 사용자가 보던 상품으로 돌아가지 못하는 P2 UX 문제다.

## 문구 통일

앱의 사용자 노출 핵심 명칭은 `PRODUCT` 상수의 `mebody Code`, `자세·체형 셀프 체크`, `14일 루틴`으로 대체로 통일됐다. 서버 홈페이지도 대부분 같은 명칭을 쓴다. 남은 차이는 다음과 같다.

- DB/Java 내부 `body_bti`는 내부 식별자라 허용할 수 있다.
- 활성 상품명 `MEBODY 폼롤러`는 화면 브랜드 표기 `mebody`와 다르다.
- 활성 상품 `자세 교정 방석`은 서비스가 교정 처방을 하지 않는다는 문구와 충돌할 수 있다.
- 앱 약관은 AdSense 쿠키를 말하지만 네이티브 구현은 AdMob이다.
- 서버/앱 약관 파일은 같은 플레이스홀더 계열이나 본문과 회사 정보가 완전히 같지는 않다.

