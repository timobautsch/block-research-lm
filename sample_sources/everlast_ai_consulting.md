# Everlast AI Consulting Interview Brief

Sample data for the SourceStudio AI demo. This document is fictional and exists to demonstrate source-grounded retrieval, citations, and Studio artifacts.

## Project Context

Everlast Consulting GmbH asked for a NotebookLM-inspired research workspace as an interview task. The strongest implementation is not a pixel-copy of Google NotebookLM. It demonstrates the underlying product architecture: source ingestion, curated notebook memory, retrieval orchestration, grounded answers, citation verification, and reusable artifacts.

## Evaluation Criteria

The hiring team will likely look for evidence that the system is more than a static UI. The app should accept real sources, parse them into stable citation blocks, generate answers only from active sources, and expose enough internals to make the grounding process inspectable.

An impressive demo should show a complete loop: seed a notebook, add a note, ask a question, click a citation, inspect the evidence block, generate a Studio artifact, and explain how the architecture can scale into a production project.

## Product Direction

The product should feel like a premium research workbench for consultants, analysts, and technical teams. It should use an independent brand language and avoid pretending to be an official Google product.

The UI should keep sources, chat, and Studio visible on desktop. Mobile can use a tabbed workspace as long as text does not overlap and source authority remains visible.

## Risks

A generic PDF chatbot would be weak because it hides how evidence is selected and verified. Another risk is fake citations: citations must point to real source blocks or the answer should abstain.

## Recommended Demo Script

Start with the seed notebook. Show that sources are active or inactive. Ask: "What is the core architectural difference between SourceStudio and a generic PDF chatbot?" Then click a citation and show the block. Generate an executive brief and a quiz. Finish by showing the Citation Ledger and Knowledge Layer.
