-- Fix race condition in use_guest_credit: make credit deduction atomic
-- Previous version: SELECT credits → check → UPDATE (TOCTOU vulnerability)
-- New version: replenish first, then atomic UPDATE WHERE credits > 0

CREATE OR REPLACE FUNCTION use_guest_credit(p_ip_address TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_updated_count INT;
BEGIN
    -- First replenish credits (idempotent)
    PERFORM replenish_guest_credits(p_ip_address);

    -- Atomic deduction: UPDATE only if credits > 0
    UPDATE guest_credits
    SET credits = credits - 1,
        last_used_at = NOW()
    WHERE ip_address = p_ip_address
      AND credits > 0;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN v_updated_count > 0;
END;
$$ LANGUAGE plpgsql;
