/**
 * KakaoTalk / Instagram / Facebook / Line in-app WebViews often mishandle
 * 100dvh/100svh and smooth scrolling. Prefer measured visualViewport height
 * and instant scroll in those environments.
 */

const INAPP_UA = /KAKAOTALK|FBAN|FBAV|Instagram|Line\//i

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return INAPP_UA.test(navigator.userAgent)
}

export function isKakaoInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /KAKAOTALK/i.test(navigator.userAgent)
}

export function preferredScrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto'
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'auto'
  if (isInAppBrowser()) return 'auto'
  return 'smooth'
}

function readVisibleHeight(): number {
  const vv = window.visualViewport
  // Prefer the actually visible height. On Kakao, innerHeight can include
  // chrome that is not usable, while visualViewport.height tracks toolbar/keyboard.
  const candidates = [vv?.height, window.innerHeight, document.documentElement.clientHeight].filter(
    (value): value is number => typeof value === 'number' && value > 0,
  )
  return Math.round(Math.min(...candidates))
}

/**
 * 네이티브 배너가 차지한 높이. src/lib/ads.ts 가 채웁니다(웹에서는 늘 0).
 *
 * 배너는 웹뷰 **위에 덮이는 네이티브 뷰**입니다. 그래서 앱 표면이 화면 전체 높이를 쓰면
 * 스크롤 중에 내용이 배너 뒤·아래로 그대로 그려집니다. padding 으로는 못 막습니다 —
 * padding 은 문서 **끝**에서만 보이기 때문입니다(실제로 그 상태였습니다).
 * 앱이 쓸 수 있는 높이 자체를 그만큼 줄여야 합니다.
 */
function adInsetPx(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--mebody-ad-inset')
    .trim()
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function applyViewportCssVars() {
  const root = document.documentElement
  const vv = window.visualViewport
  const height = readVisibleHeight() - adInsetPx()
  if (height > 0) {
    root.style.setProperty('--mebody-app-height', `${height}px`)
  }
  // When the soft keyboard opens, Kakao shifts the visual viewport.
  // Pinning #root to offsetTop keeps the UI inside the visible area.
  root.style.setProperty('--mebody-vv-top', `${Math.round(vv?.offsetTop ?? 0)}px`)
}

/**
 * Keep --mebody-app-height / --mebody-vv-top in sync with the real visible viewport.
 * Also marks html with .is-inapp / .is-kakao for CSS hooks.
 */
export function installAppViewportHeight(): () => void {
  const root = document.documentElement
  if (isInAppBrowser()) root.classList.add('is-inapp')
  if (isKakaoInAppBrowser()) root.classList.add('is-kakao')

  let frame = 0
  const schedule = () => {
    if (frame) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      applyViewportCssVars()
    })
  }

  applyViewportCssVars()

  const vv = window.visualViewport
  vv?.addEventListener('resize', schedule)
  vv?.addEventListener('scroll', schedule)
  window.addEventListener('resize', schedule)
  window.addEventListener('orientationchange', schedule)
  // 배너가 뜨거나 크기가 바뀌면 앱 높이를 다시 잡아야 합니다(ads.ts 가 이 이벤트를 쏩니다).
  window.addEventListener('mebody:ad-inset', schedule)
  // Kakao restores pages from bfcache with a stale viewport size.
  window.addEventListener('pageshow', schedule)
  document.addEventListener('visibilitychange', schedule)

  return () => {
    if (frame) window.cancelAnimationFrame(frame)
    vv?.removeEventListener('resize', schedule)
    vv?.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    window.removeEventListener('orientationchange', schedule)
    window.removeEventListener('mebody:ad-inset', schedule)
    window.removeEventListener('pageshow', schedule)
    document.removeEventListener('visibilitychange', schedule)
  }
}

/**
 * Kakao keyboard often covers the focused field. After focus, scroll the nearest
 * overflow parent so the control sits in the upper half of the visible area.
 */
export function installInAppFocusAssist(): () => void {
  if (typeof window === 'undefined' || !isInAppBrowser()) return () => undefined

  const onFocusIn = (event: FocusEvent) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (!target.matches('input, textarea, select')) return

    window.setTimeout(() => {
      applyViewportCssVars()
      const rect = target.getBoundingClientRect()
      const visibleBottom = (window.visualViewport?.height ?? window.innerHeight) * 0.55
      if (rect.bottom <= visibleBottom) return

      let node: HTMLElement | null = target.parentElement
      while (node) {
        const { overflowY } = window.getComputedStyle(node)
        if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
          node.scrollTo({
            top: node.scrollTop + (rect.bottom - visibleBottom) + 24,
            behavior: 'auto',
          })
          break
        }
        node = node.parentElement
      }
    }, 280)
  }

  document.addEventListener('focusin', onFocusIn)
  return () => document.removeEventListener('focusin', onFocusIn)
}
