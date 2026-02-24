import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LandingScreen } from './components/LandingScreen';
import { ConsentScreen } from './components/ConsentScreen';
import { DiagnosisIntroScreen } from './components/DiagnosisIntroScreen';
import { QuestionnaireScreen } from './components/QuestionnaireScreen';
import { AnalyzingScreen } from './components/AnalyzingScreen';
import { ResultScreen } from './components/ResultScreen';
import { ResultGuideScreen } from './components/ResultGuideScreen';

type Screen = 'landing' | 'consent' | 'intro' | 'questionnaire' | 'analyzing' | 'result' | 'resultGuide' | 'resultGuide2';

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
           <div className="bg-gradient-to-b from-gray-50 to-white rounded-3xl shadow-xl overflow-hidden flex flex-col" style={{ height: '844px' }}>
             <div className="flex-shrink-0 bg-white/80 backdrop-blur-lg border-b border-emerald-100 px-6 py-4 flex items-center gap-3">
               <button
                 type="button"
                 onClick={() => setCurrentScreen('resultGuide')}
                 className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
               >
                 <ArrowLeft className="w-4 h-4 text-gray-600" />
               </button>
               <h1 className="text-lg font-bold text-gray-900">다음</h1>
             </div>
             <div className="flex-1 flex flex-col items-center justify-center text-gray-500 px-6">
               <p className="text-sm">다음 콘텐츠 준비 중입니다.</p>
               <button
                 type="button"
                 onClick={() => setCurrentScreen('resultGuide')}
                 className="mt-4 w-full max-w-xs bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all active:scale-[0.98]"
               >
                 자세 사용 설명서로
               </button>
             </div>
           </div>
         )}
       </div>
     </div>
   );
}
