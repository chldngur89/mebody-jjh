/**
 * 밖으로 나가는 링크의 기준 주소.
 *
 * 네이티브 앱(Capacitor)에서 `window.location.origin` 은 **`https://localhost`** 입니다.
 * 그 값을 링크에 실으면 받는 쪽에서 열 수 없습니다.
 *
 * 공유 링크는 이미 이 문제를 처리하고 있었는데(lib/share.ts), **비밀번호 재설정 메일은
 * 그대로 `location.origin` 을 썼습니다.** 그래서 앱에서 재설정을 요청하면 메일 링크가
 * `https://localhost/...` 로 가서 계정을 되찾을 수 없었습니다(2026-09-27 점검 P0-4).
 *
 * 같은 규칙을 한 곳에 두고 둘 다 여기를 봅니다.
 */
const FALLBACK_ORIGIN = 'https://mebody-jjh.vercel.app'

export function publicOrigin(): string {
  const configured = String(import.meta.env.VITE_PUBLIC_SITE_URL ?? '').trim()
  if (configured) return configured.replace(/\/+$/, '')

  // http(s) 로 열려 있을 때만 현재 주소를 믿습니다. capacitor://·https://localhost 는 제외됩니다.
  if (typeof window !== 'undefined'
      && /^https?:$/.test(window.location.protocol)
      && window.location.hostname !== 'localhost'
      && window.location.hostname !== '127.0.0.1') {
    return window.location.origin.replace(/\/+$/, '')
  }
  return FALLBACK_ORIGIN
}
