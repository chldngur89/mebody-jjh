import { ArrowRight, ArrowLeft } from 'lucide-react';
import { AXIS_ICON_SRC } from '../data/axisIcons';

interface DiagnosisIntroScreenProps {
  onBack?: () => void;
  onBegin: () => void;
}

export function DiagnosisIntroScreen({ onBack, onBegin }: DiagnosisIntroScreenProps) {
  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full flex flex-col">
        
        {/* Header */}
        <div className="flex-shrink-0 bg-white/85 backdrop-blur-lg border-b border-gray-100 px-6 py-4 flex items-center gap-3 z-10">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-[0.18em] text-emerald-600 mb-0.5">DIAGNOSIS INTRO</div>
            <h1 className="text-[19px] font-bold text-gray-900 tracking-tight truncate">나의 mebody CODE 찾기</h1>
            <p className="text-[13px] text-gray-600 leading-5 mt-1">40개의 질문으로 체형을 분석합니다</p>
          </div>
        </div>

        {/* 4 Axes Explanation - Ver2 축 아이콘 통일 */}
        <div
          className="flex-1 px-6 py-6 overflow-y-auto"
          style={{ fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif' }}
        >
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 tracking-wide">4가지 측정 기준</h3>
            
            {/* Axis 1 - 목 */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-2xl p-5 mb-3 border border-blue-200/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white shadow-sm">
                  <img src={AXIS_ICON_SRC.neck} alt="" className="w-full h-full object-contain" />
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

            {/* Axis 2 - 어깨 */}
            <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-2xl p-5 mb-3 border border-purple-200/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white shadow-sm">
                  <img src={AXIS_ICON_SRC.shoulder} alt="" className="w-full h-full object-contain" />
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

            {/* Axis 3 - 골반 */}
            <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 rounded-2xl p-5 mb-3 border border-orange-200/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white shadow-sm">
                  <img src={AXIS_ICON_SRC.pelvis} alt="" className="w-full h-full object-contain" />
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

            {/* Axis 4 - 하체 유연성 */}
            <div className="bg-gradient-to-r from-green-50 to-green-100/50 rounded-2xl p-5 mb-3 border border-green-200/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white shadow-sm">
                  <img src={AXIS_ICON_SRC.flexibility} alt="" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">축 4. 다리 유연성</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-3 py-1 bg-white rounded-lg font-medium text-green-600 shadow-sm">F (유연)</span>
                    <span className="text-gray-400">vs</span>
                    <span className="px-3 py-1 bg-white rounded-lg font-medium text-green-600 shadow-sm">S (경직)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-white rounded-2xl p-5 mb-6 border border-gray-200 shadow-sm">
            <p className="text-[14px] leading-7 text-gray-700 text-center [word-break:keep-all]">
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
