# Setup Guide - Invoice/Quote PDF Builder

Deze guide helpt je om de applicatie van scratch op te zetten.

## Vereisten

### 1. Python 3.11+ installeren

**Windows:**
1. Download Python vanaf [python.org/downloads](https://www.python.org/downloads/)
2. Run de installer
3. ✅ Vink aan: "Add Python to PATH"
4. Klik "Install Now"
5. Verify installatie: open Command Prompt en run:
   ```bash
   python --version
   ```

### 2. Node.js 18+ installeren

**Check of Node.js geïnstalleerd is:**
```bash
node --version
```

Als het geïnstalleerd is, zie je een versienummer (bijv. v24.13.0). ✅ Je hebt dit al!

Als niet geïnstalleerd:
1. Download vanaf [nodejs.org](https://nodejs.org/)
2. Installeer de LTS versie
3. Herstart je terminal

## Supabase Project Setup

### Stap 1: Maak een Supabase account
1. Ga naar [supabase.com](https://supabase.com)
2. Klik "Start your project"
3. Sign up met GitHub/Google/Email

### Stap 2: Maak een nieuw project
1. Klik "New Project"
2. Vul in:
   - **Project name**: invoice-pdf-builder
   - **Database Password**: [kies een sterk wachtwoord - bewaar deze!]
   - **Region**: West EU (Netherlands) - dichtstbij voor snelheid
   - **Pricing Plan**: Free (gratis tier is voldoende voor development)
3. Klik "Create new project"
4. Wacht 2-3 minuten terwijl project wordt aangemaakt

### Stap 3: Maak de templates tabel

1. In je Supabase dashboard, ga naar **SQL Editor** (in sidebar)
2. Klik "New query"
3. Copy-paste deze SQL:

```sql
-- Create templates table
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on created_at for faster sorting
CREATE INDEX idx_templates_created_at ON templates(created_at DESC);

-- Create RLS policies (Row Level Security)
-- For single-user: allow all operations
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations" ON templates
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

4. Klik "Run" (of druk F5)
5. Je zou moeten zien: "Success. No rows returned"

### Stap 4: Maak een Storage Bucket

1. Ga naar **Storage** in de sidebar
2. Klik "Create a new bucket"
3. Vul in:
   - **Name**: `generated-pdfs`
   - **Public bucket**: ✅ Aan (zodat PDFs downloadbaar zijn)
4. Klik "Create bucket"

### Stap 5: Configureer Storage Policies

1. Klik op je `generated-pdfs` bucket
2. Ga naar **Policies** tab
3. Klik "New Policy"

**Policy 1: Public Read Access**
- Template: Custom
- Policy name: "Public Access"
- Definition:
  ```sql
  CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'generated-pdfs');
  ```

**Policy 2: Allow Uploads**
- Policy name: "Allow uploads"
- Definition:
  ```sql
  CREATE POLICY "Allow uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'generated-pdfs');
  ```

### Stap 6: Haal je API credentials op

1. Ga naar **Settings** → **API** in de sidebar
2. Kopieer de volgende gegevens:
   - **Project URL** (bijvoorbeeld: https://abc123.supabase.co)
   - **anon public key** (lange string die begint met "eyJ...")

## Applicatie Setup

### Stap 1: Clone/Download dit project

Als je dit leest, heb je het project waarschijnlijk al! Anders:
```bash
git clone <repository-url>
cd OpenCanvas
```

### Stap 2: Installeer Python dependencies

```bash
pip install -r requirements.txt
```

Of als pip niet werkt:
```bash
python -m pip install -r requirements.txt
```

### Stap 3: Installeer Node.js dependencies

```bash
npm install
```

Dit installeert:
- @pdfme/generator
- @pdfme/ui
- @pdfme/schemas
- express
- cors

### Stap 4: Configureer environment variables

1. Kopieer `.env.example` naar `.env`:
   ```bash
   copy .env.example .env    # Windows
   ```

2. Open `.env` in een text editor

3. Vul je Supabase credentials in:
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://abc123.supabase.co           # Jouw Project URL
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...      # Jouw anon key
   SUPABASE_STORAGE_BUCKET=generated-pdfs

   # Service Configuration (laat deze staan)
   BACKEND_HOST=0.0.0.0
   BACKEND_PORT=8000
   NODE_SERVICE_HOST=localhost
   NODE_SERVICE_PORT=3001

   # Environment
   ENVIRONMENT=development
   DEBUG=true
   ```

4. Save het bestand

## Start de applicatie

### Optie 1: Gebruik het launch script (Aanbevolen)

```bash
python tools/start_invoice_app.py
```

Dit start automatisch:
- Node.js PDF service op port 3001
- FastAPI backend op port 8000

### Optie 2: Manueel starten

**Terminal 1 - Node.js service:**
```bash
npm start
```

**Terminal 2 - FastAPI backend:**
```bash
cd tools
python -m uvicorn invoice_app.app:app --host 0.0.0.0 --port 8000 --reload
```

## Verificatie

### Test de services

**Node.js PDF Service:**
```bash
curl http://localhost:3001/health
```

Verwachte output:
```json
{
  "status": "healthy",
  "service": "pdf-generator",
  "version": "1.0.0",
  "timestamp": "..."
}
```

**FastAPI Backend:**
Open in browser: http://localhost:8000/health

Verwachte output:
```json
{
  "status": "healthy",
  "message": "Service is running",
  "supabase_connected": true,
  "node_service_connected": true
}
```

Als `supabase_connected` of `node_service_connected` `false` is:
- Check je `.env` file
- Check of Supabase project actief is
- Check of Node.js service draait

### Test de API

**Lijst templates (leeg bij eerste keer):**
```bash
curl http://localhost:8000/api/templates
```

Output: `[]` (lege array - normaal voor eerste keer)

## Volgende Stappen

Nu je setup compleet is, ben je klaar voor **Phase 2: Template Designer**!

De applicatie draait op:
- **Frontend**: http://localhost:8000/
- **Designer**: http://localhost:8000/designer (nog te bouwen)
- **Generator**: http://localhost:8000/generator (nog te bouwen)
- **Library**: http://localhost:8000/library (nog te bouwen)
- **API Docs**: http://localhost:8000/docs (FastAPI Swagger docs)

## Troubleshooting

### Python niet gevonden
- Herinstalleer Python met "Add to PATH" optie
- Herstart je terminal/command prompt

### pip niet gevonden
Gebruik: `python -m pip install -r requirements.txt`

### Node.js niet gevonden
- Installeer Node.js vanaf nodejs.org
- Herstart terminal

### Supabase connection failed
- Check of `SUPABASE_URL` en `SUPABASE_KEY` correct zijn in `.env`
- Check of je Supabase project actief is (groen bolletje in dashboard)
- Check of je internet connectie werkt

### Port already in use
Als port 8000 of 3001 al in gebruik is:

1. Wijzig in `.env`:
   ```env
   BACKEND_PORT=8001
   NODE_SERVICE_PORT=3002
   ```

2. Herstart de services

### CORS errors in browser
Dit is normaal voor development. Als het een probleem is:
- Check of backend draait
- Check browser console voor exacte error
- Verify URL klopt (http://localhost:8000, niet https)

## Hulp nodig?

- Check de [plan file](C:\Users\ronan\.claude\plans\snuggly-munching-reddy.md) voor architectuur details
- Kijk in de code comments voor uitleg
- Test met `curl` of Postman voor API debugging
