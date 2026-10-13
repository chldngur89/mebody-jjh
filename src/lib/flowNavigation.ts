export const SCREENS = ['landing', 'consent', 'intro', 'questionnaire', 'analyzing', 'result', 'auth', 'membership', 'checkout', 'cart', 'product', 'journeyIntro', 'journeyToday', 'journeyMission', 'journeyReport', 'journeyNext', 'professionalConsent'] as const;
export type Screen = typeof SCREENS[number];
export type FlowTab = 'home' | 'mission' | 'routine' | 'market' | 'status';
export interface FlowRoute {
  screen: Screen;
  tab: FlowTab;
  resultId?: string;
  bodyCode?: string;
  /** 상품 상세가 열려 있을 때의 상품 id. 새로고침·하드웨어 백에서도 같은 상품으로 돌아옵니다. */
  productId?: string;
  /** 공유 수신 중이면 랜딩 URL 에 ref=share&code 를 유지합니다(새로고침 대비). */
  shareCode?: string;
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
  // 상품 id 는 uuid 입니다. 아무 문자열이나 들어오면 상세가 빈 화면이 되므로 여기서 거릅니다.
  if (route.productId !== undefined
    && (typeof route.productId !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(route.productId))) return;
  if (route.questionIndex !== undefined && (!Number.isInteger(route.questionIndex) || route.questionIndex < 0 || route.questionIndex > 31)) return;
  if (route.diagnosisId !== undefined && typeof route.diagnosisId !== 'string') return;
  if (route.bodyCode !== undefined && (typeof route.bodyCode !== 'string' || !/^[FC][RL][RL][SF]$/.test(route.bodyCode))) return;
  if (route.shareCode !== undefined && (typeof route.shareCode !== 'string' || !/^[FC][RL][RL][SF]$/.test(route.shareCode))) return;
  if (route.authSuccess !== undefined && !SCREENS.includes(route.authSuccess)) return;
  return entry;
}

export function sameFlowPage(a: FlowRoute, b: FlowRoute) {
  return a.screen === b.screen && a.tab === b.tab && a.resultId === b.resultId
    && (a.screen !== 'questionnaire' || a.questionIndex === b.questionIndex)
    && (a.screen !== 'product' || a.productId === b.productId);
}

export function flowUrl(route: FlowRoute, href: string) {
  const url = new URL(href);
  // 앱은 언제나 `/` 에서 돕니다. 다른 경로로 들어왔으면 주소부터 바로잡습니다.
  //
  // 공유 링크가 잘리거나 오타가 나면 `/s/ZZZZ` 같은 주소로 들어옵니다. 그 자리에서
  // 화면은 정상으로 뜨지만(vercel.json 이 앱으로 보냅니다), 주소를 그대로 두면
  // **그 뒤의 모든 이동이 `/s/ZZZZ` 아래에서** 일어납니다. 사용자가 그 주소를 다시
  // 공유하면 깨진 링크가 또 퍼집니다.
  url.pathname = '/';
  // QA entry parameters must not force a stale screen after a reload.
  url.searchParams.delete('ui');
  url.searchParams.delete('mode');
  url.searchParams.delete('ref');
  url.searchParams.delete('code');
  // 공유 수신 랜딩만 ref/code 유지 — 진단 중 새로고침에 친구 카드가 붙지 않게 합니다.
  if (route.screen === 'landing' && route.shareCode) {
    url.searchParams.set('ref', 'share');
    url.searchParams.set('code', route.shareCode);
  }
  if (route.resultId) url.searchParams.set('result', route.resultId);
  else url.searchParams.delete('result');
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Return to the entry before the diagnostic flow, then replace its forward branch. */
export function completionHistoryOffset(entry: FlowEntry) {
  const start = entry.diagnosisStart ?? entry.index;
  return Math.max(0, start - 1) - entry.index;
}
