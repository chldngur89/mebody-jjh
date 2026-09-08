/**
 * 서버 상품 등록 API 검증 — "등록할 때 사진이 무조건 올라간다"를 실제 요청으로 확인합니다.
 *
 * 로컬에서 띄운 서버(기본 http://localhost:8081)에 대고 돌립니다. 그 서버는 검증용으로
 * HS256 시크릿을 쓰도록 켜져 있어야 합니다(운영은 JWKS 비대칭 검증이라 토큰을 만들 수 없습니다):
 *
 *   mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=8081 \
 *     --mebody.supabase.jwks-url= --mebody.supabase.jwt-secret=<32자 이상>"
 *
 * 마지막에 만든 상품과 사진을 전부 지웁니다 — 끝나면 DB는 시작 상태 그대로입니다.
 * 사용: MEBODY_TEST_JWT_SECRET=<위와 같은 값> npm run verify:product-api
 */
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import pg from 'pg'

const BASE = process.env.MEBODY_SERVER_BASE ?? 'http://localhost:8081'
const SECRET = process.env.MEBODY_TEST_JWT_SECRET
if (!SECRET) { console.error('MEBODY_TEST_JWT_SECRET 이 필요합니다.'); process.exit(2) }

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

const res = []
const ok = (l, p, d = '') => { res.push({ l, p }); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwt(sub, email) {
  const now = Math.floor(Date.now() / 1000)
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ sub, email, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 })
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

async function call(path, { token, method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body,
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 비 JSON 응답 */ }
  return { status: r.status, json, text }
}

/** 유효한 1x1 PNG. 실제 이미지 바이트라 Storage 도 그대로 받습니다. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64')

/**
 * Storage 에 파일이 남아 있는지 **버킷 목록으로** 확인합니다.
 * 공개 URL 을 fetch 해서 판단하면 안 됩니다 — 한 번 읽은 URL 은 CDN 에 캐시돼서
 * 원본을 지운 뒤에도 한동안 200 이 나옵니다(실제로 그렇게 오판했습니다).
 */
