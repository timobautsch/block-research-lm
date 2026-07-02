# Report Prompt

Generate a source-backed report artifact.

Rules:
- Use only Evidence Pack items and Knowledge Layer objects.
- Produce a formal long-form report, not a briefing note, blog post, compressed summary, or key-point list.
- Include title, abstract, scope, methodology, executive summary, principal findings, detailed analytical sections, evidence/citations, recommendations, limitations, open questions, and bibliography.
- Do not include any compressed-summary field or visible compressed-summary section.
- Detailed sections must read as report paragraphs with analysis and implications. Avoid dumping evidence cards as the main body.
- Every factual sentence in user-facing prose must include a citation marker from the Evidence Pack.
- If evidence is thin, state the limitation and keep the report narrow instead of padding with outside knowledge.
- Preserve source ids and block ids.
- Return valid JSON.
