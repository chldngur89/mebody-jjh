/**
 * DB 에 무엇이 적용돼 있는지 한눈에 봅니다.
 *
 * 이 프로젝트는 마이그레이션 이력 테이블이 없고 SQL Editor 로 손으로 적용합니다.
 * 그래서 "다 적용했나" 를 파일 목록으로는 알 수 없습니다. 대신 각 파일이 남기는
 * 흔적(테이블·컬럼·함수·제약·권한)을 직접 찾아 판정합니다.
 *
 * 사용: npm run verify:migrations
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
  user: env.SUPABASE_DB_USERNAME, password: env.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false } })
await c.connect()

const v = async (sql, args = []) => Boolean((await c.query(sql, args)).rows[0]?.v)
const table = (t) => v(`SELECT to_regclass($1) IS NOT NULL AS v`, [`public.${t}`])
const col = (t, name) => v(`SELECT count(*)>0 AS v FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [t, name])
const fn = (n) => v(`SELECT count(*)>0 AS v FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname=$1`, [n])
const src = (n, needle) => v(`SELECT count(*)>0 AS v FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname=$1 AND p.prosrc LIKE $2`, [n, `%${needle}%`])
const con = (t, n) => v(`SELECT count(*)>0 AS v FROM pg_constraint WHERE conrelid=$1::regclass AND conname=$2`, [`public.${t}`, n])
const noTruncate = (t) => v(`SELECT count(*)=0 AS v FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name=$1 AND privilege_type='TRUNCATE' AND grantee IN ('anon','authenticated')`, [t])

const CHECKS = [
  ['v1/010_v1_schema',                   () => table('questions')],
  ['v1/011_deactivate_legacy',           () => v(`SELECT count(*)=0 AS v FROM public.questions WHERE is_active AND question_set<>'mebody_v1_32'`)],
  ['v1/012~014 문항·점수 시드',            () => v(`SELECT count(*)=96 AS v FROM public.question_choice_scores`)],
  ['v1/015_table_role_comments',         () => v(`SELECT obj_description('public.questions'::regclass) IS NOT NULL AS v`)],
  ['v1/016_option_guide_media',          () => col('questions', 'media_url_option_1')],
  ['v1/050_app_error_log',               () => table('app_error_log')],
  ['v1/051_app_error_log_policies',      () => fn('app_error_log_rate_limit')],
  ['journey/020_journey_schema',         () => table('user_journeys')],
  ['journey/021_journey_rls',            () => v(`SELECT count(*)>0 AS v FROM pg_policies WHERE tablename='user_journeys'`)],
  ['journey/022~023 저니 시드',            () => v(`SELECT count(*)>0 AS v FROM public.journey_content_tags`)],
  ['journey/030_action_media',           () => table('immediate_action_content')],
  ['journey/031_rewards',                () => table('user_rewards')],
  ['journey/032_orders',                 () => table('orders')],
  ['journey/033_daily_routine_reward',   () => fn('claim_daily_routine_reward')],
  ['journey/034_entitlement',            () => fn('can_start_journey')],
  ['journey/035_single_plan',            () => table('membership_plans')],
  ['journey/036_routine_bonus_reward',   () => fn('claim_routine_bonus_reward')],
  ['journey/037_redesign',               () => table('body_code_next_page')],
  ['journey/038_seller_and_products',    () => col('products', 'seller_id')],
  ['journey/039_product_image_required', () => con('products', 'products_image_required')],
  ['journey/040_billing',                () => table('payments')],
  ['journey/041_billing_grants_fix',     () => noTruncate('payments')],
  ['journey/042_fulfillment_and_ssv',    () => col('orders', 'fulfillment_status')],
  // 043 은 옛 문항을 questions_archive 로 옮겼고, 050 이 그 보관 테이블을 지웠습니다.
  // 그래서 '보관 테이블이 있는가' 로는 더 이상 판정할 수 없습니다.
  // 043 이 노린 최종 상태(questions 에 옛 문항이 없다)로 판정합니다.
  ['journey/043_archive_v3_questions (049·050 으로 대체)',
                                         () => v(`SELECT count(*)=0 AS v FROM public.questions WHERE question_set<>'mebody_v1_32'`)],
  ['journey/044_response_read_hardening',() => fn('save_questionnaire_response')],
  ['journey/045_freeze_completed_result',() => src('save_questionnaire_response', '이미 제출된 결과는 수정할 수 없습니다')],
  ['journey/046_body_code_content_*',    () => col('body_code_content', 'identity_title')],
  ['journey/046_delete_account',         () => fn('prepare_account_deletion')],
  ['journey/047_drop_legacy_create_order',() => v(`SELECT count(*)=1 AS v FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname='create_order'`)],
  ['journey/048_app_error_log_grants',   () => noTruncate('app_error_log')],
  ['journey/049_cleanup_legacy_questions',() => v(`SELECT count(*)=32 AS v FROM public.questions`)],
  ['journey/050_drop_questions_archive', () => v(`SELECT to_regclass('public.questions_archive') IS NULL AS v`)],
  ['journey/051_purge_legacy_responses', () => v(`SELECT count(*)=0 AS v FROM public.questionnaire_responses WHERE question_version IS NULL OR question_version<>'mebody_v1_32'`)],
  ['journey/052_professional_core',      () => fn('current_professional_id')],
  ['journey/053_professional_client_read',() => fn('get_client_response')],
  ['journey/054_analytics_events',       () => table('analytics_events')],
  ['journey/055_signup_consent',         () => col('user_profiles', 'terms_agreed_at')],
  ['journey/056_professional_client_journey', () => fn('get_client_journey_summary')],
  ['journey/056 · 활동 로그',             () => table('professional_activity_log')],
  ['journey/057_reward_monthly_cap',      () => fn('reward_monthly_cap')],
  ['journey/057 · 눈→원 표',              () => col('reward_rules', 'payout')],
  ['journey/058_reward_disclosure',       () => v(`SELECT count(*)>0 AS v FROM public.reward_rules
     WHERE code='daily_routine_dice' AND disclosure LIKE '%1/6%'`)],
  ['journey/059_professional_assignment', () => fn('assign_client_mission')],
  ['journey/059 · 배정 출처',              () => col('user_missions', 'assigned_by')],
  ['journey/060_assignment_day_fix',      () => fn('journey_current_day')],
  ['journey/061_drop_legacy_tables',      () => v(`SELECT count(*)=0 AS v FROM pg_tables
     WHERE schemaname='public' AND tablename IN ('prompts','sere_contents','body_bti_results')`)],
  ['journey/062_drop_legacy_mission_tables', () => v(`SELECT count(*)=0 AS v FROM pg_tables
     WHERE schemaname='public' AND tablename IN ('missions','user_mission_progress')`)],
  ['journey/063_bonus_disclosure',        () => v(`SELECT count(*)>0 AS v FROM public.reward_rules
     WHERE code='routine_bonus_dice' AND disclosure LIKE '%보지 않아도%'`)],
  ['journey/064_account_deletion_after_cleanup', () => v(`SELECT count(*)=0 AS v FROM pg_proc p
     JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
     AND p.proname='prepare_account_deletion'
     AND p.prosrc ~ 'DELETE\\s+FROM\\s+public\\.body_bti_results'`)],
  ['journey/065_cap_memo_fix',            () => v(`SELECT count(*)>0 AS v FROM pg_proc p
     JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
     AND p.proname='enforce_reward_monthly_cap' AND p.prosrc LIKE '%capped_from%'`)],
  ['journey/066_challenge_disclosure',    () => v(`SELECT count(*)=3 AS v FROM public.reward_rules
     WHERE code IN ('weekly_challenge','monthly_challenge','journey_complete')
     AND disclosure LIKE '%오전 5시%'`)],
  ['journey/067_ssv_bonus_payout',        () => v(`SELECT count(*)>0 AS v FROM pg_proc p
     JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
     AND p.proname='grant_routine_bonus_admin' AND p.prosrc LIKE '%reward_payout_for%'`)],
  ['journey/068_invite_sent_event',       () => fn('create_client_invite')],
  ['journey/069_plan_draft_input',        () => fn('get_client_plan_input')],
]

console.log('\n■ 마이그레이션 적용 상태')
const missing = []
for (const [name, check] of CHECKS) {
  let applied = false
  try { applied = await check() } catch { applied = false }
  if (!applied) missing.push(name)
  console.log(`  ${applied ? '적용  ' : '미적용'}  ${name}`)
}

console.log('\n■ 남아 있으면 안 되는 것')
const leftovers = []
const truncate = (await c.query(`SELECT table_name FROM information_schema.role_table_grants
   WHERE table_schema='public' AND privilege_type='TRUNCATE' AND grantee IN ('anon','authenticated')
   GROUP BY table_name ORDER BY table_name`)).rows.map((r) => r.table_name)
if (truncate.length) leftovers.push(`TRUNCATE 가 앱 역할에 열린 테이블: ${truncate.join(', ')}`)

const overloads = (await c.query(`SELECT p.proname, count(*)::int n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.proname IN ('create_order','cancel_order','save_questionnaire_response','get_questionnaire_response')
   GROUP BY 1 HAVING count(*)>1`)).rows
for (const o of overloads) leftovers.push(`같은 이름 함수가 ${o.n}개: ${o.proname}`)

const staleQuestions = Number((await c.query(`SELECT count(*)::int n FROM public.questions WHERE question_set<>'mebody_v1_32'`)).rows[0].n)
if (staleQuestions > 0) leftovers.push(`questions 에 옛 문항 ${staleQuestions}행`)

const archive = await v(`SELECT to_regclass('public.questions_archive') IS NOT NULL AS v`)
if (archive) leftovers.push('옛 문항 보관 테이블 questions_archive 가 남아 있음 (journey/050 미적용)')

const oldResponses = Number((await c.query(`SELECT count(*)::int n FROM public.questionnaire_responses
   WHERE question_version IS NULL OR question_version<>'mebody_v1_32'`)).rows[0].n)
if (oldResponses > 0) leftovers.push(`옛 문항 세트 응답 ${oldResponses}건 (journey/051 미적용)`)

const orphanAuth = Number((await c.query(`SELECT count(*)::int n FROM public.user_profiles p
   WHERE p.auth_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p.auth_user_id)`)).rows[0].n)
if (orphanAuth > 0) leftovers.push(`인증 계정이 사라진 프로필 ${orphanAuth}건`)

/**
 * 지운 테이블을 아직 참조하는 DB 함수가 있으면 잔재입니다.
 *
 * 061 에서 body_bti_results 를 지울 때 앱·서버 코드는 훑었는데 **DB 함수는 안 훑았습니다.**
 * prepare_account_deletion() 이 그 테이블을 DELETE 하고 있었고, 탈퇴가 503 으로 죽었습니다.
 * 겉으로는 "046 미적용" 이라고 나와서 원인을 찾는 데 시간이 걸렸습니다.
 * 테이블을 지울 때는 코드만이 아니라 **함수·뷰·트리거까지** 봐야 합니다.
 */
