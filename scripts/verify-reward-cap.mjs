/**
 * 적립금 월 상한 검증 (057).
 *
 * ── 무엇을 보는가
 * 적립금은 실제 돈이라 두 가지가 동시에 맞아야 합니다.
 *   1. 랜덤이 진짜인가 — 주사위 눈 1~6 이 고르게 나오는가
 *   2. 상한이 진짜인가 — 어떤 경로로 넣어도 월 49원을 못 넘는가
 *
 * 2번은 청구 함수가 아니라 **트리거**로 막습니다. 그래서 여기서는 청구 함수를 거치지 않고
 * user_rewards 에 직접 큰 금액을 밀어 넣어 봅니다. 그걸 막지 못하면 상한이 아닙니다.
 *
 * 전부 롤백되는 트랜잭션 안에서 돌기 때문에 운영 데이터에는 아무것도 남지 않습니다.
 *
 * 사용: npm run verify:reward-cap
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'
const srv = {}
for (const l of readFileSync('../mebody-server/.env','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue; const i=t.indexOf('='); if(i>0) srv[t.slice(0,i)]=t.slice(i+1) }
const u=new URL(srv.SUPABASE_DB_URL.replace(/^jdbc:/,''))
const db=new pg.Client({host:u.hostname,port:+(u.port||5432),database:u.pathname.replace(/^\//,'')||'postgres',user:srv.SUPABASE_DB_USERNAME,password:srv.SUPABASE_DB_PASSWORD,ssl:{rejectUnauthorized:false}})
await db.connect()
const res = []
const ok = (l,p,d='') => { res.push(p); console.log(`  ${p?'PASS':'FAIL'}  ${l}${d?` — ${d}`:''}`) }

await db.query('BEGIN')
try {
  console.log('\n■ 057 적용 확인')
  const applied = (await db.query(`SELECT count(*)::int n FROM pg_proc WHERE proname='reward_monthly_cap'`)).rows[0].n
  ok('reward_monthly_cap 존재', applied === 1)
  const trig = (await db.query(`SELECT count(*)::int n FROM pg_trigger
    WHERE tgrelid='public.user_rewards'::regclass AND tgname='user_rewards_monthly_cap'`)).rows[0].n
  ok('상한 트리거가 걸려 있다', trig === 1)
  const payoutCol = (await db.query(`SELECT count(*)::int n FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reward_rules' AND column_name='payout'`)).rows[0].n
  ok('payout 표 컬럼 존재', payoutCol === 1)

  console.log('\n■ 눈 → 금액 표')
  // 072 부터 **눈이 곧 금액**입니다. 예전에는 5눈부터만 적립이었습니다.
  const faceIsAmount = {1:1,2:2,3:3,4:4,5:5,6:6}
  for (const [code, expect] of [['daily_routine_dice', faceIsAmount], ['routine_bonus_dice', faceIsAmount]]) {
    const got = {}
    for (let d = 1; d <= 6; d += 1) {
      got[d] = (await db.query('SELECT public.reward_payout_for($1,$2) v',[code,d])).rows[0].v
    }
    ok(`${code}`, JSON.stringify(got) === JSON.stringify(expect), Object.entries(got).map(([k,v])=>`${k}눈→${v}원`).join(' '))
  }

  // 072 부터 눈은 **고르게 나오지 않습니다.** 낮은 눈이 훨씬 자주 나오게 가중치를 둡니다.
  // 예전 검사는 "한쪽으로 치우치지 않는다" 였는데, 이제는 치우치는 것이 정상입니다.
  // 대신 **의도한 만큼만** 치우치는지 봅니다 — 표를 잘못 건드리면 여기서 걸립니다.
  console.log('\n■ 주사위 눈의 확률 (의도한 가중치인가)')
  const want = { 1: 27.3, 2: 27.3, 3: 27.3, 4: 9, 5: 6, 6: 3 }
  const N = 20000
  const rows = (await db.query(
    `SELECT public.draw_weighted_dice(0::numeric) v FROM generate_series(1, ${N})`)).rows
  const faces = {}
  for (const r of rows) faces[r.v] = (faces[r.v] ?? 0) + 1
  ok('1~6 이 모두 나온다', Object.keys(faces).length === 6,
    Object.entries(faces).sort().map(([k,v])=>`${k}:${v}`).join(' '))
  for (const [face, pct] of Object.entries(want)) {
    const got = ((faces[face] ?? 0) / N) * 100
    // ±1.5%p 면 2만 번 표본에서 충분히 좁습니다.
    ok(`${face}눈 ${pct}%`, Math.abs(got - pct) <= 1.5, `${got.toFixed(1)}%`)
  }

  // 예산이 줄면 낮은 눈으로 몰려야 합니다. 이게 안 되면 한 달 예산을 넘깁니다.
  const tight = (await db.query(
    `SELECT public.draw_weighted_dice(1::numeric) v FROM generate_series(1, ${N})`)).rows
  const onePct = (tight.filter((r) => r.v === 1).length / N) * 100
  ok('조였을 때 1눈이 85% 이상', onePct >= 85, `${onePct.toFixed(1)}%`)

  console.log('\n■ 월 상한')
  const cap = (await db.query('SELECT public.reward_monthly_cap() v')).rows[0].v
  // 072 에서 49 → 150 으로 올렸습니다(하루 2번 × 평균 2.48원 × 30일 = 149원).
  ok('상한 150원', cap === 150, `${cap}원`)

  // 검증용 사용자 하나를 만들어 상한을 실제로 때려 봅니다.
  // user_profiles.id 는 auth.users 를 참조합니다. 새로 만들 수 없으니 기존 프로필 하나를 빌립니다.
  // 전부 롤백되므로 그 사람의 적립 내역에는 아무것도 남지 않습니다.
  const uid = (await db.query(`SELECT id FROM public.user_profiles
     WHERE id NOT IN (SELECT DISTINCT user_id FROM public.user_rewards WHERE user_id IS NOT NULL)
     LIMIT 1`)).rows[0].id
  const earn = async (amt) => (await db.query(
    `INSERT INTO public.user_rewards (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id)
     VALUES ($1,'earn_routine','daily_routine_dice',$2,'free','routine',gen_random_uuid()) RETURNING amount`,
    [uid, amt])).rows[0].amount

  // 숫자는 상한(150원)에 맞춰 둡니다. 상한을 바꾸면 여기도 같이 바꿔야 합니다.
  ok('120원 적립', await earn(120) === 120)
  ok('이번 달 누적 120원', (await db.query('SELECT public.reward_earned_this_month($1) v',[uid])).rows[0].v === 120)
  ok('남은 한도 30원', (await db.query('SELECT public.reward_remaining_this_month($1) v',[uid])).rows[0].v === 30)
  const clamped = await earn(50)
  ok('50원을 넣어도 30원만 들어간다 (트리거)', clamped === 30, `${clamped}원`)
  ok('누적이 정확히 150원', (await db.query('SELECT public.reward_earned_this_month($1) v',[uid])).rows[0].v === 150)
  const after = await earn(5)
  ok('상한 뒤에는 0원 (행은 남는다)', after === 0, `${after}원`)
  ok('그래도 150원을 넘지 않는다', (await db.query('SELECT public.reward_earned_this_month($1) v',[uid])).rows[0].v === 150)

  console.log('\n■ 남의 적립액은 못 본다')
  const gr = (await db.query(`SELECT
      has_function_privilege('authenticated','public.reward_earned_this_month(uuid)','EXECUTE') a,
      has_function_privilege('authenticated','public.my_reward_month_status()','EXECUTE') b,
      has_function_privilege('anon','public.my_reward_month_status()','EXECUTE') c`)).rows[0]
  ok('인자 있는 조회는 회원에게 닫힘', gr.a === false)
  ok('본인용 창구는 회원에게 열림', gr.b === true)
  ok('익명은 닫힘', gr.c === false)

  console.log('\n■ 구매 적립은 상한 밖')
  await db.query(`INSERT INTO public.user_rewards (user_id, entry_type, rule_code, amount, issue_type, source_type, source_id)
     VALUES ($1,'earn_purchase','purchase_cashback',5,'free','order',gen_random_uuid())`, [uid])
  const bal = (await db.query('SELECT public.reward_balance($1) v',[uid])).rows[0].v
  // 상한(150) 을 이미 채운 뒤라 무료 적립은 더 안 들어갑니다. 구매 적립은 상한 밖이라
  // 그대로 얹혀야 합니다 — 150 + 5 = 155. 상한을 바꾸면 이 숫자도 같이 바꿉니다.
  ok('구매 5원은 그대로 들어간다', bal === 155, `잔액 ${bal}원`)

  console.log('\n■ 모든 적립 경로가 눈→금액 표를 거치는가')
  // 057 이 청구 함수 세 개를 고쳤는데 AdMob SSV 경로(grant_routine_bonus_admin)를 빠뜨려서,
  // 같은 보너스가 앱에서는 1원 · SSV 에서는 6원이 되는 상태였습니다(067 에서 고침).
  // 규칙 하나를 여러 함수가 쓰므로, 경로가 갈리는지 늘 확인합니다.
  const bypass = (await db.query(`WITH payout_rules AS (
      SELECT code FROM public.reward_rules WHERE payout IS NOT NULL)
    SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname <> 'draw_reward_amount'
       AND p.prosrc NOT LIKE '%reward_payout_for%'
       AND EXISTS (SELECT 1 FROM payout_rules r WHERE p.prosrc LIKE '%' || r.code || '%')`)).rows
  ok('표를 거치지 않는 적립 경로가 없다', bypass.length === 0,
    bypass.map((x) => x.proname).join(', ') || '없음')

  console.log('\n■ 꽝(0원)도 기록된다')
  const zero = await earn(0)
  ok('0원 행이 만들어진다', zero === 0)
} catch (e) {
  console.log('  ❌ 실패:', e.message)
  process.exitCode = 1
} finally {
  await db.query('ROLLBACK')
  const rows = (await db.query(`SELECT count(*)::int n FROM public.user_rewards`)).rows[0].n
  console.log(`\n  롤백 완료 · 적립 행 ${rows}건 (검증 전과 같아야)`)
  await db.end()
}
const failed = res.filter((x) => !x).length
console.log(`${failed ? `\n❌ ${res.length - failed} / ${res.length}` : `\n✅ ${res.length} / ${res.length} 통과`}\n`)
process.exit(failed ? 1 : 0)
