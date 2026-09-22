import { readFileSync } from 'node:fs'
import pg from 'pg'
const srv = {}
for (const l of readFileSync('../mebody-server/.env','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue; const i=t.indexOf('='); if(i>0) srv[t.slice(0,i)]=t.slice(i+1) }
const u=new URL(srv.SUPABASE_DB_URL.replace(/^jdbc:/,''))
const db=new pg.Client({host:u.hostname,port:+(u.port||5432),database:u.pathname.replace(/^\//,'')||'postgres',user:srv.SUPABASE_DB_USERNAME,password:srv.SUPABASE_DB_PASSWORD,ssl:{rejectUnauthorized:false}})
await db.connect()
const r = await db.query(`SELECT j.id, p.display_name,
  j.last_active_at::date la,
  (SELECT max(m.completed_at)::date FROM public.user_missions m
    WHERE m.user_journey_id=j.id AND m.status='completed') real_last,
  j.current_day, public.journey_current_day(j.id) real_day
  FROM public.user_journeys j LEFT JOIN public.user_profiles p ON p.id=j.user_id
  WHERE j.status='active' ORDER BY p.display_name`)
console.log('■ last_active_at 이 실제 활동과 맞나')
console.log(`  ${'고객'.padEnd(12)} ${'저장 last_active'.padEnd(16)} ${'실제 마지막 완료'.padEnd(16)} 일치`)
for (const x of r.rows) {
  const a = x.la ? new Date(x.la).toISOString().slice(0,10) : '—'
  const b = x.real_last ? new Date(x.real_last).toISOString().slice(0,10) : '—'
  console.log(`  ${String(x.display_name ?? '(이름없음)').padEnd(12)} ${a.padEnd(16)} ${b.padEnd(16)} ${a===b?'O':'X'}`)
}
await db.end()
