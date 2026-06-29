# NotebookLM Clone — Build Plan to Match or Exceed Google NotebookLM

**Stack:** TypeScript/React (Vite) + Node/Express, local-first engine.
**One-line verdict:** A well-engineered demo skeleton with *real grounding discipline* but *fake retrieval* and *mostly-fake non-text ingestion*. It is roughly a good BM25 keyword search wrapped in honest citations. Three load-bearing fakes must become real: **(1) the SHA-256 "embeddings", (2) PDF/audio/image parsing, (3) the default-local artifact templates.**

---

## 1. Honest current-state

### Inputs
| Input | Reality |
|---|---|
| Markdown / pasted text / note | ✅ Real (naive splitter, fine) |
| URL (single + crawl) | 🟡 Real fetch, regex tag-strip, no JS render / readability |
| YouTube | ✅ **Now real** via `yt-dlp` (original-language captions). No-caption videos still need ASR. |
| Google Docs | 🟡 Public `?format=txt` only, no OAuth |
| DOCX | 🟡 `unzip` + regex |
| **PDF** | ❌ **Fake** — latin1 byte-scrape, fails on real PDFs → placeholder. No OCR. |
| **Audio (mp3/wav)** | ❌ **Fake** — bytes saved, never decoded |
| **Images** | ❌ Missing |

### Retrieval — the biggest gap
- **`embedText()` is not an embedding.** It builds a 96-dim vector from SHA-256 hash buckets (hashed bag-of-words). Zero semantics; `chooseEmbeddingProvider()` is cosmetic and never calls an API even with a key set.
- Vectors live in a JSON file; retrieval is an O(N) scan. Scoring is ~82% lexical (keyword + BM25); the 18% "cosine" runs over meaningless vectors.
- No real reranker (MMR only). **Cannot do semantic retrieval** — paraphrase/synonym/cross-lingual all miss. This is the antithesis of NotebookLM's "huge multi-source grounded context."
- Chunking is genuinely good (heading-aware ~650/90) — keep it; swap `word×1.25` for a real tokenizer.

### Outputs
Default `DEFAULT_ARTIFACT_PROVIDER=local` → all 9 artifact types are deterministic templates (no LLM). Citations are real and validated (a genuine strength). Audio Overview is the most complete (LLM script + real ElevenLabs MP3). Video is a storyboard placeholder (biggest output gap).

---

## 2. Gap-closing plan

### Inputs — exact library/service
- **PDF (digital):** `unpdf` / `pdfjs-dist` (real text + page numbers). *No key.*
- **PDF (scanned) + Images:** Claude vision (`claude-opus-4-8`) primary, `tesseract.js` fallback. New `image` source type + `sharp` for HEIC/TIFF.
- **Audio / Video:** **Deepgram Nova-3** (diarized, timestamped) or local `faster-whisper`; `ffmpeg` to extract audio.
- **YouTube no-caption path:** `yt-dlp` audio → Deepgram/Whisper. (Captions path already shipped.)
- **Web:** `@mozilla/readability` + `jsdom`, `playwright` for SPAs.
- **Office:** `mammoth` (DOCX), `officeparser` (PPTX), `xlsx` (XLSX); `epub2`.
- **Google Docs/Slides/Sheets:** `googleapis` OAuth.

