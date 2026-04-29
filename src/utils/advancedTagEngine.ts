import { VER2_QUESTIONS, type AxisKey } from '../data/ver2Questions';
import type { AnswerMap } from './bodyCodeCalculator';

interface QuestionMeta {
  question_code?: string;
  question_number?: number | null;
  sort_order?: number;
  axis: string;
  is_precheck?: boolean;
  is_scored?: boolean;
}

export interface AxisSignal {
  count1: number;
  count3: number;
  validCount: number;
  dominantPct: number;
  hasBorderline: boolean;
  hasLowConfidence: boolean;
}

export interface AdvancedTag {
  key: string;
  name: string;
  title: string;
  reason: string;
  status: 'confirmed' | 'preview';
  followUpQuestions: number;
  priority: number;
}

export interface AdvancedTagAnalysis {
  axisSignals: Record<AxisKey, AxisSignal>;
  confirmedTags: AdvancedTag[];
  previewTags: AdvancedTag[];
}

function createEmptyAxisSignals(): Record<AxisKey, AxisSignal> {
  return {
    neck: { count1: 0, count3: 0, validCount: 0, dominantPct: 50, hasBorderline: false, hasLowConfidence: false },
    shoulder: { count1: 0, count3: 0, validCount: 0, dominantPct: 50, hasBorderline: false, hasLowConfidence: false },
    pelvis: { count1: 0, count3: 0, validCount: 0, dominantPct: 50, hasBorderline: false, hasLowConfidence: false },
    flexibility: { count1: 0, count3: 0, validCount: 0, dominantPct: 50, hasBorderline: false, hasLowConfidence: false },
  };
}

const LOW_CONFIDENCE_CUTOFF: Record<AxisKey, number> = {
  neck: 6,
  shoulder: 7,
  pelvis: 7,
  flexibility: 11,
};

function normalizeAxisForSignals(axis: string): AxisKey | null {
  if (axis === 'lower_body') return 'flexibility';
  if (axis === 'neck' || axis === 'shoulder' || axis === 'pelvis' || axis === 'flexibility') return axis;
  return null;
}

function getQuestionSet(questions?: QuestionMeta[]): QuestionMeta[] {
  if (questions?.length) {
    return questions
      .map((question) => {
        const axis = normalizeAxisForSignals(question.axis);
        if (!axis || question.is_precheck === true || question.is_scored === false) return null;
        return {
          question_code: question.question_code ?? (question.question_number === null || question.question_number === undefined ? undefined : String(question.question_number)),
          question_number: question.question_number === null || question.question_number === undefined ? null : Number(question.question_number),
          sort_order: Number(question.sort_order ?? question.question_number ?? 0),
          axis,
          is_precheck: false,
          is_scored: true,
        };
      })
      .filter((question): question is QuestionMeta => Boolean(question))
      .sort((a, b) => Number(a.sort_order ?? a.question_number ?? 0) - Number(b.sort_order ?? b.question_number ?? 0));
  }

  return VER2_QUESTIONS.map((question) => ({
    question_code: String(question.question_number),
    question_number: question.question_number,
    sort_order: question.question_number,
    axis: question.axis,
  }));
}

function getAxisLocalQuestion(questions: QuestionMeta[], axis: AxisKey, localIndex: number): QuestionMeta | null {
  const axisQuestions = questions
    .filter((question) => question.axis === axis)
    .sort((a, b) => Number(a.sort_order ?? a.question_number ?? 0) - Number(b.sort_order ?? b.question_number ?? 0));

  return axisQuestions[localIndex - 1] ?? null;
}

function getAnswer(answers: AnswerMap, question: QuestionMeta | null): string | undefined {
  if (!question) return undefined;
  const codeKey = question.question_code ? String(question.question_code) : null;
  const numberKey = question.question_number !== null && question.question_number !== undefined ? String(question.question_number) : null;
  const value = (codeKey ? answers[codeKey] : undefined) ?? (numberKey ? answers[numberKey] : undefined);
  return typeof value === 'string' ? value : undefined;
}

function isOption(answers: AnswerMap, question: QuestionMeta | null, option: '①' | '③'): boolean {
  return getAnswer(answers, question) === option;
}

function countMatches(
  answers: AnswerMap,
  questions: Array<QuestionMeta | null>,
  option: '①' | '③',
): number {
  return questions.reduce((count, question) => count + (isOption(answers, question, option) ? 1 : 0), 0);
}

