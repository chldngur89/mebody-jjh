/**
 * 축 아이콘 파생본 만들기 — 원본은 그대로 두고 화면 크기에 맞춘 사본을 만듭니다.
 *
 * 왜 필요한가 (2026-09-22 감사 P2-1):
 *   원본이 2048×2048 · 5.7MB 인데 화면에서는 **48×48** 로 그립니다(AnalyzingScreen 의 w-12 h-12).
 *   48픽셀을 칠하려고 5.7MB 를 내려받고 있었습니다. 그것도 결과 화면이 아니라 **분석 화면** —
 *   문항을 끝낸 모든 사용자가 반드시 지나는 길입니다. 저속 네트워크·저사양 Android 에서
 *   결과 진입이 늦어지는 가장 큰 원인입니다.
 *
 * 무엇을 만드는가:
 *   48px 의 1배·2배·3배 = 48 / 96 / 144. 고밀도 화면까지 3배면 충분합니다.
 *   WebP 로 만듭니다 — Android Chrome·iOS 14+ 가 모두 읽습니다.
 *
 * 원본을 지우지 않습니다. 나중에 더 크게 쓸 화면이 생길 수 있고,
 * 파생본은 언제든 이 스크립트로 다시 만들 수 있어야 합니다.
 *
 * 사용: npm run build:axis-icons
 * 필요: cwebp (brew install webp), sips (macOS 기본)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs'
import path from 'node:path'

const SRC_DIR = 'public/axis-icons'
const OUT_DIR = 'public/axis-icons/w'
/** 화면 표시 크기(48px)의 1·2·3배. srcset 의 1x·2x·3x 가 됩니다. */
const WIDTHS = [48, 96, 144]
const QUALITY = 88

function has(cmd) {
  try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true } catch { return false }
}
if (!has('cwebp')) {
  console.error('\n  cwebp 가 없습니다. `brew install webp` 후 다시 실행하세요.\n')
  process.exit(1)
}
if (!has('sips')) {
  console.error('\n  sips 가 없습니다(macOS 기본 도구).\n')
  process.exit(1)
}

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true })
mkdirSync(OUT_DIR, { recursive: true })

const sources = readdirSync(SRC_DIR).filter((f) => f.endsWith('.png'))
if (sources.length === 0) {
  console.error(`\n  ${SRC_DIR} 에 png 가 없습니다.\n`)
  process.exit(1)
}

console.log('\n■ 축 아이콘 파생본')
let before = 0
let after = 0
const tmp = path.join(OUT_DIR, '.tmp.png')

for (const file of sources) {
  const src = path.join(SRC_DIR, file)
  const base = file.replace(/\.png$/, '')
  before += statSync(src).size
  const made = []
  for (const w of WIDTHS) {
    // sips 로 줄이고 cwebp 로 옮깁니다. 두 단계인 이유는 cwebp 가 리사이즈를
    // 할 수는 있지만 알파가 있는 PNG 에서 sips 쪽 결과가 더 깔끔했습니다.
    execFileSync('sips', ['-Z', String(w), src, '--out', tmp], { stdio: 'ignore' })
    const out = path.join(OUT_DIR, `${base}-${w}.webp`)
    execFileSync('cwebp', ['-quiet', '-q', String(QUALITY), tmp, '-o', out], { stdio: 'ignore' })
    const size = statSync(out).size
    after += size
    made.push(`${w}px ${(size / 1024).toFixed(1)}KB`)
  }
  console.log(`  ${base}  원본 ${(statSync(src).size / 1048576).toFixed(1)}MB  →  ${made.join(' · ')}`)
}
if (existsSync(tmp)) rmSync(tmp)

console.log(`\n  원본 합계 ${(before / 1048576).toFixed(1)}MB  →  파생본 합계 ${(after / 1024).toFixed(0)}KB`)
console.log(`  줄어든 비율 ${(100 - (after / before) * 100).toFixed(2)}%`)
console.log(`\n  ${OUT_DIR}/ 에 만들었습니다. src/data/axisIcons.ts 가 이걸 씁니다.\n`)
