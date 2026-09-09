-- A9 등 선택지별 가이드 이미지
-- media_url = 상단 메인, media_url_option_N = 해당 선택지 가이드

alter table public.questions
  add column if not exists media_url_option_1 text,
  add column if not exists media_url_option_2 text,
  add column if not exists media_url_option_3 text;

comment on column public.questions.media_url_option_1 is 'Guide media after selecting option ①';
comment on column public.questions.media_url_option_2 is 'Guide media after selecting option ②';
comment on column public.questions.media_url_option_3 is 'Guide media after selecting option ③';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/A9.webp',
  media_url_option_1 = 'questions/A9-opt1.webp',
  media_url_option_2 = null,
  media_url_option_3 = 'questions/A9-opt3.webp',
  updated_at = now()
where question_code = 'A9'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/B1.webp',
  media_url_option_1 = 'questions/B1-opt1.webp',
  media_url_option_2 = null,
  media_url_option_3 = 'questions/B1-opt3.webp',
  updated_at = now()
where question_code = 'B1'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/B2.webp',
  media_url_option_1 = 'questions/B2-opt1.webp', -- image1.png
  media_url_option_2 = null,
  media_url_option_3 = 'questions/B2-opt3.webp', -- image2.png
  updated_at = now()
where question_code = 'B2'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/B3.webp',
  media_url_option_1 = 'questions/B3-opt1.webp', -- image1.png
  media_url_option_2 = null,
  media_url_option_3 = 'questions/B3-opt3.webp', -- image2.png
  updated_at = now()
where question_code = 'B3'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/B4.webp',
  media_url_option_1 = 'questions/B4-opt1.webp', -- image3.png
  media_url_option_2 = null,
  media_url_option_3 = 'questions/B4-opt3.webp', -- image2.png
  updated_at = now()
where question_code = 'B4'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/B5.webp',
  media_url_option_1 = 'questions/B5-opt1.webp', -- image2.png
  media_url_option_2 = 'questions/B5-opt2.webp', -- image3.png
  media_url_option_3 = 'questions/B5-opt3.webp', -- image1.png
  updated_at = now()
where question_code = 'B5'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/B6.webp',
  media_url_option_1 = 'questions/B6-opt1.webp', -- image1.png
  media_url_option_2 = null,
  media_url_option_3 = 'questions/B6-opt3.webp', -- image2.png
  updated_at = now()
where question_code = 'B6'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/C1.webp',
  media_url_option_1 = 'questions/C1-opt1.webp', -- image3.png
  media_url_option_2 = 'questions/C1-opt2.webp', -- image5.png
  media_url_option_3 = 'questions/C1-opt3.webp', -- image4.png
  updated_at = now()
where question_code = 'C1'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/C2.webp',
  media_url_option_1 = 'questions/C2-opt1.webp', -- img5.png
  media_url_option_2 = 'questions/C2-opt2.webp', -- image6.png
  media_url_option_3 = null,
  updated_at = now()
where question_code = 'C2'
  and question_set = 'mebody_v1_32';

-- C3: 메인만 (선택 후에도 상단 유지 — option media 없음)
update public.questions
set
  media_type = 'image',
  media_url = 'questions/C3.webp',
  media_url_option_1 = null,
  media_url_option_2 = null,
  media_url_option_3 = null,
  updated_at = now()
where question_code = 'C3'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/C4.webp',
  media_url_option_1 = 'questions/C4-opt1.webp', -- image3.png
  media_url_option_2 = 'questions/C4-opt2.webp', -- image4.png
  media_url_option_3 = 'questions/C4-opt3.webp', -- image5.png
  updated_at = now()
where question_code = 'C4'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/C5.webp',
  media_url_option_1 = 'questions/C5-opt1.webp', -- image3.png
  media_url_option_2 = 'questions/C5-opt2.webp', -- image4.png
  media_url_option_3 = 'questions/C5-opt3.webp', -- image5.png
  updated_at = now()
where question_code = 'C5'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/C6.webp',
  media_url_option_1 = 'questions/C6-opt1.webp', -- image1.png
  media_url_option_2 = null,
  media_url_option_3 = 'questions/C6-opt2.webp', -- image2.png
  updated_at = now()
where question_code = 'C6'
  and question_set = 'mebody_v1_32';

-- C7: 메인만 (선택/가이드 시에도 상단 유지 — option media 없음, A8/C3와 동일)
update public.questions
set
  media_type = 'image',
  media_url = 'questions/C7.webp',
  media_url_option_1 = null,
  media_url_option_2 = null,
  media_url_option_3 = null,
  updated_at = now()
where question_code = 'C7'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/C8.webp',
  media_url_option_1 = 'questions/C8-opt1.webp', -- image2.png
  media_url_option_2 = null,
  media_url_option_3 = 'questions/C8-opt3.webp', -- image1.png
  updated_at = now()
where question_code = 'C8'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/C9.webp',
  media_url_option_1 = 'questions/C9-opt1.webp', -- image1.png
  media_url_option_2 = null,
  media_url_option_3 = 'questions/C9-opt3.webp', -- image2.png
  updated_at = now()
where question_code = 'C9'
  and question_set = 'mebody_v1_32';

-- D1: 메인만 (선택/가이드 시에도 상단 유지 — option media 없음, A8/C3/C7와 동일)
update public.questions
set
  media_type = 'image',
  media_url = 'questions/D1.webp',
  media_url_option_1 = null,
  media_url_option_2 = null,
  media_url_option_3 = null,
  updated_at = now()
where question_code = 'D1'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/D2.webp',
  media_url_option_1 = 'questions/D2-opt1.webp', -- image1.png
  media_url_option_2 = 'questions/D2-opt2.webp', -- image2.png
  media_url_option_3 = 'questions/D2-opt3.webp', -- image3.png
  updated_at = now()
where question_code = 'D2'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/D3.webp',
  media_url_option_1 = 'questions/D3-opt1.webp', -- image1.png
  media_url_option_2 = 'questions/D3-opt2.webp', -- image2.png
  media_url_option_3 = 'questions/D3-opt3.webp', -- image3.png
  updated_at = now()
where question_code = 'D3'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/D4.webp',
  media_url_option_1 = 'questions/D4-opt1.webp', -- guide image1 (sitting, right stiff)
  media_url_option_2 = 'questions/D4-opt2.webp', -- guide image2 (similar/unsure)
  media_url_option_3 = 'questions/D4-opt3.webp', -- guide image3 (sitting, left stiff)
  updated_at = now()
where question_code = 'D4'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/D5.webp', -- MEBODY_knee_to_chest_3stage
  media_url_option_1 = 'questions/D5-opt1.webp', -- image1.png
  media_url_option_2 = 'questions/D5-opt2.webp', -- image2.png
  media_url_option_3 = 'questions/D5-opt3.webp', -- image3.png
  updated_at = now()
where question_code = 'D5'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/D6.webp',
  media_url_option_1 = 'questions/D6-opt1.webp', -- image1.png
  media_url_option_2 = null,
  media_url_option_3 = 'questions/D6-opt3.webp', -- image3.png
  updated_at = now()
where question_code = 'D6'
  and question_set = 'mebody_v1_32';

update public.questions
set
  media_type = 'image',
  media_url = 'questions/D7.webp', -- image0.png
  media_url_option_1 = 'questions/D7-opt1.webp', -- image1.png
  media_url_option_2 = 'questions/D7-opt2.webp', -- image2.png
  media_url_option_3 = 'questions/D7-opt3.webp', -- image3.png
  updated_at = now()
where question_code = 'D7'
  and question_set = 'mebody_v1_32';
