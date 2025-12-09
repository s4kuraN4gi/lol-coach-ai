-- USAGE:
-- Copy the content of this file and paste it into the SQL Editor in your Supabase Dashboard.
-- Click "Run" to execute the commands.

-- 1. Create SUMMONER_ACCOUNTS table
create table if not exists public.summoner_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  summoner_name text not null,
  region text default 'JP1',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Optional: Prevent duplicate summoner names for the same user
  unique(user_id, summoner_name)
);

-- 2. Enable RLS for Summoner Accounts
alter table public.summoner_accounts enable row level security;

-- Policies
create policy "Users can view their own summoner accounts." on public.summoner_accounts
  for select using ((select auth.uid()) = user_id);

create policy "Users can insert their own summoner accounts." on public.summoner_accounts
  for insert with check ((select auth.uid()) = user_id);

create policy "Users can delete their own summoner accounts." on public.summoner_accounts
  for delete using ((select auth.uid()) = user_id);

-- 3. Add ACTIVE_SUMMONER_ID to PROFILES
alter table public.profiles 
add column if not exists active_summoner_id uuid references public.summoner_accounts(id) on delete set null;

-- 4. Migrate existing data (Optional/Best Effort)
-- If users already have a name in profiles, move it to summoner_accounts
-- This is a bit complex in SQL script without knowing exact state, 
-- but we can try a simple migration logic block.

do $$
declare
  r record;
  new_sa_id uuid;
begin
  for r in (select id, riot_summoner_name from public.profiles where riot_summoner_name is not null) loop
    -- Check if already exists in summoner_accounts to avoid duplicates if run multiple times
    if not exists (select 1 from public.summoner_accounts where user_id = r.id and summoner_name = r.riot_summoner_name) then
        insert into public.summoner_accounts (user_id, summoner_name)
        values (r.id, r.riot_summoner_name)
        returning id into new_sa_id;
        
        -- Set as active
        update public.profiles set active_summoner_id = new_sa_id where id = r.id;
    end if;
  end loop;
end;
$$;
