/**
 * 서버(mebody-server)와 앱이 공유하는 사용자 노출 문구.
 * 제품 코드명: Mebody Code
 * 안내 표기: 체형코드(몸Bti)
 */

export const PRODUCT = {
  /** 로고/헤더 짧은 표기 */
  mark: 'mebody',
  /** 제품 코드명 (서버·앱 통일) */
  codeName: 'Mebody Code',
  /** 사용자 안내용 별칭 */
  codeGuide: '체형코드(몸Bti)',
  /** 한 줄 안내 */
  codeWithGuide: 'Mebody Code · 체형코드(몸Bti)',
} as const

export const LEGAL = {
  privacyPath: '/privacy.html',
  termsPath: '/terms.html',
  privacyLabel: '개인정보처리방침',
  termsLabel: '이용약관',
} as const

/** 화면별 CTA — 서버 index.html / 회원 홈과 맞춤 */
export const CTA = {
  diagnosisStart: 'Mebody Code 분석 시작하기',
  diagnosisStartShort: 'Mebody Code 분석 시작',
  viewResult: '내 Mebody Code 결과 보기',
  consentLocked: '아래로 내려 동의하기',
  consentAgree: '동의하고 계속하기',
  introLocked: '아래로 내려 시작하기',
  next: '다음',
  analyze: '분석하기',
  authLogin: '로그인하고 시작',
  authSignup: '회원가입하고 시작',
  missionStart: '14일 관리 시작하기',
  missionToday: '오늘의 미션 하러 가기',
  missionNow: '미션 시작하기',
} as const
