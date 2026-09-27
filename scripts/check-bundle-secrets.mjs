/**
 * 빌드된 번들에 비밀이 박혀 있는지 검사합니다.
 *
 * 왜 필요한가:
 *   `env:check` 는 로컬 `.env.local` 만 봅니다. 배포는 **Vercel 대시보드의 환경변수**로
 *   빌드되므로, 거기서 실수로 `VITE_SUPABASE_SERVICE_ROLE_KEY` 를 만들면 로컬 검사는
 *   아무것도 못 잡습니다. Vite 는 `VITE_` 가 붙은 값을 **코드에 문자열로 박아** 넣으므로
 *   그 순간 서비스 롤 키가 누구나 읽을 수 있게 공개됩니다.
 *   서비스 롤 키는 RLS 를 전부 우회합니다 — 모든 회원의 결과·연락처가 열립니다.
 *
 *   Vercel 이 "public framework prefix" 경고를 띄우는 게 정확히 이 위험 때문입니다.
 *   경고는 사람이 무시할 수 있으니 기계가 한 번 더 봅니다.
 *
 * 무엇을 보는가:
 *   1. JWT 처럼 생긴 문자열을 찾아 payload 를 열고 `role` 이 service_role 인지
 *      (이름이 아니라 **값의 내용**을 봅니다. 변수명을 어떻게 바꿔도 걸립니다)
 *   2. 비밀로 보이는 이름이 번들에 남아 있는지
 *   3. API base 가 허용 목록에 있는 주소인지 (2026-09-22 감사 P0-1)
 *
 * 사용: npm run check:bundle   (npm run build 뒤에)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const DIST = 'dist'
/** 앱이 붙어도 되는 서버. 여기 없는 주소가 번들에 있으면 배포가 잘못된 것입니다. */
const ALLOWED_API_HOSTS = [
  'mebodyserver-production.up.railway.app',
  'localhost',
  '127.0.0.1',
]

if (!existsSync(DIST)) {
  console.error(`\n  ${DIST}/ 가 없습니다. 먼저 npm run build 를 하세요.\n`)
  process.exit(1)
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(js|mjs|cjs|html|css|json|map)$/.test(name)) out.push(p)
  }
  return out
}

const files = walk(DIST)
const failures = []
const notes = []

// ── 1) JWT 의 내용을 본다. 이름이 아니라 값이 무엇인지로 판정합니다.
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g
const seenRoles = new Set()
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const token of text.match(JWT) ?? []) {
    let payload
    try {
      payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    } catch {
      continue
    }
    const role = String(payload?.role ?? '')
    if (role) seenRoles.add(role)
    if (role === 'service_role') {
      failures.push(
        `서비스 롤 키가 번들에 박혀 있습니다: ${file}\n`
        + '      이 키는 RLS 를 전부 우회합니다. 모든 회원의 결과와 연락처가 공개된 상태입니다.\n'
        + '      1) Vercel 환경변수에서 VITE_ 가 붙은 서비스 롤 키를 지우세요\n'
        + '      2) Supabase → Settings → API 에서 **키를 폐기하고 새로 발급**하세요 (이미 노출됐습니다)\n'
        + '      3) 다시 빌드·배포하세요',
      )
    }
  }
}
if (seenRoles.size) notes.push(`번들에서 본 JWT role: ${[...seenRoles].join(', ')}`)

// ── 2) 비밀로 보이는 이름이 남아 있는지. 값이 지워졌어도 이름이 남으면 흔적입니다.
const NAME_HINTS = [/SERVICE_ROLE/i, /SUPABASE_SECRET/i, /PRIVATE_KEY/i, /\bDB_PASSWORD\b/i]
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const re of NAME_HINTS) {
    if (re.test(text)) {
      failures.push(`비밀로 보이는 이름이 번들에 있습니다 (${re.source}): ${file}`)
    }
  }
}

// ── 3) API base 가 맞는 주소인지 (감사 P0-1 — 존재하지만 API 가 없는 주소로 배포됐던 사고)
//
// **모든 URL 을 보지 않습니다.** 번들에는 문서 링크·유튜브·schema.org 같은 것이 잔뜩 있고
// 그건 콘텐츠입니다. 사고가 나는 자리는 하나입니다 — **배포 대상 모양의 호스트**
// (railway.app · vercel.app). 실제 사고도 railway 주소를 넣어야 하는 자리에
// vercel 정적 사이트 주소가 들어간 것이었습니다.
const DEPLOY_SHAPED = /\.railway\.app$|\.vercel\.app$/
/** 앱 자신의 주소. API base 가 아니라 공유 링크·딥링크에 쓰입니다. */
const APP_HOSTS = ['mebody-jjh.vercel.app']

const deployHosts = new Set()
for (const file of files) {
  if (!/\.(js|mjs|html)$/.test(file)) continue
  const text = readFileSync(file, 'utf8')
  for (const m of text.match(/https?:\/\/[a-z0-9.-]+(?::\d+)?/gi) ?? []) {
    let host
    try { host = new URL(m).hostname } catch { continue }
    if (DEPLOY_SHAPED.test(host)) deployHosts.add(host)
  }
}

for (const host of deployHosts) {
  if (APP_HOSTS.includes(host)) continue
  if (ALLOWED_API_HOSTS.includes(host)) continue
  failures.push(
    `배포 주소 자리에 허용되지 않은 호스트가 있습니다: ${host}\n`
    + `      API 로 허용: ${ALLOWED_API_HOSTS.join(' · ')}\n`
    + `      앱 자신으로 허용: ${APP_HOSTS.join(' · ')}\n`
    + '      주소가 살아 있어도 API 가 없으면 가입·로그인·탈퇴·결제가 전부 조용히 실패합니다.',
  )
}

// API base 가 **아예 빠진** 경우도 잡습니다. 빠지면 서버 기능이 전부 잠깁니다.
const hasApiBase = [...deployHosts].some((h) => ALLOWED_API_HOSTS.includes(h))
if (!hasApiBase) {
  notes.push('번들에 API 서버 주소가 없습니다 — VITE_API_BASE_URL 이 비었거나 localhost 입니다.'
    + ' 결제·주문·휴대폰 가입·탈퇴가 잠깁니다.')
}

console.log('\n■ 번들 비밀 검사')
console.log(`  검사한 파일 ${files.length}개`)
console.log(`  배포 주소 자리: ${[...deployHosts].join(', ') || '(없음)'}`)
for (const n of notes) console.log(`  참고  ${n}`)
for (const f of failures) console.log(`  FAIL  ${f}`)

if (failures.length) {
  console.log(`\n  ✗ ${failures.length}건. 이 번들을 배포하면 안 됩니다.\n`)
  process.exit(1)
}
console.log('\n  ✓ 번들에 비밀이 없고 서버 주소도 허용 목록 안입니다.\n')
