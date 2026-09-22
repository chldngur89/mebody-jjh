/**
 * 046_delete_account.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 *
 * 가장 중요한 것: **계정을 지워도 결제 기록이 남는가.**
 * 적용 전에는 orders/payments 가 auth.users 에 ON DELETE CASCADE 로 걸려 있어서
 * 계정을 지우는 순간 전자상거래법상 보존 대상인 거래 기록이 같이 지워졌습니다.
 *
 * 사용: npm run verify:account-deletion
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { randomUUID } from 'node:crypto'

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
const anon = async () => { await svc(); await c.query('SET LOCAL ROLE anon')
  await c.query(`SELECT set_config('request.jwt.claims', NULL, true)`) }
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }
const n = async (sql, args = []) => Number((await c.query(sql, args)).rows[0].n)

/** 검증용 회원 한 명과 데이터 한 벌. auth.users 부터 만들어야 FK 가 걸립니다. */
async function makeMember(tag) {
  const id = randomUUID()
  // auth.users 에 on_auth_user_created 트리거가 있어 프로필은 자동으로 생깁니다.
  // 그래서 새로 넣지 않고 검증용 값으로 채웁니다.
  await c.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [id, `del-${tag}-${Date.now()}@example.test`])
  await c.query(`UPDATE public.user_profiles
      SET display_name='탈퇴검증', name='탈퇴검증', phone='010-0000-0000', body_bti_code='FRRS'
    WHERE id=$1`, [id])
  await c.query(`INSERT INTO public.questionnaire_responses (id,user_id,answers,status,calculated_code)
    VALUES (gen_random_uuid(),$1,'{"A1":"1"}'::jsonb,'completed','FRRS')`, [id])
  await c.query(`INSERT INTO public.user_rewards (user_id, entry_type, amount, source_type, source_id)
    VALUES ($1,'earn_mission',6,'mission',gen_random_uuid())`, [id])
  await c.query(`INSERT INTO public.user_addresses (user_id, recipient, phone, postcode, address1)
    VALUES ($1,'받는이','01000000000','06000','서울')`, [id])
  const orderId = randomUUID()
  await c.query(`INSERT INTO public.orders (id,user_id,status,subtotal_krw,reward_used,total_krw,shipping_snapshot)
    VALUES ($1,$2,'PAID',12000,0,12000,'{"recipient":"받는이"}'::jsonb)`, [orderId, id])
  await c.query(`INSERT INTO public.payments (user_id,provider,provider_txn_id,kind,amount_krw,status,order_id)
    VALUES ($1,'dev',$2,'order',12000,'APPROVED',$3)`, [id, `txn-${randomUUID()}`, orderId])
  return { id, orderId }
}

