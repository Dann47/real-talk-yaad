-- Real Talk Yaad: AI-written record lines, with "Sounds right" / "Fix it" before recording.
--
-- PAY (change these rows in Table Editor > task_rates; new recordings use the new values):
--   record      J$3  for reading a line as written
--   record_fix  J$1  bonus when the user corrected the line first (so a fixed line pays J$4 in total)

update public.task_rates set amount_jmd = 3 where id = 'record';

insert into public.task_rates (id, label, unit, amount_jmd, max_paid_per_session)
values ('record_fix', 'Fix a record line', 'fix', 1, 10)
on conflict (id) do update set amount_jmd = excluded.amount_jmd;

-------------------------------------------------------------------------------
-- Lines can now be hand-written (curated) or AI-written for a particular user.
-- Curated lines are mixed into every set as known-good quality checks.
-------------------------------------------------------------------------------
alter table public.record_prompts
  add column source text not null default 'curated' check (source in ('curated', 'ai')),
  add column topic_id text references public.topics (id),
  add column created_for uuid references auth.users (id) on delete cascade,
  add column created_at timestamptz not null default now();

create index record_prompts_created_for_idx on public.record_prompts (created_for, created_at desc);

drop policy "Signed-in users can read active prompts" on public.record_prompts;

create policy "Users can read curated lines and lines written for them"
  on public.record_prompts for select to authenticated
  using (active and (source = 'curated' or created_for = (select auth.uid())));

-------------------------------------------------------------------------------
-- Each recording keeps the exact words that were read, whether they fixed the line,
-- and the pay for each part.
-------------------------------------------------------------------------------
alter table public.recordings
  add column spoken_text text,
  add column fixed boolean not null default false,
  add column fix_amount_jmd numeric(10, 2) not null default 0,
  add column is_check boolean not null default false;

create or replace function public.prepare_recording()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prompt public.record_prompts%rowtype;
  read_rate numeric;
  fix_rate numeric;
  original_words integer;
  spoken_words integer;
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

  select * into prompt from public.record_prompts p
  where p.id = new.prompt_id and p.active and (p.source = 'curated' or p.created_for = new.user_id);
  if prompt.id is null then
    raise exception 'That line is no longer available.';
  end if;

  new.prompt_text := prompt.text;
  new.is_check := prompt.source = 'curated';
  new.spoken_text := btrim(coalesce(nullif(btrim(new.spoken_text), ''), prompt.text));
  new.fixed := lower(new.spoken_text) <> lower(prompt.text);

  -- A fix must still be the same sentence, not a shortcut to something easier to read.
  if new.fixed then
    original_words := array_length(regexp_split_to_array(prompt.text, '\s+'), 1);
    spoken_words := array_length(regexp_split_to_array(new.spoken_text, '\s+'), 1);
    if char_length(new.spoken_text) > 300 or spoken_words < ceil(original_words * 0.6) then
      raise exception 'Your fix changes the line too much. Keep the same meaning and length.';
    end if;
  end if;

  select r.amount_jmd into read_rate from public.task_rates r where r.id = 'record' and r.active;
  select r.amount_jmd into fix_rate from public.task_rates r where r.id = 'record_fix' and r.active;
  new.amount_jmd := coalesce(read_rate, 0);
  new.fix_amount_jmd := case when new.fixed then coalesce(fix_rate, 0) else 0 end;
  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;
