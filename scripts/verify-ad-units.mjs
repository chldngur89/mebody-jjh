/**
 * 광고 형식별 실/테스트 판정 검증 (2026-09-27 Android 점검 P1-1).
 *
 * 막으려는 사고:
 *   배너만 넣고 보상형을 비워 두면, 예전 `hasRealAdUnits()` 는 "둘 중 아무거나 있으면 true" 라
 *   보상형이 **구글 demo 단위인데 isTesting: false** 로 요청됐습니다.
 *   demo 단위를 운영 모드로 부르는 것은 AdMob 정책 위반 소지가 있고 계정 정지까지 갑니다.
 *
 * 무엇을 보는가: `src/lib/ads.ts` 를 실제로 불러 네 조합을 돌립니다.
 *   문자열 검사가 아니라 **함수를 실행해** 판정합니다.
 *
 * 사용: npm run verify:ad-units
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { transformSync } from 'esbuild'

const SRC = 'src/lib/ads.ts'
const BANNER = 'ca-app-pub-4213603824572038/8619609009'
const REWARDED = 'ca-app-pub-4213603824572038/7107216787'
const GOOGLE_DEMO = { banner: 'ca-app-pub-3940256099942544/6300978111',
                      rewarded: 'ca-app-pub-3940256099942544/5224354917' }

const res = []
const ok = (l, p, d = '') => { res.push({ l, p }); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }

/** ads.ts 를 주어진 env 로 불러옵니다. Capacitor import 는 스텁으로 바꿉니다. */
async function loadAds(env) {
  let code = readFileSync(SRC, 'utf8')
  code = code.replace(/import\s*\{\s*Capacitor\s*\}\s*from\s*'@capacitor\/core'/,
    'const Capacitor = { isNativePlatform: () => true }')
  // import.meta.env 를 주입한 객체로 바꿉니다.
  code = code.replaceAll('import.meta.env', '__ENV__')
  const js = transformSync(code, { loader: 'ts', format: 'esm' }).code
  const dir = mkdtempSync(path.join(tmpdir(), 'mebody-ads-'))
  const file = path.join(dir, 'ads.mjs')
  writeFileSync(file, `const __ENV__ = ${JSON.stringify(env)};\n${js}`)
  return import(file)
}

console.log('\n■ 광고 형식별 실/테스트 판정')

const cases = [
  { name: '둘 다 실 단위', env: { VITE_ADMOB_BANNER_RESULT: BANNER, VITE_ADMOB_BANNER_ROUTINE: BANNER, VITE_ADMOB_REWARDED: REWARDED },
    banner: true, rewarded: true },
  { name: '배너만 있고 보상형 비어 있음', env: { VITE_ADMOB_BANNER_RESULT: BANNER, VITE_ADMOB_BANNER_ROUTINE: BANNER, VITE_ADMOB_REWARDED: '' },
    banner: true, rewarded: false },
  { name: '보상형만 있고 배너 비어 있음', env: { VITE_ADMOB_BANNER_RESULT: '', VITE_ADMOB_BANNER_ROUTINE: '', VITE_ADMOB_REWARDED: REWARDED },
    banner: false, rewarded: true },
  { name: '둘 다 비어 있음', env: {}, banner: false, rewarded: false },
]

for (const c of cases) {
  const m = await loadAds(c.env)
  console.log(`\n  [${c.name}]`)
  ok('배너 실 단위 판정', m.isRealBanner('result_bottom') === c.banner, String(m.isRealBanner('result_bottom')))
  ok('보상형 실 단위 판정', m.isRealRewarded() === c.rewarded, String(m.isRealRewarded()))

  // 핵심: demo 단위로 떨어졌으면 **반드시** 테스트 모드여야 합니다.
  const bUnit = m.bannerUnitId('result_bottom')
  const rUnit = m.rewardedUnitId()
  if (bUnit === GOOGLE_DEMO.banner) {
    ok('demo 배너는 테스트 모드로만 요청된다', m.isRealBanner('result_bottom') === false)
  }
  if (rUnit === GOOGLE_DEMO.rewarded) {
    ok('demo 보상형은 테스트 모드로만 요청된다', m.isRealRewarded() === false)
  }
  // 실 단위면 demo 로 떨어지지 않아야 합니다.
  if (c.rewarded) ok('실 보상형이면 demo 로 떨어지지 않는다', rUnit === REWARDED, rUnit)
  if (c.banner) ok('실 배너면 demo 로 떨어지지 않는다', bUnit === BANNER, bUnit)
}

console.log('\n■ 현재 .env.local 값')
const envLocal = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0) envLocal[t.slice(0, i)] = t.slice(i + 1).trim()
}
const live = await loadAds(envLocal)
ok('결과 배너가 실 단위', live.isRealBanner('result_bottom'), live.bannerUnitId('result_bottom'))
ok('루틴 배너가 실 단위', live.isRealBanner('routine'), live.bannerUnitId('routine'))
ok('보상형이 실 단위', live.isRealRewarded(), live.rewardedUnitId())
// 앱 ID 와 단위 ID 를 혼동하면 광고가 아예 안 뜹니다.
//   앱 ID   ca-app-pub-XXXX~YYYY  (물결) — 앱당 하나. Manifest·capacitor.config
//   단위 ID ca-app-pub-XXXX/YYYY  (슬래시) — 자리마다 하나. .env
// capacitor.config.ts 에는 appId 가 둘입니다 — 패키지명(net.mebody.app)과 AdMob 앱 ID.
// ca-app-pub 으로 시작하는 쪽만 봅니다.
const capText = readFileSync('capacitor.config.ts', 'utf8')
const admobAppId = capText.match(/appId:\s*'(ca-app-pub-[^']+)'/)?.[1] ?? ''
ok('AdMob 앱 ID 가 ~ 형식', /^ca-app-pub-\d+~\d+$/.test(admobAppId), admobAppId || '(없음)')

const manifestText = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
const manifestAppId = manifestText.match(/android:value="(ca-app-pub-[^"]+)"/)?.[1] ?? ''
ok('Manifest 앱 ID 가 capacitor.config 와 같다', manifestAppId === admobAppId && admobAppId !== '',
   manifestAppId || '(없음)')

// 단위 ID 자리에 앱 ID 를 넣는 실수를 막습니다.
for (const [label, unit] of [['결과 배너', live.bannerUnitId('result_bottom')],
                             ['루틴 배너', live.bannerUnitId('routine')],
                             ['보상형', live.rewardedUnitId()]]) {
  ok(`${label} 단위 ID 가 / 형식 (앱 ID 를 넣지 않았다)`, /^ca-app-pub-\d+\/\d+$/.test(unit), unit)
}

const failed = res.filter((x) => !x.p).length
console.log(`\n${failed ? `❌ ${res.length - failed} / ${res.length} 통과` : `✅ ${res.length} / ${res.length} 통과`}\n`)
process.exit(failed ? 1 : 0)
