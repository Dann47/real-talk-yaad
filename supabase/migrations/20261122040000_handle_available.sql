-- Real Talk Yaad: check whether a handle is free (for the "Pick a handle" prompt and Edit profile).
-- Profiles are private, so this answers only yes/no and never reveals who has a handle.
create or replace function public.handle_available(wanted text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select wanted ~ '^[a-z0-9_]{3,24}$'
     and not exists (
       select 1 from public.profiles
       where handle = wanted and id <> (select auth.uid())
     );
$$;

revoke execute on function public.handle_available(text) from public, anon;
grant execute on function public.handle_available(text) to authenticated;
