import assert from 'node:assert/strict';
import { completionHistoryOffset, readFlowEntry, sameFlowPage, flowUrl } from '../src/lib/flowNavigation.ts';
import { parseQuestionnaireProgress } from '../src/lib/questionnaireProgress.ts';
import { parseTimerProgress } from '../src/lib/timerProgress.ts';
import { withDeadline } from '../src/lib/deadline.ts';
import { scrollRestoreTarget } from '../src/lib/scrollRestore.ts';
import { AXIS_SIDES, calculateBodyCode, characterNames, getAxisScoreBreakdown, getResultCertainty, getUndeterminedAxes, resultHeadlinePlan } from '../src/utils/bodyCodeCalculator.ts';
import { readFileSync } from 'node:fs';
import { V1_QUESTIONS_SNAPSHOT } from '../src/data/v1QuestionsSnapshot.ts';

let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
const route = { screen: 'questionnaire', tab: 'home', questionIndex: 4, resultId: 'previous-result' };
const entry = { mebodyFlow: { session: 'current-user-session', index: 5, route } };
check('logout invalidates old browser history', () => assert.equal(readFlowEntry(entry, 'new-session'), undefined));
check('valid browser entry keeps question and previous result', () => assert.deepEqual(readFlowEntry(entry, 'current-user-session').route, route));
for (const patch of [{ screen: 'unknown' }, { tab: 'unknown' }, { questionIndex: -1 }, { questionIndex: 32 }, { questionIndex: 1.5 }, { resultId: {} }, { authSuccess: 'unknown' }]) {
  check(`reject corrupt history ${JSON.stringify(patch)}`, () => assert.equal(readFlowEntry({ mebodyFlow: { ...entry.mebodyFlow, route: { ...route, ...patch } } }, 'current-user-session'), undefined));
}
check('32-question completion returns to the flow parent in one traversal', () => assert.equal(completionHistoryOffset({ ...entry.mebodyFlow, index: 35, diagnosisStart: 2 }), -34));
check('direct questionnaire entry collapses to its initial entry', () => assert.equal(completionHistoryOffset({ ...entry.mebodyFlow, index: 32, diagnosisStart: 0 }), -32));
check('question changes make distinct browser destinations', () => assert.equal(sameFlowPage(route, { ...route, questionIndex: 3 }), false));
check('past result ID makes a distinct destination', () => assert.equal(sameFlowPage(route, { ...route, resultId: 'older' }), false));
check('answer update on same question does not add an entry', () => assert.equal(sameFlowPage(route, { ...route }), true));
check('QA parameter does not override reload; unrelated query preserved', () => assert.equal(flowUrl(route, 'https://example.test/?ui=auth&mode=signup&utm_source=test'), '/?utm_source=test&result=previous-result'));
// 잘린 공유 링크로 들어와도 주소는 `/` 로 돌아옵니다. 그대로 두면 그 뒤의 모든 이동이
// 깨진 경로 아래에서 일어나고, 사용자가 그 주소를 다시 공유하면 또 퍼집니다.
check('broken share path is normalised back to the app root', () =>
  assert.equal(flowUrl({ screen: 'landing', tab: 'home' }, 'https://example.test/s/ZZZZ'), '/'));
check('valid share landing keeps ref and code but not the path', () =>
  assert.equal(flowUrl({ screen: 'landing', tab: 'home', shareCode: 'FRRS' }, 'https://example.test/s/FRRS'),
    '/?ref=share&code=FRRS'));
