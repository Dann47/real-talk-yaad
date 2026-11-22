-- Real Talk Yaad: Store (admin-curated). People spend what they've earned on looks for their profile.
--
-- WHAT'S SOLD (category -> what "payload" holds):
--   card   Card skin: changes the big balance cards (Home, Wallet, Work, Me).
--          {"background": "#1B1B1B", "text": "#FFD24A", "pattern": "rings" | "stripes" | "dots"}
--   frame  Avatar frame: a ring around your avatar, shown to everyone (Feed, leaderboard, Me).
--          {"colors": ["#009B3A", "#FED100", "#000000"]}   (one to three colours)
--   badge  Badge next to your name, shown to everyone.
--          {"icon": "flame", "color": "#F2B705", "label": "Big Up"}   (icon: any icon name the app knows)
--
-- ADDING AN ITEM: Table Editor > store_items > Insert row. Fill name, category, price_jmd, payload (as above),
-- optional description, artist_name, edition_size (limited quantity), available_from / available_until, featured.
-- Set active = false to take it off sale (people who bought it keep it).
--
-- RULES: no refunds or resale; items never change how much anyone earns. Spending comes out of the same
-- available balance as cash-outs (approved earnings - cash-outs - purchases).

create table public.store_items (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 40),
  description text not null default '' check (char_length(description) <= 200),
  category text not null check (category in ('card', 'frame', 'badge')),
  price_jmd numeric(10, 2) not null check (price_jmd >= 0),
  payload jsonb not null default '{}'::jsonb,
  artist_name text,
  edition_size integer check (edition_size is null or edition_size > 0),
  available_from timestamptz,
  available_until timestamptz,
  featured boolean not null default false,
  active boolean not null default true,
  sort integer not null default 100,
  created_at timestamptz not null default now()
);

alter table public.store_items enable row level security;
create policy "Signed-in users can see store items" on public.store_items
  for select to authenticated using (true);

create table public.purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id bigint not null references public.store_items (id),
  price_jmd numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create index purchases_item_idx on public.purchases (item_id);

alter table public.purchases enable row level security;
create policy "Users see their own purchases" on public.purchases
  for select to authenticated using (user_id = (select auth.uid()));
-- Buying goes through buy_item() only.

alter table public.profiles
  add column if not exists equipped_card bigint references public.store_items (id),
  add column if not exists equipped_frame bigint references public.store_items (id),
  add column if not exists equipped_badge bigint references public.store_items (id);
-- Equipping goes through equip_item() only (it checks you own the item).

-- Money spent in the store.
create or replace function public.spent_in_store(uid uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(price_jmd), 0) from public.purchases where user_id = uid;
$$;
revoke execute on function public.spent_in_store(uuid) from public, anon, authenticated;

-- Store items with "sold" counts and whether you own / wear each one.
create or replace function public.store_catalog()
returns table (
  id bigint, name text, description text, category text, price_jmd numeric, payload jsonb,
  artist_name text, edition_size integer, sold integer, available_until timestamptz, featured boolean,
  owned boolean, equipped boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.equipped_card, p.equipped_frame, p.equipped_badge
    from public.profiles p where p.id = (select auth.uid())
  )
  select i.id, i.name, i.description, i.category, i.price_jmd, i.payload, i.artist_name, i.edition_size,
         (select count(*) from public.purchases x where x.item_id = i.id)::integer,
         i.available_until, i.featured,
         exists (select 1 from public.purchases x where x.item_id = i.id and x.user_id = (select auth.uid())),
         i.id in (select equipped_card from me union select equipped_frame from me union select equipped_badge from me)
  from public.store_items i
  where (select auth.uid()) is not null
    and (
      exists (select 1 from public.purchases x where x.item_id = i.id and x.user_id = (select auth.uid()))
      or (i.active
          and (i.available_from is null or i.available_from <= now())
          and (i.available_until is null or i.available_until > now()))
    )
  order by i.featured desc, i.sort, i.id;
$$;
grant execute on function public.store_catalog() to authenticated;

create or replace function public.buy_item(item bigint)
returns public.purchases
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  it public.store_items;
  available numeric;
  result public.purchases;
begin
  if uid is null then raise exception 'Please sign in again.'; end if;
  perform pg_advisory_xact_lock(hashtext('payout:' || uid::text)); -- same lock as cash-outs

  select * into it from public.store_items where id = item;
  if it.id is null or not it.active
     or (it.available_from is not null and it.available_from > now())
     or (it.available_until is not null and it.available_until <= now()) then
    raise exception 'That item is no longer for sale.';
  end if;
  if exists (select 1 from public.purchases where user_id = uid and item_id = item) then
    raise exception 'You already own this.';
  end if;
  if it.edition_size is not null and (select count(*) from public.purchases where item_id = item) >= it.edition_size then
    raise exception 'Sold out! That was a limited edition.';
  end if;

  select coalesce(sum(amount_jmd), 0) into available
  from public.earnings where user_id = uid and status = 'approved';
  available := available - public.held_for_payouts(uid) - public.spent_in_store(uid);
  if it.price_jmd > available then
    raise exception 'You need J$% more for this.', to_char(it.price_jmd - greatest(available, 0), 'FM999,999,990');
  end if;

  insert into public.purchases (user_id, item_id, price_jmd) values (uid, item, it.price_jmd)
  returning * into result;
  return result;
