import { useEffect } from 'react';
import { Loader2, MoveHorizontal, Waves, RotateCcw, Zap } from 'lucide-react';

interface AnalyzingScreenProps {
  onComplete: () => void;
}

export function AnalyzingScreen({ onComplete }: AnalyzingScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full flex flex-col items-center justify-center px-8 relative overflow-hidden">
        
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
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            체형 패턴을 분석하고 있습니다
          </h2>

          {/* Subtitle */}
          <p className="text-gray-600 mb-12">
            잠시만 기다려주세요...
          </p>

          {/* 4-Axis Visual Hint */}
          <div className="bg-gray-50/80 backdrop-blur rounded-2xl p-6 inline-block">
            <div className="text-xs text-gray-500 mb-3">4가지 축 분석 중</div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center animate-pulse">
                  <MoveHorizontal className="w-6 h-6 text-blue-500" />
                </div>
                <span className="text-xs text-gray-600">목</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center animate-pulse" style={{ animationDelay: '0.2s' }}>
                  <Waves className="w-6 h-6 text-purple-500" />
                </div>
                <span className="text-xs text-gray-600">어깨</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center animate-pulse" style={{ animationDelay: '0.4s' }}>
                  <RotateCcw className="w-6 h-6 text-orange-500" />
                </div>
                <span className="text-xs text-gray-600">골반</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center animate-pulse" style={{ animationDelay: '0.6s' }}>
                  <Zap className="w-6 h-6 text-emerald-500" />
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
