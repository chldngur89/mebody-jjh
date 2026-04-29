import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ArrowLeft } from 'lucide-react';
import { fetchQuestions, saveDraft, submitQuestionnaire } from '../api/questionnaire';
import type { Question } from '../api/questionnaire';
import { QuestionPlaceholderImage } from './QuestionPlaceholderImage';
import { AXIS_ICON_FALLBACK_SRC, AXIS_ICON_SRC } from '../data/axisIcons';
import type { AxisKey } from '../data/axisIcons';
import type { AnswerMap } from '../utils/bodyCodeCalculator';

interface QuestionnaireScreenProps {
  onBack?: () => void;
  onComplete: (questionnaireId: string, code: string) => void;
}

function stripOptionPrefix(value: string) {
  return value.replace(/^[①②③]\s*/, '').trim();
}

function isUsableOption(value: string) {
  const trimmed = value.trim();
  return Boolean(trimmed) && trimmed !== '-';
}

function splitMultiOptions(value: string) {
  return stripOptionPrefix(value)
    .split(/\s*\/\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function shouldUseCompactMultiGrid(items: string[]) {
  return items.length >= 6 && items.every((item) => item.length <= 9);
}

function getQuestionTitleDisplay(questionText: string, maxSelect?: number) {
  const text = questionText.trim();

  if (text.startsWith('가장 불편함을 느끼는 부위 선택')) {
    return {
      main: '가장 불편함을 느끼는 부위 선택',
      sub: `(최대 ${maxSelect ?? 2}개)`,
    };
  }

  if (text.startsWith('운동 전 안전 확인')) {
    return {
      main: '운동 전 안전 확인',
      sub: '해당하는 것 선택',
    };
  }

  const dashParts = text.split(/\s*[—–]\s*/);
  if (dashParts.length === 2 && dashParts[0] && dashParts[1]) {
    return {
      main: dashParts[0],
      sub: dashParts[1],
    };
  }

  const parenthetical = text.match(/^(.*?)\s*(\([^)]*\))$/);
  if (parenthetical?.[1] && parenthetical?.[2]) {
    return {
      main: parenthetical[1].trim(),
      sub: parenthetical[2].replace(/곳/g, '개'),
    };
  }

  return { main: text, sub: '' };
}

function getDisplayAxis(axis: string): AxisKey | null {
  if (axis === 'neck' || axis === 'shoulder' || axis === 'pelvis' || axis === 'flexibility') return axis;
  if (axis === 'lower_body') return 'flexibility';
  if (axis === 'anterior_pelvic_tilt' || axis === 'posterior_pelvic_tilt') return 'pelvis';
  if (axis === 'sitting_driven' || axis === 'work_dominant') return 'shoulder';
  return null;
}

const axisLabels: Record<string, string> = {
  discomfort_area: '사전체크',
  red_flag: '안전 확인',
  neck: '1축 목 (F/C)',
  shoulder: '2축 어깨 (R/L)',
  pelvis: '3축 골반 (R/L)',
  lower_body: '4축 하체 (S/F)',
  flexibility: '4축 하체 (S/F)',
  anterior_pelvic_tilt: '보조축 전방 경사',
  posterior_pelvic_tilt: '보조축 후방 경사',
  sitting_driven: '생활패턴 좌식',
  work_dominant: '생활패턴 작업',
};

const axisShortLabels: Record<AxisKey, string> = {
  neck: '목',
  shoulder: '어깨',
  pelvis: '골반',
  flexibility: '하체',
};

function AxisIcon({ axis }: { axis: AxisKey }) {
  const [iconSrc, setIconSrc] = useState(AXIS_ICON_SRC[axis]);
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setIconSrc(AXIS_ICON_SRC[axis]);
    setIconFailed(false);
  }, [axis]);

  if (iconFailed) {
    return (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-xs font-black text-emerald-700">
        {axisShortLabels[axis]}
      </div>
    );
  }

  return (
    <img
      src={iconSrc}
      alt=""
      className="h-10 w-10 flex-shrink-0 object-contain"
      onError={() => {
        if (iconSrc !== AXIS_ICON_FALLBACK_SRC[axis]) {
          setIconSrc(AXIS_ICON_FALLBACK_SRC[axis]);
          return;
        }
        setIconFailed(true);
      }}
    />
  );
}
 
