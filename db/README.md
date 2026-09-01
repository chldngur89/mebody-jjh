# MEBODY DB

## 지금 할 것 — 파일 하나

Supabase SQL Editor 에 **`db/APPLY_NOW.sql`** 을 붙여넣고 실행합니다.
보안 하드닝과 Journey·적립금·주문이 모두 들어 있습니다. 재실행해도 안전합니다.

```bash
npm run verify:hardening    # 보안 구멍이 막혔는지 + 앱이 안 깨졌는지
npm run verify:journey-db   # 저니 카탈로그와 사용자 테이블 차단
```

## 나중에 운영계로 옮길 때 — 파일 하나

새 Supabase 프로젝트에 **`db/bootstrap/000_full_bootstrap.sql`** 을 붙여넣습니다.
스키마 · 콘텐츠 · RLS · Journey 가 올바른 순서로 들어갑니다.

옮기기 직전에 최신 콘텐츠로 다시 뽑으세요. 일회성 덤프가 아닙니다.

```bash
npm run db:extract          # 현재 DB → db/bootstrap/ 재생성
```

Storage 는 DB 와 별개입니다. `images` 버킷의 캐릭터 16 · 축 아이콘 4 · 체형맵 1 을 복사해야 합니다.

## 디렉터리

| 경로 | 용도 |
|---|---|
| `APPLY_NOW.sql` | **지금 DB 에 적용할 전체** (하드닝 + Journey) |
| `hardening/` | 보안 구멍 차단 (200 → 210) + RUNBOOK |
| `journey/` | Journey · 적립금 · 주문 (020~032, 합본 024, 롤백 099) |
| `bootstrap/` | 새 프로젝트 구축 (원클릭 000, 개별 110/120/130) |
| `v1/` | 기존 32문항 마이그레이션 (적용 완료) |

## 검증 상태

모든 SQL 은 롤백되는 트랜잭션 안에서 실제 DB 를 대상으로 검증했습니다.

| 대상 | 건수 |
|---|---|
| Journey 스키마 · RLS | 20 |
| 미션 생성 경로 | 17 |
| 적립금 · 주문 · 악용 방지 | 21 |
| 보안 하드닝 | 23 |
| 운영계 부트스트랩 | 14 |
| 원클릭 번들 (양쪽) | 15 |

## 되돌리기

| 대상 | 방법 |
|---|---|
| Journey · 적립금 · 주문 | `db/journey/099_rollback.sql` |
| 하드닝 | `db/hardening/RUNBOOK.md` 의 롤백 SQL |
