# NotebookLM Parity and Differentiation Plan

Dieses Dokument beschreibt den Ausbau von Nanas Block Research LM von einem lokalen, NotebookLM-inspirierten Vertical Slice zu einer produktionsnahen Research Workbench. Ziel ist nicht eine Pixelkopie von NotebookLM, sondern Ergebnisparität bei Quellenarbeit, Chat, Studio-Artefakten und Medienausgaben plus bessere Auditierbarkeit durch Evidence Packs und Citation Ledgers.

## Zielbild

Die App soll aus heterogenen Quellen einen kontrollierten Wissensraum bauen. Chat, Mind Maps, Reports, Flashcards, Quizzes, Data Tables, Slide Decks, Audio Overviews, Video Overviews und Infographics greifen auf dieselbe Evidence-Schicht zu. Jede faktische Aussage bleibt auf Source Blocks, Seiten, Zeitstempel oder andere präzise Provenance-Daten zurückführbar.

Der zentrale Produktvorteil gegenüber generischen PDF-Chatbots und auch gegenüber vielen NotebookLM-Flows ist ein prüfbarer Research Audit Trail:

- Was wurde importiert?
- Wie wurde es geparst?
- Welche Blöcke und Chunks wurden abgerufen?
- Welche Evidence Items wurden genutzt?
- Welche Claims wurden gestützt, teilweise gestützt, nicht geprüft oder entfernt?
- Welche Artefakte lassen sich aus derselben Evidence wiederholen oder revidieren?

## Phase 1: Foundation Hardening

### 1.1 Provider-Rollen vervollständigen

Aktueller Stand: Grounded Chat kann externe Provider nutzen, Artefakte werden lokal deterministisch generiert.

Umsetzung:

- `artifact_generation` im Model Router als echte externe Rolle verdrahten.
- Provider-Auswahl getrennt steuerbar machen: `SOURCESTUDIO_ARTIFACT_PROVIDER` oder `DEFAULT_ARTIFACT_PROVIDER`.
- Lokalen Fallback beibehalten, damit Tests und Offline-Demo reproduzierbar bleiben.
- Provider-Ausgabe strikt als JSON parsen.
- Artefakte weiterhin mit canonical Evidence-Pack-Citations anreichern.
- Providerfehler als Model Runs speichern und automatisch auf lokale Artefakte zurückfallen.

Erfolgskriterium:

- `npm test` enthält einen Test, der ein Studio-Artefakt über einen simulierten Provider erzeugt und den lokalen Fallback weiter absichert.

### 1.2 Evidence Pack Contract stabilisieren

Umsetzung:

- Evidence Pack JSON-Schema dokumentieren.
- Jede Evidence Item ID, Source ID, Block ID und Citation ID stabil halten.
- Evidence Pack Export für Chat und Artefakte einführen.
- Retrieval Run im UI besser sichtbar machen: Query, Rewrites, Scores, Support Type, einbezogene/ausgeschlossene Quellen.

Erfolgskriterium:

- Ein Artefakt kann zusammen mit seinem Evidence Pack exportiert und später reproduziert werden.

### 1.3 Citation Ledger auf Artefakte erweitern

Aktueller Stand: Chat-Antworten werden claim-level geprüft. Artefakte tragen Source References, aber noch kein vollwertiges Claim Ledger.

Umsetzung:

- Textfelder aus Reports, Slides, Flashcards, Quiz-Erklärungen, Audio-Transcripts und Video-Storyboards extrahieren.
- Claims gegen die Artifact Evidence Pack Items prüfen.
- Unsupported oder citation-less factual claims markieren oder entfernen.
- UI-Signal pro Artefakt: supported, partial, unsupported, not checkable.

Erfolgskriterium:

- Jedes Artefakt hat eine prüfbare Claim Coverage, nicht nur eine Citation-Liste.

## Phase 2: Ingestion Parity

### 2.1 Dokumente

Umsetzung:

- PDF parser mit Layout, Seitenzahlen, Tabellen, Überschriften und optional OCR.
- DOCX parser mit Headings, Tables, Footnotes und Comments.
- PPTX parser mit Slide-Struktur, Speaker Notes und Bild-Alttext.
- CSV/XLSX parser mit Tabellenprofilen, Spaltensemantik und Sample Rows.

Erfolgskriterium:

- Source Blocks enthalten `page_number`, `bbox`, `table_id`, `slide_number` oder passende strukturierte Metadaten.

### 2.2 Web und Websites

Umsetzung:

- Readability-Parser ersetzen oder erweitern.
- Sitemap, canonical URLs, robots respektieren.
- Duplicate/boilerplate detection.
- Crawl Scope im UI steuerbar machen.
- Website Crawl Reports mit indexierten, übersprungenen und fehlgeschlagenen URLs.

Erfolgskriterium:

- Eine Website-Quelle erzeugt weniger Navigationstext und bessere Topic-/Claim-Extraktion.

### 2.3 Audio, Video und YouTube

Umsetzung:

- Audio-Upload akzeptieren.
- Speech-to-text Provider anbinden.
- YouTube Transcript Import mit Video-Metadaten.
- Timecoded Source Blocks erzeugen.
- Citations mit Zeitstempel statt nur Block IDs anzeigen.

Erfolgskriterium:

- Audio/YouTube-Antworten können auf konkrete Zeitbereiche springen.

### 2.4 Images und Screenshots

Umsetzung:

- OCR und Vision Captioning anbinden.
- Bildbereiche als Source Blocks modellieren.
- Tabellen und Diagramme als strukturierte Knowledge Objects extrahieren.

Erfolgskriterium:

- Bildquellen können mit Citations auf OCR-Text, Caption oder Region verweisen.

## Phase 3: Retrieval Quality

