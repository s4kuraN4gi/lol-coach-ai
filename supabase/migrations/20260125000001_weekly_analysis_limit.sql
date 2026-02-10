-- Weekly Analysis Limit Migration
-- Changes from daily 50 limit to weekly 100 limit for premium users

-- Add new columns for weekly tracking
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS weekly_analysis_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Initialize weekly_reset_date to next Monday for existing users
UPDATE profiles
SET weekly_reset_date = (
    DATE_TRUNC('week', NOW()) + INTERVAL '7 days'
)
WHERE weekly_reset_date IS NULL OR weekly_reset_date = NOW();

-- Reset weekly_analysis_count for all users (fresh start)
UPDATE profiles SET weekly_analysis_count = 0;

-- Comment for documentation
COMMENT ON COLUMN profiles.weekly_analysis_count IS 'Number of analyses used this week (resets every Monday)';
COMMENT ON COLUMN profiles.weekly_reset_date IS 'Date when weekly_analysis_count resets (always a Monday)';
