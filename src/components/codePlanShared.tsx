import { useOverlayBack } from '../utils/useOverlayBack';
import { readTimerProgress, saveTimerProgress } from '../lib/timerProgress';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Gift, Pause, Play, RotateCcw, X } from 'lucide-react';
import {
  claimRoutineBonus,
  claimRoutineReward,
  fetchTodayRoutineBonus,
  fetchTodayRoutineReward,
  REWARD_UNAVAILABLE,
} from '../api/routineReward';
import { fetchAdRewardConfig } from '../api/billing';
import { supabase } from '../lib/supabase';
import { isNativeApp, showRewarded } from '../lib/ads';
import { AdSlot } from './AdSlot';
import { RewardDice } from './RewardDice';
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
import { PRODUCT } from '../theme/copy';
import { characterNames, getAxisScoreBreakdown, type AnswerMap } from '../utils/bodyCodeCalculator';
import { buildCareRoutine, formatRoutineDuration, type CareRoutine } from '../utils/careRoutine';
import { LOCAL_FALLBACK_CHARACTER_IMAGE, resolveCharacterImageUrl } from '../utils/characterImages';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';

/** 15분 케어 루틴 완료 기록 — KST 하루 단위로 localStorage 에만 저장합니다(서버 스키마 변경 없음). */
const CARE_ROUTINE_STORAGE_PREFIX = 'mebody.careRoutine.v1';

function kstDayKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60_000);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
}

function careRoutineStorageKey(bodyCode: string | null | undefined): string {
  return `${CARE_ROUTINE_STORAGE_PREFIX}:${bodyCode || 'unknown'}:${kstDayKey()}`;
}

type CareRoutineRecord = { done: string[]; completedAt: string | null };

function readCareRoutineRecord(key: string): CareRoutineRecord {
  if (typeof window === 'undefined') return { done: [], completedAt: null };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { done: [], completedAt: null };
    const parsed = JSON.parse(raw) as Partial<CareRoutineRecord>;
    return {
      done: Array.isArray(parsed.done) ? parsed.done.filter((v): v is string => typeof v === 'string') : [],
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
    };
  } catch {
    return { done: [], completedAt: null };
  }
}

function writeCareRoutineRecord(key: string, record: CareRoutineRecord) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    /* 사파리 프라이빗 모드 등 저장 불가 환경은 화면 상태만 유지한다 */
  }
}

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
  actionPlan: ImmediateActionPlan;
  /** 4축 기반 15분 루틴. 데이터가 없으면 steps 가 비고 기존 exercises 폴백을 씁니다. */
  careRoutine: CareRoutine;
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
    title: `공통 ${rank}`,
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
    title: '먼저 할 스트레칭',
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
      summary: '결과 데이터를 불러오면 오늘의 공통 스트레칭 순서를 계산합니다.',
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
  const characterName = content?.character_name || characterNames[bodyCode] || `나의 ${PRODUCT.codeName}`;
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

  const actionPlan = useMemo(
    () => buildImmediateActionPlan(result?.answers, axisRows, immediateActionData),
    [axisRows, immediateActionData, result?.answers],
  );

  // 15분 루틴: 순서는 목→어깨→골반→하체 고정, 우선순위는 세트 수로 반영
  const careRoutine = useMemo(() => {
    if (axisRows.length === 0) return { steps: [], totalSec: 0, coversAllAxes: false };
    const priorityOrder = getSortedAxisCandidates(axisRows).map((row) => row.axisLookupKey);
    return buildCareRoutine(axisRows, immediateActionData.axisMappings, immediateActionData.contents, priorityOrder);
  }, [axisRows, immediateActionData]);

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
    actionPlan,
    careRoutine,
    handleImageError,
  };
}

/** Journey 가 연결된 경우에만 전달합니다. 없으면 기존 로컬 수행률 동작을 그대로 유지합니다. */
export interface CodePlanJourneyProgress {
  progress: number;
  dayNo: number;
  totalDays: number;
  completed: number;
  total: number;
  onOpen?: () => void;
}

