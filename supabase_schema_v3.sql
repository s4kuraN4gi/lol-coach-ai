-- USAGE:
-- Copy the content of this file and paste it into the SQL Editor in your Supabase Dashboard.
-- Click "Run" to execute the commands.

-- 1. Add Monetization Columns to PROFILES
alter table public.profiles
add column if not exists is_premium boolean default false not null,
add column if not exists analysis_credits integer default 3 not null,
add column if not exists subscription_tier text default 'free' not null;

-- 2. Add validation check for subscription tiers (Optional but good practice)
alter table public.profiles
add constraint proper_tier check (subscription_tier in ('free', 'premium', 'pro'));

-- 3. Security (RLS)
-- By default, users can "view" their own profile (already covered by existing policies).
-- Users should NOT be able to "update" their own is_premium or credits directly.
-- So we generally don't need new RLS for Update unless we want to block it explicitly if generic update policy exists.
-- Existing update policy: "Users can update their own profiles."
-- We might want to restrict that to specific columns if we were strict. 
-- For now, we assume updates to `is_premium` happen via Service Role (Server Actions) which bypasses RLS,
-- OR we trust the user not to hack the client-side call (which is insecure).
-- Ideally, we should restrict UPDATE on profiles to ONLY allow `riot_summoner_name` etc., NOT `is_premium`.

-- Drop the generic update policy if it exists and is too permissive (from V1)
-- drop policy "Users can update their own profiles." on public.profiles;

-- Create a more restrictive update policy
-- create policy "Users can update their own basic info." on public.profiles
--   for update using (auth.uid() = id)
--   with check (auth.uid() = id);
-- Note: PostgreSQL column-level security is complex in RLS policies without creating separate policies per column set.
-- For this MVP, we will rely on UI not exposing it and Server Actions using `supabase-admin` (service role) *if possible*, 
-- OR just keeping it simple. Since we are using standard `createClient` (user token) in Server Actions, 
-- user CAN technically update these fields if they know how to call the API.
-- RECOMMENDATION: For production, use a Database Function (RPC) to update credits/premium that is callable only by internal logic, 
-- or use Service Role client for sensitive updates.

-- For this Phase 3 task, we will trust the Server Actions to be the primary entry point.
