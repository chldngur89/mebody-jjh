/**
 * **APK 안에서 서버에 닿는가.**
 *
 * ── 왜 따로 만들었나
 * 스위트 43개 중 CORS 를 보는 것이 하나도 없었습니다. 전부 node 에서 부르거나
 * 브라우저(`http://localhost:3000`)에서 부르는데, 그 두 자리는 **원래 허용 목록에 있습니다.**
 * 정작 사용자가 쓰는 자리 — 안드로이드 웹뷰의 `https://localhost` — 만 빠져 있었고,
 * 그래서 APK 안에서 회원가입·로그인·비밀번호 재설정·탈퇴·전문가 초대가 전부
 * CORS 403 이었습니다(실측 2026-10-12). 에뮬레이터에 깔아 보기 전까지 아무도 몰랐습니다.
 *
 * ── 무엇을 보나
 * 앱이 실제로 부르는 서버 주소마다, 웹뷰 Origin 으로 프리플라이트를 보내
 * `Access-Control-Allow-Origin` 이 돌아오는지 봅니다. 목록은 **소스에서 뽑습니다** —
 * 여기에 베껴 적으면 새 호출이 생겼을 때 조용히 빠집니다.
 *
 * 사용: npm run verify:app-origin
 *       MEBODY_SERVER_BASE=https://... npm run verify:app-origin   (운영 확인)
 */
import { readFileSync, readdirSync } from 'node:fs'

const BASE = (process.env.MEBODY_SERVER_BASE ?? 'http://localhost:8081').replace(/\/+$/, '')
/** Capacitor 안드로이드가 번들을 서빙하는 주소. capacitor.config.ts 에 scheme 를 바꾸면 같이 바뀝니다. */
const APP_ORIGIN = 'https://localhost'

const res = []
const ok = (l, p, d = '') => { res.push(p); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }

/** 앱 소스에서 서버 호출 경로를 뽑습니다. 템플릿 변수는 자리표시자로 바꿉니다. */
function appServerPaths() {
  const dir = new URL('../src/api/', import.meta.url).pathname
  const paths = new Set()
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(`${dir}${f}`, 'utf8')
    for (const m of src.matchAll(/\$\{API_BASE\}(\/[^`'"\s]*)/g)) {
      // `${encodeURIComponent(token)}` 같은 조각은 아무 값이나 넣어도 CORS 판정은 같습니다.
      paths.add(m[1].replace(/\$\{[^}]*\}/g, 'x'.repeat(25)))
    }
  }
  return [...paths].sort()
}

console.log(`\n■ 앱이 부르는 서버 주소 (${BASE})`)
const paths = appServerPaths()
ok('소스에서 호출 경로를 찾았다', paths.length >= 5, `${paths.length}개`)

console.log('\n■ 웹뷰 Origin 이 CORS 를 통과하는가')
// 먼저 서버가 떠 있는지. 안 떠 있으면 전부 FAIL 이 나서 원인을 못 읽습니다.
let reachable = false
try {
  const r = await fetch(`${BASE}/api/public/health`, { signal: AbortSignal.timeout(10000) })
  reachable = r.status < 500
} catch { /* 아래에서 알립니다 */ }
ok('서버에 닿는다', reachable, reachable ? BASE : `${BASE} 에 응답이 없습니다 — 서버를 띄우고 다시 돌리세요`)

if (reachable) {
  for (const path of paths) {
    let allow = null
    let status = 0
    let trace = ''
    try {
      const r = await fetch(`${BASE}${path}`, {
        method: 'OPTIONS',
        headers: {
          Origin: APP_ORIGIN,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type',
        },
        signal: AbortSignal.timeout(10000),
      })
      status = r.status
      allow = r.headers.get('access-control-allow-origin')
      // 실패했을 때 Railway 로그와 맞춰 볼 수 있어야 합니다. 시각과 요청 id 가 없으면
      // "아까는 됐는데" 로 끝나고 원인을 영영 못 찾습니다(2026-10-12 에 실제로 그랬습니다).
      trace = [new Date().toTimeString().slice(0, 8),
               r.headers.get('x-railway-request-id'),
               r.headers.get('x-railway-edge')].filter(Boolean).join(' · ')
    } catch (e) {
      allow = `오류: ${String(e).slice(0, 40)}`
    }
    ok(`${path}`, allow === APP_ORIGIN, allow === APP_ORIGIN ? '' : `HTTP ${status} · allow-origin=${allow ?? '없음'} · ${trace}`)
  }

  console.log('\n■ 아무 주소나 열어 주지는 않는가')
  // 전부 허용(*)으로 풀어 버리면 위 검사는 통과하지만 보호가 사라집니다.
  let wildOk = false
  let wildAllow = null
  try {
    const r = await fetch(`${BASE}/api/public/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
      signal: AbortSignal.timeout(10000),
    })
    wildAllow = r.headers.get('access-control-allow-origin')
    wildOk = wildAllow === null
  } catch { wildOk = true }
  ok('모르는 주소는 막는다', wildOk, `allow-origin=${wildAllow ?? '없음'}`)
}

console.log('\n■ 설정이 코드에 박혀 있는가')
// 운영 환경변수(FRONTEND_ORIGIN)에 의존하면 배포 때 빠집니다. 앱 주소는 고정값입니다.
const sec = readFileSync(new URL('../../mebody-server/src/main/java/com/mebody/common/config/SecurityConfig.java', import.meta.url).pathname, 'utf8')
ok('웹뷰 주소가 코드에 있다', sec.includes(`"${APP_ORIGIN}"`), '환경변수에 맡기면 배포에서 빠집니다')

const failed = res.filter((p) => !p)
console.log(failed.length === 0 ? `\n  OK — ${res.length}개 검증 모두 통과\n`
  : `\n  FAIL — ${failed.length}개 실패 / ${res.length - failed.length}개 통과\n`)
process.exit(failed.length === 0 ? 0 : 1)
