import { Fragment, useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchResultGuide, fetchBodyCodeNextPage, fetchAppImages, type ResultGuide } from '../api/content';
import { SUPABASE_STORAGE_PUBLIC } from '../lib/supabase';
import { RESULT_GUIDE_TITLE, RESULT_GUIDE_SECTIONS } from '../data/resultGuideContent';

const LOCAL_FALLBACK_IMAGE = '/icon.svg';

function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-gray-900">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

function renderReadableText(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const blocks = paragraphs.length ? paragraphs : [text];

  return (
    <div className="space-y-3 text-[15px] text-gray-700 leading-8 tracking-[-0.01em] [word-break:keep-all]">
      {blocks.map((block, blockIdx) => {
        const lines = block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const isBulletList = lines.length > 1 && lines.every((line) => /^[-•]\s?/.test(line));

        if (isBulletList) {
          return (
            <ul key={blockIdx} className="list-disc pl-5 space-y-1 marker:text-emerald-500">
              {lines.map((line, lineIdx) => (
                <li key={lineIdx}>{renderBold(line.replace(/^[-•]\s?/, ''))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIdx}>
            {lines.map((line, lineIdx) => (
              <Fragment key={lineIdx}>
                {lineIdx > 0 && <br />}
                {renderBold(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

interface ResultGuideScreenProps {
  bodyCode?: string | null;
  onBack?: () => void;
  onNextPage?: () => void;
}

export function ResultGuideScreen({ bodyCode, onBack, onNextPage }: ResultGuideScreenProps) {
  const [guide, setGuide] = useState<ResultGuide | null>(null);
  const [nextPageSections, setNextPageSections] = useState<{ title: string; content: string }[]>([]);
  const [nextPageTitle, setNextPageTitle] = useState('');
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
    Promise.all([
      fetchResultGuide(bodyCode ?? undefined),
      bodyCode && bodyCode.length === 4 ? fetchBodyCodeNextPage(bodyCode) : Promise.resolve(null),
    ])
      .then(([guideData, nextPageData]) => {
        if (cancelled) return;
        setGuide(guideData ?? null);
        if (nextPageData?.sections?.length) {
          setNextPageTitle(nextPageData.title);
          setNextPageSections(nextPageData.sections);
        } else {
          setNextPageTitle('');
          setNextPageSections([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [bodyCode]);

  const resolveImage = useCallback(
    (candidates: Array<string | undefined>) => {
      for (const raw of candidates) {
        const url = (raw || '').trim();
        if (!url) continue;
        if (url.includes('your-bucket.supabase.co')) continue;
        if (!failedImageUrls.has(url)) return url;
      }
      return LOCAL_FALLBACK_IMAGE;
    },
    [failedImageUrls],
  );

  const bodyTypesPreferred =
    appImages.body_types_image ||
    (SUPABASE_STORAGE_PUBLIC ? `${SUPABASE_STORAGE_PUBLIC}/body-types/bodyTypesImage.png` : '');
  const bodyTypesDefault = SUPABASE_STORAGE_PUBLIC ? `${SUPABASE_STORAGE_PUBLIC}/body-types/bodyTypesImage.png` : '';
  const bodyTypesImageUrl = resolveImage([bodyTypesPreferred, bodyTypesDefault]);
  const markImageFailed = useCallback((url: string) => {
    setFailedImageUrls((s) => new Set(s).add(url));
  }, []);

  const title = guide?.title ?? RESULT_GUIDE_TITLE;
  const sections = guide?.sections?.length ? guide.sections : RESULT_GUIDE_SECTIONS;
  const hasNextPageSections = nextPageSections.length > 0;

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full flex flex-col">
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
            <div className="text-[10px] font-semibold tracking-[0.18em] text-emerald-600 mb-0.5">POSTURE GUIDE</div>
            <h1 className="text-[17px] font-bold tracking-tight text-gray-900 truncate">{loading ? '로딩 중...' : title}</h1>
          </div>
        </div>
        <div
          className="flex-1 overflow-y-auto px-6 py-6"
          style={{ fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif' }}
        >
          <div className="space-y-4">
            {sections.map((section, index) => {
              const isOpen = openIndex === index;
              return (
                <section
                  key={index}
                  className={`bg-white border rounded-3xl shadow-sm overflow-hidden transition-all ${
                    isOpen ? 'border-emerald-200 shadow-md' : 'border-gray-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/80 transition-colors"
                  >
                    <h3 className="text-[15px] font-semibold text-gray-900 leading-6 pr-4">{section.title}</h3>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 pb-5 pt-4 bg-gradient-to-b from-white to-gray-50/70">
                      <div className="rounded-2xl bg-white border border-gray-100 px-4 py-4 shadow-sm">
                        {renderReadableText(section.content)}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* 맞춤 가이드(체형별) – body_code_next_page 내용 통합 */}
          {hasNextPageSections && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              {nextPageTitle && (
                <div className="text-center mb-4">
                  <div className="text-[10px] font-semibold tracking-[0.16em] text-emerald-600 mb-1">CUSTOM GUIDE</div>
                  <h2 className="text-base font-bold text-emerald-700">{nextPageTitle}</h2>
                </div>
              )}
              <div className="space-y-4">
                {nextPageSections.map((section, index) => {
                  const idx = sections.length + index;
                  const isOpen = openIndex === idx;
                  return (
                    <section
                      key={`next-${index}`}
                      className={`bg-white border rounded-3xl shadow-sm overflow-hidden transition-all ${
                        isOpen ? 'border-emerald-200 shadow-md' : 'border-gray-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenIndex(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/80 transition-colors"
                      >
                        <h3 className="text-[15px] font-semibold text-gray-900 leading-6 pr-4">{section.title}</h3>
                        {isOpen ? (
                          <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="border-t border-gray-100 px-5 pb-5 pt-4 bg-gradient-to-b from-white to-gray-50/70">
                          <div className="rounded-2xl bg-white border border-gray-100 px-4 py-4 shadow-sm">
                            {renderReadableText(section.content)}
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          )}

          {/* 프로그레스바 + 전체 16가지 체형 이미지 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>진단 완료</span>
              <span className="font-semibold text-emerald-600">100%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div className="h-full w-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: '100%' }} />
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-6 border border-gray-200 text-center">
              <h3 className="text-base font-bold text-gray-900 mb-1">전체 16가지 체형 분류</h3>
              <p className="text-xs text-gray-500 mb-4">전체 맵에서 나의 위치를 확인해보세요</p>
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
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-2xl font-semibold tracking-wide shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
