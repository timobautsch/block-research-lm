# Technical Decisions

## Existing Stack Beibehalten

Das Repository enthält bereits eine funktionierende React/Vite/Express-Basis. Diese Basis wurde gezielt erweitert, statt Zeit in ein Framework-Rewrite zu investieren. Das Ergebnis ist ein vollständiger lokaler Vertical Slice mit Frontend, API, Engine, Tests und Dokumentation.

## Local JSON/Filesystem Adapter

Die App läuft vollständig lokal und benötigt keine externen Produktivdatenbanken. Der lokale JSON/Filesystem Adapter macht die Demo reproduzierbar und erlaubt einen Start ohne Infrastruktur. Die Domain-Objekte sind so getrennt, dass Postgres/pgvector später als Storage Adapter angebunden werden kann.

## Deterministische lokale Embeddings

Die Demo nutzt deterministische Hash-Embeddings plus Keyword-, Heading- und Entity-Signale. Dadurch bleiben Tests stabil und kostenfrei. Produktive Embedding Provider sind als nächster Schritt über die Provider-Grenze vorgesehen.

## Model Router mit lokalem Fallback

Grounded Chat unterstützt externe LLM Provider über den Model Router. Anthropic, OpenAI und Gemini laufen serverseitig, wenn passende API-Keys und Provider-Routing gesetzt sind. Ohne Key oder bei Providerfehlern nutzt die App den deterministischen lokalen Fallback. Model Runs speichern Provider, Model, Role, Latency, Status und Error.

## Citation Verification bleibt Pflicht

Die Citation Verification bleibt nach der Antwortgenerierung aktiv, unabhängig davon, ob die Antwort lokal oder über einen externen Provider entstanden ist. Unsupported Claims werden nicht als belastbare Antwort angezeigt.

## PDF Text Extraction

PDF-Dateien nutzen einen lokalen Text-Extraction-Fallback für Demo-Szenarien. Dieser Pfad erhält Upload-Metadaten und extrahiert lesbaren Text, sofern der PDF-String-Layer verfügbar ist. Layout-aware Parsing und OCR sind Produktionsausbau.

## Artifact Jobs

Artifact Jobs besitzen queued/running/completed/failed-Status, laufen lokal aber synchron. Redis/Queue Worker können diese Grenze ersetzen, ohne den UI- oder API-Vertrag zu ändern.

## UI Direction

Die UI nutzt einen eigenständigen Premium-Research-Workbench-Look mit drei Spalten auf Desktop und Tabs auf mobilen Viewports. Sie bleibt NotebookLM-inspiriert, vermeidet aber Google-Branding und vermeidet eine reine Pixelkopie.

## Nächste Produktionsschritte

- Postgres/pgvector Persistenz.
- Redis/Queue Worker.
- produktive Embedding Provider.
- weitere externe LLM-Rollen für Summarization, Extraction, Artifact Generation und Citation Verification.
- Layout-aware PDF/DOCX Extraction.
- Browser-grade Website Readability.
- Audio- und Video-Rendering über dedizierte Provider.
- Browser-E2E-Testsuite.
