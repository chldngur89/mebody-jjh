/**
 * "왜 이 코드가 나왔는지" — 내 답변 중 각 축을 가장 크게 가른 것을 뽑습니다.
 *
 * **점수 계산에는 손대지 않습니다.** `calculateBodyCode` 와 같은 표(V1_CHOICE_SCORE_MAP)를
 * 읽기만 해서 기여도를 다시 세는 별도 함수입니다. 결과 코드는 여기서 나오지 않습니다.
 *
 * 왜 필요한가: 결과 화면이 축 게이지와 코드별 고정 문장만 보여줍니다. 내가 무엇이라고
 * 답해서 이렇게 나왔는지가 없어, 흥미로운 테스트로 끝나고 다시 오지 않습니다.
 */
import { AXIS_SIDES, normalizeChoice, type AnswerMap, type AxisKey } from './bodyCodeCalculator'
import { V1_CHOICE_SCORE_MAP } from '../data/v1ScoreMapping'

export interface AxisContribution {
  questionCode: string
  /** 선택지 요약. 점수표가 들고 있는 사람이 읽는 문장입니다. */
  summary: string
  /** 이 답이 가리킨 방향의 글자(F/C, R/L, S/F) */
  direction: string
  weight: number
  /** 게이지의 어느 쪽으로 끌었는지. AxisTrack 의 좌·우와 같은 기준입니다. */
  side: 'left' | 'right'
}

const EMPTY: Record<AxisKey, AxisContribution[]> = {
  neck: [], shoulder: [], pelvis: [], flexibility: [],
}

/**
 * 축마다 기여가 큰 답변부터 정렬해 돌려줍니다.
 *
 * 하체(flexibility)는 게이지의 좌우가 점수의 a/b 와 뒤집혀 있습니다.
 * `getAxisScoreBreakdown` 이 같은 이유로 percentLeft/Right 를 바꿔 넣습니다. 여기서도 맞춥니다.
 */
export function getAxisContributions(answers: AnswerMap | undefined): Record<AxisKey, AxisContribution[]> {
  if (!answers || Object.keys(answers).length === 0) return EMPTY

  const out: Record<AxisKey, AxisContribution[]> = {
    neck: [], shoulder: [], pelvis: [], flexibility: [],
  }

  for (const [questionCode, rawValue] of Object.entries(answers)) {
    const choice = normalizeChoice(rawValue)
    if (!choice) continue

    const row = V1_CHOICE_SCORE_MAP[`${questionCode}_${choice}`]
    if (!row?.axis || !row.direction || row.axis_weight <= 0) continue

    const axis = row.axis as AxisKey
    const sides = AXIS_SIDES[axis]
    if (!sides) continue
    if (row.direction !== sides.a && row.direction !== sides.b) continue

    const isSideA = row.direction === sides.a
    out[axis].push({
      questionCode,
      summary: row.choice_summary,
      direction: row.direction,
      weight: row.axis_weight,
      side: axis === 'flexibility' ? (isSideA ? 'right' : 'left') : (isSideA ? 'left' : 'right'),
    })
  }

  for (const axis of Object.keys(out) as AxisKey[]) {
    out[axis].sort((a, b) => b.weight - a.weight || a.questionCode.localeCompare(b.questionCode))

    // 서로 다른 문항이 같은 요약 문장을 갖는 경우가 있습니다(목 축에서 실제로 두 번 나왔습니다).
    // 같은 문장을 두 줄로 보여주면 읽는 사람은 무엇이 다른지 찾느라 멈춥니다.
    const seen = new Set<string>()
    out[axis] = out[axis].filter((x) => {
      const key = x.summary.trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  return out
}

/** 화면에 다 넣으면 읽히지 않습니다. 축마다 가장 크게 가른 것 몇 개만 보여줍니다. */
export function topContributions(list: AxisContribution[], limit = 2): AxisContribution[] {
  return list.slice(0, limit)
}
