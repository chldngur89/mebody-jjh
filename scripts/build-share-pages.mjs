/**
 * 코드별 공유 페이지 16장을 만듭니다.
 *
 * ── 왜 필요한가
 * `lib/share.ts` 는 공유 링크를 `/api/share-og?code=FRRS` 로 만들면서 주석에
 * "봇은 og 태그, 사람은 SPA 공유 랜딩으로" 라고 적어 뒀습니다. **그 엔드포인트가
 * 만들어진 적이 없습니다.** 지금 그 주소는 SPA 의 index.html 로 떨어지고,
 * 그래서 **누가 무슨 코드를 공유하든 미리보기가 똑같습니다.**
 *
 * 카카오톡·트위터 같은 크롤러는 자바스크립트를 돌리지 않습니다. 링크를 받은 순간의
 * HTML 에 og 태그가 들어 있어야 합니다. SPA 로는 안 됩니다.
 *
 * ── 어떻게
 * 코드마다 **아주 작은 정적 HTML** 한 장을 미리 구워 둡니다.
 *   · 크롤러 → og 태그를 읽고 그 코드의 카드 이미지를 보여줍니다
 *   · 사람   → 곧바로 앱으로 넘어갑니다 (meta refresh + JS)
 * 서버도 함수도 필요 없습니다. 이미 있는 public/share-cards/<CODE>.png 를 씁니다.
 *
 * 링크에 **결과 id 를 담지 않습니다.** 코드(FRRS 등)는 16가지뿐인 공개 분류라
 * 개인을 가리키지 않습니다. 이 규칙은 verify:share-freeze 가 지킵니다.
 *
 * 사용: npm run build:share-pages  (app:build 가 자동으로 부릅니다)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

const ROOT = new URL('../', import.meta.url).pathname
const OUT = `${ROOT}public/s/`

/**
 * 링크의 기준 주소. **반드시 절대경로여야 합니다.**
 *
 * og:image 를 `/share-cards/FRRS.png` 처럼 상대경로로 두면 카카오톡·트위터·페이스북이
 * 이미지를 못 가져옵니다. 크롤러는 우리 페이지를 자기 서버에서 긁어가므로 "어느 호스트의
 * /share-cards 인가" 를 알 방법이 없습니다. 카드 16장을 만들어 두고도 미리보기에
 * 아무것도 안 뜨던 이유입니다(실측 2026-10-13).
 *
 * 값은 앱과 **같은 출처**에서 가져옵니다 — lib/publicOrigin.ts. 여기에 베껴 적으면
 * 도메인을 바꿀 때 한쪽만 바뀝니다.
 */
function siteOrigin() {
  const fromEnv = String(process.env.VITE_PUBLIC_SITE_URL ?? '').trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  const src = readFileSync(`${ROOT}src/lib/publicOrigin.ts`, 'utf8')
  const m = src.match(/FALLBACK_ORIGIN\s*=\s*'([^']+)'/)
  if (!m) throw new Error('publicOrigin.ts 에서 FALLBACK_ORIGIN 을 찾지 못했습니다')
  return m[1].replace(/\/+$/, '')
}

const ORIGIN = siteOrigin()

/** 캐릭터 이름은 앱과 **같은 출처**에서 읽습니다. 여기에 베껴 적으면 반드시 어긋납니다. */
function characterNames() {
  const src = readFileSync(`${ROOT}src/utils/bodyCodeCalculator.ts`, 'utf8')
  const block = src.match(/export const characterNames[^{]*\{([\s\S]*?)\n\}/)
  if (!block) throw new Error('characterNames 를 찾지 못했습니다 — bodyCodeCalculator.ts 가 바뀌었나요?')
  const out = {}
  for (const m of block[1].matchAll(/([A-Z]{4}):\s*'([^']+)'/g)) out[m[1]] = m[2]
  return out
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const names = characterNames()
const codes = Object.keys(names)
if (codes.length !== 16) throw new Error(`코드가 16개가 아니라 ${codes.length}개입니다`)

mkdirSync(OUT, { recursive: true })

let made = 0
for (const code of codes) {
  const card = `${ROOT}public/share-cards/${code}.png`
  if (!existsSync(card)) throw new Error(`카드 이미지가 없습니다: share-cards/${code}.png`)

  const title = `${code} · ${names[code]} | mebody Code`
  const desc = `자세·체형 셀프 체크로 나온 mebody Code 는 ${code}(${names[code]})입니다. 나의 코드도 확인해보세요.`
  // 사람이 열면 앱으로 보냅니다. ref=share 로 유입을 구분합니다(lib/share.ts 와 같은 값).
  const to = `/?ref=share&code=${code}`
  // 공유자가 붙인 4축(`?ax=72-65-58-22`)을 **그대로 들고 넘어갑니다.**
  // 이 페이지는 코드별로 미리 구워져 있어 ax 를 담을 수 없으므로, 받는 쪽 주소에
  // 이어 붙이는 일은 여기서 해야 합니다. 떨어뜨리면 친구 화면에 막대가 안 뜹니다.
  // (JS 가 꺼져 있으면 meta refresh 가 ax 없이 보냅니다 — 코드만 보이고 막대만 빠집니다)
  const forward = `location.replace(${JSON.stringify(to)} + location.search.replace(/^\\?/, '&'))`
  const cardUrl = `${ORIGIN}/share-cards/${code}.png`
  // canonical 은 **이 페이지 자신**입니다. 넘어갈 주소(ref=share 가 붙은)를 적으면
  // 추적 파라미터가 원본으로 색인됩니다.
  const self = `${ORIGIN}/s/${code}`

  writeFileSync(`${OUT}${code}.html`, `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <!-- 사람은 바로 앱으로. 크롤러는 아래 og 태그만 읽고 갑니다. -->
    <meta http-equiv="refresh" content="0; url=${to}" />
    <link rel="canonical" href="${self}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${self}" />
    <meta property="og:site_name" content="mebody" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:image" content="${cardUrl}" />
    <meta property="og:image:alt" content="${esc(`${code} ${names[code]} mebody Code 카드`)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${cardUrl}" />
    <script>${forward}</script>
  </head>
  <body>
    <p>mebody 로 이동 중입니다… <a href="${to}">바로 가기</a></p>
  </body>
</html>
`, 'utf8')
  made += 1
}

console.log(`[build-share-pages] 공유 페이지 ${made}장 → public/s/<CODE>.html  (기준 주소 ${ORIGIN})`)
