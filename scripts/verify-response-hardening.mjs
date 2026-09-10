/**
 * 044_response_read_hardening.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 *
 * 두 가지를 동시에 확인합니다:
 *   1) 남의 결과를 훑을 수 없는가 (지금은 익명·로그인 양쪽이 비회원 결과를 다 읽습니다)
 *   2) **비회원 진단 저장이 여전히 되는가** — 이게 깨지면 안 됩니다
 *
 * 사용: npm run verify:response-hardening
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { randomUUID } from 'node:crypto'

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
// 역할만 바꾸면 안 된다. request.jwt.claims 는 트랜잭션 내내 남아서
// anon 으로 바꿔도 auth.uid() 가 계속 회원 id 를 돌려준다.
const anon = async () => { await svc(); await c.query('SET LOCAL ROLE anon')
  await c.query(`SELECT set_config('request.jwt.claims', NULL, true)`) }
const auth = async (id) => { await svc(); await c.query('SET LOCAL ROLE authenticated')
  await c.query(`SELECT set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]) }
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }

// 앱이 부르는 것과 같은 이름 인자 호출
const save = (p) => c.query(
  `SELECT public.save_questionnaire_response(
     p_id => $1, p_answers => $2::jsonb, p_status => $3, p_calculated_code => $4,
     p_completed_at => $5::timestamptz, p_question_version => $6,
     p_primary_identity => $7, p_scoring_meta => $8::jsonb) AS id`,
  [p.id, JSON.stringify(p.answers ?? {}), p.status ?? 'draft', p.calculated_code ?? null,
   p.completed_at ?? null, p.question_version ?? null, p.primary_identity ?? null,
   p.scoring_meta ? JSON.stringify(p.scoring_meta) : null])

await c.connect(); await c.query('BEGIN')
try {
  console.log('\n■ 적용 전 — 문제 재현')
  await svc()
  const uid = (await c.query('SELECT id FROM auth.users WHERE email=$1', [EMAIL])).rows[0].id
  const total = Number((await c.query('SELECT count(*)::int n FROM public.questionnaire_responses')).rows[0].n)

  // 044 가 이미 적용된 DB 에서는 재현할 수 없습니다. 그때는 재현 대신 결과를 확인합니다.
  const already = (await c.query(
    `SELECT has_table_privilege('anon','public.questionnaire_responses','SELECT') s`)).rows[0].s === false

  let leakAnon = 0
  let leakAuth = 0
  if (already) {
    ok('익명이 비회원 결과를 통째로 읽고 있다(= 고쳐야 하는 상태)', true, '044 적용 완료 상태라 재현 생략')
    ok('로그인 사용자도 남의 비회원 결과를 읽고 있다', true, '044 적용 완료 상태라 재현 생략')
  } else {
    await anon()
    leakAnon = Number((await c.query('SELECT count(*)::int n FROM public.questionnaire_responses')).rows[0].n)
    ok('익명이 비회원 결과를 통째로 읽고 있다(= 고쳐야 하는 상태)', leakAnon > 0, `${total}행 중 ${leakAnon}행`)

    await auth(uid)
    leakAuth = Number((await c.query(
      `SELECT count(*)::int n FROM public.questionnaire_responses WHERE user_id IS NULL`)).rows[0].n)
    ok('로그인 사용자도 남의 비회원 결과를 읽고 있다', leakAuth > 0, `${leakAuth}행`)
  }

  console.log('\n■ 마이그레이션 적용')
  await svc()
  await c.query(readFileSync(new URL('../db/journey/044_response_read_hardening.sql', import.meta.url).pathname, 'utf8'))
  ok('044 적용', true)

  console.log('\n■ 권한이 실제로 좁혀졌다')
  const p = (await c.query(`SELECT
    has_table_privilege('anon','public.questionnaire_responses','SELECT') sel,
    has_table_privilege('anon','public.questionnaire_responses','UPDATE') upd,
    has_table_privilege('anon','public.questionnaire_responses','INSERT') ins,
    has_function_privilege('anon','public.get_questionnaire_response(uuid)','EXECUTE') getrpc,
    has_function_privilege('anon','public.save_questionnaire_response(uuid,jsonb,text,text,timestamptz,text,text,jsonb)','EXECUTE') saverpc,
    has_function_privilege('anon','public.claim_questionnaire_response(uuid)','EXECUTE') claimrpc`)).rows[0]
  ok('익명 테이블 읽기 권한 없음', p.sel === false, leakAnon ? `${leakAnon}행 읽히던 상태 → 회수` : '')
  ok('익명 테이블 수정 권한 없음', p.upd === false)
  ok('익명 저장 RPC 는 부를 수 있다', p.saverpc === true)
  ok('익명 조회 RPC 는 부를 수 있다', p.getrpc === true)
  ok('익명은 귀속 RPC 를 부를 수 없다', p.claimrpc === false)

  console.log('\n■ 익명은 더 이상 훑을 수 없다')
  await anon()
  const list = await T(() => c.query('SELECT count(*)::int n FROM public.questionnaire_responses'))
  ok('익명 목록 조회 → 권한 거부', !list.ok && list.code === '42501', list.ok ? `${list.r.rows[0].n}행 읽힘` : list.code)
  const scan = await T(() => c.query('SELECT answers FROM public.questionnaire_responses LIMIT 1'))
  ok('익명이 answers 를 읽으려 해도 막힌다', !scan.ok && scan.code === '42501', scan.ok ? '읽힘' : scan.code)

  console.log('\n■ 그래도 비회원 저장은 된다 (진단 플로우 그대로)')
  const draftId = randomUUID()
  const created = await T(() => save({ id: draftId, answers: { A1: '1' }, status: 'draft', question_version: 'mebody_v1_32' }))
  ok('비회원 임시저장(신규) 성공', created.ok, created.ok ? draftId.slice(0, 8) : created.code)

  const resaved = await T(() => save({ id: draftId, answers: { A1: '1', A2: '2' }, status: 'draft', question_version: 'mebody_v1_32' }))
  ok('비회원 임시저장(같은 id 갱신) 성공', resaved.ok, resaved.ok ? '' : resaved.code)

  const submitted = await T(() => save({ id: draftId, answers: { A1: '1', A2: '2' }, status: 'completed',
    calculated_code: 'FRRS', completed_at: new Date().toISOString(), question_version: 'mebody_v1_32',
    primary_identity: '테스트', scoring_meta: { axis: {} } }))
  ok('비회원 제출 성공', submitted.ok, submitted.ok ? '' : submitted.code)

  const bad = await T(() => save({ id: randomUUID(), answers: {}, status: 'hacked' }))
  ok('허용되지 않는 status 는 거부', !bad.ok && bad.code === '22023', bad.ok ? '통과함' : bad.code)

  console.log('\n■ 자기 결과는 RPC 로 계속 읽는다')
  const mine = await c.query('SELECT * FROM public.get_questionnaire_response($1)', [draftId])
  ok('id 를 알면 한 행이 나온다', mine.rowCount === 1)
  ok('그 행에 내 답변과 코드가 들어 있다',
    Boolean(mine.rows[0]?.answers) && mine.rows[0]?.calculated_code === 'FRRS',
    `${JSON.stringify(mine.rows[0]?.answers)} / ${mine.rows[0]?.calculated_code}`)
  ok('user_id 는 반환하지 않는다', !('user_id' in (mine.rows[0] ?? {})), Object.keys(mine.rows[0] ?? {}).join(','))
  const nothing = await c.query('SELECT * FROM public.get_questionnaire_response($1)', [randomUUID()])
  ok('없는 id 는 0행 (id 를 알아야만 열린다)', nothing.rowCount === 0)

  console.log('\n■ 회원 결과는 익명에게 닫혀 있다')
  await svc()
  const member = (await c.query(
    `SELECT id FROM public.questionnaire_responses WHERE user_id IS NOT NULL AND user_id <> $1 LIMIT 1`, [uid])).rows[0]
    ?? (await c.query(`SELECT id FROM public.questionnaire_responses WHERE user_id=$1 LIMIT 1`, [uid])).rows[0]
  await anon()
  const stolen = await c.query('SELECT * FROM public.get_questionnaire_response($1)', [member.id])
  ok('익명이 회원 결과 id 를 알아도 읽지 못한다', stolen.rowCount === 0)
  const overwrite = await T(() => save({ id: member.id, answers: { hacked: true }, status: 'completed' }))
  ok('익명이 회원 결과 id 를 알아도 덮어쓰지 못한다', !overwrite.ok && overwrite.code === '42501',
    overwrite.ok ? '덮어써짐' : overwrite.code)

  console.log('\n■ 로그인 사용자도 남의 결과는 못 본다')
  await auth(uid)
  const stillLeaking = Number((await c.query(
    `SELECT count(*)::int n FROM public.questionnaire_responses WHERE user_id IS DISTINCT FROM $1`, [uid])).rows[0].n)
  ok('남의 결과 0행', stillLeaking === 0, `${leakAuth ? `${leakAuth} → ` : ''}${stillLeaking}행`)

  console.log('\n■ 로그인 직후 비회원 결과 귀속')
  const claimed = await T(() => c.query('SELECT public.claim_questionnaire_response($1) AS done', [draftId]))
  ok('주인 없는 결과를 내 것으로 붙인다', claimed.ok && claimed.r.rows[0].done === true,
    claimed.ok ? `반환값 ${JSON.stringify(claimed.r.rows[0].done)}` : `${claimed.code} ${claimed.msg}`)
  const readAfterClaim = await c.query(
    `SELECT count(*)::int n FROM public.questionnaire_responses WHERE id=$1 AND user_id=$2`, [draftId, uid])
  ok('귀속 뒤에는 테이블에서 직접 보인다', readAfterClaim.rows[0].n === 1)
  const again = await c.query('SELECT public.claim_questionnaire_response($1) AS done', [draftId])
  ok('이미 주인이 있으면 false (재귀속 없음)', again.rows[0].done === false)
  const rpcOwn = await c.query('SELECT * FROM public.get_questionnaire_response($1)', [draftId])
  ok('귀속 뒤에도 RPC 로 읽힌다', rpcOwn.rowCount === 1)

  console.log('\n■ 데이터는 그대로')
  await svc()
  const after = Number((await c.query('SELECT count(*)::int n FROM public.questionnaire_responses')).rows[0].n)
  ok('기존 결과가 지워지지 않았다', after === total + 1, `${total} → ${after} (검증용 1건 포함)`)

  console.log('\n■ 두 번 실행해도 안전')
  const twice = await T(() => c.query(readFileSync(new URL('../db/journey/044_response_read_hardening.sql', import.meta.url).pathname, 'utf8')))
  ok('같은 파일을 다시 실행해도 통과', twice.ok, twice.ok ? '' : twice.msg)
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