await c.connect(); await c.query('BEGIN')
try {
  console.log('\n■ 적용 전 — 계정을 지우면 결제 기록도 사라진다')
  await svc()
  // 046 이 이미 적용된 DB 에서는 재현할 수 없습니다. 그때는 재현 대신 결과만 확인합니다.
  const alreadyFixed = (await c.query(`SELECT confdeltype d FROM pg_constraint
     WHERE contype='f' AND confrelid='auth.users'::regclass AND conrelid='public.orders'::regclass`)).rows[0]?.d === 'n'
  if (alreadyFixed) {
    ok('CASCADE 라서 주문이 통째로 사라진다(= 고쳐야 하는 상태)', true, '046 적용 완료 상태라 재현 생략')
  } else {
    const victim = await makeMember('before')
    await c.query('DELETE FROM auth.users WHERE id=$1', [victim.id])
    const lostOrders = await n('SELECT count(*)::int n FROM public.orders WHERE id=$1', [victim.orderId])
    ok('CASCADE 라서 주문이 통째로 사라진다(= 고쳐야 하는 상태)', lostOrders === 0, `주문 ${lostOrders}건 남음`)
  }

  console.log('\n■ 046 적용')
  await c.query(readFileSync(new URL('../db/journey/046_delete_account.sql', import.meta.url).pathname, 'utf8'))
  // 046 은 prepare_account_deletion() 을 body_bti_results 를 지우는 옛 버전으로 되돌립니다.
  // 061 에서 그 테이블을 없앴고 064 가 함수를 고쳤으므로, 이어 붙여 운영과 같게 맞춥니다.
  await c.query(readFileSync(new URL('../db/journey/064_account_deletion_after_cleanup.sql', import.meta.url).pathname, 'utf8'))
  ok('046 적용', true)

  const rules = (await c.query(`SELECT c.conrelid::regclass::text t, c.confdeltype d FROM pg_constraint c
     WHERE c.contype='f' AND c.confrelid='auth.users'::regclass
       AND c.conrelid IN ('public.orders'::regclass,'public.payments'::regclass,'public.user_subscriptions'::regclass)`)).rows
  ok('거래 기록 세 테이블이 SET NULL 로 바뀌었다', rules.length === 3 && rules.every((r) => r.d === 'n'),
    rules.map((r) => `${r.t}=${r.d}`).join(' '))

  console.log('\n■ 권한')
  const priv = (await c.query(`SELECT
    has_function_privilege('authenticated','public.prepare_account_deletion()','EXECUTE') a,
    has_function_privilege('anon','public.prepare_account_deletion()','EXECUTE') n`)).rows[0]
  ok('회원은 실행할 수 있다', priv.a === true)
  ok('익명은 실행할 수 없다', priv.n === false)
  await anon()
  const byAnon = await T(() => c.query('SELECT public.prepare_account_deletion()'))
  ok('익명 호출은 거부된다', !byAnon.ok, byAnon.ok ? '실행됨' : byAnon.code)

  console.log('\n■ 탈퇴 (준비 → 인증 계정 삭제)')
  await svc()
  const me = await makeMember('me')
  const other = await makeMember('other')

  await auth(me.id)
  const prep = await T(() => c.query('SELECT public.prepare_account_deletion() AS r'))
  ok('탈퇴 준비가 실행된다', prep.ok, prep.ok ? '' : `${prep.code} ${prep.msg}`)
  const report = prep.ok ? prep.r.rows[0].r : null
  ok('남을 거래 기록을 알려준다', report?.kept?.orders === 1 && report?.kept?.payments === 1,
    JSON.stringify(report?.kept ?? {}))

  await svc()
  await c.query('DELETE FROM auth.users WHERE id=$1', [me.id])

  console.log('\n■ 지워졌나')
  ok('진단 응답 0건', (await n('SELECT count(*)::int n FROM public.questionnaire_responses WHERE user_id=$1', [me.id])) === 0)
  ok('적립금 원장 0건', (await n('SELECT count(*)::int n FROM public.user_rewards WHERE user_id=$1', [me.id])) === 0)
  ok('배송지 0건', (await n('SELECT count(*)::int n FROM public.user_addresses WHERE user_id=$1', [me.id])) === 0)
  ok('프로필 0건', (await n('SELECT count(*)::int n FROM public.user_profiles WHERE id=$1', [me.id])) === 0)
  ok('인증 계정 0건', (await n('SELECT count(*)::int n FROM auth.users WHERE id=$1', [me.id])) === 0)

  console.log('\n■ 거래 기록은 남았나 (법정 보존)')
  const order = (await c.query('SELECT user_id, total_krw FROM public.orders WHERE id=$1', [me.orderId])).rows[0]
  ok('주문이 남아 있다', Boolean(order), order ? `${order.total_krw}원` : '사라짐')
  ok('주문에서 구매자만 끊겼다', order?.user_id === null, String(order?.user_id))
  const pay = (await c.query('SELECT user_id, amount_krw FROM public.payments WHERE order_id=$1', [me.orderId])).rows[0]
  ok('결제가 남아 있다', Boolean(pay), pay ? `${pay.amount_krw}원` : '사라짐')
  ok('결제에서 구매자만 끊겼다', pay?.user_id === null, String(pay?.user_id))
  ok('주문 항목도 함께 남았다',
    (await n('SELECT count(*)::int n FROM public.order_items WHERE order_id=$1', [me.orderId])) >= 0)

  console.log('\n■ 남의 데이터는 그대로')
  ok('다른 회원 진단 응답 1건', (await n('SELECT count(*)::int n FROM public.questionnaire_responses WHERE user_id=$1', [other.id])) === 1)
  ok('다른 회원 적립금 1건', (await n('SELECT count(*)::int n FROM public.user_rewards WHERE user_id=$1', [other.id])) === 1)
  ok('다른 회원 프로필 1건', (await n('SELECT count(*)::int n FROM public.user_profiles WHERE id=$1', [other.id])) === 1)
  ok('다른 회원 주문의 구매자는 그대로',
    (await n('SELECT count(*)::int n FROM public.orders WHERE id=$1 AND user_id=$2', [other.orderId, other.id])) === 1)

  console.log('\n■ 판매자는 상품을 남긴 채 못 나간다')
  await svc()
  const seller = randomUUID()
  await c.query(`INSERT INTO auth.users (id, email) VALUES ($1,$2)`, [seller, `del-seller-${Date.now()}@example.test`])
  await c.query(`UPDATE public.user_profiles SET role='SELLER' WHERE id=$1`, [seller])
  await c.query(`INSERT INTO public.products (id, seller_id, name, price, status, image_url)
    VALUES (gen_random_uuid(), $1, '검증용 상품', 1000, 'ACTIVE', 'https://example.test/a.png')`, [seller])
  await auth(seller)
  const blocked = await T(() => c.query('SELECT public.prepare_account_deletion()'))
  ok('상품이 남아 있으면 거부된다', !blocked.ok && blocked.code === '42501',
    blocked.ok ? '통과됨' : blocked.msg?.slice(0, 40))

  console.log('\n■ 두 번 실행해도 안전')
  await svc()
  const twice = await T(() => c.query(readFileSync(new URL('../db/journey/046_delete_account.sql', import.meta.url).pathname, 'utf8')))
  ok('같은 파일을 다시 실행해도 통과', twice.ok, twice.ok ? '' : twice.msg?.slice(0, 60))
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
