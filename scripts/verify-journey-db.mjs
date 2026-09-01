/**
 * MEBODY Journey — 마이그레이션 적용 확인 (.env.local 필요)
 *
 * db/journey/020~023 을 Supabase SQL Editor 에서 실행한 뒤 돌립니다.
 * 카탈로그는 읽히고, 사용자 테이블은 anon 에 막혀 있어야 통과합니다.
 *
 * 사용: node scripts/verify-journey-db.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvLocal() {
  const text = readFileSync(resolve('.env.local'), 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i < 0) continue
    env[trimmed.slice(0, i)] = trimmed.slice(i + 1)
  }
  return env
}

const env = loadEnvLocal()
const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('FAIL: .env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 없습니다')
  process.exit(1)
}

let passed = 0
const failures = []

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${label}`)
  } else {
    failures.push(label)
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function selectAsAnon(table, query = 'select=*') {
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

console.log('MEBODY Journey — DB 검증\n')

console.log('1. 카탈로그 (anon 읽기 가능해야 함)')
const templates = await selectAsAnon('journey_templates')
if (templates.status === 404) {
  console.error('\n마이그레이션이 아직 적용되지 않았습니다. db/journey/README.md 를 따라 020~023 을 실행하세요.')
  process.exit(1)
}
check('journey_templates 조회 가능', Array.isArray(templates.body), JSON.stringify(templates.body)?.slice(0, 120))
check('starter_14d 템플릿 존재', templates.body?.some((row) => row.code === 'starter_14d'))

const starter = templates.body?.find((row) => row.code === 'starter_14d')
check('duration_days = 14', starter?.duration_days === 14)
check('day_plan 14일', starter?.day_plan?.days?.length === 14, `days=${starter?.day_plan?.days?.length}`)

const tags = await selectAsAnon('journey_content_tags')
check('journey_content_tags 23행', tags.body?.length === 23, `len=${tags.body?.length}`)
check('축 태그 8행', tags.body?.filter((row) => row.axis_key).length === 8)
check('전 행 base_duration_sec = 180', tags.body?.every((row) => row.base_duration_sec === 180))

console.log('\n2. 콘텐츠 정합성 (immediate_action_content 와 연결)')
const contents = await selectAsAnon('immediate_action_content', 'select=content_key')
const contentKeys = new Set((contents.body ?? []).map((row) => row.content_key))
const orphans = (tags.body ?? []).filter((row) => !contentKeys.has(row.content_key))
check('고아 태그 없음', orphans.length === 0, orphans.map((r) => r.content_key).join(','))

console.log('\n3. 사용자 테이블 (anon 에 막혀 있어야 함)')
//
// 021 은 anon 에서 GRANT 자체를 REVOKE 하므로 PostgREST 는 401/42501(permission denied)을 돌려준다.
// RLS 정책만 없고 GRANT 가 남아 있으면 200 + [] 가 나온다. 둘 다 "행이 새어나가지 않음"이므로 통과로 본다.
// 행이 하나라도 반환되면 실패다.
for (const table of ['user_journeys', 'user_missions', 'journey_mission_feedback', 'journey_reports']) {
  const result = await selectAsAnon(table)
  const body = result.body
  const leakedRows = Array.isArray(body) && body.length > 0
  const permissionDenied =
    !Array.isArray(body) &&
    (String(body?.code) === '42501' || String(body?.message ?? '').includes('permission denied'))
  const emptyResult = Array.isArray(body) && body.length === 0

  const secured = !leakedRows && (permissionDenied || emptyResult)
  const how = permissionDenied ? 'GRANT 없음(권장)' : emptyResult ? 'RLS 로 빈 결과' : '노출됨'
  check(
    `${table} anon 차단 (${how})`,
    secured,
    `status=${result.status} body=${JSON.stringify(body)?.slice(0, 120)}`,
  )
}

console.log(`\n${'='.repeat(60)}`)
if (failures.length === 0) {
  console.log(`OK — ${passed}개 검증 모두 통과`)
  process.exit(0)
}
console.log(`FAIL — ${failures.length}개 실패 / ${passed}개 통과`)
for (const failure of failures) console.log(`  - ${failure}`)
process.exit(1)
