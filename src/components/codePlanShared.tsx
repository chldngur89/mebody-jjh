import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  fetchQuestionnaireResult,
  fetchQuestions,
  type BodyCodeContent,
  type Question,
  type QuestionnaireResponse,
} from '../api/questionnaire';
import {
  fetchAppImages,
  fetchBodyCodeNextPage,
  fetchResultGuide,
  fetchResultSectionsByBodyCode,
  type ResultGuideSection,
} from '../api/content';
import { AXIS_GREEN_THEME } from '../data/axisTheme';
import { characterNames, getAxisScoreBreakdown } from '../utils/bodyCodeCalculator';
import { LOCAL_FALLBACK_CHARACTER_IMAGE, resolveCharacterImageUrl } from '../utils/characterImages';

type ResultWithContent = QuestionnaireResponse & { body_code_content?: BodyCodeContent | null };
type AxisKey = 'neck' | 'shoulder' | 'pelvis' | 'flexibility';

type GuideBlock = {
  id: string;
  title: string;
  content: string;
  caption: string;
};

type AxisRow = {
  key: AxisKey;
  title: string;
  shortTitle: string;
  labelLeft: string;
  labelRight: string;
  leftColor: string;
  rightColor: string;
  surface: string;
  percentLeft: number;
  percentRight: number;
  summary: string;
  dominantLabel: string;
  imbalance: number;
};

type CodePlanPriority = {
  userLabel: string;
  recommendedLabel: string;
  actionText: string;
};

export interface CodePlanDataState {
  result: ResultWithContent | null;
  isLoading: boolean;
  error: string | null;
  bodyCode: string;
  content: BodyCodeContent | null;
  summaryLine: string;
  characterName: string;
  characterImage: string;
  axisRows: AxisRow[];
  guideBlocks: GuideBlock[];
  priority: CodePlanPriority;
  handleImageError: (url: string) => void;
}

const AXIS_META: Record<
  AxisKey,
  {
    title: string;
    shortTitle: string;
    left: string;
    right: string;
    leftCode: string;
    rightCode: string;
    leftColor: string;
    rightColor: string;
    surface: string;
  }
> = {
  neck: {
    title: '목 위치',
    shortTitle: '목',
    left: '전방',
    right: '중앙',
    leftCode: 'F',
    rightCode: 'C',
    leftColor: AXIS_GREEN_THEME.primary,
    rightColor: AXIS_GREEN_THEME.deep,
    surface: AXIS_GREEN_THEME.cardSurfaces[0],
  },
  shoulder: {
    title: '어깨 높이',
    shortTitle: '어깨',
    left: '오른쪽 높음',
    right: '왼쪽 높음',
    leftCode: 'R',
    rightCode: 'L',
    leftColor: AXIS_GREEN_THEME.primary,
    rightColor: AXIS_GREEN_THEME.deep,
    surface: AXIS_GREEN_THEME.cardSurfaces[1],
  },
  pelvis: {
    title: '골반 회전',
    shortTitle: '골반',
    left: '오른쪽 회전',
    right: '왼쪽 회전',
    leftCode: 'R',
    rightCode: 'L',
    leftColor: AXIS_GREEN_THEME.primary,
    rightColor: AXIS_GREEN_THEME.deep,
    surface: AXIS_GREEN_THEME.cardSurfaces[2],
  },
  flexibility: {
    title: '하체 유연성',
    shortTitle: '하체',
    left: '유연',
    right: '뻣뻣',
    leftCode: 'F',
    rightCode: 'S',
    leftColor: AXIS_GREEN_THEME.primary,
    rightColor: AXIS_GREEN_THEME.deep,
    surface: AXIS_GREEN_THEME.cardSurfaces[3],
  },
};

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
    <div style={{ display: 'grid', gap: '12px', fontSize: '14px', lineHeight: 1.8, color: '#4b5563', wordBreak: 'keep-all' }}>
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

function pickSummaryLine(content: BodyCodeContent | null): string {
  const line = content?.description
    ?.split(/[.\n]/)
    .map((sentence) => sentence.trim())
    .find(Boolean);

  return line || '현재 몸이 가장 자주 쓰는 보상 패턴을 기준으로 코드를 정리했습니다.';
}

