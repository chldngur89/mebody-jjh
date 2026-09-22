/**
 * 전문가 확장 데모 데이터 — 화면을 눈으로 확인하기 위한 **가상** 자료입니다.
 *
 * ── 왜 필요한가
 * 운영 DB 의 수행 기록이 사실상 비어 있습니다(미션 11건 전부 scheduled, 피드백 0건).
 * 그 상태로는 Phase 2 화면이 "아직 활동이 없습니다" 만 보여줘서 만든 것이 맞는지 볼 수 없습니다.
 *
 * ── 안전 장치
 * **실제 회원의 데이터는 절대 건드리지 않습니다.** 전용 계정을 새로 만들고 거기에만 넣습니다.
 * 계정 주소는 전부 `demo-pro-…@phone.mebody.net` / `demo-cli-…@phone.mebody.net` 모양이라
 * 한눈에 구분되고, `--clean` 하나로 흔적 없이 지웁니다.
 *
 *   npm run seed:professional          데모 전문가 1명 + 고객 2명 + 14일 수행 기록
 *   npm run seed:professional -- --clean   만든 것 전부 삭제
 *
 * 시드는 되돌릴 수 있어야 합니다. 되돌리지 못하는 가짜 데이터는 운영 DB 에서 쓰레기가 됩니다.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const CLEAN = process.argv.includes('--clean')

const app = {}
for (const l of readFileSync(new URL('../.env.local', import.meta.url).pathname, 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0) app[t.slice(0, i)] = t.slice(i + 1)
}
const SB = app.VITE_SUPABASE_URL, SVC = app.SUPABASE_SERVICE_ROLE_KEY
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

/** 데모 계정임을 주소만 보고 알 수 있게 합니다. 지울 때도 이 규칙으로 찾습니다. */
const DEMO_PREFIX = ['demo-pro-', 'demo-cli-']
const DEMO_PASSWORD = 'MebodyDemo!2026'

await db.connect()

async function clean() {
  const rows = (await db.query(
    `SELECT id, email FROM auth.users WHERE email LIKE 'demo-pro-%' OR email LIKE 'demo-cli-%'`)).rows
  if (rows.length === 0) {
    console.log('  지울 데모 계정이 없습니다.')
    return
  }
  for (const row of rows) {
    // auth.users 를 지우면 프로필·저니·미션·피드백·관계가 FK CASCADE 로 함께 사라집니다.
    const r = await fetch(`${SB}/auth/v1/admin/users/${row.id}`, { method: 'DELETE', headers: SH })
    console.log(`  삭제 ${row.email} → ${r.status}`)
  }
}

async function makeUser(prefix, displayName) {
  const email = `${prefix}${Date.now().toString(36)}@phone.mebody.net`
  const r = await fetch(`${SB}/auth/v1/admin/users`, { method: 'POST', headers: SH,
    body: JSON.stringify({ email, password: DEMO_PASSWORD, email_confirm: true }) })
  const user = await r.json()
  if (!user?.id) throw new Error(`계정 생성 실패: ${JSON.stringify(user).slice(0, 160)}`)
  // 프로필 행은 auth.users 트리거가 만듭니다. 이름만 덧입힙니다.
  const profile = (await db.query(
    'SELECT id FROM public.user_profiles WHERE auth_user_id = $1 OR id = $1 LIMIT 1', [user.id])).rows[0]
  await db.query('UPDATE public.user_profiles SET display_name = $2, updated_at = now() WHERE id = $1',
    [profile.id, displayName])
  return { authId: user.id, profileId: profile.id, email, displayName }
}