### Retrieval — the highest-leverage change
1. **Real embeddings:** Voyage `voyage-3-large` (Anthropic's recommended partner) or OpenAI `text-embedding-3-large` or Google `gemini-embedding-001`. Self-host: BGE-M3. Make `chooseEmbeddingProvider` actually call the API; delete the hash path.
2. **Vector store:** Postgres + `pgvector` (HNSW) with metadata; or `sqlite-vec` at small scale.
3. **Hybrid retrieval:** BM25 (sparse) + dense, fused with Reciprocal Rank Fusion.
4. **Reranker:** Voyage `rerank-2.5` / Cohere Rerank 3.5 / bge-reranker-v2-m3.
5. **Tokenizer:** `tiktoken` for chunk counts.

### Outputs
Flip `SOURCESTUDIO_ARTIFACT_PROVIDER=anthropic`, model `claude-sonnet-4-6` (use `claude-opus-4-8` for reports/mind maps). Keep local templates as fallback + citation re-validation. Per output: Report → 4 NotebookLM formats; Mind map → hierarchical + labeled edges (React Flow); Quiz → real distractors + randomized answer; Data table → column inference + CSV/Sheets export; Slide deck → `pptxgenjs` real `.pptx`; Audio → ElevenLabs v3 two-voice + Deep Dive/Brief/Critique/Debate; Video → Claude script → frames → ElevenLabs → `ffmpeg` MP4.

> Model note: the codebase references stale `claude-3-5-haiku-latest`. Use current IDs: `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5`. Anthropic does **not** sell embeddings.

---

## 3. What I need from you (API keys / accounts)

**Already configured:** ✅ Anthropic, ✅ ElevenLabs (+ 2 voices), ✅ yt-dlp + ffmpeg (local).

**MUST-HAVE**
| Provider | For | Fallback |
|---|---|---|
| **Voyage AI** (or OpenAI / Google) | Real embeddings + reranker — the #1 fix | self-host BGE-M3 (no key, needs GPU) |
| **Postgres + pgvector** | Vector store + metadata + FTS | sqlite-vec (smaller scale) |
| **Deepgram** (or OpenAI Whisper) | Audio/video transcription | local `faster-whisper` |

**NICE-TO-HAVE:** Google OAuth (Docs/Slides/Sheets), Firecrawl/Jina (hard SPA pages), OpenAI (alt embeddings/Whisper/image gen).

---

## 4. Open-source to reuse (license-respecting; all backends are Python — adapt patterns, don't lift server code)
1. **SurfSense** (Apache-2.0, ~15k★) — copy the **hybrid search + RRF + reranker** RAG recipe.
2. **Open Notebook** (MIT, ~34k★) — parity blueprint: Episode Profiles podcast model, multi-provider LLM/TTS abstraction.
3. **Podcastfy** (Apache-2.0) — two-voice transcript + segment-TTS + ffmpeg-stitch pipeline.
4. **InsightsLM** (MIT) — closest stack (Vite/React/TS): jump-to-source citation UX + pgvector schema.
5. **Meta NotebookLlama** — staged PDF→podcast prompt chain reference.

**Avoid:** Khoj (AGPL-3.0, copyleft).

---

## 5. How we EXCEED NotebookLM
1. **Transparent Citation Ledger** — per-claim support level + "verify this claim".
2. **Source-grounded self-verification pass** (second Claude pass flags unsupported claims).
3. **Multi-provider routing** (no Gemini lock-in).
4. **Claude-vision OCR** beats classic OCR on scanned/handwritten/diagram inputs.
5. **Richer study mechanics** (spaced repetition, adaptive missed-card regen) — already present.
6. **Real file exports** (`.pptx`, `.xlsx`, SVG, MP4).
7. **Interactive Audio** (Deepgram STT ↔ Claude ↔ ElevenLabs).

---

## 6. Ordered roadmap
**🔑 Highest-leverage first step:** replace the fake embeddings + JSON store with real embeddings (Voyage) in pgvector, hybrid + RRF retrieval, and a reranker. Everything downstream is bottlenecked by retrieval.

- **P0 (foundation):** real RAG (above) · real PDF (`unpdf` + Claude-vision OCR) · real audio/video (Deepgram + ffmpeg) · image source type · real web/office parsers · move state off the JSON file.
- **P1 (output parity):** flip artifacts to Claude · upgrade Report/Mind map/Quiz/Data table/Flashcards · Audio v3 modes · Slide-deck renderer.
- **P2 (exceed):** self-verification + Citation Ledger UI · Video Overview MP4 pipeline · infographic charts · interactive audio · connectors.