check('result URL removed when destination has no result', () => assert.equal(flowUrl({ screen: 'landing', tab: 'home' }, 'https://example.test/?result=old'), '/'));
const saved = parseQuestionnaireProgress(JSON.stringify({ index: 4, id: 'diagnosis', draftId: 'draft', answers: { A1: '①', A2: '③', D7: '②' } }));
check('login/reload preserves answer choices, position and draft', () => assert.deepEqual(saved, { index: 4, id: 'diagnosis', draftId: 'draft', answers: { A1: '①', A2: '③', D7: '②' }, completedResultId: undefined }));
check('completed result marker survives reload', () => assert.equal(parseQuestionnaireProgress(JSON.stringify({ ...saved, completedResultId: 'done' })).completedResultId, 'done'));
for (const raw of ['broken', 'null', '{"index":99,"answers":{}}', '{"index":0,"answers":[]}']) {
  check(`corrupt draft starts safely ${raw}`, () => { const p = parseQuestionnaireProgress(raw); assert.equal(p.index, 0); assert.deepEqual(p.answers, {}); });
}
check('invalid question keys and values cannot become answers', () => assert.deepEqual(parseQuestionnaireProgress('{"index":0,"answers":{"A1":"①","A11":"②","B7":"③","D7":"fake"}}').answers, { A1: '①' }));
check('paused timer restores remaining seconds', () => assert.deepEqual(parseTimerProgress('{"remaining":43,"started":true}', 60), { remaining: 43, started: true }));
check('expired timer can complete on explicit resume', () => assert.equal(parseTimerProgress('{"remaining":0,"started":true}', 60).remaining, 0));
check('invalid timer duration cannot skip a step', () => assert.deepEqual(parseTimerProgress('{"remaining":-10}', 60), { remaining: 60, started: false }));
// 탭 복귀 스크롤 복원 — 끝까지 내려본 사람에게만 깨지던 자리입니다.
check('bottom-of-list position is restored despite sub-pixel rounding', () =>
  assert.equal(scrollRestoreTarget(3182, 744, 2438.09521484375), 2438));
check('mid-list position is restored exactly', () =>
  assert.equal(scrollRestoreTarget(3182, 744, 1200), 1200));
check('content not grown yet means wait, not jump', () =>
  assert.equal(scrollRestoreTarget(900, 744, 2438), null));
check('shrunk list clamps instead of overshooting', () =>
  assert.equal(scrollRestoreTarget(1500, 744, 756.4), 756));
check('nothing saved goes to the top', () =>
  assert.equal(scrollRestoreTarget(3182, 744, 0), 0));
check('unscrollable page never claims a position', () =>
  assert.equal(scrollRestoreTarget(744, 744, 100), null));

// 정해지지 않은 축을 정해진 것처럼 보여주지 않는가.
//
// 축 점수가 완전 동점이면 계산기는 각 축의 첫 글자(F/R/R/S)를 그대로 돌려줍니다.
// 그래서 **아무것도 확인되지 않아도 코드 문자열은 FRRS** 가 나옵니다. 화면이 그 사실을
// 말해주지 않으면 앱이 확인하지 못한 것을 확인한 것처럼 보여주게 됩니다.
const QCODES = V1_QUESTIONS_SNAPSHOT.map((q) => q.question_code);
const everyAnswer = (choice) => Object.fromEntries(QCODES.map((k) => [k, choice]));
check('all-neutral answers still produce the FRRS fallback string', () =>
  assert.equal(calculateBodyCode(everyAnswer('②')).code, 'FRRS'));
check('all-neutral answers mark every axis undetermined', () =>
  assert.deepEqual(getUndeterminedAxes(everyAnswer('②')), ['neck', 'shoulder', 'pelvis', 'flexibility']));
check('decisive answers leave no axis undetermined', () => {
  assert.deepEqual(getUndeterminedAxes(everyAnswer('①')), []);
  assert.deepEqual(getUndeterminedAxes(everyAnswer('③')), []);
});

// ── 동점이 화면에 드러나는가 ─────────────────────────────────────────────────
// 「못 정했다」·「근거가 얇다」·「박빙이다」는 **서로 다른 말**입니다. 한 덩어리로 묶으면
// 정작 새 정보를 담은 줄까지 같이 흘려보게 됩니다. 셋을 갈라 두는지 여기서 지킵니다.
const AXES4 = ['neck', 'shoulder', 'pelvis', 'flexibility'];
/** 재현 가능한 난수 — 실패했을 때 같은 입력을 다시 만들 수 있어야 합니다. */
const seededCertainty = (seed) => { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; };
const answersFromCertainty = (rand) =>
  Object.fromEntries(QCODES.map((k) => [k, ['①', '②', '③'][Math.floor(rand() * 3)]]));

check('전 문항 ② — 네 축 전부 "정하지 못함", 근거 얇음과 섞이지 않는다', () => {
  const c = getResultCertainty(everyAnswer('②'));
  assert.deepEqual(c.undetermined, AXES4);
  assert.deepEqual(c.thinEvidence, []);
  assert.equal(c.nothingDetermined, true);
  assert.equal(c.level, 'none');
});

