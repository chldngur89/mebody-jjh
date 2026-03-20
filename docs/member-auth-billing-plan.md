# MEBODY 회원 데이터 / 결제 구조 작업 계획

작성일: 2026-03-20

## 요약
- 인증은 `Supabase Auth`를 계속 사용한다.
- 회원가입만으로 여는 기능은 `결과 저장`, `최근 결과 재방문`, `코드 플랜`이다.
- 결제로 여는 기능은 `심화 리포트`, `루틴 확장`, 이후 프리미엄 기능이다.
- 결제사는 아직 붙이지 않고, 당분간은 `가상 결제`로 운영한다.
- 다만 구조는 나중에 `Toss` 같은 실제 결제사로 쉽게 교체할 수 있게 잡는다.

## 현재 코드 상태

### 이미 있는 것
- `Supabase Auth` 이메일/비밀번호 회원가입/로그인
- `user_profiles` 테이블
- `membership_plans` 테이블
- `user_subscriptions` 테이블
- `questionnaire_responses.user_id` 컬럼
- 최근 결과 재방문 UI
- 결제/멤버십 UI

### 아직 부족한 것
- 결제는 실제 결제가 아니라 클라이언트에서 `activateSubscription()`으로 DB 상태만 바꾸는 테스트 구조
- `questionnaire_responses` RLS가 너무 열려 있음
- 비회원 결과를 회원 계정으로 안전하게 귀속하는 서버 흐름이 없음
- 결제 이력 원장 테이블이 없음
- 서버 API 없이 프론트가 직접 구독 상태를 바꾸고 있음

## 목표 구조

### 1. 회원 데이터

#### 유지할 테이블
- `auth.users`: 원본 회원 계정
- `user_profiles`: 앱 프로필
- `questionnaire_responses`: 결과 원본

#### `user_profiles` 최소 컬럼
- `id`
- `email`
- `display_name`
- `marketing_opt_in`
- `terms_accepted_at`
- `privacy_accepted_at`
- `created_at`
- `updated_at`

원칙:
- 추가 개인정보(`phone`, `birth`, `gender`)는 지금 넣지 않는다.
- 최소 수집 원칙으로 간다.

### 2. 결과 저장

#### 비회원 진단
- 비회원도 설문은 가능
- 이때 `questionnaire_responses.user_id = NULL`

#### 회원가입 후 귀속
- 결과 페이지에서 회원가입/로그인 완료 시
- 현재 보고 있던 `questionnaire_id`를 로그인한 본인 계정으로 귀속

조건:
- 현재 결과 row의 `user_id IS NULL`
- 이미 다른 사용자에게 연결된 결과는 가져갈 수 없음
- 프론트 직접 update가 아니라 서버 API를 통해 귀속

## 보안 / 권한 정책

### 현재 문제
- `questionnaire_responses`가 지금은 공개 read/update 수준이라 고객 회원데이터 보안 기준에 맞지 않음

### 목표 RLS

#### `user_profiles`
- 본인만 `SELECT`
- 본인만 `INSERT`
- 본인만 `UPDATE`

#### `user_subscriptions`
- 본인만 `SELECT`
- 클라이언트 직접 `INSERT/UPDATE` 금지
- 서버(API 또는 service role)만 상태 변경

#### `questionnaire_responses`
- 비회원 `INSERT` 허용
- 본인 결과만 `SELECT`
- 본인 결과만 제한적 `UPDATE`
- 공개 공유가 필요하면 `share_token` 기반으로 별도 설계

결론:
- 기존 `questionnaire_responses read/update = true` 정책은 제거 대상

## 결제 구조

### 결제 방향
- 지금은 `가상 결제`
- 구조는 `실결제 준비형`
- 이후 `Toss`로 교체할 수 있게 설계

### 유지할 테이블
- `membership_plans`: 플랜 마스터
- `user_subscriptions`: 현재 권한 상태

### 새로 추가할 테이블
- `payment_transactions`

#### `payment_transactions` 컬럼 초안
- `id`
- `user_id`
- `plan_code`
- `provider` (`virtual`, 이후 `toss`)
- `provider_order_id`
- `status` (`pending`, `paid`, `failed`, `canceled`, `refunded`)
- `amount_krw`
- `currency`
- `checkout_type`
- `metadata jsonb`
- `paid_at`
- `created_at`
- `updated_at`

#### `user_subscriptions`에 추가할 컬럼
- `provider`
- `latest_transaction_id`

원칙:
- `payment_transactions`는 결제 이력 원장
- `user_subscriptions`는 현재 사용 권한 상태

## 서버 구조

### 원칙
- 프론트에서 결제/구독 상태를 직접 쓰지 않는다
- `Vercel API`가 유일한 상태 변경 진입점이 된다

### 필요한 API

#### `POST /api/results/claim`
- 로그인 직후 현재 결과를 본인 계정으로 귀속

#### `POST /api/billing/create-checkout`
- 플랜 검증
- `payment_transactions.pending` 생성

#### `POST /api/billing/confirm-virtual`
- 가상 결제 완료 처리
- `payment_transactions.paid` 반영
- `user_subscriptions` 활성화

나중에 실제 결제사 연동 시:
- `confirm-virtual` 자리에 실제 승인 API / webhook 흐름을 넣는다
- 프론트는 그대로 두고 서버만 교체한다

## 프론트 변경 방향

### `AuthScreen`
- 회원가입 시 약관/개인정보 동의 저장 필요
- 마케팅 수신은 선택

### `Result -> Auth`
- 회원가입/로그인 성공 직후 `claim result` 실행

### `CheckoutScreen`
- 현재의 `activateSubscription()` 직접 호출 제거
- 서버 API로 변경
- 버튼 문구는 당분간 `가상 결제 테스트` 유지 가능

### `MembershipScreen` / `MyPageScreen`
- 구독 상태는 항상 `user_subscriptions` 기준으로 표시
- 필요하면 최신 결제 상태를 `payment_transactions`에서 함께 조회

## 다음 작업 순서

### 1단계. DB / RLS 정리
1. `user_profiles`에 동의 시각 컬럼 추가
2. `payment_transactions` 테이블 추가
3. `user_subscriptions` 확장 컬럼 추가
4. `questionnaire_responses` RLS 재설계
5. 기존 공개 update 정책 제거

### 2단계. 서버 API 추가
1. `POST /api/results/claim`
2. `POST /api/billing/create-checkout`
3. `POST /api/billing/confirm-virtual`

### 3단계. 프론트 연결
1. 로그인 후 결과 귀속 연결
2. 체크아웃 화면을 서버 API 기반으로 변경
3. 멤버십/마이페이지 조회 데이터 정리

### 4단계. 검증
1. 비회원 설문 -> 회원가입 -> 결과 귀속
2. 가상 결제 -> 구독 활성화
3. 재방문 시 최근 결과 진입
4. 다른 사용자 결과 접근 차단

## 내일 바로 시작할 항목

가장 먼저 할 것:
1. SQL 초안 작성
2. `questionnaire_responses` RLS 수정안 작성
3. `payment_transactions` 설계 반영
4. `results/claim` API부터 구현

작업 순서 추천:
1. SQL
2. Vercel API
3. 프론트 Auth/Checkout 연결
4. 테스트

## 주의사항
- 지금 단계에서는 실제 결제사 연동을 하지 않는다
- 클라이언트에서 직접 구독 상태를 바꾸는 코드는 제거 대상이다
- 공개 결과 URL 구조는 회원데이터 보안 기준과 충돌하므로 재설계가 필요하다
- 개인정보는 최소한만 저장한다
