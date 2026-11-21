-- Real Talk Yaad: user profiles and consent records.
-- Run with the Supabase CLI (supabase db push) or paste into the Supabase SQL editor.

-------------------------------------------------------------------------------
-- Profiles: one row per user, created automatically when they sign up.
-------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  handle text unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  parish text check (char_length(parish) <= 40),
  level integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Users may only edit these columns; level is set by the server.
revoke update on public.profiles from authenticated;
grant update (display_name, handle, parish) on public.profiles to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create the profile when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-------------------------------------------------------------------------------
-- Consents: append-only record of which terms each user accepted, and when.
-- Every recording and dataset sale will later point back to a consent row.
-------------------------------------------------------------------------------
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  terms_version text not null,
  is_adult boolean not null,
  ai_training boolean not null,
  platform text,
  accepted_at timestamptz not null default now(),
  constraint consents_must_agree check (is_adult and ai_training)
);

create index consents_user_version_idx on public.consents (user_id, terms_version);

alter table public.consents enable row level security;

create policy "Users can read their own consents"
  on public.consents for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can record their own consent"
  on public.consents for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- No update or delete policies: consent rows are never changed, only added.
