/**
 * mebody V1 — 32문항 mebody Code + 아이덴티티 계산
 * - 선택지별 Mapping(⑪)으로 축/아이덴티티 점수 누적
 * - 축 동점 시 Primary → Secondary → Supporting 앵커 비교 (가산점 없음)
 * - 아이덴티티는 raw / max * 100 정규화 후 최대 유형 선택
 * - 아이덴티티 동률 시 Primary ① 개수 → Primary 점수 비교 (⑫·⑭)
 * - 강화 규칙은 점수 변경 없이 scoringMeta에 반영 (⑭)
 */

import { V1_CHOICE_SCORE_MAP, type V1AxisKey, type V1Choice } from '../data/v1ScoreMapping.ts'

export type AnswerValue = string | string[]
export type AnswerMap = Record<string, AnswerValue>
export type AxisKey = V1AxisKey

export type IdentityKey = 'recovery' | 'strength' | 'mobility' | 'balance'

export const IDENTITY_LABELS: Record<IdentityKey, string> = {
  recovery: '회복 우선형',
  strength: '근력 보완형',
  mobility: '움직임 제한형',
  balance: '밸런스 개선형',
}

export const IDENTITY_MAX: Record<IdentityKey, number> = {
  recovery: 11,
  strength: 7,
  mobility: 14,
  balance: 9,
}

/** ⑫·⑭ Identity Anchor — 동률 해소용 (가산점 아님) */
const IDENTITY_TIE_ANCHORS: Record<IdentityKey, { primary: string[]; secondary: string[]; supporting: string[] }> = {
  recovery: { primary: ['A2', 'A4', 'A5'], secondary: ['A3'], supporting: [] },
  strength: { primary: ['A10'], secondary: ['A6', 'C3'], supporting: ['A1'] },
  mobility: { primary: ['C2', 'C5', 'D7'], secondary: ['C7'], supporting: ['A3', 'A7', 'D2', 'D5'] },
  balance: { primary: ['A6', 'C3'], secondary: ['C4'], supporting: ['A7', 'D4'] },
}

/** @deprecated V1에서는 Mapping 테이블을 사용. 호환용 타입만 유지 */
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

export interface AxisScoreDetail {
  sideA: string
  sideB: string
  scoreA: number
  scoreB: number
  winner: string
  tie: boolean
  /** 앵커까지 동점이면 true — 공식 mixed 코드 정책은 제품 합의 전 tie+low_confidence로 저장 */
  mixed?: boolean
  confidence: 'low' | 'mid' | 'high'
  maxWeight: number
}

export interface BodyCodeResult {
  code: string
  primaryIdentity?: IdentityKey
  primaryIdentityLabel?: string
  identityScores?: Record<IdentityKey, { raw: number; pct: number }>
  axisDetails?: Record<AxisKey, AxisScoreDetail>
  lowConfidence?: Partial<Record<AxisKey, boolean>>
  borderline?: Partial<Record<AxisKey, boolean>>
  tieFlags?: Partial<Record<AxisKey | 'identity', boolean>>
  auxTags?: string[]
  scoringMeta?: Record<string, unknown>
}

export interface CalculateBodyCodeOptions {
  /** 통증·어지럼 등으로 미수행한 문항 — 점수 제외 (스펙 중단 처리) */
  stoppedQuestionCodes?: string[]
}

export const AXIS_SIDES: Record<AxisKey, { a: string; b: string; max: number; low: number; mid: number }> = {
  neck: { a: 'F', b: 'C', max: 10, low: 2, mid: 6 },
  shoulder: { a: 'R', b: 'L', max: 10, low: 2, mid: 6 },
  pelvis: { a: 'R', b: 'L', max: 16, low: 3, mid: 8 },
  flexibility: { a: 'S', b: 'F', max: 15, low: 3, mid: 8 },
}

const AXIS_ORDER: AxisKey[] = ['neck', 'shoulder', 'pelvis', 'flexibility']

export function normalizeChoice(value: AnswerValue | undefined): V1Choice | null {
  if (typeof value !== 'string') return null
  if (value === '①' || value === '1') return '①'
  if (value === '②' || value === '2') return '②'
  if (value === '③' || value === '3') return '③'
  return null
}

