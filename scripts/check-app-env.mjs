/**
 * 앱(APK) 빌드 전 환경 점검 — 기기에서 죽는 설정으로 빌드하는 걸 막습니다.
 *
 * Vite 의 VITE_* 는 **빌드 시점에 코드로 박힙니다.** 실행 중에 읽지 않습니다.
 * 그리고 `.env.local` 은 dev 와 build 양쪽에서 모두 이깁니다. 그래서 로컬 서버를 보려고
 * 잠깐 바꿔 둔 `localhost` 가 그대로 APK 에 들어가는 사고가 납니다. 그러면 기기에서
 * 결제·주문·휴대폰 가입·탈퇴가 전부 조용히 실패합니다(단말에는 8081 서버가 없으므로).
 *
 * 그래서 `app:build` / `app:apk` 앞에 세워 두고, 그 경우 빌드를 **거부**합니다.
 * 웹(`npm run build`)은 막지 않습니다 — 브라우저는 개발자 컴퓨터에서 도니까요.
 *
 * 사용: npm run env:check
 */
import { existsSync, readFileSync } from 'node:fs'

/** .env.local 이 .env 를 이깁니다(Vite 와 같은 우선순위). */
function loadEnv() {
  const env = {}
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i > 0 && !(t.slice(0, i) in env)) env[t.slice(0, i)] = t.slice(i + 1).trim()
    }
  }
  return env
}

const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.0\.2\.2|\[::1\])(:|\/|$)/i

const env = loadEnv()
const failures = []
const warnings = []

const apiBase = env.VITE_API_BASE_URL ?? ''
if (!apiBase) {
  warnings.push(
    'VITE_API_BASE_URL 이 비어 있습니다 — 결제·주문·휴대폰 가입·탈퇴가 잠깁니다. 진단과 저니는 그대로 동작합니다.',
  )
} else if (LOCAL_HOST.test(apiBase)) {
  failures.push(
    `VITE_API_BASE_URL 이 로컬 주소입니다: ${apiBase}\n` +
      '      단말에는 그 서버가 없습니다. .env.local 을 배포 주소로 되돌리고 다시 빌드하세요.',
  )
} else if (!/^https:\/\//i.test(apiBase)) {
  failures.push(
    `VITE_API_BASE_URL 이 https 가 아닙니다: ${apiBase}\n` +
      '      Android 9+ 는 평문 HTTP 를 기본 차단합니다.',
  )
}

for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
  if (!env[key]) failures.push(`${key} 가 없습니다 — 앱이 아무것도 못 읽습니다.`)
}

/** 서비스 롤 키는 서버 전용입니다. VITE_ 가 붙으면 브라우저·APK 에 그대로 노출됩니다. */
for (const key of Object.keys(env)) {
  if (key.startsWith('VITE_') && /SERVICE_ROLE|SECRET/i.test(key)) {
    failures.push(`${key} — 비밀 값에 VITE_ 가 붙어 있습니다. 앱 번들에 그대로 박힙니다.`)
  }
}

if (!env.VITE_ADMOB_BANNER_RESULT && !env.VITE_ADMOB_REWARDED) {
  warnings.push('AdMob 광고 단위가 비어 있습니다 — 구글 테스트 광고가 나갑니다(수익 0). `npm run ads:check` 참고.')
}

console.log('\n■ 앱 빌드 환경 점검')
console.log(`  API base  : ${apiBase || '(비어 있음)'}`)
for (const w of warnings) console.log(`  대기  ${w}`)
for (const f of failures) console.log(`  FAIL  ${f}`)

if (failures.length) {
  console.log(`\n  ✗ ${failures.length}건 때문에 앱 빌드를 중단합니다.\n`)
  process.exit(1)
}
console.log(`\n  ✓ 앱 빌드 가능${warnings.length ? ` (경고 ${warnings.length}건)` : ''}\n`)
