/**
 * 043_archive_v3_questions.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 *
 * 이 마이그레이션은 **행을 지웁니다.** 그래서 확인할 게 하나뿐입니다:
 * 활성 32문항은 하나도 건드리지 않고, 안 쓰는 53행만 보관소로 옮겨졌는가.
 *
 * 사용: npm run verify:questions-cleanup
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

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
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }

await c.connect(); await c.query('BEGIN')
try {
  console.log('\n■ 적용 전')
  const before = await c.query(`SELECT question_set s, count(*)::int n FROM public.questions GROUP BY 1 ORDER BY 1`)
  console.table(before.rows)
  const activeBefore = await c.query(
    `SELECT question_code, question_text, option_1, option_2, option_3, sort_order
       FROM public.questions WHERE is_active AND question_set='mebody_v1_32' ORDER BY sort_order`)
  ok('활성 32문항으로 시작', activeBefore.rowCount === 32, `${activeBefore.rowCount}개`)
  const responsesBefore = Number((await c.query('SELECT count(*)::int n FROM public.questionnaire_responses')).rows[0].n)

  console.log('\n■ 마이그레이션 적용')
  await c.query(readFileSync(new URL('../db/journey/043_archive_v3_questions.sql', import.meta.url).pathname, 'utf8'))
  ok('043 적용', true)

  console.log('\n■ 활성 문항은 손대지 않았는가 (가장 중요)')
  const activeAfter = await c.query(
    `SELECT question_code, question_text, option_1, option_2, option_3, sort_order
       FROM public.questions WHERE is_active AND question_set='mebody_v1_32' ORDER BY sort_order`)
  ok('활성 문항 수 그대로 32개', activeAfter.rowCount === 32, `${activeAfter.rowCount}개`)
  ok('문항 내용이 한 글자도 바뀌지 않았다',
    JSON.stringify(activeBefore.rows) === JSON.stringify(activeAfter.rows))
  ok('questions 에는 32행만 남았다',
    Number((await c.query('SELECT count(*)::int n FROM public.questions')).rows[0].n) === 32)

  console.log('\n■ 보관')
  const archived = await c.query(`SELECT count(*)::int n, count(DISTINCT question_set)::int sets,
    min(question_set) s FROM public.questions_archive`)
  ok('53행이 보관소로 옮겨졌다', archived.rows[0].n === 53, `${archived.rows[0].n}행`)
  ok('보관된 것은 v3_full 세트뿐', archived.rows[0].sets === 1 && archived.rows[0].s === 'v3_full', archived.rows[0].s)
  ok('보관 사유가 남는다',
    (await c.query(`SELECT count(*)::int n FROM public.questions_archive WHERE archived_reason IS NOT NULL`)).rows[0].n === 53)
  ok('활성 문항은 보관소에 들어가지 않았다',
    Number((await c.query(`SELECT count(*)::int n FROM public.questions_archive WHERE question_set='mebody_v1_32'`)).rows[0].n) === 0)

  console.log('\n■ 옛 응답은 그대로인가')
  const responsesAfter = Number((await c.query('SELECT count(*)::int n FROM public.questionnaire_responses')).rows[0].n)
  ok('응답 수가 줄지 않았다', responsesAfter === responsesBefore, `${responsesBefore} → ${responsesAfter}`)
  ok('v3 로 저장된 응답도 그대로 남아 있다',
    Number((await c.query(`SELECT count(*)::int n FROM public.questionnaire_responses
      WHERE question_version='v3_49_precheck'`)).rows[0].n) === 120)
  ok('보관소에서 옛 문항을 다시 찾을 수 있다',
    Number((await c.query(`SELECT count(*)::int n FROM public.questions_archive WHERE question_code='P1'`)).rows[0].n) >= 0)

  console.log('\n■ 앱이 읽는 조회가 그대로 동작하는가')
  const appQuery = await c.query(
    `SELECT id, question_code, question_text, option_1, option_2, option_3, media_url
       FROM public.questions WHERE is_active AND question_set='mebody_v1_32' ORDER BY sort_order`)
  ok('앱 조회가 32행을 돌려준다', appQuery.rowCount === 32)
  ok('첫 문항이 A1', appQuery.rows[0].question_code === 'A1', appQuery.rows[0].question_code)
  ok('마지막 문항이 D7', appQuery.rows[31].question_code === 'D7', appQuery.rows[31].question_code)

  console.log('\n■ 채점표는 영향 없는가')
  ok('채점표는 mebody_v1_32 96행 그대로',
    Number((await c.query(`SELECT count(*)::int n FROM public.question_choice_scores WHERE question_set='mebody_v1_32'`)).rows[0].n) === 96)

  console.log('\n■ 두 번 실행해도 안전한가')
  const twice = await T(() => c.query(readFileSync(new URL('../db/journey/043_archive_v3_questions.sql', import.meta.url).pathname, 'utf8')))
  ok('같은 파일을 다시 실행해도 통과', twice.ok, twice.ok ? '' : twice.msg)
  ok('두 번 실행해도 보관소가 늘지 않는다',
    Number((await c.query('SELECT count(*)::int n FROM public.questions_archive')).rows[0].n) === 53)
  ok('두 번 실행해도 활성 문항 32개',
    Number((await c.query(`SELECT count(*)::int n FROM public.questions WHERE is_active`)).rows[0].n) === 32)

  console.log('\n■ 보관소 권한')
  ok('앱 역할에 보관소 권한이 없다',
    Number((await c.query(`SELECT count(*)::int n FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='questions_archive' AND grantee IN ('anon','authenticated')`)).rows[0].n) === 0)
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
