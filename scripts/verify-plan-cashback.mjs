/**
 * 035_single_plan_and_purchase_reward.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 * 데이터는 남지 않습니다.
 *
 * 사용: npm run verify:plan-cashback
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
const anon = async () => { await svc(); await c.query('SET LOCAL ROLE anon') }
const auth = async (id) => { await svc(); await c.query('SET LOCAL ROLE authenticated')
  await c.query(`SELECT set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]) }
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }

/** 결제 완료 주문 1건을 서비스 롤로 만든다 */
const makeOrder = async (uid, subtotal, rewardUsed = 0) =>
  (await c.query(`INSERT INTO public.orders (user_id, status, subtotal_krw, reward_used, total_krw)
    VALUES ($1,'PAID',$2,$3,$4) RETURNING id`, [uid, subtotal, rewardUsed, subtotal - rewardUsed])).rows[0].id

await c.connect(); await c.query('BEGIN')
try {
  console.log('\n■ 마이그레이션 적용')
  await c.query(readFileSync(new URL('../db/journey/035_single_plan_and_purchase_reward.sql', import.meta.url).pathname, 'utf8'))
  ok('035 적용', true)

  const uid = (await c.query('SELECT id FROM auth.users WHERE email=$1', [EMAIL])).rows[0].id
  await svc()
  await c.query('DELETE FROM public.user_subscriptions WHERE user_id=$1', [uid])

  console.log('\n■ 요금제 단일화')
  const plans = (await c.query(`SELECT code, name, price_krw, reward_multiplier, is_active
    FROM public.membership_plans ORDER BY sort_order`)).rows
  const active = plans.filter((p) => p.is_active)
  ok('활성 요금제가 1개', active.length === 1, active.map((p) => p.code).join(','))
  ok('가격 5,900원', active[0]?.price_krw === 5900, `${active[0]?.price_krw}원`)
  ok('적립 배수 2.0', Number(active[0]?.reward_multiplier) === 2, String(active[0]?.reward_multiplier))
  ok('Pro 는 비활성(삭제 아님)', plans.some((p) => p.code === 'pro_monthly' && !p.is_active))

  console.log('\n■ 배수가 실제 적립에 반영되는가')
  await svc()
  const mFree = (await c.query('SELECT public.reward_multiplier_for($1) m', [uid])).rows[0].m
  ok('무료는 1.0배', Number(mFree) === 1, String(mFree))
  await c.query(`INSERT INTO public.user_subscriptions (user_id, plan_code, status, current_period_end)
    VALUES ($1,'basic_monthly','active', now() + interval '30 days')`, [uid])
  const mPaid = (await c.query('SELECT public.reward_multiplier_for($1) m', [uid])).rows[0].m
  ok('멤버십은 2.0배', Number(mPaid) === 2, String(mPaid))
  const pct = (await c.query('SELECT public.purchase_cashback_percent($1) p', [uid])).rows[0].p
  ok('멤버십 구매 적립 5%', pct === 5, `${pct}%`)

  console.log('\n■ 구매 5% 적립')
  const oid = await makeOrder(uid, 30000)
  await auth(uid)
  const r1 = (await c.query('SELECT * FROM public.claim_purchase_reward($1)', [oid])).rows[0]
  ok('30,000원 → 1,500원 적립', r1.amount === 1500, `${r1.amount}원 (${r1.percent}%)`)
  ok('이 한 건이 주사위 한 달치보다 큼 (2.0배 최대 360원)', r1.amount > 360, `${r1.amount}원 vs 360원`)

  const r2 = (await c.query('SELECT * FROM public.claim_purchase_reward($1)', [oid])).rows[0]
  ok('같은 주문 재지급 안 함', r2.already_claimed === true && r2.balance === r1.balance,
     `already=${r2.already_claimed}, 잔액 ${r1.balance}→${r2.balance}`)
  const n = (await c.query(`SELECT count(*)::int n FROM public.user_rewards
    WHERE user_id=$1 AND entry_type='earn_purchase'`, [uid])).rows[0].n
  ok('원장에 1행만', n === 1, `${n}행`)

  console.log('\n■ 적립금으로 깎은 분에는 적립하지 않는다')
  await svc()
  const oid2 = await makeOrder(uid, 20000, 5000) // 실제 결제 15,000
  await auth(uid)
  const r3 = (await c.query('SELECT * FROM public.claim_purchase_reward($1)', [oid2])).rows[0]
  ok('20,000원 중 5,000원 적립금 사용 → 15,000의 5% = 750원', r3.amount === 750, `${r3.amount}원`)

  console.log('\n■ 무료 회원은 구매 적립 없음')
  await svc()
  await c.query(`UPDATE public.user_subscriptions SET status='canceled' WHERE user_id=$1`, [uid])
  const pctFree = (await c.query('SELECT public.purchase_cashback_percent($1) p', [uid])).rows[0].p
  ok('무료는 0%', pctFree === 0, `${pctFree}%`)
  const oid3 = await makeOrder(uid, 30000)
  await auth(uid)
  const r4 = (await c.query('SELECT * FROM public.claim_purchase_reward($1)', [oid3])).rows[0]
  ok('무료 회원 적립 0원', r4.amount === 0, `${r4.amount}원`)
  const n2 = (await c.query(`SELECT count(*)::int n FROM public.user_rewards
    WHERE user_id=$1 AND entry_type='earn_purchase'`, [uid])).rows[0].n
  ok('0원이면 원장에 남기지 않음', n2 === 2, `${n2}행 (앞의 2건 그대로)`)

  console.log('\n■ 남의 주문 · 미결제 주문')
  await svc()
  const other = (await c.query('SELECT id FROM auth.users WHERE id <> $1 LIMIT 1', [uid])).rows[0]?.id
  if (other) {
    const foreignOrder = await makeOrder(other, 30000)
    await auth(uid)
    const bad = await T(() => c.query('SELECT * FROM public.claim_purchase_reward($1)', [foreignOrder]))
    ok('남의 주문으로 적립 불가', !bad.ok, bad.ok ? '지급됨' : bad.code)
  } else {
    ok('남의 주문으로 적립 불가 (다른 계정 없음 — 건너뜀)', true, 'skipped')
  }
  await svc()
  const pending = (await c.query(`INSERT INTO public.orders (user_id,status,subtotal_krw,reward_used,total_krw)
    VALUES ($1,'PENDING',30000,0,30000) RETURNING id`, [uid])).rows[0].id
  await auth(uid)
  const notPaid = await T(() => c.query('SELECT * FROM public.claim_purchase_reward($1)', [pending]))
  ok('미결제 주문은 적립 불가', !notPaid.ok, notPaid.ok ? '지급됨' : notPaid.code)

  console.log('\n■ 비회원')
  await anon()
  const a1 = await T(() => c.query('SELECT * FROM public.claim_purchase_reward(gen_random_uuid())'))
  ok('비회원 구매 적립 차단', !a1.ok, a1.ok ? '호출됨' : a1.code)
  const a2 = await T(() => c.query('SELECT public.purchase_cashback_percent(gen_random_uuid())'))
  ok('비회원 비율 조회 차단', !a2.ok, a2.ok ? '호출됨' : a2.code)

  console.log('\n■ 고지 문구')
  const rule = (await c.query(`SELECT display_label, disclosure FROM public.reward_rules WHERE code='purchase_cashback'`)).rows[0]
  ok('멤버십 한정임이 고지에 있음', /멤버십/.test(rule.disclosure), rule.display_label)
  ok('취소 시 회수됨이 고지에 있음', /취소/.test(rule.disclosure))
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log('\n' + '='.repeat(62))
console.log(fail.length ? `FAIL — ${fail.length}개 실패 / ${res.length - fail.length}개 통과`
                        : `OK — ${res.length}개 검증 모두 통과`)
for (const f of fail) console.log('  - ' + f.l)
process.exit(fail.length ? 1 : 0)
