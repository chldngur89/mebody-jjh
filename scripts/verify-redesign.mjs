/**
 * 037_redesign.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 * 사용: npm run verify:redesign
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

/** 특정 서비스 날짜에 공통 스트레칭을 완료한 것처럼 원장에 심는다 */
const seedDay = (uid, day, amount = 3) => c.query(`INSERT INTO public.user_rewards
  (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, memo, created_at)
  VALUES ($1::uuid,'earn_routine','daily_routine_dice',$2::int,'free','routine',
          md5($1::uuid::text || ':routine:' || $3::date::text)::uuid,
          jsonb_build_object('dice',$2::int,'service_day',$3::date)::text,
          ($3::date + time '12:00') AT TIME ZONE 'Asia/Seoul')`, [uid, amount, day])

await c.connect(); await c.query('BEGIN')
try {
  console.log('\n■ 마이그레이션 적용')
  await c.query(readFileSync(new URL('../db/journey/037_redesign.sql', import.meta.url).pathname, 'utf8'))
  ok('037 적용', true)

  const uid = (await c.query('SELECT id FROM auth.users WHERE email=$1', [EMAIL])).rows[0].id
  await svc()
  await c.query('DELETE FROM public.user_rewards WHERE user_id=$1', [uid])
  await c.query('DELETE FROM public.user_subscriptions WHERE user_id=$1', [uid])

  const today = (await c.query('SELECT public.mebody_service_day()::text d')).rows[0].d
  const weekStart = (await c.query(`SELECT date_trunc('week', $1::date)::text d`, [today])).rows[0].d

  console.log('\n■ 수행 이력 (routine_history)')
  await svc()
  await seedDay(uid, weekStart, 3)
  await c.query(`SELECT 1`)
  const d2 = (await c.query(`SELECT ($1::date + 1::int)::text d`, [weekStart])).rows[0].d
  await seedDay(uid, d2, 5)
  await auth(uid)
  const hist = (await c.query(`SELECT service_day::text d, base_amount, bonus_amount
    FROM public.routine_history($1::date, ($1::date + 6::int))`, [weekStart])).rows
  ok('이력 2일', hist.length === 2, hist.map(h => `${h.d}:${h.base_amount}`).join(' '))
  ok('금액 정확', hist[0]?.base_amount === 3 && hist[1]?.base_amount === 5,
     `${hist[0]?.base_amount}, ${hist[1]?.base_amount}`)
  ok('안 한 날은 안 나옴', !hist.some(h => h.base_amount === 0))

  console.log('\n■ 주간 챌린지')
  const s1 = (await c.query('SELECT * FROM public.routine_challenge_status()')).rows[0]
  ok('이번 주 2일 / 7일', s1.week_done === 2 && s1.week_required === 7, `${s1.week_done}/${s1.week_required}`)
  const w1 = (await c.query('SELECT * FROM public.claim_weekly_challenge()')).rows[0]
  ok('7일 미달이면 미지급', w1.amount === 0, `${w1.amount}원 (${w1.done_days}/${w1.required})`)

  await svc()
  for (let i = 2; i < 7; i++) {
    const day = (await c.query(`SELECT ($1::date + $2::int)::text d`, [weekStart, i])).rows[0].d
    await seedDay(uid, day, 2)
  }
  await auth(uid)
  const w2 = (await c.query('SELECT * FROM public.claim_weekly_challenge()')).rows[0]
  ok('7일 채우면 지급', w2.amount === 20 && w2.already_claimed === false, `${w2.amount}원 (${w2.done_days}/7)`)
  const w3 = (await c.query('SELECT * FROM public.claim_weekly_challenge()')).rows[0]
  ok('같은 주 재요청 미지급', w3.already_claimed === true && w3.balance === w2.balance,
     `already=${w3.already_claimed}, 잔액 ${w2.balance}→${w3.balance}`)
  const wn = (await c.query(`SELECT count(*)::int n FROM public.user_rewards
    WHERE user_id=$1 AND entry_type='earn_weekly'`, [uid])).rows[0].n
  ok('주간 원장 1행', wn === 1, `${wn}행`)
  const s2 = (await c.query('SELECT * FROM public.routine_challenge_status()')).rows[0]
  ok('조회에 week_claimed=true', s2.week_claimed === true)

  console.log('\n■ 월간 챌린지')
  const m1 = (await c.query('SELECT * FROM public.claim_monthly_challenge()')).rows[0]
  ok('20일 미달이면 미지급', m1.amount === 0, `${m1.amount}원 (${m1.done_days}/${m1.required})`)

  await svc()
  const monthStart = (await c.query(`SELECT date_trunc('month', $1::date)::text d`, [today])).rows[0].d
  for (let i = 0; i < 25; i++) {
    const day = (await c.query(`SELECT ($1::date + $2::int)::text d`, [monthStart, i])).rows[0].d
    await c.query(`INSERT INTO public.user_rewards
      (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id, memo, created_at)
      VALUES ($1::uuid,'earn_routine','daily_routine_dice',1,'free','routine',
              md5($1::uuid::text || ':routine:' || $2::date::text)::uuid,
              jsonb_build_object('dice',1,'service_day',$2::date)::text,
              ($2::date + time '12:00') AT TIME ZONE 'Asia/Seoul')
      ON CONFLICT (user_id, entry_type, source_id) DO NOTHING`, [uid, day])
  }
  await auth(uid)
  const m2 = (await c.query('SELECT * FROM public.claim_monthly_challenge()')).rows[0]
  ok('20일 이상이면 지급', m2.amount === 50 && m2.already_claimed === false, `${m2.amount}원 (${m2.done_days}/20)`)
  const m3 = (await c.query('SELECT * FROM public.claim_monthly_challenge()')).rows[0]
  ok('같은 달 재요청 미지급', m3.already_claimed === true && m3.balance === m2.balance)

  console.log('\n■ 적립 내역')
  const hist2 = (await c.query('SELECT * FROM public.reward_history(50)')).rows
  ok('내역이 최신순', hist2.length > 0 && new Date(hist2[0].created_at) >= new Date(hist2[hist2.length - 1].created_at))
  ok('한글 라벨', hist2.some(h => h.label === '공통 스트레칭') && hist2.some(h => h.label === '주간 완주'),
     [...new Set(hist2.map(h => h.label))].join(', '))
  const bal = (await c.query('SELECT sum(amount)::int s FROM public.user_rewards WHERE user_id=$1', [uid])).rows[0]
  ok('내역 합계 = 잔액', hist2.reduce((a, h) => a + h.amount, 0) === bal.s, `${bal.s}원`)

  console.log('\n■ 마켓 카테고리 · 프로필')
  await svc()
  const cats = (await c.query(`SELECT category, count(*)::int n FROM public.products GROUP BY category ORDER BY category`)).rows
  ok('모든 상품에 카테고리', !cats.some(r => r.category === null), cats.map(r => `${r.category}:${r.n}`).join(' '))
  const cols = (await c.query(`SELECT column_name FROM information_schema.columns
    WHERE table_name='user_profiles' AND column_name IN ('height_cm','weight_kg')`)).rows
  ok('키·몸무게 컬럼', cols.length === 2, cols.map(r => r.column_name).join(','))

  console.log('\n■ 권한')
  await svc()
  const other = (await c.query('SELECT id FROM auth.users WHERE id <> $1 LIMIT 1', [uid])).rows[0]?.id
  await auth(uid)
  if (other) {
    const peek = await T(() => c.query('SELECT * FROM public.routine_week_progress($1)', [other]))
    ok('타인 진행률 직접 조회 차단', !peek.ok, peek.ok ? '조회됨' : peek.code)
  } else {
    ok('타인 진행률 직접 조회 차단 (다른 계정 없음 — 건너뜀)', true, 'skipped')
  }
  await anon()
  for (const [label, sql] of [
    ['routine_history', 'SELECT * FROM public.routine_history(current_date, current_date)'],
    ['routine_challenge_status', 'SELECT * FROM public.routine_challenge_status()'],
    ['claim_weekly_challenge', 'SELECT * FROM public.claim_weekly_challenge()'],
    ['claim_monthly_challenge', 'SELECT * FROM public.claim_monthly_challenge()'],
    ['reward_history', 'SELECT * FROM public.reward_history(10)'],
  ]) {
    const r = await T(() => c.query(sql))
    ok(`비회원 ${label} 차단`, !r.ok, r.ok ? '호출됨' : r.code)
  }

  console.log('\n■ 고지 문구')
  await svc()
  const rules = (await c.query(`SELECT code, fixed_amount, disclosure FROM public.reward_rules
    WHERE code IN ('weekly_challenge','monthly_challenge') ORDER BY code`)).rows
  ok('주간 20원 · 월간 50원', rules.find(r => r.code === 'weekly_challenge')?.fixed_amount === 20
     && rules.find(r => r.code === 'monthly_challenge')?.fixed_amount === 50)
  ok('오전 5시 기준 고지', rules.every(r => /오전 5시/.test(r.disclosure)))
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
