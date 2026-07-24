import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { V1_QUESTION_SET, V1_QUESTIONS_SNAPSHOT, type V1Question } from '../data/v1QuestionsSnapshot'
import { calculateBodyCode, type AnswerMap, type ScoringQuestion } from '../utils/bodyCodeCalculator'

export type QuestionAnswerType = 'single' | 'multi'

export interface Question extends V1Question {}

export interface QuestionnaireResponse {
  id: string
  answers: AnswerMap
  calculated_code: string
  status: 'draft' | 'completed'
  created_at: string
  updated_at: string
  completed_at?: string
  primary_identity?: string
  scoring_meta?: Record<string, unknown>
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
  'primary_identity',
  'scoring_meta',
] as const

const MIN_ACTIVE_QUESTION_COUNT = 32
const REQUIRED_QUESTION_CODES = ['A1', 'B1', 'C1', 'D7'] as const
const QUESTION_CACHE_STORAGE_KEY = 'mebody:questions:mebody_v1_32'
const LOCAL_RESULT_PREFIX = 'local-result-'
const LOCAL_RESULT_STORAGE_PREFIX = 'mebody:local-result:'
const QUESTION_QUERY_TIMEOUT_MS = 2500

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

function getSnapshotQuestions(): Question[] {
  return V1_QUESTIONS_SNAPSHOT.map((item) => ({ ...item }))
}

function isValidQuestionSet(questions: Question[]): boolean {
  if (questions.length < MIN_ACTIVE_QUESTION_COUNT) return false
  const questionCodes = new Set(questions.map((question) => question.question_code))
  return REQUIRED_QUESTION_CODES.every((code) => questionCodes.has(code))
}

function normalizeQuestionSet(questions: Question[]): Question[] | null {
  const sortedQuestions = [...questions].sort((a, b) => a.sort_order - b.sort_order)
  return isValidQuestionSet(sortedQuestions) ? sortedQuestions : null
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
    primary_identity: bodyCodeResult.primaryIdentityLabel,
    scoring_meta: bodyCodeResult.scoringMeta,
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

    return normalizeQuestionSet(parsed.map((item) => mapQuestionRow(item as Record<string, unknown>)))
  } catch (error) {
    console.warn('readPersistedQuestions failed:', error)
    return null
  }
}

function persistQuestions(questions: Question[]) {
  if (typeof window === 'undefined' || !isValidQuestionSet(questions)) return

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
    axis: String(q.axis ?? 'none'),
    question_text: String(q.question_text ?? ''),
    option_1: String(q.option_1 ?? ''),
    option_2: String(q.option_2 ?? ''),
    option_3: String(q.option_3 ?? ''),
    weight_a: Number(q.weight_a ?? 0),
    weight_b: Number(q.weight_b ?? 0),
    is_precheck: Boolean(q.is_precheck),
    is_scored: q.is_scored !== false,
    answer_type: q.answer_type === 'multi' ? 'multi' : 'single',
    max_select: q.max_select === null || q.max_select === undefined ? null : Number(q.max_select),
    title: String(q.title ?? ''),
    part: String(q.part ?? ''),
    instruction: String(q.instruction ?? ''),
    guide_text: String(q.guide_text ?? ''),
    axis_anchor: String(q.axis_anchor ?? 'None'),
    axis_priority: q.axis_priority === null || q.axis_priority === undefined ? null : Number(q.axis_priority),
    question_set: String(q.question_set ?? V1_QUESTION_SET),
    media_type: q.media_type == null || q.media_type === '' ? null : String(q.media_type),
    media_url: q.media_url == null || q.media_url === '' ? null : String(q.media_url),
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

async function loadQuestionsFromSource(): Promise<Question[]> {
  let data: Record<string, unknown>[] | null = null
  let error: unknown = null

  try {
    const result = await withTimeout(
      // DO NOT drop public.questions — this is the live UI source (32 rows).
      // question_choice_scores is scoring-only and does not replace questions.
      supabase
        .from('questions')
        .select('id, question_code, question_number, sort_order, axis, question_text, option_1, option_2, option_3, weight_a, weight_b, is_precheck, is_scored, answer_type, max_select, title, part, instruction, guide_text, axis_anchor, axis_priority, question_set, media_type, media_url')
        .eq('is_active', true)
        .eq('question_set', V1_QUESTION_SET)
        .order('sort_order', { ascending: true }),
      QUESTION_QUERY_TIMEOUT_MS,
      'fetchQuestions v1',
    )
    data = result.data
    error = result.error
  } catch (caught) {
    error = caught
  }

  if (!error && data && data.length > 0) {
    const mappedQuestions = normalizeQuestionSet(data.map(mapQuestionRow))
    if (mappedQuestions) {
      questionsCache = mappedQuestions
      persistQuestions(questionsCache)
      return questionsCache
    }

    console.warn(
      `fetchQuestions ignored invalid Supabase question set. received=${data.length}, required=${MIN_ACTIVE_QUESTION_COUNT}`,
    )
  }

  if (error) {
    console.warn(
      isTimeoutError(error)
        ? 'fetchQuestions Supabase query timed out. Falling back to bundled 32-question snapshot.'
        : 'fetchQuestions from Supabase failed. Falling back to bundled 32-question snapshot.',
      error,
    )
  }

  questionsCache = getSnapshotQuestions()
  return questionsCache
}

/** Supabase를 우선 조회해 DB 수정이 화면에 바로 반영되게 함. 실패 시에만 캐시/스냅샷. */
export async function fetchQuestions(): Promise<Question[]> {
  if (questionsRequest) return questionsRequest

  questionsRequest = (async () => {
    try {
      // 구버전 캐시 키 정리
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem('mebody:questions:v3_49_precheck')
        } catch {
          /* ignore */
        }
      }

      const fromNetwork = await loadQuestionsFromSource()
      questionsCache = fromNetwork
      return fromNetwork
    } catch (error) {
      console.warn('fetchQuestions failed. Falling back to cache/snapshot.', error)
      const persisted = readPersistedQuestions()
      questionsCache = persisted ?? getSnapshotQuestions()
      return questionsCache
    } finally {
      questionsRequest = null
    }
  })()

  return questionsRequest
}

export function clearQuestionsCache(): void {
  questionsCache = null
  questionsRequest = null
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(QUESTION_CACHE_STORAGE_KEY)
    window.localStorage.removeItem('mebody:questions:v3_49_precheck')
  } catch {
    /* ignore */
  }
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
    question_version: V1_QUESTION_SET,
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
    question_version: V1_QUESTION_SET,
    primary_identity: result.primaryIdentityLabel ?? null,
    scoring_meta: result.scoringMeta ?? {},
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
    return {
      ...responseData,
      body_code_content: getFallbackBodyCodeContent(responseData.calculated_code),
    }
  }

  return {
    ...responseData,
    body_code_content: contentData,
  }
}
