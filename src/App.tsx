import { useState } from 'react';
import { LandingScreen } from './components/LandingScreen';
import { DiagnosisIntroScreen } from './components/DiagnosisIntroScreen';
import { QuestionnaireScreen } from './components/QuestionnaireScreen';
import { AnalyzingScreen } from './components/AnalyzingScreen';
import { ResultScreen } from './components/ResultScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'intro' | 'questionnaire' | 'analyzing' | 'result'>('landing');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {currentScreen === 'landing' && (
          <LandingScreen onStart={() => setCurrentScreen('intro')} />
        )}
        {currentScreen === 'intro' && (
          <DiagnosisIntroScreen onBegin={() => setCurrentScreen('questionnaire')} />
        )}
        {currentScreen === 'questionnaire' && (
          <QuestionnaireScreen onComplete={() => setCurrentScreen('analyzing')} />
        )}
        {currentScreen === 'analyzing' && (
          <AnalyzingScreen onComplete={() => setCurrentScreen('result')} />
        )}
        {currentScreen === 'result' && (
          <ResultScreen />
        )}
      </div>
      
      {/* Screen Navigation (for demo purposes) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-full px-4 py-2 shadow-lg flex gap-2 text-xs">
        <button onClick={() => setCurrentScreen('landing')} className={`px-3 py-1 rounded-full ${currentScreen === 'landing' ? 'bg-emerald-500 text-white' : 'text-gray-600'}`}>1</button>
        <button onClick={() => setCurrentScreen('intro')} className={`px-3 py-1 rounded-full ${currentScreen === 'intro' ? 'bg-emerald-500 text-white' : 'text-gray-600'}`}>2</button>
        <button onClick={() => setCurrentScreen('questionnaire')} className={`px-3 py-1 rounded-full ${currentScreen === 'questionnaire' ? 'bg-emerald-500 text-white' : 'text-gray-600'}`}>3</button>
        <button onClick={() => setCurrentScreen('analyzing')} className={`px-3 py-1 rounded-full ${currentScreen === 'analyzing' ? 'bg-emerald-500 text-white' : 'text-gray-600'}`}>4</button>
        <button onClick={() => setCurrentScreen('result')} className={`px-3 py-1 rounded-full ${currentScreen === 'result' ? 'bg-emerald-500 text-white' : 'text-gray-600'}`}>5</button>
      </div>
    </div>
  );
}
