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
): Promise<SignupResult> {
  const resolved = resolveLoginEmail(identifier, kind)
  if ('error' in resolved) throw new Error(resolved.error)

  if (API_BASE) {
    let response: Response | null = null
    try {
      response = await fetch(`${API_BASE}/api/public/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password, displayName: displayName ?? null }),
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
