import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { V1_QUESTION_SET, V1_QUESTIONS_SNAPSHOT, type V1Question } from '../data/v1QuestionsSnapshot'
import { calculateBodyCode, type AnswerMap, type ScoringQuestion } from '../utils/bodyCodeCalculator'
import { PRODUCT } from '../theme/copy'
import { isMissingRpc, isRpcKnownMissing, markRpcMissing } from './rpcSupport'
import { reportError } from '../lib/reportError'

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
  /** 결과 첫 화면 부제(유형명) */
  identity_title?: string | null
  /** Home 본문 요약 — sections 2/3 대신 단일 출처 */
  identity_summary?: string | null
  identity_keywords?: string[] | null
  share_title?: string | null
  share_description?: string | null
  strategy_key?: string | null
  strategy_title?: string | null
  strategy_summary?: string | null
  primary_axis?: string | null
  secondary_axis?: string | null
  primary_goal?: string | null
  secondary_goal?: string | null
  starter_focus?: string[] | null
  progression_focus?: string[] | null
  journey_slug?: string | null
  journey_title?: string | null
  recommended_start_minutes?: number | null
}

const OPTIONAL_RESPONSE_COLUMNS = [
  'user_id',
  'question_version',
  'primary_identity',
  'scoring_meta',
] as const

const MIN_ACTIVE_QUESTION_COUNT = 32
const REQUIRED_QUESTION_CODES = ['A1', 'B1', 'C1', 'D7'] as const
// v4 — questions.media_url 이 DB 에서 비워졌다가 복구됐습니다(2026-09-16).
// 키를 올리지 않으면 기존 사용자는 사진이 null 인 옛 캐시를 계속 씁니다.
const QUESTION_CACHE_STORAGE_KEY = 'mebody:questions:mebody_v1_32:v4'
const LOCAL_RESULT_PREFIX = 'local-result-'
const LOCAL_RESULT_STORAGE_PREFIX = 'mebody:local-result:'
/**
 * 문항 조회 타임아웃.
 *
 * 2500ms 였는데 근거가 없었습니다. 이 쿼리는 32행 × 27컬럼(약 33KB)이고
 * 실측 0.22~0.77초입니다. 모바일 데이터나 Supabase 콜드 스타트에서는 2.5초를
 * 넘기고, 넘기면 앱이 번들 스냅샷으로 폴백합니다 — **스냅샷에는 media_url 이
 * 없어서 문항 사진이 전부 사라집니다.** 같은 파일의 콘텐츠 조회와 같은 8초로 맞춥니다.
 */
const QUESTION_QUERY_TIMEOUT_MS = 8000
/** 타임아웃·네트워크 오류일 때 한 번 더 시도합니다. 스냅샷 폴백은 최후수단입니다. */
const QUESTION_QUERY_RETRIES = 1

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

/** 새 응답의 id 를 앱이 만듭니다. 이유는 아래 mutateQuestionnaireResponse 주석 참고. */
function newResponseId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    // randomUUID 가 없는 아주 오래된 환경용 폴백
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0
      return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
  }
}

/**
 * 응답 저장 — save_questionnaire_response RPC 를 씁니다.
 *
 * 테이블에 직접 쓰지 않는 이유:
 *   044 에서 비회원의 테이블 SELECT·UPDATE 를 회수했습니다. 그 전에는 SELECT 정책이
 *   `user_id IS NULL` 이라 남의 비회원 응답 381건이 id 없이도 전부 읽혔습니다.
 *   그런데 `UPDATE ... WHERE id = ?` 은 WHERE 절이 컬럼을 읽으므로 SELECT 권한을
 *   함께 요구합니다. 읽기만 막으면 저장이 42501 로 깨지기 때문에 쓰기도 함수로 옮겼습니다.
 *
 * 새 응답의 id 는 앱이 만듭니다. RPC 가 id 를 돌려주긴 하지만, 아래 폴백 경로에서도
 * 같은 id 를 써야 호출부가 어느 쪽이든 동일하게 동작합니다.
 * 호출부는 `id` 와 `calculated_code` 만 쓰므로 반환값을 payload 로 조립해도 됩니다.
 */
const SAVE_RPC = 'save_questionnaire_response'

