import { Fragment, useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchResultSectionsByBodyCode, type ResultSectionItem } from '../api/content';
import { getAxisLabels, characterNames } from '../utils/bodyCodeCalculator';

const SECTION_KEYS = ['0', '1', '2', '3', '4', '5'] as const;
const SECTION_DEFAULT_TITLES: Record<string, string> = {
  '0': '내 체형 코드에 대해서 알아보기',
  '1': '한눈에 보는 내 코드',
  '2': '이해 포인트',
  '3': '공감 포인트',
  '4': '지금 주의하면 좋은 자세',
  '5': '무료 10~15분 자가 루틴',
};

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

interface BodyCodeAccordionScreenProps {
  bodyCode: string | null | undefined;
  onBack?: () => void;
  onLearnMore?: () => void;
}

export function BodyCodeAccordionScreen({ bodyCode, onBack, onLearnMore }: BodyCodeAccordionScreenProps) {
  const [sections, setSections] = useState<ResultSectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (bodyCode && bodyCode.length === 4) {
      setLoading(true);
      fetchResultSectionsByBodyCode(bodyCode).then((data) => {
        setSections(data);
        setLoading(false);
      });
    } else {
      setSections([]);
      setLoading(false);
    }
  }, [bodyCode]);

  const mergedSections = useMemo(() => {
    const byKey: Record<string, ResultSectionItem> = {};
    for (const s of sections) {
      byKey[s.section_key] = s;
    }
    const code = bodyCode ?? '----';
    const axisLabels = code.length === 4 ? getAxisLabels(code) : null;
    const section1Fallback = axisLabels
      ? [`목: ${axisLabels.neck}`, `어깨: ${axisLabels.shoulder}`, `골반: ${axisLabels.pelvis}`, `하체: ${axisLabels.flexibility}`].join('\n')
      : '';

    return SECTION_KEYS.map((key) => {
      const fromDb = byKey[key];
      const title =
        fromDb?.title ||
        (key === '0' && code !== '----' ? `내 체형 코드(${code})에 대해서 알아보기` : SECTION_DEFAULT_TITLES[key]);
      let content = fromDb?.content ?? '';
      if (!content && key === '0' && code !== '----') {
        const name = characterNames[code];
        content = name ? `당신의 체형 코드는 **${code}**입니다. (${name}) 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.` : `당신의 체형 코드는 **${code}**입니다. 아래 섹션에서 자세한 내용을 확인하세요.`;
      }
      if (!content && key === '1') content = section1Fallback || '축별 분석 결과를 확인할 수 있습니다.';
      if (!content && key === '2') content = '(DB에 이해 포인트 내용을 추가해 주세요.)';
      if (!content && key === '3') content = '(DB에 공감 포인트 내용을 추가해 주세요.)';
      if (!content && key === '4') content = '(DB에 주의 자세 내용을 추가해 주세요.)';
      if (!content && key === '5') content = '맞춤 운동·무료 자가 루틴은 준비 중입니다. DB에 내용을 넣으면 여기에 표시됩니다.';
      return { section_key: key, title, content };
    });
  }, [bodyCode, sections]);

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
            <div className="text-[10px] font-semibold tracking-[0.18em] text-emerald-600 mb-0.5">BODY DETAILS</div>
            <h1 className="text-[17px] font-bold tracking-tight text-gray-900 truncate">
              {loading ? '로딩 중...' : `나의 mebody 코드${bodyCode ? ` (${bodyCode})` : ''}`}
            </h1>
          </div>
        </div>
        <div
          className="flex-1 overflow-y-auto px-6 py-6"
          style={{ fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif' }}
        >
          <div className="space-y-3">
            {mergedSections.map((section, index) => {
              const isOpen = openIndex === index;
              return (
                <section
                  key={section.section_key}
                  className={`bg-white border rounded-3xl shadow-sm overflow-hidden transition-all ${
                    isOpen ? 'border-emerald-200 shadow-md' : 'border-gray-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/80 transition-colors"
                  >
                    <span className="text-[15px] font-semibold text-gray-900 leading-6 pr-4">
                      {section.section_key}) {section.title}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    )}
                  </button>
                  {isOpen && section.content && (
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
        <div className="flex-shrink-0 p-4 pt-2 pb-6 border-t border-gray-100 bg-white/80 space-y-3">
          {onLearnMore && (
            <button
              type="button"
              onClick={onLearnMore}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-2xl font-semibold tracking-wide shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all active:scale-[0.98]"
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
              맞춤 가이드로 돌아가기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
