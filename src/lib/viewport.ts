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

function applyViewportCssVars() {
  const root = document.documentElement
  const vv = window.visualViewport
  const height = readVisibleHeight()
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
  // Kakao restores pages from bfcache with a stale viewport size.
  window.addEventListener('pageshow', schedule)
  document.addEventListener('visibilitychange', schedule)

  return () => {
    if (frame) window.cancelAnimationFrame(frame)
    vv?.removeEventListener('resize', schedule)
    vv?.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    window.removeEventListener('orientationchange', schedule)
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
