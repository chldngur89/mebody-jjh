/** 메일 한도가 풀리는 순간을 잡아, 실제 발송 경로의 응답을 정밀하게 본다. */
import { readFileSync } from 'node:fs'
import pg from 'pg'
const BASE = 'http://localhost:8081'
const app = {}
for (const l of readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue; const i=t.indexOf('='); if(i>0) app[t.slice(0,i)]=t.slice(i+1) }
const SB=app.VITE_SUPABASE_URL, ANON=app.VITE_SUPABASE_ANON_KEY, SVC=app.SUPABASE_SERVICE_ROLE_KEY
const AH={apikey:ANON,Authorization:`Bearer ${ANON}`,'Content-Type':'application/json'}
const SH={apikey:SVC,Authorization:`Bearer ${SVC}`,'Content-Type':'application/json'}
const srv={}
for (const l of readFileSync('../mebody-server/.env','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue; const i=t.indexOf('='); if(i>0) srv[t.slice(0,i)]=t.slice(i+1) }
const u=new URL(srv.SUPABASE_DB_URL.replace(/^jdbc:/,''))
const db=new pg.Client({host:u.hostname,port:+(u.port||5432),database:u.pathname.replace(/^\//,'')||'postgres',user:srv.SUPABASE_DB_USERNAME,password:srv.SUPABASE_DB_PASSWORD,ssl:{rejectUnauthorized:false}})
await db.connect()

for (let attempt = 1; attempt <= 12; attempt += 1) {
  const stamp = Date.now()
  const email = `mailpath-${stamp}@phone.mebody.net`
  const pw = `MailPath!${stamp}`
  const r = await fetch(`${BASE}/api/public/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: pw, agreedTerms: true, agreedPrivacy: true }),
  })
  const body = await r.json().catch(() => null)
  if (r.status === 429) {
    console.log(`  시도 ${attempt} — 아직 한도 (${new Date().toTimeString().slice(0,8)})`)
    await new Promise((res) => setTimeout(res, 300_000))
    continue
  }

  console.log(`\n■ 한도 풀림 — 실제 발송 경로 응답 (시도 ${attempt})`)
  console.log(`  HTTP ${r.status}`)
  const d = body?.data ?? {}
  console.log(`  verificationRequired : ${d.verificationRequired}   (true 여야)`)
  console.log(`  verificationHint     : ${d.verificationHint}`)
  console.log(`  alreadyRegistered    : ${d.alreadyRegistered}`)
  const id = d.authUserId
  if (id) {
    const row = (await db.query(
      `SELECT u.email_confirmed_at, u.confirmation_sent_at, p.terms_agreed_at, p.privacy_agreed_at
         FROM auth.users u LEFT JOIN public.user_profiles p ON p.auth_user_id = u.id WHERE u.id = $1`, [id])).rows[0]
    console.log(`  email_confirmed_at   : ${row?.email_confirmed_at}   (null 이어야)`)
    console.log(`  confirmation_sent_at : ${row?.confirmation_sent_at}  (값이 있어야 발송 시도)`)
    console.log(`  terms_agreed_at      : ${row?.terms_agreed_at}       (값이 있어야 — 확인 대기여도 동의는 남는다)`)
    console.log(`  privacy_agreed_at    : ${row?.privacy_agreed_at}`)
    const login = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: AH, body: JSON.stringify({ email, password: pw }) })
    const lb = await login.json().catch(() => null)
    console.log(`  확인 전 로그인       : ${login.status} ${lb?.error_code ?? ''}  (400 email_not_confirmed 여야)`)
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: SH })
    console.log('  정리 완료')
  } else {
    console.log(`  ⚠ 계정이 만들어지지 않았습니다: ${JSON.stringify(body).slice(0, 300)}`)
  }
  await db.end()
  process.exit(0)
}
console.log('\n  한 시간 동안 한도가 풀리지 않았습니다.')
await db.end()
process.exit(1)
