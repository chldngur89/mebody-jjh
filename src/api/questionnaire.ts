import { supabase } from '../lib/supabase'
import { VER2_QUESTIONS } from '../data/ver2Questions'
import { calculateBodyCode } from '../utils/bodyCodeCalculator'

export interface Question {
  id: number
  question_number: number
  axis: 'neck' | 'shoulder' | 'pelvis' | 'flexibility'
  question_text: string
  option_1: string
  option_2: string
  option_3: string
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

/** Ver2 문항 사용 (doc/ver2 문항 엑셀 기준). DB questions 테이블은 사용하지 않음 */
export async function fetchQuestions(): Promise<Question[]> {
  return VER2_QUESTIONS.map((q) => ({
    id: q.id,
    question_number: q.question_number,
    axis: q.axis,
    question_text: q.question_text,
    option_1: q.option_1,
    option_2: q.option_2,
    option_3: q.option_3,
  }))
}

export async function saveDraft(answers: Record<number, string>, questionnaireId?: string) {
  const { data, error } = await supabase
    .from('questionnaire_responses')
    .upsert({
      id: questionnaireId,
      answers,
      status: 'draft',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'id'
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving draft:', error)
    throw error
  }

  return data
}

export async function submitQuestionnaire(answers: Record<number, string>) {
  const result = calculateBodyCode(answers)
  const code = result.code

  const { data, error } = await supabase
    .from('questionnaire_responses')
    .insert({
      answers,
      calculated_code: code,
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .select()
    .single()

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

