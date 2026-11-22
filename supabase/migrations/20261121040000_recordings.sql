-- Real Talk Yaad: "Record lines" task. Users read short Patois lines aloud.
-- The app uploads the audio to the private `voice` bucket, then inserts a row here.
-- A trigger fills in the user, the prompt text and the pay, so the app cannot set them.

create table public.record_prompts (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) between 3 and 300),
  active boolean not null default true,
  sort integer not null default 0
);

alter table public.record_prompts enable row level security;

create policy "Signed-in users can read active prompts"
  on public.record_prompts for select to authenticated
  using (active);

insert into public.record_prompts (text, sort) values
  ('Wah gwaan, how yuh do?', 1),
  ('Mi deh yah, likkle bit tired still.', 2),
  ('Mi a go a town fi buy likkle someting. Soon come back.', 3),
  ('Di bus tek long fi come dis mawnin.', 4),
  ('Gimme two a di mango dem, please.', 5),
  ('How much fi di breadfruit?', 6),
  ('Rain a fall, so mi naa go out.', 7),
  ('Wi a go beach pon Sunday.', 8),
  ('Mi granny cook di bes rice an peas.', 9),
  ('Walk good, mi wi check yuh lata.', 10),
  ('Weh yuh did deh all dis time?', 11),
  ('Mi cyaan find mi phone, yuh see it?', 12),
  ('Di likkle pickney dem a play inna di yaad.', 13),
  ('Hol a vibes, mi soon reach.', 14),
  ('Mi belly full, tank yuh fi di food.', 15),
  ('Dem seh di light gone fi di whole day.', 16),
  ('A who dat a knock pon di door?', 17),
  ('Mi nuh know wah fi seh to dat.', 18),
  ('Tek yuh time, nuh rush yuhself.', 19),
  ('Every mickle mek a muckle.', 20);

create table public.recordings (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prompt_id bigint not null references public.record_prompts (id),
  prompt_text text not null default '',
  audio_path text not null,
  duration_ms integer not null check (duration_ms between 500 and 60000),
  amount_jmd numeric(10, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, prompt_id)
);

create index recordings_user_idx on public.recordings (user_id, created_at desc);

alter table public.recordings enable row level security;

create policy "Users can read their own recordings"
  on public.recordings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own recordings"
  on public.recordings for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Server-side values: the app only sends prompt_id, audio_path and duration_ms.
create or replace function public.prepare_recording()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rate numeric;
begin
  new.user_id := auth.uid();
  if new.user_id is null then
    raise exception 'Please sign in again.';
  end if;
  if not exists (select 1 from public.consents c where c.user_id = new.user_id) then
    raise exception 'Please accept the consent terms first.';
  end if;
  if split_part(new.audio_path, '/', 1) <> new.user_id::text then
    raise exception 'That recording is not in your folder.';
  end if;

  select p.text into new.prompt_text from public.record_prompts p where p.id = new.prompt_id and p.active;
  if new.prompt_text is null then
    raise exception 'That line is no longer available.';
  end if;

  select r.amount_jmd into rate from public.task_rates r where r.id = 'record' and r.active;
  new.amount_jmd := coalesce(rate, 0);
  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;

create trigger recordings_prepare
  before insert on public.recordings
  for each row execute function public.prepare_recording();
