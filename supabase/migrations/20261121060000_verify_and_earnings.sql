-- Real Talk Yaad: Verify (people check each other's work) + live earnings for the home screen.
--
-- How verifying works
--   * Users vote yes/no on other people's pending work: chat corrections, transcript fixes and recorded lines.
--   * When one answer gets enough votes (app_settings > votes_to_decide, default 2), the item is decided:
--       - the work is approved (paid to its author) or rejected;
--       - each vote that matches the decision is approved (verifier gets paid), the others are rejected.
--     To change it: Table Editor > app_settings > votes_to_decide. Testing alone? Set it to 1.
--   * PAY per vote: Table Editor > task_rates, row "verify" (J$6). New votes use the new value.
--
-- Money
--   * earnings: one row per paid task (corrections, recordings, votes), with its status.
--   * home_summary(): balance (approved), pending, today, this week, streak days, work done today.
--     Cash-outs and store purchases are not built yet, so balance = everything approved.

-- ---------------------------------------------------------------------------
-- Settings you can change in the Table Editor without touching code
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  note text
);
alter table public.app_settings enable row level security; -- no policies: only the database and functions read it

insert into public.app_settings (key, value, note) values
  ('votes_to_decide', '2', 'Matching votes needed to approve or reject work. Use 1 only when testing alone.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Votes
-- ---------------------------------------------------------------------------
create table public.verifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_kind text not null check (item_kind in ('correction', 'recording')),
  item_id bigint not null,
  verdict text not null check (verdict in ('yes', 'no')),
  amount_jmd numeric(10, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, item_kind, item_id)
);

create index verifications_item_idx on public.verifications (item_kind, item_id);
create index verifications_user_idx on public.verifications (user_id, created_at desc);

alter table public.verifications enable row level security;

-- Users see their own votes. Votes are written only by the chat Edge Function (service role).
create policy "Users can read their own votes"
  on public.verifications for select to authenticated
  using (user_id = (select auth.uid()));

create index if not exists corrections_pending_idx on public.corrections (status, created_at) where status = 'pending';
create index if not exists recordings_pending_idx on public.recordings (status, created_at) where status = 'pending';

-- Decide an item once enough people agree, then settle every vote on it.
create or replace function public.settle_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  yes_votes integer;
  no_votes integer;
  decision text;
  current_status text;
  needed integer;
begin
  select greatest(1, coalesce(value::integer, 2)) into needed from public.app_settings where key = 'votes_to_decide';
  needed := coalesce(needed, 2);

  if new.item_kind = 'correction' then
    select status into current_status from public.corrections where id = new.item_id;
  else
    select status into current_status from public.recordings where id = new.item_id;
  end if;

  if current_status in ('approved', 'rejected') then
    decision := current_status; -- already decided: settle this late vote against it
  else
    select count(*) filter (where verdict = 'yes'), count(*) filter (where verdict = 'no')
      into yes_votes, no_votes
    from public.verifications
    where item_kind = new.item_kind and item_id = new.item_id;

    if yes_votes >= needed then
      decision := 'approved';
    elsif no_votes >= needed then
      decision := 'rejected';
    else
      return null;                  -- not decided yet
    end if;

    if new.item_kind = 'correction' then
      update public.corrections set status = decision where id = new.item_id and status = 'pending';
    else
      update public.recordings set status = decision where id = new.item_id and status = 'pending';
    end if;
  end if;

  update public.verifications
  set status = case when (verdict = 'yes') = (decision = 'approved') then 'approved' else 'rejected' end
  where item_kind = new.item_kind and item_id = new.item_id and status = 'pending';

  return null;
end;
$$;

create trigger settle_verification
  after insert on public.verifications
  for each row execute function public.settle_verification();

-- ---------------------------------------------------------------------------
-- Weekly goal (shown on Home)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists week_goal integer not null default 1000 check (week_goal between 100 and 1000000);

-- ---------------------------------------------------------------------------
-- Earnings: every paid task in one place. Runs with the caller's permissions (RLS applies).
-- ---------------------------------------------------------------------------
create or replace view public.earnings
with (security_invoker = true)
as
  select c.user_id,
         case when cv.mode = 'voice' then 'voice' else 'talk' end as task,
         c.id as ref_id,
         c.amount_jmd,
         c.status,
         c.created_at,
         c.corrected as detail
  from public.corrections c
  join public.conversations cv on cv.id = c.conversation_id
  union all
  select r.user_id, 'record', r.id, r.amount_jmd + r.fix_amount_jmd, r.status, r.created_at, r.spoken_text
  from public.recordings r
  union all
  select v.user_id, 'verify', v.id, v.amount_jmd, v.status, v.created_at, null
  from public.verifications v;

grant select on public.earnings to authenticated;

-- Everything the Home screen needs in one call. Days are counted in Jamaica time.
create or replace function public.home_summary()
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select e.*, (e.created_at at time zone 'America/Jamaica')::date as day
    from public.earnings e
    where e.user_id = (select auth.uid())
  ),
  today as (select (now() at time zone 'America/Jamaica')::date as d)
  select json_build_object(
    'balance',        coalesce(sum(amount_jmd) filter (where status = 'approved'), 0),
    'pending',        coalesce(sum(amount_jmd) filter (where status = 'pending'), 0),
    'today',          coalesce(sum(amount_jmd) filter (where status <> 'rejected' and day = (select d from today)), 0),
    'this_week',      coalesce(sum(amount_jmd) filter (where status <> 'rejected'
                                                         and day >= date_trunc('week', (select d from today))::date), 0),
    'approved_count', count(*) filter (where status = 'approved'),
    'reviewed_count', count(*) filter (where status in ('approved', 'rejected')),
    'total_count',    count(*),
    'today_by_task',  coalesce((select json_object_agg(task, n)
                                from (select task, count(*) as n from mine
                                      where day = (select d from today) group by task) t), '{}'::json),
    'active_days',    coalesce((select json_agg(day order by day desc)
                                from (select distinct day from mine
                                      where day > (select d from today) - 90) t), '[]'::json),
    'week_goal',      coalesce((select week_goal from public.profiles where id = (select auth.uid())), 1000)
  )
  from mine;
$$;

grant execute on function public.home_summary() to authenticated;

update public.task_rates set label = 'Verify work' where id = 'verify';
