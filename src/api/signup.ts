/**
 * 회원가입 — 서버(Spring)를 거칩니다.
 *
 * 앱에서 Supabase 로 바로 가입하지 않는 이유는 하나입니다. 프로젝트의 Confirm email 이 켜져 있어
 * 그렇게 가입하면 확인 메일을 열기 전까지 로그인이 막힙니다(실측: email_not_confirmed).
 * 확인된 상태로 계정을 만들려면 서비스 롤 키가 필요한데 그 키는 앱에 둘 수 없습니다.
 *
 * 서버에 못 붙으면 이메일 가입은 예전처럼 Supabase 직접 가입으로 되돌아갑니다(확인 메일 필요).
 * 휴대폰 가입은 서버 없이는 방법이 없어 그대로 알려줍니다.
 *
 * 확인 절차를 켜고 끄는 스위치는 서버 설정에 있습니다: `mebody.auth.*` (README 참고).
 */
import { supabase } from '../lib/supabase'
import { signInWithEmail } from './account'
import { resolveLoginEmail, type IdentifierKind } from '../lib/identifier'

const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export interface SignupResult {
  /** 곧바로 로그인할 때 쓸 값. 휴대폰 가입이면 별칭 이메일입니다. */
  loginEmail: string
  /** 확인 절차가 남아 있어 아직 로그인할 수 없습니다. */
  verificationRequired: boolean
  /** 사용자에게 보여줄 다음 단계 안내. */
  verificationHint?: string
  /** 이미 있는 계정이라 새로 만들지 않았습니다. */
  alreadyRegistered: boolean
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json()
    return String(body?.message ?? body?.error ?? '회원가입에 실패했습니다.')
  } catch {
    return '회원가입에 실패했습니다.'
  }
}

export async function signUpWithIdentifier(
  identifier: string,
  kind: IdentifierKind,
  password: string,
  displayName?: string,
  /** 휴대폰 가입에서만 씁니다. 적으면 이 주소가 계정 이메일이 되어 비밀번호 재설정이 가능해집니다. */
  recoveryEmail?: string,
  /** 동의한 사실을 남기기 위해 함께 보냅니다. 화면의 체크박스 상태 그대로입니다. */
  consent?: { terms?: boolean; privacy?: boolean; marketing?: boolean },
): Promise<SignupResult> {
  const resolved = resolveLoginEmail(identifier, kind)
  if ('error' in resolved) throw new Error(resolved.error)

  if (API_BASE) {
    let response: Response | null = null
    try {
      response = await fetch(`${API_BASE}/api/public/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          displayName: displayName ?? null,
          recoveryEmail: recoveryEmail?.trim() || null,
          agreedTerms: Boolean(consent?.terms),
          agreedPrivacy: Boolean(consent?.privacy),
          agreedMarketing: Boolean(consent?.marketing),
        }),
      })
    } catch {
      response = null // 서버에 못 붙음 — 아래 폴백으로 갑니다
    }

    if (response) {
      if (!response.ok) throw new Error(await readError(response))
      const body = await response.json()
      const data = body?.data ?? body
      return {
        loginEmail: String(data?.loginEmail ?? resolved.email),
        verificationRequired: Boolean(data?.verificationRequired),
        verificationHint: data?.verificationHint ?? undefined,
        alreadyRegistered: Boolean(data?.alreadyRegistered),
      }
    }
  }

  // ── 폴백: 서버가 없을 때
  if (kind === 'phone') {
    throw new Error('휴대폰 가입은 지금 처리할 수 없습니다. 이메일로 가입하거나 잠시 후 다시 시도해주세요.')
  }

  const { data, error } = await supabase.auth.signUp({
    email: resolved.email,
    password,
    options: { data: { display_name: displayName ?? '', signup_channel: 'email' } },
  })
  if (error) throw error

  return {
    loginEmail: resolved.email,
    verificationRequired: !data.session,
    verificationHint: data.session ? undefined : '확인 메일을 보냈습니다. 메일함에서 링크를 열면 로그인할 수 있어요.',
    alreadyRegistered: false,
  }
}

/** 서버가 계정을 승인 대기에서 풀어줍니다. 승인만 할 뿐 로그인은 따로 해야 합니다. */
async function requestApproval(identifier: string): Promise<boolean> {
  if (!API_BASE) return false
  try {
    const response = await fetch(`${API_BASE}/api/public/auth/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim() }),
    })
    if (!response.ok) return false
    const body = await response.json()
    const data = body?.data ?? body
    return Boolean(data?.approved)
  } catch {
    return false
  }
}

/**
 * 로그인. 승인 대기로 막히면 자동으로 풀고 한 번만 다시 시도합니다.
 *
 * 가입은 서버를 거치면 항상 승인된 상태로 만들어집니다. 그런데 서버에 못 붙었을 때의 폴백 가입과
 * 예전 인증 메일 방식으로 만들어진 계정이 남아 있습니다. 그 계정들이 로그인에서 막히지 않게 합니다.
 * 확인 절차를 다시 켜면 서버가 승인을 거절하므로 이 경로는 저절로 닫힙니다.
 */
export async function signInWithApproval(identifier: string, kind: IdentifierKind, password: string) {
  const resolved = resolveLoginEmail(identifier, kind)
  if ('error' in resolved) throw new Error(resolved.error)

  try {
    return await signInWithEmail(resolved.email, password)
  } catch (error) {
    const text = String((error as Error)?.message ?? '').toLowerCase()
    const pending = text.includes('not confirmed') || text.includes('email_not_confirmed')
    if (!pending) throw error

    const approved = await requestApproval(identifier)
    if (!approved) throw error
    return await signInWithEmail(resolved.email, password)
  }
}

/**
 * 번호로 로그인.
 *
 * 복구 이메일을 적고 가입하면 계정 이메일이 별칭이 아니어서, 번호를 별칭으로 바꾸는
 * 앱 계산만으로는 찾을 수 없습니다. 서버가 번호로 계정을 찾아 비밀번호까지 확인해 줍니다.
 * 서버에 못 붙으면 예전처럼 별칭으로 직접 로그인해 봅니다.
 */
export async function signInByPhone(identifier: string, password: string) {
  if (API_BASE) {
    let response: Response | null = null
    try {
      response = await fetch(`${API_BASE}/api/public/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      })
    } catch {
      response = null
    }

    if (response) {
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(String(body?.message ?? '휴대폰 번호 또는 비밀번호가 올바르지 않습니다.'))

      const session = body?.data ?? body
      if (session?.access_token && session?.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: String(session.access_token),
          refresh_token: String(session.refresh_token),
        })
        if (error) throw error
        return data
      }
    }
  }

  // 폴백: 별칭 이메일로 직접
  const resolved = resolveLoginEmail(identifier, 'phone')
  if ('error' in resolved) throw new Error(resolved.error)
  return signInWithEmail(resolved.email, password)
}

/**
 * 번호로 비밀번호 재설정 요청.
 *
 * 계정이 있든 없든 같은 결과를 돌려줍니다. 응답이 갈리면 번호만 넣어 가입 여부를 알 수 있습니다.
 */
export async function requestPhonePasswordReset(identifier: string): Promise<void> {
  if (!API_BASE) throw new Error('지금은 재설정 요청을 보낼 수 없습니다. 잠시 후 다시 시도해주세요.')
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
  try {
    await fetch(`${API_BASE}/api/public/auth/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim(), redirectTo: redirectTo ?? null }),
    })
  } catch {
    throw new Error('서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.')
  }
}
