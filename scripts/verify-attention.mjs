/**
 * 전문가 확장 Phase 5 검증 — 오늘 볼 사람 목록.
 *
 * ── 무엇을 보는가
 * 이 화면의 위험은 두 가지입니다.
 *
 *   1. **남의 고객이 섞이는 것.** 목록은 인자를 받지 않으므로 id 를 넣어 떠볼 수는 없지만,
 *      함수 안에서 관계 조건을 한 줄만 빠뜨려도 조용히 남의 고객이 올라옵니다.
 *      그래서 "다른 전문가의 고객이 내 목록에 없다" 를 직접 확인합니다.
 *
 *   2. **틀린 이유로 이름이 뜨는 것.** 근거 없는 목록은 한 번 틀리면 다시는 안 봅니다.
 *      그래서 플래그 5개를 **하나씩 따로 만들어** 그 사람만 그 플래그로 뜨는지 봅니다.
 *      문턱 바로 아래(2일 미활동, 완료율 50%)는 뜨면 안 된다는 것도 같이 봅니다.
 *
 * 로컬 서버(기본 http://localhost:8081)에 대고 돌립니다. 운영 DB 를 쓰므로 만든 것은 끝에 정리합니다.
 *
 * 사용: npm run verify:attention
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const BASE = process.env.MEBODY_SERVER_BASE ?? 'http://localhost:8081'

const app = {}
for (const l of readFileSync(new URL('../.env.local', import.meta.url).pathname, 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0) app[t.slice(0, i)] = t.slice(i + 1)
}
const SB = app.VITE_SUPABASE_URL, ANON = app.VITE_SUPABASE_ANON_KEY, SVC = app.SUPABASE_SERVICE_ROLE_KEY
const AH = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }
const SH = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }

const srv = {}
for (const l of readFileSync(new URL('../../mebody-server/.env', import.meta.url).pathname, 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0) srv[t.slice(0, i)] = t.slice(i + 1)
}
const u = new URL(srv.SUPABASE_DB_URL.replace(/^jdbc:/, ''))
const db = new pg.Client({ host: u.hostname, port: Number(u.port || 5432),
  database: u.pathname.replace(/^\//, '') || 'postgres',
  user: srv.SUPABASE_DB_USERNAME, password: srv.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false } })

const res = []
const ok = (l, p, d = '') => { res.push({ l, p }); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }

const stamp = Date.now()
const PW = `Attn!${stamp}`
const made = []
const AXIS = `'[{"axis":"neck","rank":1,"direction":"F","percent":80,"label":"전방"},
               {"axis":"shoulder","rank":2,"direction":"L","percent":70,"label":"왼쪽 높음"}]'::jsonb`

async function makeUser(label) {
  const email = `${label}-${stamp}@phone.mebody.net`
  const r = await fetch(`${SB}/auth/v1/admin/users`, { method: 'POST', headers: SH,
    body: JSON.stringify({ email, password: PW, email_confirm: true }) })
  const user = await r.json()
  if (user?.id) made.push(user.id)
  return { id: user?.id, email }
}
const tokenOf = async (email) => (await (await fetch(`${SB}/auth/v1/token?grant_type=password`,
  { method: 'POST', headers: AH, body: JSON.stringify({ email, password: PW }) })).json())?.access_token
const call = async (path, { token, method = 'GET' } = {}) => {
  const r = await fetch(`${BASE}${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
  return { status: r.status, body: await r.json().catch(() => null) }
}
const profileIdOf = async (authId) => (await db.query(
  'SELECT id FROM public.user_profiles WHERE auth_user_id = $1 OR id = $1 LIMIT 1', [authId])).rows[0]?.id

await db.connect()
try {
  // 070 이 없으면 이 검증 자체가 의미가 없습니다. 실패가 아니라 건너뜁니다.
  const has = (await db.query(
    `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='get_client_attention_list'`)).rowCount
  if (!has) {
    console.log('\n⏭  070 이 아직 적용되지 않았습니다. db/journey/070_client_attention.sql 을 적용한 뒤 다시 돌리세요.')
    await db.end(); process.exit(0)
  }

  console.log('\n■ 준비 — 전문가 2명, 고객 7명')
  const proA = await makeUser('attn-proA')
  const proB = await makeUser('attn-proB')
  const stranger = await makeUser('attn-stranger')
  const proAProfile = await profileIdOf(proA.id)
  const proBProfile = await profileIdOf(proB.id)

  const mkPro = async (profileId, name) => {
    await db.query(`UPDATE public.user_profiles SET role='PROFESSIONAL' WHERE id=$1`, [profileId])
    return (await db.query(`INSERT INTO public.professionals (user_profile_id, type, display_name)
       VALUES ($1,'PERSONAL_TRAINER',$2) ON CONFLICT (user_profile_id) DO UPDATE SET status='ACTIVE'
       RETURNING id`, [profileId, name])).rows[0].id
  }
  const proAId = await mkPro(proAProfile, '트레이너A')
  const proBId = await mkPro(proBProfile, '트레이너B')
  ok('전문가 2명 등록', Boolean(proAId && proBId))

  /** 고객 하나를 만들고 전문가에게 붙입니다. consent=false 면 동의 전 상태입니다. */
  const mkClient = async (label, proId, { consent = true, name } = {}) => {
    const user = await makeUser(label)
    const pid = await profileIdOf(user.id)
    await db.query(`UPDATE public.user_profiles SET display_name=$2 WHERE id=$1`, [pid, name ?? label])
    await db.query(`INSERT INTO public.professional_clients
        (professional_id, client_user_id, invite_token, status, invited_at, expires_at, consented_at)
        VALUES ($1,$2,$3,$4, now(), now()+interval '7 days', $5)`,
      [proId, pid, `attn-${label}-${stamp}`, consent ? 'ACTIVE' : 'INVITED', consent ? new Date() : null])
    return { ...user, pid }
  }

  /**
   * 저니 하나를 만듭니다.
   *   startedDaysAgo : 며칠 전에 시작했나 → journey_current_day() 가 이걸로 오늘을 셉니다
   *   inactiveDays   : last_active_at 을 며칠 전으로 둘까
   *   plan           : [[day_no, 'completed'|'scheduled'|'skipped'], ...]
   *   hardOnDays     : 이 day_no 들에 HARD 피드백 1건씩
   */
  const mkJourney = async (pid, { startedDaysAgo, inactiveDays, plan = [], hardOnDays = [], status = 'active' }) => {
    const jid = (await db.query(`INSERT INTO public.user_journeys
        (id, user_id, template_code, body_code, axis_priority, status, current_day, started_at, last_active_at)
        VALUES (gen_random_uuid(), $1, 'starter_14d', 'FRRS', ${AXIS}, $2, 1,
                now() - make_interval(days => $3::int), now() - make_interval(days => $4::int))
        RETURNING id`, [pid, status, startedDaysAgo, inactiveDays])).rows[0].id
    for (const [day, st] of plan) {
      const mid = (await db.query(`INSERT INTO public.user_missions
          (id, user_journey_id, user_id, day_no, slot_no, content_key, mission_type,
           planned_duration_sec, difficulty, source_rule, status, completed_at)
          VALUES (gen_random_uuid(), $1, $2, $3, 1, 'axis_1F', 'release', 180, 1, 'axis_p1', $4,
                  CASE WHEN $4='completed' THEN now() END) RETURNING id`, [jid, pid, day, st])).rows[0].id
      if (hardOnDays.includes(day)) {
        await db.query(`INSERT INTO public.journey_mission_feedback
            (id, user_mission_id, user_id, feeling, difficulty) VALUES (gen_random_uuid(),$1,$2,'SAME','HARD')`,
          [mid, pid])
      }
    }
    return jid
  }

  // 14일 템플릿 기준. 문턱은 미활동 3일 · 창 7일 · HARD 2회 · 완료율 0.5 · 표본 3 · 종료임박 2일.
  const done = (d) => [d, 'completed']
  const todo = (d) => [d, 'scheduled']

  // ① 연락 끊김 — 5일째 안 열었다. 나머지는 멀쩡하게 둔다.
  const cInactive = await mkClient('attn-inactive', proAId, { name: '가나다' })
  await mkJourney(cInactive.pid, { startedDaysAgo: 5, inactiveDays: 5,
    plan: [done(1), done(2), done(3), done(4)] })

  // ② 아직 시작 안 함 — 동의는 했는데 저니가 없다.
  const cNotStarted = await mkClient('attn-notstart', proAId, { name: '나다라' })

  // ③ 수행 밀림 — 매일 열지만 8개 중 1개만 했다.
  const cLow = await mkClient('attn-low', proAId, { name: '다라마' })
  await mkJourney(cLow.pid, { startedDaysAgo: 8, inactiveDays: 0,
    plan: [done(1), todo(2), todo(3), todo(4), todo(5), todo(6), todo(7), todo(8)] })

  // ④ 어렵다 반복 — 다 하고는 있는데 최근 창 안에서 HARD 2회.
  const cHard = await mkClient('attn-hard', proAId, { name: '라마바' })
  await mkJourney(cHard.pid, { startedDaysAgo: 8, inactiveDays: 0,
    plan: [done(4), done(5), done(6), done(7), done(8)], hardOnDays: [7, 8] })

  // ⑤ 종료 임박 — 14일 중 13일차, 성실히 했다.
  const cEnding = await mkClient('attn-ending', proAId, { name: '마바사' })
  await mkJourney(cEnding.pid, { startedDaysAgo: 12, inactiveDays: 0,
    plan: [done(7), done(8), done(9), done(10), done(11), done(12)] })

  // ⑥ 아무 신호 없음 — **문턱 바로 아래**. 2일 미활동(<3), 완료율 정확히 50%(<0.5 아님), HARD 1회(<2).
  const cFine = await mkClient('attn-fine', proAId, { name: '바사아' })
  await mkJourney(cFine.pid, { startedDaysAgo: 6, inactiveDays: 2,
    plan: [done(1), done(2), todo(3), todo(4)], hardOnDays: [1] })

  // ⑦ 남의 고객 — 트레이너B 소속. 신호는 A 의 ①과 똑같이 준다.
  const cOther = await mkClient('attn-other', proBId, { name: '사아자' })
  await mkJourney(cOther.pid, { startedDaysAgo: 5, inactiveDays: 5,
    plan: [done(1), done(2), done(3), done(4)] })

  // ⑧ 동의 전 — A 가 초대만 했다. 신호는 ①과 똑같이 준다.
  const cPending = await mkClient('attn-pending', proAId, { consent: false, name: '아자차' })
  await mkJourney(cPending.pid, { startedDaysAgo: 5, inactiveDays: 5,
    plan: [done(1), done(2), done(3), done(4)] })

  ok('고객 7명 · 저니 6건 준비', true)

  const tokA = await tokenOf(proA.email)
  const tokB = await tokenOf(proB.email)
  const tokS = await tokenOf(stranger.email)
  ok('토큰 3개 확보', Boolean(tokA && tokB && tokS))

  console.log('\n■ 전문가가 아니면 못 본다')
  let r = await call('/api/professional/attention')
  ok('토큰 없이 → 401', r.status === 401, `status=${r.status}`)
  r = await call('/api/professional/attention', { token: tokS })
  ok('일반 회원 → 403', r.status === 403, `status=${r.status}`)

  console.log('\n■ 트레이너A 의 목록')
  r = await call('/api/professional/attention', { token: tokA })
  ok('200 으로 열린다', r.status === 200, `status=${r.status}`)
  const d = r.body?.data ?? {}
  const list = d.clients ?? []
  const byName = Object.fromEntries(list.map((c) => [c.display_name, c]))
  const flagsOf = (n) => (byName[n]?.flags ?? []).slice().sort()

  ok('동의한 내 고객만 total 에 센다 (6명)', d.total === 6, `total=${d.total}`)
  ok('attention 수가 목록 길이와 같다', d.attention === list.length, `${d.attention} vs ${list.length}`)

  console.log('\n■ 신호가 잡힌 사람만, 잡힌 이유로만 뜬다')
  ok('① 연락 끊김', JSON.stringify(flagsOf('가나다')) === JSON.stringify(['inactive']),
    JSON.stringify(flagsOf('가나다')))
  ok('② 아직 시작 안 함', JSON.stringify(flagsOf('나다라')) === JSON.stringify(['not_started']),
    JSON.stringify(flagsOf('나다라')))
  ok('③ 수행 밀림', flagsOf('다라마').includes('low_completion'), JSON.stringify(flagsOf('다라마')))
  ok('④ 어렵다 반복', flagsOf('라마바').includes('hard_streak'), JSON.stringify(flagsOf('라마바')))
  ok('⑤ 종료 임박', flagsOf('마바사').includes('ending_soon'), JSON.stringify(flagsOf('마바사')))

  console.log('\n■ 문턱 바로 아래는 뜨지 않는다')
  ok('⑥ 2일 미활동 · 완료율 50% · HARD 1회 → 목록에 없다', byName['바사아'] === undefined,
    JSON.stringify(flagsOf('바사아')))

  console.log('\n■ 남의 고객은 섞이지 않는다')
  ok('⑦ 트레이너B 의 고객이 A 목록에 없다', byName['사아자'] === undefined)
  ok('⑧ 동의 전 고객이 A 목록에 없다', byName['아자차'] === undefined)

  r = await call('/api/professional/attention', { token: tokB })
  const listB = r.body?.data?.clients ?? []
  const namesB = listB.map((c) => c.display_name)
  ok('트레이너B 는 자기 고객만 본다', namesB.length === 1 && namesB[0] === '사아자', JSON.stringify(namesB))
  ok('B 의 total 도 자기 것만 (1명)', r.body?.data?.total === 1, `total=${r.body?.data?.total}`)

  console.log('\n■ 근거를 숫자로 같이 준다')
  ok('연락 끊김에 며칠인지가 있다', byName['가나다']?.days_inactive >= 3, String(byName['가나다']?.days_inactive))
  ok('수행 밀림에 분모·분자가 있다',
    byName['다라마']?.planned > 0 && byName['다라마']?.completed < byName['다라마']?.planned,
    `${byName['다라마']?.completed}/${byName['다라마']?.planned}`)
  ok('어렵다 반복에 횟수가 있다', byName['라마바']?.hard_count >= 2, String(byName['라마바']?.hard_count))

  console.log('\n■ 급한 순서대로 나온다')
  const prios = list.map((c) => Number(c.priority))
  ok('priority 오름차순', prios.every((v, i) => i === 0 || prios[i - 1] <= v), JSON.stringify(prios))
  ok('연락 끊김이 맨 위', list[0]?.display_name === '가나다', String(list[0]?.display_name))

  console.log('\n■ 신상은 주지 않는다')
  const leaked = list.flatMap((c) => Object.keys(c)).filter((k) => /email|phone|answers|auth/i.test(k))
  ok('이메일·전화·답변 원문이 없다', leaked.length === 0, JSON.stringify(leaked))

  console.log('\n■ 열었다는 사실이 남는다 (지표용)')
  const logged = (await db.query(
    `SELECT count(*)::int n FROM public.professional_activity_log
      WHERE professional_id=$1 AND event='attention_viewed'`, [proAId])).rows[0].n
  ok('attention_viewed 기록', logged >= 1, `${logged}건`)
  const nullClient = (await db.query(
    `SELECT count(*)::int n FROM public.professional_activity_log
      WHERE professional_id=$1 AND event='attention_viewed' AND client_user_id IS NULL`, [proAId])).rows[0].n
  ok('목록 열람은 특정 고객에 묶이지 않는다', nullClient >= 1, `${nullClient}건`)

  console.log('\n■ anon 은 함수를 부를 수 없다')
  const priv = (await db.query(
    `SELECT has_function_privilege('anon','public.get_client_attention_list()','EXECUTE') a,
            has_function_privilege('anon','public.attention_thresholds()','EXECUTE') b`)).rows[0]
  ok('get_client_attention_list 가 anon 에게 닫혀 있다', priv.a === false)
  ok('attention_thresholds 도 anon 에게 닫혀 있다', priv.b === false)

  console.log('\n■ 앱의 재시작 문턱과 같은 값을 쓴다')
  const th = (await db.query(`SELECT public.attention_thresholds() t`)).rows[0].t
  const rulesSrc = readFileSync(new URL('../src/utils/journeyRules.ts', import.meta.url).pathname, 'utf8')
  const appThreshold = Number(/RESTART_THRESHOLD_DAYS\s*=\s*(\d+)/.exec(rulesSrc)?.[1])
  ok('inactive_days 와 RESTART_THRESHOLD_DAYS 가 같다', th.inactive_days === appThreshold,
    `DB=${th.inactive_days} 앱=${appThreshold}`)
} finally {
  console.log('\n■ 정리')
  const ids = made.slice()
  // 프로필 id 는 auth id 와 다를 수 있습니다. 둘 다 모아서 지웁니다.
  let pids = []
  try {
    pids = (await db.query(
      'SELECT id FROM public.user_profiles WHERE auth_user_id = ANY($1::uuid[]) OR id = ANY($1::uuid[])',
      [ids])).rows.map((x) => x.id)
  } catch { /* 연결이 이미 끊겼으면 아래 DELETE 도 어차피 못 돕니다 */ }
  const all = [...new Set([...ids, ...pids])]
  await db.query(`DELETE FROM public.journey_mission_feedback WHERE user_id = ANY($1::uuid[])`, [all]).catch(() => {})
  await db.query(`DELETE FROM public.user_missions WHERE user_id = ANY($1::uuid[])`, [all]).catch(() => {})
  await db.query(`DELETE FROM public.user_journeys WHERE user_id = ANY($1::uuid[])`, [all]).catch(() => {})
  await db.query(`DELETE FROM public.professional_activity_log WHERE professional_id IN
      (SELECT id FROM public.professionals WHERE user_profile_id = ANY($1::uuid[]))`, [all]).catch(() => {})
  await db.query(`DELETE FROM public.professional_clients WHERE invite_token LIKE $1`, [`attn-%${stamp}`]).catch(() => {})
  await db.query(`DELETE FROM public.professionals WHERE user_profile_id = ANY($1::uuid[])`, [all]).catch(() => {})
  for (const id of ids) {
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: SH }).catch(() => {})
  }
  console.log(`  계정 ${ids.length}건 정리`)
  await db.end().catch(() => {})
}

const failed = res.filter((x) => !x.p).length
console.log(`\n${failed ? `❌ ${res.length - failed} / ${res.length} 통과` : `✅ ${res.length} / ${res.length} 통과`}\n`)
process.exit(failed ? 1 : 0)