function confidenceFor(axis: AxisKey, total: number): 'low' | 'mid' | 'high' {
  const cfg = AXIS_SIDES[axis]
  if (total <= cfg.low) return 'low'
  if (total <= cfg.mid) return 'mid'
  return 'high'
}

function resolveAxisWinner(
  axis: AxisKey,
  scoreA: number,
  scoreB: number,
  anchorScores: Record<string, { a: number; b: number }>,
): { winner: string; tie: boolean; mixed: boolean } {
  const { a: sideA, b: sideB } = AXIS_SIDES[axis]
  if (scoreA > scoreB) return { winner: sideA, tie: false, mixed: false }
  if (scoreB > scoreA) return { winner: sideB, tie: false, mixed: false }

  for (const level of ['Primary', 'Secondary', 'Supporting']) {
    const bucket = anchorScores[level]
    if (!bucket) continue
    if (bucket.a > bucket.b) return { winner: sideA, tie: false, mixed: false }
    if (bucket.b > bucket.a) return { winner: sideB, tie: false, mixed: false }
  }

  // 완전동점: 16코드 문자열은 fallback 유지, mixed+tie 태그로 원자료 보존
  return { winner: sideA, tie: true, mixed: true }
}

function identityPointsForChoice(identity: IdentityKey, row: (typeof V1_CHOICE_SCORE_MAP)[string]): number {
  if (identity === 'recovery') return row.score_recovery
  if (identity === 'strength') return row.score_strength
  if (identity === 'mobility') return row.score_mobility
  return row.score_balance
}

function countChoiceOne(answers: AnswerMap, codes: string[], stopped: Set<string>): number {
  let n = 0
  for (const code of codes) {
    if (stopped.has(code)) continue
    if (normalizeChoice(answers[code]) === '①') n += 1
  }
  return n
}

function sumIdentityOnCodes(
  answers: AnswerMap,
  identity: IdentityKey,
  codes: string[],
  stopped: Set<string>,
): number {
  let sum = 0
  for (const code of codes) {
    if (stopped.has(code)) continue
    const choice = normalizeChoice(answers[code])
    if (!choice) continue
    const row = V1_CHOICE_SCORE_MAP[`${code}_${choice}`]
    if (!row) continue
    sum += identityPointsForChoice(identity, row)
  }
  return sum
}

/**
 * 동률 아이덴티티 해소: Primary ① 개수 → Primary 점수 → Secondary … → 그래도 같으면 unresolved
 */
function resolveIdentityTie(
  tied: IdentityKey[],
  answers: AnswerMap,
  stopped: Set<string>,
): { winner: IdentityKey; unresolved: boolean } {
  let candidates = [...tied]

  for (const level of ['primary', 'secondary', 'supporting'] as const) {
    if (candidates.length <= 1) break

    const oneCounts = candidates.map((id) => ({
      id,
      count: countChoiceOne(answers, IDENTITY_TIE_ANCHORS[id][level], stopped),
    }))
    const maxOne = Math.max(...oneCounts.map((x) => x.count))
    const byOne = oneCounts.filter((x) => x.count === maxOne).map((x) => x.id)
    if (byOne.length === 1) return { winner: byOne[0], unresolved: false }
    candidates = byOne

    const scoreCounts = candidates.map((id) => ({
      id,
      score: sumIdentityOnCodes(answers, id, IDENTITY_TIE_ANCHORS[id][level], stopped),
    }))
    const maxScore = Math.max(...scoreCounts.map((x) => x.score))
    const byScore = scoreCounts.filter((x) => x.score === maxScore).map((x) => x.id)
    if (byScore.length === 1) return { winner: byScore[0], unresolved: false }
    candidates = byScore
  }

  return { winner: candidates[0], unresolved: candidates.length > 1 }
}

