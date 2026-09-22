# MEBODY Product Audit

감사일: 2026-09-19  
출시 판정: **NO-GO** — 상세 기준은 [MEBODY_RELEASE_READINESS.md](./MEBODY_RELEASE_READINESS.md)

## 감사 범위와 증거

- 앱: `main` `6d71190` 및 현재 미커밋 변경
- 서버: `main` `7bb8240` 및 현재 미커밋 변경
- 적용 DB: JDBC `BEGIN READ ONLY`로 catalog, RLS, 함수, 권한, aggregate만 조회
- 배포: `https://mebody-jjh.vercel.app` 및 저장소에 기록된 Railway URL 읽기 전용 확인
- 실제 실행: 로컬 웹 랜딩↔동의 back/forward, build/type/tests
- 금지 준수: migration, 계정/응답/주문/결제/구독 생성, 운영 데이터 변경을 하지 않음

증거 등급은 `REPRODUCED`, `CODE_VERIFIED`, `SCHEMA_VERIFIED`, `PRODUCTION_OBSERVED`, `UNVERIFIED`를 사용한다.

## 핵심 판단

제품의 강점은 결과 계산 이후까지 연결된 규칙 기반 개인화다. 32문항은 4축·identity·우선순위로 이어지고, 우선순위·가용 시간·최근 feedback·불편 콘텐츠·미접속 기간이 다음 미션을 바꾼다. 규칙 검증 112건이 통과했으므로 단순 문구 교체형 개인화로 보지 않는다.

출시를 막는 문제는 기능의 양이 아니라 신뢰 경계다. 법적 문서와 동의 증적, 계정 소유 확인/삭제, 안전 중단, 운영 서버와 release 환경, 실제 분석 수집이 완성되지 않았다. 이 상태에서 사용자를 받으면 결과를 보여주는 데 성공해도 동의와 계정을 책임 있게 운영하거나 개선 효과를 측정할 수 없다.

## 발견 사항

