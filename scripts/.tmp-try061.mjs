import { readFileSync } from 'node:fs'
import pg from 'pg'
const srv = {}
for (const l of readFileSync('../mebody-server/.env','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue; const i=t.indexOf('='); if(i>0) srv[t.slice(0,i)]=t.slice(i+1) }
const u=new URL(srv.SUPABASE_DB_URL.replace(/^jdbc:/,''))
const db=new pg.Client({host:u.hostname,port:+(u.port||5432),database:u.pathname.replace(/^\//,'')||'postgres',user:srv.SUPABASE_DB_USERNAME,password:srv.SUPABASE_DB_PASSWORD,ssl:{rejectUnauthorized:false}})
await db.connect()
await db.query('BEGIN')
try {
  const before = (await db.query(`SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'`)).rows[0].n
  await db.query(readFileSync('db/journey/061_drop_legacy_tables.sql','utf8'))
  const after = (await db.query(`SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'`)).rows[0].n
  const gone = (await db.query(`SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'
    AND tablename IN ('prompts','sere_contents','body_bti_results')`)).rows[0].n
  const kept = (await db.query(`SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'
    AND tablename IN ('missions','user_mission_progress','user_missions','user_journeys')`)).rows[0].n
  console.log(`  PASS  테이블 ${before} → ${after} (3개 감소 예상: ${before - after === 3})`)
  console.log(`  ${gone === 0 ? 'PASS' : 'FAIL'}  지울 것이 사라졌다 — ${gone}개 남음`)
  console.log(`  ${kept === 4 ? 'PASS' : 'FAIL'}  남길 것은 그대로 — ${kept}/4개`)
  // 외래키로 딸려 지워지는 게 없는지
  const fk = (await db.query(`SELECT count(*)::int n FROM pg_constraint WHERE contype='f'`)).rows[0].n
  console.log(`  외래키 ${fk}개 (삭제 전후 비교용)`)
} catch (e) { console.log('  ❌', e.message); process.exitCode = 1 }
finally {
  await db.query('ROLLBACK')
  const back = (await db.query(`SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'
    AND tablename IN ('prompts','sere_contents','body_bti_results')`)).rows[0].n
  console.log(`\n  롤백 후 복구 = ${back}/3개`)
  await db.end()
}
