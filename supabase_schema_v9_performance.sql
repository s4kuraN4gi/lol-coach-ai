-- Phase 11: Performance Optimization (Match Caching)

-- 1. Create table for caching detailed match data (avoiding Riot API rate limits)
create table if not exists public.match_cache (
    match_id text primary key not null,
    data jsonb not null, -- The full JSON response from Riot match-v5/matches/{id}
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- 2. Index for faster lookups (though PK is usually enough)
-- create index if not exists match_cache_id_idx on public.match_cache (match_id);

-- 3. RLS Policies
alter table public.match_cache enable row level security;

-- Everyone can read (it's public match data)
create policy "Public Read Match Cache" on public.match_cache
    for select using (true);

-- Only Service Role can insert (Server Actions)
-- Or authenticated users can insert if they fetch it (to distribute load)?
-- Let's stick to Service Role or "Authenticated" for now.
create policy "Auth Insert Match Cache" on public.match_cache
    for insert with check (auth.role() = 'authenticated');

-- Optional: Periodic cleanup (not implemented in SQL, but good to note)
-- We might want to clear old cache after patches, but Match V5 is persistent.
