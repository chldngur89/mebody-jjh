-- 개발자용 에러 기록.
--
-- 왜 만들었나: questions.media_url 이 통째로 비워져 문항 사진이 사라진 일이 두 번
-- 있었는데, 앱은 조용히 빈 칸을 보여주고 아무 데도 남기지 않았습니다. 사용자가
-- 말해주기 전까지 알 수 없었습니다.
--
-- 쓰기: 익명 방문자도 오류를 만나므로 anon 에게 INSERT 를 허용합니다.
-- 읽기: 관리자만. (user_profiles.role = 'ADMIN')

create table if not exists public.app_error_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null,
  detail jsonb not null default '{}'::jsonb,
  path text,
  user_agent text,
  app_version text
);

comment on table public.app_error_log is
  '앱에서 올라온 개발자용 오류 기록. 개인 식별 값은 넣지 않습니다(lib/reportError.ts 참고).';

create index if not exists app_error_log_created_at_idx
  on public.app_error_log (created_at desc);
create index if not exists app_error_log_code_idx
  on public.app_error_log (code, created_at desc);

alter table public.app_error_log enable row level security;

-- INSERT: 누구나. 단 아래 트리거가 분량을 제한합니다.
drop policy if exists app_error_log_insert_any on public.app_error_log;
create policy app_error_log_insert_any
  on public.app_error_log for insert
  to anon, authenticated
  with check (true);

-- SELECT: 관리자만.
drop policy if exists app_error_log_select_admin on public.app_error_log;
create policy app_error_log_select_admin
  on public.app_error_log for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and upper(coalesce(p.role, '')) = 'ADMIN'
    )
  );

-- 익명 INSERT 를 열어 두면 쓰레기로 채워질 수 있습니다.
-- 같은 code 가 1분에 20건을 넘으면 더 받지 않습니다(오류는 대표 몇 건만 있으면 충분).
create or replace function public.app_error_log_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent integer;
begin
  select count(*) into recent
  from public.app_error_log
  where code = new.code
    and created_at > now() - interval '1 minute';

  if recent >= 20 then
    return null;  -- 조용히 버립니다(앱에 오류를 되돌려 주지 않습니다)
  end if;

  -- 오래된 기록 정리: 30일 넘은 것은 남겨둘 이유가 없습니다.
  delete from public.app_error_log where created_at < now() - interval '30 days';

  return new;
end;
$$;

drop trigger if exists app_error_log_rate_limit_trg on public.app_error_log;
create trigger app_error_log_rate_limit_trg
  before insert on public.app_error_log
  for each row execute function public.app_error_log_rate_limit();