/** ⑭ 강화 규칙 — 점수 변경 없음, 결과 설명/확신도용 플래그 */
function computeIdentityBoosts(answers: AnswerMap, stopped: Set<string>): Record<IdentityKey, boolean> {
  const isOne = (code: string) => !stopped.has(code) && normalizeChoice(answers[code]) === '①'
  return {
    recovery: [isOne('A2'), isOne('A4'), isOne('A5')].filter(Boolean).length >= 2,
    strength: isOne('A10'),
    mobility: [isOne('C2'), isOne('C5'), isOne('D7')].filter(Boolean).length >= 2,
    balance: isOne('A6') && isOne('C3'),
  }
}

export function calculateBodyCode(
  answers: AnswerMap,
  _scoringQuestions?: ScoringQuestion[],
  options?: CalculateBodyCodeOptions,
): BodyCodeResult {
  const stopped = new Set(options?.stoppedQuestionCodes ?? [])
  const axisRaw: Record<AxisKey, { a: number; b: number }> = {
    neck: { a: 0, b: 0 },
    shoulder: { a: 0, b: 0 },
    pelvis: { a: 0, b: 0 },
    flexibility: { a: 0, b: 0 },
  }
  const anchorByAxis: Record<AxisKey, Record<string, { a: number; b: number }>> = {
    neck: {},
    shoulder: {},
    pelvis: {},
    flexibility: {},
  }
  const identityRaw: Record<IdentityKey, number> = {
    recovery: 0,
    strength: 0,
    mobility: 0,
    balance: 0,
  }
  const auxTags: string[] = []
  const stopTags: string[] = [...stopped]

  for (const [questionCode, rawValue] of Object.entries(answers)) {
    if (stopped.has(questionCode)) continue
    const choice = normalizeChoice(rawValue)
    if (!choice) continue
    const row = V1_CHOICE_SCORE_MAP[`${questionCode}_${choice}`]
    if (!row) continue

    if (row.axis && row.direction && row.axis_weight > 0) {
      const axis = row.axis as AxisKey
      const sides = AXIS_SIDES[axis]
      if (sides) {
        if (row.direction === sides.a) axisRaw[axis].a += row.axis_weight
        else if (row.direction === sides.b) axisRaw[axis].b += row.axis_weight

        const level = row.axis_anchor || 'None'
        if (level !== 'None' && level !== 'Tie tag') {
          if (!anchorByAxis[axis][level]) anchorByAxis[axis][level] = { a: 0, b: 0 }
          if (row.direction === sides.a) anchorByAxis[axis][level].a += row.axis_weight
          else if (row.direction === sides.b) anchorByAxis[axis][level].b += row.axis_weight
        }
      }
    }

    identityRaw.recovery += row.score_recovery
    identityRaw.strength += row.score_strength
    identityRaw.mobility += row.score_mobility
    identityRaw.balance += row.score_balance

    if (row.aux_tag) auxTags.push(row.aux_tag)
  }

  const axisDetails = {} as Record<AxisKey, AxisScoreDetail>
  const lowConfidence: Partial<Record<AxisKey, boolean>> = {}
  const borderline: Partial<Record<AxisKey, boolean>> = {}
  const tieFlags: Partial<Record<AxisKey | 'identity', boolean>> = {}
  let code = ''

  for (const axis of AXIS_ORDER) {
    const { a: sideA, b: sideB, max } = AXIS_SIDES[axis]
    const scoreA = axisRaw[axis].a
    const scoreB = axisRaw[axis].b
    const { winner, tie, mixed } = resolveAxisWinner(axis, scoreA, scoreB, anchorByAxis[axis])
    const total = scoreA + scoreB
    const conf = confidenceFor(axis, total)
    if (conf === 'low' || tie || mixed) lowConfidence[axis] = true
    if (tie || mixed) tieFlags[axis] = true

    const ratioA = total > 0 ? scoreA / total : 0.5
    if (ratioA >= 0.45 && ratioA <= 0.55) borderline[axis] = true

    axisDetails[axis] = {
      sideA,
      sideB,
      scoreA,
      scoreB,
      winner,
      tie,
      mixed: mixed || undefined,
      confidence: conf,
      maxWeight: max,
    }
    code += winner
  }

  const identityScores = {} as Record<IdentityKey, { raw: number; pct: number }>
  let bestPct = -1
  for (const key of Object.keys(IDENTITY_MAX) as IdentityKey[]) {
    const raw = identityRaw[key]
    const pct = IDENTITY_MAX[key] > 0 ? (raw / IDENTITY_MAX[key]) * 100 : 0
    identityScores[key] = { raw, pct }
    if (pct > bestPct) bestPct = pct
  }

  let tiedIdentities = (Object.keys(identityScores) as IdentityKey[]).filter(
    (k) => Math.abs(identityScores[k].pct - bestPct) < 0.0001,
  )

  let best: IdentityKey = tiedIdentities[0] ?? 'recovery'
  let identityComposite = false
  if (tiedIdentities.length > 1) {
    const resolved = resolveIdentityTie(tiedIdentities, answers, stopped)
    best = resolved.winner
    if (resolved.unresolved) {
      tieFlags.identity = true
      identityComposite = true
    }
  }

  const identityBoosts = computeIdentityBoosts(answers, stopped)

  const scoringMeta = {
    question_version: 'mebody_v1_32',
    axis: axisDetails,
    identity: identityScores,
    primary_identity: best,
    tie_flags: tieFlags,
    aux_tags: [...new Set(auxTags)],
    identity_boosts: identityBoosts,
    identity_composite: identityComposite || undefined,
    stop_tags: stopTags.length ? stopTags : undefined,
    /** mixed 축: 공식 16코드 문자열은 fallback 유지. 별도 mixed 코드 출력은 제품 합의 후 */
    axis_mixed: AXIS_ORDER.filter((a) => axisDetails[a].mixed),
  }

  return {
    code,
    primaryIdentity: best,
    primaryIdentityLabel: identityComposite
      ? `${IDENTITY_LABELS[best]} (복합 가능성·확신도 낮음)`
      : IDENTITY_LABELS[best],
    identityScores,
    axisDetails,
    lowConfidence: Object.keys(lowConfidence).length ? lowConfidence : undefined,
    borderline: Object.keys(borderline).length ? borderline : undefined,
    tieFlags: Object.keys(tieFlags).length ? tieFlags : undefined,
    auxTags: [...new Set(auxTags)],
    scoringMeta,
  }
}

