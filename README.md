# OpenCanvas - Invoice/Quote PDF Builder

Een web applicatie gebouwd met het **WAT framework** (Workflows, Agents, Tools) voor het visueel ontwerpen en genereren van factuur en offerte PDFs.

## Features

✨ **Visuele Template Designer** - Drag-and-drop interface voor het maken van PDF templates
📄 **PDF Generatie** - Vul templates in met eigen data en genereer professionele PDFs
💾 **Cloud Storage** - Templates en PDFs opgeslagen in Supabase
🎨 **Aanpasbaar** - Volledig configureerbare templates met tekst, afbeeldingen, QR codes, etc.

## Quick Start

### 1. Installeer Dependencies

```bash
# Python packages
pip install -r requirements.txt

# Node.js packages
npm install
```

### 2. Configureer Supabase

Zie [SETUP.md](SETUP.md) voor gedetailleerde instructies.

Quick setup:
1. Maak een gratis Supabase account
2. Run de SQL in [docs/SUPABASE_SETUP.sql](docs/SUPABASE_SETUP.sql)
3. Kopieer je API credentials naar `.env`

### 3. Start de Applicatie

```bash
python tools/start_invoice_app.py
```

De applicatie draait nu op:
- Frontend: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

## Tech Stack

- **Frontend**: Vanilla JavaScript + pdfme library
- **Backend**: Python FastAPI
- **PDF Engine**: Node.js + @pdfme/generator
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage

## WAT Framework Architecture

Dit project gebruikt het WAT framework voor betrouwbare AI-gedreven automatisering:

- **Workflows** (`workflows/`): Markdown SOPs die definiëren wat te doen en hoe
- **Agents**: AI layer die workflows leest en executie orkestreert
- **Tools** (`tools/`): Python en Node.js scripts voor deterministische uitvoering

## Project Structure

```
frontend/               # Web UI (designer, generator, library)
tools/
  ├── invoice_app/     # FastAPI backend
  │   ├── app.py       # Main application
  │   ├── routes.py    # API endpoints
  │   ├── models.py    # Pydantic models
  │   └── supabase_client.py
  ├── node_service/    # PDF generation service
  │   ├── pdf_service.js
  │   └── start_service.js
  └── start_invoice_app.py  # Launcher script
workflows/             # WAT workflows
docs/                  # Documentation & SQL scripts
.env                   # Environment variables (niet in git)
```

## API Endpoints

### Templates
- `GET /api/templates` - Lijst alle templates
- `GET /api/templates/{id}` - Haal specifieke template op
- `POST /api/templates` - Maak nieuwe template
- `PUT /api/templates/{id}` - Update template
- `DELETE /api/templates/{id}` - Verwijder template

### PDF Generation (Phase 3)
- `POST /api/generate-pdf` - Genereer PDF van template + data

Volledige API documentatie: http://localhost:8000/docs

## Development Roadmap

- [x] **Phase 1**: Foundation & Supabase Setup ✅
- [x] **Phase 2**: Template Designer ✅
  - Designer met pdfme builtInPlugins
  - Template CRUD API (create, read, update, delete)
  - Template Library page met overzicht
- [ ] **Phase 3**: PDF Generation (NEXT)
- [ ] **Phase 4**: Polish & Deployment

Zie [plan file](C:\Users\ronan\.claude\plans\snuggly-munching-reddy.md) voor details.

## Documentatie

- [SETUP.md](SETUP.md) - Uitgebreide setup instructies
- [Plan](C:\Users\ronan\.claude\plans\snuggly-munching-reddy.md) - Implementatie plan
- [CLAUDE.md](CLAUDE.md) - WAT framework instructies

## Troubleshooting

Zie [SETUP.md - Troubleshooting](SETUP.md#troubleshooting) voor veelvoorkomende problemen.

## License

MIT
