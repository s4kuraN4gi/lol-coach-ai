-- Add Stripe subscription fields to profiles table
alter table profiles
add column if not exists is_premium boolean default false,
add column if not exists stripe_customer_id text,
add column if not exists stripe_subscription_id text,
add column if not exists subscription_status text check (subscription_status in ('active', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid')),
add column if not exists subscription_end_date timestamptz;

-- Index for faster lookups by stripe_customer_id
create index if not exists idx_profiles_stripe_customer_id on profiles(stripe_customer_id);

-- RLS should already be enabled, but ensure users can view their own data
-- Existing policies likely cover this, but good to double check manually if needed.
