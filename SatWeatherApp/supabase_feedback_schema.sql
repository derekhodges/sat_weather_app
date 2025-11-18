-- User Feedback Table Schema
-- Run this SQL in your Supabase SQL Editor to create the feedback table

-- Create user_feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug_report', 'feature_request', 'general', 'performance', 'ui_ux')),
  email TEXT,
  platform TEXT NOT NULL,
  platform_version TEXT,
  app_version TEXT,
  error_logs JSONB,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_category ON user_feedback(category);
CREATE INDEX IF NOT EXISTS idx_user_feedback_submitted_at ON user_feedback(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_platform ON user_feedback(platform);

-- Enable Row Level Security (RLS)
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies

-- Policy: Allow anyone to insert feedback (authenticated or anonymous)
CREATE POLICY "Anyone can submit feedback"
  ON user_feedback
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Policy: Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
  ON user_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role can view all feedback (for admin dashboard)
-- This is automatically enabled for service role

-- Optional: Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_feedback_updated_at
  BEFORE UPDATE ON user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create a view for feedback statistics (admin use)
CREATE OR REPLACE VIEW feedback_stats AS
SELECT
  category,
  COUNT(*) as total_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE submitted_at >= NOW() - INTERVAL '7 days') as count_last_7_days,
  COUNT(*) FILTER (WHERE submitted_at >= NOW() - INTERVAL '30 days') as count_last_30_days,
  platform,
  DATE_TRUNC('day', submitted_at) as date
FROM user_feedback
GROUP BY category, platform, DATE_TRUNC('day', submitted_at);

-- Grant access to the view (only for authenticated users with admin role, if you have role-based access)
-- GRANT SELECT ON feedback_stats TO authenticated;

-- Comments for documentation
COMMENT ON TABLE user_feedback IS 'Stores user feedback including bug reports, feature requests, and general feedback';
COMMENT ON COLUMN user_feedback.id IS 'Unique identifier for each feedback entry';
COMMENT ON COLUMN user_feedback.user_id IS 'Reference to the user who submitted the feedback (nullable for anonymous feedback)';
COMMENT ON COLUMN user_feedback.message IS 'The feedback message from the user';
COMMENT ON COLUMN user_feedback.category IS 'Category of feedback: bug_report, feature_request, general, performance, or ui_ux';
COMMENT ON COLUMN user_feedback.email IS 'Optional email for follow-up contact';
COMMENT ON COLUMN user_feedback.platform IS 'Platform where feedback was submitted (ios, android, web)';
COMMENT ON COLUMN user_feedback.platform_version IS 'Version of the platform OS';
COMMENT ON COLUMN user_feedback.app_version IS 'Version of the app when feedback was submitted';
COMMENT ON COLUMN user_feedback.error_logs IS 'JSON array of error logs if included with feedback';
COMMENT ON COLUMN user_feedback.submitted_at IS 'When the feedback was submitted by the user';
COMMENT ON COLUMN user_feedback.created_at IS 'When the record was created in the database';
COMMENT ON COLUMN user_feedback.updated_at IS 'When the record was last updated';
