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

if (CLEAN) {
  const a = await db.query(`DELETE FROM public.analytics_events WHERE props->>'demo' = 'true'`)
  const p = await db.query(`DELETE FROM public.professional_activity_log
    WHERE professional_id IN (SELECT id FROM public.professionals WHERE display_name LIKE '[데모]%')`)
  const pro = await db.query(`DELETE FROM public.professionals WHERE display_name LIKE '[데모]%'`)
  console.log(`\n  앱 이벤트 ${a.rowCount}건 · 전문가 활동 ${p.rowCount}건 · 데모 전문가 ${pro.rowCount}명 삭제\n`)
  await db.end()
  process.exit(0)
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

console.log('\n■ 가상 앱 이벤트')
let total = 0
/**
 * 저니·수익·공유 퍼널은 모두 **「결과 확인」에서 갈라져 나옵니다.**
 * 앞 퍼널의 마지막 칸에서 이어 붙이면 뒤로 갈수록 0 이 되고, 화면이 텅 빕니다
 * (처음에 그렇게 만들어서 수익 퍼널이 1 → 0 → 0 이 됐습니다).
 */
let resultViewed = 0
for (const funnel of FUNNELS) {
  const line = []
  let base = funnel.name === '진단' ? 0 : resultViewed
  for (const [event, factor] of funnel.steps) {
    // 첫 칸이 1 보다 크면 절대값, 아니면 앞 칸 대비 비율입니다.
    const count = factor > 1 ? Math.round(factor) : Math.round(base * factor)
    base = count
    if (event === 'result_viewed') resultViewed = count
    line.push(`${event.replace(/_/g, ' ')} ${count}`)

    // 30일에 흩뿌립니다. 하루에 몰아 넣으면 기간 필터가 맞는지 볼 수 없습니다.
    await db.query(
      `INSERT INTO public.analytics_events (event, props, session_id, path, created_at)
       SELECT $1,
              jsonb_build_object('demo', true),
              'demo-' || md5(random()::text),
              '/',
              now() - make_interval(days => (random() * 29)::int,
                                    hours => (random() * 23)::int)
         FROM generate_series(1, $2)`,
      [event, count])
    total += count
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
 * 전문가 활동 기록.
 *
 * `fromDays`~`toDays` 사이에 흩뿌립니다. **범위의 시작이 중요합니다** — 처음에는
 * "비활성 전문가는 20일 안" 이라고만 했는데, 0~20일은 7일 안도 포함해서
 * 결국 5명 전부 주간 활성으로 잡혔습니다(화면에 100%). 비활성으로 두려면
 * 7일보다 **뒤에서 시작**해야 합니다.
 */
const logPro = async (proId, event, n, fromDays, toDays) => {
  if (n <= 0) return
  await db.query(
    `INSERT INTO public.professional_activity_log (professional_id, client_user_id, event, created_at)
     SELECT $1, NULL, $2,
            -- $3·$4 를 정수로 못 박습니다. 캐스팅이 없으면 Postgres 가 "unknown - unknown"
            -- 으로 보고 어떤 뺄셈인지 고르지 못합니다.
            now() - make_interval(days => $3::int + (random() * ($4::int - $3::int))::int,
                                  hours => (random() * 23)::int)
       FROM generate_series(1, $5)`, [proId, event, fromDays, toDays, n])
}
const logApp = async (event, n) => {
  if (n <= 0) return
  await db.query(
    `INSERT INTO public.analytics_events (event, props, session_id, path, created_at)
     SELECT $1, jsonb_build_object('demo', true), 'demo-' || md5(random()::text), '/',
            now() - make_interval(days => (random() * 29)::int)
       FROM generate_series(1, $2)`, [event, n])
  total += n
}

// 초대 발송은 전문가별로 나눠 담습니다(주간 활성을 세려면 전문가가 구분돼야 합니다).
const perPro = Math.floor(INVITES_SENT / Math.max(proIds.length, 1))
for (let i = 0; i < proIds.length; i += 1) {
  const n = i === proIds.length - 1 ? INVITES_SENT - perPro * (proIds.length - 1) : perPro
  await logPro(proIds[i], 'invite_sent', n, 0, 29)
}

const proLine = [`초대 발송 ${INVITES_SENT}`]
let proBase = INVITES_SENT
for (const [event, rate, where] of PRO_STEPS) {
  const n = Math.round(proBase * rate)
  proBase = n
  proLine.push(`${event.replace(/_/g, ' ')} ${n}`)
  if (where === 'app') {
    await logApp(event, n)
  } else {
    // 앞 3명은 최근 7일 안(0~6일), 뒤 2명은 그보다 전(8~25일)에만 활동합니다.
    // 그래야 "주간 활성 전문가 3 / 5" 가 화면에서 60% 로 나옵니다.
    for (let i = 0; i < proIds.length; i += 1) {
      const share = Math.round(n / proIds.length) + (i === 0 ? n % proIds.length : 0)
      if (i < 3) await logPro(proIds[i], event, share, 0, 6)
      else await logPro(proIds[i], event, share, 8, 25)
    }
  }
}
console.log(`  전문가 ${proIds.length}명 · ${proLine.join(' → ')}`)
console.log(`  최근 7일 활동 전문가 3 / ${proIds.length}명`)

console.log(`\n  앱 이벤트 ${total}건 생성. 콘솔 → 지표 탭에서 확인하세요.`)
console.log('  지울 때:  npm run seed:analytics -- --clean\n')
await db.end()
