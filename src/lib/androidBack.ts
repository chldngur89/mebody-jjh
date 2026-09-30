/**
 * 안드로이드 하드웨어/제스처 뒤로가기.
 *
 * 왜 필요한가 (2026-09-27 Android 점검 P0-2):
 *   Capacitor 웹뷰는 시스템 Back 을 **앱 종료**로 처리합니다. 화면 안의 화살표는 동작하는데
 *   시스템 Back 을 누르면 런처로 나갔습니다. 32문항 중간에서도 그랬습니다 — 답을 고르다
 *   홈 화면으로 튕기면 앱을 잃었다고 느낍니다. 에뮬레이터에서 실제로 재현했습니다.
 *
 * 하는 일은 한 줄입니다 — **`history.back()`.**
 *
 * 뒤로가기 규칙을 새로 만들지 않습니다. 이 앱은 이미 브라우저 히스토리 위에 서 있습니다.
 *   · useFlowHistory  화면·탭·문항 번호·결과 id 를 히스토리에 쌓습니다
 *   · useOverlayBack  시트가 열릴 때 항목을 하나 더 쌓아, 뒤로가기가 시트부터 닫게 합니다
 * 그래서 `history.back()` 한 번이면 **시트 → 화면 → 탭** 순서가 저절로 지켜집니다.
 * 규칙을 두 벌 만들면 둘이 어긋나는 날이 옵니다.
 *
 * 더 갈 곳이 없으면(랜딩 루트) 앱을 종료합니다. 거기서 종료는 정상입니다.
 *
 * 웹에서는 아무것도 하지 않습니다. 브라우저가 알아서 합니다.
 */
import { Capacitor } from '@capacitor/core'

export function installAndroidBack(): () => void {
  if (typeof window === 'undefined') return () => {}
  let detach: (() => void) | null = null
  let cancelled = false

  void (async () => {
    try {
      if (!Capacitor.isNativePlatform()) return
    } catch {
      return
    }
    try {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('backButton', ({ canGoBack }) => {
        // canGoBack 은 웹뷰가 판단한 값입니다. 우리가 pushState 로 쌓은 항목도 여기에 들어갑니다.
        if (canGoBack) {
          window.history.back()
          return
        }
        void App.exitApp()
      })
      if (cancelled) { void handle.remove(); return }
      detach = () => { void handle.remove() }
    } catch (error) {
      // 플러그인이 없거나 네이티브가 아니면 조용히 넘어갑니다.
      console.warn('안드로이드 뒤로가기 연결 실패:', error)
    }
  })()

  return () => {
    cancelled = true
    detach?.()
  }
}

/**
 * 딥링크로 앱이 열렸을 때 (2026-09-27 점검 P0-4).
 *
 * `net.mebody.app://auth?...` 같은 주소로 들어오면 쿼리·해시를 그대로 웹 경로로 옮깁니다.
 * Supabase 의 재설정·확인 링크는 토큰을 해시(#access_token=...)에 싣기 때문에 그대로 넘겨야
 * 기존 세션 복구 코드가 알아봅니다.
 *
 * 허용 목록에 없는 주소는 무시합니다 — 밖에서 온 값으로 아무 데나 보내면 안 됩니다.
 */
export function installDeepLinks(): () => void {
  if (typeof window === 'undefined') return () => {}
  let detach: (() => void) | null = null
  let cancelled = false

  void (async () => {
    try {
      if (!Capacitor.isNativePlatform()) return
    } catch {
      return
    }
    try {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('appUrlOpen', ({ url }) => {
        try {
          const parsed = new URL(url)
          if (parsed.protocol !== 'net.mebody.app:') return
          // 경로는 우리가 아는 것만 씁니다. 토큰이 실린 해시는 그대로 넘깁니다.
          const next = `/${parsed.search}${parsed.hash}`
          window.history.replaceState(window.history.state, '', next)
          window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
        } catch {
          /* 이상한 주소는 무시합니다 */
        }
      })
      if (cancelled) { void handle.remove(); return }
      detach = () => { void handle.remove() }
    } catch (error) {
      console.warn('딥링크 연결 실패:', error)
    }
  })()

  return () => {
    cancelled = true
    detach?.()
  }
}
