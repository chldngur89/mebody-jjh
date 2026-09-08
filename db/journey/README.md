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

마켓 탭과 홈 추천은 `products` 테이블의 `status='ACTIVE'` 행을 읽습니다.

**정상 경로는 SQL 이 아니라 서버 관리자 콘솔입니다** — `/admin` → 상품 관리.
사진을 고르지 않으면 등록 버튼이 열리지 않고, 서버가 사진 없는 요청을 400 으로 거절하며,
`039` 의 `products_image_required` 제약이 DB 에서도 막습니다(세 겹).
콘솔이 사진을 Storage `images/products/` 에 먼저 올리고, 그 공개 URL 을 `image_url` 에 넣습니다.

SQL 로 직접 넣어야 한다면 `image_url` 을 반드시 채워야 합니다. 안 채우면 거절됩니다:

```sql
INSERT INTO public.products (seller_id, name, description, price, category, image_url, status)
VALUES ((SELECT id FROM public.user_profiles WHERE role='SELLER' LIMIT 1),
        'MEBODY 폼롤러', '전신 근막 이완용', 29000, 'release',
        'https://<project>.supabase.co/storage/v1/object/public/images/products/foam-roller.png',
        'ACTIVE');
```

`category` 는 `release / strength / stretch / support / food` 중 하나여야 마켓 탭 필터에 잡힙니다.
`price` 가 NULL 이면 "가격 준비 중"으로 표시됩니다.

## 결제 (040)

앱은 `user_subscriptions` 와 `orders.status` 를 **바꿀 수 없습니다**(SELECT 권한만).
040 의 `*_admin` 함수도 `authenticated` 에서 EXECUTE 를 회수했습니다 —
앱이 부를 수 있으면 누구나 공짜로 멤버십을 켜고 주문을 결제 완료로 만들 수 있기 때문입니다.

**결제 UI 는 앱, 상태 변경은 서버**입니다:

```
앱 → 스토어/PG 결제 → 영수증  → Spring /api/billing/* → record_payment_admin
                                                      → activate_subscription_admin
                                                      → mark_order_paid_admin
```

`payments` 의 `UNIQUE(provider, provider_txn_id)` 가 같은 결제의 중복 반영을 막습니다.
구독 만료는 `has_active_subscription` 이 `current_period_end > now()` 를 보므로 **자동**입니다(크론 불필요).

## 주문 이후 흐름 (042)

주문에는 축이 둘입니다:

| 축 | 값 | 누가 바꾸나 |
|---|---|---|
| `status` (결제) | PENDING → PAID → CANCELED | 서버(결제 승인/환불) |
| `fulfillment_status` (배송) | NONE → PREPARING → SHIPPED → DELIVERED | 서버(판매자·관리자 콘솔) |

- 배송은 **앞으로만** 갑니다. 발송(SHIPPED) 이상은 **송장번호가 있어야** 합니다.
- **발송 뒤에는 취소가 막힙니다** — 그건 반품이고 다른 절차입니다.
- 취소하면 적립금 정산을 한 번에 합니다: 쓴 적립금은 `refund_order` 로 돌려주고,
  지급된 구매 적립(5%)은 `expire` 로 회수합니다.
  (음수 `earn_purchase` 는 제약이 막으므로 `expire` 를 씁니다)
- 결제사 환불이 **먼저**입니다. 돈을 못 돌려주는데 주문만 취소하면 장부가 어긋납니다.

배송 상태는 콘솔 `/admin` → **주문 · 배송** 에서 바꿉니다. 판매자는 자기 상품이 든 주문만 봅니다.

## 보상형 광고 서버 검증 (042)

지금까지는 앱이 "광고 다 봤다"고 하면 그대로 지급했습니다. AdMob 은 광고를 실제로
끝까지 본 경우에만 서버로 콜백을 보내고 거기에 ECDSA 서명을 붙입니다.

```
앱(보상형 광고, ssv.userId = auth user id)
  → AdMob → GET /api/ads/admob/ssv?...&signature=...
  → 서명 검증 → grant_routine_bonus_admin → 앱이 결과를 읽음
```

켜는 법:
1. AdMob 콘솔 → 해당 광고 단위 → 서버 측 확인(SSV) → 콜백 URL
   `https://<배포주소>/api/ads/admob/ssv`
2. 서버에 `MEBODY_ADS_SSV_ENABLED=true`
3. 콜백이 실제로 들어오는 걸 `ad_reward_callbacks` 에서 확인
4. 그 다음에 042 파일 끝의 REVOKE 한 줄을 실행하면 앱이 직접 청구하는 경로가 닫힙니다

꺼져 있으면(기본값) 콜백은 503 을 돌려주고, 앱이 직접 청구하는 기존 방식이 그대로 동작합니다.

### 사업자등록 전 전 구간 확인

서버를 개발 어댑터로 띄우면 실제 결제 없이 담기→주문→결제→적립까지 돌려볼 수 있습니다.
**운영에서는 반드시 꺼야 합니다**(기본값 false, 켜면 시작 로그에 경고가 찍힙니다):

```bash
MEBODY_BILLING_DEV_MODE=true ./mvnw spring-boot:run
```

계약이 끝나면 `TOSS_SECRET_KEY`(실물 상품) 와 `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`(멤버십)을
설정하면 됩니다. 실결제 어댑터가 우선이라 개발 어댑터는 자동으로 밀려납니다.

### 사진 없는 기존 상품 15개

`038` 이 시드한 상품들은 사진이 없습니다. `039` 를 적용하면 콘솔 상품 목록에서 "사진 없음"
배지와 함께 뜨고, 카드를 눌러 사진을 채울 수 있습니다. 전부 채운 뒤에는 제약을 완전 검증
상태로 올릴 수 있습니다:

```sql
ALTER TABLE public.products VALIDATE CONSTRAINT products_image_required;
```
