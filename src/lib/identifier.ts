/**
 * 회원가입·로그인에 쓰는 식별자 판별.
 *
 * 이메일과 휴대폰 번호를 한 칸에서 받습니다. 판별은 서버(SignupIdentifier.java)와 같은 규칙입니다.
 * 규칙이 갈리면 가입은 되는데 로그인이 안 되는 상황이 생기므로, 바꿀 때는 양쪽을 같이 바꿔야 합니다.
 */

/**
 * 휴대폰 가입자의 로그인용 별칭 도메인.
 *
 * Supabase 의 전화 제공자가 꺼져 있어 번호로는 로그인이 되지 않습니다(실측: phone_provider_disabled).
 * 그래서 번호를 `01012345678@phone.mebody.net` 모양의 이메일로 바꿔 계정을 만듭니다.
 * 서버의 `mebody.auth.phone-alias-domain` 과 반드시 같아야 합니다.
 */
export const PHONE_ALIAS_DOMAIN = String(
  import.meta.env.VITE_PHONE_ALIAS_DOMAIN ?? 'phone.mebody.net',
).trim().toLowerCase()

const EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/
// 0으로 시작하는 9~11자리. 서버(SignupIdentifier.java)와 같은 규칙입니다.
// 계정을 만들 수 있는 최소한만 봅니다. 조건을 더 걸지 않는 게 지금 방침입니다.
const PHONE_PATTERN = /^0[0-9]{8,10}$/

export type IdentifierKind = 'email' | 'phone'

/** 하이픈·공백·국가번호를 걷어내고 01012345678 모양으로 만듭니다. 형식이 아니면 null. */
export function normalizePhone(raw: string): string | null {
  let digits = String(raw ?? '').replace(/[^0-9]/g, '')
  if (digits.startsWith('82')) digits = `0${digits.slice(2)}`
  return PHONE_PATTERN.test(digits) ? digits : null
}

export function isEmail(raw: string): boolean {
  return EMAIL_PATTERN.test(String(raw ?? '').trim().toLowerCase())
}

/** 휴대폰 가입자가 로그인할 때 쓰는 값. 서버가 계정을 만들 때 쓴 이메일과 같아야 합니다. */
export function phoneToLoginEmail(phone: string): string | null {
  const digits = normalizePhone(phone)
  return digits ? `${digits}@${PHONE_ALIAS_DOMAIN}` : null
}

/** 휴대폰 별칭 이메일이면 번호를 꺼냅니다. 일반 이메일이면 null. */
export function phoneFromLoginEmail(email: string | null | undefined): string | null {
  const value = String(email ?? '').trim().toLowerCase()
  if (!value) return null
  const suffix = `@${PHONE_ALIAS_DOMAIN}`
  if (!value.endsWith(suffix)) return null
  return normalizePhone(value.slice(0, -suffix.length))
}

/** 입력 한 줄을 Supabase 에 보낼 이메일로 바꿉니다. 형식이 틀리면 사유를 돌려줍니다. */
export function resolveLoginEmail(raw: string, kind: IdentifierKind): { email: string } | { error: string } {
  const value = String(raw ?? '').trim()
  if (!value) {
    return { error: kind === 'phone' ? '휴대폰 번호를 입력해주세요.' : '이메일을 입력해주세요.' }
  }

  if (kind === 'phone') {
    const email = phoneToLoginEmail(value)
    return email ? { email } : { error: '휴대폰 번호를 다시 확인해주세요.' }
  }

  const email = value.toLowerCase()
  return isEmail(email) ? { email } : { error: '이메일 형식이 올바르지 않습니다.' }
}

/** 010-1234-5678 로 보기 좋게. 화면 표시에만 씁니다. */
export function formatPhone(raw: string): string {
  const digits = normalizePhone(raw)
  if (!digits) return raw
  return digits.length === 11
    ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * 입력한 값이 이메일인지 휴대폰인지 스스로 알아봅니다.
 *
 * 무엇으로 가입할지 먼저 고르게 하지 않으려는 것입니다. 아직 판단할 수 없으면 null 을 돌려주고,
 * 화면은 지금 고른 상태를 그대로 둡니다.
 */
export function detectKind(raw: string): IdentifierKind | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  if (value.includes('@')) return 'email'

  const digits = value.replace(/[^0-9]/g, '')
  // 숫자와 구분기호로만 이루어져 있고 어느 정도 길어지면 번호로 봅니다.
  if (digits.length >= 3 && /^[0-9+\-\s().]+$/.test(value)) return 'phone'
  return null
}
