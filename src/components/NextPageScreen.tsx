import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { fetchResultGuideCommon, fetchBodyCodeNextPage, fetchAppImages, type ResultGuideSection } from '../api/content';
import { SUPABASE_STORAGE_PUBLIC } from '../lib/supabase';
import bodyTypesImage from './figma/bodyTypesImage.png';

function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-gray-900">{part}</strong> : part
  );
}

interface NextPageScreenProps {
  bodyCode?: string | null;
  onBack?: () => void;
  onLearnMore?: () => void;
}

export function NextPageScreen({ bodyCode, onBack, onLearnMore }: NextPageScreenProps) {
  const [commonSections, setCommonSections] = useState<ResultGuideSection[]>([]);
  const [codeSections, setCodeSections] = useState<ResultGuideSection[]>([]);
  const [codeTitle, setCodeTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [appImages, setAppImages] = useState<Record<string, string>>({});
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAppImages().then(setAppImages);
  }, []);

  const bodyTypesPreferred =
    appImages.body_types_image ||
    (SUPABASE_STORAGE_PUBLIC ? `${SUPABASE_STORAGE_PUBLIC}/body-types/bodyTypesImage.png` : '');
  const bodyTypesImageUrl =
    bodyTypesPreferred && !failedImageUrls.has(bodyTypesPreferred) ? bodyTypesPreferred : bodyTypesImage;
  const markImageFailed = useCallback((url: string) => {
    setFailedImageUrls((s) => new Set(s).add(url));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchResultGuideCommon(),
      bodyCode && bodyCode.length === 4 ? fetchBodyCodeNextPage(bodyCode) : Promise.resolve(null),
    ])
      .then(([common, codePage]) => {
        if (cancelled) return;
        setCommonSections(common?.sections ?? []);
        if (codePage?.sections?.length) {
          setCodeTitle(codePage.title);
          setCodeSections(codePage.sections);
        } else {
          setCodeTitle('');
          setCodeSections([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [bodyCode]);

  const hasCommon = commonSections.length > 0;
  const hasCode = codeSections.length > 0;
  const hasAny = hasCommon || hasCode;

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 bg-white/80 backdrop-blur-lg border-b border-emerald-100 px-6 py-4 flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <h1 className="text-lg font-bold text-gray-900">
            {loading ? '로딩 중...' : (hasAny ? '맞춤 가이드' : '다음')}
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {hasAny ? (
            <div className="space-y-8 text-gray-700">
              {hasCommon && (
                <>
                  <h2 className="text-sm font-semibold text-emerald-700">공통</h2>
                  {commonSections.map((section, index) => (
                    <section key={`common-${index}`}>
                      <h3 className="text-base font-bold text-gray-900 mb-2">{section.title}</h3>
                      <div className="text-sm leading-relaxed whitespace-pre-line">
                        {renderBold(section.content)}
                      </div>
                    </section>
                  ))}
                </>
              )}
              {hasCode && (
                <>
                  {hasCommon && <hr className="border-gray-200" />}
                  {codeTitle && <h2 className="text-sm font-semibold text-emerald-700">{codeTitle}</h2>}
                  {codeSections.map((section, index) => (
                    <section key={`code-${index}`}>
                      <h3 className="text-base font-bold text-gray-900 mb-2">{section.title}</h3>
                      <div className="text-sm leading-relaxed whitespace-pre-line">
                        {renderBold(section.content)}
                      </div>
                    </section>
                  ))}
                </>
              )}
              {/* 프로그레스바 + 전체 16가지 체형 이미지 (다음 페이지 하단) */}
              <div className="mt-8 pt-6 border-t border-gray-200">
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
              {onLearnMore && (
                <div className="pt-4 pb-2">
                  <button
                    type="button"
                    onClick={onLearnMore}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all active:scale-[0.98]"
                  >
                    내 mebody 코드 더 알아보기
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-gray-500 text-center px-4">
              <p className="text-sm mb-6">이 체형에 대한 맞춤 정보를 준비 중입니다.</p>
              <div className="w-full max-w-xs space-y-3">
                {onLearnMore && (
                  <button
                    type="button"
                    onClick={onLearnMore}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all active:scale-[0.98]"
                  >
                    내 mebody 코드 더 알아보기
                  </button>
                )}
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    자세 사용 설명서로
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
