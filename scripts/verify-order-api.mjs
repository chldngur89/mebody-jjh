/**
 * 주문 이후 흐름 + 보상형 SSV 의 서버 API 검증 — 로컬 서버에 실제 요청을 보냅니다.
 *
 *   · 주문 취소 (소유권 · 발송 후 거절 · 적립금 정산 · 멱등)
 *   · 배송 상태 변경 (역할 · 송장 필수 · 되돌리기 금지)
 *   · AdMob SSV 콜백 (꺼짐 → 503, 켜짐 + 위조 서명 → 지급 안 됨)
 *
 * 서버는 HS256 검증 모드로 띄워야 합니다(토큰을 직접 만들기 때문입니다):
 *   mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=8081 \
 *     --mebody.supabase.jwks-url= --mebody.supabase.jwt-secret=<32자 이상> \
 *     --mebody.billing.dev-mode=true"
 *
 * 만든 주문·결제·적립은 끝에 전부 지웁니다.
 * 사용: MEBODY_TEST_JWT_SECRET=<위와 같은 값> npm run verify:order-api
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
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 비 JSON */ }
  return { status: r.status, json, text }
}

const RUN = `ordv-${Date.now()}`
const created = []
let userId = null

/** 결제까지 끝난 주문 하나 */
async function paidOrder(uid, productId, token, rewardToUse = 0) {
  await db.query('BEGIN')
  await db.query('SET LOCAL ROLE authenticated')
  await db.query(`SELECT set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })])
  const o = await db.query(`SELECT * FROM public.create_order($1::jsonb, $2)`,
    [JSON.stringify([{ product_id: productId, quantity: 1 }]), rewardToUse])
  await db.query('COMMIT')
  const orderId = o.rows[0].order_id
  created.push(orderId)
  const conf = await call(`/api/billing/orders/${orderId}/confirm`, { token, method: 'POST', body: { paymentKey: `${RUN}-${orderId}` } })
  return { orderId, total: Number(o.rows[0].total), confirmed: conf.status === 200 }
}

await db.connect()
try {
  const migrated = (await db.query(`SELECT count(*)::int n FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='fulfillment_status'`)).rows[0].n === 1

  const me = (await db.query(`SELECT id, email FROM auth.users WHERE email=$1`, [EMAIL])).rows[0]
  const other = (await db.query(`SELECT id, email FROM auth.users WHERE email<>$1 LIMIT 1`, [EMAIL])).rows[0]
  const admin = (await db.query(`SELECT auth_user_id, email FROM public.user_profiles WHERE role='ADMIN' ORDER BY created_at LIMIT 1`)).rows[0]
  const seller = (await db.query(`SELECT auth_user_id, email FROM public.user_profiles WHERE role='SELLER' LIMIT 1`)).rows[0]
  userId = me.id
  const token = jwt(me.id, me.email)
  const otherToken = jwt(other.id, other.email)
  const adminToken = jwt(admin.auth_user_id, admin.email)
  const sellerToken = jwt(seller.auth_user_id, seller.email)

  console.log(`\n(042 적용: ${migrated})`)

  console.log('\n■ 보상형 광고 SSV 콜백')
  const health = await call('/api/ads/admob/ssv/health')
  ok('콜백 상태 확인은 인증 없이 열려 있다', health.status === 200, health.text)
  const cfgNoAuth = await call('/api/ads/config')
  ok('설정 조회는 로그인 필요 → 401', cfgNoAuth.status === 401)
  const cfg = await call('/api/ads/config', { token })
  ok('로그인하면 설정 조회 → 200', cfg.status === 200, JSON.stringify(cfg.json?.data))

  const ssvEnabled = cfg.json?.data?.ssvEnabled === true
  const forged = '?ad_network=5450213213286189855&ad_unit=1234&reward_amount=1&reward_item=coins'
    + `&timestamp=${Date.now()}&transaction_id=${RUN}-forged&user_id=${me.id}&key_id=3335741209&signature=AAAA`
  const ssv = await call(`/api/ads/admob/ssv${forged}`)
  if (ssvEnabled) {
    ok('위조 서명 콜백 → 지급되지 않는다', ssv.status === 200 && ssv.text === 'rejected', `${ssv.status} ${ssv.text}`)
    if (migrated) {
      const logged = (await db.query(
        `SELECT status FROM public.ad_reward_callbacks WHERE transaction_id=$1`, [`${RUN}-forged`])).rows[0]
      ok('거절 사실이 원장에 남는다', logged?.status === 'REJECTED', logged?.status)
    }
  } else {
    ok('SSV 가 꺼져 있으면 콜백은 503 (AdMob 이 재전송하도록)', ssv.status === 503, `${ssv.status} ${ssv.text}`)
    const granted = (await db.query(
      `SELECT count(*)::int n FROM public.user_rewards WHERE user_id=$1 AND entry_type='earn_routine_bonus'
        AND created_at > now() - interval '1 minute'`, [me.id])).rows[0].n
    ok('꺼진 상태에서는 아무것도 지급되지 않는다', granted === 0, `${granted}건`)
  }

  if (!migrated) {
    console.log('\n  → 042 미적용이라 주문 취소·배송 검사는 건너뜁니다.')
  } else {
    const product = (await db.query(
      `SELECT id, price FROM public.products WHERE status='ACTIVE' AND price IS NOT NULL LIMIT 1`)).rows[0]

    console.log('\n■ 주문 취소')
    const o1 = await paidOrder(me.id, product.id, token)
    ok('결제까지 끝난 주문 생성', o1.confirmed, `${o1.total}원`)

    const foreign = await call(`/api/billing/orders/${o1.orderId}/cancel`, { token: otherToken, method: 'POST' })
    ok('남의 주문 취소 시도 → 403', foreign.status === 403, foreign.json?.message)

    const cancel = await call(`/api/billing/orders/${o1.orderId}/cancel?reason=검증`, { token, method: 'POST' })
    ok('내 주문 취소 → 200', cancel.status === 200, cancel.json?.message)
    ok('이번 요청으로 실제 취소됐다고 알려준다', cancel.json?.data?.changed === true)
    const row = (await db.query(`SELECT status FROM public.orders WHERE id=$1`, [o1.orderId])).rows[0]
    ok('DB 주문이 CANCELED', row.status === 'CANCELED', row.status)

    const again = await call(`/api/billing/orders/${o1.orderId}/cancel`, { token, method: 'POST' })
    ok('다시 취소 → 200 이지만 changed=false (멱등)', again.status === 200 && again.json?.data?.changed === false)

    console.log('\n■ 배송 상태')
    const o2 = await paidOrder(me.id, product.id, token)
    ok('두 번째 주문 결제 완료', o2.confirmed)

    const asMember = await call(`/api/admin/orders/${o2.orderId}/fulfillment`, {
      token, method: 'POST', body: { status: 'PREPARING' } })
    ok('일반 회원이 배송 상태를 바꾸려 하면 → 403', asMember.status === 403, asMember.json?.message)

    const listNoAuth = await call('/api/admin/orders')
    ok('주문 목록은 로그인 필요 → 401', listNoAuth.status === 401)

    const adminList = await call('/api/admin/orders', { token: adminToken })
    ok('관리자는 주문 목록을 본다', adminList.status === 200 && Array.isArray(adminList.json?.data),
      `${adminList.json?.data?.length ?? 0}건`)
    ok('목록에 배송 상태와 구매자가 실린다',
      adminList.json?.data?.some((o) => o.id === o2.orderId && o.fulfillmentStatus === 'NONE'))

    const sellerList = await call('/api/admin/orders', { token: sellerToken })
    ok('판매자도 자기 상품이 든 주문을 본다', sellerList.status === 200,
      `${sellerList.json?.data?.length ?? 0}건`)

    const noTracking = await call(`/api/admin/orders/${o2.orderId}/fulfillment`, {
      token: adminToken, method: 'POST', body: { status: 'SHIPPED' } })
    ok('송장 없이 발송 처리 → 400', noTracking.status === 400, noTracking.json?.message)

    const prep = await call(`/api/admin/orders/${o2.orderId}/fulfillment`, {
      token: adminToken, method: 'POST', body: { status: 'PREPARING' } })
    ok('배송 준비로 변경 → 200', prep.status === 200 && prep.json?.data?.fulfillmentStatus === 'PREPARING')

    const stillCancelable = await call('/api/admin/orders', { token: adminToken })
    ok('준비 중까지는 아직 취소 가능한 상태', stillCancelable.status === 200)

    const ship = await call(`/api/admin/orders/${o2.orderId}/fulfillment`, {
      token: adminToken, method: 'POST', body: { status: 'SHIPPED', carrier: 'CJ대한통운', trackingNo: '999888777' } })
    ok('송장과 함께 발송 처리 → 200',
      ship.status === 200 && ship.json?.data?.fulfillmentStatus === 'SHIPPED' && ship.json?.data?.trackingNo === '999888777')

    const back = await call(`/api/admin/orders/${o2.orderId}/fulfillment`, {
      token: adminToken, method: 'POST', body: { status: 'PREPARING' } })
    ok('배송 상태 되돌리기 → 400', back.status === 400, back.json?.message)

    const lateCancel = await call(`/api/billing/orders/${o2.orderId}/cancel`, { token, method: 'POST' })
    ok('발송된 주문은 앱에서 취소 불가 → 400', lateCancel.status === 400, lateCancel.json?.message)

    const delivered = await call(`/api/admin/orders/${o2.orderId}/fulfillment`, {
      token: adminToken, method: 'POST', body: { status: 'DELIVERED' } })
    ok('배송 완료 처리 → 200', delivered.status === 200 && delivered.json?.data?.fulfillmentStatus === 'DELIVERED')
  }
} finally {
  if (userId) {
    for (const oid of created) {
      await db.query('DELETE FROM public.user_rewards WHERE source_id=$1', [oid]).catch(() => {})
      await db.query('DELETE FROM public.payments WHERE order_id=$1', [oid]).catch(() => {})
      await db.query('DELETE FROM public.order_items WHERE order_id=$1', [oid]).catch(() => {})
      await db.query('DELETE FROM public.orders WHERE id=$1', [oid]).catch(() => {})
    }
    await db.query(`DELETE FROM public.ad_reward_callbacks WHERE transaction_id LIKE $1`, [`${RUN}%`]).catch(() => {})
    const left = await db.query(
      `SELECT (SELECT count(*)::int FROM public.orders WHERE user_id=$1) o,
              (SELECT count(*)::int FROM public.payments WHERE user_id=$1) p`, [userId]).catch(() => null)
    if (left) console.log(`\n(정리: 남은 주문 ${left.rows[0].o}건 · 결제 ${left.rows[0].p}건)`)
  }
  await db.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
