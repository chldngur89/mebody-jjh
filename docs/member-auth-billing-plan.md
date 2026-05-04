# 회원 데이터 / 결제 구조 계획

작성 기준: 2026-05-04

## 현재 상태
- 인증은 Supabase Auth 이메일/비밀번호 방식입니다.
- `user_profiles`, `membership_plans`, `user_subscriptions` 테이블을 사용합니다.
- `questionnaire_responses.user_id`로 로그인 사용자 결과를 연결합니다.
- 비회원 결과는 현재 탭 세션에서만 이어볼 수 있습니다.
- 체크아웃은 실제 결제가 아니라 mock 구독 활성화입니다.
- 멤버십/마이페이지 UI는 존재하지만 운영 결제 보안 구조는 아직 아닙니다.

## 운영 목표
- 회원가입 후 결과 저장과 재방문을 안정적으로 지원합니다.
- 결제 완료 사용자에게 코드 플랜 확장 기능과 이후 프리미엄 콘텐츠를 제공합니다.
- 결제/구독 상태 변경은 프론트가 직접 DB를 쓰지 않고 서버 API와 webhook으로 처리합니다.
- 개인정보는 최소 수집 원칙으로 유지합니다.

## 필요한 DB 변경
### `user_profiles`
추가 검토 컬럼:
- `terms_accepted_at`
- `privacy_accepted_at`
- `marketing_opt_in`
- `marketing_accepted_at`

### `payment_transactions`
신규 원장 테이블이 필요합니다.

필수 컬럼 초안:
- `id`
- `user_id`
- `plan_code`
- `provider`
- `provider_order_id`
- `status`
- `amount_krw`
- `currency`
- `metadata jsonb`
- `paid_at`
- `created_at`
- `updated_at`

### `user_subscriptions`
추가 검토 컬럼:
- `provider`
- `latest_transaction_id`

## 필요한 서버 API
### `POST /api/results/claim`
로그인 직후 현재 비회원 결과를 본인 계정으로 귀속합니다.

검증 조건:
- 요청 사용자가 로그인 상태여야 합니다.
- 대상 결과의 `user_id`가 비어 있어야 합니다.
- 이미 다른 사용자에게 귀속된 결과는 가져갈 수 없습니다.

### `POST /api/billing/create-checkout`
플랜을 검증하고 결제 대기 원장을 생성합니다.

### `POST /api/billing/confirm-virtual`
운영 전 mock 결제 확인용 API입니다. 프론트 직접 DB update를 제거하기 위한 중간 단계입니다.

### 결제 webhook
실제 결제사 연결 시 결제 성공/실패/취소/환불을 검증하고 `payment_transactions`, `user_subscriptions`를 갱신합니다.

## RLS 원칙
### `user_profiles`
- 본인만 조회
- 본인만 생성
- 본인만 수정

### `questionnaire_responses`
- 비회원 insert는 허용
- 로그인 사용자는 본인 결과만 조회
- 결과 귀속은 서버 API로만 처리
- 공유 URL은 별도 `share_token` 정책으로 재설계

### `user_subscriptions`
- 본인만 조회
- 클라이언트 직접 insert/update 금지
- 서버 또는 webhook만 상태 변경

### `payment_transactions`
- 본인 결제 이력만 조회
- 클라이언트 직접 insert/update 금지
- 서버 또는 webhook만 변경

## 프론트 변경 순서
1. `AuthScreen`에서 약관/개인정보 동의 시각을 저장합니다.
2. 로그인 성공 직후 `results/claim` API를 호출합니다.
3. `CheckoutScreen`에서 mock DB 직접 변경을 제거합니다.
4. `MembershipScreen`과 `MyPageScreen`은 서버가 확정한 구독 상태만 표시합니다.
5. 결과 공유는 RLS 재설계 후 별도 정책으로 다시 연결합니다.

## 내일 작업 추천 순서
1. 운영 RLS SQL 초안을 작성합니다.
2. `payment_transactions` SQL을 작성합니다.
3. `results/claim` API를 먼저 구현합니다.
4. 체크아웃 mock을 서버 API로 이동합니다.
5. 비회원 설문 -> 회원가입 -> 결과 귀속 -> 최근 결과 재방문 흐름을 검증합니다.
