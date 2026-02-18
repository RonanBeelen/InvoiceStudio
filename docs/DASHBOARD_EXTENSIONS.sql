-- ============================================================
-- Dashboard Extensions - Usage Tracking & Metadata
-- ============================================================
--
-- Instructions:
-- 1. Go to your Supabase dashboard
-- 2. Navigate to SQL Editor
-- 3. Create a new query
-- 4. Copy and paste this entire file
-- 5. Click "Run" or press F5
--
-- This script adds:
-- - thumbnail_base64 column to templates table
-- - payment_status column to templates table
-- - usage_logs table for PDF generation tracking
-- - Indexes for performance
-- - Row Level Security policies
--
-- ============================================================

-- 1. Add columns to templates table
ALTER TABLE templates
ADD COLUMN IF NOT EXISTS thumbnail_base64 TEXT;

ALTER TABLE templates
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'free';

-- 2. Create usage_logs table for tracking PDF generations
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  pdf_filename TEXT,
  generation_time_ms INT,
  file_size_bytes INT,
  input_data JSONB
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_template
  ON usage_logs(template_id);

CREATE INDEX IF NOT EXISTS idx_usage_logs_generated_at
  ON usage_logs(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_templates_payment_status
  ON templates(payment_status);

-- 4. Enable Row Level Security on usage_logs
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations on usage_logs" ON usage_logs;

-- Create policy for usage_logs (single-user mode for now)
CREATE POLICY "Allow all operations on usage_logs" ON usage_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Verification Queries
-- ============================================================

-- Check if extensions were applied successfully
SELECT 'Dashboard extensions applied successfully!' as status;

-- Show templates table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'templates'
  AND column_name IN ('thumbnail_base64', 'payment_status')
ORDER BY ordinal_position;

-- Show usage_logs table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'usage_logs'
ORDER BY ordinal_position;

-- Count existing data
SELECT
  (SELECT COUNT(*) FROM templates) as template_count,
  (SELECT COUNT(*) FROM usage_logs) as usage_log_count;

-- ============================================================
-- Optional: Sample data for testing
-- ============================================================

-- Uncomment to insert sample usage log
/*
INSERT INTO usage_logs (template_id, pdf_filename, file_size_bytes)
SELECT id, 'test_sample.pdf', 150000
FROM templates
LIMIT 1;
*/
