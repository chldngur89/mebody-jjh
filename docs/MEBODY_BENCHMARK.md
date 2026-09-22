# MEBODY External Benchmark

조사일: 2026-09-19  
원칙: 공식 제품, 공식 도움말, Google Play, 공식 개인정보/약관을 우선했다. 평점·리뷰 수는 조사일에 변할 수 있다. 아래 적용 판단은 외부 서비스의 사실을 MEBODY 현재 퍼널에 연결한 감사자의 해석이다.

## 비교 요약

| 군 | 제품 | 확인된 구조 | MEBODY에 주는 기준 | 판단 |
|---|---|---|---|---|
| 자세·스트레칭·모빌리티 | Bend | 짧은 일일 루틴, 그림·timer·주의점, streak/analytics/reminder, custom routine | 첫 행동을 짧고 명확하게 하고 수행 중 주의점을 동작에 붙임 | ADOPT |
| 개인화 피트니스 | Freeletics | onboarding에서 목표·요일·장비·선호를 받고 세션 후 성과/feedback으로 계획 조정 | 입력이 추천 변화로 이어졌음을 사용자에게 설명 | ADOPT |
| 국내 개인화 피트니스 | 플랜핏 | 체중·수준·장비 기반 추천, 기록/그래프, 기록을 다시 추천에 사용, 선택 권한 고지 | 추천 근거·기록→다음 추천의 연결과 권한별 설명 | ADOPT |
| 유형 테스트·결과 공유 | 16Personalities | test→type/detail→관련 후속 콘텐츠와 premium products | 결과를 단일 코드에서 끝내지 않고 이해·행동·후속 가치로 연결 | ADOPT |

## 1. Bend

공식 Google Play 설명은 빠른 일일 stretching routine, custom routine, illustration/timer, 동작별 상세 지침과 주의점, streak·analytics·reminder를 명시한다. 조사 시점 표시는 4.7점, 리뷰 약 16.5만, 500만+ 다운로드이며 2026-09-09 업데이트다. 데이터 안전 섹션은 개인정보·금융정보 등을 수집할 수 있고 삭제 요청이 가능하다고 표시한다.

- ADOPT: MEBODY의 첫 결과 직후 3~5분 행동, 동작 카드별 중단 조건, 간단한 주간 진행.
- EXPERIMENT: streak는 압박감과 안전 guardrail을 포함해 D7 개선 여부를 시험.
- LATER: custom routine은 기본 14일 루틴의 retention이 확인된 뒤.
- REJECT: Google Play 설명의 “통증 예방/완화” 같은 강한 효능 표현을 MEBODY 설문 결과에 그대로 적용.

사용자 리뷰에는 짧고 따라하기 쉽다는 장점과 구독 가격/무료 범위, 그림만으로 동작을 이해하기 어렵다는 불만이 함께 보인다. MEBODY는 유료 경계를 앞세우기 전에 실제 영상/설명 이해도와 무료 첫 가치를 검증해야 한다.

