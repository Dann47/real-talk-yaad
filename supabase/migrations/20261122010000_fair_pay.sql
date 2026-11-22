-- Real Talk Yaad: pay aligned with Jamaica's minimum wage, plus limits that keep payouts predictable.
--
-- RATES (Table Editor > task_rates). Target: about J$425 an hour (the July 2026 minimum wage, J$17,000 per 40-hour week),
-- that is about J$7 a minute, based on how long each task takes:
--   talk / voice       J$7  per fix               (about 1 minute)         max 10 / 6 paid fixes per chat
--   record             J$2  per line              (about 15 seconds)
--   record_fix         J$1  extra when you fixed the line first
--   teach              J$10 per description       (about 1 to 1.5 minutes)  max 20 paid per day
--   verify_recording   J$1  per matching vote     (listen to a short clip, about 8 seconds)
--   verify_correction  J$2  per matching vote     (read a fix, about 15 seconds)
--   verify_description J$3  per matching vote     (look at a post and read, about 25 seconds)
--   verify             shown on the Work screen as the typical verify pay
--
-- LIMITS (Table Editor > app_settings):
--   daily_earn_cap_jmd    1000  most one person can earn in a day, all tasks together (Jamaica time). 0 = no limit
--   monthly_budget_jmd    0     total pay for everyone this month; when reached, new work pays J$0. 0 = no limit
--   max_chats_per_day     15    new chats (typed + voice) one person can start a day
-- Corrections of the AI's opening greeting are not paid (it was a free way to earn without chatting).
-- Work over a limit is still saved and still teaches the AI; it just pays J$0, and the app says so.

update public.task_rates set amount_jmd = 7 where id in ('talk', 'voice');
update public.task_rates set amount_jmd = 2 where id = 'record';
update public.task_rates set amount_jmd = 1 where id = 'record_fix';
update public.task_rates set amount_jmd = 10 where id = 'teach';
update public.task_rates set amount_jmd = 2, label = 'Verify work' where id = 'verify';

insert into public.task_rates (id, label, unit, amount_jmd, max_paid_per_session) values
  ('verify_recording', 'Verify a recorded line', 'vote', 1, null),
  ('verify_correction', 'Verify a fix', 'vote', 2, null),
  ('verify_description', 'Verify a post description', 'vote', 3, null)
on conflict (id) do update set amount_jmd = excluded.amount_jmd, label = excluded.label;

insert into public.app_settings (key, value, note) values
  ('daily_earn_cap_jmd', '1000', 'Most one person can earn in a day across all tasks (J$). 0 = no limit.'),
  ('monthly_budget_jmd', '0', 'Total pay for everyone this month (J$). When reached, new work pays J$0. 0 = no limit.'),
  ('max_chats_per_day', '15', 'New chats (typed and voice) one person can start per day.')
on conflict (key) do nothing;

-- What someone has earned today (Jamaica time), not counting rejected work.
create or replace function public.earned_today(uid uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_jmd), 0) from public.earnings
  where user_id = uid and status <> 'rejected'
    and (created_at at time zone 'America/Jamaica')::date = (now() at time zone 'America/Jamaica')::date;
$$;

-- Everyone's pay this month (Jamaica time), not counting rejected work.
create or replace function public.paid_this_month()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_jmd), 0) from public.earnings
  where status <> 'rejected'
    and created_at >= (date_trunc('month', now() at time zone 'America/Jamaica') at time zone 'America/Jamaica');
$$;

-- The pay for a new piece of work after the daily cap and the monthly budget.
create or replace function public.capped_pay(uid uuid, amount numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cap numeric := public.setting_number('daily_earn_cap_jmd', 1000);
  budget numeric := public.setting_number('monthly_budget_jmd', 0);
begin
  if amount is null or amount <= 0 then return 0; end if;
  if budget > 0 and public.paid_this_month() >= budget then return 0; end if;
  if cap > 0 then
    amount := least(amount, greatest(0, cap - public.earned_today(uid)));
  end if;
  return amount;
end;
$$;

revoke execute on function public.earned_today(uuid) from public, anon, authenticated;
revoke execute on function public.paid_this_month() from public, anon, authenticated;
revoke execute on function public.capped_pay(uuid, numeric) from public, anon, authenticated;

-- For the app: today's limit and how much of it is used.
create or replace function public.pay_limits()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'daily_cap', public.setting_number('daily_earn_cap_jmd', 1000),
    'earned_today', public.earned_today((select auth.uid())),
    'budget_reached', public.setting_number('monthly_budget_jmd', 0) > 0
                      and public.paid_this_month() >= public.setting_number('monthly_budget_jmd', 0)
  );
$$;

grant execute on function public.pay_limits() to authenticated;

-- Recordings: same rules as before, now with the daily cap and monthly budget.
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
  total numeric;
  allowed numeric;
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

  if new.fixed then
    original_words := array_length(regexp_split_to_array(prompt.text, '\s+'), 1);
    spoken_words := array_length(regexp_split_to_array(new.spoken_text, '\s+'), 1);
    if char_length(new.spoken_text) > 300 or spoken_words < ceil(original_words * 0.6) then
      raise exception 'Your fix changes the line too much. Keep the same meaning and length.';
    end if;
  end if;

  select r.amount_jmd into read_rate from public.task_rates r where r.id = 'record' and r.active;
  select r.amount_jmd into fix_rate from public.task_rates r where r.id = 'record_fix' and r.active;
  total := coalesce(read_rate, 0) + case when new.fixed then coalesce(fix_rate, 0) else 0 end;
  allowed := public.capped_pay(new.user_id, total);
  new.amount_jmd := least(coalesce(read_rate, 0), allowed);
  new.fix_amount_jmd := allowed - new.amount_jmd;
  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;

-- Descriptions: same rules as before, now with the daily cap and monthly budget.
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

  new.amount_jmd := public.capped_pay(new.user_id, case when today_count < daily then coalesce(rate, 0) else 0 end);
  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;
