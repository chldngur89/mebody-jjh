# MEBODY — 운영계 Supabase 구축

현재 Supabase를 **개발계**로 두고, 새 프로젝트를 **운영계**로 세울 때 쓰는 번들입니다.

## 왜 필요한가

개발계의 상당수 테이블은 저장소에 DDL이 없습니다. 콘솔에서 직접 만들어졌기 때문입니다
(`immediate_action_*`, `body_code_content`, `result_guide`, `app_content`, `app_images`,
`body_code_next_page`, `body_code_result_sections`). 이 상태로는 새 프로젝트에 재현할 방법이 없어,
개발계에서 실제 스키마와 데이터를 추출해 이식 가능한 SQL로 만들었습니다.

## 실행 순서

새 Supabase 프로젝트를 만든 뒤 SQL Editor에서 순서대로 실행합니다.

| # | 파일 | 내용 |
|---|---|---|
| 1 | `110_app_schema.sql` | 앱·서버 테이블 18개 DDL (인덱스·제약·트리거 포함) |
| 2 | `130_seed_content.sql` | 콘텐츠 386행 (문항 32, 선택지 96, 16코드, 즉시액션 63, 이미지 21, 상품 3 …) |
| 3 | `120_rls.sql` | RLS 정책과 권한 — **개발계 구멍을 처음부터 막은 버전** |
| 4 | `../journey/024_combined.sql` | Journey · 적립금 · 주문 (테이블 12개) |

`110` → `130` → `120` 순서입니다. RLS를 마지막에 켜야 시드가 막히지 않습니다.

## 옮기지 않는 것

- `questionnaire_responses` 380행 — 대부분 레거시(v2_40 159건, v3_49 92건) 테스트 데이터입니다. 운영계는 비어서 시작합니다.
- `user_profiles` — 계정은 새 프로젝트의 `auth.users`에 새로 생깁니다.
- `prompts`, `sere_contents` — 다른 프로젝트 테이블입니다.

## 개발계와 달라지는 점

`120_rls.sql`은 개발계 정책을 복사하지 않습니다. 개발계에는 아래 문제가 있었습니다.

| 문제 | 개발계 | 운영계 |
|---|---|---|
| `body_code_content` | RLS 꺼짐 + anon DELETE → 공개 키로 콘텐츠 16행 삭제 가능 | RLS 켬, 읽기 전용 |
| `admin_audit_logs` | RLS 꺼짐 + anon 전체 권한 | 클라이언트 권한 없음 |
| `questionnaire_responses` | `FOR ALL USING (true)` → 380행 열람·수정·삭제 | 본인 행만, 비회원은 RPC로 자기 것만 |
| 전 테이블 | anon에 INSERT/UPDATE/DELETE 부여 | 필요한 권한만 명시 부여 |

## 환경 전환

```env
# .env.local — 개발계
VITE_SUPABASE_URL=https://<dev-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<dev-anon>

# Vercel 환경변수 — 운영계
VITE_SUPABASE_URL=https://<prod-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<prod-anon>
```

서버(`mebody-server/.env`)의 `SUPABASE_DB_URL`·`SUPABASE_JWT_SECRET`·`SUPABASE_SERVICE_ROLE_KEY`도 함께 바꿉니다.

## Storage

DB와 별개입니다. 새 프로젝트에 `images` 버킷을 만들고 아래를 복사해야 합니다.

```
images/characters/{16개 코드}.png
images/axis/axis-{neck,shoulder,pelvis,flexibility}.png
images/body-types/bodyTypesImage.png
images/actions/     ← 동작 이미지(아직 없음)
images/products/    ← 상품 이미지(아직 없음)
```

## 적용 후 확인

```bash
cd mebody-jjh
npm run verify:journey-db      # 저니·리워드 스키마와 anon 차단
node scripts/verify-db-questions.mjs   # 32문항 조회
```

anon 키로 아래가 모두 성립해야 합니다.

- `body_code_content` 16행 읽힘, DELETE 거부
- `admin_audit_logs` 거부
- `questionnaire_responses` 회원 행 0건
