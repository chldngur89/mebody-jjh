import { useEffect } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { AXIS_ICON_SRC } from '../data/axisIcons';

interface AnalyzingScreenProps {
  onBack?: () => void;
  onComplete: () => void;
}

export function AnalyzingScreen({ onBack, onComplete }: AnalyzingScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full flex flex-col items-center justify-center px-8 relative overflow-hidden">
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
            잠시만 기다려주세요...
          </p>

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
