-- ============================================================
-- Feature Migration: Activity Log + Price Items
-- Phase 1 of the InvoiceStudio feature extensions
-- ============================================================

-- 1. ACTIVITY LOG — Central audit trail for all actions
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    document_id UUID,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    action TEXT NOT NULL,
    detail JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_document_id ON activity_log(document_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity" ON activity_log
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activity" ON activity_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 2. PRICE ITEMS — Service/product catalog
CREATE TABLE IF NOT EXISTS price_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit TEXT DEFAULT 'stuk',
    btw_percentage NUMERIC(5,2) DEFAULT 21,
    default_quantity NUMERIC(10,2) DEFAULT 1,
    sku TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_items_user_id ON price_items(user_id);
CREATE INDEX IF NOT EXISTS idx_price_items_category ON price_items(user_id, category);
CREATE INDEX IF NOT EXISTS idx_price_items_active ON price_items(user_id, is_active) WHERE is_active = TRUE;

ALTER TABLE price_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own price items" ON price_items
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own price items" ON price_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own price items" ON price_items
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own price items" ON price_items
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- Phase 3: Document Sending + Email Tracking
-- ============================================================

-- 3. DOCUMENT SENDS — Email send tracking
CREATE TABLE IF NOT EXISTS document_sends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    provider TEXT DEFAULT 'manual',
    provider_message_id TEXT,
    provider_thread_id TEXT,
    delivery_status TEXT DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_sends_user ON document_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_document_sends_document ON document_sends(document_id);
CREATE INDEX IF NOT EXISTS idx_document_sends_status ON document_sends(delivery_status);

ALTER TABLE document_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sends" ON document_sends
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sends" ON document_sends
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sends" ON document_sends
    FOR UPDATE USING (auth.uid() = user_id);

-- 4. ALTER documents — add sending-related columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_sent_email TEXT;

-- 5. ALTER company_settings — add email template fields
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS email_from_name TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS email_from_address TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS email_reply_to TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS email_invoice_subject TEXT DEFAULT 'Invoice {NUMBER} from {COMPANY}';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS email_invoice_body TEXT DEFAULT 'Dear {CUSTOMER},

Please find attached invoice {NUMBER} for the amount of {TOTAL}.

Payment is due by {DUE_DATE}.

Kind regards,
{COMPANY}';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS email_quote_subject TEXT DEFAULT 'Quote {NUMBER} from {COMPANY}';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS email_quote_body TEXT DEFAULT 'Dear {CUSTOMER},

Please find attached our quote {NUMBER} for the amount of {TOTAL}.

This quote is valid for 30 days.

Kind regards,
{COMPANY}';


-- ============================================================
-- Phase 4: Email Reply Detection + Webhooks
-- ============================================================

-- 6. EMAIL EVENTS — Inbound email events (replies, bounces, opens)
CREATE TABLE IF NOT EXISTS email_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    document_send_id UUID REFERENCES document_sends(id) ON DELETE SET NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    from_email TEXT,
    subject TEXT,
    body_snippet TEXT,
    raw_payload JSONB DEFAULT '{}',
    detected_intent TEXT,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_events_user ON email_events(user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_document ON email_events(document_id);
CREATE INDEX IF NOT EXISTS idx_email_events_send ON email_events(document_send_id);
CREATE INDEX IF NOT EXISTS idx_email_events_unprocessed ON email_events(user_id, processed) WHERE processed = FALSE;

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email events" ON email_events
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own email events" ON email_events
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert email events" ON email_events
    FOR INSERT WITH CHECK (TRUE);


-- ============================================================
-- Phase 5: Recurring Invoices + Automations
-- ============================================================

-- 7. ALTER documents — add recurring/source columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS recurring_rule_id UUID;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_document_id UUID;

-- 8. RECURRING RULES — Automation definitions
CREATE TABLE IF NOT EXISTS recurring_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    source_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    customer_id UUID,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    interval_days INTEGER,
    day_of_month INTEGER,
    day_of_week INTEGER,
    auto_send BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    end_date DATE,
    max_occurrences INTEGER,
    occurrences_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_rules_user ON recurring_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_active ON recurring_rules(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_recurring_rules_next_run ON recurring_rules(next_run_at) WHERE is_active = TRUE;

ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring rules" ON recurring_rules
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring rules" ON recurring_rules
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring rules" ON recurring_rules
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring rules" ON recurring_rules
    FOR DELETE USING (auth.uid() = user_id);

-- 9. RECURRING RUNS — Execution log (immutable)
CREATE TABLE IF NOT EXISTS recurring_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    rule_id UUID NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending',
    created_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    send_id UUID,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE(rule_id, scheduled_at)
);

CREATE INDEX IF NOT EXISTS idx_recurring_runs_user ON recurring_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_runs_rule ON recurring_runs(rule_id);
CREATE INDEX IF NOT EXISTS idx_recurring_runs_status ON recurring_runs(status);

ALTER TABLE recurring_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring runs" ON recurring_runs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert recurring runs" ON recurring_runs
    FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Service can update recurring runs" ON recurring_runs
    FOR UPDATE USING (TRUE);