export function QuestionnaireScreen({ onBack, onComplete }: QuestionnaireScreenProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [questionnaireId, setQuestionnaireId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSkipping, setIsSkipping] = useState(false);

  const totalQuestions = questions.length || 53;
  const progress = questions.length ? (currentIndex / totalQuestions) * 100 : 0;
 
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

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const currentQuestionData = questions[currentIndex];

  const saveDraftDebounced = useCallback(async (newAnswers: AnswerMap) => {
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

  const completeOrAdvance = useCallback(async (newAnswers: AnswerMap) => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    try {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      let persistedId = questionnaireId;
      if (!persistedId) {
        const draft = await saveDraft(newAnswers);
        persistedId = draft.id;
        setQuestionnaireId(draft.id);
      }
      const result = await submitQuestionnaire(newAnswers, persistedId, questions);
      onComplete(result.id, result.calculated_code);
    } catch (error) {
      console.error('Failed to submit questionnaire:', error);
    }
  }, [currentIndex, onComplete, questionnaireId, questions, totalQuestions]);

  const handleSingleAnswer = useCallback(async (answer: string) => {
    if (!currentQuestionData) return;
    const newAnswers = { ...answers, [currentQuestionData.question_code]: answer };
    setAnswers(newAnswers);
    saveDraftDebounced(newAnswers);
    await completeOrAdvance(newAnswers);
  }, [answers, completeOrAdvance, currentQuestionData, saveDraftDebounced]);

  const handleMultiToggle = useCallback((item: string, exclusive = false) => {
    if (!currentQuestionData) return;
    const key = currentQuestionData.question_code;
    const current = Array.isArray(answers[key]) ? answers[key] as string[] : [];
    const maxSelect = currentQuestionData.max_select ?? 2;
    const option2Text = stripOptionPrefix(currentQuestionData.option_2);
    let next: string[];

    if (exclusive) {
      next = current.includes(item) ? [] : [item];
    } else {
      const withoutExclusive = current.filter((value) => value !== option2Text);
      next = withoutExclusive.includes(item)
        ? withoutExclusive.filter((value) => value !== item)
        : [...withoutExclusive, item].slice(0, maxSelect);
    }

    const newAnswers = { ...answers, [key]: next };
    setAnswers(newAnswers);
    saveDraftDebounced(newAnswers);
  }, [answers, currentQuestionData, saveDraftDebounced]);

  const handleSubmitMulti = useCallback(async () => {
    if (!currentQuestionData) return;
    const key = currentQuestionData.question_code;
    const current = Array.isArray(answers[key]) ? answers[key] as string[] : [];
    if (current.length === 0) return;
    await completeOrAdvance(answers);
  }, [answers, completeOrAdvance, currentQuestionData]);

  const handleSkipToResult = useCallback(async () => {
    if (!questions.length || isSkipping) return;
    setIsSkipping(true);

    try {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      const skipAnswers = questions.reduce<AnswerMap>((acc, q) => {
        const existing = answers[q.question_code];
        acc[q.question_code] = existing ?? (q.answer_type === 'multi' ? [stripOptionPrefix(q.option_2)] : '②');
        return acc;
      }, {});
      setAnswers(skipAnswers);

      let persistedId = questionnaireId;
      if (!persistedId) {
        const draft = await saveDraft(skipAnswers);
        persistedId = draft.id;
        setQuestionnaireId(draft.id);
      }
      const result = await submitQuestionnaire(skipAnswers, persistedId, questions);
      onComplete(result.id, result.calculated_code);
    } catch (error) {
      console.error('Failed to skip and submit questionnaire:', error);
    } finally {
      setIsSkipping(false);
    }
  }, [answers, isSkipping, onComplete, questionnaireId, questions]);

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

  const displayNumber = currentQuestionData.question_number ?? currentIndex + 1;
  const displayCode = currentQuestionData.question_code || String(displayNumber);
  const displayAxis = getDisplayAxis(currentQuestionData.axis);
  const axisLabel = axisLabels[currentQuestionData.axis] || '체형 체크';
  const isMulti = currentQuestionData.answer_type === 'multi';
  const selectedMultiAnswers = Array.isArray(answers[currentQuestionData.question_code])
    ? answers[currentQuestionData.question_code] as string[]
    : [];
  const multiItems = splitMultiOptions(currentQuestionData.option_1);
  const exclusiveOption = stripOptionPrefix(currentQuestionData.option_2);
  const showOption3 = isUsableOption(currentQuestionData.option_3);
  const useCompactMultiGrid = shouldUseCompactMultiGrid(multiItems);
  const questionTitle = getQuestionTitleDisplay(currentQuestionData.question_text, currentQuestionData.max_select ?? undefined);
  const multiButtonBaseClass = 'w-full rounded-2xl border px-4 py-3 text-center text-sm font-bold leading-relaxed transition-all flex items-center justify-center';
  const multiButtonIdleClass = 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/60';
  const multiButtonSelectedClass = 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm shadow-emerald-100';

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full flex flex-col">
        
        {/* Progress Header */}
        <div className="px-6 pt-7 pb-4">
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
                질문 {currentIndex + 1} / {totalQuestions}
              </span>
            </div>
            <span className="text-sm font-semibold text-emerald-600">
              {Math.round(progress)}%
            </span>
          </div>

          {/* TEMP: 테스트용 53문항 스킵 버튼 (원하면 이 블록만 삭제하면 됩니다) */}
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={handleSkipToResult}
              disabled={isSkipping}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                isSkipping
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              }`}
            >
              {isSkipping ? '결과 생성 중...' : '53문항 건너뛰고 결과 보기'}
            </button>
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
        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-1">
          {/* Question Number + Axis */}
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-600 font-semibold">{displayCode}</span>
            </div>
            {displayAxis && <AxisIcon axis={displayAxis} />}
            <span className="text-sm text-gray-500">{axisLabel}</span>
          </div>

          {currentQuestionData.is_precheck ? (
            <div
              className="mb-5 rounded-2xl border border-emerald-100 px-5 py-4"
              style={{
                background: 'linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(255,255,255,0.98) 100%)',
                boxShadow: '0 12px 28px rgba(16, 185, 129, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                  aria-hidden
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 14,
                    background: '#d1fae5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  i
                </div>
                <div style={{ minWidth: 0 }}>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">PRE CHECK</p>
                  <p
                    className="mt-1 text-sm text-gray-600"
                    style={{ lineHeight: 1.7, wordBreak: 'keep-all' }}
                  >
                    현재 불편함과 안전 확인을 먼저 기록합니다. 이 답변은 몸BTI 4글자 계산에는 직접 반영하지 않습니다.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <QuestionPlaceholderImage
                questionNumber={displayNumber}
                axis={displayAxis ?? undefined}
                className="w-full aspect-video"
              />
            </div>
          )}
        
          {/* Question Text */}
          <h2
            className="font-bold text-gray-900 whitespace-pre-line"
            style={{
              textAlign: 'center',
              fontSize: '22px',
              lineHeight: 1.38,
              letterSpacing: '-0.04em',
              wordBreak: 'keep-all',
              marginTop: currentQuestionData.is_precheck ? 24 : 18,
              marginBottom: isMulti ? 22 : 28,
            }}
          >
            <span>{questionTitle.main}</span>
            {questionTitle.sub && (
              <span
                style={{
                  display: 'block',
                  marginTop: 6,
                  fontSize: '18px',
                  lineHeight: 1.35,
                  fontWeight: 800,
                  color: '#334155',
                  letterSpacing: '-0.035em',
                }}
              >
                {questionTitle.sub}
              </span>
            )}
          </h2>
        
          {/* Answer Options */}
          {isMulti ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>복수 선택</span>
                <span>최대 {currentQuestionData.max_select ?? 2}개</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: useCompactMultiGrid ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                  gap: 10,
                }}
              >
                {multiItems.map((item) => {
                  const selected = selectedMultiAnswers.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleMultiToggle(item)}
                      disabled={isSkipping}
                      style={{
                        minHeight: useCompactMultiGrid ? 48 : 52,
                        padding: useCompactMultiGrid ? '11px 10px' : undefined,
                        fontSize: useCompactMultiGrid ? 13 : undefined,
                      }}
                      className={`${multiButtonBaseClass} ${selected ? multiButtonSelectedClass : multiButtonIdleClass}`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              {exclusiveOption && (
                <button
                  type="button"
                  onClick={() => handleMultiToggle(exclusiveOption, true)}
                  disabled={isSkipping}
                  style={{ minHeight: 52 }}
                  className={`${multiButtonBaseClass} ${selectedMultiAnswers.includes(exclusiveOption) ? multiButtonSelectedClass : multiButtonIdleClass}`}
                >
                  {exclusiveOption}
                </button>
              )}

              <button
                type="button"
                onClick={handleSubmitMulti}
                disabled={isSkipping || selectedMultiAnswers.length === 0}
                style={{ minHeight: 54 }}
                className={`w-full rounded-2xl px-4 py-3 font-bold text-base transition-all active:scale-95 ${
                  selectedMultiAnswers.length === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200'
                }`}
              >
                다음
              </button>

              {onBack && (
                <div className="mt-6 flex justify-start">
                  <button
                    type="button"
                    onClick={currentIndex > 0 ? () => setCurrentIndex((index) => index - 1) : onBack}
                    className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors text-sm font-medium"
                  >
                    <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                    {currentIndex > 0 ? '이전 질문' : '진단 소개로'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => handleSingleAnswer('①')}
                disabled={isSkipping}
                className="w-full bg-white border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 py-6 rounded-2xl font-semibold text-lg text-gray-900 transition-all active:scale-95 flex items-center justify-between px-6 group"
              >
                <span>{currentQuestionData.option_1}</span>
                <div className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-emerald-500 group-hover:bg-emerald-500 flex items-center justify-center transition-all">
                  <Check className="w-5 h-5 text-transparent group-hover:text-white transition-colors" />
                </div>
              </button>
          
              <button
                type="button"
                onClick={() => handleSingleAnswer('②')}
                disabled={isSkipping}
                className="w-full bg-white border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 py-6 rounded-2xl font-semibold text-lg text-gray-600 transition-all active:scale-95 flex items-center justify-between px-6 group"
              >
                <span>{currentQuestionData.option_2}</span>
                <div className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-gray-400 flex items-center justify-center transition-all">
                  <Check className="w-5 h-5 text-transparent transition-colors" />
                </div>
              </button>
          
              {showOption3 && (
                <button
                  type="button"
                  onClick={() => handleSingleAnswer('③')}
                  disabled={isSkipping}
                  className="w-full bg-white border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 py-6 rounded-2xl font-semibold text-lg text-gray-900 transition-all active:scale-95 flex items-center justify-between px-6 group"
                >
                  <span>{currentQuestionData.option_3}</span>
                  <div className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-emerald-500 group-hover:bg-emerald-500 flex items-center justify-center transition-all">
                    <Check className="w-5 h-5 text-transparent group-hover:text-white transition-colors" />
                  </div>
                </button>
              )}

              {/* 3번째 버튼 아래: 이전 질문(왼쪽 정렬) / 1번째면 진단 소개로 */}
              {onBack && (
                <div className="mt-6 flex justify-start">
                  <button
                    type="button"
                    onClick={currentIndex > 0 ? () => setCurrentIndex((index) => index - 1) : onBack}
                    className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors text-sm font-medium"
                  >
                    <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                    {currentIndex > 0 ? '이전 질문' : '진단 소개로'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Bottom Space */}
        <div className="pb-8"></div>
      </div>
    </div>
  );
}
