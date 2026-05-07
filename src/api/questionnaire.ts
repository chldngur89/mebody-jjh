import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { VER3_QUESTIONS_SNAPSHOT } from '../data/ver3QuestionsSnapshot'
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

function isMissingTableOrColumn(error: unknown): boolean {
  const text = getErrorText(error)
  return (
    text.includes('does not exist') ||
    text.includes('undefined column') ||
    (text.includes('column') && text.includes('does not exist'))
  )
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

let questionsCache: Question[] | null = null
let questionsRequest: Promise<Question[]> | null = null
const QUESTION_QUERY_TIMEOUT_MS = 2500
const MIN_ACTIVE_QUESTION_COUNT = 53
const QUESTION_CACHE_STORAGE_KEY = 'mebody:questions:v3_49_precheck'
const LOCAL_RESULT_PREFIX = 'local-result-'
const LOCAL_RESULT_STORAGE_PREFIX = 'mebody:local-result:'

function getSnapshotQuestions(): Question[] {
  return VER3_QUESTIONS_SNAPSHOT.map((item) => mapQuestionRow(item as Record<string, unknown>))
}

function getFallbackBodyCodeContent(bodyCode: string): BodyCodeContent {
  return {
    body_code: bodyCode,
    character_name: bodyCode,
    description: '현재 답변을 기준으로 mebody 코드가 계산되었습니다.',
    neck_result: '목 위치 사용 패턴입니다.',
    shoulder_result: '어깨 높이 사용 패턴입니다.',
    pelvis_result: '골반 회전 사용 패턴입니다.',
    flexibility_result: '하체 유연성 사용 패턴입니다.',
    lifestyle_tips: [],
    exercises: [],
    health_products: [],
  }
}

function getLocalResultStorageKey(questionnaireId: string): string {
  return `${LOCAL_RESULT_STORAGE_PREFIX}${questionnaireId}`
}

function isLocalResultId(questionnaireId: string): boolean {
  return questionnaireId.startsWith(LOCAL_RESULT_PREFIX)
}

export function readLocalQuestionnaireResult(questionnaireId: string): QuestionnaireResponse | null {
  if (typeof window === 'undefined' || !isLocalResultId(questionnaireId)) return null

  try {
    const raw = window.sessionStorage.getItem(getLocalResultStorageKey(questionnaireId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as QuestionnaireResponse
    return parsed?.id === questionnaireId ? parsed : null
  } catch (error) {
    console.warn('readLocalQuestionnaireResult failed:', error)
    return null
  }
}

async function fetchBodyCodeContentWithFallback(bodyCode: string): Promise<BodyCodeContent> {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('body_code_content')
        .select('*')
        .eq('body_code', bodyCode)
        .maybeSingle(),
      8000,
      'fetchBodyCodeContent',
    )

    if (!error && data) return data as BodyCodeContent
    if (error && !isNetworkError(error) && !isTimeoutError(error)) {
      console.warn('fetchBodyCodeContentWithFallback failed:', error)
    }
  } catch (error) {
    console.warn('fetchBodyCodeContentWithFallback timed out:', error)
  }

  return getFallbackBodyCodeContent(bodyCode)
}

export function createLocalQuestionnaireResult(
  answers: AnswerMap,
  scoringQuestions?: ScoringQuestion[],
): QuestionnaireResponse {
  const bodyCodeResult = calculateBodyCode(answers, scoringQuestions)
  const now = new Date().toISOString()
  const id = `${LOCAL_RESULT_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const response: QuestionnaireResponse = {
    id,
    answers,
    calculated_code: bodyCodeResult.code,
    status: 'completed',
    created_at: now,
    updated_at: now,
    completed_at: now,
  }

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(getLocalResultStorageKey(id), JSON.stringify(response))
    } catch (error) {
      console.warn('createLocalQuestionnaireResult persist failed:', error)
    }
  }

  return response
}

function readPersistedQuestions(): Question[] | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(QUESTION_CACHE_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length < MIN_ACTIVE_QUESTION_COUNT) return null

    return parsed.map((item) => mapQuestionRow(item as Record<string, unknown>))
  } catch (error) {
    console.warn('readPersistedQuestions failed:', error)
    return null
  }
}

function persistQuestions(questions: Question[]) {
  if (typeof window === 'undefined' || questions.length < MIN_ACTIVE_QUESTION_COUNT) return

  try {
    window.localStorage.setItem(QUESTION_CACHE_STORAGE_KEY, JSON.stringify(questions))
  } catch (error) {
    console.warn('persistQuestions failed:', error)
  }
}

function isTimeoutError(error: unknown): boolean {
  const text = getErrorText(error)
  return text.includes('timed out') || text.includes('abort')
}

function isNetworkError(error: unknown): boolean {
  const text = getErrorText(error)
  return (
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('network request failed') ||
    text.includes('load failed')
  )
}

async function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

function mapQuestionRow(q: Record<string, unknown>): Question {
  return {
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
  }
}

function mapLegacyQuestionRow(q: Record<string, unknown>): Question {
  return {
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
  }
}

async function getCurrentAuthUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

async function syncLatestBodyCodeToProfile(user: User | null, bodyCode: string) {
  if (!user?.id || !bodyCode) return

  const { data: contentData, error: contentError } = await supabase
    .from('body_code_content')
    .select('character_name, description')
    .eq('body_code', bodyCode)
    .maybeSingle()

  if (contentError && !isMissingTableOrColumn(contentError)) {
    console.warn('syncLatestBodyCodeToProfile content lookup failed:', contentError)
  }

  const displayName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null
  const payload = {
    id: user.id,
    auth_user_id: user.id,
    email: user.email ?? null,
    display_name: displayName,
    name: displayName,
    body_bti_code: bodyCode,
    body_bti_title: String(contentData?.character_name ?? bodyCode),
    body_bti_description: String(contentData?.description ?? ''),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'id' })

  if (error) {
    if (!isMissingTableOrColumn(error)) {
      console.warn('syncLatestBodyCodeToProfile failed:', error)
    }
  }
}

function toQuestionAnswerType(value: unknown): QuestionAnswerType {
  return value === 'multi' ? 'multi' : 'single'
}

async function loadQuestionsFromSource(): Promise<Question[]> {
  let data: Record<string, unknown>[] | null = null
  let error: unknown = null

  try {
    const result = await withTimeout(
      supabase
        .from('questions')
        .select('id, question_code, question_number, sort_order, axis, question_text, option_1, option_2, option_3, weight_a, weight_b, is_precheck, is_scored, answer_type, max_select')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      QUESTION_QUERY_TIMEOUT_MS,
      'fetchQuestions primary schema',
    )
    data = result.data
    error = result.error
  } catch (caught) {
    error = caught
  }

  if (!error && data && data.length > 0) {
    questionsCache = data.map(mapQuestionRow)
    persistQuestions(questionsCache)
    return questionsCache
  }

  if (error) {
    console.warn(
      isTimeoutError(error)
        ? 'fetchQuestions Supabase query timed out. Falling back to local questions.'
        : 'fetchQuestions from Supabase v3 schema failed. Trying legacy question schema.',
      error,
    )

    if (isTimeoutError(error) || isNetworkError(error)) {
      questionsCache = getSnapshotQuestions()
      return questionsCache
    }

    let legacyData: Record<string, unknown>[] | null = null
    let legacyError: unknown = null

    try {
      const legacyResult = await withTimeout(
        supabase
          .from('questions')
          .select('id, question_number, axis, question_text, option_1, option_2, option_3, weight_a, weight_b')
          .order('question_number', { ascending: true }),
        QUESTION_QUERY_TIMEOUT_MS,
        'fetchQuestions legacy schema',
      )
      legacyData = legacyResult.data
      legacyError = legacyResult.error
    } catch (caught) {
      legacyError = caught
    }

    if (!legacyError && legacyData && legacyData.length >= MIN_ACTIVE_QUESTION_COUNT) {
      questionsCache = legacyData.map(mapLegacyQuestionRow)
      persistQuestions(questionsCache)
      return questionsCache
    }

    if (legacyError) {
      console.warn('fetchQuestions legacy schema failed. Falling back to local Ver2 questions.', legacyError)
    }
  }

  questionsCache = getSnapshotQuestions()
  return questionsCache
}

/** 첫 렌더는 53문항 스냅샷으로 즉시 열고, Supabase questions 테이블은 백그라운드로 최신화 */
export async function fetchQuestions(): Promise<Question[]> {
  if (questionsCache) return questionsCache
  if (questionsRequest) return questionsRequest

  const persistedQuestions = readPersistedQuestions()
  if (persistedQuestions) {
    questionsCache = persistedQuestions
    questionsRequest = loadQuestionsFromSource()
      .then((questions) => {
        questionsCache = questions
        return questionsCache
      })
      .catch((error) => {
        console.warn('fetchQuestions background refresh failed:', error)
        return questionsCache ?? persistedQuestions
      })
      .finally(() => {
        questionsRequest = null
      })
    return questionsCache
  }

  questionsCache = getSnapshotQuestions()
  questionsRequest = loadQuestionsFromSource()
    .then((questions) => {
      questionsCache = questions
      persistQuestions(questionsCache)
      return questionsCache
    })
    .catch((error) => {
      console.warn('fetchQuestions background refresh failed. Using bundled question snapshot.', error)
      return questionsCache ?? getSnapshotQuestions()
    })
    .finally(() => {
      questionsRequest = null
    })

  return questionsCache
}

export function preloadQuestions(): void {
  if (questionsCache || questionsRequest) return
  void fetchQuestions().catch((error) => {
    console.warn('preloadQuestions failed:', error)
  })
}

export async function saveDraft(answers: AnswerMap, questionnaireId?: string) {
  const now = new Date().toISOString()
  const user = await getCurrentAuthUser()
  const payload = {
    answers,
    status: 'draft' as const,
    updated_at: now,
    user_id: user?.id ?? null,
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
  const user = await getCurrentAuthUser()

  const now = new Date().toISOString()
  const payload = {
    answers,
    calculated_code: code,
    status: 'completed' as const,
    completed_at: now,
    updated_at: now,
    user_id: user?.id ?? null,
    question_version: 'v3_49_precheck',
  }
  const data = await mutateQuestionnaireResponse(questionnaireId, payload as Record<string, unknown>)
  await syncLatestBodyCodeToProfile(user, code)

  return { ...data, body_code_meta: result }
}

export async function fetchQuestionnaireResult(questionnaireId: string) {
  const localResult = readLocalQuestionnaireResult(questionnaireId)
  if (localResult) {
    return {
      ...localResult,
      body_code_content: await fetchBodyCodeContentWithFallback(localResult.calculated_code),
    }
  }

  // 1단계: 설문 응답 가져오기
  const { data: responseData, error: responseError } = await withTimeout(
    supabase
      .from('questionnaire_responses')
      .select('*')
      .eq('id', questionnaireId)
      .single(),
    8000,
    'fetchQuestionnaireResult response',
  )

  if (responseError) {
    console.error('Error fetching questionnaire result:', responseError)
    throw responseError
  }

  // 2단계: body_code_content에서 캐릭터 정보 가져오기
  const { data: contentData, error: contentError } = await withTimeout(
    supabase
      .from('body_code_content')
      .select('*')
      .eq('body_code', responseData.calculated_code)
      .single(),
    5000,
    'fetchQuestionnaireResult content',
  )

  if (contentError) {
    console.error('Error fetching body code content:', contentError)
    // 콘텐츠가 없어도 결과는 반환 (캐릭터 정보 없이)
    return {
      ...responseData,
      body_code_content: getFallbackBodyCodeContent(responseData.calculated_code),
    }
  }

  // 응답에 body_code_content 합치기
  return {
    ...responseData,
    body_code_content: contentData
  }
}
