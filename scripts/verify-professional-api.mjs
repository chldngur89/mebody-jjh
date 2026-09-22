/**
 * 전문가 확장 Phase 1 HTTP 검증 — 계정·초대·동의·결과 열람.
 *
 * ── 무엇을 보는가
 * 이 기능의 위험은 하나입니다. **남의 몸 상태를 보는 것.**
 * 그래서 "되는 것" 보다 "안 되는 것" 을 먼저 봅니다.
 *
 *   · 전문가가 아닌 사람이 전문가 경로를 부르면 403
 *   · 초대만 하고 고객이 동의하지 않았으면 결과가 0행
 *   · 내 고객이 아닌 id 를 넣으면 0행 (있는 사람인지조차 알려주지 않는다)
 *   · 같은 초대 토큰은 한 번만 쓰인다
 *   · 고객이 동의를 거두면 그 순간부터 다시 0행
 *   · 초대 미리보기는 없는 토큰과 만료 토큰의 답이 같다
 *
 * 로컬 서버(기본 http://localhost:8081)에 대고 돌립니다. 운영 DB 를 쓰므로 만든 것은 끝에 정리합니다.
 * 서버가 JWKS 모드면 우리가 토큰을 만들 수 없어서, 실제 Supabase 계정으로 로그인해 토큰을 얻습니다.
 *
 * 사용: npm run verify:professional-api
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
const PW = `ProApi!${stamp}`
const made = []

/** 확인 절차가 켜져 있어도 메일을 쓰지 않도록 관리자 경로로 만듭니다. */
async function makeUser(label) {
  const email = `${label}-${stamp}@phone.mebody.net`
  const r = await fetch(`${SB}/auth/v1/admin/users`, { method: 'POST', headers: SH,
    body: JSON.stringify({ email, password: PW, email_confirm: true }) })
  const user = await r.json()
  if (user?.id) made.push(user.id)
  return { id: user?.id, email, status: r.status }
}

async function tokenOf(email) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: AH,
    body: JSON.stringify({ email, password: PW }) })
  const body = await r.json()
  return body?.access_token
}

const call = async (path, { token, method = 'GET', body } = {}) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}

