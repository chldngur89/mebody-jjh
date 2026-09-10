/**
 * 카카오톡 공유 — JavaScript 키가 있을 때만 동작합니다.
 *
 * 키는 VITE_KAKAO_JAVASCRIPT_KEY 로만 받습니다. 코드에 적지 않습니다.
 * 키가 없으면 SDK 를 아예 내려받지 않고 카카오 버튼도 숨깁니다.
 * 나머지 공유(OS 공유·링크 복사)는 키와 무관하게 그대로 동작합니다.
 *
 * 사람이 해야 하는 준비:
 *   Kakao Developers → 앱 생성 → JavaScript 키 → 플랫폼 Web 에 도메인 등록
 *   → 카카오톡 공유 활성화. 등록하지 않은 도메인에서는 전송이 거부됩니다.
 */
import { buildShareTitle, buildShareUrl, buildShareDescription, shareBaseUrl, type SharePayload, type ShareOutcome } from './share'
import { PRODUCT } from '../theme/copy'

const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'
const SDK_ELEMENT_ID = 'kakao-js-sdk'

interface KakaoLink { mobileWebUrl: string; webUrl: string }
interface KakaoSdk {
  init: (key: string) => void
  isInitialized: () => boolean
  Share?: { sendDefault: (settings: Record<string, unknown>) => void }
}

declare global {
  interface Window { Kakao?: KakaoSdk }
}

function kakaoKey(): string {
  return String(import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY ?? '').trim()
}

/** 카카오 버튼을 그릴지 판단합니다. 키가 없으면 false 입니다. */
export function isKakaoShareConfigured(): boolean {
  return kakaoKey().length > 0
}

let loading: Promise<KakaoSdk | null> | null = null

function loadSdk(): Promise<KakaoSdk | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve(null)
  if (window.Kakao?.Share) return Promise.resolve(window.Kakao)
  if (loading) return loading

  loading = new Promise<KakaoSdk | null>((resolve) => {
    const existing = document.getElementById(SDK_ELEMENT_ID) as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')

    const done = () => resolve(window.Kakao ?? null)
    const failed = () => {
      console.warn('Kakao SDK 를 불러오지 못했습니다.')
      resolve(null)
    }

    script.addEventListener('load', done, { once: true })
    script.addEventListener('error', failed, { once: true })

    if (!existing) {
      script.id = SDK_ELEMENT_ID
      script.src = SDK_URL
      script.async = true
      // TODO Kakao 문서의 integrity 값을 함께 넣으면 더 안전합니다(버전과 짝을 맞춰야 합니다).
      script.crossOrigin = 'anonymous'
      document.head.appendChild(script)
    }
  }).finally(() => {
    loading = null
  })

  return loading
}

async function ready(): Promise<KakaoSdk | null> {
  const key = kakaoKey()
  if (!key) return null

  const sdk = await loadSdk()
  if (!sdk?.Share) return null

  try {
    if (!sdk.isInitialized()) sdk.init(key)
  } catch (error) {
    console.warn('Kakao.init 실패:', error)
    return null
  }
  return sdk
}

/** 키가 있으면 미리 받아 둡니다. 버튼을 눌렀을 때 기다리지 않게 하려는 것뿐입니다. */
export function preloadKakao(): void {
  if (!isKakaoShareConfigured()) return
  void loadSdk()
}

export async function shareToKakao(payload: SharePayload): Promise<ShareOutcome> {
  const sdk = await ready()
  if (!sdk?.Share) return 'unsupported'

  const url = buildShareUrl(payload.bodyCode)
  const link: KakaoLink = { mobileWebUrl: url, webUrl: url }

  try {
    sdk.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: buildShareTitle(payload),
        description: buildShareDescription(payload),
        // 캐릭터 PNG 는 세로 비율이라 피드에서 잘립니다. 가로 카드(1200×630)를 씁니다.
        // TODO 코드별 가로 카드 이미지가 생기면 여기만 바꾸면 됩니다.
        imageUrl: `${shareBaseUrl()}/og-image.png`,
        link,
      },
      buttons: [{ title: `나도 ${PRODUCT.codeGuide} 해보기`, link }],
    })
    return 'shared'
  } catch (error) {
    console.warn('shareToKakao failed:', error)
    return 'failed'
  }
}
