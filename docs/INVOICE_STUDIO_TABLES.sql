-- ============================================================
-- Invoice Studio - New Tables Migration
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
-- - company_settings table (single-row, company details & preferences)
-- - customers table (customer address book)
-- - documents table (generated invoices & quotes tracking)
-- - Indexes for performance
-- - Row Level Security policies
-- - Updated_at triggers
--
-- ============================================================

-- ============================================================
-- 1. Company Settings (single-row, upsert pattern)
-- ============================================================

CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  company_name TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'Nederland',
  kvk_number TEXT,
  btw_number TEXT,
  iban TEXT,
  phone TEXT,
  email TEXT,

  -- Branding
  logo_base64 TEXT,
  brand_color_primary TEXT DEFAULT '#000000',
  brand_color_secondary TEXT DEFAULT '#008F7A',

  -- Defaults
  default_payment_terms_days INT DEFAULT 30,
  default_btw_percentage DECIMAL(5,2) DEFAULT 21.00,

  -- Invoice numbering
  invoice_number_format TEXT DEFAULT 'F-{YEAR}-{SEQ}',
  invoice_number_next INT DEFAULT 1,
  invoice_number_prefix TEXT DEFAULT 'F',

  -- Quote numbering
  quote_number_format TEXT DEFAULT 'O-{YEAR}-{SEQ}',
  quote_number_next INT DEFAULT 1,
  quote_number_prefix TEXT DEFAULT 'O',

  -- Extra
  footer_text TEXT,
  additional_bank_accounts JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Customers (address book)
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'Nederland',
  email TEXT,
  phone TEXT,
  tax_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. Documents (generated invoices & quotes)
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'quote')),
  document_number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal DECIMAL(12,2) DEFAULT 0,
  btw_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'concept',
  pdf_url TEXT,
  storage_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. Indexes
-- ============================================================

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_name
  ON customers(name);

CREATE INDEX IF NOT EXISTS idx_customers_company_name
  ON customers(company_name);

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_type
  ON documents(document_type);

CREATE INDEX IF NOT EXISTS idx_documents_status
  ON documents(status);

CREATE INDEX IF NOT EXISTS idx_documents_customer_id
  ON documents(customer_id);

CREATE INDEX IF NOT EXISTS idx_documents_date
  ON documents(date DESC);

CREATE INDEX IF NOT EXISTS idx_documents_number
  ON documents(document_number);

-- ============================================================
-- 5. Row Level Security
-- ============================================================

-- Company Settings
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on company_settings" ON company_settings;
CREATE POLICY "Allow all operations on company_settings" ON company_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on customers" ON customers;
CREATE POLICY "Allow all operations on customers" ON customers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on documents" ON documents;
CREATE POLICY "Allow all operations on documents" ON documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 6. Updated_at triggers
-- ============================================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Company Settings
DROP TRIGGER IF EXISTS update_company_settings_updated_at ON company_settings;
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Customers
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Documents
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Verification
-- ============================================================

SELECT 'Invoice Studio tables created successfully!' as status;

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('company_settings', 'customers', 'documents')
ORDER BY table_name, ordinal_position;
