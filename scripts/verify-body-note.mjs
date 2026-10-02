/**
 * 074 검증 — 트랜잭션 안에서 적용하고 ROLLBACK 합니다.
 *
 * 가장 중요한 것 두 가지입니다.
 *   ① 남의 기록을 절대 못 본다 — 회원끼리도, 전문가도.
 *   ② 전문가는 사용자 기록을 **고칠 수 없다.** 경로 자체가 없어야 합니다.
 *
 * 그 다음으로 입력 규칙을 봅니다. 화면만 믿으면 API 를 직접 부르는 쪽으로
 * 다른 값이 들어옵니다.
 *
 * 사용: npm run verify:body-note
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
const anon = async () => { await svc(); await c.query('SET LOCAL ROLE anon')
  await c.query(`SELECT set_config('request.jwt.claims', NULL, true)`) }
const T = async (fn) => { try { await c.query('SAVEPOINT s'); const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return { ok: true, r } }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message } } }

/** 검증용 회원. auth.users 트리거가 프로필을 자동으로 만듭니다. */
async function member(tag) {
  const id = randomUUID()
  await c.query('INSERT INTO auth.users (id, email) VALUES ($1,$2)', [id, `bn-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`])
  return id
}

/** 오늘(한국시간) 날짜 문자열 */
const kstToday = async () => (await c.query(`SELECT (now() AT TIME ZONE 'Asia/Seoul')::date::text d`)).rows[0].d

const insertNote = (uid, date, parts, side, acts, cond, note = null) =>
  c.query(`INSERT INTO public.body_notes
    (user_id, record_date, discomfort_parts, side, activity_tags, condition, note)
    VALUES ($1,$2::date,$3::text[],$4,$5::text[],$6,$7) RETURNING id`,
    [uid, date, parts, side, acts, cond, note])

