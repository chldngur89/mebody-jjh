import { useState, useEffect } from 'react';
import { MoveHorizontal, Waves, RotateCcw, Zap, Play, Lock, Share2, Download, ArrowLeft } from 'lucide-react';
import { fetchQuestionnaireResult } from '../api/questionnaire';
import { getAxisLabels, getBodyCodeKeywords, allCodes } from '../utils/bodyCodeCalculator';
import type { QuestionnaireResponse, BodyCodeContent } from '../api/questionnaire';

// Figma Character Images
import FRRS_img from './figma/FRRS.png';
import FRRF_img from './figma/FRRF.png';
import FRLS_img from './figma/FRLS.png';
import FRLF_img from './figma/FRLF.png';
import FLRS_img from './figma/FLRS.png';
import FLRF_img from './figma/FLRF.png';
import FLLS_img from './figma/FLLS.png';
import FLLF_img from './figma/FLLF.png';
import CRRS_img from './figma/CRRS.png';
import CRRF_img from './figma/CRRF.png';
import CRLS_img from './figma/CRLS.png';
import CRLF_img from './figma/CRLF.png';
import CLRS_img from './figma/CLRS.png';
import CLRF_img from './figma/CLRF.png';
import CLLS_img from './figma/CLLS.png';
import CLLF_img from './figma/CLLF.png';
import bodyTypesImage from './figma/bodyTypesImage.png';

interface ResultScreenProps {
  questionnaireId?: string;
  onRestart?: () => void;
}

