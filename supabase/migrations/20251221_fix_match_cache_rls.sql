-- Fix: Allow Authenticated Users to Read Match Cache
-- Required for displaying cached matches

-- 1. Enable RLS (Ensure it is enabled)
alter table public.match_cache enable row level security;

-- 2. Drop existing restrictive policies if any (Clean slate)
drop policy if exists "Public Read Match Cache" on public.match_cache;
drop policy if exists "Auth Insert Match Cache" on public.match_cache;

-- 3. Create Permissive Policies
-- Allow anyone logged in to READ cached matches (matches are public data essentially)
create policy "Allow Auth Read Match Cache" on public.match_cache
  for select using (auth.role() = 'authenticated');

-- Allow anyone logged in to INSERT (if they fetched it from Riot)
create policy "Allow Auth Insert Match Cache" on public.match_cache
  for insert with check (auth.role() = 'authenticated');

-- Allow anyone logged in to UPDATE (if they re-fetched it)
create policy "Allow Auth Update Match Cache" on public.match_cache
  for update using (auth.role() = 'authenticated');
