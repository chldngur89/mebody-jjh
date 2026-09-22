# MEBODY Professional Architecture

작성 기준: 2026-09-19 운영 DB 실측 + 실제 코드.
사용자 결정: **전문가 화면은 서버 관리자 콘솔 안에**, **퍼스널 트레이너를 먼저 검증**.

---

## 1. 판매자 모델이 이미 선례다

전문가는 새로 발명할 개념이 아니다. MEBODY 에는 이미 "남을 대신해 무언가를 관리하는 두 번째
사용자 유형" 이 동작하고 있다. 판매자(SELLER)다.

| 필요한 것 | 판매자에 이미 있는 것 | 파일 |
|---|---|---|
| 역할 구분 | `user_profiles.role` CHECK(MEMBER/SELLER/ADMIN) | DB |
| 내가 누구인지 판정 | `current_user_role()`, `current_seller_id()` SECURITY DEFINER | DB |
| 내 것만 보이는 RLS | `products_owner_read`, `products_manage_update/delete` | DB |
| 관리 화면 | 서버 정적 콘솔의 상품 관리 탭 | `static/index.html`, `assets/web.js` |
| 서버 API | `SellerProductController` | Java |
| 검증 | `npm run verify:seller` 22건 | scripts |

**전문가는 이 패턴을 한 벌 더 뜨는 일이다.** 새 인증, 새 콘솔, 새 권한 체계를 만들지 않는다.

---

## 2. 최소 신규 테이블 2개

### `professionals`

```
id               uuid PK
user_profile_id  uuid  → user_profiles.id   (1:1)
type             text  PERSONAL_TRAINER | PHYSIO
display_name     text
status           text  ACTIVE | SUSPENDED
created_at, updated_at
```

`user_profiles` 에 컬럼을 붙이지 않는 이유: 일반 회원 99% 에게 빈 컬럼이 늘어난다.
판매자도 같은 이유로 분리돼 있다.

`user_profiles.role` CHECK 에 `PROFESSIONAL` 을 더한다(EXTEND, 값 추가 한 줄).

### `professional_clients`

```
id               uuid PK
professional_id  uuid  → professionals.id
client_user_id   uuid  nullable → user_profiles.id   (수락 전에는 null)
invite_token     text  UNIQUE
status           text  INVITED | ACTIVE | REVOKED
invited_at       timestamptz
consented_at     timestamptz   (고객이 동의를 누른 시각)
revoked_at       timestamptz
UNIQUE(professional_id, client_user_id)
```

**초대 테이블을 따로 만들지 않는다.** 초대와 관계가 한 줄로 이어져 "초대했는데 관계가 없는"
중간 상태가 생기지 않는다. 고객이 링크를 열어 동의하면 같은 행이 `ACTIVE` 가 된다.

---

## 3. 권한 경계 — 가장 위험한 지점

**전문가가 아무 사용자의 데이터나 조회할 수 있으면 안 된다.**

이번 세션에서 `questionnaire_responses` 를 막 잠갔다.

- `044` 익명·회원 모두 테이블 직접 조회를 막고 읽기를 `get_questionnaire_response(id)` 하나로 좁혔다
  (적용 전 실측: 전체 399행 중 381행이 id 없이 읽혔다)
- `045` 제출이 끝난 결과는 아무도 못 고치게 얼렸다

전문가에게 열어주려고 **테이블 정책을 넓히면 그 상태로 되돌아간다.** 그래서 원칙을 못 박는다.

### 원칙

1. **테이블 RLS 를 넓히지 않는다.** SECURITY DEFINER 함수를 하나 더 만든다.

```sql
get_client_response(p_client_user_id uuid)
  -- 1) 호출자가 PROFESSIONAL 인가
  -- 2) professional_clients 에 (나, 그 고객) 관계가 ACTIVE 인가
  -- 3) consented_at 이 채워져 있는가
  -- 셋 다 맞을 때만 그 고객의 최신 완료 결과 1행. 아니면 0행.
```

2. **관계 밖 id 는 0행.** 오류도 내지 않는다. 오류가 갈리면 관계 여부를 떠볼 수 있다.
3. **동의가 없으면 아무것도 안 나온다.** 초대 수락이 곧 동의다.
4. **고객이 언제든 끊을 수 있다.** `status='REVOKED'` 가 되면 그 순간부터 0행.
5. `current_professional_id()` 를 `current_seller_id()` 와 같은 모양으로 만든다.

### 전문가가 볼 수 있는 것 / 없는 것

| 데이터 | 볼 수 있나 | 방법 |
|---|---|---|
| 고객의 body code, 축 점수 | O | `get_client_response()` |
| 고객의 32문항 원본 답변 | **Phase 1 에서는 X** | 필요성이 확인되면 별도 동의 |
| 고객의 저니 진행률·미션 수행 | O (Phase 2) | `get_client_journey_summary()` |
| 고객의 피드백 | O (Phase 2) | 같은 함수 |
| 고객의 적립금·주문·결제 | **X** | 전문가 업무와 무관 |
| 고객의 이메일·전화번호 | **X** | 표시 이름만 |
| 다른 전문가의 고객 | **X** | 관계로 차단 |

