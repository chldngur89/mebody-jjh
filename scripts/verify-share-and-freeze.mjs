/**
 * 공유 URL 과 결과 확정본 검증.
 *
 * 두 가지를 봅니다:
 *   1) 공유 링크에 개인 데이터가 실리지 않는가 (코드만)
 *   2) result id 가 새더라도 **결과가 고쳐지지 않는가** (045)
 *
 * DB 검증은 트랜잭션 안에서 045 를 적용하고 ROLLBACK 합니다.
 * 사용: npm run verify:share-freeze
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import pg from 'pg'
import { randomUUID } from 'node:crypto'

const EMAIL = process.env.MEBODY_E2E_EMAIL ?? 'wh.choi@mebody.net'

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
const anon = async () => { await svc(); await c.query('SET LOCAL ROLE anon')
  await c.query(`SELECT set_config('request.jwt.claims', NULL, true)`) }
const auth = async (id) => { await svc(); await c.query('SET LOCAL ROLE authenticated')
  await c.query(`SELECT set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]) }
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }

const save = (p) => c.query(
  `SELECT public.save_questionnaire_response(
     p_id => $1, p_answers => $2::jsonb, p_status => $3, p_calculated_code => $4,
     p_completed_at => $5::timestamptz, p_question_version => $6,
     p_primary_identity => $7, p_scoring_meta => $8::jsonb) AS id`,
  [p.id, JSON.stringify(p.answers ?? {}), p.status ?? 'draft', p.calculated_code ?? null,
   p.completed_at ?? null, p.question_version ?? null, p.primary_identity ?? null,
   p.scoring_meta ? JSON.stringify(p.scoring_meta) : null])

const read = async (id) => (await c.query('SELECT * FROM public.get_questionnaire_response($1)', [id])).rows[0]

// ── 1. 공유 링크에 무엇이 실리나 (실제 앱 코드를 그대로 읽습니다) ─────────────
console.log('\n■ 공유 링크에 실리는 값')
const shareSrc = readFileSync(new URL('../src/lib/share.ts', import.meta.url).pathname, 'utf8')
const params = [...shareSrc.matchAll(/searchParams\.set\('([^']+)'/g)].map((m) => m[1])
ok('공유 URL 파라미터는 ref·code 뿐', params.length === 2 && params.includes('ref') && params.includes('code'), params.join(', '))
ok('공유 코드에 result id 를 넣지 않는다', !/result|questionnaireId|\.id\b/.test(shareSrc.split('buildShareUrl')[1]?.slice(0, 400) ?? ''))
ok('몸BTI 코드 형식만 허용', /\^\[FC\]\[RL\]\[RL\]\[SF\]\$/.test(shareSrc))

// ── 1-2. 공유 미리보기가 **실제로 뜨는가** ────────────────────────────────────
// 카드 16장을 만들어 두고도 미리보기에 아무것도 안 뜬 적이 있습니다(2026-10-13).
// og:image 가 상대경로였기 때문입니다 — 크롤러는 우리 페이지를 자기 서버에서 긁어가므로
// 「어느 호스트의 /share-cards 인가」를 알 방법이 없습니다. 카카오톡이 주 공유 경로라
// 이게 안 되면 바이럴 설계가 통째로 죽습니다.
console.log('\n■ 코드별 공유 미리보기')
const codesDir = new URL('../public/s/', import.meta.url).pathname
const cardsDir = new URL('../public/share-cards/', import.meta.url).pathname
const pages = readdirSync(codesDir).filter((f) => f.endsWith('.html'))
ok('코드 16장이 구워져 있다', pages.length === 16, `${pages.length}장`)

const BODY_CODE = /^[FC][RL][RL][SF]$/
let relativeOg = []
let missingCard = []
let noOgUrl = []
let badCanonical = []
for (const f of pages) {
  const code = f.replace(/\.html$/, '')
  if (!BODY_CODE.test(code)) continue
  const html = readFileSync(`${codesDir}${f}`, 'utf8')
  const pick = (re) => (html.match(re) ?? [])[1] ?? ''
  const img = pick(/<meta property="og:image" content="([^"]+)"/)
  const tw = pick(/<meta name="twitter:image" content="([^"]+)"/)
  const ogUrl = pick(/<meta property="og:url" content="([^"]+)"/)
  const canon = pick(/<link rel="canonical" href="([^"]+)"/)
  if (!/^https?:\/\//.test(img) || !/^https?:\/\//.test(tw)) relativeOg.push(code)
  if (!/^https?:\/\//.test(ogUrl)) noOgUrl.push(code)
  // canonical 은 이 페이지 자신이어야 합니다. ref=share 가 붙은 주소를 적으면
  // 추적 파라미터가 원본으로 색인됩니다.
  if (!canon.endsWith(`/s/${code}`)) badCanonical.push(code)
  if (!existsSync(`${cardsDir}${code}.png`)) missingCard.push(code)
  if (!html.includes(code)) ok(`${code} 페이지에 코드가 들어 있다`, false)
}
ok('og:image·twitter:image 가 절대주소', relativeOg.length === 0, relativeOg.slice(0, 3).join(','))
ok('og:url 이 절대주소로 있다', noOgUrl.length === 0, noOgUrl.slice(0, 3).join(','))
ok('canonical 이 공유 페이지 자신을 가리킨다', badCanonical.length === 0, badCanonical.slice(0, 3).join(','))
ok('코드마다 카드 이미지가 있다', missingCard.length === 0, missingCard.slice(0, 3).join(','))

// 사람이 열면 앱으로 가야 합니다. 크롤러만 og 를 읽고 갑니다.
const sample = readFileSync(`${codesDir}FRRS.html`, 'utf8')
ok('사람은 앱으로 넘어간다', /http-equiv="refresh"/.test(sample) && /location\.replace/.test(sample))
ok('유입 구분 파라미터가 붙는다', /ref=share&code=FRRS/.test(sample))

// ── 1-2-2. 이미지로 공유해도 **돌아올 길**이 있는가 ──────────────────────────
// 가장 많이 눌리는 버튼이 「카드 이미지 저장·공유」입니다. 그런데 files·title·text 만
// 보내고 있어서, 받은 사람이 **그림 한 장**만 받았습니다. 마음에 들어도 들어올 방법이
// 없으면 바이럴은 거기서 끊깁니다(실측 2026-10-14).
console.log('\n■ 이미지 공유에 링크가 붙는가')
const cardSrc = readFileSync(new URL('../src/lib/shareCardImage.ts', import.meta.url).pathname, 'utf8')
const imageShare = cardSrc.split('shareShareCardImage')[1] ?? ''
ok('공유 본문에 링크를 넣는다', /buildShareUrl\(/.test(imageShare))
ok('navigator.share 에 url 을 넘긴다', /url:\s*link/.test(imageShare))
// 앨범에 저장하거나 캡처해서 전달하면 링크가 따라가지 않습니다. 그림 자체에 주소가 있어야 합니다.
ok('카드 그림에 주소를 그린다', /fillText\(\s*shareBaseUrl\(\)/.test(cardSrc),
   '저장·캡처 전달에는 링크가 따라가지 않습니다')

// ── 1-2-3. 공유 안내가 **사실과 맞는가** ─────────────────────────────────────
// 「개인 점수·응답은 포함되지 않아요」 한 줄이 두 버튼 위에 걸려 있었습니다. 링크 기준으로는
// 맞지만 바로 아래 버튼이 보내는 카드 이미지에는 **내 4축 막대 위치가 그려집니다.**
// 화면은 시스템이 보장할 수 있는 것만 말해야 합니다.
console.log('\n■ 공유 안내 문구')
const shareUiRaw = readFileSync(new URL('../src/components/home/ResultShareCard.tsx', import.meta.url).pathname, 'utf8')
// 주석은 뺍니다 — 왜 바꿨는지 적어 둔 설명이 옛 문구를 인용하고 있어서,
// 그대로 보면 자기 자신의 주석에 걸립니다.
const shareUi = shareUiRaw
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
const cardDraws = /const axes = payload\.axes/.test(cardSrc)
ok('카드 이미지가 4축을 그린다(전제 확인)', cardDraws)
ok('「개인 점수·응답은 포함되지 않아요」로 뭉뚱그리지 않는다',
   !/개인 점수·응답은 포함되지 않아요/.test(shareUi),
   '이미지 공유에는 4축이 들어갑니다')
ok('링크와 카드 이미지를 나눠 설명한다',
   /링크<\/span>로 보내면/.test(shareUi) && /카드 이미지<\/span>에는/.test(shareUi))
ok('문항별 답변은 안 나간다고만 말한다', /문항별 답변은 보내지 않아요/.test(shareUi))

// ── 1-2-3-b. 공유 문구의 **제품명** ──────────────────────────────────────────
// theme/copy.ts 는 "MEBODY / 몸Bti / 체형코드 혼용 금지" 라고 적어 두었는데,
// 정작 밖으로 나가는 문장(body_code_content.share_title/description) 16개가
// **전부 구표기**였습니다. 링크 복사는 URL 만 보내서 눈에 안 띄었고,
// 카카오·OS 공유 시트를 쓴 사람에게만 "내 몸BTI는 …" 이 나갔습니다(075).
//
// SQL 원문을 봅니다. DB 쪽은 아래 「공유 문구 제품명(DB)」에서 실제 값으로 다시 확인합니다.
console.log('\n■ 공유 문구 제품명(SQL 원문)')
// 잡아야 하는 것은 **저장되는 문구**입니다 — `share_title = '…몸BTI…'` 같은 대입.
// 075 의 replace() 인자와 WHERE … LIKE '%몸BTI%' 는 구표기를 **찾아 없애는 쪽**이라
// 그대로 남아 있어야 정상입니다. 그래서 대입 형태만 봅니다.
const LEGACY_ASSIGN = /share_(?:title|description)\s*=\s*'[^']*(?:몸BTI|몸Bti|MEBODY 코드)/
for (const rel of ['../db/journey/046_body_code_content_identity_care.sql',
                   '../db/journey/075_share_copy_brand.sql',
                   '../db/bootstrap/130_seed_content.sql',
                   '../db/bootstrap/000_full_bootstrap.sql']) {
  const path = new URL(rel, import.meta.url).pathname
  const name = path.split('/').pop()
  // 주석은 뺍니다 — 왜 바꿨는지 적어 둔 설명이 옛 문구를 인용합니다.
  const body = readFileSync(path, 'utf8').replace(/^\s*--.*$/gm, ' ')
  const bad = body.split('\n').filter((l) => LEGACY_ASSIGN.test(l))
  ok(`${name} 에 구표기가 남지 않았다`, bad.length === 0, bad.length ? `${bad.length}줄` : '')
}
// 폴백과 같은 모양인지. share.ts 가 DB 값이 없을 때 쓰는 문장과 어긋나면
// 사람에 따라 다른 말이 나갑니다.
ok('share.ts 폴백이 PRODUCT.codeName 을 쓴다',
   /내 \$\{PRODUCT\.codeName\}는/.test(shareSrc),
   'DB 값이 없을 때도 같은 제품명이어야 합니다')

// ── 1-2-4. 캐릭터 그림 16장이 살아 있는가 ────────────────────────────────────
// 그림은 저장소가 아니라 Supabase Storage 에 있습니다. 코드로는 안 보이므로 여기서 확인합니다.
// 한 장이라도 없으면 그 코드가 나온 사람의 결과 화면과 공유 카드에 그림이 빠집니다.
console.log('\n■ 캐릭터 그림')
const calcSrc = readFileSync(new URL('../src/utils/bodyCodeCalculator.ts', import.meta.url).pathname, 'utf8')
const nameBlock = calcSrc.match(/export const characterNames[^{]*\{([\s\S]*?)\n\}/)?.[1] ?? ''
const allCodes = [...nameBlock.matchAll(/([A-Z]{4}):\s*'([^']+)'/g)].map((m) => m[1])
ok('코드 16개를 읽었다', allCodes.length === 16, `${allCodes.length}개`)

// 앱 쪽 .env.local 에서 Supabase 주소를 읽습니다(서버 .env 에는 없습니다).
const appEnv = {}
try {
  for (const l of readFileSync(new URL('../.env.local', import.meta.url).pathname, 'utf8').split('\n')) {
    const t = l.trim(); if (!t || t.startsWith('#')) continue
    const i = t.indexOf('='); if (i > 0) appEnv[t.slice(0, i)] = t.slice(i + 1)
  }
} catch { /* 없으면 아래에서 건너뜁니다 */ }
const storageBase = appEnv.VITE_SUPABASE_URL
  ? `${appEnv.VITE_SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/images`
  : null
