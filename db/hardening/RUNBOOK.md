# 하드닝 적용 · 검증 런북

제가 DB에 쓸 수 없어(환경 안전장치) 아래 두 단계는 직접 실행해 주셔야 합니다.
각 단계마다 확인 명령을 붙였습니다.

---

## 0. 지금 상태 (적용 전)

```bash
cd mebody-jjh && npm run verify:hardening
```

지금은 **7건 실패**가 나옵니다. 정상입니다. 무엇이 뚫려 있는지 그대로 보여줍니다.

```
FAIL  콘텐츠 삭제 차단 (body_code_content)
FAIL  콘텐츠 변조 차단 (immediate_action_content)
FAIL  문항 변조 차단 (questions)
FAIL  상품 변조 차단 (products)
FAIL  admin_audit_logs 비노출
FAIL  회원 응답 0건 노출          ← 5건 노출됨
FAIL  조회 RPC                    ← 아직 함수 없음
```

---

## 1. 하드닝 적용

실사용자가 없는 상태이므로 **`db/APPLY_NOW.sql` 하나**로 하드닝과 Journey 를 한 번에 적용해도 됩니다.

나눠서 하려면 SQL Editor 에서 순서대로:

1. `db/hardening/200_dev_rls_fix.sql`
2. `db/hardening/210_response_read_lock.sql`

두 파일 모두 트랜잭션으로 감싸져 있어 중간 실패 시 자동 롤백됩니다.

```bash
npm run verify:hardening     # 이제 전부 PASS 여야 합니다
```

**앱 배포는 필요 없습니다.** `210` 이 추가하는 조회 RPC는 이미 앱에 반영돼 있고,
RPC가 없으면 기존 방식으로 폴백하도록 만들어 두었습니다(폴백 동작은 브라우저에서 확인 완료).

---

## 2. 비회원 진단 확인 (브라우저)

```bash
npm run dev
```

1. 랜딩 → 내 체형 코드 분석 시작하기 → 동의 → 안내 → 32문항 완주
2. 결과 페이지에 코드·4축 그래프·캐릭터가 보이는지
3. 새로고침해도 결과가 유지되는지
4. 개발자도구 콘솔에 `42501` 이나 `permission denied` 가 없는지

여기서 막히면 즉시 롤백하세요.

```sql
-- 되돌리기: 200/210 이전 상태로
DROP POLICY IF EXISTS questionnaire_responses_select_anon ON public.questionnaire_responses;
CREATE POLICY "questionnaire_responses read" ON public.questionnaire_responses
  FOR SELECT USING (true);
```

---

## 3. 회원 + 리워드 검증

리워드는 Journey 스키마가 있어야 동작합니다.

1. `db/journey/024_combined.sql` 실행 (020~032 전체)
2. `npm run verify:journey-db` — 카탈로그 조회와 사용자 테이블 anon 차단 확인
3. 브라우저에서:

| 단계 | 확인할 것 |
|---|---|
| 회원가입 → 32문항 완주 | 결과가 계정에 저장되는지 |
| 결과 → `14일 관리 시작하기` | Journey Intro 에 관리 우선순위 1·2순위가 뜨는지 |
| 시작하기 → 오늘의 미션 | Day 1 미션이 배정되는지 (1순위 축) |
| 미션 시작 → 완료 | 타이머가 끝나고 피드백 시트가 뜨는지 |
| 피드백 시트 | **적립 금액(1~7원)과 총 적립금이 표시되는지** |
| 같은 미션 다시 완료 | "이미 적립됨" 으로 나오고 금액이 안 늘어나는지 |
| 마이페이지 | 저니 진행 카드가 보이는지 |
| 결과 페이지 하단 스토어 | **내 적립금과 상품별 "적립금 적용가"가 보이는지** |

4. 서버에서 원장 확인:

```sql
SELECT entry_type, amount, issue_type, memo, created_at
  FROM public.user_rewards
 WHERE user_id = '<내 uid>'
 ORDER BY created_at DESC;

SELECT public.reward_balance('<내 uid>');   -- 원장 합계와 같아야 함
```

5. 구독 배수 확인 (선택):

```sql
INSERT INTO public.user_subscriptions (user_id, plan_code, status, current_period_end)
VALUES ('<내 uid>', 'pro_monthly', 'active', now() + interval '30 days');
```

이후 미션을 완료하면 적립금이 2배로 들어오고 `memo` 에
`기본 N원 x 등급 2.00배` 가 남습니다.

---

## 문제가 생기면

| 증상 | 원인 | 조치 |
|---|---|---|
| 진단 저장이 `42501` | SELECT 정책 부족 (`INSERT ... RETURNING`) | `210` 의 `questionnaire_responses_select_anon` 정책이 있는지 확인 |
| 결과 페이지 빈 화면 | 콘텐츠 읽기 권한 회수 | `200` 의 콘텐츠 GRANT 블록 재실행 |
| 적립이 안 됨 | Journey 스키마 미적용 | `024_combined.sql` 실행 |
| 적립이 두 번 됨 | 있을 수 없음 | `user_rewards_once_per_event` UNIQUE 제약 확인 |
