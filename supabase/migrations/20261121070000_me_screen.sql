-- Real Talk Yaad: the Me screen.
--   * profiles.show_on_leaderboard: people can hide from the weekly leaderboard (Me > Edit profile).
--   * me_summary(): lifetime stats, work by task, and how often your votes matched other speakers.
--   * leaderboard(): top 10 this week (Monday to Sunday, Jamaica time) by approved work,
--     in your parish if you set one, otherwise all of Jamaica. Shows first names only.

alter table public.profiles
  add column if not exists show_on_leaderboard boolean not null default true;

-- The parish list the app offers (kept here too so the database rejects anything else).
update public.profiles set parish = null where parish not in (
  'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 'St. Mary', 'St. Ann', 'Trelawny',
  'St. James', 'Hanover', 'Westmoreland', 'St. Elizabeth', 'Manchester', 'Clarendon', 'St. Catherine'
);
alter table public.profiles drop constraint if exists profiles_parish_check;
alter table public.profiles add constraint profiles_parish_check check (
  parish is null or parish in (
    'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 'St. Mary', 'St. Ann', 'Trelawny',
    'St. James', 'Hanover', 'Westmoreland', 'St. Elizabeth', 'Manchester', 'Clarendon', 'St. Catherine'
  )
);

create or replace function public.me_summary()
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select e.* from public.earnings e where e.user_id = (select auth.uid())
  )
  select json_build_object(
    'tasks_done',     count(*),
    'approved_count', count(*) filter (where status = 'approved'),
    'reviewed_count', count(*) filter (where status in ('approved', 'rejected')),
    'earned_total',   coalesce(sum(amount_jmd) filter (where status = 'approved'), 0),
    'pending_total',  coalesce(sum(amount_jmd) filter (where status = 'pending'), 0),
    'votes_matched',  count(*) filter (where task = 'verify' and status = 'approved'),
    'votes_settled',  count(*) filter (where task = 'verify' and status in ('approved', 'rejected')),
    'by_task', coalesce((
      select json_object_agg(task, json_build_object(
        'count', n, 'approved', a, 'earned', earned))
      from (
        select task, count(*) as n, count(*) filter (where status = 'approved') as a,
               coalesce(sum(amount_jmd) filter (where status = 'approved'), 0) as earned
        from mine group by task
      ) t), '{}'::json)
  )
  from mine;
$$;

grant execute on function public.me_summary() to authenticated;

-- Reads across users, so it runs as the owner, but returns only first names and counts.
create or replace function public.leaderboard()
returns table (rank integer, name text, approved integer, is_me boolean, scope text)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.parish from public.profiles p where p.id = (select auth.uid())
  ),
  week_start as (
    select (date_trunc('week', now() at time zone 'America/Jamaica') at time zone 'America/Jamaica') as t
  ),
  work as (
    select c.user_id from public.corrections c, week_start w where c.status = 'approved' and c.created_at >= w.t
    union all
    select r.user_id from public.recordings r, week_start w where r.status = 'approved' and r.created_at >= w.t
    union all
    select v.user_id from public.verifications v, week_start w where v.status = 'approved' and v.created_at >= w.t
  ),
  counts as (
    select p.id, split_part(coalesce(nullif(btrim(p.display_name), ''), 'Speaker'), ' ', 1) as name,
           count(*)::integer as approved
    from work
    join public.profiles p on p.id = work.user_id
    where (p.show_on_leaderboard or p.id = (select auth.uid()))
      and ((select parish from me) is null or p.parish = (select parish from me))
    group by p.id, p.display_name
  ),
  ranked as (
    select (rank() over (order by approved desc))::integer as rank, id, name, approved from counts
  )
  select r.rank, r.name, r.approved, r.id = (select auth.uid()) as is_me,
         coalesce((select parish from me), 'Jamaica') as scope
  from ranked r
  where r.rank <= 10 or r.id = (select auth.uid())
  order by r.rank, r.name;
$$;

revoke execute on function public.leaderboard() from public, anon;
grant execute on function public.leaderboard() to authenticated;
