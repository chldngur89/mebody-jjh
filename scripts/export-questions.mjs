/**
 * 활성 32문항을 촬영용 목록(HTML)으로 뽑습니다.
 *
 * DB(public.questions, question_set='mebody_v1_32', is_active)에서 그대로 읽으므로
 * 문항을 고치면 다시 돌리기만 하면 됩니다.
 *
 * 사용: npm run export:questions            → dist-docs/questions.html
 *       npm run export:questions -- --csv   → dist-docs/questions.csv 도 함께
 */
import { mkdirSync, writeFileSync } from 'node:fs'
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
  user: env.SUPABASE_DB_USERNAME, password: env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, statement_timeout: 60000 })

const AXIS_LABEL = {
  neck: '목',
  shoulder: '어깨',
  pelvis: '골반',
  flexibility: '하체 유연성',
  none: '생활·컨디션',
}

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))

await c.connect()
const { rows } = await c.query(`
  SELECT sort_order, question_code, axis, part, title, instruction, guide_text,
         question_text, option_1, option_2, option_3, media_url
    FROM public.questions
   WHERE is_active AND question_set = 'mebody_v1_32'
   ORDER BY sort_order`)
await c.end()

if (rows.length === 0) {
  console.error('활성 문항을 찾지 못했습니다.')
  process.exit(1)
}

const done = rows.filter((r) => r.media_url).length

const cards = rows.map((r) => `
  <article class="q${r.media_url ? ' has-image' : ''}">
    <header>
      <span class="no">${r.sort_order}</span>
      <span class="code">${esc(r.question_code)}</span>
      <span class="axis axis-${esc(r.axis)}">${esc(AXIS_LABEL[r.axis] ?? r.axis)}</span>
      ${r.media_url ? '<span class="badge done">사진 있음</span>' : '<span class="badge todo">사진 필요</span>'}
    </header>
    ${r.part || r.title ? `<div class="meta">${esc([r.part ? `${r.part}파트` : null, r.title].filter(Boolean).join(' · '))}</div>` : ''}
    <p class="text">${esc(r.question_text)}</p>
    ${r.instruction ? `<p class="hint">${esc(r.instruction)}</p>` : ''}
    <ol class="options">
      <li>${esc(r.option_1)}</li>
      <li>${esc(r.option_2)}</li>
      <li>${esc(r.option_3)}</li>
    </ol>
    <div class="file">
      <label><input type="checkbox" ${r.media_url ? 'checked' : ''} /> 촬영 완료</label>
      <code>questions/${esc(r.question_code)}.png</code>
    </div>
  </article>`).join('')