---

## 4. 초대 흐름

```
전문가 가입 (관리자가 role 부여)
   ↓
콘솔에서 초대 링크 생성      → professional_clients (status=INVITED, invite_token)
   ↓
카카오톡·문자로 전달          → https://<앱>/?invite=<token>
   ↓
고객이 링크 열기
   ├ 기존 회원 → 로그인 → 동의 화면
   └ 신규      → 가입 → 동의 화면
   ↓
"○○ 트레이너가 내 체형 결과를 볼 수 있도록 허용" 동의
   ↓
professional_clients: status=ACTIVE, client_user_id, consented_at
   ↓
(결과가 없으면) 32문항 진단 → 결과
   ↓
전문가 콘솔에서 고객 결과 확인
```

### 비회원 결과 문제

비회원으로 진단한 사람이 나중에 가입하면 `claim_questionnaire_response()` 가 결과를 귀속시킨다
(044 에서 만듦). 초대 링크로 들어온 사람도 같은 경로를 탄다. **새로 만들 것이 없다.**

### 초대 토큰

- 추측 불가한 난수. 앱의 결과 id 와 같은 수준(uuid 이상)
- 한 번 수락되면 재사용 불가
- 만료 기한을 둔다(7일). 만료된 링크는 새로 만들어야 한다

---

## 5. 전문가 화면 — 3단계

서버 관리자 콘솔(`static/index.html` + `assets/web.js`)에 탭을 더한다. B2C 앱은 손대지 않는다.

### A. 고객 상태 (Phase 1)

```
김철수
  몸BTI      FRRS  암사가는 잠금 로봇
  축         목 전방 / 어깨 오른쪽 높음 / 골반 오른쪽 회전 / 하체 경직
  관리 우선순위  1 목  2 하체  3 골반  4 어깨
  진단일      2026-09-12
```

필요한 데이터가 전부 `questionnaire_responses` + `body_code_content` 에 있다. 새 계산이 없다.

### B. 활동 확인 (Phase 2)

```
09/15  미션 완료   목 이완 + 스트레칭
09/16  미션 완료   하체 스트레칭          피드백: 괜찮음 / 적당
09/17  활동 없음
09/18  미션 건너뜀
09/19  미션 완료   목 이완                피드백: 불편 / 어려움
```

`user_missions.status` + `journey_mission_feedback` 을 날짜로 묶으면 된다.
`fetchTodayProgressSummary`, `calculateDayProgress` 가 이미 같은 계산을 한다.

### C. 개입 (Phase 3)

- 미션 추가 배정 (`user_missions` INSERT, `source_rule='professional'`)
- 메모 (`professional_clients` 에 컬럼 추가 또는 별도 노트 테이블)
- 체크인 요청 (`journey_reports` 템플릿)

**적립금 경계를 먼저 정한다.** 전문가 배정 미션이 적립 대상이면 적립금 발급 경로가 열린다.

---

## 6. PT · 물리치료사 공통 Core

두 개의 제품으로 만들지 않는다.

### 공통 (지금 구조 그대로)

Assessment · Client · Plan(저니) · Mission · Feedback · Progress · Report

### 나중에 갈라질 곳

| | FITNESS MODULE | PHYSIO MODULE |
|---|---|---|
| 미션 표현 | sets / reps / weight / RPE | 횟수·유지 시간·통증 척도 |
| 평가 | 체력 목표 | 전문가 평가, 경과 측정(outcome measure) |
| 콘텐츠 | 운동 | 치료적 운동 |
| 표현 규제 | 없음 | 의료 표현 가이드라인 |

### 지금 구조로 못 담는 것

`user_missions` 는 `planned_duration_sec` 과 `difficulty` 만 있다. **세트·횟수·중량이 없다.**
PT 가 "스쿼트 3×10" 을 배정하려면 컬럼이 필요하다.

가장 작은 방법: `user_missions.prescription` jsonb 한 컬럼. `{"sets":3,"reps":10,"weight_kg":40}`
FITNESS 는 sets/reps, PHYSIO 는 hold_sec/pain_scale 을 같은 컬럼에 담는다.
**타입별 테이블을 만들지 않는다.**

---

## 7. 안전

- MEBODY 엔진은 진단하거나 치료를 결정하지 않는다. 규칙으로 승인된 콘텐츠를 고를 뿐이다
- 물리치료사가 쓰더라도 "전문가의 판단을 대체한다" 고 표현하지 않는다
- AI 초안과 전문가 승인 Plan 을 `plan_source` 로 구분한다. 승인 전 초안은 고객에게 보이지 않는다
- 기존 진단 소개 화면의 의료 고지 문구를 전문가 경로에서도 유지한다
