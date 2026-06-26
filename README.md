# NotebookLM-Style Research Workspace

A NotebookLM-inspired research workspace built with React, Vite, Express, and Claude. It implements the core workflow of a source-grounded notebook: manage sources, ask questions, cite evidence, save notes, and generate Studio outputs.

This is an interview/demo project, not an official Google product and not affiliated with Google or NotebookLM.

## Features

- Three-panel research workspace: Sources, Chat, and Studio.
- Source management with upload, paste, link, delete, select, search, and generated source discovery.
- Claude-backed grounded chat via a same-origin server route.
- Citation snippets for generated answers.
- Studio generation for audio scripts, video storyboards, mind maps, reports, flashcards, quizzes, and infographic copy.
- Notes, copy actions, JSON export, notebook rename, notebook duplicate, chat clearing, and Studio output clearing.
- Responsive mobile tab layout.
- Local fallback behavior when Claude is unavailable.

## Stack

- React 19
- Vite 7
- TypeScript
- Express 5
- Claude Messages API
- `lucide-react` icons

## Setup

Install dependencies:

```bash
npm install
```

Create local environment:

```bash
cp .env.example .env.local
```

Set `ANTHROPIC_API_KEY` in `.env.local`.

For local Blockresearch reuse, you can point at existing private env files without copying secrets:

```bash
BLOCKRESEARCH_ENV_PATHS="/absolute/path/to/.env.dev:/absolute/path/to/seo-automation/.env" npm run dev
```

Do not commit `.env.local` or any secret-bearing file.

## Development

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Production Build

```bash
npm run build
npm run serve
```

## Verification

Run the full local verification gate:

```bash
npm run verify
```

This runs:

- button action audit
- TypeScript production build
- ESLint
- server syntax check

With a local server running, check the API:

```bash
npm run smoke:api
```

To also call Claude:

```bash
SMOKE_CHAT=true npm run smoke:api
```

`SMOKE_CHAT=true` uses the configured Anthropic key and may consume API credits.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes for LLM features | Server-side Claude API key. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-haiku-4-5-20251001`. |
| `PORT` | No | Defaults to `5173`. |
| `BLOCKRESEARCH_ENV_PATHS` | No | Colon-separated local env file paths for private Blockresearch reuse. |

## Current Product Boundaries

This project intentionally implements the core NotebookLM-style workflows, but it does not claim feature parity with NotebookLM:

- PDF/DOCX/PPTX extraction is not production-grade yet.
- URL import accepts pasted page text instead of full server-side article extraction.
- Audio Overview is a browser speech playback experience, not a generated audio file.
- Video Overview is a generated storyboard, not rendered video.
- Notebook state is currently in-memory for the running browser session.

Recommended next production steps:

1. Add persistent notebook storage.
2. Add robust PDF/DOCX/PPTX/URL extraction.
3. Add structured tests for API and browser flows.
4. Add deploy target and GitHub Actions verification.
