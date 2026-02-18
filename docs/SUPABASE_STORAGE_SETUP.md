# Supabase Storage Setup voor PDF Generatie

## Stap 1: Bucket Aanmaken

1. Ga naar je Supabase Dashboard: https://supabase.com/dashboard
2. Selecteer je project
3. Ga naar **Storage** in het linkermenu
4. Klik op **"New bucket"**
5. Vul in:
   - **Name**: `generated-pdfs`
   - **Public bucket**: ✅ **Aanvinken** (zodat PDFs publiek toegankelijk zijn)
   - **File size limit**: 50 MB (default is OK)
   - **Allowed MIME types**: `application/pdf` (of laat leeg voor alle types)

6. Klik **"Create bucket"**

## Stap 2: Bucket Policies Instellen

De bucket moet publiek leesbaar zijn zodat gegenereerde PDFs gedownload kunnen worden.

### Optie A: Via SQL Editor (Recommended)

1. Ga naar **SQL Editor** in Supabase Dashboard
2. Voer dit SQL commando uit:

```sql
-- Allow public read access to generated PDFs
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'generated-pdfs');

-- Allow authenticated uploads (for now: allow all, later restrict to specific users)
CREATE POLICY "Allow uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'generated-pdfs');

-- Allow deletions (optional, for cleanup)
CREATE POLICY "Allow deletions"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'generated-pdfs');
```

### Optie B: Via Dashboard UI

1. Ga naar **Storage** > **Policies**
2. Voor de `storage.objects` tabel:

**Policy 1: Public Read Access**
- Policy name: `Public Access`
- Allowed operation: `SELECT`
- Target roles: `public` (of `anon`)
- USING expression: `bucket_id = 'generated-pdfs'`

**Policy 2: Allow Uploads**
- Policy name: `Allow uploads`
- Allowed operation: `INSERT`
- Target roles: `anon` (of `authenticated` voor later)
- WITH CHECK expression: `bucket_id = 'generated-pdfs'`

**Policy 3: Allow Deletions (optional)**
- Policy name: `Allow deletions`
- Allowed operation: `DELETE`
- Target roles: `anon`
- USING expression: `bucket_id = 'generated-pdfs'`

## Stap 3: Verificatie

Test of de bucket correct is ingesteld:

```bash
# Test upload via API (gebruik je SUPABASE_KEY uit .env)
curl -X POST \
  https://YOUR_PROJECT.supabase.co/storage/v1/object/generated-pdfs/test.pdf \
  -H "apikey: YOUR_SUPABASE_KEY" \
  -H "Authorization: Bearer YOUR_SUPABASE_KEY" \
  -H "Content-Type: application/pdf" \
  --data-binary "@test.pdf"

# Test public access
curl https://YOUR_PROJECT.supabase.co/storage/v1/object/public/generated-pdfs/test.pdf
```

Of test via de applicatie:
1. Start de app: `python tools/start_invoice_app.py`
2. Maak een template in de Designer
3. Ga naar Generator page (als deze klaar is)
4. Genereer een PDF
5. Check of de PDF downloadbaar is via de URL

## Troubleshooting

### Error: "Bucket not found"
- Controleer of de bucket naam exact `generated-pdfs` is
- Check of de bucket is aangemaakt in het juiste project

### Error: "Permission denied" bij upload
- Controleer of de INSERT policy is ingesteld
- Check of je de juiste `apikey` en `Authorization` headers gebruikt

### Error: "404 Not Found" bij download
- Controleer of de SELECT policy voor publieke toegang is ingesteld
- Verifieer dat de bucket als "Public" is ingesteld

### PDFs zijn niet publiek toegankelijk
- Controleer of "Public bucket" is aangevinkt bij bucket creation
- Alternatief: gebruik signed URLs (vereist code aanpassing)

## Opschoning (Optional)

Als je automatisch oude PDFs wilt verwijderen:

1. Ga naar **Database** > **Functions**
2. Maak een nieuwe function:

```sql
CREATE OR REPLACE FUNCTION cleanup_old_pdfs()
RETURNS void AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'generated-pdfs'
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

3. Maak een cron job (via Supabase Cron of externe scheduler):

```sql
-- Run cleanup weekly (requires pg_cron extension)
SELECT cron.schedule(
  'cleanup-old-pdfs',
  '0 0 * * 0',  -- Every Sunday at midnight
  'SELECT cleanup_old_pdfs()'
);
```

## Security Notes

**Voor productie**:
- Beperk INSERT policy tot `authenticated` role
- Voeg user_id checking toe aan policies
- Overweeg signed URLs in plaats van publieke bucket
- Stel file size limits in
- Monitor storage usage

**Voorbeeld policy voor multi-user (later)**:
```sql
CREATE POLICY "Users can only upload own PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'generated-pdfs' AND
    auth.uid() = owner
  );
```
