import { supabase } from '../lib/supabase'
import { VER2_QUESTIONS } from '../data/ver2Questions'
import { calculateBodyCode, type ScoringQuestion } from '../utils/bodyCodeCalculator'

export interface Question {
  id: number
  question_number: number
  axis: 'neck' | 'shoulder' | 'pelvis' | 'flexibility'
  question_text: string
  option_1: string
  option_2: string
  option_3: string
  weight_a: number
  weight_b: number
}

export interface QuestionnaireResponse {
  id: string
  answers: Record<number, string>
  calculated_code: string
  status: 'draft' | 'completed'
  created_at: string
  updated_at: string
  completed_at?: string
}

export interface BodyCodeContent {
  body_code: string
  character_name: string
  description: string
  neck_result: string
  shoulder_result: string
  pelvis_result: string
  flexibility_result: string
  lifestyle_tips: string[]
  exercises: Array<{
    title: string
    duration: string
    desc: string
  }>
  health_products: Array<{
    name: string
    desc: string
  }>
}

/** 문항은 Supabase questions 테이블 우선, 실패 시 Ver2 로컬 데이터 폴백 */
export async function fetchQuestions(): Promise<Question[]> {
  const fallbackByNumber = new Map(VER2_QUESTIONS.map((q) => [q.question_number, q]))
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_number, axis, question_text, option_1, option_2, option_3, weight_a, weight_b')
    .order('question_number', { ascending: true })

  if (!error && data && data.length > 0) {
    return data.map((q) => ({
      // questions.id가 숫자가 아니면 question_number를 식별자로 사용
      id: Number.isFinite(Number(q.id)) && Number(q.id) > 0 ? Number(q.id) : Number(q.question_number),
      question_number: Number(q.question_number),
      axis:
        q.axis === 'neck' || q.axis === 'shoulder' || q.axis === 'pelvis' || q.axis === 'flexibility'
          ? q.axis
          : 'neck',
      question_text: String(q.question_text ?? ''),
      option_1: String(q.option_1 ?? ''),
      option_2: String(q.option_2 ?? ''),
      option_3: String(q.option_3 ?? ''),
      weight_a: Number(q.weight_a ?? fallbackByNumber.get(Number(q.question_number))?.weight_a ?? 1),
      weight_b: Number(q.weight_b ?? fallbackByNumber.get(Number(q.question_number))?.weight_b ?? 1),
    }))
  }

  if (error) {
    console.warn('fetchQuestions from Supabase failed. Falling back to local Ver2 questions.', error)
  }

  return VER2_QUESTIONS.map((q) => ({
    id: q.id,
    question_number: q.question_number,
    axis: q.axis,
    question_text: q.question_text,
    option_1: q.option_1,
    option_2: q.option_2,
    option_3: q.option_3,
    weight_a: q.weight_a,
    weight_b: q.weight_b,
  }))
}

export async function saveDraft(answers: Record<number, string>, questionnaireId?: string) {
  const now = new Date().toISOString()
  const payload = {
    answers,
    status: 'draft' as const,
    updated_at: now
  }
  const query = questionnaireId
    ? supabase
        .from('questionnaire_responses')
        .update(payload)
        .eq('id', questionnaireId)
    : supabase
        .from('questionnaire_responses')
        .insert(payload)

  const { data, error } = await query
    .select()
    .single()

  if (error) {
    console.error('Error saving draft:', error)
    throw error
  }

  return data
}

export async function submitQuestionnaire(
  answers: Record<number, string>,
  questionnaireId?: string,
  scoringQuestions?: ScoringQuestion[],
) {
  const result = calculateBodyCode(answers, scoringQuestions)
  const code = result.code

  const now = new Date().toISOString()
  const payload = {
    answers,
    calculated_code: code,
    status: 'completed' as const,
    completed_at: now,
    updated_at: now
  }
  let data: QuestionnaireResponse | null = null
  let error: unknown = null

  if (questionnaireId) {
    const updated = await supabase
      .from('questionnaire_responses')
      .update(payload)
      .eq('id', questionnaireId)
      .select()
      .single()
    data = updated.data
    error = updated.error
  } else {
    const inserted = await supabase
      .from('questionnaire_responses')
      .insert(payload)
      .select()
      .single()
    data = inserted.data
    error = inserted.error
  }

  if (error) {
    console.error('Error submitting questionnaire:', error)
    throw error
  }

  return { ...data, body_code_meta: result }
}

export async function fetchQuestionnaireResult(questionnaireId: string) {
  // 1단계: 설문 응답 가져오기
  const { data: responseData, error: responseError } = await supabase
    .from('questionnaire_responses')
    .select('*')
    .eq('id', questionnaireId)
    .single()

  if (responseError) {
    console.error('Error fetching questionnaire result:', responseError)
    throw responseError
  }

  // 2단계: body_code_content에서 캐릭터 정보 가져오기
  const { data: contentData, error: contentError } = await supabase
    .from('body_code_content')
    .select('*')
    .eq('body_code', responseData.calculated_code)
    .single()

  if (contentError) {
    console.error('Error fetching body code content:', contentError)
    // 콘텐츠가 없어도 결과는 반환 (캐릭터 정보 없이)
    return responseData
  }

  // 응답에 body_code_content 합치기
  return {
    ...responseData,
    body_code_content: contentData
  }
}