check('무응답도 같은 자리 — 코드는 FRRS 지만 확인된 것은 없다', () => {
  assert.equal(calculateBodyCode({}).code, 'FRRS');
  assert.equal(getResultCertainty({}).nothingDetermined, true);
});

check('전 문항 ①·③ — 네 축 전부 또렷하다(회귀 방지)', () => {
  for (const choice of ['①', '③']) {
    const c = getResultCertainty(everyAnswer(choice));
    assert.deepEqual(c.undetermined, []);
    assert.deepEqual(c.thinEvidence, []);
    assert.equal(c.level, 'clear');
  }
});

check('세 가지가 서로 겹치지 않는다', () => {
  const rand = seededCertainty(31);
  for (let i = 0; i < 600; i += 1) {
    const c = getResultCertainty(answersFromCertainty(rand));
    for (const axis of AXES4) {
      const bucket = [c.undetermined, c.thinEvidence, c.closeCall].filter((list) => list.includes(axis));
      assert.ok(bucket.length <= 1, `${axis}: ${bucket.length}곳에 동시에 들어갔습니다`);
    }
    assert.equal(c.undetermined.length + c.thinEvidence.length + AXES4.filter((a) => c.byAxis[a] === 'clear').length, 4);
  }
});

// 근거가 얇은 축은 막대가 **가장 세게 기울어 보입니다**(2:0 → 100%). 동점과 같은 줄에
// 묶으면 "가운데에 가깝다" 는 설명이 붙는데, 화면에는 정반대로 그려집니다.
check('근거가 얇은 축은 막대가 한쪽 끝으로 그려진다 — 동점과 다른 말이다', () => {
  const rand = seededCertainty(1234);
  let seen = 0;
  for (let i = 0; i < 4000 && seen < 20; i += 1) {
    const a = answersFromCertainty(rand);
    const c = getResultCertainty(a);
    if (!c.thinEvidence.length) continue;
    const pct = getAxisScoreBreakdown(a);
    for (const axis of c.thinEvidence) {
      const { percentLeft, percentRight } = pct[axis];
      assert.notEqual(percentLeft, percentRight, `${axis}: 얇은 근거인데 막대가 가운데입니다`);
      seen += 1;
    }
  }
  assert.ok(seen >= 20, `표본 ${seen}개 — 근거 얇은 축을 충분히 못 만났습니다`);
});

// ── 화면이 그 상태를 그대로 말하는가 ─────────────────────────────────────────
// 분기를 JSX 안에만 두면 눈으로만 확인됩니다. 화면과 여기가 **같은 함수**를 봅니다.
check('전 문항 ② — 머리글이 유형 설명을 내린다', () =>
  assert.deepEqual(resultHeadlinePlan(getResultCertainty(everyAnswer('②'))), { kind: 'undetermined' }));
check('전 문항 ① — 머리글은 지금처럼 유형 설명 그대로(회귀 방지)', () =>
  assert.deepEqual(resultHeadlinePlan(getResultCertainty(everyAnswer('①'))), { kind: 'type' }));
check('일부 축만 동점이면 유형 설명은 남기고 한 줄만 덧붙인다', () => {
  const rand = seededCertainty(808);
  let found = null;
  for (let i = 0; i < 4000 && !found; i += 1) {
    const c = getResultCertainty(answersFromCertainty(rand));
    if (c.undetermined.length > 0 && !c.nothingDetermined) found = c;
  }
  assert.ok(found, '일부만 동점인 표본을 못 만들었습니다');
  assert.deepEqual(resultHeadlinePlan(found), { kind: 'type-hedged', undetermined: found.undetermined });
});
check('응답을 아직 못 읽었을 때 "또렷하다"로 넘어가지 않는다', () =>
  assert.equal(resultHeadlinePlan(null).kind, 'type'));

