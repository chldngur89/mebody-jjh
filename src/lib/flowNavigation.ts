export const SCREENS = ['landing', 'consent', 'intro', 'questionnaire', 'analyzing', 'result', 'auth', 'membership', 'checkout', 'cart', 'journeyIntro', 'journeyToday', 'journeyMission', 'journeyReport', 'journeyNext'] as const;
export type Screen = typeof SCREENS[number];
export type FlowTab = 'home' | 'mission' | 'routine' | 'market' | 'status';
export interface FlowRoute {
  screen: Screen;
  tab: FlowTab;
  resultId?: string;
  bodyCode?: string;
  questionIndex?: number;
  diagnosisId?: string;
  authSuccess?: Screen;
}
export interface FlowEntry { session: string; index: number; route: FlowRoute; diagnosisStart?: number }
export const FLOW_SESSION_KEY = 'mebody:flow-session';

export function readFlowEntry(state: unknown, session: string): FlowEntry | undefined {
  const entry = (state as { mebodyFlow?: FlowEntry } | null)?.mebodyFlow;
  if (!entry || entry.session !== session || !Number.isInteger(entry.index) || entry.index < 0) return;
  if (entry.diagnosisStart !== undefined && (!Number.isInteger(entry.diagnosisStart) || entry.diagnosisStart < 0 || entry.diagnosisStart > entry.index)) return;
  const route = entry.route;
  if (!route || !SCREENS.includes(route.screen) || !['home', 'mission', 'routine', 'market', 'status'].includes(route.tab)) return;
  if (route.resultId !== undefined && typeof route.resultId !== 'string') return;
  if (route.questionIndex !== undefined && (!Number.isInteger(route.questionIndex) || route.questionIndex < 0 || route.questionIndex > 31)) return;
  if (route.diagnosisId !== undefined && typeof route.diagnosisId !== 'string') return;
  if (route.bodyCode !== undefined && (typeof route.bodyCode !== 'string' || !/^[FC][RL][RL][SF]$/.test(route.bodyCode))) return;
  if (route.authSuccess !== undefined && !SCREENS.includes(route.authSuccess)) return;
  return entry;
}

export function sameFlowPage(a: FlowRoute, b: FlowRoute) {
  return a.screen === b.screen && a.tab === b.tab && a.resultId === b.resultId
    && (a.screen !== 'questionnaire' || a.questionIndex === b.questionIndex);
}

export function flowUrl(route: FlowRoute, href: string) {
  const url = new URL(href);
  // QA entry parameters must not force a stale screen after a reload.
  url.searchParams.delete('ui');
  url.searchParams.delete('mode');
  // 공유 링크 파라미터는 첫 진입에서 한 번만 읽습니다.
  // 남겨두면 진단 도중 새로고침해도 계속 "친구가 공유했어요" 가 붙습니다.
  url.searchParams.delete('ref');
  url.searchParams.delete('code');
  if (route.resultId) url.searchParams.set('result', route.resultId);
  else url.searchParams.delete('result');
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Return to the entry before the diagnostic flow, then replace its forward branch. */
export function completionHistoryOffset(entry: FlowEntry) {
  const start = entry.diagnosisStart ?? entry.index;
  return Math.max(0, start - 1) - entry.index;
}