async function saveViaRpc(
  id: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<boolean> {
  if (isRpcKnownMissing(SAVE_RPC)) return false

  const request = supabase.rpc(SAVE_RPC, {
    p_id: id,
    p_answers: payload.answers ?? {},
    p_status: payload.status ?? 'draft',
    p_calculated_code: payload.calculated_code ?? null,
    p_completed_at: payload.completed_at ?? null,
    p_question_version: payload.question_version ?? null,
    p_primary_identity: payload.primary_identity ?? null,
    p_scoring_meta: payload.scoring_meta ?? null,
  })

  const { error } = await (signal ? request.abortSignal(signal) : request)
  if (!error) return true
  // 044 미적용 DB — 예전 테이블 경로로 되돌아갑니다
  if (isMissingRpc(error)) {
    markRpcMissing(SAVE_RPC)
    return false
  }

  console.error('Error saving questionnaire response:', error)
  throw error
}

async function mutateQuestionnaireResponse(questionnaireId: string | undefined, payload: Record<string, unknown>, signal?: AbortSignal) {
  const id = questionnaireId ?? newResponseId()
  const result = { ...payload, id } as Record<string, unknown> & { id: string }

  signal?.throwIfAborted()
  if (await saveViaRpc(id, payload, signal)) return result

  // ── 폴백: 044 를 아직 적용하지 않은 DB
  let nextPayload = questionnaireId ? { ...payload } : { ...payload, id }

  while (true) {
    signal?.throwIfAborted()
    const request = questionnaireId
      ? supabase.from('questionnaire_responses').update(nextPayload).eq('id', questionnaireId)
      : supabase.from('questionnaire_responses').insert(nextPayload)
    const { error } = await (signal ? request.abortSignal(signal) : request)

    if (!error) return result

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

/**
 * 상단 사진이 빠진 문항 코드. 비어 있으면 정상입니다.
 *
 * media_url 은 DB(questions.media_url)가 정본입니다. 과거에 이 컬럼이 통째로
 * 비워진 적이 있고 화면에는 빈 칸만 남았습니다 — 조용히 넘어가지 않고 잡습니다.
 */
export function findQuestionsMissingMedia(questions: Question[]): string[] {
  return questions.filter((q) => !q.media_url?.trim()).map((q) => q.question_code)
}

function normalizeQuestionSet(questions: Question[]): Question[] | null {
  const sortedQuestions = [...questions].sort((a, b) => a.sort_order - b.sort_order)
  return isValidQuestionSet(sortedQuestions) ? sortedQuestions : null
}

function getFallbackBodyCodeContent(bodyCode: string): BodyCodeContent {
  return {
    body_code: bodyCode,
    character_name: bodyCode,
    description: `현재 답변을 기준으로 ${PRODUCT.codeName}가 계산되었습니다.`,
    neck_result: '목 위치 사용 패턴입니다.',
    shoulder_result: '어깨 높이 사용 패턴입니다.',
    pelvis_result: '골반 회전 사용 패턴입니다.',
    flexibility_result: '하체 유연성 사용 패턴입니다.',
    lifestyle_tips: [],
    exercises: [],
    health_products: [],
    identity_title: null,
    identity_summary: null,
    identity_keywords: [],
    share_title: null,
    share_description: null,
    strategy_key: null,
    strategy_title: null,
    strategy_summary: null,
    primary_axis: null,
    secondary_axis: null,
    primary_goal: null,
    secondary_goal: null,
    starter_focus: [],
    progression_focus: [],
    journey_slug: null,
    journey_title: null,
    recommended_start_minutes: 5,
  }
}

function getLocalResultStorageKey(questionnaireId: string): string {
  return `${LOCAL_RESULT_STORAGE_PREFIX}${questionnaireId}`
}

/**
 * 비회원 결과는 **기기에** 남깁니다(localStorage).
 * 이전에는 sessionStorage 라 탭을 닫으면 결과가 사라졌습니다.
 * 시크릿 모드·저장 차단 환경에서는 접근 자체가 throw 하므로 전부 감쌉니다.
 */
function localStore(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** 이번 방문에만 쓰던 옛 저장소 — 기존 사용자의 결과를 잃지 않도록 읽기에서만 참조합니다. */
function legacySessionStore(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * 과거 로컬 결과를 지웁니다.
 * sessionStorage 시절에는 탭을 닫으면 알아서 없어졌지만, localStorage 는 남습니다.
 * 정리하지 않으면 재측정할 때마다 키가 하나씩 쌓입니다.
 */
function pruneLocalResults(keepId: string): void {
  for (const store of [localStore(), legacySessionStore()]) {
    if (!store) continue
    try {
      const stale: string[] = []
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i)
        if (key?.startsWith(LOCAL_RESULT_STORAGE_PREFIX) && key !== getLocalResultStorageKey(keepId)) {
          stale.push(key)
        }
      }
      for (const key of stale) store.removeItem(key)
    } catch (error) {
      console.warn('pruneLocalResults failed:', error)
    }
  }
}

/** 기기에 남은 로컬 결과를 모두 지웁니다(재측정·초기화 시). */
export function clearLocalQuestionnaireResults(): void {
  pruneLocalResults('')
}

function isLocalResultId(questionnaireId: string): boolean {
  return questionnaireId.startsWith(LOCAL_RESULT_PREFIX)
}

export { isLocalResultId }

export function readLocalQuestionnaireResult(questionnaireId: string): QuestionnaireResponse | null {
  if (typeof window === 'undefined' || !isLocalResultId(questionnaireId)) return null

  const key = getLocalResultStorageKey(questionnaireId)
  // localStorage 우선. 옛 sessionStorage 에 있던 것도 읽어 줍니다(이전 버전에서 넘어온 사용자).
  for (const store of [localStore(), legacySessionStore()]) {
    if (!store) continue
    try {
      const raw = store.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as QuestionnaireResponse
      if (parsed?.id === questionnaireId) return parsed
    } catch (error) {
      console.warn('readLocalQuestionnaireResult failed:', error)
    }
  }
  return null
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

export { fetchBodyCodeContentWithFallback }

export function createLocalQuestionnaireResult(
  answers: AnswerMap,
  scoringQuestions?: ScoringQuestion[],
  signal?: AbortSignal,
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

  const store = localStore()
  if (store) {
    try {
      store.setItem(getLocalResultStorageKey(id), JSON.stringify(response))
      pruneLocalResults(id)
    } catch (error) {
      // 용량 초과면 과거 것을 비우고 한 번 더 시도합니다.
      console.warn('createLocalQuestionnaireResult persist failed:', error)
      try {
        pruneLocalResults(id)
        store.setItem(getLocalResultStorageKey(id), JSON.stringify(response))
      } catch {
        /* 저장 불가 환경 — 이번 방문 동안은 React state 가 결과를 들고 있습니다. */
      }
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
    media_url_option_1: q.media_url_option_1 == null || q.media_url_option_1 === '' ? null : String(q.media_url_option_1),
    media_url_option_2: q.media_url_option_2 == null || q.media_url_option_2 === '' ? null : String(q.media_url_option_2),
    media_url_option_3: q.media_url_option_3 == null || q.media_url_option_3 === '' ? null : String(q.media_url_option_3),
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

  for (let attempt = 0; attempt <= QUESTION_QUERY_RETRIES; attempt++) {
    if (attempt > 0) {
      console.warn(`fetchQuestions retrying (attempt ${attempt + 1}).`)
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    data = null
    error = null
  try {
    const result = await withTimeout(
      // DO NOT drop public.questions — this is the live UI source (32 rows).
      // question_choice_scores is scoring-only and does not replace questions.
      supabase
        .from('questions')
        .select('id, question_code, question_number, sort_order, axis, question_text, option_1, option_2, option_3, weight_a, weight_b, is_precheck, is_scored, answer_type, max_select, title, part, instruction, guide_text, axis_anchor, axis_priority, question_set, media_type, media_url, media_url_option_1, media_url_option_2, media_url_option_3')
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
    // 타임아웃·네트워크 오류만 재시도합니다. 스키마 오류는 다시 해도 같습니다.
    if (!error) break
    if (!isTimeoutError(error) && !isNetworkError(error)) break
  }

  if (!error && data && data.length > 0) {
    const mappedQuestions = normalizeQuestionSet(data.map(mapQuestionRow))
    if (mappedQuestions) {
      const missingMedia = findQuestionsMissingMedia(mappedQuestions)
      if (missingMedia.length > 0) {
        // DB 는 응답했지만 사진 경로가 비었습니다 — 화면에 빈 칸으로 나가므로 남깁니다.
        reportError('questions.media_url_missing', {
          missing_count: missingMedia.length,
          total: mappedQuestions.length,
          codes: missingMedia.slice(0, 8).join(','),
        })
      }
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
        ? 'fetchQuestions Supabase query timed out.'
        : 'fetchQuestions from Supabase failed.',
      error,
    )
  }

  const persisted = readPersistedQuestions()
  if (persisted) {
    console.warn('Falling back to persisted questions cache.')
    questionsCache = persisted
    return questionsCache
  }

  // 스냅샷에는 media_url 이 없습니다 — 사진 없는 화면이 나가므로 반드시 남깁니다.
  console.warn('Falling back to bundled 32-question snapshot (no media).')
  reportError('questions.snapshot_fallback', {
    reason: isTimeoutError(error) ? 'timeout' : isNetworkError(error) ? 'network' : 'other',
  })
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

export async function saveDraft(answers: AnswerMap, questionnaireId?: string, signal?: AbortSignal) {
  const now = new Date().toISOString()
  const user = await getCurrentAuthUser()
  const payload = {
    answers,
    status: 'draft' as const,
    updated_at: now,
    user_id: user?.id ?? null,
    question_version: V1_QUESTION_SET,
  }
  return mutateQuestionnaireResponse(questionnaireId, payload as Record<string, unknown>, signal)
}

export async function submitQuestionnaire(
  answers: AnswerMap,
  questionnaireId?: string,
  scoringQuestions?: ScoringQuestion[],
  signal?: AbortSignal,
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
  const data = await mutateQuestionnaireResponse(questionnaireId, payload as Record<string, unknown>, signal)
  await syncLatestBodyCodeToProfile(user, code)

  return { ...data, calculated_code: code, body_code_meta: result }
}

export async function fetchQuestionnaireResult(questionnaireId: string) {
  const localResult = readLocalQuestionnaireResult(questionnaireId)
  if (localResult) {
    return {
      ...localResult,
      body_code_content: await fetchBodyCodeContentWithFallback(localResult.calculated_code),
    }
  }

  // RLS 강화 후에는 남의 응답을 직접 조회할 수 없습니다.
  // 비회원은 자기 응답의 UUID 를 알고 있으므로 RPC 로 한 행만 받아옵니다.
  // RPC 가 아직 없는 환경에서는 기존 select 로 폴백합니다.
  // Record<string, unknown> 으로 두면 spread 결과에서 calculated_code 같은
  // 알려진 필드가 타입에서 사라져, 호출부가 존재 여부를 확인할 수 없다.
  let responseData: QuestionnaireResponse | null = null

  try {
    const rpcResult = await withTimeout(
      supabase.rpc('get_questionnaire_response', { p_id: questionnaireId }),
      8000,
      'fetchQuestionnaireResult rpc',
    )
    if (!rpcResult.error) {
      const rows = rpcResult.data as QuestionnaireResponse[] | QuestionnaireResponse | null
      responseData = Array.isArray(rows) ? (rows[0] ?? null) : (rows ?? null)
    }
  } catch (rpcError) {
    console.debug('get_questionnaire_response rpc unavailable, falling back:', rpcError)
  }

  if (!responseData) {
    const { data: fallbackData, error: responseError } = await withTimeout(
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
    responseData = fallbackData as QuestionnaireResponse
  }

  const { data: contentData, error: contentError } = await withTimeout(
    supabase
      .from('body_code_content')
      .select('*')
      .eq('body_code', String(responseData.calculated_code ?? ''))
      .single(),
    5000,
    'fetchQuestionnaireResult content',
  )

  if (contentError) {
    console.error('Error fetching body code content:', contentError)
    return {
      ...responseData,
      body_code_content: getFallbackBodyCodeContent(String(responseData.calculated_code ?? '')),
    }
  }

  return {
    ...responseData,
    body_code_content: contentData,
  }
}
