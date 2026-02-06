import { useState, useEffect, useCallback, useRef } from 'react';
import { Check } from 'lucide-react';
import { fetchQuestions, saveDraft, submitQuestionnaire } from '../api/questionnaire';
import type { Question } from '../api/questionnaire';

interface QuestionnaireScreenProps {
  onComplete: (questionnaireId: string, code: string) => void;
}
 
export function QuestionnaireScreen({ onComplete }: QuestionnaireScreenProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [questionnaireId, setQuestionnaireId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const totalQuestions = 40;
  const progress = ((currentQuestion - 1) / totalQuestions) * 100;
 
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    async function loadQuestions() {
      try {
        const data = await fetchQuestions();
        setQuestions(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load questions:', error);
        setIsLoading(false);
      }
    }
    loadQuestions();
  }, []);

  const currentQuestionData = questions.find(q => q.question_number === currentQuestion);

  const saveDraftDebounced = useCallback(async (newAnswers: Record<number, string>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await saveDraft(newAnswers, questionnaireId);
        if (!questionnaireId) {
          setQuestionnaireId(result.id);
        }
      } catch (error) {
        console.error('Failed to save draft:', error);
      }
    }, 3000);
  }, [questionnaireId]);

  const handleAnswer = useCallback(async (answer: string) => {
    const newAnswers = { ...answers, [currentQuestion]: answer };
    setAnswers(newAnswers);
    saveDraftDebounced(newAnswers);

    if (currentQuestion < totalQuestions) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      try {
        const result = await submitQuestionnaire(newAnswers);
        onComplete(result.id, result.calculated_code);
      } catch (error) {
        console.error('Failed to submit questionnaire:', error);
      }
    }
  }, [currentQuestion, answers, saveDraftDebounced, onComplete]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex items-center justify-center" style={{ height: '844px' }}>
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!currentQuestionData) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex items-center justify-center" style={{ height: '844px' }}>
        <div className="text-gray-500">질문을 찾을 수 없습니다</div>
      </div>
    );
  }

  const axisLabels: Record<string, string> = {
    neck: '목 위치 측정',
    shoulder: '어깨 높이 측정',
    pelvis: '골반 회전 측정',
    flexibility: '하체 유연성 측정'
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
            <span className="text-sm text-gray-500">{axisLabels[currentQuestionData.axis] || ''}</span>
          </div>
        
          {/* Question Text */}
          <h2 className="text-2xl font-bold text-gray-900 mb-12 leading-relaxed">
            {currentQuestionData.question_text}
          </h2>
        
          {/* Answer Options */}
          <div className="space-y-4">
            <button
              onClick={() => handleAnswer('①')}
              className="w-full bg-white border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 py-6 rounded-2xl font-semibold text-lg text-gray-900 transition-all active:scale-95 flex items-center justify-between px-6 group"
            >
              <span>{currentQuestionData.option_1}</span>
              <div className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-emerald-500 group-hover:bg-emerald-500 flex items-center justify-center transition-all">
                <Check className="w-5 h-5 text-transparent group-hover:text-white transition-colors" />
              </div>
            </button>
        
            <button
              onClick={() => handleAnswer('②')}
              className="w-full bg-white border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 py-6 rounded-2xl font-semibold text-lg text-gray-600 transition-all active:scale-95 flex items-center justify-between px-6 group"
            >
              <span>{currentQuestionData.option_2}</span>
              <div className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-gray-400 flex items-center justify-center transition-all">
                <Check className="w-5 h-5 text-transparent transition-colors" />
              </div>
            </button>
        
            <button
              onClick={() => handleAnswer('③')}
              className="w-full bg-white border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 py-6 rounded-2xl font-semibold text-lg text-gray-900 transition-all active:scale-95 flex items-center justify-between px-6 group"
            >
              <span>{currentQuestionData.option_3}</span>
              <div className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-emerald-500 group-hover:bg-emerald-500 flex items-center justify-center transition-all">
                <Check className="w-5 h-5 text-transparent group-hover:text-white transition-colors" />
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
