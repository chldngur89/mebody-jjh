/**
 * MEBODY Journey — 추천 규칙 검증 (DB 불필요)
 *
 * db/journey/022·023 시드 SQL 에서 실제 day_plan 과 콘텐츠 태그를 파싱해
 * src/utils/journeyRules.ts 의 순수 함수를 검증합니다.
 * 시드와 규칙이 어긋나면 여기서 잡힙니다.
 *
 * 사용: node scripts/verify-journey-rules.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  adjustDifficulty,
  buildAxisPriority,
  buildReportPayload,
  computeCurrentDay,
  daysSince,
  buildMissionSteps,
  recommendNextJourney,
  reportRangeFor,
  scaleDuration,
  selectDailyMissions,
  summarizeFeedback,
} from '../src/utils/journeyRules.ts'
import { compareJourneyResults } from '../src/utils/journeyCompare.ts'
import { buildCareRoutine, CARE_ROUTINE_TOTAL_SEC } from '../src/utils/careRoutine.ts'

let passed = 0
const failures = []

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${label}`)
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

// --- 시드 SQL 에서 실제 데이터 파싱 -----------------------------------------

function loadDayPlan() {
  const sql = readFileSync(resolve('db/journey/022_seed_journey_template.sql'), 'utf8')
  const start = sql.indexOf("'{")
  const end = sql.indexOf("}'::jsonb")
  if (start < 0 || end < 0) throw new Error('022 시드에서 day_plan 을 찾지 못했습니다')
  return JSON.parse(sql.slice(start + 1, end + 1).replace(/''/g, "'"))
}

function loadContentTags() {
  const sql = readFileSync(resolve('db/journey/023_seed_journey_content_tags.sql'), 'utf8')
  const rowPattern =
    /\('([^']+)',\s*(NULL|'[^']+'),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+),\s*'\{([^}]*)\}'::text\[\],\s*(true|false)\)/g
  const tags = []
  let match
  while ((match = rowPattern.exec(sql)) !== null) {
    tags.push({
      content_key: match[1],
      axis_key: match[2] === 'NULL' ? null : match[2].slice(1, -1),
      direction_key: match[3],
      body_part_key: match[4],
      mission_type: match[5],
      difficulty: Number(match[6]),
      base_duration_sec: Number(match[7]),
      equipment: match[8].split(',').map((v) => v.replace(/"/g, '').trim()).filter(Boolean),
      is_active: match[9] === 'true',
    })
  }
  return tags
}

const dayPlan = loadDayPlan()
const contentTags = loadContentTags()

section('0. 시드 파싱')
check('day_plan 14일', dayPlan.days.length === 14, `days=${dayPlan.days.length}`)
check('콘텐츠 태그 23행', contentTags.length === 23, `tags=${contentTags.length}`)
check('축 태그 8행', contentTags.filter((t) => t.axis_key).length === 8)
check('Day 7 = weekly_report', dayPlan.days[6].kind === 'weekly_report')
check('Day 14 = progress_check', dayPlan.days[13].kind === 'progress_check')

// --- 우선순위 ---------------------------------------------------------------

section('1. 관리 우선순위 (buildAxisPriority)')

const axisRows = [
  { key: 'neck', axisLookupKey: 'neck', dominantCode: 'F', dominantPercent: 68, dominantLabel: '전방' },
  { key: 'shoulder', axisLookupKey: 'shoulder', dominantCode: 'R', dominantPercent: 55, dominantLabel: '오른쪽 높음' },
  { key: 'pelvis', axisLookupKey: 'pelvis', dominantCode: 'R', dominantPercent: 72, dominantLabel: '오른쪽 회전' },
  { key: 'flexibility', axisLookupKey: 'lower', dominantCode: 'S', dominantPercent: 60, dominantLabel: '뻣뻣' },
]
const priority = buildAxisPriority(axisRows)
check('P1 = 가장 높은 축(pelvis 72%)', priority[0].axis === 'pelvis' && priority[0].rank === 1)
check('P2 = 두 번째(neck 68%)', priority[1].axis === 'neck')
check('방향 코드 보존', priority[0].direction === 'R')

const tied = buildAxisPriority([
  { key: 'neck', axisLookupKey: 'neck', dominantCode: 'F', dominantPercent: 60, dominantLabel: '전방' },
  { key: 'flexibility', axisLookupKey: 'lower', dominantCode: 'S', dominantPercent: 60, dominantLabel: '뻣뻣' },
])
check('동점이면 하체 우선 (codePlanShared 규칙과 동일)', tied[0].axis === 'lower')

// --- Day 배정 ---------------------------------------------------------------

section('2. Day 슬롯 배정 (selectDailyMissions)')

const base = { dayPlan, axisPriority: priority, contentTags, availableMinutes: 15 }
const now = new Date('2026-08-27T10:00:00+09:00')

const day1 = selectDailyMissions({ ...base, dayNo: 1, now })
check('Day 1 미션 1개', day1.length === 1, `len=${day1.length}`)
check('Day 1 = P1축(pelvis)', day1[0]?.source_rule === 'axis_p1')
check('Day 1 콘텐츠가 pelvis 축', contentTags.find((t) => t.content_key === day1[0]?.content_key)?.axis_key === 'pelvis')

const day2 = selectDailyMissions({ ...base, dayNo: 2, now })
check('Day 2 = P2축(neck)', day2[0]?.source_rule === 'axis_p2')
check('Day 2 콘텐츠가 neck 축', contentTags.find((t) => t.content_key === day2[0]?.content_key)?.axis_key === 'neck')

const day7 = selectDailyMissions({ ...base, dayNo: 7, now })
check('Day 7 미션 2개', day7.length === 2, `len=${day7.length}`)
check('Day 7 슬롯1 = release', day7[0]?.mission_type === 'release')
check('Day 7 슬롯2 = stretch', day7[1]?.mission_type === 'stretch')
check('Day 7 두 미션의 콘텐츠가 서로 다름', day7[0]?.content_key !== day7[1]?.content_key)

const day1Again = selectDailyMissions({ ...base, dayNo: 1, now })
check('같은 입력 → 같은 결과 (결정적)', JSON.stringify(day1) === JSON.stringify(day1Again))

section('3. 가용 시간 예산')
const short = selectDailyMissions({ ...base, dayNo: 14, availableMinutes: 3, now })
check('3분이면 Day 14 두 슬롯 중 1개만', short.length === 1, `len=${short.length}`)
const long = selectDailyMissions({ ...base, dayNo: 14, availableMinutes: 15, now })
check('15분이면 Day 14 두 슬롯 모두', long.length === 2, `len=${long.length}`)

// --- 피드백 조정 -------------------------------------------------------------

section('4. 피드백 → 다음 미션 조정')

check('HARD → 난이도 감소', adjustDifficulty(3, 'HARD') === 2)
check('EASY → 난이도 증가', adjustDifficulty(2, 'EASY') === 3)
check('GOOD → 유지', adjustDifficulty(2, 'GOOD') === 2)
check('난이도 하한 1', adjustDifficulty(1, 'HARD') === 1)
check('난이도 상한 3', adjustDifficulty(3, 'EASY') === 3)
check('HARD → 시간 감소', scaleDuration(180, 'HARD') < 180)
check('EASY → 시간 증가', scaleDuration(180, 'EASY') > 180)
check('시간 하한 60초', scaleDuration(60, 'HARD') === 60)

const hardFeedback = [
  { content_key: 'axis_3R', feeling: 'SAME', difficulty: 'HARD', created_at: '2026-08-26T00:00:00Z' },
  { content_key: 'axis_1F', feeling: 'SAME', difficulty: 'HARD', created_at: '2026-08-25T00:00:00Z' },
  { content_key: 'axis_3R', feeling: 'SAME', difficulty: 'GOOD', created_at: '2026-08-24T00:00:00Z' },
]
check('최근 3건 다수결 = HARD', summarizeFeedback(hardFeedback).difficultyTrend === 'HARD')

const day11Normal = selectDailyMissions({ ...base, dayNo: 11, now })
const day11Hard = selectDailyMissions({ ...base, dayNo: 11, feedback: hardFeedback, now })
check(
  'HARD 피드백 후 난이도가 낮아짐',
  day11Hard[0].difficulty < day11Normal[0].difficulty,
  `${day11Normal[0].difficulty} -> ${day11Hard[0].difficulty}`,
)
check(
  'HARD 피드백 후 시간이 줄어듦',
  day11Hard[0].planned_duration_sec < day11Normal[0].planned_duration_sec,
  `${day11Normal[0].planned_duration_sec}s -> ${day11Hard[0].planned_duration_sec}s`,
)

section('5. UNCOMFORTABLE → 제외 / 대체')

const pelvisAxisKeys = contentTags.filter((t) => t.axis_key === 'pelvis').map((t) => t.content_key)
const uncomfortable = pelvisAxisKeys.map((key, index) => ({
  content_key: key,
  feeling: 'UNCOMFORTABLE',
  difficulty: 'GOOD',
  created_at: `2026-08-2${6 - index}T00:00:00Z`,
}))
const summary = summarizeFeedback(uncomfortable)
check('제외 목록에 반영', pelvisAxisKeys.every((key) => summary.excludedContentKeys.has(key)))

const substituted = selectDailyMissions({ ...base, dayNo: 1, feedback: uncomfortable, now })
check('제외된 콘텐츠는 다시 나오지 않음', !pelvisAxisKeys.includes(substituted[0]?.content_key))
check('같은 부위 콘텐츠로 대체', substituted[0]?.source_rule === 'substitute', `rule=${substituted[0]?.source_rule}`)
check(
  '대체 콘텐츠가 pelvis/waist 부위',
  ['pelvis', 'waist'].includes(
    contentTags.find((t) => t.content_key === substituted[0]?.content_key)?.body_part_key,
  ),
)

const better = [{ content_key: 'axis_3R', feeling: 'BETTER', difficulty: 'GOOD', created_at: '2026-08-26T00:00:00Z' }]
check('BETTER 는 선호 목록에', summarizeFeedback(better).preferredContentKeys.has('axis_3R'))

// --- 미접속 복귀 -------------------------------------------------------------

section('6. 장기간 미접속 → Restart Mission')

const restart = selectDailyMissions({
  ...base,
  dayNo: 5,
  lastActiveAt: '2026-08-22T10:00:00+09:00',
  now,
})
check('Restart 미션 1개', restart.length === 1, `len=${restart.length}`)
check('source_rule = restart', restart[0]?.source_rule === 'restart')
check('난이도 1', restart[0]?.difficulty === 1)
check('시간 절반 이하', restart[0]?.planned_duration_sec <= 90, `${restart[0]?.planned_duration_sec}s`)
check('5일 전 접속 → 5일', daysSince('2026-08-22T10:00:00+09:00', now) === 5)
check('어제 접속이면 restart 아님', selectDailyMissions({
  ...base, dayNo: 5, lastActiveAt: '2026-08-26T10:00:00+09:00', now,
})[0]?.source_rule !== 'restart')

// --- Day 계산 ---------------------------------------------------------------

section('7. Day 계산 (KST 자정 경계)')
check('시작 당일 = Day 1', computeCurrentDay('2026-08-27T09:00:00+09:00', now) === 1)
check('다음 날 = Day 2', computeCurrentDay('2026-08-26T23:50:00+09:00', now) === 2)
check('KST 자정 직전 시작도 하루로', computeCurrentDay('2026-08-27T00:10:00+09:00', now) === 1)
check('14일 상한', computeCurrentDay('2026-01-01T00:00:00+09:00', now) === 14)

// --- 리포트 -----------------------------------------------------------------

section('8. 리포트 집계 (buildReportPayload)')
const missions = [
  { day_no: 1, content_key: 'axis_3R', status: 'completed' },
  { day_no: 2, content_key: 'axis_1F', status: 'completed' },
  { day_no: 3, content_key: 'axis_3R', status: 'skipped' },
  { day_no: 4, content_key: 'axis_1F', status: 'completed' },
  { day_no: 9, content_key: 'axis_3R', status: 'completed' },
]
const report = buildReportPayload(missions, hardFeedback, contentTags, 1, 7)
check('기간 내 미션만 집계', report.completion.scheduled === 4, `scheduled=${report.completion.scheduled}`)
check('완료 3건', report.completion.completed === 3)
check('완료율 75%', report.completion.rate === 75, `rate=${report.completion.rate}`)
check('축별 집계', report.axis_focus.pelvis === 2 && report.axis_focus.neck === 2)
check('HARD 추세 → 강도 낮추는 힌트', report.next_hint.includes('줄여'))

section('9. 미션 실행 단계 (buildMissionSteps)')

// immediate_action_content 23행의 공통 규격
const sampleContent = {
  release_title: '상부승모근 이완',
  release_content: '1. 앉거나 선다 / 2. 손으로 근육을 잡는다 / 3. 천천히 누른다',
  release_tool: '손',
  release_duration_sec: 90,
  stretch_title: '상부승모근 스트레칭',
  stretch_content: '1. 머리를 반대쪽으로 / 2. 30초 유지',
  stretch_duration_sec: 30,
  sets: 3,
}

const comboSteps = buildMissionSteps(sampleContent, { mission_type: 'combo', planned_duration_sec: 180 })
check('combo = 이완 1 + 스트레칭 3세트', comboSteps.length === 4, `len=${comboSteps.length}`)
check('첫 단계는 이완', comboSteps[0].kind === 'release')
check('이완 90초', comboSteps[0].seconds === 90, `${comboSteps[0].seconds}s`)
check('스트레칭 30초', comboSteps[1].seconds === 30, `${comboSteps[1].seconds}s`)
check('총합 = 배정 시간', comboSteps.reduce((a, s2) => a + s2.seconds, 0) === 180)
check('세트 표기', comboSteps[3].meta === '3세트 / 3세트', comboSteps[3].meta)
check('수행 단계 파싱', comboSteps[0].lines.length === 3 && comboSteps[0].lines[0] === '앉거나 선다')

const releaseOnly = buildMissionSteps(sampleContent, { mission_type: 'release', planned_duration_sec: 90 })
check('release 타입은 이완만', releaseOnly.length === 1 && releaseOnly[0].kind === 'release')

const stretchOnly = buildMissionSteps(sampleContent, { mission_type: 'stretch', planned_duration_sec: 90 })
check('stretch 타입은 스트레칭 세트만', stretchOnly.length === 3 && stretchOnly.every((s2) => s2.kind === 'stretch'))

const hardScaled = buildMissionSteps(sampleContent, { mission_type: 'combo', planned_duration_sec: 120 })
const hardTotal = hardScaled.reduce((a, s2) => a + s2.seconds, 0)
check('HARD 로 줄어든 시간이 반영됨', hardTotal < 180 && hardTotal >= 100, `${hardTotal}s`)

const extreme = buildMissionSteps(sampleContent, { mission_type: 'combo', planned_duration_sec: 10 })
check('극단적으로 짧아도 최소 시간 보장', extreme.every((s2) => s2.seconds >= 10))

const missingDurations = buildMissionSteps(
  { ...sampleContent, release_duration_sec: null, stretch_duration_sec: null, sets: null },
  { mission_type: 'combo', planned_duration_sec: 180 },
)
check('시간 값이 없으면 기본 규격(90/30/3세트)', missingDurations.length === 4)

section('10. 다음 저니 추천 (recommendNextJourney)')

const mk = (rate, feeling = {}, difficulty = {}) => ({
  period: { from_day: 1, to_day: 14 },
  completion: { scheduled: 10, completed: 0, skipped: 0, rate },
  feeling: { BETTER: 0, SAME: 0, UNCOMFORTABLE: 0, ...feeling },
  difficulty: { EASY: 0, GOOD: 0, HARD: 0, ...difficulty },
  axis_focus: {},
  excluded_content_keys: [],
  next_hint: '',
})

check('완료율 30% -> 가볍게 한 번 더', recommendNextJourney(mk(30)).kind === 'restart_gentle')
check('불편 1건 -> 재측정', recommendNextJourney(mk(80, { UNCOMFORTABLE: 1 })).kind === 'remeasure')
check(
  '완료율 80% + EASY 우세 -> 2순위 축',
  recommendNextJourney(mk(80, {}, { EASY: 4, HARD: 1 })).kind === 'next_axis',
)
check('2순위 축 추천은 focusRank 2', recommendNextJourney(mk(80, {}, { EASY: 4, HARD: 1 })).focusRank === 2)
check('그 외 -> 재측정 후 이어가기', recommendNextJourney(mk(60, {}, { GOOD: 5 })).kind === 'remeasure')
check(
  '불편이 완료율보다 우선',
  recommendNextJourney(mk(90, { UNCOMFORTABLE: 1 }, { EASY: 5 })).kind === 'remeasure',
)
check('모든 추천에 사유 문구가 있음', ['restart_gentle', 'remeasure', 'next_axis'].every((k) => {
  const r = [mk(30), mk(80, { UNCOMFORTABLE: 1 }), mk(80, {}, { EASY: 4 })].map(recommendNextJourney)
  return r.every((x) => x.reason.length > 10)
}))

section('11. 재측정 전후 비교 (compareJourneyResults)')

// 운영 DB 의 실제 scoring_meta 형태를 그대로 사용
const mkMeta = (neck, shoulder, pelvis, flexibility) => ({
  axis: {
    neck: { sideA: 'F', sideB: 'C', scoreA: neck[0], scoreB: neck[1], winner: neck[0] >= neck[1] ? 'F' : 'C', tie: false, confidence: 'high', maxWeight: 10 },
    shoulder: { sideA: 'R', sideB: 'L', scoreA: shoulder[0], scoreB: shoulder[1], winner: shoulder[0] >= shoulder[1] ? 'R' : 'L', tie: false, confidence: 'high', maxWeight: 10 },
    pelvis: { sideA: 'R', sideB: 'L', scoreA: pelvis[0], scoreB: pelvis[1], winner: pelvis[0] >= pelvis[1] ? 'R' : 'L', tie: false, confidence: 'high', maxWeight: 16 },
    flexibility: { sideA: 'S', sideB: 'F', scoreA: flexibility[0], scoreB: flexibility[1], winner: flexibility[0] >= flexibility[1] ? 'S' : 'F', tie: false, confidence: 'high', maxWeight: 15 },
  },
  identity: {},
})

// 목 10:0(100%) -> 6:4(60%) : 차이가 크게 줄어듦
const before = { calculated_code: 'FRRS', primary_identity: '회복 우선형', scoring_meta: mkMeta([10, 0], [6, 4], [10, 6], [12, 3]) }
const after = { calculated_code: 'FRRS', primary_identity: '회복 우선형', scoring_meta: mkMeta([6, 4], [6, 4], [10, 6], [12, 3]) }
const cmp = compareJourneyResults(before, after)

check('4개 축 모두 비교', cmp.axes.length === 4, `len=${cmp.axes.length}`)
check('목 축 차이 줄어듦 -> narrowed', cmp.axes[0].trend === 'narrowed', cmp.axes[0].trend)
check('목 100% -> 60%', cmp.axes[0].beforePercent === 100 && cmp.axes[0].afterPercent === 60)
check('변화 없는 축은 similar', cmp.axes[1].trend === 'similar', cmp.axes[1].trend)
check('코드 문자 변경 0', cmp.changedAxisCount === 0)
check('아이덴티티 동일하면 changed=false', cmp.identityChanged === false)
check('중립 문구 사용(좋아졌다/나빠졌다 없음)',
  cmp.axes.every((a) => !a.message.includes('좋아') && !a.message.includes('나빠')))

// 방향이 뒤집힌 경우
const flipped = compareJourneyResults(
  { calculated_code: 'FRRS', scoring_meta: mkMeta([10, 0], [6, 4], [10, 6], [12, 3]) },
  { calculated_code: 'CRRS', scoring_meta: mkMeta([0, 10], [6, 4], [10, 6], [12, 3]) },
)
check('방향 뒤집힘 -> flipped', flipped.axes[0].trend === 'flipped')
check('코드 문자 1개 변경 감지', flipped.changedAxisCount === 1, `changed=${flipped.changedAxisCount}`)

// 차이가 커진 경우
const widened = compareJourneyResults(
  { calculated_code: 'FRRS', scoring_meta: mkMeta([6, 4], [6, 4], [10, 6], [12, 3]) },
  { calculated_code: 'FRRS', scoring_meta: mkMeta([10, 0], [6, 4], [10, 6], [12, 3]) },
)
check('차이 커짐 -> widened', widened.axes[0].trend === 'widened')

// 아이덴티티 변경
const identityChanged = compareJourneyResults(
  { calculated_code: 'FRRS', primary_identity: '회복 우선형', scoring_meta: mkMeta([10, 0], [6, 4], [10, 6], [12, 3]) },
  { calculated_code: 'FRRS', primary_identity: '밸런스 개선형', scoring_meta: mkMeta([10, 0], [6, 4], [10, 6], [12, 3]) },
)
check('아이덴티티 변경 감지', identityChanged.identityChanged === true)

// 데이터가 없는 경우
const empty = compareJourneyResults({ calculated_code: 'FRRS' }, { calculated_code: 'CRLF' })
check('scoring_meta 없으면 축 비교 0건', empty.axes.length === 0)
check('빈 비교도 안내 문구 제공', empty.summary.length > 0)

// 8%p 이하 변화는 측정 편차로 보고 similar
const smallChange = compareJourneyResults(
  { calculated_code: 'FRRS', scoring_meta: mkMeta([10, 0], [6, 4], [10, 6], [12, 3]) },
  { calculated_code: 'FRRS', scoring_meta: mkMeta([9, 1], [6, 4], [10, 6], [12, 3]) },
)
check(
  '가중치 1 문항 하나 차이(10%p)는 측정 편차로 보고 similar',
  smallChange.axes[0].trend === 'similar',
  smallChange.axes[0].trend,
)

// Primary 앵커(가중치 3) 수준의 변화는 실제 변화로 잡아야 한다
const anchorChange = compareJourneyResults(
  { calculated_code: 'FRRS', scoring_meta: mkMeta([10, 0], [6, 4], [10, 6], [12, 3]) },
  { calculated_code: 'FRRS', scoring_meta: mkMeta([7, 3], [6, 4], [10, 6], [12, 3]) },
)
check('가중치 3 앵커 변화(30%p)는 narrowed 로 감지', anchorChange.axes[0].trend === 'narrowed', anchorChange.axes[0].trend)

section('12. 리포트 집계 범위 (reportRangeFor)')

// 화면 문구가 "2주 진척 확인" 이므로 Day 14 리포트는 2주 전체를 집계해야 한다.
const weeklyRange = reportRangeFor('weekly', 7)
check('주간 리포트는 1~7', weeklyRange.fromDay === 1 && weeklyRange.toDay === 7)

const progressRange = reportRangeFor('progress_check', 14)
check(
  '2주 진척 확인은 1~14 (8~14 가 아님)',
  progressRange.fromDay === 1 && progressRange.toDay === 14,
  `${progressRange.fromDay}~${progressRange.toDay}`,
)

// 범위를 적용했을 때 집계가 실제로 2주 전체를 덮는지
const fullMissions = []
for (let d = 1; d <= 14; d += 1) {
  fullMissions.push({ day_no: d, content_key: d % 2 ? 'axis_3R' : 'axis_1F', status: d <= 12 ? 'completed' : 'skipped' })
}
const full = buildReportPayload(fullMissions, [], contentTags, progressRange.fromDay, progressRange.toDay)
check('2주 리포트가 14일 전체를 집계', full.completion.scheduled === 14, `scheduled=${full.completion.scheduled}`)
check('완료 12 / 14 = 86%', full.completion.rate === 86, `rate=${full.completion.rate}`)

const weekOnly = buildReportPayload(fullMissions, [], contentTags, 1, 7)
check('주간 리포트는 7일만 집계', weekOnly.completion.scheduled === 7)

section('13. 15분 케어 루틴 (buildCareRoutine)')

const routineAxisRows = [
  { axisLookupKey: 'neck', axisNo: 1, title: '목 위치', dominantCode: 'F', dominantLabel: '전방', dominantPercent: 60 },
  { axisLookupKey: 'shoulder', axisNo: 2, title: '어깨 높이', dominantCode: 'R', dominantLabel: '오른쪽', dominantPercent: 65 },
  { axisLookupKey: 'pelvis', axisNo: 3, title: '골반 회전', dominantCode: 'R', dominantLabel: '오른쪽', dominantPercent: 80 },
  { axisLookupKey: 'lower', axisNo: 4, title: '하체 유연성', dominantCode: 'S', dominantLabel: '뻣뻣', dominantPercent: 75 },
]
const routineMappings = [
  { axis_no: 1, axis_key: 'neck', direction_key: 'F', display_name: '목 앞쪽 경향 관리', release_content_key: 'axis_1F', stretch_content_key: 'axis_1F', is_active: true },
  { axis_no: 2, axis_key: 'shoulder', direction_key: 'R', display_name: '오른쪽 어깨 높음 관리', release_content_key: 'axis_2R', stretch_content_key: 'axis_2R', is_active: true },
  { axis_no: 3, axis_key: 'pelvis', direction_key: 'R', display_name: '골반 오른쪽 회전 관리', release_content_key: 'axis_3R', stretch_content_key: 'axis_3R', is_active: true },
  { axis_no: 4, axis_key: 'lower', direction_key: 'S', display_name: '하체 뻣뻣 경향 관리', release_content_key: 'axis_4S', stretch_content_key: 'axis_4S', is_active: true },
]
const mkContent = (k, n) => ({ content_key: k, display_name: n, target_muscle: '근육', release_title: '이완',
  release_content: '1. 준비 / 2. 실행', release_tool: '손', release_duration_sec: 90,
  stretch_title: '스트레칭', stretch_content: '1. 늘린다', stretch_duration_sec: 30, sets: 3, caution: '무리하지 않기' })
const routineContents = [
  mkContent('axis_1F', '목 앞쪽 경향 관리'), mkContent('axis_2R', '오른쪽 어깨 높음 관리'),
  mkContent('axis_3R', '골반 오른쪽 회전 관리'), mkContent('axis_4S', '하체 뻣뻣 경향 관리'),
]

// 1순위 골반, 2순위 하체 — 순서는 바뀌면 안 되고 시간만 달라져야 한다
const routine = buildCareRoutine(routineAxisRows, routineMappings, routineContents, ['pelvis', 'lower', 'shoulder', 'neck'])
const axisSteps = routine.steps.filter((s2) => s2.kind === 'axis')

check('4축 전부 포함', routine.coversAllAxes, axisSteps.map((s2) => s2.axis).join(','))
check('상→하 순서 고정 (목·어깨·골반·하체)',
  axisSteps.map((s2) => s2.axis).join(',') === 'neck,shoulder,pelvis,lower',
  axisSteps.map((s2) => s2.axis).join(','))
check('우선순위가 높아도 순서를 앞으로 당기지 않음', axisSteps[0].axis === 'neck')
check('총 15분(900초)', routine.totalSec === CARE_ROUTINE_TOTAL_SEC, `${routine.totalSec}s`)
check('1순위 축 세트 5', axisSteps.find((s2) => s2.axis === 'pelvis').sets === 5)
check('2순위 축 세트 4', axisSteps.find((s2) => s2.axis === 'lower').sets === 4)
check('3·4순위 축 세트 3', axisSteps.filter((s2) => ['neck', 'shoulder'].includes(s2.axis)).every((s2) => s2.sets === 3))
check('우선순위 배지는 1·2순위에만',
  axisSteps.filter((s2) => s2.priorityRank).length === 2,
  axisSteps.map((s2) => `${s2.axis}:${s2.priorityRank ?? '-'}`).join(' '))
check('마지막은 마무리 단계', routine.steps.at(-1).kind === 'finish')
check('수행법이 파싱됨', axisSteps.every((s2) => s2.releaseSteps.length === 2 && s2.stretchSteps.length === 1))

// 반대 방향 코드도 매핑되는지
const opposite = buildCareRoutine(
  routineAxisRows.map((r2) => ({ ...r2, dominantCode: { neck: 'C', shoulder: 'L', pelvis: 'L', lower: 'F' }[r2.axisLookupKey] })),
  routineMappings, routineContents, [])
check('매핑이 없는 방향은 해당 축을 건너뜀', opposite.steps.filter((s2) => s2.kind === 'axis').length === 0)

// 데이터가 없으면 빈 루틴 -> 화면은 기존 폴백 사용
const emptyRoutine = buildCareRoutine(routineAxisRows, [], [], [])
check('매핑·콘텐츠 없으면 빈 루틴 (폴백 유도)', emptyRoutine.steps.length === 0 && emptyRoutine.coversAllAxes === false)

// --- 결과 -------------------------------------------------------------------

console.log(`\n${'='.repeat(60)}`)
if (failures.length === 0) {
  console.log(`OK — ${passed}개 검증 모두 통과`)
  process.exit(0)
}
console.log(`FAIL — ${failures.length}개 실패 / ${passed}개 통과`)
for (const failure of failures) console.log(`  - ${failure}`)
process.exit(1)