// 홈 화면이 그 분기를 **실제로 따르는가**. 주석은 뺍니다 — 왜 바꿨는지 적어 둔 설명이
// 옛 문구와 분기 이름을 인용하고 있어서, 그대로 보면 자기 주석에 걸립니다.
const homeSrc = readFileSync(new URL('../src/components/home/HomeScreen.tsx', import.meta.url).pathname, 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');
check('홈이 머리글 분기를 계산기에서 받아 쓴다', () =>
  assert.match(homeSrc, /const headline = resultHeadlinePlan\(certainty\)/));
check('단정형 유형 설명이 "정하지 못함" 분기 밖에만 있다', () => {
  const branch = homeSrc.indexOf("headline.kind === 'undetermined' ?");
  const summary = homeSrc.indexOf('{data.summaryLine}', branch);
  const elseArm = homeSrc.indexOf(') : (', branch);
  assert.ok(branch > 0 && elseArm > branch, '머리글 분기를 못 찾았습니다');
  assert.ok(summary > elseArm, 'identity_summary 가 또렷하지 않을 때도 그대로 나옵니다');
});
check('또렷하지 않을 때 화면이 재측정을 권한다', () =>
  assert.match(homeSrc, /다시 체크하면 결과가 달라질 수 있어요/));

// ── 코드가 제대로·일관되게 나오는가 ─────────────────────────────────────────
// 사용자가 문항을 다 누르면 **같은 답이면 늘 같은 코드**가 나오고, 화면의 축 막대와
// 코드 글자가 서로 어긋나지 않아야 합니다. 둘 중 하나라도 흔들리면 결과를 믿을 수 없습니다.
const CHOICES = ['①', '②', '③'];
/** 재현 가능한 난수 — 실패했을 때 같은 입력을 다시 만들 수 있어야 합니다. */
const seeded = (seed) => { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; };
const answersFrom = (rand) => Object.fromEntries(QCODES.map((k) => [k, CHOICES[Math.floor(rand() * 3)]]));

check('same answers always produce the same code', () => {
  const rand = seeded(7);
  for (let i = 0; i < 120; i += 1) {
    const a = answersFrom(rand);
    const first = calculateBodyCode(a).code;
    assert.equal(calculateBodyCode(a).code, first);
    assert.equal(calculateBodyCode(a).code, first);
  }
});

check('every code is a valid four-letter body code', () => {
  const rand = seeded(555);
  for (let i = 0; i < 500; i += 1) {
    assert.match(calculateBodyCode(answersFrom(rand)).code, /^[FC][RL][RL][SF]$/);
  }
});

check('code letters never contradict the axis bars on screen', () => {
  const AXES = ['neck', 'shoulder', 'pelvis', 'flexibility'];
  const rand = seeded(99);
  for (let i = 0; i < 400; i += 1) {
    const a = answersFrom(rand);
    const { code } = calculateBodyCode(a);
    const pct = getAxisScoreBreakdown(a);
    const undecided = new Set(getUndeterminedAxes(a));
    AXES.forEach((axis, idx) => {
      if (undecided.has(axis)) return;        // 동점은 막대가 가운데 — 화면이 따로 알립니다
      const { a: sideA, b: sideB } = AXIS_SIDES[axis];
      const p = pct[axis];
      if (p.percentLeft === p.percentRight) return;
      // 하체만 표시 좌/우가 뒤집혀 있습니다(labelLeft=Flexible=sideB).
      const leftSide = axis === 'flexibility' ? sideB : sideA;
      const rightSide = axis === 'flexibility' ? sideA : sideB;
      const dominant = p.percentLeft > p.percentRight ? leftSide : rightSide;
      assert.equal(dominant, code[idx], `${axis}: 막대는 ${dominant} 인데 코드는 ${code[idx]}`);
    });
  }
});

check('all sixteen codes are reachable and every one has a character name', () => {
  const seen = new Set();
  const rand = seeded(2024);
  for (let i = 0; i < 20000 && seen.size < 16; i += 1) seen.add(calculateBodyCode(answersFrom(rand)).code);
  assert.equal(seen.size, 16);
  for (const code of Object.keys(characterNames)) assert.ok(characterNames[code], `${code} 이름 없음`);
  assert.equal(Object.keys(characterNames).length, 16);
});

const controller = new AbortController();
await assert.rejects(withDeadline(() => new Promise(() => {}), controller, 10));
check('hanging save is aborted at the deadline', () => assert.equal(controller.signal.aborted, true));
const normal = new AbortController();
assert.equal(await withDeadline(async () => 'saved', normal, 100), 'saved');
check('successful save does not abort', () => assert.equal(normal.signal.aborted, false));
const cancelled = new AbortController();
const pending = withDeadline(() => new Promise(() => {}), cancelled, 1000);
cancelled.abort(new Error('left analysis'));
await assert.rejects(pending, /left analysis/);
checks++;
console.log(`OK — ${checks} navigation/progress/deadline checks`);
