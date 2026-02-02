import { ArrowRight, MoveHorizontal, Waves, RotateCcw, Zap } from 'lucide-react';

interface DiagnosisIntroScreenProps {
  onBegin: () => void;
}

export function DiagnosisIntroScreen({ onBegin }: DiagnosisIntroScreenProps) {
  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full flex flex-col">
        
        {/* Header */}
        <div className="px-6 pt-8 pb-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              나의 mebody CODE 찾기
            </h1>
            <p className="text-gray-600">
              40개의 질문으로 체형을 분석합니다
            </p>
          </div>
        </div>

        {/* 4 Axes Explanation */}
        <div className="flex-1 px-6 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">4가지 측정 기준</h3>
            
            {/* Axis 1 */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-2xl p-5 mb-3 border border-blue-200/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <MoveHorizontal className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">축 1. 목 위치</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-3 py-1 bg-white rounded-lg font-medium text-blue-600 shadow-sm">F (전방)</span>
                    <span className="text-gray-400">vs</span>
                    <span className="px-3 py-1 bg-white rounded-lg font-medium text-blue-600 shadow-sm">C (중앙)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Axis 2 */}
            <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-2xl p-5 mb-3 border border-purple-200/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Waves className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">축 2. 어깨 높이</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-3 py-1 bg-white rounded-lg font-medium text-purple-600 shadow-sm">L (왼쪽 높음)</span>
                    <span className="text-gray-400">vs</span>
                    <span className="px-3 py-1 bg-white rounded-lg font-medium text-purple-600 shadow-sm">R (오른쪽 높음)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Axis 3 */}
            <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 rounded-2xl p-5 mb-3 border border-orange-200/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <RotateCcw className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">축 3. 골반 회전</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-3 py-1 bg-white rounded-lg font-medium text-orange-600 shadow-sm">L (왼쪽 회전)</span>
                    <span className="text-gray-400">vs</span>
                    <span className="px-3 py-1 bg-white rounded-lg font-medium text-orange-600 shadow-sm">R (오른쪽 회전)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Axis 4 */}
            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-2xl p-5 mb-3 border border-emerald-200/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">축 4. 다리 유연성</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-3 py-1 bg-white rounded-lg font-medium text-emerald-600 shadow-sm">F (유연)</span>
                    <span className="text-gray-400">vs</span>
                    <span className="px-3 py-1 bg-white rounded-lg font-medium text-emerald-600 shadow-sm">S (경직)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-600 text-center">
              각 질문에 편안하게 답변해주세요.<br />
              정답은 없으며, 솔직한 답변이 가장 정확한 결과를 만듭니다.
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="px-6 pb-8">
          <button
            onClick={onBegin}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-5 rounded-2xl font-semibold text-lg shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            질문 시작하기
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
