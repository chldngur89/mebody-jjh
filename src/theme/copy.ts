/**
 * 서버(mebody-server)와 앱이 공유하는 사용자 노출 문구.
 *
 * 사용자 노출 명: mebody Code
 * 보조 설명: 자세·체형 셀프 체크
 * (MEBODY / 몸Bti / 체형코드 혼용 금지 — 화면·OG·공유에 이 상수만 씁니다)
 */

export const PRODUCT = {
  /** 로고/헤더 짧은 표기 */
  mark: 'mebody',
  /** 제품 코드명 (서버·앱 통일) */
  codeName: 'mebody Code',
  /** 사용자 안내용 보조 설명 */
  codeGuide: '자세·체형 셀프 체크',
  /** 한 줄 안내 */
  codeWithGuide: 'mebody Code · 자세·체형 셀프 체크',
  /**
   * 14일 프로그램의 사용자 노출명.
   * 하단 탭이 "루틴" 이라 사용자는 그 단어로 화면을 찾는다. 여기에 맞춘다.
   * (저니 / 14일 관리 / 14일 미션 혼용 금지 — '저니' 는 DB·모듈 이름일 뿐이다)
   */
  program: '14일 루틴',
} as const

export const LEGAL = {
  privacyPath: '/privacy.html',
  termsPath: '/terms.html',
  privacyLabel: '개인정보처리방침',
  termsLabel: '이용약관',
} as const

/** 화면별 CTA — 동사 고정: 동의 / 분석 / 저장 / 미션 */
export const CTA = {
  diagnosisStart: 'mebody Code 분석하기',
  diagnosisStartShort: '분석하기',
  viewResult: '내 mebody Code 결과 보기',
  consentLocked: '아래로 내려 동의하기',
  consentAgree: '동의하기',
  introLocked: '아래로 내려 분석하기',
  next: '다음',
  analyze: '분석하기',
  authLogin: '로그인하고 저장',
  authSignup: '회원가입하고 저장',
  /** 결과 화면 — 휴대폰 번호로 짧게 보관 */
  missionStart: '14일 루틴 시작하기',
  missionToday: '오늘의 미션 하러 가기',
  missionNow: '미션 시작하기',
  resumeAnalysis: '이어서 분석하기',
  startFresh: '처음부터 하기',
  shareImage: '카드 이미지 저장·공유',
  shareLink: '링크 복사',
} as const
