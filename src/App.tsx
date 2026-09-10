import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import { useMediaQuery } from './utils/useMediaQuery';
import { LandingScreen } from './components/LandingScreen';
import { track } from './lib/analytics';
import { SHARE_REF, isShareableBodyCode } from './lib/share';
import { AnalyzingScreen } from './components/AnalyzingScreen';
import { lazyImportWithReload } from './lib/chunkLoadRecovery';

const ConsentScreen = lazy(() => lazyImportWithReload(() => import('./components/ConsentScreen').then(m => ({ default: m.ConsentScreen }))));
const DiagnosisIntroScreen = lazy(() => lazyImportWithReload(() => import('./components/DiagnosisIntroScreen').then(m => ({ default: m.DiagnosisIntroScreen }))));
const QuestionnaireScreen = lazy(() => lazyImportWithReload(() => import('./components/QuestionnaireScreen').then(m => ({ default: m.QuestionnaireScreen }))));
const AuthScreen = lazy(() => lazyImportWithReload(() => import('./components/AuthScreen').then(m => ({ default: m.AuthScreen }))));
const MembershipScreen = lazy(() => lazyImportWithReload(() => import('./components/MembershipScreen').then(m => ({ default: m.MembershipScreen }))));
const CheckoutScreen = lazy(() => lazyImportWithReload(() => import('./components/CheckoutScreen').then(m => ({ default: m.CheckoutScreen }))));
const CartScreen = lazy(() => lazyImportWithReload(() => import('./components/market/CartScreen').then(m => ({ default: m.CartScreen }))));
const JourneyIntroScreen = lazy(() => lazyImportWithReload(() => import('./components/journey/JourneyIntroScreen').then(m => ({ default: m.JourneyIntroScreen }))));
const JourneyTodayScreen = lazy(() => lazyImportWithReload(() => import('./components/journey/JourneyTodayScreen').then(m => ({ default: m.JourneyTodayScreen }))));
const JourneyMissionScreen = lazy(() => lazyImportWithReload(() => import('./components/journey/JourneyMissionScreen').then(m => ({ default: m.JourneyMissionScreen }))));
const JourneyReportScreen = lazy(() => lazyImportWithReload(() => import('./components/journey/JourneyReportScreen').then(m => ({ default: m.JourneyReportScreen }))));
const JourneyNextScreen = lazy(() => lazyImportWithReload(() => import('./components/journey/JourneyNextScreen').then(m => ({ default: m.JourneyNextScreen }))));
import { preloadQuestions, saveDraft, submitQuestionnaire, createLocalQuestionnaireResult, readLocalQuestionnaireResult, isLocalResultId, type Question } from './api/questionnaire';
import {
  attachQuestionnaireResultToUser,
  fetchLatestCompletedResultForUser,
  fetchUserBodyCodeForUser,
  signOutAccount,
  upsertProfileFromUser,
} from './api/account';
import { fetchEntitlement, FREE_OPEN_ENTITLEMENT, type Entitlement } from './api/entitlement';
import { CookieConsentBanner } from './components/CookieConsent';
import { AppShell, type AppTab } from './components/shell/AppShell';
import { HomeScreen } from './components/home/HomeScreen';
import { preloadCharacterImage } from './utils/characterImages';
import { StatusScreen } from './components/status/StatusScreen';
import { MissionScreen } from './components/mission/MissionScreen';
import { RoutineTab } from './components/routine/RoutineTab';
import { MarketScreen } from './components/market/MarketScreen';
import type { UserMission } from './api/journey';
import type { CodePlanJourneyProgress } from './components/codePlanShared';
import {
  clearInvalidAuthSession,
  getStoredSupabaseSession,
  isInvalidRefreshTokenError,
  recoverAuthSession,
} from './lib/authSession';
import { supabase } from './lib/supabase';
import type { AnswerMap } from './utils/bodyCodeCalculator';
import { readFlowEntry, type Screen, type FlowRoute } from './lib/flowNavigation';
import { withDeadline } from './lib/deadline';
import { flowSession, useFlowHistory } from './utils/useFlowHistory';
import { emptyQuestionnaireProgress, hasIncompleteProgress, readQuestionnaireProgress, persistQuestionnaireProgress } from './lib/questionnaireProgress';

const SESSION_LAST_RESULT_KEY = 'mebody:sessionResultId';

type ResultEntrySource = 'questionnaire' | 'quick' | 'shared';
type ResultSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';
type PendingAnalysis = {
  answers: AnswerMap;
  questions: Question[];
  questionnaireId?: string;
} | null;

const MIN_ANALYSIS_VISIBLE_MS = 1000;

/**
 * 데스크톱에서만 보이는 기기 목업 프레임.
 * 이 래퍼가 바깥 테두리이고, 안쪽 화면들은 각자 32px 라운드를 그립니다.
 * 테두리 반경을 2px 크게 잡아 자식의 모서리가 선 안쪽에 앉도록 합니다.
 */
