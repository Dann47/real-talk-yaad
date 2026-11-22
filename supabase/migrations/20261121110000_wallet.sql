-- Real Talk Yaad: Wallet (before a payout partner is connected).
--
-- What works now
--   * Payout method: a Jamaican bank account or a Lynk wallet. Only what's needed to show it is kept
--     (bank, account type, holder name, last 4 digits / Lynk handle). Full account numbers are NOT stored:
--     the payout partner will collect and keep those when it is connected.
--   * Cash-out requests: request_payout() checks the balance and the minimum, then records the request.
--     The money is held (taken off "available") until it is paid, failed or cancelled.
--   * Until payouts go live you pay requests by hand and update payouts.status in the Table Editor:
--       requested -> processing -> paid   (or failed: the money goes back to the balance)
--
-- SETTINGS (Table Editor > app_settings):
--   min_cashout_jmd  1000   smallest cash-out
--   cashout_fee_jmd  0      fee taken from each cash-out
--   payouts_live     false  shown in the app ("paid by hand for now" vs. automatic)

insert into public.app_settings (key, value, note) values
  ('min_cashout_jmd', '1000', 'Smallest cash-out in J$.'),
  ('cashout_fee_jmd', '0', 'Fee in J$ taken from each cash-out.'),
  ('payouts_live', 'false', 'true once the payout partner is connected.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Payout method (one per person)
-- ---------------------------------------------------------------------------
create table public.payout_methods (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bank', 'lynk')),
  bank_name text check (char_length(bank_name) <= 60),
  account_type text check (account_type in ('savings', 'chequing')),
  holder_name text not null check (char_length(holder_name) between 2 and 80),
  account_last4 text check (account_last4 ~ '^[0-9]{4}$'),
  lynk_handle text check (lynk_handle ~ '^@?[A-Za-z0-9_.]{2,30}$'),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'bank' and bank_name is not null and account_type is not null and account_last4 is not null)
    or (kind = 'lynk' and lynk_handle is not null)
  )
);

alter table public.payout_methods enable row level security;

create policy "Users can read their payout method" on public.payout_methods
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can add their payout method" on public.payout_methods
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users can change their payout method" on public.payout_methods
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users can remove their payout method" on public.payout_methods
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Cash-outs
-- ---------------------------------------------------------------------------
create table public.payouts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_jmd numeric(12, 2) not null check (amount_jmd > 0),
  fee_jmd numeric(12, 2) not null default 0,
  method jsonb not null,               -- copy of the payout method at the time (for the record)
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'paid', 'failed', 'cancelled')),
  note text,                           -- e.g. a reference number, or why it failed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payouts_user_idx on public.payouts (user_id, created_at desc);

alter table public.payouts enable row level security;

-- People see their own cash-outs. Creating and cancelling go through the functions below.
create policy "Users can read their payouts" on public.payouts
  for select to authenticated using (user_id = (select auth.uid()));

-- Money held by cash-outs (not failed or cancelled).
create or replace function public.held_for_payouts(uid uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_jmd), 0) from public.payouts
  where user_id = uid and status in ('requested', 'processing', 'paid');
$$;

revoke execute on function public.held_for_payouts(uuid) from public, anon, authenticated;

create or replace function public.setting_number(setting text, fallback numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value::numeric from public.app_settings where key = setting), fallback);
$$;

-- Everything the Wallet screen needs.
create or replace function public.wallet_summary()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  earned as (
    select coalesce(sum(amount_jmd) filter (where status = 'approved'), 0) as approved,
           coalesce(sum(amount_jmd) filter (where status = 'pending'), 0) as pending
    from public.earnings e where e.user_id = (select id from me)
  ),
  out as (
    select coalesce(sum(amount_jmd) filter (where status = 'paid'), 0) as paid,
           coalesce(sum(amount_jmd) filter (where status in ('requested', 'processing')), 0) as on_the_way
    from public.payouts p where p.user_id = (select id from me)
  )
  select json_build_object(
    'available',   greatest(0, earned.approved - out.paid - out.on_the_way),
    'pending',     earned.pending,
    'on_the_way',  out.on_the_way,
    'paid_out',    out.paid,
    'lifetime',    earned.approved,
    'min_cashout', public.setting_number('min_cashout_jmd', 1000),
    'fee',         public.setting_number('cashout_fee_jmd', 0),
    'payouts_live', coalesce((select value from public.app_settings where key = 'payouts_live'), 'false') = 'true'
  )
  from earned, out;
$$;

grant execute on function public.wallet_summary() to authenticated;

-- Ask for a cash-out. Checked here so it can't be faked from the app.
create or replace function public.request_payout(amount numeric)
returns public.payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  method public.payout_methods;
  approved numeric;
  available numeric;
  minimum numeric := public.setting_number('min_cashout_jmd', 1000);
  fee numeric := public.setting_number('cashout_fee_jmd', 0);
  result public.payouts;
begin
  if uid is null then raise exception 'Please sign in again.'; end if;
  -- One request at a time per person, so two taps can't both pass the balance check.
  perform pg_advisory_xact_lock(hashtext('payout:' || uid::text));

  select * into method from public.payout_methods where user_id = uid;
  if method.user_id is null then raise exception 'Add a payout method first.'; end if;

  if exists (select 1 from public.payouts where user_id = uid and status in ('requested', 'processing')) then
    raise exception 'You already have a cash-out on the way. Wait for it to be paid first.';
  end if;

  amount := round(amount, 2);
  if amount is null or amount < minimum then
    raise exception 'The smallest cash-out is J$%.', to_char(minimum, 'FM999,999,990');
  end if;

  select coalesce(sum(amount_jmd), 0) into approved
  from public.earnings where user_id = uid and status = 'approved';
  available := approved - public.held_for_payouts(uid);
  if amount > available then
    raise exception 'You only have J$% available.', to_char(greatest(available, 0), 'FM999,999,990.00');
  end if;
  if amount <= fee then raise exception 'That amount is smaller than the fee.'; end if;

  insert into public.payouts (user_id, amount_jmd, fee_jmd, method)
  values (uid, amount, fee, jsonb_build_object(
    'kind', method.kind, 'bank_name', method.bank_name, 'account_type', method.account_type,
    'holder_name', method.holder_name, 'account_last4', method.account_last4, 'lynk_handle', method.lynk_handle))
  returning * into result;
  return result;
end;
$$;

grant execute on function public.request_payout(numeric) to authenticated;

-- Cancel a cash-out that hasn't started yet. The money goes back to the balance.
create or replace function public.cancel_payout(payout_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payouts set status = 'cancelled', updated_at = now()
  where id = payout_id and user_id = (select auth.uid()) and status = 'requested';
  if not found then raise exception 'That cash-out can no longer be cancelled.'; end if;
end;
$$;

grant execute on function public.cancel_payout(bigint) to authenticated;

-- Home's balance now takes cash-outs into account.
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
  today as (select (now() at time zone 'America/Jamaica')::date as d),
  held as (
    select coalesce(sum(amount_jmd), 0) as amount from public.payouts
    where user_id = (select auth.uid()) and status in ('requested', 'processing', 'paid')
  )
  select json_build_object(
    'balance',        greatest(0, coalesce(sum(amount_jmd) filter (where status = 'approved'), 0) - (select amount from held)),
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
