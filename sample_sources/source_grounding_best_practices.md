# Source Grounding Best Practices

Sample data for the SourceStudio AI demo. This document lists practical rules for grounded AI systems.

## Source Authority

In source-only mode, sources are the authority. The model may phrase, compress, and compare evidence, but it should not introduce external facts. If the sources do not contain the answer, the system should say that the active sources are insufficient.

## Chunk Design

Chunks should preserve human-readable context. Headings, section names, page numbers, timestamps, and neighboring paragraphs improve answer quality. Chunk overlap can help, but too much overlap makes citations noisy.

## Citation UX

Inline citations should be small and clickable. When a citation opens, the user should see the source title, heading path, quoted passage, and block identifiers. This turns citations from decoration into an audit trail.

## Verification

A citation verifier should not only check whether a source was retrieved. It should ask whether each answer claim is actually supported by the cited passage. Claims with weak support should be removed, softened, or marked as partially supported.

## Artifact Generation

Studio artifacts should use the same Evidence Pack pattern as chat. Reports, slide decks, quizzes, data tables, audio scripts, and video storyboards should carry source references. This makes artifacts reusable as project outputs rather than disposable AI text.

## Abstention

Abstention is a feature, not a failure. A grounded system that refuses unsupported answers earns more trust than a general chatbot that invents plausible but unverifiable details.