interface CodePlanDetailContentProps {
  /** 적립은 회원만 가능합니다. 비회원에게는 안내만 보여줍니다. */
  isLoggedIn?: boolean;
  /** 활성 구독 보유 — true 면 광고를 렌더하지 않습니다 */
  isPaid?: boolean;
  /** routineOnly 면 공통 스트레칭 블록만 렌더합니다(미션 탭). */
  variant?: 'full' | 'routineOnly';
  data: Pick<CodePlanDataState, 'bodyCode' | 'content' | 'summaryLine' | 'characterName' | 'characterImage' | 'axisRows' | 'guideBlocks' | 'actionPlan' | 'careRoutine' | 'handleImageError'>;
  hideGuideSection?: boolean;
  journeyProgress?: CodePlanJourneyProgress;
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

/** 동작 이미지. URL 이 없거나 로딩 실패하면 아무것도 그리지 않는다(텍스트만 남음). */
function ActionImage({ url, alt }: { url?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return null;

  return (
    <div
      style={{
        borderRadius: '14px',
        overflow: 'hidden',
        border: `1px solid ${AXIS_GREEN_THEME.border}`,
        background: '#ffffff',
        marginBottom: '10px',
      }}
    >
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: '100%', display: 'block' }}
      />
    </div>
  );
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
  const closeOverlay = useOverlayBack(true, onClose);
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
  const title = mode === 'all' ? '공통 스트레칭 전체' : mode === 1 ? '먼저 할 스트레칭' : '이어서 할 스트레칭';
  const actionDetailScrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      onClick={closeOverlay}
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
          position: 'relative',
          width: '100%',
          maxWidth: '430px',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderRadius: '30px',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(236,253,245,0.98) 100%)',
          border: `1px solid ${AXIS_GREEN_THEME.border}`,
          boxShadow: '0 28px 80px rgba(15,23,42,0.24)',
          overflow: 'hidden',
        }}
      >
        <div
          ref={actionDetailScrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '20px',
          }}
        >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.16em', color: '#014725', marginBottom: '6px' }}>COMMON STRETCH</div>
            <h2 style={{ fontSize: '24px', lineHeight: 1.18, letterSpacing: '-0.045em', fontWeight: 900, color: '#111827' }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeOverlay}
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
        <ScrollIndicator containerRef={actionDetailScrollRef} bottomOffset="30px" />
      </div>
    </div>
  );
}

/**
 * 코드 플랜 하단의 14일 저니 진입 카드.
 * 코드 플랜 화면과 랜딩 모달이 같은 진입점을 쓰도록 여기서 한 벌만 정의합니다.
 * 진행 중인 저니가 있으면 인트로를 건너뛰고 바로 오늘의 미션으로 보냅니다.
 */
