import { supabase } from '../lib/supabase'

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

export async function fetchQuestions(): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .order('question_number')

  if (error) {
    console.error('Error fetching questions:', error)
    throw error
  }

  return data || []
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
  const code = calculateBodyCode(answers)

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

  return data
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

function calculateBodyCode(answers: Record<number, string>): string {
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
