/**
 * 034_entitlement.sql 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 *
 * PostgREST 가 하는 역할 전환(authenticated + request.jwt.claims)을 그대로 재현하므로
 * RLS 와 SECURITY DEFINER 함수가 앱에서와 동일하게 동작합니다.
 * 데이터는 남지 않습니다.
 *
 * 사용: npm run verify:entitlement
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

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
const anon = async () => { await svc(); await c.query('SET LOCAL ROLE anon') }
const auth = async (id) => { await svc(); await c.query('SET LOCAL ROLE authenticated')
  await c.query(`SELECT set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]) }
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }

/** 저니 1건 INSERT — 앱의 startJourney 와 같은 형태 */
const insertJourney = (uid, rid) => c.query(`INSERT INTO public.user_journeys
  (user_id, questionnaire_response_id, template_code, body_code, axis_priority, status, current_day, started_at, last_active_at)
  VALUES ($1,$2,'starter_14d','FRRS','[]'::jsonb,'active',1,now(),now()) RETURNING id`, [uid, rid])

await c.connect(); await c.query('BEGIN')
try {
  console.log('\n■ 마이그레이션 적용')
  await c.query(readFileSync(new URL('../db/journey/034_entitlement.sql', import.meta.url).pathname, 'utf8'))
  ok('034 적용', true)

  const uid = (await c.query('SELECT id FROM auth.users WHERE email=$1', [EMAIL])).rows[0].id
  const other = (await c.query('SELECT id FROM auth.users WHERE id <> $1 LIMIT 1', [uid])).rows[0]?.id ?? null

  // 기존 저니를 비워 "첫 저니" 상태에서 시작한다 (트랜잭션이라 롤백됨)
  await svc()
  await c.query('DELETE FROM public.user_missions')
  await c.query('DELETE FROM public.user_journeys')
  await c.query('DELETE FROM public.user_subscriptions WHERE user_id=$1', [uid])
  const rid = (await c.query(`SELECT id FROM public.questionnaire_responses
    WHERE user_id=$1 AND status='completed' LIMIT 1`, [uid])).rows[0]?.id ?? null

  console.log('\n■ 무구독 — 첫 저니는 무료')
  await auth(uid)
  const e0 = (await c.query('SELECT * FROM public.journey_entitlement()')).rows[0]
  ok('등급 free', e0.tier === 'free', e0.tier)
  ok('is_paid=false', e0.is_paid === false)
  ok('저니 이력 0건', e0.journey_count === 0, `${e0.journey_count}건`)
  ok('can_start=true (첫 저니)', e0.can_start === true)

  const first = await T(() => insertJourney(uid, rid))
  ok('첫 저니 INSERT 성공', first.ok, first.ok ? '' : first.code)
  ok('RLS 안에서 재귀하지 않음 (INSERT 가 실제로 통과)', first.ok, first.ok ? '' : first.code)

  console.log('\n■ 무구독 — 두 번째 저니는 막힌다')
  // 활성 저니는 1개만 허용되므로(user_journeys_one_active_uidx) 첫 저니를 완료 처리한다.
  await svc()
  await c.query(`UPDATE public.user_journeys SET status='completed' WHERE user_id=$1`, [uid])
  await auth(uid)
  const e1 = (await c.query('SELECT * FROM public.journey_entitlement()')).rows[0]
  ok('저니 이력 1건', e1.journey_count === 1, `${e1.journey_count}건`)
  ok('can_start=false (체험 소진)', e1.can_start === false)
  const second = await T(() => insertJourney(uid, rid))
  ok('두 번째 저니 INSERT 거부', !second.ok, second.ok ? '들어감' : second.code)
  ok('거부 코드가 42501 (RLS)', second.code === '42501', String(second.code))

  console.log('\n■ 구독하면 다시 열린다')
  await svc()
  await c.query(`INSERT INTO public.user_subscriptions (user_id, plan_code, status, current_period_end)
    VALUES ($1,'basic_monthly','active', now() + interval '30 days')`, [uid])
  await auth(uid)
  const e2 = (await c.query('SELECT * FROM public.journey_entitlement()')).rows[0]
  ok('등급 basic', e2.tier === 'basic', e2.tier)
  ok('is_paid=true', e2.is_paid === true)
  ok('can_start=true', e2.can_start === true)
  const third = await T(() => insertJourney(uid, rid))
  ok('구독 후 저니 INSERT 성공', third.ok, third.ok ? '' : third.code)

  console.log('\n■ 적립 배수와 판정이 어긋나지 않는다')
  await svc()
  const mult = (await c.query('SELECT public.reward_multiplier_for($1) m', [uid])).rows[0].m
  const hasSub = (await c.query('SELECT public.has_active_subscription($1) b', [uid])).rows[0].b
  ok('구독 중이면 배수 > 1 이고 has_active=true', Number(mult) > 1 && hasSub === true, `배수 ${mult}, has_active ${hasSub}`)

  await c.query(`UPDATE public.user_subscriptions SET status='canceled' WHERE user_id=$1`, [uid])
  const mult2 = (await c.query('SELECT public.reward_multiplier_for($1) m', [uid])).rows[0].m
  const hasSub2 = (await c.query('SELECT public.has_active_subscription($1) b', [uid])).rows[0].b
  ok('해지하면 배수 1.0 이고 has_active=false', Number(mult2) === 1 && hasSub2 === false, `배수 ${mult2}, has_active ${hasSub2}`)

  console.log('\n■ 만료된 구독은 무료 취급')
  await svc()
  await c.query(`UPDATE public.user_subscriptions
    SET status='active', current_period_end = now() - interval '1 day' WHERE user_id=$1`, [uid])
  await auth(uid)
  const e3 = (await c.query('SELECT * FROM public.journey_entitlement()')).rows[0]
  ok('기간 지난 구독은 free', e3.tier === 'free' && e3.is_paid === false, `${e3.tier}/${e3.is_paid}`)
  const expired = await T(() => insertJourney(uid, rid))
  ok('기간 지나면 저니 INSERT 거부', !expired.ok, expired.ok ? '들어감' : expired.code)

  console.log('\n■ 남의 자격은 볼 수 없다')
  await auth(uid)
  if (other) {
    const peek = (await c.query('SELECT public.can_start_journey($1) b', [other])).rows[0].b
    ok('타인 uid 로 물으면 false', peek === false, String(peek))
  } else {
    ok('타인 uid 로 물으면 false (다른 계정 없음 — 건너뜀)', true, 'skipped')
  }
  const leak1 = await T(() => c.query('SELECT public.has_active_subscription($1)', [uid]))
  ok('has_active_subscription 직접 호출 차단', !leak1.ok, leak1.ok ? '호출됨' : leak1.code)
  const leak2 = await T(() => c.query('SELECT public.subscription_tier($1)', [uid]))
  ok('subscription_tier 직접 호출 차단', !leak2.ok, leak2.ok ? '호출됨' : leak2.code)

  console.log('\n■ 비회원')
  await anon()
  const a1 = await T(() => c.query('SELECT * FROM public.journey_entitlement()'))
  ok('비회원 자격 조회 차단', !a1.ok, a1.ok ? '호출됨' : a1.code)
  const a2 = await T(() => c.query('SELECT public.can_start_journey(gen_random_uuid())'))
  ok('비회원 can_start_journey 차단', !a2.ok, a2.ok ? '호출됨' : a2.code)
  const a3 = await T(() => insertJourney(uid, rid))
  ok('비회원 저니 INSERT 차단', !a3.ok, a3.ok ? '들어감' : a3.code)
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const fail = res.filter((r) => !r.p)
console.log('\n' + '='.repeat(62))
console.log(fail.length ? `FAIL — ${fail.length}개 실패 / ${res.length - fail.length}개 통과`
                        : `OK — ${res.length}개 검증 모두 통과`)
for (const f of fail) console.log('  - ' + f.l)
process.exit(fail.length ? 1 : 0)
