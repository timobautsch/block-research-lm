# Query Rewrite Prompt

Rewrite the user question for source-grounded retrieval.

Rules:
- Preserve the original question.
- Generate 2-5 alternate searches.
- Include relevant entities, synonyms, section names, and artifact intent.
- Do not answer the question.
- Return JSON with `original_query`, `rewritten_queries`, `intent`, and `filters`.
