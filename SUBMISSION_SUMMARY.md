# Architektur- und Funktionszusammenfassung

## Kurzfassung

SourceStudio AI ist ein lokaler, NotebookLM-inspirierter Research Workspace. Die App bildet nicht nur eine Oberfläche nach, sondern implementiert eine quellengebundene Research-Pipeline: Quellen importieren, strukturieren, aktivieren oder deaktivieren, Wissen extrahieren, Fragen beantworten, Citations prüfen und daraus Artefakte wie Reports, Mind Maps, Quizze, Flashcards, Slide Decks, Audio Briefings und Video Storyboards erzeugen.

Der zentrale Qualitätsanspruch ist: Antworten und Artefakte entstehen nachvollziehbar aus den aktiven Quellen. Dafür nutzt die App Evidence Packs, Source Blocks, Citation Chips und ein Citation Ledger.

## Ziel der App

SourceStudio AI ist als lokaler Technical Slice eines source-grounded AI Research Systems gebaut. Nutzer erstellen ein Notebook, fügen Quellen hinzu, arbeiten im Chat mit diesen Quellen und erzeugen daraus strukturierte Outputs.

Die wichtigste Produktidee ist nicht PDF hochladen und chatten, sondern ein kontrollierter Wissensraum: Quellen sind die Autorität. Der Chat und alle Studio-Artefakte greifen auf dieselbe strukturierte Evidence-Schicht zu.

## Frontend

Die UI liegt hauptsächlich in `src/App.tsx` und `src/styles.css`.

Sie ist in drei Hauptbereiche gegliedert:

- Sources Panel: Quellenliste, aktive/inaktive Quellen, Upload- und Erfassungsformular, Source Details und Source Blocks.
- Conversation Panel: Chat gegen die aktiven Quellen, Grounding Status, Citation Chips, Evidence-Anzeige und Abstain-Verhalten bei nicht belegbaren Fragen.
- Studio Panel: Artefakt-Generator für Reports, Mind Maps, Flashcards, Quizze, Data Tables, Slide Decks, Audio Overviews, Video Overviews und Infographics.

Auf Desktop erscheint die App als dreispaltiger Research Workspace. Auf mobilen Viewports wechselt sie in ein Tab-Layout. Die UI ist auf stabile Breiten, saubere Scrollbereiche und responsive Darstellung ausgelegt.

## Backend

Das Express-Backend liegt in `server/index.js` und stellt die API für die App bereit:

- `GET /api/health`
- `GET /api/providers`
- `GET /api/notebooks`
- `GET /api/notebooks/:id`
- `POST /api/notebooks/:id/sources`
- `PATCH /api/sources/:id/active`
- `GET /api/sources/:id/blocks`
- `POST /api/chat`
- `GET /api/messages/:id/citations`
- `POST /api/artifacts`
- `GET /api/jobs/:id`
- `GET /api/artifacts/:id`
- `GET /api/model-runs`
- `POST /api/seed`

## Core Engine

Die zentrale SourceStudio-Logik liegt in `server/sourcestudio/engine.js`.

Dort sind die wichtigsten Domänenobjekte umgesetzt:

- `notebooks`
- `sources`
- `blocks`
- `chunks`
- `embeddings`
- `knowledgeObjects`
- `chatMessages`
- `retrievalRuns`
- `evidencePacks`
- `citationLedgers`
- `artifactJobs`
- `artifacts`
- `modelRuns`

Diese Struktur ist bewusst näher an einer echten Research-/RAG-Architektur als an einer reinen UI-Demo.

## Datenhaltung

Die App läuft vollständig lokal und benötigt keine externen Produktivdatenbanken. Sie nutzt lokalen Filesystem-Speicher unter `.data/sourcestudio`. Der Ordner ist gitignored.

## Source Ingestion

Die App kann mehrere Quellentypen aufnehmen:

- Markdown
- Plain Text
- Notes
- URLs
- PDF-Dateien mit lokalem Text-Extraction-Fallback für Demo-Szenarien

Beim Import wird jede Quelle in stabile Source Blocks zerlegt. Jeder Block erhält eine eindeutige ID, Blocktyp, Text, Heading-Kontext und Positionsinformationen. Danach werden Chunks erzeugt, damit Retrieval und Evidence Packs auf kleineren, zitierbaren Einheiten arbeiten können.

Notes sind first-class Sources. Sie werden wie andere Quellen indexiert, zitiert und für Chat sowie Artefakte verwendet.

## Knowledge Layer

Nach dem Import erzeugt die Engine strukturierte Wissensobjekte.

Pro Quelle:

- Source Summary
- Section Summaries
- Claims
- Entities
- Dates
- Numbers
- Risks
- Open Questions

Pro Notebook:

- Notebook Summary
- Topic Map
- Entity Index
- Connections
- Contradictions
- Suggested Questions
- Suggested Artifacts

Damit verhält sich die App nicht wie ein einfacher Dokumentenchat, sondern wie ein Research-System mit eigener Wissensschicht.

## Retrieval

Bei jeder Chat-Frage läuft eine quellengebundene Retrieval-Pipeline:

