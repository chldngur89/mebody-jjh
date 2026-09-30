/**
 * 지표 화면 확인용 **가상** 이벤트.
 *
 * ── 왜 필요한가
 * 이벤트를 붙여도 쌓인 게 없으면 퍼널이 전부 0 으로 보여서, 화면이 맞게 만들어졌는지
 * 알 수 없습니다. 실제 사용자가 생기기 전까지 눈으로 볼 자료가 필요합니다.
 *
 * ── 안전 장치
 * 넣는 행마다 `props.demo = true` 를 찍습니다. `--clean` 이 그 표시만 골라 지우므로
 * **실제 사용자 이벤트는 건드리지 않습니다.** 되돌리지 못하는 가짜 데이터는 쓰레기가 됩니다.
 *
 *   npm run seed:analytics          30일치 가상 퍼널
 *   npm run seed:analytics -- --clean   가상 이벤트만 삭제
 *
 * ── 숫자는 어떻게 정했나
 * 아무 숫자나 넣으면 화면이 그럴듯해 보여서 오히려 판단을 흐립니다. 그래서 각 칸에
 * "그럴 법한 이탈" 을 넣었습니다 — 진단은 끝까지 가는 편이고, 저니는 중간에 크게 빠지고,
 * 수익 퍼널은 아주 얇습니다. 실제로도 대개 그 모양입니다.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const CLEAN = process.argv.includes('--clean')

const srv = {}
for (const l of readFileSync(new URL('../../mebody-server/.env', import.meta.url).pathname, 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0) srv[t.slice(0, i)] = t.slice(i + 1)
}
const u = new URL(srv.SUPABASE_DB_URL.replace(/^jdbc:/, ''))
const db = new pg.Client({ host: u.hostname, port: Number(u.port || 5432),
  database: u.pathname.replace(/^\//, '') || 'postgres',
  user: srv.SUPABASE_DB_USERNAME, password: srv.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false } })
await db.connect()

/**
 * 데모 흔적을 지웁니다. `props.demo = true` 와 `[데모]` 이름만 골라 지우므로 실제 자료는 남습니다.
 *
 * **심기 전에 항상 부릅니다.** 예전에는 `--clean` 을 줄 때만 지웠고, 그래서 시드를 돌릴 때마다
 * 앞 회차 위에 쌓였습니다. 회차마다 날짜를 따로 뽑으니 퍼널이 뒤섞여
 * 「초대 발송 45 → 링크 열림 50」 같은 역전이 났습니다. seed:professional 은 이미 이렇게 합니다.
 */
async function cleanDemo() {
  const a = await db.query(`DELETE FROM public.analytics_events WHERE props->>'demo' = 'true'`)
  const p = await db.query(`DELETE FROM public.professional_activity_log
    WHERE professional_id IN (SELECT id FROM public.professionals WHERE display_name LIKE '[데모]%')`)
  const pro = await db.query(`DELETE FROM public.professionals WHERE display_name LIKE '[데모]%'`)
  return { events: a.rowCount, activity: p.rowCount, pros: pro.rowCount }
}

if (CLEAN) {
  const n = await cleanDemo()
  console.log(`\n  앱 이벤트 ${n.events}건 · 전문가 활동 ${n.activity}건 · 데모 전문가 ${n.pros}명 삭제\n`)
  await db.end()
  process.exit(0)
}

console.log('\n■ 기존 데모 데이터 정리 (중복 방지)')
{
  const n = await cleanDemo()
  console.log(`  앱 이벤트 ${n.events}건 · 전문가 활동 ${n.activity}건 · 데모 전문가 ${n.pros}명 삭제`)
}

/** 각 칸이 앞 칸의 몇 %가 되는지. 그럴 법한 이탈을 넣습니다. */
const FUNNELS = [
  { name: '진단', steps: [
    ['landing_viewed', 1200], ['questionnaire_started', 0.42],
    ['questionnaire_completed', 0.71], ['result_viewed', 0.94]] },
  { name: '저니', steps: [
    ['journey_started', 0.38], ['journey_viewed', 0.82], ['mission_started', 0.64],
    ['mission_completed', 0.77], ['feedback_submitted', 0.45],
    ['weekly_report_viewed', 0.31], ['next_journey_viewed', 0.48]] },
  { name: '수익', steps: [
    ['paywall_viewed', 0.22], ['checkout_clicked', 0.17], ['subscription_started', 0.55]] },
  { name: '공유', steps: [
    ['result_share_clicked', 0.19], ['result_share_succeeded', 0.63],
    ['shared_link_opened', 0.34]] },
]

