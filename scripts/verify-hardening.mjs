/**
 * MEBODY — 보안 하드닝 적용 확인 (.env.local 필요)
 *
 * db/hardening/200_dev_rls_fix.sql, 210_response_read_lock.sql 적용 후 실행합니다.
 * 공개 anon 키로 실제 요청을 보내 "막혔는지"와 "앱이 안 깨졌는지"를 함께 확인합니다.
 *
 * 사용: node scripts/verify-hardening.mjs   (또는 npm run verify:hardening)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const env = {}
for (const line of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i > 0) env[t.slice(0, i)] = t.slice(i + 1)
}
const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY
if (!url || !anon) {
  console.error('FAIL: .env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 없습니다')
  process.exit(1)
}

let passed = 0
const failures = []
const check = (label, ok, detail = '') => {
  if (ok) { passed += 1; console.log(`  PASS  ${label}`) }
  else { failures.push(label); console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}

const H = { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' }
async function req(method, path, body, prefer) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: prefer ? { ...H, Prefer: prefer } : H,
    body: body ? JSON.stringify(body) : undefined,
  })
  let parsed = null
  try { parsed = await res.json() } catch { /* 204 등 */ }
  return { status: res.status, body: parsed }
}
const denied = (r) =>
  r.status === 401 || r.status === 403 ||
  String(r.body?.code) === '42501' ||
  String(r.body?.message ?? '').includes('permission denied')

console.log('MEBODY — 보안 하드닝 확인\n')

console.log('1. 쓰기가 막혔는가 (공개 anon 키)')
check('콘텐츠 삭제 차단 (body_code_content)',
  denied(await req('DELETE', 'body_code_content?body_code=eq.__none__')),
  JSON.stringify((await req('DELETE', 'body_code_content?body_code=eq.__none__')).body)?.slice(0, 90))
check('콘텐츠 변조 차단 (immediate_action_content)',
  denied(await req('PATCH', 'immediate_action_content?content_key=eq.__none__', { caution: 'x' })))
check('문항 변조 차단 (questions)',
  denied(await req('PATCH', 'questions?question_code=eq.__none__', { question_text: 'x' })))
check('상품 변조 차단 (products)',
  denied(await req('PATCH', 'products?name=eq.__none__', { price: 0 })))

console.log('\n2. 서버 전용 테이블이 가려졌는가')
for (const t of ['admin_audit_logs', 'missions', 'user_mission_progress', 'body_bti_results']) {
  const r = await req('GET', `${t}?select=*&limit=1`)
  const hidden = denied(r) || (Array.isArray(r.body) && r.body.length === 0)
  check(`${t} 비노출`, hidden, `status=${r.status} ${JSON.stringify(r.body)?.slice(0, 70)}`)
}

console.log('\n3. 회원 응답이 보호되는가')
const member = await req('GET', 'questionnaire_responses?select=id&user_id=not.is.null&limit=5')
check('회원 응답 0건 노출',
  denied(member) || (Array.isArray(member.body) && member.body.length === 0),
  `status=${member.status} ${Array.isArray(member.body) ? `${member.body.length}건` : ''}`)

console.log('\n4. 앱이 여전히 동작하는가')
const q = await req('GET', 'questions?select=id&is_active=eq.true&question_set=eq.mebody_v1_32')
check('32문항 조회', Array.isArray(q.body) && q.body.length === 32, `${q.body?.length}개`)
const ia = await req('GET', 'immediate_action_content?select=content_key')
check('즉시액션 23행 조회', Array.isArray(ia.body) && ia.body.length === 23, `${ia.body?.length}행`)
const am = await req('GET', 'immediate_action_axis_mapping?select=axis_no')
check('축 매핑 8행 조회 (15분 루틴)', Array.isArray(am.body) && am.body.length === 8, `${am.body?.length}행`)
const bc = await req('GET', 'body_code_content?select=body_code')
check('16코드 콘텐츠 조회', Array.isArray(bc.body) && bc.body.length === 16, `${bc.body?.length}행`)
const pr = await req('GET', 'products?select=id&status=eq.ACTIVE')
check('상품 조회', Array.isArray(pr.body) && pr.body.length > 0, `${pr.body?.length}행`)

console.log('\n5. 비회원 진단이 되는가 (실제 행을 만들고 지웁니다)')
// Prefer: return=representation 이 없으면 생성된 행을 돌려주지 않아 정리를 못 한다.
const created = await req('POST', 'questionnaire_responses?select=id', {
  answers: { __qa: 'verify-hardening' }, status: 'draft', question_version: 'mebody_v1_32',
}, 'return=representation')
const newId = Array.isArray(created.body) ? created.body[0]?.id : created.body?.id
check('비회원 초안 생성 (INSERT ... RETURNING)', Boolean(newId),
  `status=${created.status} ${JSON.stringify(created.body)?.slice(0, 90)}`)

if (newId) {
  const upd = await req('PATCH', `questionnaire_responses?id=eq.${newId}&select=id`, {
    status: 'completed', calculated_code: 'FRRS',
  })
  check('비회원 결과 제출 (UPDATE)', upd.status < 300, `status=${upd.status}`)

  const rpc = await fetch(`${url}/rest/v1/rpc/get_questionnaire_response`, {
    method: 'POST', headers: H, body: JSON.stringify({ p_id: newId }),
  })
  const rpcBody = await rpc.json().catch(() => null)
  check('조회 RPC 로 자기 결과 확인', rpc.ok && Array.isArray(rpcBody) && rpcBody.length === 1,
    `status=${rpc.status} ${JSON.stringify(rpcBody)?.slice(0, 80)}`)

  // 검증용 행 정리
  const del = await req('DELETE', `questionnaire_responses?id=eq.${newId}`)
  if (del.status < 300) {
    console.log('     정리: 검증용 행 삭제 완료')
  } else {
    console.log('\n  ※ 검증용 행이 남았습니다. anon 에 DELETE 권한이 없어 정상입니다.')
    console.log('     아래를 SQL Editor 에서 실행해 지워주세요:')
    console.log(`     DELETE FROM public.questionnaire_responses WHERE id = '${newId}';`)
  }
} else if (created.status < 300) {
  // 행은 만들어졌는데 id 를 못 받은 경우 — 반드시 알린다
  console.log('\n  ※ 행이 생성됐지만 id 를 받지 못했습니다. 아래로 정리하세요:')
  console.log("     DELETE FROM public.questionnaire_responses WHERE answers->>'__qa' = 'verify-hardening';")
}

console.log('\n' + '='.repeat(62))
if (failures.length === 0) {
  console.log(`OK — ${passed}개 확인 모두 통과`)
  process.exit(0)
}
console.log(`FAIL — ${failures.length}개 실패 / ${passed}개 통과`)
for (const f of failures) console.log(`  - ${f}`)
console.log('\n하드닝이 아직 적용되지 않았다면 db/hardening/README.md 를 따라 200 → 210 을 실행하세요.')
process.exit(1)
