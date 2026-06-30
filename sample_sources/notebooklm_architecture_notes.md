# Notebook Architecture Notes

Sample data for the SourceStudio AI demo. This document describes architecture patterns inspired by source-grounded notebook products.

## Core Architecture

A mature source-grounded notebook is not just a vector search box. The system first transforms uploaded material into a canonical source model. That model contains sources, blocks, chunks, embeddings, citations, claims, retrieval runs, evidence packs, and generated artifacts.

Every answer should be traceable to source blocks. A citation that only says "Source 1" is not enough. The citation should identify a passage, heading, page, timestamp, or block id so the user can audit the answer.

## Notebook Knowledge Layer

The knowledge layer turns sources into reusable structured memory. A source summary captures the main point of one document. Section summaries preserve local context. Claims, definitions, entities, dates, numbers, risks, and open questions become queryable objects.

At the notebook level, the system can build a topic map, entity index, cross-source connections, contradictions, suggested questions, and suggested artifacts. This makes the notebook more useful over time because it remembers what has already been extracted.

## Retrieval Orchestrator

Evidence-first retrieval combines vector search, keyword search, metadata filters, active-source filtering, entity search, and table search. A retrieval run should save the query, query rewrites, retrieved chunks, scores, and final evidence items.

The output of retrieval is an Evidence Pack, not a random list of chunks. The Evidence Pack tells the model which sources are active, what intent was detected, which passages are relevant, and which constraints apply.

## Citation Verification

After a draft answer is generated, a citation verifier should split it into claims. Each claim is checked against the cited evidence. Unsupported claims are removed or softened. Partially supported claims are narrowed. The final answer should expose how many claims were checked and how many were supported.