const DESKTOP_FRAME_STYLE: CSSProperties = {
  border: '3px solid #183126',
  borderRadius: '34px',
  overflow: 'hidden',
  boxShadow: '0 24px 60px rgba(0, 70, 40, 0.18)',
  background: '#FAFAF0',
  // 기기 목업처럼 높이를 고정해야 안쪽 화면의 스크롤이 프레임 안에서 동작합니다.
  // 화면들이 minHeight: 100dvh 를 갖고 있어 이를 index.css 에서 무력화합니다(.mebody-frame > *).
  height: 'min(844px, calc(100vh - 32px))',
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const bootSearchParams = useRef(new URLSearchParams(window.location.search)).current;
  const restoredRoute = useRef(readFlowEntry(history.state, flowSession())?.route).current;
  const [questionnaireProgress, setQuestionnaireProgress] = useState(readQuestionnaireProgress);
  useEffect(() => persistQuestionnaireProgress(questionnaireProgress), [questionnaireProgress]);
  /**
   * 공유 링크로 들어왔는지. 첫 진입에서 한 번만 읽고 그 뒤로는 URL 에서 지웁니다(flowUrl).
   * code 는 결과를 여는 열쇠가 아니라 랜딩 문구 재료일 뿐입니다.
   */
  const sharedCode = useRef(
    bootSearchParams.get('ref') === SHARE_REF && isShareableBodyCode(bootSearchParams.get('code'))
      ? String(bootSearchParams.get('code'))
      : undefined,
  ).current;
  useEffect(() => {
    if (sharedCode) track('shared_link_opened', { ref: SHARE_REF, body_code: sharedCode });
  }, [sharedCode]);
  const previewScreenParam = bootSearchParams.get('ui');
  // ?ui=<screen> 로 특정 화면을 바로 여는 QA 용 파라미터. 결제 화면도 로그인 없이 확인할 수 있어야
  // 검증이 가능해서 membership·checkout 을 함께 둡니다(결제 자체는 로그인이 필요합니다).
  const previewScreen = import.meta.env.DEV ? (['landing', 'auth', 'result', 'membership', 'checkout', 'cart', 'journeyIntro', 'journeyToday'] as const).find((screen) => screen === previewScreenParam) : undefined;
  const bootAuthMode = bootSearchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const [currentScreen, setCurrentScreen] = useState<Screen>(restoredRoute?.screen === 'journeyMission' ? 'journeyToday' : restoredRoute?.screen === 'questionnaire' && questionnaireProgress.completedResultId ? 'result' : restoredRoute?.screen === 'analyzing' ? 'questionnaire' : restoredRoute?.screen ?? previewScreen ?? 'landing');
  const [questionnaireId, setQuestionnaireId] = useState<string | undefined>(restoredRoute?.resultId);
  const [bodyCode, setBodyCode] = useState<string | undefined>(restoredRoute?.bodyCode);
  const sharedResultIdParam = bootSearchParams.get('result');
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return getStoredSupabaseSession()?.user ?? null;
  });
  const [latestResultId, setLatestResultId] = useState<string | undefined>();
  const [selectedPlanCode, setSelectedPlanCode] = useState('basic_monthly');
  const [resultEntrySource, setResultEntrySource] = useState<ResultEntrySource>('questionnaire');
  const [resultSaveStatus, setResultSaveStatus] = useState<ResultSaveStatus>('idle');
  const [isBootstrapping, setIsBootstrapping] = useState(!previewScreen);
  const [authReturnScreen, setAuthReturnScreen] = useState<Screen>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>(bootAuthMode);
  const [membershipReturnScreen, setMembershipReturnScreen] = useState<Screen>('landing');
  const [pendingAnalysis, setPendingAnalysis] = useState<PendingAnalysis>(null);
  const [activeMission, setActiveMission] = useState<UserMission | null>(null);
  const [journeySummary, setJourneySummary] = useState<CodePlanJourneyProgress | null>(null);
  /** 무료/유료 자격. 실제 잠금은 DB(RLS)가 하고, 이 값은 화면 안내용입니다. */
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE_OPEN_ENTITLEMENT);
  /** 하단 5탭. currentScreen === 'result' 일 때 셸이 이 값으로 내용을 고릅니다. */
  const [activeTab, setActiveTab] = useState<AppTab>(restoredRoute?.tab ?? 'home');
  const [journeyReportTarget, setJourneyReportTarget] = useState<{ type: 'weekly' | 'progress_check'; dayNo: number }>({ type: 'weekly', dayNo: 7 });
  const mountedRef = useRef(true);
  const questionnaireIdRef = useRef<string | undefined>();
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  const [authSuccessScreen, setAuthSuccessScreen] = useState<Screen>(restoredRoute?.authSuccess ?? 'landing');
  const [diagnosisReturnScreen, setDiagnosisReturnScreen] = useState<Screen>('landing');
  const [journeyReturnScreen, setJourneyReturnScreen] = useState<Screen>('result');
  const analysisAbortRef = useRef<AbortController>();
  useEffect(() => {
    if (currentScreen !== 'analyzing') analysisAbortRef.current?.abort();
  }, [currentScreen]);
  const screenRef = useRef(currentScreen);
  screenRef.current = currentScreen;
  const navigation = useFlowHistory({ screen: currentScreen, tab: activeTab, resultId: questionnaireId, bodyCode,
    diagnosisId: questionnaireProgress.id, authSuccess: currentScreen === 'auth' ? authSuccessScreen : undefined,
    questionIndex: currentScreen === 'questionnaire' ? questionnaireProgress.index : undefined }, (route: FlowRoute) => {
    setPendingAnalysis(null);
    const completedQuestionnaire = route.screen === 'questionnaire' && (questionnaireProgress.completedResultId || (route.diagnosisId && route.diagnosisId !== questionnaireProgress.id));
    const screen = completedQuestionnaire ? 'result' : route.screen === 'analyzing' ? 'result'
      : route.screen === 'journeyMission' && !activeMission ? 'journeyToday' : route.screen;
    setCurrentScreen(screen);
    setActiveTab(route.tab);
    setBodyCode(route.bodyCode);
    setQuestionnaireId(completedQuestionnaire ? questionnaireProgress.completedResultId ?? latestResultId : route.resultId);
    if (route.authSuccess) setAuthSuccessScreen(route.authSuccess);
    if (screen === 'questionnaire' && route.questionIndex !== undefined) {
      setQuestionnaireProgress((progress) => ({ ...progress, index: route.questionIndex! }));
    }
  }, !isBootstrapping);
  const goBack = (screen: Screen = 'result') => navigation.back({ screen, tab: activeTab, resultId: questionnaireId });


  useEffect(() => {
    questionnaireIdRef.current = questionnaireId;
  }, [questionnaireId]);

  const rememberResultForCurrentSession = (id: string, user: User | null = currentUser) => {
    setLatestResultId(id);
    if (!user) {
      sessionStorage.setItem(SESSION_LAST_RESULT_KEY, id);
    }
  };

  const resetAnonymousState = (clearSession = true) => {
    navigation.reset();
    setQuestionnaireProgress(emptyQuestionnaireProgress());
    setLatestResultId(undefined);
    setQuestionnaireId(undefined);
    setBodyCode(undefined);
    setResultEntrySource('questionnaire');
    setResultSaveStatus('idle');
    setPendingAnalysis(null);
    setActiveMission(null);
    setJourneySummary(null);
    if (clearSession) {
      sessionStorage.removeItem(SESSION_LAST_RESULT_KEY);
    }
    setCurrentScreen('landing');
  };

  const openAuth = (returnScreen: Screen, mode: 'signin' | 'signup' = 'signin', successScreen: Screen = returnScreen) => {
    setAuthReturnScreen(returnScreen);
    setAuthSuccessScreen(successScreen);
    setAuthInitialMode(mode);
    setCurrentScreen('auth');
  };

  const openMembership = (returnScreen: Screen) => {
    setPendingAnalysis(null);
    setMembershipReturnScreen(returnScreen);
    if (currentUser) {
      setCurrentScreen('membership');
      return;
    }
    openAuth(returnScreen, 'signin', 'membership');
  };

  const openResultScreen = (id: string, source: ResultEntrySource, tab: AppTab = 'home') => {
    setPendingAnalysis(null);
    setQuestionnaireId(id);
    setActiveTab(tab);
    setCurrentScreen('result');
    setResultEntrySource(source);
    setResultSaveStatus(currentUser ? 'saved' : 'idle');
    rememberResultForCurrentSession(id);
  };

  const handleQuestionnaireComplete = (answers: AnswerMap, questions: Question[], draftId?: string) => {
    if (questionnaireProgress.completedResultId || screenRef.current === 'analyzing') return;
    setPendingAnalysis({ answers, questions, questionnaireId: draftId });
    setResultEntrySource('questionnaire');
    setResultSaveStatus('saving');
    setCurrentScreen('analyzing');
  };

  const persistAnalysisResult = async (
    pending: NonNullable<PendingAnalysis>,
    signal?: AbortSignal,
  ): Promise<{ resultId: string; resultCode: string }> => {
    const answers = pending.answers;
    const questions = pending.questions;
    let persistedId = pending.questionnaireId;
    if (!persistedId || isLocalResultId(persistedId)) {
      const draft = await saveDraft(answers, undefined, signal);
      persistedId = String(draft.id);
    }

    let dbResult;
    try {
      dbResult = await submitQuestionnaire(answers, persistedId, questions, signal);
    } catch (firstError) {
      signal?.throwIfAborted();
      console.warn('First save attempt failed, retrying once...', firstError);
      await wait(1000);
      dbResult = await submitQuestionnaire(answers, persistedId, questions, signal);
    }

    const dbResultId = String(dbResult.id);
    const resultCode = dbResult.calculated_code || createLocalQuestionnaireResult(answers, questions).calculated_code;

    if (currentUser) {
      await attachQuestionnaireResultToUser(dbResultId, currentUser.id);
    }

    if (sharedCode) track('shared_questionnaire_completed', { ref: SHARE_REF, body_code: resultCode });

    return { resultId: dbResultId, resultCode };
  };

  const handleAnalyzePendingAnswers = async () => {
    const currentPending = pendingAnalysis;
    if (!currentPending) {
      setCurrentScreen('questionnaire');
      return;
    }

    const controller = new AbortController();
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = controller;
    const startedAt = Date.now();
    const localResult = createLocalQuestionnaireResult(currentPending.answers, currentPending.questions);

    let resultId = localResult.id;
    let resultCode = localResult.calculated_code;
    let finalSaveStatus: ResultSaveStatus = 'saved';
    let saveSucceeded = false;

    try {
      await withDeadline(async (signal) => {
        const persisted = await persistAnalysisResult(currentPending, signal);
        resultId = persisted.resultId;
        resultCode = persisted.resultCode || resultCode;
        saveSucceeded = true;
      }, controller, 15000);
    } catch (error) {
      console.error('[mebody-error] submit failed; showing the available result:', error);
      finalSaveStatus = 'failed';
      saveSucceeded = false;
    }

    // Analysis screen should remain visible until save finishes,
    // then keep it for at least 1 second for visual continuity.
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_ANALYSIS_VISIBLE_MS) {
      await wait(MIN_ANALYSIS_VISIBLE_MS - elapsed);
    }

    if (!mountedRef.current) return;
    if (screenRef.current !== 'analyzing' || analysisAbortRef.current !== controller) return;

    // Keep retry payload when save failed so Home can re-submit.
    if (saveSucceeded) {
      setPendingAnalysis(null);
      setQuestionnaireProgress((progress) => ({ ...progress, completedResultId: resultId, answers: {}, index: 0 }));
      rememberResultForCurrentSession(resultId);
    } else {
      setPendingAnalysis({
        ...currentPending,
        questionnaireId: currentPending.questionnaireId,
      });
      setQuestionnaireProgress((progress) => ({ ...progress, completedResultId: undefined }));
    }

    setQuestionnaireId(resultId);
    setBodyCode(resultCode);
    setResultEntrySource('questionnaire');
    setResultSaveStatus(finalSaveStatus);
    setCurrentScreen('result');
  };

  const handleRetryResultSave = async () => {
    const currentPending = pendingAnalysis;
    if (!currentPending || resultSaveStatus === 'saving') return;

    setResultSaveStatus('saving');
    try {
      const persisted = await persistAnalysisResult(currentPending);
      setPendingAnalysis(null);
      setQuestionnaireId(persisted.resultId);
      setBodyCode(persisted.resultCode);
      setQuestionnaireProgress((progress) => ({
        ...progress,
        completedResultId: persisted.resultId,
        answers: {},
        index: 0,
      }));
      rememberResultForCurrentSession(persisted.resultId);
      setResultSaveStatus('saved');
    } catch (error) {
      console.error('[mebody-error] retry save failed:', error);
      setResultSaveStatus('failed');
    }
  };

  const handleRestart = () => {
    setQuestionnaireId(undefined);
    setBodyCode(undefined);
    setPendingAnalysis(null);
    setResultEntrySource('questionnaire');
    setResultSaveStatus('idle');
    setCurrentScreen('questionnaire');
  };


  const handleResultLoad = (code: string) => {
    setBodyCode(code);
  };

  const refreshLatestResultInBackground = (userId: string, email?: string | null) => {
    void fetchLatestCompletedResultForUser(userId)
      .then(async (latestFromDb) => {
        if (!mountedRef.current) return;
        if (latestFromDb) {
          setLatestResultId(latestFromDb.id);
          setBodyCode(latestFromDb.calculated_code);
          return;
        }

        const profileCode = await fetchUserBodyCodeForUser(userId, email);
        if (!mountedRef.current || !profileCode) return;
        setBodyCode(profileCode.body_bti_code);
      })
      .catch((error) => {
        console.warn('refreshLatestResultInBackground failed:', error);
      });
  };

  const syncUserInBackground = (user: User) => {
    void (async () => {
      try {
        await upsertProfileFromUser(user);
      } catch (error) {
        console.warn('syncUserInBackground failed:', error);
      }
    })();
  };

  const handleSignedInRoute = async (user: User, options?: { navigate?: boolean }) => {
    const shouldNavigate = options?.navigate !== false;
    setCurrentUser(user);

    const currentQuestionnaireId = questionnaireIdRef.current;
    const canAttach =
      Boolean(currentQuestionnaireId) &&
      !isLocalResultId(currentQuestionnaireId!);

    try {
      // Profile sync should not block post-login routing.
      try {
        await upsertProfileFromUser(user);
      } catch (profileError) {
        console.warn('handleSignedInRoute upsertProfileFromUser failed:', profileError);
      }

      if (canAttach && currentQuestionnaireId) {
        setResultSaveStatus('saving');
        try {
          await attachQuestionnaireResultToUser(currentQuestionnaireId, user.id);
        } catch (attachError) {
          console.warn('handleSignedInRoute attachQuestionnaireResultToUser failed:', attachError);
        }
        setQuestionnaireId(currentQuestionnaireId);
        setLatestResultId(currentQuestionnaireId);
        setResultEntrySource('questionnaire');
        setResultSaveStatus('saved');
        if (shouldNavigate) {
          // 로그인 직후는 항상 내 상태 탭으로 보냅니다.
          setActiveTab('status');
          setCurrentScreen('result');
        }
        return;
      }

      const latestFromDb = await fetchLatestCompletedResultForUser(user.id);
      if (latestFromDb) {
        setQuestionnaireId(latestFromDb.id);
        setLatestResultId(latestFromDb.id);
        setBodyCode(latestFromDb.calculated_code);
        setResultEntrySource('quick');
        setResultSaveStatus('saved');
        if (shouldNavigate) {
          setActiveTab('status');
          setCurrentScreen('result');
        }
        return;
      }

      // Fallback path: legacy users may have only profile body code.
      const profileCode = await fetchUserBodyCodeForUser(user.id, user.email);
      if (!isLocalResultId(currentQuestionnaireId ?? '')) {
        setQuestionnaireId(undefined);
        setLatestResultId(undefined);
      }
      setBodyCode(profileCode?.body_bti_code);
      setResultEntrySource('questionnaire');
      setResultSaveStatus('idle');
      if (!shouldNavigate) return;
      if (profileCode?.body_bti_code) {
        setActiveTab('status');
        setCurrentScreen('result');
      } else {
        setCurrentScreen('consent');
      }
    } catch (error) {
      console.warn('handleSignedInRoute failed:', error);
      if (!shouldNavigate) return;
      setQuestionnaireId(undefined);
      setLatestResultId(undefined);
      setBodyCode(undefined);
      setResultEntrySource('questionnaire');
      setResultSaveStatus('failed');
      setCurrentScreen('consent');
    }
  };

  useEffect(() => {
    preloadQuestions();
  }, []);

  useEffect(() => {
    if (previewScreen) {
      if (!restoredRoute) setCurrentScreen(previewScreen);
      setIsBootstrapping(false);
      return;
    }

    mountedRef.current = true;
    let authUnsubscribe: (() => void) | undefined;

    async function bootstrap() {
      try {
        const params = new URLSearchParams(window.location.search);
        const sharedResultId = params.get('result');
        const sessionResultId = sessionStorage.getItem(SESSION_LAST_RESULT_KEY) ?? undefined;

        const session = await recoverAuthSession();
        if (!mountedRef.current) return;

        const user = session?.user ?? null;
        setCurrentUser(user);

        if (!user) {
          if (restoredRoute && !restoredRoute.screen.startsWith('journey')
            && (!sharedResultId || sessionResultId === sharedResultId)) {
            setLatestResultId(sessionResultId);
            return;
          }
          if (sharedResultId && sessionResultId === sharedResultId) {
            openResultScreen(sharedResultId, 'questionnaire');
            return;
          }
          resetAnonymousState();
          return;
        }

        syncUserInBackground(user);
        refreshLatestResultInBackground(user.id, user.email);

        // 어디로 보낼지 정하려면 코드가 있는지부터 알아야 합니다.
        let resolvedResultId: string | undefined;
        let resolvedProfileCode: string | undefined;
        try {
          const latestFromDb = await fetchLatestCompletedResultForUser(user.id);
          if (latestFromDb) {
            resolvedResultId = latestFromDb.id;
            setLatestResultId(latestFromDb.id);
            setBodyCode(latestFromDb.calculated_code);
          } else {
            const profileCode = await fetchUserBodyCodeForUser(user.id, user.email);
            if (profileCode?.body_bti_code) {
              resolvedProfileCode = profileCode.body_bti_code;
              setBodyCode(profileCode.body_bti_code);
            }
          }
        } catch (resolveError) {
          console.warn('bootstrap user result/profile resolution failed:', resolveError);
        }

        if (restoredRoute) {
          setQuestionnaireId(sharedResultId ?? resolvedResultId);
          // 로그인 재접속: 진단/저니 중간이 아니면 미션 탭으로 보냅니다.
          const midFlow = (
            restoredRoute.screen === 'questionnaire'
            || restoredRoute.screen === 'analyzing'
            || restoredRoute.screen === 'auth'
            || restoredRoute.screen.startsWith('journey')
          );
          if (!midFlow) {
            setActiveTab('mission');
            setCurrentScreen('result');
          }
          return;
        }

        if (sharedResultId) {
          openResultScreen(sharedResultId, 'shared', 'mission');
          return;
        }

        // 이미 코드가 있으면 문항을 다시 묻지 않습니다.
        // 재접속(세션 복원)은 미션 탭으로, 로그인 직후는 handleSignedInRoute 가 내 상태로 보냅니다.
        if (resolvedResultId) {
          openResultScreen(resolvedResultId, 'quick', 'mission');
        } else if (resolvedProfileCode) {
          setActiveTab('mission');
          setCurrentScreen('result');
        } else {
          // 코드가 없으면 문항 플로우로 태웁니다(동의 → 안내 → 문항).
          setCurrentScreen('consent');
        }
      } catch (error) {
        if (isInvalidRefreshTokenError(error)) {
          await clearInvalidAuthSession();
          setCurrentUser(null);
          resetAnonymousState();
        } else {
          console.warn('bootstrap failed:', error);
          setCurrentScreen('landing');
        }
      } finally {
        if (mountedRef.current) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    // 주의: supabase-js 는 이 콜백을 내부 인증 락(navigator.locks) 안에서 실행합니다.
    // 콜백 안에서 supabase 호출을 await 하면 같은 락에 재진입해 데드락이 나고,
    // 그 뒤로 getSession() 이 영원히 끝나지 않아 모든 PostgREST 쿼리가 멈춥니다.
    // 그래서 동기 state 갱신만 콜백에서 하고, DB 작업은 setTimeout 으로 락 밖에서 실행합니다.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);

      if (!user) {
        // Supabase 는 비로그인 방문자에게도 구독 직후 INITIAL_SESSION(session=null)을 발생시킵니다.
        // 여기서 무조건 초기화하면 bootstrap 이 복원한 비회원 결과를 덮어써
        // 결과 화면에서 새로고침하면 랜딩으로 튕깁니다.
        // 실제 로그아웃일 때만 초기화합니다.
        if (event === 'SIGNED_OUT') {
          resetAnonymousState();
        }
        return;
      }

      setTimeout(() => {
        void (async () => {
          if (!mountedRef.current) return;
          try {
            await upsertProfileFromUser(user);
            await attachQuestionnaireResultToUser(questionnaireIdRef.current, user.id);
          } catch (error) {
            console.warn('upsertProfileFromUser(auth) failed:', error);
          }

          try {
            const latestFromDb = await fetchLatestCompletedResultForUser(user.id);
            if (!mountedRef.current) return;
            if (latestFromDb) {
              setLatestResultId(latestFromDb.id);
              setBodyCode(latestFromDb.calculated_code);
              setResultSaveStatus('saved');
            } else if (questionnaireIdRef.current) {
              setLatestResultId(questionnaireIdRef.current);
            } else {
              const profileCode = await fetchUserBodyCodeForUser(user.id, user.email);
              if (mountedRef.current && profileCode) setBodyCode(profileCode.body_bti_code);
            }
          } catch (error) {
            console.warn('auth post-login sync failed:', error);
          }
        })();
      }, 0);
    });

    authUnsubscribe = () => authListener.subscription.unsubscribe();

    return () => {
      mountedRef.current = false;
      authUnsubscribe?.();
    };
  }, [previewScreen]);

  /**
   * 자격(유료 여부)을 다시 읽습니다.
   * 결제 직후에 부르면 광고가 사라지고 루틴 잠금이 풀리는 게 화면 이동 없이 바로 반영됩니다.
   */
  const refreshEntitlement = useCallback(async () => {
    const next = await fetchEntitlement(currentUser?.id);
    if (mountedRef.current) setEntitlement(next);
  }, [currentUser?.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchEntitlement(currentUser?.id);
      if (!cancelled) setEntitlement(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentScreen]);

  // 코드를 아는 순간 캐릭터 이미지를 미리 받아 둡니다.
  // 결과 화면이 열릴 때는 이미 캐시에 있어 바로 뜹니다.
  useEffect(() => {
    preloadCharacterImage(bodyCode);
  }, [bodyCode]);

  useEffect(() => {
    const needsSummary =
      Boolean(currentUser)
      && currentScreen === 'result'
      && (activeTab === 'status' || activeTab === 'routine' || activeTab === 'mission');

    if (!needsSummary) return;

    let cancelled = false;
    void (async () => {
      try {
        const { fetchTodayProgressSummary } = await import('./api/journey');
        const summary = await fetchTodayProgressSummary(currentUser!.id);
        if (cancelled) return;
        setJourneySummary(
          summary
            ? {
                progress: summary.progress,
                dayNo: summary.dayNo,
                totalDays: summary.totalDays,
                completed: summary.completed,
                total: summary.total,
                onOpen: () => setCurrentScreen('journeyToday'),
              }
            : null,
        );
      } catch (error) {
        console.warn('journey summary load failed:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentScreen, activeTab]);


  /**
   * 랜딩의 기본 진입.
   * 이미 완료된 결과가 있으면 결과로 보냅니다.
   * 중간 진행은 Landing에서 이어서/처음부터를 고른 뒤 onResumeIncomplete / startNewDiagnosis 로 처리합니다.
   */
  const startOrResumeDiagnosis = () => {
    const knownResultId = questionnaireId ?? latestResultId;
    if (knownResultId && !isLocalResultId(knownResultId)) {
      openResultScreen(knownResultId, 'quick');
      return;
    }
    // 결과 ID 는 아직 못 받았지만 코드가 저장돼 있는 회원이면
    // 문항으로 보내지 말고 내 페이지로 보냅니다(거기서 최근 결과를 찾아줍니다).
    if (currentUser && bodyCode) {
      openMyPage();
      return;
    }
    startNewDiagnosis();
  };

  const resumeIncompleteDiagnosis = () => {
    setCurrentScreen('questionnaire');
  };

  const startNewDiagnosis = () => {
    if (sharedCode) track('shared_questionnaire_started', { ref: SHARE_REF, body_code: sharedCode });
    setDiagnosisReturnScreen(currentScreen);
    setQuestionnaireProgress(emptyQuestionnaireProgress());
    setPendingAnalysis(null);
    setResultEntrySource('questionnaire');
    setResultSaveStatus('idle');
    setCurrentScreen('consent');
  };

  const openQuickResult = () => {
    if (!latestResultId) return;
    openResultScreen(latestResultId, 'quick');
  };

  /**
   * 14일 관리 진입은 여기 한 곳만 씁니다.
   * 진행 중인 저니가 있으면 인트로를 건너뛰고 바로 오늘의 미션으로 보냅니다.
   */
  const openJourneyIntro = () => {
    setJourneyReturnScreen(currentScreen);
    setPendingAnalysis(null);
    if (!currentUser) {
      openAuth(currentScreen, 'signup', 'journeyIntro');
      return;
    }
    // 요약이 이미 로드돼 있으면(=진행 중) 왕복 없이 바로 이동합니다.
    if (journeySummary) {
      setCurrentScreen('journeyToday');
      return;
    }
    // 무료 체험(첫 저니)을 이미 쓴 무구독 사용자는 결제 안내로 보냅니다.
    // 실제 잠금은 RLS 가 하므로 여기서 놓쳐도 INSERT 단계에서 다시 막힙니다.
    if (!entitlement.isFallback && !entitlement.canStartJourney) {
      openMembership(currentScreen);
      return;
    }
    setCurrentScreen('journeyIntro');
    void (async () => {
      try {
        const { fetchActiveJourney } = await import('./api/journey');
        const active = await fetchActiveJourney(currentUser.id);
        if (mountedRef.current && active && screenRef.current === 'journeyIntro') { navigation.replace(); setCurrentScreen('journeyToday'); }
      } catch (error) {
        console.warn('fetchActiveJourney failed:', error);
      }
    })();
  };

  /**
   * "내 페이지" 는 이제 셸의 "내 상태" 탭입니다.
   * 같은 내용을 두 화면이 다르게 보여주고 있어 하나로 합쳤습니다.
   */
  const openMyPage = () => {
    if (!currentUser) {
      openAuth('result', 'signin');
      return;
    }
    setActiveTab('status');
    setCurrentScreen('result');
  };

  const handleLogout = async () => {
    try {
      await signOutAccount();
    } catch (error) {
      console.warn('signOutAccount failed, trying local signout:', error);
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (localError) {
        console.warn('local signOut fallback failed:', localError);
      }
    } finally {
      setCurrentUser(null);
      resetAnonymousState(true);
    }
  };

  if (isBootstrapping) {
    return (
      <div className={isDesktopMockup ? "mebody-desktop-backdrop min-h-screen flex items-center justify-center p-4" : ""}>
        <div
          className={isDesktopMockup ? "mebody-app-surface w-full max-w-md flex items-center justify-center" : "mebody-app-surface w-full flex items-center justify-center"}
          style={isDesktopMockup ? DESKTOP_FRAME_STYLE : { height: 'var(--mebody-app-height)', minHeight: 'var(--mebody-app-height)' }}
        >
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={isDesktopMockup ? "mebody-desktop-backdrop min-h-screen flex items-center justify-center p-4" : ""}>
      <div
        className={isDesktopMockup ? "mebody-frame w-full max-w-md relative" : "w-full relative"}
        style={isDesktopMockup ? DESKTOP_FRAME_STYLE : { height: 'var(--mebody-app-height)', minHeight: 'var(--mebody-app-height)', overflow: 'hidden' }}
      >
        <Suspense fallback={
          <div className="flex items-center justify-center" style={{ height: 'var(--mebody-app-height)', minHeight: 'var(--mebody-app-height)' }}>
            <div className="text-gray-400">화면을 불러오는 중...</div>
          </div>
        }>
          {currentScreen === 'landing' && (
            <LandingScreen
              onStart={startOrResumeDiagnosis}
              hasIncompleteProgress={hasIncompleteProgress(questionnaireProgress)}
              onResumeIncomplete={resumeIncompleteDiagnosis}
              onStartFresh={startNewDiagnosis}
              hasExistingCode={Boolean(
                (questionnaireId && !isLocalResultId(questionnaireId)) ||
                  latestResultId ||
                  (currentUser && bodyCode),
              )}
              isLoggedIn={Boolean(currentUser)}
              userEmail={currentUser?.email}
              userDisplayName={
                typeof currentUser?.user_metadata?.display_name === 'string'
                  ? currentUser.user_metadata.display_name
                  : undefined
              }
              latestBodyCode={bodyCode}
              onAccount={currentUser ? openMyPage : () => openAuth('landing')}
              onPreviewSignedIn={() => {
                // 미리보기(로그인 직후와 동일): 내 상태 탭
                setActiveTab('status');
                setCurrentScreen('result');
              }}
              sharedCode={sharedCode}
            />
          )}

          {currentScreen === 'consent' && <ConsentScreen onBack={() => goBack(diagnosisReturnScreen)} onAgree={() => setCurrentScreen('intro')} />}

          {currentScreen === 'intro' && <DiagnosisIntroScreen onBack={() => goBack('consent')} onBegin={() => setCurrentScreen('questionnaire')} />}

          {currentScreen === 'questionnaire' && (
            <QuestionnaireScreen
              onPreviousQuestion={(index) => navigation.back({ screen: 'questionnaire', tab: activeTab, resultId: questionnaireId, questionIndex: index })}
              progress={questionnaireProgress}
              onProgressChange={setQuestionnaireProgress}
              onBack={() => goBack('intro')}
              onComplete={handleQuestionnaireComplete}
              isLoggedIn={Boolean(currentUser)}
              userEmail={currentUser?.email}
              onOpenMyPage={openMyPage}
              onRequireAuth={() => openAuth('questionnaire')}
            />
          )}

          {currentScreen === 'analyzing' && (
            <AnalyzingScreen onAnalyze={handleAnalyzePendingAnswers} />
          )}

          {currentScreen === 'auth' && (
            <AuthScreen
              user={currentUser}
              initialMode={authInitialMode}
              onBack={() => goBack(authReturnScreen)}
              onSignedIn={async (signedInUser) => {
                const explicitDestination = (
                  ['membership', 'journeyIntro', 'checkout', 'cart', 'journeyToday', 'journeyMission', 'journeyReport', 'journeyNext'] as Screen[]
                ).includes(authSuccessScreen);

                if (explicitDestination) {
                  await handleSignedInRoute(signedInUser, { navigate: false });
                  navigation.replace();
                  setCurrentScreen(authSuccessScreen);
                  return;
                }

                await handleSignedInRoute(signedInUser, { navigate: true });
              }}
              onGoMembership={() => openMembership('auth')}
            />
          )}

          {/* 홈·미션·루틴·마켓·내 상태 + 멤버십·결제. 결제도 앱 안(탭바 유지)에서 끝납니다. */}
          {(currentScreen === 'result' || currentScreen === 'membership' || currentScreen === 'checkout' || currentScreen === 'cart') && (
            <AppShell
              scrollKey={`${currentScreen}:${activeTab}:${questionnaireId ?? "none"}`}
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                // 멤버십·결제 화면에서 탭을 누르면 그 탭으로 빠져나옵니다.
                setCurrentScreen('result');
              }}
              onBrandClick={() => setCurrentScreen('landing')}
              topBarRight={
                <button
                  type="button"
                  onClick={currentUser ? openMyPage : () => openAuth(currentScreen)}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: '#004628',
                    fontSize: '13px',
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {currentUser ? '내 페이지' : '로그인'}
                </button>
              }
            >
              {currentScreen === 'membership' && (
                <MembershipScreen
                  user={currentUser}
                  onBack={() => goBack(membershipReturnScreen === 'membership' ? 'result' : membershipReturnScreen)}
                  onRequireAuth={() => openAuth('membership')}
                  onSelectPlan={(planCode) => {
                    setSelectedPlanCode(planCode);
                    setCurrentScreen('checkout');
                  }}
                />
              )}

              {currentScreen === 'checkout' && (
                <CheckoutScreen
                  user={currentUser}
                  planCode={selectedPlanCode}
                  onBack={() => goBack('membership')}
                  onRequireAuth={() => openAuth('checkout')}
                  onComplete={() => { void refreshEntitlement(); }}
                />
              )}

              {currentScreen === 'cart' && (
                <CartScreen
                  user={currentUser}
                  isPaid={entitlement.isPaid}
                  onBack={() => navigation.back({ screen: 'result', tab: 'market', resultId: questionnaireId })}
                  onRequireAuth={() => openAuth('cart')}
                  onContinueShopping={() => { setActiveTab('market'); setCurrentScreen('result'); }}
                  onPaid={() => { void refreshEntitlement(); }}
                />
              )}

              {currentScreen === 'result' && activeTab === 'home' && resultSaveStatus === 'failed' && (
                <div
                  role="status"
                  style={{
                    margin: '12px 16px 0',
                    padding: '14px 16px',
                    borderRadius: '16px',
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    display: 'grid',
                    gap: '10px',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#7f1d1d', wordBreak: 'keep-all' }}>
                    결과를 서버에 저장하지 못했습니다. 화면에서는 계속 볼 수 있지만, 로그인·여정에는 아직 연결되지 않습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleRetryResultSave()}
                    disabled={!pendingAnalysis}
                    style={{
                      height: '40px',
                      borderRadius: '12px',
                      border: 'none',
                      background: pendingAnalysis ? '#014725' : '#9ca3af',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: pendingAnalysis ? 'pointer' : 'not-allowed',
                    }}
                  >
                    다시 저장
                  </button>
                </div>
              )}
              {currentScreen === 'result' && activeTab === 'home' && resultSaveStatus === 'saving' && (
                <p role="status" style={{ margin: '12px 16px 0', fontSize: '13px', fontWeight: 700, color: '#014725' }}>
                  결과를 저장하는 중…
                </p>
              )}
              {currentScreen === 'result' && activeTab === 'home' && (
                <HomeScreen
                  // 내 상태 탭 등으로 들어오면 questionnaireId 가 없을 수 있어
                  // 저장된 최근 결과로 폴백합니다.
                  questionnaireId={questionnaireId ?? latestResultId}
                  isLoggedIn={Boolean(currentUser)}
                  isPaid={entitlement.isPaid}
                  onResultLoad={handleResultLoad}
                  initialBodyCode={bodyCode}
                  onStartCare={() => setActiveTab('mission')}
                  onOpenRoutine={() => setActiveTab('routine')}
                  onOpenMarket={() => setActiveTab('market')}
                  onRemeasure={startNewDiagnosis}
                  onGoAuth={() => openAuth('result')}
                />
              )}
              {currentScreen === 'result' && activeTab === 'mission' && (
                <MissionScreen
                  questionnaireId={questionnaireId ?? latestResultId}
                  isLoggedIn={Boolean(currentUser)}
                  isPaid={entitlement.isPaid}
                  onRequireAuth={() => openAuth('result')}
                />
              )}
              {currentScreen === 'result' && activeTab === 'routine' && (
                <RoutineTab
                  entitlement={entitlement}
                  isLoggedIn={Boolean(currentUser)}
                  journeyProgress={journeySummary ?? undefined}
                  onOpenJourney={openJourneyIntro}
                  onOpenMembership={() => openMembership('result')}
                  onRequireAuth={() => openAuth('result')}
                />
              )}
              {currentScreen === 'result' && activeTab === 'status' && (
                <StatusScreen
                  user={currentUser}
                  bodyCode={bodyCode}
                  isPaid={entitlement.isPaid}
                  tier={entitlement.tier !== 'free' ? entitlement.tier : undefined}
                  journeyProgress={journeySummary ?? undefined}
                  onOpenResult={(id) => { if (id) { setQuestionnaireId(id); setBodyCode(undefined); } setActiveTab('home'); }}
                  onOpenRoutine={openJourneyIntro}
                  onOpenMembership={() => openMembership('result')}
                  onStartDiagnosis={startNewDiagnosis}
                  onRequireAuth={() => openAuth('result')}
                  onLogout={handleLogout}
                  onSubscriptionChanged={() => { void refreshEntitlement(); }}
                />
              )}
              {currentScreen === 'result' && activeTab === 'market' && (
                <MarketScreen
                  isPaid={entitlement.isPaid}
                  bodyCode={bodyCode}
                  onOpenMembership={() => openMembership('result')}
                  onOpenCart={() => setCurrentScreen('cart')}
                />
              )}
            </AppShell>
          )}

          {currentScreen === 'journeyIntro' && (
            <JourneyIntroScreen
              user={currentUser}
              questionnaireId={questionnaireId ?? latestResultId}
              onBack={() => goBack(journeyReturnScreen)}
              onRequireAuth={() => openAuth('journeyIntro', 'signup')}
              onStarted={() => { navigation.replace(); setCurrentScreen('journeyToday'); }}
              onStartDiagnosis={startNewDiagnosis}
              onRequireSubscription={() => openMembership(currentScreen)}
              isFirstJourneyFree={!entitlement.isFallback && !entitlement.isPaid && entitlement.journeyCount === 0}
            />
          )}

          {currentScreen === 'journeyToday' && (
            <JourneyTodayScreen
              user={currentUser}
              onBack={() => goBack(journeyReturnScreen)}
              onStartJourney={openJourneyIntro}
              onOpenMission={(mission) => {
                setActiveMission(mission);
                setCurrentScreen('journeyMission');
              }}
              onOpenReport={(dayNo, kind) => {
                setJourneyReportTarget({ type: kind, dayNo });
                setCurrentScreen('journeyReport');
              }}
            />
          )}

          {currentScreen === 'journeyMission' && (
            <JourneyMissionScreen
              key={activeMission?.id ?? 'empty'}
              user={currentUser}
              mission={activeMission}
              onBack={() => {
                goBack('journeyToday');
              }}
              onDone={() => {
                setActiveMission(null);
                goBack('journeyToday');
              }}
            />
          )}

          {currentScreen === 'journeyReport' && (
            <JourneyReportScreen
              user={currentUser}
              reportType={journeyReportTarget.type}
              dayNo={journeyReportTarget.dayNo}
              onBack={() => goBack('journeyToday')}
              onNext={() => setCurrentScreen('journeyNext')}
            />
          )}

          {currentScreen === 'journeyNext' && (
            <JourneyNextScreen
              user={currentUser}
              onBack={() => goBack('journeyToday')}
              onRemeasure={startNewDiagnosis}
              onStartedNext={() => setCurrentScreen('journeyToday')}
              onRequireSubscription={() => openMembership(currentScreen)}
            />
          )}

        </Suspense>
        {/* 광고 쿠키 동의 — 유료 회원에게는 광고가 없으므로 묻지 않습니다 */}
        {!entitlement.isPaid && <CookieConsentBanner aboveTabBar={currentScreen === 'result'} />}
      </div>
    </div>
  );
}
