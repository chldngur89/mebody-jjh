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
import { randomUUID } from 'node:crypto'

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
/** PostgREST 는 없는 함수에 404 를 돌려줍니다. 그걸로 044 적용 여부를 가릅니다. */
const rpc = (name, args) => req('POST', `rpc/${name}`, args)
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
// id 는 앱과 마찬가지로 클라이언트가 만든다.
// RETURNING 을 쓰면 SELECT 정책이 필요해서 044 적용 뒤에 막힌다.
const newId = randomUUID()

// 저장 RPC 가 있으면 그쪽을, 없으면 예전 테이블 경로를 쓴다(앱과 같은 분기).
const viaRpc = await rpc('save_questionnaire_response', {
  p_id: newId, p_answers: { __qa: 'verify-hardening' },
  p_status: 'draft', p_question_version: 'mebody_v1_32',
})
const created = viaRpc.status === 404
  ? await req('POST', 'questionnaire_responses', {
      id: newId, answers: { __qa: 'verify-hardening' }, status: 'draft', question_version: 'mebody_v1_32',
    })
  : viaRpc
check('비회원 초안 생성', created.status < 300,
  `${viaRpc.status === 404 ? '테이블' : 'RPC'} status=${created.status}`)

if (created.status < 300) {
  const upd = viaRpc.status === 404
    ? await req('PATCH', `questionnaire_responses?id=eq.${newId}`, { status: 'completed', calculated_code: 'FRRS' })
    : await rpc('save_questionnaire_response', {
        p_id: newId, p_answers: { __qa: 'verify-hardening' }, p_status: 'completed', p_calculated_code: 'FRRS',
      })
  check('비회원 결과 제출 (UPDATE)', upd.status < 300, `status=${upd.status}`)

  const readBack = await rpc('get_questionnaire_response', { p_id: newId })
  check('조회 RPC 로 자기 결과 확인',
    readBack.status < 300 && Array.isArray(readBack.body) && readBack.body.length === 1,
    `status=${readBack.status} ${JSON.stringify(readBack.body)?.slice(0, 80)}`)

  // 검증용 행 정리.
  // anon 에 DELETE 권한이 없는 게 정상이므로(하드닝) 정리는 서비스 롤 키로 한다.
  // 검증 자체는 위까지 전부 anon 키로 끝났고, 여기서는 뒷정리만 한다.
  const service = env.SUPABASE_SERVICE_ROLE_KEY
  let cleaned = false
  if (service) {
    const res = await fetch(`${url}/rest/v1/questionnaire_responses?id=eq.${newId}`, {
      method: 'DELETE',
      headers: { apikey: service, Authorization: `Bearer ${service}` },
    })
    cleaned = res.status < 300
  }
  if (cleaned) {
    console.log('     정리: 검증용 행 삭제 완료')
  } else {
    console.log('\n  ※ 검증용 행이 남았습니다.')
    console.log(service
      ? '     서비스 롤로도 지우지 못했습니다. 아래를 SQL Editor 에서 실행하세요:'
      : '     .env.local 에 SUPABASE_SERVICE_ROLE_KEY 가 없어 자동 정리를 못 했습니다. 아래를 실행하세요:')
    console.log(`     DELETE FROM public.questionnaire_responses WHERE id = '${newId}';`)
  }
} else {
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
