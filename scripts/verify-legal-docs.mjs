/**
 * 약관·개인정보처리방침이 **두 벌인데 내용이 같은가.**
 *
 * 같은 문서가 두 곳에 있습니다.
 *   앱   mebody-jjh/public/{privacy,terms}.html        — APK 안에 들어갑니다
 *   웹   mebody-server/.../static/{privacy,terms}.html — 사이트가 서빙합니다
 *
 * 꾸밈(머리말·스타일·내비게이션)은 달라도 됩니다. 앱은 독립 문서라 폰트를 직접 싣고,
 * 웹은 사이트 CSS 를 씁니다. **법적 본문이 달라지면 안 됩니다.**
 *
 * 실제로 갈라져 있었습니다. 074 로 「몸 기록」 수집 항목을 더했을 때 앱 사본에만 들어가서,
 * 앱과 웹이 서로 다른 수집 항목을 고지하는 상태가 됐습니다. 한쪽만 고치는 일은 반드시
 * 다시 일어나므로 사람이 기억하는 대신 여기서 막습니다.
 *
 * 사용: npm run verify:legal-docs
 */
import { readFileSync } from 'node:fs'

const res = []
const ok = (l, p, d = '') => { res.push(p); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }

const APP = new URL('../public/', import.meta.url).pathname
const WEB = new URL('../../mebody-server/src/main/resources/static/', import.meta.url).pathname

/** 태그·공백을 걷어내고 **문장만** 남깁니다. 꾸밈 차이는 여기서 사라집니다. */
function sentences(path) {
  const raw = readFileSync(path, 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '\n')
  const decoded = raw
    .replace(/&middot;/g, '·').replace(/&mdash;/g, '—').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  return decoded.split('\n').map((l) => l.trim()).filter((l) => l.length >= 12)
}

/** 본문이 아니라 꾸밈·안내에 해당하는 줄. 양쪽이 달라도 되는 것들입니다. */
const CHROME = [
  /^mebody( ·|$)/, /자세·체형 셀프 체크$/, /^홈으로$/, /^서비스명/,
  /법적 효력을 갖는 최종 고지문이 아닙니다/,
  // 사이트 머리말·푸터. 웹에만 있는 것이 정상입니다.
  /^mebody Code 셀프 체크$/, /All rights reserved/,
]
const isChrome = (l) => CHROME.some((re) => re.test(l))

console.log('\n■ 앱과 웹의 법적 본문이 같은가')
for (const name of ['privacy', 'terms']) {
  const app = sentences(`${APP}${name}.html`).filter((l) => !isChrome(l))
  const web = sentences(`${WEB}${name}.html`).filter((l) => !isChrome(l))
  const inWeb = new Set(web)
  const inApp = new Set(app)
  const missingFromWeb = app.filter((l) => !inWeb.has(l))
  const missingFromApp = web.filter((l) => !inApp.has(l))

  ok(`${name} — 앱에만 있는 문장이 없다`, missingFromWeb.length === 0,
     missingFromWeb.slice(0, 2).map((l) => l.slice(0, 50)).join(' / '))
  ok(`${name} — 웹에만 있는 문장이 없다`, missingFromApp.length === 0,
     missingFromApp.slice(0, 2).map((l) => l.slice(0, 50)).join(' / '))
}

console.log('\n■ 새 개인정보가 고지돼 있는가')
// 074 가 더한 몸 기록. 수집 항목에 없으면 고지 없이 모으는 것이 됩니다.
for (const where of [`${APP}privacy.html`, `${WEB}privacy.html`]) {
  const t = readFileSync(where, 'utf8')
  const label = where.includes('/public/') ? '앱' : '웹'
  ok(`${label} 방침에 몸 기록이 적혀 있다`, /몸 기록/.test(t))
  ok(`${label} 방침이 몸 기록을 진단으로 말하지 않는다`,
     !/몸 기록[\s\S]{0,200}?(진단합니다|판독|치료를 제공)/.test(t))
}

console.log('\n■ 아직 비어 있는 자리')
// 막지는 않습니다. 사업자 등록이 나와야 채울 수 있습니다.
// 다만 몇 개가 남았는지는 늘 보이게 둡니다 — 조용히 잊히면 그대로 출시됩니다.
const holes = new Set()
for (const f of ['privacy', 'terms']) {
  for (const m of readFileSync(`${APP}${f}.html`, 'utf8').matchAll(/\[([^\]]{2,20})\]/g)) holes.add(m[1])
  if (/사업자등록 준비 중/.test(readFileSync(`${APP}${f}.html`, 'utf8'))) holes.add('사업자등록번호')
}
console.log(`  남은 자리 ${holes.size}개: ${[...holes].join(', ') || '없음'}`)
console.log('  (사업자 등록이 나와야 채울 수 있습니다 — 출시 전 필수)')

const failed = res.filter((p) => !p)
console.log(failed.length === 0 ? `\n  OK — ${res.length}개 검증 모두 통과\n`
  : `\n  FAIL — ${failed.length}개 실패 / ${res.length - failed.length}개 통과\n`)
process.exit(failed.length === 0 ? 0 : 1)
