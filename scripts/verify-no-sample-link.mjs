/**
 * 앱 안에서 /sample 로 가는 길이 없는지 확인합니다.
 *
 * `/sample` 은 서버(mebody-server)에 붙여 둔 앱 출시 전 설문 흐름입니다.
 * **들어가는 입구는 홈페이지에만 둡니다** — 앱 사용자는 앱 안에서 자기 결과를
 * 보면 되고, 12문항 간이 흐름으로 빠지면 32문항 결과와 섞여 혼란만 생깁니다.
 *
 * 반대 방향(샘플 → 앱)은 막지 않습니다. 설문 참여자를 앱으로 데려오는 것은
 * 의도된 흐름이고, 그 링크는 샘플 쪽(sample-questionnaire/src/config/urls.ts)에
 * 있습니다.
 *
 * 지금은 이미 0건입니다. 이 스크립트는 그 상태가 유지되는지를 지키기 위한 것입니다 —
 * 나중에 누군가 「샘플도 링크해 두자」고 한 줄 넣으면 여기서 걸립니다.
 *
 *   node scripts/verify-no-sample-link.mjs
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };

/** 앱이 사용자에게 보여주는 코드만 봅니다. 주석·CSS 주석은 링크가 아니므로 제외합니다. */
const SCAN_DIRS = ['src', 'public'];
const SCAN_FILES = ['index.html'];
const EXTS = /\.(tsx?|jsx?|html|json)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.test(name)) out.push(full);
  }
  return out;
}

const files = [
  ...SCAN_DIRS.flatMap((d) => { try { return walk(join(ROOT, d)); } catch { return []; } }),
  ...SCAN_FILES.map((f) => join(ROOT, f)),
];

/** 줄 주석·블록 주석을 지웁니다. 주석 안의 'sample' 은 설명이지 링크가 아닙니다. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
}

/** 샘플로 데려가는 표현들. 경로·번들 이름·설문 도메인 경로를 모두 봅니다. */
const FORBIDDEN = [
  { pattern: /['"`](?:https?:\/\/[^'"`]*)?\/sample(?:\/|['"`?#])/, what: "'/sample' 경로" },
  { pattern: /sample-questionnaire/, what: 'sample-questionnaire 번들' },
  { pattern: /['"`]\/sample['"`]/, what: "'/sample' 문자열" },
];

const hits = [];
for (const file of files) {
  const body = stripComments(readFileSync(file, 'utf8'));
  for (const { pattern, what } of FORBIDDEN) {
    if (pattern.test(body)) hits.push(`${relative(ROOT, file)} — ${what}`);
  }
}

check('앱 안에 /sample 로 가는 링크가 없다', () => {
  assert.deepEqual(hits, [], `앱에서 샘플로 가는 경로가 생겼습니다:\n  ${hits.join('\n  ')}`);
});

check('검사 대상 파일이 실제로 있다', () => {
  // 경로가 바뀌어 0개를 검사하고 통과하는 일을 막습니다.
  assert.ok(files.length > 50, `검사한 파일이 ${files.length}개뿐입니다 — 경로 설정을 확인하세요`);
});

console.log(`OK — ${checks} checks · 파일 ${files.length}개 검사`);
