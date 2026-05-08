/**
 * 53문항 체형 코드 계산 (Tug-of-War 가중치 방식)
 * ① = A방향 가중치, ② = 0점, ③ = B방향 가중치
 * 축별: 목 F/C, 어깨 R/L, 골반 R/L, 하체 S/F
 */

import { VER3_QUESTIONS_SNAPSHOT } from '../data/ver3QuestionsSnapshot';

export type AnswerValue = string | string[]
export type AnswerMap = Record<string, AnswerValue>
export type AxisKey = 'neck' | 'shoulder' | 'pelvis' | 'flexibility'

export interface ScoringQuestion {
  question_code?: string
  question_number?: number | null
  sort_order?: number
  axis: string
  weight_a: number
  weight_b: number
  is_precheck?: boolean
  is_scored?: boolean
}

export interface BodyCodeResult {
  code: string
  /** 축별 저신뢰도 여부 (해당 축 획득 점수가 최대의 40% 미만) */
  lowConfidence?: Partial<Record<AxisKey, boolean>>
  /** 축별 경계선 여부 (45~55%) */
  borderline?: Partial<Record<AxisKey, boolean>>
}

function normalizeCoreAxis(axis: string): AxisKey | null {
  if (axis === 'lower_body') return 'flexibility';
  if (axis === 'neck' || axis === 'shoulder' || axis === 'pelvis' || axis === 'flexibility') return axis;
  return null;
}

function getQuestionAnswer(answers: AnswerMap, question: ScoringQuestion): AnswerValue | undefined {
  const codeKey = question.question_code ? String(question.question_code) : null;
  const numberKey = question.question_number !== null && question.question_number !== undefined ? String(question.question_number) : null;
  return (codeKey ? answers[codeKey] : undefined) ?? (numberKey ? answers[numberKey] : undefined);
}

function isSingleAnswer(value: AnswerValue | undefined, expected: '①' | '③' | '1' | '3'): boolean {
  return typeof value === 'string' && value === expected;
}

function isScoredQuestion(question: ScoringQuestion): boolean {
  return question.is_precheck !== true && question.is_scored !== false && Boolean(normalizeCoreAxis(question.axis));
}

function getQuestionSet(scoringQuestions?: ScoringQuestion[]): ScoringQuestion[] {
  if (scoringQuestions?.length) return scoringQuestions;
  return VER3_QUESTIONS_SNAPSHOT.map((question) => ({
    question_code: String(question.question_code),
    question_number: question.question_number,
    sort_order: question.sort_order,
    axis: question.axis,
    weight_a: question.weight_a,
    weight_b: question.weight_b,
    is_precheck: question.is_precheck,
    is_scored: question.is_scored,
  }));
}

/** 가중치 합산 후 더 높은 쪽으로 코드 결정 */
export function calculateBodyCode(answers: AnswerMap, scoringQuestions?: ScoringQuestion[]): BodyCodeResult {
  const axisKeys: AxisKey[] = ['neck', 'shoulder', 'pelvis', 'flexibility'];
  const questionSet = getQuestionSet(scoringQuestions);
  const lowConfidence: Partial<Record<AxisKey, boolean>> = {};
  const borderline: Partial<Record<AxisKey, boolean>> = {};
  let code = '';

  for (const axis of axisKeys) {
    const axisQuestions = questionSet.filter((q) => isScoredQuestion(q) && normalizeCoreAxis(q.axis) === axis);
    let scoreA = 0;
    let scoreB = 0;

    for (const q of axisQuestions) {
      const value = getQuestionAnswer(answers, q);
      if (isSingleAnswer(value, '①') || isSingleAnswer(value, '1')) scoreA += q.weight_a;
      else if (isSingleAnswer(value, '③') || isSingleAnswer(value, '3')) scoreB += q.weight_b;
      // ② 또는 미응답 = 0
    }

    const total = scoreA + scoreB;
    const maxScore = axisQuestions.reduce((s, q) => s + q.weight_a + q.weight_b, 0) / 2; // 한쪽 최대
    const threshold = maxScore * 0.4;
    if (total < threshold) lowConfidence[axis] = true;

    const ratioA = total > 0 ? scoreA / total : 0.5;
    if (ratioA >= 0.45 && ratioA <= 0.55) borderline[axis] = true;

    // 0.1%라도 높은 쪽으로 코드 부여
    if (axis === 'neck') code += scoreA >= scoreB ? 'F' : 'C';
    else if (axis === 'shoulder') code += scoreA >= scoreB ? 'R' : 'L';
    else if (axis === 'pelvis') code += scoreA >= scoreB ? 'R' : 'L';
    else code += scoreA >= scoreB ? 'S' : 'F';
  }

  return {
    code,
    lowConfidence: Object.keys(lowConfidence).length ? lowConfidence : undefined,
    borderline: Object.keys(borderline).length ? borderline : undefined,
  };
}

