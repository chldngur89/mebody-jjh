/**
 * Supabase 가 돌려주는 영어 오류를 화면에 쓸 문장으로 바꿉니다.
 *
 * 왜 한 곳에 모으나 — 이전에는 세 곳에서 각자
 *   `(err as Error)?.message ?? '한국어 문구'`
 *   `error.message || '한국어 문구'`
 * 식으로 처리했는데, Error 에는 message 가 **항상** 있으므로 한국어 대비책은
 * 한 번도 실행되지 않고 영어 원문이 그대로 사용자에게 갔습니다.
 * 이제 원문은 콘솔에만 남기고 화면에는 우리 문장만 나갑니다.
 *
 * writing.md › 오류는 무엇이 잘못됐고 어떻게 고치는지를 인터페이스의 목소리로 말한다.
 */

/** 로그인 식별자 종류 — 문구에서 "이메일"/"휴대폰 번호"를 갈라 씁니다. */
export type IdentifierLabel = '이메일' | '휴대폰 번호'

function rawText(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  const message = (err as { message?: unknown } | null)?.message
  return typeof message === 'string' ? message : ''
}

/**
 * @param err      잡은 오류 (Error · Supabase 오류 객체 · 문자열)
 * @param fallback 아는 패턴이 없을 때 보여줄 우리 문장. **영어 원문은 절대 쓰지 않습니다.**
 * @param label    "이메일" 또는 "휴대폰 번호" — 자격증명 관련 문구에 끼웁니다.
 */
export function authErrorMessage(err: unknown, fallback: string, label: IdentifierLabel = '이메일'): string {
  const raw = rawText(err)
  const text = raw.toLowerCase()

  if (raw) console.warn('[auth] 원문 오류:', raw)

  if (text.includes('invalid login credentials')) return `${label} 또는 비밀번호가 올바르지 않습니다.`
  if (text.includes('email not confirmed')) return '가입 확인이 아직 끝나지 않았습니다. 확인 메일의 링크를 열어주세요.'
  if (text.includes('already registered') || text.includes('already been registered')) {
    return '이미 가입된 계정입니다. 로그인으로 진행해주세요.'
  }
  if (text.includes('should be different from the old password')) {
    return '지금 쓰고 있는 비밀번호와 다른 비밀번호로 입력해주세요.'
  }
  if (text.includes('same_password')) return '지금 쓰고 있는 비밀번호와 다른 비밀번호로 입력해주세요.'
  if (text.includes('rate limit') || text.includes('too many requests')) {
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.'
  }
  // "For security purposes, you can only request this after 46 seconds."
  const wait = raw.match(/after (\d+) seconds?/i)
  if (wait) return `보안을 위해 ${wait[1]}초 뒤에 다시 시도할 수 있습니다.`
  // 길이 제한은 서버 설정이 정합니다 — Supabase 가 자기 정책으로 거절하면 그 길이를 문구에 넣습니다.
  const tooShort = raw.match(/at least (\d+) characters/i)
  if (tooShort) return `비밀번호는 ${tooShort[1]}자 이상으로 입력해주세요.`
  if (text.includes('failed to fetch') || text.includes('network')) {
    return '네트워크에 연결하지 못했습니다. 연결을 확인하고 다시 시도해주세요.'
  }
  if (text.includes('invalid email')) return '이메일 형식이 올바르지 않습니다.'

  return fallback
}