export function getAxisLabels(code: string) {
  return {
    neck: code[0] === 'F' ? '전방 (F)' : '중앙 (C)',
    shoulder: code[1] === 'R' ? '오른쪽 높음 (R)' : '왼쪽 높음 (L)',
    pelvis: code[2] === 'R' ? '오른쪽 회전 (R)' : '왼쪽 회전 (L)',
    flexibility: code[3] === 'S' ? '경직 (S)' : '유연 (F)',
  }
}

export function getBodyCodeKeywords(code: string) {
  const keywords = []
  if (code[0] === 'F') keywords.push('거북목')
  else keywords.push('목 정렬')
  if (code[1] === 'R') keywords.push('오른어깨')
  else keywords.push('왼어깨')
  if (code[2] === 'R') keywords.push('오른골반')
  else keywords.push('왼골반')
  if (code[3] === 'S') keywords.push('하체 경직')
  else keywords.push('하체 유연')
  return keywords
}

export const characterNames: Record<string, string> = {
  FRRS: '꽈악 잠금 로봇',
  FRRF: '기대면 흐르는 젤리인간',
  FRLS: '꽈배기 금속 스프링',
  FRLF: '회전 많은 풍선인형',
  FLRS: '으쓱 고정 목각병정',
  FLRF: '리듬 타는 갈대',
  FLLS: '한쪽에 박힌 말뚝',
  FLLF: '녹아내리는 소프트콘',
  CRRS: '닻',
  CRRF: '오뚝이',
  CRLS: '큐브 탑',
  CRLF: '중심 귀찮은 문어',
  CLRS: '엇갈려 잠긴 나무인형',
  CLRF: '아슬아슬 젠가 탑',
  CLLS: '한쪽 뿌리 소나무',
  CLLF: '출렁이는 물침대',
}

export const allCodes = [
  'FRRS', 'FRRF', 'FRLS', 'FRLF',
  'FLRS', 'FLRF', 'FLLS', 'FLLF',
  'CRRS', 'CRRF', 'CRLS', 'CRLF',
  'CLRS', 'CLRF', 'CLLS', 'CLLF',
]

