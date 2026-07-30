/**
 * MEBODY V1 — 32문항 체형 코드 + 아이덴티티 계산
 * - 선택지별 Mapping(⑪)으로 축/아이덴티티 점수 누적
 * - 축 동점 시 Primary → Secondary → Supporting 앵커 비교 (가산점 없음)
 * - 아이덴티티는 raw / max * 100 정규화 후 최대 유형 선택
 * - 아이덴티티 동률 시 Primary ① 개수 → Primary 점수 비교 (⑫·⑭)
 * - 강화 규칙은 점수 변경 없이 scoringMeta에 반영 (⑭)
 */

import { V1_CHOICE_SCORE_MAP, type V1AxisKey, type V1Choice } from '../data/v1ScoreMapping'

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

const AXIS_SIDES: Record<AxisKey, { a: string; b: string; max: number; low: number; mid: number }> = {
  neck: { a: 'F', b: 'C', max: 10, low: 2, mid: 6 },
  shoulder: { a: 'R', b: 'L', max: 10, low: 2, mid: 6 },
  pelvis: { a: 'R', b: 'L', max: 16, low: 3, mid: 8 },
  flexibility: { a: 'S', b: 'F', max: 15, low: 3, mid: 8 },
}

const AXIS_ORDER: AxisKey[] = ['neck', 'shoulder', 'pelvis', 'flexibility']

function normalizeChoice(value: AnswerValue | undefined): V1Choice | null {
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
