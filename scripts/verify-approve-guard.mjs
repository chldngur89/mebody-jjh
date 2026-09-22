/**
 * 공개 승인 엔드포인트(/api/public/auth/approve) 가 확인 절차를 우회시키지 않는지 봅니다.
 *
 * ── 무엇을 막는가
 * 이 엔드포인트는 로그인 전에 불려야 해서 누구나 부를 수 있습니다(permitAll). 하는 일은
 * "승인 대기로 남은 계정을 풀어주기" 인데, 확인 절차를 켜 둔 상태에서도 풀어준다면
 * 확인 절차를 켠 의미가 없습니다. 메일이나 문자를 받지 않고도 계정이 열립니다.
 *
 * 예전 코드는 `!id.isPhone() && emailVerificationRequired()` 로 검사해서
 * **휴대폰 식별자는 검사를 통째로 건너뛰었습니다.** 즉 휴대폰 인증을 켜 두어도
 * 번호를 이 엔드포인트에 보내면 그냥 승인됐습니다.
 *
 * ── 어떻게 도는가
 * 서버의 /api/public/auth/config 로 지금 스위치 상태를 읽고, 그 상태에서 옳은 동작을 검사합니다.
 *   · 확인 절차 ON  → 그 종류의 식별자는 409 로 거절해야 한다
 *   · 확인 절차 OFF → 200 이되 계정 존재를 응답으로 알려주지 않아야 한다
 * 그래서 스위치를 켜고 서버를 띄운 뒤 다시 돌리면 켠 쪽 경로까지 확인됩니다.
 *
 * 사용: npm run verify:approve-guard
 *   확인 절차를 켠 서버로 검사하려면:
 *     MEBODY_AUTH_REQUIRE_EMAIL_VERIFICATION=true \
 *     MEBODY_AUTH_REQUIRE_PHONE_VERIFICATION=true  (서버 쪽 환경변수)
 */
const BASE = process.env.MEBODY_SERVER_BASE ?? 'http://localhost:8081'

const res = []
const ok = (l, p, d = '') => { res.push({ l, p }); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }

const approve = async (identifier) => {
  const r = await fetch(`${BASE}/api/public/auth/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  })
  const body = await r.json().catch(() => null)
  return { status: r.status, data: body?.data ?? null, message: body?.message ?? body?.error ?? '' }
}

const stamp = Date.now()
const EMAIL_ID = `guard-${stamp}@phone.mebody.net`
const PHONE_ID = `010-${String(stamp).slice(-8, -4)}-${String(stamp).slice(-4)}`

const cfg = await fetch(`${BASE}/api/public/auth/config`)
  .then((r) => r.json()).then((b) => b?.data ?? b)
  .catch(() => null)

if (!cfg) {
  console.error(`\n서버에 붙지 못했습니다: ${BASE}\n  mebody-server 를 띄운 뒤 다시 돌려주세요.\n`)
  process.exit(1)
}

const emailOn = cfg.emailVerificationRequired === true
const phoneOn = cfg.phoneVerificationRequired === true

console.log(`\n■ 지금 서버 설정 — 이메일 확인 ${emailOn ? 'ON' : 'OFF'} · 휴대폰 인증 ${phoneOn ? 'ON' : 'OFF'} · 휴대폰 방식 ${cfg.phoneMode}`)

console.log('\n■ 이메일 식별자')
{
  const r = await approve(EMAIL_ID)
  if (emailOn) {
    ok('확인 절차가 켜져 있으면 승인을 거절한다', r.status === 409, `status=${r.status} ${r.message}`)
  } else {
    ok('확인 절차가 꺼져 있으면 승인한다', r.status === 200 && r.data?.approved === true, `status=${r.status}`)
    ok('계정 존재를 알려주지 않는다', r.status === 200 && !('found' in (r.data ?? {})), JSON.stringify(r.data))
  }
}

console.log('\n■ 휴대폰 식별자 — 예전에 검사를 건너뛰던 경로')
{
  const r = await approve(PHONE_ID)
  if (phoneOn) {
    ok('휴대폰 인증이 켜져 있으면 승인을 거절한다', r.status === 409, `status=${r.status} ${r.message}`)
  } else {
    ok('휴대폰 인증이 꺼져 있으면 승인한다', r.status === 200 && r.data?.approved === true, `status=${r.status}`)
    ok('계정 존재를 알려주지 않는다', r.status === 200 && !('found' in (r.data ?? {})), JSON.stringify(r.data))
  }
}

console.log('\n■ 있는 식별자와 없는 식별자의 응답이 구분되지 않는다')
{
  const a = await approve(`nobody-a-${stamp}@phone.mebody.net`)
  const b = await approve(`nobody-b-${stamp}@phone.mebody.net`)
  const shape = (x) => `${x.status}|${Object.keys(x.data ?? {}).sort().join(',')}|${x.data?.approved}`
  ok('모양과 상태가 같다', shape(a) === shape(b), `${shape(a)} vs ${shape(b)}`)
}

if (!emailOn && !phoneOn) {
  console.log('\n  ※ 지금 서버는 확인 절차가 꺼져 있어 "거절" 경로는 검사하지 못했습니다.')
  console.log('    켠 쪽까지 보려면 아래처럼 서버를 띄우고 다시 돌리세요.')
  console.log('      MEBODY_AUTH_REQUIRE_EMAIL_VERIFICATION=true \\')
  console.log('      MEBODY_AUTH_REQUIRE_PHONE_VERIFICATION=true  mvn spring-boot:run')
}

const failed = res.filter((r) => !r.p).length
console.log(`\n${failed ? `✗ ${failed}건 실패` : `✓ ${res.length}건 전부 통과`} (${res.length}건)\n`)
process.exit(failed ? 1 : 0)
