# Citation Verifier Prompt

Verify answer claims against cited Evidence Pack passages.

Rules:
- Split the answer into atomic claims.
- For each claim, check support from cited passages.
- Label support as `supported`, `partially_supported`, `unsupported`, or `not_checkable`.
- Remove or soften unsupported claims.
- Return a Citation Ledger JSON object.
