import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { AXIS_ICON_SRC } from '../data/axisIcons';
import { useMediaQuery } from '../utils/useMediaQuery';

interface AnalyzingScreenProps {
  onBack?: () => void;
  onAnalyze: () => Promise<void>;
}

export function AnalyzingScreen({ onBack, onAnalyze }: AnalyzingScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');

  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runAnalysis = useCallback(async () => {
    setErrorMessage(null);
    setIsRunning(true);
    try {
      await onAnalyze();
    } catch (error) {
      console.error('Failed to analyze questionnaire:', error);
      if (mountedRef.current) {
        setErrorMessage('결과 계산 중 문제가 발생했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.');
      }
    } finally {
      if (mountedRef.current) {
        setIsRunning(false);
      }
    }
  }, [onAnalyze]);

  useEffect(() => {
    mountedRef.current = true;
    if (!startedRef.current) {
      startedRef.current = true;
      void runAnalysis();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [runAnalysis]);

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100dvh',
        borderRadius: isDesktopMockup ? '32px' : 0,
        background: 'linear-gradient(145deg, #ecfdf5 0%, #f3fdfb 42%, #f0fdfa 100%)',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.13)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', position: 'relative' }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="absolute top-6 left-6 z-20 w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
        )}
        
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-teal-200/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        {/* Content */}
        <div className="relative z-10 text-center">
          {/* Spinner */}
          <div className="mb-8 inline-flex items-center justify-center">
            <Loader2 className="w-16 h-16 text-emerald-500 animate-spin" />
          </div>

          {/* Title */}
          <h2
            className="font-bold text-gray-900 mb-3"
            style={{
              fontSize: '27px',
              lineHeight: 1.34,
              letterSpacing: '-0.045em',
              wordBreak: 'keep-all',
            }}
          >
            체형 패턴을
            <br />
            분석하고 있습니다
          </h2>

          {/* Subtitle */}
          <p className="text-gray-600 mb-12">
            {errorMessage ?? '답변을 저장하고 mebody 코드를 계산하는 중입니다.'}
          </p>

          {errorMessage && (
            <button
              type="button"
              onClick={runAnalysis}
              disabled={isRunning}
              className="mb-8 inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 text-sm font-black text-white shadow-lg shadow-emerald-100 disabled:opacity-60"
            >
              {isRunning ? '다시 계산 중...' : '다시 계산하기'}
            </button>
          )}

          {/* 4-Axis Visual Hint - Ver2 축 아이콘 통일 */}
          <div className="bg-gray-50/80 backdrop-blur rounded-2xl p-6 inline-block">
            <div className="text-xs text-gray-500 mb-3">4가지 축 분석 중</div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden bg-white animate-pulse">
                  <img src={AXIS_ICON_SRC.neck} alt="" className="w-full h-full object-contain" />
                </div>
                <span className="text-xs text-gray-600">목</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden bg-white animate-pulse" style={{ animationDelay: '0.2s' }}>
                  <img src={AXIS_ICON_SRC.shoulder} alt="" className="w-full h-full object-contain" />
                </div>
                <span className="text-xs text-gray-600">어깨</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden bg-white animate-pulse" style={{ animationDelay: '0.4s' }}>
                  <img src={AXIS_ICON_SRC.pelvis} alt="" className="w-full h-full object-contain" />
                </div>
                <span className="text-xs text-gray-600">골반</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden bg-white animate-pulse" style={{ animationDelay: '0.6s' }}>
                  <img src={AXIS_ICON_SRC.flexibility} alt="" className="w-full h-full object-contain" />
                </div>
                <span className="text-xs text-gray-600">다리</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
