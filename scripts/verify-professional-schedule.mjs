/**
 * 전문가가 짜준 것을 고객이 **그대로 따라하게 되는가** — 끝에서 끝까지.
 *
 * 기존 스위트는 조각을 봅니다. verify:professional 은 권한을, verify:professional-api 는
 * 서버 API 를 봅니다. 그런데 **배정한 것이 고객 화면에 실제로 나타나는지**는 아무도
 * 안 봤습니다. 거기가 끊기면 전문가는 짰는데 고객은 모르는 상태가 됩니다.
 *
 * 그래서 이 스위트는 한 줄로 잇습니다.
 *
 *   고객이 바디 노트를 남긴다
 *     → 전문가가 그 기록을 읽는다 (074)
 *     → 보고 미션을 배정한다 (059)
 *     → **고객이 앱과 같은 경로로 그 미션을 본다** (user_missions · RLS)
 *     → 전문가가 안내를 남기고 고객이 읽는다 (074)
 *     → 동의를 거두면 위가 전부 막힌다
 *
 * 고객 쪽 조회는 앱이 쓰는 것과 **같은 질의**를 씁니다(src/api/journey.ts 의
 * fetchMissionsForJourney — user_missions 를 RLS 로 직접 읽습니다).
 * 함수를 따로 만들어 보면 "검증은 통과하는데 앱에서는 안 보이는" 일이 생깁니다.
 *
 * 사용: npm run verify:professional-schedule
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { randomUUID } from 'node:crypto'

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
const auth = async (id) => { await svc(); await c.query('SET LOCAL ROLE authenticated')
  await c.query(`SELECT set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]) }
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }

async function member(tag) {
  const id = randomUUID()
  await c.query('INSERT INTO auth.users (id, email) VALUES ($1,$2)',
    [id, `sch-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`])
  return id
}

await c.connect(); await c.query('BEGIN')
try {
  await svc()

  console.log('\n■ 준비 — 전문가와 고객을 잇습니다')
  const client = await member('client')
  const proUser = await member('pro')
  await c.query(`UPDATE public.user_profiles SET role='PROFESSIONAL' WHERE id=$1`, [proUser])
  const pro = (await c.query(`INSERT INTO public.professionals (user_profile_id, type, display_name)
    VALUES ($1,'PERSONAL_TRAINER','검증용 트레이너') RETURNING id`, [proUser])).rows[0].id
  const token = randomUUID()
  await c.query(`INSERT INTO public.professional_clients (professional_id, client_user_id, invite_token, status, consented_at)
    VALUES ($1,$2,$3,'ACTIVE',now())`, [pro, client, token])

  // 고객에게 진행 중인 저니가 있어야 배정이 들어갑니다(앱과 같은 전제).
  const template = (await c.query(`SELECT code FROM public.journey_templates WHERE is_active LIMIT 1`)).rows[0]?.code
  ok('저니 템플릿이 있다', Boolean(template), String(template))
  const journey = (await c.query(`INSERT INTO public.user_journeys (user_id, template_code, body_code, status, started_at)
    VALUES ($1,$2,'FRRS','active',now()) RETURNING id`, [client, template])).rows[0].id
  ok('고객 저니 준비', Boolean(journey))

  console.log('\n■ ① 고객이 오늘의 몸을 적는다')
  await auth(client)
  const noteId = (await c.query(`INSERT INTO public.body_notes
    (user_id, record_date, discomfort_parts, side, activity_tags, condition)
    VALUES (public.current_profile_id(), (now() AT TIME ZONE 'Asia/Seoul')::date,
            ARRAY['shoulder']::text[], 'right', ARRAY['sitting_long']::text[], 'slightly_uncomfortable')
    RETURNING id`)).rows[0].id
  ok('고객이 바디 노트를 남겼다', Boolean(noteId))

  console.log('\n■ ② 전문가가 그 기록을 읽는다')
  await auth(proUser)
  const notes = (await c.query('SELECT public.get_client_body_notes($1,30) v', [client])).rows[0].v
  ok('전문가가 고객 기록을 읽는다', notes !== null && notes.notes.length === 1, notes ? `${notes.notes.length}건` : 'null')
  ok('불편 부위가 그대로 온다', notes?.notes?.[0]?.discomfort_parts?.[0] === 'shoulder',
     JSON.stringify(notes?.notes?.[0]?.discomfort_parts))
  const summary = (await c.query('SELECT public.get_client_body_note_summary($1,30) v', [client])).rows[0].v
  ok('요약에 어깨가 잡힌다', summary?.parts?.shoulder === 1, JSON.stringify(summary?.parts))

  console.log('\n■ ③ 전문가가 보고 미션을 배정한다')
  const content = (await c.query(`SELECT content_key FROM public.immediate_action_content LIMIT 1`)).rows[0].content_key
  const NOTE = '어깨가 반복되네요. 오늘은 가볍게 진행해주세요.'
  const missionId = (await c.query('SELECT public.assign_client_mission($1,$2,$3) v', [client, content, NOTE])).rows[0].v
  ok('배정이 들어간다', Boolean(missionId), String(missionId))

  console.log('\n■ ④ 고객이 앱과 같은 경로로 그것을 본다')
  await auth(client)
  // src/api/journey.ts 의 fetchMissionsForJourney 와 같은 질의입니다.
  const mine = (await c.query(
    `SELECT id, assigned_by, prescription, content_key, day_no
       FROM public.user_missions WHERE user_journey_id = $1 ORDER BY day_no, slot_no`, [journey])).rows
  const assigned = mine.find((m) => m.id === missionId)
  ok('내 오늘 미션 목록에 들어 있다', Boolean(assigned), `${mine.length}건 중`)
  ok('전문가가 넣었다는 표시가 있다', assigned?.assigned_by === pro, String(assigned?.assigned_by))
  ok('전문가 메모가 그대로 보인다', assigned?.prescription?.note === NOTE, String(assigned?.prescription?.note))
  ok('동작은 승인된 콘텐츠에서만 온다', assigned?.content_key === content, String(assigned?.content_key))

  console.log('\n■ ⑤ 전문가가 안내를 남기고 고객이 읽는다')
  await auth(proUser)
  const gid = (await c.query(
    `SELECT public.create_body_note_guidance($1,$2,'check_next_session','다음에 어깨 가동범위 같이 볼게요.') v`,
    [client, noteId])).rows[0].v
  ok('안내를 남긴다', gid !== null, String(gid))
  await auth(client)
  const seen = (await c.query(`SELECT count(*)::int n FROM public.professional_body_note_guidance`)).rows[0].n
  ok('고객에게 보인다', seen === 1, `${seen}건`)
  const marked = (await c.query('SELECT public.mark_guidance_read($1) v', [gid])).rows[0].v
  ok('고객이 읽음 처리한다', marked === true, String(marked))

  console.log('\n■ ⑥ 전문가는 고객 기록을 고칠 수 없다')
  await auth(proUser)
  const edit = await T(() => c.query(`UPDATE public.body_notes SET condition='comfortable' WHERE id=$1`, [noteId]))
  ok('기록 수정이 안 된다', edit.ok && edit.r.rowCount === 0, `${edit.r?.rowCount ?? '-'}행`)
  const del = await T(() => c.query(`DELETE FROM public.body_notes WHERE id=$1`, [noteId]))
  ok('기록 삭제가 안 된다', del.ok && del.r.rowCount === 0, `${del.r?.rowCount ?? '-'}행`)

  console.log('\n■ ⑦ 동의를 거두면 전부 막힌다')
  await svc()
  await c.query(`UPDATE public.professional_clients SET status='REVOKED', revoked_at=now() WHERE invite_token=$1`, [token])
  await auth(proUser)
  const afterRead = (await c.query('SELECT public.get_client_body_notes($1,30) v', [client])).rows[0].v
  ok('기록 조회가 막힌다', afterRead === null, String(afterRead))
  const afterAssign = await T(() => c.query('SELECT public.assign_client_mission($1,$2,$3) v', [client, content, '거둔 뒤']))
  ok('배정이 막힌다', !afterAssign.ok && afterAssign.code === '42501', afterAssign.code ?? '들어감')
  const afterGuide = (await c.query(`SELECT public.create_body_note_guidance($1,NULL,'comment','거둔 뒤') v`, [client])).rows[0].v
  ok('안내 작성이 막힌다', afterGuide === null, String(afterGuide))

  console.log('\n■ ⑧ 이미 배정된 것은 고객 것으로 남는다')
  await auth(client)
  const stillThere = (await c.query(
    `SELECT count(*)::int n FROM public.user_missions WHERE id=$1`, [missionId])).rows[0].n
  ok('관계가 끊겨도 받은 미션은 그대로', stillThere === 1,
     '거둔다고 과거에 받은 것을 뺏으면 그게 더 이상합니다')
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const failed = res.filter((r) => !r.p)
console.log(failed.length === 0 ? `\n  OK — ${res.length}개 검증 모두 통과\n`
  : `\n  FAIL — ${failed.length}개 실패 / ${res.length - failed.length}개 통과\n`)
process.exit(failed.length === 0 ? 0 : 1)