export interface AxisPercent {
  labelLeft: string
  labelRight: string
  percentLeft: number
  percentRight: number
}

export function getAxisScoreBreakdown(answers: AnswerMap, _scoringQuestions?: ScoringQuestion[]): Record<AxisKey, AxisPercent> {
  const result = calculateBodyCode(answers)
  const out = {} as Record<AxisKey, AxisPercent>

  for (const axis of AXIS_ORDER) {
    const d = result.axisDetails?.[axis]
    const scoreA = d?.scoreA ?? 0
    const scoreB = d?.scoreB ?? 0
    const total = scoreA + scoreB
    const percentA = total > 0 ? Math.round((scoreA / total) * 100) : 50
    const percentB = total > 0 ? Math.round((scoreB / total) * 100) : 50

    if (axis === 'neck') {
      out.neck = { labelLeft: 'Neck forward', labelRight: 'Neck central', percentLeft: percentA, percentRight: percentB }
    } else if (axis === 'shoulder') {
      out.shoulder = { labelLeft: 'Right up', labelRight: 'Left up', percentLeft: percentA, percentRight: percentB }
    } else if (axis === 'pelvis') {
      out.pelvis = { labelLeft: 'Right rotation', labelRight: 'Left rotation', percentLeft: percentA, percentRight: percentB }
    } else {
      out.flexibility = { labelLeft: 'Flexible', labelRight: 'Stiff', percentLeft: percentB, percentRight: percentA }
    }
  }

  return out
}

/**
 * **어느 쪽인지 정해지지 않은 축.**
 *
 * 축 점수가 완전 동점이면 `resolveAxisWinner` 가 앵커 비교까지 해 보고, 그래도 같으면
 * 각 축의 첫 글자(F/R/R/S)를 그대로 돌려줍니다. 즉 **아무것도 정해지지 않아도
 * 코드 문자열은 FRRS 가 나옵니다.** 전 문항 ② 가 정확히 그 경우입니다.
 *
 * 그 상태를 화면이 말해주지 않으면, 앱이 확인하지 못한 것을 확인한 것처럼 보여주게 됩니다.
 * 코드 문자열은 바꾸지 않고(저장·공유·콘텐츠가 전부 여기 묶여 있습니다) **어느 축이
 * 또렷하지 않았는지만** 따로 알려주기 위한 함수입니다.
 */
export function getUndeterminedAxes(answers: AnswerMap): AxisKey[] {
  return getResultCertainty(answers).undetermined
}

/**
 * 한 축을 **얼마나 확인했는지**. 서로 다른 말을 한 덩어리로 묶지 않습니다.
 *
 * - `undetermined` — 어느 쪽인지 **정하지 못했습니다.** 점수가 완전 동점이고 앵커까지
 *   같아서, 코드 글자는 확인된 결과가 아니라 폴백(F/R/R/S)입니다.
 * - `thin` — 방향은 갈렸지만 **그 방향을 떠받치는 답변이 적습니다.** 2:0 도 막대에서는
 *   100% 로 그려집니다 — 화면이 가장 세게 단정해 보이는데 근거는 가장 얇은 자리입니다.
 * - `clear` — 방향도 근거도 있습니다.
 */
export type AxisCertainty = 'undetermined' | 'thin' | 'clear'

export interface ResultCertainty {
  byAxis: Record<AxisKey, AxisCertainty>
  /** 어느 쪽인지 정하지 못한 축 (tie·mixed) */
  undetermined: AxisKey[]
  /** 방향은 갈렸지만 근거가 얇은 축 (confidence === 'low', 동점은 제외) */
  thinEvidence: AxisKey[]
  /**
   * 방향도 근거도 있지만 45~55% 로 박빙인 축.
   *
   * **화면 문구로는 올리지 않습니다.** 막대가 이미 52:48 로 그려져 그 사실을 보여주고
   * 있고, 전체 결과의 1/3 에서 켜집니다(무작위 응답 2만 건 기준 33.2%). 한 줄을 더
   * 얹으면 새로 알려주는 것 없이, 정작 새 정보를 담은 위 두 줄까지 같이 흘려보게 됩니다.
   * 저장·분석용으로만 남깁니다.
   */
  closeCall: AxisKey[]
  /** 네 축 전부 정하지 못함 — 전 문항 동일 응답·무응답이 여기로 옵니다. */
  nothingDetermined: boolean
  /**
   * **유형 설명을 어디까지 단정해도 되는가.** 정하지 못한 축만 셉니다.
   * 근거가 얇은 축(`thinEvidence`)은 방향 자체는 갈린 것이라 여기를 내리지 않고,
   * 축 안내에서 따로 말합니다.
   */
  level: 'clear' | 'partial' | 'none'
}

