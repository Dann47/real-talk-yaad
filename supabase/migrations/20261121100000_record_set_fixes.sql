-- Real Talk Yaad: Record lines also remembers fixes you typed but hadn't recorded yet,
-- so resuming a set puts you back exactly where you were. { "<prompt id>": "your fixed line" }
alter table public.record_sets add column if not exists fixes jsonb not null default '{}'::jsonb;
grant update (skipped, finished_at, fixes) on public.record_sets to authenticated;
