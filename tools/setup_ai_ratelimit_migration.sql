-- AI Template Generation Rate Limiting
-- Run in Supabase Dashboard > SQL Editor
--
-- Tracks AI template generations per user for rate limiting (3 per month)

CREATE TABLE IF NOT EXISTS ai_generation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'success',  -- 'success' or 'error'
    file_type TEXT,                 -- 'pdf', 'png', 'jpeg'
    file_size_bytes INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_user_id ON ai_generation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_created_at ON ai_generation_logs(created_at);

-- RLS
ALTER TABLE ai_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai logs" ON ai_generation_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage ai logs" ON ai_generation_logs
    FOR ALL USING (true) WITH CHECK (true);
