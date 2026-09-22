# MEBODY Analytics Gap

> **2026-09-22 갱신 — 이 문서의 표는 낡았습니다.**
>
> 아래 표는 "전부 MISSING" 으로 적혀 있지만, 지금은 **19줄 중 16줄이 실제로 쌓입니다.**
> 남은 것은 `day_2/7/14_return`(리텐션)·`progress_check_completed`·`next_journey_started` 뿐이고,
> 리텐션은 14일 알림과 같이 가야 해서 미뤘습니다.
>
> 더 중요한 변화는 **볼 곳이 생겼다**는 점입니다. 콘솔 「지표」 탭에서 네 퍼널과
> 주간 활성 전문가를 봅니다. 이벤트를 쌓아도 볼 곳이 없으면 쌓는 의미가 없었습니다.
>
> 자세한 내용은 README 의 「운영 지표」 절을 보세요. 이 표는 당시 기록으로 남깁니다.

감사일: 2026-09-19

## 결론

현재 제품 분석은 **MISSING**이다. `src/lib/analytics.ts`의 `track()`은 개발 모드에서 `console.debug`만 실행하고 외부 수집처로 전송하지 않는다. 호출이 있는 공유 이벤트도 `UI/INTERFACE ONLY`이며 운영 전환율이나 리텐션을 계산할 수 없다. `app_error_log`는 제품 분석이 아닌 제한된 오류 관측 수단이다.

## 이벤트 상태

| 이벤트 | 호출 인터페이스 | 실제 전송 | 동의 후 전송 | 중복 통제 | 세션/유입/실험 연결 | 운영 조회 | 판정 |
|---|---:|---:|---:|---:|---:|---:|---|
| landing_viewed | 없음 | 없음 | - | - | - | 없음 | MISSING |
| questionnaire_started | 없음 | 없음 | - | - | - | 없음 | MISSING |
| questionnaire_completed | 없음 | 없음 | - | - | - | 없음 | MISSING |
| result_viewed | 없음 | 없음 | - | - | - | 없음 | MISSING |
| journey_viewed | 없음 | 없음 | - | - | - | 없음 | MISSING |
| journey_started | 없음 | 없음 | - | - | - | 없음 | MISSING |
| mission_started | 없음 | 없음 | - | - | - | 없음 | MISSING |
| mission_completed | 없음 | 없음 | - | - | - | 없음 | MISSING |
| feedback_submitted | 없음 | 없음 | - | - | - | 없음 | MISSING |
| day_2_return / day_7_return / day_14_return | 없음 | 없음 | - | - | - | 없음 | MISSING |
| weekly_report_viewed | 없음 | 없음 | - | - | - | 없음 | MISSING |
| progress_check_completed | 없음 | 없음 | - | - | - | 없음 | MISSING |
| next_journey_viewed / started | 없음 | 없음 | - | - | - | 없음 | MISSING |
| paywall_viewed | 없음 | 없음 | - | - | - | 없음 | MISSING |
| checkout_clicked | 없음 | 없음 | - | - | - | 없음 | MISSING |
| subscription_started | 없음 | 없음 | - | - | - | 없음 | MISSING |
| result_share_clicked | 있음 | 없음 | 미연결 | 호출부별 1회 의도 | body code/channel만 | 없음 | UI/INTERFACE ONLY |
| shared_link_opened | 있음 | 없음 | 미연결 | 첫 mount 의도 | ref/body code만 | 없음 | UI/INTERFACE ONLY |
| shared_questionnaire_started/completed | 있음 | 없음 | 미연결 | 흐름 호출 | ref/body code만 | 없음 | UI/INTERFACE ONLY |

## 개인정보 점검

현재 `AnalyticsProps`는 `body_code`, 공유 채널, `ref`, 분류된 실패 이유만 허용한다. user id, 이메일, result id, 문항 응답, 축 원점수는 타입에 없다. 이 설계는 유지해야 한다. 실제 SDK를 붙일 때도 원문 설문·통증 서술·이메일·전화번호를 이벤트 속성에 넣지 않는다.

쿠키 배너는 광고 동의만 localStorage에 저장하며 분석 SDK와 연결되지 않았다. 네이티브 앱에서 광고/분석 동의를 동일하게 볼 것인지, 분석을 필수 서비스 측정으로 볼 것인지 법적 문서와 함께 결정해야 한다.

## 오류 관측

`reportError()`는 문항 미디어 누락, snapshot fallback, chunk reload/preload 실패를 `app_error_log`에 기록한다. 현재 DB에는 테이블, RLS, anon INSERT, 관리자 SELECT, 분당 code 20건 제한이 적용되어 있다. 좋은 최소 장치지만 다음이 없다.

- 결과 저장, 로그인, Journey, 결제 API 오류 분류
- release/version/build 채움 보장 (`VITE_APP_VERSION`이 없으면 null)
- 오류율/영향 사용자 수 대시보드와 알림
- 클라이언트 조작·봇 삽입을 구분할 무결성 수단

## 필요한 최소 측정 설계

P0 이벤트는 `landing_viewed`, `questionnaire_started`, `questionnaire_completed`, `result_viewed`, `first_action_clicked`, `error_shown`이다. 각 이벤트 공통 속성은 익명 installation/session id, app version, platform, acquisition ref, consent state, experiment assignments로 제한한다. 한 화면 노출은 route instance당 한 번, 완료 이벤트는 결과/미션 상태 전이 시 한 번만 기록한다.

P1에서 Journey, retention, paywall, share 이벤트를 추가한다. D2/D7/D14는 클라이언트가 임의로 보내는 이벤트보다 서버/warehouse에서 활동 날짜를 계산하는 편이 안정적이다. 운영 대시보드는 최소 다음을 보여야 한다.

1. landing → start → complete → result → first action 전환율
2. 저장/문항 로드/인증 오류율과 app version
3. D1/D2/D7/D14 return cohort
4. Journey 시작 → 첫 미션 → 피드백 → 7일/14일 완주
5. 공유 click → shared open → shared start → shared complete

성공 기준은 동일 행동 중복률 1% 미만, PII/원문 응답 0건, 핵심 이벤트 누락률 2% 미만, 운영자가 배포 후 10분 안에 퍼널과 오류를 조회할 수 있는 상태다.

