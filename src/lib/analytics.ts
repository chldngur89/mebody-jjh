/**
 * 이벤트 기록 — 인터페이스만 있습니다.
 *
 * 외부 SDK 를 붙이지 않았습니다. 지금 붙일 곳이 정해지지 않았고, 광고·분석 SDK 는
 * 동의 배너(CookieConsent)와 묶여야 해서 따로 결정할 일입니다.
 * 그때 track() 안쪽만 바꾸면 호출부는 그대로 둘 수 있습니다.
 *
 * ★ payload 규칙: 개인을 식별할 수 있는 값은 넣지 않습니다.
 *   user id · email · result id · 문항 응답 · 축 원점수 전부 금지입니다.
 *   타입으로 막아두었으니 필드를 늘릴 때도 이 원칙을 지켜야 합니다.
 */
export type AnalyticsEvent =
  | 'result_share_opened'
  | 'result_share_clicked'
  | 'result_share_succeeded'
  | 'result_share_cancelled'
  | 'result_share_failed'
  | 'shared_link_opened'
  | 'shared_questionnaire_started'
  | 'shared_questionnaire_completed'

export type ShareChannel = 'kakao' | 'native' | 'copy'

export interface AnalyticsProps {
  /** 몸BTI 코드(FRRS 등). 이미 공유 링크에 들어가는 공개 값입니다. */
  body_code?: string
  share_channel?: ShareChannel
  /** 유입 표시(share 등) */
  ref?: string
  /** 실패 사유 분류. 원문 오류 메시지가 아니라 짧은 라벨입니다. */
  reason?: string
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (import.meta.env.DEV) {
    console.debug('[analytics]', event, props)
  }
  // TODO 분석 도구를 정하면 여기서만 보내면 됩니다(동의 배너 수락 이후에만).
}
