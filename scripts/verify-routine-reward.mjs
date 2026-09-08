/**
 * 033_daily_routine_reward.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 * 실제 스키마/RLS/권한 위에서 돌므로 앱에서와 같은 조건입니다. 데이터는 남지 않습니다.
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
  await c.query(readFileSync(new URL('../db/journey/033_daily_routine_reward.sql', import.meta.url).pathname, 'utf8'))
  ok('033 적용', true)

  const uid = (await c.query('SELECT id FROM auth.users WHERE email=$1', [EMAIL])).rows[0].id

  console.log('\n■ 하루 경계 — 한국시간 05시')
  const bd = (await c.query(`SELECT
    public.mebody_service_day('2026-09-02 04:59:59+09'::timestamptz)::text a,
    public.mebody_service_day('2026-09-02 05:00:00+09'::timestamptz)::text b,
    public.mebody_service_day('2026-09-02 23:59:00+09'::timestamptz)::text cday,
    public.mebody_service_day('2026-09-03 04:00:00+09'::timestamptz)::text d`)).rows[0]
  const iso = (v) => v
  ok('04:59 KST → 전날', iso(bd.a) === '2026-09-01', iso(bd.a))
  ok('05:00 KST → 당일', iso(bd.b) === '2026-09-02', iso(bd.b))
  ok('23:59 KST → 당일', iso(bd.cday) === '2026-09-02', iso(bd.cday))
  ok('다음날 04:00 KST → 여전히 전날', iso(bd.d) === '2026-09-02', iso(bd.d))

  console.log('\n■ 주사위 분포 — 1~6 균등')
  const draw = await c.query(`SELECT public.draw_reward_amount('daily_routine_dice') v FROM generate_series(1,3000)`)
  const vals = draw.rows.map(r => r.v)
  const min = Math.min(...vals), max = Math.max(...vals)
  const counts = {}; for (const v of vals) counts[v] = (counts[v] ?? 0) + 1
  ok('범위가 1~6', min === 1 && max === 6, `min=${min} max=${max}`)
  ok('6개 눈이 모두 나옴', Object.keys(counts).length === 6, JSON.stringify(counts))
  const share = Object.values(counts).map(n => n / vals.length)
  ok('대략 균등 (각 눈 12~21%)', share.every(s => s > 0.12 && s < 0.21),
     share.map(s => (s * 100).toFixed(1) + '%').join(' '))

  console.log('\n■ 비회원')
  await anon()
  const a1 = await T(() => c.query('SELECT * FROM public.claim_daily_routine_reward()'))
  ok('비회원 적립 차단', !a1.ok, a1.ok ? '호출됨' : a1.code)
  const a2 = await T(() => c.query('SELECT * FROM public.today_routine_reward()'))
  ok('비회원 조회 차단', !a2.ok, a2.ok ? '호출됨' : a2.code)

  console.log('\n■ 회원 — 하루 1회')
  await auth(uid)
  await svc()
  const before = (await c.query('SELECT public.reward_balance($1) b', [uid])).rows[0].b
  await auth(uid)
  const t0 = await c.query('SELECT * FROM public.today_routine_reward()')
  ok('적립 전 claimed=false', t0.rows[0].claimed === false, `claimed=${t0.rows[0].claimed}`)

  const r1 = (await c.query('SELECT * FROM public.claim_daily_routine_reward()')).rows[0]
  ok('1회차 적립됨', r1.already_claimed === false, `주사위 ${r1.dice} → ${r1.amount}원`)
  ok('주사위 1~6', r1.dice >= 1 && r1.dice <= 6, String(r1.dice))
  ok('적립액 = 주사위 x 배수', r1.amount === Math.max(1, Math.round(r1.dice * Number(r1.multiplier))),
     `${r1.dice} x ${r1.multiplier} = ${r1.amount}`)
  ok('잔액 증가', Number(r1.balance) === Number(before) + r1.amount, `${before} → ${r1.balance}`)

  const r2 = (await c.query('SELECT * FROM public.claim_daily_routine_reward()')).rows[0]
  ok('2회차는 already_claimed', r2.already_claimed === true, `already=${r2.already_claimed}`)
  ok('2회차에 잔액 안 늘어남', Number(r2.balance) === Number(r1.balance), `${r1.balance} → ${r2.balance}`)
  ok('2회차 주사위 눈 동일', r2.dice === r1.dice, `${r1.dice} vs ${r2.dice}`)

  const n = (await c.query(`SELECT count(*)::int n FROM public.user_rewards
    WHERE user_id=$1 AND entry_type='earn_routine'`, [uid])).rows[0].n
  ok('원장에 1행만', n === 1, `${n}행`)

  const t1 = (await c.query('SELECT * FROM public.today_routine_reward()')).rows[0]
  ok('적립 후 claimed=true', t1.claimed === true && t1.dice === r1.dice, `dice=${t1.dice}`)

  console.log('\n■ 다음 날은 다시 받을 수 있어야 한다')
  await svc()
  await c.query(`UPDATE public.user_rewards
    SET source_id = md5($1::text || ':routine:' || (public.mebody_service_day() - 1)::text)::uuid
    WHERE user_id=$1 AND entry_type='earn_routine'`, [uid])
  await auth(uid)
  const t2 = (await c.query('SELECT * FROM public.today_routine_reward()')).rows[0]
  ok('어제 것은 오늘로 안 잡힘', t2.claimed === false, `claimed=${t2.claimed}`)
  const r3 = (await c.query('SELECT * FROM public.claim_daily_routine_reward()')).rows[0]
  ok('오늘 다시 적립됨', r3.already_claimed === false, `주사위 ${r3.dice} → ${r3.amount}원`)

  console.log('\n■ 원장 무결성')
  await svc()
  const bad = await T(() => c.query(`INSERT INTO public.user_rewards
    (user_id,entry_type,rule_code,amount,issue_type,source_type,source_id)
    VALUES ($1,'earn_routine','daily_routine_dice',-5,'free','routine',gen_random_uuid())`, [uid]))
  ok('적립인데 음수면 거부', !bad.ok, bad.ok ? '들어감' : bad.code)
  const dup = await T(() => c.query(`INSERT INTO public.user_rewards
    (user_id,entry_type,rule_code,amount,issue_type,source_type,source_id)
    SELECT user_id,entry_type,rule_code,amount,issue_type,source_type,source_id
      FROM public.user_rewards WHERE user_id=$1 AND entry_type='earn_routine' LIMIT 1`, [uid]))
  ok('같은 날 중복 INSERT 거부', !dup.ok, dup.ok ? '들어감' : dup.code)

  console.log('\n■ 고지 문구')
  const disc = (await c.query(`SELECT display_label, disclosure, min_amount, max_amount
    FROM public.reward_rules WHERE code='daily_routine_dice'`)).rows[0]
  ok('최대치가 실제 도달 가능', disc.max_amount === 6, `표시 최대 ${disc.max_amount}원`)
  ok('확률 고지 포함', /1\/6|확률/.test(disc.disclosure), disc.disclosure.slice(0, 40) + '...')
  ok('하루 기준 고지 포함', /오전 5시/.test(disc.disclosure))
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter(r => !r.p)
console.log('\n' + '='.repeat(62))
console.log(fail.length ? `FAIL — ${fail.length}개 실패 / ${res.length - fail.length}개 통과`
                        : `OK — ${res.length}개 검증 모두 통과`)
for (const f of fail) console.log('  - ' + f.l)
process.exit(fail.length ? 1 : 0)