| ID | 심각도 | 화면/기능 | 기대 동작 | 실제 동작 | 사용자 영향 | 증거 | 출시 차단 |
|---|---|---|---|---|---|---|---|
| PA-01 | P0 | 개인정보/약관 | 실제 처리 내용을 고지 | 배포 문서가 “플레이스홀더”, 예시/교체 지시 포함 | 유효한 정보 없이 필수 동의 | PRODUCTION_OBSERVED | 예 |
| PA-02 | P0 | 동의 | 종류·버전·시각·채널 보존 | 체크 state만 있고 DB 필드/테이블 없음 | 동의 증명·개정 재동의 불가 | SCHEMA_VERIFIED | 예 |
| PA-03 | P0 | 설문 안전 | 통증/어지럼 시 중단 응답과 점수 제외 | UI는 세 답만 강제. 계산기 타입만 stopped list 지원 | 위험 동작을 계속하거나 부정확한 답 강요 | CODE_VERIFIED | 예 |
| PA-04 | P0 | 회원 탈퇴 | 앱에서 재인증 후 삭제 | DB 준비 함수만 있음 | 삭제권 행사 경로 없음 | SCHEMA_VERIFIED | 예 |
| PA-05 | P0 | 가입/서버 | 배포 앱→운영 API | 앱 bundle API base 없음, 기록된 Railway 404 | phone 가입·billing·SSV 불가 | PRODUCTION_OBSERVED | 예 |
| PA-06 | P0 | Analytics | 핵심 퍼널/오류를 운영 조회 | 공유용 `track()`도 console only | 베타 성과·장애 판단 불가 | CODE_VERIFIED | 예 |
| PA-07 | P1 | 계정 신뢰 | 이메일/전화 소유 확인 | 서버 기본 verify off, alias phone, phone recovery 미지원 | 타인 주소 사칭·복구 실패 | CODE_VERIFIED | 예 |
| PA-08 | P1 | 비밀번호 | 화면 안내와 실제 Auth 정책 일치 | UI/server는 최소 1, Supabase 실제 하한은 설정 의존·화면 미표시 | 가입 시 뒤늦은 오류 | CODE_VERIFIED, 실제 하한 UNVERIFIED | 조건부 |
| PA-09 | P1 | 결제 | Play Billing purchase token 검증 | 앱이 날짜 기반 임시 token 생성 | 실 결제 성공 불가 또는 dev mode 오인 위험 | CODE_VERIFIED | 결제 노출 시 예 |
| PA-10 | P1 | 광고 | 동의·실 unit·SSV | unit 3개 비어 테스트 광고, 서버 없으면 SSV false | 수익/보상 검증 불가 | CODE_VERIFIED | 광고 노출 시 예 |
| PA-11 | P1 | 배포 재현 | git migration history와 DB 일치 | DB 함수/046 변경은 적용됐지만 ledger에 수동분 없음 | 새 환경 재구축·롤백 불확실 | SCHEMA_VERIFIED | 조건부 |
| PA-12 | P1 | 오류 표현 | API 실패와 빈 데이터 구분 | 여러 fetch가 빈 상태/fallback으로 흡수 | 사용자가 “없음”과 장애를 구별 못함 | CODE_VERIFIED | 아니오 |
| PA-13 | P2 | 상품→장바구니 back | 상품으로 복귀 | market 탭으로 고정 복귀 | 탐색 맥락 손실 | CODE_VERIFIED | 아니오 |
| PA-14 | P2 | 활성 상품 문구 | 웰니스 범위와 일치 | “자세 교정 방석”, 브랜드 `MEBODY` 혼용 | 의료/브랜드 메시지 혼선 | SCHEMA_VERIFIED | 문구 검토 전 조건부 |
| PA-15 | P2 | Android backup | 민감 session 저장 정책 명시 | manifest `allowBackup=true`, 별도 backup rule 없음 | 기기 이전/백업 범위 불명확 | CODE_VERIFIED | 아니오 |

## 재현 순서가 중요한 P0

### PA-01 법적 문서

1. 배포 앱에서 진단 시작.
2. 동의 화면의 개인정보처리방침/이용약관을 연다.
3. 두 문서 첫 문단에서 플레이스홀더와 교체 지시를 확인한다.

필수 동의를 요구하는 링크 자체가 미완성 문서이므로 베타 공개 전에 반드시 교체해야 한다.

### PA-03 안전 중단

1. A10 “의자 10회” 등 동작 문항으로 이동한다.
2. 안내는 통증·어지럼 시 즉시 중단하라고 한다.
3. `QuestionCard`는 ①/②/③만 만들며 “중단/수행 불가”가 없다.
4. 다음으로 가려면 세 답 중 하나를 골라야 한다.

계산기에는 `stopped_question_codes` 개념이 있으나 입력 UI와 저장 경로에서 생성되지 않는다.

### PA-05 배포 서버 단절

1. 배포 JS bundle에서 `/api/billing/config`는 찾을 수 있지만 Railway hostname은 없다.
2. 저장소에 기록된 Railway health/auth/billing/ads URL을 조회한다.
3. 모두 HTTP 404 `Application not found`다.
4. `VITE_API_BASE_URL`이 없으면 phone signup은 즉시 오류, billing은 “서버 미연결”로 잠긴다.

## 개인화 감사

| 질문 | 판정 | 근거 |
|---|---|---|
| 16개 code가 다른 결과를 제공 | WORKING | code content/section/character 데이터와 lookup |
| 축 점수가 추천에 사용 | WORKING | `buildAxisPriority`→mission selection |
| primary/secondary가 사용 | WORKING | priority rank와 day slot 선택 |
| feedback이 다음 mission 변경 | WORKING | HARD/EASY duration·difficulty, UNCOMFORTABLE 제외/대체 |
| completion history가 추천 변경 | WORKING | report/completion rate→next journey |
| 같은 code라도 상태별 추천 | WORKING | time budget, feedback, inactive days |
| 콘텐츠가 code별 하드코딩만 됨 | 아님 | axis/direction/content tag 규칙 기반 |
| 운영 데이터에서 실제 추천 | PARTIAL | 스키마/코드 확인, 계정 생성 금지로 종단 간 미실행 |

