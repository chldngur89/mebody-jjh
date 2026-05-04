import { Fragment, useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { fetchResultGuideCommon, type ResultGuide } from '../api/content';
import { AXIS_GREEN_THEME } from '../data/axisTheme';
import { RESULT_GUIDE_SECTIONS, RESULT_GUIDE_TITLE } from '../data/resultGuideContent';

interface CommonGuideScreenProps {
  onBack?: () => void;
  onNext?: () => void;
}

function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} style={{ fontWeight: 700, color: '#111827' }}>
        {part}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

function renderReadableText(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const blocks = paragraphs.length ? paragraphs : [text];

  return (
    <div style={{ display: 'grid', gap: '13px', fontSize: '14px', lineHeight: 1.82, color: '#4b5563', wordBreak: 'keep-all' }}>
      {blocks.map((block, blockIndex) => {
        const lines = block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const isBulletList = lines.length > 1 && lines.every((line) => /^[-•]\s?/.test(line));

        if (isBulletList) {
          return (
            <ul key={blockIndex} style={{ paddingLeft: '18px', display: 'grid', gap: '6px' }}>
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderBold(line.replace(/^[-•]\s?/, ''))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIndex}>
            {lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderBold(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function CommonGuideScreen({ onBack, onNext }: CommonGuideScreenProps) {
  const [guide, setGuide] = useState<ResultGuide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>('guide-0');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchResultGuideCommon()
      .then((data) => {
        if (cancelled) return;
        setGuide(data);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Failed to load common guide:', error);
        setGuide(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const sections = guide?.sections?.length ? guide.sections : RESULT_GUIDE_SECTIONS;
  const title = guide?.title || RESULT_GUIDE_TITLE;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: '844px',
        borderRadius: '32px',
        background: 'linear-gradient(145deg, #ecfdf5 0%, #f3fdfb 42%, #f0fdfa 100%)',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.13)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: '48px',
            left: '-80px',
            width: '280px',
            height: '280px',
            borderRadius: '999px',
            background: 'rgba(52, 211, 153, 0.15)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          height: '100%',
          flexDirection: 'column',
          fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '22px 24px 18px',
            background: 'rgba(255,255,255,0.52)',
            backdropFilter: 'blur(18px)',
          }}
        >
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.42)',
                background: 'rgba(255,255,255,0.74)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#374151',
                cursor: 'pointer',
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
              }}
              title="뒤로"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', color: '#059669', marginBottom: '4px' }}>POSTURE GUIDE</div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              자세 사용 공통
            </h1>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px', display: 'grid', gap: '16px' }}>
          <section
            style={{
              borderRadius: '22px',
              border: `1px solid ${AXIS_GREEN_THEME.border}`,
              background: '#ffffff',
              padding: '18px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#059669', marginBottom: '6px' }}>공통 설명서</div>
            <div style={{ fontSize: '16px', lineHeight: 1.7, fontWeight: 700, color: '#111827', wordBreak: 'keep-all' }}>{title}</div>
          </section>

          {isLoading ? (
            <div style={{ textAlign: 'center', color: '#6b7280', paddingTop: '12px' }}>로딩 중...</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {sections.map((section, index) => {
                const id = `guide-${index}`;
                const isOpen = openId === id;
                return (
                  <section
                    key={id}
                    style={{
                      borderRadius: '18px',
                      border: `1px solid ${isOpen ? AXIS_GREEN_THEME.borderStrong : AXIS_GREEN_THEME.border}`,
                      background: isOpen ? 'rgba(228,244,240,0.56)' : '#ffffff',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '16px 18px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>{section.title}</span>
                      {isOpen ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 18px 20px' }}>
                        <div style={{ borderRadius: '16px', background: '#ffffff', border: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '18px' }}>
                          {renderReadableText(section.content)}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {onNext && (
            <button
              type="button"
              onClick={onNext}
              style={{
                display: 'inline-flex',
                width: '100%',
                height: '54px',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '16px',
                border: 'none',
                background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 800,
                boxShadow: '0 14px 28px rgba(20,184,166,0.22)',
                cursor: 'pointer',
              }}
            >
              다음 페이지: 내 코드 더 알아보기
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
