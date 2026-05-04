import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, X } from 'lucide-react';
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
  fetchImmediateActionData,
  fetchResultGuide,
  fetchResultSectionsByBodyCode,
  type ImmediateActionContent,
  type ImmediateActionData,
  type ImmediateActionDiscomfortMapping,
  type ImmediateActionAxisMapping,
  type ResultGuideSection,
} from '../api/content';
import { AXIS_GREEN_THEME } from '../data/axisTheme';
import { characterNames, getAxisScoreBreakdown, type AnswerMap } from '../utils/bodyCodeCalculator';
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
  axisNo: number;
  axisLookupKey: 'neck' | 'shoulder' | 'pelvis' | 'lower';
  title: string;
  shortTitle: string;
  labelLeft: string;
  labelRight: string;
  leftCode: string;
  rightCode: string;
  leftColor: string;
  rightColor: string;
  surface: string;
  percentLeft: number;
  percentRight: number;
  summary: string;
  dominantLabel: string;
  dominantCode: string;
  dominantPercent: number;
  imbalance: number;
};

type CodePlanPriority = {
  userLabel: string;
  recommendedLabel: string;
  actionText: string;
};

type ImmediateActionCase = 'A' | 'B' | 'empty';
type ImmediateActionSource = 'discomfort' | 'axis';

type ImmediateActionPriorityItem = {
  id: string;
  rank: 1 | 2;
  sourceType: ImmediateActionSource;
  title: string;
  displayName: string;
  percent?: number;
  contentKeys: string[];
  contents: ImmediateActionContent[];
};

type ImmediateActionPlan = {
  isConfigured: boolean;
  caseType: ImmediateActionCase;
  summary: string;
  items: ImmediateActionPriorityItem[];
  detailContents: ImmediateActionContent[];
};

type MissionProgress = 0 | 50 | 100;
type ActionDetailMode = 1 | 2 | 'all';

type RoutineItem = BodyCodeContent['exercises'][number] & {
  durationMinutes: number;
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
  actionPlan: ImmediateActionPlan;
  handleImageError: (url: string) => void;
}

