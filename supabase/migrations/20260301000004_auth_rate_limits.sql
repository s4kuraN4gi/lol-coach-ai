-- Distributed auth rate limiting (replaces in-memory Map)
-- Works correctly across Vercel serverless instances

CREATE TABLE IF NOT EXISTS auth_rate_limits (
    ip TEXT PRIMARY KEY,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
-- No RLS policies: all access goes through SECURITY DEFINER RPCs

-- Atomic check-and-increment: returns TRUE if rate limited
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_ip TEXT,
    p_max_attempts INTEGER DEFAULT 10,
    p_window_seconds INTEGER DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO auth_rate_limits (ip, attempt_count, window_start)
    VALUES (p_ip, 1, now())
    ON CONFLICT (ip) DO UPDATE
    SET
        attempt_count = CASE
            WHEN auth_rate_limits.window_start + make_interval(secs => p_window_seconds) < now()
            THEN 1
            ELSE auth_rate_limits.attempt_count + 1
        END,
        window_start = CASE
            WHEN auth_rate_limits.window_start + make_interval(secs => p_window_seconds) < now()
            THEN now()
            ELSE auth_rate_limits.window_start
        END
    RETURNING attempt_count INTO v_count;

    RETURN v_count > p_max_attempts;
END;
$$;

-- Allow anon role to call (pre-auth check, no user session exists)
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) TO anon;

-- Cleanup stale entries (called by scheduled cron or manually)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM auth_rate_limits
    WHERE window_start < now() - interval '10 minutes';
END;
$$;
