/**
 * 서버의 회원가입 설정을 읽습니다.
 *
 * 왜 필요한가: 2026-09-22 감사에서 **화면 문구와 실제 설정이 반대**였습니다.
 * 홈페이지는 "확인 메일이 갑니다" 라고 하는데 서버는 확인이 꺼져 있었고,
 * "휴대폰 번호로 가입하면 바로 이용" 이라고 하는데 입력칸이 없었습니다.
 * 원인은 하나입니다 — 문구가 코드에 박혀 있고 설정을 아무도 읽지 않았습니다.
 *
 * 그래서 화면이 조건을 말할 때는 이 값을 씁니다. 서버 설정을 바꾸면 문구도 따라 바뀝니다.
 *
 * 서버에 못 붙을 수도 있습니다(오프라인·배포 주소 오류). 그때는 **더 보수적인 쪽**으로
 * 기본값을 둡니다 — 비밀번호 8자, 복구 이메일 필수. 화면이 실제보다 느슨하게 안내해서
 * 사용자가 거부당하는 것보다, 엄격하게 안내하는 편이 낫습니다.
 */
const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export interface AuthConfig {
  emailVerificationRequired: boolean
  phoneVerificationRequired: boolean
  phoneMode: 'alias' | 'native'
  phoneAliasDomain: string
  minPasswordLength: number
  phoneSignupEnabled: boolean
  phoneRecoveryEmailRequired: boolean
}

/** 서버에 못 붙었을 때. 서버 기본값과 같은 쪽으로 맞춰 둡니다. */
export const FALLBACK_AUTH_CONFIG: AuthConfig = {
  emailVerificationRequired: true,
  phoneVerificationRequired: false,
  phoneMode: 'alias',
  phoneAliasDomain: String(import.meta.env.VITE_PHONE_ALIAS_DOMAIN ?? 'phone.mebody.net'),
  minPasswordLength: 8,
  phoneSignupEnabled: true,
  phoneRecoveryEmailRequired: true,
}

// 화면이 여러 번 그려져도 한 번만 물어봅니다.
let cached: Promise<AuthConfig> | null = null

export function fetchAuthConfig(): Promise<AuthConfig> {
  if (cached) return cached
  cached = (async () => {
    if (!API_BASE) return FALLBACK_AUTH_CONFIG
    try {
      const r = await fetch(`${API_BASE}/api/public/auth/config`, {
        signal: AbortSignal.timeout(8_000),
      })
      if (!r.ok) return FALLBACK_AUTH_CONFIG
      const body = await r.json()
      const d = body?.data
      if (!d || typeof d.minPasswordLength !== 'number') return FALLBACK_AUTH_CONFIG
      return {
        emailVerificationRequired: Boolean(d.emailVerificationRequired),
        phoneVerificationRequired: Boolean(d.phoneVerificationRequired),
        phoneMode: d.phoneMode === 'native' ? 'native' : 'alias',
        phoneAliasDomain: String(d.phoneAliasDomain || FALLBACK_AUTH_CONFIG.phoneAliasDomain),
        minPasswordLength: Math.max(1, Number(d.minPasswordLength)),
        // 옛 서버는 이 두 값을 안 줍니다. 없으면 보수적인 기본값을 씁니다.
        phoneSignupEnabled: d.phoneSignupEnabled === undefined ? true : Boolean(d.phoneSignupEnabled),
        phoneRecoveryEmailRequired:
          d.phoneRecoveryEmailRequired === undefined ? true : Boolean(d.phoneRecoveryEmailRequired),
      }
    } catch {
      return FALLBACK_AUTH_CONFIG
    }
  })()
  return cached
}

/** 테스트에서만 씁니다. */
export function resetAuthConfigCache(): void {
  cached = null
}
