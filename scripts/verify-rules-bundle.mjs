/**
 * 콘솔이 쓰는 규칙 엔진이 앱과 같은 코드인지 봅니다.
 *
 * ── 왜 필요한가
 * 전문가 콘솔의 초안은 `static/assets/journey-rules.js` 로 계산합니다. 그 파일은
 * 앱의 `src/utils/journeyRules.ts` 를 변환한 것이고, **원본을 고치고 다시 만들지 않으면
 * 앱과 콘솔이 다른 걸 추천하게 됩니다.** 그런데 그건 화면에서 티가 안 납니다 —
 * 둘 다 그럴듯한 목록을 보여주니까요.
 *
 * 그래서 여기서 막습니다. 원본이 바뀌었는데 번들이 낡았으면 실패합니다.
 *
 * 사용: npm run verify:rules-bundle
 *       (실패하면 npm run build:rules)
 */
import { readFileSync, existsSync } from 'node:fs'
import { transformSync } from 'esbuild'

const SRC = new URL('../src/utils/journeyRules.ts', import.meta.url).pathname
const OUT = new URL('../../mebody-server/src/main/resources/static/assets/journey-rules.js', import.meta.url).pathname

const res = []
const ok = (l, p, d = '') => { res.push(p); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }

console.log('\n■ 규칙 엔진 번들')
ok('번들 파일이 있다', existsSync(OUT), OUT.split('/').slice(-1)[0])
if (!existsSync(OUT)) {
  console.log('\n  npm run build:rules 를 돌리세요.\n')
  process.exit(1)
}

const source = readFileSync(SRC, 'utf8')
const bundle = readFileSync(OUT, 'utf8')

// 원본은 import 가 없어야 브라우저가 그대로 실행할 수 있습니다.
const imports = [...source.matchAll(/^import\s/gm)]
ok('원본에 import 가 없다 (순수 로직)', imports.length === 0, `${imports.length}개`)

const risky = /\b(react|supabase|import\.meta|window\.|document\.)/.exec(source)
ok('브라우저·앱 전용 참조가 없다', !risky, risky ? risky[0] : '없음')

// 지금 원본으로 다시 만든 결과와 같아야 합니다.
const { code } = transformSync(source, { loader: 'ts', format: 'esm', target: 'es2020' })
const bundleBody = bundle.slice(bundle.indexOf('*/') + 2).trim()
ok('번들이 원본과 같다 (다시 만들 필요 없음)', bundleBody === code.trim(),
  bundleBody === code.trim() ? '최신' : 'npm run build:rules 를 돌리세요')

// 콘솔이 실제로 부르는 함수가 들어 있어야 합니다.
for (const fn of ['selectDailyMissions', 'computeCurrentDay']) {
  ok(`${fn} 을 내보낸다`, new RegExp(`export\\s*\\{[^}]*\\b${fn}\\b`).test(bundle) || bundle.includes(`function ${fn}`),
    '')
}

// 손으로 고치지 말라는 경고가 있어야 합니다.
ok('직접 고치지 말라는 표시가 있다', /직접 고치지 마세요/.test(bundle))

const failed = res.filter((x) => !x).length
console.log(`\n${failed ? `❌ ${res.length - failed} / ${res.length}` : `✅ ${res.length} / ${res.length} 통과`}\n`)
process.exit(failed ? 1 : 0)
