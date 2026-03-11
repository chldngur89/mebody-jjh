import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { LandingScreen } from './components/LandingScreen';
import { ConsentScreen } from './components/ConsentScreen';
import { DiagnosisIntroScreen } from './components/DiagnosisIntroScreen';
import { QuestionnaireScreen } from './components/QuestionnaireScreen';
import { AnalyzingScreen } from './components/AnalyzingScreen';
import { ResultScreen } from './components/ResultScreen';
import { ResultGuideScreen } from './components/ResultGuideScreen';
import { BodyCodeAccordionScreen } from './components/BodyCodeAccordionScreen';
import { AuthScreen } from './components/AuthScreen';
import { MembershipScreen } from './components/MembershipScreen';
import { CheckoutScreen } from './components/CheckoutScreen';
import { AdvancedPreviewScreen } from './components/AdvancedPreviewScreen';
import { fetchLatestCompletedResultIdForUser, upsertProfileFromUser } from './api/account';
import { supabase } from './lib/supabase';

const LOCAL_LAST_RESULT_KEY = 'mebody:lastResultId';

type Screen =
  | 'landing'
  | 'consent'
  | 'intro'
  | 'questionnaire'
  | 'analyzing'
  | 'result'
  | 'resultGuide'
  | 'resultAccordion'
  | 'advanced'
  | 'auth'
  | 'membership'
  | 'checkout';

type ResultEntrySource = 'questionnaire' | 'quick' | 'shared';