export function JourneyEntryCard({
  hasActiveJourney,
  dayNo,
  totalDays,
  onOpen,
}: {
  hasActiveJourney: boolean;
  dayNo?: number;
  totalDays?: number;
  onOpen: () => void;
}) {
  return (
    <section
      style={{
        borderRadius: '24px',
        border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
        background: 'linear-gradient(135deg, rgba(232,245,238,0.96) 0%, rgba(255,255,255,0.98) 100%)',
        padding: '20px 18px',
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#014725', marginBottom: '6px' }}>
        {hasActiveJourney ? `IN PROGRESS · DAY ${dayNo ?? 1} / ${totalDays ?? 14}` : 'NEXT'}
      </div>
      <h2 style={{ fontSize: '19px', fontWeight: 900, color: '#111827', marginBottom: '8px' }}>
        {hasActiveJourney ? '오늘의 내 코드 미션이 준비됐습니다' : '내 코드에 맞는 14일 미션 시작하기'}
      </h2>
      <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#4b5563', wordBreak: 'keep-all', marginBottom: '14px' }}>
        {hasActiveJourney
          ? '진행 중인 14일 관리가 있습니다. 바로 오늘 미션으로 이어집니다.'
          : '위 공통 스트레칭과 별개로, 내 코드와 관리 우선순위에 맞춘 미션이 하루 한 가지씩 배정됩니다.'}
      </p>
      <button
        type="button"
        onClick={onOpen}
        style={{
          display: 'inline-flex',
          width: '100%',
          height: '52px',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          borderRadius: '16px',
          border: 'none',
          background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
          color: '#ffffff',
          fontSize: '15px',
          fontWeight: 800,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        {hasActiveJourney ? '오늘의 내 코드 미션 하러 가기' : '14일 관리 시작하기'}
        <ChevronRight size={18} />
      </button>
    </section>
  );
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 단계 타이머 — 미션 화면(JourneyMissionScreen)과 같은 방식입니다.
 * 시작하면 그 단계의 시간만큼 카운트다운하고, 0 이 되면 자동으로 완료 체크됩니다.
 * 감소는 타이머가, 완료 처리는 별도 effect 가 합니다(업데이터 안에서 부작용을 일으키지 않도록).
 */
function RoutineStepTimer({
  storageKey,
  done,
  durationSec,
  onToggle,
  onComplete,
}: {
  storageKey: string;
  done: boolean;
  durationSec: number;
  onToggle: () => void;
  onComplete: () => void;
}) {
  const initial = useRef(readTimerProgress(storageKey, durationSec)).current;
  const [remaining, setRemaining] = useState(initial.remaining);
  // Leaving a screen pauses the timer; returning requires an explicit resume.
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(initial.started);
  const wasDone = useRef(done);
  useEffect(() => {
    if (wasDone.current && !done) {
      setRemaining(durationSec);
      setRunning(false);
      setStarted(false);
    }
    wasDone.current = done;
  }, [done, durationSec]);
  useEffect(() => {
    saveTimerProgress(storageKey, { remaining, started });
  }, [storageKey, remaining, started]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      setRemaining((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  // 0 이 되면 자동 완료.
  useEffect(() => {
    if (!running || remaining > 0) return;
    setRunning(false);
    if (!done) onComplete();
  }, [running, remaining, done, onComplete]);

  if (done) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed
        style={{
          marginTop: '14px',
          display: 'inline-flex',
          width: '100%',
          height: '44px',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '7px',
          borderRadius: '14px',
          border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
          background: 'rgba(1,71,37,0.08)',
          color: '#014725',
          fontSize: '13px',
          fontWeight: 900,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        <Check size={15} />
        완료함
      </button>
    );
  }

  const progress = durationSec > 0 ? ((durationSec - remaining) / durationSec) * 100 : 0;

  return (
    <div style={{ marginTop: '14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '8px',
        }}
      >
        <div
          aria-live="polite"
          style={{
            fontSize: '26px',
            lineHeight: 1,
            fontWeight: 900,
            color: started ? '#014725' : '#9ca3af',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatClock(remaining)}
        </div>
        <button
          type="button"
          onClick={() => {
            setStarted(true);
            setRunning((v) => !v);
          }}
          style={{
            display: 'inline-flex',
            height: '40px',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            borderRadius: '999px',
            border: 'none',
            background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
            padding: '0 18px',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 900,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {running ? (
            <>
              <Pause size={14} />
              일시정지
            </>
          ) : (
            <>
              <Play size={14} />
              {started ? '이어서 하기' : '시작하기'}
            </>
          )}
        </button>
      </div>
      <div style={{ height: '8px', borderRadius: '999px', background: AXIS_GREEN_THEME.track, overflow: 'hidden' }}>
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
            transition: 'width 900ms linear',
          }}
        />
      </div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          marginTop: '8px',
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: '4px',
          fontSize: '12px',
          fontWeight: 800,
          color: '#9ca3af',
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        타이머 없이 완료 처리
      </button>
    </div>
  );
}

export function CodePlanDetailContent({ data, hideGuideSection = false, isLoggedIn = false, isPaid = false, variant = 'full', journeyProgress }: CodePlanDetailContentProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');

  const [guideOpen, setGuideOpen] = useState(false);
  // 공통 스트레칭은 항상 접힌 상태로 시작합니다.
  // 5단계가 길어서 펼쳐진 채로 두면 아래의 14일 관리 진입이 한참 밀립니다.
  const [routineOpen, setRoutineOpen] = useState(false);
  const [actionDetailOpen, setActionDetailOpen] = useState(false);
  const [actionDetailMode, setActionDetailMode] = useState<ActionDetailMode>(1);
  const [missionProgress, setMissionProgress] = useState<MissionProgress>(0);
  // 4축 루틴이 조합되면 그것을 쓰고, 데이터가 없을 때만 기존 exercises 폴백을 쓴다
  const useAxisRoutine = data.careRoutine.steps.length > 0;
  const routineItems = useMemo(
    () => (useAxisRoutine ? [] : buildFifteenMinuteRoutine(data.content?.exercises)),
    [useAxisRoutine, data.content?.exercises],
  );
  const routineStepCount = useAxisRoutine ? data.careRoutine.steps.length : routineItems.length;
  const routineTotalLabel = useAxisRoutine ? formatRoutineDuration(data.careRoutine.totalSec) : '15분';

  // 15분 케어 루틴 완료 체크 (KST 하루 단위, localStorage)
  const routineStorageKey = careRoutineStorageKey(data.bodyCode);
  const routineStepKeys = useMemo(
    () =>
      useAxisRoutine
        ? data.careRoutine.steps.map((step) => `${step.kind}-${step.order}`)
        : routineItems.map((item, index) => `legacy-${index}`),
    [useAxisRoutine, data.careRoutine.steps, routineItems],
  );
  const [routineRecord, setRoutineRecord] = useState<CareRoutineRecord>(() => readCareRoutineRecord(routineStorageKey));
  useEffect(() => {
    setRoutineRecord(readCareRoutineRecord(routineStorageKey));
  }, [routineStorageKey]);

  const routineDoneCount = routineStepKeys.filter((key) => routineRecord.done.includes(key)).length;
  const routineAllDone = routineStepCount > 0 && routineDoneCount === routineStepCount;
  const routineCompleted = Boolean(routineRecord.completedAt);

  const persistRoutineRecord = useCallback(
    (next: CareRoutineRecord) => {
      setRoutineRecord(next);
      writeCareRoutineRecord(routineStorageKey, next);
    },
    [routineStorageKey],
  );

  const toggleRoutineStep = useCallback(
    (stepKey: string) => {
      const done = routineRecord.done.includes(stepKey)
        ? routineRecord.done.filter((key) => key !== stepKey)
        : [...routineRecord.done, stepKey];
      // 단계를 다시 해제하면 완료 상태도 함께 풀린다
      persistRoutineRecord({ done, completedAt: done.length === routineStepKeys.length ? routineRecord.completedAt : null });
    },
    [persistRoutineRecord, routineRecord, routineStepKeys.length],
  );

  const markRoutineStepDone = useCallback(
    (stepKey: string) => {
      if (routineRecord.done.includes(stepKey)) return;
      persistRoutineRecord({ done: [...routineRecord.done, stepKey], completedAt: routineRecord.completedAt });
    },
    [persistRoutineRecord, routineRecord],
  );

  const completeRoutine = useCallback(() => {
    persistRoutineRecord({ done: [...routineStepKeys], completedAt: new Date().toISOString() });
  }, [persistRoutineRecord, routineStepKeys]);

  const resetRoutine = useCallback(() => {
    persistRoutineRecord({ done: [], completedAt: null });
  }, [persistRoutineRecord]);

  // 주사위 적립 — 눈과 금액은 전부 서버가 정합니다. 하루 1회, 한국시간 오전 5시 기준.
  const [rewardDice, setRewardDice] = useState<number | null>(null);
  const [rewardAmount, setRewardAmount] = useState<number | null>(null);
  const [rewardRolling, setRewardRolling] = useState(false);
  const [rewardClaimedToday, setRewardClaimedToday] = useState(false);
  const [rewardNotice, setRewardNotice] = useState<string | null>(null);

  // 광고 보너스 — 기본 적립을 받은 무료 회원만. 유료 회원은 서버가 거부합니다.
  const [bonusEligible, setBonusEligible] = useState(false);
  const [bonusDice, setBonusDice] = useState<number | null>(null);
  const [bonusAmount, setBonusAmount] = useState<number | null>(null);
  const [bonusRolling, setBonusRolling] = useState(false);
  const [bonusNotice, setBonusNotice] = useState<string | null>(null);
  /** setTimeout 안에서 최신 값을 봐야 해서 ref 로도 들고 있습니다. */
  const bonusEligibleRef = useRef(false);
  useEffect(() => {
    bonusEligibleRef.current = bonusEligible;
  }, [bonusEligible]);

  const refreshBonus = useCallback(async () => {
    if (!isLoggedIn) return;
    const status = await fetchTodayRoutineBonus();
    if (!status) return;
    setBonusEligible(status.eligible);
    if (status.claimed) {
      setBonusDice(status.dice);
      setBonusAmount(status.amount);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    void refreshBonus();
  }, [refreshBonus, routineStorageKey]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    void (async () => {
      const today = await fetchTodayRoutineReward();
      if (cancelled || !today?.claimed) return;
      setRewardClaimedToday(true);
      setRewardDice(today.dice);
      setRewardAmount(today.amount);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, routineStorageKey]);

  const completeRoutineWithReward = useCallback(() => {
    completeRoutine();
    if (!isLoggedIn) {
      setRewardNotice('적립은 회원만 받을 수 있습니다. 로그인하면 다음 완료부터 주사위를 굴립니다.');
      return;
    }
    if (rewardClaimedToday) return;

    setRewardRolling(true);
    setRewardNotice(null);
    void (async () => {
      const started = Date.now();
      const result = await claimRoutineReward();
      // 주사위가 도는 게 보이도록 최소 900ms 는 굴립니다.
      const wait = Math.max(0, 900 - (Date.now() - started));
      window.setTimeout(() => {
        setRewardRolling(false);
        if (result === REWARD_UNAVAILABLE) {
          setRewardNotice('적립 기능을 준비 중입니다. 완료 기록은 저장되었습니다.');
          return;
        }
        if (!result) {
          setRewardNotice('적립을 처리하지 못했습니다. 완료 기록은 저장되었습니다.');
          return;
        }
        setRewardDice(result.dice);
        setRewardAmount(result.amount);
        setRewardClaimedToday(true);
        void refreshBonus();
        // 다 끝났으면 접어서 다음 할 일(14일 관리)이 바로 보이게 합니다.
        // 보너스 버튼이 있으면 그건 보여줘야 하므로 접지 않습니다.
        window.setTimeout(() => {
          setRoutineOpen((open) => (bonusEligibleRef.current ? open : false));
        }, 2200);
        if (result.alreadyClaimed) {
          setRewardNotice('오늘 적립은 이미 받으셨습니다. 내일 오전 5시에 다시 굴릴 수 있습니다.');
        }
      }, wait);
    })();
  }, [completeRoutine, isLoggedIn, rewardClaimedToday, refreshBonus]);
  const displayProgress = journeyProgress ? journeyProgress.progress : missionProgress;
  const missionStatus = journeyProgress
    ? journeyProgress.total === 0
      ? '오늘 배정된 미션 없음'
      : `${journeyProgress.completed} / ${journeyProgress.total} 완료`
    : missionProgress === 100
      ? '공통 스트레칭 확인 완료'
      : missionProgress === 50
        ? '1순위 확인 완료'
        : '오늘 시작 전';
  const nextActionLabel =
    missionProgress === 100 ? '공통 스트레칭 전체 보기' : missionProgress === 50 ? '이어서 할 스트레칭 보기' : '먼저 할 스트레칭 보기';

  const updateMissionProgress = useCallback((progress: MissionProgress) => {
    setMissionProgress((current) => (progress > current ? progress : current));
  }, []);

  const watchAdForBonus = useCallback(() => {
    setBonusRolling(true);
    setBonusNotice(null);
    void (async () => {
      // 서버 검증(SSV)이 켜져 있으면 AdMob 이 우리 서버로 직접 콜백을 보냅니다.
      // 그때는 앱이 보너스를 청구하지 않고 서버가 지급한 결과를 읽기만 합니다 —
      // 광고를 실제로 봤는지 판단하는 주체가 앱에서 서버로 옮겨갑니다.
      const [{ ssvEnabled }, session] = await Promise.all([
        fetchAdRewardConfig(),
        supabase.auth.getSession(),
      ]);
      const userId = session.data.session?.user?.id;

      const outcome = await showRewarded(
        ssvEnabled && userId ? { userId, customData: 'routine_bonus' } : undefined,
      );
      if (outcome !== 'rewarded') {
        setBonusRolling(false);
        setBonusNotice(
          outcome === 'unavailable'
            ? '지금은 볼 수 있는 광고가 없습니다. 기본 적립은 이미 받으셨어요.'
            : '광고를 끝까지 보셔야 보너스를 받을 수 있어요.',
        );
        return;
      }

      if (ssvEnabled && userId) {
        // 콜백은 광고가 닫힌 직후에 도착합니다. 몇 번 확인해 보고, 그래도 없으면
        // 나중에 반영된다고 안내합니다(원장에는 서버가 남깁니다).
        for (let attempt = 0; attempt < 6; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 700));
          const status = await fetchTodayRoutineBonus();
          if (status?.claimed) {
            setBonusRolling(false);
            setBonusDice(status.dice ?? null);
            setBonusAmount(status.amount ?? null);
            setBonusEligible(false);
            return;
          }
        }
        setBonusRolling(false);
        setBonusNotice('보너스 확인이 조금 늦어지고 있어요. 잠시 후 다시 열어보시면 반영돼 있습니다.');
        return;
      }

      const result = await claimRoutineBonus();
      setBonusRolling(false);
      if (result === REWARD_UNAVAILABLE || !result) {
        setBonusNotice('보너스를 처리하지 못했습니다. 기본 적립은 그대로 유지됩니다.');
        return;
      }
      setBonusDice(result.dice);
      setBonusAmount(result.amount);
      setBonusEligible(false);
      if (result.alreadyClaimed) {
        setBonusNotice('오늘 보너스는 이미 받으셨습니다.');
      }
    })();
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

  // 공통 스트레칭 블록. 미션 탭이 이것만 따로 쓸 수 있게 변수로 빼둡니다.
  const routineSection = (
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
              <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#014725', marginBottom: '7px' }}>COMMON</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#111827', marginBottom: '6px' }}>매일 하는 공통 스트레칭</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#6b7280' }}>
                총 {routineTotalLabel} · {routineStepCount}단계
                {useAxisRoutine ? ' · 목에서 하체 순서' : ' 구성'}
              </div>
              {routineStepCount > 0 && (routineCompleted || routineDoneCount > 0) && (
                <div
                  style={{
                    marginTop: '9px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    borderRadius: '999px',
                    background: routineCompleted ? 'rgba(1,71,37,0.10)' : '#ffffff',
                    border: `1px solid ${routineCompleted ? AXIS_GREEN_THEME.borderStrong : AXIS_GREEN_THEME.border}`,
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 900,
                    color: '#014725',
                  }}
                >
                  {routineCompleted ? (
                    <>
                      <CheckCircle2 size={13} />
                      오늘 완료
                    </>
                  ) : (
                    `${routineDoneCount} / ${routineStepCount} 단계`
                  )}
                </div>
              )}
            </div>
            {routineOpen ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
          </button>
          {routineOpen && (
            <div style={{ borderTop: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '18px 20px 22px', display: 'grid', gap: '18px' }}>
              {useAxisRoutine ? (
                <>
                  <div
                    style={{
                      borderRadius: '16px',
                      background: 'rgba(228,244,240,0.86)',
                      border: `1px solid ${AXIS_GREEN_THEME.border}`,
                      padding: '13px 15px',
                      fontSize: '12px',
                      lineHeight: 1.65,
                      fontWeight: 700,
                      color: '#014725',
                      wordBreak: 'keep-all',
                    }}
                  >
                    누구나 4축(목 → 어깨 → 골반 → 하체)을 같은 순서로 전부 합니다. 코드에 따라 달라지는 건 순서가 아니라 세트 수예요. 내 코드에 맞는 개별 미션은 14일 관리에서 하루 한 가지씩 따로 나갑니다.
                  </div>
                  {data.careRoutine.steps.map((step) => (
                    <div
                      key={`${step.kind}-${step.order}`}
                      style={{
                        borderRadius: '24px',
                        background: step.kind === 'finish' ? 'rgba(248,252,248,0.95)' : 'rgba(244,251,249,0.95)',
                        border: `1px solid ${step.priorityRank ? AXIS_GREEN_THEME.borderStrong : AXIS_GREEN_THEME.border}`,
                        padding: '22px 20px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '7px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 900, color: AXIS_GREEN_THEME.text }}>
                              STEP {step.order}
                              {step.axisLabel ? ` · ${step.axisLabel}` : ''}
                            </span>
                            {step.priorityRank && (
                              <span
                                style={{
                                  borderRadius: '999px',
                                  background: 'rgba(1,71,37,0.10)',
                                  border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
                                  padding: '3px 8px',
                                  fontSize: '10px',
                                  lineHeight: 1,
                                  fontWeight: 900,
                                  color: '#014725',
                                }}
                              >
                                {step.priorityRank}순위 집중
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '19px', lineHeight: 1.35, fontWeight: 900, color: '#111827', wordBreak: 'keep-all' }}>
                            {step.title}
                          </div>
                        </div>
                        <div style={{ flexShrink: 0, borderRadius: '999px', background: AXIS_GREEN_THEME.surface, border: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '7px 11px', fontSize: '13px', fontWeight: 900, color: '#014725' }}>
                          {formatRoutineDuration(step.durationSec)}
                        </div>
                      </div>

                      {step.kind === 'finish' ? (
                        <div style={{ fontSize: '15px', lineHeight: 1.75, color: '#4b5563', wordBreak: 'keep-all' }}>{step.desc}</div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {step.targetMuscle && (
                              <span style={{ borderRadius: '999px', background: '#ffffff', border: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '5px 10px', fontSize: '11px', fontWeight: 800, color: '#4b5563' }}>
                                타겟: {step.targetMuscle}
                              </span>
                            )}
                            {step.tool && (
                              <span style={{ borderRadius: '999px', background: '#ffffff', border: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '5px 10px', fontSize: '11px', fontWeight: 800, color: '#4b5563' }}>
                                도구: {step.tool}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'grid', gap: '10px' }}>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 900, color: AXIS_GREEN_THEME.text, marginBottom: '6px' }}>
                                이완 {step.releaseSec}초
                              </div>
                              <ActionImage url={step.releaseImageUrl} alt={`${step.title} 이완 동작`} />
                              <ol style={{ display: 'grid', gap: '5px', paddingLeft: '18px', fontSize: '14px', lineHeight: 1.7, color: '#4b5563', wordBreak: 'keep-all' }}>
                                {(step.releaseSteps ?? []).map((line, index) => (
                                  <li key={index}>{line}</li>
                                ))}
                              </ol>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 900, color: AXIS_GREEN_THEME.text, marginBottom: '6px' }}>
                                스트레칭 {step.stretchSec}초 × {step.sets}세트
                              </div>
                              <ActionImage url={step.stretchImageUrl} alt={`${step.title} 스트레칭 동작`} />
                              <ol style={{ display: 'grid', gap: '5px', paddingLeft: '18px', fontSize: '14px', lineHeight: 1.7, color: '#4b5563', wordBreak: 'keep-all' }}>
                                {(step.stretchSteps ?? []).map((line, index) => (
                                  <li key={index}>{line}</li>
                                ))}
                              </ol>
                            </div>
                          </div>
                          {step.caution && (
                            <div
                              style={{
                                marginTop: '12px',
                                borderRadius: '14px',
                                background: 'rgba(255,251,235,0.88)',
                                border: '1px solid rgba(245,158,11,0.22)',
                                padding: '11px 12px',
                                fontSize: '12px',
                                lineHeight: 1.6,
                                color: '#92400e',
                                wordBreak: 'keep-all',
                              }}
                            >
                              주의: {step.caution}
                            </div>
                          )}
                        </>
                      )}
                      <RoutineStepTimer
                        key={`${routineStorageKey}:${step.kind}-${step.order}:${step.durationSec}`}
                        storageKey={`${routineStorageKey}:timer:${step.kind}-${step.order}:${step.durationSec}`}
                        done={routineRecord.done.includes(`${step.kind}-${step.order}`)}
                        durationSec={step.durationSec}
                        onToggle={() => toggleRoutineStep(`${step.kind}-${step.order}`)}
                        onComplete={() => markRoutineStepDone(`${step.kind}-${step.order}`)}
                      />
                    </div>
                  ))}
                </>
              ) : routineItems.length > 0 ? (
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
                      <div style={{ flexShrink: 0, borderRadius: '999px', background: AXIS_GREEN_THEME.surface, border: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '7px 11px', fontSize: '13px', fontWeight: 900, color: '#014725' }}>
                        {exercise.durationMinutes}분
                      </div>
                    </div>
                    <div style={{ fontSize: '15px', lineHeight: 1.75, color: '#4b5563', wordBreak: 'keep-all' }}>{exercise.desc}</div>
                    <RoutineStepTimer
                      key={`${routineStorageKey}:legacy-${index}:${exercise.durationMinutes}`}
                      storageKey={`${routineStorageKey}:timer:legacy-${index}:${exercise.durationMinutes}`}
                      done={routineRecord.done.includes(`legacy-${index}`)}
                      durationSec={Math.max(60, Math.round(exercise.durationMinutes * 60))}
                      onToggle={() => toggleRoutineStep(`legacy-${index}`)}
                      onComplete={() => markRoutineStepDone(`legacy-${index}`)}
                    />
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '14px', lineHeight: 1.6, color: '#6b7280', paddingTop: '4px', wordBreak: 'keep-all' }}>
                  아직 연결된 루틴이 없습니다.
                </div>
              )}

              {routineStepCount > 0 &&
                (routineCompleted ? (
                  <div
                    style={{
                      borderRadius: '22px',
                      border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
                      background: 'linear-gradient(135deg, rgba(1,71,37,0.10) 0%, rgba(232,245,238,0.86) 100%)',
                      padding: '20px 18px',
                      textAlign: 'center',
                    }}
                  >
                    {rewardRolling || rewardDice != null ? (
                      <div style={{ marginBottom: '10px' }}>
                        <RewardDice value={rewardDice} rolling={rewardRolling} size={72} />
                      </div>
                    ) : (
                      <CheckCircle2 size={30} color="#014725" style={{ margin: '0 auto 8px' }} />
                    )}
                    <div style={{ fontSize: '17px', fontWeight: 900, color: '#014725', marginBottom: '5px' }}>
                      {rewardRolling
                        ? '주사위를 굴리는 중...'
                        : rewardAmount != null
                          ? `주사위 ${rewardDice} · ${rewardAmount}원 적립!`
                          : '오늘의 공통 스트레칭 성공!'}
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: 1.65, fontWeight: 700, color: '#3f6553', wordBreak: 'keep-all' }}>
                      {rewardAmount != null && !rewardRolling
                        ? '오늘 적립이 완료되었습니다. 내일 오전 5시에 다시 굴릴 수 있습니다.'
                        : `${routineTotalLabel} · ${routineStepCount}단계를 모두 마쳤습니다. 내일 같은 시간에 한 번 더 이어가면 좋아요.`}
                    </div>
                    {rewardNotice && (
                      <div style={{ marginTop: '10px', fontSize: '12px', lineHeight: 1.6, fontWeight: 700, color: '#6b7280', wordBreak: 'keep-all' }}>
                        {rewardNotice}
                      </div>
                    )}

                    {/* 광고 보너스 — 선택입니다. 안 봐도 위의 기본 적립은 그대로입니다. */}
                    {bonusAmount != null ? (
                      <div
                        style={{
                          marginTop: '14px',
                          borderTop: `1px solid ${AXIS_GREEN_THEME.border}`,
                          paddingTop: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          fontWeight: 900,
                          color: '#014725',
                        }}
                      >
                        <RewardDice value={bonusDice} rolling={false} size={34} />
                        보너스 {bonusDice} · {bonusAmount}원 추가 적립
                      </div>
                    ) : bonusEligible && isNativeApp() ? (
                      <div style={{ marginTop: '14px', borderTop: `1px solid ${AXIS_GREEN_THEME.border}`, paddingTop: '12px' }}>
                        <button
                          type="button"
                          onClick={watchAdForBonus}
                          disabled={bonusRolling}
                          style={{
                            display: 'inline-flex',
                            width: '100%',
                            height: '46px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '7px',
                            borderRadius: '14px',
                            border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
                            background: '#ffffff',
                            color: '#014725',
                            fontSize: '13px',
                            fontWeight: 900,
                            fontFamily: 'inherit',
                            cursor: bonusRolling ? 'default' : 'pointer',
                            opacity: bonusRolling ? 0.6 : 1,
                          }}
                        >
                          <Gift size={15} />
                          {bonusRolling ? '광고 보는 중...' : '광고 보고 한 번 더 굴리기'}
                        </button>
                        <div style={{ marginTop: '6px', fontSize: '11px', lineHeight: 1.5, color: '#9ca3af', wordBreak: 'keep-all' }}>
                          선택입니다. 보지 않으셔도 위의 적립은 그대로예요.
                        </div>
                      </div>
                    ) : null}
                    {bonusNotice && (
                      <div style={{ marginTop: '8px', fontSize: '12px', lineHeight: 1.6, fontWeight: 700, color: '#6b7280', wordBreak: 'keep-all' }}>
                        {bonusNotice}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={resetRoutine}
                      style={{
                        marginTop: '14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '999px',
                        border: `1px solid ${AXIS_GREEN_THEME.border}`,
                        background: '#ffffff',
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: 800,
                        color: '#6b7280',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      <RotateCcw size={13} />
                      다시 하기 (적립은 하루 1회)
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={completeRoutineWithReward}
                    style={{
                      display: 'inline-flex',
                      width: '100%',
                      height: '54px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '16px',
                      border: routineAllDone ? 'none' : `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
                      background: routineAllDone ? 'linear-gradient(90deg, #016B38 0%, #014725 100%)' : '#ffffff',
                      color: routineAllDone ? '#ffffff' : '#014725',
                      fontSize: '15px',
                      fontWeight: 900,
                      fontFamily: 'inherit',
                      boxShadow: routineAllDone ? '0 14px 28px rgba(1,71,37,0.22)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <CheckCircle2 size={18} />
                    {routineAllDone
                      ? '완료하고 주사위 굴리기'
                      : `완료하고 주사위 굴리기 (${routineDoneCount}/${routineStepCount})`}
                  </button>
                ))}
            </div>
          )}
        </section>
  );

  // 미션 탭은 공통 스트레칭만 필요합니다.
  if (variant === 'routineOnly') return routineSection;

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <section
        style={{
          borderRadius: '30px',
          background: 'rgba(255,255,255,0.84)',
          boxShadow: '0 22px 46px rgba(15, 23, 42, 0.10)',
          backdropFilter: 'blur(20px)',
          padding: '18px',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#014725', marginBottom: '12px' }}>코드 상태 창</div>
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
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#014725' }}>{data.bodyCode}</div>
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
          <div style={{ fontSize: '12px', fontWeight: 900, color: '#014725', marginBottom: '7px' }}>한 줄 이해</div>
          <div style={{ fontSize: '15px', lineHeight: 1.65, fontWeight: 800, color: '#111827', wordBreak: 'keep-all' }}>{data.summaryLine}</div>
        </div>
      </section>

      <section
        role="button"
        tabIndex={0}
        aria-label={journeyProgress ? '오늘의 내 코드 미션 보기' : nextActionLabel}
        onClick={journeyProgress?.onOpen ?? openActionDetailByProgress}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            (journeyProgress?.onOpen ?? openActionDetailByProgress)();
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
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#014725', marginBottom: '8px' }}>
          {journeyProgress
            ? `MY CODE MISSION · DAY ${journeyProgress.dayNo} / ${journeyProgress.totalDays}`
            : 'COMMON STRETCH'}
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#111827', marginBottom: '6px' }}>
          {journeyProgress ? `${data.bodyCode ?? '내'} 코드 미션 수행률` : '공통 스트레칭 진행률'}
        </h2>
        <p style={{ fontSize: '13px', lineHeight: 1.6, fontWeight: 700, color: '#6b7280', marginBottom: '14px', wordBreak: 'keep-all' }}>
          {journeyProgress
            ? '14일 관리에서 내 코드에 맞춰 하루 한 가지씩 배정되는 미션입니다.'
            : '공통 스트레칭은 누구나 같은 4축을 합니다. 내 코드에 맞는 미션은 14일 관리에서 따로 나갑니다.'}
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '40px', lineHeight: 1, fontWeight: 900, color: '#111827' }}>{displayProgress}%</div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: displayProgress > 0 ? AXIS_GREEN_THEME.text : '#6b7280' }}>{missionStatus}</div>
        </div>
        <div style={{ height: '14px', borderRadius: '999px', background: AXIS_GREEN_THEME.track, overflow: 'hidden' }}>
          <div
            style={{
              width: `${displayProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
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
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.16em', color: '#014725', marginBottom: '6px' }}>COMMON · STEP 1</div>
            <h2 style={{ fontSize: '20px', lineHeight: 1.2, fontWeight: 900, color: '#111827' }}>공통 스트레칭 · 먼저 할 두 가지</h2>
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
                        background: isCompleted ? 'linear-gradient(135deg, #016B38 0%, #014725 100%)' : '#ffffff',
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
                            background: isCompleted ? 'rgba(1,71,37,0.12)' : '#ffffff',
                            border: `1px solid ${isCompleted ? AXIS_GREEN_THEME.borderStrong : AXIS_GREEN_THEME.border}`,
                            padding: '4px 8px',
                            fontSize: '10px',
                            lineHeight: 1,
                            fontWeight: 900,
                            color: isCompleted ? '#014725' : '#7c8794',
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
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#014725', marginBottom: '4px' }}>GUIDE</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>나의 {PRODUCT.codeName} 가이드 보기</div>
            </div>
            {guideOpen ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
          </button>
          {guideOpen && (
            <div style={{ borderTop: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '16px 18px 20px', display: 'grid', gap: '12px' }}>
              {data.guideBlocks.length > 0 ? (
                data.guideBlocks.map((block) => (
                  <div
                    key={block.id}
                    style={{
                      borderRadius: '18px',
                      background: 'rgba(244,251,249,0.95)',
                      border: `1px solid ${AXIS_GREEN_THEME.border}`,
                      padding: '18px',
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: '#014725', marginBottom: '6px' }}>{block.caption}</div>
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

      {routineSection}

      {/* 루틴을 다 본 뒤 자리. 미션 수행 중에는 방해가 없도록 섹션 밖에 둡니다. */}
      <AdSlot
        isPaid={isPaid}
        placement="routine"
        house={{
          title: '관리에 쓰는 도구, 결과에 맞춰 골라드려요',
          body: '위 루틴에 필요한 폼롤러·마사지볼을 결과 페이지에서 확인할 수 있습니다.',
        }}
      />

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
