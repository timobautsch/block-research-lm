import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import {
  ActiveSourceSchema,
  ArtifactRequestSchema,
  ChatRequestSchema,
  CreateNotebookSchema,
  CreateSourceSchema,
  FlashcardReviewSchema,
} from "./schemas.js";
import { createModelRouter } from "./model-router.js";
import { createDurableStore } from "./durable-store.js";
import { noopLogger } from "./logger.js";

const VECTOR_SIZE = 96;
const CHUNK_TOKEN_TARGET = 650;
const CHUNK_TOKEN_OVERLAP = 90;
const MAX_EVIDENCE_ITEMS = 8;
const MAX_ARTIFACT_EVIDENCE_ITEMS = 12;
const MAX_AUDIO_EVIDENCE_ITEMS = 18;
const RETRIEVAL_CANDIDATE_MULTIPLIER = 4;
const RETRIEVAL_MIN_CANDIDATES = 24;
const FLASHCARD_COUNT_PRESETS = {
  fewer: 6,
  standard: 10,
  more: 16,
};
const FLASHCARD_DIFFICULTIES = new Set(["easy", "medium", "hard", "mixed"]);
const FLASHCARD_CARD_TYPES = ["concept", "application", "cloze", "caveat", "source-check", "compare"];
const DEFAULT_CRAWL_MAX_PAGES = 12;
const MAX_CRAWL_TEXT_CHARS = 2_200_000;
const PRODUCT_NAME = "Block Research LM";
const execFile = promisify(execFileCallback);

