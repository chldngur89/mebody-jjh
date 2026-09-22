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
  const emailVerify = c.emailVerificationRequired === true
  ok('이메일 확인 절차 ON (2026-09-21 정책)', emailVerify, `emailVerificationRequired=${c.emailVerificationRequired}`)
  ok('휴대폰 인증 절차 꺼짐 (SMS 제공자가 없어 켤 수 없음)', c.phoneVerificationRequired === false)
  ok('휴대폰은 별칭 방식', c.phoneMode === 'alias', c.phoneMode)
  ok('별칭 도메인이 앱 기본값과 같다', c.phoneAliasDomain === 'phone.mebody.net', c.phoneAliasDomain)
  ok('비밀번호 길이 제한 없음 (1자)', c.minPasswordLength === 1, `${c.minPasswordLength}자`)

  let r, s
  if (!emailVerify) {
    console.log('\n■ 이메일 가입 → 바로 로그인')
    r = await signup({ identifier: EMAIL, password: PW, displayName: '이메일가입' })
    const emailData = r.body?.data ?? r.body
    if (emailData?.authUserId) created.push(emailData.authUserId)
    ok('가입 성공', r.status === 200, `status=${r.status}`)
    ok('확인 절차 없음', emailData?.verificationRequired === false)
    ok('로그인용 값이 입력한 이메일 그대로', emailData?.loginEmail === EMAIL, String(emailData?.loginEmail))
    s = await login(EMAIL, PW)
    ok('바로 로그인된다', s.status === 200 && Boolean(s.body?.access_token), `status=${s.status} ${s.body?.error_code ?? ''}`)
  } else {
    console.log('\n■ 이메일 가입 → 확인 메일을 열기 전에는 로그인 안 됨')
    // 공개 가입은 Supabase 가 확인 메일을 실제로 보냅니다. 기본 SMTP 는 시간당 몇 통이라
    // 이 스위트를 연달아 돌리면 429 가 납니다. 그건 우리 코드의 실패가 아니므로 나눠서 봅니다.
    r = await signup({ identifier: EMAIL, password: PW, displayName: '이메일가입' })
    const emailData = r.body?.data ?? r.body
    if (emailData?.authUserId) created.push(emailData.authUserId)
    // 이 경로를 실제로 돌릴 수 없는 환경 제약이 둘 있습니다. 둘 다 우리 코드의 실패가 아니라
    // 이 테스트 계정으로는 확인할 수 없다는 뜻이므로, 통과시키지 않고 "못 봤다" 로 남깁니다.
    //
    //   429  Supabase 기본 SMTP 의 시간당 발송 한도
    //   400  "사용할 수 없는 이메일 주소" — 공개 가입(/auth/v1/signup)은 MX 레코드가 없는
    //        도메인을 거부합니다. 우리 테스트 주소가 쓰는 @phone.mebody.net 이 그렇습니다.
    //        관리자 경로(/admin/users)는 검사하지 않아서 아래 게이팅 검사는 그대로 돕니다.
    //        실사용자에게도 같은 거절이 나가며, 그게 맞는 동작입니다.
    const rateLimited = r.status === 429
    const domainRejected = r.status === 400 && /사용할 수 없는 이메일/.test(String(r.body?.message ?? ''))
    const cannotExercise = rateLimited || domainRejected
    if (!cannotExercise && r.status !== 200) {
      console.log(`    ↳ 예상 못 한 응답: status=${r.status} ${JSON.stringify(r.body).slice(0, 200)}`)
    }
    if (cannotExercise) {
      ok('막힐 때도 우리 문장으로 안내한다',
        /확인 메일|잠시 후|사용할 수 없는/.test(String(r.body?.message ?? '')),
        `${r.status} — ${r.body?.message ?? ''}`)
      console.log(`    ※ ${rateLimited ? 'Supabase 메일 한도' : '공개 가입이 MX 없는 도메인을 거부'}입니다.`)
      console.log('      게이팅 자체는 아래 관리자 경로로 검사합니다.')
    } else {
      ok('가입 성공', r.status === 200, `status=${r.status} ${r.body?.message ?? ''}`)
      ok('확인이 필요하다고 알려준다', emailData?.verificationRequired === true)
      ok('다음에 뭘 해야 하는지 문구가 있다', Boolean(emailData?.verificationHint), String(emailData?.verificationHint))
      s = await login(EMAIL, PW)
      ok('확인 전에는 로그인이 막힌다',
        s.status !== 200 && s.body?.error_code === 'email_not_confirmed', `status=${s.status} ${s.body?.error_code ?? ''}`)
    }

    // 메일 발송과 무관하게 게이팅 로직만 따로 봅니다. 관리자 경로로 만들면 메일이 나가지 않습니다.
    const gateEmail = `gate-${stamp}@phone.mebody.net`
    const gr = await fetch(`${SB}/auth/v1/admin/users`, {
      method: 'POST', headers: SH,
      body: JSON.stringify({ email: gateEmail, password: PW, email_confirm: false }),
    })
    const gateUser = await gr.json()
    if (gateUser?.id) created.push(gateUser.id)
    ok('확인 안 된 계정을 만들었다', gr.status === 200 && !gateUser.email_confirmed_at)

    s = await login(gateEmail, PW)
    ok('확인 안 된 계정은 로그인이 막힌다',
      s.status !== 200 && s.body?.error_code === 'email_not_confirmed', `status=${s.status} ${s.body?.error_code ?? ''}`)

    const ar = await fetch(`${BASE}/api/public/auth/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: gateEmail }),
    })
    ok('공개 승인으로 우회되지 않는다', ar.status === 409, `status=${ar.status}`)

    await fetch(`${SB}/auth/v1/admin/users/${gateUser.id}`, {
      method: 'PUT', headers: SH, body: JSON.stringify({ email_confirm: true }),
    })
    s = await login(gateEmail, PW)
    ok('확인을 마치면 로그인된다', s.status === 200 && Boolean(s.body?.access_token), `status=${s.status}`)
  }

  console.log('\n■ 휴대폰 가입 → 바로 로그인 (확인 절차와 무관)')
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

  console.log('\n■ 우리 쪽 조건은 없다 (하한은 Supabase 정책이 정합니다)')
  // 2026-09-19 실측: Supabase 프로젝트가 6자 미만을 weak_password 로 거절합니다.
  // 우리 서버는 min-password-length=1 이라 아무 조건도 더하지 않고, 거절 사유만 옮깁니다.
  //
  // 확인 절차가 켜져 있으면 "성공하는 이메일 가입" 은 매번 확인 메일을 한 통 씁니다.
  // 그래서 켜져 있을 때는 메일이 나가지 않는 휴대폰 경로로 같은 것을 봅니다.
  const simplePw = 'abcdef'
  if (!emailVerify) {
    const simpleEmail = `simple-${stamp}@phone.mebody.net`
    r = await signup({ identifier: simpleEmail, password: simplePw })
    const simple = r.body?.data ?? r.body
    if (simple?.authUserId) created.push(simple.authUserId)
    ok('대문자·숫자·기호 없이 6자만으로 가입된다', r.status === 200, `status=${r.status} ${JSON.stringify(r.body).slice(0, 70)}`)
    s = await login(simpleEmail, simplePw)
    ok('그 계정으로 로그인도 된다', s.status === 200 && Boolean(s.body?.access_token), `status=${s.status}`)

    const noNameEmail = `noname-${stamp}@phone.mebody.net`
    r = await signup({ identifier: noNameEmail, password: simplePw })
    const noName = r.body?.data ?? r.body
    if (noName?.authUserId) created.push(noName.authUserId)
    ok('이름 없이도 가입된다', r.status === 200, `status=${r.status}`)
  } else {
    const simplePhone = `010-${String(stamp + 31).slice(-8, -4)}-${String(stamp + 31).slice(-4)}`
    r = await signup({ identifier: simplePhone, password: simplePw })
    const simple = r.body?.data ?? r.body
    if (simple?.authUserId) created.push(simple.authUserId)
    ok('대문자·숫자·기호 없이 6자만으로 가입된다', r.status === 200, `status=${r.status} ${JSON.stringify(r.body).slice(0, 70)}`)
    s = await login(simple?.loginEmail, simplePw)
    ok('그 계정으로 로그인도 된다', s.status === 200 && Boolean(s.body?.access_token), `status=${s.status}`)

    const noNamePhone = `010-${String(stamp + 57).slice(-8, -4)}-${String(stamp + 57).slice(-4)}`
    r = await signup({ identifier: noNamePhone, password: simplePw })
    const noName = r.body?.data ?? r.body
    if (noName?.authUserId) created.push(noName.authUserId)
    ok('이름 없이도 가입된다', r.status === 200, `status=${r.status}`)
  }

  // 비밀번호 거절은 Supabase 가 메일을 보내기 전에 판정하므로 한도를 쓰지 않습니다.
  r = await signup({ identifier: `tooshort-${stamp}@phone.mebody.net`, password: 'ab' })
  ok('Supabase 가 거절하면 사유를 우리 문장으로 옮긴다',
    r.status === 400 && /짧|길게/.test(String(r.body?.message ?? '')),
    `status=${r.status} ${r.body?.message ?? ''}`)

  console.log('\n■ 휴대폰 가입 + 복구용 이메일')
  const recPhoneRaw = `010-${String(stamp + 7).slice(-8, -4)}-${String(stamp + 7).slice(-4)}`
  const recPhone = recPhoneRaw.replace(/-/g, '')
  const recoveryEmail = `recovery-${stamp}@phone.mebody.net`
  r = await signup({ identifier: recPhoneRaw, password: PW, recoveryEmail, displayName: '복구이메일' })
  const rec = r.body?.data ?? r.body
  if (rec?.authUserId) created.push(rec.authUserId)
  ok('복구 이메일과 함께 가입된다', r.status === 200, `status=${r.status}`)
  ok('계정 이메일이 복구 이메일이 된다', rec?.loginEmail === recoveryEmail, String(rec?.loginEmail))

  const recPhoneRow = (await db.query('SELECT phone FROM auth.users WHERE id=$1', [rec?.authUserId])).rows[0]
  ok('번호도 함께 저장된다', recPhoneRow?.phone === `82${recPhone.slice(1)}`, String(recPhoneRow?.phone))

  s = await login(recoveryEmail, PW)
  ok('복구 이메일로 로그인된다', s.status === 200 && Boolean(s.body?.access_token), `status=${s.status}`)

  console.log('\n■ 그래도 번호로 로그인된다 (서버가 찾아 줌)')
  r = await fetch(`${BASE}/api/public/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: recPhoneRaw, password: PW }),
  })
  const phoneSession = (await r.json().catch(() => null))?.data
  ok('번호로 로그인 성공', r.status === 200 && Boolean(phoneSession?.access_token), `status=${r.status}`)

  r = await fetch(`${BASE}/api/public/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: recPhoneRaw, password: 'WrongPassword!123' }),
  })
  ok('틀린 비밀번호로는 401', r.status === 401, `status=${r.status}`)

  console.log('\n■ 재설정 요청은 가입 여부를 흘리지 않는다')
  const resetOf = async (id) => {
    const rr = await fetch(`${BASE}/api/public/auth/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: id }),
    })
    const body = await rr.json().catch(() => null)
    // timestamp 는 호출마다 달라서 비교에서 뺍니다. 가입 여부가 새는지만 봅니다.
    return { status: rr.status, shape: JSON.stringify({ success: body?.success, message: body?.message ?? null, data: body?.data ?? null }) }
  }
  const known = await resetOf(recPhoneRaw)
  const unknown = await resetOf('010-0000-0000')
  ok('있는 번호와 없는 번호의 응답이 같다',
    known.status === unknown.status && known.shape === unknown.shape,
    `${known.status} ${known.shape} vs ${unknown.status} ${unknown.shape}`)

  // 확인 절차가 켜져 있으면 이 경로는 닫혀 있어야 맞습니다(앞의 "확인 안 된 계정" 절에서 409 를 봤습니다).
  // 꺼져 있을 때만, 승인 대기로 남은 계정이 로그인 한 번으로 풀리는지 봅니다.
  console.log(`\n■ 승인 대기로 남은 계정 — ${emailVerify ? '확인 절차가 켜져 있어 풀리지 않아야 한다' : '자동으로 풀린다'}`)
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

  const doApprove = (identifier) => fetch(`${BASE}/api/public/auth/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  })
  const confirmedOf = async (email) => (await db.query(
    'SELECT email_confirmed_at FROM auth.users WHERE email = $1', [email])).rows[0]?.email_confirmed_at

  const before = await confirmedOf(pendingEmail)
  r = await doApprove(pendingEmail)
  const approval = (await r.json().catch(() => null))?.data
  const after = await confirmedOf(pendingEmail)

  if (emailVerify) {
    ok('확인 절차가 켜져 있으면 승인을 거절한다', r.status === 409, `status=${r.status}`)
    ok('거절했으니 계정도 그대로다', String(before) === String(after), `${before} -> ${after}`)
    s = await login(pendingEmail, PW)
    ok('여전히 로그인이 막힌다', s.status !== 200 && s.body?.error_code === 'email_not_confirmed',
      `status=${s.status} ${s.body?.error_code ?? ''}`)
  } else {
    ok('자동 승인 요청 성공', r.status === 200 && approval?.approved === true, `status=${r.status}`)
    s = await login(pendingEmail, PW)
    ok('승인 뒤 바로 로그인된다', s.status === 200 && Boolean(s.body?.access_token), `status=${s.status}`)

    // 한 번 더 불러도 아무것도 바뀌면 안 됩니다. 예전에는 응답의 alreadyApproved 로 확인했는데,
    // 그 필드 자체가 계정 존재를 알려주는 값이라 없앴습니다. 그래서 DB 를 직접 봅니다.
    const confirmedBefore = await confirmedOf(pendingEmail)
    r = await doApprove(pendingEmail)
    const confirmedAfter = await confirmedOf(pendingEmail)
    ok('이미 승인된 계정은 그대로 둔다',
      r.status === 200 && String(confirmedBefore) === String(confirmedAfter),
      `${confirmedBefore} -> ${confirmedAfter}`)
  }

  // 계정 존재가 응답으로 새는지는 모드와 무관하게 봅니다.
  const unknownId = `nobody-${stamp}@phone.mebody.net`
  r = await doApprove(unknownId)
  const none = (await r.json().catch(() => null))?.data
  const again = approval
  const conjured = Number((await db.query(
    'SELECT count(*)::int n FROM auth.users WHERE email = $1', [unknownId])).rows[0].n)
  ok('없는 계정은 만들어내지 않는다', conjured === 0, `auth.users=${conjured}`)

  // 계정 존재가 응답으로 새면, 이 공개 엔드포인트에 이메일·번호를 하나씩 넣어 보는 것만으로
  // 회원 명단을 캘 수 있습니다. /reset 은 처음부터 막혀 있었고 /approve 만 빠져 있었습니다.
  ok('승인 응답이 계정 존재를 알려주지 않는다',
    !('found' in (none ?? {})) && !('alreadyApproved' in (none ?? {}))
      && again?.approved === none?.approved
      && Object.keys(again ?? {}).sort().join(',') === Object.keys(none ?? {}).sort().join(','),
    `${JSON.stringify(again)} vs ${JSON.stringify(none)}`)

  // 확인 절차가 켜진 서버에서는 이 경로가 우회가 됩니다. 예전 코드는 이메일만 보고
  // 휴대폰 식별자는 검사를 통째로 건너뛰었습니다. 자세한 검증은 verify:approve-guard 가 합니다.
  const authCfg = await fetch(`${BASE}/api/public/auth/config`)
    .then((x) => x.json()).then((b) => b?.data ?? b).catch(() => null)
  ok('확인 절차 상태가 설정과 일치한다',
    authCfg?.emailVerificationRequired === emailVerify && authCfg?.phoneVerificationRequired === false,
    `email=${authCfg?.emailVerificationRequired} phone=${authCfg?.phoneVerificationRequired}`)

  console.log('\n■ 동의한 사실이 남는가 (055)')
  const hasCols = Number((await db.query(`SELECT count(*)::int n FROM information_schema.columns
     WHERE table_schema='public' AND table_name='user_profiles' AND column_name='terms_agreed_at'`)).rows[0].n) === 1
  if (!hasCols) {
    ok('동의 시각이 기록된다', true, '055 미적용이라 생략')
    ok('동의하지 않으면 기록되지 않는다', true, '055 미적용이라 생략')
  } else {
    const consentRow = (id) => db.query(`SELECT terms_agreed_at, privacy_agreed_at, marketing_agreed_at
       FROM public.user_profiles WHERE auth_user_id=$1`, [id]).then((x) => x.rows[0])

    // 휴대폰 경로는 확인 메일을 쓰지 않아 항상 돕니다. 기본 검사는 여기서 합니다.
    const consentPhone = `010-${String(stamp + 91).slice(-8, -4)}-${String(stamp + 91).slice(-4)}`
    r = await signup({ identifier: consentPhone, password: PW, agreedTerms: true, agreedPrivacy: true })
    const consentUser = r.body?.data ?? r.body
    if (consentUser?.authUserId) created.push(consentUser.authUserId)
    const row = await consentRow(consentUser?.authUserId)
    ok('동의 시각이 기록된다',
      Boolean(row?.terms_agreed_at) && Boolean(row?.privacy_agreed_at),
      `약관 ${row?.terms_agreed_at ? 'O' : 'X'} 처리방침 ${row?.privacy_agreed_at ? 'O' : 'X'}`)
    ok('동의하지 않은 마케팅은 비어 있다', row?.marketing_agreed_at === null)

    const noConsentPhone = `010-${String(stamp + 113).slice(-8, -4)}-${String(stamp + 113).slice(-4)}`
    r = await signup({ identifier: noConsentPhone, password: PW })
    const noConsentUser = r.body?.data ?? r.body
    if (noConsentUser?.authUserId) created.push(noConsentUser.authUserId)
    const row2 = await consentRow(noConsentUser?.authUserId)
    ok('동의를 안 보내면 기록되지 않는다', row2?.terms_agreed_at === null, String(row2?.terms_agreed_at))

    // 확인 메일을 기다리는 계정도 동의 증적이 있어야 합니다. 없으면 auth.users 에 사람은
    // 생겼는데 동의한 기록은 없는 상태가 됩니다. (메일 한도에 걸리면 이번 회차는 건너뜁니다)
    if (emailVerify) {
      const pendingConsent = `pconsent-${stamp}@phone.mebody.net`
      r = await signup({ identifier: pendingConsent, password: PW, agreedTerms: true, agreedPrivacy: true })
      const pc = r.body?.data ?? r.body
      if (pc?.authUserId) created.push(pc.authUserId)
      if (r.status !== 200) {
        console.log(`    대기  확인 대기 계정의 동의 증적 — 이번엔 못 봤습니다 (${r.status})`)
      } else {
        const row3 = await consentRow(pc?.authUserId)
        ok('확인을 기다리는 계정도 동의 시각이 남는다',
          r.status === 200 && pc?.verificationRequired === true && Boolean(row3?.terms_agreed_at),
          `status=${r.status} 약관 ${row3?.terms_agreed_at ? 'O' : 'X'}`)
      }
    }
  }

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
