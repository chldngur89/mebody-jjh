/**
 * 042_fulfillment_and_ssv.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 *
 * 확인하는 것:
 *   · 배송 상태가 앞으로만 가는가, 송장 없이 발송 처리되지 않는가
 *   · 결제 완료 주문 취소가 적립금을 정확히 되돌리는가(환불 + 구매적립 회수)
 *   · 배송이 시작된 주문은 취소되지 않는가
 *   · 앱(authenticated)이 이 함수들을 부를 수 없는가
 *   · 보상형 보너스를 서버가 지급할 때 앱 경로와 같은 슬롯을 쓰는가(중복 지급 없음)
 *
 * 사용: npm run verify:fulfillment
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

/** 결제까지 끝난 주문을 하나 만든다 */
async function paidOrder(uid, productId, rewardToUse = 0) {
  await auth(uid)
  const o = await c.query(`SELECT * FROM public.create_order($1::jsonb, $2)`,
    [JSON.stringify([{ product_id: productId, quantity: 1 }]), rewardToUse])
  const orderId = o.rows[0].order_id
  await svc()
  const pay = await c.query(
    `SELECT * FROM public.record_payment_admin($1,'dev',$2,'order',$3,$4,NULL,NULL)`,
    [uid, `ff-${orderId}`, Number(o.rows[0].total), orderId])
  await c.query(`SELECT public.mark_order_paid_admin($1,$2)`, [orderId, pay.rows[0].payment_id])
  return { orderId, total: Number(o.rows[0].total), rewardUsed: Number(o.rows[0].reward_used) }
}

