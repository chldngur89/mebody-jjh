/**
 * 038_seller_and_products.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 * 사용: npm run verify:seller
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const EMAIL = process.env.MEBODY_E2E_EMAIL ?? 'wh.choi@mebody.net'
let SELLER = null  // 038 적용 후 조회
const env = {}
for (const l of readFileSync(process.env.MEBODY_SERVER_ENV ?? new URL('../../mebody-server/.env', import.meta.url).pathname, 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i > 0) env[t.slice(0, i)] = t.slice(i + 1)
}
const u = new URL(env.SUPABASE_DB_URL.replace(/^jdbc:/, ''))
const c = new pg.Client({ host: u.hostname, port: Number(u.port || 5432),
  database: u.pathname.replace(/^\//, '') || 'postgres',
  user: env.SUPABASE_DB_USERNAME, password: env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, statement_timeout: 120000 })

const res = []
const ok = (l, p, d = '') => { res.push({ l, p }); console.log(`  ${p ? 'PASS' : 'FAIL'}  ${l}${d ? ` — ${d}` : ''}`) }
const svc = () => c.query('RESET ROLE')
const anon = async () => { await svc(); await c.query('SET LOCAL ROLE anon') }
const auth = async (id) => { await svc(); await c.query('SET LOCAL ROLE authenticated')
  await c.query(`SELECT set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]) }
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }

// 039 의 products_image_required 제약 때문에 ACTIVE 상품은 사진이 있어야 합니다.
// (이 스크립트는 원래 사진 없이 넣고 있었고, 039 적용 후 정확히 그 이유로 23514 로 막혔습니다)
const IMG = 'https://example.supabase.co/storage/v1/object/public/images/products/verify.png'
const insertProduct = (name, sellerId) => c.query(`INSERT INTO public.products
  (seller_id, name, description, price, category, status, image_url)
  VALUES ($1::uuid, $2, 'test', 1000, 'release', 'ACTIVE', $3) RETURNING id`, [sellerId, name, IMG])

/** 사진 없이 넣으려는 시도 — 039 가 막아야 합니다 */
const insertProductNoImage = (name, sellerId) => c.query(`INSERT INTO public.products
  (seller_id, name, description, price, category, status)
  VALUES ($1::uuid, $2, 'test', 1000, 'release', 'ACTIVE') RETURNING id`, [sellerId, name])

