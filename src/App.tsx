import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import type { User } from '@supabase/supabase-js';
import { useMediaQuery } from './utils/useMediaQuery';
import { LandingScreen } from './components/LandingScreen';
import { AnalyzingScreen } from './components/AnalyzingScreen';

const ConsentScreen = lazy(() => import('./components/ConsentScreen').then(m => ({ default: m.ConsentScreen })));
const DiagnosisIntroScreen = lazy(() => import('./components/DiagnosisIntroScreen').then(m => ({ default: m.DiagnosisIntroScreen })));
const QuestionnaireScreen = lazy(() => import('./components/QuestionnaireScreen').then(m => ({ default: m.QuestionnaireScreen })));
const ResultScreen = lazy(() => import('./components/ResultScreen').then(m => ({ default: m.ResultScreen })));
const CodePlanScreen = lazy(() => import('./components/CodePlanScreen').then(m => ({ default: m.CodePlanScreen })));
const CommonGuideScreen = lazy(() => import('./components/CommonGuideScreen').then(m => ({ default: m.CommonGuideScreen })));
const CodeDetailsScreen = lazy(() => import('./components/CodeDetailsScreen').then(m => ({ default: m.CodeDetailsScreen })));
const AuthScreen = lazy(() => import('./components/AuthScreen').then(m => ({ default: m.AuthScreen })));
const MembershipScreen = lazy(() => import('./components/MembershipScreen').then(m => ({ default: m.MembershipScreen })));
const CheckoutScreen = lazy(() => import('./components/CheckoutScreen').then(m => ({ default: m.CheckoutScreen })));
const MyPageScreen = lazy(() => import('./components/MyPageScreen').then(m => ({ default: m.MyPageScreen })));
const CodePlanFullscreenModal = lazy(() => import('./components/CodePlanFullscreenModal').then(m => ({ default: m.CodePlanFullscreenModal })));
import { preloadQuestions, saveDraft, submitQuestionnaire, createLocalQuestionnaireResult, readLocalQuestionnaireResult, type Question } from './api/questionnaire';
import {
  attachQuestionnaireResultToUser,
  fetchLatestCompletedResultForUser,
  fetchUserBodyCodeForUser,
  signOutAccount,
  upsertProfileFromUser,
} from './api/account';
import { getSessionWithFallback, getStoredSupabaseSession } from './lib/authSession';
import { supabase } from './lib/supabase';
import type { AnswerMap } from './utils/bodyCodeCalculator';

const SESSION_LAST_RESULT_KEY = 'mebody:sessionResultId';

type Screen =
  | 'landing'
  | 'consent'
  | 'intro'
  | 'questionnaire'
  | 'analyzing'
  | 'result'
  | 'codePlan'
  | 'guideCommon'
  | 'guideDetails'
  | 'auth'
  | 'membership'
  | 'checkout'
  | 'myPage';

type ResultEntrySource = 'questionnaire' | 'quick' | 'shared';
type ResultSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';
type PendingAnalysis = {
  answers: AnswerMap;
  questions: Question[];
  questionnaireId?: string;
} | null;

