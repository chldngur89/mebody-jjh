import { MoveHorizontal, Waves, RotateCcw, Zap, Play, Lock, Share2, Download } from 'lucide-react';

export function ResultScreen() {
  const bodyCode = "FLRF";
  const allCodes = [
    "FCLS", "FCLF", "FCRS", "FCRF",
    "FRLS", "FRLF", "FRRS", "FRRF",
    "CLLS", "CLLF", "CLRS", "CLRF",
    "CRLS", "CRLF", "CRRS", "CRRF"
  ];

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-lg border-b border-gray-100 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">진단 결과</h1>
            <div className="flex gap-2">
              <button className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                <Share2 className="w-4 h-4 text-gray-600" />
              </button>
              <button className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                <Download className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-8">
          
          {/* Hero Body Code Badge */}
          <div className="mt-8 mb-8 text-center">
            <div className="inline-block bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-1 rounded-3xl shadow-2xl shadow-emerald-500/30">
              <div className="bg-white rounded-[22px] px-12 py-10">
                <div className="text-7xl font-black tracking-wider bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent mb-3">
                  {bodyCode}
                </div>
                <div className="text-sm text-gray-600 font-medium">
                  나의 mebody CODE
                </div>
              </div>
            </div>
          </div>

          {/* 4-Axis Breakdown Card */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">4가지 축 분석 결과</h3>
            
            <div className="space-y-3">
              {/* Axis 1 */}
              <div className="flex items-center gap-3 bg-blue-50/80 rounded-xl p-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MoveHorizontal className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-blue-600 font-medium mb-0.5">목 위치</div>
                  <div className="font-semibold text-gray-900">전방 (F)</div>
                </div>
                <div className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg">F</div>
              </div>

              {/* Axis 2 */}
              <div className="flex items-center gap-3 bg-purple-50/80 rounded-xl p-3">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Waves className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-purple-600 font-medium mb-0.5">어깨 높이</div>
                  <div className="font-semibold text-gray-900">왼쪽 높음 (L)</div>
                </div>
                <div className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-lg">L</div>
              </div>

              {/* Axis 3 */}
              <div className="flex items-center gap-3 bg-orange-50/80 rounded-xl p-3">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-orange-600 font-medium mb-0.5">골반 회전</div>
                  <div className="font-semibold text-gray-900">오른쪽 회전 (R)</div>
                </div>
                <div className="px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded-lg">R</div>
              </div>

              {/* Axis 4 */}
              <div className="flex items-center gap-3 bg-emerald-50/80 rounded-xl p-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-emerald-600 font-medium mb-0.5">다리 유연성</div>
                  <div className="font-semibold text-gray-900">유연 (F)</div>
                </div>
                <div className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg">F</div>
              </div>
            </div>
          </div>

          {/* Keyword Summary Chips */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">체형 특징</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-4 py-2 bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
                거북목
              </span>
              <span className="px-4 py-2 bg-gradient-to-r from-purple-100 to-purple-50 text-purple-700 rounded-full text-sm font-medium border border-purple-200">
                왼쪽 어깨 기울임
              </span>
              <span className="px-4 py-2 bg-gradient-to-r from-orange-100 to-orange-50 text-orange-700 rounded-full text-sm font-medium border border-orange-200">
                골반 회전
              </span>
              <span className="px-4 py-2 bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 rounded-full text-sm font-medium border border-emerald-200">
                유연한 하체
              </span>
            </div>
          </div>

          {/* 16-Type Grid Preview */}
          <div className="mb-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">전체 16가지 체형 분류</h3>
            <div className="grid grid-cols-4 gap-2">
              {allCodes.map((code) => (
                <div
                  key={code}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                    code === bodyCode
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg scale-110'
                      : 'bg-white text-gray-400 border border-gray-200'
                  }`}
                >
                  {code}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-3 text-center">
              당신은 <span className="font-semibold text-emerald-600">FLRF</span> 유형입니다
            </p>
          </div>

          {/* Action Plan Preview */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">맞춤 운동 프로그램</h3>
            
            {/* Video Cards */}
            <div className="space-y-3 mb-4">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex gap-3 hover:shadow-md transition-shadow">
                <div className="w-28 h-20 bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <Play className="w-8 h-8 text-white/90" fill="white" />
                </div>
                <div className="flex-1 py-3 pr-3">
                  <div className="font-semibold text-gray-900 text-sm mb-1">목 스트레칭</div>
                  <div className="text-xs text-gray-600">5분 • 거북목 교정</div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex gap-3 hover:shadow-md transition-shadow">
                <div className="w-28 h-20 bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <Play className="w-8 h-8 text-white/90" fill="white" />
                </div>
                <div className="flex-1 py-3 pr-3">
                  <div className="font-semibold text-gray-900 text-sm mb-1">어깨 균형 운동</div>
                  <div className="text-xs text-gray-600">7분 • 어깨 높이 조정</div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex gap-3 hover:shadow-md transition-shadow">
                <div className="w-28 h-20 bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <Play className="w-8 h-8 text-white/90" fill="white" />
                </div>
                <div className="flex-1 py-3 pr-3">
                  <div className="font-semibold text-gray-900 text-sm mb-1">골반 정렬 동작</div>
                  <div className="text-xs text-gray-600">6분 • 골반 회전 교정</div>
                </div>
              </div>
            </div>

            {/* Lifestyle Tips */}
            <div className="bg-emerald-50 rounded-xl p-4 mb-4 border border-emerald-100">
              <div className="text-sm font-semibold text-emerald-900 mb-2">생활 습관 팁</div>
              <ul className="space-y-1.5 text-sm text-emerald-800">
                <li className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span>모니터 높이를 눈높이에 맞춰주세요</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span>의자에 앉을 때 양쪽 골반을 균등하게 두세요</span>
                </li>
              </ul>
            </div>

            {/* Unlock CTA */}
            <button className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
              <Lock className="w-5 h-5" />
              전체 프로그램 시작하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
