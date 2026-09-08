/**
 * 광고 설정 점검 — 앱을 빌드하기 전에 무엇이 준비됐고 뭐가 비었는지 한눈에 봅니다.
 *
 * Vite 의 VITE_* 변수는 "빌드 시점"에 코드에 박힙니다. 실행 중에 읽지 않습니다.
 * 그래서 앱용 값은 **이 컴퓨터의 .env.local** 에 있어야 하고,
 * Vercel 환경변수는 웹사이트 빌드에만 쓰입니다(AdMob 은 웹에서 안 돌아가므로 불필요).
 *
 * 사용: npm run ads:check
 */
import { existsSync, readFileSync } from 'node:fs'

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

const UNIT = /^ca-app-pub-\d{16}\/\d{10}$/
const APP_ID = /^ca-app-pub-\d{16}~\d{10}$/

const units = [
  ['VITE_ADMOB_BANNER_RESULT', '결과 페이지 배너'],
  ['VITE_ADMOB_BANNER_ROUTINE', '공통 스트레칭 배너'],
  ['VITE_ADMOB_REWARDED', '보상형(보너스 주사위)'],
]

console.log('\n■ AdMob 앱 ID')
const cfg = readFileSync('capacitor.config.ts', 'utf8')
const appId = cfg.match(/ca-app-pub-[\d~]+/)?.[0]
console.log(`  ${appId && APP_ID.test(appId) ? 'OK  ' : 'FAIL'} capacitor.config.ts — ${appId ?? '없음'}`)
const manifest = existsSync('android/app/src/main/AndroidManifest.xml')
  ? readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8') : ''
const inManifest = manifest.includes('com.google.android.gms.ads.APPLICATION_ID')
console.log(`  ${inManifest ? 'OK  ' : 'FAIL'} AndroidManifest.xml — ${inManifest ? '등록됨' : '없음 (앱이 즉시 종료됩니다)'}`)

console.log('\n■ 광고 단위 ID (.env.local)')
let real = 0
for (const [key, label] of units) {
  const v = env[key]
  if (!v) {
    console.log(`  대기  ${label.padEnd(22)} — 비어 있음 → 테스트 광고가 나갑니다`)
  } else if (UNIT.test(v)) {
    console.log(`  OK    ${label.padEnd(22)} — ${v}`)
    real += 1
  } else if (APP_ID.test(v)) {
    console.log(`  FAIL  ${label.padEnd(22)} — 앱 ID(~)를 넣으셨습니다. 광고 단위는 '/' 입니다`)
  } else {
    console.log(`  FAIL  ${label.padEnd(22)} — 형식이 다릅니다: ${v}`)
  }
}

console.log('\n■ Supabase (웹·앱 공용)')
for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
  console.log(`  ${env[key] ? 'OK  ' : 'FAIL'} ${key}`)
}

console.log('\n■ 다음 단계')
if (real === 0) {
  console.log('  · 지금은 Google 테스트 광고로 동작합니다. 화면 확인은 이 상태로 충분합니다.')
  console.log('  · 실 광고를 붙이려면 AdMob 에서 광고 단위 3개를 만들어 .env.local 에 넣으세요.')
} else if (real < units.length) {
  console.log(`  · ${real}/${units.length} 개만 실 단위입니다. 나머지는 테스트 광고가 나갑니다.`)
} else {
  console.log('  · 실 광고 단위가 모두 설정됐습니다. 개발 중 실단위 테스트는 무효 트래픽이 될 수 있으니 주의하세요.')
}
console.log('  · 앱 빌드:  npm run app:build   (웹 빌드 → android 동기화)')
console.log('  · 안드로이드 스튜디오 열기:  npm run app:open\n')
