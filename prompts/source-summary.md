# Source Summary Prompt

Summarize one parsed source using only its source blocks.

Rules:
- Use only supplied blocks.
- Keep claims traceable to `source_id` and `block_ids`.
- Return JSON with `summary`, `section_summaries`, `important_claims`, `entities`, `dates`, `numbers`, `risks`, and `open_questions`.
- Do not invent missing metadata.
