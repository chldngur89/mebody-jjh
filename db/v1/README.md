# MEBODY V1 (32문항) Supabase 마이그레이션

프로젝트: `promptDashboard` (`ubylshiqilznifpmbkyu`)

## 적용 순서

1. `010_v1_schema.sql` — 컬럼/매핑 테이블/응답 메타
2. `011_deactivate_legacy.sql` — 레거시 본진단 비활성
3. `012_seed_v1_32_questions.sql` — 32문항
4. `013_seed_v1_choice_scores.sql` — 96 선택지 점수
5. `015_table_role_comments.sql` — 테이블 역할 COMMENT (선택, 재실행 가능)

이미 MCP로 원격 DB에 적용됨. 재적용 시 `014_combined_seed.sql` 또는 개별 파일 사용.

## 테이블 역할 (Drop 금지)

두 테이블은 겹쳐 보이지만 **역할이 다릅니다. `questions`를 Drop하면 안 됩니다.**

| 테이블 | 행 수 | 역할 | 앱 사용 |
|---|---|---|---|
| `questions` | 32 | 문항 UI: 문구, 보기, 수행법/해설, 미디어, 순서 | **필수** — `fetchQuestions()`가 Supabase에서 조회 |
| `question_choice_scores` | 96 (32×3) | 선택지별 축/아이덴티티 점수 | DB 소스 오브 트루스; 런타임 채점은 번들 `v1ScoreMapping.ts` |

공통처럼 보이는 `question_code` / `axis` / `axis_anchor` 등은 join key·문항 메타일 뿐, 한쪽이 다른 쪽을 대체하지 않습니다.

- Drop 대상이 있다면 레거시 `question_set = v3_full` **행**만 비활성/삭제 (`011_deactivate_legacy.sql`)
- 정리 시 테이블 Drop이 아니라 미사용 구 컬럼(`weight_a`/`weight_b` 등) 정리가 맞음

## 앱 연동

- `question_set = mebody_v1_32`
- UI: `questions` → [`src/api/questionnaire.ts`](../../src/api/questionnaire.ts) `fetchQuestions()`
- 채점: 번들 [`src/data/v1ScoreMapping.ts`](../../src/data/v1ScoreMapping.ts) (= DB `question_choice_scores`와 동일 소스)
- UX: select → guide (수행법/해설)
