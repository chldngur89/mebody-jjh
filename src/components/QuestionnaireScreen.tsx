import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ArrowLeft, ChevronRight, Sparkles, UserRound } from 'lucide-react';
import { fetchQuestions, saveDraft } from '../api/questionnaire';
import type { Question } from '../api/questionnaire';
import { QuestionPlaceholderImage } from './QuestionPlaceholderImage';
import { AXIS_ICON_FALLBACK_SRC, AXIS_ICON_SRC } from '../data/axisIcons';
import type { AxisKey } from '../data/axisIcons';
import type { AnswerMap } from '../utils/bodyCodeCalculator';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';

interface QuestionnaireScreenProps {
  onBack?: () => void;
  onComplete: (answers: AnswerMap, questions: Question[], questionnaireId?: string) => void;
  isLoggedIn?: boolean;
  userEmail?: string;
  onOpenMyPage?: () => void;
  onRequireAuth?: () => void;
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

function getSkipAnswer(question: Question): AnswerMap[string] {
  if (question.answer_type === 'multi') {
    const fallbackOption =
      [question.option_2, question.option_3, question.option_1].find((option) => /없음|해당 없음|궁금/.test(option)) ||
      question.option_2;
    const normalized = stripOptionPrefix(fallbackOption);
    return normalized ? [normalized] : [];
  }

  return '②';
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
 
export function QuestionnaireScreen({
  onBack,
  onComplete,
  isLoggedIn = false,
  onOpenMyPage,
  onRequireAuth,
}: QuestionnaireScreenProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [questionnaireId, setQuestionnaireId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);

  const totalQuestions = questions.length || 53;
  const progress = questions.length ? (currentIndex / totalQuestions) * 100 : 0;
 
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const questionScrollRef = useRef<HTMLDivElement>(null);

  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchQuestions();
      setQuestions(data);
      if (!data.length) {
        setLoadError('문항 데이터가 비어 있습니다. Supabase questions 테이블을 확인해주세요.');
      }
    } catch (error) {
      console.error('Failed to load questions:', error);
      setLoadError('문항을 불러오지 못했습니다. 네트워크나 Supabase 연결을 확인해주세요.');
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [loadQuestions]);

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

  const completeOrAdvance = useCallback((newAnswers: AnswerMap) => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    onComplete(newAnswers, questions, questionnaireId);
  }, [currentIndex, onComplete, questionnaireId, questions, totalQuestions]);

  const handleSingleAnswer = useCallback(async (answer: string) => {
    if (!currentQuestionData) return;
    const newAnswers = { ...answers, [currentQuestionData.question_code]: answer };
    setAnswers(newAnswers);
    saveDraftDebounced(newAnswers);
    completeOrAdvance(newAnswers);
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
    completeOrAdvance(answers);
  }, [answers, completeOrAdvance, currentQuestionData]);

