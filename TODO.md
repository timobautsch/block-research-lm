# SourceStudio AI Roadmap

## Implementiert

- SourceStudio Domain Engine mit Notebooks, Sources, Blocks, Chunks, Knowledge Objects, Retrieval Runs, Evidence Packs, Citation Ledgers, Jobs, Artifacts und Model Runs.
- Validierte API-Routen für Notebooks, Sources, Chat, Citations, Artifacts, Jobs, Seed und Model Diagnostics.
- Model Router mit lokalem deterministischem Fallback und optionalem Anthropic/OpenAI/Gemini-Pfad für Grounded Chat.
- Provider-gestützte Studio-Artefaktgenerierung über `artifact_generation` mit getrenntem Routing, JSON-Validierung, kanonischen Evidence-Pack-Citations und lokalem Fallback.
- Markdown/Text Parser.
- Notes als first-class Sources.
- URL-Ingestion mit serverseitigem Fetch und HTML Cleanup.
- PDF-Dateien mit lokalem Text-Extraction-Fallback für Demo-Szenarien.
- Hierarchical Chunking mit Block References und lokalen deterministischen Embeddings.
- Query Intent, Query Rewrites, Hybrid Retrieval, Evidence Pack Creation, Abstention, Grounded Answer Generation, clickable Citations und Citation Ledger.
- Source Summaries, Section Summaries, Claims, Entities, Dates, Numbers, Risks, Open Questions, Topic Map, Contradictions, Suggested Questions und Suggested Artifacts.
- Source-backed Report, Mind Map, Flashcards, Quiz, Data Table, Slide Deck, Audio Overview Transcript und Video Overview Storyboard.
- Artifact Jobs, Progress, Results, Exports und Source References.
- API-gebundene UI mit Source Details, Block Highlighting, Grounding Details, Knowledge Layer Visibility, Job Status und Artifact Previews.
- Unit-, Integration- und Smoke-Tests.
- Seed Demo Sources und Seed Command.
- Abgabedokumentation.

## Nächste Produktionsschritte

- Postgres/pgvector statt lokalem Filesystem-Speicher.
- Redis/Queue Worker statt synchroner lokaler Jobs.
- produktive Embedding Provider statt lokaler Hash-Embeddings.
- weitere LLM-Rollen pro Prompt über Anthropic/OpenAI/Gemini, insbesondere Summarization, Extraction, Reranking und Citation Verification.
- robusteres PDF/OCR/Layout-Parsing.
- Auth, Multi-Tenant-Isolation und Deployment.
- Monitoring, Rate Limits und Usage Accounting.
