/**
 * 검색 노출 준비가 **실제로 맞는 상태인가.**
 *
 * ── 가장 위험한 것
 * canonical 이 가리키는 주소가 이 사이트를 서빙하지 않는 경우입니다.
 * 2026-10 기준 mebody.net 은 스퀘어스페이스 「공사 중」 페이지입니다. 그 상태로 제출하면
 * 구글이 "원본은 mebody.net" 이라고 읽는데 거기엔 아무것도 없어서, 정작 글이 있는 쪽이
 * 색인에서 밀립니다. 등록 전에 이걸 먼저 걸러야 합니다.
 *
 * ── 그 다음
 * 페이지마다 제목·설명이 **달라야** 합니다. 같으면 구글이 중복으로 보고 하나만 남깁니다.
 * sitemap·canonical·og:url 은 **같은 주소**여야 합니다. 셋이 어긋나면 어느 쪽을 믿을지
 * 검색엔진이 알아서 고르고, 보통 우리가 원하는 쪽이 아닙니다.
 *
 * 사용: npm run verify:seo
 *       MEBODY_SEO_LIVE=0 npm run verify:seo   (네트워크 확인 건너뛰기)
 */
import { readFileSync } from 'node:fs'

const STATIC = new URL('../../mebody-server/src/main/resources/static/', import.meta.url).pathname
const CHECK_LIVE = process.env.MEBODY_SEO_LIVE !== '0'

const res = []
const ok = (l, p, d = '') => { res.push(p); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }
const warn = (l, d = '') => console.log(`  주의  ${l}${d ? ` — ${d}` : ''}`)

const read = (f) => readFileSync(`${STATIC}${f}`, 'utf8')
const pick = (html, re) => { const m = html.match(re); return m ? m[1] : null }

const PAGES = [
  { file: 'index.html', path: '/' },
  { file: 'privacy.html', path: '/privacy' },
  { file: 'terms.html', path: '/terms' },
]

console.log('\n■ 페이지마다 제목·설명이 다른가')
const titles = new Map()
const descs = new Map()
for (const p of PAGES) {
  const html = read(p.file)
  const title = pick(html, /<title>([^<]*)<\/title>/)
  const desc = pick(html, /<meta name="description" content="([^"]*)"/)
  ok(`${p.path} 제목이 있다`, Boolean(title && title.trim()), title ?? '없음')
  ok(`${p.path} 설명이 있다`, Boolean(desc && desc.trim().length >= 20), desc ? `${desc.length}자` : '없음')
  if (title) titles.set(p.path, title)
  if (desc) descs.set(p.path, desc)
}
ok('제목이 서로 다르다', new Set(titles.values()).size === titles.size,
   `${new Set(titles.values()).size}/${titles.size}가지`)
ok('설명이 서로 다르다', new Set(descs.values()).size === descs.size,
   `${new Set(descs.values()).size}/${descs.size}가지`)

console.log('\n■ canonical · og:url · sitemap 이 같은 주소인가')
const sitemap = read('sitemap.xml')
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
ok('sitemap 에 공개 페이지가 다 있다', locs.length === PAGES.length, `${locs.length}개`)

let origin = null
for (const p of PAGES) {
  const html = read(p.file)
  const canonical = pick(html, /<link rel="canonical" href="([^"]+)"/)
  const ogUrl = pick(html, /<meta property="og:url" content="([^"]+)"/)
  const expect = locs.find((l) => new URL(l).pathname === p.path)
  ok(`${p.path} canonical 이 sitemap 과 같다`, canonical === expect, `${canonical} vs ${expect}`)
  ok(`${p.path} og:url 이 canonical 과 같다`, ogUrl === canonical)
  if (canonical && !origin) origin = new URL(canonical).origin
}

console.log('\n■ robots')
const robots = read('robots.txt')
ok('Sitemap 줄이 있다', /^Sitemap:\s*\S+$/m.test(robots), (robots.match(/Sitemap:.*/) ?? ['없음'])[0])
ok('Sitemap 주소가 canonical 과 같은 도메인', (robots.match(/Sitemap:\s*(\S+)/) ?? [])[1]?.startsWith(origin ?? '\u0000'))
ok('공개 페이지를 막지 않는다', !/^Disallow:\s*\/\s*$/m.test(robots))
ok('관리 화면은 막는다', /Disallow:\s*\/admin/.test(robots) && /Disallow:\s*\/me/.test(robots))

console.log('\n■ 구조화 데이터')
const indexHtml = read('index.html')
const ld = pick(indexHtml, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
ok('JSON-LD 가 있다', Boolean(ld))
if (ld) {
  let parsed = null
  try { parsed = JSON.parse(ld) } catch { /* 아래에서 실패로 잡힙니다 */ }
  ok('JSON-LD 가 올바른 JSON 이다', Array.isArray(parsed) || (parsed && typeof parsed === 'object'))
  const flat = JSON.stringify(parsed ?? {})
  // 없는 것을 있다고 적으면 구글이 리치 결과를 아예 꺼 버립니다.
  ok('없는 평점·후기를 적지 않았다', !/aggregateRating|reviewCount|ratingValue/.test(flat))
  ok('사업자 정보를 지어내지 않았다', !/telephone|streetAddress|postalCode/.test(flat),
     '사업자 등록 후에 넣습니다')
  ok('주소가 canonical 도메인과 같다', flat.includes(origin ?? '\u0000'))
}

if (CHECK_LIVE && origin) {
  console.log(`\n■ ${origin} 이 실제로 이 사이트를 서빙하는가`)
  // 여기가 핵심입니다. 안 서빙하는 도메인을 canonical 로 걸고 제출하면
  // 글이 있는 쪽이 "원본이 아니다" 로 읽혀 색인에서 밀립니다.
  let body = ''
  let status = 0
  try {
    const r = await fetch(origin, { redirect: 'follow', signal: AbortSignal.timeout(15000) })
    status = r.status
    body = await r.text()
  } catch (e) {
    warn('접속하지 못했습니다', String(e).slice(0, 60))
  }
  const ours = /mebody Code/.test(body) && /32문항|셀프 체크/.test(body)
  const parked = /squarespace|공사 중|곧 출시/i.test(body)
  ok(`${origin} 이 우리 사이트를 서빙한다`, status === 200 && ours && !parked,
     parked ? '주차 페이지(공사 중)가 응답합니다 — 아직 제출하지 마세요'
            : status === 200 ? (ours ? 'OK' : '다른 내용이 응답합니다') : `HTTP ${status}`)

  let smStatus = 0
  try {
    const r = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(15000) })
    smStatus = r.status
  } catch { /* 위에서 이미 알렸습니다 */ }
  ok(`${origin}/sitemap.xml 이 열린다`, smStatus === 200, `HTTP ${smStatus}`)
} else {
  warn('네트워크 확인을 건너뛰었습니다 (MEBODY_SEO_LIVE=0)')
}

const failed = res.filter((p) => !p)
console.log(failed.length === 0 ? `\n  OK — ${res.length}개 검증 모두 통과\n`
  : `\n  FAIL — ${failed.length}개 실패 / ${res.length - failed.length}개 통과\n`)
process.exit(failed.length === 0 ? 0 : 1)