  const handleSkipToResult = useCallback(() => {
    if (!questions.length || isSkipping) return;
    setIsSkipping(true);

    try {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      const skipAnswers = questions.reduce<AnswerMap>((acc, q) => {
        acc[q.question_code] = getSkipAnswer(q);
        return acc;
      }, {});
      setAnswers(skipAnswers);
      onComplete(skipAnswers, questions, questionnaireId);
    } catch (error) {
      console.error('Failed to prepare skipped questionnaire:', error);
      setIsSkipping(false);
    } finally {
      // 정상 흐름에서는 즉시 분석 화면으로 이동하므로 이 상태는 화면에 남지 않습니다.
    }
  }, [isSkipping, onComplete, questionnaireId, questions]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ minHeight: '100dvh' }}>
        <div className="h-full flex flex-col">
          <div className="px-6 pb-4" style={{ paddingTop: 40 }}>
            <div className="flex items-center justify-between gap-3" style={{ marginBottom: 28 }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2 shadow-sm">
                <Sparkles size={17} color="#059669" />
                <span className="text-xs font-black tracking-wide text-gray-800">MEBODY</span>
              </div>
              <div className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-700 shadow-sm">
                <UserRound size={15} />
                {isLoggedIn ? '내 페이지' : '로그인'}
              </div>
            </div>

            <div
              className="mb-4 border border-emerald-100 bg-emerald-50/70"
              style={{ borderRadius: 24, padding: '20px 26px 18px' }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">LOADING</span>
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-emerald-700 shadow-sm">
                  준비 중
                </span>
              </div>
              <p className="font-bold text-emerald-950" style={{ fontSize: 12.5, lineHeight: 1.72, wordBreak: 'keep-all' }}>
                문항 데이터를 불러오고 있습니다. 잠시 후 사전체크부터 이어집니다.
              </p>
            </div>

            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-emerald-300 to-teal-300" />
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-6 pb-4 pt-1">
            <div className="grid items-center gap-3" style={{ gridTemplateColumns: '38px minmax(0, 1fr) 38px', marginBottom: 18 }}>
              <div className="h-[38px] w-[38px] rounded-full bg-gray-100" />
              <div className="flex items-center justify-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100" />
                <div className="h-4 w-20 rounded-full bg-gray-100" />
              </div>
              <div />
            </div>

            <div
              className="mx-2 mb-5 border border-emerald-100"
              style={{
                borderRadius: 24,
                background: 'linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(255,255,255,0.98) 100%)',
                boxShadow: '0 12px 28px rgba(16, 185, 129, 0.08)',
                padding: '22px 24px 22px 26px',
              }}
            >
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-2xl bg-emerald-100" />
                <div className="min-w-0 flex-1">
                  <div className="mb-3 h-4 w-24 rounded-full bg-emerald-100" />
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded-full bg-gray-100" />
                    <div className="h-3 w-4/5 rounded-full bg-gray-100" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-auto mb-8 mt-8 h-8 w-3/4 rounded-full bg-gray-100" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-14 rounded-2xl border border-gray-100 bg-white shadow-sm" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !currentQuestionData) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ minHeight: '100dvh' }}>
        <div className="h-full flex flex-col px-6 py-10">
          <div className="flex items-center justify-between gap-3" style={{ marginBottom: 28 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2 shadow-sm">
              <Sparkles size={17} color="#059669" />
              <span className="text-xs font-black tracking-wide text-gray-800">MEBODY</span>
            </div>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-gray-100 bg-gray-50 px-4 text-xs font-extrabold text-gray-600 shadow-sm"
              >
                <ArrowLeft size={15} />
                뒤로
              </button>
            )}
          </div>
          <div
            className="flex-1 flex flex-col items-center justify-center text-center"
            style={{
              borderRadius: 28,
              border: '1px solid rgba(167,243,208,0.95)',
              background: 'linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(255,255,255,0.98) 100%)',
              padding: '28px 24px',
            }}
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl font-black text-emerald-700">!</div>
            <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">QUESTION LOAD</div>
            <h2 className="mb-3 text-2xl font-black tracking-[-0.04em] text-gray-900">문항을 준비하지 못했습니다</h2>
            <p className="mb-5 text-sm font-bold leading-7 text-gray-600" style={{ wordBreak: 'keep-all' }}>
              {loadError || '현재 표시할 문항이 없습니다. 다시 시도해도 반복되면 Supabase questions 데이터를 확인해주세요.'}
            </p>
            <button
              type="button"
              onClick={loadQuestions}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-black text-white shadow-lg shadow-emerald-100"
            >
              문항 다시 불러오기
            </button>
          </div>
        </div>
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
  const handleAccountAction = isLoggedIn ? onOpenMyPage : onRequireAuth;
  const handlePreviousOrBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((index) => index - 1);
      return;
    }
    onBack?.();
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ minHeight: '100dvh' }}>
      <div className="h-full flex flex-col">

        {/* Progress Header */}
        <div className="px-6 pb-4" style={{ paddingTop: 40 }}>
          <div
            className="flex items-center justify-between gap-3"
            style={{ marginBottom: 28 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2 shadow-sm">
              <Sparkles size={17} color="#059669" />
              <span className="text-xs font-black tracking-wide text-gray-800">MEBODY</span>
            </div>
            {handleAccountAction && (
              <button
                type="button"
                onClick={handleAccountAction}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100"
              >
                <UserRound size={15} />
                {isLoggedIn ? '내 페이지' : '로그인'}
              </button>
            )}
          </div>

          <div
            className="mb-4 border border-emerald-100 bg-emerald-50/70"
            style={{
              borderRadius: 24,
              padding: '20px 26px 18px',
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">PROGRESS</span>
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-emerald-700 shadow-sm">
                {Math.round(progress)}%
              </span>
            </div>
            <p
              className="font-bold text-emerald-950"
              style={{ fontSize: 12.5, lineHeight: 1.72, wordBreak: 'keep-all' }}
            >
              {isLoggedIn
                ? '답변은 계정에 저장되며, 완료 후 코드 플랜과 오늘의 미션으로 이어집니다.'
                : '로그인하면 결과를 계정에 저장하고, 지난 결과와 오늘의 미션을 이어서 확인할 수 있습니다.'}
            </p>
          </div>

          {/* TEMP: 테스트용 53문항 스킵 버튼 (원하면 이 블록만 삭제하면 됩니다) */}
          <div className="mb-3 flex items-center justify-between gap-3">
            {!isLoggedIn && onRequireAuth ? (
              <button
                type="button"
                onClick={onRequireAuth}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 underline underline-offset-4"
              >
                회원가입하고 저장하기
                <ChevronRight size={13} />
              </button>
            ) : (
              <span className="text-xs font-medium text-gray-400">53문항 셀프 체크</span>
            )}
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
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={questionScrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-1">
          {/* Question Number + Axis */}
          <div
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: '38px minmax(0, 1fr) 38px', marginBottom: 18 }}
          >
            {onBack ? (
              <button
                type="button"
                onClick={handlePreviousOrBack}
                className="bg-gray-100 transition-colors hover:bg-gray-200"
                style={{
                  width: 38,
                  height: 38,
                  minWidth: 38,
                  minHeight: 38,
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label={currentIndex > 0 ? '이전 질문' : '진단 소개로'}
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-600 font-semibold">{displayCode}</span>
              </div>
              {displayAxis && <AxisIcon axis={displayAxis} />}
              <span className="text-sm text-gray-500">{axisLabel}</span>
            </div>
            <div />
          </div>

          {currentQuestionData.is_precheck ? (
            <div
              className="mx-2 mb-5 border border-emerald-100"
              style={{
                borderRadius: 24,
                background: 'linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(255,255,255,0.98) 100%)',
                boxShadow: '0 12px 28px rgba(16, 185, 129, 0.08)',
                marginTop: 0,
                padding: '22px 24px 22px 26px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
                <div
                  aria-hidden
                  style={{
                    width: 32,
                    height: 32,
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
                    className="mt-1 font-semibold text-gray-600"
                    style={{ fontSize: 11, lineHeight: 1.58, wordBreak: 'keep-all' }}
                  >
                    현재 불편함과 안전을 기록합니다. 몸BTI 4글자 계산에는 직접 반영되지 않습니다.
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
          <ScrollIndicator containerRef={questionScrollRef} bottomOffset="72px" />
        </div>

        {/* Bottom Space */}
        <div className="pb-8"></div>
      </div>
    </div>
  );
}
