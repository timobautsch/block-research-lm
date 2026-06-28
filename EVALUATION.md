# Evaluation

## Seed Notebook

Seed-Dateien:

- `sample_sources/everlast_ai_consulting.md`
- `sample_sources/notebooklm_architecture_notes.md`
- `sample_sources/ai_automation_for_smes.md`
- `sample_sources/source_grounding_best_practices.md`

Run:

```bash
npm run seed -- --reset
```

## Testfragen

```text
What is the core architectural difference between SourceStudio and a generic PDF chatbot?
```

Erwartung: Die Antwort zitiert Architektur- und Source-Grounding-Passagen.

```text
Which AI automation use cases are most relevant for SMEs?
```

Erwartung: Die Antwort zitiert die SME-Use-Case-Quelle.

```text
Create an executive brief from all active sources.
```

Erwartung: Report-Artefakt mit Source References.

```text
Generate a quiz for a junior AI consultant.
```

Erwartung: Quiz-Artefakt mit Erklärungen und Citations.

```text
Find contradictions or open questions in the sources.
```

Erwartung: Evidence-grounded Vergleich oder offene Fragen.

```text
What will the weather be in Berlin tomorrow?
```

Erwartung: Abstention, weil die aktiven Quellen diese Information nicht tragen.

## Automatisierte Checks

```bash
npm test
```

Deckt ab:

- Markdown Parser.
- Chunking und Knowledge Creation.
- unterstützte Grounded Answer mit Citations.
- Citation Ledger.
- Abstention bei nicht belegbarer Frage.
- Studio-Artefakte.

```bash
npm run verify
```

Deckt ab:

- Button Action Audit.
- TypeScript/Vite Build.
- ESLint.
- Node Test Suite.
- Server Syntax Check.

Mit laufendem Server:

```bash
npm run smoke:api
npm run smoke:e2e
```

Der E2E-Smoke erzeugt ein Notebook, fügt eine Quelle hinzu, stellt eine Frage, prüft Citations und generiert ein Quiz über die API.

## Bewertungskriterium

Die technische Leistung liegt in der vollständigen quellengebundenen Pipeline: Source Ingestion, Knowledge Extraction, Retrieval, Evidence Packs, Citation Verification, Abstention, Artifact Generation, Tests und responsive UI.
