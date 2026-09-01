/**
 * MEBODY — 회원 · 비회원 전체 E2E (실제 적용된 스키마 대상)
 *
 * PostgREST 가 하는 역할 전환(authenticated + request.jwt.claims)을 그대로 재현하므로
 * RLS 와 SECURITY DEFINER 함수가 앱에서와 동일하게 동작합니다.
 * 규칙 계산은 앱이 쓰는 실제 모듈(journeyRules.ts)을 그대로 import 합니다.
 *
 * 트랜잭션 안에서 실행하고 ROLLBACK 하므로 데이터는 남지 않습니다.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { buildAxisPriority, selectDailyMissions, buildMissionSteps, buildReportPayload,
         recommendNextJourney, reportRangeFor } from '../src/utils/journeyRules.ts'
import { buildCareRoutine } from '../src/utils/careRoutine.ts'

const EMAIL = process.env.MEBODY_E2E_EMAIL ?? 'wh.choi@mebody.net'
const env={}; for(const l of readFileSync(process.env.MEBODY_SERVER_ENV ?? new URL('../../mebody-server/.env', import.meta.url).pathname,'utf8').split('\n')){
  const t=l.trim(); if(!t||t.startsWith('#'))continue; const i=t.indexOf('='); if(i>0)env[t.slice(0,i)]=t.slice(i+1)}
const u=new URL(env.SUPABASE_DB_URL.replace(/^jdbc:/,''))
const c=new pg.Client({host:u.hostname,port:Number(u.port||5432),database:u.pathname.replace(/^\//,'')||'postgres',
  user:env.SUPABASE_DB_USERNAME,password:env.SUPABASE_DB_PASSWORD,ssl:{rejectUnauthorized:false},statement_timeout:120000})
const res=[]; const ok=(l,p,d='')=>{res.push({l,p});console.log(`  ${p?'PASS':'FAIL'}  ${l}${d?` — ${d}`:''}`)}
const svc=async()=>c.query(`RESET ROLE`)
const anon=async()=>{await svc();await c.query(`SET LOCAL ROLE anon`)}
const auth=async(id)=>{await svc();await c.query(`SET LOCAL ROLE authenticated`)
  await c.query(`SELECT set_config('request.jwt.claims',$1,true)`,[JSON.stringify({sub:id,role:'authenticated'})])}
const T=async(fn)=>{try{await c.query('SAVEPOINT s');const r=await fn();await c.query('RELEASE SAVEPOINT s');return{ok:true,r}}
  catch(e){await c.query('ROLLBACK TO SAVEPOINT s');return{ok:false,code:e.code,msg:e.message}}}
const AXIS={neck:'neck',shoulder:'shoulder',pelvis:'pelvis',flexibility:'lower'}

await c.connect(); await c.query('BEGIN')
try{
  const uid=(await c.query(`SELECT id FROM auth.users WHERE email=$1`,[EMAIL])).rows[0].id
  const other=(await c.query(`SELECT id FROM auth.users WHERE email<>$1 LIMIT 1`,[EMAIL])).rows[0].id
  console.log(`계정: ${EMAIL}\n`)

  // ══ 비회원 ══
  console.log('■ 비회원')
  await anon()
  const anonDraft=await T(()=>c.query(`INSERT INTO public.questionnaire_responses (answers,status,question_version)
    VALUES ('{"A1":"①"}'::jsonb,'draft','mebody_v1_32') RETURNING id`))
  ok('진단 초안 생성', anonDraft.ok, anonDraft.ok?'':anonDraft.code)
  const anonId=anonDraft.ok?anonDraft.r.rows[0].id:null
  if(anonId){
    const sub=await T(()=>c.query(`UPDATE public.questionnaire_responses
      SET status='completed',calculated_code='FRRS',completed_at=now() WHERE id=$1`,[anonId]))
    ok('결과 제출', sub.ok&&sub.r.rowCount===1, sub.ok?'':sub.code)
    const read=await T(()=>c.query(`SELECT calculated_code FROM public.get_questionnaire_response($1)`,[anonId]))
    ok('조회 RPC 로 자기 결과 확인', read.ok&&read.r.rows[0]?.calculated_code==='FRRS', read.ok?'':read.code)
  }
  const peek=await T(()=>c.query(`SELECT count(*)::int n FROM public.questionnaire_responses WHERE user_id IS NOT NULL`))
  ok('회원 응답은 못 봄', peek.ok&&peek.r.rows[0].n===0, peek.ok?`${peek.r.rows[0].n}건`:peek.code)
  const q=await T(()=>c.query(`SELECT count(*)::int n FROM public.questions WHERE is_active AND question_set='mebody_v1_32'`))
  ok('32문항 조회', q.ok&&q.r.rows[0].n===32, q.ok?`${q.r.rows[0].n}개`:q.code)
  const jt=await T(()=>c.query(`SELECT count(*)::int n FROM public.journey_content_tags`))
  ok('저니 카탈로그 읽기', jt.ok&&jt.r.rows[0].n===23, jt.ok?`${jt.r.rows[0].n}행`:jt.code)
  const noJ=await T(()=>c.query(`SELECT count(*) FROM public.user_journeys`))
  ok('저니 사용자 테이블 차단', !noJ.ok, noJ.ok?'노출됨':noJ.code)
  const noR=await T(()=>c.query(`SELECT * FROM public.claim_mission_reward(gen_random_uuid())`))
  ok('적립 함수 호출 차단', !noR.ok, noR.ok?'호출됨':noR.code)

  // ══ 회원: 진단 ══
  console.log('\n■ 회원 — 진단')
  await auth(uid)
  const mine=await T(()=>c.query(`INSERT INTO public.questionnaire_responses
    (user_id,answers,status,calculated_code,primary_identity,scoring_meta,question_version,completed_at)
    VALUES ($1,'{"A1":"③","B1":"①"}'::jsonb,'completed','FRRS','회복 우선형',
      (SELECT scoring_meta FROM public.questionnaire_responses WHERE scoring_meta ? 'axis'
        AND question_version='mebody_v1_32' LIMIT 1),'mebody_v1_32',now()) RETURNING id`,[uid]))
  ok('회원 진단 저장', mine.ok, mine.ok?'':mine.code)
  const rid=mine.ok?mine.r.rows[0].id:null
  const own=await T(()=>c.query(`SELECT count(*)::int n FROM public.questionnaire_responses WHERE user_id=$1`,[uid]))
  ok('본인 결과 조회', own.ok&&own.r.rows[0].n===1, own.ok?`${own.r.rows[0].n}건`:own.code)
  const foreign=await T(()=>c.query(`SELECT count(*)::int n FROM public.questionnaire_responses
    WHERE user_id IS NOT NULL AND user_id<>$1`,[uid]))
  ok('다른 회원 결과 안 보임', foreign.ok&&foreign.r.rows[0].n===0, foreign.ok?`${foreign.r.rows[0].n}건`:foreign.code)

  // ══ 회원: 저니 시작 ══
  console.log('\n■ 회원 — 저니 시작')
  await svc()
  const meta=(await c.query(`SELECT scoring_meta FROM public.questionnaire_responses WHERE id=$1`,[rid])).rows[0].scoring_meta
  const axisRows=Object.entries(meta.axis).map(([k,d])=>{const t=d.scoreA+d.scoreB
    return {key:k,axisLookupKey:AXIS[k],dominantCode:d.winner,
      dominantPercent:t>0?Math.round(Math.max(d.scoreA,d.scoreB)/t*100):50,dominantLabel:d.winner,
      axisNo:{neck:1,shoulder:2,pelvis:3,flexibility:4}[k],title:{neck:'목 위치',shoulder:'어깨 높이',pelvis:'골반 회전',flexibility:'하체 유연성'}[k]}})
  const prio=buildAxisPriority(axisRows)
  console.log(`     우선순위: ${prio.map(p=>`${p.rank}:${p.axis}(${p.direction},${p.percent}%)`).join(' ')}`)

  await auth(uid)
  const jStart=await T(()=>c.query(`INSERT INTO public.user_journeys
    (user_id,questionnaire_response_id,body_code,axis_priority) VALUES ($1,$2,'FRRS',$3::jsonb) RETURNING id`,
    [uid,rid,JSON.stringify(prio)]))
  ok('저니 생성', jStart.ok, jStart.ok?'':jStart.code)
  const jid=jStart.ok?jStart.r.rows[0].id:null
  const dup=await T(()=>c.query(`INSERT INTO public.user_journeys (user_id,body_code,axis_priority)
    VALUES ($1,'FRRS','[]'::jsonb)`,[uid]))
  ok('진행 중 저니 중복 생성 차단', !dup.ok&&dup.code==='23505', dup.ok?'중복 생성됨':dup.code)

  // ══ 회원: 미션 · 적립 ══
  console.log('\n■ 회원 — 미션 · 적립')
  await svc()
  const tags=(await c.query(`SELECT * FROM public.journey_content_tags`)).rows
  const plan=(await c.query(`SELECT day_plan FROM public.journey_templates WHERE code='starter_14d'`)).rows[0].day_plan
  const contents=(await c.query(`SELECT * FROM public.immediate_action_content`)).rows

  const d1=selectDailyMissions({dayNo:1,dayPlan:plan,axisPriority:prio,contentTags:tags,availableMinutes:15})
  ok('Day 1 미션 배정', d1.length>0, d1.map(m=>`${m.content_key}(${m.source_rule},${m.planned_duration_sec}s)`).join(' '))

  await auth(uid)
  const mIns=await T(()=>c.query(`INSERT INTO public.user_missions
    (user_journey_id,user_id,day_no,slot_no,content_key,mission_type,planned_duration_sec,difficulty,source_rule,status)
    VALUES ($1,$2,1,1,$3,$4,$5,$6,$7,'scheduled') RETURNING id`,
    [jid,uid,d1[0].content_key,d1[0].mission_type,d1[0].planned_duration_sec,d1[0].difficulty,d1[0].source_rule]))
  ok('미션 저장', mIns.ok, mIns.ok?'':mIns.code)
  const mid=mIns.ok?mIns.r.rows[0].id:null

  const early=await T(()=>c.query(`SELECT * FROM public.claim_mission_reward($1)`,[mid]))
  ok('완료 전에는 적립 불가', !early.ok, early.ok?'적립됨':early.code)

  await T(()=>c.query(`UPDATE public.user_missions SET status='started',started_at=now() WHERE id=$1`,[mid]))
  await T(()=>c.query(`UPDATE public.user_missions SET status='completed',completed_at=now() WHERE id=$1`,[mid]))
  const claim=await T(()=>c.query(`SELECT * FROM public.claim_mission_reward($1)`,[mid]))
  const amt=claim.ok?claim.r.rows[0].amount:0
  ok('미션 완료 적립 (1~7원)', claim.ok&&amt>=1&&amt<=7, claim.ok?`+${amt}원 잔액 ${claim.r.rows[0].balance}`:claim.code)
  const again=await T(()=>c.query(`SELECT * FROM public.claim_mission_reward($1)`,[mid]))
  ok('중복 적립 차단', again.ok&&again.r.rows[0].already_claimed===true&&again.r.rows[0].amount===amt,
     again.ok?`재요청 ${again.r.rows[0].amount}원 (already=${again.r.rows[0].already_claimed})`:again.code)

  const fb=await T(()=>c.query(`INSERT INTO public.journey_mission_feedback
    (user_mission_id,user_id,feeling,difficulty) VALUES ($1,$2,'UNCOMFORTABLE','HARD')`,[mid,uid]))
  ok('피드백 저장', fb.ok, fb.ok?'UNCOMFORTABLE / HARD':fb.code)

  const feedback=[{content_key:d1[0].content_key,feeling:'UNCOMFORTABLE',difficulty:'HARD',created_at:new Date().toISOString()}]
  const d3=selectDailyMissions({dayNo:3,dayPlan:plan,axisPriority:prio,contentTags:tags,feedback,availableMinutes:15})
  const d3n=selectDailyMissions({dayNo:3,dayPlan:plan,axisPriority:prio,contentTags:tags,availableMinutes:15})
  ok('피드백이 다음 미션에 반영', d3[0].content_key!==d1[0].content_key||d3[0].planned_duration_sec<d3n[0].planned_duration_sec,
     `${d1[0].content_key} → ${d3[0].content_key}, ${d3n[0].planned_duration_sec}s → ${d3[0].planned_duration_sec}s`)

  // ══ 회원: 리포트 · 완주 ══
  console.log('\n■ 회원 — 리포트 · 완주')
  const rng=reportRangeFor('weekly',7)
  const payload=buildReportPayload([{day_no:1,content_key:d1[0].content_key,status:'completed'}],
    [{content_key:d1[0].content_key,feeling:'UNCOMFORTABLE',difficulty:'HARD',created_at:''}],tags,rng.fromDay,rng.toDay)
  const rep=await T(()=>c.query(`INSERT INTO public.journey_reports
    (user_journey_id,user_id,report_type,day_no,payload) VALUES ($1,$2,'weekly',7,$3::jsonb) RETURNING id`,
    [jid,uid,JSON.stringify(payload)]))
  ok('주간 리포트 저장', rep.ok, rep.ok?`완료율 ${payload.completion.rate}%`:rep.code)
  const repDup=await T(()=>c.query(`INSERT INTO public.journey_reports
    (user_journey_id,user_id,report_type,day_no,payload) VALUES ($1,$2,'weekly',7,'{}'::jsonb)`,[jid,uid]))
  ok('리포트 중복 생성 차단', !repDup.ok&&repDup.code==='23505', repDup.ok?'중복됨':repDup.code)

  const earlyBonus=await T(()=>c.query(`SELECT * FROM public.claim_journey_reward($1)`,[jid]))
  ok('완주 전에는 보너스 불가', !earlyBonus.ok, earlyBonus.ok?'지급됨':earlyBonus.code)
  await T(()=>c.query(`UPDATE public.user_journeys SET status='completed',completed_at=now() WHERE id=$1`,[jid]))
  const bonus=await T(()=>c.query(`SELECT * FROM public.claim_journey_reward($1)`,[jid]))
  ok('14일 완주 50원', bonus.ok&&bonus.r.rows[0].amount===50, bonus.ok?`+50원 잔액 ${bonus.r.rows[0].balance}`:bonus.code)

  const nextRec=recommendNextJourney(payload)
  ok('다음 저니 추천 생성', Boolean(nextRec.title), `${nextRec.kind} — ${nextRec.title}`)

  // ══ 회원: 주문 · 차감 ══
  console.log('\n■ 회원 — 주문 · 적립금 차감')
  await svc()
  await c.query(`INSERT INTO public.user_rewards (user_id,entry_type,amount,issue_type,source_type,source_id,memo)
    VALUES ($1,'earn_subscription',20000,'paid','subscription',gen_random_uuid(),'E2E 테스트 충전')`,[uid])
  const prod=(await c.query(`SELECT id,name,price FROM public.products WHERE status='ACTIVE' ORDER BY price LIMIT 1`)).rows[0]
  await auth(uid)
  const items=JSON.stringify([{product_id:prod.id,quantity:1}])
  const balBefore=(await c.query(`SELECT sum(amount)::int b FROM public.user_rewards WHERE user_id=$1`,[uid])).rows[0].b
  const order=await T(()=>c.query(`SELECT * FROM public.create_order($1::jsonb,$2)`,[items,3000]))
  ok('주문 생성 + 3000원 차감', order.ok&&order.r.rows[0].reward_used===3000,
     order.ok?`${prod.name} ${prod.price}원 → 결제 ${order.r.rows[0].total}원`:order.code)
  ok('잔액 감소 정확', order.ok&&order.r.rows[0].balance===balBefore-3000,
     order.ok?`${balBefore} → ${order.r.rows[0].balance}`:'')
  const oid=order.ok?order.r.rows[0].order_id:null
  const cancel=await T(()=>c.query(`SELECT * FROM public.cancel_order($1)`,[oid]))
  ok('취소 시 환불', cancel.ok&&cancel.r.rows[0].refunded===3000&&cancel.r.rows[0].balance===balBefore,
     cancel.ok?`+${cancel.r.rows[0].refunded}원 → ${cancel.r.rows[0].balance}`:cancel.code)
  const over=await T(()=>c.query(`SELECT * FROM public.create_order($1::jsonb,$2)`,[items,999999]))
  ok('잔액 초과 요청 잘림', over.ok&&over.r.rows[0].reward_used<=Number(prod.price), over.ok?`${over.r.rows[0].reward_used}원`:over.code)
  if(over.ok) await T(()=>c.query(`SELECT * FROM public.cancel_order($1)`,[over.r.rows[0].order_id]))

  // ══ 구독 배수 ══
  console.log('\n■ 회원 — 구독 등급 배수')
  await svc()
  const m0=(await c.query(`SELECT public.reward_multiplier_for($1) m`,[uid])).rows[0].m
  ok('구독 없으면 1.0배', Number(m0)===1, `${m0}`)
  await c.query(`INSERT INTO public.user_subscriptions (user_id,plan_code,status,current_period_end)
    VALUES ($1,'pro_monthly','active',now()+interval '30 days')`,[uid])
  const m1=(await c.query(`SELECT public.reward_multiplier_for($1) m`,[uid])).rows[0].m
  ok('Pro 구독 2.0배', Number(m1)===2, `${m1}`)
  const m2=(await c.query(`INSERT INTO public.user_missions
    (user_journey_id,user_id,day_no,slot_no,content_key,mission_type,planned_duration_sec,difficulty,status)
    VALUES ($1,$2,2,1,'axis_2R','combo',180,2,'completed') RETURNING id`,[jid,uid])).rows[0].id
  await auth(uid)
  const boosted=await T(()=>c.query(`SELECT * FROM public.claim_mission_reward($1)`,[m2]))
  ok('배수가 적립에 적용', boosted.ok&&Number(boosted.r.rows[0].multiplier)===2,
     boosted.ok?`+${boosted.r.rows[0].amount}원 (배수 ${boosted.r.rows[0].multiplier})`:boosted.code)

  // ══ 15분 루틴 ══
  console.log('\n■ 15분 루틴 (실제 DB 콘텐츠)')
  await svc()
  const maps=(await c.query(`SELECT * FROM public.immediate_action_axis_mapping`)).rows
  const routine=buildCareRoutine(axisRows,maps,contents,prio.map(p=>p.axis))
  ok('4축 전부 포함', routine.coversAllAxes, routine.steps.filter(s=>s.kind==='axis').map(s=>s.axis).join(' → '))
  ok('총 15분', routine.totalSec===900, `${routine.totalSec}초`)
  ok('상→하 순서', routine.steps.filter(s=>s.kind==='axis').every((s,i)=>s.axisNo===i+1))
  const st=buildMissionSteps(contents.find(x=>x.content_key===d1[0].content_key),d1[0])
  ok('미션 단계 = 배정 시간', st.reduce((a,s)=>a+s.seconds,0)===d1[0].planned_duration_sec,
     `${st.length}단계 ${st.reduce((a,s)=>a+s.seconds,0)}초`)

  // ══ 원장 정합성 ══
  console.log('\n■ 원장 정합성')
  await svc()
  const led=(await c.query(`SELECT entry_type,amount,issue_type FROM public.user_rewards WHERE user_id=$1 ORDER BY created_at`,[uid])).rows
  led.forEach(r=>console.log(`     ${r.entry_type.padEnd(18)} ${String(r.amount).padStart(7)}원  ${r.issue_type}`))
  const sum=led.reduce((a,r)=>a+r.amount,0)
  const fn=(await c.query(`SELECT public.reward_balance($1) b`,[uid])).rows[0].b
  ok('잔액 = 원장 합계', sum===fn, `${sum} = ${fn}`)
  ok('잔액 음수 아님', fn>=0, `${fn}원`)

  await auth(other)
  const spy=await T(()=>c.query(`SELECT count(*)::int n FROM public.user_rewards`))
  ok('다른 회원은 내 적립금 못 봄', spy.ok&&spy.r.rows[0].n===0, spy.ok?`${spy.r.rows[0].n}건`:spy.code)
  const spyJ=await T(()=>c.query(`SELECT count(*)::int n FROM public.user_journeys`))
  ok('다른 회원은 내 저니 못 봄', spyJ.ok&&spyJ.r.rows[0].n===0, spyJ.ok?`${spyJ.r.rows[0].n}건`:spyJ.code)
  await svc()
}finally{ await c.query('ROLLBACK'); console.log('\nROLLBACK — 데이터 남지 않음'); await c.end() }
const f=res.filter(x=>!x.p)
console.log('\n'+'='.repeat(62))
console.log(f.length===0?`OK — ${res.length}개 검증 모두 통과`:`FAIL — ${f.length}개 실패 / ${res.length-f.length}개 통과`)
f.forEach(x=>console.log(`  - ${x.l}`))
process.exit(f.length?1:0)
