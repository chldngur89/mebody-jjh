/**
 * 054_analytics_events.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 *
 * 두 가지를 봅니다:
 *   1) 누구나 남길 수 있고 관리자만 읽는가
 *   2) **개인 식별 값이 들어갈 자리가 없는가** (user_id 컬럼이 없어야 합니다)
 *
 * 사용: npm run verify:analytics
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
const anon = async () => { await svc(); await c.query('SET LOCAL ROLE anon')
  await c.query(`SELECT set_config('request.jwt.claims', NULL, true)`) }
const auth = async (id) => { await svc(); await c.query('SET LOCAL ROLE authenticated')
  await c.query(`SELECT set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]) }
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }

const EMAIL = process.env.MEBODY_E2E_EMAIL ?? 'wh.choi@mebody.net'

await c.connect(); await c.query('BEGIN')
try {
  await svc()
  await c.query(readFileSync(new URL('../db/journey/054_analytics_events.sql', import.meta.url).pathname, 'utf8'))
  ok('054 적용', true)

  console.log('\n■ 개인 식별 값이 들어갈 자리가 없는가')
  const cols = (await c.query(`SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='analytics_events' ORDER BY ordinal_position`)).rows.map((r) => r.column_name)
  ok('user_id 컬럼이 없다', !cols.includes('user_id'), cols.join(', '))
  ok('email·phone 컬럼도 없다', !cols.some((x) => /email|phone/.test(x)))

  console.log('\n■ 권한')
  const tr = Number((await c.query(`SELECT count(*)::int n FROM information_schema.role_table_grants
     WHERE table_schema='public' AND privilege_type='TRUNCATE' AND grantee IN ('anon','authenticated')`)).rows[0].n)
  ok('앱 역할에 TRUNCATE 가 열린 테이블 0개', tr === 0, `${tr}개`)
  const g = (await c.query(`SELECT grantee r, string_agg(privilege_type,',' ORDER BY privilege_type) p
     FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='analytics_events' AND grantee IN ('anon','authenticated')
    GROUP BY 1 ORDER BY 1`)).rows
  ok('익명은 INSERT 만', g.find((x) => x.r === 'anon')?.p === 'INSERT', String(g.find((x) => x.r === 'anon')?.p))
  ok('회원은 INSERT,SELECT 만', g.find((x) => x.r === 'authenticated')?.p === 'INSERT,SELECT')

  console.log('\n■ 남기기')
  const sess = randomUUID()
  await anon()
  const ins = await T(() => c.query(
    `INSERT INTO public.analytics_events (event, props, session_id, path) VALUES ($1,$2::jsonb,$3,$4)`,
    ['landing_viewed', JSON.stringify({ ref: 'share' }), sess, '/']))
  ok('익명이 이벤트를 남길 수 있다', ins.ok, ins.ok ? '' : ins.code)

  console.log('\n■ 읽기')
  const anonRead = await T(() => c.query('SELECT count(*) FROM public.analytics_events'))
  ok('익명은 읽지 못한다', !anonRead.ok && anonRead.code === '42501', anonRead.ok ? '읽힘' : anonRead.code)

  await svc()
  const uid = (await c.query('SELECT id FROM auth.users WHERE email=$1', [EMAIL])).rows[0].id
  const role = (await c.query('SELECT role FROM public.user_profiles WHERE id=$1', [uid])).rows[0]?.role
  await auth(uid)
  const memberRead = Number((await c.query('SELECT count(*)::int n FROM public.analytics_events')).rows[0].n)
  if (role === 'ADMIN') {
    ok('관리자는 읽는다', memberRead >= 1, `${memberRead}행 (role=${role})`)
  } else {
    ok('일반 회원은 0행만 본다', memberRead === 0, `${memberRead}행 (role=${role})`)
  }

  console.log('\n■ 쏟아지는 것을 막는가')
  await anon()
  for (let i = 0; i < 65; i += 1) {
    await c.query(`INSERT INTO public.analytics_events (event, session_id) VALUES ('result_viewed',$1)`, [sess])
  }
  await svc()
  const stored = Number((await c.query(
    `SELECT count(*)::int n FROM public.analytics_events WHERE session_id=$1 AND event='result_viewed'`, [sess])).rows[0].n)
  ok('같은 세션의 같은 이벤트가 60건에서 멈춘다', stored === 60, `${stored}건 저장 (65번 시도)`)

  console.log('\n■ 앱이 보내는 모양 그대로')
  await anon()
  const asApp = await T(() => c.query(
    `INSERT INTO public.analytics_events (event, props, session_id, path, app_version)
     VALUES ($1,$2::jsonb,$3,$4,$5)`,
    ['result_share_succeeded', JSON.stringify({ share_channel: 'copy', body_code: 'FRRS' }),
     randomUUID(), '/', '1.0.0']))
  ok('공유 이벤트가 그대로 들어간다', asApp.ok, asApp.ok ? '' : asApp.code)

  console.log('\n■ 두 번 실행해도 안전')
  await svc()
  const twice = await T(() => c.query(readFileSync(new URL('../db/journey/054_analytics_events.sql', import.meta.url).pathname, 'utf8')))
  ok('같은 파일을 다시 실행해도 통과', twice.ok, twice.ok ? '' : String(twice.msg).slice(0, 60))
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
