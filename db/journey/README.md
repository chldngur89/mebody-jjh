# MEBODY Journey — Supabase 마이그레이션

결과 페이지 이후 지속 관리 Journey용 신규 테이블입니다.
설계 근거는 [docs/MEBODY_JOURNEY_TECH_DESIGN.md](../../docs/MEBODY_JOURNEY_TECH_DESIGN.md)를 참고합니다.

## 적용 순서

Supabase SQL Editor에서 위에서부터 순서대로 실행합니다. 전부 재실행 안전합니다.
합본 `024_combined.sql`(020~032 전체) 하나를 붙여넣어도 결과는 같습니다.

1. `020_journey_schema.sql` — 신규 테이블 6개 + 인덱스 + 트리거
2. `021_journey_rls.sql` — RLS 정책과 권한
3. `022_seed_journey_template.sql` — `starter_14d` 템플릿 1행
4. `023_seed_journey_content_tags.sql` — 콘텐츠 태그 23행
5. `030_action_media.sql` — 동작 이미지 컬럼 (값은 NULL, 화면 영향 없음)
6. `031_rewards.sql` — 적립금 통합 원장 + 서버 추첨 함수
7. `032_orders.sql` — 멤버십 · 주문 · 적립금 차감 RPC

## 롤백

`099_rollback.sql` 로 020~023 이 만든 것만 되돌립니다. 사용자 저니 데이터가 함께 삭제됩니다.

## 기존 테이블에 대한 영향

| 테이블 | 변경 |
|---|---|
| `immediate_action_content` | UNIQUE 인덱스 1개 + **이미지 컬럼 2개 추가**(값 NULL). 기존 컬럼·행 변경 없음 |
| 그 외 전부 | **변경 없음** |

`missions`·`user_mission_progress`는 Spring JPA 엔티티(`mebody-server`)가 매핑 중이므로 건드리지 않습니다. Journey는 `journey_*` / `user_journeys` / `user_missions`를 새로 씁니다.

`020`의 UNIQUE 인덱스는 중복이 있으면 실패합니다. 실행 전 확인:

```sql
SELECT content_key, count(*) FROM public.immediate_action_content GROUP BY 1 HAVING count(*) > 1;
```

## 테이블 역할

| 테이블 | 역할 | RLS |
|---|---|---|
| `journey_templates` | Day 슬롯 규칙. 코드별 프로그램 하드코딩 없음 | 읽기 전용 공개 |
| `journey_content_tags` | `immediate_action_content` 23행의 축·방향·부위·난이도·도구 메타 | 읽기 전용 공개 |
| `user_journeys` | 사용자가 시작한 Journey 1건 (진행 중 1개 제한) | 본인 행만 |
| `user_missions` | Day/슬롯에 배정된 미션 인스턴스 | 본인 행만 |
| `journey_mission_feedback` | 미션 1건당 피드백 1건 | 본인 행만 |
| `journey_reports` | Day 7 Weekly / Day 14 Progress Check | 본인 행만 |

## 적용 후 검증

카탈로그는 읽히고 사용자 테이블은 anon에 막혀 있어야 합니다.

```bash
cd mebody-jjh && node scripts/verify-journey-db.mjs
```

수동으로 확인하려면 anon 키로:

| 요청 | 기대 |
|---|---|
| `GET /rest/v1/journey_templates` | 1행 |
| `GET /rest/v1/journey_content_tags` | 23행 |
| `GET /rest/v1/user_journeys` | `[]` |
| `GET /rest/v1/user_missions` | `[]` |
| `GET /rest/v1/journey_mission_feedback` | `[]` |
| `GET /rest/v1/journey_reports` | `[]` |

사용자 테이블에서 행이 하나라도 나오면 RLS가 잘못 적용된 것입니다.

## 동작 이미지 넣기

`030` 적용 후 Storage `images` 버킷에 `actions/` 폴더를 만들고 이미지를 올린 뒤:

```sql
UPDATE public.immediate_action_content
   SET release_image_url = 'actions/' || content_key || '_release.png',
       stretch_image_url = 'actions/' || content_key || '_stretch.png';
```

값이 NULL 이면 화면은 지금처럼 텍스트만 보여줍니다. 이미지를 넣는 즉시 반영됩니다.

## 상품 올리기

결과 페이지 스토어는 `products` 테이블의 `status='ACTIVE'` 행을 읽습니다.

```sql
INSERT INTO public.products (name, description, price, image_url, status)
VALUES ('MEBODY 폼롤러', '전신 근막 이완용', 29000, 'products/foam-roller.png', 'ACTIVE');
```

`price` 가 NULL 이면 "가격 준비 중"으로 표시됩니다.
