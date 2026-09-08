import type { Question } from '../api/questionnaire'

/** 선택지별 가이드 이미지가 하나라도 있으면 true (A9처럼 선택 후 상단→하단 전환) */
export function hasOptionGuideMedia(
  question: Pick<Question, 'media_url_option_1' | 'media_url_option_2' | 'media_url_option_3'>,
): boolean {
  return Boolean(
    question.media_url_option_1 || question.media_url_option_2 || question.media_url_option_3,
  )
}

/** 선택지(①/②/③)별 가이드 이미지 URL. 없으면 null */
export function getOptionGuideMediaUrl(
  question: Pick<Question, 'media_url_option_1' | 'media_url_option_2' | 'media_url_option_3'>,
  selectedAnswer?: string | null,
): string | null {
  if (!selectedAnswer) return null
  if (selectedAnswer === '①') return question.media_url_option_1 ?? null
  if (selectedAnswer === '②') return question.media_url_option_2 ?? null
  if (selectedAnswer === '③') return question.media_url_option_3 ?? null
  return null
}