/** 14일 루틴을 "이만큼 했다" 는 모양으로 채웁니다. */
async function seedJourney(client, { bodyCode, doneDays, skipDays, feedbacks }) {
  const responseId = (await db.query(
    `INSERT INTO public.questionnaire_responses
       (id, user_id, answers, status, calculated_code, question_version, completed_at)
     VALUES (gen_random_uuid(), $1, $2::jsonb, 'completed', $3, 'mebody_v1_32', now() - interval '20 days')
     RETURNING id`,
    [client.profileId, JSON.stringify({ A1: '1', B5: '3', C4: '1', D7: '2' }), bodyCode])).rows[0].id

  const journeyId = (await db.query(
    `INSERT INTO public.user_journeys
       (id, user_id, questionnaire_response_id, template_code, body_code, axis_priority,
        status, current_day, started_at, last_active_at)
     VALUES (gen_random_uuid(), $1, $2, 'starter_14d', $3, $4::jsonb,
             'active', $5, now() - interval '13 days', now() - interval '1 day')
     RETURNING id`,
    [client.profileId, responseId, bodyCode,
     // 실제 저니와 같은 모양이어야 합니다. 문자열 배열을 넣으면 규칙 엔진이
     // axis·rank·direction 을 못 읽어 초안이 늘 0개로 나옵니다(실제로 그랬습니다).
     JSON.stringify([
       { axis: 'neck', rank: 1, direction: 'F', percent: 80, label: '전방' },
       { axis: 'shoulder', rank: 2, direction: 'L', percent: 70, label: '왼쪽 높음' },
       { axis: 'pelvis', rank: 3, direction: 'R', percent: 60, label: '오른쪽 회전' },
       { axis: 'lower', rank: 4, direction: 'S', percent: 50, label: '뻣뻣' },
     ]), Math.max(...doneDays, 1)])).rows[0].id

  const CONTENT = ['axis_1F', 'axis_2L', 'axis_3L', 'axis_4S', 'waist_left']
  const missionIds = []
  for (let day = 1; day <= 14; day += 1) {
    const slots = day % 3 === 0 ? 3 : 2
    for (let slot = 1; slot <= slots; slot += 1) {
      const status = doneDays.includes(day) ? 'completed'
        : skipDays.includes(day) ? 'skipped'
        : 'scheduled'
      const completedAt = status === 'completed'
        ? `now() - interval '${14 - day} days'` : 'NULL'
      const id = (await db.query(
        `INSERT INTO public.user_missions
           (id, user_journey_id, user_id, day_no, slot_no, content_key, mission_type,
            planned_duration_sec, difficulty, source_rule, status, completed_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${completedAt})
         RETURNING id`,
        [journeyId, client.profileId, day, slot, CONTENT[(day + slot) % CONTENT.length],
         slot === 1 ? 'release' : 'stretch', 180, (day % 3) + 1,
         slot === 1 ? 'axis_p1' : 'axis_p2', status])).rows[0].id
      if (status === 'completed') missionIds.push({ id, day })
    }
  }

  for (const fb of feedbacks) {
    const target = missionIds.find((m) => m.day === fb.day)
    if (!target) continue
    await db.query(
      `INSERT INTO public.journey_mission_feedback
         (id, user_mission_id, user_id, feeling, difficulty, note, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now() - interval '${14 - fb.day} days')`,
      [target.id, client.profileId, fb.feeling, fb.difficulty, fb.note])
  }

  return { journeyId, done: missionIds.length }
}

if (CLEAN) {
  console.log('\n■ 데모 데이터 삭제')
  await clean()
  await db.end()
  console.log('')
  process.exit(0)
}

console.log('\n■ 기존 데모 데이터 정리 (중복 방지)')
await clean()

console.log('\n■ 데모 전문가')
const pro = await makeUser(DEMO_PREFIX[0], '김민수 트레이너')
await db.query(`UPDATE public.user_profiles SET role = 'PROFESSIONAL' WHERE id = $1`, [pro.profileId])
const proId = (await db.query(
  `INSERT INTO public.professionals (user_profile_id, type, display_name)
   VALUES ($1, 'PERSONAL_TRAINER', '김민수 트레이너')
   ON CONFLICT (user_profile_id) DO UPDATE SET status = 'ACTIVE' RETURNING id`, [pro.profileId])).rows[0].id
console.log(`  ${pro.displayName} — ${pro.email}`)

console.log('\n■ 데모 고객 2명')
// 잘 따라오는 고객과 중간에 멈춘 고객. 화면이 두 경우를 다르게 보여줘야 쓸모가 있습니다.
const steady = await makeUser(DEMO_PREFIX[1], '이수진')
const stalled = await makeUser(DEMO_PREFIX[1], '박준호')

const a = await seedJourney(steady, {
  bodyCode: 'FRRS',
  doneDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  skipDays: [11],
  feedbacks: [
    { day: 3, feeling: 'BETTER', difficulty: 'GOOD', note: '목 뒤가 확실히 편해졌어요.' },
    { day: 6, feeling: 'SAME', difficulty: 'HARD', note: '골반 돌리는 동작이 오른쪽만 뻑뻑합니다.' },
    { day: 9, feeling: 'BETTER', difficulty: 'EASY', note: '아침에 일어날 때 허리가 덜 뻣뻣해요.' },
  ],
})
const b = await seedJourney(stalled, {
  bodyCode: 'CLRF',
  doneDays: [1, 2, 3],
  skipDays: [4, 5, 6],
  feedbacks: [
    { day: 2, feeling: 'UNCOMFORTABLE', difficulty: 'HARD', note: '왼쪽 어깨를 올릴 때 걸리는 느낌이 있어요.' },
    { day: 3, feeling: 'SAME', difficulty: 'HARD', note: '시간이 없어서 하루 한 개만 겨우 합니다.' },
  ],
})
console.log(`  ${steady.displayName} — 완료 ${a.done}개 (잘 따라오는 경우)`)
console.log(`  ${stalled.displayName} — 완료 ${b.done}개 (3일째 멈춘 경우)`)

console.log('\n■ 관계 — 둘 다 동의한 상태로 연결')
for (const client of [steady, stalled]) {
  await db.query(
    `INSERT INTO public.professional_clients
       (professional_id, client_user_id, invite_token, status, consented_at)
     VALUES ($1, $2, $3, 'ACTIVE', now() - interval '12 days')`,
    [proId, client.profileId, `demo-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`])
}

console.log('\n■ 로그인 정보')
console.log(`  전문가  ${pro.email}`)
console.log(`  고객A   ${steady.email}`)
console.log(`  고객B   ${stalled.email}`)
console.log(`  비밀번호 ${DEMO_PASSWORD}`)
console.log('\n  지울 때:  npm run seed:professional -- --clean\n')

await db.end()
