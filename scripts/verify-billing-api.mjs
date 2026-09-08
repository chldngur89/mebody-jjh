/**
 * 결제 API 검증 — 로컬 서버에 실제 요청을 보냅니다.
 *
 * 서버가 어떤 모드인지 /api/billing/config 로 스스로 알아내고 그에 맞게 검사합니다.
 *
 *   · 개발 어댑터 꺼짐(기본값) → 결제 API 가 501 로 거절하는지. **DB 를 건드리지 않습니다.**
 *   · 개발 어댑터 켜짐        → 구독 활성화 · 주문 결제 · 5% 적립까지 전 구간.
 *                              끝에 만든 것(구독·주문·결제·적립)을 전부 되돌립니다.
 *
 * 두 모드를 모두 확인하려면 서버를 두 번 띄우세요:
 *   (1) 기본값 그대로
 *   (2) --mebody.billing.dev-mode=true
 *
 * 사용: MEBODY_TEST_JWT_SECRET=<서버에 준 값> npm run verify:billing-api
 */
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import pg from 'pg'

const BASE = process.env.MEBODY_SERVER_BASE ?? 'http://localhost:8081'
const SECRET = process.env.MEBODY_TEST_JWT_SECRET
const EMAIL = process.env.MEBODY_E2E_EMAIL ?? 'wh.choi@mebody.net'
if (!SECRET) { console.error('MEBODY_TEST_JWT_SECRET 이 필요합니다.'); process.exit(2) }