await db.connect()
try {
  console.log('\n■ 계정 준비')
  const pro = await makeUser('pro')
  const client = await makeUser('cli')
  const stranger = await makeUser('stranger')
  ok('계정 3개 생성', Boolean(pro.id && client.id && stranger.id))

  // 프로필 행은 auth.users 트리거가 만듭니다. 그 행 id 를 씁니다.
  const profileIdOf = async (authId) => (await db.query(
    'SELECT id FROM public.user_profiles WHERE auth_user_id = $1 OR id = $1 LIMIT 1', [authId])).rows[0]?.id
  const proProfile = await profileIdOf(pro.id)
  const clientProfile = await profileIdOf(client.id)
  const strangerProfile = await profileIdOf(stranger.id)
  ok('프로필이 만들어졌다', Boolean(proProfile && clientProfile))

  // 고객에게 완료된 결과 1건을 심습니다. 이게 전문가가 보게 될 대상입니다.
  await db.query(`INSERT INTO public.questionnaire_responses
      (id, user_id, answers, status, calculated_code, question_version, completed_at)
      VALUES (gen_random_uuid(), $1, '{"A1":"1"}'::jsonb, 'completed', 'FRRS', 'mebody_v1_32', now())`,
    [clientProfile])
  ok('고객 결과 1건 준비', true, 'FRRS')

  // Phase 2 — 수행 기록. 완료 2일 · 건너뜀 1일 · 피드백 1건.
  const journeyId = (await db.query(`INSERT INTO public.user_journeys
      (id, user_id, template_code, body_code, axis_priority, status, current_day, started_at, last_active_at)
      VALUES (gen_random_uuid(), $1, 'starter_14d', 'FRRS',
              -- 실제 저니와 같은 모양이어야 합니다. 예전에는 '["neck"]' 만 넣었는데,
              -- 엔진은 {axis, rank, direction} 을 보므로 초안이 늘 0개로 나왔고
              -- 그걸 통과시키고 있었습니다.
              '[{"axis":"neck","rank":1,"direction":"F","percent":80,"label":"전방"},
                {"axis":"shoulder","rank":2,"direction":"L","percent":70,"label":"왼쪽 높음"}]'::jsonb,
              'active', 3, now() - interval '3 days', now() - interval '1 day') RETURNING id`,
    [clientProfile])).rows[0].id
  const missionOf = async (day, status) => (await db.query(`INSERT INTO public.user_missions
      (id, user_journey_id, user_id, day_no, slot_no, content_key, mission_type,
       planned_duration_sec, difficulty, source_rule, status, completed_at)
      VALUES (gen_random_uuid(), $1, $2, $3, 1, 'axis_1F', 'release', 180, 1, 'axis_p1', $4,
              CASE WHEN $4 = 'completed' THEN now() - interval '1 day' END) RETURNING id`,
    [journeyId, clientProfile, day, status])).rows[0].id
  const m1 = await missionOf(1, 'completed')
  await missionOf(2, 'completed')
  await missionOf(3, 'skipped')
  await db.query(`INSERT INTO public.journey_mission_feedback
      (id, user_mission_id, user_id, feeling, difficulty, note)
      VALUES (gen_random_uuid(), $1, $2, 'BETTER', 'GOOD', '목이 한결 편해요')`, [m1, clientProfile])
  ok('고객 수행 기록 준비', true, '완료 2 · 건너뜀 1 · 피드백 1')

  const proToken = await tokenOf(pro.email)
  const clientToken = await tokenOf(client.email)
  const strangerToken = await tokenOf(stranger.email)
  ok('토큰 3개 확보', Boolean(proToken && clientToken && strangerToken))

  console.log('\n■ 전문가가 아니면 아무것도 못 한다')
  let r = await call('/api/professional/me', { token: strangerToken })
  ok('일반 회원의 /me → 403', r.status === 403, `status=${r.status}`)
  r = await call('/api/professional/clients', { token: strangerToken })
  ok('일반 회원의 고객 목록 → 403', r.status === 403, `status=${r.status}`)
  r = await call('/api/professional/clients/invite', { token: strangerToken, method: 'POST' })
  ok('일반 회원의 초대 생성 → 403', r.status === 403, `status=${r.status}`)
  r = await call('/api/professional/clients')
  ok('토큰 없이 → 401', r.status === 401, `status=${r.status}`)

  console.log('\n■ 전문가 발급은 관리자만')
  r = await call('/api/admin/professionals', { token: strangerToken, method: 'POST',
    body: { email: pro.email, type: 'PERSONAL_TRAINER', displayName: '김트레이너' } })
  ok('일반 회원이 자기를 전문가로 올릴 수 없다', r.status === 403, `status=${r.status}`)

  // 관리자 계정을 거치지 않고 DB 로 발급합니다(관리자 경로 자체는 위에서 막히는 것만 봅니다).
  await db.query(`UPDATE public.user_profiles SET role='PROFESSIONAL' WHERE id=$1`, [proProfile])
  const proId = (await db.query(
    `INSERT INTO public.professionals (user_profile_id, type, display_name)
     VALUES ($1,'PERSONAL_TRAINER','김트레이너')
     ON CONFLICT (user_profile_id) DO UPDATE SET status='ACTIVE' RETURNING id`, [proProfile])).rows[0].id
  ok('전문가 등록', Boolean(proId))

  console.log('\n■ 전문가 본인 정보')
  r = await call('/api/professional/me', { token: proToken })
  ok('/me 가 열린다', r.status === 200 && r.body?.data?.type === 'PERSONAL_TRAINER',
    `status=${r.status} ${r.body?.data?.displayName ?? ''}`)

  console.log('\n■ 초대')
  r = await call('/api/professional/clients/invite', { token: proToken, method: 'POST' })
  const invite = r.body?.data
  const token = String(invite?.inviteUrl ?? '').split('invite=')[1] ?? ''
  ok('초대 생성', r.status === 200 && Boolean(token), `status=${r.status}`)
  ok('토큰이 추측 가능한 길이가 아니다', token.length >= 40, `${token.length}자`)

  r = await call(`/api/public/professional/invite/${token}`)
  ok('로그인 없이 미리보기가 열린다', r.status === 200 && r.body?.data?.valid === true, `status=${r.status}`)
  ok('전문가 이름만 알려준다', r.body?.data?.professionalName === '김트레이너'
    && !('clientUserId' in (r.body?.data ?? {})), JSON.stringify(r.body?.data))

  const bogus = await call('/api/public/professional/invite/definitely-not-a-real-token-000000000000')
  ok('없는 토큰과 있는 토큰의 실패 답이 같다',
    bogus.status === 200 && bogus.body?.data?.valid === false, `status=${bogus.status}`)

  console.log('\n■ 동의 전에는 아무것도 보이지 않는다')
  r = await call('/api/professional/clients', { token: proToken })
  const pendingRow = (r.body?.data ?? []).find((x) => x.status === 'INVITED')
  ok('초대가 목록에 보인다', r.status === 200 && Boolean(pendingRow), `status=${r.status}`)
  // 서버가 null 필드를 응답에서 빼므로(non_null), 없는 것과 null 을 같이 봅니다.
  ok('아직 고객이 누구인지 모른다', pendingRow?.clientUserId == null, String(pendingRow?.clientUserId))
  ok('결과 코드도 비어 있다', pendingRow?.bodyCode == null, String(pendingRow?.bodyCode))

  r = await call(`/api/professional/clients/${clientProfile}`, { token: proToken })
  ok('동의 전 결과 조회 → 404', r.status === 404, `status=${r.status}`)
  r = await call(`/api/professional/clients/${clientProfile}/journey`, { token: proToken })
  ok('동의 전 수행 기록 조회 → 404', r.status === 404, `status=${r.status}`)

  console.log('\n■ 고객이 동의한다')
  r = await call(`/api/invites/${token}/accept`)
  ok('로그인 없이는 동의할 수 없다', r.status === 401, `status=${r.status}`)

  r = await call(`/api/invites/${token}/accept`, { token: clientToken, method: 'POST' })
  const accepted = r.body?.data
  ok('동의 성공', r.status === 200 && Boolean(accepted?.consentedAt), `status=${r.status}`)
  ok('결과가 있다고 알려준다', accepted?.hasResult === true)

  r = await call(`/api/invites/${token}/accept`, { token: strangerToken, method: 'POST' })
  ok('같은 토큰을 다른 사람이 다시 쓸 수 없다 (1회용)', r.status === 409, `status=${r.status}`)

  r = await call(`/api/public/professional/invite/${token}`)
  ok('수락된 토큰은 미리보기에서도 무효', r.body?.data?.valid === false)

  console.log('\n■ 동의 뒤에는 결과가 보인다')
  r = await call(`/api/professional/clients/${clientProfile}`, { token: proToken })
  ok('결과 조회 성공', r.status === 200 && r.body?.data?.calculatedCode === 'FRRS',
    `status=${r.status} ${r.body?.data?.calculatedCode ?? ''}`)
  ok('답변 원문은 내려오지 않는다', !('answers' in (r.body?.data ?? {})), Object.keys(r.body?.data ?? {}).join(','))

  r = await call('/api/professional/clients', { token: proToken })
  const activeRow = (r.body?.data ?? []).find((x) => x.status === 'ACTIVE')
  ok('목록에서 ACTIVE 로 바뀐다', Boolean(activeRow))
  ok('수락 뒤에는 초대 링크를 더 주지 않는다', activeRow?.inviteUrl == null, String(activeRow?.inviteUrl))
  ok('동의했으므로 코드가 보인다', activeRow?.bodyCode === 'FRRS', String(activeRow?.bodyCode))

  console.log('\n■ 수행 기록 (Phase 2)')
  r = await call(`/api/professional/clients/${clientProfile}/journey`, { token: proToken })
  const jr = r.body?.data
  ok('수행 기록 조회 성공', r.status === 200 && jr?.hasJourney === true, `status=${r.status}`)
  ok('진행률이 계산된다', jr?.summary?.progress?.completed === 2 && jr?.summary?.progress?.skipped === 1,
    JSON.stringify(jr?.summary?.progress))
  ok('일자별 타임라인이 온다', Array.isArray(jr?.summary?.days) && jr.summary.days.length === 3,
    `${jr?.summary?.days?.length}일`)
  ok('피드백이 온다', jr?.summary?.feedback?.[0]?.note === '목이 한결 편해요',
    JSON.stringify(jr?.summary?.feedback?.[0]))
  // 수행 기록에도 신상이 섞이면 안 됩니다.
  const journeyText = JSON.stringify(jr ?? {})
  ok('수행 기록에 이메일·user_id 가 섞이지 않는다',
    !journeyText.includes('@') && !journeyText.includes(String(clientProfile)),
    `${journeyText.length}자`)

  console.log('\n■ 미션 배정 (Phase 3)')
  const hasAssign = Number((await db.query(`SELECT count(*)::int n FROM pg_proc WHERE proname='assign_client_mission'`)).rows[0].n) === 1
  if (!hasAssign) {
    console.log('    대기  059 미적용이라 배정 검사를 건너뜁니다')
  } else {
    r = await call('/api/professional/contents', { token: proToken })
    const contents = r.body?.data ?? []
    ok('배정할 동작 목록이 온다', r.status === 200 && contents.length > 0, `${contents.length}개`)
    r = await call('/api/professional/contents', { token: strangerToken })
    ok('전문가가 아니면 목록도 403', r.status === 403, `status=${r.status}`)

    const key = contents[0]?.contentKey
    r = await call(`/api/professional/clients/${clientProfile}/missions`, {
      token: proToken, method: 'POST', body: { contentKey: key, note: '오른쪽만 천천히' } })
    const assigned = r.body?.data?.missionId
    ok('배정 성공', r.status === 200 && Boolean(assigned), `status=${r.status} ${r.body?.message ?? ''}`)

    const row = (await db.query(`SELECT source_rule, assigned_by, prescription, status, user_id, day_no, user_journey_id
      FROM public.user_missions WHERE id=$1`, [assigned])).rows[0]
    ok('고객의 저니에 붙는다', row?.user_id === clientProfile && row?.status === 'scheduled')

    // 배정이 "고객이 오늘 보는 날" 에 붙어야 합니다. user_journeys.current_day 컬럼은
    // 뒤처져 있어서, 그걸 쓰면 지나간 날에 붙고 고객은 영영 보지 못합니다(060 이 고친 문제).
    const hasDayFn = Number((await db.query(`SELECT count(*)::int n FROM pg_proc WHERE proname='journey_current_day'`)).rows[0].n) === 1
    if (hasDayFn) {
      const realDay = Number((await db.query('SELECT public.journey_current_day($1) v', [row.user_journey_id])).rows[0].v)
      ok('오늘 날짜에 붙는다 (지나간 날 아님)', row.day_no === realDay, `배정 ${row.day_no}일차 · 오늘 ${realDay}일차`)
    } else {
      console.log('    대기  060 미적용이라 배정 날짜 검사를 건너뜁니다')
    }
    ok('출처와 메모가 남는다', row?.source_rule === 'professional' && row?.prescription?.note === '오른쪽만 천천히',
      JSON.stringify(row?.prescription))

    // 만들어 넣을 수 없다 — 여기가 뚫리면 검증 안 된 지시가 남의 몸으로 갑니다.
    r = await call(`/api/professional/clients/${clientProfile}/missions`, {
      token: proToken, method: 'POST', body: { contentKey: '지어낸동작', note: null } })
    ok('없는 동작 → 400', r.status === 400, `status=${r.status}`)
    r = await call(`/api/professional/clients/${clientProfile}/missions`, {
      token: proToken, method: 'POST', body: { contentKey: key, note: '가'.repeat(201) } })
    ok('메모 201자 → 400', r.status === 400, `status=${r.status}`)

    // 남의 고객에게는 배정할 수 없다
    r = await call(`/api/professional/clients/${strangerProfile}/missions`, {
      token: proToken, method: 'POST', body: { contentKey: key, note: null } })
    ok('내 고객이 아니면 403', r.status === 403, `status=${r.status}`)
    r = await call(`/api/professional/clients/${clientProfile}/missions`, {
      token: strangerToken, method: 'POST', body: { contentKey: key, note: null } })
    ok('전문가가 아니면 403', r.status === 403, `status=${r.status}`)

    // 하루 3개 — 위에서 1개 썼으니 2개 더 넣으면 4번째가 막혀야 합니다.
    for (let i = 0; i < 2; i += 1) {
      await call(`/api/professional/clients/${clientProfile}/missions`, {
        token: proToken, method: 'POST', body: { contentKey: key, note: null } })
    }
    r = await call(`/api/professional/clients/${clientProfile}/missions`, {
      token: proToken, method: 'POST', body: { contentKey: key, note: null } })
    ok('하루 4번째 → 429', r.status === 429, `status=${r.status}`)

    // 고객이 시작한 뒤에는 거둘 수 없습니다.
    r = await call(`/api/professional/missions/${assigned}`, { token: proToken, method: 'DELETE' })
    ok('시작 전 배정은 거둘 수 있다', r.status === 200 && r.body?.data?.cancelled === true, JSON.stringify(r.body?.data))
    const gone = Number((await db.query('SELECT count(*)::int n FROM public.user_missions WHERE id=$1',[assigned])).rows[0].n)
    ok('거둔 미션은 사라진다', gone === 0)
  }

  console.log('\n■ 초안 재료 (Phase 4)')
  const hasPlanFn = Number((await db.query(`SELECT count(*)::int n FROM pg_proc WHERE proname='get_client_plan_input'`)).rows[0].n) === 1
  if (!hasPlanFn) {
    console.log('    대기  069 미적용이라 초안 검사를 건너뜁니다')
  } else {
    r = await call(`/api/professional/clients/${clientProfile}/plan-input`, { token: proToken })
    const input = r.body?.data
    ok('초안 재료가 온다', r.status === 200 && input?.has_journey === true, `status=${r.status}`)
    ok('엔진이 필요한 값이 다 있다',
      ['day_no', 'axis_priority', 'day_plan', 'content_tags', 'feedback', 'recent_content_keys']
        .every((k) => k in (input ?? {})),
      Object.keys(input ?? {}).join(','))
    // 콘텐츠 본문을 함께 보내면 필요 없는 자료가 매번 나갑니다.
    ok('콘텐츠 본문은 빠져 있다', !JSON.stringify(input ?? {}).includes('release_content'))
    ok('신상이 섞이지 않는다',
      !JSON.stringify(input ?? {}).includes('@') && !JSON.stringify(input ?? {}).includes(String(clientProfile)))

    r = await call(`/api/professional/clients/${strangerProfile}/plan-input`, { token: proToken })
    ok('내 고객이 아니면 404', r.status === 404, `status=${r.status}`)
    r = await call(`/api/professional/clients/${clientProfile}/plan-input`, { token: strangerToken })
    ok('전문가가 아니면 403', r.status === 403, `status=${r.status}`)

    // 규칙 엔진이 이 입력으로 실제로 돌아야 초안이 나옵니다.
    try {
      const engine = await import('../../mebody-server/src/main/resources/static/assets/journey-rules.js')
      const planned = engine.selectDailyMissions({
        dayNo: input.day_no, dayPlan: input.day_plan, axisPriority: input.axis_priority,
        contentTags: input.content_tags, feedback: input.feedback,
        recentContentKeys: input.recent_content_keys, availableMinutes: 15,
        lastActiveAt: input.last_active_at,
      })
      // 빈 초안을 통과시키면 초안이 망가져도 모릅니다. 실제로 그래서 못 잡을 뻔했습니다.
      ok('앱과 같은 엔진이 이 입력으로 실제 초안을 만든다', planned.length > 0, `${planned.length}개`)
      ok('초안 항목이 화면이 쓰는 모양이다',
        planned.length > 0 && ['slot_no', 'content_key', 'planned_duration_sec', 'source_rule']
          .every((k) => k in planned[0]),
        planned.length ? Object.keys(planned[0]).join(',') : '(빈 초안)')
      ok('초안이 고객의 1순위 축을 반영한다',
        planned.some((m) => /axis_1/.test(m.content_key)) || planned.some((m) => m.source_rule === 'substitute'),
        planned.map((m) => m.content_key).join(','))
    } catch (e) {
      ok('앱과 같은 엔진이 이 입력으로 돈다', false, e.message)
    }
  }

  console.log('\n■ 내 고객이 아니면 못 본다')
  r = await call(`/api/professional/clients/${strangerProfile}`, { token: proToken })
  ok('관계 없는 사람의 결과 → 404', r.status === 404, `status=${r.status}`)
  r = await call(`/api/professional/clients/00000000-0000-0000-0000-000000000000`, { token: proToken })
  ok('없는 id 도 같은 404 (존재 여부를 흘리지 않는다)', r.status === 404, `status=${r.status}`)
  r = await call(`/api/professional/clients/${clientProfile}`, { token: strangerToken })
  ok('전문가가 아닌 사람은 403', r.status === 403, `status=${r.status}`)
  r = await call(`/api/professional/clients/${strangerProfile}/journey`, { token: proToken })
  ok('관계 없는 사람의 수행 기록 → 404', r.status === 404, `status=${r.status}`)
  r = await call(`/api/professional/clients/${clientProfile}/journey`, { token: strangerToken })
  ok('전문가가 아닌 사람의 수행 기록 → 403', r.status === 403, `status=${r.status}`)

  console.log('\n■ 고객이 동의를 거두면 그 순간부터 안 보인다')
  r = await call(`/api/invites/relations/${accepted.relationId}`, { token: strangerToken, method: 'DELETE' })
  ok('남이 남의 연결을 끊을 수 없다', r.status === 404, `status=${r.status}`)

  r = await call(`/api/invites/relations/${accepted.relationId}`, { token: clientToken, method: 'DELETE' })
  ok('고객 본인은 동의를 거둘 수 있다', r.status === 200, `status=${r.status}`)

  r = await call(`/api/professional/clients/${clientProfile}`, { token: proToken })
  ok('거둔 뒤 결과 조회 → 404', r.status === 404, `status=${r.status}`)
  r = await call(`/api/professional/clients/${clientProfile}/journey`, { token: proToken })
  ok('거둔 뒤 수행 기록도 404', r.status === 404, `status=${r.status}`)

  r = await call('/api/professional/clients', { token: proToken })
  const revoked = (r.body?.data ?? []).find((x) => x.status === 'REVOKED')
  ok('목록에서 REVOKED', Boolean(revoked))
  ok('거둔 뒤에는 코드도 사라진다', revoked?.bodyCode == null, String(revoked?.bodyCode))
} finally {
  console.log('\n■ 정리')
  await db.query('DELETE FROM public.questionnaire_responses WHERE answers = \'{"A1":"1"}\'::jsonb AND calculated_code = \'FRRS\' AND user_id = ANY($1::uuid[])',
    [made]).catch(() => {})
  for (const id of made) {
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: SH }).catch(() => {})
  }
  console.log(`  계정 ${made.length}건 정리`)
  await db.end().catch(() => {})
}

const failed = res.filter((x) => !x.p).length
console.log(`\n${failed ? `❌ ${res.length - failed} / ${res.length} 통과` : `✅ ${res.length} / ${res.length} 통과`}\n`)
process.exit(failed ? 1 : 0)
