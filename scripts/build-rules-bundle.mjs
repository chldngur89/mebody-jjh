/**
 * 규칙 엔진을 서버 콘솔이 쓸 수 있게 한 파일로 내보냅니다.
 *
 * ── 왜 이렇게 하는가
 * 전문가 콘솔(서버의 정적 페이지)에서 "앱이 오늘 무엇을 배정할까" 를 미리 보여주려면
 * 같은 규칙이 필요합니다. 그런데 엔진은 앱(TypeScript)에 있고 콘솔은 다른 프로세스입니다.
 *
 * 규칙을 SQL 이나 Java 로 옮겨 적으면 **같은 로직이 두 벌**이 됩니다. 112개 테스트가 붙은
 * 쪽과 아닌 쪽으로 갈리고, 한쪽만 고치면 앱과 콘솔이 다른 걸 추천하게 됩니다.
 *
 * 다행히 `src/utils/journeyRules.ts` 는 **import 가 하나도 없는 순수 로직**입니다
 * (React·Supabase·window 참조 0). 타입만 걷어내면 브라우저가 그대로 실행합니다.
 * 그래서 옮겨 적지 않고 **같은 파일을 변환해서** 콘솔에 보냅니다.
 *
 * 규칙을 고치면 이 스크립트를 다시 돌려야 콘솔에 반영됩니다.
 * `npm run build:rules` 가 하고, `verify:rules-bundle` 이 최신인지 검사합니다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

const SRC = new URL('../src/utils/journeyRules.ts', import.meta.url).pathname
const OUT = new URL('../../mebody-server/src/main/resources/static/assets/journey-rules.js', import.meta.url).pathname

const source = readFileSync(SRC, 'utf8')

// 옮겨 적지 않았다는 근거를 남깁니다 — 이 파일만 보고 손으로 고치면 앱과 갈라집니다.
const header = `/**
 * 자동 생성 파일입니다. **직접 고치지 마세요.**
 *
 * 원본: mebody-jjh/src/utils/journeyRules.ts
 * 생성: npm run build:rules   (앱 저장소에서)
 *
 * 규칙을 고칠 일이 있으면 원본을 고치고 다시 생성합니다. 이 파일을 손으로 고치면
 * 앱과 콘솔이 다른 추천을 하게 되고, 112개 테스트는 원본만 지킵니다.
 */
`

const { code } = transformSync(source, {
  loader: 'ts',
  format: 'esm',
  target: 'es2020',
})

writeFileSync(OUT, header + code)
console.log(`  ${OUT.split('/').slice(-1)[0]} 생성 — ${code.split('\n').length}줄`)
