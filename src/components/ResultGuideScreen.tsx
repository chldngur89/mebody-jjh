import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { fetchResultGuide, type ResultGuide } from '../api/content';
import { RESULT_GUIDE_TITLE, RESULT_GUIDE_SECTIONS } from '../data/resultGuideContent';

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

  const title = guide?.title ?? RESULT_GUIDE_TITLE;
  const sections = guide?.sections?.length ? guide.sections : RESULT_GUIDE_SECTIONS;

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
          <h1 className="text-lg font-bold text-gray-900">{loading ? '로딩 중...' : title}</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-8 text-gray-700">
            {sections.map((section, index) => (
              <section key={index}>
                <h2 className="text-base font-bold text-gray-900 mb-2">{section.title}</h2>
                <div className="text-sm leading-relaxed whitespace-pre-line">
                  {renderBold(section.content)}
                </div>
              </section>
            ))}
          </div>
        </div>
        {onNextPage && (
          <div className="flex-shrink-0 p-4 pt-2 pb-6 border-t border-emerald-100 bg-white/80">
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