출처: [Bend Google Play](https://play.google.com/store/apps/details?id=com.bowerydigital.bend)

## 2. Freeletics

공식 도움말에 따르면 가입 후 onboarding 질문을 받고, Coach 구독 사용자는 목표·운동 방식·요일·장비·running 선호를 입력한다. Coach는 각 세션의 성과와 feedback을 기반으로 계획을 조정한다. 무료 버전은 제한된 warm-up, cool-down, workout, exercise, run을 제공한다. 별도 공식 문서는 시간·장비·공간·소음·부위·난이도에 따라 당일 세션을 바꾸는 기능과 통증/부상 가능 시 의사 확인을 안내한다.

- ADOPT: feedback을 받는 데 그치지 말고 다음 날 “강도/시간/대체 동작이 이렇게 바뀜”을 표시.
- ADOPT: 오늘 가능한 시간과 장비 없음 같은 상황 입력을 추천에 반영. MEBODY 코드에는 시간 반영 규칙이 이미 있어 노출만 보강하면 된다.
- EXPERIMENT: 무료 콘텐츠와 개인화 Coach 경계를 MEBODY 첫 Journey 무료 정책과 비교 실험.
- REJECT: 통증을 단순 난이도 조절로 처리. 통증은 운동 대체보다 안전 중단/전문가 안내로 분리.

출처: [Freeletics 시작 도움말](https://help.freeletics.com/hc/en-us/articles/115004675229-Get-started-with-Freeletics-Training), [세션 조정 도움말](https://help.freeletics.com/hc/en-us/articles/360003933780-Adapt-your-Bodyweight-training-session)

## 3. 플랜핏

Google Play 공식 설명은 체중·수준·체성분·헬스장 장비를 추천에 사용하고, 운동 기록·calendar·graph를 제공하며 기록 데이터를 다시 추천에 반영한다고 말한다. 선택 권한별 목적과 거부 시 제한 범위를 설명하고 데이터 삭제 요청 가능 표시가 있다. 조사 시점 표시는 4.6점, 리뷰 약 2.65만, 100만+ 다운로드, 2026-09-15 업데이트다.

최근 노출 리뷰에는 운동량 계산 정확성, 기록 화면 keyboard/bottom sheet 뒤로가기, 사진 선택 후 다음 버튼 비활성 문제가 반복된다. 이는 추천 품질만큼 기록 정확성과 상태 복구, Android 입력/뒤로가기가 retention에 중요하다는 근거다.

- ADOPT: “이 입력이 어느 추천에 사용됐는지”와 feedback 반영 결과 표시.
- ADOPT: 권한은 필요 시점에만 요청하고 거부해도 제한되는 기능만 설명.
- ADOPT: Android keyboard/bottom sheet/system back matrix를 release gate로 운영.
- EXPERIMENT: calendar/graph는 14일 completion과 D7 baseline 확보 후 최소 주간 보기부터 시험.
- LATER: 커뮤니티와 custom routines.

출처: [플랜핏 Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.mih.planfit), [플랜핏 개인정보처리방침](https://planfit.ai/privacy), [플랜핏 이용약관](https://planfit.ai/terms-and-conditions)

## 4. 16Personalities

공식 사이트는 personality test, personality types, framework, 관련 articles, premium career/team products를 한 구조로 연결한다. MEBODY가 참고할 핵심은 유형 이름 자체보다 결과를 이해하는 상세 콘텐츠와 다음 가치로 이어지는 정보 구조다.

- ADOPT: 결과 상단에 “왜 이 code가 나왔는가”, 4축 근거, 오늘 할 행동을 순서대로 제시.
- EXPERIMENT: 공유 수신자에게 친구 code를 잠깐 보여준 뒤 자신의 test 시작 CTA를 제공.
- LATER: 직업형 premium report 같은 수직 확장은 MEBODY 사용 데이터가 쌓인 뒤.
- REJECT: 유형을 고정된 신체 정체성이나 의학적 분류처럼 표현.

출처: [16Personalities 공식 테스트](https://www.16personalities.com/en/personality-test), [공식 Framework](https://www.16personalities.com/articles/our-theory)

## MEBODY 비교표

| 기준 | MEBODY 현재 | 외부 기준과의 차이 | 조치 |
|---|---|---|---|
| onboarding 길이 | 동의+소개+32문항 | 첫 가치까지 길다 | 완료 시간을 먼저 계측, 중간 가치/진행 저장은 유지 |
| 개인화 입력 사용 | 축·우선순위·시간·feedback 실제 사용 | 좋은 편이나 변화 설명 부족 | ADOPT: 추천 이유와 변경 표시 |
| 오늘 행동 명확성 | 결과 상세·미션·루틴 선택지 다수 | 첫 행동이 분산 | EXPERIMENT: 단일 3분 CTA |
| feedback 반영 | 난이도·시간·대체에 실제 반영 | 사용자에게 보이지 않음 | ADOPT: 다음 추천 변화 표시 |
| 기록/진행 | 측정 3회, Journey report | 핵심 구조 있음 | 분석·return cohort부터 연결 |
| streak/reminder | 없음 | 반복 동기 약함 | EXPERIMENT/LATER |
| 무료/유료 경계 | 첫 Journey 무료, checkout 불완전 | 실험 이전에 결제 기반 미완성 | 결제 숨김 후 Play Billing 완성 |
| 안전 | disclaimer는 좋으나 중단 응답 없음 | 기본 안전 장치 미달 | ADOPT P0 |
| 개인정보/삭제 | placeholder, 삭제 UI 없음 | 스토어 기본 신뢰 미달 | ADOPT P0 |
| 공유 유입 | code-only URL과 카드 | privacy는 좋고 측정이 없음 | analytics 후 CTA 실험 |

## 적용 순서

1. ADOPT: 안전 중단, 법적 문서/삭제, Android back gate, 실제 analytics.
2. ADOPT: feedback이 바꾼 다음 추천과 추천 이유 표시.
3. EXPERIMENT: 결과 직후 3분 행동, reminder/streak, 무료 범위, 공유 CTA.
4. LATER: custom routine, community, Health Connect, AI coach.
5. REJECT: 의료 효능 확정, 통증 수행 압박, 유형의 고정 신체 분류.

