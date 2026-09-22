# MEBODY Extension Data Model

작성 기준: 2026-09-19 운영 DB 실측. 행수와 정책 수는 그날 조회 결과다.

---

## 1. 기존 36개 테이블 전수 분류

`KEEP` 그대로 / `EXTEND` 컬럼 추가 / `DEPRECATE` 정리 후보

| 테이블 | 행 | 정책 | 판정 | 비고 |
|---|---|---|---|---|
| `questions` | 32 | 4 | KEEP | 문항 정본. 049 에서 옛 문항 정리 완료 |
| `question_choice_scores` | 96 | 2 | KEEP | 32×3 점수표 |
| `questionnaire_responses` | 68 | 7 | **EXTEND** | 전문가 열람 함수 추가. **정책은 넓히지 않는다** |
| `body_code_content` | 16 | 3 | KEEP | 코드별 캐릭터·전략 |
| `body_code_result_sections` | 96 | 2 | KEEP | 감사 문서가 역할 중복 지적. 이번 확장과 무관 |
| `body_code_next_page` | 1 | 2 | KEEP | |
| `result_guide` | 4 | 2 | KEEP | |
| `immediate_action_content` | 23 | 2 | **EXTEND** | `creator_type`, `visibility` |
| `immediate_action_axis_mapping` | 8 | 2 | KEEP | |
| `immediate_action_discomfort_mapping` | 32 | 2 | KEEP | |
| `journey_content_tags` | 23 | 1 | KEEP | 축·방향 태그 |
| `journey_templates` | 1 | 1 | KEEP | `day_plan` jsonb 가 Weekly Structure |
| `user_journeys` | 2 | 3 | **EXTEND** | `plan_source`, `professional_id`, `goal` |
| `user_missions` | 11 | 3 | **EXTEND** | `assigned_by`, `prescription` jsonb |
| `journey_mission_feedback` | 0 | 3 | KEEP | |
| `journey_reports` | 0 | 2 | **EXTEND** | 체크인 컨테이너로 `report_type` 값 확대 |
| `user_profiles` | 8 | 6 | **EXTEND** | `role` CHECK 에 `PROFESSIONAL` 값 추가 |
| `user_rewards` | 2 | 1 | KEEP | **전문가 배정 미션의 적립 여부를 먼저 정할 것** |
| `reward_rules` | 7 | 1 | KEEP | |
| `membership_plans` | 2 | 1 | KEEP | |
| `user_subscriptions` | 0 | 1 | KEEP | 046 에서 SET NULL 로 변경됨 |
| `orders` | 0 | 1 | KEEP | 046 에서 SET NULL |
| `order_items` | 0 | 1 | KEEP | |
| `payments` | 0 | 1 | KEEP | 046 에서 SET NULL |
| `products` | 15 | 6 | KEEP | 판매자 RLS 패턴의 원본 |
| `user_addresses` | 0 | 4 | KEEP | |
| `app_content` | 1 | 2 | KEEP | |
| `app_images` | 21 | 2 | KEEP | |
| `app_error_log` | 0 | 2 | KEEP | 048 에서 권한 정리 완료 |
| `admin_audit_logs` | 5 | 0 | KEEP | 서버 전용. 전문가 행위 기록에 재사용 가능 |
| `ad_reward_callbacks` | 0 | 0 | KEEP | 서버 전용 |
| `missions` | 0 | 0 | KEEP | 앱 4곳·서버 2곳 참조. 저니 미션과 다른 옛 구조 |
| `user_mission_progress` | 0 | 0 | **삭제됨 (062)** | 서버 MissionService 를 user_missions 로 바꾼 뒤 제거 |
| `body_bti_results` | 0 | 0 | **삭제됨 (061)** | ⚠️ 지울 때 prepare_account_deletion() 이 참조 중이라 탈퇴가 깨졌다(064 로 복구) |
| `prompts` | 13 | 1 | **삭제됨 (061)** | 다른 제품 잔재. 백업: backup_legacy_tables_061.sql |
| `sere_contents` | 3 | 1 | **삭제됨 (061)** | 다른 제품 잔재. 백업: backup_legacy_tables_061.sql |

**2026-09-22 갱신 — 위 4개 + `missions` 를 정리했다.** 공개 테이블 40 → 35개.

정리하면서 배운 것을 남긴다. **테이블을 지우기 전에 코드만 훑으면 부족하다.**
`body_bti_results` 는 앱·서버 코드 어디에도 없었지만 `prepare_account_deletion()` 이
`DELETE` 하고 있었고, 지우는 순간 회원 탈퇴가 503 으로 죽었다. 겉으로는 "046 미적용" 이라고
나와서 원인을 찾는 데 시간이 걸렸다.

`missions` · `user_mission_progress` 는 0행이었지만 `GET /api/me/missions`(홈페이지 「미션 진행」
카드)가 읽고 있었다. 테이블만 먼저 지웠으면 그 화면이 500 이었다. 그래서 서버를
`user_missions` 로 옮긴 뒤(062) 지웠다 — 덤으로 늘 0% 이던 카드가 실제 숫자를 보여주게 됐다.

이제 `npm run verify:migrations` 가 **지운 테이블을 참조하는 DB 함수**를 잔재로 잡는다.
다음에 무언가를 지울 때는 그 검사가 먼저 걸린다.

