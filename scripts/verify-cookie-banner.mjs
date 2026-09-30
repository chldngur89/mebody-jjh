/**
 * IMMUTABLE — 쿠키 동의는 하단 배너만.
 *
 * 전체화면·백드롭·height:100% 프레임 강제에 배너가 걸리면
 * 본문이 가려져 "빈 전체 화면 안내"처럼 보입니다.
 * 제품 결정(2026-09-30): 항상 하단 바. 바꾸지 말 것.
 *
 *   npm run verify:cookie-banner
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
let checks = 0
const check = (name, fn) => {
  fn()
  checks++
  console.log(`PASS ${name}`)
}

/** 주석·문자열에 적힌 금지 단어가 오탐하지 않게, 코드만 남깁니다. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const cookieRaw = readFileSync(join(ROOT, 'src/components/CookieConsent.tsx'), 'utf8')
const cssRaw = readFileSync(join(ROOT, 'src/index.css'), 'utf8')
const appRaw = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8')
const cookie = codeOnly(cookieRaw)
const css = codeOnly(cssRaw)
const app = codeOnly(appRaw)

check('배너에 mebody-cookie-banner 클래스가 있다', () => {
  assert.match(cookie, /className=["']mebody-cookie-banner["']/)
})

check('배너는 absolute + bottom 이다 (전체 덮개 아님)', () => {
  assert.match(cookie, /position:\s*['"]absolute['"]/)
  assert.match(cookie, /bottom:\s*`/)
  assert.doesNotMatch(cookie, /inset:\s*0/)
  assert.doesNotMatch(cookie, /position:\s*['"]fixed['"]/)
  assert.doesNotMatch(cookie, /aria-modal=["']true["']/)
})

check('배너 높이가 100%로 강제되지 않는다', () => {
  assert.match(cookie, /height:\s*['"]auto['"]/)
  assert.doesNotMatch(cookie, /height:\s*['"]100%['"]/)
  assert.doesNotMatch(cookie, /height:\s*['"]100vh['"]/)
  assert.doesNotMatch(cookie, /height:\s*['"]100dvh['"]/)
})

check('전체화면 백드롭 스타일이 없다', () => {
  assert.doesNotMatch(cookie, /position:\s*['"]fixed['"][\s\S]{0,80}inset/)
  assert.doesNotMatch(cookie, /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.[2-9]/)
})

check('프레임 CSS가 배너를 height:100% 대상에서 제외한다', () => {
  assert.match(cssRaw, /\.mebody-frame\s*>\s*\*:not\(\.mebody-cookie-banner\)/)
  // 예전 버그: 직계 자식 전부 100% (배너 포함)
  assert.doesNotMatch(cssRaw, /\.mebody-frame\s*>\s*\*\s*\{[^}]*height:\s*100%\s*!important/s)
})

check('App이 배너를 relative 셸 안에 마운트한다', () => {
  assert.match(app, /CookieConsentBanner/)
  assert.match(app, /relative/)
  assert.match(app, /!entitlement\.isPaid\s*&&\s*<CookieConsentBanner/)
})

console.log(`\nverify-cookie-banner: ${checks} checks passed`)
