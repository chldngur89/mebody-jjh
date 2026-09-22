/**
 * 운영 지표 검증.
 *
 * ── 무엇을 보는가
 * 지표는 "멈출지 말지" 를 정하는 숫자라, 틀린 숫자는 없는 것보다 나쁩니다.
 * 그래서 계산이 아니라 **말이 되는가**를 봅니다.
 *
 *   · 퍼널이 뒤로 갈수록 줄어드는가 (뒤 칸이 앞 칸보다 크면 뭔가 잘못된 것)
 *   · 앞 칸이 0일 때 비율을 0% 가 아니라 null 로 주는가 ("잴 수 없다" 와 "아무도 안 넘어갔다" 는 다름)
 *   · 비율이 바로 앞 칸 대비인가 (첫 칸 대비면 어디서 떨어지는지 안 보임)
 *   · 관리자만 볼 수 있는가
 *
 * 사용: npm run verify:metrics
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
const ok = (l, p, d = '') => { res.push(p); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }

const stamp = Date.now()
const PW = `Metrics!${stamp}`
const made = []

async function makeUser(label, role) {
  const email = `${label}-${stamp}@phone.mebody.net`
  const r = await fetch(`${SB}/auth/v1/admin/users`, { method: 'POST', headers: SH,
    body: JSON.stringify({ email, password: PW, email_confirm: true }) })
  const user = await r.json()
  if (user?.id) made.push(user.id)
  if (role) await db.query(`UPDATE public.user_profiles SET role=$2 WHERE auth_user_id=$1 OR id=$1`, [user.id, role])
  const token = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: AH,
    body: JSON.stringify({ email, password: PW }) }).then((x) => x.json()).then((b) => b?.access_token)
  return { id: user?.id, email, token }
}

const call = async (path, token) => {
  const r = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  return { status: r.status, body: await r.json().catch(() => null) }
}

await db.connect()
try {
  console.log('\n■ 관리자만 볼 수 있다')
  const admin = await makeUser('metrics-admin', 'ADMIN')
  const member = await makeUser('metrics-member', null)
  ok('계정 준비', Boolean(admin.token && member.token))

  let r = await call('/api/admin/metrics/funnels?days=30')
  ok('토큰 없이 → 401', r.status === 401, `status=${r.status}`)
  r = await call('/api/admin/metrics/funnels?days=30', member.token)
  ok('일반 회원 → 403', r.status === 403, `status=${r.status}`)
  r = await call('/api/admin/metrics/funnels?days=30', admin.token)
  ok('관리자 → 200', r.status === 200, `status=${r.status}`)

  const m = r.body?.data
  console.log('\n■ 퍼널이 말이 되는가')
  const funnels = [['진단', m?.diagnosis], ['저니', m?.journey], ['수익', m?.revenue], ['전문가', m?.professional]]
  for (const [name, steps] of funnels) {
    ok(`${name} 퍼널이 온다`, Array.isArray(steps) && steps.length > 0, `${steps?.length ?? 0}칸`)
    if (!Array.isArray(steps) || steps.length === 0) continue

    // 뒤 칸이 앞 칸보다 크면 숫자가 잘못된 것입니다.
    let shrinking = true, where = ''
    for (let i = 1; i < steps.length; i += 1) {
      if (Number(steps[i].count) > Number(steps[i - 1].count)) {
        shrinking = false
        where = `${steps[i - 1].label}(${steps[i - 1].count}) → ${steps[i].label}(${steps[i].count})`
        break
      }
    }
    ok(`${name} 퍼널이 뒤로 갈수록 줄어든다`, shrinking, where || '')

    ok(`${name} 첫 칸에는 비율이 없다`, steps[0].rate == null, String(steps[0].rate))

    // 비율은 바로 앞 칸 대비여야 합니다.
    let relative = true, detail = ''
    for (let i = 1; i < steps.length; i += 1) {
      const prev = Number(steps[i - 1].count)
      if (prev <= 0) {
        if (steps[i].rate != null) { relative = false; detail = `${steps[i].label}: 앞 칸 0인데 ${steps[i].rate}%` ; break }
        continue
      }
      const expect = Math.round(Number(steps[i].count) * 1000 / prev) / 10
      if (Math.abs(Number(steps[i].rate) - expect) > 0.11) {
        relative = false; detail = `${steps[i].label}: ${steps[i].rate}% vs 앞칸대비 ${expect}%`; break
      }
    }
    ok(`${name} 비율이 바로 앞 칸 대비다`, relative, detail)
  }

  console.log('\n■ 앞 칸이 0이면 비율은 null')
  // 아무도 없는 기간을 물어보면 전부 0이고 비율은 null 이어야 합니다.
  r = await call('/api/admin/metrics/funnels?days=1', admin.token)
  const zeroDay = r.body?.data?.revenue ?? []
  const allNullAfterZero = zeroDay.every((s, i) => i === 0 || Number(zeroDay[i - 1].count) > 0 || s.rate == null)
  ok('앞 칸이 0이면 비율이 null', allNullAfterZero,
    zeroDay.map((s) => `${s.count}/${s.rate}`).join(' '))

  console.log('\n■ 기간이 실제로 걸린다')
  const d7 = (await call('/api/admin/metrics/funnels?days=7', admin.token)).body?.data
  const d90 = (await call('/api/admin/metrics/funnels?days=90', admin.token)).body?.data
  const n7 = Number(d7?.diagnosis?.[0]?.count ?? 0)
  const n90 = Number(d90?.diagnosis?.[0]?.count ?? 0)
  ok('7일 ≤ 90일', n7 <= n90, `7일 ${n7} · 90일 ${n90}`)
  ok('days 가 응답에 실린다', d7?.days === 7 && d90?.days === 90, `${d7?.days} / ${d90?.days}`)

  console.log('\n■ 주간 활성 전문가')
  ok('활성 전문가 수를 함께 준다', typeof m?.totalPros === 'number' && typeof m?.weeklyActivePros === 'number',
    `${m?.weeklyActivePros} / ${m?.totalPros}`)
  ok('활성이 전체를 넘지 않는다', Number(m?.weeklyActivePros) <= Number(m?.totalPros))
} finally {
  console.log('\n■ 정리')
  for (const id of made) {
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: SH }).catch(() => {})
  }
  console.log(`  계정 ${made.length}건 정리`)
  await db.end().catch(() => {})
}

const failed = res.filter((x) => !x).length
console.log(`\n${failed ? `❌ ${res.length - failed} / ${res.length}` : `✅ ${res.length} / ${res.length} 통과`}\n`)
process.exit(failed ? 1 : 0)