if (!storageBase) {
  console.log('  주의  VITE_SUPABASE_URL 이 없어 그림 확인을 건너뜁니다')
} else {
  const missing = []
  for (const code of allCodes) {
    try {
      const r = await fetch(`${storageBase}/characters/${code}.png`, { method: 'HEAD', signal: AbortSignal.timeout(20000) })
      const type = r.headers.get('content-type') ?? ''
      if (r.status !== 200 || !/^image\//.test(type)) missing.push(`${code}(${r.status} ${type || '타입없음'})`)
    } catch (e) {
      missing.push(`${code}(${String(e).slice(0, 24)})`)
    }
  }
  ok('코드마다 캐릭터 그림이 있다', missing.length === 0, missing.slice(0, 3).join(', '))
}

// ── 1-3. 링크가 잘리거나 오타가 나면 ─────────────────────────────────────────
// 공유를 받은 사람이 벌거벗은 404 를 보면 거기서 잃습니다.
console.log('\n■ 잘못된 공유 링크')
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url).pathname, 'utf8'))
const rules = vercel.rewrites ?? []
const exact = rules.find((r) => /\[FC\]\[RL\]\[RL\]\[SF\]/.test(r.source ?? ''))
const fallback = rules.find((r) => /^\/s\//.test(r.source ?? '') && (r.destination ?? '').includes('index.html'))
ok('16가지 코드에만 정적 페이지를 준다', Boolean(exact), exact?.source ?? '규칙 없음')
ok('그 밖의 /s/* 는 앱 첫 화면으로 보낸다', Boolean(fallback), fallback?.source ?? '규칙 없음 — 404 가 그대로 노출됩니다')
ok('되돌림 규칙이 정확한 쪽보다 뒤에 있다',
   Boolean(exact && fallback) && rules.indexOf(exact) < rules.indexOf(fallback),
   '순서가 바뀌면 정상 코드도 전부 앱으로 떨어집니다')

// 앱은 형식에 안 맞는 코드를 **무시**해야 합니다(없는 친구 결과를 지어내지 않게).
const appSrc = readFileSync(new URL('../src/App.tsx', import.meta.url).pathname, 'utf8')
ok('앱도 코드 형식을 검사한다', /isShareableBodyCode\(bootSearchParams\.get\('code'\)\)/.test(appSrc))

const analyticsSrc = readFileSync(new URL('../src/lib/analytics.ts', import.meta.url).pathname, 'utf8')
const props = [...analyticsSrc.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1])
/**
 * 이벤트에 실어도 되는 값의 목록. **여기에 없는 이름이 생기면 실패합니다.**
 *
 * 054 의 전제는 "analytics_events 로는 사람을 되짚을 수 없다" 입니다. 그래서 값을 더할 때마다
 * 이 목록을 손으로 늘리게 해 두었습니다 — 자동으로 통과시키면 언젠가 이메일이나 id 가 섞입니다.
 *
 * 지금 허용하는 것과 그 근거:
 *   body_code      공유 링크에 이미 들어가는 공개 값. 16가지뿐이라 사람을 좁히지 못한다
 *   share_channel  kakao·native·copy·image 중 하나
 *   ref            유입 표시(share 등)
 *   reason         실패 사유 분류. 원문 오류가 아니라 짧은 라벨
 *   day_no         14일 루틴의 며칠차. 1~14 뿐이고 어느 사용자인지와 무관하다
 *   plan_code      멤버십 플랜 코드. 상품 식별자이지 사람 식별자가 아니다
 *   feeling        BETTER·SAME·UNCOMFORTABLE 중 하나. 건강 관련이지만 세 값뿐이고
 *                  누구의 것인지 이어 붙일 방법이 없다(이 표에는 user_id 가 없다)
 */
