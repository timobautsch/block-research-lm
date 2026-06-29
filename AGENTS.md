# Agent Notes

This repository is a standalone interview/demo project and follows a focused delivery discipline.

## Project Map

- Product: Block Research LM, a local NotebookLM-inspired Block Research AI workbench with source-grounded chat, Evidence Packs, Citation Ledgers, and Studio artifact generation.
- Frontend: `src/App.tsx` and `src/styles.css` contain the React/Vite workbench UI, including auth views, Sources, Chat, Studio artifacts, citations, and responsive layout.
- API: `server/index.js` runs the Express server, auth endpoints, protected `/api` routes, Vite middleware in development, and static `dist` serving in production.
- Domain engine: `server/sourcestudio/engine.js` owns notebooks, sources, source blocks, chunks, local embeddings, knowledge objects, retrieval runs, evidence packs, citation ledgers, artifact jobs, artifacts, and model runs.
- Auth: `server/sourcestudio/auth-store.js` uses Node's built-in SQLite API for local users, sessions, and password reset tokens. Auth data is local runtime state, not repository state.
- Provider routing: `server/sourcestudio/model-router.js` supports deterministic local grounded answers plus optional Anthropic, OpenAI, and Gemini grounded-answer providers. ElevenLabs is used only for optional audio artifact rendering.
- Schemas: `server/sourcestudio/schemas.js` centralizes Zod request/status schemas.
- Prompts: `prompts/*.md` are source-controlled prompt specs for grounded answers, extraction, verification, and artifact types.
- Demo data: `sample_sources/*.md` are source-controlled seed sources used by `npm run seed`.
- Tests and smoke checks: `tests/pipeline.test.js`, `scripts/smoke-api.js`, and `scripts/e2e-smoke.js` cover the local pipeline, authenticated API checks, and artifact generation.
- Docs: `ARCHITECTURE.md`, `DECISIONS.md`, `DEMO_SCRIPT.md`, `ENVIRONMENT.md`, `EVALUATION.md`, `SUBMISSION_SUMMARY.md`, and `TODO.md` are intended project documentation and should stay tracked.

## Operating Rules

- Prefer CLI checks over browser/manual checks when possible.
- Keep secrets out of git. Use `.env.local`, shell env, or GitHub Secrets for local-only reuse.
- Do not commit `.env`, `.env.local`, API keys, browser tokens, generated exports, or local logs.
- Keep changes focused and verify before pushing.
- Use English for commits, code comments, README text, and GitHub metadata.
- Report user-facing status in German unless asked otherwise.

## Versioning Rules

- Track source, docs, prompts, tests, sample sources, scripts, public brand assets, GitHub workflows, and package manifests.
- Do not track runtime or generated folders: `.data/`, `dist/`, `.vite/`, `node_modules/`, `storage/`, `exports/`, `coverage/`, `playwright-report/`, or `test-results/`.
- Do not track local auth/database state such as `.data/sourcestudio/auth.sqlite` or `.data/sourcestudio/state.json`.
- Do not track generated artifact exports under `.data/sourcestudio/artifacts/`.
- `.env.example` is the only env file intended for Git.
- When adding source-like untracked files, check `git status --short --ignored --untracked-files=all` and stage only non-ignored project files.
- The current branded shell uses the original Block Research AI mark for `public/brand/blockresearch-mark.svg`; do not replace it with generated or SourceStudio placeholder branding.

## Runtime Notes

- `npm run dev` starts the combined Express/Vite server on `http://127.0.0.1:5173/` by default.
- The server loads `.env.local` and then `.env` with existing environment variables taking precedence.
- API routes after auth setup require an `ssai_session` cookie. Smoke scripts create or reuse local smoke users.
- Default storage is `.data/sourcestudio`; override with `STORAGE_DIR` only for local testing or isolated runs.
- `npm run seed -- --reset` rebuilds the local demo notebook from `sample_sources/`.
- `SMOKE_CHAT=true npm run smoke:api` may call a configured external LLM provider and consume API credits.

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

`SMOKE_CHAT=true` may call a configured external LLM provider and consume API credits.

## GitHub

- Default repository target for this project: private GitHub repository unless explicitly requested otherwise.
- Use a focused initial commit.
- Push immediately after verification.
- Do not open a public repository unless explicitly requested.