const env = {}
for (const l of readFileSync(new URL('../../mebody-server/.env', import.meta.url).pathname, 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0) env[t.slice(0, i)] = t.slice(i + 1)
}
const u = new URL(env.SUPABASE_DB_URL.replace(/^jdbc:/, ''))
const db = new pg.Client({ host: u.hostname, port: Number(u.port || 5432),
  database: u.pathname.replace(/^\//, '') || 'postgres',
  user: env.SUPABASE_DB_USERNAME, password: env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, statement_timeout: 60000 })

const res = []
const ok = (l, p, d = '') => { res.push({ l, p }); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwt(sub, email) {
  const now = Math.floor(Date.now() / 1000)
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ sub, email, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 })
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`
}

async function call(path, { token, method = 'GET', body } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 비 JSON */ }
  return { status: r.status, json, text }
}

// 이번 실행이 만든 것만 정리하기 위한 표식
const RUN = `verify-${Date.now()}`
let createdOrderId = null
let userId = null

await db.connect()
try {
  // 040 이 적용됐는지 먼저 본다. 없으면 dev 모드 검사는 못 한다.
  const migrated = (await db.query(`SELECT count(*)::int n FROM information_schema.tables
    WHERE table_schema='public' AND table_name='payments'`)).rows[0].n === 1

  const me = (await db.query(`SELECT u.id, u.email FROM auth.users u WHERE u.email=$1`, [EMAIL])).rows[0]
  const other = (await db.query(`SELECT id, email FROM auth.users WHERE email<>$1 LIMIT 1`, [EMAIL])).rows[0]
  userId = me.id
  const token = jwt(me.id, me.email)
  const otherToken = jwt(other.id, other.email)

  console.log('\n■ 접근 권한')
  ok('토큰 없이 config → 401', (await call('/api/billing/config')).status === 401)
  const cfg = await call('/api/billing/config', { token })
  ok('로그인하면 config → 200', cfg.status === 200, JSON.stringify(cfg.json?.data))

  const devMode = cfg.json?.data?.devMode === true
  const subProvider = cfg.json?.data?.subscriptionProvider ?? null
  const ordProvider = cfg.json?.data?.orderProvider ?? null
  console.log(`\n  (모드: devMode=${devMode} · 구독=${subProvider ?? '없음'} · 주문=${ordProvider ?? '없음'} · 040 적용=${migrated})`)

  if (!devMode) {
    console.log('\n■ 개발 어댑터가 꺼진 기본 상태 — 결제가 열려 있으면 안 된다')
    ok('config 의 구독 provider 가 없음', subProvider === null, String(subProvider))
    ok('config 의 주문 provider 가 없음', ordProvider === null, String(ordProvider))

    const sub = await call('/api/billing/subscription/verify', { token, method: 'POST',
      body: { planCode: 'basic_monthly', purchaseToken: RUN } })
    ok('구독 결제 시도 → 501', sub.status === 501, sub.json?.message)

    const conf = await call(`/api/billing/orders/${crypto.randomUUID()}/confirm`, { token, method: 'POST',
      body: { paymentKey: RUN } })
    ok('주문 결제 시도 → 501', conf.status === 501, conf.json?.message)

    const paid = (await db.query(`SELECT public.has_active_subscription($1) p`, [me.id])).rows[0].p
    ok('아무도 유료가 되지 않았다', paid === false)

    if (migrated) {
      const n = (await db.query(`SELECT count(*)::int n FROM public.payments`)).rows[0].n
      ok('결제 원장에 아무것도 남지 않았다', n === 0, `${n}건`)
    }
    console.log('\n  → 기본값이 안전합니다. 전체 플로우를 보려면 서버를 dev-mode=true 로 다시 띄우세요.')
  } else {
    if (!migrated) {
      ok('040_billing.sql 이 적용돼 있어야 합니다', false, 'payments 테이블이 없습니다')
      throw new Error('040 미적용')
    }

    console.log('\n■ 시작 상태 정리')
    await db.query('DELETE FROM public.user_subscriptions WHERE user_id=$1', [me.id])
    ok('구독 없음으로 시작',
      (await db.query(`SELECT public.has_active_subscription($1) p`, [me.id])).rows[0].p === false)
    const rewardBefore = (await db.query(`SELECT public.reward_balance($1) b`, [me.id])).rows[0].b

    console.log('\n■ 멤버십 결제')
    const bad = await call('/api/billing/subscription/verify', { token, method: 'POST',
      body: { planCode: 'pro_monthly', purchaseToken: `${RUN}-bad` } })
    ok('비활성 플랜으로 결제 → 400', bad.status === 400, bad.json?.message)

    const noToken = await call('/api/billing/subscription/verify', { token, method: 'POST',
      body: { planCode: 'basic_monthly' } })
    ok('구매 토큰 없이 → 400', noToken.status === 400, noToken.json?.message)

    const sub = await call('/api/billing/subscription/verify', { token, method: 'POST',
      body: { planCode: 'basic_monthly', purchaseToken: `${RUN}-sub` } })
    ok('구독 결제 → 200', sub.status === 200, sub.json?.message)
    ok('응답이 active 상태', sub.json?.data?.status === 'active', JSON.stringify(sub.json?.data))

    const entit = (await db.query(`SELECT public.has_active_subscription($1) p, public.subscription_tier($1) t`, [me.id])).rows[0]
    ok('DB 판정도 유료 (앱의 entitlement.isPaid 가 true 가 된다)', entit.p === true && entit.t === 'basic')
    ok('구매 적립 5% 로 올라간다',
      (await db.query(`SELECT public.purchase_cashback_percent($1) p`, [me.id])).rows[0].p === 5)

    const again = await call('/api/billing/subscription/verify', { token, method: 'POST',
      body: { planCode: 'basic_monthly', purchaseToken: `${RUN}-sub` } })
    ok('같은 구매 토큰으로 다시 → 200 (중복 결제 기록 안 생김)', again.status === 200)
    const payN = (await db.query(
      `SELECT count(*)::int n FROM public.payments WHERE provider_txn_id = $1`, [`dev-${RUN}-sub`])).rows[0].n
    ok('결제 원장에 같은 거래가 한 건만', payN === 1, `${payN}건`)

    console.log('\n■ 상품 주문 결제')
    const product = (await db.query(
      `SELECT id, price FROM public.products WHERE status='ACTIVE' AND price IS NOT NULL LIMIT 1`)).rows[0]
    // create_order 는 auth.uid() 를 쓰므로 앱과 같은 역할로 불러야 한다.
    await db.query('BEGIN')
    await db.query('SET LOCAL ROLE authenticated')
    await db.query(`SELECT set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: me.id, role: 'authenticated' })])
    const created = await db.query(
      `SELECT * FROM public.create_order($1::jsonb, 0)`, [JSON.stringify([{ product_id: product.id, quantity: 1 }])])
    await db.query('COMMIT')
    createdOrderId = created.rows[0]?.order_id ?? null
    ok('주문 생성', Boolean(createdOrderId))

    const total = Number(created.rows[0].total)
    const foreign = await call(`/api/billing/orders/${createdOrderId}/confirm`, { token: otherToken, method: 'POST',
      body: { paymentKey: `${RUN}-steal` } })
    ok('남의 주문을 결제하려 하면 → 403', foreign.status === 403, foreign.json?.message)

    const conf = await call(`/api/billing/orders/${createdOrderId}/confirm`, { token, method: 'POST',
      body: { paymentKey: `${RUN}-ord` } })
    ok('내 주문 결제 → 200', conf.status === 200, conf.json?.message)
    ok('PAID 로 바뀌고 금액이 주문 총액과 같다',
      conf.json?.data?.status === 'PAID' && conf.json?.data?.totalKrw === total, `${conf.json?.data?.totalKrw} / ${total}`)
    ok('이번 요청으로 실제 상태가 바뀌었다고 알려준다', conf.json?.data?.changed === true)

    const confAgain = await call(`/api/billing/orders/${createdOrderId}/confirm`, { token, method: 'POST',
      body: { paymentKey: `${RUN}-ord` } })
    ok('같은 결제를 재시도 → 200 이지만 changed=false (멱등)',
      confAgain.status === 200 && confAgain.json?.data?.changed === false)

    const dbOrder = (await db.query(`SELECT status, paid_at FROM public.orders WHERE id=$1`, [createdOrderId])).rows[0]
    ok('DB 주문이 PAID 이고 결제 시각이 찍혔다', dbOrder.status === 'PAID' && dbOrder.paid_at !== null)

    console.log('\n■ 결제 후 5% 적립')
    // 적립 청구는 앱이 한다(claim_purchase_reward 는 authenticated 용)
    await db.query('BEGIN')
    await db.query('SET LOCAL ROLE authenticated')
    await db.query(`SELECT set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: me.id, role: 'authenticated' })])
    const claim = await db.query(`SELECT * FROM public.claim_purchase_reward($1)`, [createdOrderId])
    await db.query('COMMIT')
    ok('5% 적립 지급', Number(claim.rows[0].amount) === Math.floor(total * 5 / 100),
      `${claim.rows[0].amount}원 / 결제 ${total}원`)
    const rewardAfter = (await db.query(`SELECT public.reward_balance($1) b`, [me.id])).rows[0].b
    ok('적립금 잔액이 늘었다', Number(rewardAfter) > Number(rewardBefore), `${rewardBefore} → ${rewardAfter}`)

    console.log('\n■ 해지')
    const cancel = await call('/api/billing/subscription/cancel', { token, method: 'POST' })
    ok('기간 만료 해지 예약 → 200', cancel.status === 200, cancel.json?.message)
    ok('cancelAtPeriodEnd = true', cancel.json?.data?.cancelAtPeriodEnd === true)
    ok('예약 해지 중에도 아직 유료',
      (await db.query(`SELECT public.has_active_subscription($1) p`, [me.id])).rows[0].p === true)

    const now = await call('/api/billing/subscription/cancel?immediate=true', { token, method: 'POST' })
    ok('즉시 해지 → 200', now.status === 200)
    ok('즉시 해지 후 무료로 판정',
      (await db.query(`SELECT public.has_active_subscription($1) p`, [me.id])).rows[0].p === false)
  }
} finally {
  // 이번 실행이 만든 것만 되돌린다
  if (userId) {
    if (createdOrderId) {
      await db.query('DELETE FROM public.user_rewards WHERE source_id=$1', [createdOrderId]).catch(() => {})
      await db.query('DELETE FROM public.payments WHERE order_id=$1', [createdOrderId]).catch(() => {})
      await db.query('DELETE FROM public.order_items WHERE order_id=$1', [createdOrderId]).catch(() => {})
      await db.query('DELETE FROM public.orders WHERE id=$1', [createdOrderId]).catch(() => {})
    }
    await db.query(`DELETE FROM public.payments WHERE provider_txn_id LIKE $1`, [`dev-${RUN}%`]).catch(() => {})
    await db.query('DELETE FROM public.user_subscriptions WHERE user_id=$1', [userId]).catch(() => {})
    const left = await db.query(
      `SELECT (SELECT count(*)::int FROM public.orders WHERE user_id=$1) o,
              (SELECT count(*)::int FROM public.user_subscriptions WHERE user_id=$1) s`, [userId]).catch(() => null)
    if (left) console.log(`\n(정리: 남은 주문 ${left.rows[0].o}건 · 구독 ${left.rows[0].s}건)`)
  }
  await db.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
