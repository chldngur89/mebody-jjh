/**
 * 040_billing.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 *
 * 핵심 질문 하나: **앱(authenticated)이 스스로 유료 회원이 되거나 주문을 결제 완료로
 * 바꿀 수 있는가?** 전부 "아니오" 여야 합니다.
 *
 * 사용: npm run verify:billing
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const EMAIL = process.env.MEBODY_E2E_EMAIL ?? 'wh.choi@mebody.net'

const env = {}
for (const l of readFileSync(process.env.MEBODY_SERVER_ENV ?? new URL('../../mebody-server/.env', import.meta.url).pathname, 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0) env[t.slice(0, i)] = t.slice(i + 1)
}
const u = new URL(env.SUPABASE_DB_URL.replace(/^jdbc:/, ''))
const c = new pg.Client({ host: u.hostname, port: Number(u.port || 5432),
  database: u.pathname.replace(/^\//, '') || 'postgres',
  user: env.SUPABASE_DB_USERNAME, password: env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, statement_timeout: 120000 })

const res = []
const ok = (l, p, d = '') => { res.push({ l, p }); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }
const svc = () => c.query('RESET ROLE')
const auth = async (id) => { await svc(); await c.query('SET LOCAL ROLE authenticated')
  await c.query(`SELECT set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]) }
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }

await c.connect(); await c.query('BEGIN')
try {
  console.log('\n■ 마이그레이션 적용')
  await c.query(readFileSync(new URL('../db/journey/040_billing.sql', import.meta.url).pathname, 'utf8'))
  ok('040 적용', true)
  await c.query(readFileSync(new URL('../db/journey/041_billing_grants_fix.sql', import.meta.url).pathname, 'utf8'))
  ok('041 적용', true)

  await svc()
  const uid = (await c.query('SELECT id FROM auth.users WHERE email=$1', [EMAIL])).rows[0].id
  const other = (await c.query('SELECT id FROM auth.users WHERE email<>$1 LIMIT 1', [EMAIL])).rows[0].id
  const product = (await c.query(`SELECT id, price FROM public.products WHERE status='ACTIVE' AND price IS NOT NULL LIMIT 1`)).rows[0]

  // 기존 상태를 지운다(이 트랜잭션 안에서만)
  await c.query('DELETE FROM public.user_subscriptions WHERE user_id=$1', [uid])
  await c.query('DELETE FROM public.user_rewards WHERE user_id=$1', [uid])
  await c.query('DELETE FROM public.orders WHERE user_id=$1', [uid])

  console.log('\n■ 앱(authenticated)은 스스로 유료가 될 수 없다')
  await auth(uid)
  const a1 = await T(() => c.query(`INSERT INTO public.user_subscriptions
    (user_id, plan_code, status, started_at, current_period_end)
    VALUES ($1,'basic_monthly','active',now(),now()+interval '30 days')`, [uid]))
  ok('구독 직접 INSERT → 거절', !a1.ok && a1.code === '42501', a1.ok ? '들어가 버림' : a1.code)

  const a2 = await T(() => c.query(`SELECT public.activate_subscription_admin($1,'basic_monthly',30)`, [uid]))
  ok('activate_subscription_admin 호출 → 거절', !a2.ok && a2.code === '42501', a2.ok ? '통과해 버림' : a2.code)

  const a3 = await T(() => c.query(`SELECT public.record_payment_admin($1,'dev','x','subscription',5900,NULL,'basic_monthly',NULL)`, [uid]))
  ok('record_payment_admin 호출 → 거절', !a3.ok && a3.code === '42501', a3.ok ? '통과해 버림' : a3.code)

  const a4 = await T(() => c.query(`SELECT public.cancel_subscription_admin($1,false)`, [uid]))
  ok('cancel_subscription_admin 호출 → 거절', !a4.ok && a4.code === '42501', a4.ok ? '통과해 버림' : a4.code)

  const a5 = await T(() => c.query(`INSERT INTO public.payments
    (user_id, provider, provider_txn_id, kind, plan_code, amount_krw)
    VALUES ($1,'dev','hack','subscription','basic_monthly',5900)`, [uid]))
  ok('payments 직접 INSERT → 거절', !a5.ok && a5.code === '42501', a5.ok ? '들어가 버림' : a5.code)

  // TRUNCATE 는 **RLS 를 적용받지 않는다.** 권한이 남아 있으면 로그인한 아무나
  // 원장 전체를 지울 수 있다. 040 초판이 실제로 이 상태였다(041 에서 메움).
  for (const table of ['payments', 'user_addresses', 'orders', 'user_rewards', 'user_subscriptions']) {
    const t = await T(() => c.query(`TRUNCATE public.${table} CASCADE`))
    ok(`${table} TRUNCATE → 거절 (RLS 를 우회하는 경로)`, !t.ok && t.code === '42501',
      t.ok ? '전부 지워짐' : t.code)
  }

  console.log('\n■ 앱은 주문을 결제 완료로 바꿀 수 없다')
  const orderRow = await c.query(`SELECT * FROM public.create_order($1::jsonb, 0)`,
    [JSON.stringify([{ product_id: product.id, quantity: 1 }])])
  const orderId = orderRow.rows[0].order_id
  const orderTotal = Number(orderRow.rows[0].total)
  ok('create_order 로 PENDING 주문 생성', Boolean(orderId), `총 ${orderTotal}원`)

  const b1 = await T(() => c.query(`UPDATE public.orders SET status='PAID' WHERE id=$1`, [orderId]))
  ok('orders.status 를 PAID 로 직접 UPDATE → 거절', !b1.ok && b1.code === '42501', b1.ok ? '통과해 버림' : b1.code)

  const b2 = await T(() => c.query(`SELECT public.mark_order_paid_admin($1,$1)`, [orderId]))
  ok('mark_order_paid_admin 호출 → 거절', !b2.ok && b2.code === '42501', b2.ok ? '통과해 버림' : b2.code)

  const b3 = await T(() => c.query(`SELECT * FROM public.claim_purchase_reward($1)`, [orderId]))
  ok('결제 전에 5% 적립 청구 → 거절', !b3.ok && b3.code === '42501', b3.ok ? '지급돼 버림' : b3.code)

  console.log('\n■ 서버(service role)는 할 수 있다')
  await svc()
  const s1 = await c.query(`SELECT * FROM public.record_payment_admin($1,'dev','sub-1','subscription',5900,NULL,'basic_monthly',NULL)`, [uid])
  ok('결제 기록 생성', s1.rows[0].was_new === true)
  const s1again = await c.query(`SELECT * FROM public.record_payment_admin($1,'dev','sub-1','subscription',5900,NULL,'basic_monthly',NULL)`, [uid])
  ok('같은 거래를 다시 기록 → 새로 만들지 않고 기존 것을 돌려준다(멱등)',
    s1again.rows[0].was_new === false && s1again.rows[0].payment_id === s1.rows[0].payment_id)

  const dupe = await T(() => c.query(`INSERT INTO public.payments
    (user_id, provider, provider_txn_id, kind, plan_code, amount_krw)
    VALUES ($1,'dev','sub-1','subscription','basic_monthly',5900)`, [uid]))
  ok('같은 (provider, 거래ID) 직접 INSERT → 23505', !dupe.ok && dupe.code === '23505', dupe.ok ? '중복 허용됨' : dupe.code)

  const steal = await T(() => c.query(`SELECT * FROM public.record_payment_admin($1,'dev','sub-1','subscription',5900,NULL,'basic_monthly',NULL)`, [other]))
  ok('남의 결제건을 내 것으로 재사용 → 거절', !steal.ok && steal.code === '42501', steal.ok ? '통과해 버림' : steal.code)

  const act = await c.query(`SELECT * FROM public.activate_subscription_admin($1,'basic_monthly',30)`, [uid])
  ok('구독 활성화', act.rows[0].status === 'active', `~${String(act.rows[0].current_period_end).slice(0, 10)}`)

  const paidCheck = await c.query(`SELECT public.has_active_subscription($1) p, public.subscription_tier($1) t`, [uid])
  ok('has_active_subscription = true', paidCheck.rows[0].p === true)
  ok('subscription_tier = basic', paidCheck.rows[0].t === 'basic', paidCheck.rows[0].t)

  const ext = await c.query(`SELECT * FROM public.activate_subscription_admin($1,'basic_monthly',30)`, [uid])
  const extended = new Date(ext.rows[0].current_period_end) > new Date(act.rows[0].current_period_end)
  ok('한 번 더 결제하면 기간이 이어 붙는다(남은 기간을 잃지 않는다)', extended,
    `${String(act.rows[0].current_period_end).slice(0, 10)} → ${String(ext.rows[0].current_period_end).slice(0, 10)}`)

  const badPlan = await T(() => c.query(`SELECT public.activate_subscription_admin($1,'pro_monthly',30)`, [uid]))
  ok('비활성 플랜(pro_monthly)으로 활성화 → 거절', !badPlan.ok && badPlan.code === '22023', badPlan.ok ? '통과해 버림' : badPlan.code)

  console.log('\n■ 주문 결제 — 금액을 대조한다')
  const wrongPay = await c.query(`SELECT * FROM public.record_payment_admin($1,'dev','ord-wrong','order',100,$2,NULL,NULL)`, [uid, orderId])
  const mismatch = await T(() => c.query(`SELECT public.mark_order_paid_admin($1,$2)`, [orderId, wrongPay.rows[0].payment_id]))
  ok('주문 총액과 다른 금액의 결제 → 거절', !mismatch.ok && mismatch.code === '22023', mismatch.ok ? '통과해 버림' : mismatch.msg)

  const goodPay = await c.query(`SELECT * FROM public.record_payment_admin($1,'dev','ord-1','order',$3,$2,NULL,NULL)`, [uid, orderId, orderTotal])
  const paid = await c.query(`SELECT * FROM public.mark_order_paid_admin($1,$2)`, [orderId, goodPay.rows[0].payment_id])
  ok('금액이 맞으면 PAID 로 전환', paid.rows[0].status === 'PAID' && paid.rows[0].was_new === true)

  const again = await c.query(`SELECT * FROM public.mark_order_paid_admin($1,$2)`, [orderId, goodPay.rows[0].payment_id])
  ok('이미 PAID 인 주문을 다시 결제 → 아무 일도 없음(멱등)', again.rows[0].was_new === false)

  const otherOrderPay = await T(() => c.query(`SELECT public.mark_order_paid_admin($1,$2)`, [orderId, s1.rows[0].payment_id]))
  ok('구독 결제건으로 주문을 결제 완료 시도 → 거절', !otherOrderPay.ok && otherOrderPay.code === '22023',
    otherOrderPay.ok ? '통과해 버림' : otherOrderPay.code)

  console.log('\n■ 결제 후에야 5% 적립을 받는다')
  await auth(uid)
  const claim = await c.query(`SELECT * FROM public.claim_purchase_reward($1)`, [orderId])
  const expected = Math.floor(orderTotal * 5 / 100)
  ok('5% 적립 지급', Number(claim.rows[0].amount) === expected, `${claim.rows[0].amount}원 (기대 ${expected}원)`)
  const claim2 = await c.query(`SELECT * FROM public.claim_purchase_reward($1)`, [orderId])
  ok('같은 주문으로 두 번 청구 → already_claimed', claim2.rows[0].already_claimed === true)

  console.log('\n■ 해지')
  await svc()
  const cancel = await c.query(`SELECT * FROM public.cancel_subscription_admin($1,false)`, [uid])
  ok('기간 만료 시 해지로 예약', cancel.rows[0].cancel_at_period_end === true)
  ok('예약 해지 중에도 기간이 남아 있으면 계속 유료',
    (await c.query(`SELECT public.has_active_subscription($1) p`, [uid])).rows[0].p === true)

  const now = await c.query(`SELECT * FROM public.cancel_subscription_admin($1,true)`, [uid])
  ok('즉시 해지하면 status=canceled', now.rows[0].status === 'canceled')
  ok('즉시 해지 후에는 무료로 판정',
    (await c.query(`SELECT public.has_active_subscription($1) p`, [uid])).rows[0].p === false)

  console.log('\n■ 배송지')
  await auth(uid)
  const addr = await c.query(`INSERT INTO public.user_addresses
    (user_id, label, recipient, phone, postcode, address1, address2, is_default)
    VALUES ($1,'집','최우혁','010-0000-0000','06236','서울시 강남구','101호',true) RETURNING id`, [uid])
  ok('본인 배송지 등록', addr.rowCount === 1)

  const dupDefault = await T(() => c.query(`INSERT INTO public.user_addresses
    (user_id, recipient, phone, postcode, address1, is_default)
    VALUES ($1,'최우혁','010-0000-0000','06236','서울시 강남구',true)`, [uid]))
  ok('기본 배송지는 하나만 → 두 번째 기본 지정 거절', !dupDefault.ok && dupDefault.code === '23505',
    dupDefault.ok ? '두 개가 됨' : dupDefault.code)

  const foreign = await T(() => c.query(`INSERT INTO public.user_addresses
    (user_id, recipient, phone, postcode, address1)
    VALUES ($1,'남','010-0000-0000','06236','서울시')`, [other]))
  ok('남의 id 로 배송지 등록 → 거절', !foreign.ok, foreign.ok ? '들어가 버림' : foreign.code)

  const seeOthers = await c.query(`SELECT count(*)::int n FROM public.user_addresses WHERE user_id <> $1`, [uid])
  ok('남의 배송지는 보이지 않는다', seeOthers.rows[0].n === 0, `${seeOthers.rows[0].n}건`)

  console.log('\n■ 주문에 배송지 붙이기')
  const withAddr = await c.query(`SELECT * FROM public.create_order($1::jsonb, 0, $2::uuid)`,
    [JSON.stringify([{ product_id: product.id, quantity: 1 }]), addr.rows[0].id])
  const snap = await c.query(`SELECT address_id, shipping_snapshot FROM public.orders WHERE id=$1`,
    [withAddr.rows[0].order_id])
  ok('주문에 배송지가 연결된다', snap.rows[0].address_id === addr.rows[0].id)
  ok('배송지 사본이 주문에 남는다', snap.rows[0].shipping_snapshot?.recipient === '최우혁',
    JSON.stringify(snap.rows[0].shipping_snapshot))

  // 사본이 있으니 배송지를 지워도 주문 내역은 남아야 한다
  await c.query('DELETE FROM public.user_addresses WHERE id=$1', [addr.rows[0].id])
  const afterDelete = await c.query(`SELECT address_id, shipping_snapshot FROM public.orders WHERE id=$1`,
    [withAddr.rows[0].order_id])
  ok('배송지를 지워도 주문의 배송 정보는 남는다',
    afterDelete.rows[0].address_id === null && afterDelete.rows[0].shipping_snapshot?.recipient === '최우혁')

  const otherAddr = await c.query(`SELECT id FROM public.user_addresses WHERE user_id <> $1 LIMIT 1`, [uid])
  const stolenAddr = await T(() => c.query(`SELECT * FROM public.create_order($1::jsonb, 0, $2::uuid)`,
    [JSON.stringify([{ product_id: product.id, quantity: 1 }]),
     otherAddr.rows[0]?.id ?? '00000000-0000-0000-0000-000000000000']))
  ok('남의 배송지로 주문 → 거절', !stolenAddr.ok && stolenAddr.code === '42501',
    stolenAddr.ok ? '통과해 버림' : stolenAddr.code)

  const twoArg = await T(() => c.query(`SELECT * FROM public.create_order($1::jsonb, 0)`,
    [JSON.stringify([{ product_id: product.id, quantity: 1 }])]))
  ok('배송지 없이(인자 2개) 부르던 기존 호출도 그대로 동작', twoArg.ok, twoArg.ok ? '' : twoArg.code)

  console.log('\n■ 권한 목록 — 새 테이블에 위험한 권한이 남지 않았는지')
  await svc()
  const grants = await c.query(`SELECT table_name t, grantee g, string_agg(privilege_type,',' ORDER BY privilege_type) p
    FROM information_schema.role_table_grants WHERE table_schema='public'
     AND table_name IN ('payments','user_addresses') AND grantee IN ('anon','authenticated')
     GROUP BY table_name, grantee ORDER BY table_name, grantee`)
  const payAuth = grants.rows.find((r) => r.t === 'payments' && r.g === 'authenticated')
  const payAnon = grants.rows.find((r) => r.t === 'payments' && r.g === 'anon')
  const addrAuth = grants.rows.find((r) => r.t === 'user_addresses' && r.g === 'authenticated')
  ok('payments · authenticated = SELECT 만', payAuth?.p === 'SELECT', payAuth?.p)
  ok('payments · anon = 권한 없음', payAnon === undefined, payAnon?.p)
  ok('user_addresses · authenticated = DELETE,INSERT,SELECT,UPDATE 만',
    addrAuth?.p === 'DELETE,INSERT,SELECT,UPDATE', addrAuth?.p)
  const anyTruncate = await c.query(`SELECT count(*)::int n FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee IN ('anon','authenticated') AND privilege_type='TRUNCATE'`)
  ok('public 스키마 전체에 TRUNCATE 가 열린 테이블 0개', anyTruncate.rows[0].n === 0, `${anyTruncate.rows[0].n}개`)
  await auth(uid)

  console.log('\n■ 결제 내역은 본인 것만 보인다')
  const mine = await c.query(`SELECT count(*)::int n FROM public.payments`)
  ok('내 결제 내역 조회 가능', mine.rows[0].n > 0, `${mine.rows[0].n}건`)
  await svc()
  await c.query(`SELECT public.record_payment_admin($1,'dev','other-1','subscription',5900,NULL,'basic_monthly',NULL)`, [other])
  await auth(uid)
  const notMine = await c.query(`SELECT count(*)::int n FROM public.payments WHERE user_id <> $1`, [uid])
  ok('남의 결제 내역은 보이지 않는다', notMine.rows[0].n === 0, `${notMine.rows[0].n}건`)
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
