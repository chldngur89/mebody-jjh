/**
 * 개발자용 에러 기록 — Supabase `app_error_log` 테이블에 남깁니다.
 *
 * 쓰기는 누구나(익명 방문자도 오류를 만나므로), 읽기는 **관리자만** 입니다.
 * 정책은 db/v1/050_app_error_log.sql 에 있습니다.
 *
 * ★ payload 규칙 — analytics.ts 와 같습니다.
 *   개인을 식별할 수 있는 값은 넣지 않습니다: user id · email · 결과 id ·
 *   문항 응답 · 축 원점수. 넣을 값은 "무엇이 왜 실패했는지" 뿐입니다.
 */
import { supabase } from './supabase'

export type ErrorCode =
  /** DB 는 응답했지만 questions.media_url 이 빈 행이 있었습니다 */
  | 'questions.media_url_missing'
  /** 문항 조회가 실패해 번들 스냅샷으로 폴백했습니다(사진 없음) */
  | 'questions.snapshot_fallback'
  /** 문항 사진이 제때 뜨지 않아 사용을 막았습니다 */
  | 'questions.media_load_timeout'
  /** 청크 로드 실패로 리로드했지만 상한에 걸려 더 시도하지 않음 */
  | 'chunk.reload_limit'
  /** 청크 미리가져오기 실패 — 새로고침하지 않고 기록만 합니다 */
  | 'chunk.preload_failed'

/** 같은 오류를 한 방문에서 반복해 쌓지 않습니다. */
const sent = new Set<string>()

export function reportError(code: ErrorCode, detail: Record<string, string | number> = {}): void {
  const key = `${code}:${JSON.stringify(detail)}`
  if (sent.has(key)) return
  sent.add(key)

  if (import.meta.env.DEV) console.error('[reportError]', code, detail)

  const row = {
    code,
    detail,
    // 어떤 화면·기기에서 났는지만. 쿼리스트링은 결과 id 가 들어가므로 뺍니다.
    path: typeof window === 'undefined' ? null : window.location.pathname,
    user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent.slice(0, 300),
    app_version: import.meta.env.VITE_APP_VERSION ?? null,
  }

  // 기록 실패가 화면을 막으면 안 됩니다 — 조용히 삼킵니다.
  void supabase
    .from('app_error_log')
    .insert(row)
    .then(({ error }) => {
      if (error) console.warn('reportError insert failed:', error.message)
    })
}
