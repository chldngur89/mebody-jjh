/**
 * 회원가입 검증 — 이메일·휴대폰 둘 다 "가입 즉시 로그인" 되는지 봅니다.
 *
 * 로컬 서버(기본 http://localhost:8081)에 대고 돌립니다.
 * 만든 계정과 프로필은 마지막에 전부 지웁니다.
 *
 * 사용: npm run verify:signup
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const BASE = process.env.MEBODY_SERVER_BASE ?? 'http://localhost:8081'

const app = {}
for (const l of readFileSync(new URL('../.env.local', import.meta.url).pathname, 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0) app[t.slice(0, i)] = t.slice(i + 1)
}
const SB = app.VITE_SUPABASE_URL, ANON = app.VITE_SUPABASE_ANON_KEY, SVC = app.SUPABASE_SERVICE_ROLE_KEY
const AH = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }
const SH = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }

const srv = {}
for (const l of readFileSync(new URL('../../mebody-server/.env', import.meta.url).pathname, 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0) srv[t.slice(0, i)] = t.slice(i + 1)
}
const u = new URL(srv.SUPABASE_DB_URL.replace(/^jdbc:/, ''))
const db = new pg.Client({ host: u.hostname, port: Number(u.port || 5432),
  database: u.pathname.replace(/^\//, '') || 'postgres',
  user: srv.SUPABASE_DB_USERNAME, password: srv.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false } })

const res = []
const ok = (l, p, d = '') => { res.push({ l, p }); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }

const signup = async (body) => {
  const r = await fetch(`${BASE}/api/public/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}
const login = async (email, password) => {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: AH, body: JSON.stringify({ email, password }),
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}

const stamp = Date.now()
const PW = `SignupProbe!${stamp}`
const EMAIL = `probe-${stamp}@phone.mebody.net`   // 실제 메일함이 없는 주소 — 확인 메일이 나가지 않는 경로만 씁니다
const PHONE_RAW = `010-${String(stamp).slice(-8, -4)}-${String(stamp).slice(-4)}`
const PHONE_DIGITS = PHONE_RAW.replace(/-/g, '')
const created = []

await db.connect()
try {
  console.log('\n■ 설정 확인')
  const cfg = await (await fetch(`${BASE}/api/public/auth/config`)).json()
  const c = cfg.data ?? cfg
  ok('이메일 확인 절차 꺼짐 (가입 즉시 이용)', c.emailVerificationRequired === false)
  ok('휴대폰 인증 절차 꺼짐 (가입 즉시 이용)', c.phoneVerificationRequired === false)
  ok('휴대폰은 별칭 방식', c.phoneMode === 'alias', c.phoneMode)
  ok('별칭 도메인이 앱 기본값과 같다', c.phoneAliasDomain === 'phone.mebody.net', c.phoneAliasDomain)
  ok('비밀번호 길이 제한 없음 (1자)', c.minPasswordLength === 1, `${c.minPasswordLength}자`)

  console.log('\n■ 이메일 가입 → 바로 로그인')
  let r = await signup({ identifier: EMAIL, password: PW, displayName: '이메일가입' })
  const emailData = r.body?.data ?? r.body
  if (emailData?.authUserId) created.push(emailData.authUserId)
  ok('가입 성공', r.status === 200, `status=${r.status}`)
  ok('확인 절차 없음', emailData?.verificationRequired === false)
  ok('로그인용 값이 입력한 이메일 그대로', emailData?.loginEmail === EMAIL, String(emailData?.loginEmail))
  let s = await login(EMAIL, PW)
  ok('바로 로그인된다', s.status === 200 && Boolean(s.body?.access_token), `status=${s.status} ${s.body?.error_code ?? ''}`)

  console.log('\n■ 휴대폰 가입 → 바로 로그인')
  r = await signup({ identifier: PHONE_RAW, password: PW, displayName: '휴대폰가입' })
  const phoneData = r.body?.data ?? r.body
  if (phoneData?.authUserId) created.push(phoneData.authUserId)
  ok('하이픈 넣은 번호로 가입 성공', r.status === 200, `status=${r.status} ${JSON.stringify(r.body).slice(0, 90)}`)
  ok('확인 절차 없음', phoneData?.verificationRequired === false)
  ok('별칭 이메일이 번호+도메인', phoneData?.loginEmail === `${PHONE_DIGITS}@phone.mebody.net`, String(phoneData?.loginEmail))
  s = await login(phoneData?.loginEmail, PW)
  ok('별칭으로 바로 로그인된다', s.status === 200 && Boolean(s.body?.access_token), `status=${s.status} ${s.body?.error_code ?? ''}`)
  ok('메타데이터에 실제 번호가 남는다', s.body?.user?.user_metadata?.phone_number === PHONE_DIGITS,
    String(s.body?.user?.user_metadata?.phone_number))
  ok('가입 경로가 phone 으로 기록된다', s.body?.user?.user_metadata?.signup_channel === 'phone')

  console.log('\n■ 나중에 전화 제공자를 켤 때를 대비한 값')
  const phoneRow = (await db.query('SELECT phone, phone_confirmed_at IS NOT NULL pc FROM auth.users WHERE id=$1',
    [phoneData?.authUserId])).rows[0]
  ok('auth.users.phone 에 국제표기로 저장', phoneRow?.phone === `82${PHONE_DIGITS.slice(1)}`, String(phoneRow?.phone))
  ok('번호도 확인됨 상태', phoneRow?.pc === true)

  console.log('\n■ 프로필이 만들어진다')
  const prof = (await db.query('SELECT display_name, email FROM public.user_profiles WHERE auth_user_id=$1',
    [phoneData?.authUserId])).rows[0]
  ok('user_profiles 생성', Boolean(prof), prof ? `${prof.display_name} / ${prof.email}` : '없음')

  console.log('\n■ 같은 번호로 다시 가입하면')
  r = await signup({ identifier: PHONE_DIGITS, password: 'AnotherPw!12345', displayName: '덮어쓰기시도' })
  const dup = r.body?.data ?? r.body
  ok('이미 가입됨으로 응답', r.status === 200 && dup?.alreadyRegistered === true, `status=${r.status}`)
  const profAfter = (await db.query('SELECT display_name FROM public.user_profiles WHERE auth_user_id=$1',
    [phoneData?.authUserId])).rows[0]
  ok('기존 프로필 이름이 바뀌지 않는다', profAfter?.display_name === prof?.display_name,
    `${prof?.display_name} → ${profAfter?.display_name}`)
  const wrongPw = await login(phoneData?.loginEmail, 'AnotherPw!12345')
  ok('아무 비밀번호로 로그인되지 않는다', wrongPw.status !== 200, `status=${wrongPw.status}`)

  console.log('\n■ 조건 없이 가입된다')
  const shortPwEmail = `short-${stamp}@phone.mebody.net`
  r = await signup({ identifier: shortPwEmail, password: 'a' })
  const shortPw = r.body?.data ?? r.body
  if (shortPw?.authUserId) created.push(shortPw.authUserId)
  ok('한 글자 비밀번호도 가입된다', r.status === 200, `status=${r.status} ${JSON.stringify(r.body).slice(0, 80)}`)
  s = await login(shortPwEmail, 'a')
  ok('그 계정으로 로그인도 된다', s.status === 200 && Boolean(s.body?.access_token), `status=${s.status}`)

  const noNameEmail = `noname-${stamp}@phone.mebody.net`
  r = await signup({ identifier: noNameEmail, password: 'x' })
  const noName = r.body?.data ?? r.body
  if (noName?.authUserId) created.push(noName.authUserId)
  ok('이름 없이도 가입된다', r.status === 200, `status=${r.status}`)

  console.log('\n■ 승인 대기로 남은 계정은 자동으로 풀린다')
  // 서버가 꺼졌을 때의 폴백 가입, 예전 인증 메일 가입이 만들어내는 상태를 그대로 재현합니다.
  const pendingEmail = `pending-${stamp}@phone.mebody.net`
  let cr = await fetch(`${SB}/auth/v1/admin/users`, {
    method: 'POST', headers: SH,
    body: JSON.stringify({ email: pendingEmail, password: PW, email_confirm: false }),
  })
  const pendingUser = await cr.json()
  if (pendingUser?.id) created.push(pendingUser.id)
  ok('승인 대기 계정을 만들었다', cr.status === 200 && !pendingUser.email_confirmed_at)

  s = await login(pendingEmail, PW)
  ok('그 상태로는 로그인이 막힌다', s.status !== 200 && s.body?.error_code === 'email_not_confirmed',
    `status=${s.status} ${s.body?.error_code ?? ''}`)

  r = await fetch(`${BASE}/api/public/auth/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: pendingEmail }),
  })
  const approval = (await r.json().catch(() => null))?.data
  ok('자동 승인 요청 성공', r.status === 200 && approval?.approved === true, `status=${r.status}`)

  s = await login(pendingEmail, PW)
  ok('승인 뒤 바로 로그인된다', s.status === 200 && Boolean(s.body?.access_token), `status=${s.status}`)

  r = await fetch(`${BASE}/api/public/auth/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: pendingEmail }),
  })
  const again = (await r.json().catch(() => null))?.data
  ok('이미 승인된 계정은 그대로 둔다', r.status === 200 && again?.alreadyApproved === true)

  r = await fetch(`${BASE}/api/public/auth/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: `nobody-${stamp}@phone.mebody.net` }),
  })
  const none = (await r.json().catch(() => null))?.data
  ok('없는 계정은 만들어내지 않는다', r.status === 200 && none?.found === false)

  console.log('\n■ 계정을 만들 수 없는 입력만 막는다')
  r = await signup({ identifier: '', password: PW })
  ok('빈 식별자 거절', r.status === 400, `status=${r.status}`)
  r = await signup({ identifier: '알수없는값', password: PW })
  ok('이메일도 번호도 아닌 값 거절', r.status === 400, `status=${r.status}`)
  r = await signup({ identifier: `blank-${stamp}@phone.mebody.net`, password: '' })
  ok('빈 비밀번호 거절', r.status === 400, `status=${r.status}`)
} finally {
  console.log('\n■ 정리')
  for (const id of [...new Set(created)].filter(Boolean)) {
    await db.query('DELETE FROM public.user_profiles WHERE auth_user_id=$1', [id]).catch(() => {})
    const d = await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: SH })
    console.log(`  계정 삭제 ${String(id).slice(0, 8)} → ${d.status}`)
  }
  await db.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