1. Die Frage wird analysiert und einem Intent zugeordnet.
2. Query-Rewrites werden erzeugt.
3. Nur aktive Quellen werden berücksichtigt.
4. Chunks werden über mehrere Signale bewertet: Keyword-Matching, lokale Vektorähnlichkeit, Entities und Summary-Kontext.
5. Die besten Treffer werden in einem Evidence Pack gespeichert.
6. Die Antwort wird ausschließlich aus diesem Evidence Pack erzeugt.

Die lokalen Embeddings sind deterministische Hash-Embeddings. Sie dienen der reproduzierbaren lokalen Demo und den Tests. Die Architektur ist so getrennt, dass produktive Embedding Provider als nächster Schritt sauber angebunden werden können.

## Chat und Citations

Chat-Antworten werden source-grounded generiert. Citation Chips verweisen auf konkrete Source Blocks aus dem Evidence Pack. Wenn die aktiven Quellen keine ausreichende Grundlage für eine Antwort enthalten, abstainiert die App.

Nach der Antwort erstellt die App ein Citation Ledger. Claims werden gegen Evidence geprüft und klassifiziert:

- `supported`
- `partially_supported`
- `unsupported`
- `not_checkable`

Unsupported Claims werden nicht als belastbare Antwort ausgegeben. Der Grounding Status wird im Interface sichtbar gemacht.

## Artifact Studio

Das Studio erzeugt aus denselben Quellen strukturierte Outputs:

- Report
- Mind Map
- Flashcards
- Quiz
- Data Table
- Slide Deck
- Audio Overview Transcript
- Video Overview Storyboard
- Infographic

Artefakte laufen über einen Job-Mechanismus mit Status, Progress, Ergebnisdaten und gespeicherten Artefaktdateien unter `.data/sourcestudio/artifacts`. Audio Overview kann bei gesetztem ElevenLabs-Key zusätzlich eine MP3-Datei rendern; Transcript und Source References bleiben sichtbar.

## Provider-Strategie

Die App erkennt optionale Provider-Keys über lokale Environment-Variablen. Für reproduzierbare Tests und lokale Demo-Läufe steht ein deterministischer Fallback-Provider zur Verfügung. Die Architektur trennt Provider-Status, Model Runs und Generierung über einen Model Router. Bei gesetztem API-Key kann die Antwortgenerierung serverseitig über externe LLM-Provider laufen.

Grounded Chat unterstützt externe LLM Provider über den Model Router. Der lokale Fallback bleibt für Tests und Offline-Demo verfügbar. Model Runs speichern Provider, Model, Role, Latency, Status und optional Error.

## Testing

Automatisierte Tests liegen in `tests/pipeline.test.js`.

Verifiziert wird:

- Markdown-Ingestion in Blocks, Chunks und Knowledge Objects.
- Chat-Antworten mit Citations und Citation Ledger.
- Abstain-Verhalten bei nicht belegbaren Fragen.
- Artefaktgenerierung für alle geforderten Studio-Typen.

Zusätzlich gibt es Smoke Tests:

- `npm run smoke:api`
- `npm run smoke:e2e`

Der vollständige Verify-Lauf umfasst:

- `npm run verify`
- `npm run seed -- --reset`
- `npm run smoke:api`
- `npm run smoke:e2e`

Dabei laufen TypeScript Build, Vite Production Build, ESLint, Node Tests, Button Audit, Server Syntax Check und API-Smoke-Checks.

## Dokumentation

Für die Bewertung wurden folgende Dokumente ergänzt:

- `README.md`
- `ARCHITECTURE.md`
- `DECISIONS.md`
- `EVALUATION.md`
- `DEMO_SCRIPT.md`
- `ENVIRONMENT.md`
- `TODO.md`
- `SUBMISSION_SUMMARY.md`

Diese Dokumente beschreiben Setup, Architektur, technische Entscheidungen, Evaluationskriterien, Demo-Ablauf, Environment-Variablen und nächste Produktionsschritte.

## Bewusste Grenzen des Prototyps

Die App ist ein starker lokaler Interview-Slice, aber noch kein vollständig betriebenes SaaS-System. Für Produktion wären als nächste Schritte sinnvoll:

- Postgres/pgvector statt lokalem Filesystem-Speicher.
- Redis/Queue Worker statt synchroner lokaler Jobs.
- produktive Embedding Provider statt lokaler Hash-Embeddings.
- weitere LLM-Rollen pro Prompt über Anthropic/OpenAI/Gemini.
- robusteres PDF/OCR/Layout-Parsing.
- Auth, Multi-Tenant-Isolation und Deployment.
- Monitoring, Rate Limits und Usage Accounting.

## Technischer Bewertungspunkt

Die wichtigste technische Leistung ist nicht die optische NotebookLM-Kopie, sondern die vollständige quellengebundene Research-Pipeline: Source Ingestion, Knowledge Extraction, Retrieval, Evidence Packs, Citation Verification, Abstain-Verhalten, Artifact Generation, Tests und responsive UI.

Das Projekt zeigt nachvollziehbar, wie aus einem offenen Produktprompt ein funktionierendes, prüfbares AI-Research-System gebaut wurde.
