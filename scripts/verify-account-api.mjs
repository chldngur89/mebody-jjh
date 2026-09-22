/**
 * 탈퇴 엔드포인트 검증 — 실제 계정을 만들고 지웁니다.
 *
 * 로컬 서버(기본 http://localhost:8081)에 대고 돌립니다.
 * 운영 DB 를 쓰므로, 만든 것은 끝에 반드시 정리합니다.
 *
 * 사용: npm run verify:account-api
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { randomUUID } from 'node:crypto'

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
const n = async (sql, args = []) => Number((await db.query(sql, args)).rows[0].n)

const stamp = Date.now()
const PW = `DeleteProbe!${stamp}`
const made = []

await db.connect()
try {
  console.log('\n■ 검증용 계정과 데이터')
  const email = `del-api-${stamp}@phone.mebody.net`
  let r = await fetch(`${SB}/auth/v1/admin/users`, { method: 'POST', headers: SH,
    body: JSON.stringify({ email, password: PW, email_confirm: true }) })
  const user = await r.json()
  if (user?.id) made.push(user.id)
  ok('계정 생성', r.status === 200, `status=${r.status}`)

  await db.query(`INSERT INTO public.questionnaire_responses (id,user_id,answers,status,calculated_code,question_version)
    VALUES (gen_random_uuid(),$1,'{"A1":"1"}'::jsonb,'completed','FRRS','mebody_v1_32')`, [user.id])
  await db.query(`INSERT INTO public.user_rewards (user_id, entry_type, amount, source_type, source_id)
    VALUES ($1,'earn_mission',6,'mission',gen_random_uuid())`, [user.id])
  const orderId = randomUUID()
  await db.query(`INSERT INTO public.orders (id,user_id,status,subtotal_krw,reward_used,total_krw)
    VALUES ($1,$2,'PAID',9000,0,9000)`, [orderId, user.id])
  await db.query(`INSERT INTO public.payments (user_id,provider,provider_txn_id,kind,amount_krw,status,order_id)
    VALUES ($1,'dev',$2,'order',9000,'APPROVED',$3)`, [user.id, `txn-${randomUUID()}`, orderId])
  ok('진단·적립금·주문·결제 준비됨',
    (await n('SELECT count(*)::int n FROM public.questionnaire_responses WHERE user_id=$1', [user.id])) === 1)

  console.log('\n■ 로그인해서 내 토큰 받기')
  r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: AH,
    body: JSON.stringify({ email, password: PW }) })
  const session = await r.json()
  ok('로그인 성공', r.status === 200 && Boolean(session.access_token), `status=${r.status}`)

  console.log('\n■ 인증 없이는 지울 수 없다')
  r = await fetch(`${BASE}/api/account`, { method: 'DELETE' })
  ok('토큰 없이 호출 → 401', r.status === 401, `status=${r.status}`)

  console.log('\n■ 탈퇴')
  r = await fetch(`${BASE}/api/account`, { method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` } })
  const body = await r.json().catch(() => null)
  const data = body?.data ?? body
  ok('탈퇴 성공', r.status === 200, `status=${r.status} ${JSON.stringify(body).slice(0, 90)}`)
  ok('남는 거래 기록을 알려준다', data?.keptOrders === 1 && data?.keptPayments === 1,
    `주문 ${data?.keptOrders} 결제 ${data?.keptPayments}`)

  console.log('\n■ 실제로 지워졌나')
  ok('인증 계정 없음', (await n('SELECT count(*)::int n FROM auth.users WHERE id=$1', [user.id])) === 0)
  ok('프로필 없음', (await n('SELECT count(*)::int n FROM public.user_profiles WHERE id=$1', [user.id])) === 0)
  ok('진단 응답 없음', (await n('SELECT count(*)::int n FROM public.questionnaire_responses WHERE user_id=$1', [user.id])) === 0)
  ok('적립금 원장 없음', (await n('SELECT count(*)::int n FROM public.user_rewards WHERE user_id=$1', [user.id])) === 0)

  console.log('\n■ 거래 기록은 남고 사람만 끊겼나')
  const order = (await db.query('SELECT user_id, total_krw FROM public.orders WHERE id=$1', [orderId])).rows[0]
  ok('주문이 남아 있다', Boolean(order), order ? `${order.total_krw}원` : '사라짐')
  ok('구매자 연결이 끊겼다', order?.user_id === null, String(order?.user_id))
  const pay = (await db.query('SELECT user_id FROM public.payments WHERE order_id=$1', [orderId])).rows[0]
  ok('결제가 남고 구매자만 끊겼다', Boolean(pay) && pay.user_id === null)

  console.log('\n■ 지워진 계정의 토큰은 더 못 쓴다')
  r = await fetch(`${BASE}/api/account`, { method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` } })
  ok('같은 토큰으로 다시 호출 → 401 (500 이 아니라)', r.status === 401, `status=${r.status}`)

  console.log('\n■ 같은 이메일로 다시 가입된다')
  // 이메일 확인 절차가 켜져 있으면 이 호출이 확인 메일을 한 통 씁니다. Supabase 기본 SMTP 는
  // 시간당 몇 통이라 429 가 날 수 있는데, 그건 우리 코드의 실패가 아닙니다. 그래도 "같은 주소를
  // 다시 쓸 수 있는가 / 옛 기록이 되살아나는가" 는 확인해야 하므로 관리자 경로로 이어서 봅니다.
  r = await fetch(`${BASE}/api/public/auth/signup`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: PW }) })
  // Response 객체에는 값을 못 붙입니다(읽기 전용). 지역 변수로 들고 씁니다.
  const signupBody = await r.json().catch(() => null)
  let again = signupBody?.data
  if (again?.authUserId) made.push(again.authUserId)

  // 공개 가입이 막히는 경우가 둘입니다. 둘 다 우리 코드의 실패가 아니라 환경 제약입니다.
  //   429  Supabase 메일 발송 한도
  //   400  "사용할 수 없는 이메일 주소" — 공개 가입은 MX 레코드 없는 도메인을 거부합니다.
  //        테스트 주소가 쓰는 @phone.mebody.net 이 그렇습니다.
  // 예전에는 429 만 잡아서, 메일 한도가 잠깐 풀린 순간에만 400 이 나며 간헐적으로 떨어졌습니다.
  const publicSignupBlocked = r.status === 429
    || (r.status === 400 && /사용할 수 없는 이메일/.test(String(signupBody?.message ?? '')))
  if (publicSignupBlocked) {
    console.log(`    대기  공개 가입 막힘(${r.status}). 같은 주소 재사용은 관리자 경로로 확인합니다`)
    const ar = await fetch(`${SB}/auth/v1/admin/users`, { method: 'POST', headers: SH,
      body: JSON.stringify({ email, password: PW, email_confirm: true }) })
    again = await ar.json()
    if (again?.id) made.push(again.id)
    again = { authUserId: again?.id }
    ok('재가입 성공', ar.status === 200, `admin status=${ar.status}`)
  } else {
    ok('재가입 성공', r.status === 200, `status=${r.status}`)
  }
  ok('예전 기록은 돌아오지 않는다',
    (await n('SELECT count(*)::int n FROM public.questionnaire_responses WHERE user_id=$1', [again?.authUserId])) === 0)

  console.log('\n■ 정리')
  await db.query('DELETE FROM public.payments WHERE order_id=$1', [orderId])
  await db.query('DELETE FROM public.orders WHERE id=$1', [orderId])
  ok('검증용 주문·결제 삭제', (await n('SELECT count(*)::int n FROM public.orders WHERE id=$1', [orderId])) === 0)
} finally {
  for (const id of [...new Set(made)].filter(Boolean)) {
    await db.query('DELETE FROM public.user_profiles WHERE auth_user_id=$1', [id]).catch(() => {})
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: SH }).catch(() => {})
  }
  console.log(`  계정 ${[...new Set(made)].length}건 정리`)
  await db.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
