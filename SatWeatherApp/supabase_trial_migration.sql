-- Add trial support to subscriptions table
-- Run this in your Supabase SQL Editor to enable free trial functionality

-- Add trial tracking columns
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;

-- Create an index on trial_ends_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends_at ON subscriptions(trial_ends_at);

-- Comment the columns for documentation
COMMENT ON COLUMN subscriptions.trial_started_at IS 'Timestamp when the user started their free trial';
COMMENT ON COLUMN subscriptions.trial_ends_at IS 'Timestamp when the free trial expires (7 days after start)';
COMMENT ON COLUMN subscriptions.trial_used IS 'Whether the user has already used their one-time free trial';
