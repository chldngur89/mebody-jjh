import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ArrowLeft } from 'lucide-react';
import { fetchQuestions, saveDraft, submitQuestionnaire } from '../api/questionnaire';
import type { Question } from '../api/questionnaire';
import { QuestionPlaceholderImage } from './QuestionPlaceholderImage';
import { AXIS_ICON_SRC } from '../data/axisIcons';

interface QuestionnaireScreenProps {
  onBack?: () => void;
  onComplete: (questionnaireId: string, code: string) => void;
}
 
export function QuestionnaireScreen({ onBack, onComplete }: QuestionnaireScreenProps) {
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
    neck: '1축 목 (F/C)',
    shoulder: '2축 어깨 (R/L)',
    pelvis: '3축 골반 (R/L)',
    flexibility: '4축 하체 (S/F)',
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full flex flex-col">
        
        {/* Progress Header */}
        <div className="px-6 pt-8 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-600" />
                </button>
              )}
              <span className="text-sm font-medium text-gray-600">
                질문 {currentQuestion} / {totalQuestions}
              </span>
            </div>
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
        <div className="flex-1 px-6 flex flex-col justify-center overflow-y-auto">
          {/* Question Number + Axis (Ver2 축 아이콘) */}
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-600 font-semibold">{currentQuestion}</span>
            </div>
            <img
              src={AXIS_ICON_SRC[currentQuestionData.axis]}
              alt=""
              className="w-10 h-10 object-contain flex-shrink-0"
            />
            <span className="text-sm text-gray-500">{axisLabels[currentQuestionData.axis] || ''}</span>
          </div>

          {/* 문항별 placeholder 이미지 (Ver2) */}
          <div className="mb-4">
            <QuestionPlaceholderImage
              questionNumber={currentQuestion}
              axis={currentQuestionData.axis}
              className="w-full aspect-video"
            />
          </div>
        
          {/* Question Text */}
          <h2 className="text-xl font-bold text-gray-900 mb-8 leading-relaxed whitespace-pre-line">
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

            {/* 3번째 버튼 아래: 이전 질문(왼쪽 정렬) / 1번째면 진단 소개로 */}
            {onBack && (
              <div className="mt-6 flex justify-start">
                <button
                  type="button"
                  onClick={currentQuestion > 1 ? () => setCurrentQuestion((q) => q - 1) : onBack}
                  className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors text-sm font-medium"
                >
                  <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                  {currentQuestion > 1 ? '이전 질문' : '진단 소개로'}
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom Space */}
        <div className="pb-8"></div>
      </div>
    </div>
  );
}
