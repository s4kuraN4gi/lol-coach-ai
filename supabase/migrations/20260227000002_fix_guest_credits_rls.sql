-- Fix: Remove overly permissive anon RLS policy on guest_credits
-- All guest credit operations use Service Role client (bypasses RLS),
-- so anon role should NOT have direct access to the table.

-- Drop the wide-open anon policy
DROP POLICY IF EXISTS "Allow anonymous access to guest_credits" ON guest_credits;

-- Also secure the RPC functions with SECURITY DEFINER
-- so they execute with the definer's privileges regardless of caller role
CREATE OR REPLACE FUNCTION replenish_guest_credits(p_ip_address TEXT)
RETURNS TABLE(current_credits INT, can_use BOOLEAN) AS $$
DECLARE
    v_record guest_credits%ROWTYPE;
    v_days_since_use NUMERIC;
    v_credits_to_add INT;
BEGIN
    SELECT * INTO v_record FROM guest_credits WHERE ip_address = p_ip_address;

    IF NOT FOUND THEN
        INSERT INTO guest_credits (ip_address, credits)
        VALUES (p_ip_address, 3)
        RETURNING * INTO v_record;

        RETURN QUERY SELECT v_record.credits, true;
        RETURN;
    END IF;

    IF v_record.last_used_at IS NOT NULL THEN
        v_days_since_use := EXTRACT(EPOCH FROM (NOW() - v_record.last_used_at)) / 86400;
        v_credits_to_add := FLOOR(v_days_since_use / 3)::INT;

        IF v_credits_to_add > 0 THEN
            UPDATE guest_credits
            SET credits = LEAST(3, credits + v_credits_to_add)
            WHERE ip_address = p_ip_address
            RETURNING * INTO v_record;
        END IF;
    END IF;

    RETURN QUERY SELECT v_record.credits, (v_record.credits > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION use_guest_credit(p_ip_address TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_credits INT;
BEGIN
    SELECT current_credits INTO v_credits FROM replenish_guest_credits(p_ip_address);

    IF v_credits <= 0 THEN
        RETURN false;
    END IF;

    UPDATE guest_credits
    SET credits = credits - 1,
        last_used_at = NOW()
    WHERE ip_address = p_ip_address;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
