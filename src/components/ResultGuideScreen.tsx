import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchResultGuide, fetchAppImages, type ResultGuide } from '../api/content';
import { SUPABASE_STORAGE_PUBLIC } from '../lib/supabase';
import { RESULT_GUIDE_TITLE, RESULT_GUIDE_SECTIONS } from '../data/resultGuideContent';
import bodyTypesImage from './figma/bodyTypesImage.png';

function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-gray-900">{part}</strong> : part
  );
}

interface ResultGuideScreenProps {
  bodyCode?: string | null;
  onBack?: () => void;
  onNextPage?: () => void;
}

export function ResultGuideScreen({ bodyCode, onBack, onNextPage }: ResultGuideScreenProps) {
  const [guide, setGuide] = useState<ResultGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [appImages, setAppImages] = useState<Record<string, string>>({});
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAppImages().then(setAppImages);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchResultGuide(bodyCode ?? undefined)
      .then((data) => {
        if (!cancelled) setGuide(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [bodyCode]);

  const bodyTypesPreferred =
    appImages.body_types_image ||
    (SUPABASE_STORAGE_PUBLIC ? `${SUPABASE_STORAGE_PUBLIC}/body-types/bodyTypesImage.png` : '');
  const bodyTypesImageUrl =
    bodyTypesPreferred && !failedImageUrls.has(bodyTypesPreferred) ? bodyTypesPreferred : bodyTypesImage;
  const markImageFailed = useCallback((url: string) => {
    setFailedImageUrls((s) => new Set(s).add(url));
  }, []);

  const title = guide?.title ?? RESULT_GUIDE_TITLE;
  const sections = guide?.sections?.length ? guide.sections : RESULT_GUIDE_SECTIONS;

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 bg-white/80 backdrop-blur-lg border-b border-gray-100 px-6 py-4 flex items-center gap-3 z-10">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <h1 className="text-lg font-bold text-gray-900">{loading ? '로딩 중...' : title}</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-4">
            {sections.map((section, index) => {
              const isOpen = openIndex === index;
              return (
                <section
                  key={index}
                  className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/80 transition-colors"
                  >
                    <h3 className="text-sm font-semibold text-gray-800">{section.title}</h3>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 pb-5 pt-2">
                      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {renderBold(section.content)}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* 다음 페이지부터: 프로그레스바 + 전체 16가지 체형 이미지 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>진단 완료</span>
              <span className="font-semibold text-emerald-600">100%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div className="h-full w-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: '100%' }} />
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">전체 16가지 체형 분류</h3>
              <div className="bg-white rounded-xl overflow-hidden mb-4 shadow-sm">
                <img
                  src={bodyTypesImageUrl}
                  alt="16 Body Types"
                  className="w-full h-auto"
                  onError={() => markImageFailed(bodyTypesImageUrl)}
                />
              </div>
              {bodyCode && bodyCode.length === 4 && (
                <p className="text-xs text-gray-600 mt-3 text-center">
                  당신은 <span className="font-semibold text-emerald-600">{bodyCode}</span> 유형입니다
                </p>
              )}
            </div>
          </div>
        </div>
        {onNextPage && (
          <div className="flex-shrink-0 p-4 pt-2 pb-6 border-t border-gray-100 bg-white/80">
            <button
              type="button"
              onClick={onNextPage}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              다음 페이지
              <span className="text-lg">&gt;</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