### 3.1 Produktive Embeddings

Umsetzung:

- Embedding Provider für OpenAI/Gemini/andere konfigurieren.
- pgvector als Storage Adapter einführen.
- Deterministische lokale Embeddings als Test-Fallback behalten.
- Embedding-Versionierung mit Reindex Jobs.

Erfolgskriterium:

- Retrievalqualität steigt messbar auf einem festen Evaluationsset.

### 3.2 Reranking und Query Planning

Umsetzung:

- Query Intent weiter ausbauen: factual, compare, synthesis, table, artifact, chronology, contradiction.
- Query Rewrites durch LLM oder lokale Regeln kombinieren.
- Reranker einführen.
- Diversity pass gegen Quellenmonokultur.
- Long-context summarization für breite Synthesen.

Erfolgskriterium:

- Antworten nutzen mehrere relevante Quellen statt nur den ersten Keyword-Treffer.

### 3.3 Knowledge Layer verbessern

Umsetzung:

- Claims, Entities, Dates, Numbers, Risks, Open Questions per LLM-Extraction erzeugen.
- Entity Linking und Alias-Mapping.
- Contradiction Detection mit Evidenzpaaren.
- Topic Map aus Claims und Entities statt nur Top Terms.

Erfolgskriterium:

- Mind Maps und Reports basieren auf semantischen Beziehungen, nicht nur auf häufigen Begriffen.

## Phase 4: Studio Output Parity

### 4.1 Mind Map

Umsetzung:

- LLM-generierte Graph-Struktur aus topic, entity, claim und question nodes.
- Edge Labels mit Beziehungstypen.
- Interaktives Canvas mit Zoom, Search, Expand/Collapse und Citation Panel.
- Export als PNG/SVG/JSON.

Erfolgskriterium:

- Die Mind Map ist ein exploratives Arbeitswerkzeug, nicht nur eine Node-Liste.

### 4.2 Reports

Umsetzung:

- Report-Typen: Executive Brief, Analyst Memo, Risk Review, Market Map, Source Digest.
- Tone und Zielgruppe steuerbar.
- Claim-Level Ledger im Report.
- Markdown/PDF/DOCX Export.

Erfolgskriterium:

- Reports sind mit Evidence Pack und Claim Ledger auditierbar.

### 4.3 Learning Artifacts

Umsetzung:

- Flashcards mit Difficulty, Tags, Spaced-Repetition-Feldern.
- Quiz mit Distractor-Qualität, Erklärungen und Citation Coverage.
- Export für CSV/Anki/JSON.

Erfolgskriterium:

- Lernartefakte sind nicht nur Zusammenfassungen, sondern überprüfbare Lernobjekte.

### 4.4 Slides und Infographics

Umsetzung:

- Slide schema mit Layout, Visual Slots, Speaker Notes und Citations.
- PPTX/PDF Export.
- Infographic renderer als PNG/PDF.
- Visual Themes für Business/Research/Teaching.

Erfolgskriterium:

- Artefakte sind präsentationsfähig, nicht nur JSON-Previews.

### 4.5 Audio und Video

Umsetzung:

- Audio Overviews mit Länge, Sprache, Host-Stil, Zielgruppe und Quellenabdeckung.
- Text-to-dialogue Provider plus lokaler Fallback.
- Video Storyboard mit Visual Assets, Captions und Voiceover.
- MP4 Rendering Pipeline mit Queue Worker.

Erfolgskriterium:

- Audio und Video sind echte Medienartefakte mit Transcript, Citations und Download.

## Phase 5: Product and Platform

### 5.1 Jobs und Skalierung

Umsetzung:

- Redis/Queue Worker für Ingestion, Embedding, Artifact Generation, Rendering.
- Job Progress per Server-Sent Events oder Polling.
- Retry/Cancel/Resume.
- Usage Accounting pro Providerrolle.

Erfolgskriterium:

- Lange Crawls, OCR, Audio und Video blockieren den API-Prozess nicht.

### 5.2 Auth, Tenancy und Sharing

Umsetzung:

- Multi-Tenant Isolation.
- Notebook Sharing mit Rollen.
- Public Notebook Links.
- Artifact Sharing und Exports.
- Audit Logs.

Erfolgskriterium:

- Team- und Demo-Flows funktionieren ohne lokale State-Annahmen.

### 5.3 Evaluation

Umsetzung:

- Goldens für Retrieval, Abstention, Citation Accuracy und Artifact Quality.
- LLM-as-judge nur als Hilfssignal, nicht als alleinige Wahrheit.
- Regression Dataset aus sample_sources plus realistischen PDFs/Websites.
- Scorecards im CI oder Smoke Run.

Erfolgskriterium:

- Verbesserungen sind messbar, nicht nur subjektiv.

## Differenzierung Gegenüber NotebookLM

Die App soll besonders dort besser werden, wo professionelle Research Workflows mehr Transparenz brauchen:

- Claim-Level Audit für Chat und Artefakte.
- Exportierbare Evidence Packs.
- Sichtbarer Retrieval Run.
- Strikte Source Scope Controls.
- Reproduzierbare lokale Fallbacks.
- Provider-agnostisches Routing.
- Artifact Revisions mit Vergleich.
- Compliance-taugliche Provenance.

## Empfohlene Reihenfolge

1. Provider-backed Artifact Generation.
2. Artifact Citation Ledger.
3. Evidence Pack Export und UI.
4. PDF/DOCX/PPTX parser.
5. Productive Embeddings plus pgvector.
6. Reranking und Knowledge Extraction.
7. Mind Map Canvas.
8. PPTX/PDF/PNG Renderer.
9. Audio/Video Rendering Jobs.
10. Sharing, Tenancy, Usage und Evaluation.

