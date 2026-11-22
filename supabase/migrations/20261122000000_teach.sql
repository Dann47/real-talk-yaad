-- Real Talk Yaad: Teach. People post photos and short videos to the Feed; others describe what's
-- happening in Patois. Descriptions are paid once other speakers verify them (same Verify flow).
--
-- PAY: Table Editor > task_rates, row "teach": amount_jmd per description (J$25),
--      max_paid_per_session = paid descriptions per day (20). One paid description per post per person,
--      and never on your own post.
-- SAFETY: anyone can report a post; it is hidden from the Feed after app_settings > reports_to_hide (3) reports.
--         Hidden posts stay in the database so you can review them (posts.hidden).

insert into public.app_settings (key, value, note) values
  ('reports_to_hide', '3', 'Reports from different people before a Feed post is hidden.')
on conflict (key) do nothing;

update public.task_rates
set label = 'Teach: describe a post', unit = 'description', amount_jmd = 25, max_paid_per_session = 20
where id = 'teach';

-- ---------------------------------------------------------------------------
-- Media (photos and videos for the Feed). Private bucket; every signed-in user can view.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create policy "Users can upload their own media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Signed-in users can view media"
  on storage.objects for select to authenticated
  using (bucket_id = 'media');

create policy "Users can delete their own media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Posts, likes, reports
-- ---------------------------------------------------------------------------
create table public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  media_path text not null,
  caption text not null default '' check (char_length(caption) <= 300),
  width integer,
  height integer,
  duration_ms integer check (duration_ms is null or duration_ms <= 61000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index posts_feed_idx on public.posts (created_at desc) where not hidden;

alter table public.posts enable row level security;

create policy "Signed-in users can see visible posts and their own"
  on public.posts for select to authenticated
  using (not hidden or user_id = (select auth.uid()));
create policy "Users can create their own posts"
  on public.posts for insert to authenticated
  with check (user_id = (select auth.uid()) and (storage.foldername(media_path))[1] = (select auth.uid())::text);
create policy "Users can delete their own posts"
  on public.posts for delete to authenticated
  using (user_id = (select auth.uid()));
-- People can't edit posts or un-hide them.
revoke update on public.posts from authenticated;

create table public.post_likes (
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;
create policy "Users see their own likes" on public.post_likes for select to authenticated using (user_id = (select auth.uid()));
create policy "Users like as themselves" on public.post_likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users unlike their own likes" on public.post_likes for delete to authenticated using (user_id = (select auth.uid()));

create table public.post_reports (
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (reason in ('not_jamaican', 'offensive', 'violence', 'sexual', 'spam', 'private_info', 'other')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_reports enable row level security;
create policy "Users report as themselves" on public.post_reports for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users see their own reports" on public.post_reports for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.hide_reported_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.post_reports where post_id = new.post_id)
     >= public.setting_number('reports_to_hide', 3) then
    update public.posts set hidden = true where id = new.post_id;
  end if;
  return null;
end;
$$;

create trigger hide_reported_post after insert on public.post_reports
  for each row execute function public.hide_reported_post();

-- ---------------------------------------------------------------------------
-- Descriptions (the paid "teach" work)
-- ---------------------------------------------------------------------------
create table public.descriptions (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 10 and 500),
  amount_jmd numeric(10, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index descriptions_post_idx on public.descriptions (post_id, created_at);
create index descriptions_pending_idx on public.descriptions (status, created_at) where status = 'pending';

alter table public.descriptions enable row level security;
create policy "Users see their own descriptions" on public.descriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "Users add their own descriptions" on public.descriptions for insert to authenticated with check (user_id = (select auth.uid()));

-- Sets pay and checks the rules, whatever the app sends.
create or replace function public.prepare_description()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post public.posts;
  rate numeric;
  daily integer;
  today_count integer;
begin
  new.user_id := (select auth.uid());
  new.text := btrim(regexp_replace(new.text, '\s+', ' ', 'g'));
  if array_length(regexp_split_to_array(new.text, ' '), 1) < 4 then
    raise exception 'Say a little more: at least 4 words about what is happening.';
  end if;

  select * into post from public.posts where id = new.post_id and not hidden;
  if post.id is null then raise exception 'That post is no longer available.'; end if;
  if post.user_id = new.user_id then raise exception 'You can''t describe your own post. Let others teach on it!'; end if;

  if not exists (select 1 from public.consents c where c.user_id = new.user_id) then
    raise exception 'Please accept the terms first.';
  end if;

  select amount_jmd, coalesce(max_paid_per_session, 20) into rate, daily
  from public.task_rates where id = 'teach' and active;

  select count(*) into today_count from public.descriptions d
  where d.user_id = new.user_id and d.amount_jmd > 0
    and (d.created_at at time zone 'America/Jamaica')::date = (now() at time zone 'America/Jamaica')::date;

  new.amount_jmd := case when today_count < daily then coalesce(rate, 0) else 0 end;
  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;

create trigger prepare_description before insert on public.descriptions
  for each row execute function public.prepare_description();

-- ---------------------------------------------------------------------------
-- Feed and post details (with first names, counts and "did I like / describe it")
-- ---------------------------------------------------------------------------
create or replace function public.feed_posts(filter text default 'all', before_id bigint default null, page integer default 12)
returns table (
  id bigint, kind text, media_path text, caption text, width integer, height integer, duration_ms integer,
  created_at timestamptz, author text, is_mine boolean, like_count integer, liked boolean,
  description_count integer, my_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.kind, p.media_path, p.caption, p.width, p.height, p.duration_ms, p.created_at,
         split_part(coalesce(nullif(btrim(pr.display_name), ''), 'Someone'), ' ', 1) as author,
         p.user_id = (select auth.uid()) as is_mine,
         (select count(*) from public.post_likes l where l.post_id = p.id)::integer,
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())),
         (select count(*) from public.descriptions d where d.post_id = p.id and d.status <> 'rejected')::integer,
         (select d.status from public.descriptions d where d.post_id = p.id and d.user_id = (select auth.uid()))
  from public.posts p
  left join public.profiles pr on pr.id = p.user_id
  where (not p.hidden or p.user_id = (select auth.uid()))
    and (before_id is null or p.id < before_id)
    and (
      filter = 'all'
      or (filter = 'mine' and p.user_id = (select auth.uid()))
      or (filter = 'teach' and p.user_id <> (select auth.uid()) and not p.hidden
          and not exists (select 1 from public.descriptions d where d.post_id = p.id and d.user_id = (select auth.uid())))
    )
    and (select auth.uid()) is not null
  order by p.id desc
  limit least(greatest(page, 1), 30);
$$;

grant execute on function public.feed_posts(text, bigint, integer) to authenticated;

-- Other people's descriptions are shown only after you add your own (so nobody copies),
-- or on your own post. Only approved ones, plus your own.
create or replace function public.post_descriptions(target bigint)
returns table (id bigint, author text, text text, status text, is_mine boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  allowed as (
    select exists (select 1 from public.descriptions where post_id = target and user_id = (select id from me))
        or exists (select 1 from public.posts where id = target and user_id = (select id from me)) as ok
  )
  select d.id, split_part(coalesce(nullif(btrim(pr.display_name), ''), 'Someone'), ' ', 1), d.text, d.status,
         d.user_id = (select id from me), d.created_at
  from public.descriptions d
  left join public.profiles pr on pr.id = d.user_id
  where d.post_id = target
    and (d.user_id = (select id from me) or ((select ok from allowed) and d.status = 'approved'))
  order by d.user_id = (select id from me) desc, d.created_at;
$$;

grant execute on function public.post_descriptions(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Verify: descriptions are checked like everything else
-- ---------------------------------------------------------------------------
alter table public.verifications drop constraint if exists verifications_item_kind_check;
alter table public.verifications add constraint verifications_item_kind_check
  check (item_kind in ('correction', 'recording', 'description'));

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
  elsif new.item_kind = 'recording' then
    select status into current_status from public.recordings where id = new.item_id;
  else
    select status into current_status from public.descriptions where id = new.item_id;
  end if;

  if current_status in ('approved', 'rejected') then
    decision := current_status;
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
      return null;
    end if;

    if new.item_kind = 'correction' then
      update public.corrections set status = decision where id = new.item_id and status = 'pending';
    elsif new.item_kind = 'recording' then
      update public.recordings set status = decision where id = new.item_id and status = 'pending';
    else
      update public.descriptions set status = decision where id = new.item_id and status = 'pending';
    end if;
  end if;

  update public.verifications
  set status = case when (verdict = 'yes') = (decision = 'approved') then 'approved' else 'rejected' end
  where item_kind = new.item_kind and item_id = new.item_id and status = 'pending';

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Earnings and the leaderboard include descriptions
-- ---------------------------------------------------------------------------
create or replace view public.earnings
with (security_invoker = true)
as
  select c.user_id,
         case when cv.mode = 'voice' then 'voice' else 'talk' end as task,
         c.id as ref_id, c.amount_jmd, c.status, c.created_at, c.corrected as detail
  from public.corrections c
  join public.conversations cv on cv.id = c.conversation_id
  union all
  select r.user_id, 'record', r.id, r.amount_jmd + r.fix_amount_jmd, r.status, r.created_at, r.spoken_text
  from public.recordings r
  union all
  select v.user_id, 'verify', v.id, v.amount_jmd, v.status, v.created_at, null
  from public.verifications v
  union all
  select d.user_id, 'teach', d.id, d.amount_jmd, d.status, d.created_at, d.text
  from public.descriptions d;

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
    union all
    select d.user_id from public.descriptions d, week_start w where d.status = 'approved' and d.created_at >= w.t
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
