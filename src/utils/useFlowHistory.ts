import { useLayoutEffect, useRef } from 'react';
import { FLOW_SESSION_KEY, completionHistoryOffset, flowUrl, readFlowEntry, sameFlowPage, type FlowRoute } from '../lib/flowNavigation';

export function flowSession() {
  try {
    let id = sessionStorage.getItem(FLOW_SESSION_KEY);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(FLOW_SESSION_KEY, id); }
    return id;
  } catch { return 'memory-flow'; }
}

/** React batches screen/tab updates; commit one browser entry for the final route. */
export function useFlowHistory(route: FlowRoute, restore: (route: FlowRoute) => void, ready: boolean) {
  const session = useRef(flowSession());
  const previous = useRef<FlowRoute>();
  const restoring = useRef(false);
  const backPending = useRef(false);
  const completing = useRef<{ route: FlowRoute; hasParent: boolean }>();
  const replaceNext = useRef(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  useLayoutEffect(() => {
    const onPop = (event: PopStateEvent) => {
      backPending.current = false;
      let entry = readFlowEntry(event.state, session.current);
      if (completing.current) {
        const { route: destination, hasParent } = completing.current;
        completing.current = undefined;
        if (!hasParent) {
          history.replaceState({ mebodyFlow: { session: session.current, index: 0, route: { screen: 'landing', tab: 'home' } } }, '', flowUrl({ screen: 'landing', tab: 'home' }, location.href));
          entry = readFlowEntry(history.state, session.current);
        }
        history.pushState({ mebodyFlow: { session: session.current, index: (entry?.index ?? 0) + 1, route: destination } }, '', flowUrl(destination, location.href));
        previous.current = destination;
        restoring.current = false;
        replaceNext.current = false;
        return;
      }
      if (entry && previous.current && sameFlowPage(entry.route, previous.current)) return;
      restoring.current = true;
      restoreRef.current(entry?.route ?? { screen: 'landing', tab: 'home' });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    if (completing.current) { completing.current.route = route; return; }
    const current = readFlowEntry(history.state, session.current);
    if (previous.current?.screen === 'analyzing' && route.screen === 'result' && current) {
      const offset = completionHistoryOffset(current);
      if (offset < 0) {
        completing.current = { route, hasParent: (current.diagnosisStart ?? 0) > 0 };
        history.go(offset);
        return;
      }
    }
    const replace = !previous.current || restoring.current || replaceNext.current
      || sameFlowPage(previous.current, route) || previous.current.screen === 'analyzing';
    const index = replace ? (current?.index ?? 0) : (current?.index ?? 0) + 1;
    const inDiagnosis = ['consent', 'intro', 'questionnaire', 'analyzing'].includes(route.screen);
    const startsDiagnosis = inDiagnosis && (!previous.current || !['consent', 'intro', 'questionnaire', 'analyzing', 'auth'].includes(previous.current.screen));
    const diagnosisStart = inDiagnosis || route.screen === 'auth' ? (startsDiagnosis ? index : current?.diagnosisStart ?? index) : undefined;
    const { mebodyOverlay: _, ...baseState } = history.state ?? {};
    const state = { ...baseState, mebodyFlow: { session: session.current, index, route, diagnosisStart } };
    history[replace ? 'replaceState' : 'pushState'](state, '', flowUrl(route, location.href));
    previous.current = route;
    restoring.current = false;
    replaceNext.current = false;
  }, [route.screen, route.tab, route.resultId, route.questionIndex, route.diagnosisId, route.authSuccess, route.bodyCode, ready]);

  return {
    back(fallback: FlowRoute) {
      if (backPending.current) return;
      const entry = readFlowEntry(history.state, session.current);
      if (entry && entry.index > 0) { backPending.current = true; history.back(); }
      else { replaceNext.current = true; restoreRef.current(fallback); }
    },
    replace() { replaceNext.current = true; },
    reset() {
      session.current = crypto.randomUUID();
      try { sessionStorage.setItem(FLOW_SESSION_KEY, session.current); } catch { /* memory only */ }
      previous.current = undefined;
      replaceNext.current = true;
    },
  };
}
