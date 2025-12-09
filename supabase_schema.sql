-- USAGE:
-- Copy the content of this file and paste it into the SQL Editor in your Supabase Dashboard.
-- Click "Run" to execute the commands.

-- 1. Create PROFILES table
-- This table stores public user information and links to the auth.users table.
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  riot_summoner_name text,
  riot_region text,
  puuid text,
  avatar_url text, -- For future use
  
  constraint username_length check (char_length(riot_summoner_name) >= 3)
);

-- 2. Enable RLS for Profiles
alter table public.profiles enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can insert their own profile." on public.profiles
  for insert with check ((select auth.uid()) = id);

create policy "Users can update their own profile." on public.profiles
  for update using ((select auth.uid()) = id);

-- 3. Create MATCH_HISTORIES table
create table if not exists public.match_histories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  match_id text, -- Riot Match ID
  champion text,
  role text,
  result text,   -- 'Win' or 'Lose'
  kda text,      -- e.g. '10/2/5'
  ai_advice text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Enable RLS for Match Histories
alter table public.match_histories enable row level security;

-- Policies
create policy "Users can view their own match histories." on public.match_histories
  for select using ((select auth.uid()) = user_id);

create policy "Users can insert their own match histories." on public.match_histories
  for insert with check ((select auth.uid()) = user_id);

-- 5. Auto-create Profile on Signup Trigger
-- This ensures a row exists in `profiles` as soon as a user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid error on re-run
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. Setup Realtime (Optional but recommended)
-- alter publication supabase_realtime add table public.profiles;
-- alter publication supabase_realtime add table public.match_histories;
