# SourceStudio AI

SourceStudio AI ist ein lokaler, NotebookLM-inspirierter Research Workspace. Die App bildet nicht nur eine Oberfläche nach, sondern implementiert eine quellengebundene Research-Pipeline: Quellen importieren, strukturieren, aktivieren oder deaktivieren, Wissen extrahieren, Fragen beantworten, Citations prüfen und daraus Artefakte wie Reports, Mind Maps, Quizze, Flashcards, Slide Decks, Audio Briefings und Video Storyboards erzeugen.

Der zentrale Qualitätsanspruch ist: Antworten und Artefakte entstehen nachvollziehbar aus den aktiven Quellen. Dafür nutzt die App Evidence Packs, Source Blocks, Citation Chips und ein Citation Ledger.

SourceStudio AI ist kein offizielles Google- oder NotebookLM-Produkt.

## Produktidee

Die wichtigste Produktidee ist nicht PDF hochladen und chatten, sondern ein kontrollierter Wissensraum: Quellen sind die Autorität. Der Chat und alle Studio-Artefakte greifen auf dieselbe strukturierte Evidence-Schicht zu.

## Funktionen

- Notebook Workspace mit Sources, Chat und Studio.
- Markdown/Text-Ingestion.
- Notes als first-class Sources.
- URL-Ingestion mit serverseitigem Fetch und HTML-Cleanup.
- PDF-Dateien mit lokalem Text-Extraction-Fallback für Demo-Szenarien.
- Aktive/inaktive Quellen als Scope für Retrieval, Chat und Artefakte.
- Source Blocks mit stabilen IDs, Heading-Kontext und Block-Highlighting.
- Hierarchical Chunking mit Source References und deterministischen lokalen Embeddings.
- Knowledge Layer mit Summaries, Claims, Entities, Topics, Risiken, offenen Fragen, Suggested Questions und Suggested Artifacts.
- Hybrid Retrieval über Keyword-, lokale Vektor-, Metadata-, Heading- und Entity-Signale.
- Evidence Packs und gespeicherte Retrieval Runs.
- Grounded Chat mit inline Citation Chips.
- Citation Ledger mit Claim-Support-Statistiken.
- Abstention, wenn aktive Quellen eine Antwort nicht tragen.
- Artifact Studio für Report, Mind Map, Flashcards, Quiz, Data Table, Slide Deck, Audio Overview Transcript, Video Overview Storyboard und Infographic.
- Optionales ElevenLabs Rendering für Audio Overview MP3-Dateien über Text-to-Dialogue.
- Server-seitiger Model Router mit lokalem Fallback und optionalem Anthropic/OpenAI/Gemini-Pfad für Grounded Chat.
- Seed Demo Notebook, Tests und API-Smoke-Scripts.

## Stack

- React 19
- Vite 7
- TypeScript
- Express 5
- Zod
- Node.js 24.x
- Node.js JSON/Filesystem Storage
- Deterministische lokale Embeddings
- Optional serverseitige LLM Provider über den Model Router

## Quickstart

```bash
fnm use
npm install
cp .env.example .env.local
npm run dev
```

App öffnen:

```text
http://127.0.0.1:5173/
```

Demo Notebook neu erzeugen:

```bash
npm run seed -- --reset
```

## Commands

```bash
npm run dev          # local app/server
npm run build        # production client build
npm run serve        # production static server
npm run seed         # create demo notebook
npm test             # parser/retrieval/citation/artifact tests
npm run verify       # button audit, build, lint, tests, server syntax check
npm run smoke:api    # health check against a running local server
npm run smoke:e2e    # create notebook, add source, ask, generate quiz via API
```

## Environment

Siehe [ENVIRONMENT.md](./ENVIRONMENT.md).

Wichtige Variablen:

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GOOGLE_API_KEY`
- `GOOGLE_MODEL`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID_HOST_A`
- `ELEVENLABS_VOICE_ID_HOST_B`
- `DATABASE_URL`
- `REDIS_URL`
- `STORAGE_DIR`
- `DEFAULT_REASONING_PROVIDER`
- `DEFAULT_EMBEDDING_PROVIDER`

API-Keys bleiben serverseitig. Ohne Provider-Keys nutzt die App reproduzierbare lokale Fallbacks.

## Local Storage

Die App läuft vollständig lokal und benötigt keine externen Produktivdatenbanken. Persistenz liegt standardmäßig unter:

```text
.data/sourcestudio/
```

Der Ordner enthält Notebook State, importierte Dateien und Artefakt-Exports. Er ist gitignored.

## Provider-Strategie

Die App erkennt optionale Provider-Keys über lokale Environment-Variablen. Für reproduzierbare Tests und lokale Demo-Läufe steht ein deterministischer Fallback-Provider zur Verfügung. Die Architektur trennt Provider-Status, Model Runs und Generierung über einen Model Router. Bei gesetztem API-Key kann die Antwortgenerierung serverseitig über externe LLM-Provider laufen.

Grounded Chat unterstützt externe LLM Provider über den Model Router. Der lokale Fallback bleibt für Tests und Offline-Demo verfügbar.

Studio-Artefakte können ebenfalls über den Model Router generiert werden. Standardmäßig bleibt `artifact_generation` lokal, damit Studio-Klicks keine ungeplanten Providerkosten auslösen. Mit `SOURCESTUDIO_ARTIFACT_PROVIDER=anthropic`, `openai`, `google` oder `auto` erzeugt die App Reports, Mind Maps, Quizzes, Slides und weitere Studio-Payloads über den gewählten Provider, validiert die JSON-Struktur und hängt serverseitig die kanonischen Evidence-Pack-Citations an. Bei Providerfehlern fällt die Generierung automatisch auf den lokalen Artefaktgenerator zurück.

## Grenzen des Prototyps

Die App ist ein starker lokaler Interview-Slice, aber noch kein vollständig betriebenes SaaS-System. Für Produktion wären als nächste Schritte sinnvoll:

- Postgres/pgvector statt lokalem Filesystem-Speicher.
- Redis/Queue Worker statt synchroner lokaler Jobs.
- produktive Embedding Provider statt lokaler Hash-Embeddings.
- weitere LLM-Rollen pro Prompt über Anthropic/OpenAI/Gemini.
- robusteres PDF/OCR/Layout-Parsing.
- Auth, Multi-Tenant-Isolation und Deployment.
- Monitoring, Rate Limits und Usage Accounting.

## Dokumentation

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DECISIONS.md](./DECISIONS.md)
- [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)
- [EVALUATION.md](./EVALUATION.md)
- [ENVIRONMENT.md](./ENVIRONMENT.md)
- [SUBMISSION_SUMMARY.md](./SUBMISSION_SUMMARY.md)
- [TODO.md](./TODO.md)
