/**
 * 상품 사진 일괄 등록 (임시 자리 사진)
 *
 * 사진이 없는 ACTIVE 상품에 지정한 이미지 파일을 올립니다.
 * **새 경로를 쓰지 않고** 서버의 정식 상품 수정 API(PATCH /api/admin/products/{id}, multipart)를
 * 그대로 호출합니다 — 즉 이 스크립트가 도는 것 자체가 그 기능의 실사용 검증입니다.
 *
 * 상품마다 **별도 Storage 객체**로 올립니다. 하나를 공유하면 상품 하나를 지울 때
 * ProductAdminService.delete() 가 그 객체를 지워 나머지 상품 사진이 전부 깨집니다.
 *
 * 이미 사진이 있는 상품은 건너뛰므로 여러 번 실행해도 안전합니다.
 *
 * 사용:
 *   MEBODY_TEST_JWT_SECRET=<로컬 서버에 준 값> \
 *   node scripts/seed-product-photos.mjs <이미지파일> [--force]
 *
 * 로컬 서버는 검증용 HS256 모드로 떠 있어야 합니다(운영은 JWKS 비대칭이라 토큰을 만들 수 없습니다):
 *   mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=8081 \
 *     --mebody.supabase.jwks-url= --mebody.supabase.jwt-secret=<32자 이상>"
 */
import { createHmac } from 'node:crypto'
import { basename, extname } from 'node:path'
import { readFileSync } from 'node:fs'
import pg from 'pg'

const BASE = process.env.MEBODY_SERVER_BASE ?? 'http://localhost:8081'
const SECRET = process.env.MEBODY_TEST_JWT_SECRET
const imagePath = process.argv[2]
const force = process.argv.includes('--force')

if (!SECRET) { console.error('MEBODY_TEST_JWT_SECRET 이 필요합니다.'); process.exit(2) }
if (!imagePath) { console.error('사용: node scripts/seed-product-photos.mjs <이미지파일> [--force]'); process.exit(2) }

const bytes = readFileSync(imagePath)
const ext = extname(imagePath).toLowerCase()
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' }
const contentType = MIME[ext]
if (!contentType) { console.error(`이미지 확장자를 알 수 없습니다: ${ext}`); process.exit(2) }

const env = {}
for (const l of readFileSync(new URL('../../mebody-server/.env', import.meta.url).pathname, 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0) env[t.slice(0, i)] = t.slice(i + 1)
}
const u = new URL(env.SUPABASE_DB_URL.replace(/^jdbc:/, ''))
const db = new pg.Client({ host: u.hostname, port: Number(u.port || 5432),
  database: u.pathname.replace(/^\//, '') || 'postgres',
  user: env.SUPABASE_DB_USERNAME, password: env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, statement_timeout: 60000 })

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwt(sub, email) {
  const now = Math.floor(Date.now() / 1000)
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ sub, email, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 })
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`
}

await db.connect()
let ok = 0
let failed = 0
try {
  const admin = (await db.query(
    `SELECT auth_user_id, email FROM public.user_profiles WHERE role='ADMIN' ORDER BY created_at LIMIT 1`)).rows[0]
  if (!admin) throw new Error('ADMIN 계정을 찾지 못했습니다.')
  const token = jwt(admin.auth_user_id, admin.email)

  const targets = (await db.query(`
    SELECT id, name FROM public.products
     WHERE status = 'ACTIVE' ${force ? '' : "AND (image_url IS NULL OR btrim(image_url) = '')"}
     ORDER BY created_at`)).rows

  console.log(`\n${basename(imagePath)} (${Math.ceil(bytes.length / 1024)}KB) → 대상 ${targets.length}개\n`)
  if (targets.length === 0) {
    console.log('사진이 필요한 상품이 없습니다. (--force 로 전부 덮어쓸 수 있습니다)')
  }

  for (const p of targets) {
    const fd = new FormData()
    // 상품마다 새 파일명 → 서버가 새 Storage 객체를 만든다(상품별 독립)
    fd.append('image', new Blob([bytes], { type: contentType }), `${p.name}${ext}`)
    const r = await fetch(`${BASE}/api/admin/products/${p.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
    const json = await r.json().catch(() => null)
    if (r.ok && json?.data?.imageUrl) {
      ok += 1
      console.log(`  OK    ${p.name} → ${json.data.imageUrl.split('/').pop()}`)
    } else {
      failed += 1
      console.log(`  FAIL  ${p.name} — ${r.status} ${json?.message ?? ''}`)
    }
  }

  const left = (await db.query(`SELECT count(*)::int n FROM public.products
    WHERE status='ACTIVE' AND (image_url IS NULL OR btrim(image_url)='')`)).rows[0].n
  console.log(`\n성공 ${ok} · 실패 ${failed} · 사진 없는 ACTIVE 상품 ${left}개 남음`)
  process.exitCode = failed === 0 && left === 0 ? 0 : 1
} finally {
  await db.end()
}