// 이벤트에 실어도 되는 값. **사람을 가리키거나 몸 상태를 드러내는 값은 넣지 않습니다.**
//
// 바디 노트(074)에서 더한 네 개는 전부 **개수나 0/1** 입니다 —
// 어느 부위가 불편했는지는 몸 상태라 개인정보이고, 분석에 필요한 것은
// "쓰다 마는가 / 몇 개나 고르는가" 이지 "어디가 아픈가" 가 아닙니다.
//   editing       수정인가 새로 쓰는가 (1/0)
//   partCount     부위를 몇 개 골랐나
//   activityCount 활동을 몇 개 골랐나
//   connected     전문가가 붙어 있나 (1/0) — 누구인지는 담지 않습니다
const ALLOWED_PROPS = ['body_code', 'share_channel', 'ref', 'reason', 'day_no', 'plan_code', 'feeling',
                       'editing', 'partCount', 'activityCount', 'connected']
const extraProps = props.filter((p) => !ALLOWED_PROPS.includes(p))
ok('이벤트 payload 에 개인 식별 값이 없다', extraProps.length === 0,
  extraProps.length ? `허용 목록에 없는 값: ${extraProps.join(', ')}` : props.join(', '))

// 이름만 보고 위험한 것은 따로 막습니다. 목록을 늘리다 실수로 넣는 경우가 있습니다.
const risky = props.filter((p) => /email|phone|name|user|auth|token|address|birth|id$/i.test(p))
ok('사람을 가리키는 이름이 없다', risky.length === 0, risky.join(', ') || '없음')

