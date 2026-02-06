export function calculateBodyCode(answers: Record<number, string>): string {
  const answersArray = Object.entries(answers)
    .map(([key, value]) => ({ questionNumber: parseInt(key), value }))

  const neckAnswers = answersArray.filter(a => a.questionNumber >= 1 && a.questionNumber <= 10)
  const shoulderAnswers = answersArray.filter(a => a.questionNumber >= 11 && a.questionNumber <= 20)
  const pelvisAnswers = answersArray.filter(a => a.questionNumber >= 21 && a.questionNumber <= 30)
  const flexibilityAnswers = answersArray.filter(a => a.questionNumber >= 31 && a.questionNumber <= 40)

  function countAxisAnswers(answers: Array<{ questionNumber: number; value: string }>) {
    let count1 = 0
    let count3 = 0

    answers.forEach(a => {
      if (a.value === '①' || a.value === '1') count1++
      if (a.value === '③' || a.value === '3') count3++
    })

    return { count1, count3 }
  }

  const neck = countAxisAnswers(neckAnswers)
  const neckResult = neck.count1 >= neck.count3 ? 'F' : 'C'

  const shoulder = countAxisAnswers(shoulderAnswers)
  const shoulderResult = shoulder.count1 >= shoulder.count3 ? 'R' : 'L'

  const pelvis = countAxisAnswers(pelvisAnswers)
  const pelvisResult = pelvis.count1 >= pelvis.count3 ? 'R' : 'L'

  const flexibility = countAxisAnswers(flexibilityAnswers)
  const flexibilityResult = flexibility.count1 >= flexibility.count3 ? 'S' : 'F'

  return `${neckResult}${shoulderResult}${pelvisResult}${flexibilityResult}`
}

export function getAxisLabels(code: string) {
  return {
    neck: code[0] === 'F' ? '전방 (F)' : '중앙 (C)',
    shoulder: code[1] === 'R' ? '오른쪽 높음 (R)' : '왼쪽 높음 (L)',
    pelvis: code[2] === 'R' ? '오른쪽 회전 (R)' : '왼쪽 회전 (L)',
    flexibility: code[3] === 'S' ? '경직 (S)' : '유연 (F)'
  }
}

export function getBodyCodeKeywords(code: string) {
  const keywords = []

  if (code[0] === 'F') keywords.push('거북목')
  if (code[1] === 'R') keywords.push('오른쪽 어깨 기울임')
  if (code[1] === 'L') keywords.push('왼쪽 어깨 기울임')
  if (code[2] === 'R') keywords.push('골반 우회전')
  if (code[2] === 'L') keywords.push('골반 좌회전')
  if (code[3] === 'S') keywords.push('뻣뻣한 하체')
  if (code[3] === 'F') keywords.push('유연한 하체')

  return keywords
}

// Figma Character Names (한국어)
export const characterNames: Record<string, string> = {
  'FRRS': '암사가는 잠금 로봇',
  'FRRF': '기대면 흐르는 젤리인간',
  'FRLS': '되배기 금속 스프링',
  'FRLF': '회전 많은 풍선인형',
  'FLRS': '으쓱 고정 목각병정',
  'FLRF': '리듬은 좋은데 금방 시치는 갈대',
  'FLLS': '한쪽에 박힌 발톱',
  'FLLF': '녹아내리는 소프트콘',
  'CRRS': '닻',
  'CRRF': '오뚝이',
  'CRLS': '큐브 탑',
  'CRLF': '중심 귀찮은 문어',
  'CLRS': '엇갈려 잠긴 나무인형',
  'CLRF': '아슬아슬 젠가 탑',
  'CLLS': '한쪽 뿌리 소나무',
  'CLLF': '출렁이는 물침대'
};

export const allCodes = [
  'FRRS', 'FRRF', 'FRLS', 'FRLF',
  'FLRS', 'FLRF', 'FLLS', 'FLLF',
  'CRRS', 'CRRF', 'CRLS', 'CRLF',
  'CLRS', 'CLRF', 'CLLS', 'CLLF'
]
