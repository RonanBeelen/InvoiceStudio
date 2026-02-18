-- ====================================================================
-- Supabase Database Setup SQL
-- Invoice/Quote PDF Builder
-- ====================================================================
--
-- Instructions:
-- 1. Go to your Supabase dashboard
-- 2. Navigate to SQL Editor
-- 3. Create a new query
-- 4. Copy and paste this entire file
-- 5. Click "Run" or press F5
--
-- ====================================================================

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_templates_created_at
ON templates(created_at DESC);

-- Create index on name for searching
CREATE INDEX IF NOT EXISTS idx_templates_name
ON templates USING gin(to_tsvector('english', name));

-- ====================================================================
-- Row Level Security (RLS)
-- ====================================================================

-- Enable RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations" ON templates;

-- Single-user policy: Allow all operations
-- (For multi-user in future, replace with user-specific policies)
CREATE POLICY "Allow all operations" ON templates
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ====================================================================
-- Triggers
-- ====================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists
DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;

-- Create trigger for templates table
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- Sample Data (Optional)
-- ====================================================================

-- Uncomment below to insert a sample template for testing

/*
INSERT INTO templates (name, description, template_json)
VALUES (
  'Sample Invoice Template',
  'A simple invoice template for testing',
  '{
    "basePdf": "BLANK_PDF",
    "schemas": [
      [
        {
          "name": "invoice_number",
          "type": "text",
          "position": {"x": 20, "y": 20},
          "width": 60,
          "height": 10,
          "fontSize": 14,
          "fontColor": "#000000"
        },
        {
          "name": "customer_name",
          "type": "text",
          "position": {"x": 20, "y": 40},
          "width": 100,
          "height": 10,
          "fontSize": 12,
          "fontColor": "#000000"
        },
        {
          "name": "total_amount",
          "type": "text",
          "position": {"x": 20, "y": 60},
          "width": 60,
          "height": 10,
          "fontSize": 16,
          "fontColor": "#000000"
        }
      ]
    ]
  }'::jsonb
);
*/

-- ====================================================================
-- Verification Queries
-- ====================================================================

-- Check if table was created successfully
SELECT 'Templates table created successfully' as status,
       COUNT(*) as template_count
FROM templates;

-- Show table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'templates'
ORDER BY ordinal_position;

-- ====================================================================
-- Storage Bucket Setup (Manual - Run in Supabase Dashboard)
-- ====================================================================

/*
MANUAL STEPS FOR STORAGE:

1. Go to Storage in Supabase dashboard
2. Click "Create a new bucket"
3. Bucket name: generated-pdfs
4. Public bucket: YES (checked)
5. Click "Create bucket"

Then create policies:

POLICY 1 - Public Read Access:
---------------------------------
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-pdfs');

POLICY 2 - Allow Uploads:
---------------------------------
CREATE POLICY "Allow uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'generated-pdfs');

POLICY 3 - Allow Deletes:
---------------------------------
CREATE POLICY "Allow deletes"
ON storage.objects FOR DELETE
USING (bucket_id = 'generated-pdfs');
*/
