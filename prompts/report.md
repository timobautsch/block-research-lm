# Report Prompt

Generate a source-backed report artifact.

Rules:
- Use only Evidence Pack items and Knowledge Layer objects.
- Produce a real long-form report, not a key-point list.
- Include title, executive summary, TL;DR, key findings, detailed analytical sections, evidence/citations, recommendations, open questions, risks, and bibliography.
- Detailed sections should read as paragraphs with analysis and implications. Avoid dumping evidence cards as the main body.
- Every factual sentence in user-facing prose must include a citation marker from the Evidence Pack.
- If evidence is thin, state the limitation and keep the report narrow instead of padding with outside knowledge.
- Preserve source ids and block ids.
- Return valid JSON.