await c.connect(); await c.query('BEGIN')
try {
  console.log('\n■ 마이그레이션 적용')
  await c.query(readFileSync(new URL('../db/journey/038_seller_and_products.sql', import.meta.url).pathname, 'utf8'))
  ok('038 적용', true)

  await svc()
  SELLER = (await c.query(`SELECT id FROM public.user_profiles WHERE role='SELLER' LIMIT 1`)).rows[0]?.id
  const uid = (await c.query('SELECT id FROM auth.users WHERE email=$1', [EMAIL])).rows[0].id
  const adminId = (await c.query(`SELECT id FROM public.user_profiles WHERE role='ADMIN' LIMIT 1`)).rows[0].id

  console.log('\n■ 판매자 · 상품 시드')
  const seller = (await c.query(`SELECT email, role, status FROM public.user_profiles WHERE id=$1`, [SELLER])).rows[0]
  ok('판매자 계정 지정', seller?.role === 'SELLER', `${seller?.email} / ${seller?.role}`)
  const cats = (await c.query(`SELECT category, count(*)::int n FROM public.products WHERE status='ACTIVE' GROUP BY category ORDER BY category`)).rows
  ok('카테고리 5종', cats.length === 5, cats.map(r => `${r.category}:${r.n}`).join(' '))
  const total = (await c.query(`SELECT count(*)::int n FROM public.products WHERE status='ACTIVE'`)).rows[0].n
  ok('상품 15개 (기존 3 + 신규 12)', total === 15, `${total}개`)
  const orphan = (await c.query(`SELECT count(*)::int n FROM public.products WHERE seller_id IS NULL`)).rows[0].n
  ok('모든 상품이 판매자 소유', orphan === 0, `미귀속 ${orphan}개`)

  console.log('\n■ 재실행 안전성')
  await c.query(readFileSync(new URL('../db/journey/038_seller_and_products.sql', import.meta.url).pathname, 'utf8'))
  const total2 = (await c.query(`SELECT count(*)::int n FROM public.products WHERE status='ACTIVE'`)).rows[0].n
  ok('두 번 돌려도 안 늘어남', total2 === total, `${total} → ${total2}`)

  console.log('\n■ 역할 판정')
  await auth(uid)
  const rMember = (await c.query('SELECT public.current_user_role() r')).rows[0].r
  ok('일반 회원 = MEMBER', rMember === 'MEMBER', rMember)
  const sidMember = (await c.query('SELECT public.current_seller_id() s')).rows[0].s
  ok('일반 회원은 판매자 id 없음', sidMember === null, String(sidMember))
  await auth(adminId)
  const rAdmin = (await c.query('SELECT public.current_user_role() r')).rows[0].r
  ok('관리자 = ADMIN', rAdmin === 'ADMIN', rAdmin)

  console.log('\n■ 상품 쓰기 권한')
  await auth(uid)
  const memberIns = await T(() => insertProduct('회원이 만든 상품', SELLER))
  ok('일반 회원은 상품 등록 불가', !memberIns.ok, memberIns.ok ? '등록됨' : memberIns.code)
  const memberUpd = await T(() => c.query(`UPDATE public.products SET price=1 WHERE name='듀얼 마사지볼' RETURNING id`))
  ok('일반 회원은 수정 불가', !memberUpd.ok || memberUpd.r.rowCount === 0,
     memberUpd.ok ? `${memberUpd.r.rowCount}행 변경` : memberUpd.code)

  await auth(adminId)
  const adminIns = await T(() => insertProduct('관리자가 만든 상품', SELLER))
  ok('관리자는 상품 등록 가능', adminIns.ok, adminIns.ok ? '' : adminIns.code)
  const adminUpd = await T(() => c.query(`UPDATE public.products SET price=99000 WHERE name='듀얼 마사지볼' RETURNING price`))
  ok('관리자는 수정 가능', adminUpd.ok && adminUpd.r.rowCount === 1, adminUpd.ok ? `${adminUpd.r.rows[0]?.price}` : adminUpd.code)

  console.log('\n■ 판매자 본인으로 로그인했을 때')
  // 판매자 프로필의 id 가 곧 auth.users.id 이므로 그 id 로 인증하면 된다.
  await auth(SELLER)
  const rSeller = (await c.query('SELECT public.current_user_role() r')).rows[0].r
  ok('SELLER 로 판정', rSeller === 'SELLER', rSeller)
  const noPhoto = await T(() => insertProductNoImage('사진 없는 상품', SELLER))
  ok('사진 없이는 판매자도 등록 불가 (039 제약)', !noPhoto.ok && noPhoto.code === '23514',
    noPhoto.ok ? '들어가 버림' : noPhoto.code)

  const sellerIns = await T(() => insertProduct('판매자가 만든 상품', SELLER))
  ok('판매자는 자기 상품 등록 가능', sellerIns.ok, sellerIns.ok ? '' : sellerIns.code)
  const otherIns = await T(() => insertProduct('남의 이름으로', adminId))
  ok('판매자가 남의 seller_id 로는 등록 불가', !otherIns.ok, otherIns.ok ? '등록됨' : otherIns.code)

  console.log('\n■ 비회원')
  await anon()
  const a1 = await T(() => insertProduct('비회원 상품', SELLER))
  ok('비회원 등록 차단', !a1.ok, a1.ok ? '등록됨' : a1.code)
  const a2 = await T(() => c.query(`DELETE FROM public.products WHERE name='듀얼 마사지볼'`))
  ok('비회원 삭제 차단', !a2.ok || a2.r.rowCount === 0, a2.ok ? `${a2.r.rowCount}행` : a2.code)
  const a3 = (await c.query(`SELECT count(*)::int n FROM public.products`)).rows[0].n
  ok('비회원도 ACTIVE 상품은 읽힘', a3 > 0, `${a3}개`)

  console.log('\n■ 앱이 읽는 형태')
  await anon()
  const appRows = (await c.query(`SELECT id,name,description,price,image_url,status,category FROM public.products
    WHERE status='ACTIVE' ORDER BY created_at`)).rows
  ok('앱 select 컬럼 전부 존재', appRows.length > 0 && 'category' in appRows[0])
  ok('모든 상품에 카테고리', !appRows.some(r => !r.category))
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter(r => !r.p)
console.log('\n' + '='.repeat(62))
console.log(fail.length ? `FAIL — ${fail.length}개 실패 / ${res.length - fail.length}개 통과`
                        : `OK — ${res.length}개 검증 모두 통과`)
for (const f of fail) console.log('  - ' + f.l)
process.exit(fail.length ? 1 : 0)