end;
$$;
grant execute on function public.buy_item(bigint) to authenticated;

-- Wear an item (or take it off: pass null with the category).
create or replace function public.equip_item(item bigint, slot text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cat text;
begin
  if slot not in ('card', 'frame', 'badge') then raise exception 'Unknown slot.'; end if;
  if item is not null then
    select category into cat from public.store_items where id = item;
    if cat is distinct from slot then raise exception 'That item doesn''t go there.'; end if;
    if not exists (select 1 from public.purchases where user_id = uid and item_id = item) then
      raise exception 'Buy it first.';
    end if;
  end if;
  if slot = 'card' then update public.profiles set equipped_card = item where id = uid;
  elsif slot = 'frame' then update public.profiles set equipped_frame = item where id = uid;
  else update public.profiles set equipped_badge = item where id = uid;
  end if;
end;
$$;
grant execute on function public.equip_item(bigint, text) to authenticated;

-- What someone is wearing (frame + badge are public; anyone signed in can ask for a list of people).
create or replace function public.cosmetics_for(people uuid[])
returns table (user_id uuid, card jsonb, frame jsonb, badge jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         case when p.id = (select auth.uid()) then c.payload end,  -- card skins are only seen by their owner
         f.payload, b.payload
  from public.profiles p
  left join public.store_items c on c.id = p.equipped_card
  left join public.store_items f on f.id = p.equipped_frame
  left join public.store_items b on b.id = p.equipped_badge
  where p.id = any(people) and (select auth.uid()) is not null;
$$;
grant execute on function public.cosmetics_for(uuid[]) to authenticated;

-- Feed and post details now say who wrote each post (an id, so the app can show their frame and badge).
drop function if exists public.feed_posts(text, bigint, integer);
create or replace function public.feed_posts(filter text default 'all', before_id bigint default null, page integer default 12)
returns table (
  id bigint, kind text, media_path text, caption text, width integer, height integer, duration_ms integer,
  created_at timestamptz, author text, author_id uuid, is_mine boolean, like_count integer, liked boolean,
  description_count integer, my_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.kind, p.media_path, p.caption, p.width, p.height, p.duration_ms, p.created_at,
         split_part(coalesce(nullif(btrim(pr.display_name), ''), 'Someone'), ' ', 1) as author,
         p.user_id,
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

-- Balances now subtract store purchases.
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
    'available',   greatest(0, earned.approved - out.paid - out.on_the_way - public.spent_in_store((select id from me))),
    'pending',     earned.pending,
    'on_the_way',  out.on_the_way,
    'paid_out',    out.paid,
    'spent',       public.spent_in_store((select id from me)),
    'lifetime',    earned.approved,
    'min_cashout', public.setting_number('min_cashout_jmd', 1000),
    'fee',         public.setting_number('cashout_fee_jmd', 0),
    'payouts_live', coalesce((select value from public.app_settings where key = 'payouts_live'), 'false') = 'true'
  )
  from earned, out;
$$;

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
  available := approved - public.held_for_payouts(uid) - public.spent_in_store(uid);
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
  ),
  spent as (
    select coalesce(sum(price_jmd), 0) as amount from public.purchases where user_id = (select auth.uid())
  )
  select json_build_object(
    'balance',        greatest(0, coalesce(sum(amount_jmd) filter (where status = 'approved'), 0)
                                  - (select amount from held) - (select amount from spent)),
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

-- A first set of items. Change or add more in the Table Editor.
insert into public.store_items (name, description, category, price_jmd, payload, featured, sort) values
  ('Yaad Gold', 'Black and gold balance cards.', 'card', 300,
   '{"background": "#141414", "text": "#FED100", "pattern": "rings"}', true, 10),
  ('Blue Mountain', 'Misty blue cards, cool like di mountain.', 'card', 250,
   '{"background": "#1E4A6B", "text": "#FFFFFF", "pattern": "stripes"}', false, 20),
  ('Sunset Negril', 'Warm sunset orange cards.', 'card', 250,
   '{"background": "#C2410C", "text": "#FFF7ED", "pattern": "dots"}', false, 30),
  ('Flag Ring', 'Black, green and gold around your avatar.', 'frame', 200,
   '{"colors": ["#009B3A", "#FED100", "#000000"]}', true, 40),
  ('Gold Ring', 'A solid gold frame.', 'frame', 150, '{"colors": ["#F2B705"]}', false, 50),
  ('Riddim', 'Purple and pink, like a dancehall light show.', 'frame', 150, '{"colors": ["#7C3AED", "#EC4899"]}', false, 60),
  ('Big Up', 'A badge next to your name.', 'badge', 150, '{"icon": "flame", "color": "#F2B705", "label": "Big Up"}', false, 70),
  ('Yaadie', 'Show where you from.', 'badge', 150, '{"icon": "home", "color": "#009B3A", "label": "Yaadie"}', false, 80),
  ('Patois Pro', 'For people who know dem ting.', 'badge', 300, '{"icon": "sparkles", "color": "#7C3AED", "label": "Patois Pro"}', false, 90);
