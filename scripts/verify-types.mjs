/**
 * 타입 점검 — 이제 오류 0을 요구한다.
 *
 * 도입 당시엔 기존 오류 4건이 있어 "정의되지 않은 이름"만 게이트로 삼았지만,
 * 그 4건을 모두 고쳐 0이 되었으므로 전체를 게이트로 올린다.
 * 다시 늘어나지 않게 하는 것이 이 스크립트의 목적이다.
 *
 * 사용: npm run verify:types
 */
import { execFileSync } from 'node:child_process'

let out = ''
try {
  execFileSync('npx', ['tsc', '--noEmit'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
} catch (e) {
  out = `${e.stdout ?? ''}${e.stderr ?? ''}`
}

const lines = out.split('\n').filter((l) => /error TS\d+/.test(l))
const blocking = lines.filter((l) => /TS2304|TS2552/.test(l))
const others = lines.filter((l) => !/TS2304|TS2552/.test(l))

if (lines.length === 0) {
  console.log('OK — 타입 오류 0건')
  process.exit(0)
}

// 정의되지 않은 이름(import 누락)은 런타임을 바로 터뜨리므로 먼저 보여준다.
if (blocking.length) {
  console.log(`FAIL — 정의되지 않은 이름 ${blocking.length}건 (import 누락 가능성)`)
  for (const l of blocking) console.log('  ' + l)
}
if (others.length) {
  console.log(`FAIL — 그 외 타입 오류 ${others.length}건`)
  for (const l of others) console.log('  ' + l)
}
process.exit(1)
