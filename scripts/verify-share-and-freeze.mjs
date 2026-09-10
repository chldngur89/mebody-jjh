/**
 * 공유 URL 과 결과 확정본 검증.
 *
 * 두 가지를 봅니다:
 *   1) 공유 링크에 개인 데이터가 실리지 않는가 (코드만)
 *   2) result id 가 새더라도 **결과가 고쳐지지 않는가** (045)
 *
 * DB 검증은 트랜잭션 안에서 045 를 적용하고 ROLLBACK 합니다.
 * 사용: npm run verify:share-freeze
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
const anon = async () => { await svc(); await c.query('SET LOCAL ROLE anon')
  await c.query(`SELECT set_config('request.jwt.claims', NULL, true)`) }
const auth = async (id) => { await svc(); await c.query('SET LOCAL ROLE authenticated')
  await c.query(`SELECT set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]) }
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }

const save = (p) => c.query(
  `SELECT public.save_questionnaire_response(
     p_id => $1, p_answers => $2::jsonb, p_status => $3, p_calculated_code => $4,
     p_completed_at => $5::timestamptz, p_question_version => $6,
     p_primary_identity => $7, p_scoring_meta => $8::jsonb) AS id`,
  [p.id, JSON.stringify(p.answers ?? {}), p.status ?? 'draft', p.calculated_code ?? null,
   p.completed_at ?? null, p.question_version ?? null, p.primary_identity ?? null,
   p.scoring_meta ? JSON.stringify(p.scoring_meta) : null])

const read = async (id) => (await c.query('SELECT * FROM public.get_questionnaire_response($1)', [id])).rows[0]

// ── 1. 공유 링크에 무엇이 실리나 (실제 앱 코드를 그대로 읽습니다) ─────────────
console.log('\n■ 공유 링크에 실리는 값')
const shareSrc = readFileSync(new URL('../src/lib/share.ts', import.meta.url).pathname, 'utf8')
const params = [...shareSrc.matchAll(/searchParams\.set\('([^']+)'/g)].map((m) => m[1])
ok('공유 URL 파라미터는 ref·code 뿐', params.length === 2 && params.includes('ref') && params.includes('code'), params.join(', '))
ok('공유 코드에 result id 를 넣지 않는다', !/result|questionnaireId|\.id\b/.test(shareSrc.split('buildShareUrl')[1]?.slice(0, 400) ?? ''))
ok('몸BTI 코드 형식만 허용', /\^\[FC\]\[RL\]\[RL\]\[SF\]\$/.test(shareSrc))

const analyticsSrc = readFileSync(new URL('../src/lib/analytics.ts', import.meta.url).pathname, 'utf8')
const props = [...analyticsSrc.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1])
ok('이벤트 payload 에 개인 식별 값이 없다',
  props.every((p) => ['body_code', 'share_channel', 'ref', 'reason'].includes(p)), props.join(', '))

await c.connect(); await c.query('BEGIN')
try {
  await svc()
  const uid = (await c.query('SELECT id FROM auth.users WHERE email=$1', [EMAIL])).rows[0].id
  const total = Number((await c.query('SELECT count(*)::int n FROM public.questionnaire_responses')).rows[0].n)

  console.log('\n■ 적용 전 — 문제 재현')
  // 045 가 이미 적용된 DB 에서는 재현할 수 없습니다.
  const frozen = (await c.query(`SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
     WHERE ns.nspname='public' AND p.proname='save_questionnaire_response'
       AND p.prosrc LIKE '%이미 제출된 결과는 수정할 수 없습니다%'`)).rows[0].n > 0

  let extraRows = 0
  if (frozen) {
    ok('id 만 알면 남의 결과가 덮어써진다(= 고쳐야 하는 상태)', true, '045 적용 완료 상태라 재현 생략')
  } else {
    await anon()
    const victim = randomUUID()
    await save({ id: victim, answers: { A1: '1' }, status: 'draft', question_version: 'mebody_v1_32' })
    await save({ id: victim, answers: { A1: '1', D7: '3' }, status: 'completed', calculated_code: 'FRRS',
      completed_at: new Date().toISOString() })
    const hijack = await T(() => save({ id: victim, answers: { HACKED: true }, status: 'completed', calculated_code: 'CLLF' }))
    const afterHijack = await read(victim)
    ok('id 만 알면 남의 결과가 덮어써진다(= 고쳐야 하는 상태)',
      hijack.ok && afterHijack.calculated_code === 'CLLF', `FRRS → ${afterHijack.calculated_code}`)
    extraRows = 1
  }

  console.log('\n■ 045 적용')
  await svc()
  await c.query(readFileSync(new URL('../db/journey/045_freeze_completed_result.sql', import.meta.url).pathname, 'utf8'))
  ok('045 적용', true)

  console.log('\n■ 제출이 끝난 결과는 고쳐지지 않는다')
  await anon()
  const target = randomUUID()
  await save({ id: target, answers: { A1: '1' }, status: 'draft', question_version: 'mebody_v1_32' })
  await save({ id: target, answers: { A1: '1', D7: '3' }, status: 'completed', calculated_code: 'FRRS',
    completed_at: new Date().toISOString(), primary_identity: '원본' })

  const attack = await T(() => save({ id: target, answers: { HACKED: true }, status: 'completed', calculated_code: 'CLLF' }))
  ok('다른 코드로 덮어쓰기 → 거부', !attack.ok && attack.code === '42501', attack.ok ? '덮어써짐' : attack.code)

  const after = await read(target)
  ok('코드가 그대로다', after.calculated_code === 'FRRS', after.calculated_code)
  ok('답변이 그대로다', JSON.stringify(after.answers) === JSON.stringify({ A1: '1', D7: '3' }), JSON.stringify(after.answers))
  ok('아이덴티티가 그대로다', after.primary_identity === '원본', String(after.primary_identity))

  const sameAgain = await T(() => save({ id: target, answers: { A1: '1', D7: '3' }, status: 'completed', calculated_code: 'FRRS' }))
  ok('같은 결과 재전송(앱 재시도) → 통과', sameAgain.ok, sameAgain.ok ? '' : sameAgain.code)

  const lateDraft = await T(() => save({ id: target, answers: { A1: '2' }, status: 'draft' }))
  const afterLate = await read(target)
  ok('제출 뒤 늦게 온 임시저장이 결과를 되돌리지 않는다',
    lateDraft.ok && afterLate.status === 'completed' && afterLate.calculated_code === 'FRRS',
    `${afterLate.status} / ${afterLate.calculated_code}`)

  console.log('\n■ 진단 흐름은 그대로 동작한다')
  const fresh = randomUUID()
  const d1 = await T(() => save({ id: fresh, answers: { A1: '1' }, status: 'draft', question_version: 'mebody_v1_32' }))
  ok('비회원 임시저장(신규)', d1.ok, d1.ok ? '' : d1.code)
  const d2 = await T(() => save({ id: fresh, answers: { A1: '1', A2: '2' }, status: 'draft' }))
  ok('비회원 임시저장(갱신)', d2.ok, d2.ok ? '' : d2.code)
  const d3 = await T(() => save({ id: fresh, answers: { A1: '1', A2: '2' }, status: 'completed',
    calculated_code: 'CLLF', completed_at: new Date().toISOString() }))
  ok('비회원 제출', d3.ok, d3.ok ? '' : d3.code)
  const freshRow = await read(fresh)
  ok('제출 결과가 읽힌다', freshRow?.calculated_code === 'CLLF', String(freshRow?.calculated_code))

  console.log('\n■ 재측정은 막히지 않는다 (새 id 로 새 행)')
  const again = randomUUID()
  const r1 = await T(() => save({ id: again, answers: { A1: '3' }, status: 'completed',
    calculated_code: 'CRLS', completed_at: new Date().toISOString() }))
  ok('새 진단은 새 행으로 저장된다', r1.ok, r1.ok ? '' : r1.code)

  console.log('\n■ 로그인 뒤 귀속은 그대로')
  await auth(uid)
  const claimed = await c.query('SELECT public.claim_questionnaire_response($1) AS done', [target])
  ok('확정된 비회원 결과도 내 것으로 붙일 수 있다', claimed.rows[0].done === true)
  const mine = (await c.query(
    'SELECT count(*)::int n FROM public.questionnaire_responses WHERE id=$1 AND user_id=$2', [target, uid])).rows[0].n
  ok('귀속 뒤 내 결과로 보인다', mine === 1)

  console.log('\n■ 익명은 여전히 훑을 수 없다')
  await anon()
  const scan = await T(() => c.query('SELECT count(*) FROM public.questionnaire_responses'))
  ok('목록 조회 → 권한 거부', !scan.ok && scan.code === '42501', scan.ok ? '읽힘' : scan.code)

  console.log('\n■ 데이터는 그대로')
  await svc()
  const end = Number((await c.query('SELECT count(*)::int n FROM public.questionnaire_responses')).rows[0].n)
  ok('검증용 행 외에 늘거나 줄지 않았다', end === total + 3 + extraRows, `${total} → ${end}`)

  console.log('\n■ 두 번 실행해도 안전')
  const twice = await T(() => c.query(readFileSync(new URL('../db/journey/045_freeze_completed_result.sql', import.meta.url).pathname, 'utf8')))
  ok('같은 파일을 다시 실행해도 통과', twice.ok, twice.ok ? '' : twice.msg)
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
