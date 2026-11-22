-- Real Talk Yaad: a fuller leaderboard.
--   leaderboard(scope, period, lim)
--     scope:  'parish' (your parish; everyone if you haven't set one) or 'all' (all of Jamaica)
--     period: 'week' (Monday to now, Jamaica time) or 'all' (all time)
--     lim:    how many from the top (max 100). You, and the 2 people either side of you, always come back too.
--   Counts approved work. Shows first names only, plus the frame and badge people wear from the Store.
--   People who switched off "Show me on the leaderboard" are left out (except to themselves).

drop function if exists public.leaderboard();

create or replace function public.leaderboard(scope text default 'parish', period text default 'week', lim integer default 10)
returns table (rank integer, name text, approved integer, is_me boolean, scope_label text, frame jsonb, badge jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.parish from public.profiles p where p.id = (select auth.uid())
  ),
  since as (
    select case when period = 'all' then '-infinity'::timestamptz
                else (date_trunc('week', now() at time zone 'America/Jamaica') at time zone 'America/Jamaica') end as t
  ),
  work as (
    select c.user_id from public.corrections c, since s where c.status = 'approved' and c.created_at >= s.t
    union all
    select r.user_id from public.recordings r, since s where r.status = 'approved' and r.created_at >= s.t
    union all
    select v.user_id from public.verifications v, since s where v.status = 'approved' and v.created_at >= s.t
    union all
    select d.user_id from public.descriptions d, since s where d.status = 'approved' and d.created_at >= s.t
  ),
  counts as (
    select p.id, split_part(coalesce(nullif(btrim(p.display_name), ''), 'Speaker'), ' ', 1) as name,
           count(*)::integer as approved, p.equipped_frame, p.equipped_badge
    from work
    join public.profiles p on p.id = work.user_id
    where (p.show_on_leaderboard or p.id = (select auth.uid()))
      and (scope = 'all' or (select parish from me) is null or p.parish = (select parish from me))
    group by p.id, p.display_name, p.equipped_frame, p.equipped_badge
  ),
  ranked as (
    select (rank() over (order by approved desc))::integer as rank, * from counts
  ),
  mine as (select rank from ranked where id = (select auth.uid()))
  select r.rank, r.name, r.approved, r.id = (select auth.uid()),
         case when scope = 'all' or (select parish from me) is null then 'Jamaica' else (select parish from me) end,
         f.payload, b.payload
  from ranked r
  left join public.store_items f on f.id = r.equipped_frame
  left join public.store_items b on b.id = r.equipped_badge
  where (select auth.uid()) is not null
    and (r.rank <= least(greatest(lim, 1), 100)
         or r.id = (select auth.uid())
         or abs(r.rank - coalesce((select rank from mine), -100)) <= 2)
  order by r.rank, r.name;
$$;

revoke execute on function public.leaderboard(text, text, integer) from public, anon;
grant execute on function public.leaderboard(text, text, integer) to authenticated;