await c.connect(); await c.query('BEGIN')
try {
  console.log('\n■ 마이그레이션 적용')
  await c.query(readFileSync(new URL('../db/journey/042_fulfillment_and_ssv.sql', import.meta.url).pathname, 'utf8'))
  ok('042 적용', true)

  await svc()
  const uid = (await c.query('SELECT id FROM auth.users WHERE email=$1', [EMAIL])).rows[0].id
  const other = (await c.query('SELECT id FROM auth.users WHERE email<>$1 LIMIT 1', [EMAIL])).rows[0].id
  const product = (await c.query(
    `SELECT id, price FROM public.products WHERE status='ACTIVE' AND price IS NOT NULL LIMIT 1`)).rows[0]

  // 이 트랜잭션 안에서만 시작 상태를 비운다
  await c.query('DELETE FROM public.user_subscriptions WHERE user_id=$1', [uid])
  await c.query('DELETE FROM public.orders WHERE user_id=$1', [uid])
  await c.query('DELETE FROM public.user_rewards WHERE user_id=$1', [uid])

  console.log('\n■ 앱은 배송·취소 함수를 부를 수 없다')
  const o1 = await paidOrder(uid, product.id)
  await auth(uid)
  const f1 = await T(() => c.query(`SELECT public.set_order_fulfillment_admin($1,'PREPARING',NULL,NULL)`, [o1.orderId]))
  ok('set_order_fulfillment_admin 호출 → 거절', !f1.ok && f1.code === '42501', f1.ok ? '통과해 버림' : f1.code)
  const f2 = await T(() => c.query(`SELECT public.cancel_paid_order_admin($1,$2,NULL)`, [o1.orderId, uid]))
  ok('cancel_paid_order_admin 호출 → 거절', !f2.ok && f2.code === '42501', f2.ok ? '통과해 버림' : f2.code)
  const f3 = await T(() => c.query(`SELECT public.grant_routine_bonus_admin($1)`, [uid]))
  ok('grant_routine_bonus_admin 호출 → 거절', !f3.ok && f3.code === '42501', f3.ok ? '통과해 버림' : f3.code)
  const f4 = await T(() => c.query(`UPDATE public.orders SET fulfillment_status='DELIVERED' WHERE id=$1`, [o1.orderId]))
  ok('배송 상태 직접 UPDATE → 거절', !f4.ok && f4.code === '42501', f4.ok ? '통과해 버림' : f4.code)
  const f5 = await T(() => c.query(`SELECT count(*)::int FROM public.ad_reward_callbacks`))
  ok('SSV 콜백 원장은 앱에서 읽을 수 없다', !f5.ok && f5.code === '42501', f5.ok ? '읽힘' : f5.code)

  console.log('\n■ 배송 상태')
  await svc()
  const noTracking = await T(() => c.query(`SELECT public.set_order_fulfillment_admin($1,'SHIPPED',NULL,NULL)`, [o1.orderId]))
  ok('송장 없이 발송 처리 → 거절', !noTracking.ok && noTracking.code === '22023', noTracking.ok ? '통과해 버림' : noTracking.msg)

  const prep = await c.query(`SELECT * FROM public.set_order_fulfillment_admin($1,'PREPARING',NULL,NULL)`, [o1.orderId])
  ok('배송 준비로 변경', prep.rows[0].fulfillment_status === 'PREPARING')

  const shipped = await c.query(`SELECT * FROM public.set_order_fulfillment_admin($1,'SHIPPED','CJ대한통운','123456789')`, [o1.orderId])
  ok('송장과 함께 발송 처리', shipped.rows[0].fulfillment_status === 'SHIPPED' && shipped.rows[0].tracking_no === '123456789')
  ok('발송 시각이 기록된다',
    (await c.query(`SELECT shipped_at FROM public.orders WHERE id=$1`, [o1.orderId])).rows[0].shipped_at !== null)

  const back = await T(() => c.query(`SELECT public.set_order_fulfillment_admin($1,'PREPARING',NULL,NULL)`, [o1.orderId]))
  ok('배송 상태를 되돌리려 하면 → 거절', !back.ok && back.code === '22023', back.ok ? '되돌아감' : back.msg)

  const badStatus = await T(() => c.query(`SELECT public.set_order_fulfillment_admin($1,'WHATEVER',NULL,NULL)`, [o1.orderId]))
  ok('없는 배송 상태 → 거절', !badStatus.ok && badStatus.code === '22023', badStatus.ok ? '통과해 버림' : badStatus.code)

  console.log('\n■ 배송 시작 후에는 취소할 수 없다')
  const tooLate = await T(() => c.query(`SELECT public.cancel_paid_order_admin($1,$2,NULL)`, [o1.orderId, uid]))
  ok('발송된 주문 취소 → 거절', !tooLate.ok && tooLate.code === '22023', tooLate.ok ? '취소돼 버림' : tooLate.msg)

  console.log('\n■ 결제 완료 주문 취소 — 적립금 정산')
  // 적립금을 만들어 두고, 그걸 일부 사용한 주문을 만든다
  await c.query(`INSERT INTO public.user_rewards (user_id, entry_type, amount, issue_type, source_type, source_id, memo)
    VALUES ($1,'earn_mission',5000,'free','mission',gen_random_uuid(),'검증용 잔액')`, [uid])
  const before = Number((await c.query(`SELECT public.reward_balance($1) b`, [uid])).rows[0].b)

  const o2 = await paidOrder(uid, product.id, 1000)
  ok('적립금 1000원을 쓴 주문 생성', o2.rewardUsed === 1000, `총 ${o2.total}원`)

  // 멤버십이 있어야 구매 적립 5% 가 붙는다
  await svc()
  await c.query(`SELECT public.activate_subscription_admin($1,'basic_monthly',30)`, [uid])
  await auth(uid)
  const claim = await c.query(`SELECT * FROM public.claim_purchase_reward($1)`, [o2.orderId])
  const earned = Number(claim.rows[0].amount)
  ok('구매 적립 5% 지급', earned === Math.floor(o2.total * 5 / 100), `${earned}원`)

  // reward_balance 는 앱 역할에 EXECUTE 가 없다(앱은 user_rewards 를 직접 합산한다).
  await svc()
  const afterPurchase = Number((await c.query(`SELECT public.reward_balance($1) b`, [uid])).rows[0].b)
  ok('잔액 = 시작 − 사용 + 적립', afterPurchase === before - 1000 + earned,
    `${before} − 1000 + ${earned} = ${afterPurchase}`)

  await svc()
  const cancel = await c.query(`SELECT * FROM public.cancel_paid_order_admin($1,$2,'검증 취소')`, [o2.orderId, uid])
  ok('취소 처리', cancel.rows[0].was_new === true)
  ok('쓴 적립금 환불', Number(cancel.rows[0].refunded) === 1000, `${cancel.rows[0].refunded}원`)
  ok('구매 적립 회수', Number(cancel.rows[0].clawed_back) === earned, `${cancel.rows[0].clawed_back}원`)
  ok('잔액이 주문 전으로 정확히 돌아온다', Number(cancel.rows[0].balance) === before,
    `${afterPurchase} → ${cancel.rows[0].balance} (주문 전 ${before})`)

  const orderRow = (await c.query(`SELECT status, canceled_at FROM public.orders WHERE id=$1`, [o2.orderId])).rows[0]
  ok('주문이 CANCELED 로 바뀌고 취소 시각이 남는다', orderRow.status === 'CANCELED' && orderRow.canceled_at !== null)
  ok('결제 원장도 CANCELED 로 바뀐다',
    (await c.query(`SELECT status FROM public.payments WHERE order_id=$1`, [o2.orderId])).rows[0].status === 'CANCELED')

  const again = await c.query(`SELECT * FROM public.cancel_paid_order_admin($1,$2,NULL)`, [o2.orderId, uid])
  ok('같은 주문을 다시 취소 → 아무 일도 없음(멱등)', again.rows[0].was_new === false)
  ok('두 번 취소해도 잔액이 그대로', Number(again.rows[0].balance) === before, `${again.rows[0].balance}`)

  const foreign = await T(() => c.query(`SELECT public.cancel_paid_order_admin($1,$2,NULL)`, [o1.orderId, other]))
  ok('남의 주문을 취소하려 하면 → 거절', !foreign.ok && foreign.code === '42501', foreign.ok ? '취소돼 버림' : foreign.code)

  console.log('\n■ 적립 내역 라벨')
  await auth(uid)
  const hist = await c.query(`SELECT entry_type, label FROM public.reward_history(50)`)
  const labels = Object.fromEntries(hist.rows.map((r) => [r.entry_type, r.label]))
  ok('취소로 회수된 적립이 "구매 적립 회수" 로 보인다', labels.expire === '구매 적립 회수', labels.expire)
  ok('환불이 "주문 취소 환불" 로 보인다', labels.refund_order === '주문 취소 환불', labels.refund_order)

  console.log('\n■ 보상형 보너스 — 서버 지급')
  await svc()
  // 유료 회원은 광고가 없으므로 보너스도 없다
  const paidBonus = await T(() => c.query(`SELECT public.grant_routine_bonus_admin($1)`, [uid]))
  ok('유료 회원에게는 보너스를 주지 않는다', !paidBonus.ok && paidBonus.code === '42501',
    paidBonus.ok ? '지급돼 버림' : paidBonus.code)

  await c.query('DELETE FROM public.user_subscriptions WHERE user_id=$1', [uid])
  const noBase = await T(() => c.query(`SELECT public.grant_routine_bonus_admin($1)`, [uid]))
  ok('기본 적립 전에는 보너스를 주지 않는다', !noBase.ok && noBase.code === '42501',
    noBase.ok ? '지급돼 버림' : noBase.code)

  // 기본 적립을 만든다
  await auth(uid)
  const base = await c.query(`SELECT * FROM public.claim_daily_routine_reward()`)
  ok('기본 적립 지급', Number(base.rows[0].amount) > 0, `${base.rows[0].amount}원`)

  await svc()
  const bonus = await c.query(`SELECT * FROM public.grant_routine_bonus_admin($1)`, [uid])
  ok('서버가 보너스를 지급', bonus.rows[0].already_claimed === false && Number(bonus.rows[0].amount) >= 1,
    `주사위 ${bonus.rows[0].dice} · ${bonus.rows[0].amount}원`)
  ok('보너스는 1~6원', Number(bonus.rows[0].amount) >= 1 && Number(bonus.rows[0].amount) <= 6)

  const bonusAgain = await c.query(`SELECT * FROM public.grant_routine_bonus_admin($1)`, [uid])
  ok('서버가 두 번 불러도 한 번만 지급(멱등)', bonusAgain.rows[0].already_claimed === true)

  // 앱 경로와 같은 슬롯인지 — 서버가 이미 줬으면 앱은 already 를 받아야 한다
  await auth(uid)
  const appClaim = await c.query(`SELECT * FROM public.claim_routine_bonus_reward()`)
  ok('앱이 이어서 청구해도 중복 지급되지 않는다', appClaim.rows[0].already_claimed === true,
    `${appClaim.rows[0].amount}원`)
  ok('앱과 서버가 같은 금액을 본다', Number(appClaim.rows[0].amount) === Number(bonus.rows[0].amount))

  console.log('\n■ SSV 콜백 원장')
  await svc()
  await c.query(`INSERT INTO public.ad_reward_callbacks (transaction_id, user_id, ad_unit, reward_amount, status)
    VALUES ('txn-1',$1,'unit-1',1,'GRANTED')`, [uid])
  const dup = await T(() => c.query(`INSERT INTO public.ad_reward_callbacks (transaction_id, user_id, status)
    VALUES ('txn-1',$1,'GRANTED')`, [uid]))
  ok('같은 거래 ID 재전송 → 23505 (중복 지급 차단)', !dup.ok && dup.code === '23505', dup.ok ? '중복 허용됨' : dup.code)

  const grants = await c.query(`SELECT count(*)::int n FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='ad_reward_callbacks' AND grantee IN ('anon','authenticated')`)
  ok('앱 역할에 원장 권한이 없다', grants.rows[0].n === 0, `${grants.rows[0].n}개`)

  const anyTruncate = await c.query(`SELECT count(*)::int n FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee IN ('anon','authenticated') AND privilege_type='TRUNCATE'`)
  ok('public 스키마에 TRUNCATE 가 열린 테이블 0개', anyTruncate.rows[0].n === 0, `${anyTruncate.rows[0].n}개`)
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
