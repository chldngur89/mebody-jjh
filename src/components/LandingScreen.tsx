import { Sparkles } from 'lucide-react';

interface LandingScreenProps {
  onStart: () => void;
}

export function LandingScreen({ onStart }: LandingScreenProps) {
  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      {/* Mobile Screen Container */}
      <div className="h-full flex flex-col items-center justify-center px-8 relative">
        
        {/* Background Decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 right-10 w-64 h-64 bg-emerald-100/40 rounded-full blur-3xl"></div>
          <div className="absolute bottom-32 left-10 w-48 h-48 bg-teal-100/40 rounded-full blur-3xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 text-center">
          {/* Logo/Icon */}
          <div className="mb-8 inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl shadow-lg">
            <Sparkles className="w-12 h-12 text-white" />
          </div>

          {/* Brand Name */}
          <div className="mb-4">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">mebody</h1>
            <div className="h-1 w-16 bg-gradient-to-r from-emerald-400 to-teal-500 mx-auto rounded-full"></div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-gray-900 mb-3 mt-12">
            나의 바디 코드를<br />발견하세요
          </h2>

          {/* Subtitle */}
          <p className="text-lg text-gray-600 mb-16">
            자세와 균형을 위한 간단한 셀프체크
          </p>

          {/* CTA Button */}
          <button
            onClick={onStart}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-5 rounded-2xl font-semibold text-lg shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all active:scale-95"
          >
            진단 시작하기
          </button>

          {/* Features */}
          <div className="mt-12 space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <span>40개의 간단한 질문</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <span>16가지 체형 분류</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <span>맞춤형 운동 처방</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
