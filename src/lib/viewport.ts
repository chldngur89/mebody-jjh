/**
 * KakaoTalk / Instagram / Facebook in-app WebViews often mishandle
 * 100dvh/100svh and smooth scrolling. Prefer measured visualViewport height
 * and instant scroll in those environments.
 */

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /KAKAOTALK|FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent)
}

export function preferredScrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto'
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'auto'
  if (isInAppBrowser()) return 'auto'
  return 'smooth'
}

/** Keep --mebody-app-height in sync with the real visible viewport (Kakao-safe). */
export function installAppViewportHeight(): () => void {
  const root = document.documentElement

  const apply = () => {
    const height = Math.round(window.visualViewport?.height ?? window.innerHeight)
    if (height > 0) {
      root.style.setProperty('--mebody-app-height', `${height}px`)
    }
  }

  apply()
  const vv = window.visualViewport
  vv?.addEventListener('resize', apply)
  vv?.addEventListener('scroll', apply)
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)

  return () => {
    vv?.removeEventListener('resize', apply)
    vv?.removeEventListener('scroll', apply)
    window.removeEventListener('resize', apply)
    window.removeEventListener('orientationchange', apply)
  }
}
