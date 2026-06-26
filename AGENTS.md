# Agent Notes

This repository is a standalone interview/demo project, but it follows the same delivery discipline used in the Blockresearch and Gridmatic workspaces.

## Operating Rules

- Prefer CLI checks over browser/manual checks when possible.
- Keep secrets out of git. Use `.env.local`, shell env, GitHub Secrets, or `BLOCKRESEARCH_ENV_PATHS` for local-only reuse.
- Do not commit `.env`, `.env.local`, API keys, browser tokens, generated exports, or local logs.
- Keep changes focused and verify before pushing.
- Use English for commits, code comments, README text, and GitHub metadata.
- Report user-facing status in German unless asked otherwise.

## Verification

Run this before pushing:

```bash
npm run verify
```

For a running local server:

```bash
npm run smoke:api
SMOKE_CHAT=true npm run smoke:api
```

`SMOKE_CHAT=true` calls Claude and may consume API credits.

## GitHub

- Default repository target for this project: private GitHub repo under the Blockresearch account.
- Use a focused initial commit.
- Push immediately after verification.
- Do not open a public repository unless explicitly requested.