function createTag(tag: Omit<AdvancedTag, 'status' | 'followUpQuestions'> & { status?: AdvancedTag['status']; followUpQuestions?: number }): AdvancedTag {
  return {
    status: tag.status ?? 'confirmed',
    followUpQuestions: tag.followUpQuestions ?? 0,
    ...tag,
  };
}

export function normalizeStoredAdvancedTags(raw: unknown): AdvancedTag[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<AdvancedTag>;
      if (!candidate.key || !candidate.name || !candidate.title || !candidate.reason) return null;
      return createTag({
        key: String(candidate.key),
        name: String(candidate.name),
        title: String(candidate.title),
        reason: String(candidate.reason),
        status: candidate.status === 'preview' ? 'preview' : 'confirmed',
        followUpQuestions: Number(candidate.followUpQuestions ?? 0),
        priority: Number(candidate.priority ?? 999),
      });
    })
    .filter((item): item is AdvancedTag => Boolean(item))
    .sort((left, right) => left.priority - right.priority);
}

export function buildAdvancedTagAnalysisFromStored(
  rawPreviewTags: unknown,
  rawConfirmedTags: unknown,
  answers?: AnswerMap,
  questions?: QuestionMeta[],
): AdvancedTagAnalysis | null {
  const previewTags = normalizeStoredAdvancedTags(rawPreviewTags);
  const confirmedTags = normalizeStoredAdvancedTags(rawConfirmedTags);

  if (!previewTags.length && !confirmedTags.length) {
    return answers ? analyzeAdvancedTags(answers, questions) : null;
  }

  const axisSignals = answers ? analyzeAdvancedTags(answers, questions).axisSignals : createEmptyAxisSignals();
  return {
    axisSignals,
    previewTags,
    confirmedTags,
  };
}

