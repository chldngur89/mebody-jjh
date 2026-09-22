/**
 * 문항·응답이 32문항 하나로 정리돼 있는지 검사합니다.
 *
 * 예전에는 043_archive_v3_questions.sql 을 트랜잭션에서 적용해 보는 스위트였습니다.
 * 043 이 하던 일(옛 문항을 보관소로 옮기기)은 049·050·051 로 대체됐습니다.
 * 보관소 자체를 없앴고 옛 응답도 지웠으므로, 이제 '043 이 잘 옮겼는가' 는 물을 수 없습니다.
 * 대신 **지금 남아 있어야 하는 모습**을 검사합니다. 무엇이 다시 들어오면 여기서 걸립니다.
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
const n = async (sql, args = []) => Number((await c.query(sql, args)).rows[0].n)

await c.connect()
try {
  console.log('\n■ 문항은 32개뿐인가')
  ok('questions 32행', (await n('SELECT count(*)::int n FROM public.questions')) === 32)
  ok('전부 활성', (await n('SELECT count(*)::int n FROM public.questions WHERE is_active')) === 32)
  ok('전부 mebody_v1_32',
    (await n(`SELECT count(*)::int n FROM public.questions WHERE question_set <> 'mebody_v1_32'`)) === 0)
  ok('중복된 문항 코드 없음',
    (await n('SELECT count(*)::int n FROM (SELECT question_code FROM public.questions GROUP BY 1 HAVING count(*)>1) t')) === 0)

  console.log('\n■ 앱이 읽는 조회 (fetchQuestions 와 같은 조건)')
  const app = await c.query(
    `SELECT question_code, question_text, option_1, option_2, option_3
       FROM public.questions WHERE is_active AND question_set='mebody_v1_32' ORDER BY sort_order`)
  ok('32행을 돌려준다', app.rowCount === 32, `${app.rowCount}행`)
  ok('첫 문항이 A1', app.rows[0]?.question_code === 'A1', String(app.rows[0]?.question_code))
  ok('마지막 문항이 D7', app.rows[31]?.question_code === 'D7', String(app.rows[31]?.question_code))
  ok('빈 질문·선택지가 없다',
    app.rows.every((r) => r.question_text?.trim() && r.option_1?.trim() && r.option_2?.trim() && r.option_3?.trim()))

  console.log('\n■ 채점표')
  ok('mebody_v1_32 96행 (32×3)',
    (await n(`SELECT count(*)::int n FROM public.question_choice_scores WHERE question_set='mebody_v1_32'`)) === 96)
  ok('다른 세트 점수는 없다',
    (await n(`SELECT count(*)::int n FROM public.question_choice_scores WHERE question_set <> 'mebody_v1_32'`)) === 0)
  ok('모든 문항에 점수가 있다',
    (await n(`SELECT count(*)::int n FROM public.questions q
       WHERE NOT EXISTS (SELECT 1 FROM public.question_choice_scores s WHERE s.question_code = q.question_code)`)) === 0)

  console.log('\n■ 옛 것이 남아 있지 않은가')
  ok('보관 테이블 questions_archive 없음 (050)',
    (await c.query(`SELECT to_regclass('public.questions_archive') IS NULL AS v`)).rows[0].v === true)
  ok('옛 문항 세트 응답 0건 (051)',
    (await n(`SELECT count(*)::int n FROM public.questionnaire_responses
       WHERE question_version IS NULL OR question_version <> 'mebody_v1_32'`)) === 0)
  const live = await n('SELECT count(*)::int n FROM public.questionnaire_responses')
  ok('남은 응답은 전부 지금 문항 세트', live > 0, `${live}건`)

  console.log('\n■ 문항 테이블의 역할 주석 (지우지 말라는 표시)')
  const comment = (await c.query(`SELECT obj_description('public.questions'::regclass) AS d`)).rows[0].d
  ok('questions 에 주석이 있다', Boolean(comment), comment ? comment.slice(0, 40) + '…' : '없음')
} finally {
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