---

## 2. 신규 테이블 2개

```sql
-- EXTEND: user_profiles.role CHECK 에 'PROFESSIONAL' 값 추가 (한 줄)

-- NEW
professionals (
  id uuid PK default gen_random_uuid(),
  user_profile_id uuid NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('PERSONAL_TRAINER','PHYSIO')),
  display_name text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

-- NEW
professional_clients (
  id uuid PK default gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  client_user_id  uuid REFERENCES user_profiles(id) ON DELETE CASCADE,  -- 수락 전 null
  invite_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED','ACTIVE','REVOKED')),
  invited_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days',
  consented_at timestamptz,
  revoked_at   timestamptz,
  UNIQUE (professional_id, client_user_id)
)
```

**초대 전용 테이블을 만들지 않는다.** 초대와 관계가 한 행이다.

---

## 3. 관계도

```
auth.users ──1:1── user_profiles ──1:1── professionals
                        │                     │
                        │                     │ professional_id
                        │  client_user_id     ↓
                        └──────────── professional_clients
                                              │
user_profiles ──1:N── questionnaire_responses │  (get_client_response 로만 접근)
             ──1:N── user_journeys ───────────┘  (professional_id 로 연결)
                          │
                          ├─1:N─ user_missions ─1:1─ journey_mission_feedback
                          └─1:N─ journey_reports
```

---

## 4. RLS 설계

### 새 헬퍼 함수

```sql
current_professional_id() RETURNS uuid
  -- current_seller_id() 와 같은 모양.
  -- auth.uid() → user_profiles(role='PROFESSIONAL') → professionals.id
  -- STABLE SECURITY DEFINER, search_path=public
```

### 새 테이블 정책

| 테이블 | 동작 | 정책 |
|---|---|---|
| `professionals` | SELECT | 본인 행 + ADMIN |
| `professionals` | INSERT/UPDATE | ADMIN 만 (전문가 승인은 사람이 한다) |
| `professional_clients` | SELECT | `professional_id = current_professional_id()` 또는 `client_user_id = auth.uid()` |
| `professional_clients` | INSERT | 전문가가 자기 초대만 |
| `professional_clients` | UPDATE | 고객은 자기 행의 수락·해지만, 전문가는 자기 초대의 취소만 |

### 고객 데이터 접근 — 함수로만

**`questionnaire_responses` 의 SELECT 정책을 넓히지 않는다.** 044 를 되돌리는 셈이 된다.

```sql
get_client_response(p_client_user_id uuid)
  SECURITY DEFINER
  -- 호출자가 PROFESSIONAL 이고
  -- professional_clients 에 (current_professional_id(), p_client_user_id) 가 ACTIVE 이고
  -- consented_at IS NOT NULL 일 때만 1행
  -- user_id, email 은 반환하지 않는다 (get_questionnaire_response 와 같은 원칙)
```

같은 방식으로 Phase 2 에 `get_client_journey_summary(p_client_user_id)` 를 더한다.

### 검증 스위트

`verify:seller` 22건이 판매자 경계를 지키는 것과 같은 수준으로 `verify:professional` 을 만든다.
최소 항목:

- 관계 없는 고객 id → 0행
- `status='INVITED'` 인 동안 → 0행
- `consented_at` 이 null 이면 → 0행
- `REVOKED` 후 → 0행
- 다른 전문가의 고객 → 0행
- 일반 회원이 `current_professional_id()` 를 불러도 null
- 익명이 함수를 부르면 거부
- 고객 본인의 기존 조회 경로가 안 깨짐

---

## 5. 마이그레이션 전략

번호는 `db/journey/` 다음 번호부터. **`db/v1` 에도 같은 번호가 있으니 폴더를 함께 적는다.**

| 파일 | 내용 | 되돌리기 |
|---|---|---|
| `052_professional_core.sql` | 역할 값 추가, 두 테이블, 헬퍼 함수, 정책 | 테이블 DROP |
| `053_professional_client_read.sql` | `get_client_response()` | 함수 DROP |
| `054_client_plan_source.sql` | `user_journeys` 3컬럼, `user_missions` 2컬럼 | 컬럼 DROP |
| `055_content_library_scope.sql` | `immediate_action_content` 2컬럼 | 컬럼 DROP |

원칙(지금까지와 동일):

- 파일 안에 `BEGIN`/`COMMIT` 을 쓰지 않는다. 검증 스크립트가 트랜잭션으로 감싸 시험한다
- 새 테이블은 **반드시** `REVOKE ALL ... FROM anon, authenticated` 후 필요한 것만 GRANT.
  Supabase 기본값에 TRUNCATE 가 들어 있고 TRUNCATE 는 RLS 를 우회한다 (041·048 의 교훈)
- 새 함수도 `REVOKE ALL ... FROM PUBLIC` 먼저. `CREATE FUNCTION` 은 PUBLIC 에 EXECUTE 를 준다
- 기본값을 넣어 기존 행이 그대로 유효하게 한다 (`plan_source` 기본 `MEBODY_ENGINE`)
- 적용 상태는 `npm run verify:migrations` 에 판정 항목을 더해 추적한다