const AXIS_META: Record<
  AxisKey,
  {
    axisNo: number;
    axisLookupKey: 'neck' | 'shoulder' | 'pelvis' | 'lower';
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
    axisNo: 1,
    axisLookupKey: 'neck',
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
    axisNo: 2,
    axisLookupKey: 'shoulder',
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
    axisNo: 3,
    axisLookupKey: 'pelvis',
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
    axisNo: 4,
    axisLookupKey: 'lower',
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

const EMPTY_IMMEDIATE_ACTION_PLAN: ImmediateActionPlan = {
  isConfigured: false,
  caseType: 'empty',
  summary: '액션 데이터를 준비 중입니다. 연결이 완료되면 결과에 맞춘 관리 순서가 자동으로 표시됩니다.',
  items: [],
  detailContents: [],
};

const DISCOMFORT_LABEL_TO_KEY: Record<string, string> = {
  목: 'neck',
  '머리·두통': 'neck',
  어깨: 'shoulder',
  '등 상부': 'upper_back',
  허리: 'waist',
  '골반·엉덩이': 'pelvis',
  무릎: 'knee',
  '허벅지 앞': 'knee',
  '허벅지 뒤': 'knee',
  '종아리·발목': 'ankle',
  발바닥: 'foot',
};

const AXIS_TIE_PRIORITY: Record<AxisKey, number> = {
  neck: 1,
  shoulder: 2,
  pelvis: 3,
  flexibility: 4,
};

function normalizeAnswerList(value: AnswerMap[string] | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function isNoneDiscomfort(value: string): boolean {
  return value.includes('없음') || value.includes('궁금');
}

function getSideInputFromAnswer(value: AnswerMap[string] | undefined): 'right' | 'left' | 'unknown' {
  if (value === '①' || value === '1') return 'right';
  if (value === '③' || value === '3') return 'left';
  return 'unknown';
}

function splitContentKeys(...rawKeys: string[]): string[] {
  return Array.from(
    new Set(
      rawKeys
        .flatMap((key) => key.split('|'))
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  );
}

function getContentsForKeys(keys: string[], contentByKey: Map<string, ImmediateActionContent>): ImmediateActionContent[] {
  return keys
    .map((key) => contentByKey.get(key))
    .filter((content): content is ImmediateActionContent => Boolean(content));
}

function dedupeContents(contents: ImmediateActionContent[]): ImmediateActionContent[] {
  const seenKeys = new Set<string>();
  const seenMuscleDirection = new Set<string>();

  return contents.filter((content) => {
    const contentKey = content.content_key;
    const muscleDirectionKey = `${content.target_muscle}:${content.direction}`;

    if (seenKeys.has(contentKey) || seenMuscleDirection.has(muscleDirectionKey)) return false;
    seenKeys.add(contentKey);
    seenMuscleDirection.add(muscleDirectionKey);
    return true;
  });
}

function findDiscomfortMapping(
  mappings: ImmediateActionDiscomfortMapping[],
  partKey: string,
  sideInput: string,
): ImmediateActionDiscomfortMapping | undefined {
  return (
    mappings.find((mapping) => mapping.discomfort_part_key === partKey && mapping.side_input === sideInput) ||
    mappings.find((mapping) => mapping.discomfort_part_key === partKey && mapping.side_input === 'unknown') ||
    mappings.find((mapping) => mapping.discomfort_part_key === partKey && mapping.side_input === 'both')
  );
}

function findAxisMapping(
  mappings: ImmediateActionAxisMapping[],
  row: AxisRow,
): ImmediateActionAxisMapping | undefined {
  return mappings.find((mapping) => mapping.axis_key === row.axisLookupKey && mapping.direction_key === row.dominantCode);
}

function buildAxisPriorityItem(
  rank: 1 | 2,
  row: AxisRow,
  mapping: ImmediateActionAxisMapping | undefined,
  contentByKey: Map<string, ImmediateActionContent>,
): ImmediateActionPriorityItem | null {
  if (!mapping) return null;

  const contentKeys = splitContentKeys(mapping.release_content_key, mapping.stretch_content_key);
  const contents = getContentsForKeys(contentKeys, contentByKey);

  return {
    id: `axis-${rank}-${row.key}-${row.dominantCode}`,
    rank,
    sourceType: 'axis',
    title: `당신의 ${rank}순위`,
    displayName: mapping.display_name,
    percent: row.dominantPercent,
    contentKeys,
    contents,
  };
}

function buildDiscomfortPriorityItem(
  labels: string[],
  sideInput: string,
  data: ImmediateActionData,
  contentByKey: Map<string, ImmediateActionContent>,
): ImmediateActionPriorityItem | null {
  const mappings = labels
    .map((label) => DISCOMFORT_LABEL_TO_KEY[label])
    .filter(Boolean)
    .map((partKey) => findDiscomfortMapping(data.discomfortMappings, partKey, sideInput))
    .filter((mapping): mapping is ImmediateActionDiscomfortMapping => Boolean(mapping));

  if (!mappings.length) return null;

  const contentKeys = splitContentKeys(
    ...mappings.flatMap((mapping) => [mapping.release_content_key, mapping.stretch_content_key]),
  );
  const contents = getContentsForKeys(contentKeys, contentByKey);
  const displayName = Array.from(new Set(mappings.map((mapping) => mapping.display_name))).join(' · ');

  return {
    id: `discomfort-1-${sideInput}`,
    rank: 1,
    sourceType: 'discomfort',
    title: '당신의 1순위',
    displayName,
    contentKeys,
    contents,
  };
}

function getSortedAxisCandidates(axisRows: AxisRow[]): AxisRow[] {
  return [...axisRows].sort((left, right) => {
    if (right.dominantPercent !== left.dominantPercent) return right.dominantPercent - left.dominantPercent;
    return AXIS_TIE_PRIORITY[right.key] - AXIS_TIE_PRIORITY[left.key];
  });
}

function buildImmediateActionPlan(
  answers: AnswerMap | undefined,
  axisRows: AxisRow[],
  data: ImmediateActionData,
): ImmediateActionPlan {
  const hasSupabaseData = data.discomfortMappings.length > 0 && data.axisMappings.length > 0 && data.contents.length > 0;
  if (!hasSupabaseData) return EMPTY_IMMEDIATE_ACTION_PLAN;
  if (!answers || axisRows.length === 0) {
    return {
      ...EMPTY_IMMEDIATE_ACTION_PLAN,
      isConfigured: true,
      summary: '결과 데이터를 불러오면 지금 해야 할 액션을 계산합니다.',
    };
  }

  const contentByKey = new Map(data.contents.map((content) => [content.content_key, content]));
  const discomfortAnswers = normalizeAnswerList(answers['A-1']).slice(0, 2);
  const validDiscomfortAnswers = discomfortAnswers.filter((answer) => !isNoneDiscomfort(answer));
  const axisCandidates = getSortedAxisCandidates(axisRows);

  if (validDiscomfortAnswers.length) {
    const sideInput = getSideInputFromAnswer(answers['A-3']);
    const firstItem = buildDiscomfortPriorityItem(validDiscomfortAnswers, sideInput, data, contentByKey);
    const axisRow = axisCandidates[0];
    const secondItem = axisRow ? buildAxisPriorityItem(2, axisRow, findAxisMapping(data.axisMappings, axisRow), contentByKey) : null;
    const items = [firstItem, secondItem].filter((item): item is ImmediateActionPriorityItem => Boolean(item));
    const detailContents = dedupeContents(items.flatMap((item) => item.contents));
    const firstLabel = firstItem?.displayName || validDiscomfortAnswers.join(' · ');
    const secondLabel = secondItem?.displayName || '문항 결과에서 가장 뚜렷한 축';

    return {
      isConfigured: true,
      caseType: 'A',
      summary: `가장 불편하게 느끼는 부위는 ${firstLabel}이며, 문항 결과에서는 ${secondLabel} 경향이 가장 뚜렷하게 나타났습니다. 오늘은 이 두 가지 패턴을 먼저 확인해보세요.`,
      items,
      detailContents,
    };
  }

  const firstAxis = axisCandidates[0];
  const secondAxis = axisCandidates[1];
  const firstItem = firstAxis ? buildAxisPriorityItem(1, firstAxis, findAxisMapping(data.axisMappings, firstAxis), contentByKey) : null;
  const secondItem = secondAxis ? buildAxisPriorityItem(2, secondAxis, findAxisMapping(data.axisMappings, secondAxis), contentByKey) : null;
  const items = [firstItem, secondItem].filter((item): item is ImmediateActionPriorityItem => Boolean(item));
  const detailContents = dedupeContents(items.flatMap((item) => item.contents));
  const firstLabel = firstItem?.displayName || '가장 높은 축';
  const secondLabel = secondItem?.displayName || '두 번째 축';

  return {
    isConfigured: true,
    caseType: 'B',
    summary: `선택된 불편 부위는 없지만, 문항 결과에서는 ${firstLabel} 경향이 가장 뚜렷합니다. 두 번째로는 ${secondLabel} 경향이 함께 보여 오늘은 이 순서로 확인해보세요.`,
    items,
    detailContents,
  };
}

export function useCodePlanData(questionnaireId?: string): CodePlanDataState {
  const [result, setResult] = useState<ResultWithContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appImages, setAppImages] = useState<Record<string, string>>({});
  const [immediateActionData, setImmediateActionData] = useState<ImmediateActionData>({
    discomfortMappings: [],
    axisMappings: [],
    contents: [],
  });
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
      setImmediateActionData({ discomfortMappings: [], axisMappings: [], contents: [] });
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const loadImmediateActionData = async () => {
      const nextData = await fetchImmediateActionData().catch(() => ({
        discomfortMappings: [],
        axisMappings: [],
        contents: [],
      }));
      if (cancelled) return;

      setImmediateActionData(nextData);

      const hasData =
        nextData.discomfortMappings.length > 0 &&
        nextData.axisMappings.length > 0 &&
        nextData.contents.length > 0;

      if (!hasData && attempts < 6) {
        attempts += 1;
        retryTimer = setTimeout(loadImmediateActionData, 2500);
      }
    };

    const handleFocus = () => {
      attempts = 0;
      loadImmediateActionData();
    };

    loadImmediateActionData();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [questionnaireId]);

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
      const codeIndex = key === 'neck' ? 0 : key === 'shoulder' ? 1 : key === 'pelvis' ? 2 : 3;
      const codeDirection = bodyCode[codeIndex];
      const dominantIsLeft = percentLeft > percentRight || (percentLeft === percentRight && codeDirection === meta.leftCode);
      const dominantLabel = dominantIsLeft ? meta.left : meta.right;

      return {
        axisNo: meta.axisNo,
        axisLookupKey: meta.axisLookupKey,
        key,
        title: meta.title,
        shortTitle: meta.shortTitle,
        labelLeft: meta.left,
        labelRight: meta.right,
        leftCode: meta.leftCode,
        rightCode: meta.rightCode,
        leftColor: meta.leftColor,
        rightColor: meta.rightColor,
        surface: meta.surface,
        percentLeft,
        percentRight,
        summary: detailByKey || `${meta.title} 축에서 ${dominantLabel} 방향이 더 강하게 나타났습니다.`,
        dominantLabel,
        dominantCode: dominantIsLeft ? meta.leftCode : meta.rightCode,
        dominantPercent: Math.max(percentLeft, percentRight),
        imbalance: Math.abs(percentLeft - percentRight),
      };
    });
  }, [axisPercent, bodyCode, content]);

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

  const actionPlan = useMemo(
    () => buildImmediateActionPlan(result?.answers, axisRows, immediateActionData),
    [axisRows, immediateActionData, result?.answers],
  );

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
    actionPlan,
    handleImageError,
  };
}