const html = `<title>MEBODY 32문항 촬영 목록</title>
<style>
  :root {
    --green: #004628; --card: #fffef8; --bg: #f4f6f2; --muted: #6b7a70; --line: #e2e8e3;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: #14201a;
         font: 14px/1.6 -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
  .wrap { max-width: 900px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 30px; letter-spacing: -1px; color: var(--green); margin: 0 0 6px; }
  .sub { color: var(--muted); margin: 0 0 22px; }
  .spec { background: var(--card); border: 1px solid var(--line); border-radius: 18px;
          padding: 16px 18px; margin-bottom: 26px; }
  .spec h2 { font-size: 13px; letter-spacing: .1em; color: var(--green); margin: 0 0 10px; }
  .spec ul { margin: 0; padding-left: 18px; color: #3b4a41; }
  .spec code { background: #eef2ec; border-radius: 5px; padding: 1px 5px; font-size: 12.5px; }
  .count { display: inline-block; background: var(--green); color: #fff; border-radius: 999px;
           padding: 3px 11px; font-size: 12px; font-weight: 800; }
  .grid { display: grid; gap: 12px; }
  .q { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 16px 18px; }
  .q.has-image { border-color: #b9d7c6; }
  .q header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .no { width: 26px; height: 26px; border-radius: 999px; background: var(--green); color: #fff;
        display: grid; place-items: center; font-size: 12px; font-weight: 800; }
  .code { font-weight: 900; letter-spacing: .04em; }
  .axis { font-size: 11px; font-weight: 800; border-radius: 999px; padding: 3px 9px;
          background: #eef2ec; color: #3f5a4a; }
  .axis-neck { background: #e8f1fb; color: #2c5680; }
  .axis-shoulder { background: #f3ecfb; color: #5b3f80; }
  .axis-pelvis { background: #fdf0e8; color: #8a4f27; }
  .axis-flexibility { background: #e9f6ec; color: #2f6b3e; }
  .badge { margin-left: auto; font-size: 11px; font-weight: 900; border-radius: 999px; padding: 3px 9px; }
  .badge.todo { background: #fff4e5; color: #8a5a10; }
  .badge.done { background: #e6f4ea; color: #1e6b3a; }
  .meta { font-size: 11.5px; color: var(--muted); font-weight: 700; margin-bottom: 6px; }
  .text { font-size: 15.5px; font-weight: 700; margin: 0 0 8px; word-break: keep-all; }
  .hint { font-size: 12.5px; color: var(--muted); margin: 0 0 8px; word-break: keep-all; }
  .options { margin: 0 0 12px; padding-left: 20px; color: #3b4a41; }
  .options li { margin: 2px 0; word-break: keep-all; }
  .file { display: flex; align-items: center; justify-content: space-between; gap: 10px;
          border-top: 1px solid var(--line); padding-top: 10px; }
  .file label { font-size: 12.5px; font-weight: 800; color: var(--muted); cursor: pointer; }
  .file code { font-size: 12px; background: #eef2ec; border-radius: 6px; padding: 3px 8px; }
  @media print {
    body { background: #fff; }
    .q { break-inside: avoid; border-color: #ccc; }
  }
</style>
<div class="wrap">
  <h1>MEBODY 32문항 촬영 목록</h1>
  <p class="sub">
    <span class="count">사진 ${done} / ${rows.length}</span>
    &nbsp; <code>public.questions</code> · <code>question_set='mebody_v1_32'</code> · <code>is_active</code> 에서 뽑았습니다.
  </p>

  <section class="spec">
    <h2>사진 규격</h2>
    <ul>
      <li><b>1:1 정사각형</b> — 화면에서 최대 320px 폭, 최소 280px 높이로 그려집니다</li>
      <li>권장 <b>640 × 640</b> (2배수), PNG 또는 WEBP</li>
      <li><code>object-contain</code> 이라 <b>잘리지 않습니다.</b> 여백이 생겨도 괜찮습니다</li>
      <li>파일명은 <code>questions/&lt;문항코드&gt;.png</code> — Storage <code>images</code> 버킷에 올립니다</li>
      <li>사진이 없는 문항은 부드러운 자리표시자가 뜹니다. <b>일부만 채워도 화면은 안 깨집니다</b></li>
    </ul>
  </section>

  <div class="grid">${cards}</div>
</div>
`

mkdirSync(new URL('../dist-docs/', import.meta.url).pathname, { recursive: true })
const htmlPath = new URL('../dist-docs/questions.html', import.meta.url).pathname
writeFileSync(htmlPath, html, 'utf8')
console.log(`HTML  → ${htmlPath}`)

if (process.argv.includes('--csv')) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = ['번호,코드,축,파트,제목,문항,선택1,선택2,선택3,파일명,사진있음']
    .concat(rows.map((r) => [
      r.sort_order, r.question_code, AXIS_LABEL[r.axis] ?? r.axis, r.part, r.title,
      r.question_text, r.option_1, r.option_2, r.option_3,
      `questions/${r.question_code}.png`, r.media_url ? 'Y' : '',
    ].map(cell).join(',')))
    .join('\n')
  const csvPath = new URL('../dist-docs/questions.csv', import.meta.url).pathname
  writeFileSync(csvPath, '﻿' + csv, 'utf8')
  console.log(`CSV   → ${csvPath}`)
}

console.log(`\n활성 문항 ${rows.length}개 · 사진 있음 ${done}개 · 필요 ${rows.length - done}개`)
