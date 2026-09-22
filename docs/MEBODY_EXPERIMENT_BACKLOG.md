# MEBODY Experiment Backlog

감사일: 2026-09-19

출시 차단 문제는 실험이 아니라 **BUILD**다. 법적 문서, 동의 증적, 안전 중단, 계정 삭제/확인, 운영 API, 분석 수집이 완료되기 전에는 성장 실험을 시작하지 않는다.

## BUILD

| 항목 | 문제 | 최소 구현 | 측정/완료 기준 |
|---|---|---|---|
| 법적·동의 기반 | 미완성 문서와 증적 없음 | 최종 문서 version + consent ledger + 가입/진단 연결 | 동의 없는 보호 데이터 저장 0, 모든 동의 row에 version/time/channel |
| 안전 중단 | 통증 사용자가 답을 강제당함 | stop 응답, 점수 제외, 전문가 안내 | 지정 동작 문항 모두 stop 가능, 결과 왜곡 없음 |
| 계정 lifecycle | 확인·복구·삭제 불완전 | email verify, phone 제한, reset, delete | 이메일/삭제 E2E 성공, 미복구 계정 0 |
| 운영 연결 | 공개 서버 404/release localhost | 배포 API, release env, health monitoring | APK에서 auth/billing-disabled config/error log 조회 성공 |
| 핵심 분석 | funnel을 볼 수 없음 | consent-aware SDK/server events/dashboard | 핵심 누락 <2%, 중복 <1%, PII 0 |

## EXPERIMENT

### E1. 결과 직후 하나의 첫 행동

- Hypothesis: 결과 화면 상단에 한 개의 3분 행동만 제시하면 첫 행동 완료율이 오른다.
- Variant A: 현재 결과 상세와 여러 CTA.
- Variant B: 결과 요약 직후 “3분 시작” 한 개, 상세는 아래.
- Primary Metric: `result_viewed → first_action_completed`.
- Guardrail: 결과 상세 열람률, 안전 중단률, D1 return.
- Minimum Data Required: variant당 결과 조회 300명과 최소 2주.
- Decision Rule: 완료율 상대 +15% 이상, guardrail -5%p 이내면 채택.

### E2. 3분과 10분 첫 미션

- Hypothesis: 첫날 3분은 완료율을 높이고 D7을 해치지 않는다.
- Variant A: 10분.
- Variant B: 3분 후 선택 연장.
- Primary Metric: 첫 미션 완료율.
- Guardrail: D7 return, 불편 feedback, 총 수행시간.
- Minimum Data Required: variant당 Journey 시작 250명.
- Decision Rule: 첫 완료 +10%p 이상이고 D7 비열등(-3%p 이내).

### E3. feedback 이유 노출

- Hypothesis: “이 답으로 내일 강도/시간이 바뀐다”를 보여주면 feedback 제출률이 오른다.
- Variant A: 현재 버튼.
- Variant B: 변화 예고 + 버튼.
- Primary Metric: feedback submission rate.
- Guardrail: mission completion→exit 시간, 선택 분포.
- Minimum Data Required: variant당 완료 미션 500건.
- Decision Rule: 제출률 +10%p, 무응답/이탈 악화 없음.

### E4. 무료 루틴 경계

- Hypothesis: 첫 3일을 무료로 명확히 체험시키는 것이 첫 14일 전체 무료보다 유료 의도를 더 잘 검증한다.
- Variant A: 현재 첫 Journey 무료.
- Variant B: 3일 무료 후 결과/진행 리포트 preview와 paywall.
- Primary Metric: verified checkout intent와 subscription conversion.
- Guardrail: Day 3 completion, 환불/불만, D7.
- Minimum Data Required: 실제 Play Billing 준비 후 variant당 300명.
- Decision Rule: 유료전환 개선과 Day 3/불만 비열등을 함께 충족.

### E5. 공유 카드의 신규 시작 연결

- Hypothesis: 공유 카드에 “내 코드 확인” CTA와 예상 소요시간을 넣으면 shared start가 증가한다.
- Variant A: 현재 공유 링크.
- Variant B: “약 N분, 무료” CTA.
- Primary Metric: shared open→questionnaire started.
- Guardrail: 공유 취소율, completion rate.
- Minimum Data Required: variant당 shared open 500건.
- Decision Rule: start +15%, completion -3%p 이내.

## LATER

- streak와 push reminder: D1/D7 baseline과 사용자 알림 선호를 얻은 뒤 실험한다.
- 커뮤니티/피드: 핵심 루틴 retention이 확인된 뒤 판단한다.
- AI coach/chat: 규칙 기반 추천의 실패 유형이 쌓인 뒤 판단한다.
- Health Connect: 사용자가 기록 자동화를 요구하고 개인정보 운영 역량이 생긴 뒤 판단한다.

## REJECT

- 32문항 결과로 질환·통증 원인·구조적 틀어짐을 확정하는 기능
- 통증 사용자의 수행을 streak 유지 목적으로 압박하는 설계
- 동의 전 광고/분석 식별자 수집
- 근거 없이 P1으로 올린 소셜·게임화·생성 AI 기능

