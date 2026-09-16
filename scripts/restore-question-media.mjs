/**
 * questions.media_url 복구
 *
 * 증상: 앱 문항 화면의 상단 사진이 전부 사라짐.
 * 원인: Storage 의 questions/<코드>.webp 파일 32개는 모두 살아 있는데,
 *       DB questions.media_url 컬럼만 85행 전부 null 이 됨.
 *       (같은 UPDATE 로 넣었던 media_url_option_* 는 남아 있으므로,
 *        이 컬럼만 따로 비운 작업이 있었던 것으로 보입니다.)
 *
 * 하는 일: mebody_v1_32 세트 32행에 대해
 *          Storage 에 파일이 실제로 존재하는 것만 media_url = 'questions/<코드>.webp' 로 설정.
 *
 *   node scripts/restore-question-media.mjs          # 미리보기만 (아무것도 안 씀)
 *   node scripts/restore-question-media.mjs --apply  # 실제 반영
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--apply')

function loadEnv() {
  const env = {}
  for (const name of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(resolve(root, name), 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m) env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
      }
    } catch {}
  }
  return env
}

const env = loadEnv()
const URL_ = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
// 쓰기에는 service role 이 필요합니다 (anon 은 questions 에 UPDATE 권한이 없습니다).
const WRITE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !ANON) throw new Error('.env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 필요합니다')
if (APPLY && !WRITE) throw new Error('--apply 에는 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다')

const h = (key) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' })

const rows = await fetch(
  `${URL_}/rest/v1/questions?select=id,question_code,media_url&question_set=eq.mebody_v1_32&order=sort_order`,
  { headers: h(ANON) },
).then((r) => r.json())

console.log(`mebody_v1_32 문항 ${rows.length}개`)

const plan = []
for (const row of rows) {
  const path = `questions/${row.question_code}.webp`
  const head = await fetch(`${URL_}/storage/v1/object/public/${'images'}/${path}`, { method: 'HEAD' })
  if (!head.ok) {
    console.log(`  건너뜀 ${row.question_code}: Storage 에 ${path} 없음 (HTTP ${head.status})`)
    continue
  }
  if (row.media_url === path) {
    console.log(`  이미 정상 ${row.question_code}`)
    continue
  }
  plan.push({ id: row.id, code: row.question_code, from: row.media_url, to: path })
}

console.log(`\n바꿀 행: ${plan.length}개`)
for (const p of plan) console.log(`  ${p.code.padEnd(4)} ${String(p.from)} → ${p.to}`)

if (!APPLY) {
  console.log('\n미리보기만 했습니다. 실제로 반영하려면 --apply 를 붙이세요.')
  process.exit(0)
}

let done = 0
for (const p of plan) {
  const res = await fetch(`${URL_}/rest/v1/questions?id=eq.${p.id}`, {
    method: 'PATCH',
    headers: { ...h(WRITE), Prefer: 'return=minimal' },
    body: JSON.stringify({ media_url: p.to }),
  })
  if (!res.ok) {
    console.error(`  실패 ${p.code}: HTTP ${res.status} ${await res.text()}`)
    continue
  }
  done++
}
console.log(`\n반영 완료: ${done}/${plan.length}`)
console.log('앱은 문항을 localStorage 에 캐시합니다 — 사용자 화면에 바로 반영되지 않으면')
console.log("브라우저에서 localStorage 의 'mebody:questions:mebody_v1_32:v3' 를 지우거나 캐시 키를 올려야 합니다.")