/**
 * 전문가 퍼널은 **한 줄기로 이어져야** 합니다.
 *
 * 처음에는 앱 이벤트(invite_opened·invite_accepted)와 전문가 로그(invite_sent·client_opened)를
 * 따로 만들었는데, 그러면 "동의한 고객 2명인데 결과를 32번 봤다" 같은 숫자가 나옵니다.
 * 화면에는 1600% 로 찍혔습니다. 앞뒤가 안 맞는 가상 자료는 판단을 돕는 게 아니라 흐립니다.
 *
 * 그래서 초대 발송 수 하나에서 시작해 각 칸의 비율로 내려갑니다.
 */
const INVITES_SENT = 70
const PRO_STEPS = [
  ['invite_opened', 0.61, 'app'],
  ['invite_accepted', 0.72, 'app'],
  ['client_opened', 0.84, 'pro'],
  ['activity_viewed', 0.65, 'pro'],
  ['assignment_created', 0.38, 'pro'],
]

/** 주어진 날짜들에 그대로 기록합니다. 부분집합을 넘기면 퍼널이 어떤 창에서도 단조입니다. */
const logProOnDays = async (proId, event, days) => {
  if (!days.length) return
  await db.query(
    `INSERT INTO public.professional_activity_log (professional_id, client_user_id, event, created_at)
     SELECT $1, NULL, $2, now() - make_interval(days => d::int, hours => (random() * 23)::int)
       FROM unnest($3::int[]) AS d`, [proId, event, days])
}

const logAppOnDays = async (event, days) => {
  if (!days.length) return
  await db.query(
    `INSERT INTO public.analytics_events (event, props, session_id, path, created_at)
     SELECT $1, jsonb_build_object('demo', true), 'demo-' || md5(random()::text), '/',
            now() - make_interval(days => d::int, hours => (random() * 23)::int)
       FROM unnest($2::int[]) AS d`, [event, days])
  total += days.length
}

console.log('\n■ 가상 앱 이벤트')
let total = 0
/**
 * 저니·수익·공유 퍼널은 모두 **「결과 확인」에서 갈라져 나옵니다.**
 * 앞 퍼널의 마지막 칸에서 이어 붙이면 뒤로 갈수록 0 이 되고, 화면이 텅 빕니다
 * (처음에 그렇게 만들어서 수익 퍼널이 1 → 0 → 0 이 됐습니다).
 */
/**
 * 각 퍼널도 **부분집합 체인**으로 만듭니다.
 *
 * 30일에 흩뿌리는 것은 그대로입니다 — 하루에 몰아 넣으면 기간 필터가 맞는지 볼 수 없습니다.
 * 다만 칸마다 **따로** 흩뿌리면 안 됩니다. 지표의 기간 창이 앞으로 밀릴 때 칸마다 서로 다른
 * 비율로 빠져나가 뒤 칸이 앞 칸보다 커집니다(전문가 퍼널에서 실제로 났던 사고).
 *
 * 첫 칸에서 날짜를 정하고 뒤 칸은 그 앞쪽 n개를 물려받습니다.
 */
let visitorDays = []   // 저니·수익·공유가 갈라져 나올 「결과 확인」 자리의 날짜들
for (const funnel of FUNNELS) {
  const line = []
  // 진단은 처음부터 만들고, 나머지는 결과 확인에서 갈라져 나옵니다.
  let days = funnel.name === '진단' ? [] : visitorDays.slice()
  for (const [event, factor] of funnel.steps) {
    if (factor > 1) {
      // 첫 칸이 1 보다 크면 절대값입니다. 이때만 새로 날짜를 뽑습니다.
      days = Array.from({ length: Math.round(factor) }, () => Math.floor(Math.random() * 29))
    } else {
      days = days.slice(0, Math.round(days.length * factor))
    }
    if (event === 'result_viewed') visitorDays = days.slice()
    line.push(`${event.replace(/_/g, ' ')} ${days.length}`)
    await logAppOnDays(event, days)
  }
  console.log(`  ${funnel.name.padEnd(8)} ${line.join(' → ')}`)
}

