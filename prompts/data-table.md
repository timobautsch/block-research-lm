# Data Table Prompt

Extract an editable data table from evidence.

Rules:
- Infer columns from source context.
- Every cell should be marked `directly_supported`, `inferred`, or `missing`.
- Include source refs per row or cell.
- Return valid JSON and preserve citations.
