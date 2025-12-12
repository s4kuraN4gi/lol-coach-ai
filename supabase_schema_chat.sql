-- Add Daily Chat Limit Columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_chat_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_chat_reset timestamp with time zone DEFAULT now();

-- Ensure profile policies allow update (usually already exists, but good to double check or just add columns)
-- No RLS changes needed if users can already update their own profile or if service role handles it.