await c.connect(); await c.query('BEGIN')
try {
  await svc()
  const uid = (await c.query('SELECT id FROM auth.users WHERE email=$1', [EMAIL])).rows[0].id
  const total = Number((await c.query('SELECT count(*)::int n FROM public.questionnaire_responses')).rows[0].n)

  // ── 공유 문구 제품명 — **실제 DB 값**을 봅니다 ─────────────────────────────
  // SQL 원문만 보면 "파일은 고쳤는데 운영에는 안 올렸다" 를 못 잡습니다.
  // 밖으로 나가는 문장이므로 DB 가 기준입니다(075).
  console.log('\n■ 공유 문구 제품명(DB)')
  const brand = (await c.query(`
    SELECT count(*) FILTER (WHERE share_title       LIKE '%몸BTI%'
                              OR share_title       LIKE '%MEBODY 코드%'
                              OR share_description LIKE '%몸BTI%'
                              OR share_description LIKE '%MEBODY 코드%')::int AS legacy,
           count(*) FILTER (WHERE share_title LIKE '내 mebody Code는 %')::int   AS titled,
           count(*)::int AS rows
    FROM public.body_code_content`)).rows[0]
  ok('코드 16행이 있다', brand.rows === 16, `${brand.rows}행`)
  ok('구표기(몸BTI·MEBODY 코드)가 DB 에 없다', brand.legacy === 0,
     brand.legacy ? `${brand.legacy}행 남음 — db/journey/075_share_copy_brand.sql 적용 필요` : '')
  ok('16행 전부 「내 mebody Code는 …」 로 시작한다', brand.titled === 16, `${brand.titled}/16`)

  // 075 를 다시 실행해도 안전한가. 트랜잭션 안이라 끝나면 되돌아갑니다.
  const brandSql = readFileSync(new URL('../db/journey/075_share_copy_brand.sql', import.meta.url).pathname, 'utf8')
    .replace(/^\s*(BEGIN|COMMIT)\s*;\s*$/gm, '')   // 바깥 트랜잭션을 끊지 않습니다
  const brandTwice = await T(() => c.query(brandSql))
  ok('075 를 다시 실행해도 통과', brandTwice.ok, brandTwice.ok ? '' : brandTwice.msg)

  console.log('\n■ 적용 전 — 문제 재현')
  // 045 가 이미 적용된 DB 에서는 재현할 수 없습니다.
  const frozen = (await c.query(`SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
     WHERE ns.nspname='public' AND p.proname='save_questionnaire_response'
       AND p.prosrc LIKE '%이미 제출된 결과는 수정할 수 없습니다%'`)).rows[0].n > 0

  let extraRows = 0
  if (frozen) {
    ok('id 만 알면 남의 결과가 덮어써진다(= 고쳐야 하는 상태)', true, '045 적용 완료 상태라 재현 생략')
  } else {
    await anon()
    const victim = randomUUID()
    await save({ id: victim, answers: { A1: '1' }, status: 'draft', question_version: 'mebody_v1_32' })
    await save({ id: victim, answers: { A1: '1', D7: '3' }, status: 'completed', calculated_code: 'FRRS',
      completed_at: new Date().toISOString() })
    const hijack = await T(() => save({ id: victim, answers: { HACKED: true }, status: 'completed', calculated_code: 'CLLF' }))
    const afterHijack = await read(victim)
    ok('id 만 알면 남의 결과가 덮어써진다(= 고쳐야 하는 상태)',
      hijack.ok && afterHijack.calculated_code === 'CLLF', `FRRS → ${afterHijack.calculated_code}`)
    extraRows = 1
  }

  console.log('\n■ 045 적용')
  await svc()
  await c.query(readFileSync(new URL('../db/journey/045_freeze_completed_result.sql', import.meta.url).pathname, 'utf8'))
  ok('045 적용', true)

  console.log('\n■ 제출이 끝난 결과는 고쳐지지 않는다')
  await anon()
  const target = randomUUID()
  await save({ id: target, answers: { A1: '1' }, status: 'draft', question_version: 'mebody_v1_32' })
  await save({ id: target, answers: { A1: '1', D7: '3' }, status: 'completed', calculated_code: 'FRRS',
    completed_at: new Date().toISOString(), primary_identity: '원본' })

  const attack = await T(() => save({ id: target, answers: { HACKED: true }, status: 'completed', calculated_code: 'CLLF' }))
  ok('다른 코드로 덮어쓰기 → 거부', !attack.ok && attack.code === '42501', attack.ok ? '덮어써짐' : attack.code)

  const after = await read(target)
  ok('코드가 그대로다', after.calculated_code === 'FRRS', after.calculated_code)
  ok('답변이 그대로다', JSON.stringify(after.answers) === JSON.stringify({ A1: '1', D7: '3' }), JSON.stringify(after.answers))
  ok('아이덴티티가 그대로다', after.primary_identity === '원본', String(after.primary_identity))

  const sameAgain = await T(() => save({ id: target, answers: { A1: '1', D7: '3' }, status: 'completed', calculated_code: 'FRRS' }))
  ok('같은 결과 재전송(앱 재시도) → 통과', sameAgain.ok, sameAgain.ok ? '' : sameAgain.code)

  const lateDraft = await T(() => save({ id: target, answers: { A1: '2' }, status: 'draft' }))
  const afterLate = await read(target)
  ok('제출 뒤 늦게 온 임시저장이 결과를 되돌리지 않는다',
    lateDraft.ok && afterLate.status === 'completed' && afterLate.calculated_code === 'FRRS',
    `${afterLate.status} / ${afterLate.calculated_code}`)

  console.log('\n■ 진단 흐름은 그대로 동작한다')
  const fresh = randomUUID()
  const d1 = await T(() => save({ id: fresh, answers: { A1: '1' }, status: 'draft', question_version: 'mebody_v1_32' }))
  ok('비회원 임시저장(신규)', d1.ok, d1.ok ? '' : d1.code)
  const d2 = await T(() => save({ id: fresh, answers: { A1: '1', A2: '2' }, status: 'draft' }))
  ok('비회원 임시저장(갱신)', d2.ok, d2.ok ? '' : d2.code)
  const d3 = await T(() => save({ id: fresh, answers: { A1: '1', A2: '2' }, status: 'completed',
    calculated_code: 'CLLF', completed_at: new Date().toISOString() }))
  ok('비회원 제출', d3.ok, d3.ok ? '' : d3.code)
  const freshRow = await read(fresh)
  ok('제출 결과가 읽힌다', freshRow?.calculated_code === 'CLLF', String(freshRow?.calculated_code))

  console.log('\n■ 재측정은 막히지 않는다 (새 id 로 새 행)')
  const again = randomUUID()
  const r1 = await T(() => save({ id: again, answers: { A1: '3' }, status: 'completed',
    calculated_code: 'CRLS', completed_at: new Date().toISOString() }))
  ok('새 진단은 새 행으로 저장된다', r1.ok, r1.ok ? '' : r1.code)

  console.log('\n■ 로그인 뒤 귀속은 그대로')
  await auth(uid)
  const claimed = await c.query('SELECT public.claim_questionnaire_response($1) AS done', [target])
  ok('확정된 비회원 결과도 내 것으로 붙일 수 있다', claimed.rows[0].done === true)
  const mine = (await c.query(
    'SELECT count(*)::int n FROM public.questionnaire_responses WHERE id=$1 AND user_id=$2', [target, uid])).rows[0].n
  ok('귀속 뒤 내 결과로 보인다', mine === 1)

  console.log('\n■ 익명은 여전히 훑을 수 없다')
  await anon()
  const scan = await T(() => c.query('SELECT count(*) FROM public.questionnaire_responses'))
  ok('목록 조회 → 권한 거부', !scan.ok && scan.code === '42501', scan.ok ? '읽힘' : scan.code)

  console.log('\n■ 데이터는 그대로')
  await svc()
  const end = Number((await c.query('SELECT count(*)::int n FROM public.questionnaire_responses')).rows[0].n)
  ok('검증용 행 외에 늘거나 줄지 않았다', end === total + 3 + extraRows, `${total} → ${end}`)

  console.log('\n■ 두 번 실행해도 안전')
  const twice = await T(() => c.query(readFileSync(new URL('../db/journey/045_freeze_completed_result.sql', import.meta.url).pathname, 'utf8')))
  ok('같은 파일을 다시 실행해도 통과', twice.ok, twice.ok ? '' : twice.msg)
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log(`\n${fail.length === 0 ? '✅' : '❌'} ${res.length - fail.length} / ${res.length} 통과`)
process.exit(fail.length === 0 ? 0 : 1)
