/**
 * Local verify: .env.local → anon READ 32 questions.
 * Optional: service role WRITE then READ to prove DB edits are visible.
 * Usage: node scripts/verify-db-questions.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i < 0) continue
    env[trimmed.slice(0, i)] = trimmed.slice(i + 1)
  }
  return env
}

const env = loadEnvLocal()
const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY
const service = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anon) {
  console.error('FAIL: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in .env.local')
  process.exit(1)
}

const reader = createClient(url, anon)
const writer = service ? createClient(url, service) : null

const MARKER = `[CEO-EDIT-TEST ${Date.now()}] 최근 규칙적으로 운동하고 있나요?`
const ORIGINAL = '최근 규칙적으로 운동하고 있나요?'

async function fetchList(client) {
  const { data, error } = await client
    .from('questions')
    .select('question_code, question_text, sort_order')
    .eq('question_set', 'mebody_v1_32')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

const list = await fetchList(reader)
console.log('anon_read_count', list.length)
console.log('anon_first', list[0]?.question_code, list[0]?.question_text)
if (list.length !== 32) {
  console.error('FAIL: expected 32 active mebody_v1_32 questions via anon')
  process.exit(1)
}
console.log('PASS: anon can read 32 questions from DB')

if (!writer) {
  console.log('SKIP write-reflect test (no SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(0)
}

const { data: updated, error: updErr } = await writer
  .from('questions')
  .update({ question_text: MARKER, updated_at: new Date().toISOString() })
  .eq('question_set', 'mebody_v1_32')
  .eq('question_code', 'A1')
  .select('question_code, question_text')

if (updErr) {
  console.error('FAIL service update:', updErr.message)
  process.exit(1)
}
if (!updated?.length) {
  console.error('FAIL: service update matched 0 rows')
  process.exit(1)
}

const after = await fetchList(reader)
const a1 = after.find((q) => q.question_code === 'A1')
console.log('anon_read_after_service_edit', a1?.question_text)
const ok = a1?.question_text === MARKER
console.log(ok ? 'PASS: anon fetch sees DB edit immediately' : 'FAIL: anon fetch stale after DB edit')

await writer
  .from('questions')
  .update({ question_text: ORIGINAL, updated_at: new Date().toISOString() })
  .eq('question_set', 'mebody_v1_32')
  .eq('question_code', 'A1')

console.log('restored_A1')
process.exit(ok ? 0 : 1)
