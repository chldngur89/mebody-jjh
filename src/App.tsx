import { useState } from 'react';
import { LandingScreen } from './components/LandingScreen';
import { ConsentScreen } from './components/ConsentScreen';
import { DiagnosisIntroScreen } from './components/DiagnosisIntroScreen';
import { QuestionnaireScreen } from './components/QuestionnaireScreen';
import { AnalyzingScreen } from './components/AnalyzingScreen';
import { ResultScreen } from './components/ResultScreen';
import { ResultGuideScreen } from './components/ResultGuideScreen';
import { NextPageScreen } from './components/NextPageScreen';

type Screen = 'landing' | 'consent' | 'intro' | 'questionnaire' | 'analyzing' | 'result' | 'resultGuide' | 'resultGuide2' | 'advanced';

export default function App() {
   const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
   const [questionnaireId, setQuestionnaireId] = useState<string | undefined>();
   const [bodyCode, setBodyCode] = useState<string | undefined>();

   const handleQuestionnaireComplete = (id: string, code: string) => {
     setQuestionnaireId(id);
     setCurrentScreen('analyzing');
   };

   const handleAnalyzingComplete = () => {
     setCurrentScreen('result');
   };

   const handleRestart = () => {
     setQuestionnaireId(undefined);
     setBodyCode(undefined);
     setCurrentScreen('questionnaire');
   };

   const handleResultLoad = (code: string) => {
     setBodyCode(code);
   };

  return (
     <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
       <div className="w-full max-w-md">
         {currentScreen === 'landing' && (
           <LandingScreen onStart={() => setCurrentScreen('consent')} />
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
             onBack={() => setCurrentScreen('questionnaire')}
             onNextPage={() => setCurrentScreen('resultGuide')}
             onResultLoad={handleResultLoad}
           />
         )}
         {currentScreen === 'resultGuide' && (
           <ResultGuideScreen
             bodyCode={bodyCode}
             onBack={() => setCurrentScreen('result')}
             onNextPage={() => setCurrentScreen('resultGuide2')}
           />
         )}
         {currentScreen === 'resultGuide2' && (
           <NextPageScreen
             bodyCode={bodyCode}
             onBack={() => setCurrentScreen('resultGuide')}
             onLearnMore={() => setCurrentScreen('advanced')}
           />
         )}
         {currentScreen === 'advanced' && (
           <div className="bg-gradient-to-b from-gray-50 to-white rounded-3xl shadow-xl overflow-hidden flex flex-col items-center justify-center px-6" style={{ height: '844px' }}>
             <p className="text-gray-600 mb-6 text-center">심화 버전 (태그 분석·루틴 우선순위)은 MVP·파일럿 테스트 후 제공 예정입니다.</p>
             <button
               type="button"
               onClick={() => setCurrentScreen('resultGuide2')}
               className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-200"
             >
               맞춤 가이드로 돌아가기
             </button>
           </div>
         )}
       </div>
     </div>
   );
}