function buildGuideBlocks(
  nextPageSections: ResultGuideSection[],
  detailSections: Array<{ key: string; title: string; content: string }>,
  guideSections: ResultGuideSection[],
): GuideBlock[] {
  const blocks: GuideBlock[] = [
    ...nextPageSections.map((section, index) => ({
      id: `next-${index}`,
      title: section.title,
      content: section.content,
      caption: 'CODE PLAN',
    })),
    ...detailSections.map((section) => ({
      id: section.key,
      title: section.title,
      content: section.content,
      caption: 'BODY GUIDE',
    })),
    ...guideSections.map((section, index) => ({
      id: `guide-${index}`,
      title: section.title,
      content: section.content,
      caption: 'POSTURE GUIDE',
    })),
  ];

  return blocks.filter((block) => block.title || block.content);
}

export function useCodePlanData(questionnaireId?: string): CodePlanDataState {
  const [result, setResult] = useState<ResultWithContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appImages, setAppImages] = useState<Record<string, string>>({});
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const [scoringQuestions, setScoringQuestions] = useState<Question[]>([]);
  const [guideSections, setGuideSections] = useState<ResultGuideSection[]>([]);
  const [nextPageSections, setNextPageSections] = useState<ResultGuideSection[]>([]);
  const [detailSections, setDetailSections] = useState<Array<{ key: string; title: string; content: string }>>([]);

  useEffect(() => {
    fetchAppImages().then(setAppImages).catch(() => setAppImages({}));
    fetchQuestions().then(setScoringQuestions).catch(() => setScoringQuestions([]));
  }, []);

  useEffect(() => {
    if (!questionnaireId) {
      setResult(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchQuestionnaireResult(questionnaireId)
      .then((data) => {
        if (cancelled) return;
        setResult((data as ResultWithContent) ?? null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error('Failed to load code plan result:', loadError);
        setError('결과를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [questionnaireId]);

  useEffect(() => {
    const code = result?.calculated_code;
    if (!code || code.length !== 4) {
      setGuideSections([]);
      setNextPageSections([]);
      setDetailSections([]);
      return;
    }

    let cancelled = false;

    Promise.all([fetchResultGuide(code), fetchBodyCodeNextPage(code), fetchResultSectionsByBodyCode(code)])
      .then(([guide, nextPage, detail]) => {
        if (cancelled) return;
        setGuideSections(guide?.sections ?? []);
        setNextPageSections(nextPage?.sections ?? []);
        setDetailSections(
          detail.map((section) => ({
            key: section.section_key,
            title: section.title,
            content: section.content,
          })),
        );
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.warn('Failed to load code plan guide content:', loadError);
        setGuideSections([]);
        setNextPageSections([]);
        setDetailSections([]);
      });

    return () => {
      cancelled = true;
    };
  }, [result?.calculated_code]);

  const handleImageError = useCallback((url: string) => {
    setFailedImageUrls((prev) => new Set(prev).add(url));
  }, []);

  const bodyCode = result?.calculated_code || '----';
  const content = result?.body_code_content ?? null;
  const summaryLine = pickSummaryLine(content);
  const characterName = content?.character_name || characterNames[bodyCode] || '나의 mebody 코드';
  const axisPercent = result?.answers ? getAxisScoreBreakdown(result.answers, scoringQuestions) : null;
  const characterImage = resolveCharacterImageUrl(bodyCode, appImages, failedImageUrls);

  const axisRows = useMemo(() => {
    if (!axisPercent) return [];

    return (Object.keys(AXIS_META) as AxisKey[]).map((key) => {
      const meta = AXIS_META[key];
      const detailByKey =
        key === 'neck'
          ? content?.neck_result
          : key === 'shoulder'
            ? content?.shoulder_result
            : key === 'pelvis'
              ? content?.pelvis_result
              : content?.flexibility_result;
      const percentLeft = axisPercent[key].percentLeft;
      const percentRight = axisPercent[key].percentRight;
      const dominantLabel = percentLeft >= percentRight ? meta.left : meta.right;

      return {
        key,
        title: meta.title,
        shortTitle: meta.shortTitle,
        labelLeft: meta.left,
        labelRight: meta.right,
        leftColor: meta.leftColor,
        rightColor: meta.rightColor,
        surface: meta.surface,
        percentLeft,
        percentRight,
        summary: detailByKey || `${meta.title} 축에서 ${dominantLabel} 방향이 더 강하게 나타났습니다.`,
        dominantLabel,
        imbalance: Math.abs(percentLeft - percentRight),
      };
    });
  }, [axisPercent, content]);

  const guideBlocks = useMemo(
    () => buildGuideBlocks(nextPageSections, detailSections, guideSections),
    [detailSections, guideSections, nextPageSections],
  );

  const priority = useMemo<CodePlanPriority>(() => {
    if (axisRows.length === 0) {
      return {
        userLabel: '결과를 불러오면 우선 축이 계산됩니다.',
        recommendedLabel: '결과를 불러오면 추천 축이 계산됩니다.',
        actionText: '결과를 다시 불러온 뒤 코드 플랜을 확인해주세요.',
      };
    }

    const strongestAxis = [...axisRows].sort((a, b) => b.imbalance - a.imbalance)[0];
    const stiffAxis = axisRows.find((row) => row.key === 'flexibility');
    const recommendedAxis =
      bodyCode[3] === 'S' || (stiffAxis && stiffAxis.percentRight >= 62) ? stiffAxis ?? strongestAxis : strongestAxis;
    const userLabel = `${strongestAxis.shortTitle} ${strongestAxis.dominantLabel}`;
    const recommendedLabel = `${recommendedAxis.shortTitle} ${recommendedAxis.dominantLabel}`;

    return {
      userLabel,
      recommendedLabel,
      actionText: `지금은 ${userLabel} 패턴이 가장 선명합니다. mebody는 ${recommendedLabel} 축부터 가이드와 15분 루틴을 시작하는 것을 추천합니다.`,
    };
  }, [axisRows, bodyCode]);

  return {
    result,
    isLoading,
    error,
    bodyCode,
    content,
    summaryLine,
    characterName,
    characterImage: characterImage || LOCAL_FALLBACK_CHARACTER_IMAGE,
    axisRows,
    guideBlocks,
    priority,
    handleImageError,
  };
}

interface CodePlanDetailContentProps {
  data: Pick<CodePlanDataState, 'bodyCode' | 'content' | 'summaryLine' | 'characterName' | 'characterImage' | 'axisRows' | 'guideBlocks' | 'priority' | 'handleImageError'>;
  hideGuideSection?: boolean;
}

export function CodePlanDetailContent({ data, hideGuideSection = false }: CodePlanDetailContentProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <section
        style={{
          borderRadius: '30px',
          background: 'rgba(255,255,255,0.80)',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
          backdropFilter: 'blur(20px)',
          padding: '22px',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '10px' }}>코드 상태 창</div>
        <div style={{ display: 'grid', gridTemplateColumns: '112px 1fr', gap: '16px', alignItems: 'start' }}>
          <div>
            <div
              style={{
                width: '112px',
                height: '132px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(255,255,255,0.96) 100%)',
                border: '1px solid rgba(209,250,229,0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: '0 16px 30px rgba(15, 23, 42, 0.08)',
                marginBottom: '10px',
              }}
            >
              {data.characterImage && data.characterImage !== LOCAL_FALLBACK_CHARACTER_IMAGE ? (
                <img
                  src={data.characterImage}
                  alt={data.bodyCode}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={() => data.handleImageError(data.characterImage)}
                />
              ) : (
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#059669' }}>{data.bodyCode}</div>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.04em', color: '#111827', marginBottom: '6px' }}>{data.bodyCode}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#374151', wordBreak: 'keep-all' }}>{data.characterName}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {data.axisRows.map((row) => (
              <div
                key={row.key}
                style={{
                  borderRadius: '18px',
                  background: row.surface,
                  border: `1px solid ${AXIS_GREEN_THEME.border}`,
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827' }}>{row.title}</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280' }}>{row.dominantLabel}</div>
                </div>
                <div style={{ display: 'flex', height: '14px', borderRadius: '999px', overflow: 'hidden', marginBottom: '8px', background: AXIS_GREEN_THEME.track }}>
                  <div style={{ width: `${row.percentLeft}%`, background: row.leftColor }} />
                  <div style={{ width: `${row.percentRight}%`, background: row.rightColor }} />
                </div>
                <div style={{ fontSize: '12px', lineHeight: 1.5, color: '#4b5563', wordBreak: 'keep-all' }}>{row.summary}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: '16px',
            borderRadius: '20px',
            background: 'rgba(228,244,240,0.84)',
            border: `1px solid ${AXIS_GREEN_THEME.border}`,
            padding: '16px 18px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#059669', marginBottom: '6px' }}>한 줄 이해</div>
          <div style={{ fontSize: '15px', lineHeight: 1.7, fontWeight: 700, color: '#111827', wordBreak: 'keep-all' }}>{data.summaryLine}</div>
        </div>
      </section>

      <section
        style={{
          borderRadius: '24px',
          border: `1px solid ${AXIS_GREEN_THEME.border}`,
          background: '#ffffff',
          padding: '18px',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '6px' }}>MISSION</div>
        <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>오늘의 미션 수행률</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
          <div style={{ fontSize: '34px', lineHeight: 1, fontWeight: 800, color: '#111827' }}>0%</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>오늘 시작 전</div>
        </div>
        <div style={{ height: '14px', borderRadius: '999px', background: AXIS_GREEN_THEME.track, overflow: 'hidden' }}>
          <div style={{ width: '0%', height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)' }} />
        </div>
      </section>

      <section
        style={{
          borderRadius: '24px',
          border: `1px solid ${AXIS_GREEN_THEME.border}`,
          background: '#ffffff',
          padding: '18px',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '6px' }}>ACTION</div>
        <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#111827', marginBottom: '14px' }}>지금 해야 할 액션</h2>
        <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
          <div style={{ borderRadius: '16px', background: 'rgba(244,251,249,0.96)', border: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#6b7280', marginBottom: '4px' }}>당신의 1순위</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>{data.priority.userLabel}</div>
          </div>
          <div style={{ borderRadius: '16px', background: 'rgba(228,244,240,0.92)', border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`, padding: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: AXIS_GREEN_THEME.text, marginBottom: '4px' }}>mebody 추천 1순위</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>{data.priority.recommendedLabel}</div>
          </div>
        </div>
        <p style={{ fontSize: '14px', lineHeight: 1.75, color: '#4b5563', wordBreak: 'keep-all' }}>{data.priority.actionText}</p>
      </section>

      {!hideGuideSection && (
        <section
          style={{
            borderRadius: '24px',
            border: guideOpen ? `1px solid ${AXIS_GREEN_THEME.borderStrong}` : `1px solid ${AXIS_GREEN_THEME.border}`,
            background: '#ffffff',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => setGuideOpen((open) => !open)}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '18px',
              background: guideOpen ? 'rgba(228,244,240,0.84)' : '#ffffff',
              cursor: 'pointer',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '4px' }}>GUIDE</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>나의 mebody 코드 가이드 보기</div>
            </div>
            {guideOpen ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
          </button>
          {guideOpen && (
            <div style={{ borderTop: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '0 18px 18px', display: 'grid', gap: '12px' }}>
              {data.guideBlocks.length > 0 ? (
                data.guideBlocks.map((block) => (
                  <div
                    key={block.id}
                    style={{
                      borderRadius: '18px',
                      background: 'rgba(244,251,249,0.95)',
                      border: `1px solid ${AXIS_GREEN_THEME.border}`,
                      padding: '16px',
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: '#059669', marginBottom: '6px' }}>{block.caption}</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827', marginBottom: '10px', wordBreak: 'keep-all' }}>{block.title}</div>
                    {renderReadableText(block.content)}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '14px', lineHeight: 1.6, color: '#6b7280', paddingTop: '4px', wordBreak: 'keep-all' }}>
                  아직 연결된 가이드가 없습니다.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section
        style={{
          borderRadius: '24px',
          border: routineOpen ? `1px solid ${AXIS_GREEN_THEME.borderStrong}` : `1px solid ${AXIS_GREEN_THEME.border}`,
          background: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => setRoutineOpen((open) => !open)}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '18px',
            background: routineOpen ? 'rgba(228,244,240,0.84)' : '#ffffff',
            cursor: 'pointer',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '4px' }}>ROUTINE</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>맞춤 15분 케어 루틴</div>
          </div>
          {routineOpen ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
        </button>
        {routineOpen && (
          <div style={{ borderTop: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '0 18px 18px', display: 'grid', gap: '12px' }}>
            {(data.content?.exercises?.length ?? 0) > 0 ? (
              data.content!.exercises.map((exercise, index) => (
                <div
                  key={`${exercise.title}-${index}`}
                  style={{
                    borderRadius: '18px',
                    background: 'rgba(244,251,249,0.95)',
                    border: `1px solid ${AXIS_GREEN_THEME.border}`,
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827', wordBreak: 'keep-all' }}>{exercise.title}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>{exercise.duration}</div>
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: 1.7, color: '#4b5563', wordBreak: 'keep-all' }}>{exercise.desc}</div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '14px', lineHeight: 1.6, color: '#6b7280', paddingTop: '4px', wordBreak: 'keep-all' }}>
                아직 연결된 루틴이 없습니다.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