console.log('\n■ 가상 전문가 활동')
// 전문가 5명 중 3명만 최근 활동 — 주간 활성이 100%가 아니게 합니다.
const proIds = []
const profiles = (await db.query(`SELECT id FROM public.user_profiles LIMIT 5`)).rows
for (let i = 0; i < Math.min(5, profiles.length); i += 1) {
  const r = await db.query(
    `INSERT INTO public.professionals (user_profile_id, type, display_name)
     VALUES ($1, 'PERSONAL_TRAINER', $2)
     ON CONFLICT (user_profile_id) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`, [profiles[i].id, `[데모] 트레이너 ${i + 1}`])
  proIds.push(r.rows[0].id)
}

/**
 * 초대 한 건마다 **어느 전문가의 것이고 며칠 전인지**를 미리 정합니다.
 *
 * 예전에는 칸마다 따로 흩뿌렸습니다(`random() * 29`). 그러면 단조 감소가
 * **시드한 순간에만** 맞습니다. 지표의 기간 창이 앞으로 밀리면 칸마다 서로 다른 비율로
 * 창 밖으로 빠져나가 역전됩니다. 실제로 9일 뒤에 「초대 발송 35 → 링크 열림 36」 이
 * 나와서 verify:metrics 가 잡았습니다.
 *
 * 이제 뒤 칸은 앞 칸의 **부분집합**이고 날짜를 그대로 물려받습니다.
 * 그러면 어떤 기간으로 잘라도 뒤 칸이 앞 칸보다 많을 수 없습니다.
 *
 * 전문가별 구간도 여기서 정합니다. 앞 3명은 최근 7일(0~6), 뒤 2명은 그 이전(8~25)에서
 * 뽑습니다. 그래야 「주간 활성 전문가 3 / 5」 가 화면에서 60% 로 나옵니다.
 * 두 조건(단조성·주간 활성)을 같이 만족시키려면 **초대 자체를 그 구간에서 뽑아야** 합니다.
 */
const ACTIVE_PROS = 3
const invites = []
for (let i = 0; i < proIds.length; i += 1) {
  const n = i === proIds.length - 1
    ? INVITES_SENT - Math.floor(INVITES_SENT / proIds.length) * (proIds.length - 1)
    : Math.floor(INVITES_SENT / proIds.length)
  const [from, to] = i < ACTIVE_PROS ? [0, 6] : [8, 25]
  for (let k = 0; k < n; k += 1) {
    invites.push({ proId: proIds[i], day: from + Math.floor(Math.random() * (to - from + 1)) })
  }
}

// 1칸: 초대 발송 — 전체
for (const id of proIds) {
  await logProOnDays(id, 'invite_sent', invites.filter((x) => x.proId === id).map((x) => x.day))
}

const proLine = [`초대 발송 ${invites.length}`]
// 뒤 칸은 앞 칸의 **앞쪽 n개**를 그대로 물려받습니다. 부분집합이므로 어떤 창에서도 단조입니다.
let surviving = invites
for (const [event, rate, where] of PRO_STEPS) {
  surviving = surviving.slice(0, Math.round(surviving.length * rate))
  proLine.push(`${event.replace(/_/g, ' ')} ${surviving.length}`)
  if (where === 'app') {
    await logAppOnDays(event, surviving.map((x) => x.day))
  } else {
    for (const id of proIds) {
      await logProOnDays(id, event, surviving.filter((x) => x.proId === id).map((x) => x.day))
    }
  }
}
console.log(`  전문가 ${proIds.length}명 · ${proLine.join(' → ')}`)
console.log(`  최근 7일 활동 전문가 3 / ${proIds.length}명`)

console.log(`\n  앱 이벤트 ${total}건 생성. 콘솔 → 지표 탭에서 확인하세요.`)
console.log('  지울 때:  npm run seed:analytics -- --clean\n')
await db.end()
