/**
 * 결과 공유 — 코드와 캐릭터 이름만 나갑니다.
 *
 * 공유 링크에 담는 것: ref=share, code=몸BTI 코드. 그게 전부입니다.
 * **result id 를 넣지 않습니다.** id 가 링크에 실리면 받은 사람이
 * get_questionnaire_response 로 원 사용자의 32문항 응답을 그대로 열 수 있습니다.
 * code 는 결과를 복원하는 열쇠가 아니라 "친구는 FRRS 였다" 는 말풍선 재료입니다.
 */
import { track, type ShareChannel } from './analytics'

export const SHARE_REF = 'share'
export const BODY_CODE_PATTERN = /^[FC][RL][RL][SF]$/

const FALLBACK_ORIGIN = 'https://mebody-jjh.vercel.app'

/**
 * 링크의 기준 주소.
 *
 * 네이티브 앱(Capacitor)에서는 origin 이 localhost/capacitor 라서 그대로 쓰면
 * 받은 사람이 열 수 없는 링크가 됩니다. 그래서 http(s) 일 때만 현재 origin 을 씁니다.
 */
export function shareBaseUrl(): string {
  const configured = String(import.meta.env.VITE_PUBLIC_SITE_URL ?? '').trim()
  if (configured) return configured.replace(/\/+$/, '')

  if (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)) {
    return window.location.origin.replace(/\/+$/, '')
  }
  return FALLBACK_ORIGIN
}

export function isShareableBodyCode(code: unknown): code is string {
  return typeof code === 'string' && BODY_CODE_PATTERN.test(code)
}

export function buildShareUrl(bodyCode: string): string {
  const url = new URL(`${shareBaseUrl()}/`)
  url.searchParams.set('ref', SHARE_REF)
  if (isShareableBodyCode(bodyCode)) url.searchParams.set('code', bodyCode)
  return url.toString()
}

export interface SharePayload {
  bodyCode: string
  characterName: string
  summaryLine?: string
}

export function buildShareTitle({ bodyCode, characterName }: SharePayload): string {
  return `내 몸BTI는 ${bodyCode} ${characterName}`
}

export function buildShareText(payload: SharePayload): string {
  const lines = [
    `${buildShareTitle(payload)}.`,
    payload.summaryLine?.trim() || '32문항으로 목·어깨·골반·유연성 사용 습관을 확인했어요.',
    '너는 어떤 유형인지 궁금해요.',
  ]
  return lines.filter(Boolean).join('\n')
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