export async function createSourceStudioEngine(options = {}) {
  const root = options.root || resolve(dirname(new URL(import.meta.url).pathname), "../..");
  const storageDir = options.storageDir || process.env.STORAGE_DIR || join(root, ".data", "sourcestudio");
  const stateFile = options.stateFile || join(storageDir, "state.json");
  const fileDir = join(storageDir, "files");
  const artifactDir = join(storageDir, "artifacts");
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const logger = options.logger || noopLogger();
  const modelRouter = createModelRouter({
    env,
    fetchImpl,
    localGroundedAnswer: generateGroundedAnswer,
    estimateTokens,
  });
  const embedder = createEmbedder({ env, fetchImpl, logger });
  const pgStore = createPgStore({ env, logger });
  const durable = createDurableStore({ env, logger });

  await mkdir(fileDir, { recursive: true });
  await mkdir(artifactDir, { recursive: true });

  let state = await loadInitialState();
  let audioOverviewPromptSpec = null;
  logger.info("engine.ready", {
    storage_dir: storageLabel(root, storageDir),
    durable: durable.enabled,
    counts: stateCounts(),
  });

  // Load the durable snapshot (Supabase) first so notebooks/sources survive
  // Cloud Run restarts and redeploys; fall back to the local disk copy.
  async function loadInitialState() {
    if (durable.enabled) {
      const stored = await durable.get("engine_state");
      if (stored && typeof stored === "object") {
        return { ...createEmptyState(), ...stored };
      }
    }
    return loadState(stateFile);
  }

  async function persist() {
    await mkdir(dirname(stateFile), { recursive: true });
    await writeFile(stateFile, JSON.stringify(state, null, 2));
    if (durable.enabled) await durable.set("engine_state", state);
  }

  function now() {
    return new Date().toISOString();
  }

  function id(prefix) {
    return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
  }

  function providerStatus() {
    const routerStatus = modelRouter.status();
    const groundedAnswer = routerStatus.roles.grounded_answer;
    return {
      anthropic: hasConfiguredValue(env.ANTHROPIC_API_KEY),
      openai: hasConfiguredValue(env.OPENAI_API_KEY),
      google: hasConfiguredValue(env.GOOGLE_API_KEY),
      elevenlabs: hasConfiguredValue(env.ELEVENLABS_API_KEY),
      database: hasConfiguredValue(env.DATABASE_URL),
      redis: hasConfiguredValue(env.REDIS_URL),
      storage: "local-json-filesystem",
      storage_dir: storageLabel(root, storageDir),
      available_reasoning_providers: routerStatus.available_reasoning_providers,
      active_grounded_answer_provider: groundedAnswer.provider,
      grounded_answer_model: groundedAnswer.model,
      external_grounded_answer_enabled: groundedAnswer.external,
      roles: routerStatus.roles,
    };
  }

  function health() {
    const providers = providerStatus();
    return {
      ok: true,
      product: PRODUCT_NAME,
      provider: providerLabel(providers.active_grounded_answer_provider),
      configured: providers.anthropic || providers.openai || providers.google,
      model: providers.grounded_answer_model,
      providers,
      counts: {
        notebooks: state.notebooks.length,
        sources: state.sources.length,
        blocks: state.blocks.length,
        chunks: state.chunks.length,
        artifacts: state.artifacts.length,
        flashcard_decks: state.flashcardDecks.length,
        flashcards: state.flashcards.length,
        flashcard_reviews: state.flashcardReviews.length,
        model_runs: state.modelRuns.length,
      },
    };
  }

  async function reset() {
    logger.warn("engine.reset.start", { storage_dir: storageLabel(root, storageDir) });
    state = createEmptyState();
    await rm(stateFile, { force: true });
    await rm(fileDir, { recursive: true, force: true });
    await rm(artifactDir, { recursive: true, force: true });
    await mkdir(fileDir, { recursive: true });
    await mkdir(artifactDir, { recursive: true });
    await persist();
    logger.warn("engine.reset.complete", { counts: stateCounts() });
  }

  async function createNotebook(input = {}, context = {}) {
    const parsed = CreateNotebookSchema.parse(input);
    const timestamp = now();
    const notebook = {
      id: id("notebook"),
      owner_user_id: context.ownerUserId || "",
      title: parsed.title,
      description: parsed.description,
      created_at: timestamp,
      updated_at: timestamp,
      summary: "",
      active_source_count: 0,
      source_count: 0,
    };
    state.notebooks.push(notebook);
    await persist();
    logger.info("notebook.create.complete", {
      request_id: context.requestId,
      notebook_id: notebook.id,
      owner_user_id: context.ownerUserId || "",
      title: notebook.title,
    });
    return decorateNotebook(notebook.id);
  }

  function listNotebooks(context = {}) {
    return state.notebooks
      .filter((notebook) => notebookBelongsTo(notebook, context))
      .map((notebook) => decorateNotebook(notebook.id))
      .filter(Boolean);
  }

  function getNotebook(notebookId, context = {}) {
    assertNotebookAccess(notebookId, context);
    return decorateNotebook(notebookId);
  }

  async function ingestSource(notebookId, input = {}, context = {}) {
    const startedAt = Date.now();
    assertNotebookAccess(notebookId, context);
    const parsed = CreateSourceSchema.parse(input);
    const timestamp = now();
    const sourceId = id("source");
    const source = {
      id: sourceId,
      notebook_id: notebookId,
      type: parsed.type,
      title: parsed.title || inferTitle(parsed),
      original_url: parsed.original_url || "",
      file_path: "",
      status: "pending",
      raw_text: parsed.body || "",
      cleaned_text: "",
      metadata_json: {
        file_name: parsed.file_name || "",
        mime_type: parsed.mime_type || "",
        parser: "pending",
        fallback: false,
      },
      created_at: timestamp,
      updated_at: timestamp,
      version: 1,
      active: parsed.active,
    };
    state.sources.push(source);
    await persist();
    logger.info("source.ingest.start", {
      request_id: context.requestId,
      notebook_id: notebookId,
      source_id: sourceId,
      type: parsed.type,
      title: source.title,
      body_chars: parsed.body?.length || 0,
      has_file: Boolean(parsed.base64),
      active: parsed.active,
    });

    const runIngest = async () => {
     try {
      source.status = "parsing";
      source.updated_at = now();
      if (parsed.base64) {
        const safeName = sanitizeFileName(parsed.file_name || `${sourceId}.bin`);
        const filePath = join(fileDir, `${sourceId}-${safeName}`);
        await writeFile(filePath, Buffer.from(parsed.base64, "base64"));
        source.file_path = filePath;
      }

      const document = await parseSource(source, parsed, context);
      source.title = document.title || source.title;
      source.raw_text = document.raw_text;
      source.cleaned_text = document.cleaned_text;
      source.metadata_json = { ...source.metadata_json, ...document.metadata };
      source.status = "indexed";
      source.updated_at = now();

      removeSourceDerivedRows(sourceId);
      if (pgStore.enabled) {
        await pgStore.deleteBySource(sourceId).catch((error) =>
          logger.warn("pgvector.delete.failed", { source_id: sourceId, error: String(error?.message || error).slice(0, 160) }),
        );
      }
      state.blocks.push(...document.blocks);
      const chunks = chunkDocument(notebookId, source, document.blocks);
      state.chunks.push(...chunks);
      const chunkVectors = await embedder.embed(chunks.map((chunk) => chunk.normalized_text), "document");
      state.embeddings.push(
        ...chunks.map((chunk, index) => ({
          id: id("embedding"),
          chunk_id: chunk.id,
          provider: embedder.provider,
          model: embedder.model,
          vector: chunkVectors[index] || embedText(chunk.normalized_text),
          created_at: now(),
        })),
      );
      if (pgStore.enabled) {
        try {
          await pgStore.upsertChunks(
            chunks.map((chunk, index) => ({
              chunk_id: chunk.id,
              notebook_id: notebookId,
              source_id: sourceId,
              owner_user_id: context.ownerUserId || "",
              content: chunk.normalized_text || chunk.text || "",
              heading_path: (chunk.heading_path || []).join(" / "),
              metadata: { source_title: source.title },
              embedding: chunkVectors[index],
            })),
          );
        } catch (error) {
          logger.warn("pgvector.upsert.failed", { source_id: sourceId, error: String(error?.message || error).slice(0, 160) });
        }
      }
      const sourceKnowledge = buildSourceKnowledgeObjects(source, document.blocks, chunks);
      state.knowledgeObjects.push(...sourceKnowledge);
      rebuildNotebookKnowledge(notebookId);
      await persist();
      logger.info("source.ingest.complete", {
        request_id: context.requestId,
        notebook_id: notebookId,
        source_id: sourceId,
        title: source.title,
        parser: source.metadata_json.parser,
        blocks: document.blocks.length,
        chunks: chunks.length,
        knowledge_objects: sourceKnowledge.length,
        duration_ms: Date.now() - startedAt,
      });
      await maybeAutoNameNotebook(notebookId, context);
      return decorateSource(sourceId, { includeBlocks: true });
    } catch (error) {
      source.status = "failed";
      source.updated_at = now();
      source.metadata_json = {
        ...source.metadata_json,
        error: error.message,
      };
      await persist();
      logger.error("source.ingest.failed", {
        request_id: context.requestId,
        notebook_id: notebookId,
        source_id: sourceId,
        title: source.title,
        type: source.type,
        duration_ms: Date.now() - startedAt,
        error,
      });
      throw error;
     }
    };

    if (context.sync) {
      return runIngest();
    }
    // Parse in the background so long parses (YouTube audio transcription, large
    // media) never hold the request past Firebase Hosting's ~60s proxy timeout.
    source.status = "parsing";
    await persist();
    runIngest().catch(() => {
      // Failure is already recorded on the source (status + metadata error).
    });
    return decorateSource(sourceId, { includeBlocks: false });
  }

  async function renameNotebook(notebookId, input = {}, context = {}) {
    const notebook = assertNotebookAccess(notebookId, context);
    const title = String(input.title || "").trim();
    if (!title) throw statusError(400, "Notebook title is required.");
    if (title.length > 160) throw statusError(400, "Notebook title is too long.");
    notebook.title = title;
    notebook.title_source = "manual";
    notebook.updated_at = now();
    await persist();
    logger.info("notebook.rename", { request_id: context.requestId, notebook_id: notebookId, title });
    return decorateNotebook(notebookId);
  }

  // After a source finishes indexing, ask the model for a notebook name that captures
  // the overarching topic of its sources — but never override a user's manual title.
  async function maybeAutoNameNotebook(notebookId, context = {}) {
    const notebook = state.notebooks.find((item) => item.id === notebookId);
    if (!notebook || notebook.auto_naming) return;
    if (notebook.title_source === "manual") return;
    if (!isDefaultNotebookTitle(notebook.title)) return;
    const sources = state.sources.filter(
      (source) => source.notebook_id === notebookId && source.status === "indexed",
    );
    if (!sources.length) return;

    notebook.auto_naming = true;
    try {
      const suggestion = await suggestNotebookTitle(sources);
      const fresh = state.notebooks.find((item) => item.id === notebookId);
      // Re-check: the user may have manually renamed it while the model was thinking.
      if (fresh && suggestion && fresh.title_source !== "manual" && isDefaultNotebookTitle(fresh.title)) {
        fresh.title = suggestion;
        fresh.title_source = "auto";
        fresh.updated_at = now();
        await persist();
        logger.info("notebook.autoname.complete", {
          request_id: context.requestId,
          notebook_id: notebookId,
          title: suggestion,
        });
      }
    } catch (error) {
      logger.warn("notebook.autoname.failed", {
        notebook_id: notebookId,
        error: String(error?.message || error).slice(0, 160),
      });
    } finally {
      const fresh = state.notebooks.find((item) => item.id === notebookId);
      if (fresh) fresh.auto_naming = false;
    }
  }

  async function suggestNotebookTitle(sources) {
    const corpus = sources
      .slice(0, 5)
      .map((source) => {
        const body = String(source.cleaned_text || source.raw_text || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 1200);
        return `Source title: ${source.title}\n${body}`;
      })
      .join("\n\n---\n\n");

    const prompt = [
      "Name a research notebook based on the sources below.",
      "Capture the overarching topic shared across the sources — specific, not generic.",
      "Return ONLY the title text: 2-6 words, Title Case, no quotes, no markdown, no file extensions, no trailing punctuation.",
      "",
      "SOURCES:",
      corpus,
      "",
      "Notebook title:",
    ].join("\n");

    const result = await modelRouter.generateStructured({
      role: "artifact_generation",
      systemPrompt: "You generate short, specific notebook titles. Output only the title text, nothing else.",
      prompt,
      maxTokens: 24,
      startRun: startModelRun,
    });
    if (result?.run) state.modelRuns.push(result.run);
    return cleanNotebookTitle(result?.text) || fallbackNotebookTitle(sources);
  }

  async function setSourceActive(sourceId, input = {}, context = {}) {
    const parsed = ActiveSourceSchema.parse(input);
    const source = findSource(sourceId);
    assertSourceAccess(source, context);
    source.active = parsed.active;
    source.updated_at = now();
    rebuildNotebookKnowledge(source.notebook_id);
    await persist();
    logger.info("source.active.updated", {
      request_id: context.requestId,
      notebook_id: source.notebook_id,
      source_id: source.id,
      active: parsed.active,
    });
    return decorateSource(sourceId);
  }

  async function deleteSource(sourceId, context = {}) {
    const source = findSource(sourceId);
    assertSourceAccess(source, context);
    state.sources = state.sources.filter((item) => item.id !== sourceId);
    removeSourceDerivedRows(sourceId);
    if (pgStore.enabled) {
      await pgStore.deleteBySource(sourceId).catch((error) =>
        logger.warn("pgvector.delete.failed", { source_id: sourceId, error: String(error?.message || error).slice(0, 160) }),
      );
    }
    rebuildNotebookKnowledge(source.notebook_id);
    await persist();
    logger.warn("source.delete.complete", {
      request_id: context.requestId,
      notebook_id: source.notebook_id,
      source_id: sourceId,
      title: source.title,
    });
    return { ok: true };
  }

  async function askChat(input = {}, context = {}) {
    const startedAt = Date.now();
    let notebookId = "";
    let questionChars = 0;
    try {
      const parsed = normalizeChatRequest(input, context);
      questionChars = parsed.question.length;
      const notebook = resolveNotebookForChat(parsed, context);
      notebookId = notebook.id;
      logger.info("chat.ask.start", {
        request_id: context.requestId,
        notebook_id: notebook.id,
        source_mode: parsed.source_mode,
        selected_sources: parsed.selected_source_ids.length,
        question_chars: questionChars,
        answer_style: parsed.answer_style,
      });
      const evidencePack = await buildEvidencePack({
        notebook_id: notebook.id,
        question: parsed.question,
        source_mode: parsed.source_mode,
        selected_source_ids: parsed.selected_source_ids,
      });
      logger.info("retrieval.pack.created", {
        request_id: context.requestId,
        notebook_id: notebook.id,
        evidence_pack_id: evidencePack.id,
        intent: evidencePack.intent,
        active_sources: evidencePack.active_source_ids.length,
        evidence_items: evidencePack.evidence_items.length,
        retrieved_items: evidencePack.retrieved_items.length,
      });
      const generation = await modelRouter.generateGroundedAnswer({
        question: parsed.question,
        evidencePack,
        answerStyle: parsed.answer_style,
        startRun: startModelRun,
      });
      const answer = generation.answer;
      const activeModelRun = generation.active_run;

      const verification = verifyAnswer(answer, evidencePack);
      const finalAnswer = verification.final_answer;
      const messageId = id("message");
      const timestamp = now();
      const message = {
        id: messageId,
        notebook_id: notebook.id,
        session_id: parsed.session_id || "default",
        role: "assistant",
        content: finalAnswer.content,
        created_at: timestamp,
        citations: finalAnswer.citations,
        evidence_pack_id: evidencePack.id,
        citation_ledger_id: verification.ledger_id,
        provider: activeModelRun.provider,
        model: activeModelRun.model,
        mode: answer.abstained ? "abstained" : "grounded",
        claim_stats: verification.stats,
        fallback_reason: generation.fallback_reason || "",
      };
      state.chatMessages.push({
        id: id("message"),
        notebook_id: notebook.id,
        session_id: parsed.session_id || "default",
        role: "user",
        content: parsed.question,
        created_at: timestamp,
      });
      state.chatMessages.push(message);
      state.retrievalRuns.push(evidencePack.retrieval_run);
      state.evidencePacks.push(evidencePack);
      state.citationLedgers.push(verification.ledger);
      state.modelRuns.push(...generation.model_runs);
      await persist();
      logger.info("chat.ask.complete", {
        request_id: context.requestId,
        notebook_id: notebook.id,
        message_id: message.id,
        mode: message.mode,
        provider: activeModelRun.provider,
        model: activeModelRun.model,
        citations: message.citations.length,
        grounding: verification.stats,
        model_runs: generation.model_runs.map((run) => ({
          id: run.id,
          provider: run.provider,
          status: run.status,
          latency_ms: run.latency_ms,
          error: run.error,
        })),
        fallback_reason: generation.fallback_reason || "",
        duration_ms: Date.now() - startedAt,
      });
      return {
        message,
        content: message.content,
        citations: message.citations,
        evidence_pack: evidencePack,
        grounding: verification.stats,
        citation_ledger: verification.ledger,
        provider: activeModelRun.provider,
        model: activeModelRun.model,
      };
    } catch (error) {
      logger.error("chat.ask.failed", {
        request_id: context.requestId,
        notebook_id: notebookId,
        question_chars: questionChars,
        duration_ms: Date.now() - startedAt,
        error,
      });
      throw error;
    }
  }

  async function createArtifact(input = {}, context = {}) {
    const startedAt = Date.now();
    const parsed = ArtifactRequestSchema.parse(input);
    const notebook = getNotebook(parsed.notebook_id, context);
    const timestamp = now();
    const job = {
      id: id("job"),
      notebook_id: notebook.id,
      type: parsed.type,
      status: "queued",
      progress: 0,
      options_json: parsed.options,
      result_artifact_id: "",
      error: "",
      created_at: timestamp,
      updated_at: timestamp,
    };
    state.artifactJobs.push(job);
    await persist();
    logger.info("artifact.job.queued", {
      request_id: context.requestId,
      notebook_id: notebook.id,
      job_id: job.id,
      type: parsed.type,
      options: Object.keys(parsed.options || {}),
    });

    const runJob = async () => {
     try {
      job.status = "running";
      job.progress = 35;
      job.updated_at = now();
      logger.info("artifact.job.running", {
        request_id: context.requestId,
        notebook_id: notebook.id,
        job_id: job.id,
        type: parsed.type,
        progress: job.progress,
      });
      const query = artifactQuery(parsed.type, parsed.options);
      const evidencePack = await buildEvidencePack({
        notebook_id: notebook.id,
        question: query,
        source_mode: parsed.options.source_mode || "active",
        selected_source_ids: parsed.options.selected_source_ids || [],
        artifact_type: parsed.type,
      });
      state.retrievalRuns.push(evidencePack.retrieval_run);
      state.evidencePacks.push(evidencePack);
      logger.info("artifact.evidence_pack.created", {
        request_id: context.requestId,
        notebook_id: notebook.id,
        job_id: job.id,
        type: parsed.type,
        evidence_pack_id: evidencePack.id,
        active_sources: evidencePack.active_source_ids.length,
        evidence_items: evidencePack.evidence_items.length,
      });

      const artifactId = id("artifact");
      const artifactOptions = {
        ...parsed.options,
        artifact_id: artifactId,
      };
      let artifactPayload;
      let modelRunIds = [];
      if (parsed.type === "youtube-kit") {
        artifactPayload = await buildYouTubeKit(notebook, evidencePack, artifactOptions);
      } else if (parsed.type === "thumbnail") {
        artifactPayload = await buildThumbnail(notebook, evidencePack, artifactOptions);
      } else if (parsed.type === "infographic") {
        artifactPayload = await buildInfographic(notebook, evidencePack, artifactOptions);
      } else {
        const artifactResult = await buildArtifactPayload(parsed.type, notebook, evidencePack, artifactOptions);
        const localPayload = artifactResult?.payload || artifactResult;
        const artifactModelRuns = artifactResult?.model_runs || [];
        const generation = await modelRouter.generateArtifactPayload({
          type: parsed.type,
          notebook,
          evidencePack,
          options: artifactOptions,
          localPayload,
          startRun: startModelRun,
        });
        artifactPayload = generation.payload;
        if (parsed.type === "infographic") {
          artifactPayload = finalizeInfographicPayload(artifactPayload, localPayload);
        }
        if (parsed.type === "slide-deck") {
          artifactPayload = attachSlideSvgs(artifactPayload);
        }
        if (artifactPayload && typeof artifactPayload === "object" && !Array.isArray(artifactPayload)) {
          artifactPayload.generation_provider = generation.active_run.provider;
          artifactPayload.generation_model = generation.active_run.model;
          artifactPayload.generation_fallback_reason = generation.fallback_reason || "";
          artifactPayload.evidence_audit = buildArtifactEvidenceAudit(evidencePack, artifactPayload);
        }
        state.modelRuns.push(...generation.model_runs, ...artifactModelRuns);
        modelRunIds = [...generation.model_runs.map((run) => run.id), ...artifactModelRuns.map((run) => run.id)];
      }
      if (parsed.type === "audio") {
        const audioRun = await renderAudioArtifact({
          artifactDir,
          artifactId,
          payload: artifactPayload,
        });
        if (audioRun) {
          state.modelRuns.push(audioRun);
          modelRunIds.push(audioRun.id);
        }
      }
      const artifact = {
        id: artifactId,
        notebook_id: notebook.id,
        type: parsed.type,
        title: artifactPayload.title,
        content_json: artifactPayload,
        text_content: renderArtifactText(parsed.type, artifactPayload),
        file_path: "",
        source_refs_json: collectSourceRefs(evidencePack),
        model_runs_json: modelRunIds,
        created_at: now(),
      };
      if (parsed.type === "flashcards") {
        const deck = createFlashcardDeckFromArtifact({
          notebook,
          artifact,
          options: parsed.options,
          evidencePack,
        });
        artifact.content_json.deck_id = deck.id;
        artifact.content_json.progress = deck.progress;
      }
      artifact.file_path = await writeArtifactFile(artifactDir, artifact);
      state.artifacts.push(artifact);
      job.status = "completed";
      job.progress = 100;
      job.result_artifact_id = artifact.id;
      job.updated_at = now();
      await persist();
      logger.info("artifact.job.completed", {
        request_id: context.requestId,
        notebook_id: notebook.id,
        job_id: job.id,
        artifact_id: artifact.id,
        type: parsed.type,
        progress: job.progress,
        source_refs: artifact.source_refs_json.length,
        model_runs: modelRunIds,
        provider: artifactPayload.generation_provider || "local",
        fallback_reason: artifactPayload.generation_fallback_reason || "",
        duration_ms: Date.now() - startedAt,
      });
      return { job, artifact, evidence_pack: evidencePack };
     } catch (error) {
      job.status = "failed";
      job.error = error.message;
      job.updated_at = now();
      await persist();
      logger.error("artifact.job.failed", {
        request_id: context.requestId,
        notebook_id: notebook.id,
        job_id: job.id,
        type: parsed.type,
        duration_ms: Date.now() - startedAt,
        error,
      });
      throw error;
     }
    };

    // Legacy/sync callers await the full artifact. The default path runs the job in
    // the background and returns immediately, so long artifacts (audio/video, 60-120s)
    // never hit Firebase Hosting's ~60s rewrite-proxy timeout — the client polls the job.
    if (context.sync) {
      return runJob();
    }
    runJob().catch(() => {
      // Failure is already recorded on the job (status/error) and logged above.
    });
    return { job, artifact: null, evidence_pack: null };
  }

  async function seedDemo({ resetFirst = false, ownerUserId = "", requestId = "" } = {}) {
    const startedAt = Date.now();
    logger.info("seed.start", {
      request_id: requestId,
      reset: resetFirst,
      owner_user_id: ownerUserId,
    });
    if (resetFirst) {
      if (ownerUserId) {
        resetOwnerData(ownerUserId);
        await persist();
      } else {
        await reset();
      }
    }
    const context = {
      ...(ownerUserId ? { ownerUserId } : {}),
      ...(requestId ? { requestId } : {}),
    };
    const existing = state.notebooks.find(
      (notebook) => [PRODUCT_NAME, "SourceStudio Demo Notebook"].includes(notebook.title) && notebookBelongsTo(notebook, context),
    );
    if (existing) {
      logger.info("seed.reuse_existing", {
        request_id: requestId,
        notebook_id: existing.id,
        owner_user_id: ownerUserId,
        duration_ms: Date.now() - startedAt,
      });
      return decorateNotebook(existing.id);
    }

    const notebook = await createNotebook({
      title: PRODUCT_NAME,
      description: "Seeded demo notebook for a source-grounded AI research workbench.",
    }, context);
    const files = [
      "everlast_ai_consulting.md",
      "notebooklm_architecture_notes.md",
      "ai_automation_for_smes.md",
      "source_grounding_best_practices.md",
    ];
    for (const file of files) {
      const filePath = join(root, "sample_sources", file);
      const body = await readFile(filePath, "utf8");
      await ingestSource(notebook.id, {
        type: "markdown",
        title: titleFromFile(file),
        body,
        file_name: file,
        active: true,
      }, context);
    }
    await createArtifact({ notebook_id: notebook.id, type: "report", options: { report_type: "Executive Brief" } }, context);
    await createArtifact({ notebook_id: notebook.id, type: "mindmap", options: {} }, context);
    await createArtifact({ notebook_id: notebook.id, type: "quiz", options: {} }, context);
    logger.info("seed.complete", {
      request_id: requestId,
      notebook_id: notebook.id,
      owner_user_id: ownerUserId,
      duration_ms: Date.now() - startedAt,
    });
    return decorateNotebook(notebook.id);
  }

  function getCitationLedger(messageId, context = {}) {
    const message = state.chatMessages.find((item) => item.id === messageId);
    if (!message) throw statusError(404, "Message not found.");
    assertNotebookAccess(message.notebook_id, context);
    const ledger = state.citationLedgers.find((item) => item.id === message.citation_ledger_id);
    return ledger || null;
  }

  function getSourceBlocks(sourceId, context = {}) {
    assertSourceAccess(findSource(sourceId), context);
    return state.blocks.filter((block) => block.source_id === sourceId);
  }

  function getArtifact(artifactId, context = {}) {
    const artifact = state.artifacts.find((item) => item.id === artifactId);
    if (!artifact) throw statusError(404, "Artifact not found.");
    assertNotebookAccess(artifact.notebook_id, context);
    return artifact;
  }

  async function getFlashcardDeckForArtifact(artifactId, context = {}) {
    const artifact = getArtifact(artifactId, context);
    if (artifact.type !== "flashcards") throw statusError(400, "Artifact is not a flashcard deck.");
    let deck = state.flashcardDecks.find((item) => item.artifact_id === artifactId);
    if (!deck) {
      const notebook = assertNotebookAccess(artifact.notebook_id, context);
      deck = createFlashcardDeckFromArtifact({
        notebook,
        artifact,
        options: artifact.content_json?.options_json || {},
        evidencePack: null,
      });
      artifact.content_json.deck_id = deck.id;
      artifact.content_json.progress = deck.progress;
      artifact.file_path = await writeArtifactFile(artifactDir, artifact);
      await persist();
    }
    return decorateFlashcardDeck(deck.id, context);
  }

  async function recordFlashcardReview(deckId, input = {}, context = {}) {
    const parsed = FlashcardReviewSchema.parse(input);
    const deck = findFlashcardDeck(deckId);
    assertNotebookAccess(deck.notebook_id, context);
    const card = state.flashcards.find(
      (item) => item.deck_id === deckId && item.id === parsed.card_id && item.status !== "deleted",
    );
    if (!card) throw statusError(404, "Flashcard not found.");
    const review = {
      id: id("review"),
      notebook_id: deck.notebook_id,
      deck_id: deck.id,
      card_id: card.id,
      result: parsed.result,
      session_id: parsed.session_id || "default",
      created_at: now(),
    };
    state.flashcardReviews.push(review);
    deck.updated_at = now();
    const artifact = syncFlashcardArtifactProgress(deck.id);
    if (artifact) artifact.file_path = await writeArtifactFile(artifactDir, artifact);
    await persist();
    return decorateFlashcardDeck(deck.id, context);
  }

  async function deleteFlashcard(deckId, cardId, context = {}) {
    const deck = findFlashcardDeck(deckId);
    assertNotebookAccess(deck.notebook_id, context);
    const card = state.flashcards.find((item) => item.deck_id === deckId && item.id === cardId);
    if (!card) throw statusError(404, "Flashcard not found.");
    card.status = "deleted";
    card.updated_at = now();
    deck.updated_at = now();
    const artifact = syncFlashcardArtifactProgress(deck.id);
    if (artifact) artifact.file_path = await writeArtifactFile(artifactDir, artifact);
    await persist();
    return decorateFlashcardDeck(deck.id, context);
  }

  async function resetFlashcardDeck(deckId, context = {}) {
    const deck = findFlashcardDeck(deckId);
    assertNotebookAccess(deck.notebook_id, context);
    state.flashcardReviews = state.flashcardReviews.filter((review) => review.deck_id !== deckId);
    deck.updated_at = now();
    const artifact = syncFlashcardArtifactProgress(deck.id);
    if (artifact) artifact.file_path = await writeArtifactFile(artifactDir, artifact);
    await persist();
    return decorateFlashcardDeck(deck.id, context);
  }

  async function createAdaptiveFlashcards(deckId, input = {}, context = {}) {
    const deck = findFlashcardDeck(deckId);
    assertNotebookAccess(deck.notebook_id, context);
    const decorated = decorateFlashcardDeck(deckId, context);
    const missed = decorated.cards
      .filter((card) => card.review_state === "missed")
      .slice(0, Number(input.limit || 4));
    const baseCards = missed.length ? missed : decorated.cards.filter((card) => card.status !== "deleted").slice(0, 3);
    const created = [];
    for (const card of baseCards) {
      const variants = buildAdaptiveCards(card, deck, created.length);
      for (const variant of variants) {
        if (created.length >= 6) break;
        state.flashcards.push(variant);
        created.push(variant);
      }
    }
    deck.updated_at = now();
    const artifact = syncFlashcardArtifactProgress(deck.id);
    if (artifact) artifact.file_path = await writeArtifactFile(artifactDir, artifact);
    await persist();
    logger.info("flashcards.adaptive.created", {
      request_id: context.requestId,
      notebook_id: deck.notebook_id,
      deck_id: deck.id,
      base_cards: baseCards.length,
      created_cards: created.length,
    });
    return decorateFlashcardDeck(deck.id, context);
  }

  function getArtifactMedia(artifactId, context = {}) {
    const artifact = getArtifact(artifactId, context);
    const mediaPath = artifact.content_json?.audio_file_path || "";
    if (!mediaPath) throw statusError(404, "Artifact has no rendered media file.");
    return {
      path: resolve(root, mediaPath),
      content_type: artifact.content_json?.audio_content_type || "audio/mpeg",
      file_name: artifact.content_json?.audio_file_name || `${artifact.id}.mp3`,
    };
  }

  function getJob(jobId, context = {}) {
    const job = state.artifactJobs.find((item) => item.id === jobId);
    if (!job) throw statusError(404, "Job not found.");
    assertNotebookAccess(job.notebook_id, context);
    return job;
  }

  function listModelRuns() {
    return state.modelRuns.slice(-80).reverse();
  }

  function debugSnapshot(context = {}) {
    const notebookIds = ownedNotebookIds(context);
    const jobs = state.artifactJobs
      .filter((job) => notebookIds.has(job.notebook_id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const messages = state.chatMessages
      .filter((message) => notebookIds.has(message.notebook_id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return {
      server_time: now(),
      storage_dir: storageLabel(root, storageDir),
      provider: providerStatus(),
      counts: stateCounts(context),
      running_jobs: jobs
        .filter((job) => ["queued", "running"].includes(job.status))
        .map(debugJob),
      failed_jobs: jobs
        .filter((job) => job.status === "failed")
        .slice(0, 8)
        .map(debugJob),
      recent_jobs: jobs.slice(0, 12).map(debugJob),
      recent_model_runs: state.modelRuns.slice(-16).reverse().map(debugModelRun),
      recent_messages: messages.slice(0, 10).map((message) => ({
        id: message.id,
        role: message.role,
        mode: message.mode || "",
        provider: message.provider || "",
        model: message.model || "",
        citations: message.citations?.length || 0,
        claim_stats: message.claim_stats || null,
        created_at: message.created_at,
      })),
    };
  }

  return {
    health,
    providerStatus,
    debugSnapshot,
    reset,
    createNotebook,
    listNotebooks,
    getNotebook,
    renameNotebook,
    ingestSource,
    setSourceActive,
    deleteSource,
    askChat,
    createArtifact,
    seedDemo,
    getCitationLedger,
    getSourceBlocks,
    getArtifact,
    getFlashcardDeckForArtifact,
    recordFlashcardReview,
    deleteFlashcard,
    resetFlashcardDeck,
    createAdaptiveFlashcards,
    getArtifactMedia,
    getJob,
    listModelRuns,
    _state: () => state,
    _internals: {
      parseMarkdownBlocks,
      chunkDocument,
      buildEvidencePack,
      verifyAnswer,
      embedText,
      tokenize,
    },
  };

  function ownedNotebookIds(context = {}) {
    return new Set(
      state.notebooks
        .filter((notebook) => notebookBelongsTo(notebook, context))
        .map((notebook) => notebook.id),
    );
  }

  function stateCounts(context = {}) {
    const notebookIds = ownedNotebookIds(context);
    const sourceIds = new Set(state.sources.filter((source) => notebookIds.has(source.notebook_id)).map((source) => source.id));
    const chunkIds = new Set(state.chunks.filter((chunk) => sourceIds.has(chunk.source_id)).map((chunk) => chunk.id));
    return {
      notebooks: notebookIds.size,
      sources: sourceIds.size,
      blocks: state.blocks.filter((block) => sourceIds.has(block.source_id)).length,
      chunks: chunkIds.size,
      knowledge_objects: state.knowledgeObjects.filter((object) => notebookIds.has(object.notebook_id)).length,
      messages: state.chatMessages.filter((message) => notebookIds.has(message.notebook_id)).length,
      evidence_packs: state.evidencePacks.filter((pack) => notebookIds.has(pack.notebook_id)).length,
      retrieval_runs: state.retrievalRuns.filter((run) => notebookIds.has(run.notebook_id)).length,
      artifacts: state.artifacts.filter((artifact) => notebookIds.has(artifact.notebook_id)).length,
      artifact_jobs: state.artifactJobs.filter((job) => notebookIds.has(job.notebook_id)).length,
      flashcard_decks: state.flashcardDecks.filter((deck) => notebookIds.has(deck.notebook_id)).length,
      flashcards: state.flashcards.filter((card) => notebookIds.has(card.notebook_id)).length,
      flashcard_reviews: state.flashcardReviews.filter((review) => notebookIds.has(review.notebook_id)).length,
      model_runs: state.modelRuns.length,
    };
  }

  function debugJob(job) {
    return {
      id: job.id,
      notebook_id: job.notebook_id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result_artifact_id: job.result_artifact_id,
      error: job.error || "",
      created_at: job.created_at,
      updated_at: job.updated_at,
    };
  }

  function debugModelRun(run) {
    return {
      id: run.id,
      role: run.role,
      provider: run.provider,
      model: run.model,
      status: run.status,
      input_tokens_estimate: run.input_tokens_estimate,
      output_tokens_estimate: run.output_tokens_estimate,
      latency_ms: run.latency_ms,
      error: run.error || "",
      created_at: run.created_at,
    };
  }

  function notebookBelongsTo(notebook, context = {}) {
    if (!context.ownerUserId) return true;
    return notebook?.owner_user_id === context.ownerUserId;
  }

  function assertNotebookAccess(notebookId, context = {}) {
    const notebook = state.notebooks.find((item) => item.id === notebookId);
    if (!notebook || !notebookBelongsTo(notebook, context)) {
      throw statusError(404, "Notebook not found.");
    }
    return notebook;
  }

  function assertSourceAccess(source, context = {}) {
    assertNotebookAccess(source.notebook_id, context);
  }

  function resetOwnerData(ownerUserId) {
    const notebookIds = new Set(
      state.notebooks.filter((notebook) => notebook.owner_user_id === ownerUserId).map((notebook) => notebook.id),
    );
    const sourceIds = new Set(
      state.sources.filter((source) => notebookIds.has(source.notebook_id)).map((source) => source.id),
    );
    const chunkIds = new Set(
      state.chunks.filter((chunk) => sourceIds.has(chunk.source_id)).map((chunk) => chunk.id),
    );
    const artifactIds = new Set(
      state.artifacts.filter((artifact) => notebookIds.has(artifact.notebook_id)).map((artifact) => artifact.id),
    );
    const jobIds = new Set(
      state.artifactJobs.filter((job) => notebookIds.has(job.notebook_id)).map((job) => job.id),
    );
    const messageIds = new Set(
      state.chatMessages.filter((message) => notebookIds.has(message.notebook_id)).map((message) => message.id),
    );
    const evidencePackIds = new Set(
      state.evidencePacks.filter((pack) => notebookIds.has(pack.notebook_id)).map((pack) => pack.id),
    );
    const retrievalRunIds = new Set(
      state.retrievalRuns.filter((run) => notebookIds.has(run.notebook_id)).map((run) => run.id),
    );

    state.notebooks = state.notebooks.filter((notebook) => !notebookIds.has(notebook.id));
    state.sources = state.sources.filter((source) => !sourceIds.has(source.id));
    state.blocks = state.blocks.filter((block) => !sourceIds.has(block.source_id));
    state.chunks = state.chunks.filter((chunk) => !chunkIds.has(chunk.id));
    state.embeddings = state.embeddings.filter((embedding) => !chunkIds.has(embedding.chunk_id));
    state.knowledgeObjects = state.knowledgeObjects.filter((object) => !notebookIds.has(object.notebook_id));
    state.chatSessions = state.chatSessions.filter((session) => !notebookIds.has(session.notebook_id));
    state.chatMessages = state.chatMessages.filter((message) => !messageIds.has(message.id));
    state.retrievalRuns = state.retrievalRuns.filter((run) => !retrievalRunIds.has(run.id));
    state.evidencePacks = state.evidencePacks.filter((pack) => !evidencePackIds.has(pack.id));
    state.citationLedgers = state.citationLedgers.filter(
      (ledger) => !evidencePackIds.has(ledger.evidence_pack_id) && !messageIds.has(ledger.answer_message_id),
    );
    state.artifactJobs = state.artifactJobs.filter((job) => !jobIds.has(job.id));
    state.artifacts = state.artifacts.filter((artifact) => !artifactIds.has(artifact.id));
    state.flashcardDecks = state.flashcardDecks.filter(
      (deck) => !notebookIds.has(deck.notebook_id) && !artifactIds.has(deck.artifact_id),
    );
    state.flashcards = state.flashcards.filter(
      (card) => !notebookIds.has(card.notebook_id) && !artifactIds.has(card.artifact_id),
    );
    const cardIds = new Set(state.flashcards.map((card) => card.id));
    state.flashcardReviews = state.flashcardReviews.filter((review) => cardIds.has(review.card_id));
  }

  function findSource(sourceId) {
    const source = state.sources.find((item) => item.id === sourceId);
    if (!source) throw statusError(404, "Source not found.");
    return source;
  }

  function decorateNotebook(notebookId) {
    const notebook = state.notebooks.find((item) => item.id === notebookId);
    if (!notebook) return null;
    const sources = state.sources
      .filter((source) => source.notebook_id === notebookId)
      .map((source) => decorateSource(source.id));
    const artifacts = state.artifacts
      .filter((artifact) => artifact.notebook_id === notebookId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const jobs = state.artifactJobs
      .filter((job) => job.notebook_id === notebookId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const knowledge = state.knowledgeObjects.filter((object) => object.notebook_id === notebookId);
    const messages = state.chatMessages
      .filter((message) => message.notebook_id === notebookId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const notebookSummary = knowledge.find((object) => object.type === "notebook_summary")?.data?.summary || "";
    return {
      ...notebook,
      source_count: sources.length,
      active_source_count: sources.filter((source) => source.active).length,
      summary: notebookSummary,
      sources,
      artifacts,
      jobs,
      knowledge,
      messages,
      suggested_questions: knowledge.find((object) => object.type === "suggested_questions")?.data?.questions || [],
      suggested_artifacts: knowledge.find((object) => object.type === "suggested_artifacts")?.data?.artifacts || [],
    };
  }

  function decorateSource(sourceId, options = {}) {
    const source = state.sources.find((item) => item.id === sourceId);
    if (!source) return null;
    const blocks = state.blocks.filter((block) => block.source_id === sourceId);
    const chunks = state.chunks.filter((chunk) => chunk.source_id === sourceId);
    const knowledge = state.knowledgeObjects.filter(
      (object) => object.source_id === sourceId && object.type !== "notebook_summary",
    );
    const base = {
      ...source,
      block_count: blocks.length,
      chunk_count: chunks.length,
      word_count: source.cleaned_text ? tokenize(source.cleaned_text).length : 0,
      summary: knowledge.find((object) => object.type === "source_summary")?.data?.summary || "",
      knowledge,
    };
    if (options.includeBlocks) base.blocks = blocks;
    return base;
  }

  function findFlashcardDeck(deckId) {
    const deck = state.flashcardDecks.find((item) => item.id === deckId);
    if (!deck) throw statusError(404, "Flashcard deck not found.");
    return deck;
  }

  function createFlashcardDeckFromArtifact({ notebook, artifact, options = {}, evidencePack = null }) {
    const existing = state.flashcardDecks.find((deck) => deck.artifact_id === artifact.id);
    if (existing) return decorateFlashcardDeck(existing.id);
    const timestamp = now();
    const payloadOptions = artifact.content_json?.options_json || {};
    const plan = buildFlashcardPlan({ ...payloadOptions, ...options });
    const deck = {
      id: id("deck"),
      notebook_id: notebook.id,
      artifact_id: artifact.id,
      title: artifact.title,
      options_json: {
        topic: plan.topic,
        language: plan.language,
        audience: plan.audience,
        count_preset: plan.countPreset,
        count: plan.count,
        difficulty: plan.difficulty,
        card_types: plan.cardTypes,
        source_mode: options.source_mode || "active",
        selected_source_ids: options.selected_source_ids || [],
      },
      evidence_pack_id: evidencePack?.id || artifact.content_json?.evidence_audit?.evidence_pack_id || "",
      created_at: timestamp,
      updated_at: timestamp,
    };
    const cards = Array.isArray(artifact.content_json?.cards) ? artifact.content_json.cards : [];
    const normalizedCards = cards.map((card, index) => normalizeFlashcardCard(card, deck, artifact, index));
    state.flashcardDecks.push(deck);
    state.flashcards.push(...normalizedCards);
    const decorated = decorateFlashcardDeck(deck.id);
    artifact.content_json.deck_id = deck.id;
    artifact.content_json.progress = decorated.progress;
    artifact.content_json.cards = decorated.cards.map((card) => flashcardCardForPayload(card));
    artifact.text_content = renderArtifactText(artifact.type, artifact.content_json);
    return decorated;
  }

  function normalizeFlashcardCard(card, deck, artifact, index) {
    const timestamp = now();
    const sourceRefs = normalizeSourceRefs(card.source_refs);
    return {
      id: card.id || id("card"),
      notebook_id: deck.notebook_id,
      deck_id: deck.id,
      artifact_id: artifact.id,
      order_index: Number(card.order_index || index + 1),
      card_type: card.card_type || "concept",
      learning_goal: card.learning_goal || "",
      question: card.question || `What should you remember from card ${index + 1}?`,
      answer: card.answer || "",
      explanation: card.explanation || "This card is generated from cited source evidence.",
      hint: card.hint || "",
      difficulty: card.difficulty || deck.options_json.difficulty || "mixed",
      tags: Array.isArray(card.tags) ? card.tags.slice(0, 10) : [],
      citation: card.citation || `[${index + 1}]`,
      evidence_id: card.evidence_id || "",
      evidence_quote: card.evidence_quote || sourceRefs[0]?.quote || "",
      source_title: card.source_title || "",
      source_refs: sourceRefs,
      support_level: card.support_level || "supported",
      confidence: Number(card.confidence || 0.8),
      status: card.status || "active",
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  function normalizeSourceRefs(refs) {
    const list = Array.isArray(refs) ? refs : refs ? [refs] : [];
    return list
      .filter(Boolean)
      .map((ref) => ({
        source_id: ref.source_id || ref.sourceId || "",
        block_ids: Array.isArray(ref.block_ids) ? ref.block_ids : [],
        chunk_id: ref.chunk_id || "",
        quote: ref.quote || "",
      }))
      .filter((ref) => ref.source_id || ref.quote);
  }

  function decorateFlashcardDeck(deckId, context = {}) {
    const deck = findFlashcardDeck(deckId);
    assertNotebookAccess(deck.notebook_id, context);
    const cards = state.flashcards
      .filter((card) => card.deck_id === deck.id && card.status !== "deleted")
      .sort((a, b) => a.order_index - b.order_index)
      .map(decorateFlashcardCard);
    return {
      ...deck,
      cards,
      progress: flashcardProgress(deck.id),
      source_coverage: flashcardSourceCoverage(cards),
    };
  }

  function decorateFlashcardCard(card) {
    const reviews = state.flashcardReviews
      .filter((review) => review.card_id === card.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const gotIt = reviews.filter((review) => review.result === "got_it").length;
    const missed = reviews.filter((review) => review.result === "missed").length;
    const lastReview = reviews.at(-1) || null;
    const masteryScore = reviews.length ? gotIt / reviews.length : 0;
    return {
      ...card,
      attempts: reviews.length,
      got_it_count: gotIt,
      missed_count: missed,
      review_state: lastReview?.result || "new",
      last_reviewed_at: lastReview?.created_at || "",
      mastery_score: Number(masteryScore.toFixed(2)),
      due_state: !reviews.length || lastReview?.result === "missed" ? "due" : "reviewed",
    };
  }

  function flashcardProgress(deckId) {
    const activeCards = state.flashcards.filter((card) => card.deck_id === deckId && card.status !== "deleted");
    const allCards = state.flashcards.filter((card) => card.deck_id === deckId);
    const decorated = activeCards.map(decorateFlashcardCard);
    const reviewed = decorated.filter((card) => card.review_state !== "new").length;
    const gotIt = decorated.filter((card) => card.review_state === "got_it").length;
    const missed = decorated.filter((card) => card.review_state === "missed").length;
    const due = decorated.filter((card) => card.due_state === "due").length;
    const masteryScore = decorated.length
      ? decorated.reduce((sum, card) => sum + card.mastery_score, 0) / decorated.length
      : 0;
    return {
      total: decorated.length,
      active: decorated.length,
      deleted: allCards.length - decorated.length,
      reviewed,
      remaining: Math.max(0, decorated.length - reviewed),
      due,
      got_it: gotIt,
      missed,
      mastery_score: Number(masteryScore.toFixed(2)),
      session_complete: Boolean(decorated.length && reviewed >= decorated.length),
    };
  }

  function flashcardSourceCoverage(cards) {
    const sourceIds = new Set(cards.flatMap((card) => card.source_refs || []).map((ref) => ref.source_id).filter(Boolean));
    return {
      cited_source_count: sourceIds.size,
      cited_sources: [...sourceIds],
    };
  }

  function syncFlashcardArtifactProgress(deckId) {
    const deck = findFlashcardDeck(deckId);
    const artifact = state.artifacts.find((item) => item.id === deck.artifact_id);
    if (!artifact) return null;
    const decorated = decorateFlashcardDeck(deck.id);
    artifact.content_json.deck_id = deck.id;
    artifact.content_json.progress = decorated.progress;
    artifact.content_json.cards = decorated.cards.map((card) => flashcardCardForPayload(card));
    artifact.text_content = renderArtifactText(artifact.type, artifact.content_json);
    return artifact;
  }

  function flashcardCardForPayload(card) {
    return {
      id: card.id,
      card_type: card.card_type,
      learning_goal: card.learning_goal,
      question: card.question,
      answer: card.answer,
      explanation: card.explanation,
      hint: card.hint,
      difficulty: card.difficulty,
      tags: card.tags,
      citation: card.citation,
      evidence_id: card.evidence_id,
      evidence_quote: card.evidence_quote,
      source_title: card.source_title,
      source_refs: card.source_refs,
      support_level: card.support_level,
      confidence: card.confidence,
      attempts: card.attempts,
      review_state: card.review_state,
      mastery_score: card.mastery_score,
    };
  }

  function buildAdaptiveCards(card, deck, offset) {
    const baseSentence = stripCitations(card.answer || card.evidence_quote || "");
    const topic = titleCase(topicFromSentence(baseSentence || card.question));
    const timestamp = now();
    const base = {
      notebook_id: deck.notebook_id,
      deck_id: deck.id,
      artifact_id: deck.artifact_id,
      difficulty: card.difficulty === "easy" ? "medium" : "hard",
      tags: [...new Set([...(card.tags || []), "adaptive", "missed-review"])].slice(0, 10),
      citation: card.citation,
      evidence_id: card.evidence_id,
      evidence_quote: card.evidence_quote,
      source_title: card.source_title,
      source_refs: card.source_refs,
      support_level: card.support_level,
      confidence: card.confidence,
      status: "active",
      created_at: timestamp,
      updated_at: timestamp,
    };
    const currentMax = Math.max(0, ...state.flashcards.filter((item) => item.deck_id === deck.id).map((item) => item.order_index || 0));
    return [
      {
        ...base,
        id: id("card"),
        order_index: currentMax + offset * 2 + 1,
        card_type: "application",
        learning_goal: `Apply the previously missed claim about ${topic}.`,
        question: `You missed this concept: how would you explain ${topic} using only the cited source?`,
        answer: card.answer,
        explanation: `This adaptive card repeats the same evidence boundary with a practical prompt so the concept can be recovered from memory.`,
        hint: card.hint || `Stay inside the cited quote about ${topic}.`,
      },
      {
        ...base,
        id: id("card"),
        order_index: currentMax + offset * 2 + 2,
        card_type: "source-check",
        learning_goal: `Verify the source-supported wording for ${topic}.`,
        question: `What exact source-backed claim should replace a vague answer about ${topic}?`,
        answer: card.answer,
        explanation: `This adaptive card turns the missed item into a citation check, which helps prevent fluent but unsupported recall.`,
        hint: `Use the attached citation and avoid adding outside assumptions.`,
      },
    ];
  }

  function removeSourceDerivedRows(sourceId) {
    state.blocks = state.blocks.filter((item) => item.source_id !== sourceId);
    state.chunks = state.chunks.filter((item) => item.source_id !== sourceId);
    state.embeddings = state.embeddings.filter((embedding) => {
      const chunk = state.chunks.find((item) => item.id === embedding.chunk_id);
      return chunk && chunk.source_id !== sourceId;
    });
    state.knowledgeObjects = state.knowledgeObjects.filter((item) => item.source_id !== sourceId);
  }

  async function parseSource(source, payload, context = {}) {
    if (source.type === "youtube") {
      const videoId = youtubeVideoId(source.original_url);
      let rawText = payload.body?.trim()
        ? payload.body
        : await fetchYouTubeTranscript(source.original_url, fetchImpl);
      let parser = payload.body?.trim() ? "youtube-user-transcript" : "youtube-transcript-fetcher";
      // No captions available? Transcribe the audio track with Deepgram so the
      // video is still fully transcribed instead of left as a short placeholder.
      if (
        !payload.body?.trim() &&
        /no public or auto-generated captions|did not include a youtube video id|transcript was not available|no captions/i.test(rawText) &&
        realProviderKey(env.DEEPGRAM_API_KEY)
      ) {
        logger.info("youtube.audio_transcribe.start", { request_id: context.requestId, video_id: videoId });
        const audioText = await fetchYouTubeAudioTranscript(videoId, {
          apiKey: realProviderKey(env.DEEPGRAM_API_KEY),
          model: env.DEEPGRAM_MODEL || "nova-3",
          fetchImpl,
        });
        if (audioText && audioText.split(/\s+/).length > 30) {
          rawText = `# YouTube transcript (audio)\n\n${audioText}`;
          parser = "youtube-deepgram-asr";
          logger.info("youtube.audio_transcribe.complete", { request_id: context.requestId, video_id: videoId, words: audioText.split(/\s+/).length });
        }
      }
      // Use the real video title when the user didn't name the source (avoids "youtube.com").
      if (!payload.title?.trim() && !payload.body?.trim()) {
        const ytTitle = await fetchYouTubeTitle(videoId);
        if (ytTitle) source.title = ytTitle;
      }
      return parseMarkdownLikeDocument(source, {
        rawText,
        cleanedText: normalizeWhitespace(rawText),
        parser,
        fallback: !payload.body?.trim() && /transcript was not available|no public or auto-generated captions/i.test(rawText),
        metadata: {
          original_url: source.original_url,
          video_id: videoId,
        },
      });
    }
    if (source.type === "google_doc") {
      const rawText = payload.body?.trim()
        ? payload.body
        : await fetchGoogleDocText(source.original_url, fetchImpl);
      return parseMarkdownLikeDocument(source, {
        rawText,
        cleanedText: normalizeWhitespace(rawText),
        parser: payload.body?.trim() ? "google-doc-pasted-text" : "google-doc-export-text",
        fallback: false,
        metadata: {
          original_url: source.original_url,
          export_url: googleDocExportUrl(source.original_url) || "",
        },
      });
    }
    if (source.type === "audio") {
      let rawText = payload.body?.trim() || "";
      let parser = rawText ? "audio-user-transcript" : "audio-transcript-required";
      let transcriptionStatus = rawText ? "provided" : "missing";
      if (!rawText && payload.base64 && realProviderKey(env.DEEPGRAM_API_KEY)) {
        try {
          const transcript = await transcribeAudioWithDeepgram(Buffer.from(payload.base64, "base64"), {
            apiKey: realProviderKey(env.DEEPGRAM_API_KEY),
            model: env.DEEPGRAM_MODEL || "nova-3",
            fetchImpl,
          });
          if (transcript) {
            rawText = `# Audio transcript\n\n${transcript}`;
            parser = "deepgram-nova-3";
            transcriptionStatus = "transcribed";
          }
        } catch (error) {
          logger.warn("audio.transcription.failed", { error: String(error?.message || error).slice(0, 200) });
        }
      }
      if (!rawText) {
        rawText = `# Audio source: ${source.title}\n\nAudio file uploaded. Configure DEEPGRAM_API_KEY to transcribe automatically, or paste a transcript to make this source searchable.`;
      }
      return parseMarkdownLikeDocument(source, {
        rawText,
        cleanedText: normalizeWhitespace(rawText),
        parser,
        fallback: parser === "audio-transcript-required",
        metadata: {
          file_name: payload.file_name || "",
          mime_type: payload.mime_type || "",
          transcription_status: transcriptionStatus,
        },
      });
    }
    if (source.type === "image") {
      let rawText = payload.body?.trim() || "";
      let parser = rawText ? "image-caption-provided" : "image-undescribed";
      if (!rawText && payload.base64) {
        try {
          const description = await describeImage(payload.base64, payload.mime_type, {
            apiKey: realProviderKey(env.OPENAI_API_KEY),
            fetchImpl,
          });
          if (description) {
            rawText = `# Image: ${source.title}\n\n${description}`;
            parser = `vision-${process.env.OPENAI_VISION_MODEL || "gpt-5.5"}`;
          }
        } catch (error) {
          logger.warn("image.vision.failed", { error: String(error?.message || error).slice(0, 160) });
        }
      }
      if (!rawText) {
        rawText = `# Image source: ${source.title}\n\nImage uploaded. Configure OPENAI_API_KEY for vision description, or paste a caption.`;
      }
      return parseMarkdownLikeDocument(source, {
        rawText,
        cleanedText: normalizeWhitespace(rawText),
        parser,
        fallback: parser === "image-undescribed",
        metadata: { file_name: payload.file_name || "", mime_type: payload.mime_type || "" },
      });
    }
    if (source.type === "docx") {
      const rawText = payload.body?.trim()
        ? payload.body
        : await parseDocxTextFallback(source.file_path);
      return parseMarkdownLikeDocument(source, {
        rawText,
        cleanedText: normalizeWhitespace(rawText),
        parser: payload.body?.trim() ? "docx-pasted-text" : "docx-xml-text-fallback",
        fallback: !payload.body?.trim(),
        metadata: {
          file_name: payload.file_name || "",
          mime_type: payload.mime_type || "",
        },
      });
    }
    if (source.type === "url") {
      if (payload.body?.trim() || payload.crawl === false) {
        const fetched = payload.body?.trim()
          ? payload.body
          : await fetchUrlText(source.original_url, fetchImpl);
        return parseMarkdownLikeDocument(source, {
          rawText: fetched,
          cleanedText: normalizeWhitespace(fetched),
          parser: "url-readability-lite",
          fallback: !payload.body?.trim() && !fetched,
          metadata: {
            crawl_enabled: false,
            crawl_pages: 1,
            crawled_urls: [source.original_url].filter(Boolean),
          },
        });
      }
      const crawled = await crawlWebsiteSource(source.original_url, {
        maxPages: payload.crawl_max_pages,
        requestId: context.requestId,
      });
      return parseMarkdownLikeDocument(source, {
        rawText: crawled.rawText,
        cleanedText: crawled.cleanedText,
        parser: "same-origin-site-crawler",
        fallback: crawled.pages.length <= 1,
        metadata: {
          crawl_enabled: true,
          crawl_pages: crawled.pages.length,
          crawl_discovered_urls: crawled.discoveredCount,
          crawled_urls: crawled.pages.map((page) => page.url),
          crawl_failed_urls: crawled.failures,
        },
      });
    }
    if (source.type === "pdf") {
      let rawText = payload.body || "";
      let parser = "pdf-pasted-text";
      let fallback = !payload.body;
      if (payload.base64) {
        const extracted = await extractPdfText(Buffer.from(payload.base64, "base64"));
        rawText = extracted.text || rawText;
        parser = extracted.parser;
        fallback = extracted.parser === "pdf-string-fallback";
      }
      return parseMarkdownLikeDocument(source, {
        rawText,
        cleanedText: normalizeWhitespace(rawText || payload.body || ""),
        parser,
        fallback,
      });
    }
    return parseMarkdownLikeDocument(source, {
      rawText: payload.body || "",
      cleanedText: normalizeWhitespace(payload.body || ""),
      parser: source.type === "note" ? "note-parser" : "markdown-parser",
      fallback: false,
    });
  }

  async function crawlWebsiteSource(startUrl, options = {}) {
    const maxPages = Math.min(
      40,
      Math.max(1, Number(options.maxPages || env.SOURCESTUDIO_CRAWL_MAX_PAGES || DEFAULT_CRAWL_MAX_PAGES)),
    );
    const start = normalizeCrawlUrl(startUrl, startUrl);
    if (!start) throw statusError(400, "URL source is not crawlable.");
    const origin = new URL(start).origin;
    const queue = [];
    const queued = new Set();
    const visited = new Set();
    const pages = [];
    const failures = [];
    let discoveredCount = 0;

    function enqueue(url, reason = "link") {
      const normalized = normalizeCrawlUrl(url, start);
      if (!normalized || queued.has(normalized) || visited.has(normalized)) return;
      if (!isSameOrigin(normalized, origin) || !isCrawlablePageUrl(normalized)) return;
      queued.add(normalized);
      queue.push({ url: normalized, reason, score: crawlPriority(normalized) });
      queue.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
    }

    logger.info("crawl.start", {
      request_id: options.requestId,
      start_url: start,
      origin,
      max_pages: maxPages,
    });

    enqueue(start, "seed");
    for (const sitemapUrl of await discoverSitemapUrls(start, fetchImpl)) enqueue(sitemapUrl, "sitemap");
    discoveredCount = queue.length;

    while (queue.length && pages.length < maxPages) {
      const next = queue.shift();
      if (!next || visited.has(next.url)) continue;
      visited.add(next.url);
      try {
        const page = await fetchUrlPage(next.url, fetchImpl);
        if (!page.cleanedText || page.cleanedText.length < 180) {
          logger.debug("crawl.page.skipped", {
            request_id: options.requestId,
            url: next.url,
            reason: "too_little_text",
            chars: page.cleanedText.length,
          });
          continue;
        }
        pages.push(page);
        logger.info("crawl.page.indexed", {
          request_id: options.requestId,
          url: page.url,
          title: page.title,
          chars: page.cleanedText.length,
          links: page.links.length,
          pages: pages.length,
        });
        for (const link of page.links) enqueue(link, "page");
        discoveredCount = Math.max(discoveredCount, queued.size);
      } catch (error) {
        failures.push({ url: next.url, error: safeProviderError(error) });
        logger.warn("crawl.page.failed", {
          request_id: options.requestId,
          url: next.url,
          error: safeProviderError(error),
        });
      }
    }

    if (!pages.length) {
      const fallback = await fetchUrlText(start, fetchImpl);
      pages.push({
        url: start,
        title: new URL(start).hostname,
        cleanedText: fallback,
        links: [],
      });
    }

    const rawText = pagesToCrawlMarkdown(start, pages);
    const cleanedText = rawText.slice(0, MAX_CRAWL_TEXT_CHARS);
    logger.info("crawl.complete", {
      request_id: options.requestId,
      start_url: start,
      pages: pages.length,
      discovered_urls: discoveredCount,
      failed_urls: failures.length,
      chars: cleanedText.length,
    });
    return {
      rawText,
      cleanedText,
      pages,
      failures,
      discoveredCount,
    };
  }

  function parseMarkdownLikeDocument(source, { rawText, cleanedText, parser, fallback, metadata = {} }) {
    const text = cleanedText.trim();
    if (!text) throw statusError(400, "Source does not contain readable text.");
    const blocks = parseMarkdownBlocks(source, text);
    return {
      title: source.title || firstHeading(text) || inferTitle({ body: text, type: source.type }),
      author: "",
      source_type: source.type,
      blocks,
      metadata: {
        parser,
        fallback,
        block_count: blocks.length,
        cleaned_characters: text.length,
        ...metadata,
      },
      raw_text: rawText,
      cleaned_text: text,
    };
  }

  function parseMarkdownBlocks(source, text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    const headingPath = [];
    let buffer = [];
    let bufferType = "paragraph";
    let order = 0;
    let charCursor = 0;

    const flush = () => {
      const blockText = buffer.join("\n").trim();
      if (!blockText) {
        buffer = [];
        return;
      }
      const charStart = Math.max(0, text.indexOf(blockText, charCursor));
      const charEnd = charStart + blockText.length;
      charCursor = charEnd;
      blocks.push({
        block_id: `${source.id}:block_${String(++order).padStart(4, "0")}`,
        source_id: source.id,
        notebook_id: source.notebook_id,
        type: bufferType,
        text: blockText,
        markdown: blockText,
        page_number: null,
        timestamp_start: null,
        timestamp_end: null,
        char_start: charStart,
        char_end: charEnd,
        bbox: null,
        parent_block_id: null,
        heading_path: [...headingPath],
        order_index: order,
      });
      buffer = [];
      bufferType = "paragraph";
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line.trim());
      const isTableLine = /^\|.+\|$/.test(line.trim());
      const isListLine = /^([-*+]|\d+\.)\s+/.test(line.trim());
      const isQuoteLine = /^>\s+/.test(line.trim());

      if (!line.trim()) {
        flush();
        continue;
      }
      if (headingMatch) {
        flush();
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();
        headingPath.splice(level - 1);
        headingPath[level - 1] = title;
        bufferType = "heading";
        buffer = [title];
        flush();
        continue;
      }
      if (isTableLine && buffer.length && bufferType !== "table") flush();
      if (isListLine && buffer.length && bufferType !== "list_item") flush();
      if (isQuoteLine && buffer.length && bufferType !== "quote") flush();
      if (isTableLine) bufferType = "table";
      else if (isListLine) bufferType = "list_item";
      else if (isQuoteLine) bufferType = "quote";
      buffer.push(line);
    }
    flush();
    return blocks;
  }

  function chunkDocument(notebookId, source, blocks) {
    const chunks = [];
    let current = [];
    let tokenCount = 0;
    let currentHeading = [];
    // How many leading blocks in `current` are overlap carried over from the previous chunk.
    // Used to guard flushes so we never emit an overlap-only (duplicate) chunk.
    let carriedOverlap = 0;
    const pushChunk = () => {
      const text = current.map((block) => block.text).join("\n\n").trim();
      if (!text) {
        current = [];
        tokenCount = 0;
        carriedOverlap = 0;
        return;
      }
      const blockIds = [...new Set(current.map((block) => block.block_id))];
      const first = current[0];
      const last = current[current.length - 1];
      chunks.push({
        id: id("chunk"),
        source_id: source.id,
        notebook_id: notebookId,
        text,
        normalized_text: normalizeForSearch(text),
        heading_path: currentHeading.length ? [...currentHeading] : first.heading_path,
        block_ids: blockIds,
        token_count: estimateTokens(text),
        char_start: first.char_start,
        char_end: last.char_end,
        page_start: first.page_number,
        page_end: last.page_number,
        timestamp_start: first.timestamp_start,
        timestamp_end: last.timestamp_end,
        metadata_json: {
          source_title: source.title,
          surrounding_section_title: (currentHeading || []).at(-1) || "",
          overlap_tokens: CHUNK_TOKEN_OVERLAP,
        },
        created_at: now(),
      });
      // Carry only a small trailing tail (<= CHUNK_TOKEN_OVERLAP tokens) into the next chunk
      // for context continuity. A block at/over the target is never carried (that is what
      // previously made the chunker repeat the same opening and skip the document body).
      const overlap = [];
      let overlapTokens = 0;
      for (let i = current.length - 1; i >= 0; i -= 1) {
        const blockTokens = estimateTokens(current[i].text);
        if (blockTokens > CHUNK_TOKEN_OVERLAP || overlapTokens + blockTokens > CHUNK_TOKEN_OVERLAP) break;
        overlap.unshift(current[i]);
        overlapTokens += blockTokens;
      }
      current = overlap;
      tokenCount = overlapTokens;
      carriedOverlap = overlap.length;
    };

    for (const block of splitOversizedBlocks(blocks)) {
      if (block.type === "heading") {
        if (current.length > carriedOverlap) pushChunk(); // close the open section first
        currentHeading = block.heading_path;
      }
      const blockTokens = estimateTokens(block.text);
      // Flush before adding when this block would overflow the target, but only once we
      // hold real (non-overlap) content. The `current.length > carriedOverlap` guard
      // guarantees forward progress, full coverage, and no overlap-only duplicate chunks.
      if (current.length > carriedOverlap && tokenCount + blockTokens > CHUNK_TOKEN_TARGET) pushChunk();
      current.push(block);
      tokenCount += blockTokens;
    }
    if (current.length > carriedOverlap) pushChunk();

    // Fold a tiny trailing remnant back into its predecessor.
    if (chunks.length > 1 && chunks.at(-1).block_ids.length <= 1 && estimateTokens(chunks.at(-1).text) < CHUNK_TOKEN_OVERLAP) {
      const last = chunks.pop();
      const previous = chunks.at(-1);
      previous.text = `${previous.text}\n\n${last.text}`;
      previous.normalized_text = normalizeForSearch(previous.text);
      previous.block_ids = [...new Set([...previous.block_ids, ...last.block_ids])];
      previous.token_count = estimateTokens(previous.text);
      previous.char_end = last.char_end;
    }
    return chunks;
  }

  function buildSourceKnowledgeObjects(source, blocks, chunks) {
    const timestamp = now();
    const text = source.cleaned_text;
    const sectionSummaries = buildSectionSummaries(blocks);
    const claims = extractClaims(text).slice(0, 12);
    const entities = extractEntities(text).slice(0, 18);
    const dates = extractDates(text).slice(0, 12);
    const numbers = extractNumbers(text).slice(0, 14);
    const risks = extractSentences(text).filter((sentence) => /risk|limit|caveat|unknown|unclear|challenge|fail/i.test(sentence)).slice(0, 8);
    const questions = [
      `What are the most important claims in ${source.title}?`,
      `Which risks or open questions appear in ${source.title}?`,
      `How should this source influence an executive brief?`,
    ];
    const sourceRefs = [{ source_id: source.id, block_ids: blocks.slice(0, 3).map((block) => block.block_id) }];
    return [
      knowledge("source_summary", source.notebook_id, source.id, {
        summary: summarizeText(text, 3),
        chunk_count: chunks.length,
        source_refs: sourceRefs,
      }),
      knowledge("section_summaries", source.notebook_id, source.id, {
        sections: sectionSummaries,
        source_refs: sourceRefs,
      }),
      ...claims.map((claim) =>
        knowledge("claim", source.notebook_id, source.id, {
          text: claim,
          confidence: 0.72,
          tags: inferTags(claim),
          created_by_model: false,
          source_refs: blockRefsForText(source.id, blocks, claim),
        }),
      ),
      ...entities.map((entity) =>
        knowledge("entity", source.notebook_id, source.id, {
          name: entity,
          entity_type: inferEntityType(entity),
          aliases: [],
          source_refs: blockRefsForText(source.id, blocks, entity),
        }),
      ),
      knowledge("dates", source.notebook_id, source.id, { items: dates, source_refs: sourceRefs }),
      knowledge("important_numbers", source.notebook_id, source.id, { items: numbers, source_refs: sourceRefs }),
      knowledge("open_questions", source.notebook_id, source.id, {
        questions,
        source_refs: sourceRefs,
      }),
      knowledge("risks", source.notebook_id, source.id, {
        risks: risks.length ? risks : ["No explicit risk statement was detected heuristically."],
        source_refs: sourceRefs,
      }),
    ];

    function knowledge(type, notebookId, sourceId, data) {
      return {
        id: id("knowledge"),
        notebook_id: notebookId,
        source_id: sourceId,
        type,
        data,
        created_at: timestamp,
      };
    }
  }

  function rebuildNotebookKnowledge(notebookId) {
    state.knowledgeObjects = state.knowledgeObjects.filter(
      (object) =>
        object.notebook_id !== notebookId ||
        !["notebook_summary", "topic_map", "entity_index", "connections", "contradiction", "suggested_questions", "suggested_artifacts"].includes(object.type),
    );
    const activeSources = state.sources.filter((source) => source.notebook_id === notebookId && source.active && source.status === "indexed");
    if (!activeSources.length) return;
    const sourceSummaries = activeSources
      .map((source) => state.knowledgeObjects.find((object) => object.source_id === source.id && object.type === "source_summary"))
      .filter(Boolean);
    const allEntities = state.knowledgeObjects.filter((object) => object.notebook_id === notebookId && object.type === "entity");
    const allClaims = state.knowledgeObjects.filter((object) => object.notebook_id === notebookId && object.type === "claim");
    const summary = sourceSummaries
      .map((object) => object.data.summary)
      .join(" ")
      .split(". ")
      .slice(0, 5)
      .join(". ");
    const topics = topTerms(activeSources.map((source) => source.cleaned_text).join("\n"), 12);
    const connections = findConnections(allEntities);
    const contradictions = findContradictions(allClaims);
    const timestamp = now();
    state.knowledgeObjects.push(
      {
        id: id("knowledge"),
        notebook_id: notebookId,
        source_id: "",
        type: "notebook_summary",
        data: { summary, source_refs: activeSources.map((source) => ({ source_id: source.id })) },
        created_at: timestamp,
      },
      {
        id: id("knowledge"),
        notebook_id: notebookId,
        source_id: "",
        type: "topic_map",
        data: {
          topics: topics.map((topic, index) => ({ id: `topic-${index + 1}`, label: topic.term, weight: topic.count })),
        },
        created_at: timestamp,
      },
      {
        id: id("knowledge"),
        notebook_id: notebookId,
        source_id: "",
        type: "entity_index",
        data: {
          entities: mergeEntities(allEntities),
        },
        created_at: timestamp,
      },
      {
        id: id("knowledge"),
        notebook_id: notebookId,
        source_id: "",
        type: "connections",
        data: { connections },
        created_at: timestamp,
      },
      ...contradictions.map((contradiction) => ({
        id: id("knowledge"),
        notebook_id: notebookId,
        source_id: "",
        type: "contradiction",
        data: contradiction,
        created_at: timestamp,
      })),
      {
        id: id("knowledge"),
        notebook_id: notebookId,
        source_id: "",
        type: "suggested_questions",
        data: {
          questions: [
            "What does Block Research AI appear to offer across the website and blog sources?",
            "Which trading-bot and automation themes appear most often in the sources?",
            "Find contradictions or open questions in the sources.",
            "Create an executive brief from all active sources.",
          ],
        },
        created_at: timestamp,
      },
      {
        id: id("knowledge"),
        notebook_id: notebookId,
        source_id: "",
        type: "suggested_artifacts",
        data: {
          artifacts: ["report", "mindmap", "flashcards", "quiz", "data-table", "slide-deck", "audio", "video", "infographic"],
        },
        created_at: timestamp,
      },
    );
  }

  async function buildEvidencePack({ notebook_id, question, source_mode = "active", selected_source_ids = [], artifact_type = "" }) {
    const notebook = state.notebooks.find((item) => item.id === notebook_id);
    if (!notebook) throw statusError(404, "Notebook not found.");
    const intent = detectIntent(question, artifact_type);
    const evidenceLimit = artifact_type === "audio"
      ? MAX_AUDIO_EVIDENCE_ITEMS
      : artifact_type
        ? MAX_ARTIFACT_EVIDENCE_ITEMS
        : MAX_EVIDENCE_ITEMS;
    const sourceIds = resolveSourceIds(notebook_id, source_mode, selected_source_ids);
    const queryTokens = tokenize(question);
    const rewrites = rewriteQuery(question, notebook_id, queryTokens);
    const corpusStats = buildRetrievalCorpusStats(sourceIds);
    const queryVector = (await embedder.embed([rewrites.join(" ") || question], "query"))[0] || [];
    const candidateLimit = Math.max(evidenceLimit * RETRIEVAL_CANDIDATE_MULTIPLIER, RETRIEVAL_MIN_CANDIDATES);
    let pgSimMap = null;
    if (pgStore.enabled) {
      try {
        pgSimMap = await pgStore.nearest(queryVector, sourceIds, Math.max(50, candidateLimit));
      } catch (error) {
        logger.warn("pgvector.nearest.failed", { error: String(error?.message || error).slice(0, 160) });
      }
    }
    let scored = state.chunks
      .filter((chunk) => sourceIds.includes(chunk.source_id))
      .map((chunk) => scoreChunkForQuery(chunk, rewrites, queryTokens, intent, corpusStats, queryVector, pgSimMap))
      .filter((result) => result.include)
      .sort((a, b) => b.score - a.score)
      .slice(0, candidateLimit);
    scored = diversifyScoredChunks(scored, evidenceLimit);
    if (!scored.length && ["summary", "compare", "artifact", "table", "audio", "video", "slides", "mindmap"].includes(intent)) {
      scored = diversifyScoredChunks(state.chunks
        .filter((chunk) => sourceIds.includes(chunk.source_id))
        .slice(0, candidateLimit)
        .map((chunk) => ({
          chunk,
          score: 0.1,
          rerank_score: 0.1,
          include: true,
          support_type: "summary_context",
          ranking_signals: { summary_context: 1 },
        })), evidenceLimit);
    }
    const evidenceItems = scored.map((result, index) => {
      const source = state.sources.find((item) => item.id === result.chunk.source_id);
      const firstBlock = state.blocks.find((block) => result.chunk.block_ids.includes(block.block_id));
      return {
        evidence_id: `E${index + 1}`,
        source_id: source.id,
        source_title: source.title,
        block_ids: result.chunk.block_ids,
        chunk_id: result.chunk.id,
        // Show the full retrieved chunk (capped) — truncating to a few hundred chars used
        // to hide evidence that sat past the chunk opening (e.g. a pricing table mid-chunk),
        // which made the model abstain even though the chunk contained the answer.
        quote: truncate(result.chunk.text, 2600),
        heading_path: result.chunk.heading_path || [],
        page_number: result.chunk.page_start || firstBlock?.page_number || null,
        timestamp_start: result.chunk.timestamp_start || null,
        timestamp_end: result.chunk.timestamp_end || null,
        relevance_score: Number(result.score.toFixed(4)),
        rerank_score: Number((result.rerank_score ?? result.score).toFixed(4)),
        support_type: result.support_type,
        ranking_signals: result.ranking_signals || {},
      };
    });
    const relevantKnowledge = getRelevantKnowledgeObjects(notebook_id, queryTokens);
    const sourceSummaries = state.knowledgeObjects
      .filter((object) => object.notebook_id === notebook_id && object.type === "source_summary" && sourceIds.includes(object.source_id))
      .map((object) => object.data);
    const retrievalRun = {
      id: id("retrieval"),
      notebook_id,
      query: question,
      rewritten_queries: rewrites,
      retrieved_chunks: scored.map((result) => ({
        chunk_id: result.chunk.id,
        source_id: result.chunk.source_id,
        score: result.score,
        rerank_score: result.rerank_score ?? result.score,
        support_type: result.support_type,
        ranking_signals: result.ranking_signals || {},
      })),
      final_evidence_ids: evidenceItems.map((item) => item.evidence_id),
      created_at: now(),
    };
    return {
      id: id("evidence"),
      user_question: question,
      notebook_id,
      active_source_ids: sourceIds,
      intent,
      retrieved_items: retrievalRun.retrieved_chunks,
      source_summaries: sourceSummaries,
      relevant_knowledge_objects: relevantKnowledge,
      citations_available: evidenceItems.length > 0,
      evidence_items: evidenceItems,
      constraints: {
        answer_only_from_evidence: true,
        abstain_if_insufficient_evidence: true,
        cite_every_factual_claim: true,
      },
      retrieval_run: retrievalRun,
      created_at: now(),
    };
  }

  function resolveSourceIds(notebookId, sourceMode, selectedSourceIds) {
    const sources = state.sources.filter((source) => source.notebook_id === notebookId && source.status === "indexed");
    if (sourceMode === "all") return sources.map((source) => source.id);
    if (sourceMode === "selected" && selectedSourceIds.length) {
      return sources.filter((source) => selectedSourceIds.includes(source.id)).map((source) => source.id);
    }
    return sources.filter((source) => source.active).map((source) => source.id);
  }

  function buildRetrievalCorpusStats(sourceIds) {
    const chunks = state.chunks.filter((chunk) => sourceIds.includes(chunk.source_id));
    const documentFrequency = new Map();
    let totalTokenCount = 0;
    for (const chunk of chunks) {
      const tokens = tokenize(chunk.normalized_text);
      totalTokenCount += tokens.length;
      for (const token of new Set(tokens)) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
    return {
      total_chunks: chunks.length || 1,
      average_token_count: totalTokenCount / Math.max(1, chunks.length),
      document_frequency: documentFrequency,
    };
  }

  function scoreChunkForQuery(chunk, rewrites, queryTokens, intent, corpusStats, queryVector = [], pgSimMap = null) {
    const chunkTokens = tokenize(chunk.normalized_text);
    const keywordScore = queryTokens.reduce((sum, token) => {
      const exact = chunkTokens.filter((chunkToken) => chunkToken === token).length;
      const partial = chunkTokens.filter((chunkToken) => chunkToken.includes(token) || token.includes(chunkToken)).length;
      return sum + exact * 2 + partial * 0.35;
    }, 0);
    const keywordNorm = keywordScore / Math.max(1, queryTokens.length);
    const bm25Score = bm25QueryScore(queryTokens, chunkTokens, corpusStats);
    const rewriteScore = rewrites.reduce((sum, query) => sum + overlapScore(tokenize(query), chunkTokens), 0);
    const stored = state.embeddings.find((item) => item.chunk_id === chunk.id);
    const chunkVector = stored?.vector;
    const semantic = embedder.isSemantic;
    let vectorScore = 0;
    const pgSim = pgSimMap?.get(chunk.id);
    if (typeof pgSim === "number") {
      vectorScore = pgSim;
    } else if (queryVector?.length && chunkVector?.length === queryVector.length && (stored?.provider || "local") === embedder.provider) {
      vectorScore = cosineSimilarity(queryVector, chunkVector);
    }
    const entityScore = getEntityScore(chunk, queryTokens);
    const summaryIntent = ["summary", "compare", "artifact", "table", "audio", "video", "slides", "mindmap"].includes(intent);
    // With real (semantic) embeddings the dense signal carries meaning, so it
    // dominates; with the local hash it is mostly lexical, so keep it small.
    const weights = semantic
      ? { keyword: 0.20, bm25: 0.22, rewrite: 0.10, vector: 0.40, entity: 0.12 }
      : { keyword: 0.24, bm25: 0.28, rewrite: 0.14, vector: 0.18, entity: 0.16 };
    const score =
      keywordNorm * weights.keyword +
      bm25Score * weights.bm25 +
      rewriteScore * weights.rewrite +
      vectorScore * weights.vector +
      entityScore * weights.entity;
    const semanticHit = semantic && vectorScore > 0.35;
    const include = summaryIntent
      ? score > 0.01 || chunk.token_count > 20
      : keywordScore > 0 || entityScore > 0.1 || score > 0.26 || semanticHit;
    let supportType = semanticHit && keywordScore === 0 ? "semantic" : "vector";
    if (keywordScore > 0) supportType = bm25Score > 0.2 ? "lexical" : "keyword";
    if (entityScore > 0.1) supportType = "entity";
    if (summaryIntent && keywordScore === 0) supportType = semantic ? "semantic_context" : "summary_context";
    return {
      chunk,
      score,
      include,
      support_type: supportType,
      ranking_signals: {
        keyword: Number(keywordNorm.toFixed(4)),
        bm25: Number(bm25Score.toFixed(4)),
        rewrite: Number(rewriteScore.toFixed(4)),
        vector: Number(vectorScore.toFixed(4)),
        entity: Number(entityScore.toFixed(4)),
      },
    };
  }

  function bm25QueryScore(queryTokens, chunkTokens, corpusStats) {
    if (!queryTokens.length || !chunkTokens.length) return 0;
    const termCounts = new Map();
    for (const token of chunkTokens) termCounts.set(token, (termCounts.get(token) || 0) + 1);
    const k1 = 1.2;
    const b = 0.75;
    const averageLength = Math.max(1, corpusStats.average_token_count || chunkTokens.length);
    const lengthNorm = 1 - b + b * (chunkTokens.length / averageLength);
    const score = queryTokens.reduce((sum, token) => {
      const tf = termCounts.get(token) || 0;
      if (!tf) return sum;
      const df = corpusStats.document_frequency.get(token) || 0;
      const idf = Math.log(1 + (corpusStats.total_chunks - df + 0.5) / (df + 0.5));
      return sum + idf * ((tf * (k1 + 1)) / (tf + k1 * lengthNorm));
    }, 0);
    return score / Math.max(1, queryTokens.length);
  }

  function diversifyScoredChunks(scored, limit) {
    const selected = [];
    const pool = [...scored];
    while (pool.length && selected.length < limit) {
      let bestIndex = 0;
      let bestScore = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < pool.length; index += 1) {
        const candidate = pool[index];
        const redundancy = selected.length
          ? Math.max(...selected.map((item) => overlapScore(tokenize(candidate.chunk.text), tokenize(item.chunk.text))))
          : 0;
        const sameSourceCount = selected.filter((item) => item.chunk.source_id === candidate.chunk.source_id).length;
        const headingNovelty = selected.some((item) => (item.chunk.heading_path || []).join("/") === (candidate.chunk.heading_path || []).join("/"))
          ? 0
          : 0.08;
        const rerankScore = candidate.score - redundancy * 0.22 - sameSourceCount * 0.04 + headingNovelty;
        if (rerankScore > bestScore) {
          bestScore = rerankScore;
          bestIndex = index;
        }
      }
      const [picked] = pool.splice(bestIndex, 1);
      selected.push({
        ...picked,
        rerank_score: bestScore,
        ranking_signals: {
          ...(picked.ranking_signals || {}),
          diversity: Number(bestScore.toFixed(4)),
        },
      });
    }
    return selected;
  }

  function getRelevantKnowledgeObjects(notebookId, queryTokens) {
    return state.knowledgeObjects
      .filter((object) => object.notebook_id === notebookId)
      .map((object) => ({
        object,
        score: overlapScore(queryTokens, tokenize(JSON.stringify(object.data))),
      }))
      .filter((item) => item.score > 0.04 || ["notebook_summary", "topic_map", "entity_index"].includes(item.object.type))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((item) => item.object);
  }

  function generateGroundedAnswer(question, evidencePack, answerStyle) {
    if (!evidencePack.active_source_ids.length) {
      return {
        content: "I cannot answer in source-only mode because no active sources are available. Add or activate a source first.",
        citations: [],
        abstained: true,
      };
    }
    if (!evidencePack.citations_available) {
      return {
        content:
          "I cannot answer that from the active sources. The Evidence Pack did not contain a passage that supports the requested claim, so Source-only mode abstained.",
        citations: [],
        abstained: true,
      };
    }
    const citations = evidencePack.evidence_items.slice(0, 5).map((item, index) => ({
      index: index + 1,
      evidence_id: item.evidence_id,
      sourceId: item.source_id,
      source_id: item.source_id,
      sourceTitle: item.source_title,
      source_title: item.source_title,
      block_ids: item.block_ids,
      chunk_id: item.chunk_id,
      quote: item.quote,
      heading_path: item.heading_path,
      page_number: item.page_number,
    }));
    const strict = /strict/i.test(answerStyle);
    const exploratory = /explor/i.test(answerStyle);
    const concise = strict || /concise|brief/i.test(answerStyle);
    const evidenceSentences = citations.map((citation) => bestSentenceForQuestion(citation.quote, question));
    const lines = [];
    if (evidencePack.intent === "compare") {
      lines.push("The active sources frame the comparison around evidence quality, reuse, and operational maturity.");
    } else if (evidencePack.intent === "summary") {
      lines.push("The active sources support this synthesis:");
    } else {
      lines.push("Based on the active sources:");
    }
    evidenceSentences.slice(0, strict ? 3 : exploratory ? 6 : concise ? 3 : 5).forEach((sentence, index) => {
      lines.push(`- ${sentence} [${index + 1}]`);
    });
    return {
      content: lines.join("\n"),
      citations,
      abstained: false,
    };
  }

  function verifyAnswer(answer, evidencePack) {
    const ledgerId = id("ledger");
    const claims = splitClaims(answer.content);
    const entries = claims.map((claim, claimIndex) => {
      const citationIndexes = [...claim.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));
      const citedEvidence = citationIndexes
        .map((index) => answer.citations[index - 1])
        .filter(Boolean)
        .map((citation) => evidencePack.evidence_items.find((item) => item.evidence_id === citation.evidence_id))
        .filter(Boolean);
      const support = citedEvidence.length
        ? Math.max(...citedEvidence.map((evidence) => overlapScore(tokenize(stripCitations(claim)), tokenize(evidence.quote))))
        : 0;
      let supportLevel = "unsupported";
      if (support >= 0.18) supportLevel = "supported";
      else if (support >= 0.08) supportLevel = "partially_supported";
      else if (!claim.trim() || answer.abstained || (!citationIndexes.length && /:\s*$/.test(claim))) supportLevel = "not_checkable";
      return {
        claim_id: id("claim"),
        answer_message_id: "",
        claim_text: stripCitations(claim),
        support_level: supportLevel,
        source_id: citedEvidence[0]?.source_id || "",
        block_ids: citedEvidence[0]?.block_ids || [],
        evidence_quote: citedEvidence[0]?.quote || "",
        verifier_notes:
          supportLevel === "supported"
            ? "Claim overlaps with cited Evidence Pack passage."
            : supportLevel === "partially_supported"
              ? "Claim is directionally supported but phrasing should stay narrow."
              : "No sufficient cited evidence was found.",
        confidence: Number(Math.min(0.98, support + 0.55).toFixed(2)),
        order_index: claimIndex + 1,
      };
    });
    const unsupported = entries.filter((entry) => entry.support_level === "unsupported");
    let finalContent = answer.content;
    if (unsupported.length && !answer.abstained) {
      const unsupportedSet = new Set(unsupported.map((entry) => entry.claim_text));
      const kept = claims.filter((claim) => !unsupportedSet.has(stripCitations(claim)));
      finalContent = kept.length
        ? kept.join("\n")
        : "I cannot provide a verified answer from the available evidence, so Source-only mode abstained.";
    }
    const ledger = {
      id: ledgerId,
      evidence_pack_id: evidencePack.id,
      entries,
      created_at: now(),
    };
    const supported = entries.filter((entry) => entry.support_level === "supported").length;
    const partial = entries.filter((entry) => entry.support_level === "partially_supported").length;
    const notCheckable = entries.filter((entry) => entry.support_level === "not_checkable").length;
    const unsupportedCount = entries.filter((entry) => entry.support_level === "unsupported").length;
    const citedClaimCount = entries.filter((entry) => entry.source_id).length;
    const checkableCount = Math.max(1, entries.length - notCheckable);
    const citationCoverage = entries.length ? citedClaimCount / entries.length : answer.abstained ? 0 : 1;
    const supportScore = entries.length
      ? (supported + partial * 0.5) / checkableCount
      : answer.abstained
        ? 0
        : 1;
    return {
      ledger_id: ledgerId,
      ledger,
      final_answer: {
        ...answer,
        content: finalContent,
      },
      stats: {
        claims_checked: entries.length,
        supported,
        partially_supported: partial,
        unsupported: unsupportedCount,
        not_checkable: notCheckable,
        citation_coverage: Number(citationCoverage.toFixed(2)),
        support_score: Number(Math.max(0, Math.min(1, supportScore)).toFixed(2)),
      },
    };
  }

  async function buildArtifactPayload(type, notebook, evidencePack, options = {}) {
    const citations = dedupeEvidenceItems(evidencePack.evidence_items, evidencePack.user_question).map((item, index) => ({
      ...item,
      citation: `[${index + 1}]`,
    }));
    const titleBase = `${notebook.title}: ${artifactLabel(type)}`;
    const flashcardPlan = type === "flashcards" ? buildFlashcardPlan(options) : null;
    if (!citations.length) {
      return {
        title: titleBase,
        warning: "No active source evidence was available. Artifact generation abstained.",
        citations: [],
      };
    }
    const keyPointLimit = flashcardPlan ? Math.max(6, Math.min(flashcardPlan.count, citations.length || 1)) : 6;
    const keyPoints = citations.slice(0, keyPointLimit).map((item) => ({
      text: bestSentenceForQuestion(item.quote, evidencePack.user_question),
      citation: item.citation,
      source_refs: sourceRefsFromEvidence(item),
    }));
    if (type === "report") {
      return {
        title: options.report_type || "Executive Brief",
        tldr: keyPoints.slice(0, 3).map((point) => `${point.text} ${point.citation}`),
        key_points: keyPoints,
        detailed_sections: buildReportSections(keyPoints, citations),
        open_questions: openQuestionsForNotebook(notebook.id).slice(0, 5),
        risks_limitations: risksForNotebook(notebook.id).slice(0, 5),
        bibliography: bibliography(citations),
        citations,
      };
    }
    if (type === "mindmap") {
      const topics = state.knowledgeObjects.find((object) => object.notebook_id === notebook.id && object.type === "topic_map")?.data?.topics || [];
      return {
        title: titleBase,
        nodes: [
          { id: "center", label: notebook.title, type: "notebook", source_refs: [] },
          ...topics.slice(0, 7).map((topic, index) => ({
            id: `topic-${index + 1}`,
            label: titleCase(topic.label),
            type: "topic",
            source_refs: citations.slice(index, index + 1).map(sourceRefsFromEvidence),
          })),
          ...keyPoints.slice(0, 5).map((point, index) => ({
            id: `claim-${index + 1}`,
            label: truncate(stripCitations(point.text), 88),
            type: "claim",
            source_refs: point.source_refs,
          })),
        ],
        edges: [
          ...topics.slice(0, 7).map((_, index) => ({ id: `edge-topic-${index + 1}`, source: "center", target: `topic-${index + 1}` })),
          ...keyPoints.slice(0, 5).map((_, index) => ({ id: `edge-claim-${index + 1}`, source: "center", target: `claim-${index + 1}` })),
        ],
        citations,
      };
    }
    if (type === "flashcards") {
      return {
        title: titleBase,
        mode: "spaced_review_ready",
        options_json: {
          topic: flashcardPlan.topic,
          language: flashcardPlan.language,
          audience: flashcardPlan.audience,
          count_preset: flashcardPlan.countPreset,
          count: flashcardPlan.count,
          difficulty: flashcardPlan.difficulty,
          card_types: flashcardPlan.cardTypes,
        },
        review_actions: ["got_it", "missed"],
        cards: buildFlashcardCards(citations, keyPoints, flashcardPlan, evidencePack),
        session_defaults: {
          count_preset: flashcardPlan.countPreset,
          target_difficulty: flashcardPlan.difficulty,
          card_types: flashcardPlan.cardTypes,
          topic: flashcardPlan.topic,
          language: flashcardPlan.language,
          audience: flashcardPlan.audience,
        },
        citations,
      };
    }
    if (type === "quiz") {
      return {
        title: titleBase,
        mode: "interactive_review",
        study_goal: options.study_goal || "Check source-grounded understanding before using the notebook in a briefing.",
        passing_score: 0.8,
        questions: buildQuizQuestions(keyPoints, citations, options),
        citations,
      };
    }
    if (type === "data-table") {
      return {
        title: titleBase,
        columns: ["Item", "Evidence", "Support", "Source"],
        rows: keyPoints.map((point, index) => ({
          cells: {
            Item: topicFromSentence(point.text),
            Evidence: stripCitations(point.text),
            Support: "directly_supported",
            Source: citations[index]?.source_title || "Active source",
          },
          source_refs: point.source_refs,
        })),
        citations,
      };
    }
    if (type === "slide-deck") {
      return {
        title: titleBase,
        deck_type: options.deck_type || "Executive",
        slides: [
          {
            title: notebook.title,
            subtitle: "Source-grounded briefing",
            bullets: keyPoints.slice(0, 2).map((point) => `${stripCitations(point.text)} ${point.citation}`),
            speaker_notes: "Open by explaining that all statements are evidence-backed.",
            citations: citations.slice(0, 2),
            visual_suggestion: "Notebook evidence map",
            layout_type: "title",
          },
          ...keyPoints.slice(2, 7).map((point, index) => ({
            title: titleCase(topicFromSentence(point.text)),
            bullets: [`${stripCitations(point.text)} ${point.citation}`],
            speaker_notes: "Keep the explanation tied to the citation shown on the slide.",
            citations: [citations[index + 2]].filter(Boolean),
            visual_suggestion: "Evidence card with source highlight",
            layout_type: "evidence",
          })),
        ],
        citations,
      };
    }
    if (type === "infographic") {
      return buildInfographicPayload({
        notebook,
        evidencePack,
        citations,
        keyPoints,
        options,
      });
    }
    if (type === "audio") {
      return buildPodcastAudioPayload({
        notebook,
        evidencePack,
        citations,
        options,
      });
    }
    if (type === "video") {
      return {
        title: titleBase,
        render_status: "Storyboard and captions generated. MP4 rendering is a documented production extension.",
        storyboard: keyPoints.slice(0, 6).map((point, index) => ({
          scene: index + 1,
          title: titleCase(topicFromSentence(point.text)),
          narration: `${stripCitations(point.text)} ${point.citation}`,
          captions: [stripCitations(point.text)],
          visual: "Source card, highlighted citation, and Knowledge Layer node",
          citations: [citations[index]].filter(Boolean),
        })),
        citations,
      };
    }
    return {
      title: titleBase,
      panels: keyPoints.map((point, index) => ({
        headline: titleCase(topicFromSentence(point.text)),
        copy: `${stripCitations(point.text)} ${point.citation}`,
        source_refs: point.source_refs,
        panel: index + 1,
      })),
      citations,
    };
  }

  function extractJsonBlock(text) {
    const trimmed = String(text || "").trim();
    if (trimmed.startsWith("{")) return trimmed;
    const match = trimmed.match(/\{[\s\S]*\}/);
    return match ? match[0] : "{}";
  }

  function buildLocalChapters(evidencePack) {
    const chapters = [];
    const seen = new Set();
    for (const item of evidencePack.evidence_items || []) {
      const match = /\[(\d+):(\d{2})\]/.exec(item.quote || "");
      if (match && !seen.has(match[0])) {
        seen.add(match[0]);
        chapters.push({
          time: `${match[1]}:${match[2]}`,
          label: truncate(stripCitations((item.quote || "").replace(/\[\d+:\d+\]/g, "")), 60),
        });
      }
    }
    if (!chapters.some((chapter) => chapter.time === "0:00")) chapters.unshift({ time: "0:00", label: "Intro" });
    return chapters.slice(0, 12);
  }

  async function buildYouTubeKit(notebook, evidencePack, options = {}) {
    const activeIds = evidencePack.active_source_ids || [];
    const activeSources = state.sources.filter(
      (source) => source.notebook_id === notebook.id && (activeIds.includes(source.id) || source.active),
    );
    const transcript = activeSources.map((source) => source.cleaned_text || "").join("\n\n").slice(0, 120000);
    if (!transcript.trim()) {
      return { title: "YouTube title & description", titles: [], description: "", chapters: [], tags: [], warning: "No active source transcript available." };
    }
    const language = options.language || "the language of the transcript";
    const prompt = [
      "You are a top YouTube growth strategist. From the timestamped transcript below, produce a complete publish kit.",
      `Write everything in ${language}. Return STRICT JSON only (no markdown fences) with this exact shape:`,
      '{"titles": ["..."], "description": "...", "chapters": [{"time": "M:SS", "label": "..."}], "tags": ["..."]}',
      "Rules:",
      "- titles: exactly 5 click-worthy but accurate options, each <= 70 characters, varied angles.",
      "- description: a strong 2-3 sentence hook, then a concise summary, then a short call-to-action, as 3-6 short paragraphs separated by blank lines.",
      "- chapters: derive real timestamps from the [M:SS] markers in the transcript. The first chapter MUST be 0:00. Use 4-12 concise chapters.",
      "- tags: 10 relevant lowercase search tags.",
      "- Base everything ONLY on the transcript. Do not invent facts and do not add citation markers like [1].",
      "",
      "Transcript:",
      transcript,
    ].join("\n");
    const result = await modelRouter.generateStructured({
      role: "artifact_generation",
      systemPrompt: "You write YouTube publish kits as strict JSON only. No prose outside JSON.",
      prompt,
      maxTokens: 1800,
      startRun: startModelRun,
    });
    if (result.run) state.modelRuns.push(result.run);
    let parsed = null;
    try {
      parsed = JSON.parse(extractJsonBlock(result.text));
    } catch {
      parsed = null;
    }
    if (!parsed) {
      return {
        title: "YouTube title & description",
        titles: [truncate(notebook.title, 70)],
        description: (evidencePack.evidence_items || []).slice(0, 3).map((item) => stripCitations((item.quote || "").replace(/\[\d+:\d+\]/g, ""))).join(" "),
        chapters: buildLocalChapters(evidencePack),
        tags: [],
        generation_provider: result.provider || "local",
        generation_model: result.model || "local-grounded-v1",
        warning: result.error ? `LLM generation failed: ${result.error}` : "Configure an LLM provider for higher-quality titles.",
      };
    }
    return {
      title: "YouTube title & description",
      titles: Array.isArray(parsed.titles) ? parsed.titles.slice(0, 5) : [],
      description: String(parsed.description || ""),
      chapters: Array.isArray(parsed.chapters) ? parsed.chapters.slice(0, 12) : buildLocalChapters(evidencePack),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 12) : [],
      generation_provider: result.provider,
      generation_model: result.model,
    };
  }

  async function buildThumbnail(notebook, evidencePack, options = {}) {
    const topic = stripCitations((evidencePack.evidence_items?.[0]?.quote || notebook.title || "").replace(/\[\d+:\d+\]/g, "")).trim();
    const imagePrompt = String(options.prompt || "").trim()
      || `Bold, high-contrast YouTube thumbnail about: ${truncate(topic, 180)}. Eye-catching and professional, vivid colors, a strong central subject, dramatic lighting, leave clear negative space for a few words of overlaid text. No watermarks, no gibberish text.`;
    const references = Array.isArray(options.reference_images) ? options.reference_images.filter(Boolean).slice(0, 4) : [];
    const result = await generateThumbnailImage(imagePrompt, references);
    return {
      title: "YouTube thumbnail",
      image_prompt: imagePrompt,
      image_data: result.image_data || "",
      image_status: result.image_data ? "rendered" : (result.error || "Image generation unavailable. Configure OpenAI billing for gpt-image-1."),
      reference_count: references.length,
      generation_provider: "openai",
      generation_model: env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    };
  }

  async function buildInfographic(notebook, evidencePack, options = {}) {
    // Use the same synthesized key points as the panel version, then have gpt-image-2
    // design a real infographic poster from them (a fixed, branded infographic prompt).
    const content = await buildArtifactPayload("infographic", notebook, evidencePack, options);
    const data = content?.payload || content || {};
    const panels = Array.isArray(data.panels) ? data.panels : [];
    const title = truncate(notebook.title || data.title || "Infographic", 90);
    const points = panels
      .slice(0, 6)
      .map((panel, index) => {
        const heading = stripCitations(String(panel.heading || panel.title || "").trim());
        const body = stripCitations(truncate(String(panel.body || panel.text || "").trim(), 130));
        return `${index + 1}. ${heading}${body ? ` — ${body}` : ""}`;
      })
      .filter((line) => line.replace(/^\d+\.\s*/, "").trim().length > 2)
      .join("\n");
    const imagePrompt = String(options.prompt || "").trim() || infographicImagePrompt(title, points);
    const result = await generateThumbnailImage(imagePrompt, [], "1024x1536");
    return {
      title: `${title}: Infographic`,
      image_prompt: imagePrompt,
      image_data: result.image_data || "",
      image_status: result.image_data
        ? "rendered"
        : (result.error || "Image generation unavailable. Configure OpenAI billing for gpt-image-2."),
      panels,
      source_refs: collectSourceRefs(evidencePack),
      generation_provider: "openai",
      generation_model: env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    };
  }

  function infographicImagePrompt(title, points) {
    return [
      "Design a clean, modern, professional INFOGRAPHIC poster in portrait orientation.",
      "Dark theme: near-black background (#0a0a0a) with a subtle grid texture, a vibrant green accent (#0fd070), and tasteful blue/purple highlights.",
      `Bold title at the top: "${title}".`,
      "Lay out these key points as distinct visual sections, each with a small relevant icon, a short heading, and one concise supporting line:",
      points || "Summarize the most important themes from the sources.",
      "Show any key numbers as big stat callouts. Use crisp sans-serif typography, clear visual hierarchy, generous spacing, and a polished editorial layout like a top-tier tech/finance infographic.",
      "All text must be sharp, legible, and spelled correctly. No watermarks, no lorem ipsum, no gibberish text.",
    ].join("\n");
  }

  async function generateThumbnailImage(prompt, references = [], size = "1536x1024") {
    const key = realProviderKey(env.OPENAI_API_KEY);
    if (!key) return { error: "OpenAI key not configured." };
    const imageModel = env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    try {
      let response;
      if (references.length) {
        const form = new FormData();
        form.append("model", imageModel);
        form.append("prompt", prompt);
        form.append("size", size);
        references.forEach((ref, index) => {
          // Use the reference's real mime/extension — sending a JPEG/WebP labelled
          // "image/png" makes the images/edits endpoint reject it ("Invalid image file").
          const mime = (/^data:([^;,]+)/.exec(String(ref))?.[1] || "image/png").toLowerCase();
          const ext = /jpe?g/.test(mime) ? "jpg" : mime.includes("webp") ? "webp" : "png";
          const base64 = String(ref).replace(/^data:[^,]+,/, "");
          form.append("image[]", new Blob([Buffer.from(base64, "base64")], { type: mime }), `ref-${index}.${ext}`);
        });
        response = await fetchImpl("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { authorization: `Bearer ${key}` },
          body: form,
        });
      } else {
        response = await fetchImpl("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({ model: imageModel, prompt, size, n: 1 }),
        });
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return { error: body?.error?.message?.slice(0, 180) || `Image API failed with ${response.status}.` };
      const b64 = body.data?.[0]?.b64_json;
      if (!b64) return { error: "Image API returned no image." };
      return { image_data: `data:image/png;base64,${b64}` };
    } catch (error) {
      return { error: String(error?.message || error).slice(0, 180) };
    }
  }

  function buildFlashcardCards(citations, keyPoints, plan, evidencePack) {
    const cards = [];
    const seen = new Set();
    const pool = citations.length ? citations : [];
    if (!pool.length) return cards;
    for (let index = 0; index < plan.count; index += 1) {
      const citation = pool[index % pool.length];
      const point = keyPoints[index % Math.max(1, keyPoints.length)] || {
        text: bestSentenceForQuestion(citation.quote, evidencePack.user_question),
        citation: citation.citation,
      };
      const sentence = stripCitations(bestSentenceForQuestion(citation.quote, plan.topic || evidencePack.user_question || point.text));
      const cardType = plan.cardTypes[index % plan.cardTypes.length];
      const topic = titleCase(plan.topic || topicFromSentence(sentence));
      const question = flashcardQuestionForType({
        type: cardType,
        topic,
        sentence,
        citation,
        index,
        audience: plan.audience,
      });
      const answer = `${sentence} ${citation.citation}`;
      const dedupeKey = evidenceDedupeKey(`${cardType} ${question} ${answer}`);
      if (dedupeKey && seen.has(dedupeKey)) continue;
      if (dedupeKey) seen.add(dedupeKey);
      const supportScore = overlapScore(tokenize(sentence), tokenize(citation.quote));
      cards.push({
        id: id("card"),
        card_type: cardType,
        learning_goal: flashcardLearningGoal(cardType, topic),
        question,
        answer,
        explanation: flashcardExplanation({ cardType, topic, citation }),
        hint: flashcardHint(sentence, topic),
        difficulty: flashcardDifficultyForIndex(plan.difficulty, index),
        tags: [...new Set([...inferTags(sentence), cardType, plan.difficulty].filter(Boolean))].slice(0, 8),
        citation: citation.citation,
        evidence_id: citation.evidence_id,
        evidence_quote: truncate(citation.quote, 520),
        source_title: citation.source_title,
        support_level: supportScore >= 0.16 ? "supported" : supportScore >= 0.08 ? "partially_supported" : "needs_review",
        confidence: Number(Math.min(0.99, supportScore + 0.55).toFixed(2)),
        source_refs: [sourceRefsFromEvidence(citation)],
        order_index: cards.length + 1,
      });
    }
    return cards;
  }

  function flashcardQuestionForType({ type, topic, sentence, citation, index, audience }) {
    const sourceTitle = citation.source_title || "the active source";
    const audienceHint = audience && audience !== "general" ? ` for ${audience}` : "";
    const cloze = clozePrompt(sentence);
    return (
      {
        concept: `What is the key source-grounded takeaway about ${topic}${audienceHint}?`,
        application: `How should someone apply the cited point about ${topic}${audienceHint}?`,
        cloze: `Fill the gap from ${sourceTitle}: ${cloze}`,
        caveat: `What limitation or careful framing should you remember about ${topic}?`,
        "source-check": `Which claim about ${topic} is directly supported by ${sourceTitle}?`,
        compare: `How does the evidence position ${topic} relative to the rest of the notebook?`,
      }[type] || `What should you remember about ${topic}?`
    ).replace(/\s+/g, " ").trim() || `What does card ${index + 1} test?`;
  }

  function flashcardLearningGoal(cardType, topic) {
    return (
      {
        concept: `Recall the core cited claim about ${topic}.`,
        application: `Use the cited claim about ${topic} in a practical explanation.`,
        cloze: `Remember the missing source phrase for ${topic}.`,
        caveat: `Keep the source-grounded caveat for ${topic} narrow.`,
        "source-check": `Separate supported evidence from unsupported claims about ${topic}.`,
        compare: `Connect ${topic} to adjacent notebook evidence without leaving the sources.`,
      }[cardType] || `Study ${topic} from cited evidence.`
    );
  }

  function flashcardExplanation({ cardType, topic, citation }) {
    const sourceTitle = citation.source_title || "the cited source";
    if (cardType === "source-check") {
      return `The accepted answer must stay inside ${sourceTitle}; the attached quote is the support boundary for ${topic}.`;
    }
    if (cardType === "caveat") {
      return `The card is asking for careful framing, so the answer repeats only what the cited passage supports about ${topic}.`;
    }
    return `This card is grounded in ${sourceTitle}; use the citation to inspect the exact source block before relying on the answer.`;
  }

  function flashcardHint(sentence, topic) {
    const terms = topTerms(sentence, 2).map((item) => item.term);
    return terms.length ? `Think about ${terms.join(" and ")} in relation to ${topic}.` : `Look for the cited claim about ${topic}.`;
  }

  function clozePrompt(sentence) {
    const terms = topTerms(sentence, 1).map((item) => item.term);
    const term = terms[0];
    if (!term) return truncate(sentence, 120);
    return truncate(sentence.replace(new RegExp(`\\b${escapeRegExp(term)}\\b`, "i"), "_____"), 150);
  }

  async function buildPodcastAudioPayload({ notebook, evidencePack, citations, options = {} }) {
    const audioOptions = normalizeAudioOptions(options);
    const synthesis = buildAudioSynthesis({
      notebook,
      evidencePack,
      citations,
      options: audioOptions,
    });
    const fallbackPayload = buildLocalAudioScript({
      notebook,
      synthesis,
      options: audioOptions,
    });
    const promptSpec = await loadAudioOverviewPromptSpec();
    const prompt = buildAudioScriptPrompt({
      promptSpec,
      notebook,
      evidencePack,
      synthesis,
      options: audioOptions,
    });
    const scriptResult = await modelRouter.generateAudioScript({
      prompt,
      fallback: () => fallbackPayload,
      startRun: startModelRun,
    });
    const payload = normalizeAudioScriptPayload(scriptResult.payload, {
      notebook,
      synthesis,
      options: audioOptions,
      fallbackPayload,
      fallbackReason: scriptResult.fallback_reason || "",
    });
    return {
      payload,
      model_runs: scriptResult.model_runs || [],
    };
  }

  function normalizeAudioOptions(options = {}) {
    const mode = normalizeAudioMode(options.format || options.mode || "deep_dive");
    const length = ["short", "default", "long"].includes(String(options.length || "").toLowerCase())
      ? String(options.length).toLowerCase()
      : "default";
    return {
      mode,
      mode_label: audioModeLabel(mode),
      language: truncate(String(options.language || "English").trim() || "English", 80),
      length,
      length_label: length === "short" ? "Shorter" : length === "long" ? "Longer" : "Default",
      focus: truncate(String(options.prompt || options.focus || "").trim(), 700),
      title: truncate(String(options.title || "").trim(), 180),
      artifact_id: options.artifact_id || "",
      target_turns: audioTurnTarget(mode, length),
    };
  }

  function normalizeAudioMode(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (["brief", "critique", "debate", "deep_dive"].includes(normalized)) return normalized;
    if (normalized === "podcast") return "deep_dive";
    return "deep_dive";
  }

  function audioModeLabel(mode) {
    return {
      deep_dive: "Deep Dive",
      brief: "Brief",
      critique: "Critique",
      debate: "Debate",
    }[mode] || "Deep Dive";
  }

  function audioTurnTarget(mode, length) {
    const base = {
      brief: 6,
      deep_dive: 13,
      critique: 13,
      debate: 14,
    }[mode] || 13;
    const adjustment = length === "short" ? -2 : length === "long" ? 3 : 0;
    return Math.max(4, Math.min(14, base + adjustment));
  }

  function buildAudioSynthesis({ notebook, evidencePack, citations, options }) {
    const rankedEvidence = citations
      .filter((item) => !isNavigationEvidence(item))
      .slice(0, Math.max(8, options.target_turns + 4));
    const usableEvidence = rankedEvidence.length ? rankedEvidence : citations.slice(0, Math.max(6, options.target_turns));
    const query = [notebook.title, options.mode_label, options.focus].filter(Boolean).join(" ");
    const evidenceCards = usableEvidence.map((item, index) => {
      const bestSentence = stripCitations(bestSentenceForQuestion(item.quote, query));
      return {
        evidence_id: item.evidence_id,
        citation: item.citation,
        source_id: item.source_id,
        source_title: item.source_title,
        block_ids: item.block_ids,
        chunk_id: item.chunk_id,
        page_number: item.page_number,
        heading: evidenceLabel(item),
        heading_path: item.heading_path || [],
        claim: truncate(bestSentence, 260),
        quote: item.quote,
        support_type: item.support_type,
        priority: index + 1,
      };
    });
    const topics = extractAudioTopics(notebook.id, evidenceCards);
    const riskCards = evidenceCards.filter((card) => /risk|limit|gap|caveat|unknown|fails?|cannot|not enough|privacy|security|cost|latency|error|trade.?off/i.test(`${card.claim} ${card.quote}`));
    const sourceCounts = new Map();
    for (const card of evidenceCards) {
      sourceCounts.set(card.source_id, {
        source_id: card.source_id,
        title: card.source_title,
        references: (sourceCounts.get(card.source_id)?.references || 0) + 1,
      });
    }
    return {
      notebook_title: notebook.title,
      active_source_count: evidencePack.active_source_ids.length,
      evidence_count: evidencePack.evidence_items.length,
      cited_item_count: citations.length,
      cited_source_count: sourceCounts.size,
      source_coverage: Number((sourceCounts.size / Math.max(1, evidencePack.active_source_ids.length)).toFixed(2)),
      top_sources: [...sourceCounts.values()].sort((a, b) => b.references - a.references).slice(0, 6),
      topics,
      source_summaries: evidencePack.source_summaries.slice(0, 8),
      relevant_knowledge_objects: compactAudioKnowledge(evidencePack.relevant_knowledge_objects),
      open_questions: openQuestionsForNotebook(notebook.id).slice(0, 5),
      risks: risksForNotebook(notebook.id).slice(0, 5),
      risk_cards: riskCards.slice(0, 4),
      evidence_cards: evidenceCards,
      constraints: evidencePack.constraints,
    };
  }

  function extractAudioTopics(notebookId, evidenceCards) {
    const topicMap = state.knowledgeObjects.find((object) => object.notebook_id === notebookId && object.type === "topic_map")?.data?.topics || [];
    const topicLabels = topicMap
      .map((topic) => topic.label || topic.name || "")
      .filter(Boolean)
      .slice(0, 8);
    if (topicLabels.length) return topicLabels;
    return topTerms(evidenceCards.map((card) => card.claim).join(" "), 8).map((item) => item.term);
  }

  function compactAudioKnowledge(objects = []) {
    return objects.slice(0, 8).map((object) => ({
      type: object.type,
      source_id: object.source_id || "",
      data: object.data,
    }));
  }

  async function loadAudioOverviewPromptSpec() {
    if (audioOverviewPromptSpec !== null) return audioOverviewPromptSpec;
    try {
      audioOverviewPromptSpec = await readFile(join(root, "prompts", "audio-overview.md"), "utf8");
    } catch {
      audioOverviewPromptSpec = "Generate a source-grounded audio overview script as strict JSON.";
    }
    return audioOverviewPromptSpec;
  }

  function buildAudioScriptPrompt({ promptSpec, notebook, evidencePack, synthesis, options }) {
    return [
      promptSpec,
      "",
      "Audio request:",
      JSON.stringify({
        notebook_title: notebook.title,
        mode: options.mode,
        mode_label: options.mode_label,
        language: options.language,
        length: options.length,
        target_turns: options.target_turns,
        focus_prompt: options.focus,
      }, null, 2),
      "",
      "Evidence Pack constraints:",
      JSON.stringify(evidencePack.constraints, null, 2),
      "",
      "Audio synthesis dossier:",
      JSON.stringify(synthesis, null, 2),
      "",
      "Return strict JSON only. Keep transcript turns at or below target_turns. Use citation_ids from evidence_cards.",
    ].join("\n");
  }

  function buildLocalAudioScript({ notebook, synthesis, options }) {
    const cards = synthesis.evidence_cards.slice(0, Math.max(3, options.target_turns - 2));
    const outline = audioEpisodeOutline(synthesis, options);
    const transcript = options.mode === "brief"
      ? buildBriefAudioTurns({ notebook, synthesis, cards, options })
      : buildConversationAudioTurns({ notebook, synthesis, cards, options });
    return {
      title: options.title || `${notebook.title}: ${options.mode_label}`,
      mode: options.mode_label,
      episode_format: options.mode === "brief" ? "single-speaker source-grounded brief" : `two-host source-grounded ${options.mode_label.toLowerCase()}`,
      episode_outline: outline,
      transcript: transcript.slice(0, options.target_turns),
      tts_directives: audioTtsDirectives(options),
    };
  }

  function buildBriefAudioTurns({ notebook, synthesis, cards, options }) {
    const primary = cards[0];
    const risks = synthesis.risk_cards.length ? synthesis.risk_cards : cards.slice(-1);
    return [
      audioScriptTurn("Briefing Host", `${notebook.title} in brief: this overview focuses on ${audioFocusLine(synthesis, options)}.`, [], "warm, direct opening"),
      ...cards.slice(0, Math.max(2, options.target_turns - 2)).map((card, index) =>
        audioScriptTurn("Briefing Host", `${briefLead(index)} ${card.claim}`, [card.evidence_id], "concise evidence delivery"),
      ),
      audioScriptTurn("Briefing Host", `${risks[0] ? `The main caveat is ${risks[0].claim}` : `The sources leave open questions about ${synthesis.open_questions[0] || "implementation details"}.`}`, risks[0] ? [risks[0].evidence_id] : [], "measured caution"),
      audioScriptTurn("Briefing Host", `Bottom line: ${primary ? primary.claim : "the active sources support a compact source-grounded overview."}`, primary ? [primary.evidence_id] : [], "clear closing"),
    ];
  }

  function buildConversationAudioTurns({ notebook, synthesis, cards, options }) {
    const risk = synthesis.risk_cards[0] || cards.find((card) => /risk|gap|limit|cannot|not/i.test(card.claim)) || cards[cards.length - 1];
    const opening = [
      audioScriptTurn("Host A", `Welcome to ${PRODUCT_NAME}. Today we are turning ${notebook.title} into a ${options.mode_label.toLowerCase()} audio overview focused on ${audioFocusLine(synthesis, options)}.`, [], "inviting opening"),
      audioScriptTurn("Host B", `The ground rule is simple: we stay inside the active sources, use the strongest evidence, and call out caveats instead of smoothing them over.`, [], "calm framing"),
    ];
    const body = cards.slice(0, Math.max(3, options.target_turns - 3)).map((card, index) => {
      const host = index % 2 === 0 ? "Host A" : "Host B";
      const lead = audioModeLead(options.mode, index);
      return audioScriptTurn(host, `${lead} ${card.claim}`, [card.evidence_id], audioVoiceDirection(options.mode, index));
    });
    const closing = [
      audioScriptTurn("Host A", `${risk ? `The caveat worth holding onto is this: ${risk.claim}` : `One useful next question is ${synthesis.open_questions[0] || "what evidence would change this reading"}.`}`, risk ? [risk.evidence_id] : [], "slower, careful caveat"),
      audioScriptTurn("Host B", `So the practical takeaway is not just a summary. It is a source-backed map of what matters, what is supported, and what still needs checking before decisions are made.`, cards.slice(0, 2).map((card) => card.evidence_id), "confident close"),
    ];
    if (options.mode === "debate") {
      opening[1].text = "Host B will press the counterpoint: where the evidence is thinner, broader, or less decisive than the opening claim might imply.";
    }
    if (options.mode === "critique") {
      opening[1].text = "Host B will evaluate the material as a reviewer: useful claims first, then gaps, risks, and the next questions the sources create.";
    }
    return [...opening, ...body, ...closing];
  }

  function normalizeAudioScriptPayload(rawPayload, { notebook, synthesis, options, fallbackPayload, fallbackReason }) {
    const generated = rawPayload?.transcript?.length ? rawPayload : fallbackPayload;
    const citationsByEvidenceId = new Map(synthesis.evidence_cards.map((card) => {
      const citation = synthesisToCitation(card, synthesis);
      return [card.evidence_id, citation];
    }));
    const transcript = generated.transcript
      .slice(0, options.target_turns)
      .map((turn) => {
        const citationIds = (turn.citation_ids || []).filter((citationId) => citationsByEvidenceId.has(citationId)).slice(0, 6);
        const turnCitations = citationIds.map((citationId) => citationsByEvidenceId.get(citationId));
        return {
          host: normalizeAudioHost(turn.host, options.mode),
          text: attachTranscriptCitations(sanitizeTranscriptText(turn.text), turnCitations),
          citation_ids: citationIds,
          citations: turnCitations,
          voice_direction: turn.voice_direction || "",
        };
      })
      .filter((turn) => turn.text);
    const citedTurnCount = transcript.filter((turn) => turn.citations.length).length;
    const payload = {
      title: options.title || generated.title || `${notebook.title}: ${options.mode_label}`,
      mode: options.mode_label,
      mode_key: options.mode,
      language: options.language,
      length: options.length_label,
      episode_format: generated.episode_format || fallbackPayload.episode_format,
      episode_outline: (generated.episode_outline?.length ? generated.episode_outline : fallbackPayload.episode_outline).slice(0, 12),
      source_coverage: {
        active_sources: synthesis.active_source_count,
        evidence_items: synthesis.evidence_count,
        cited_items: synthesis.cited_item_count,
        cited_sources: synthesis.cited_source_count,
        coverage_ratio: synthesis.source_coverage,
        top_sources: synthesis.top_sources,
      },
      audio_status: providerStatus().elevenlabs ? "queued" : "transcript_only",
      tts_status: providerStatus().elevenlabs
        ? `${PRODUCT_NAME} will render this ${options.mode_label} through ElevenLabs Text to Dialogue.`
        : "Transcript generated. Set ELEVENLABS_API_KEY and two host voices to render MP3 audio.",
      interactive_status: "planned",
      interactive_note: "Interactive voice questions require a future STT and realtime playback layer.",
      tts_directives: {
        ...audioTtsDirectives(options),
        ...(generated.tts_directives || {}),
      },
      generation: {
        script_provider: modelRouter.selectProvider("audio_script").provider,
        fallback_reason: fallbackReason,
        prompt_version: "prompts/audio-overview.md",
      },
      quality_checks: {
        transcript_turns: transcript.length,
        cited_turns: citedTurnCount,
        cited_turn_ratio: Number((citedTurnCount / Math.max(1, transcript.length)).toFixed(2)),
        source_coverage: synthesis.source_coverage,
        evidence_cards: synthesis.evidence_cards.length,
      },
      transcript,
      citations: synthesis.evidence_cards.map((card) => synthesisToCitation(card, synthesis)),
    };
    if (!payload.transcript.some((turn) => turn.citations.length)) {
      return normalizeAudioScriptPayload(fallbackPayload, {
        notebook,
        synthesis,
        options,
        fallbackPayload,
        fallbackReason: fallbackReason || "Provider output had no supported citations.",
      });
    }
    return payload;
  }

  function synthesisToCitation(card, synthesis) {
    const evidence = synthesis.evidence_cards.find((item) => item.evidence_id === card.evidence_id) || card;
    return {
      index: Number(String(evidence.citation || "").replace(/\D/g, "")) || evidence.priority,
      evidence_id: evidence.evidence_id,
      source_id: evidence.source_id,
      source_title: evidence.source_title,
      block_ids: evidence.block_ids || [],
      chunk_id: evidence.chunk_id || "",
      page_number: evidence.page_number || null,
      heading_path: evidence.heading_path || (evidence.heading ? [evidence.heading] : []),
      quote: evidence.quote,
      citation: evidence.citation,
    };
  }

  function attachTranscriptCitations(text, citationsForTurn) {
    const suffix = citationsForTurn
      .map((citation) => citation.citation)
      .filter((citation) => citation && !text.includes(citation))
      .join(" ");
    return suffix ? `${text} ${suffix}` : text;
  }

  function sanitizeTranscriptText(text) {
    return truncate(String(text || "").replace(/\s+/g, " ").replace(/[`*_#>]/g, "").trim(), 1000);
  }

  function normalizeAudioHost(host, mode) {
    const clean = String(host || "").trim();
    if (mode === "brief") return clean || "Briefing Host";
    if (/host\s*b|critic|counter/i.test(clean)) return "Host B";
    return "Host A";
  }

  function audioScriptTurn(host, text, citationIds = [], voiceDirection = "") {
    return {
      host,
      text,
      citation_ids: citationIds.filter(Boolean),
      voice_direction: voiceDirection,
    };
  }

  function audioEpisodeOutline(synthesis, options) {
    const topics = synthesis.topics.slice(0, 4);
    const focus = options.focus || topics.join(", ") || "the strongest supported themes";
    if (options.mode === "brief") return [`Fast source-backed summary of ${focus}`, "Key evidence", "Caveat", "Bottom line"];
    if (options.mode === "critique") return ["What the sources support", "Where the evidence is strongest", "Gaps and risks", "Questions for follow-up", "Practical takeaway"];
    if (options.mode === "debate") return ["Opening claim", "Counterpoint", "Evidence test", "Caveat", "Synthesis"];
    return ["Context and stakes", "Main supported themes", "Evidence examples", "Caveats and open questions", "Takeaway"];
  }

  function audioFocusLine(synthesis, options) {
    if (options.focus) return options.focus;
    return synthesis.topics.slice(0, 3).join(", ") || "the strongest source-backed themes";
  }

  function briefLead(index) {
    return [
      "First, the sources point to this:",
      "The next supported point is:",
      "A useful detail is:",
      "The material also shows:",
      "One more cited point is:",
    ][index] || "The sources also say:";
  }

  function audioModeLead(mode, index) {
    const leads = {
      critique: [
        "The strongest supported claim is:",
        "The critique starts with scope:",
        "A gap to inspect is:",
        "The operational question is:",
        "The evidence becomes more useful when we separate claim from implication:",
      ],
      debate: [
        "The affirmative case starts here:",
        "The counterpoint is:",
        "A stronger evidence test is:",
        "The debate turns on this detail:",
        "Both sides need to account for this:",
      ],
      deep_dive: [
        "The first thread is:",
        "A second layer is:",
        "Here is where the source gets concrete:",
        "The implication is easier to see through this point:",
        "Another source-backed detail matters:",
      ],
    };
    return (leads[mode] || leads.deep_dive)[index % (leads[mode] || leads.deep_dive).length];
  }

  function audioVoiceDirection(mode, index) {
    if (mode === "critique") return index % 2 ? "analytical reviewer tone" : "clear setup";
    if (mode === "debate") return index % 2 ? "firm counterpoint" : "confident argument";
    return index % 2 ? "curious follow-up" : "measured explanation";
  }

  function audioTtsDirectives(options) {
    return {
      pace: options.length === "short" ? "brisk" : "measured",
      tone: options.mode === "debate" ? "formal but conversational" : "clear, warm, and source-aware",
      language: options.language,
      host_a: options.mode === "brief" ? "single narrator" : "primary guide",
      host_b: options.mode === "brief" ? "unused" : "second perspective",
    };
  }

  function evidenceLabel(evidence) {
    return [
      evidence?.heading_path?.filter(Boolean).join(" / "),
      evidence?.source_title,
    ].filter(Boolean)[0] || "";
  }

  function isNavigationEvidence(evidence) {
    const text = `${evidenceLabel(evidence)} ${evidence?.quote || ""}`;
    return /cookie|privacy|terms|legal notice|acceptable use|all rights reserved|navigation|menu/i.test(text);
  }

  async function renderAudioArtifact({ artifactDir, artifactId, payload }) {
    const transcript = Array.isArray(payload.transcript) ? payload.transcript : [];
    if (!transcript.length) return null;
    if (!hasConfiguredValue(env.ELEVENLABS_API_KEY)) {
      payload.audio_status = "transcript_only";
      logger.info("audio.render.skipped", {
        reason: "elevenlabs_key_missing",
        artifact_id: artifactId,
      });
      return null;
    }
    const hostAVoiceId = env.ELEVENLABS_VOICE_ID_HOST_A || env.ELEVENLABS_VOICE_ID || "";
    const hostBVoiceId = env.ELEVENLABS_VOICE_ID_HOST_B || hostAVoiceId;
    if (!hostAVoiceId || !hostBVoiceId) {
      payload.audio_status = "transcript_only";
      payload.tts_status = "Transcript generated. Configure ELEVENLABS_VOICE_ID_HOST_A and ELEVENLABS_VOICE_ID_HOST_B to render MP3 audio.";
      logger.info("audio.render.skipped", {
        reason: "voice_ids_missing",
        artifact_id: artifactId,
      });
      return null;
    }

    const dialogue = transcript.slice(0, 22).map((turn) => ({
      text: spokenAudioText(turn.text),
      voice_id: turn.host === "Host B" ? hostBVoiceId : hostAVoiceId,
    }));
    const inputText = dialogue.map((turn) => turn.text).join("\n");
    const model = env.ELEVENLABS_MODEL || "eleven_v3";
    const outputFormat = env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
    const audioRun = startModelRun("audio_script", "elevenlabs", model, inputText);
    logger.info("audio.render.start", {
      artifact_id: artifactId,
      model,
      output_format: outputFormat,
      turns: dialogue.length,
      input_chars: inputText.length,
    });

    try {
      const response = await fetchImpl(
        `https://api.elevenlabs.io/v1/text-to-dialogue?output_format=${encodeURIComponent(outputFormat)}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "xi-api-key": env.ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            inputs: dialogue,
            model_id: model,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`ElevenLabs audio render failed with ${response.status}.`);
      }
      const audioBuffer = Buffer.from(await response.arrayBuffer());
      if (!audioBuffer.length) throw new Error("ElevenLabs returned an empty audio file.");
      const fileName = `${sanitizeFileName(`audio-${artifactId}`)}.mp3`;
      const audioPath = join(artifactDir, fileName);
      await writeFile(audioPath, audioBuffer);
      payload.audio_status = "rendered";
      payload.tts_status = "MP3 rendered with ElevenLabs Text to Dialogue.";
      payload.audio_provider = "elevenlabs";
      payload.audio_model = model;
      payload.audio_format = outputFormat;
      payload.audio_content_type = "audio/mpeg";
      payload.audio_file_name = fileName;
      payload.audio_file_path = audioPath;
      payload.audio_url = `/api/artifacts/${artifactId}/media`;
      payload.audio_turn_count = dialogue.length;
      audioRun.status = "completed";
      audioRun.latency_ms = Date.now() - audioRun.started_at_ms;
      audioRun.output_tokens_estimate = Math.max(1, Math.ceil(audioBuffer.length / 1200));
      delete audioRun.started_at_ms;
      logger.info("audio.render.completed", {
        artifact_id: artifactId,
        model,
        bytes: audioBuffer.length,
        file_name: fileName,
        latency_ms: audioRun.latency_ms,
      });
    } catch (error) {
      const elevenLabsError = safeProviderError(error);
      payload.audio_status = "failed";
      payload.tts_status = "Transcript generated. ElevenLabs MP3 rendering failed, so the artifact remains usable as verified text.";
      payload.audio_error = elevenLabsError;
      audioRun.status = "failed";
      audioRun.latency_ms = Date.now() - audioRun.started_at_ms;
      audioRun.output_tokens_estimate = 0;
      audioRun.error = elevenLabsError;
      delete audioRun.started_at_ms;
      logger.error("audio.render.failed", {
        artifact_id: artifactId,
        model,
        latency_ms: audioRun.latency_ms,
        error: audioRun.error,
      });
      try {
        const fallback = await renderLocalAudioFallback({
          artifactDir,
          artifactId,
          transcript,
          originalError: elevenLabsError,
        });
        if (fallback) {
          payload.audio_status = "rendered";
          payload.tts_status = `ElevenLabs MP3 rendering failed (${elevenLabsError}); local macOS TTS fallback rendered an M4A file.`;
          payload.audio_provider = fallback.provider;
          payload.audio_model = fallback.model;
          payload.audio_format = fallback.format;
          payload.audio_content_type = fallback.content_type;
          payload.audio_file_name = fallback.file_name;
          payload.audio_file_path = fallback.path;
          payload.audio_url = `/api/artifacts/${artifactId}/media`;
          payload.audio_turn_count = fallback.turns;
          payload.audio_fallback_from = "elevenlabs";
          audioRun.status = "completed";
          audioRun.provider = fallback.provider;
          audioRun.model = fallback.model;
          audioRun.output_tokens_estimate = Math.max(1, Math.ceil(fallback.bytes / 1200));
          audioRun.error = `ElevenLabs failed (${elevenLabsError}); rendered local fallback.`;
        }
      } catch (fallbackError) {
        payload.audio_fallback_error = safeProviderError(fallbackError);
        logger.error("audio.render.fallback.failed", {
          artifact_id: artifactId,
          error: payload.audio_fallback_error,
        });
      }
    }
    return audioRun;
  }

  async function renderLocalAudioFallback({ artifactDir, artifactId, transcript, originalError }) {
    if (env.SOURCESTUDIO_LOCAL_TTS_FALLBACK === "false" || process.platform !== "darwin") {
      logger.info("audio.render.fallback.skipped", {
        artifact_id: artifactId,
        reason: process.platform === "darwin" ? "disabled" : "unsupported_platform",
        original_error: originalError,
      });
      return null;
    }
    const voice = env.SOURCESTUDIO_LOCAL_TTS_VOICE || "Alex";
    const fileBase = sanitizeFileName(`audio-${artifactId}-local`);
    const textPath = join(artifactDir, `${fileBase}.txt`);
    const aiffPath = join(artifactDir, `${fileBase}.aiff`);
    const audioPath = join(artifactDir, `${fileBase}.m4a`);
    const script = transcript
      .slice(0, 14)
      .map((turn) => `${turn.host}: ${spokenAudioText(turn.text)}`)
      .join("\n\n");

    logger.info("audio.render.fallback.start", {
      artifact_id: artifactId,
      provider: "macos-say-fallback",
      voice,
      turns: Math.min(transcript.length, 14),
      input_chars: script.length,
      original_error: originalError,
    });

    const startedAt = Date.now();
    await writeFile(textPath, script);
    try {
      await execFile("say", ["-v", voice, "-f", textPath, "-o", aiffPath], {
        timeout: 180_000,
        maxBuffer: 1024 * 1024,
      });
      await execFile("afconvert", [aiffPath, audioPath, "-f", "m4af", "-d", "aac"], {
        timeout: 180_000,
        maxBuffer: 1024 * 1024,
      });
      const { size } = await stat(audioPath);
      logger.info("audio.render.fallback.completed", {
        artifact_id: artifactId,
        provider: "macos-say-fallback",
        voice,
        bytes: size,
        file_name: `${fileBase}.m4a`,
        latency_ms: Date.now() - startedAt,
      });
      return {
        provider: "macos-say-fallback",
        model: voice,
        format: "m4a_aac",
        content_type: "audio/mp4",
        file_name: `${fileBase}.m4a`,
        path: audioPath,
        bytes: size,
        turns: Math.min(transcript.length, 14),
      };
    } finally {
      await rm(textPath, { force: true });
      await rm(aiffPath, { force: true });
    }
  }

  async function writeArtifactFile(directory, artifact) {
    const safeTitle = sanitizeFileName(`${artifact.type}-${artifact.id}`);
    const extension = artifact.type === "data-table"
      ? "csv"
      : artifact.type === "report"
        ? "md"
        : artifact.type === "infographic"
          ? "svg"
          : "json";
    const filePath = join(directory, `${safeTitle}.${extension}`);
    const body = artifact.type === "infographic" && artifact.content_json?.svg_markup
      ? artifact.content_json.svg_markup
      : extension === "json"
        ? JSON.stringify(artifact.content_json, null, 2)
        : artifact.text_content;
    await writeFile(filePath, body);
    return filePath;
  }

  function renderArtifactText(type, payload) {
    if (type === "report") {
      return [
        `# ${payload.title}`,
        "",
        "## TL;DR",
        ...(payload.tldr || []).map((item) => `- ${item}`),
        "",
        "## Key Points",
        ...(payload.key_points || []).map((item) => `- ${item.text} ${item.citation}`),
        "",
        "## Open Questions",
        ...(payload.open_questions || []).map((item) => `- ${item}`),
        "",
        "## Risks / Limitations",
        ...(payload.risks_limitations || []).map((item) => `- ${item}`),
      ].join("\n");
    }
    if (type === "data-table") {
      const columns = payload.columns || [];
      const rows = payload.rows || [];
      return [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row.cells?.[column] || "")).join(","))].join("\n");
    }
    if (type === "infographic" && payload.svg_markup) {
      return payload.svg_markup;
    }
    if (type === "youtube-kit") {
      return [
        "# Title options",
        ...(payload.titles || []).map((title) => `- ${title}`),
        "",
        "# Description",
        payload.description || "",
        "",
        "# Chapters",
        ...(payload.chapters || []).map((chapter) => `${chapter.time}  ${chapter.label}`),
        "",
        "# Tags",
        (payload.tags || []).join(", "),
      ].join("\n");
    }
    if (type === "thumbnail") {
      return `# YouTube thumbnail\n\nPrompt: ${payload.image_prompt || ""}\nStatus: ${payload.image_status || ""}`;
    }
    return JSON.stringify(payload, null, 2);
  }

  function startModelRun(role, provider, model, input) {
    const run = {
      id: id("modelrun"),
      provider,
      model,
      role,
      input_tokens_estimate: estimateTokens(input),
      output_tokens_estimate: 0,
      latency_ms: 0,
      status: "running",
      error: "",
      cost_estimate: 0,
      created_at: now(),
      started_at_ms: Date.now(),
    };
    logger.info("model.run.start", {
      model_run_id: run.id,
      role,
      provider,
      model,
      input_tokens_estimate: run.input_tokens_estimate,
    });
    return run;
  }

  function normalizeChatRequest(input, context = {}) {
    const parsed = ChatRequestSchema.parse(input);
    if (parsed.notebook_id) return parsed;
    if (parsed.selectedSources?.length) {
      const notebook = {
        id: id("notebook"),
        owner_user_id: context.ownerUserId || "",
        title: "Ad hoc smoke notebook",
        description: "Temporary notebook for legacy smoke payloads.",
        created_at: now(),
        updated_at: now(),
        summary: "",
        active_source_count: parsed.selectedSources.length,
        source_count: parsed.selectedSources.length,
      };
      state.notebooks.push(notebook);
      for (const source of parsed.selectedSources) {
        const sourceId = String(source.id || id("source"));
        const stored = {
          id: sourceId,
          notebook_id: notebook.id,
          type: source.kind || "text",
          title: source.title || "Smoke source",
          original_url: "",
          file_path: "",
          status: "indexed",
          raw_text: source.body || "",
          cleaned_text: normalizeWhitespace(source.body || ""),
          metadata_json: { parser: "legacy-payload", fallback: false },
          created_at: now(),
          updated_at: now(),
          version: 1,
          active: true,
        };
        state.sources.push(stored);
        const blocks = parseMarkdownBlocks(stored, stored.cleaned_text);
        state.blocks.push(...blocks);
        const chunks = chunkDocument(notebook.id, stored, blocks);
        state.chunks.push(...chunks);
        state.embeddings.push(...chunks.map((chunk) => ({ id: id("embedding"), chunk_id: chunk.id, provider: "local", vector: embedText(chunk.text), created_at: now() })));
        state.knowledgeObjects.push(...buildSourceKnowledgeObjects(stored, blocks, chunks));
      }
      rebuildNotebookKnowledge(notebook.id);
      parsed.notebook_id = notebook.id;
    }
    return parsed;
  }

  function resolveNotebookForChat(parsed, context = {}) {
    if (parsed.notebook_id) return getNotebook(parsed.notebook_id, context);
    const first = listNotebooks(context)[0];
    if (!first) throw statusError(400, "Create or seed a notebook before chatting.");
    return first;
  }

  function chooseEmbeddingProvider() {
    if (env.DEFAULT_EMBEDDING_PROVIDER) return env.DEFAULT_EMBEDDING_PROVIDER;
    if (env.GOOGLE_API_KEY) return "gemini-configured-local-cache";
    if (env.OPENAI_API_KEY) return "openai-configured-local-cache";
    return "deterministic-local";
  }

  function openQuestionsForNotebook(notebookId) {
    return state.knowledgeObjects
      .filter((object) => object.notebook_id === notebookId && object.type === "open_questions")
      .flatMap((object) => object.data.questions || []);
  }

  function risksForNotebook(notebookId) {
    return state.knowledgeObjects
      .filter((object) => object.notebook_id === notebookId && object.type === "risks")
      .flatMap((object) => object.data.risks || [])
      .filter((risk) => !/^No explicit/i.test(risk));
  }
}

async function loadState(stateFile) {
  if (!existsSync(stateFile)) return createEmptyState();
  try {
    const parsed = JSON.parse(await readFile(stateFile, "utf8"));
    return { ...createEmptyState(), ...parsed };
  } catch {
    return createEmptyState();
  }
}

function createEmptyState() {
  return {
    notebooks: [],
    sources: [],
    blocks: [],
    chunks: [],
    embeddings: [],
    knowledgeObjects: [],
    chatSessions: [],
    chatMessages: [],
    retrievalRuns: [],
    evidencePacks: [],
    citationLedgers: [],
    artifactJobs: [],
    artifacts: [],
    flashcardDecks: [],
    flashcards: [],
    flashcardReviews: [],
    modelRuns: [],
  };
}

function providerLabel(provider) {
  return (
    {
      anthropic: "Anthropic",
      openai: "OpenAI",
      google: "Gemini",
      local: "Local deterministic fallback",
    }[provider] || "Local deterministic fallback"
  );
}

function storageLabel(root, storageDir) {
  const relativePath = relative(root, storageDir);
  if (relativePath && !relativePath.startsWith("..") && !relativePath.startsWith("/")) {
    return relativePath || ".";
  }
  return "custom-local-storage";
}

function hasConfiguredValue(value) {
  const text = String(value || "").trim();
  return Boolean(text && !/^replace-with-/i.test(text));
}

async function fetchUrlText(url, fetchImpl = globalThis.fetch) {
  const page = await fetchUrlPage(url, fetchImpl);
  return page.cleanedText;
}

async function fetchUrlPage(url, fetchImpl = globalThis.fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "SourceStudioAI/1.0 local demo crawler",
        accept: "text/html, text/plain;q=0.9, */*;q=0.5",
      },
    });
    if (!response.ok) throw statusError(400, `URL fetch failed with ${response.status}.`);
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (contentType.includes("html")) {
      return {
        url: response.url || url,
        title: extractHtmlTitle(text) || readableUrlTitle(response.url || url),
        cleanedText: cleanHtml(text),
        links: extractHtmlLinks(text, response.url || url),
        contentType,
      };
    }
    return {
      url: response.url || url,
      title: readableUrlTitle(response.url || url),
      cleanedText: normalizeWhitespace(text),
      links: [],
      contentType,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverSitemapUrls(startUrl, fetchImpl = globalThis.fetch) {
  const urls = [];
  const root = new URL(startUrl);
  const candidates = [
    new URL("/sitemap.xml", root.origin).toString(),
    new URL("/sitemap_index.xml", root.origin).toString(),
  ];
  for (const sitemapUrl of candidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetchImpl(sitemapUrl, {
        signal: controller.signal,
        headers: {
          "user-agent": "SourceStudioAI/1.0 local demo crawler",
          accept: "application/xml,text/xml,text/plain,*/*;q=0.5",
        },
      });
      clearTimeout(timeout);
      if (!response.ok) continue;
      const text = await response.text();
      const locs = [...text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
        .map((match) => decodeHtml(match[1].trim()))
        .filter(Boolean);
      urls.push(...locs);
    } catch {
      // Sitemap discovery is opportunistic; page links still drive the crawl.
    }
  }
  return [...new Set(urls)];
}

function pagesToCrawlMarkdown(startUrl, pages) {
  const host = new URL(startUrl).hostname.replace(/^www\./, "");
  return [
    `# Website crawl: ${host}`,
    "",
    `Crawled ${pages.length} same-origin page${pages.length === 1 ? "" : "s"} from ${startUrl}.`,
    "",
    ...pages.flatMap((page, index) => [
      `## Page ${index + 1}: ${page.title || readableUrlTitle(page.url)}`,
      "",
      `Source URL: ${page.url}`,
      "",
      page.cleanedText,
      "",
    ]),
  ].join("\n").slice(0, MAX_CRAWL_TEXT_CHARS);
}

function extractHtmlLinks(html, baseUrl) {
  return [...html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => decodeHtml(match[1].trim()))
    .map((href) => normalizeCrawlUrl(href, baseUrl))
    .filter(Boolean);
}

function extractHtmlTitle(html) {
  const h1 = /<h1[^>]*>(.*?)<\/h1>/is.exec(html)?.[1];
  const title = /<title[^>]*>(.*?)<\/title>/is.exec(html)?.[1];
  return cleanInlineHtml(h1 || title || "");
}

function cleanInlineHtml(html) {
  return normalizeWhitespace(String(html || "").replace(/<[^>]+>/g, " "));
}

function normalizeCrawlUrl(input, baseUrl) {
  try {
    const raw = String(input || "").trim();
    if (!raw || raw.startsWith("#") || /^mailto:|^tel:|^javascript:/i.test(raw)) return "";
    const url = new URL(raw, baseUrl);
    url.hash = "";
    if (!/^https?:$/.test(url.protocol)) return "";
    url.searchParams.sort();
    const ignoredParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    for (const param of ignoredParams) url.searchParams.delete(param);
    let normalized = url.toString();
    if (url.pathname !== "/" && normalized.endsWith("/")) normalized = normalized.slice(0, -1);
    return normalized;
  } catch {
    return "";
  }
}

function isSameOrigin(url, origin) {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

function isCrawlablePageUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    if (/\.(?:css|js|mjs|png|jpe?g|gif|webp|avif|svg|ico|pdf|zip|mp3|mp4|mov|webm|woff2?|ttf|eot)$/i.test(path)) return false;
    if (/\/(?:api|assets|images|img|fonts)\//i.test(path)) return false;
    return true;
  } catch {
    return false;
  }
}

function crawlPriority(url) {
  const path = new URL(url).pathname.toLowerCase();
  let score = 0;
  if (path === "/") score += 20;
  if (/\/blog(\/|$)/.test(path)) score += 80;
  if (/trading|bot|algo|signal|vyn|software|academy|learning|documentation/.test(path)) score += 45;
  if (/legal|privacy|terms|cookie|eula|acceptable-use|guarantee/.test(path)) score -= 80;
  if (/\/(?:de|es)(\/|$)/.test(path)) score -= 25;
  score -= path.split("/").length;
  return score;
}

function readableUrlTitle(url) {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).at(-1) || parsed.hostname.replace(/^www\./, "");
    return titleCase(last.replace(/[-_]+/g, " "));
  } catch {
    return "Web page";
  }
}

