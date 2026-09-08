/**
 * 036_routine_bonus_reward.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 * 사용: npm run verify:routine-bonus
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

await c.connect(); await c.query('BEGIN')
try {
  console.log('\n■ 마이그레이션 적용')
  await c.query(readFileSync(new URL('../db/journey/036_routine_bonus_reward.sql', import.meta.url).pathname, 'utf8'))
  ok('036 적용', true)

  const uid = (await c.query('SELECT id FROM auth.users WHERE email=$1', [EMAIL])).rows[0].id
  await svc()
  await c.query('DELETE FROM public.user_rewards WHERE user_id=$1', [uid])
  await c.query('DELETE FROM public.user_subscriptions WHERE user_id=$1', [uid])

  console.log('\n■ 기본 적립 전에는 보너스를 못 받는다')
  await auth(uid)
  const s0 = (await c.query('SELECT * FROM public.today_routine_bonus()')).rows[0]
  ok('eligible=false, reason=routine_not_done', s0.eligible === false && s0.reason === 'routine_not_done', s0.reason)
  const early = await T(() => c.query('SELECT * FROM public.claim_routine_bonus_reward()'))
  ok('기본 적립 없이 보너스 요청 거부', !early.ok, early.ok ? '지급됨' : early.code)

  console.log('\n■ 기본 → 보너스 순서')
  const base = (await c.query('SELECT * FROM public.claim_daily_routine_reward()')).rows[0]
  ok('기본 주사위 지급', base.amount >= 1 && base.amount <= 6, `주사위 ${base.dice} → ${base.amount}원`)
  const s1 = (await c.query('SELECT * FROM public.today_routine_bonus()')).rows[0]
  ok('이제 eligible=true', s1.eligible === true && s1.reason === 'ready', s1.reason)

  const b1 = (await c.query('SELECT * FROM public.claim_routine_bonus_reward()')).rows[0]
  ok('보너스 주사위 1~6', b1.dice >= 1 && b1.dice <= 6, `주사위 ${b1.dice} → ${b1.amount}원`)
  ok('보너스는 배수 없이 눈 그대로', b1.amount === b1.dice, `${b1.dice} = ${b1.amount}`)
  ok('잔액 = 기본 + 보너스', Number(b1.balance) === base.amount + b1.amount,
     `${base.amount} + ${b1.amount} = ${b1.balance}`)
  ok('하루 최대 12원 이내', Number(b1.balance) <= 12, `${b1.balance}원`)

  console.log('\n■ 하루 1회')
  const b2 = (await c.query('SELECT * FROM public.claim_routine_bonus_reward()')).rows[0]
  ok('두 번째는 already_claimed', b2.already_claimed === true)
  ok('잔액 안 늘어남', Number(b2.balance) === Number(b1.balance), `${b1.balance} → ${b2.balance}`)
  ok('같은 눈 반환', b2.dice === b1.dice, `${b1.dice} vs ${b2.dice}`)
  const n = (await c.query(`SELECT count(*)::int n FROM public.user_rewards
    WHERE user_id=$1 AND entry_type='earn_routine_bonus'`, [uid])).rows[0].n
  ok('원장에 1행만', n === 1, `${n}행`)
  const s2 = (await c.query('SELECT * FROM public.today_routine_bonus()')).rows[0]
  ok('조회는 claimed=true', s2.claimed === true && s2.eligible === false, s2.reason)

  console.log('\n■ 유료 회원은 보너스가 없다')
  await svc()
  await c.query(`INSERT INTO public.user_subscriptions (user_id,plan_code,status,current_period_end)
    VALUES ($1,'basic_monthly','active', now() + interval '30 days')`, [uid])
  await c.query(`DELETE FROM public.user_rewards WHERE user_id=$1 AND entry_type='earn_routine_bonus'`, [uid])
  await auth(uid)
  const s3 = (await c.query('SELECT * FROM public.today_routine_bonus()')).rows[0]
  ok('멤버십은 eligible=false, reason=membership', s3.eligible === false && s3.reason === 'membership', s3.reason)
  const paid = await T(() => c.query('SELECT * FROM public.claim_routine_bonus_reward()'))
  ok('멤버십 보너스 요청 거부 (화면 아닌 함수에서)', !paid.ok, paid.ok ? '지급됨' : paid.code)

  console.log('\n■ 다음 날은 다시 받을 수 있다')
  await svc()
  await c.query(`DELETE FROM public.user_subscriptions WHERE user_id=$1`, [uid])
  await c.query(`UPDATE public.user_rewards
    SET source_id = md5($1::text || ':routine:' || (public.mebody_service_day() - 1)::text)::uuid
    WHERE user_id=$1 AND entry_type='earn_routine'`, [uid])
  await auth(uid)
  const s4 = (await c.query('SELECT * FROM public.today_routine_bonus()')).rows[0]
  ok('어제 기본 적립은 오늘로 안 잡힘', s4.reason === 'routine_not_done', s4.reason)

  console.log('\n■ 비회원')
  await anon()
  const a1 = await T(() => c.query('SELECT * FROM public.claim_routine_bonus_reward()'))
  ok('비회원 보너스 차단', !a1.ok, a1.ok ? '호출됨' : a1.code)
  const a2 = await T(() => c.query('SELECT * FROM public.today_routine_bonus()'))
  ok('비회원 조회 차단', !a2.ok, a2.ok ? '호출됨' : a2.code)

  console.log('\n■ 고지 문구')
  const rule = (await c.query(`SELECT display_label, disclosure, max_amount FROM public.reward_rules WHERE code='routine_bonus_dice'`)).rows[0]
  ok('표시 최대 6원이 실제 도달 가능', rule.max_amount === 6, `${rule.max_amount}원`)
  ok('선택이라는 점이 고지에 있음', /선택/.test(rule.disclosure))
  ok('안 봐도 기본 적립은 받는다는 점이 고지에 있음', /보지 않아도/.test(rule.disclosure))
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
