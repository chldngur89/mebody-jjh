/**
 * MEBODY V1 — 32문항 체형 코드 + 아이덴티티 계산
 * - 선택지별 Mapping(⑪)으로 축/아이덴티티 점수 누적
 * - 축 동점 시 Primary → Secondary → Supporting 앵커 비교 (가산점 없음)
 * - 아이덴티티는 raw / max * 100 정규화 후 최대 유형 선택
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
): { winner: string; tie: boolean } {
  const { a: sideA, b: sideB } = AXIS_SIDES[axis]
  if (scoreA > scoreB) return { winner: sideA, tie: false }
  if (scoreB > scoreA) return { winner: sideB, tie: false }

  for (const level of ['Primary', 'Secondary', 'Supporting']) {
    const bucket = anchorScores[level]
    if (!bucket) continue
    if (bucket.a > bucket.b) return { winner: sideA, tie: false }
    if (bucket.b > bucket.a) return { winner: sideB, tie: false }
  }

  return { winner: sideA, tie: true }
}

export function calculateBodyCode(answers: AnswerMap, _scoringQuestions?: ScoringQuestion[]): BodyCodeResult {
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

  for (const [questionCode, rawValue] of Object.entries(answers)) {
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
    const { winner, tie } = resolveAxisWinner(axis, scoreA, scoreB, anchorByAxis[axis])
    const total = scoreA + scoreB
    const conf = confidenceFor(axis, total)
    if (conf === 'low' || tie) lowConfidence[axis] = true
    if (tie) tieFlags[axis] = true

    const ratioA = total > 0 ? scoreA / total : 0.5
    if (ratioA >= 0.45 && ratioA <= 0.55) borderline[axis] = true

    axisDetails[axis] = {
      sideA,
      sideB,
      scoreA,
      scoreB,
      winner,
      tie,
      confidence: conf,
      maxWeight: max,
    }
    code += winner
  }

  const identityScores = {} as Record<IdentityKey, { raw: number; pct: number }>
  let best: IdentityKey = 'recovery'
  let bestPct = -1
  for (const key of Object.keys(IDENTITY_MAX) as IdentityKey[]) {
    const raw = identityRaw[key]
    const pct = IDENTITY_MAX[key] > 0 ? (raw / IDENTITY_MAX[key]) * 100 : 0
    identityScores[key] = { raw, pct }
    if (pct > bestPct) {
      bestPct = pct
      best = key
    }
  }

  const tiedIdentities = (Object.keys(identityScores) as IdentityKey[]).filter(
    (k) => Math.abs(identityScores[k].pct - bestPct) < 0.0001,
  )
  if (tiedIdentities.length > 1) {
    tieFlags.identity = true
  }

  const scoringMeta = {
    question_version: 'mebody_v1_32',
    axis: axisDetails,
    identity: identityScores,
    primary_identity: best,
    tie_flags: tieFlags,
    aux_tags: [...new Set(auxTags)],
  }

  return {
    code,
    primaryIdentity: best,
    primaryIdentityLabel: IDENTITY_LABELS[best],
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