export default function App() {
   const previewScreenParam = new URLSearchParams(window.location.search).get('ui');
   const previewScreen = (['landing', 'auth', 'advanced'] as const).find((screen) => screen === previewScreenParam);
   const [currentScreen, setCurrentScreen] = useState<Screen>(previewScreen ?? 'landing');
   const [questionnaireId, setQuestionnaireId] = useState<string | undefined>();
   const [bodyCode, setBodyCode] = useState<string | undefined>();
   const [currentUser, setCurrentUser] = useState<User | null>(null);
   const [latestResultId, setLatestResultId] = useState<string | undefined>();
   const [selectedPlanCode, setSelectedPlanCode] = useState('pro_monthly');
   const [resultEntrySource, setResultEntrySource] = useState<ResultEntrySource>('quick');
   const [isBootstrapping, setIsBootstrapping] = useState(!previewScreen);
   const [authReturnScreen, setAuthReturnScreen] = useState<Screen>('landing');
   const mountedRef = useRef(true);

   const openAuth = (returnScreen: Screen) => {
     setAuthReturnScreen(returnScreen);
     setCurrentScreen('auth');
   };

   const openResultScreen = (id: string, source: ResultEntrySource) => {
     setQuestionnaireId(id);
     setCurrentScreen('result');
     setResultEntrySource(source);
     setLatestResultId(id);
     localStorage.setItem(LOCAL_LAST_RESULT_KEY, id);
   };

   const handleQuestionnaireComplete = (id: string, code: string) => {
     setQuestionnaireId(id);
     setBodyCode(code);
     setLatestResultId(id);
     setResultEntrySource('questionnaire');
     localStorage.setItem(LOCAL_LAST_RESULT_KEY, id);
     setCurrentScreen('analyzing');
   };

   const handleAnalyzingComplete = () => {
     setCurrentScreen('result');
   };

   const handleRestart = () => {
     setQuestionnaireId(undefined);
     setBodyCode(undefined);
     setResultEntrySource('questionnaire');
     setCurrentScreen('questionnaire');
   };

   const handleResultLoad = (code: string) => {
     setBodyCode(code);
   };

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
         const localResultId = localStorage.getItem(LOCAL_LAST_RESULT_KEY) ?? undefined;

         const { data } = await supabase.auth.getSession();
         if (!mountedRef.current) return;

         const user = data.session?.user ?? null;
         setCurrentUser(user);

         if (user) {
           try {
             await upsertProfileFromUser(user);
           } catch (error) {
             console.warn('upsertProfileFromUser failed:', error);
           }
         }

         let resolvedLatestResultId = localResultId;
         if (user) {
           const latestFromDb = await fetchLatestCompletedResultIdForUser(user.id);
           if (!mountedRef.current) return;
           if (latestFromDb) {
             resolvedLatestResultId = latestFromDb;
             localStorage.setItem(LOCAL_LAST_RESULT_KEY, latestFromDb);
           }
         }

         setLatestResultId(resolvedLatestResultId);

         if (sharedResultId) {
           openResultScreen(sharedResultId, 'shared');
         } else if (resolvedLatestResultId) {
           openResultScreen(resolvedLatestResultId, 'quick');
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

       if (!user) return;
       try {
         await upsertProfileFromUser(user);
       } catch (error) {
         console.warn('upsertProfileFromUser(auth) failed:', error);
       }

       const latestFromDb = await fetchLatestCompletedResultIdForUser(user.id);
       if (!mountedRef.current) return;
       if (latestFromDb) {
         setLatestResultId(latestFromDb);
         localStorage.setItem(LOCAL_LAST_RESULT_KEY, latestFromDb);
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
    setQuestionnaireId(undefined);
    setBodyCode(undefined);
    setResultEntrySource('questionnaire');
    setCurrentScreen('consent');
  };

  const openQuickResult = () => {
    if (!latestResultId) return;
    openResultScreen(latestResultId, 'quick');
  };

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden flex items-center justify-center" style={{ height: '844px' }}>
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
     <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
       <div className="w-full max-w-md">
         {currentScreen === 'landing' && (
           <LandingScreen
             onStart={startNewDiagnosis}
             onQuickResult={latestResultId ? openQuickResult : undefined}
             hasQuickResult={Boolean(latestResultId)}
             isLoggedIn={Boolean(currentUser)}
             userEmail={currentUser?.email}
             onAccount={() => openAuth('landing')}
             onMembership={() => setCurrentScreen(currentUser ? 'membership' : 'auth')}
           />
         )}
         {currentScreen === 'consent' && (
           <ConsentScreen
             onBack={() => setCurrentScreen('landing')}
             onAgree={() => setCurrentScreen('intro')}
           />
         )}
         {currentScreen === 'intro' && (
           <DiagnosisIntroScreen
             onBack={() => setCurrentScreen('consent')}
             onBegin={() => setCurrentScreen('questionnaire')}
           />
         )}
         {currentScreen === 'questionnaire' && (
           <QuestionnaireScreen
             onBack={() => setCurrentScreen('intro')}
             onComplete={handleQuestionnaireComplete}
           />
         )}
         {currentScreen === 'analyzing' && (
           <AnalyzingScreen
             onBack={() => setCurrentScreen('questionnaire')}
             onComplete={handleAnalyzingComplete}
           />
         )}
         {currentScreen === 'result' && (
           <ResultScreen
             questionnaireId={questionnaireId}
             onRestart={handleRestart}
             onBack={() => setCurrentScreen(resultEntrySource === 'questionnaire' ? 'questionnaire' : 'landing')}
             onNextPage={() => setCurrentScreen('resultGuide')}
             onResultLoad={handleResultLoad}
             isLoggedIn={Boolean(currentUser)}
             onGoAuth={() => openAuth('result')}
             onGoMembership={() => setCurrentScreen(currentUser ? 'membership' : 'auth')}
             onGoDeepDive={() => (currentUser ? setCurrentScreen('advanced') : openAuth('advanced'))}
           />
         )}
         {currentScreen === 'resultGuide' && (
           <ResultGuideScreen
             bodyCode={bodyCode}
             onBack={() => setCurrentScreen('result')}
             onNextPage={() => setCurrentScreen('resultAccordion')}
           />
         )}
         {currentScreen === 'resultAccordion' && (
           <BodyCodeAccordionScreen
             bodyCode={bodyCode}
             onBack={() => setCurrentScreen('resultGuide')}
             onLearnMore={() => setCurrentScreen('advanced')}
           />
         )}
         {currentScreen === 'advanced' && (
           <AdvancedPreviewScreen
             questionnaireId={questionnaireId}
             isLoggedIn={Boolean(currentUser)}
             onBack={() => setCurrentScreen('result')}
             onGoMembership={() => setCurrentScreen(currentUser ? 'membership' : 'auth')}
             onGoAuth={() => openAuth('advanced')}
           />
         )}
         {currentScreen === 'auth' && (
           <AuthScreen
             user={currentUser}
             onBack={() => setCurrentScreen(authReturnScreen)}
             onSignedIn={() => setCurrentScreen(authReturnScreen)}
             onGoMembership={() => setCurrentScreen('membership')}
           />
         )}
         {currentScreen === 'membership' && (
           <MembershipScreen
             user={currentUser}
             onBack={() => setCurrentScreen('landing')}
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
       </div>
     </div>
   );
  }
