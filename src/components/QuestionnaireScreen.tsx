import { useState } from 'react';
import { Check } from 'lucide-react';

interface QuestionnaireScreenProps {
  onComplete: () => void;
}

export function QuestionnaireScreen({ onComplete }: QuestionnaireScreenProps) {
  const [currentQuestion, setCurrentQuestion] = useState(12);
  const totalQuestions = 40;
  const progress = (currentQuestion / totalQuestions) * 100;

  const questions = [
    "거울을 볼 때 왼쪽 어깨가 오른쪽보다 높습니까?",
    "앉아 있을 때 자주 한쪽으로 기울어집니까?",
    "서 있을 때 목이 앞으로 나와 있습니까?"
  ];

  const handleAnswer = (answer: string) => {
    if (currentQuestion < totalQuestions) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setTimeout(onComplete, 300);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full flex flex-col">
        
        {/* Progress Header */}
        <div className="px-6 pt-8 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">
              질문 {currentQuestion} / {totalQuestions}
            </span>
            <span className="text-sm font-semibold text-emerald-600">
              {Math.round(progress)}%
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Question Content */}
        <div className="flex-1 px-6 flex flex-col justify-center">
          {/* Question Number Badge */}
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <span className="text-emerald-600 font-semibold">{currentQuestion}</span>
            </div>
            <span className="text-sm text-gray-500">목 위치 측정</span>
          </div>

          {/* Question Text */}
          <h2 className="text-2xl font-bold text-gray-900 mb-12 leading-relaxed">
            {questions[0]}
          </h2>

          {/* Answer Options */}
          <div className="space-y-4">
            <button
              onClick={() => handleAnswer('yes')}
              className="w-full bg-white border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 py-6 rounded-2xl font-semibold text-lg text-gray-900 transition-all active:scale-95 flex items-center justify-between px-6 group"
            >
              <span>네, 그렇습니다</span>
              <div className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-emerald-500 group-hover:bg-emerald-500 flex items-center justify-center transition-all">
                <Check className="w-5 h-5 text-transparent group-hover:text-white transition-colors" />
              </div>
            </button>

            <button
              onClick={() => handleAnswer('no')}
              className="w-full bg-white border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 py-6 rounded-2xl font-semibold text-lg text-gray-900 transition-all active:scale-95 flex items-center justify-between px-6 group"
            >
              <span>아니오, 그렇지 않습니다</span>
              <div className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-emerald-500 group-hover:bg-emerald-500 flex items-center justify-center transition-all">
                <Check className="w-5 h-5 text-transparent group-hover:text-white transition-colors" />
              </div>
            </button>

            <button
              onClick={() => handleAnswer('unsure')}
              className="w-full bg-white border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 py-6 rounded-2xl font-semibold text-lg text-gray-600 transition-all active:scale-95 flex items-center justify-between px-6 group"
            >
              <span>잘 모르겠습니다</span>
              <div className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-gray-400 flex items-center justify-center transition-all">
                <Check className="w-5 h-5 text-transparent transition-colors" />
              </div>
            </button>
          </div>
        </div>

        {/* Bottom Space */}
        <div className="pb-8"></div>
      </div>
    </div>
  );
}
