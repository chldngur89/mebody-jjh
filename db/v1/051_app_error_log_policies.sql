-- app_error_log 정책 보정.
--
-- 050_app_error_log.sql 을 돌린 뒤 점검해 보니 **테이블과 컬럼은 만들어졌는데
-- INSERT 정책이 빠져 있었습니다.** 그래서 앱의 reportError() 가
--   "new row violates row-level security policy for table app_error_log"
-- 로 조용히 실패하고, 오류가 한 건도 쌓이지 않았습니다.
--
-- 이 파일은 정책만 다시 적용합니다. 여러 번 돌려도 안전합니다.
--
-- 확인 방법(적용 후):
--   anon 키로 INSERT 가 성공해야 하고, anon 키로 SELECT 는 빈 배열이어야 합니다.

alter table public.app_error_log enable row level security;

-- INSERT: 누구나. 익명 방문자도 오류를 만나므로 열어 둡니다.
-- (아래 rate limit 트리거가 분량을 제한합니다)
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
-- 같은 code 가 1분에 20건을 넘으면 더 받지 않고, 30일 지난 기록은 지웁니다.
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

  delete from public.app_error_log where created_at < now() - interval '30 days';

  return new;
end;
$$;

drop trigger if exists app_error_log_rate_limit_trg on public.app_error_log;
create trigger app_error_log_rate_limit_trg
  before insert on public.app_error_log
  for each row execute function public.app_error_log_rate_limit();