await c.connect(); await c.query('BEGIN')
try {
  await svc()
  console.log('\n■ 마이그레이션 적용')
  await c.query(readFileSync(new URL('../db/journey/074_body_notes.sql', import.meta.url).pathname, 'utf8'))
  ok('074 적용', true)

  const today = await kstToday()

  // ────────────────────────────────────────────────────────────────────────
  console.log('\n■ 권한 — Supabase 기본값이 남지 않았는가')
  const anonGrants = (await c.query(`SELECT count(*)::int n FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee='anon'
       AND table_name IN ('body_notes','professional_body_note_guidance')`)).rows[0].n
  ok('anon 에게 테이블 권한이 없다', anonGrants === 0, `${anonGrants}건`)

  // TRUNCATE 는 **RLS 를 우회합니다.** 다만 postgres·service_role 은 가지고 있는 것이
  // 정상이고 기존 테이블(user_rewards·professional_clients)도 같습니다. 위험한 것은
  // 앱이 쓰는 두 역할이 가지는 경우라 거기만 봅니다.
  const trunc = (await c.query(`SELECT count(*)::int n FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name IN ('body_notes','professional_body_note_guidance')
       AND privilege_type='TRUNCATE' AND grantee IN ('anon','authenticated','PUBLIC')`)).rows[0].n
  ok('anon·authenticated 에게 TRUNCATE 가 없다 (RLS 우회)', trunc === 0, `${trunc}건`)

  const guidWrite = (await c.query(`SELECT count(*)::int n FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='professional_body_note_guidance'
       AND grantee='authenticated' AND privilege_type IN ('INSERT','UPDATE','DELETE')`)).rows[0].n
  ok('전문가 안내는 회원이 직접 쓸 수 없다', guidWrite === 0, `${guidWrite}건`)

  const pol = (await c.query(`SELECT count(*)::int n FROM pg_policies
     WHERE schemaname='public' AND tablename='body_notes'`)).rows[0].n
  ok('body_notes 정책 4개 (select·insert·update·delete)', pol === 4, `${pol}개`)

  // ────────────────────────────────────────────────────────────────────────
  console.log('\n■ 비회원')
  const uA = await member('a')
  const uB = await member('b')
  await svc()
  const seeded = (await insertNote(uA, today, ['neck'], 'left', ['sitting_long'], 'usual')).rows[0].id

  await anon()
  const a1 = await T(() => c.query('SELECT * FROM public.body_notes'))
  ok('비회원 조회 차단', !a1.ok || a1.r.rowCount === 0, a1.ok ? `${a1.r.rowCount}행` : a1.code)
  const a2 = await T(() => insertNote(uA, today, ['neck'], null, [], 'usual'))
  ok('비회원 작성 차단', !a2.ok, a2.ok ? '들어감' : a2.code)

  // ────────────────────────────────────────────────────────────────────────
  console.log('\n■ 회원 — 본인 기록만')
  await auth(uA)
  const mine = await c.query('SELECT count(*)::int n FROM public.body_notes')
  ok('내 기록은 보인다', mine.rows[0].n === 1, `${mine.rows[0].n}행`)

  await auth(uB)
  const others = await c.query('SELECT count(*)::int n FROM public.body_notes')
  ok('남의 기록은 안 보인다', others.rows[0].n === 0, `${others.rows[0].n}행`)

  const steal = await T(() => insertNote(uA, today, ['knee'], null, [], 'usual'))
  ok('남의 이름으로 못 쓴다', !steal.ok, steal.ok ? '들어감' : steal.code)

  await auth(uA)
  const upd = await T(() => c.query(`UPDATE public.body_notes SET condition='comfortable' WHERE id=$1`, [seeded]))
  ok('내 기록은 고칠 수 있다', upd.ok && upd.r.rowCount === 1)
  await auth(uB)
  const updOther = await T(() => c.query(`UPDATE public.body_notes SET condition='comfortable' WHERE id=$1`, [seeded]))
  ok('남의 기록은 못 고친다', updOther.ok && updOther.r.rowCount === 0, `${updOther.r?.rowCount ?? '-'}행`)

  // ────────────────────────────────────────────────────────────────────────
  console.log('\n■ 입력 규칙 — 화면이 아니라 DB 가 지킨다')
  await svc()
  const dup = await T(() => insertNote(uA, today, ['back'], null, [], 'usual'))
  ok('하루 한 건 (같은 날 두 번째는 거부)', !dup.ok && dup.code === '23505', dup.code ?? '들어감')

  const future = await T(() => c.query(
    `INSERT INTO public.body_notes (user_id, record_date, condition)
     VALUES ($1, ((now() AT TIME ZONE 'Asia/Seoul')::date + 5), 'usual')`, [uB]))
  ok('미래 날짜 거부', !future.ok && future.code === '23514', future.code ?? '들어감')

  const longNote = await T(() => insertNote(uB, today, ['neck'], null, [], 'usual', 'ㄱ'.repeat(301)))
  ok('메모 300자 초과 거부', !longNote.ok && longNote.code === '23514', longNote.code ?? '들어감')

  const badCond = await T(() => insertNote(uB, today, ['neck'], null, [], 'severe'))
  ok('허용 밖 컨디션 거부', !badCond.ok && badCond.code === '23514', badCond.code ?? '들어감')

  const badPart = await T(() => insertNote(uB, today, ['spine_fracture'], null, [], 'usual'))
  ok('허용 밖 부위 거부', !badPart.ok && badPart.code === '23514', badPart.code ?? '들어감')

  const badSide = await T(() => insertNote(uB, today, ['neck'], 'diagonal', [], 'usual'))
  ok('허용 밖 좌우 거부', !badSide.ok && badSide.code === '23514', badSide.code ?? '들어감')

  // 'none' 정리
  const noneRow = (await insertNote(uB, today, ['none', 'neck'], 'left', ['walking'], 'comfortable')).rows[0].id
  const normalized = (await c.query('SELECT discomfort_parts, side FROM public.body_notes WHERE id=$1', [noneRow])).rows[0]
  ok("'없음' 을 고르면 다른 부위는 버린다", normalized.discomfort_parts.length === 1 && normalized.discomfort_parts[0] === 'none',
     JSON.stringify(normalized.discomfort_parts))
  ok("'없음' 이면 좌우는 비운다", normalized.side === null, String(normalized.side))

  // ────────────────────────────────────────────────────────────────────────
  console.log('\n■ 전문가 — 자기 고객만, 읽기만')
  const proUser = await member('pro')
  const otherProUser = await member('pro2')
  await c.query(`UPDATE public.user_profiles SET role='PROFESSIONAL' WHERE id IN ($1,$2)`, [proUser, otherProUser])
  const pro = (await c.query(`INSERT INTO public.professionals (user_profile_id, type, display_name)
    VALUES ($1,'PERSONAL_TRAINER','검증용') RETURNING id`, [proUser])).rows[0].id
  const proOther = (await c.query(`INSERT INTO public.professionals (user_profile_id, type, display_name)
    VALUES ($1,'PERSONAL_TRAINER','검증용2') RETURNING id`, [otherProUser])).rows[0].id
  const token = randomUUID()
  await c.query(`INSERT INTO public.professional_clients (professional_id, client_user_id, invite_token, status, consented_at)
    VALUES ($1,$2,$3,'ACTIVE',now())`, [pro, uA, token])

  const proTableGrant = (await c.query(`SELECT count(*)::int n FROM pg_policies
     WHERE schemaname='public' AND tablename='body_notes' AND qual LIKE '%professional%'`)).rows[0].n
  ok('body_notes 정책에 전문가 통로가 없다', proTableGrant === 0, `${proTableGrant}건`)

  await auth(proUser)
  const proRead = (await c.query('SELECT public.get_client_body_notes($1,30) v', [uA])).rows[0].v
  ok('내 고객 기록은 읽는다', proRead !== null && Array.isArray(proRead.notes) && proRead.notes.length >= 1,
     proRead ? `${proRead.notes.length}건` : 'null')

  const proReadOther = (await c.query('SELECT public.get_client_body_notes($1,30) v', [uB])).rows[0].v
  ok('내 고객이 아니면 빈 결과 (오류가 아니라 null)', proReadOther === null, String(proReadOther))

  await auth(otherProUser)
  const crossRead = (await c.query('SELECT public.get_client_body_notes($1,30) v', [uA])).rows[0].v
  ok('다른 전문가는 남의 고객을 못 읽는다', crossRead === null, String(crossRead))

  await auth(proUser)
  const summary = (await c.query('SELECT public.get_client_body_note_summary($1,30) v', [uA])).rows[0].v
  ok('요약이 온다', summary !== null && typeof summary.total === 'number', summary ? `총 ${summary.total}건` : 'null')

  const proWrite = await T(() => c.query(`UPDATE public.body_notes SET condition='comfortable' WHERE id=$1`, [seeded]))
  ok('전문가가 사용자 기록을 못 고친다', proWrite.ok && proWrite.r.rowCount === 0, `${proWrite.r?.rowCount ?? '-'}행`)
  const proDelete = await T(() => c.query(`DELETE FROM public.body_notes WHERE id=$1`, [seeded]))
  ok('전문가가 사용자 기록을 못 지운다', proDelete.ok && proDelete.r.rowCount === 0, `${proDelete.r?.rowCount ?? '-'}행`)

  // ────────────────────────────────────────────────────────────────────────
  console.log('\n■ 전문가 안내')
  await auth(proUser)
  const gid = (await c.query(`SELECT public.create_body_note_guidance($1,$2,'comment','어깨가 반복되네요. 다음에 같이 봐요.') v`,
    [uA, seeded])).rows[0].v
  ok('내 고객에게 안내를 쓴다', gid !== null, String(gid))

  const gidOther = (await c.query(`SELECT public.create_body_note_guidance($1,NULL,'comment','테스트') v`, [uB])).rows[0].v
  ok('내 고객이 아니면 못 쓴다', gidOther === null, String(gidOther))

  await auth(otherProUser)
  const gidCross = (await c.query(`SELECT public.update_body_note_guidance($1,'남의 안내 수정') v`, [gid])).rows[0].v
  ok('남이 쓴 안내는 못 고친다', gidCross === false, String(gidCross))
  const wdCross = (await c.query(`SELECT public.withdraw_body_note_guidance($1) v`, [gid])).rows[0].v
  ok('남이 쓴 안내는 못 철회한다', wdCross === false, String(wdCross))

  await auth(uA)
  const seenByUser = (await c.query(`SELECT count(*)::int n FROM public.professional_body_note_guidance`)).rows[0].n
  ok('사용자는 자기에게 온 안내를 본다', seenByUser === 1, `${seenByUser}건`)
  await auth(uB)
  const seenByOther = (await c.query(`SELECT count(*)::int n FROM public.professional_body_note_guidance`)).rows[0].n
  ok('남에게 온 안내는 안 보인다', seenByOther === 0, `${seenByOther}건`)

  await auth(uA)
  const readMark = (await c.query('SELECT public.mark_guidance_read($1) v', [gid])).rows[0].v
  ok('사용자가 읽음 처리할 수 있다', readMark === true, String(readMark))
  await auth(uB)
  const readMarkOther = (await c.query('SELECT public.mark_guidance_read($1) v', [gid])).rows[0].v
  ok('남의 안내는 읽음 처리 못 한다', readMarkOther === false, String(readMarkOther))

  await auth(proUser)
  const wd = (await c.query('SELECT public.withdraw_body_note_guidance($1) v', [gid])).rows[0].v
  ok('쓴 사람은 철회할 수 있다', wd === true, String(wd))
  await auth(uA)
  const afterWd = (await c.query(`SELECT count(*)::int n FROM public.professional_body_note_guidance`)).rows[0].n
  ok('철회하면 사용자에게 안 보인다', afterWd === 0, `${afterWd}건`)

  // ────────────────────────────────────────────────────────────────────────
  console.log('\n■ 동의 철회 — 그 다음 호출부터 즉시 막힌다')
  await svc()
  await c.query(`UPDATE public.professional_clients SET status='REVOKED', revoked_at=now() WHERE invite_token=$1`, [token])
  await auth(proUser)
  const afterRevoke = (await c.query('SELECT public.get_client_body_notes($1,30) v', [uA])).rows[0].v
  ok('관계가 끊기면 조회가 막힌다', afterRevoke === null, String(afterRevoke))
  const writeAfterRevoke = (await c.query(`SELECT public.create_body_note_guidance($1,NULL,'comment','철회 뒤') v`, [uA])).rows[0].v
  ok('관계가 끊기면 작성도 막힌다', writeAfterRevoke === null, String(writeAfterRevoke))

  // ────────────────────────────────────────────────────────────────────────
  console.log('\n■ 탈퇴하면 기록도 사라진다')
  await svc()
  const before = (await c.query('SELECT count(*)::int n FROM public.body_notes WHERE user_id=$1', [uB])).rows[0].n
  await c.query('DELETE FROM public.user_profiles WHERE id=$1', [uB])
  const after = (await c.query('SELECT count(*)::int n FROM public.body_notes WHERE user_id=$1', [uB])).rows[0].n
  ok('프로필이 지워지면 기록도 지워진다', before > 0 && after === 0, `${before}건 → ${after}건`)

  // ────────────────────────────────────────────────────────────────────────
  console.log('\n■ 의료 표현')
  const medical = (await c.query(`SELECT count(*)::int n FROM information_schema.columns
     WHERE table_schema='public' AND table_name='body_notes'
       AND column_name ~ '(pain|symptom|diagnos|disease|injur)'`)).rows[0].n
  ok('컬럼 이름에 의료 표현이 없다', medical === 0, `${medical}건`)
} finally {
  await c.query('ROLLBACK')
  await c.end()
}

const failed = res.filter((r) => !r.p)
console.log(failed.length === 0 ? `\n  OK — ${res.length}개 검증 모두 통과\n`
  : `\n  FAIL — ${failed.length}개 실패 / ${res.length - failed.length}개 통과\n`)
process.exit(failed.length === 0 ? 0 : 1)
