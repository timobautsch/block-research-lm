# 8-10 Minute Demo Script

## 1. Produktpositionierung

"Das ist SourceStudio AI: ein source-grounded Research Workspace. Die App ist NotebookLM-inspiriert, aber als eigenständiger Technical Slice gebaut. Quellen werden importiert, strukturiert, retrieved, zitiert, verifiziert und für wiederverwendbare Studio-Artefakte genutzt."

## 2. Workspace zeigen

Öffne:

```text
http://127.0.0.1:5173/
```

Zeige:

- Sources links.
- Source-only Chat in der Mitte.
- Studio-Artefakte rechts.
- aktive Quellen.
- Knowledge Layer Status.
- aktiven Grounded-Answer-Provider in der Topbar.

## 3. Seed Notebook neu erzeugen

Klicke "Rebuild seed" oder führe aus:

```bash
npm run seed -- --reset
```

Erkläre, dass der Seed vier realistische Beispielquellen lädt.

## 4. Source Blocks inspizieren

Öffne eine Quelle im linken Panel. Erkläre, dass Citations auf konkrete Source Blocks zeigen und nicht nur auf Dokumentnamen.

## 5. Grounded Question stellen

Frage:

```text
What is the core architectural difference between SourceStudio and a generic PDF chatbot?
```

Zeige:

- Inline Citation Chips.
- Citation Cards.
- Klick auf Citation.
- Highlighted Source Block.

## 6. Abstention zeigen

Frage:

```text
What will the weather be in Berlin tomorrow?
```

Erkläre, dass Source-only mode abstained, weil die aktiven Quellen diese Information nicht enthalten.

## 7. Citation Ledger erklären

Zeige den Grounding Strip:

- claims checked.
- supported.
- partial.
- unsupported.

Erkläre, dass unsupported Claims vor der Anzeige entfernt werden.

## 8. Studio-Artefakte erzeugen

Erzeuge:

- Report.
- Mind Map.
- Quiz.
- Slide Deck.
- Audio Overview.
- Video Overview.

Öffne die Artefakt-Vorschau und zeige Source References.

## 9. Architektur erklären

"Die Kernarchitektur ist kein PDF-Chat. Das System baut ein canonical source model, einen Knowledge Layer, einen Retrieval Run, ein Evidence Pack und ein Citation Ledger. Dieselbe Evidence wird von Chat und Studio-Artefakten wiederverwendet."

## 10. Abschluss

"Ich habe einen echten End-to-End Product Slice gebaut: Source Ingestion, Retrieval, grounded answers, Verification, Artifacts, Tests und Dokumentation. Die verbleibende Arbeit für Produktion liegt in Infrastruktur, Provider-Ausbau und Deployment."
