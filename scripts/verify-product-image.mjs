/**
 * 039_product_image_required.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 * "상품 등록 시 사진 필수" 규칙이 DB 층에서 실제로 막는지 확인합니다.
 * 사용: npm run verify:product-image
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

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
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }

const IMG = 'https://example.supabase.co/storage/v1/object/public/images/products/x.jpg'
const ins = (status, imageUrl) => c.query(
  `INSERT INTO public.products (seller_id, name, description, price, category, status, image_url)
   VALUES ((SELECT id FROM public.user_profiles WHERE role='SELLER' LIMIT 1),
           $1, 'verify', 1000, 'release', $2, $3) RETURNING id`,
  [`__verify_${Math.random().toString(36).slice(2)}`, status, imageUrl])

await c.connect(); await c.query('BEGIN')
try {
  console.log('\n■ 적용 전 상태')
  const before = await c.query(`SELECT count(*)::int n FROM pg_constraint
    WHERE conrelid='public.products'::regclass AND conname='products_image_required'`)
  console.log(`  (제약 존재: ${before.rows[0].n === 1 ? '이미 적용됨' : '아직 없음'})`)
  const legacy = await c.query(`SELECT count(*)::int n FROM public.products
    WHERE status='ACTIVE' AND (image_url IS NULL OR btrim(image_url)='')`)
  console.log(`  (사진 없는 ACTIVE 상품: ${legacy.rows[0].n}개)`)

  // 적용 전에는 사진 없이도 들어가는지 — 제약이 실제로 "새로 막는" 것임을 보이기 위해
  if (before.rows[0].n === 0) {
    const pre = await T(() => ins('ACTIVE', null))
    ok('적용 전에는 사진 없는 ACTIVE 상품이 들어간다(= 제약이 필요한 상태)', pre.ok, pre.ok ? '' : pre.code)
  } else {
    ok('적용 전에는 사진 없는 ACTIVE 상품이 들어간다(= 제약이 필요한 상태)', true, '이미 제약이 적용돼 있어 생략')
  }

  console.log('\n■ 마이그레이션 적용')
  await c.query(readFileSync(new URL('../db/journey/039_product_image_required.sql', import.meta.url).pathname, 'utf8'))
  ok('039 적용', true)

  console.log('\n■ 제약 정의')
  const def = await c.query(`SELECT convalidated, pg_get_constraintdef(oid) d FROM pg_constraint
    WHERE conrelid='public.products'::regclass AND conname='products_image_required'`)
  ok('products_image_required 제약 존재', def.rowCount === 1)
  ok('CHECK 정의에 image_url 조건 포함', /image_url/.test(def.rows[0]?.d ?? ''), def.rows[0]?.d)
  ok('NOT VALID 로 걸려 기존 15행을 깨뜨리지 않는다', def.rows[0]?.convalidated === false)

  console.log('\n■ INSERT 규칙')
  const a = await T(() => ins('ACTIVE', null))
  ok('사진 없는 ACTIVE 등록 → 거절', !a.ok && a.code === '23514', a.ok ? '들어가 버림' : a.code)

  const b = await T(() => ins('ACTIVE', '   '))
  ok('공백만 넣은 image_url → 거절', !b.ok && b.code === '23514', b.ok ? '들어가 버림' : b.code)

  const d = await T(() => ins('ACTIVE', IMG))
  ok('사진 있는 ACTIVE 등록 → 통과', d.ok, d.ok ? '' : d.code)

  const e = await T(() => ins('DRAFT', null))
  ok('DRAFT(미공개)는 사진 없이도 저장 가능', e.ok, e.ok ? '' : e.code)

  console.log('\n■ UPDATE 규칙')
  const draft = await c.query(`INSERT INTO public.products (seller_id, name, price, category, status)
    VALUES ((SELECT id FROM public.user_profiles WHERE role='SELLER' LIMIT 1), '__verify_draft', 1000, 'release', 'DRAFT')
    RETURNING id`)
  const draftId = draft.rows[0].id

  const f = await T(() => c.query(`UPDATE public.products SET status='ACTIVE' WHERE id=$1`, [draftId]))
  ok('사진 없는 상품을 ACTIVE 로 전환 → 거절', !f.ok && f.code === '23514', f.ok ? '통과해 버림' : f.code)

  const g = await T(() => c.query(`UPDATE public.products SET status='ACTIVE', image_url=$2 WHERE id=$1`, [draftId, IMG]))
  ok('사진과 함께 ACTIVE 로 전환 → 통과', g.ok, g.ok ? '' : g.code)

  const legacyRow = await c.query(`SELECT id FROM public.products
    WHERE status='ACTIVE' AND (image_url IS NULL OR btrim(image_url)='') LIMIT 1`)
  if (legacyRow.rowCount === 1) {
    const h = await T(() => c.query(`UPDATE public.products SET name=name||'' WHERE id=$1`, [legacyRow.rows[0].id]))
    ok('사진 없는 기존 상품을 그대로 수정 → 거절(사진을 채워야 한다)', !h.ok && h.code === '23514', h.ok ? '통과해 버림' : h.code)

    const i = await T(() => c.query(`UPDATE public.products SET image_url=$2 WHERE id=$1`, [legacyRow.rows[0].id, IMG]))
    ok('사진 없는 기존 상품에 사진을 채우는 수정 → 통과', i.ok, i.ok ? '' : i.code)
  } else {
    ok('사진 없는 기존 상품을 그대로 수정 → 거절(사진을 채워야 한다)', true, '해당 행 없음(전부 사진 있음)')
    ok('사진 없는 기존 상품에 사진을 채우는 수정 → 통과', true, '해당 행 없음(전부 사진 있음)')
  }

  console.log('\n■ 기존 데이터 보존')
  const stay = await c.query(`SELECT count(*)::int n FROM public.products WHERE name NOT LIKE '__verify%'`)
  ok('제약 적용 후에도 기존 상품 15개가 그대로 남아 있다', stay.rows[0].n === 15, `${stay.rows[0].n}개`)

  const activeVisible = await c.query(`SELECT count(*)::int n FROM public.products
    WHERE status='ACTIVE' AND name NOT LIKE '__verify%'`)
  ok('마켓에 노출되는 ACTIVE 상품 수가 줄지 않았다', activeVisible.rows[0].n === 15, `${activeVisible.rows[0].n}개`)

  console.log('\n■ 카테고리 값 — 서버 API 가 허용하는 5종과 일치')
  const cats = await c.query(`SELECT DISTINCT category FROM public.products
    WHERE name NOT LIKE '__verify%' ORDER BY category`)
  const allowed = ['food', 'release', 'strength', 'stretch', 'support']
  ok('기존 상품 카테고리가 전부 허용 목록 안', cats.rows.every((r) => allowed.includes(r.category)),
    cats.rows.map((r) => r.category).join(', '))
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