const DROPPED = ['prompts', 'sere_contents', 'body_bti_results', 'missions', 'user_mission_progress']

//
// ★ 주석은 빼고 봅니다. 064 는 "예전에는 body_bti_results 를 지웠습니다" 라는 설명을
//   함수 본문 주석으로 남겼는데, 그걸 코드로 세어 멀쩡한 함수를 잔재로 잡았습니다.
//   설명을 지우면 다음 사람이 왜 그런지 모르게 되므로, 검사 쪽을 고치는 게 맞습니다.
const brokenFns = (await c.query(`
  WITH stripped AS (
    SELECT p.proname,
           regexp_replace(regexp_replace(p.prosrc, '/\\*.*?\\*/', ' ', 'gs'),
                          '--[^' || chr(10) || ']*', ' ', 'g') AS src
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
  )
  SELECT proname FROM stripped
   WHERE src ~ '\\mprompts\\M'
      OR src ~ '\\msere_contents\\M'
      OR src ~ '\\mbody_bti_results\\M'
      OR src ~ '\\muser_mission_progress\\M'
      OR (src ~ '\\mmissions\\M' AND src !~ 'user_missions')`)).rows
for (const row of brokenFns) {
  leftovers.push(`함수 ${row.proname}() 가 지운 테이블을 아직 참조함 — 부르면 실패합니다`)
}

// 지운 테이블이 되살아났는지도 봅니다. 옛 마이그레이션을 다시 돌리면 생길 수 있습니다.
for (const t of DROPPED) {
  if (await v(`SELECT to_regclass('public.${t}') IS NOT NULL AS v`)) {
    leftovers.push(`지운 테이블 ${t} 가 다시 생겨 있음 (061·062 확인)`)
  }
}

if (leftovers.length === 0) console.log('  없음')
for (const l of leftovers) console.log(`  ! ${l}`)

console.log(`\n${missing.length === 0 && leftovers.length === 0 ? '✅' : '❌'} 미적용 ${missing.length}건 · 잔재 ${leftovers.length}건`)
await c.end()
process.exit(missing.length === 0 && leftovers.length === 0 ? 0 : 1)