const MIN_ANALYSIS_VISIBLE_MS = 800;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const previewScreenParam = new URLSearchParams(window.location.search).get('ui');
  const previewScreen = (['landing', 'auth', 'myPage', 'codePlan'] as const).find((screen) => screen === previewScreenParam);
  const [currentScreen, setCurrentScreen] = useState<Screen>(previewScreen ?? 'landing');
  const [questionnaireId, setQuestionnaireId] = useState<string | undefined>();
  const [bodyCode, setBodyCode] = useState<string | undefined>();
  const sharedResultIdParam = new URLSearchParams(window.location.search).get('result');
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return getStoredSupabaseSession()?.user ?? null;
  });
  const [latestResultId, setLatestResultId] = useState<string | undefined>();
  const [selectedPlanCode, setSelectedPlanCode] = useState('pro_monthly');
  const [resultEntrySource, setResultEntrySource] = useState<ResultEntrySource>('questionnaire');
  const [resultSaveStatus, setResultSaveStatus] = useState<ResultSaveStatus>('idle');
  const [isBootstrapping, setIsBootstrapping] = useState(!previewScreen && !!sharedResultIdParam);
  const [authReturnScreen, setAuthReturnScreen] = useState<Screen>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signin');
  const [membershipReturnScreen, setMembershipReturnScreen] = useState<Screen>('landing');
  const [myPagePreviewMode, setMyPagePreviewMode] = useState(false);
  const [landingCodePlanModalOpen, setLandingCodePlanModalOpen] = useState(false);
  const [codePlanPreviewMode, setCodePlanPreviewMode] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<PendingAnalysis>(null);
  const mountedRef = useRef(true);
  const questionnaireIdRef = useRef<string | undefined>();
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');

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
    setLatestResultId(undefined);
    setQuestionnaireId(undefined);
    setBodyCode(undefined);
    setResultEntrySource('questionnaire');
    setResultSaveStatus('idle');
    setLandingCodePlanModalOpen(false);
    setCodePlanPreviewMode(false);
    setMyPagePreviewMode(false);
    setPendingAnalysis(null);
    if (clearSession) {
      sessionStorage.removeItem(SESSION_LAST_RESULT_KEY);
    }
    setCurrentScreen('landing');
  };

  const openAuth = (returnScreen: Screen, mode: 'signin' | 'signup' = 'signin') => {
    setMyPagePreviewMode(false);
    setLandingCodePlanModalOpen(false);
    setCodePlanPreviewMode(false);
    setPendingAnalysis(null);
    setAuthReturnScreen(returnScreen);
    setAuthInitialMode(mode);
    setCurrentScreen('auth');
  };

  const openMembership = (returnScreen: Screen) => {
    setMyPagePreviewMode(false);
    setLandingCodePlanModalOpen(false);
    setCodePlanPreviewMode(false);
    setPendingAnalysis(null);
    setMembershipReturnScreen(returnScreen);
    if (currentUser) {
      setCurrentScreen('membership');
      return;
    }
    openAuth(returnScreen, 'signin');
  };

  const openResultScreen = (id: string, source: ResultEntrySource) => {
    setMyPagePreviewMode(false);
    setLandingCodePlanModalOpen(false);
    setCodePlanPreviewMode(false);
    setPendingAnalysis(null);
    setQuestionnaireId(id);
    setCurrentScreen('result');
    setResultEntrySource(source);
    setResultSaveStatus(currentUser ? 'saved' : 'idle');
    rememberResultForCurrentSession(id);
  };

  const handleQuestionnaireComplete = (answers: AnswerMap, questions: Question[], draftId?: string) => {
    setMyPagePreviewMode(false);
    setLandingCodePlanModalOpen(false);
    setCodePlanPreviewMode(false);
    setPendingAnalysis({ answers, questions, questionnaireId: draftId });
    setResultEntrySource('questionnaire');
    setResultSaveStatus(currentUser ? 'saving' : 'idle');
    setCurrentScreen('analyzing');
  };

  const handleAnalyzePendingAnswers = async () => {
    if (!pendingAnalysis) {
      setCurrentScreen('questionnaire');
      return;
    }

    const startedAt = Date.now();

    // 1. Calculate local result instantly
    const localResult = createLocalQuestionnaireResult(pendingAnalysis.answers, pendingAnalysis.questions);

    // 2. Wait for the exact animation time (0.8s)
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_ANALYSIS_VISIBLE_MS) {
      await wait(MIN_ANALYSIS_VISIBLE_MS - elapsed);
    }

    if (!mountedRef.current) return;

    // 3. Immediately transition to Result Screen with local result
    setMyPagePreviewMode(false);
    setLandingCodePlanModalOpen(false);
    setCodePlanPreviewMode(false);

    setQuestionnaireId(localResult.id);
    setBodyCode(localResult.calculated_code);
    rememberResultForCurrentSession(localResult.id);
    setResultEntrySource('questionnaire');
    setResultSaveStatus('saving');
    setCurrentScreen('result');

    // 4. Perform DB save in the background
    const answers = pendingAnalysis.answers;
    const questions = pendingAnalysis.questions;
    const initialDraftId = pendingAnalysis.questionnaireId;
    setPendingAnalysis(null);

    (async () => {
      try {
        let persistedId = initialDraftId;
        if (!persistedId) {
          const draft = await saveDraft(answers);
          persistedId = String(draft.id);
        }

        let dbResult;
        try {
          dbResult = await submitQuestionnaire(answers, persistedId, questions);
        } catch (firstError) {
          console.warn('First save attempt failed, retrying once...', firstError);
          await wait(1000);
          dbResult = await submitQuestionnaire(answers, persistedId, questions);
        }

        const dbResultId = String(dbResult.id);

        if (currentUser) {
          await attachQuestionnaireResultToUser(dbResultId, currentUser.id);
        }

        if (mountedRef.current) {
          setQuestionnaireId(dbResultId);
          rememberResultForCurrentSession(dbResultId);
          setResultSaveStatus(currentUser ? 'saved' : 'idle');
        }
      } catch (error) {
        console.error('[mebody-error] Background save failed completely after retry:', error);
        if (mountedRef.current) {
          setResultSaveStatus('failed');
        }
      }
    })();
  };

  const handleRestart = () => {
    setMyPagePreviewMode(false);
    setLandingCodePlanModalOpen(false);
    setCodePlanPreviewMode(false);
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

  const handleSignedInRoute = async (user: User) => {
    setCurrentUser(user);
    setMyPagePreviewMode(false);
    setLandingCodePlanModalOpen(false);
    setCodePlanPreviewMode(false);

    const currentQuestionnaireId = questionnaireIdRef.current;

    try {
      await upsertProfileFromUser(user);

      if (currentQuestionnaireId) {
        setResultSaveStatus('saving');
        await attachQuestionnaireResultToUser(currentQuestionnaireId, user.id);
        setQuestionnaireId(currentQuestionnaireId);
        setLatestResultId(currentQuestionnaireId);
        setResultEntrySource('questionnaire');
        setResultSaveStatus('saved');
        setCurrentScreen('codePlan');
        return;
      }

      const latestFromDb = await fetchLatestCompletedResultForUser(user.id);
      if (latestFromDb) {
        setQuestionnaireId(latestFromDb.id);
        setLatestResultId(latestFromDb.id);
        setBodyCode(latestFromDb.calculated_code);
        setResultEntrySource('quick');
        setResultSaveStatus('saved');
        setCurrentScreen('codePlan');
        return;
      }

      const profileCode = await fetchUserBodyCodeForUser(user.id, user.email);
      setQuestionnaireId(undefined);
      setLatestResultId(undefined);
      setBodyCode(profileCode?.body_bti_code);
      setResultEntrySource('questionnaire');
      setResultSaveStatus('idle');
      setCurrentScreen('consent');
    } catch (error) {
      console.warn('handleSignedInRoute failed:', error);
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
      setCurrentScreen(previewScreen);
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

        const { data } = await getSessionWithFallback();
        if (!mountedRef.current) return;

        const user = data.session?.user ?? null;
        setCurrentUser(user);

        if (!user) {
          if (sharedResultId && sessionResultId === sharedResultId) {
            openResultScreen(sharedResultId, 'questionnaire');
            return;
          }
          resetAnonymousState();
          return;
        }

        syncUserInBackground(user);
        refreshLatestResultInBackground(user.id, user.email);

        if (sharedResultId) {
          openResultScreen(sharedResultId, 'shared');
        } else {
          setCurrentScreen('landing');
        }
      } catch (error) {
        console.warn('bootstrap failed:', error);
        setCurrentScreen('landing');
      } finally {
        if (mountedRef.current) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);

      if (!user) {
        resetAnonymousState();
        return;
      }

      try {
        await upsertProfileFromUser(user);
        await attachQuestionnaireResultToUser(questionnaireIdRef.current, user.id);
      } catch (error) {
        console.warn('upsertProfileFromUser(auth) failed:', error);
      }

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
    });

    authUnsubscribe = () => authListener.subscription.unsubscribe();

    return () => {
      mountedRef.current = false;
      authUnsubscribe?.();
    };
  }, [previewScreen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (questionnaireId) {
      params.set('result', questionnaireId);
    } else {
      params.delete('result');
    }
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', nextUrl);
  }, [questionnaireId]);

  const startNewDiagnosis = () => {
    setMyPagePreviewMode(false);
    setLandingCodePlanModalOpen(false);
    setCodePlanPreviewMode(false);
    setQuestionnaireId(undefined);
    setBodyCode(undefined);
    setPendingAnalysis(null);
    setResultEntrySource('questionnaire');
    setResultSaveStatus('idle');
    setCurrentScreen('consent');
  };

  const openQuickResult = () => {
    if (!latestResultId) return;
    openResultScreen(latestResultId, 'quick');
  };

  const openMyPage = () => {
    setMyPagePreviewMode(false);
    setLandingCodePlanModalOpen(false);
    setCodePlanPreviewMode(false);
    if (currentUser) {
      setCurrentScreen('myPage');
      return;
    }
    openAuth('myPage', 'signin');
  };

  const handleLogout = async () => {
    try {
      await signOutAccount();
    } catch (error) {
      console.warn('signOutAccount failed:', error);
    } finally {
      setCurrentUser(null);
      resetAnonymousState(true);
    }
  };

  if (isBootstrapping) {
    return (
      <div className={isDesktopMockup ? "min-h-screen bg-gray-50 flex items-center justify-center p-4" : ""}>
        <div 
          className={isDesktopMockup ? "w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden flex items-center justify-center" : "w-full min-h-screen bg-white flex items-center justify-center"} 
          style={isDesktopMockup ? { height: '844px' } : {}}
        >
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={isDesktopMockup ? "min-h-screen bg-gray-50 flex items-center justify-center p-4" : ""}>
      <div className={isDesktopMockup ? "w-full max-w-md relative" : "w-full min-h-screen relative"}>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-gray-400">화면을 불러오는 중...</div>
          </div>
        }>
          {currentScreen === 'landing' && (
            <LandingScreen
              onStart={startNewDiagnosis}
              onQuickResult={currentUser && latestResultId ? () => setLandingCodePlanModalOpen(true) : undefined}
              hasQuickResult={Boolean(currentUser && latestResultId)}
              isLoggedIn={Boolean(currentUser)}
              userEmail={currentUser?.email}
              userDisplayName={
                typeof currentUser?.user_metadata?.display_name === 'string'
                  ? currentUser.user_metadata.display_name
                  : undefined
              }
              latestBodyCode={bodyCode}
              onAccount={currentUser ? openMyPage : () => openAuth('consent')}
              onPreviewSignedIn={() => {
                setMyPagePreviewMode(true);
                setCurrentScreen('myPage');
              }}
            />
          )}

          {currentScreen === 'consent' && <ConsentScreen onBack={() => setCurrentScreen('landing')} onAgree={() => setCurrentScreen('intro')} />}

          {currentScreen === 'intro' && <DiagnosisIntroScreen onBack={() => setCurrentScreen('consent')} onBegin={() => setCurrentScreen('questionnaire')} />}

          {currentScreen === 'questionnaire' && (
            <QuestionnaireScreen
              onBack={() => setCurrentScreen('intro')}
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

          {currentScreen === 'result' && (
            <ResultScreen
              questionnaireId={questionnaireId}
              onRestart={handleRestart}
              onBack={() => setCurrentScreen(resultEntrySource === 'questionnaire' ? 'questionnaire' : 'landing')}
              onResultLoad={handleResultLoad}
              isLoggedIn={Boolean(currentUser)}
              isAdmin={Boolean(currentUser?.email && ['chldngur89@gmail.com'].includes(currentUser.email))}
              resultSaveStatus={resultSaveStatus}
              onGoAuth={() => openAuth('codePlan')}
              onContinue={() => {
                setCodePlanPreviewMode(false);
                setCurrentScreen('codePlan');
              }}
              onPreviewContinue={() => {
                setCodePlanPreviewMode(true);
                setCurrentScreen('codePlan');
              }}
            />
          )}

          {currentScreen === 'codePlan' && (
            <CodePlanScreen
              questionnaireId={questionnaireId}
              isLoggedIn={Boolean(currentUser)}
              previewMode={codePlanPreviewMode}
              onBack={() => setCurrentScreen('result')}
              onRequireAuth={() => openAuth('codePlan')}
              onNextGuide={() => setCurrentScreen('guideCommon')}
            />
          )}

          {currentScreen === 'guideCommon' && (
            <CommonGuideScreen onBack={() => setCurrentScreen('codePlan')} onNext={() => setCurrentScreen('guideDetails')} />
          )}

          {currentScreen === 'guideDetails' && (
            <CodeDetailsScreen
              questionnaireId={questionnaireId}
              bodyCode={bodyCode}
              onBack={() => setCurrentScreen('guideCommon')}
              onDone={() => setCurrentScreen('codePlan')}
            />
          )}

          {currentScreen === 'myPage' && (
            <MyPageScreen
              user={currentUser}
              latestResultId={latestResultId}
              previewMode={myPagePreviewMode}
              onBack={() => {
                setMyPagePreviewMode(false);
                setCurrentScreen('landing');
              }}
              onOpenLatestResult={latestResultId ? openQuickResult : undefined}
              onOpenMembership={() => openMembership('myPage')}
              onStartDiagnosis={startNewDiagnosis}
              onRequireAuth={() => openAuth('myPage')}
              onLatestResultResolved={(resultId) => setLatestResultId(resultId)}
              onLogout={handleLogout}
            />
          )}

          {currentScreen === 'auth' && (
            <AuthScreen
              user={currentUser}
              initialMode={authInitialMode}
              onBack={() => setCurrentScreen(authReturnScreen)}
              onSignedIn={handleSignedInRoute}
              onGoMembership={() => openMembership(authReturnScreen)}
            />
          )}

          {currentScreen === 'membership' && (
            <MembershipScreen
              user={currentUser}
              onBack={() => setCurrentScreen(membershipReturnScreen)}
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
              onBack={() => setCurrentScreen('membership')}
              onRequireAuth={() => openAuth('checkout')}
              onComplete={() => setCurrentScreen('membership')}
            />
          )}

          {currentScreen === 'landing' && landingCodePlanModalOpen && currentUser && latestResultId && (
            <CodePlanFullscreenModal questionnaireId={latestResultId} onClose={() => setLandingCodePlanModalOpen(false)} />
          )}
        </Suspense>
      </div>
    </div>
  );
}