async function storageHas(path) {
  const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/list/images`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix: 'products', limit: 1000, offset: 0 }),
  })
  const list = await r.json()
  const name = decodeURIComponent(String(path).split('/').pop())
  return Array.isArray(list) && list.some((o) => o.name === name)
}

function form(fields, file) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) fd.append(k, String(v))
  if (file) fd.append('image', new Blob([file.bytes], { type: file.type }), file.name)
  return fd
}

const NAME = `__verify_product_${Date.now()}`
let createdId = null
let firstImageUrl = null

await db.connect()
try {
  const admin = (await db.query(`SELECT id, auth_user_id, email FROM public.user_profiles WHERE role='ADMIN' ORDER BY created_at LIMIT 1`)).rows[0]
  const seller = (await db.query(`SELECT id, auth_user_id, email FROM public.user_profiles WHERE role='SELLER' LIMIT 1`)).rows[0]
  const member = (await db.query(`SELECT id, auth_user_id, email FROM public.user_profiles WHERE role='MEMBER' LIMIT 1`)).rows[0]
  const adminToken = jwt(admin.auth_user_id, admin.email)
  const sellerToken = jwt(seller.auth_user_id, seller.email)
  const memberToken = member ? jwt(member.auth_user_id, member.email) : null
  const before = (await db.query('SELECT count(*)::int n FROM public.products')).rows[0].n
  console.log(`\n(관리자 ${admin.email} · 판매자 ${seller.email} · 상품 ${before}개로 시작)`)

  console.log('\n■ 접근 권한')
  ok('토큰 없이 상품 목록 → 401', (await call('/api/admin/products')).status === 401)
  const asMember = memberToken ? await call('/api/admin/products', { token: memberToken }) : null
  ok('일반 회원 토큰 → 403', asMember ? asMember.status === 403 : true, asMember ? '' : 'MEMBER 계정 없음, 생략')
  const adminList = await call('/api/admin/products', { token: adminToken })
  ok('관리자 토큰 → 200', adminList.status === 200, `${adminList.json?.data?.length ?? 0}개`)
  ok('목록에 category 가 실려 온다', adminList.json?.data?.every((p) => 'category' in p) === true)
  const sellerList = await call('/api/seller/products', { token: sellerToken })
  ok('판매자는 /api/seller/products 로 자기 상품만', sellerList.status === 200,
    `${sellerList.json?.data?.length ?? 0}개 / 전체 ${adminList.json?.data?.length ?? 0}개`)

  console.log('\n■ 사진 없이 등록하려는 모든 경로가 막히는가')
  const noImage = await call('/api/admin/products', { token: adminToken, method: 'POST',
    body: form({ name: NAME, price: 1000, category: 'release', status: 'ACTIVE', sellerId: seller.id }) })
  ok('multipart 인데 image 파트가 없음 → 400', noImage.status === 400, noImage.json?.message)
  ok('안내 문구가 "사진"을 말한다', /사진/.test(noImage.json?.message ?? ''), noImage.json?.message)

  const asJson = await call('/api/admin/products', { token: adminToken, method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: NAME, price: 1000, category: 'release', sellerId: seller.id }) })
  ok('JSON 으로 등록 시도 → 415 (사진 없이 부를 방법 자체가 없다)', asJson.status === 415, `status ${asJson.status}`)

  const emptyFile = await call('/api/admin/products', { token: adminToken, method: 'POST',
    body: form({ name: NAME, price: 1000, category: 'release', sellerId: seller.id },
      { bytes: Buffer.alloc(0), type: 'image/png', name: 'empty.png' }) })
  ok('빈 파일 → 400', emptyFile.status === 400, emptyFile.json?.message)

  const notImage = await call('/api/admin/products', { token: adminToken, method: 'POST',
    body: form({ name: NAME, price: 1000, category: 'release', sellerId: seller.id },
      { bytes: Buffer.from('not an image'), type: 'text/plain', name: 'a.txt' }) })
  ok('이미지가 아닌 파일 → 400', notImage.status === 400, notImage.json?.message)

  const tooBig = await call('/api/admin/products', { token: adminToken, method: 'POST',
    body: form({ name: NAME, price: 1000, category: 'release', sellerId: seller.id },
      { bytes: Buffer.alloc(9 * 1024 * 1024, 1), type: 'image/png', name: 'big.png' }) })
  ok('8MB 초과 → 413', tooBig.status === 413, `status ${tooBig.status} ${tooBig.json?.message ?? ''}`)

  console.log('\n■ 나머지 필수값')
  const badCat = await call('/api/admin/products', { token: adminToken, method: 'POST',
    body: form({ name: NAME, price: 1000, category: 'nope', sellerId: seller.id },
      { bytes: PNG, type: 'image/png', name: 'a.png' }) })
  ok('허용 목록에 없는 카테고리 → 400', badCat.status === 400, badCat.json?.message)

  const noSeller = await call('/api/admin/products', { token: adminToken, method: 'POST',
    body: form({ name: NAME, price: 1000, category: 'release' },
      { bytes: PNG, type: 'image/png', name: 'a.png' }) })
  ok('판매자 미지정 → 400', noSeller.status === 400, noSeller.json?.message)

  const dbAfterRejects = (await db.query('SELECT count(*)::int n FROM public.products')).rows[0].n
  ok('여기까지 거절된 요청들이 DB에 아무 행도 남기지 않았다', dbAfterRejects === before, `${dbAfterRejects}개`)

  console.log('\n■ 사진과 함께 등록 (성공 경로)')
  const created = await call('/api/admin/products', { token: adminToken, method: 'POST',
    body: form({ name: NAME, description: '검증용 임시 상품', price: 12345, category: 'release', status: 'ACTIVE', sellerId: seller.id },
      { bytes: PNG, type: 'image/png', name: 'sample.png' }) })
  ok('등록 → 200', created.status === 200, created.json?.message ?? created.text.slice(0, 200))
  createdId = created.json?.data?.id
  firstImageUrl = created.json?.data?.imageUrl
  ok('응답에 사진 공개 URL 이 들어 있다', typeof firstImageUrl === 'string' && firstImageUrl.includes('/storage/v1/object/public/images/products/'), firstImageUrl)
  ok('판매자가 지정한 계정으로 귀속됐다', created.json?.data?.sellerId === seller.id)

  const row = (await db.query('SELECT name, image_url, category, status, seller_id FROM public.products WHERE id=$1', [createdId])).rows[0]
  ok('DB 행에 image_url 이 저장됐다', Boolean(row?.image_url), row?.image_url)
  ok('DB 행의 카테고리·상태가 요청과 같다', row?.category === 'release' && row?.status === 'ACTIVE')

  const img = await fetch(firstImageUrl)
  ok('공개 URL 로 실제 사진이 내려온다', img.status === 200 && (img.headers.get('content-type') || '').startsWith('image/'),
    `${img.status} ${img.headers.get('content-type')}`)

  const publicList = await call('/api/products')
  ok('공개 상품 API(/api/products)에 바로 나온다 = 앱 마켓에 반영', 
    (publicList.json?.data ?? []).some((p) => p.id === createdId))
  ok('공개 API 응답에도 imageUrl 이 실린다',
    Boolean((publicList.json?.data ?? []).find((p) => p.id === createdId)?.imageUrl))

  console.log('\n■ 수정 — 사진 교체')
  const patched = await call(`/api/admin/products/${createdId}`, { token: adminToken, method: 'PATCH',
    body: form({ price: 22222 }, { bytes: PNG, type: 'image/webp', name: 'sample2.webp' }) })
  ok('사진을 새로 올리면 교체된다', patched.status === 200 && patched.json?.data?.imageUrl !== firstImageUrl,
    patched.json?.data?.imageUrl)
  ok('교체된 옛 사진은 Storage 에서 정리된다', (await storageHas(firstImageUrl)) === false)
  ok('새 사진은 Storage 에 남아 있다', (await storageHas(patched.json?.data?.imageUrl)) === true)

  const patchedNoImage = await call(`/api/admin/products/${createdId}`, { token: adminToken, method: 'PATCH',
    body: form({ price: 33333 }) })
  ok('이미 사진이 있는 상품은 사진 없이도 수정된다', patchedNoImage.status === 200 && patchedNoImage.json?.data?.price === 33333,
    patchedNoImage.json?.message)

  console.log('\n■ 판매자 범위')
  const sellerSees = await call('/api/seller/products', { token: sellerToken })
  ok('판매자 목록에 자기 상품으로 보인다', (sellerSees.json?.data ?? []).some((p) => p.id === createdId))
  const sellerNoImage = await call('/api/seller/products', { token: sellerToken, method: 'POST',
    body: form({ name: `${NAME}_seller`, price: 1000, category: 'stretch' }) })
  ok('판매자도 사진 없이는 등록 못 한다 → 400', sellerNoImage.status === 400, sellerNoImage.json?.message)

  console.log('\n■ 정리 (검증 상품 삭제)')
  const secondImageUrl = patched.json?.data?.imageUrl
  const del = await call(`/api/admin/products/${createdId}`, { token: adminToken, method: 'DELETE' })
  ok('삭제 → 200', del.status === 200, del.json?.message)
  const gone = (await db.query('SELECT count(*)::int n FROM public.products WHERE id=$1', [createdId])).rows[0].n
  ok('DB 행이 사라졌다', gone === 0)
  createdId = null
  ok('사진도 Storage 에서 사라졌다', (await storageHas(secondImageUrl)) === false)

  const after = (await db.query('SELECT count(*)::int n FROM public.products')).rows[0].n
  ok('검증 전후 상품 수가 같다(부수효과 없음)', after === before, `${before} → ${after}`)
} finally {
  if (createdId) console.error(`\n⚠️  정리 실패: 상품 ${createdId} 이 남아 있습니다.`)
  await db.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
