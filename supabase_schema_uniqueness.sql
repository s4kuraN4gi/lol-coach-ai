-- RPC to check if a summoner PUUID is already taken by ANY user.
-- SECURITY DEFINER allows this function to bypass RLS.
-- It returns TRUE if the summoner exists (is taken), FALSE otherwise.

CREATE OR REPLACE FUNCTION check_summoner_taken(target_puuid text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.summoner_accounts 
    WHERE puuid = target_puuid
  );
END;
$$;
