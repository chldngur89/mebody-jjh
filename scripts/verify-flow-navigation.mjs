import assert from 'node:assert/strict';
import { completionHistoryOffset, readFlowEntry, sameFlowPage, flowUrl } from '../src/lib/flowNavigation.ts';
import { parseQuestionnaireProgress } from '../src/lib/questionnaireProgress.ts';
import { parseTimerProgress } from '../src/lib/timerProgress.ts';
import { withDeadline } from '../src/lib/deadline.ts';

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
