/**
 * 052·053 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 *
 * 가장 중요한 것: **전문가가 자기 고객 밖의 데이터를 절대 못 본다.**
 * 044·045 로 잠근 questionnaire_responses 를 다시 열지 않았는지도 함께 봅니다.
 *
 * 사용: npm run verify:professional
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
const read = async (clientId) => (await c.query('SELECT * FROM public.get_client_response($1)', [clientId])).rows

/** 검증용 회원. auth.users 트리거가 프로필을 자동으로 만듭니다. */
async function member(tag, code) {
  const id = randomUUID()
  await c.query('INSERT INTO auth.users (id, email) VALUES ($1,$2)', [id, `pro-${tag}-${Date.now()}@example.test`])
  if (code) {
    await c.query(`INSERT INTO public.questionnaire_responses
      (id,user_id,answers,status,calculated_code,primary_identity,completed_at,question_version)
      VALUES (gen_random_uuid(),$1,'{"A1":"1"}'::jsonb,'completed',$2,'테스트',now(),'mebody_v1_32')`, [id, code])
  }
  return id
}

await c.connect(); await c.query('BEGIN')
try {
  await svc()
  await c.query(readFileSync(new URL('../db/journey/052_professional_core.sql', import.meta.url).pathname, 'utf8'))
  await c.query(readFileSync(new URL('../db/journey/053_professional_client_read.sql', import.meta.url).pathname, 'utf8'))
  ok('052·053 적용', true)

  console.log('\n■ 권한 — 기본값 GRANT ALL 이 남지 않았는가')
  const tr = Number((await c.query(`SELECT count(*)::int n FROM information_schema.role_table_grants
     WHERE table_schema='public' AND privilege_type='TRUNCATE' AND grantee IN ('anon','authenticated')`)).rows[0].n)
  ok('앱 역할에 TRUNCATE 가 열린 테이블 0개', tr === 0, `${tr}개`)
  const g = (await c.query(`SELECT table_name t, grantee r, string_agg(privilege_type,',' ORDER BY privilege_type) p
     FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name IN ('professionals','professional_clients')
      AND grantee IN ('anon','authenticated') GROUP BY 1,2 ORDER BY 1,2`)).rows
  ok('익명에게는 아무 권한도 없다', g.every((x) => x.r !== 'anon'), g.map((x) => `${x.t}/${x.r}`).join(' '))
  ok('회원은 professionals 를 읽기만', g.find((x) => x.t === 'professionals')?.p === 'SELECT')
  const pv = (await c.query(`SELECT
    has_function_privilege('anon','public.get_client_response(uuid)','EXECUTE') a,
    has_function_privilege('anon','public.current_professional_id()','EXECUTE') b`)).rows[0]
  ok('익명은 두 함수를 못 부른다', pv.a === false && pv.b === false)

  console.log('\n■ 검증용 전문가와 고객')
  await svc()
  const proUser = await member('pro', null)
  const other = await member('other-pro', null)
  const clientA = await member('client-a', 'FRRS')
  const clientB = await member('client-b', 'CLLF')
  const stranger = await member('stranger', 'CRRF')

  await c.query(`UPDATE public.user_profiles SET role='PROFESSIONAL' WHERE id IN ($1,$2)`, [proUser, other])
  const pro = (await c.query(`INSERT INTO public.professionals (user_profile_id, type, display_name)
    VALUES ($1,'PERSONAL_TRAINER','검증트레이너') RETURNING id`, [proUser])).rows[0].id
  const proOther = (await c.query(`INSERT INTO public.professionals (user_profile_id, type, display_name)
    VALUES ($1,'PERSONAL_TRAINER','다른트레이너') RETURNING id`, [other])).rows[0].id
  ok('전문가 2명 생성', Boolean(pro && proOther))

  await auth(proUser)
  ok('내가 전문가로 인식된다',
    (await c.query('SELECT public.current_professional_id() AS v')).rows[0].v === pro)
  await auth(clientA)
  ok('일반 회원은 전문가가 아니다',
    (await c.query('SELECT public.current_professional_id() AS v')).rows[0].v === null)

  console.log('\n■ 초대 → 동의 전까지는 아무것도 안 보인다')
  await svc()
  const token = randomUUID()
  await c.query(`INSERT INTO public.professional_clients (professional_id, invite_token) VALUES ($1,$2)`, [pro, token])
  await auth(proUser)
  ok('초대만 만든 상태에서 조회 → 0행', (await read(clientA)).length === 0)

  await svc()
  await c.query(`UPDATE public.professional_clients SET client_user_id=$1, status='ACTIVE' WHERE invite_token=$2`,
    [clientA, token])
  await auth(proUser)
  ok('ACTIVE 지만 동의 전이면 → 0행', (await read(clientA)).length === 0)

  console.log('\n■ 동의하면 보인다')
  await svc()
  await c.query(`UPDATE public.professional_clients SET consented_at=now() WHERE invite_token=$1`, [token])
  await auth(proUser)
  const rows = await read(clientA)
  ok('내 고객의 결과가 1행 나온다', rows.length === 1, String(rows[0]?.calculated_code))
  ok('코드가 맞다', rows[0]?.calculated_code === 'FRRS')
  ok('연락처·user_id 는 돌려주지 않는다',
    !('email' in (rows[0] ?? {})) && !('user_id' in (rows[0] ?? {})),
    Object.keys(rows[0] ?? {}).join(','))

  console.log('\n■ 경계')
  ok('관계 없는 회원 → 0행', (await read(stranger)).length === 0)
  ok('내 고객이 아닌 회원 → 0행', (await read(clientB)).length === 0)

  await auth(other)
  ok('다른 전문가가 내 고객을 보려 하면 → 0행', (await read(clientA)).length === 0)

  await auth(clientB)
  ok('일반 회원이 함수를 불러도 → 0행', (await read(clientA)).length === 0)

  await anon()
  const byAnon = await T(() => c.query('SELECT * FROM public.get_client_response($1)', [clientA]))
  ok('익명 호출은 거부된다', !byAnon.ok, byAnon.ok ? '실행됨' : byAnon.code)

  console.log('\n■ 해지하면 즉시 닫힌다')
  await svc()
  await c.query(`UPDATE public.professional_clients SET status='REVOKED', revoked_at=now() WHERE invite_token=$1`, [token])
  await auth(proUser)
  ok('REVOKED 후 → 0행', (await read(clientA)).length === 0)

  console.log('\n■ 고객이 직접 스스로를 전문가로 만들 수 없다')
  await auth(clientB)
  const selfPromote = await T(() => c.query(
    `INSERT INTO public.professionals (user_profile_id, type) VALUES ($1,'PERSONAL_TRAINER')`, [clientB]))
  ok('회원이 professionals 에 INSERT 못 한다', !selfPromote.ok, selfPromote.ok ? '삽입됨' : selfPromote.code)

  console.log('\n■ 044·045 가 그대로인가 (가장 중요)')
  await anon()
  const scan = await T(() => c.query('SELECT count(*) FROM public.questionnaire_responses'))
  ok('익명은 여전히 응답을 훑을 수 없다', !scan.ok && scan.code === '42501', scan.ok ? '읽힘' : scan.code)
  await auth(proUser)
  const proScan = await T(() => c.query(
    `SELECT count(*)::int n FROM public.questionnaire_responses WHERE user_id IS DISTINCT FROM $1`, [proUser]))
  ok('전문가도 테이블을 직접 훑지 못한다',
    proScan.ok ? proScan.r.rows[0].n === 0 : true,
    proScan.ok ? `${proScan.r.rows[0].n}행` : proScan.code)
  await svc()
  const frozen = Number((await c.query(`SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
     WHERE ns.nspname='public' AND p.proname='save_questionnaire_response'
       AND p.prosrc LIKE '%이미 제출된 결과는 수정할 수 없습니다%'`)).rows[0].n)
  ok('045 의 결과 잠금이 그대로', frozen === 1)

  console.log('\n■ 두 번 실행해도 안전')
  const twice = await T(async () => {
    await c.query(readFileSync(new URL('../db/journey/052_professional_core.sql', import.meta.url).pathname, 'utf8'))
    await c.query(readFileSync(new URL('../db/journey/053_professional_client_read.sql', import.meta.url).pathname, 'utf8'))
  })
  ok('같은 파일을 다시 실행해도 통과', twice.ok, twice.ok ? '' : String(twice.msg).slice(0, 60))
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