interface CodePlanDetailContentProps {
  data: Pick<CodePlanDataState, 'bodyCode' | 'content' | 'summaryLine' | 'characterName' | 'characterImage' | 'axisRows' | 'guideBlocks' | 'priority' | 'actionPlan' | 'handleImageError'>;
  hideGuideSection?: boolean;
}

function splitInstructionSteps(text: string): string[] {
  return text
    .split(/\s+\/\s+/)
    .map((step) => step.trim())
    .filter(Boolean);
}

function parseDurationMinutes(duration: string): number {
  const match = duration.match(/(\d+)/);
  const parsed = match ? Number(match[1]) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFifteenMinuteRoutine(exercises: BodyCodeContent['exercises'] | undefined): RoutineItem[] {
  const base = exercises?.length
    ? exercises
    : [
        { title: '목 스트레칭', duration: '5분', desc: '목과 어깨 연결부를 천천히 열어줍니다.' },
        { title: '어깨 균형 운동', duration: '7분', desc: '좌우 어깨 높이 차이를 부드럽게 확인합니다.' },
      ];

  const routine = base.map((exercise) => ({
    ...exercise,
    durationMinutes: parseDurationMinutes(exercise.duration),
  }));

  const total = routine.reduce((sum, exercise) => sum + exercise.durationMinutes, 0);

  if (total < 15) {
    const remaining = 15 - total;
    return [
      ...routine,
      {
        title: '마무리 정렬 체크',
        duration: `${remaining}분`,
        desc: '호흡을 정리하면서 목, 어깨, 골반 위치를 다시 가볍게 확인합니다.',
        durationMinutes: remaining,
      },
    ];
  }

  if (total > 15) {
    let remaining = 15;
    const normalized: RoutineItem[] = [];

    for (const exercise of routine) {
      if (remaining <= 0) break;
      const nextMinutes = Math.min(Math.max(1, exercise.durationMinutes), remaining);
      normalized.push({
        ...exercise,
        duration: `${nextMinutes}분`,
        durationMinutes: nextMinutes,
      });
      remaining -= nextMinutes;
    }

    return normalized;
  }

  return routine;
}

function InstructionBlock({ title, meta, text }: { title: string; meta: string; text: string }) {
  const steps = splitInstructionSteps(text);

  return (
    <div
      style={{
        borderRadius: '20px',
        background: 'rgba(244,251,249,0.96)',
        border: `1px solid ${AXIS_GREEN_THEME.border}`,
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
        <div style={{ fontSize: '15px', fontWeight: 900, color: '#111827', wordBreak: 'keep-all' }}>{title}</div>
        <div style={{ flexShrink: 0, fontSize: '12px', fontWeight: 800, color: AXIS_GREEN_THEME.text }}>{meta}</div>
      </div>
      <ol style={{ display: 'grid', gap: '7px', paddingLeft: '18px', fontSize: '13px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>
        {steps.map((step, index) => (
          <li key={`${title}-${index}`}>{step.replace(/^\d+\.\s*/, '')}</li>
        ))}
      </ol>
    </div>
  );
}

function ActionDetailOverlay({
  actionPlan,
  mode,
  onClose,
}: {
  actionPlan: ImmediateActionPlan;
  mode: ActionDetailMode;
  onClose: () => void;
}) {
  const detailByKey = new Map(actionPlan.detailContents.map((content) => [content.content_key, content]));
  const filteredItems =
    mode === 'all'
      ? actionPlan.items
      : actionPlan.items.filter((item, index) => item.rank === mode || index + 1 === mode);
  const visibleItems = filteredItems.length ? filteredItems : actionPlan.items.slice(0, 1);
  const groupedItems = visibleItems.map((item) => ({
    item,
    contents: dedupeContents(item.contentKeys.map((key) => detailByKey.get(key)).filter((content): content is ImmediateActionContent => Boolean(content))),
  }));
  const title = mode === 'all' ? '지금 해야 할 액션 전체' : mode === 1 ? '1순위 액션 상세' : '2순위 액션 상세';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(15,23,42,0.34)',
        backdropFilter: 'blur(14px)',
        padding: '18px',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '430px',
          maxHeight: '86vh',
          overflowY: 'auto',
          borderRadius: '30px',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(236,253,245,0.98) 100%)',
          border: `1px solid ${AXIS_GREEN_THEME.border}`,
          boxShadow: '0 28px 80px rgba(15,23,42,0.24)',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.16em', color: '#059669', marginBottom: '6px' }}>ACTION DETAIL</div>
            <h2 style={{ fontSize: '24px', lineHeight: 1.18, letterSpacing: '-0.045em', fontWeight: 900, color: '#111827' }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '999px',
              border: `1px solid ${AXIS_GREEN_THEME.border}`,
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#374151',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: '18px', paddingBottom: '10px' }}>
          {groupedItems.map(({ item, contents }, itemIndex) => (
            <section
              key={item.id}
              style={{
                borderRadius: '26px',
                background: '#ffffff',
                border: `1px solid ${itemIndex === 0 ? AXIS_GREEN_THEME.borderStrong : AXIS_GREEN_THEME.border}`,
                padding: '17px',
                boxShadow: '0 14px 30px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                <div
                  aria-hidden
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '9px',
                    border: `2px solid ${AXIS_GREEN_THEME.borderStrong}`,
                    background: itemIndex === 0 ? AXIS_GREEN_THEME.surface : '#ffffff',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: AXIS_GREEN_THEME.text, marginBottom: '5px' }}>{item.title}</div>
                  <h3 style={{ fontSize: '18px', lineHeight: 1.35, fontWeight: 900, color: '#111827', wordBreak: 'keep-all' }}>
                    {item.displayName}
                  </h3>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '14px' }}>
                {contents.map((content) => (
                  <div key={content.content_key}>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 900, color: AXIS_GREEN_THEME.text, marginBottom: '5px' }}>
                        {content.direction === 'both' ? '양쪽' : content.direction === 'right' ? '오른쪽' : content.direction === 'left' ? '왼쪽' : '공통'}
                      </div>
                      <h4 style={{ fontSize: '17px', lineHeight: 1.35, fontWeight: 900, color: '#111827', wordBreak: 'keep-all' }}>
                        {content.display_name}
                      </h4>
                      <div style={{ marginTop: '8px', display: 'inline-flex', borderRadius: '999px', background: AXIS_GREEN_THEME.surface, border: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '6px 10px', fontSize: '12px', fontWeight: 800, color: AXIS_GREEN_THEME.text }}>
                        타겟 근육: {content.target_muscle}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: '10px' }}>
                      <InstructionBlock
                        title={content.release_title}
                        meta={`${content.release_tool} · ${content.release_duration_sec ?? 90}초`}
                        text={content.release_content}
                      />
                      <InstructionBlock
                        title={content.stretch_title}
                        meta={`${content.stretch_duration_sec ?? 30}초 × ${content.sets ?? 3}세트`}
                        text={content.stretch_content}
                      />
                    </div>

                    {content.caution && (
                      <div
                        style={{
                          marginTop: '10px',
                          borderRadius: '16px',
                          background: 'rgba(255,251,235,0.88)',
                          border: '1px solid rgba(245,158,11,0.22)',
                          padding: '12px',
                          fontSize: '12px',
                          lineHeight: 1.6,
                          color: '#92400e',
                          wordBreak: 'keep-all',
                        }}
                      >
                        주의: {content.caution}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CodePlanDetailContent({ data, hideGuideSection = false }: CodePlanDetailContentProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [actionDetailOpen, setActionDetailOpen] = useState(false);
  const [actionDetailMode, setActionDetailMode] = useState<ActionDetailMode>(1);
  const [missionProgress, setMissionProgress] = useState<MissionProgress>(0);
  const routineItems = useMemo(() => buildFifteenMinuteRoutine(data.content?.exercises), [data.content?.exercises]);
  const missionStatus =
    missionProgress === 100 ? '액션 확인 완료' : missionProgress === 50 ? '1순위 확인 완료' : '오늘 시작 전';
  const nextActionLabel =
    missionProgress === 100 ? '완료한 액션 전체 보기' : missionProgress === 50 ? '남은 2순위 액션 보기' : '1순위 액션 먼저 보기';

  const updateMissionProgress = useCallback((progress: MissionProgress) => {
    setMissionProgress((current) => (progress > current ? progress : current));
  }, []);

  const openActionDetailByProgress = useCallback(() => {
    if (data.actionPlan.detailContents.length === 0) return;
    const nextMode: ActionDetailMode = missionProgress === 100 ? 'all' : missionProgress === 50 ? 2 : 1;
    setActionDetailMode(nextMode);
    if (nextMode === 1) {
      updateMissionProgress(50);
    } else if (nextMode === 2) {
      updateMissionProgress(100);
    }
    setActionDetailOpen(true);
  }, [data.actionPlan.detailContents.length, missionProgress, updateMissionProgress]);

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <section
        style={{
          borderRadius: '30px',
          background: 'rgba(255,255,255,0.84)',
          boxShadow: '0 22px 46px rgba(15, 23, 42, 0.10)',
          backdropFilter: 'blur(20px)',
          padding: '18px',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#059669', marginBottom: '12px' }}>코드 상태 창</div>
        <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '15px', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                width: '96px',
                height: '108px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(255,255,255,0.96) 100%)',
                border: '1px solid rgba(209,250,229,0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: '0 14px 26px rgba(15, 23, 42, 0.08)',
                marginBottom: '9px',
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
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#059669' }}>{data.bodyCode}</div>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', lineHeight: 1, fontWeight: 900, letterSpacing: '-0.04em', color: '#111827', marginBottom: '5px' }}>{data.bodyCode}</div>
              <div style={{ fontSize: '12px', lineHeight: 1.35, fontWeight: 800, color: '#374151', wordBreak: 'keep-all' }}>{data.characterName}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '11px', minWidth: 0 }}>
            {data.axisRows.map((row) => (
              <div key={row.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '5px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: '#111827' }}>{row.labelLeft}</div>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: '#111827' }}>{row.labelRight}</div>
                </div>
                <div style={{ display: 'flex', height: '12px', borderRadius: '999px', overflow: 'hidden', background: '#eef4f2' }}>
                  <div style={{ width: `${row.percentLeft}%`, background: AXIS_GREEN_THEME.soft }} />
                  <div style={{ width: `${row.percentRight}%`, background: AXIS_GREEN_THEME.primary }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '5px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#7c8794' }}>{row.percentLeft}%</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#7c8794' }}>{row.percentRight}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: '16px',
            borderRadius: '20px',
            background: 'rgba(228,244,240,0.86)',
            border: `1px solid ${AXIS_GREEN_THEME.border}`,
            padding: '16px 18px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 900, color: '#059669', marginBottom: '7px' }}>한 줄 이해</div>
          <div style={{ fontSize: '15px', lineHeight: 1.65, fontWeight: 800, color: '#111827', wordBreak: 'keep-all' }}>{data.summaryLine}</div>
        </div>
      </section>

      <section
        role="button"
        tabIndex={0}
        aria-label={nextActionLabel}
        onClick={openActionDetailByProgress}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openActionDetailByProgress();
          }
        }}
        style={{
          borderRadius: '24px',
          border: `1px solid ${AXIS_GREEN_THEME.border}`,
          background: '#ffffff',
          padding: '18px',
          cursor: data.actionPlan.detailContents.length > 0 ? 'pointer' : 'default',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '8px' }}>MISSION</div>
        <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#111827', marginBottom: '14px' }}>오늘의 미션 수행률</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '40px', lineHeight: 1, fontWeight: 900, color: '#111827' }}>{missionProgress}%</div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: missionProgress > 0 ? AXIS_GREEN_THEME.text : '#6b7280' }}>{missionStatus}</div>
        </div>
        <div style={{ height: '14px', borderRadius: '999px', background: AXIS_GREEN_THEME.track, overflow: 'hidden' }}>
          <div
            style={{
              width: `${missionProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
              transition: 'width 260ms ease',
            }}
          />
        </div>
      </section>

      <section
        style={{
          borderRadius: '24px',
          border: `1px solid ${AXIS_GREEN_THEME.border}`,
          background: '#ffffff',
          padding: '19px 18px',
        }}
      >
        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.16em', color: '#059669', marginBottom: '6px' }}>ACTION</div>
            <h2 style={{ fontSize: '20px', lineHeight: 1.2, fontWeight: 900, color: '#111827' }}>지금 해야 할 액션</h2>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {data.actionPlan.items.length > 0 ? (
              data.actionPlan.items.map((item, index) => {
                const isCompleted = (index === 0 && missionProgress >= 50) || (index === 1 && missionProgress >= 100);
                const statusLabel =
                  missionProgress === 100
                    ? '전체 보기'
                    : missionProgress === 50
                      ? index === 1
                        ? '남은 액션'
                        : '완료'
                      : index === 0
                        ? '먼저 확인'
                        : '다음 확인';

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={openActionDetailByProgress}
                    disabled={data.actionPlan.detailContents.length === 0}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: '30px 1fr auto',
                      alignItems: 'center',
                      gap: '13px',
                      borderRadius: '20px',
                      background: index === 0 ? 'rgba(244,251,249,0.98)' : 'rgba(228,244,240,0.9)',
                      border: `1px solid ${index === 0 ? AXIS_GREEN_THEME.border : AXIS_GREEN_THEME.borderStrong}`,
                      padding: '17px 15px',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      cursor: data.actionPlan.detailContents.length > 0 ? 'pointer' : 'default',
                      boxShadow: index === 0 ? '0 12px 24px rgba(15, 23, 42, 0.05)' : 'none',
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '10px',
                        border: `2px solid ${isCompleted ? AXIS_GREEN_THEME.primary : '#cbd5e1'}`,
                        background: isCompleted ? 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' : '#ffffff',
                        boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.85)',
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '12px', fontWeight: 900, color: index === 0 ? '#6b7280' : AXIS_GREEN_THEME.text }}>
                          {item.title}
                        </div>
                        <div
                          style={{
                            borderRadius: '999px',
                            background: isCompleted ? 'rgba(16,185,129,0.12)' : '#ffffff',
                            border: `1px solid ${isCompleted ? AXIS_GREEN_THEME.borderStrong : AXIS_GREEN_THEME.border}`,
                            padding: '4px 8px',
                            fontSize: '10px',
                            lineHeight: 1,
                            fontWeight: 900,
                            color: isCompleted ? '#059669' : '#7c8794',
                          }}
                        >
                          {statusLabel}
                        </div>
                      </div>
                      <div style={{ fontSize: '17px', lineHeight: 1.36, fontWeight: 900, color: '#111827', wordBreak: 'keep-all' }}>
                        {item.displayName}
                      </div>
                    </div>
                    <div style={{ display: 'grid', justifyItems: 'end', gap: '8px', flexShrink: 0 }}>
                      {typeof item.percent === 'number' && (
                        <div style={{ fontSize: '12px', fontWeight: 900, color: '#7c8794' }}>{item.percent}%</div>
                      )}
                      {data.actionPlan.detailContents.length > 0 && <ChevronRight size={18} color="#7c8794" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div
                style={{
                  borderRadius: '16px',
                  background: 'rgba(244,251,249,0.96)',
                  border: `1px solid ${AXIS_GREEN_THEME.border}`,
                  padding: '14px',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: '#6b7280',
                  wordBreak: 'keep-all',
                }}
              >
                {data.actionPlan.summary}
              </div>
            )}
          </div>

          {data.actionPlan.items.length > 0 && (
            <p style={{ fontSize: '14px', lineHeight: 1.72, color: '#4b5563', wordBreak: 'keep-all' }}>{data.actionPlan.summary}</p>
          )}
        </div>
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
            padding: '22px 20px',
            background: routineOpen ? 'rgba(228,244,240,0.84)' : '#ffffff',
            cursor: 'pointer',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#059669', marginBottom: '7px' }}>ROUTINE</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#111827', marginBottom: '6px' }}>맞춤 15분 케어 루틴</div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#6b7280' }}>총 15분 · {routineItems.length}단계 구성</div>
          </div>
          {routineOpen ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
        </button>
        {routineOpen && (
          <div style={{ borderTop: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '18px 20px 22px', display: 'grid', gap: '18px' }}>
            {routineItems.length > 0 ? (
              routineItems.map((exercise, index) => (
                <div
                  key={`${exercise.title}-${index}`}
                  style={{
                    borderRadius: '24px',
                    background: 'rgba(244,251,249,0.95)',
                    border: `1px solid ${AXIS_GREEN_THEME.border}`,
                    padding: '22px 20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 900, color: AXIS_GREEN_THEME.text, marginBottom: '7px' }}>
                        STEP {index + 1}
                      </div>
                      <div style={{ fontSize: '19px', lineHeight: 1.35, fontWeight: 900, color: '#111827', wordBreak: 'keep-all' }}>{exercise.title}</div>
                    </div>
                    <div style={{ flexShrink: 0, borderRadius: '999px', background: AXIS_GREEN_THEME.surface, border: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '7px 11px', fontSize: '13px', fontWeight: 900, color: '#059669' }}>
                      {exercise.durationMinutes}분
                    </div>
                  </div>
                  <div style={{ fontSize: '15px', lineHeight: 1.75, color: '#4b5563', wordBreak: 'keep-all' }}>{exercise.desc}</div>
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

      {actionDetailOpen && data.actionPlan.detailContents.length > 0 && (
        <ActionDetailOverlay
          actionPlan={data.actionPlan}
          mode={actionDetailMode}
          onClose={() => setActionDetailOpen(false)}
        />
      )}
    </div>
  );
}
