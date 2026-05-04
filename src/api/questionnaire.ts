import { supabase } from '../lib/supabase'
import { VER2_QUESTIONS } from '../data/ver2Questions'
import { calculateBodyCode, type AnswerMap, type ScoringQuestion } from '../utils/bodyCodeCalculator'

export type QuestionAnswerType = 'single' | 'multi'

export interface Question {
  id: number
  question_code: string
  question_number: number | null
  sort_order: number
  axis: string
  question_text: string
  option_1: string
  option_2: string
  option_3: string
  weight_a: number
  weight_b: number
  is_precheck: boolean
  is_scored: boolean
  answer_type: QuestionAnswerType
  max_select: number | null
}

export interface QuestionnaireResponse {
  id: string
  answers: AnswerMap
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

const OPTIONAL_RESPONSE_COLUMNS = [
  'user_id',
  'question_version',
] as const

function getErrorText(error: unknown): string {
  return String((error as { message?: string } | null)?.message ?? error ?? '').toLowerCase()
}

function stripUnsupportedColumns(payload: Record<string, unknown>, error: unknown): Record<string, unknown> | null {
  const text = getErrorText(error)
  if (!text.includes('does not exist')) return null

  let removed = false
  const nextPayload = { ...payload }

  for (const column of OPTIONAL_RESPONSE_COLUMNS) {
    if (column in nextPayload && text.includes(column)) {
      delete nextPayload[column]
      removed = true
    }
  }

  return removed ? nextPayload : null
}

async function mutateQuestionnaireResponse(questionnaireId: string | undefined, payload: Record<string, unknown>) {
  let nextPayload = { ...payload }

  while (true) {
    const { data, error } = await (
      questionnaireId
        ? supabase.from('questionnaire_responses').update(nextPayload).eq('id', questionnaireId)
        : supabase.from('questionnaire_responses').insert(nextPayload)
    )
      .select()
      .single()

    if (!error) return data

    const strippedPayload = stripUnsupportedColumns(nextPayload, error)
    if (strippedPayload) {
      nextPayload = strippedPayload
      continue
    }

    console.error('Error mutating questionnaire response:', error)
    throw error
  }
}

async function getCurrentAuthUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

function toQuestionAnswerType(value: unknown): QuestionAnswerType {
  return value === 'multi' ? 'multi' : 'single'
}

function mapLegacyQuestion(q: (typeof VER2_QUESTIONS)[number]): Question {
  return {
    id: q.id,
    question_code: String(q.question_number),
    question_number: q.question_number,
    sort_order: q.question_number,
    axis: q.axis,
    question_text: q.question_text,
    option_1: q.option_1,
    option_2: q.option_2,
    option_3: q.option_3,
    weight_a: q.weight_a,
    weight_b: q.weight_b,
    is_precheck: false,
    is_scored: true,
    answer_type: 'single',
    max_select: null,
  }
}

/** 문항은 Supabase questions 테이블 우선, 실패 시 Ver2 로컬 데이터 폴백 */
export async function fetchQuestions(): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_code, question_number, sort_order, axis, question_text, option_1, option_2, option_3, weight_a, weight_b, is_precheck, is_scored, answer_type, max_select')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (!error && data && data.length > 0) {
    return data.map((q) => ({
      id: Number.isFinite(Number(q.id)) && Number(q.id) > 0 ? Number(q.id) : Number(q.sort_order ?? q.question_number ?? 0),
      question_code: String(q.question_code ?? q.question_number ?? q.id),
      question_number: q.question_number === null || q.question_number === undefined ? null : Number(q.question_number),
      sort_order: Number(q.sort_order ?? q.question_number ?? q.id ?? 0),
      axis: String(q.axis ?? ''),
      question_text: String(q.question_text ?? ''),
      option_1: String(q.option_1 ?? ''),
      option_2: String(q.option_2 ?? ''),
      option_3: String(q.option_3 ?? ''),
      weight_a: Number(q.weight_a ?? 1),
      weight_b: Number(q.weight_b ?? 1),
      is_precheck: Boolean(q.is_precheck),
      is_scored: q.is_scored !== false,
      answer_type: toQuestionAnswerType(q.answer_type),
      max_select: q.max_select === null || q.max_select === undefined ? null : Number(q.max_select),
    }))
  }

  if (error) {
    console.warn('fetchQuestions from Supabase v3 schema failed. Trying legacy question schema.', error)

    const { data: legacyData, error: legacyError } = await supabase
      .from('questions')
      .select('id, question_number, axis, question_text, option_1, option_2, option_3, weight_a, weight_b')
      .order('question_number', { ascending: true })

    if (!legacyError && legacyData && legacyData.length > 0) {
      return legacyData.map((q) => ({
        id: Number.isFinite(Number(q.id)) && Number(q.id) > 0 ? Number(q.id) : Number(q.question_number),
        question_code: String(q.question_number),
        question_number: Number(q.question_number),
        sort_order: Number(q.question_number),
        axis: String(q.axis ?? ''),
        question_text: String(q.question_text ?? ''),
        option_1: String(q.option_1 ?? ''),
        option_2: String(q.option_2 ?? ''),
        option_3: String(q.option_3 ?? ''),
        weight_a: Number(q.weight_a ?? 1),
        weight_b: Number(q.weight_b ?? 1),
        is_precheck: false,
        is_scored: true,
        answer_type: 'single',
        max_select: null,
      }))
    }

    if (legacyError) {
      console.warn('fetchQuestions legacy schema failed. Falling back to local Ver2 questions.', legacyError)
    }
  }

  return VER2_QUESTIONS.map(mapLegacyQuestion)
}

export async function saveDraft(answers: AnswerMap, questionnaireId?: string) {
  const now = new Date().toISOString()
  const userId = await getCurrentAuthUserId()
  const payload = {
    answers,
    status: 'draft' as const,
    updated_at: now,
    user_id: userId,
    question_version: 'v3_49_precheck',
  }
  return mutateQuestionnaireResponse(questionnaireId, payload as Record<string, unknown>)
}

export async function submitQuestionnaire(
  answers: AnswerMap,
  questionnaireId?: string,
  scoringQuestions?: ScoringQuestion[],
) {
  const result = calculateBodyCode(answers, scoringQuestions)
  const code = result.code
  const userId = await getCurrentAuthUserId()

  const now = new Date().toISOString()
  const payload = {
    answers,
    calculated_code: code,
    status: 'completed' as const,
    completed_at: now,
    updated_at: now,
    user_id: userId,
    question_version: 'v3_49_precheck',
  }
  const data = await mutateQuestionnaireResponse(questionnaireId, payload as Record<string, unknown>)

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
