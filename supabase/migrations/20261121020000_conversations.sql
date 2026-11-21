-- Real Talk Yaad: AI conversations, messages and corrections.
-- Users can READ their own rows. All WRITES go through the `chat` Edge Function
-- (service role), so nobody can fake an AI message or a correction from the app.

-------------------------------------------------------------------------------
-- Topics the AI steers conversations toward.
-------------------------------------------------------------------------------
create table public.topics (
  id text primary key,
  title text not null,
  guidance text not null,
  active boolean not null default true,
  sort integer not null default 0
);

alter table public.topics enable row level security;

create policy "Signed-in users can read active topics"
  on public.topics for select to authenticated
  using (active);

insert into public.topics (id, title, guidance, sort) values
  ('sunday-dinner', 'Sunday dinner', 'Food cooked for Sunday dinner, who cooks it, who comes to eat, family traditions.', 1),
  ('market-day', 'Market day', 'Shopping at the market: prices, bargaining with higglers, fruit, vegetables and ground provisions.', 2),
  ('taxi-bus', 'Taxi and bus rides', 'Getting around: route taxis, buses, traffic, funny things that happen on the journey.', 3),
  ('dominoes', 'Dominoes', 'Playing dominoes: partners, slamming the table, trash talk, who always wins.', 4),
  ('school-days', 'School days', 'Primary and high school memories: teachers, lunch money, uniforms, exams, friends.', 5),
  ('weather', 'Weather and hurricanes', 'Rain, heat, drought, preparing for a hurricane, what people do when the light gone.', 6),
  ('music', 'Music and dancehall', 'Reggae and dancehall songs, artists, sound systems, street dances, favourite tunes.', 7),
  ('sports', 'Cricket and football', 'Watching cricket and football, school sports, Champs, favourite athletes.', 8),
  ('cooking', 'Cooking at home', 'How to cook local dishes like ackee and saltfish, curry goat, run down, dumplings.', 9),
  ('family', 'Family and the yaad', 'Family life, grandparents, cousins, chores, the neighbours in the yard.', 10),
  ('hustle', 'Work and hustle', 'Jobs, side hustles, starting a small business, saving money, payday.', 11),
  ('country-town', 'Country vs town', 'Differences between country life and town life, visiting family in the country.', 12),
  ('festivals', 'Holidays and festivals', 'Christmas, Independence, Emancipation, Easter bun and cheese, Grand Market.', 13),
  ('folklore', 'Old-time stories', 'Anansi stories, duppy stories and sayings the elders tell.', 14),
  ('church', 'Church and community', 'Church on Sunday, community events, helping neighbours.', 15);

-------------------------------------------------------------------------------
-- Conversations, messages and corrections.
-------------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id text references public.topics (id),
  model text not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index conversations_user_idx on public.conversations (user_id, created_at desc);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 2000),
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, id);
create index messages_user_recent_idx on public.messages (user_id, created_at desc) where role = 'user';

create table public.corrections (
  id bigint generated always as identity primary key,
  message_id bigint not null unique references public.messages (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  original text not null,
  corrected text not null check (char_length(corrected) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index corrections_user_idx on public.corrections (user_id, created_at desc);
create index corrections_status_idx on public.corrections (status) where status = 'pending';

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.corrections enable row level security;

create policy "Users can read their own conversations"
  on public.conversations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own messages"
  on public.messages for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own corrections"
  on public.corrections for select to authenticated
  using ((select auth.uid()) = user_id);

-- No insert, update or delete policies: only the chat function (service role) writes.
