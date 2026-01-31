-- Fix: Allow Users to Update their own Summoner Accounts
-- Required for caching Match IDs and Ranks

create policy "Users can update their own summoner accounts." on public.summoner_accounts
  for update using ((select auth.uid()) = user_id);
