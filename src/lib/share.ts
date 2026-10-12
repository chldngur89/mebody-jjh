/**
 * 결과 공유 — 코드와 캐릭터 이름만 나갑니다.
 *
 * 공유 링크에 담는 것: ref=share, code=mebody Code. 그게 전부입니다.
 * **result id 를 넣지 않습니다.** id 가 링크에 실리면 받은 사람이
 * get_questionnaire_response 로 원 사용자의 32문항 응답을 그대로 열 수 있습니다.
 * code 는 결과를 복원하는 열쇠가 아니라 "친구는 FRRS 였다" 는 말풍선 재료입니다.
 */
import { track, type ShareChannel } from './analytics'
import { PRODUCT } from '../theme/copy'
import { publicOrigin } from './publicOrigin'

export const SHARE_REF = 'share'
export const BODY_CODE_PATTERN = /^[FC][RL][RL][SF]$/

/**
 * 링크의 기준 주소. 규칙은 lib/publicOrigin.ts 한 곳에 있습니다 —
 * 재설정 메일도 같은 값을 써야 하는데 예전에는 따로 놀았습니다(점검 P0-4).
 */
export function shareBaseUrl(): string {
  return publicOrigin()
}

export function isShareableBodyCode(code: unknown): code is string {
  return typeof code === 'string' && BODY_CODE_PATTERN.test(code)
}

export function buildShareUrl(bodyCode: string): string {
  const base = shareBaseUrl()
  // 프로덕션: 코드별 **정적 공유 페이지** → 봇은 og 태그, 사람은 곧바로 앱으로.
  //
  // 예전에는 `/api/share-og?code=` 를 가리켰는데 **그 엔드포인트가 없었습니다.**
  // SPA 의 index.html 로 떨어져서 누가 무슨 코드를 공유하든 미리보기가 똑같았습니다.
  // 카카오톡·트위터 크롤러는 자바스크립트를 돌리지 않으므로 SPA 로는 해결되지 않습니다.
  // scripts/build-share-pages.mjs 가 16장을 미리 구워 둡니다.
  //
  // 로컬 Vite 에는 그 파일이 없으므로 개발 중에는 SPA 쿼리로 둡니다.
  if (!import.meta.env.DEV && isShareableBodyCode(bodyCode)) {
    return `${base}/s/${encodeURIComponent(bodyCode)}`
  }
  const url = new URL(`${base}/`)
  url.searchParams.set('ref', SHARE_REF)
  if (isShareableBodyCode(bodyCode)) url.searchParams.set('code', bodyCode)
  return url.toString()
}

export interface SharePayload {
  bodyCode: string
  characterName: string
  summaryLine?: string
  /** 예: C · L · L · F — 목 중앙, ... 링크에는 넣지 않고 공유 문구에만 씁니다. */
  tendencyLine?: string
  /** body_code_content.share_title — 있으면 조합 제목 대신 사용 */
  shareTitle?: string
  /** body_code_content.share_description */
  shareDescription?: string
  /**
   * 4축 상세 결과 — 공유 카드 이미지에 그립니다.
   * 원점수가 아니라 이미 화면에 보이는 좌/우 치우침(%)만 넘깁니다.
   */
  axes?: ShareAxis[]
}

/** 공유 카드에 그릴 축 한 줄. resultData 의 AxisRow 에서 필요한 것만 가져옵니다. */
export interface ShareAxis {
  title: string
  labelLeft: string
  labelRight: string
  /** 0~100. 클수록 왼쪽으로 치우침 */
  percentLeft: number
}

export function buildShareTitle({ bodyCode, characterName, shareTitle }: SharePayload): string {
  const fromDb = shareTitle?.trim()
  if (fromDb) return fromDb
  return `내 ${PRODUCT.codeName}는 ${bodyCode} ${characterName}`
}

export function buildShareText(payload: SharePayload): string {
  const detail =
    payload.shareDescription?.trim() ||
    payload.tendencyLine?.trim() ||
    payload.summaryLine?.trim() ||
    '32문항으로 목·어깨·골반·유연성 사용 습관을 확인했어요.'
  const lines = [
    `${buildShareTitle(payload)}.`,
    detail,
    '너는 어떤 유형인지 궁금해요.',
  ]
  return lines.filter(Boolean).join('\n')
}

export function buildShareDescription(payload: SharePayload): string {
  return (
    payload.shareDescription?.trim() ||
    payload.tendencyLine?.trim() ||
    payload.summaryLine?.trim() ||
    '32문항으로 확인한 내 몸 사용 습관. 너는 어떤 유형일까?'
  )
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed'

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/** OS 공유 시트. 사용자가 닫은 것(cancelled)은 오류가 아닙니다. */
export async function shareNative(payload: SharePayload): Promise<ShareOutcome> {
  if (!canNativeShare()) return 'unsupported'

  try {
    await navigator.share({
      title: buildShareTitle(payload),
      text: buildShareText(payload),
      url: buildShareUrl(payload.bodyCode),
    })
    return 'shared'
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return 'cancelled'
    console.warn('shareNative failed:', error)
    return 'failed'
  }
}

/** 링크 복사. clipboard 가 막힌 환경(구형 웹뷰·비 HTTPS)에서는 execCommand 로 한 번 더 시도합니다. */
export async function copyShareLink(url: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return true
    }
  } catch (error) {
    console.debug('clipboard.writeText unavailable, falling back:', error)
  }

  if (typeof document === 'undefined') return false

  try {
    const area = document.createElement('textarea')
    area.value = url
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    area.setSelectionRange(0, url.length)
    const copied = document.execCommand('copy')
    document.body.removeChild(area)
    return copied
  } catch (error) {
    console.warn('copyShareLink failed:', error)
    return false
  }
}

/** 결과 보고용 공통 기록. 성공·취소·실패를 같은 모양으로 남깁니다. */
export function trackShareOutcome(channel: ShareChannel, bodyCode: string, outcome: ShareOutcome): void {
  if (outcome === 'shared') track('result_share_succeeded', { share_channel: channel, body_code: bodyCode })
  else if (outcome === 'cancelled') track('result_share_cancelled', { share_channel: channel, body_code: bodyCode })
  else track('result_share_failed', { share_channel: channel, body_code: bodyCode, reason: outcome })
}
