-- Real Talk Yaad: pay rates (data, not code) and voice chat.

-------------------------------------------------------------------------------
-- Pay rates. The app shows them; the chat function snapshots them onto each correction.
-- Change a rate here and both update. Amounts are Jamaican dollars.
-------------------------------------------------------------------------------
create table public.task_rates (
  id text primary key,
  label text not null,
  unit text not null,                  -- what one payment is for: fix, line, vote, description
  amount_jmd numeric(10, 2) not null check (amount_jmd >= 0),
  max_paid_per_session integer check (max_paid_per_session > 0),
  active boolean not null default true
);

alter table public.task_rates enable row level security;

create policy "Signed-in users can read rates"
  on public.task_rates for select to authenticated
  using (true);

insert into public.task_rates (id, label, unit, amount_jmd, max_paid_per_session) values
  ('talk',   'Talk with the AI',        'fix',         15, 10),  -- up to J$150 per chat
  ('voice',  'Voice chat',              'fix',         15, 6),   -- up to J$90 per voice chat
  ('record', 'Record lines',            'line',        4,  10),  -- J$40 per set of 10
  ('verify', 'Verify corrections',      'vote',        6,  10),  -- J$60 per set of 10
  ('teach',  'Teach: describe a clip',  'description', 25, 1);   -- J$25 each

-------------------------------------------------------------------------------
-- Conversations can be typed or spoken; messages can carry audio.
-------------------------------------------------------------------------------
alter table public.conversations
  add column mode text not null default 'text' check (mode in ('text', 'voice'));

alter table public.messages
  add column audio_path text,
  add column transcript_raw text;     -- what speech-to-text heard, before any fix

alter table public.corrections
  add column kind text not null default 'ai_reply' check (kind in ('ai_reply', 'transcript')),
  add column amount_jmd numeric(10, 2) not null default 0;

-------------------------------------------------------------------------------
-- Private storage for voice recordings: users upload into their own folder only.
-- Path: <user id>/<conversation id>/<timestamp>.<ext>
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice', 'voice', false, 10485760,
        array['audio/m4a', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/3gpp'])
on conflict (id) do nothing;

create policy "Users can upload their own voice recordings"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'voice' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can read their own voice recordings"
  on storage.objects for select to authenticated
  using (bucket_id = 'voice' and (storage.foldername(name))[1] = (select auth.uid())::text);