## DB 감사 요약

현재 public에는 37개 테이블이 확인됐다. 핵심 source of truth는 다음과 같다.

| 데이터 | 정본 | 쓰기 | 읽기 | 중복/legacy |
|---|---|---|---|---|
| 답변·code·score meta·identity | `questionnaire_responses` | 보호 RPC | result/profile/journey | `user_profiles.body_bti_*`, `body_bti_results`에 요약/legacy 중복 |
| 결과 콘텐츠 | `body_code_content`, `body_code_result_sections`, `result_guide` | 운영 seed/admin | result | 역할이 겹치는 세 구조 정리 필요 |
| 즉시 행동 | `immediate_action_*` | seed/admin | mission/home | 명확 |
| Journey template/tag | `journey_templates`, `journey_content_tags` | seed | rules/API | 명확 |
| 사용자 Journey/미션/feedback/report | `user_journeys`, `user_missions`, `journey_mission_feedback`, `journey_reports` | 회원 RPC | Journey UI | 명확 |
| 적립 | `user_rewards`, `reward_rules` | security definer RPC/server | status/market | 명확 |
| 구독·주문·결제 | `user_subscriptions`, `orders`, `payments` | 서버 | 앱 SELECT | 서버 배포 없음 |
| 동의 | 없음 | 없음 | 없음 | MISSING |

RLS는 핵심 사용자 테이블에서 활성화됐고 own 정책을 사용한다. `questionnaire_responses`와 `user_profiles`에는 같은 목적의 과거/신규 정책이 중복되어 있어 동작은 안전해 보이지만 운영 이해와 변경 검증을 어렵게 한다. 삭제 전에 정책별 역할과 RPC 의존을 테스트해야 한다.

## 기술 품질

- TypeScript: 통과
- production build: 통과. main bundle 약 659 kB, gzip 약 185 kB이며 dynamic/static import 경고 1건
- Spring tests: 통과하나 출력상 실질 테스트 수는 확인되지 않음
- flow/progress/deadline: 29건 통과
- personalization rules: 112건 통과
- lint script: 없음
- Android release APK/기기: 미검증
- 공개 서버: 404

README/TODO는 최신 코드보다 뒤처졌다. checkout이 단순 mock이라고만 쓰거나 서버 상품 기능이 shell이라고 적힌 부분, 서버가 앱의 현재 가입 경로를 설명하지 못하는 부분이 있다. 반대로 실제 코드가 생겼다고 배포 완료로 보아서는 안 된다.

## 가치·전환

| 구간 | 사용자 가치 | 현재 마찰 | 측정 가능 |
|---|---|---|---|
| Landing→Start | DISCOVERY | 쿠키 배너와 법적 신뢰 문제 | 불가 |
| Start→Complete | DISCOVERY | 32문항, 중단 응답 없음 | 불가 |
| Complete→Result | INSIGHT | 저장 실패 fallback은 좋음 | 불가 |
| Result→First Action | ACTION | 선택지가 많고 대표 CTA 측정 없음 | 불가 |
| Journey→Mission→Feedback | PERSONALIZATION/PROGRESS | 로그인·entitlement 의존 | 불가 |
| D1→D7→D14 | RETENTION | 알림/return 측정 없음 | 불가 |
| Free→Paywall→Checkout | MONETIZATION | 서버/Play Billing 미완성 | 불가 |
| Result→Share→New user | VIRALITY | URL 구조는 안전, sink 없음 | 불가 |