export function analyzeAdvancedTags(
  answers: AnswerMap,
  questions?: QuestionMeta[],
): AdvancedTagAnalysis {
  const questionSet = getQuestionSet(questions);
  const axisSignals = createEmptyAxisSignals();

  for (const axis of Object.keys(axisSignals) as AxisKey[]) {
    const axisQuestionNumbers = questionSet
      .filter((question) => question.axis === axis)
      .map((question) => question);

    const count1 = countMatches(answers, axisQuestionNumbers, '①');
    const count3 = countMatches(answers, axisQuestionNumbers, '③');
    const validCount = count1 + count3;
    const dominantPct = validCount > 0 ? (Math.max(count1, count3) / validCount) * 100 : 50;

    axisSignals[axis] = {
      count1,
      count3,
      validCount,
      dominantPct,
      hasBorderline: dominantPct < 55,
      hasLowConfidence: validCount < LOW_CONFIDENCE_CUTOFF[axis],
    };
  }

  const confirmedTags: AdvancedTag[] = [];
  const previewTags: AdvancedTag[] = [];

  if (axisSignals.neck.hasBorderline) {
    confirmedTags.push(createTag({
      key: 'borderline-neck',
      name: 'Borderline',
      title: '목 축 경계의 모호',
      reason: '목 축 응답이 한 방향으로 충분히 모이지 않아 생활 패턴에 따라 흔들릴 가능성이 있습니다.',
      priority: 10,
    }));
  }

  if (axisSignals.shoulder.hasBorderline) {
    confirmedTags.push(createTag({
      key: 'borderline-shoulder',
      name: 'Borderline',
      title: '어깨 축 경계의 모호',
      reason: '어깨 높이 패턴이 한쪽으로 고정되지 않아 작업 환경에 따라 보상이 바뀔 수 있습니다.',
      priority: 11,
    }));
  }

  if (axisSignals.flexibility.hasBorderline) {
    confirmedTags.push(createTag({
      key: 'borderline-flexibility',
      name: 'Borderline',
      title: '하체 축 경계의 모호',
      reason: '하체 유연성과 버티는 성향이 비슷하게 잡혀 그날 컨디션에 따라 반응이 달라질 수 있습니다.',
      priority: 12,
    }));
  }

  if (axisSignals.pelvis.hasBorderline) {
    confirmedTags.push(createTag({
      key: 'three-axis-borderline',
      name: '3-axis borderline',
      title: '골반 회전 방향의 불분명함',
      reason: '골반 축이 한 방향으로 정착되지 않아 안정성보다 흔들림이 먼저 나타날 가능성이 있습니다.',
      priority: 13,
    }));
  }

  if (axisSignals.neck.hasLowConfidence) {
    confirmedTags.push(createTag({
      key: 'low-confidence-neck',
      name: 'Low confidence',
      title: '목 축 데이터 부족',
      reason: '목 축에서 모르겠다 응답이 많아 현재 결과의 확신도가 낮습니다.',
      priority: 20,
    }));
  }

  if (axisSignals.shoulder.hasLowConfidence) {
    confirmedTags.push(createTag({
      key: 'low-confidence-shoulder',
      name: 'Low confidence',
      title: '어깨 축 데이터 부족',
      reason: '어깨 축에서 유효 응답이 부족해 현재 방향성을 단정하기 어렵습니다.',
      priority: 21,
    }));
  }

  if (axisSignals.pelvis.hasLowConfidence) {
    confirmedTags.push(createTag({
      key: 'low-confidence-pelvis',
      name: 'Low confidence',
      title: '골반 축 데이터 부족',
      reason: '골반 축에 대한 신체 인지가 불명확해 추가 확인이 필요한 상태입니다.',
      priority: 22,
    }));
  }

  if (axisSignals.flexibility.hasLowConfidence) {
    confirmedTags.push(createTag({
      key: 'low-confidence-flexibility',
      name: 'Low confidence',
      title: '하체 축 데이터 부족',
      reason: '하체 축에서 유효 응답이 적어 버팀/유연 패턴을 더 확인해야 합니다.',
      priority: 23,
    }));
  }

  const borderlineCount = Object.values(axisSignals).filter((signal) => signal.hasBorderline).length;
  const lowConfidenceCount = Object.values(axisSignals).filter((signal) => signal.hasLowConfidence).length;

  if (borderlineCount >= 2 || lowConfidenceCount >= 1) {
    confirmedTags.push(createTag({
      key: 'mixed',
      name: 'Mixed',
      title: '복합 혼합 패턴',
      reason: '여러 축이 동시에 애매하거나 데이터가 부족해 몸이 한 가지 방식보다 복합 보상으로 움직일 가능성이 높습니다.',
      priority: 30,
    }));
  }

  if (
    axisSignals.shoulder.dominantPct >= 70 &&
    (axisSignals.pelvis.hasBorderline || axisSignals.flexibility.hasBorderline || borderlineCount >= 2 || lowConfidenceCount >= 1)
  ) {
    confirmedTags.push(createTag({
      key: 'zig-zag-compensation',
      name: 'Zig-zag Compensation',
      title: '상·하체 엇갈림 보상',
      reason: '어깨 쪽 방향성은 뚜렷한데 골반 또는 하체 쪽이 흔들려 척추가 지그재그로 힘을 흡수할 가능성이 있습니다.',
      priority: 31,
    }));
  }

  const qNeck4 = getAxisLocalQuestion(questionSet, 'neck', 4);
  const qShoulder3 = getAxisLocalQuestion(questionSet, 'shoulder', 3);
  const qShoulder8 = getAxisLocalQuestion(questionSet, 'shoulder', 8);
  const qPelvis5 = getAxisLocalQuestion(questionSet, 'pelvis', 5);
  const qPelvis6 = getAxisLocalQuestion(questionSet, 'pelvis', 6);
  const qFlex1 = getAxisLocalQuestion(questionSet, 'flexibility', 1);
  const qFlex2 = getAxisLocalQuestion(questionSet, 'flexibility', 2);
  const qFlex3 = getAxisLocalQuestion(questionSet, 'flexibility', 3);
  const qFlex4 = getAxisLocalQuestion(questionSet, 'flexibility', 4);
  const qFlex5 = getAxisLocalQuestion(questionSet, 'flexibility', 5);
  const qFlex6 = getAxisLocalQuestion(questionSet, 'flexibility', 6);
  const qFlex7 = getAxisLocalQuestion(questionSet, 'flexibility', 7);
  const qFlex9 = getAxisLocalQuestion(questionSet, 'flexibility', 9);
  const qFlex10 = getAxisLocalQuestion(questionSet, 'flexibility', 10);
  const qFlex12 = getAxisLocalQuestion(questionSet, 'flexibility', 12);

  const sittingDrivenSignals = [qNeck4, qFlex4, qFlex6, qFlex9];
  if (countMatches(answers, sittingDrivenSignals, '①') >= 2) {
    previewTags.push(createTag({
      key: 'sitting-driven',
      name: 'Sitting-driven',
      title: '앉는 생활 영향',
      reason: '목 빠짐, 앞사타구니, 햄스트링, 힙힌지 패턴이 함께 보여 좌식 환경 영향 가능성이 높습니다.',
      status: 'preview',
      followUpQuestions: 3,
      priority: 100,
    }));
  }

  const workDominantFirst = countMatches(answers, [qShoulder3, qShoulder8, qPelvis5, qPelvis6], '①');
  const workDominantThird = countMatches(answers, [qShoulder3, qShoulder8, qPelvis5, qPelvis6], '③');
  if (workDominantFirst >= 2 || workDominantThird >= 2) {
    previewTags.push(createTag({
      key: 'work-dominant',
      name: 'Work-dominant',
      title: '작업 비대칭',
      reason: '한쪽으로 반복되는 어깨·골반 사용 패턴이 보여 작업 환경 편향 가능성이 감지되었습니다.',
      status: 'preview',
      followUpQuestions: 3,
      priority: 101,
    }));
  }

  if (
    axisSignals.flexibility.dominantPct >= 65 &&
    axisSignals.pelvis.dominantPct >= 60 &&
    (axisSignals.neck.hasBorderline || axisSignals.neck.hasLowConfidence)
  ) {
    previewTags.push(createTag({
      key: 'compensatory-neck',
      name: 'Compensatory neck',
      title: '목의 억지 보상',
      reason: '하체와 골반은 뚜렷한데 목 축이 흔들려 시선·작업 환경 때문에 목이 대신 버티는 패턴이 의심됩니다.',
      status: 'preview',
      followUpQuestions: 3,
      priority: 102,
    }));
  }

  if (countMatches(answers, [qFlex2, qFlex3, qFlex12], '①') >= 1) {
    previewTags.push(createTag({
      key: 'ankle-limited',
      name: 'Ankle-limited',
      title: '발목 움직임 제한',
      reason: '쪼그려 앉기와 발목 접힘 관련 답변에서 후방 사슬 뻣뻣함이 감지되었습니다.',
      status: 'preview',
      followUpQuestions: 3,
      priority: 103,
    }));
  }

  if (isOption(answers, qFlex10, '①') && (axisSignals.pelvis.hasBorderline || axisSignals.pelvis.hasLowConfidence)) {
    previewTags.push(createTag({
      key: 'hip-rotation-asymmetry',
      name: 'Hip-rotation asymmetry',
      title: '고관절 회전 비대칭 의심',
      reason: '골반 방향은 애매한데 고관절 회전 관련 응답이 강하게 잡혀 추가 확인이 필요합니다.',
      status: 'preview',
      followUpQuestions: 3,
      priority: 104,
    }));
  }

  const hasAnteriorHint = countMatches(answers, [qFlex4, qFlex5], '①') >= 1;
  const hasPosteriorHint = countMatches(answers, [qFlex1, qFlex6, qFlex7], '①') >= 2;

  if (hasAnteriorHint && hasPosteriorHint) {
    previewTags.push(createTag({
      key: 'global-stiff-strategy',
      name: 'Global-stiff strategy',
      title: '전후면 동시 과긴장',
      reason: '앞쪽과 뒤쪽 힌트가 동시에 잡혀 전신이 굳은 채 버티는 전략일 가능성이 있습니다.',
      status: 'preview',
      followUpQuestions: 3,
      priority: 105,
    }));
  } else if (hasAnteriorHint) {
    previewTags.push(createTag({
      key: 'anterior-leaning-strategy',
      name: 'Anterior-leaning strategy',
      title: '앞쪽 주도 전략',
      reason: '앞사타구니와 앞허벅지 힌트가 보여 체중을 앞쪽 체인에 실어 버티는 패턴이 의심됩니다.',
      status: 'preview',
      followUpQuestions: 3,
      priority: 106,
    }));
  } else if (hasPosteriorHint) {
    previewTags.push(createTag({
      key: 'posterior-leaning-strategy',
      name: 'Posterior-leaning strategy',
      title: '뒤쪽 주도 전략',
      reason: '햄스트링과 후방 사슬의 뻣뻣함 힌트가 겹쳐 뒤쪽 체인으로 버티는 전략이 의심됩니다.',
      status: 'preview',
      followUpQuestions: 3,
      priority: 107,
    }));
  }

  confirmedTags.sort((left, right) => left.priority - right.priority);
  previewTags.sort((left, right) => left.priority - right.priority);

  return {
    axisSignals,
    confirmedTags,
    previewTags,
  };
}
