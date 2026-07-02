# Block Research LM

**Live-Demo: [blockresearch-lm.web.app](https://blockresearch-lm.web.app)**

Block Research LM ist ein NotebookLM-inspirierter, source-grounded Research Workspace. Die App bildet nicht nur eine Oberfläche nach, sondern implementiert eine vollständige quellengebundene Research-Pipeline: Quellen importieren (Dokumente, URLs, YouTube-Videos, Audio, Bilder), strukturieren, aktivieren oder deaktivieren, Wissen extrahieren, Fragen beantworten, Citations prüfen und daraus Artefakte wie Reports, Mind Maps, Quizze, Flashcards, Slide Decks, Audio Overviews (gerenderte MP3-Podcasts) und Video Overviews (gerenderte MP4s) erzeugen.

Der zentrale Qualitätsanspruch: Antworten und Artefakte entstehen nachvollziehbar aus den aktiven Quellen. Dafür nutzt die App Evidence Packs, Source Blocks, Citation Chips und ein Citation Ledger. Die Engine im Server heißt intern „SourceStudio".

Block Research LM ist kein offizielles Google- oder NotebookLM-Produkt.

## Produktidee

Die wichtigste Produktidee ist nicht „PDF hochladen und chatten", sondern ein kontrollierter Wissensraum: Quellen sind die Autorität. Der Chat und alle Studio-Artefakte greifen auf dieselbe strukturierte Evidence-Schicht zu.

## Funktionen

**Ingestion (multimodal)**

- Markdown/Text, Notes als first-class Sources.
- URL-Ingestion mit serverseitigem Fetch, HTML-Cleanup und optionalem Crawling.
- PDF, DOCX, PPTX, EPUB.
- YouTube-Videos: Transkript über Captions (yt-dlp mit Proof-of-Origin-Token-Provider), Fallback auf automatische Audio-Transkription (Deepgram Nova-3) für Videos ohne Untertitel.
- Audio-Dateien (Deepgram, diarisiert), Bilder (Vision-Beschreibung + OCR), Google Docs.

**Evidence-Schicht**

- Source Blocks mit stabilen IDs, Heading-Kontext und Block-Highlighting.
- Semantisches Chunking mit Source References und Embeddings (lokal deterministisch oder Provider).
- Knowledge Layer mit Summaries, Claims, Entities, Topics, Risiken, offenen Fragen, Suggested Questions und Suggested Artifacts.
- Hybrid Retrieval über Keyword-, Vektor-, Metadata-, Heading- und Entity-Signale, optionales Reranking (Cohere).
- Evidence Packs und gespeicherte Retrieval Runs.

**Grounded Chat**

- Inline Citation Chips, Citation Ledger mit Claim-Support-Statistiken.
- Abstention, wenn aktive Quellen eine Antwort nicht tragen.

**Artifact Studio**

- Report, Mind Map, Flashcards (mit Review-Loop und adaptiven Decks), Quiz, Data Table, Infographic (gerendertes SVG), Thumbnail (Bildgenerierung), YouTube Publish Kit.
- Slide Deck mit designtem Layout und PPTX-Export.
- Audio Overview: Zwei-Sprecher-Skript, gerendert als MP3 über ElevenLabs Text-to-Dialogue.
- Video Overview: Storyboard, gerendert als abspielbares MP4 (ffmpeg).

**Betrieb**

- Auth mit Sessions (Signup/Login/Passwort-Reset), Persistenz über Supabase in Produktion.
- Server-seitiger Model Router mit lokalem deterministischem Fallback und Anthropic/OpenAI/Gemini-Pfaden.
- Deployt auf Google Cloud Run (Docker), ausgeliefert über Firebase Hosting.
- Log-basiertes Alerting (Cloud Monitoring) für den YouTube-Egress-Proxy.

## Stack

- React 19, Vite 7, TypeScript
- Express 5, Zod, Node.js 24.x
- Anthropic Claude (Chat + Artefakte), OpenAI (Vision + Bilder), Deepgram (ASR), ElevenLabs (TTS)
- Lokale deterministische Embeddings als Fallback, JSON/Filesystem- oder Supabase-Storage

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

Ohne Provider-Keys nutzt die App reproduzierbare lokale Fallbacks — alle Kernflüsse (Ingestion, Retrieval, Chat, Artefakte) funktionieren offline.

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

Siehe [ENVIRONMENT.md](./ENVIRONMENT.md) und [.env.example](./.env.example).

Wichtige Variablen:

- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` — Grounded Chat + Artefakte
- `OPENAI_API_KEY` — Vision (Bild-Ingestion) + Bildgenerierung
- `DEEPGRAM_API_KEY` — Audio/YouTube-Transkription
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_HOST_A/B` — Audio-Overview-Rendering
- `YTDLP_PROXY` — Residential-Egress-Proxy für YouTube-Ingestion aus Cloud-Umgebungen (Datacenter-IPs werden von YouTube geblockt); unterstützt einen `{session}`-Platzhalter für Sticky Sessions
- `SUPABASE_DB_URL` — persistente Storage/Auth in Produktion
- `DEFAULT_REASONING_PROVIDER`, `DEFAULT_EMBEDDING_PROVIDER`, `SOURCESTUDIO_ARTIFACT_PROVIDER` — Provider-Routing

API-Keys bleiben serverseitig. Ohne Provider-Keys nutzt die App reproduzierbare lokale Fallbacks.

## Local Storage

Lokal benötigt die App keine externen Datenbanken. Persistenz liegt standardmäßig unter:

```text
.data/sourcestudio/
```

Der Ordner enthält Notebook State, importierte Dateien und Artefakt-Exports. Er ist gitignored. In Produktion übernimmt Supabase die Persistenz.

## Provider-Strategie

Die App erkennt optionale Provider-Keys über Environment-Variablen. Für reproduzierbare Tests und lokale Demo-Läufe steht ein deterministischer Fallback-Provider zur Verfügung. Die Architektur trennt Provider-Status, Model Runs und Generierung über einen Model Router.

Studio-Artefakte können ebenfalls über den Model Router generiert werden. Standardmäßig bleibt `artifact_generation` lokal, damit Studio-Klicks keine ungeplanten Providerkosten auslösen. Mit `SOURCESTUDIO_ARTIFACT_PROVIDER=anthropic`, `openai`, `google` oder `auto` erzeugt die App Reports, Mind Maps, Quizzes, Slides und weitere Studio-Payloads über den gewählten Provider, validiert die JSON-Struktur und hängt serverseitig die kanonischen Evidence-Pack-Citations an. Bei Providerfehlern fällt die Generierung automatisch auf den lokalen Artefaktgenerator zurück.

## Grenzen des Prototyps

Die App ist ein produktionsnah deployter Prototyp, aber noch kein vollständig betriebenes SaaS-System. Sinnvolle nächste Schritte:

- pgvector-basiertes Retrieval statt In-Process-Vektorsuche.
- Redis/Queue Worker statt In-Process-Jobs.
- Produktive Embedding-Provider als Default statt lokaler Hash-Embeddings.
- Robusteres PDF/OCR/Layout-Parsing.
- Video-Frame-Analyse für YouTube-Quellen (Vision über Keyframes).
- Feingranulares Usage Accounting und Rate Limits pro Nutzer.

## Dokumentation

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DECISIONS.md](./DECISIONS.md)
- [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)
- [EVALUATION.md](./EVALUATION.md)
- [ENVIRONMENT.md](./ENVIRONMENT.md)
- [SUBMISSION_SUMMARY.md](./SUBMISSION_SUMMARY.md)
- [TODO.md](./TODO.md)
