-- Restrict match_cache: remove UPDATE policy
-- Match cache data is immutable once inserted (public Riot API data).
-- The upsert in matchService.ts uses ignoreDuplicates: true, so UPDATE is not needed.

drop policy if exists "Allow Auth Update Match Cache" on public.match_cache;