export function ResultScreen({ questionnaireId, onRestart }: ResultScreenProps) {
  const [result, setResult] = useState<QuestionnaireResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadResult() {
      if (!questionnaireId) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await fetchQuestionnaireResult(questionnaireId);
        setResult(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load result:', err);
        setError('결과를 찾을 수 없습니다');
        setIsLoading(false);
      }
    }

    loadResult();
  }, [questionnaireId]);

  const bodyCode = result?.calculated_code || '----';
  const content = result?.body_code_content as BodyCodeContent | null;
  const axisLabels = result?.calculated_code ? getAxisLabels(result.calculated_code) : null;
  const keywords = result?.calculated_code ? getBodyCodeKeywords(result.calculated_code) : [];

  // Figma Character Image Mapping
  const characterImages: Record<string, string> = {
    'FRRS': FRRS_img,
    'FRRF': FRRF_img,
    'FRLS': FRLS_img,
    'FRLF': FRLF_img,
    'FLRS': FLRS_img,
    'FLRF': FLRF_img,
    'FLLS': FLLS_img,
    'FLLF': FLLF_img,
    'CRRS': CRRS_img,
    'CRRF': CRRF_img,
    'CRLS': CRLS_img,
    'CRLF': CRLF_img,
    'CLRS': CLRS_img,
    'CLRF': CLRF_img,
    'CLLS': CLLS_img,
    'CLLF': CLLF_img,
  };

  const currentCharacterImage = bodyCode !== '----' ? characterImages[bodyCode] : null;

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex items-center justify-center" style={{ height: '844px' }}>
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col items-center justify-center px-6" style={{ height: '844px' }}>
        <div className="text-red-500 mb-4">{error}</div>
        {onRestart && (
          <button onClick={onRestart} className="bg-emerald-500 text-white px-6 py-3 rounded-xl">
            다시 시작하기
          </button>
        )}
      </div>
    );
  }

  if (!result || !content) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex items-center justify-center" style={{ height: '844px' }}>
        <div className="text-gray-500">결과를 찾을 수 없습니다</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-lg border-b border-gray-100 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">진단 결과</h1>
            <div className="flex gap-2">
              {onRestart && (
                <button onClick={onRestart} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                  <ArrowLeft className="w-4 h-4 text-gray-600" />
                </button>
              )}
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
          
          {/* Hero Body Code Badge with Character Image */}
          <div className="mt-8 mb-8 text-center">
            {/* Character Image - Individual high-quality image */}
            {currentCharacterImage && (
              <div className="mb-6 flex justify-center">
                <div className="w-56 h-64 bg-white rounded-2xl shadow-lg overflow-hidden border-4 border-emerald-500 p-4 flex items-center justify-center">
                  <img
                    src={currentCharacterImage}
                    alt={`${bodyCode} Character`}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}

            <div className="inline-block bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-1 rounded-3xl shadow-2xl shadow-emerald-500/30">
              <div className="bg-white rounded-[22px] px-12 py-10">
                <div className="text-7xl font-black tracking-wider bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent mb-3">
                  {bodyCode}
                </div>
                <div className="text-sm text-gray-600 font-medium">
                  나의 mebody CODE
                </div>
                {content?.character_name && (
                  <div className="text-xs text-gray-500 mt-2">
                    {content.character_name}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Character Name */}
          {content.character_name && (
            <div className="text-center mb-6">
              <div className="inline-block bg-gradient-to-r from-gray-100 to-gray-50 px-6 py-3 rounded-full border border-gray-200">
                <span className="text-gray-700 font-semibold">{content.character_name}</span>
              </div>
            </div>
          )}
          
          {/* 4-Axis Breakdown Card */}
          {axisLabels && (
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
                    <div className="font-semibold text-gray-900">{axisLabels.neck}</div>
                  </div>
                  <div className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg">{content.neck_result}</div>
                </div>
                
                {/* Axis 2 */}
                <div className="flex items-center gap-3 bg-purple-50/80 rounded-xl p-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Waves className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-purple-600 font-medium mb-0.5">어깨 높이</div>
                    <div className="font-semibold text-gray-900">{axisLabels.shoulder}</div>
                  </div>
                  <div className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-lg">{content.shoulder_result}</div>
                </div>
                
                {/* Axis 3 */}
                <div className="flex items-center gap-3 bg-orange-50/80 rounded-xl p-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <RotateCcw className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-orange-600 font-medium mb-0.5">골반 회전</div>
                    <div className="font-semibold text-gray-900">{axisLabels.pelvis}</div>
                  </div>
                  <div className="px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded-lg">{content.pelvis_result}</div>
                </div>
                
                {/* Axis 4 */}
                <div className="flex items-center gap-3 bg-emerald-50/80 rounded-xl p-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-emerald-600 font-medium mb-0.5">다리 유연성</div>
                    <div className="font-semibold text-gray-900">{axisLabels.flexibility}</div>
                  </div>
                  <div className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg">{content.flexibility_result}</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Keyword Summary Chips */}
          {keywords.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">체형 특징</h3>
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword, index) => {
                  const colors = [
                    ['from-blue-100 to-blue-50', 'text-blue-700', 'border-blue-200'],
                    ['from-purple-100 to-purple-50', 'text-purple-700', 'border-purple-200'],
                    ['from-orange-100 to-orange-50', 'text-orange-700', 'border-orange-200'],
                    ['from-emerald-100 to-emerald-50', 'text-emerald-700', 'border-emerald-200']
                  ];
                  const [bg, text, border] = colors[index % 4];
                  return (
                    <span key={keyword} className={`px-4 py-2 bg-gradient-to-r ${bg} ${text} rounded-full text-sm font-medium border ${border}`}>
                      {keyword}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* 16-Type Grid Preview */}
          <div className="mb-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">전체 16가지 체형 분류</h3>

            {/* Full Image Display */}
            <div className="bg-white rounded-xl overflow-hidden mb-4 shadow-sm">
              <img
                src={bodyTypesImage}
                alt="16 Body Types"
                className="w-full h-auto"
              />
            </div>

            <p className="text-xs text-gray-600 mt-3 text-center">
              당신은 <span className="font-semibold text-emerald-600">{bodyCode}</span> 유형입니다
            </p>
          </div>
          
          {/* Action Plan Preview */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">맞춤 운동 프로그램</h3>
            
            {/* Video Cards */}
            {content.exercises && content.exercises.length > 0 && (
              <div className="space-y-3 mb-4">
                {content.exercises.slice(0, 3).map((exercise, index) => {
                  const gradients = [
                    'from-blue-400 to-blue-500',
                    'from-purple-400 to-purple-500',
                    'from-orange-400 to-orange-500'
                  ];
                  return (
                    <div key={index} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex gap-3 hover:shadow-md transition-shadow">
                      <div className={`w-28 h-20 bg-gradient-to-br ${gradients[index]} flex items-center justify-center flex-shrink-0`}>
                        <Play className="w-8 h-8 text-white/90" fill="white" />
                      </div>
                      <div className="flex-1 py-3 pr-3">
                        <div className="font-semibold text-gray-900 text-sm mb-1">{exercise.title}</div>
                        <div className="text-xs text-gray-600">{exercise.duration} • {exercise.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Lifestyle Tips */}
            {content.lifestyle_tips && content.lifestyle_tips.length > 0 && (
              <div className="bg-emerald-50 rounded-xl p-4 mb-4 border border-emerald-100">
                <div className="text-sm font-semibold text-emerald-900 mb-2">생활 습관 팁</div>
                <ul className="space-y-1.5 text-sm text-emerald-800">
                  {content.lifestyle_tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-1 h-1 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Health Products */}
            {content.health_products && content.health_products.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                <div className="text-sm font-semibold text-gray-900 mb-2">추천 헬스 케어 용품</div>
                <div className="space-y-2">
                  {content.health_products.map((product, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                      <span><strong>{product.name}</strong>: {product.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
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
