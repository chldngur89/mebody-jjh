/**
 * MEBODY — 운영계 이전용 부트스트랩 재생성
 *
 * 현재 DB(개발계)의 스키마와 콘텐츠를 읽어 db/bootstrap/ 을 다시 만듭니다.
 * 콘텐츠·상품·이미지가 바뀔 때마다 다시 돌리면 됩니다. 일회성 덤프가 아닙니다.
 *
 * 필요한 것: mebody-server/.env 의 SUPABASE_DB_URL / SUPABASE_DB_USERNAME / SUPABASE_DB_PASSWORD
 *            (Supabase 대시보드 > Project Settings > Database > Connection string)
 *
 * 사용: npm run db:extract
 *
 * 읽기 전용입니다. DB 를 변경하지 않습니다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
const OUT = resolve('db/bootstrap')
const ENV_PATH = process.env.MEBODY_SERVER_ENV ?? resolve('..', 'mebody-server', '.env')
let envText
try { envText = readFileSync(ENV_PATH, 'utf8') } catch {
  console.error(`FAIL: ${ENV_PATH} 를 읽을 수 없습니다.`)
  console.error('MEBODY_SERVER_ENV=<경로> 로 지정하거나 mebody-server/.env 를 준비하세요.')
  process.exit(1)
}
const env={}; for(const l of envText.split('\n')){
  const t=l.trim(); if(!t||t.startsWith('#'))continue; const i=t.indexOf('='); if(i>0)env[t.slice(0,i)]=t.slice(i+1)}
const u=new URL(env.SUPABASE_DB_URL.replace(/^jdbc:/,''))
const c=new pg.Client({host:u.hostname,port:Number(u.port||5432),database:u.pathname.replace(/^\//,'')||'postgres',
  user:env.SUPABASE_DB_USERNAME,password:env.SUPABASE_DB_PASSWORD,ssl:{rejectUnauthorized:false}})
await c.connect()
const q=async(s,p=[])=>(await c.query(s,p)).rows

// 이전 대상: 앱·서버가 쓰는 테이블만. prompts/sere_contents 는 다른 프로젝트라 제외.
const TABLES=['questions','question_choice_scores','questionnaire_responses','body_code_content',
  'body_code_next_page','body_code_result_sections','result_guide','app_content','app_images',
  'immediate_action_content','immediate_action_axis_mapping','immediate_action_discomfort_mapping',
  'user_profiles','products','missions','user_mission_progress','body_bti_results','admin_audit_logs']

// 데이터까지 옮길 테이블 (콘텐츠). 사용자 데이터는 옮기지 않는다.
const SEED=['questions','question_choice_scores','body_code_content','body_code_next_page',
  'body_code_result_sections','result_guide','app_content','app_images',
  'immediate_action_content','immediate_action_axis_mapping','immediate_action_discomfort_mapping','products']

async function ddl(t){
  const cols=await q(`SELECT column_name, data_type, udt_name, character_maximum_length, numeric_precision,
      numeric_scale, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,[t])
  const lines=cols.map(c=>{
    let type=c.data_type
    if(type==='USER-DEFINED'||type==='ARRAY') type=c.udt_name.replace(/^_/,'')+(c.data_type==='ARRAY'?'[]':'')
    else if(type==='character varying') type=c.character_maximum_length?`varchar(${c.character_maximum_length})`:'text'
    else if(type==='numeric'&&c.numeric_precision) type=`numeric(${c.numeric_precision},${c.numeric_scale})`
    else if(type==='timestamp with time zone') type='timestamptz'
    else if(type==='timestamp without time zone') type='timestamp'
    else if(type==='double precision') type='double precision'
    let def=c.column_default?` DEFAULT ${c.column_default}`:''
    // 시퀀스 기본값은 identity 로 대체
    if(def.includes('nextval(')) { type = c.data_type==='bigint'?'bigserial':'serial'; def='' }
    return `  ${c.column_name} ${type}${def}${c.is_nullable==='NO'?' NOT NULL':''}`
  })
  const cons=await q(`SELECT conname, pg_get_constraintdef(oid) def, contype FROM pg_constraint
    WHERE conrelid=$1::regclass ORDER BY contype DESC, conname`,[`public.${t}`])
  for(const k of cons){
    // auth 스키마 참조 FK 는 그대로 살린다(Supabase 프로젝트마다 auth.users 존재)
    lines.push(`  CONSTRAINT ${k.conname} ${k.def}`)
  }
  const idx=await q(`SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1
    AND indexname NOT IN (SELECT conname FROM pg_constraint WHERE conrelid=$2::regclass)`,[t,`public.${t}`])
  return `CREATE TABLE IF NOT EXISTS public.${t} (\n${lines.join(',\n')}\n);\n`
    + idx.map(i=>i.indexdef.replace(/^CREATE (UNIQUE )?INDEX /,'CREATE $1INDEX IF NOT EXISTS ')+';').join('\n')
    + (idx.length?'\n':'')
}

function lit(v){
  if(v===null||v===undefined) return 'NULL'
  if(typeof v==='number') return String(v)
  if(typeof v==='boolean') return v?'true':'false'
  if(v instanceof Date) return `'${v.toISOString()}'`
  if(Array.isArray(v)||typeof v==='object') return `'${JSON.stringify(v).replace(/'/g,"''")}'::jsonb`
  return `'${String(v).replace(/'/g,"''")}'`
}

let schema=`-- MEBODY — 앱 스키마 (개발계에서 추출, ${new Date().toISOString().slice(0,10)})
--
-- 새 Supabase 프로젝트를 운영계로 세울 때 이 파일부터 실행합니다.
-- 저장소에 DDL 이 없던 테이블(콘솔에서 만든 것)까지 전부 포함합니다.
-- RLS 정책은 여기 없습니다. 120_rls.sql 에서 처음부터 올바르게 설정합니다.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

`
for(const t of TABLES){ schema += `\n-- ===== ${t} =====\n` + await ddl(t) }

// updated_at 트리거 재생성
const trg=await q(`SELECT c.relname, t.tgname, pg_get_triggerdef(t.oid) def FROM pg_trigger t
  JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace
  ORDER BY c.relname`)
if(trg.length){
  schema += `\n-- ===== 트리거 =====\n`
  for(const g of trg) if(TABLES.includes(g.relname))
    schema += `DROP TRIGGER IF EXISTS ${g.tgname} ON public.${g.relname};\n${g.def};\n`
}
schema += `\nCOMMIT;\n`
writeFileSync(`${OUT}/110_app_schema.sql`, schema)
console.log(`110_app_schema.sql — ${TABLES.length}개 테이블, ${schema.split('\n').length}줄`)

let seed=`-- MEBODY — 콘텐츠 시드 (개발계에서 추출, ${new Date().toISOString().slice(0,10)})
--
-- 콘텐츠·문항·매핑만 옮깁니다. 사용자 데이터(questionnaire_responses, user_profiles)는 옮기지 않습니다.
-- 재실행 안전: 기본키 충돌 시 갱신합니다.

BEGIN;

`
let total=0
for(const t of SEED){
  const rows=await q(`SELECT * FROM public.${t} ORDER BY 1`)
  if(!rows.length) continue
  const pk=(await q(`SELECT a.attname FROM pg_constraint c
    JOIN unnest(c.conkey) k(n) ON true JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n
    WHERE c.conrelid=$1::regclass AND c.contype='p'`,[`public.${t}`])).map(r=>r.attname)
  const cols=Object.keys(rows[0])
  seed += `\n-- ===== ${t} (${rows.length}행) =====\n`
  for(const r of rows){
    const vals=cols.map(k=>lit(r[k])).join(', ')
    const upd=cols.filter(k=>!pk.includes(k)).map(k=>`${k} = EXCLUDED.${k}`).join(', ')
    seed += `INSERT INTO public.${t} (${cols.join(', ')}) VALUES (${vals})`
    seed += pk.length&&upd ? `\n  ON CONFLICT (${pk.join(', ')}) DO UPDATE SET ${upd};\n` : ` ON CONFLICT DO NOTHING;\n`
  }
  total += rows.length
  console.log(`  ${t.padEnd(36)} ${rows.length}행`)
}
seed += `\nCOMMIT;\n`
writeFileSync(`${OUT}/130_seed_content.sql`, seed)
console.log(`130_seed_content.sql — 총 ${total}행`)
await c.end()
