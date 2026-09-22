/**
 * 이벤트 기록 — 인터페이스만 있습니다.
 *
 * 외부 SDK 를 붙이지 않았습니다. Supabase 의 analytics_events 테이블에 바로 남깁니다
 * (db/journey/054). Spring 서버를 거치지 않으므로 서버가 없어도 앱이 그대로 동작하고,
 * 수집 실패가 화면을 막지 않습니다.
 *
 * 나중에 외부 도구를 붙이더라도 track() 안쪽만 바꾸면 호출부는 그대로 둡니다.
 *
 * ★ payload 규칙: 개인을 식별할 수 있는 값은 넣지 않습니다.
 *   user id · email · result id · 문항 응답 · 축 원점수 전부 금지입니다.
 *   타입으로 막아두었으니 필드를 늘릴 때도 이 원칙을 지켜야 합니다.
 *   테이블에도 user_id 컬럼이 없습니다. 있으면 개인정보가 되어 탈퇴할 때 지울 곳이 늘어납니다.
 */
import { supabase } from './supabase'

export type AnalyticsEvent =
  | 'result_share_opened'
  | 'result_share_clicked'
  | 'result_share_succeeded'
  | 'result_share_cancelled'
  | 'result_share_failed'
  | 'shared_link_opened'
  | 'shared_questionnaire_started'
  | 'shared_questionnaire_completed'
  // 진단 퍼널
  | 'landing_viewed'
  | 'questionnaire_started'
  | 'questionnaire_completed'
  | 'result_viewed'
  // 관리 루틴
  | 'journey_started'
  | 'mission_completed'
  // 저니 퍼널 — "결과를 봤다" 에서 "실제로 했다" 까지
  //
  // 여기가 비어 있으면 이탈 지점을 알 수 없습니다. 지금까지는 진단 퍼널만 있어서
  // "결과까지는 오는데 그 뒤에 뭘 하는가" 를 답할 수 없었습니다.
  | 'journey_viewed'
  | 'mission_started'
  | 'feedback_submitted'
  | 'weekly_report_viewed'
  | 'progress_check_completed'
  | 'next_journey_viewed'
  // 수익 퍼널 — 결제를 열기 전에 쌓아 둬야 "왜 아무도 안 사는지" 를 알 수 있습니다.
  | 'paywall_viewed'
  | 'checkout_clicked'
  | 'subscription_started'
  // 전문가 초대 (Phase 1)
  //
  // 이 넷이 Phase 1 의 가설을 재는 전부입니다.
  //   invite_sent / invite_opened      — 링크가 실제로 전달되는가
  //   invite_opened / invite_accepted  — 고객이 결과를 보여줄 마음이 있는가
  //   professional_result_viewed / invite_sent — 트레이너가 상담에서 실제로 여는가(주지표)
  // 이 값이 초대의 30% 미만이면 Phase 2 이후를 멈춥니다(로드맵의 FAILURE CONDITION).
  | 'invite_sent'
  | 'invite_opened'
  | 'invite_accepted'
  | 'professional_result_viewed'

export type ShareChannel = 'kakao' | 'native' | 'copy' | 'image'

export interface AnalyticsProps {
  /** mebody Code(FRRS 등). 이미 공유 링크에 들어가는 공개 값입니다. */
  body_code?: string
  share_channel?: ShareChannel
  /** 유입 표시(share 등) */
  ref?: string
  /** 14일 루틴의 며칠차인가. 어디서 멈추는지 보려면 날짜가 있어야 합니다. */
  day_no?: number
  /** 멤버십 플랜 코드. 어느 상품에서 이탈하는지 봅니다. */
  plan_code?: string
  /** 피드백의 느낌(BETTER·SAME·UNCOMFORTABLE) */
  feeling?: string
  /** 실패 사유 분류. 원문 오류 메시지가 아니라 짧은 라벨입니다. */
  reason?: string
}

/**
 * 한 번의 방문을 잇는 임시 값. 사람을 식별하지 않습니다.
 * 탭을 닫으면 사라지고, 다음 방문에는 새로 생깁니다.
 */
function sessionId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      window.sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return null  // 저장이 막힌 환경에서는 세션을 잇지 않고 이벤트만 남깁니다
  }
}

const SESSION_KEY = 'mebody:analytics-session'

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (import.meta.env.DEV) {
    console.debug('[analytics]', event, props)
  }

  // 수집이 화면을 막으면 안 됩니다. 실패해도 조용히 지나갑니다.
  try {
    void supabase
      .from('analytics_events')
      .insert({
        event,
        props,
        session_id: sessionId(),
        // 쿼리스트링은 넣지 않습니다. 결과 id 가 들어갑니다.
        path: typeof window === 'undefined' ? null : window.location.pathname,
        app_version: import.meta.env.VITE_APP_VERSION ?? null,
      })
      .then(({ error }) => {
        if (error && import.meta.env.DEV) console.debug('[analytics] insert failed:', error.message)
      })
  } catch {
    /* 수집 실패는 삼킵니다 */
  }
}
