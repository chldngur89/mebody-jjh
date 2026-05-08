import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { fetchQuestionnaireResult } from '../api/questionnaire';
import { fetchResultSectionsByBodyCode, type ResultSectionItem } from '../api/content';
import { AXIS_GREEN_THEME } from '../data/axisTheme';
import { characterNames, getAxisLabels } from '../utils/bodyCodeCalculator';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';

interface CodeDetailsScreenProps {
  questionnaireId?: string;
  bodyCode?: string;
  onBack?: () => void;
  onDone?: () => void;
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

function buildDetailFallbackSections(code: string): ResultSectionItem[] {
  const safeCode = code || '----';
  const axisLabels = safeCode.length === 4 ? getAxisLabels(safeCode) : null;
  const section1Fallback = axisLabels
    ? [`목: ${axisLabels.neck}`, `어깨: ${axisLabels.shoulder}`, `골반: ${axisLabels.pelvis}`, `하체: ${axisLabels.flexibility}`].join('\n')
    : '축별 분석 결과를 확인할 수 있습니다.';
  const name = characterNames[safeCode];

  return [
    {
      section_key: '0',
      title: safeCode !== '----' ? `내 체형 코드(${safeCode})에 대해서 알아보기` : '내 체형 코드에 대해서 알아보기',
      content: name
        ? `당신의 체형 코드는 **${safeCode}**입니다. (${name}) 아래 섹션에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.`
        : `당신의 체형 코드는 **${safeCode}**입니다. 아래 섹션에서 자세한 내용을 확인하세요.`,
    },
    { section_key: '1', title: '한눈에 보는 내 코드', content: section1Fallback },
    { section_key: '2', title: '이해 포인트', content: '이 코드는 특정 축의 보상 패턴이 자주 반복될 때 나타납니다. 한 자세를 오래 유지하는 시간을 줄이고, 반대 방향으로 자주 환기하는 것이 핵심입니다.' },
    { section_key: '3', title: '공감 포인트', content: '평소에는 괜찮다가도 오래 앉아 있거나 한쪽에 기대면 더 피곤하고 무거운 느낌이 커질 수 있습니다. 내 몸이 자주 쓰는 방향을 먼저 알아차리는 것이 시작입니다.' },
    { section_key: '4', title: '지금 주의하면 좋은 자세', content: '한쪽으로 기대거나, 다리를 꼬거나, 목과 어깨를 같은 방향으로 오래 고정하는 패턴을 줄이는 것이 좋습니다. 완벽한 자세보다 오래 머물지 않는 것이 더 중요합니다.' },
    { section_key: '5', title: '무료 10~15분 자가 루틴', content: '지금은 강한 운동보다, 짧게라도 자주 풀어주는 루틴이 더 효과적입니다. 결과에 맞는 무료 10~15분 자가 루틴과 스트레칭을 먼저 실행해보세요.' },
  ];
}

export function CodeDetailsScreen({ questionnaireId, bodyCode, onBack, onDone }: CodeDetailsScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');

  const [resolvedCode, setResolvedCode] = useState(bodyCode ?? '');
  const [sections, setSections] = useState<ResultSectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>('detail-0');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        let code = bodyCode ?? '';
        if (!code && questionnaireId) {
          const response = await fetchQuestionnaireResult(questionnaireId);
          code = String(response?.calculated_code ?? '');
        }
        if (cancelled) return;
        setResolvedCode(code);

        const data = code && code.length === 4 ? await fetchResultSectionsByBodyCode(code) : [];
        if (cancelled) return;
        setSections(data);
      } catch (error) {
        if (cancelled) return;
        console.warn('Failed to load code details:', error);
        setSections([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [bodyCode, questionnaireId]);

  const mergedSections = useMemo(() => {
    const fallback = buildDetailFallbackSections(resolvedCode);
    const byKey = new Map(sections.map((section) => [section.section_key, section]));
    return fallback.map((item) => ({
      ...item,
      title: byKey.get(item.section_key)?.title || item.title,
      content: byKey.get(item.section_key)?.content || item.content,
    }));
  }, [resolvedCode, sections]);

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100dvh',
        borderRadius: isDesktopMockup ? '32px' : 0,
        background: 'linear-gradient(145deg, #ecfdf5 0%, #f3fdfb 42%, #f0fdfa 100%)',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.13)',
      }}
    >
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
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', color: '#059669', marginBottom: '4px' }}>BODY DETAILS</div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              내 코드 더 알아보기
            </h1>
          </div>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px', display: 'grid', gap: '16px' }}>
          <section
            style={{
              borderRadius: '22px',
              border: `1px solid ${AXIS_GREEN_THEME.border}`,
              background: '#ffffff',
              padding: '18px',
            paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#059669', marginBottom: '6px' }}>내 코드 상세</div>
            <div style={{ fontSize: '16px', lineHeight: 1.7, fontWeight: 700, color: '#111827', wordBreak: 'keep-all' }}>
              {resolvedCode ? `${resolvedCode} ${characterNames[resolvedCode] ? `· ${characterNames[resolvedCode]}` : ''}` : '내 체형 코드 해설'}
            </div>
          </section>

          {isLoading ? (
            <div style={{ textAlign: 'center', color: '#6b7280', paddingTop: '12px' }}>로딩 중...</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {mergedSections.map((item, index) => {
                const id = `detail-${item.section_key}`;
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            minWidth: '28px',
                            height: '28px',
                            borderRadius: '999px',
                            background: AXIS_GREEN_THEME.surface,
                            border: `1px solid ${AXIS_GREEN_THEME.border}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 800,
                            color: '#0f766e',
                          }}
                        >
                          {index + 1}
                        </span>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>{item.title}</span>
                      </div>
                      {isOpen ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 18px 20px' }}>
                        <div style={{ borderRadius: '16px', background: '#ffffff', border: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '18px' }}>
                          {renderReadableText(item.content)}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {onDone && (
            <button
              type="button"
              onClick={onDone}
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
              코드 플랜으로 돌아가기
              <RotateCcw size={18} />
            </button>
          )}
        </div>
        <ScrollIndicator containerRef={scrollRef} bottomOffset="30px" />
      </div>
    </div>
  );
}