function cleanHtml(html) {
  const withHeadings = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, "\n# $1\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, "\n## $1\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, "\n### $1\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gis, "\n- $1")
    .replace(/<\/p>/gi, "\n\n");
  return decodeHtml(
    withHeadings
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

async function extractPdfText(buffer) {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const cleaned = normalizeWhitespace(Array.isArray(text) ? text.join("\n\n") : String(text || ""));
    if (cleaned.length > 40) return { text: cleaned, parser: "pdf-unpdf" };
  } catch {
    // Fall through to the byte-scan fallback (e.g. scanned/encrypted PDFs).
  }
  return { text: parsePdfFallback(buffer), parser: "pdf-string-fallback" };
}

function parsePdfFallback(buffer) {
  const text = buffer
    .toString("latin1")
    .replace(/\\[nrt]/g, " ")
    .match(/\(([^()]{3,})\)|[\wÄÖÜäöüß.,;:!?%€$'" -]{8,}/g)
    ?.map((part) => part.replace(/^\(|\)$/g, ""))
    .join(" ") || "";
  const cleaned = normalizeWhitespace(text);
  if (cleaned.length > 120) return cleaned;
  return "PDF uploaded. The local text-extraction fallback did not find reliable text in this file. OCR or layout-aware PDF extraction is a production extension.";
}

async function parseDocxTextFallback(filePath) {
  if (!filePath) {
    return "DOCX source uploaded without readable text. Paste the document text to index it, or configure a layout-aware DOCX parser.";
  }
  try {
    const { stdout } = await execFile("unzip", ["-p", filePath, "word/document.xml"], {
      timeout: 12000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const text = decodeHtml(
      stdout
        .replace(/<w:tab\/>/g, " ")
        .replace(/<\/w:p>/g, "\n\n")
        .replace(/<[^>]+>/g, " "),
    );
    const cleaned = normalizeWhitespace(text);
    if (cleaned.length > 80) return cleaned;
  } catch {
    // The fallback depends on the local unzip binary and a standard DOCX XML layer.
  }
  return "DOCX uploaded. The local XML text fallback did not find reliable text. Paste document text or add a production DOCX parser for layout-aware extraction.";
}

async function fetchGoogleDocText(url, fetchImpl = globalThis.fetch) {
  const exportUrl = googleDocExportUrl(url);
  if (!exportUrl) return fetchUrlText(url, fetchImpl);
  try {
    return await fetchUrlText(exportUrl, fetchImpl);
  } catch {
    return `Google Doc source: ${url}\n\nThe document could not be exported as plain text. Make the document accessible or paste the document text into the source body.`;
  }
}

function googleDocExportUrl(url) {
  try {
    const parsed = new URL(url);
    const id = /\/document\/d\/([^/]+)/.exec(parsed.pathname)?.[1];
    if (!id) return "";
    return `https://docs.google.com/document/d/${id}/export?format=txt`;
  } catch {
    return "";
  }
}

// Vision description + OCR for image sources (GPT-4o-mini vision).
async function describeImage(base64, mimeType, { apiKey, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) return "";
  const dataUrl = String(base64).startsWith("data:") ? base64 : `data:${mimeType || "image/png"};base64,${base64}`;
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-5.5",
      max_completion_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image in thorough detail for a research notebook. Transcribe ALL visible text verbatim. Note any charts, diagrams, numbers, data, people, branding, and context. Be comprehensive and factual.",
            },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message?.slice(0, 160) || `Vision API failed with ${response.status}.`);
  return body.choices?.[0]?.message?.content?.trim() || "";
}

// Audio/video transcription via Deepgram (Nova-3, diarized). ffmpeg normalizes
// any input (incl. extracting audio from video) to a clean 16kHz mono MP3 first.
async function transcribeAudioWithDeepgram(buffer, { apiKey, model = "nova-3", fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) return "";
  const audio = await normalizeAudioForAsr(buffer).catch(() => buffer);
  const params = new URLSearchParams({
    model,
    smart_format: "true",
    punctuate: "true",
    diarize: "true",
    utterances: "true",
    detect_language: "true",
  });
  const response = await fetchImpl(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: "POST",
    headers: { authorization: `Token ${apiKey}`, "content-type": "audio/mpeg" },
    body: audio,
  });
  if (!response.ok) throw new Error(`Deepgram transcription failed with ${response.status}.`);
  const body = await response.json();
  const utterances = body.results?.utterances;
  if (Array.isArray(utterances) && utterances.length) {
    const lines = [];
    let lastSpeaker = null;
    for (const utterance of utterances) {
      const speaker = `Speaker ${(utterance.speaker ?? 0) + 1}`;
      if (speaker !== lastSpeaker) {
        lines.push(`${speaker}: ${utterance.transcript}`);
        lastSpeaker = speaker;
      } else {
        lines[lines.length - 1] += ` ${utterance.transcript}`;
      }
    }
    return lines.join("\n").trim();
  }
  return body.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
}

async function normalizeAudioForAsr(buffer) {
  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
  const workDir = await mkdtemp(join(tmpdir(), "ssai-asr-"));
  const inputPath = join(workDir, "input");
  const outputPath = join(workDir, "audio.mp3");
  try {
    await writeFile(inputPath, buffer);
    await execFile(
      ffmpegPath,
      ["-y", "-i", inputPath, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "64k", outputPath],
      { timeout: 240000, maxBuffer: 1024 * 1024 * 16 },
    );
    return await readFile(outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

const YOUTUBE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchYouTubeTitle(videoId) {
  if (!videoId || process.env.SOURCESTUDIO_DISABLE_YTDLP === "1") return "";
  try {
    const ytDlpPath = process.env.YTDLP_PATH || "yt-dlp";
    const { stdout } = await execFile(
      ytDlpPath,
      ["--print", "%(title)s", "--skip-download", "--no-warnings", "--no-playlist", `https://www.youtube.com/watch?v=${videoId}`],
      { timeout: 30_000 },
    );
    return String(stdout || "").split("\n")[0].trim().slice(0, 200);
  } catch {
    return "";
  }
}

// When a video has no captions, download its audio track (yt-dlp) and transcribe
// it with Deepgram, so a YouTube source is still fully transcribed rather than a
// placeholder. ffmpeg (inside transcribeAudioWithDeepgram) normalizes the audio.
async function fetchYouTubeAudioTranscript(videoId, { apiKey, model, fetchImpl = globalThis.fetch } = {}) {
  if (!videoId || !apiKey || process.env.SOURCESTUDIO_DISABLE_YTDLP === "1") return "";
  const ytDlpPath = process.env.YTDLP_PATH || "yt-dlp";
  let dir;
  try {
    dir = await mkdtemp(join(tmpdir(), "yt-audio-"));
    await execFile(
      ytDlpPath,
      [
        "-f", "bestaudio/best",
        "-x", "--audio-format", "mp3", "--audio-quality", "5",
        "--no-warnings", "--no-playlist",
        "-o", join(dir, "audio.%(ext)s"),
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      { timeout: 300_000, maxBuffer: 1024 * 1024 * 64 },
    );
    const files = await readdir(dir);
    const audioFile = files.find((name) => /\.mp3$/i.test(name)) || files[0];
    if (!audioFile) return "";
    const buffer = await readFile(join(dir, audioFile));
    return (await transcribeAudioWithDeepgram(buffer, { apiKey, model, fetchImpl })) || "";
  } catch {
    return "";
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function fetchYouTubeTranscript(url, fetchImpl = globalThis.fetch) {
  const videoId = youtubeVideoId(url);
  if (!videoId) {
    return `# YouTube source\n\nThe supplied URL did not include a YouTube video ID. Paste the transcript to index this source.\n\nSource URL: ${url || "n/a"}`;
  }

  // Primary: yt-dlp. It generates the proof-of-origin token YouTube now requires
  // and reliably serves both manual and auto-generated captions in any language —
  // the bare timedtext endpoints below return empty without that token.
  if (fetchImpl === globalThis.fetch && process.env.SOURCESTUDIO_DISABLE_YTDLP !== "1") {
    try {
      const viaYtDlp = await fetchYouTubeTranscriptViaYtDlp(videoId);
      if (viaYtDlp) return viaYtDlp;
    } catch {
      // yt-dlp may be missing or rate-limited; fall back to the direct fetch paths.
    }
  }

  // Preferred path: read the watch page and use the real caption-track URLs.
  // Unlike the bare timedtext endpoint, this works for auto-generated ("asr")
  // captions and any available language, which is what most videos actually have.
  try {
    const tracks = await fetchYouTubeCaptionTracks(videoId, fetchImpl);
    const track = pickBestCaptionTrack(tracks);
    if (track?.baseUrl) {
      const baseUrl = track.baseUrl.replace(/\\u0026/g, "&");
      const trackUrl = /[?&]fmt=/.test(baseUrl) ? baseUrl : `${baseUrl}&fmt=json3`;
      const response = await fetchImpl(trackUrl, {
        headers: { "user-agent": YOUTUBE_UA, "accept-language": "en,de;q=0.8" },
      });
      if (response.ok) {
        const transcript = parseYouTubeTimedText(await response.text());
        if (transcript) {
          const auto = track.kind === "asr" ? " (auto-generated)" : "";
          const langName = track.name?.simpleText || track.name?.runs?.[0]?.text || "";
          return [
            `# YouTube transcript`,
            "",
            `Video ID: ${videoId}`,
            `Language: ${track.languageCode || "unknown"}${auto}${langName ? ` — ${langName}` : ""}`,
            "",
            transcript,
          ].join("\n");
        }
      }
    }
  } catch {
    // Fall through to the legacy direct endpoint.
  }

  // Legacy fallback: direct timedtext for common languages (manual captions only).
  for (const lang of ["en", "en-US", "de"]) {
    try {
      const transcriptUrl = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}&fmt=json3`;
      const response = await fetchImpl(transcriptUrl, {
        headers: { "user-agent": YOUTUBE_UA },
      });
      if (!response.ok) continue;
      const transcript = parseYouTubeTimedText(await response.text());
      if (transcript) {
        return [`# YouTube transcript`, "", `Video ID: ${videoId}`, `Language: ${lang}`, "", transcript].join("\n");
      }
    } catch {
      // Transcript fetching is opportunistic; users can still paste transcripts.
    }
  }

  return `# YouTube source\n\nNo public or auto-generated captions were available for video ${videoId} (the uploader may have disabled captions). Paste the transcript into the source body, or configure speech-to-text (Deepgram or Whisper) to transcribe the audio automatically.\n\nSource URL: ${url}`;
}

async function fetchYouTubeTranscriptViaYtDlp(videoId) {
  const ytDlpPath = process.env.YTDLP_PATH || "yt-dlp";
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Step 1: discover which caption languages actually exist on the video, so we
  // request only a real track. Requesting non-existent langs makes yt-dlp pull
  // translation tracks, which YouTube aggressively 429-rate-limits.
  let chosenLang = "";
  let chosenIsAuto = false;
  try {
    const { stdout } = await execFile(
      ytDlpPath,
      ["-J", "--skip-download", "--no-warnings", "--no-playlist", videoUrl],
      { timeout: 60_000, maxBuffer: 1024 * 1024 * 64 },
    );
    const info = JSON.parse(stdout);
    const origLang = String(info.language || "").toLowerCase();
    const manual = Object.keys(info.subtitles || {});
    const auto = Object.keys(info.automatic_captions || {});
    const pickManual = (langs) => {
      for (const pref of ["en", "de", "es", "fr"]) {
        const hit = langs.find((code) => code.toLowerCase().startsWith(pref));
        if (hit) return hit;
      }
      return langs[0] || "";
    };
    const pickAuto = (langs) => {
      // automatic_captions lists ~150 machine TRANSLATIONS; only the video's own
      // language is the real transcript. Requesting a translation makes YouTube
      // 429. Prefer the original language so we never request a translated track.
      if (origLang) {
        const native =
          langs.find((code) => code.toLowerCase() === `${origLang}-orig`) ||
          langs.find((code) => code.toLowerCase() === origLang) ||
          langs.find((code) => code.toLowerCase().startsWith(origLang));
        if (native) return native;
      }
      return langs.find((code) => /-orig$/i.test(code)) || pickManual(langs);
    };
    if (manual.length) {
      chosenLang = pickManual(manual);
      chosenIsAuto = false;
    } else if (auto.length) {
      chosenLang = pickAuto(auto);
      chosenIsAuto = true;
    }
  } catch {
    // Metadata probe failed; fall back to a small fixed request set below.
  }

  const workDir = await mkdtemp(join(tmpdir(), "ssai-yt-"));
  try {
    const subFlags = chosenLang
      ? [chosenIsAuto ? "--write-auto-subs" : "--write-subs", "--sub-langs", chosenLang]
      : ["--write-auto-subs", "--write-subs", "--sub-langs", "en.*,de.*"];
    await execFile(
      ytDlpPath,
      [
        "--skip-download",
        ...subFlags,
        "--sub-format",
        "json3",
        "--no-warnings",
        "--no-playlist",
        "--ignore-errors",
        "--no-abort-on-error",
        "--retries",
        "2",
        "--socket-timeout",
        "20",
        "--paths",
        workDir,
        "-o",
        "%(id)s",
        videoUrl,
      ],
      { timeout: 90_000, maxBuffer: 1024 * 1024 * 8 },
    ).catch(() => {
      // --ignore-errors keeps successful tracks; read whatever was written below.
    });
    const files = (await readdir(workDir)).filter((name) => name.endsWith(".json3"));
    if (!files.length) return "";
    const chosen = pickSubtitleFile(files);
    const transcript = parseYouTubeTimedTextWithStamps(await readFile(join(workDir, chosen), "utf8"));
    if (!transcript) return "";
    const lang = subtitleLangFromFile(chosen);
    const auto = chosenIsAuto || /-orig\b/.test(lang) ? " (auto-generated)" : "";
    return [`# YouTube transcript`, "", `Video ID: ${videoId}`, `Language: ${lang}${auto}`, "", transcript].join("\n");
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function subtitleLangFromFile(name) {
  return (/\.([A-Za-z-]+(?:-orig)?)\.json3$/.exec(name)?.[1] || "unknown");
}

function pickSubtitleFile(files) {
  const score = (name) => {
    const lang = subtitleLangFromFile(name).toLowerCase();
    let value = 0;
    if (lang.startsWith("en")) value += 100;
    else if (lang.startsWith("de")) value += 90;
    if (!/-orig\b/.test(lang)) value += 5;
    return value;
  };
  return [...files].sort((a, b) => score(b) - score(a))[0];
}

async function fetchYouTubeCaptionTracks(videoId, fetchImpl = globalThis.fetch) {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`;
  const response = await fetchImpl(watchUrl, {
    headers: { "user-agent": YOUTUBE_UA, "accept-language": "en,de;q=0.8" },
  });
  if (!response.ok) return [];
  const html = await response.text();
  const match = html.match(/"captionTracks":(\[.*?\])\s*,\s*"(?:audioTracks|translationLanguages|defaultAudioTrackIndex)"/s)
    || html.match(/"captionTracks":(\[.*?\])/s);
  if (!match) return [];
  try {
    return JSON.parse(match[1].replace(/\\u0026/g, "&"));
  } catch {
    return [];
  }
}

function pickBestCaptionTrack(tracks) {
  if (!Array.isArray(tracks) || !tracks.length) return null;
  const preferredLangs = ["en", "en-us", "en-gb", "de"];
  const manual = tracks.filter((track) => track.kind !== "asr");
  const pool = manual.length ? manual : tracks;
  for (const lang of preferredLangs) {
    const hit = pool.find((track) => String(track.languageCode || "").toLowerCase().startsWith(lang));
    if (hit) return hit;
  }
  return pool[0];
}

function youtubeVideoId(url) {
  try {
    const parsed = new URL(url);
    if (/youtu\.be$/i.test(parsed.hostname)) return parsed.pathname.replace(/^\//, "").split("/")[0] || "";
    if (/youtube\.com$/i.test(parsed.hostname) || /youtube-nocookie\.com$/i.test(parsed.hostname)) {
      return parsed.searchParams.get("v") || /\/(?:embed|shorts)\/([^/?]+)/.exec(parsed.pathname)?.[1] || "";
    }
  } catch {
    return "";
  }
  return "";
}

// Build a transcript with inline [M:SS] markers (roughly every windowSec) so
// downstream features (YouTube chapters) have real timestamps to work from.
function parseYouTubeTimedTextWithStamps(text, windowSec = 12) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return parseYouTubeTimedText(text);
  }
  const lines = [];
  let buffer = [];
  let windowStartMs = null;
  const flush = () => {
    if (!buffer.length || windowStartMs == null) return;
    const t = Math.floor(windowStartMs / 1000);
    lines.push(`[${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}] ${normalizeWhitespace(buffer.join(" "))}`);
    buffer = [];
    windowStartMs = null;
  };
  for (const event of parsed.events || []) {
    const segText = (event.segs || []).map((seg) => seg.utf8 || "").join("");
    if (!segText.trim()) continue;
    const startMs = event.tStartMs || 0;
    if (windowStartMs != null && startMs - windowStartMs >= windowSec * 1000) flush();
    if (windowStartMs == null) windowStartMs = startMs;
    buffer.push(segText);
  }
  flush();
  return lines.join("\n") || parseYouTubeTimedText(text);
}

function parseYouTubeTimedText(text) {
  try {
    const parsed = JSON.parse(text);
    return normalizeWhitespace(
      (parsed.events || [])
        .flatMap((event) => event.segs || [])
        .map((segment) => segment.utf8 || "")
        .join(" "),
    );
  } catch {
    const captions = [...String(text).matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)]
      .map((match) => decodeHtml(match[1].replace(/<[^>]+>/g, " ")))
      .join(" ");
    return normalizeWhitespace(captions);
  }
}

function inferTitle(input) {
  if (input.file_name) return titleFromFile(input.file_name);
  if (input.original_url) {
    try {
      const url = new URL(input.original_url);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return "URL source";
    }
  }
  return firstHeading(input.body || "") || titleCase(String(input.type || "Source"));
}

function firstHeading(text) {
  return /^(?:#\s+|Title:\s*)(.+)$/im.exec(text)?.[1]?.trim() || "";
}

function titleFromFile(file) {
  return String(file)
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeWhitespace(text) {
  return decodeHtml(String(text || ""))
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+\n/g, "\n\n")
    .trim();
}

function decodeHtml(text) {
  return String(text)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeForSearch(text) {
  return normalizeWhitespace(text).toLowerCase();
}

function tokenize(input) {
  const stop = new Set([
    "the",
    "and",
    "for",
    "from",
    "with",
    "that",
    "this",
    "what",
    "where",
    "when",
    "how",
    "are",
    "you",
    "your",
    "about",
    "into",
    "onto",
    "only",
    "also",
    "than",
    "then",
    "they",
    "them",
    "have",
    "has",
    "had",
    "was",
    "were",
    "will",
    "can",
    "could",
    "should",
    "source",
    "sources",
  ]);
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s-]/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stop.has(token));
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || "").split(/\s+/).filter(Boolean).length * 1.25));
}

// Split any single block whose text exceeds the chunk target into smaller
// sub-blocks (by line for transcripts, else by sentence) so long sources
// (YouTube transcripts, big PDFs) produce many retrievable chunks instead of one.
function splitOversizedBlocks(blocks) {
  const out = [];
  for (const block of blocks) {
    if (block.type === "heading" || estimateTokens(block.text) <= CHUNK_TOKEN_TARGET) {
      out.push(block);
      continue;
    }
    const useNewlines = (block.text.match(/\n/g) || []).length >= 3;
    const units = useNewlines ? block.text.split("\n") : block.text.split(/(?<=[.!?])\s+/);
    const joiner = useNewlines ? "\n" : " ";
    let buffer = [];
    let bufferTokens = 0;
    let offset = block.char_start || 0;
    const emit = (raw) => {
      const text = String(raw || "").trim();
      if (!text) return;
      out.push({ ...block, text, char_start: offset, char_end: offset + text.length });
      offset += text.length;
    };
    const flush = () => {
      if (!buffer.length) return;
      emit(buffer.join(joiner));
      buffer = [];
      bufferTokens = 0;
    };
    for (const unit of units) {
      // A single unit can itself exceed the target when there are no sentence breaks —
      // e.g. a flattened pricing/milestone table. Hard-split it by words so every
      // sub-block stays retrievable instead of becoming one oversized (or dropped) chunk.
      if (estimateTokens(unit) > CHUNK_TOKEN_TARGET) {
        flush();
        let wordBuffer = [];
        let wordTokens = 0;
        for (const word of unit.split(/\s+/).filter(Boolean)) {
          const wt = estimateTokens(word);
          if (wordBuffer.length && wordTokens + wt > CHUNK_TOKEN_TARGET) {
            emit(wordBuffer.join(" "));
            wordBuffer = [];
            wordTokens = 0;
          }
          wordBuffer.push(word);
          wordTokens += wt;
        }
        if (wordBuffer.length) emit(wordBuffer.join(" "));
        continue;
      }
      const unitTokens = estimateTokens(unit);
      if (buffer.length && bufferTokens + unitTokens > CHUNK_TOKEN_TARGET) flush();
      buffer.push(unit);
      bufferTokens += unitTokens;
    }
    flush();
  }
  return out;
}

function realProviderKey(value) {
  const key = String(value || "").trim();
  return key && !/^replace-with-/i.test(key) ? key : "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Real semantic embeddings (Voyage → OpenAI → local hash fallback). Replaces the
// SHA-256 hashed bag-of-words so retrieval understands meaning, not just keywords.
// Override the provider with EMBEDDING_PROVIDER=voyage|openai|local.
function createEmbedder({ env = process.env, fetchImpl = globalThis.fetch, logger } = {}) {
  const voyageKey = realProviderKey(env.VOYAGE_API_KEY);
  const openaiKey = realProviderKey(env.OPENAI_API_KEY);
  const preferred = String(env.EMBEDDING_PROVIDER || "").trim().toLowerCase();
  let provider = "local";
  let model = "local-hash-v1";
  if (preferred === "local") {
    provider = "local";
  } else if (preferred === "local-model" || preferred === "transformers") {
    provider = "local-model";
    model = env.LOCAL_EMBEDDING_MODEL || "Xenova/multilingual-e5-small";
  } else if (preferred === "openai" && openaiKey) {
    provider = "openai";
    model = env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-large";
  } else if (preferred === "voyage" && voyageKey) {
    provider = "voyage";
    model = env.VOYAGE_EMBEDDING_MODEL || "voyage-3-large";
  } else if (voyageKey) {
    provider = "voyage";
    model = env.VOYAGE_EMBEDDING_MODEL || "voyage-3-large";
  } else if (openaiKey) {
    provider = "openai";
    model = env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-large";
  }

  let localModelPipePromise = null;
  function getLocalModelPipe() {
    if (!localModelPipePromise) {
      localModelPipePromise = import("@xenova/transformers").then(({ pipeline }) =>
        pipeline("feature-extraction", model),
      );
    }
    return localModelPipePromise;
  }

  // Multilingual sentence-transformer running locally via ONNX. Free, offline,
  // no rate limits, cross-lingual. e5 models expect "query:"/"passage:" prefixes.
  async function embedLocalModel(texts, inputType) {
    const pipe = await getLocalModelPipe();
    const prefix = inputType === "query" ? "query: " : "passage: ";
    const output = await pipe(texts.map((text) => prefix + text), { pooling: "mean", normalize: true });
    return output.tolist();
  }

  async function postWithRetry(url, headers, payload) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(payload) });
      if (response.status === 429 || response.status >= 500) {
        if (attempt === 4) throw new Error(`Embeddings rate-limited (${response.status}) after retries.`);
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!response.ok) throw new Error(`Embeddings failed with ${response.status}.`);
      return response.json();
    }
    throw new Error("Embeddings failed after retries.");
  }

  async function embedBatch(texts, inputType) {
    if (provider === "local-model") return embedLocalModel(texts, inputType);
    if (provider === "voyage") {
      const body = await postWithRetry(
        "https://api.voyageai.com/v1/embeddings",
        { "content-type": "application/json", authorization: `Bearer ${voyageKey}` },
        { input: texts, model, input_type: inputType === "query" ? "query" : "document" },
      );
      return (body.data || []).slice().sort((a, b) => a.index - b.index).map((item) => item.embedding);
    }
    if (provider === "openai") {
      const body = await postWithRetry(
        "https://api.openai.com/v1/embeddings",
        { "content-type": "application/json", authorization: `Bearer ${openaiKey}` },
        { input: texts, model },
      );
      return (body.data || []).slice().sort((a, b) => a.index - b.index).map((item) => item.embedding);
    }
    return texts.map(embedText);
  }

  async function embed(texts, inputType = "document") {
    const list = (Array.isArray(texts) ? texts : [texts]).map((text) => String(text || "").slice(0, 24000) || " ");
    if (!list.length) return [];
    if (provider === "local") return list.map(embedText);
    const out = [];
    const BATCH = provider === "local-model" ? 16 : 64;
    for (let start = 0; start < list.length; start += BATCH) {
      const slice = list.slice(start, start + BATCH);
      try {
        const vectors = await embedBatch(slice, inputType);
        if (vectors.length !== slice.length) throw new Error("Embedding count mismatch.");
        out.push(...vectors);
      } catch (error) {
        logger?.warn?.("embedding.provider.failed", { provider, model, error: String(error?.message || error).slice(0, 200) });
        out.push(...slice.map(embedText));
      }
    }
    return out;
  }

  return { embed, provider, model, isSemantic: provider !== "local" };
}

// Optional Supabase/pgvector store for durable, scalable vector retrieval.
// Active when SUPABASE_DB_URL is set; otherwise the in-memory cosine path is used.
const PGVECTOR_DIM = 384;
function createPgStore({ env = process.env, logger } = {}) {
  const url = String(env.SUPABASE_DB_URL || "").trim();
  if (!url) return { enabled: false };
  let poolPromise = null;
  async function getPool() {
    if (!poolPromise) {
      poolPromise = import("pg").then(({ default: pg }) => {
        const pool = new pg.Pool({
          connectionString: url,
          max: 4,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 8000,
        });
        pool.on("error", (error) => logger?.warn?.("pg.pool.error", { error: String(error?.message || error).slice(0, 160) }));
        return pool;
      });
    }
    return poolPromise;
  }
  const toVector = (vec) => `[${vec.join(",")}]`;
  async function upsertChunks(rows) {
    const usable = rows.filter((row) => Array.isArray(row.embedding) && row.embedding.length === PGVECTOR_DIM);
    if (!usable.length) return;
    const pool = await getPool();
    const client = await pool.connect();
    try {
      for (const row of usable) {
        await client.query(
          `insert into doc_chunks(chunk_id, notebook_id, source_id, owner_user_id, content, heading_path, metadata, embedding)
           values($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (chunk_id) do update set content = excluded.content, embedding = excluded.embedding, metadata = excluded.metadata`,
          [row.chunk_id, row.notebook_id, row.source_id, row.owner_user_id || "", row.content || "", row.heading_path || "", row.metadata || {}, toVector(row.embedding)],
        );
      }
    } finally {
      client.release();
    }
  }
  async function deleteBySource(sourceId) {
    const pool = await getPool();
    await pool.query("delete from doc_chunks where source_id = $1", [sourceId]);
  }
  async function nearest(queryVector, sourceIds, limit) {
    if (!sourceIds.length || queryVector.length !== PGVECTOR_DIM) return new Map();
    const pool = await getPool();
    const result = await pool.query(
      "select chunk_id, 1 - (embedding <=> $1) as sim from doc_chunks where source_id = any($2) order by embedding <=> $1 limit $3",
      [toVector(queryVector), sourceIds, limit],
    );
    return new Map(result.rows.map((row) => [row.chunk_id, Number(row.sim)]));
  }
  return { enabled: true, upsertChunks, deleteBySource, nearest };
}

function embedText(text) {
  const vector = Array.from({ length: VECTOR_SIZE }, () => 0);
  for (const token of tokenize(text)) {
    const hash = createHash("sha256").update(token).digest();
    const index = hash[0] % VECTOR_SIZE;
    const sign = hash[1] % 2 === 0 ? 1 : -1;
    vector[index] += sign * (1 + Math.min(token.length, 12) / 12);
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    dot += a[index] * b[index];
    magA += a[index] * a[index];
    magB += b[index] * b[index];
  }
  return dot / ((Math.sqrt(magA) || 1) * (Math.sqrt(magB) || 1));
}

function overlapScore(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const b = new Set(bTokens);
  const matched = aTokens.filter((token) => b.has(token) || [...b].some((candidate) => candidate.includes(token) || token.includes(candidate)));
  return matched.length / Math.max(aTokens.length, 1);
}

function detectIntent(question, artifactType = "") {
  if (artifactType) {
    if (artifactType === "data-table") return "table";
    if (artifactType === "slide-deck") return "slides";
    if (artifactType === "mindmap") return "mindmap";
    if (artifactType === "audio") return "audio";
    if (artifactType === "video") return "video";
    return "artifact";
  }
  if (/summari[sz]e|overview|brief|tl;?dr/i.test(question)) return "summary";
  if (/compare|difference|versus|vs|contradiction|disagree|tension/i.test(question)) return "compare";
  if (/table|extract|numbers|dates|list/i.test(question)) return "table";
  if (/quiz|flashcard|slide|deck|artifact|audio|video|mind.?map|report/i.test(question)) return "artifact";
  if (/why|explain|concept/i.test(question)) return "explain";
  return "factual";
}

function rewriteQuery(question, notebookId, queryTokens) {
  const entityHints = queryTokens.filter((token) => token.length > 5).slice(0, 4).join(" ");
  const variants = [
    question,
    queryTokens.join(" "),
    `${question} evidence citation source block`,
    entityHints ? `${entityHints} requirements architecture risks` : "",
  ].filter(Boolean);
  return [...new Set(variants)].slice(0, 5);
}

function getEntityScore(chunk, queryTokens) {
  const headingTokens = tokenize((chunk.heading_path || []).join(" "));
  return overlapScore(queryTokens, [...headingTokens, ...tokenize(chunk.metadata_json?.source_title || "")]);
}

function summarizeText(text, sentenceCount = 3) {
  return extractSentences(text).slice(0, sentenceCount).join(" ");
}

function extractSentences(text) {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 30 && sentence.length < 420);
}

function extractClaims(text) {
  return extractSentences(text).filter((sentence) => /\b(is|are|needs?|requires?|should|must|can|will|supports?|creates?|reduces?|improves?)\b/i.test(sentence));
}

function extractEntities(text) {
  const matches = String(text).match(/\b[A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,4}\b/g) || [];
  return [...new Set(matches.filter((item) => !/^(The|This|That|For|When|Where|Source|Notebook)$/i.test(item)))];
}

function extractDates(text) {
  return [...new Set(String(text).match(/\b(?:20\d{2}|19\d{2}|Q[1-4]\s+20\d{2}|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b[^.\n]{0,80}/gi) || [])];
}

function extractNumbers(text) {
  return [...new Set(String(text).match(/\b\d+(?:[.,]\d+)?\s?(?:%|percent|€|\$|hours?|days?|weeks?|months?|years?|users?|sources?|tokens?|minutes?)?\b/gi) || [])];
}

function buildSectionSummaries(blocks) {
  const sections = new Map();
  for (const block of blocks) {
    const key = block.heading_path.join(" / ") || "Overview";
    if (!sections.has(key)) sections.set(key, []);
    if (block.type !== "heading") sections.get(key).push(block.text);
  }
  return [...sections.entries()].slice(0, 12).map(([heading, texts]) => ({
    heading_path: heading === "Overview" ? [] : heading.split(" / "),
    summary: summarizeText(texts.join(" "), 2),
  }));
}

function blockRefsForText(sourceId, blocks, text) {
  const terms = tokenize(text);
  const best = blocks
    .map((block) => ({ block, score: overlapScore(terms, tokenize(block.text)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  return [{ source_id: sourceId, block_ids: best.map((item) => item.block.block_id) }];
}

function inferTags(text) {
  return topTerms(text, 4).map((item) => item.term);
}

function inferEntityType(entity) {
  if (/\b(AI|API|LLM|CRM|ERP|PDF|SME|SaaS)\b/i.test(entity)) return "technology";
  if (/\bGmbH|Inc|LLC|Research|Consulting|Studio|SourceStudio\b/i.test(entity)) return "organization";
  return "concept";
}

function topTerms(text, limit = 10) {
  const counts = new Map();
  for (const token of tokenize(text)) counts.set(token, (counts.get(token) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function mergeEntities(entityObjects) {
  const map = new Map();
  for (const object of entityObjects) {
    const name = object.data.name;
    if (!map.has(name)) map.set(name, { ...object.data, source_refs: [] });
    map.get(name).source_refs.push(...(object.data.source_refs || []));
  }
  return [...map.values()].slice(0, 40);
}

function findConnections(entityObjects) {
  const bySource = new Map();
  for (const object of entityObjects) {
    if (!object.source_id) continue;
    if (!bySource.has(object.source_id)) bySource.set(object.source_id, []);
    bySource.get(object.source_id).push(object.data.name);
  }
  return [...bySource.entries()].flatMap(([sourceId, entities]) =>
    entities.slice(0, 5).map((entity) => ({ entity, source_id: sourceId, relationship: "mentioned_in_source" })),
  );
}

function findContradictions(claimObjects) {
  const claims = claimObjects.map((object) => ({ source_id: object.source_id, text: object.data.text, refs: object.data.source_refs }));
  const contradictions = [];
  for (const a of claims) {
    for (const b of claims) {
      if (a.source_id === b.source_id || contradictions.length >= 4) continue;
      const overlap = overlapScore(tokenize(a.text), tokenize(b.text));
      const opposite = /\b(not|avoid|risk|limit|cannot|fails?)\b/i.test(a.text + " " + b.text);
      if (overlap > 0.18 && opposite) {
        contradictions.push({
          statement_a: a.text,
          statement_b: b.text,
          source_refs_a: a.refs,
          source_refs_b: b.refs,
          severity: "medium",
        });
      }
    }
  }
  return contradictions;
}

function bestSentenceForQuestion(text, question) {
  const query = tokenize(question);
  const sentences = extractSentences(text);
  if (!sentences.length) return truncate(text, 220);
  return sentences
    .map((sentence) => ({ sentence, score: overlapScore(query, tokenize(sentence)) }))
    .sort((a, b) => b.score - a.score || b.sentence.length - a.sentence.length)[0].sentence;
}

function splitClaims(answer) {
  return answer
    .split(/\n+/)
    .flatMap((line) => {
      const clean = line.replace(/^[-*]\s+/, "").trim();
      return /\[\d+\]/.test(clean) ? [clean] : clean.split(/(?<=[.!?])\s+/);
    })
    .map((claim) => claim.trim())
    .filter((claim) => claim.length > 20);
}

function stripCitations(text) {
  return String(text).replace(/\[\d+\]/g, "").replace(/^[-*]\s+/, "").trim();
}

function spokenAudioText(text) {
  return truncate(stripCitations(text).replace(/\bSourceStudio\b/g, "Source Studio"), 900);
}

function safeProviderError(error) {
  return String(error?.message || error || "Provider request failed.").replace(/sk_[a-z0-9]+/gi, "[redacted]").slice(0, 220);
}

function dedupeEvidenceItems(items, question) {
  const seen = new Set();
  const deduped = [];
  for (const item of items || []) {
    const sentence = bestSentenceForQuestion(item.quote, question);
    const key = evidenceDedupeKey(sentence || item.quote);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    deduped.push(item);
  }
  return deduped.length ? deduped : items || [];
}

function evidenceDedupeKey(text) {
  return tokenize(stripCitations(text)).slice(0, 24).join(" ");
}

function sourceRefsFromEvidence(evidence) {
  return {
    source_id: evidence.source_id,
    block_ids: evidence.block_ids,
    chunk_id: evidence.chunk_id,
    quote: evidence.quote,
  };
}

function collectSourceRefs(evidencePack) {
  return evidencePack.evidence_items.map(sourceRefsFromEvidence);
}

function buildArtifactEvidenceAudit(evidencePack, payload = {}) {
  const citationItems = Array.isArray(payload.citations) ? payload.citations : [];
  const evidenceItems = evidencePack.evidence_items || [];
  const evidenceById = new Map(evidenceItems.map((item) => [item.evidence_id, item]));
  const payloadUsage = collectArtifactEvidenceUsage(payload, citationItems);
  const citedEvidenceIds = new Set(
    [...payloadUsage.evidence_ids, ...citationItems.map((item) => item.evidence_id)]
      .filter(Boolean),
  );
  const validCitedEvidenceIds = [...citedEvidenceIds].filter((evidenceId) => evidenceById.has(evidenceId));
  const invalidEvidenceIds = [...citedEvidenceIds].filter((evidenceId) => !evidenceById.has(evidenceId));
  const sourceIds = new Set(evidenceItems.map((item) => item.source_id).filter(Boolean));
  const citedSourceIds = new Set(
    [
      ...payloadUsage.source_ids,
      ...validCitedEvidenceIds.map((evidenceId) => evidenceById.get(evidenceId)?.source_id),
      ...citationItems.map((item) => item.source_id),
    ].filter(Boolean),
  );
  const claimItems = extractArtifactClaimItems(payload);
  const citedClaimItems = claimItems.filter((item) => artifactItemHasCitation(item)).length;
  const topSources = [...sourceIds]
    .map((sourceId) => {
      const sourceEvidence = evidenceItems.filter((item) => item.source_id === sourceId);
      const citedItems = sourceEvidence.filter((item) => validCitedEvidenceIds.includes(item.evidence_id));
      const supportTypes = [...new Set(sourceEvidence.map((item) => item.support_type).filter(Boolean))];
      return {
        source_id: sourceId,
        title: sourceEvidence[0]?.source_title || "Source",
        references: sourceEvidence.length,
        evidence_items: sourceEvidence.length,
        cited_items: citedItems.length,
        coverage: Number((citedItems.length / Math.max(1, sourceEvidence.length)).toFixed(2)),
        support_types: supportTypes,
      };
    })
    .sort((a, b) => b.cited_items - a.cited_items || b.references - a.references)
    .slice(0, 6);
  const evidenceCoverage = evidenceItems.length
    ? validCitedEvidenceIds.length / evidenceItems.length
    : 0;
  const sourceCoverage = sourceIds.size
    ? citedSourceIds.size / sourceIds.size
    : 0;
  const itemCitationCoverage = claimItems.length
    ? citedClaimItems / claimItems.length
    : citationItems.length || !evidenceItems.length
      ? 1
      : 0;
  const status = !evidenceItems.length
    ? "abstained"
    : invalidEvidenceIds.length
      ? "needs_review"
      : validCitedEvidenceIds.length && itemCitationCoverage >= 0.8
        ? "passed"
        : "needs_review";
  return {
    status,
    evidence_pack_id: evidencePack.id,
    retrieval_run_id: evidencePack.retrieval_run?.id || "",
    retrieval_intent: evidencePack.intent,
    query: evidencePack.user_question,
    evidence_items: evidenceItems.length,
    cited_evidence_items: validCitedEvidenceIds.length,
    uncited_evidence_ids: evidenceItems
      .map((item) => item.evidence_id)
      .filter((evidenceId) => !validCitedEvidenceIds.includes(evidenceId)),
    invalid_evidence_ids: invalidEvidenceIds,
    invalid_citation_count: invalidEvidenceIds.length,
    evidence_coverage: Number(evidenceCoverage.toFixed(2)),
    active_source_count: evidencePack.active_source_ids?.length || 0,
    source_count: sourceIds.size,
    cited_source_count: citedSourceIds.size,
    source_coverage: Number(sourceCoverage.toFixed(2)),
    artifact_items: claimItems.length,
    cited_artifact_items: citedClaimItems,
    item_citation_coverage: Number(itemCitationCoverage.toFixed(2)),
    constraints: evidencePack.constraints,
    top_sources: topSources,
    summary: evidenceItems.length
      ? `${validCitedEvidenceIds.length}/${evidenceItems.length} Evidence Pack items cited across ${citedSourceIds.size}/${sourceIds.size} retrieved source(s).`
      : "No source evidence was available; artifact generation abstained.",
  };
}

function collectArtifactEvidenceUsage(payload, citationItems = []) {
  const markerToEvidenceId = new Map(
    citationItems
      .map((item, index) => [String(index + 1), item.evidence_id])
      .filter((entry) => entry[1]),
  );
  const evidenceIds = new Set();
  const sourceIds = new Set();

  walkArtifactValue(payload, (value, key) => {
    if (key === "evidence_audit") return false;
    if (typeof value === "string") {
      for (const match of value.matchAll(/\[(\d+)\]/g)) {
        const evidenceId = markerToEvidenceId.get(match[1]);
        if (evidenceId) evidenceIds.add(evidenceId);
      }
      if (key === "evidence_id" && value) evidenceIds.add(value);
      if (key === "source_id" && value) sourceIds.add(value);
      return true;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (typeof value.evidence_id === "string" && value.evidence_id) evidenceIds.add(value.evidence_id);
      if (typeof value.source_id === "string" && value.source_id) sourceIds.add(value.source_id);
    }
    return true;
  });

  return {
    evidence_ids: evidenceIds,
    source_ids: sourceIds,
  };
}

function extractArtifactClaimItems(payload = {}) {
  const items = [];
  collectClaimItems(items, payload.key_points);
  collectClaimItems(items, payload.cards);
  collectClaimItems(items, payload.questions);
  collectClaimItems(items, payload.rows);
  collectClaimItems(items, payload.slides);
  collectClaimItems(items, sourceGroundedTranscriptTurns(payload.transcript));
  collectClaimItems(items, payload.storyboard);
  collectClaimItems(items, payload.panels);
  if (Array.isArray(payload.tldr)) {
    items.push(...payload.tldr.map((text) => ({ text })));
  }
  if (Array.isArray(payload.detailed_sections)) {
    for (const section of payload.detailed_sections) collectClaimItems(items, section?.body);
  }
  return items.filter((item) => JSON.stringify(item).replace(/\s+/g, "").length > 2);
}

function sourceGroundedTranscriptTurns(transcript) {
  if (!Array.isArray(transcript)) return [];
  return transcript.filter((turn) =>
    artifactItemHasCitation(turn) ||
    (Array.isArray(turn?.citation_ids) && turn.citation_ids.length) ||
    /\[\d+\]/.test(String(turn?.text || "")),
  );
}

function collectClaimItems(items, value) {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (typeof item === "string") items.push({ text: item });
    else if (item && typeof item === "object") items.push(item);
  }
}

function artifactItemHasCitation(item) {
  if (!item || typeof item !== "object") return false;
  if (typeof item.text === "string" && /\[\d+\]/.test(item.text)) return true;
  if (typeof item.answer === "string" && /\[\d+\]/.test(item.answer)) return true;
  if (typeof item.explanation === "string" && /\[\d+\]/.test(item.explanation)) return true;
  if (typeof item.narration === "string" && /\[\d+\]/.test(item.narration)) return true;
  if (typeof item.copy === "string" && /\[\d+\]/.test(item.copy)) return true;
  if (typeof item.citation === "string" && item.citation) return true;
  if (typeof item.evidence_id === "string" && item.evidence_id) return true;
  if (Array.isArray(item.source_refs) && item.source_refs.length) return true;
  if (item.source_refs && typeof item.source_refs === "object" && Object.keys(item.source_refs).length) return true;
  if (Array.isArray(item.citations) && item.citations.length) return true;
  if (Array.isArray(item.citation_ids) && item.citation_ids.length) return true;
  if (Array.isArray(item.bullets) && item.bullets.some((bullet) => /\[\d+\]/.test(String(bullet)))) return true;
  if (item.cells && typeof item.cells === "object") {
    return Object.values(item.cells).some((value) => /\[\d+\]/.test(String(value)));
  }
  return false;
}

function walkArtifactValue(value, visitor, key = "") {
  if (visitor(value, key) === false) return;
  if (Array.isArray(value)) {
    for (const item of value) walkArtifactValue(item, visitor, key);
    return;
  }
  if (value && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      walkArtifactValue(childValue, visitor, childKey);
    }
  }
}

function artifactQuery(type, options) {
  const label = artifactLabel(type);
  if (type === "audio") {
    const requestedMode = String(options.format || options.mode || "Deep Dive").replace(/[_-]+/g, " ").trim();
    const mode = requestedMode ? titleCase(requestedMode) : "Deep Dive";
    const focus = options.prompt || options.focus || "";
    return [
      `Create a ${mode} audio overview from active notebook sources.`,
      "Cover the strongest supported themes, concrete examples, caveats, contradictions, open questions, and citations.",
      "Prefer source passages with claims, decisions, processes, risks, evidence, or examples over navigation boilerplate.",
      "Build a narrative that remains useful when listened to without seeing the sources.",
      focus,
    ].join(" ").trim();
  }
  return `Create a source-backed ${label}. Include citations, risks, and open questions where relevant. ${options.prompt || ""}`.trim();
}

function artifactLabel(type) {
  return (
    {
      report: "Report",
      mindmap: "Mind Map",
      flashcards: "Flashcards",
      quiz: "Quiz",
      "data-table": "Data Table",
      "slide-deck": "Slide Deck",
      audio: "Audio Overview",
      video: "Video Overview",
      infographic: "Infographic",
      "youtube-kit": "Title & Description",
      thumbnail: "Thumbnail",
    }[type] || titleCase(type)
  );
}

function buildReportSections(keyPoints, citations) {
  return [
    {
      heading: "What the evidence says",
      body: keyPoints.slice(0, 3).map((point) => `${point.text} ${point.citation}`),
    },
    {
      heading: "Implications",
      body: keyPoints.slice(3, 6).map((point) => `${point.text} ${point.citation}`),
    },
    {
      heading: "Evidence audit",
      body: citations.slice(0, 4).map((citation) => `${citation.source_title}: ${truncate(citation.quote, 160)} ${citation.citation}`),
    },
  ];
}

function buildInfographicPayload({ notebook, evidencePack, citations, keyPoints, options = {} }) {
  const orientation = normalizeChoice(options.orientation, ["landscape", "portrait", "square"], "landscape");
  const detailLevel = normalizeChoice(options.detail_level || options.detailLevel, ["compact", "balanced", "detailed"], "balanced");
  const visualStyle = normalizeChoice(options.visual_style || options.visualStyle, ["evidence-dashboard", "executive-brief", "study-map"], "evidence-dashboard");
  const language = String(options.language || "English").slice(0, 48);
  const panelCount = detailLevel === "compact" ? 4 : detailLevel === "detailed" ? 8 : 6;
  const usablePoints = keyPoints.length
    ? keyPoints
    : citations.slice(0, panelCount).map((citation) => ({
        text: bestSentenceForQuestion(citation.quote, evidencePack.user_question),
        citation: citation.citation,
        source_refs: [sourceRefsFromEvidence(citation)],
      }));
  const panels = usablePoints.slice(0, panelCount).map((point, index) => {
    const citation = citations[index % Math.max(1, citations.length)] || {};
    const sentence = stripCitations(point.text);
    return {
      panel: index + 1,
      headline: infographicPanelHeadline(citation, sentence, index),
      copy: `${truncate(sentence, detailLevel === "compact" ? 118 : 154)} ${point.citation || citation.citation || ""}`.trim(),
      citation: point.citation || citation.citation || "",
      evidence_id: citation.evidence_id || "",
      source_title: citation.source_title || "",
      metric_label: infographicMetricLabel(citation, index),
      metric_value: infographicMetricValue(citation, index),
      source_refs: point.source_refs,
    };
  });
  const evidenceAppendix = citations.slice(0, Math.min(8, Math.max(4, panels.length))).map((citation, index) => ({
    index: index + 1,
    citation: citation.citation,
    evidence_id: citation.evidence_id,
    source_title: citation.source_title,
    quote: truncate(citation.quote, 220),
    source_refs: [sourceRefsFromEvidence(citation)],
  }));
  const citedSources = new Set(citations.map((citation) => citation.source_id).filter(Boolean));
  const dimensions = infographicDimensions(orientation);
  const payload = {
    title: options.title || `${notebook.title}: Infographic`,
    artifact_format: "source_grounded_infographic",
    render_status: "rendered_svg",
    language,
    orientation,
    detail_level: detailLevel,
    visual_style: visualStyle,
    prompt: options.prompt || "",
    dimensions,
    summary: `${panels.length} source-grounded panels built from ${evidencePack.evidence_items.length} Evidence Pack item(s).`,
    source_coverage: {
      active_sources: evidencePack.active_source_ids.length,
      evidence_items: evidencePack.evidence_items.length,
      cited_sources: citedSources.size,
      cited_evidence_items: citations.length,
    },
    panels,
    evidence_appendix: evidenceAppendix,
    citations,
    renderer: {
      format: "svg",
      export_status: "ready",
      download_filename_hint: `${sanitizeFileName(`${notebook.title}-infographic`)}.svg`,
      notes: "SVG is generated deterministically from cited Evidence Pack passages.",
    },
  };
  // Height grows with the panel count, so resolve the real canvas size from the layout.
  const layout = infographicLayout(payload);
  payload.dimensions = { width: layout.W, height: layout.H };
  payload.svg_markup = renderInfographicSvg(payload);
  return payload;
}

// The model router refines a infographic's title + panels but drops the deterministic
// visual metadata and svg_markup. Re-merge the refined panels onto the local payload and
// re-render the SVG so the designed infographic survives every provider path.
function finalizeInfographicPayload(generated, local) {
  const base = local && typeof local === "object" && Array.isArray(local.panels) ? local : generated;
  if (!base || typeof base !== "object") return generated;
  const merged = { ...base };
  if (generated && typeof generated === "object") {
    if (typeof generated.title === "string" && generated.title.trim()) merged.title = generated.title.trim();
    if (Array.isArray(generated.key_stats) && generated.key_stats.length) merged.key_stats = generated.key_stats;
    if (Array.isArray(generated.panels) && generated.panels.length) {
      merged.panels = generated.panels.map((g, index) => {
        const localPanel = (base.panels && base.panels[index]) || {};
        return {
          ...localPanel,
          panel: g.panel || localPanel.panel || index + 1,
          headline: g.headline || localPanel.headline || "",
          copy: g.copy || localPanel.copy || "",
          citation: g.citation || localPanel.citation || "",
          source_title: g.source_title || localPanel.source_title || "",
          evidence_id: g.evidence_id || localPanel.evidence_id || "",
          source_refs: g.source_refs || localPanel.source_refs || [],
        };
      });
    }
  }
  const layout = infographicLayout(merged);
  merged.dimensions = { width: layout.W, height: layout.H };
  merged.render_status = "rendered_svg";
  merged.svg_markup = renderInfographicSvg(merged);
  return merged;
}

// ---------------- Slide deck: render each slide as a designed 16:9 SVG ----------------
function attachSlideSvgs(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.slides)) return payload;
  const total = payload.slides.length;
  payload.slides = payload.slides.map((slide, index) =>
    ({ ...slide, svg_markup: renderSlideSvg(slide, { index, total, deckTitle: payload.title || "" }) }));
  payload.render_status = "rendered_svg";
  payload.slide_format = "designed_svg_16x9";
  return payload;
}

function renderSlideSvg(slide, { index, total, deckTitle }) {
  const W = 1280, H = 720, M = 64;
  const c = infographicPalette("evidence-dashboard");
  const accent = c.accents[index % c.accents.length];
  const layout = String(slide.layout_type || "content").toLowerCase();
  const isTitle = layout === "title" || index === 0;
  const isClosing = layout === "closing" || layout === "section" || (layout === "title" && index === total - 1 && total > 1);
  const title = infographicCleanText(slide.title || (isTitle ? deckTitle : ""));
  const subtitle = infographicCleanText(slide.subtitle || "");
  const bullets = (slide.bullets || []).map((b) => infographicCleanText(b)).filter(Boolean).slice(0, 6);
  const visual = infographicCleanText(slide.visual_suggestion || "");
  const p = [];

  p.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(title || "Slide")}">`);
  p.push(`<defs>`);
  p.push(`<linearGradient id="sl-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.bg1}"/><stop offset="1" stop-color="${c.bg0}"/></linearGradient>`);
  p.push(`<linearGradient id="sl-acc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.20"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>`);
  p.push(`</defs>`);
  p.push(`<rect width="${W}" height="${H}" fill="url(#sl-bg)"/>`);
  const gl = [];
  for (let gx = 0; gx < W; gx += 48) gl.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="${H}" stroke="${c.text}" stroke-opacity="0.014"/>`);
  for (let gy = 0; gy < H; gy += 48) gl.push(`<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="${c.text}" stroke-opacity="0.014"/>`);
  p.push(gl.join(""));
  p.push(`<rect x="0" y="0" width="9" height="${H}" fill="${accent}"/>`);

  if (isTitle || isClosing) {
    p.push(`<rect x="${W - 360}" y="-60" width="420" height="420" rx="210" fill="url(#sl-acc)"/>`);
    const tLines = wrapSvgText(title, 26, 3);
    p.push(`<circle cx="${M + 6}" cy="248" r="4" fill="${accent}"/>`);
    p.push(svgText(M + 18, 252, (isClosing ? "IN SUMMARY" : `${PRODUCT_NAME.toUpperCase()} · DECK`), { fill: accent, size: 14, weight: 800, spacing: 2.6 }));
    p.push(svgTextBlock(tLines, M, 320, { fill: c.text, size: 56, weight: 800, lineHeight: 64 }));
    const underY = 320 + tLines.length * 64 + 4;
    p.push(`<rect x="${M}" y="${underY}" width="120" height="5" rx="2.5" fill="${accent}"/>`);
    if (subtitle) p.push(svgTextBlock(wrapSvgText(subtitle, 64, 2), M, underY + 44, { fill: c.muted, size: 22, weight: 500, lineHeight: 30 }));
  } else {
    p.push(svgText(M, 96, infographicCleanText(deckTitle).toUpperCase() || "BRIEFING", { fill: accent, size: 13, weight: 800, spacing: 2.4 }));
    const tLines = wrapSvgText(title, 38, 2);
    p.push(svgTextBlock(tLines, M, 142, { fill: c.text, size: 40, weight: 800, lineHeight: 48 }));
    let y = 142 + tLines.length * 48 + 14;
    if (subtitle) { p.push(svgText(M, y, truncate(subtitle, 96), { fill: c.muted, size: 19, weight: 500 })); y += 36; }
    p.push(`<rect x="${M}" y="${y - 4}" width="${W - M * 2}" height="1" fill="${c.panelEdge}"/>`);
    y += 30;
    const bulletAreaBottom = H - 96;
    const perBullet = bullets.length ? Math.min(96, Math.floor((bulletAreaBottom - y) / bullets.length)) : 0;
    bullets.forEach((b, i) => {
      const by = y + i * perBullet;
      const lines = wrapSvgText(b, 76, perBullet < 64 ? 2 : 3);
      p.push(`<rect x="${M}" y="${by - 2}" width="14" height="14" rx="4" fill="${accent}"/>`);
      p.push(svgTextBlock(lines, M + 30, by + 11, { fill: c.muted, size: 21, weight: 500, lineHeight: 27 }));
    });
    if (visual) p.push(svgText(M, H - 64, `▸ Visual: ${truncate(visual, 88)}`, { fill: c.faint, size: 13, weight: 600 }));
  }

  // footer: slide number + deck title + brand
  p.push(`<rect x="${M}" y="${H - 44}" width="${W - M * 2}" height="1" fill="${c.panelEdge}"/>`);
  p.push(svgText(M, H - 22, `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, { fill: accent, size: 13, weight: 800 }));
  p.push(svgText(W / 2, H - 22, truncate(infographicCleanText(deckTitle), 64), { fill: c.faint, size: 12.5, weight: 600, anchor: "middle" }));
  p.push(svgText(W - M, H - 22, PRODUCT_NAME, { fill: c.muted, size: 12.5, weight: 800, anchor: "end" }));
  p.push(`</svg>`);
  return p.join("");
}

function normalizeChoice(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function infographicDimensions(orientation) {
  // Width is fixed per orientation; the real height is computed from content by
  // infographicLayout() (the canvas grows with the panel count). These heights are
  // only nominal seeds and get overwritten in buildInfographicPayload().
  if (orientation === "portrait") return { width: 1000, height: 1414 };
  if (orientation === "square") return { width: 1080, height: 1080 };
  return { width: 1280, height: 1000 };
}

function infographicHeadline(sentence, index) {
  const topic = titleCase(topicFromSentence(sentence));
  const prefixes = ["Core Signal", "Evidence", "Workflow", "Risk", "Decision", "Next Step", "Pattern", "Question"];
  return truncate(`${prefixes[index % prefixes.length]}: ${topic}`, 48);
}

// Prefer the cited passage's section heading (e.g. a markdown H2) as the panel headline —
// it reads far better than a keyword-salad topic. Only use it when it actually relates to
// the panel copy (retrieval chunks can straddle heading boundaries); otherwise fall back to
// the synthesized headline so headline and copy never drift apart.
function infographicPanelHeadline(citation, sentence, index) {
  const heading = Array.isArray(citation?.heading_path)
    ? citation.heading_path.filter(Boolean).at(-1)
    : "";
  if (heading && heading.trim().length >= 4) {
    const related = overlapScore(tokenize(heading), tokenize(sentence)) >= 0.12;
    if (related) return truncate(titleCase(heading.trim()), 46);
  }
  return infographicHeadline(sentence, index);
}

function infographicMetricLabel(citation, index) {
  if (citation?.heading_path?.length) return "Section";
  return ["Evidence", "Source", "Signal", "Claim"][index % 4];
}

function infographicMetricValue(citation, index) {
  if (citation?.heading_path?.length) return truncate(citation.heading_path.at(-1), 32);
  if (citation?.source_title) return truncate(citation.source_title, 32);
  return `E${index + 1}`;
}

// stripCitations + tidy spacing around punctuation (stripped citations leave " ." behind).
function infographicCleanText(text) {
  return stripCitations(text).replace(/\s+([.,;:!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

// Inline icon library (24x24 viewport). Each value is the inner markup, placed inside a
// <g transform="translate(x y) scale(s)" stroke=...> by iconMarkup().
const INFOGRAPHIC_ICONS = {
  shield: `<path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 7.7 7.5 9.5 4.3-1.8 7.5-4.9 7.5-9.5v-6L12 2.5Z"/><path d="M8.7 12.2l2.3 2.3 4.3-4.6"/>`,
  chartUp: `<path d="M4 19.5h16"/><path d="M4 19.5V5"/><path d="M6.5 15l3.5-4 3 2.5 4.5-6"/><path d="M17.5 7.5h-3M17.5 7.5v3"/>`,
  calendar: `<rect x="4" y="5.5" width="16" height="14.5" rx="2.4"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/><path d="M8.5 14.5l2 2 4-4.2"/>`,
  dollar: `<circle cx="12" cy="12" r="9"/><path d="M12 7v10M14.7 9.2c-.5-1-1.6-1.5-2.9-1.5-1.6 0-2.7.8-2.7 2 0 1.3 1 1.8 2.8 2.2 1.9.4 2.9 1 2.9 2.3 0 1.3-1.2 2.1-2.9 2.1-1.4 0-2.6-.6-3-1.7"/>`,
  layers: `<path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5Z"/><path d="M3.5 12 12 16.5 20.5 12"/><path d="M3.5 16 12 20.5 20.5 16"/>`,
  target: `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>`,
  bot: `<rect x="4.5" y="8" width="15" height="11" rx="3"/><path d="M12 8V4.5M12 4.5h-.01"/><circle cx="9" cy="13" r="1.3"/><circle cx="15" cy="13" r="1.3"/><path d="M9.5 16.3h5M2.8 12v3M21.2 12v3"/>`,
  flow: `<circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="12" cy="18" r="2.6"/><path d="M8.4 7.2 11 15.4M15.6 7.2 13 15.4M8.6 6h6.8"/>`,
  lightbulb: `<path d="M9 17.5h6M9.7 20.5h4.6"/><path d="M12 3.2A6 6 0 0 0 8 14.3c.7.7 1 1.3 1 2.2h6c0-.9.3-1.5 1-2.2A6 6 0 0 0 12 3.2Z"/>`,
  check: `<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.6 2.6L16 9.3"/>`,
  gauge: `<path d="M4 16.5a8 8 0 1 1 16 0"/><path d="M12 16.5 16 10"/><circle cx="12" cy="16.5" r="1.4"/>`,
  link: `<path d="M9.5 14.5 14.5 9.5"/><path d="M11 7.5l1.2-1.2a3.6 3.6 0 0 1 5.1 5.1L16 12.6"/><path d="M13 16.5l-1.2 1.2a3.6 3.6 0 0 1-5.1-5.1L8 11.3"/>`,
  spark: `<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>`,
  doc: `<path d="M6 3.5h7l5 5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M13 3.5V8.5h5M8.5 13h7M8.5 16.5h7"/>`,
  users: `<circle cx="9" cy="9" r="3"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 6.2a3 3 0 0 1 0 5.6M17 14.2c2.3.5 3.5 2.4 3.5 4.8"/>`,
};
const INFOGRAPHIC_ICON_KEYWORDS = [
  [/\b(price|cost|\$|usd|fee|revenue|paid|plan|month|year)\b/i, "dollar"],
  [/\b(risk|safety|protect|secure|guard|hedge|drawdown)\b/i, "shield"],
  [/\b(growth|increase|return|performance|profit|yield|gain|scale|trend)\b/i, "chartUp"],
  [/\b(since|history|year|decade|live|track record)\b/i, "calendar"],
  [/\b(bot|automat|algorith|systematic|execution|engine)\b/i, "bot"],
  [/\b(strategy|method|approach|framework|principle|model)\b/i, "target"],
  [/\b(layer|stack|tier|ladder|product|infrastructure|system)\b/i, "layers"],
  [/\b(workflow|pipeline|process|route|signal|flow|webhook)\b/i, "flow"],
  [/\b(idea|insight|learn|course|understand|guide)\b/i, "lightbulb"],
  [/\b(community|trader|user|team|member|people|discord)\b/i, "users"],
  [/\b(connect|integrat|api|link|bridge)\b/i, "link"],
  [/\b(volatility|adaptive|dynamic|real-time|monitor)\b/i, "gauge"],
];
function pickInfographicIcon(text, index) {
  const hay = String(text || "");
  for (const [re, key] of INFOGRAPHIC_ICON_KEYWORDS) if (re.test(hay)) return key;
  const cycle = ["target", "layers", "chartUp", "spark", "flow", "doc", "lightbulb", "gauge"];
  return cycle[index % cycle.length];
}
function infographicIconMarkup(key, x, y, size, color, strokeW = 1.8) {
  const inner = INFOGRAPHIC_ICONS[key] || INFOGRAPHIC_ICONS.target;
  const s = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
}

// Pull the most quotable numbers (money, %, years, durations) out of the cited copy to
// power the hero KPI strip. Backfills with structural coverage stats so we always get 3.
const INFOGRAPHIC_KPI_STOP = new Set("the a an of on in at to and or for all with that this its his her their is are was were be been has have had includes include uses use built from than over per via into out up down new now first only also each both".split(" "));
// The bare-number branch uses lookarounds so it never matches a fragment of a larger
// number (e.g. "449" inside "$4,449").
const INFOGRAPHIC_NUM_RE = /(\$\s?[\d.,]+\s?(?:k|m|bn)?(?:\s?\/\s?(?:month|year|mo|yr))?|\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?\s?(?:years?|yrs?|months?|weeks?|days?|hours?|x)\b|(?<![\d.,$€£])\d{3,}(?![\d.,]))/gi;
function infographicKpiLabel(before, after, fallbackTopic) {
  const pick = (arr) => arr.map((w) => w.toLowerCase()).filter((w) => w.length > 2 && !INFOGRAPHIC_KPI_STOP.has(w) && !/^https?/.test(w));
  let words = pick(after).slice(0, 2);
  if (words.length < 1) words = pick(before).slice(-2);
  if (words.length < 1 && fallbackTopic) words = String(fallbackTopic).split(/\s+/).slice(0, 2);
  return titleCase(words.join(" ")) || "From sources";
}
function extractInfographicMetrics(payload) {
  const panels = payload.panels || [];
  // Prefer model-provided key_stats (clean value + label) when available — they read far
  // better than regex-extracted numbers. Fall back to extraction for the local path.
  if (Array.isArray(payload.key_stats) && payload.key_stats.length) {
    const stats = payload.key_stats
      .filter((s) => s && (s.value || s.value === 0))
      .slice(0, 3)
      .map((s, i) => {
        const value = infographicCleanText(String(s.value));
        const label = infographicCleanText(String(s.label || ""));
        const isMoney = /[$€£]/.test(value), isPct = /%/.test(value), isYear = /^(19|20)\d{2}$/.test(value.replace(/\D/g, "").slice(0, 4));
        const icon = isMoney ? "dollar" : isPct ? "gauge" : isYear ? "calendar" : pickInfographicIcon(`${label} ${value}`, i);
        return { value: truncate(value, 13), label: truncate(label || "From sources", 24), icon };
      });
    if (stats.length >= 1) return stats.length >= 3 ? stats.slice(0, 3) : stats;
  }
  const entries = [
    ...panels.map((p) => ({ text: `${p.headline}. ${p.copy}`, topic: infographicCleanText(p.headline || "") })),
    ...(payload.evidence_appendix || []).map((e) => ({ text: e.quote || "", topic: infographicCleanText(e.source_title || "") })),
  ];
  const found = [];
  const seen = new Set();
  for (const entry of entries) {
    const clean = infographicCleanText(entry.text);
    let m;
    INFOGRAPHIC_NUM_RE.lastIndex = 0;
    while ((m = INFOGRAPHIC_NUM_RE.exec(clean))) {
      const value = m[0].replace(/\s+/g, " ").trim().replace(/\s?\/\s?/g, "/");
      const key = value.toLowerCase().replace(/[,\s]/g, "");
      if (seen.has(key)) continue;
      const before = clean.slice(Math.max(0, m.index - 46), m.index).replace(/[^a-zA-Z%/$.\s]/g, " ").trim().split(/\s+/).filter(Boolean);
      const after = clean.slice(m.index + m[0].length, m.index + m[0].length + 46).replace(/[^a-zA-Z%/$.\s]/g, " ").trim().split(/\s+/).filter(Boolean);
      const label = infographicKpiLabel(before, after, entry.topic);
      seen.add(key);
      const isMoney = /\$/.test(value), isPct = /%/.test(value), isYear = /^(19|20)\d{2}$/.test(value);
      const icon = isMoney ? "dollar" : isPct ? "gauge" : isYear ? "calendar" : pickInfographicIcon(`${label} ${value}`, found.length);
      found.push({
        value: truncate(value, 13),
        label: truncate(label, 24),
        icon,
        score: (isMoney ? 10 : 0) + (isPct ? 8 : 0) + (isYear ? 6 : 0) + Math.min(4, value.length),
      });
      if (found.length >= 10) break;
    }
    if (found.length >= 10) break;
  }
  found.sort((a, b) => b.score - a.score);
  const top = found.slice(0, 3);
  const cov = payload.source_coverage || {};
  const fillers = [
    { value: String(cov.active_sources ?? 0), label: "Active sources", icon: "doc" },
    { value: String(cov.evidence_items ?? (payload.evidence_appendix || []).length), label: "Evidence items", icon: "layers" },
    { value: String(panels.length), label: "Source panels", icon: "target" },
    { value: String(cov.cited_sources ?? 0), label: "Cited sources", icon: "check" },
  ];
  let fi = 0;
  while (top.length < 3 && fi < fillers.length) {
    const f = fillers[fi++];
    if (!top.some((t) => t.value === f.value && t.label === f.label)) top.push(f);
  }
  return top.slice(0, 3);
}

// Full layout. Width is fixed per orientation; height GROWS with the panel count so every
// panel gets a comfortable, fixed row height (no cramming, no overlaps).
function infographicLayout(payload) {
  const portrait = payload.orientation === "portrait";
  const square = payload.orientation === "square";
  const W = Number(payload.dimensions?.width) || (portrait ? 1000 : square ? 1080 : 1280);
  const M = Math.round(W * 0.035);
  const columns = portrait ? 1 : 2;
  const panels = payload.panels || [];
  const rows = Math.max(1, Math.ceil(panels.length / columns));
  const titleSize = portrait ? 30 : 34;
  const titleLH = portrait ? 36 : 40;
  const titleLines = wrapSvgText(payload.title, portrait ? 28 : 34, 2);
  const headerH = 64 + titleLines.length * titleLH + 30;
  const kpiH = portrait ? 122 : 116;
  const footerH = 72;
  const pGap = 16;
  const panelH = portrait ? 150 : 172;
  const gridTop = M + headerH + 12 + kpiH + 16;
  const H = gridTop + rows * panelH + (rows - 1) * pGap + 14 + footerH + M;
  return { W, H, M, portrait, columns, panels, rows, titleSize, titleLH, titleLines, headerH, kpiH, footerH, pGap, panelH, gridTop };
}

function svgText(x, y, str, { fill, size, weight = 600, anchor = "start", spacing, family = "Inter, 'Helvetica Neue', Arial, sans-serif", opacity }) {
  const attrs = [
    `x="${x}"`, `y="${y}"`, `fill="${fill}"`, `font-family="${family}"`,
    `font-size="${size}"`, `font-weight="${weight}"`, `text-anchor="${anchor}"`,
    spacing ? `letter-spacing="${spacing}"` : "",
    opacity != null ? `opacity="${opacity}"` : "",
  ].filter(Boolean).join(" ");
  return `<text ${attrs}>${escapeXml(str)}</text>`;
}

function svgTextBlock(lines, x, y, { fill, size, weight, lineHeight, anchor = "start", spacing }) {
  return lines.map((line, index) => svgText(x, y + index * lineHeight, line, { fill, size, weight, anchor, spacing })).join("");
}

function renderInfographicSvg(payload) {
  const L = infographicLayout(payload);
  const { W, H, M, portrait, columns, panels, titleSize, titleLH, titleLines, headerH, kpiH, footerH, pGap, panelH, gridTop } = L;
  const c = infographicPalette(payload.visual_style);
  const innerW = W - M * 2;

  const coverage = payload.source_coverage || {};
  const subtitle = truncate(
    `${panels.length} source-grounded panels · ${coverage.cited_sources || 0}/${coverage.active_sources || 0} sources cited · ${coverage.evidence_items || 0} evidence items`,
    portrait ? 60 : 84,
  );

  const metrics = extractInfographicMetrics(payload);
  const kpiGap = 16;
  const kpiW = Math.floor((innerW - kpiGap * (metrics.length - 1)) / Math.max(1, metrics.length));
  const panelW = Math.floor((innerW - pGap * (columns - 1)) / columns);

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(payload.title)}">`);

  // gradient defs
  parts.push(`<defs>`);
  parts.push(`<linearGradient id="ig-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.bg1}"/><stop offset="1" stop-color="${c.bg0}"/></linearGradient>`);
  parts.push(`<linearGradient id="ig-hdr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.green}" stop-opacity="0.16"/><stop offset="0.6" stop-color="${c.accents[4]}" stop-opacity="0.05"/><stop offset="1" stop-color="${c.bg0}" stop-opacity="0"/></linearGradient>`);
  c.accents.forEach((a, i) => {
    parts.push(`<linearGradient id="ig-acc${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}" stop-opacity="0.22"/><stop offset="1" stop-color="${a}" stop-opacity="0.02"/></linearGradient>`);
  });
  parts.push(`</defs>`);

  // backdrop + faint grid texture
  parts.push(`<rect width="${W}" height="${H}" fill="url(#ig-bg)"/>`);
  const gl = [];
  for (let gx = M; gx < W - M; gx += 48) gl.push(`<line x1="${gx}" y1="${M}" x2="${gx}" y2="${H - M}" stroke="${c.text}" stroke-opacity="0.018"/>`);
  for (let gy = M; gy < H - M; gy += 48) gl.push(`<line x1="${M}" y1="${gy}" x2="${W - M}" y2="${gy}" stroke="${c.text}" stroke-opacity="0.018"/>`);
  parts.push(gl.join(""));

  // ===== HEADER =====
  const hx = M, hy = M;
  parts.push(`<rect x="${hx}" y="${hy}" width="${innerW}" height="${headerH}" rx="22" fill="url(#ig-hdr)" stroke="${c.panelEdge}"/>`);
  const mox = W - M - 64, moy = hy + 58;
  parts.push(`<circle cx="${mox}" cy="${moy}" r="46" fill="none" stroke="${c.green}" stroke-opacity="0.25"/>`);
  parts.push(`<circle cx="${mox}" cy="${moy}" r="30" fill="none" stroke="${c.accents[1]}" stroke-opacity="0.3"/>`);
  parts.push(`<circle cx="${mox}" cy="${moy}" r="6" fill="${c.green}"/>`);
  [[-46, 0], [33, -33], [33, 33], [0, 46]].forEach(([dx, dy], i) => {
    const a = c.accents[i % c.accents.length];
    parts.push(`<line x1="${mox}" y1="${moy}" x2="${mox + dx}" y2="${moy + dy}" stroke="${a}" stroke-opacity="0.3"/>`);
    parts.push(`<circle cx="${mox + dx}" cy="${moy + dy}" r="4.5" fill="${a}"/>`);
  });
  parts.push(`<circle cx="${hx + 28}" cy="${hy + 32}" r="4" fill="${c.green}"/>`);
  parts.push(svgText(hx + 40, hy + 36, "SOURCE-GROUNDED INFOGRAPHIC", { fill: c.green, size: 12.5, weight: 800, spacing: 2.4 }));
  parts.push(svgTextBlock(titleLines, hx + 28, hy + 64 + titleSize - 6, { fill: c.text, size: titleSize, weight: 800, lineHeight: titleLH }));
  parts.push(svgText(hx + 28, hy + headerH - 18, subtitle, { fill: c.muted, size: 13.5, weight: 600 }));

  // ===== HERO KPI STRIP =====
  const ky = M + headerH + 12;
  metrics.forEach((mt, i) => {
    const kx = M + i * (kpiW + kpiGap);
    const a = c.accents[i % c.accents.length];
    parts.push(`<g transform="translate(${kx} ${ky})">`);
    parts.push(`<rect width="${kpiW}" height="${kpiH}" rx="18" fill="url(#ig-acc${i % c.accents.length})" stroke="${a}" stroke-opacity="0.45"/>`);
    parts.push(`<rect width="5" height="${kpiH}" rx="2.5" fill="${a}"/>`);
    parts.push(`<rect x="20" y="20" width="40" height="40" rx="11" fill="${a}" fill-opacity="0.16"/>`);
    parts.push(infographicIconMarkup(mt.icon, 28, 28, 24, a, 1.9));
    parts.push(svgText(20, kpiH - 38, truncate(mt.value, 14), { fill: c.text, size: 40, weight: 800 }));
    parts.push(svgText(20, kpiH - 16, truncate(mt.label, 30).toUpperCase(), { fill: c.muted, size: 11.5, weight: 700, spacing: 0.8 }));
    parts.push(`</g>`);
  });

  // ===== PANEL GRID =====
  panels.forEach((p, i) => {
    const col = i % columns, row = Math.floor(i / columns);
    const x = M + col * (panelW + pGap);
    const y = gridTop + row * (panelH + pGap);
    const a = c.accents[i % c.accents.length];
    const icon = pickInfographicIcon(`${p.headline} ${p.copy}`, i);
    const headlineText = infographicCleanText(p.headline || "");
    const copyText = infographicCleanText(p.copy || "");
    const single = columns === 1;
    const headSize = single ? 20 : 18, headLH = single ? 25 : 23;
    const copySize = single ? 15 : 13.5, copyLH = single ? 21 : 19;
    const headLines = wrapSvgText(headlineText, single ? 52 : 30, 2);
    const padX = 24;
    const headTop = 30;
    const copyY = headTop + headLines.length * headLH + 10;
    const dividerY = panelH - 30;
    const footerY = panelH - 14;
    const copyRoom = dividerY - 6 - copyY;
    const maxCopyLines = Math.min(5, Math.floor(copyRoom / copyLH));
    const copyLines = maxCopyLines >= 1 ? wrapSvgText(copyText, single ? 80 : 44, maxCopyLines) : [];
    const source = truncate(p.source_title || p.evidence_id || "Evidence Pack", single ? 56 : 30);

    parts.push(`<g transform="translate(${x} ${y})">`);
    parts.push(`<rect width="${panelW}" height="${panelH}" rx="18" fill="${c.panel}" stroke="${c.panelEdge}"/>`);
    parts.push(`<rect width="5" height="${panelH}" rx="2.5" fill="${a}"/>`);
    parts.push(`<circle cx="42" cy="40" r="18" fill="${a}" fill-opacity="0.16" stroke="${a}" stroke-opacity="0.5"/>`);
    parts.push(svgText(42, 45, String(p.panel || i + 1).padStart(2, "0"), { fill: a, size: 14, weight: 800, anchor: "middle" }));
    parts.push(`<rect x="${panelW - 56}" y="22" width="36" height="36" rx="10" fill="${a}" fill-opacity="0.1"/>`);
    parts.push(infographicIconMarkup(icon, panelW - 50, 28, 24, a, 1.8));
    parts.push(svgTextBlock(headLines, 72, headTop + headSize - 4, { fill: c.text, size: headSize, weight: 800, lineHeight: headLH }));
    parts.push(svgTextBlock(copyLines, padX, copyY + copySize, { fill: c.muted, size: copySize, weight: 500, lineHeight: copyLH }));
    parts.push(`<line x1="${padX}" y1="${dividerY}" x2="${panelW - padX}" y2="${dividerY}" stroke="${c.panelEdge}"/>`);
    parts.push(`<circle cx="${padX + 4}" cy="${footerY - 4}" r="3" fill="${a}"/>`);
    parts.push(svgText(padX + 14, footerY, source, { fill: c.faint, size: 11.5, weight: 700 }));
    if (p.citation) {
      const cw = 16 + String(p.citation).length * 7.4;
      parts.push(`<rect x="${panelW - cw - padX}" y="${footerY - 15}" width="${cw}" height="22" rx="11" fill="${a}" fill-opacity="0.16"/>`);
      parts.push(svgText(panelW - padX - cw / 2, footerY, String(p.citation), { fill: a, size: 11.5, weight: 800, anchor: "middle" }));
    }
    parts.push(`</g>`);
  });

  // ===== FOOTER =====
  const fy = H - M - footerH;
  parts.push(`<rect x="${M}" y="${fy}" width="${innerW}" height="${footerH}" rx="16" fill="${c.panel}" fill-opacity="0.5" stroke="${c.panelEdge}"/>`);
  parts.push(`<circle cx="${M + 24}" cy="${fy + 26}" r="4" fill="${c.green}"/>`);
  parts.push(svgText(M + 36, fy + 30, "EVIDENCE APPENDIX", { fill: c.green, size: 11.5, weight: 800, spacing: 1.6 }));
  const refs = (payload.evidence_appendix || []).slice(0, 4).map((e) => `${e.citation} ${truncate(e.source_title || "", 26)}`).join("    ");
  parts.push(svgText(M + 36, fy + 52, truncate(refs || "No source references available.", portrait ? 70 : 104), { fill: c.faint, size: 12, weight: 600 }));
  parts.push(svgText(W - M - 18, fy + 42, PRODUCT_NAME, { fill: c.muted, size: 12.5, weight: 800, anchor: "end" }));

  parts.push(`</svg>`);
  return parts.join("");
}

function infographicPalette(style) {
  const base = {
    bg0: "#080b0a", bg1: "#0d100e",
    panel: "#161b18", panelEdge: "#243029",
    text: "#f3f7f2", muted: "#aeb9b2", faint: "#7f8c84",
    green: "#13d075",
    accents: ["#13d075", "#7bd3f0", "#c9e36b", "#f0a2c0", "#b6a4ff", "#7fd4c2", "#f0b483", "#9db9f0"],
  };
  if (style === "executive-brief") {
    return { ...base, accents: ["#c9e36b", "#7bd3f0", "#13d075", "#f0a2c0", "#7fd4c2", "#b6a4ff"] };
  }
  if (style === "study-map") {
    return { ...base, bg0: "#08090f", bg1: "#0d0f17", panel: "#161827", panelEdge: "#262a3d",
      accents: ["#b6a4ff", "#7bd3f0", "#13d075", "#f0b483", "#f0a2c0", "#c9e36b"] };
  }
  return base;
}

function wrapSvgText(text, maxChars, maxLines) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = truncate(lines[maxLines - 1], Math.max(8, maxChars - 1));
  }
  return lines;
}

function escapeXml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function bibliography(citations) {
  return [...new Map(citations.map((citation) => [citation.source_id, citation])).values()].map((citation) => ({
    source_id: citation.source_id,
    title: citation.source_title,
  }));
}

function buildFlashcardPlan(options = {}) {
  const countPreset = Object.hasOwn(FLASHCARD_COUNT_PRESETS, options.count_preset)
    ? options.count_preset
    : Object.hasOwn(FLASHCARD_COUNT_PRESETS, options.countPreset)
      ? options.countPreset
      : "standard";
  const explicitCount = Number(options.count || options.card_count || options.cardCount || 0);
  const requestedDifficulty = String(options.difficulty || "mixed").toLowerCase();
  const difficulty = FLASHCARD_DIFFICULTIES.has(requestedDifficulty) ? requestedDifficulty : "mixed";
  const requestedTypes = Array.isArray(options.card_types)
    ? options.card_types
    : Array.isArray(options.cardTypes)
      ? options.cardTypes
      : FLASHCARD_CARD_TYPES;
  const cardTypes = requestedTypes.filter((type) => FLASHCARD_CARD_TYPES.includes(type));
  return {
    countPreset,
    count: Math.min(24, Math.max(3, Number.isFinite(explicitCount) && explicitCount > 0 ? explicitCount : FLASHCARD_COUNT_PRESETS[countPreset])),
    difficulty,
    cardTypes: cardTypes.length ? cardTypes : FLASHCARD_CARD_TYPES,
    topic: truncate(String(options.topic || options.focus || "").trim(), 120),
    language: truncate(String(options.language || "English").trim(), 60),
    audience: truncate(String(options.audience || "general").trim(), 80),
  };
}

function flashcardDifficultyForIndex(difficulty, index) {
  if (difficulty !== "mixed") return difficulty;
  if (index < 3) return "easy";
  if (index < 7) return "medium";
  return "hard";
}

function buildQuizQuestions(keyPoints, citations, options = {}) {
  const requestedCount = Number(options.question_count || options.count || 6);
  const questionCount = Math.min(12, Math.max(3, Number.isFinite(requestedCount) ? requestedCount : 6));
  const pool = keyPoints.length ? keyPoints : citations.slice(0, questionCount).map((citation) => ({
    text: bestSentenceForQuestion(citation.quote, citation.source_title || ""),
    citation: citation.citation,
    source_refs: [sourceRefsFromEvidence(citation)],
  }));
  return pool.slice(0, questionCount).map((point, index) => {
    const sentence = stripCitations(point.text);
    const citation = citations[index % Math.max(1, citations.length)] || {};
    const topic = titleCase(topicFromSentence(sentence));
    const sourceTitle = citation.source_title || "the active source";
    const correctIndex = index % 4;
    const learningGoal = quizLearningGoal(sentence, index);
    const distractors = quizDistractors({ sentence, topic, sourceTitle, index });
    const optionsList = insertCorrectOption(distractors, sentence, correctIndex);
    const sourceRefs = Array.isArray(point.source_refs) ? point.source_refs : [point.source_refs].filter(Boolean);
    return {
      id: `quiz-${index + 1}`,
      type: "multiple_choice",
      learning_goal: learningGoal,
      question: quizQuestionText({ topic, sourceTitle, index }),
      options: optionsList,
      correct_index: correctIndex,
      correct_answer: sentence,
      explanation: `${sentence} ${point.citation}`,
      distractor_rationales: optionsList.map((option, optionIndex) =>
        optionIndex === correctIndex
          ? "This option restates the cited Evidence Pack passage."
          : quizDistractorRationale(option, topic),
      ),
      evidence_quote: truncate(citation.quote || sentence, 420),
      source_refs: sourceRefs,
      citation: point.citation,
      difficulty: quizDifficulty(sentence, index),
      tags: inferTags(sentence),
    };
  });
}

function quizQuestionText({ topic, sourceTitle, index }) {
  return [
    `Which statement is directly supported by ${sourceTitle} about ${topic}?`,
    `What should a strict citation verifier accept about ${topic}?`,
    `Which takeaway best matches the cited evidence from ${sourceTitle}?`,
    `Which option stays inside the active sources on ${topic}?`,
  ][index % 4];
}

function quizLearningGoal(sentence, index) {
  const topic = topicFromSentence(sentence);
  return [
    `Recall the cited claim about ${topic}.`,
    `Separate source-grounded evidence from unsupported generalization about ${topic}.`,
    `Identify the safest briefing takeaway about ${topic}.`,
  ][index % 3];
}

function quizDifficulty(sentence, index) {
  const tokenCount = tokenize(sentence).length;
  if (index > 5 || tokenCount > 26) return "hard";
  if (index > 2 || tokenCount > 16) return "medium";
  return "easy";
}

function quizDistractors({ topic, sourceTitle, index }) {
  const scoped = [
    `The active sources do not establish a source-grounded conclusion about ${topic}.`,
    `${sourceTitle} is only useful as background and should not be cited for ${topic}.`,
    `A general model-memory answer is sufficient because ${topic} does not need source evidence.`,
    `The cited passage should be ignored when producing an artifact about ${topic}.`,
  ];
  const audit = [
    `The best answer would avoid citations to keep the artifact easier to read.`,
    `The source evidence supports every possible interpretation of ${topic}.`,
    `The notebook should treat unstated assumptions about ${topic} as verified facts.`,
    `The answer should prefer fluent synthesis over direct support from the cited passage.`,
  ];
  return [...scoped.slice(index % scoped.length), ...audit].slice(0, 3);
}

function quizDistractorRationale(option, topic) {
  if (/general model-memory|unstated assumptions/i.test(option)) {
    return `This is not source-grounded; the quiz is checking only what the active evidence supports about ${topic}.`;
  }
  if (/avoid citations|ignored|not be cited/i.test(option)) {
    return "This conflicts with source-only artifact rules because factual claims need citations.";
  }
  return `This overstates or denies the cited evidence for ${topic}.`;
}

function insertCorrectOption(distractors, correct, correctIndex) {
  const options = [...distractors.slice(0, 3)];
  options.splice(correctIndex, 0, correct);
  return options.slice(0, 4);
}

function topicFromSentence(sentence) {
  const terms = topTerms(sentence, 3).map((item) => item.term);
  return terms.length ? terms.join(" ") : "evidence";
}

function titleCase(text) {
  return String(text)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sanitizeFileName(name) {
  return String(name || "file").replace(/[^a-z0-9._-]/gi, "-").slice(0, 120);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapeRegExp(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncate(input, maxLength) {
  const clean = String(input || "").replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trim()}...` : clean;
}

function statusError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isDefaultNotebookTitle(title) {
  const value = String(title || "").trim();
  return (
    value === "" ||
    value === "Untitled notebook" ||
    value === "SourceStudio Demo Notebook" ||
    value === PRODUCT_NAME
  );
}

// Normalize a model's raw title output: take the first non-empty line, strip wrapping
// quotes/markdown/trailing punctuation, and reject sentence-length blobs (refusals etc.).
function cleanNotebookTitle(raw) {
  if (!raw) return "";
  let title = String(raw)
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) || "";
  title = title
    .replace(/^["'`*#\s]+/, "")
    .replace(/["'`*\s]+$/, "")
    .replace(/[.;:,]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return "";
  if (title.split(" ").length > 10) return "";
  if (title.length > 80) title = title.slice(0, 80).trim();
  return title;
}

function fallbackNotebookTitle(sources) {
  const first = sources[0];
  if (!first) return "";
  const base = String(first.title || "")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base ? truncate(base, 60) : "";
}
