-- Guest credits table for IP-based rate limiting
-- Guests get 1 credit per 3 days, max 3 credits

CREATE TABLE guest_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL UNIQUE,
    credits INT DEFAULT 3 CHECK (credits >= 0 AND credits <= 3),
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast IP lookup
CREATE INDEX idx_guest_credits_ip ON guest_credits(ip_address);

-- Enable RLS
ALTER TABLE guest_credits ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read/update their own credits (matched by IP in application code)
-- Note: Actual IP matching is done in server-side code, not in RLS policies
CREATE POLICY "Allow anonymous access to guest_credits"
    ON guest_credits
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_guest_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER trigger_guest_credits_updated_at
    BEFORE UPDATE ON guest_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_credits_updated_at();

-- Function to replenish credits (1 per 3 days, max 3)
-- This can be called before checking credits
CREATE OR REPLACE FUNCTION replenish_guest_credits(p_ip_address TEXT)
RETURNS TABLE(current_credits INT, can_use BOOLEAN) AS $$
DECLARE
    v_record guest_credits%ROWTYPE;
    v_days_since_use NUMERIC;
    v_credits_to_add INT;
BEGIN
    -- Get or create record
    SELECT * INTO v_record FROM guest_credits WHERE ip_address = p_ip_address;

    IF NOT FOUND THEN
        -- New guest, create with 3 credits
        INSERT INTO guest_credits (ip_address, credits)
        VALUES (p_ip_address, 3)
        RETURNING * INTO v_record;

        RETURN QUERY SELECT v_record.credits, true;
        RETURN;
    END IF;

    -- Calculate credits to replenish
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
$$ LANGUAGE plpgsql;

-- Function to use a credit
CREATE OR REPLACE FUNCTION use_guest_credit(p_ip_address TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_credits INT;
BEGIN
    -- First replenish
    SELECT current_credits INTO v_credits FROM replenish_guest_credits(p_ip_address);

    IF v_credits <= 0 THEN
        RETURN false;
    END IF;

    -- Deduct credit
    UPDATE guest_credits
    SET credits = credits - 1,
        last_used_at = NOW()
    WHERE ip_address = p_ip_address;

    RETURN true;
END;
$$ LANGUAGE plpgsql;