export function getAxisLabels(code: string) {
  return {
    neck: code[0] === 'F' ? '전방 (F)' : '중앙 (C)',
    shoulder: code[1] === 'R' ? '오른쪽 높음 (R)' : '왼쪽 높음 (L)',
    pelvis: code[2] === 'R' ? '오른쪽 회전 (R)' : '왼쪽 회전 (L)',
    flexibility: code[3] === 'S' ? '경직 (S)' : '유연 (F)',
  };
}

export function getBodyCodeKeywords(code: string) {
  const keywords = [];

  if (code[0] === 'F') keywords.push('거북목');
  if (code[1] === 'R') keywords.push('오른쪽 어깨 기울임');
  if (code[1] === 'L') keywords.push('왼쪽 어깨 기울임');
  if (code[2] === 'R') keywords.push('골반 우회전');
  if (code[2] === 'L') keywords.push('골반 좌회전');
  if (code[3] === 'S') keywords.push('뻣뻣한 하체');
  if (code[3] === 'F') keywords.push('유연한 하체');

  return keywords;
}

// Figma Character Names (한국어)
export const characterNames: Record<string, string> = {
  FRRS: '암사가는 잠금 로봇',
  FRRF: '기대면 흐르는 젤리인간',
  FRLS: '되배기 금속 스프링',
  FRLF: '회전 많은 풍선인형',
  FLRS: '으쓱 고정 목각병정',
  FLRF: '리듬은 좋은데 금방 시치는 갈대',
  FLLS: '한쪽에 박힌 발톱',
  FLLF: '녹아내리는 소프트콘',
  CRRS: '닻',
  CRRF: '오뚝이',
  CRLS: '큐브 탑',
  CRLF: '중심 귀찮은 문어',
  CLRS: '엇갈려 잠긴 나무인형',
  CLRF: '아슬아슬 젠가 탑',
  CLLS: '한쪽 뿌리 소나무',
  CLLF: '출렁이는 물침대',
};

export const allCodes = [
  'FRRS', 'FRRF', 'FRLS', 'FRLF',
  'FLRS', 'FLRF', 'FLLS', 'FLLF',
  'CRRS', 'CRRF', 'CRLS', 'CRLF',
  'CLRS', 'CLRF', 'CLLS', 'CLLF',
];

/** 축별 퍼센트 (결과 화면 바 차트용) */
export interface AxisPercent {
  labelLeft: string
  labelRight: string
  percentLeft: number
  percentRight: number
}

export function getAxisScoreBreakdown(answers: AnswerMap, scoringQuestions?: ScoringQuestion[]): Record<AxisKey, AxisPercent> {
  const axisKeys: AxisKey[] = ['neck', 'shoulder', 'pelvis', 'flexibility'];
  const questionSet = getQuestionSet(scoringQuestions);
  const result = {} as Record<AxisKey, AxisPercent>;

  for (const axis of axisKeys) {
    const axisQuestions = questionSet.filter((q) => isScoredQuestion(q) && normalizeCoreAxis(q.axis) === axis);
    let scoreA = 0;
    let scoreB = 0;

    for (const q of axisQuestions) {
      const value = getQuestionAnswer(answers, q);
      if (isSingleAnswer(value, '①') || isSingleAnswer(value, '1')) scoreA += q.weight_a;
      else if (isSingleAnswer(value, '③') || isSingleAnswer(value, '3')) scoreB += q.weight_b;
    }

    const total = scoreA + scoreB;
    const percentA = total > 0 ? Math.round((scoreA / total) * 100) : 50;
    const percentB = total > 0 ? Math.round((scoreB / total) * 100) : 50;

    if (axis === 'neck') {
      result.neck = { labelLeft: 'Neck forward', labelRight: 'Neck central', percentLeft: percentA, percentRight: percentB };
    } else if (axis === 'shoulder') {
      result.shoulder = { labelLeft: 'Right up', labelRight: 'Left up', percentLeft: percentA, percentRight: percentB };
    } else if (axis === 'pelvis') {
      result.pelvis = { labelLeft: 'Right rotation', labelRight: 'Left rotation', percentLeft: percentA, percentRight: percentB };
    } else {
      result.flexibility = { labelLeft: 'Flexible', labelRight: 'Stiff', percentLeft: percentB, percentRight: percentA };
    }
  }

  return result;
}
