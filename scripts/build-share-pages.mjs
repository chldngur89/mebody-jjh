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

  writeFileSync(`${OUT}${code}.html`, `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <!-- 사람은 바로 앱으로. 크롤러는 아래 og 태그만 읽고 갑니다. -->
    <meta http-equiv="refresh" content="0; url=${to}" />
    <link rel="canonical" href="${to}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="mebody" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:image" content="/share-cards/${code}.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="/share-cards/${code}.png" />
    <script>location.replace(${JSON.stringify(to)})</script>
  </head>
  <body>
    <p>mebody 로 이동 중입니다… <a href="${to}">바로 가기</a></p>
  </body>
</html>
`, 'utf8')
  made += 1
}

console.log(`[build-share-pages] 공유 페이지 ${made}장 → public/s/<CODE>.html`)
