/**
 * 화면 문구가 줄 수 없는 금액을 말하지 않는지 봅니다.
 *
 * ── 왜 필요한가
 * 057 에서 적립금을 내렸을 때, DB 는 맞게 바꿨는데 앱 문구 세 곳에 "50원" 이 그대로
 * 남아 있었습니다. 줄 수 없는 금액을 약속하는 상태였고, 그건 과장 광고입니다.
 * 숫자를 화면에 박는 순간 규칙과 어긋날 길이 열리므로, 아예 못 박게 막습니다.
 *
 * 금액은 reward_rules 에서 읽어야 합니다(fetchRewardRules).
 *
 * 사용: npm run verify:reward-copy
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const SRC = new URL('../src', import.meta.url).pathname
const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(name)) files.push(full)
  }
}
walk(SRC)

const res = []
const ok = (l, p, d = '') => { res.push(p); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }

console.log('\n■ 화면에 박힌 금액')
// "50원", "최대 120원" 처럼 사용자에게 보이는 금액 문자열.
// 변수 보간(${...}원)은 규칙에서 읽어오는 것이므로 대상이 아닙니다.
const MONEY = /(?<!\$\{[^}]{0,40})\b\d{1,5}원/g
const hits = []
for (const file of files) {
  // 적립 규칙 자체를 다루는 파일은 제외합니다.
  if (/api\/routineReward\.ts$/.test(file)) continue
  const text = readFileSync(file, 'utf8')
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) continue  // 주석은 설명입니다
    // 상품 가격·장바구니처럼 적립금과 무관한 금액은 대상이 아닙니다.
    if (/price|Price|total|Total|amount_krw|krw|formatKrw|0원/.test(t)) continue
    const m = t.match(MONEY)
    if (m) hits.push(`${file.replace(SRC, 'src')} — ${m.join(',')} · ${t.slice(0, 60)}`)
  }
}
ok('적립 금액이 화면에 박혀 있지 않다', hits.length === 0, hits.slice(0, 6).join(' | ') || '없음')

console.log('\n■ 규칙의 표시 최대치가 실제 지급 가능액과 같은가')
const srv = {}
for (const l of readFileSync(new URL('../../mebody-server/.env', import.meta.url).pathname, 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0) srv[t.slice(0, i)] = t.slice(i + 1)
}
const u = new URL(srv.SUPABASE_DB_URL.replace(/^jdbc:/, ''))
const db = new pg.Client({ host: u.hostname, port: Number(u.port || 5432),
  database: u.pathname.replace(/^\//, '') || 'postgres',
  user: srv.SUPABASE_DB_USERNAME, password: srv.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false } })
await db.connect()
const rows = (await db.query(`SELECT code, max_amount,
  (SELECT max((value)::int) FROM jsonb_each_text(r.payout)) real_max, disclosure
  FROM public.reward_rules r WHERE is_active ORDER BY code`)).rows
for (const r of rows) {
  if (r.real_max == null) continue
  ok(`${r.code} 표시 최대치가 실제와 같다`, r.max_amount === r.real_max,
    `표시 ${r.max_amount}원 · 실제 ${r.real_max}원`)
}
const capped = (await db.query(`SELECT count(*)::int n FROM public.reward_rules
  WHERE is_active AND disclosure IS NOT NULL AND disclosure LIKE '%한 달%'`)).rows[0].n
ok('월 상한이 고지에 적혀 있다', capped >= 3, `${capped}개 규칙`)
await db.end()

const failed = res.filter((x) => !x).length
console.log(`\n${failed ? `❌ ${res.length - failed} / ${res.length}` : `✅ ${res.length} / ${res.length} 통과`}\n`)
process.exit(failed ? 1 : 0)