/**
 * **확인한 것과 확인하지 못한 것을 갈라 놓습니다.**
 *
 * 계산기는 완전 동점이어도 코드 글자를 돌려주므로(위 `getUndeterminedAxes` 주석),
 * 결과 화면이 이 구분을 받지 않으면 확인하지 못한 것을 확인한 것처럼 말하게 됩니다.
 * 코드 문자열은 건드리지 않습니다 — 공유 링크·정적 공유 페이지·캐릭터 그림·
 * body_code_content 가 전부 거기 묶여 있습니다.
 */
export function getResultCertainty(answers: AnswerMap): ResultCertainty {
  const result = calculateBodyCode(answers)
  const byAxis = {} as Record<AxisKey, AxisCertainty>
  const undetermined: AxisKey[] = []
  const thinEvidence: AxisKey[] = []
  const closeCall: AxisKey[] = []

  for (const axis of AXIS_ORDER) {
    const d = result.axisDetails?.[axis]
    if (d?.tie || d?.mixed) {
      byAxis[axis] = 'undetermined'
      undetermined.push(axis)
      continue
    }
    if (d?.confidence === 'low') {
      byAxis[axis] = 'thin'
      thinEvidence.push(axis)
      continue
    }
    byAxis[axis] = 'clear'
    if (result.borderline?.[axis]) closeCall.push(axis)
  }

  const nothingDetermined = undetermined.length === AXIS_ORDER.length
  return {
    byAxis,
    undetermined,
    thinEvidence,
    closeCall,
    nothingDetermined,
    level: nothingDetermined ? 'none' : undetermined.length > 0 ? 'partial' : 'clear',
  }
}

/**
 * **결과 화면 머리글이 무엇을 말해도 되는가.**
 *
 * 화면과 검증이 같은 함수를 봅니다. 분기를 JSX 안에만 두면 "전 문항 ② 일 때 단정형
 * 카피가 안 뜨는가" 를 사람 눈으로만 확인할 수 있습니다.
 *
 * - `type`        — 유형 설명을 그대로 보여줍니다.
 * - `type-hedged` — 보여주되, 또렷하지 않은 축을 바로 아래에 한 줄로 덧붙입니다.
 * - `undetermined`— 유형 설명을 **내리고** 재측정을 권합니다. 네 축 전부 동점 —
 *                   확인된 것이 하나도 없고 코드 글자는 폴백입니다.
 */
export type ResultHeadlinePlan =
  | { kind: 'type' }
  | { kind: 'type-hedged'; undetermined: AxisKey[] }
  | { kind: 'undetermined' }

export function resultHeadlinePlan(certainty: ResultCertainty | null): ResultHeadlinePlan {
  if (!certainty) return { kind: 'type' }
  if (certainty.nothingDetermined) return { kind: 'undetermined' }
  if (certainty.undetermined.length > 0) return { kind: 'type-hedged', undetermined: certainty.undetermined }
  return { kind: 'type' }
}

/** 결과 화면 호환: 답변 map에서 축별 비율 추정 */
export function getAxisPercentages(answers: AnswerMap, _questions?: ScoringQuestion[]) {
  const result = calculateBodyCode(answers)
  const out: Record<AxisKey, number> = {
    neck: 50,
    shoulder: 50,
    pelvis: 50,
    flexibility: 50,
  }
  if (!result.axisDetails) return out
  for (const axis of AXIS_ORDER) {
    const d = result.axisDetails[axis]
    const total = d.scoreA + d.scoreB
    out[axis] = total > 0 ? Math.round((d.scoreA / total) * 100) : 50
  }
  return out
}
