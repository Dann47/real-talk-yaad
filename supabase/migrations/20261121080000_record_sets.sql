-- Real Talk Yaad: remember each set of record lines so people pick up where they left off.
--   * The chat function creates a set when it hands out lines (action record_lines).
--   * The app marks lines as skipped, and the set as finished when the last line is done.
--   * Opening Record lines again returns the unfinished set (if it is less than 3 days old)
--     with the lines already recorded or skipped marked, instead of writing new lines.

create table public.record_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id text,
  topic_title text,
  prompt_ids bigint[] not null,
  skipped bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index record_sets_open_idx on public.record_sets (user_id, created_at desc) where finished_at is null;

alter table public.record_sets enable row level security;

create policy "Users can read their own record sets"
  on public.record_sets for select to authenticated
  using (user_id = (select auth.uid()));

-- People can only mark lines skipped and finish the set; the lines themselves can't be changed.
create policy "Users can update their own record sets"
  on public.record_sets for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke update on public.record_sets from authenticated;
grant update (skipped, finished_at) on public.record_sets to authenticated;
