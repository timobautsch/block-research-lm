import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createAuthStore } from "../server/sourcestudio/auth-store.js";
import { createSourceStudioEngine } from "../server/sourcestudio/engine.js";

async function withEngine(fn, env = {}) {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-test-"));
  const engine = await createSourceStudioEngine({
    root: resolve("."),
    storageDir: dir,
    stateFile: join(dir, "state.json"),
    env: {
      SOURCESTUDIO_VIDEO_TTS: "false",
      ...env,
    },
  });
  try {
    await fn(engine);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withRerankerEngine(fn) {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-reranker-test-"));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    const body = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: body.documents.map((_, index) => ({
          index,
          relevance_score: index === 0 ? 0.95 : 0.25,
        })),
      }),
    };
  };
  const engine = await createSourceStudioEngine({
    root: resolve("."),
    storageDir: dir,
    stateFile: join(dir, "state.json"),
    env: {
      COHERE_API_KEY: "test-cohere-token",
      COHERE_RERANK_MODEL: "rerank-v4.0-pro",
      RERANK_PROVIDER: "cohere",
      RERANK_WEIGHT: "1",
      SOURCESTUDIO_VIDEO_TTS: "false",
    },
    fetchImpl,
  });
  try {
    await fn(engine, calls);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withProviderEngine(fn) {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-provider-test-"));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              abstained: false,
              answer_markdown: "- SourceStudio uses Evidence Packs to make retrieval auditable. [1]",
              citations: [{ index: 1, evidence_id: "E1" }],
            }),
          },
        ],
      }),
    };
  };
  const engine = await createSourceStudioEngine({
    root: resolve("."),
    storageDir: dir,
    stateFile: join(dir, "state.json"),
    env: {
      ANTHROPIC_API_KEY: "test-provider-token",
      ANTHROPIC_MODEL: "test-claude-model",
      DEFAULT_REASONING_PROVIDER: "anthropic",
    },
    fetchImpl,
  });
  try {
    await fn(engine, calls);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withArtifactProviderEngine(fn) {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-artifact-provider-test-"));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              title: "Provider Executive Brief",
              abstract: ["SourceStudio uses Evidence Packs to make retrieval auditable before generation. [1]"],
              scope: ["This report is limited to the active grounding source. [1]"],
              methodology: ["The report uses cited evidence from the retrieved source block. [1]"],
              executive_summary: [
                "SourceStudio uses Evidence Packs to make retrieval auditable. [1]",
                "Citation Ledgers verify answer claims against cited source blocks. [1]",
                "The report remains limited to the active evidence. [1]",
              ],
              key_points: [
                {
                  text: "SourceStudio uses Evidence Packs to make retrieval auditable. [1]",
                  citation: "[1]",
                },
              ],
              key_findings: [
                {
                  heading: "Auditable evidence layer",
                  text: "SourceStudio uses Evidence Packs to make retrieval auditable. [1]",
                  analysis: "The cited source establishes the evidence layer as the basis for artifact generation. [1]",
                  citation: "[1]",
                },
              ],
              detailed_sections: [
                {
                  heading: "Evidence layer",
                  body: "The cited source says Evidence Packs make retrieval auditable. [1]",
                },
              ],
              open_questions: ["Which retrieval metrics should be exposed next?"],
              risks_limitations: ["The brief is limited to the active source evidence. [1]"],
              bibliography: ["[1] Grounding source"],
            }),
          },
        ],
      }),
    };
  };
  const engine = await createSourceStudioEngine({
    root: resolve("."),
    storageDir: dir,
    stateFile: join(dir, "state.json"),
    env: {
      ANTHROPIC_API_KEY: "test-provider-token",
      ANTHROPIC_MODEL: "test-claude-model",
      ANTHROPIC_ARTIFACT_MODEL: "test-claude-artifact-model",
      DEFAULT_ARTIFACT_PROVIDER: "anthropic",
    },
    fetchImpl,
  });
  try {
    await fn(engine, calls);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withYouTubeKitProviderEngine(fn, providerPayload) {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-youtube-provider-test-"));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          {
            text: JSON.stringify(providerPayload),
          },
        ],
      }),
    };
  };
  const engine = await createSourceStudioEngine({
    root: resolve("."),
    storageDir: dir,
    stateFile: join(dir, "state.json"),
    env: {
      ANTHROPIC_API_KEY: "test-provider-token",
      ANTHROPIC_MODEL: "test-claude-model",
      ANTHROPIC_ARTIFACT_MODEL: "test-claude-artifact-model",
      DEFAULT_ARTIFACT_PROVIDER: "anthropic",
      SOURCESTUDIO_VIDEO_TTS: "false",
    },
    fetchImpl,
  });
  try {
    await fn(engine, calls);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withAudioEngine(fn) {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-audio-test-"));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(Buffer.from("fake-mp3-audio"), {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    });
  };
  const engine = await createSourceStudioEngine({
    root: resolve("."),
    storageDir: dir,
    stateFile: join(dir, "state.json"),
    env: {
      ELEVENLABS_API_KEY: "test-provider-token",
      ELEVENLABS_VOICE_ID_HOST_A: "voice-a",
      ELEVENLABS_VOICE_ID_HOST_B: "voice-b",
      ELEVENLABS_MODEL: "eleven_v3",
    },
    fetchImpl,
  });
  try {
    await fn(engine, calls);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withVideoElevenLabsEngine(fn) {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-video-elevenlabs-test-"));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(tinyWavBuffer(), {
      status: 200,
      headers: { "content-type": "audio/wav" },
    });
  };
  const engine = await createSourceStudioEngine({
    root: resolve("."),
    storageDir: dir,
    stateFile: join(dir, "state.json"),
    env: {
      ELEVENLABS_API_KEY: "test-provider-token",
      ELEVENLABS_VOICE_ID_VIDEO: "voice-video",
      ELEVENLABS_VIDEO_MODEL: "eleven_multilingual_v2",
      SOURCESTUDIO_VIDEO_IMAGE_PROVIDER: "local",
    },
    fetchImpl,
  });
  try {
    await fn(engine, calls);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withAudioScriptProviderEngine(fn) {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-audio-script-provider-test-"));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              title: "Provider Audio Overview",
              mode: "Critique",
              episode_format: "two-host source-grounded critique",
              episode_outline: ["Evidence", "Risk", "Next question"],
              transcript: [
                {
                  host: "Host A",
                  text: "The source-backed implementation claim is that Evidence Packs make retrieval auditable.",
                  citation_ids: ["E1"],
                  voice_direction: "clear setup",
                },
                {
                  host: "Host B",
                  text: "The critique is that citation verification still has to prove each displayed claim.",
                  citation_ids: ["E1"],
                  voice_direction: "analytical response",
                },
              ],
              tts_directives: {
                pace: "measured",
                tone: "analytical",
              },
            }),
          },
        ],
      }),
    };
  };
  const engine = await createSourceStudioEngine({
    root: resolve("."),
    storageDir: dir,
    stateFile: join(dir, "state.json"),
    env: {
      ANTHROPIC_API_KEY: "test-provider-token",
      ANTHROPIC_MODEL: "test-claude-model",
      SOURCESTUDIO_AUDIO_SCRIPT_PROVIDER: "anthropic",
    },
    fetchImpl,
  });
  try {
    await fn(engine, calls);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function tinyWavBuffer(seconds = 1, sampleRate = 8000) {
  const sampleCount = Math.max(1, Math.floor(seconds * sampleRate));
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

async function waitForCondition(predicate, { attempts = 80, intervalMs = 25, message = "Timed out waiting for condition." } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await predicate();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  if (lastError) throw lastError;
  assert.fail(message);
}

async function withAuthStore(fn) {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-auth-test-"));
  const store = createAuthStore({
    root: resolve("."),
    env: {
      AUTH_DB_PATH: join(dir, "auth.sqlite"),
      AUTH_EXPOSE_RESET_TOKEN: "true",
      NODE_ENV: "test",
    },
  });
  try {
    await fn(store);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("creates accounts, sessions, and password reset tokens in the auth database", async () => {
  await withAuthStore(async (store) => {
    const user = store.createUser({
      name: "Research User",
      email: "research@example.com",
      password: "SourceStudio123!",
    });
    assert.equal(user.email, "research@example.com");

    const login = store.loginUser({ email: "research@example.com", password: "SourceStudio123!" });
    assert.equal(login.id, user.id);

    const session = store.createSession(user.id, { userAgent: "node-test" });
    const hydratedSession = store.getSession(session.token);
    assert.equal(hydratedSession.user.id, user.id);

    const reset = store.requestPasswordReset({ email: "research@example.com" });
    assert.ok(reset.reset_token);
    const resetUser = store.resetPassword({ token: reset.reset_token, password: "NewSourceStudio123!" });
    assert.equal(resetUser.id, user.id);
    assert.equal(store.getSession(session.token), null);

    const secondLogin = store.loginUser({ email: "research@example.com", password: "NewSourceStudio123!" });
    assert.equal(secondLogin.id, user.id);
  });
});

test("ingests markdown into blocks, chunks, and knowledge objects", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Parser test" });
    const source = await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Architecture source",
      body: "# SourceStudio\n\nSourceStudio uses Evidence Packs and Citation Ledgers for grounded answers.\n\n## Retrieval\n\nHybrid retrieval combines keyword search, vector search, and entity filters.",
    });
    assert.equal(source.status, "indexed");
    assert.ok(source.block_count >= 3);
    assert.ok(source.chunk_count >= 1);
    const hydrated = engine.getNotebook(notebook.id);
    assert.ok(hydrated.knowledge.some((object) => object.type === "notebook_summary"));
  });
});

test("generates notebook-specific suggested questions instead of demo prompts", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Prop firm documents" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Payout rules",
      body: "# Payout Rules\n\nProp firm challenge documents describe drawdown limits, payout timing, account verification, and execution evidence.",
    });

    const questions = engine.getNotebook(notebook.id).suggested_questions;
    assert.ok(questions.length >= 3);
    assert.match(questions.join(" "), /Payout rules|active sources|material/i);
    assert.doesNotMatch(questions.join(" "), /Block Research AI|trading-bot|automation themes/i);

    engine._state().knowledgeObjects.push({
      id: "legacy-demo-suggestions",
      notebook_id: notebook.id,
      source_id: "",
      type: "suggested_questions",
      data: {
        questions: [
          "What does Block Research AI appear to offer across the website and blog sources?",
          "Which trading-bot and automation themes appear most often in the sources?",
        ],
      },
      created_at: new Date().toISOString(),
    });

    const migratedQuestions = engine.getNotebook(notebook.id).suggested_questions;
    assert.doesNotMatch(migratedQuestions.join(" "), /Block Research AI|trading-bot|automation themes/i);
    assert.match(migratedQuestions.join(" "), /Payout rules|active sources|material/i);
  });
});

test("deferred source ingest returns before background indexing completes", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Deferred ingest test" });
    const body = Array.from({ length: 220 }, (_, index) =>
      `## Section ${index + 1}\n\nDeferred upload should create the source card first, then extract, chunk, embed, and build source knowledge in the background.`,
    ).join("\n\n");
    const source = await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Deferred source",
      body,
      defer_indexing: true,
    });
    assert.equal(source.status, "parsing");
    assert.notEqual(source.metadata_json.ingest_stage, "indexed");

    let indexedSource = null;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const current = engine.getNotebook(notebook.id).sources.find((item) => item.id === source.id);
      if (current?.status === "indexed") {
        indexedSource = current;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(indexedSource);
    assert.equal(indexedSource.metadata_json.ingest_stage, "indexed");
    assert.ok(indexedSource.chunk_count >= 1);
  });
});

test("persists every deferred source in a concurrent upload batch", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-concurrent-ingest-test-"));
  const stateFile = join(dir, "state.json");
  const env = {
    SOURCESTUDIO_INGEST_CONCURRENCY: "3",
    SOURCESTUDIO_VIDEO_TTS: "false",
  };
  try {
    const engine = await createSourceStudioEngine({
      root: resolve("."),
      storageDir: dir,
      stateFile,
      env,
    });
    const notebook = await engine.createNotebook({ title: "Concurrent ingest test" });
    const totalSources = 24;
    const expectedTitles = Array.from({ length: totalSources }, (_, index) =>
      `Batch upload source ${String(index + 1).padStart(2, "0")}`,
    );

    const accepted = await Promise.all(
      expectedTitles.map((title, index) =>
        engine.ingestSource(notebook.id, {
          type: "markdown",
          title,
          body: [
            `# ${title}`,
            "Concurrent deferred uploads should keep every accepted source visible and persisted.",
            `Source number ${index + 1} includes a unique persistence marker for reload verification.`,
            "The indexing pipeline extracts blocks, chunks them, embeds them, and stores source knowledge.",
          ].join("\n\n"),
          defer_indexing: true,
        }),
      ),
    );

    assert.equal(accepted.length, totalSources);
    assert.equal(engine.getNotebook(notebook.id).sources.length, totalSources);

    await waitForCondition(
      () => {
        const sources = engine.getNotebook(notebook.id).sources;
        return sources.length === totalSources && sources.every((source) => source.status === "indexed");
      },
      { attempts: 160, intervalMs: 25, message: "Concurrent sources did not finish indexing." },
    );

    const persistedSources = await waitForCondition(
      async () => {
        const saved = JSON.parse(await readFile(stateFile, "utf8"));
        const sources = saved.sources.filter((source) => source.notebook_id === notebook.id);
        return sources.length === totalSources && sources.every((source) => source.status === "indexed") ? sources : null;
      },
      { attempts: 160, intervalMs: 25, message: "Concurrent sources were not fully persisted." },
    );
    assert.deepEqual(
      persistedSources.map((source) => source.title).sort(),
      expectedTitles.slice().sort(),
    );

    const reloadedEngine = await createSourceStudioEngine({
      root: resolve("."),
      storageDir: dir,
      stateFile,
      env,
    });
    const reloadedNotebook = reloadedEngine.getNotebook(notebook.id);
    assert.equal(reloadedNotebook.sources.length, totalSources);
    assert.deepEqual(
      reloadedNotebook.sources.map((source) => source.title).sort(),
      expectedTitles.slice().sort(),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("hybrid semantic chunking splits topic shifts before the token target", async () => {
  await withEngine(async (engine) => {
    const source = {
      id: "source_semantic_chunking",
      notebook_id: "notebook_semantic_chunking",
      title: "Semantic chunking source",
    };
    const musicParagraph = [
      "Acoustic guitar performance depends on rhythm, melody, live dynamics, percussion patterns, stage timing, and audience energy.",
      "The duo layers bass notes, hi hat textures, chord accents, festival arrangements, and improvisational transitions without laptop loops.",
      "Rehearsal focuses on tempo discipline, guitar technique, pickup balance, soundcheck routines, and expressive live phrasing.",
    ].join(" ");
    const contractParagraph = [
      "Construction contract disputes depend on acceptance, defect notices, cure deadlines, evidentiary records, payment maturity, and damages limits.",
      "The legal analysis tracks warranty rights, burden of proof, remediation periods, documented defects, and remuneration after refused acceptance.",
      "Settlement planning focuses on written notices, inspection logs, contractual milestones, mitigation duties, and enforceable repair demands.",
    ].join(" ");
    const body = [
      musicParagraph,
      musicParagraph,
      musicParagraph,
      contractParagraph,
      contractParagraph,
      contractParagraph,
    ].join("\n\n");
    const blocks = engine._internals.parseMarkdownBlocks(source, body);
    const chunks = engine._internals.chunkDocument(source.notebook_id, source, blocks);

    assert.ok(chunks.length >= 2);
    assert.equal(chunks[0].metadata_json.chunking_strategy, "hybrid_semantic");
    assert.ok(chunks.some((chunk) => chunk.metadata_json.semantic_boundary_reason === "semantic_shift"));
    assert.match(chunks[0].text, /Acoustic guitar performance/);
    assert.doesNotMatch(chunks[0].text, /Construction contract disputes/);
    assert.match(chunks.at(-1).text, /Construction contract disputes/);
  }, { CHUNKING_STRATEGY: "hybrid" });
});

test("does not retrieve binary PDF fallback text", async () => {
  await withEngine(async (engine) => {
    const binaryPdfText = [
      "%PDF-1.4",
      "% created by Pillow 11.2.1 PDF driver",
      "1 0 obj << /Type /XObject /Subtype /Image /Filter /DCTDecode /Length 9999 /ColorSpace /DeviceRGB >>",
      "stream",
      `${"\xff\xd8\xff\xe0JFIF\u0000".repeat(80)}${"A\u0001B\u0002C\u0003".repeat(120)}${"\u00c2\u00be".repeat(260)}`,
      "endstream",
      "endobj",
      "xref",
      "trailer << /Root 1 0 R >>",
    ].join("\n");
    assert.equal(engine._internals.isLikelyGarbledExtraction(binaryPdfText), true);

    const extracted = await engine._internals.extractPdfText(Buffer.from(binaryPdfText, "latin1"));
    assert.equal(extracted.parser, "pdf-unreadable");
    assert.doesNotMatch(extracted.text, /DCTDecode|JFIF|%PDF|Pillow/);

    const notebook = await engine.createNotebook({ title: "Bad PDF test" });
    const source = await engine.ingestSource(notebook.id, {
      type: "pdf",
      title: "Scanned statement",
      file_name: "statement.pdf",
      mime_type: "application/pdf",
      base64: Buffer.from(binaryPdfText, "latin1").toString("base64"),
    }, { sync: true });
    assert.equal(source.metadata_json.parser, "pdf-unreadable");
    assert.equal(source.word_count, 0);

    const evidencePack = await engine._internals.buildEvidencePack({
      notebook_id: notebook.id,
      question: "What does the scanned statement say?",
    });
    assert.equal(evidencePack.citations_available, false);
    assert.equal(evidencePack.evidence_items.length, 0);

    const response = await engine.askChat({
      notebook_id: notebook.id,
      question: "What does the scanned statement say?",
    });
    assert.equal(response.message.mode, "abstained");
    assert.doesNotMatch(response.content, /DCTDecode|JFIF|%PDF|Pillow|\u00c2\u00be/);
    assert.match(response.content, /cannot answer/i);
  });
});

test("answers supported questions with citations and a citation ledger", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Chat test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Grounding source",
      body: "# Grounding\n\nSourceStudio uses Evidence Packs to make retrieval auditable. Citation Ledgers verify each answer claim against cited source blocks.",
    });
    const response = await engine.askChat({
      notebook_id: notebook.id,
      question: "What does SourceStudio use to make retrieval auditable?",
    });
    assert.match(response.content, /Evidence Packs/i);
    assert.ok(response.citations.length >= 1);
    assert.equal(response.grounding.unsupported, 0);
    const ledger = engine.getCitationLedger(response.message.id);
    assert.ok(ledger.entries.length >= 1);
  });
});

test("reranks hybrid retrieval candidates through Cohere when configured", async () => {
  await withRerankerEngine(async (engine, calls) => {
    const notebook = await engine.createNotebook({ title: "Reranker test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Hybrid retrieval source",
      body: "# Hybrid Retrieval\n\nHybrid search first gathers BM25, keyword, entity, and vector candidates before evidence selection.",
    });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Reranker source",
      body: "# Reranking\n\nA reranker reads candidate passages and promotes the evidence that most directly answers the query before the Evidence Pack is built.",
    });

    const response = await engine.askChat({
      notebook_id: notebook.id,
      question: "How does the reranker improve hybrid search?",
    });

    assert.equal(engine.providerStatus().reranker.provider, "cohere");
    assert.equal(engine.providerStatus().reranker.model, "rerank-v4.0-pro");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /cohere\.com\/v2\/rerank/);
    assert.equal(calls[0].options.headers.authorization, "Bearer test-cohere-token");
    const payload = JSON.parse(calls[0].options.body);
    assert.equal(payload.model, "rerank-v4.0-pro");
    assert.ok(payload.documents.length >= 1);
    assert.ok(response.evidence_pack.retrieved_items.some((item) => item.ranking_signals.reranker_provider === "cohere"));
    assert.ok(response.evidence_pack.evidence_items.some((item) => item.ranking_signals.reranker_model === "rerank-v4.0-pro"));
  });
});

test("keeps translated provider answers instead of nuking them as unsupported", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-translate-test-"));
  // Provider returns the takeaways translated to Azerbaijani — zero token
  // overlap with the German source quotes, which used to get every claim
  // marked unsupported and the whole answer replaced by a forced abstention.
  const providerAnswer = {
    abstained: false,
    answer_markdown:
      "Əsas nəticələr: Aurora Hydrogen 2019-cu ildə Hamburqda qurulub [1]. Elektrolizerin səmərəliliyi 74 faizdir [1].",
    citations: [{ index: 1, evidence_id: "E1" }],
  };
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ text: JSON.stringify(providerAnswer) }] }),
  });
  const engine = await createSourceStudioEngine({
    root: resolve("."),
    storageDir: dir,
    stateFile: join(dir, "state.json"),
    env: {
      ANTHROPIC_API_KEY: "test-provider-token",
      ANTHROPIC_MODEL: "test-claude-model",
      SOURCESTUDIO_VIDEO_TTS: "false",
    },
    fetchImpl,
  });
  try {
    const notebook = await engine.createNotebook({ title: "Übersetzung" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Aurora Dossier",
      body: "# Aurora\n\nAurora Hydrogen wurde 2019 in Hamburg gegründet. Der Elektrolyseur erreicht 74 Prozent Effizienz.",
    });
    const response = await engine.askChat({
      notebook_id: notebook.id,
      question: "Übersetze die wichtigsten Key-Takeaways auf Aserbaidschanisch.",
    });
    assert.equal(response.message.mode, "grounded");
    assert.ok(response.message.content.includes("Əsas nəticələr"), "translated content must survive verification");
    assert.ok(response.citations.length >= 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("collection questions expose every source via overview evidence", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Podcast collection" });
    const episodes = [
      ["Trading Unscripted Episode 1", "Wir sprechen über Risikomanagement und Positionsgrößen im täglichen Trading Alltag."],
      ["Trading Unscripted Episode 2", "Das Interview behandelt Marktzyklen, Emotionen und die Psychologie hinter Verlustserien."],
      ["Trading Unscripted Episode 3", "Diese Folge erklärt automatisierte Strategien, Backtesting und den Umgang mit Slippage."],
    ];
    for (const [title, body] of episodes) {
      await engine.ingestSource(notebook.id, {
        type: "youtube",
        title,
        original_url: `https://www.youtube.com/watch?v=ep${episodes.findIndex((e) => e[0] === title)}0000000`,
        body: `# YouTube transcript\n\n${body}`,
      });
    }
    const response = await engine.askChat({
      notebook_id: notebook.id,
      question: "Über was wird in den Podcasts gesprochen?",
    });
    // The evidence pack must cover the whole collection: every source appears
    // either via retrieved chunks or via a synthetic source-overview item.
    const evidencedSources = new Set(response.evidence_pack.evidence_items.map((item) => item.source_id));
    assert.equal(evidencedSources.size, 3);
    // And the collection question must not be answered with an abstention that
    // claims there is no podcast information.
    assert.equal(response.message.mode, "grounded");
  });
});

test("imports the latest channel videos as individual YouTube sources", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-youtube-batch-test-"));
  const channelVideos = [
    { video_id: "vid00000001", title: "Grid bots explained", url: "https://www.youtube.com/watch?v=vid00000001" },
    { video_id: "vid00000002", title: "Backtesting deep dive", url: "https://www.youtube.com/watch?v=vid00000002" },
    { video_id: "vid00000003", title: "Portfolio rebalancing", url: "https://www.youtube.com/watch?v=vid00000003" },
  ];
  // Serves the two fetch shapes the caption path needs: a watch page whose
  // captionTracks point at timedtext, and the json3 track itself.
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target.includes("/api/timedtext")) {
      const videoId = /v=([^&]+)/.exec(target)?.[1] || "unknown";
      const words = `Transcript for ${videoId}: grid trading strategies, backtests, and portfolio risk in practice.`;
      return new Response(JSON.stringify({ events: [{ segs: [{ utf8: words }] }] }), { status: 200 });
    }
    const videoId = /v=([^&]+)/.exec(target)?.[1] || "unknown";
    const html = `<html>"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=${videoId}\\u0026lang=en","languageCode":"en"}],"audioTracks"</html>`;
    return new Response(html, { status: 200 });
  };
  const engine = await createSourceStudioEngine({
    root: resolve("."),
    storageDir: dir,
    stateFile: join(dir, "state.json"),
    env: { SOURCESTUDIO_VIDEO_TTS: "false", SOURCESTUDIO_DISABLE_YTDLP: "1" },
    fetchImpl,
    expandYouTubeChannelImpl: async (channelUrl, count) => ({
      channel_title: "Test Channel",
      videos: channelVideos.slice(0, count),
    }),
  });
  try {
    const notebook = await engine.createNotebook({ title: "Channel batch" });
    const batch = await engine.ingestYouTubeChannel(notebook.id, {
      channel_url: "https://www.youtube.com/@testchannel",
      count: 3,
    });
    assert.equal(batch.channel_title, "Test Channel");
    assert.equal(batch.queued, 3);
    assert.equal(batch.skipped_existing, 0);
    assert.equal(batch.sources.length, 3);
    // Sources index asynchronously through the bounded ingest queue.
    for (let i = 0; i < 100; i += 1) {
      const view = engine.getNotebook(notebook.id);
      const youtubeSources = view.sources.filter((source) => source.type === "youtube");
      if (youtubeSources.length === 3 && youtubeSources.every((source) => source.status === "indexed")) break;
      assert.ok(!youtubeSources.some((source) => source.status === "failed"), "no batch source should fail");
      await new Promise((resolvePoll) => setTimeout(resolvePoll, 100));
    }
    const view = engine.getNotebook(notebook.id);
    const titles = view.sources.map((source) => source.title);
    assert.ok(titles.includes("Grid bots explained"));
    assert.ok(titles.includes("Backtesting deep dive"));
    assert.ok(view.sources.every((source) => source.status === "indexed"));
    // Re-importing the same channel must dedupe against existing video sources.
    const rerun = await engine.ingestYouTubeChannel(notebook.id, {
      channel_url: "https://www.youtube.com/@testchannel",
      count: 3,
    });
    assert.equal(rerun.queued, 0);
    assert.equal(rerun.skipped_existing, 3);
    // The schema caps the batch size at 50.
    await assert.rejects(
      engine.ingestYouTubeChannel(notebook.id, { channel_url: "https://www.youtube.com/@testchannel", count: 99 }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("prints full active video transcript when explicitly requested", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Transcript test" });
    await engine.ingestSource(notebook.id, {
      type: "youtube",
      title: "TradingView automation walkthrough",
      original_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      body: [
        "# YouTube transcript",
        "",
        "[0:00] Today we are saying goodbye to three commas in Europe.",
        "[0:12] We have been building a better and simpler alternative.",
        "[1:58] For automated trading strategies from a pine script you need an intermediate layer.",
        "[5:41] The log is more detailed and does not stop after five entries.",
        "[7:01] Go to settings and start with the Signal Pipe secret.",
      ].join("\n"),
    });
    const response = await engine.askChat({
      notebook_id: notebook.id,
      question: "Poste mir bitte das komplette Videoskript.",
    });
    assert.match(response.content, /Today we are saying goodbye to three commas/i);
    assert.match(response.content, /Signal Pipe secret/i);
    assert.doesNotMatch(response.content, /Based on the active sources/i);
    assert.equal(response.provider, "local");
    assert.equal(response.model, "local-source-text-v1");
    assert.equal(response.grounding.unsupported, 0);
    assert.ok(response.citations.length >= 1);
  });
});

test("routes grounded answers through a configured server-side provider", async () => {
  await withProviderEngine(async (engine, calls) => {
    const notebook = await engine.createNotebook({ title: "Provider test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Grounding source",
      body: "# Grounding\n\nSourceStudio uses Evidence Packs to make retrieval auditable. Citation Ledgers verify each answer claim against cited source blocks.",
    });
    const response = await engine.askChat({
      notebook_id: notebook.id,
      question: "What does SourceStudio use to make retrieval auditable?",
    });
    assert.match(response.content, /Evidence Packs/i);
    assert.equal(response.provider, "anthropic");
    assert.equal(response.model, "test-claude-model");
    assert.equal(response.grounding.unsupported, 0);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /anthropic\.com\/v1\/messages/);
    const runs = engine.listModelRuns();
    assert.equal(runs[0].provider, "anthropic");
    assert.equal(runs[0].role, "grounded_answer");
    assert.equal(runs[0].status, "completed");
  });
});

test("abstains when active sources do not support the question", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Abstention test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Grounding source",
      body: "# Grounding\n\nCitations should point to real source blocks.",
    });
    const response = await engine.askChat({
      notebook_id: notebook.id,
      question: "What will the weather be in Berlin tomorrow?",
    });
    assert.equal(response.message.mode, "abstained");
    assert.equal(response.citations.length, 0);
  });
});

test("abstains on off-topic questions even when retrieval returns evidence", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Off-topic abstention" });
    // Content-rich source: top-k retrieval WILL return evidence items for any
    // question, so this exercises the relevance gate in the local answer path
    // instead of the empty-evidence-pack abstention.
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Aurora Hydrogen Dossier",
      body: [
        "# Aurora Hydrogen GmbH",
        "",
        "Aurora Hydrogen GmbH wurde 2019 in Hamburg gegründet und beschäftigt 42 Mitarbeiter.",
        "Der Elektrolyseur des Unternehmens erreicht eine Effizienz von 74 Prozent im Dauerbetrieb.",
        "Die Series B über 38 Millionen Euro wurde 2025 von Verdane angeführt.",
        "Das Unternehmen plant den Ausbau der Produktionskapazität auf 200 Megawatt bis 2027.",
        "Wichtige Kunden kommen aus der Stahl- und Chemieindustrie in Norddeutschland.",
      ].join("\n"),
    });
    const offTopic = await engine.askChat({
      notebook_id: notebook.id,
      question: "Was ist die Hauptstadt von Australien?",
    });
    assert.equal(offTopic.message.mode, "abstained");
    assert.equal(offTopic.citations.length, 0);
    // Referencing the collection must not smuggle an off-topic question past
    // the gate ("laut den Quellen" / "according to the sources").
    const framedOffTopic = await engine.askChat({
      notebook_id: notebook.id,
      question: "Was ist laut den Quellen die Hauptstadt von Australien?",
    });
    assert.equal(framedOffTopic.message.mode, "abstained");
    assert.equal(framedOffTopic.citations.length, 0);
    // A genuinely grounded question must still pass the relevance gate.
    const grounded = await engine.askChat({
      notebook_id: notebook.id,
      question: "Wie effizient ist der Elektrolyseur von Aurora Hydrogen?",
    });
    assert.equal(grounded.message.mode, "grounded");
    assert.ok(grounded.message.content.includes("74"));
    assert.ok(grounded.citations.length >= 1);
  });
});

test("generates all required source-backed Studio artifacts", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Artifact test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Artifact source",
      body: "# Artifact Source\n\nReports, mind maps, flashcards, quizzes, data tables, slide decks, audio scripts, and video storyboards should carry source references. Reports should not be TLDR or short bullet lists.",
    });
    for (const type of ["report", "mindmap", "flashcards", "quiz", "data-table", "slide-deck", "audio", "video", "infographic"]) {
      const response = await engine.createArtifact({ notebook_id: notebook.id, type, options: {} });
      assert.equal(response.job.status, "completed");
      assert.equal(response.artifact.type, type);
      assert.ok(response.artifact.source_refs_json.length >= 1, `${type} should include source refs`);
      assert.equal(response.artifact.content_json.evidence_audit.status, "passed", `${type} should pass evidence audit`);
      assert.equal(response.artifact.content_json.evidence_audit.evidence_pack_id, response.evidence_pack.id);
      assert.ok(response.artifact.content_json.evidence_audit.cited_evidence_items >= 1, `${type} should cite evidence`);
      assert.ok(response.artifact.content_json.evidence_audit.source_coverage > 0, `${type} should cite at least one retrieved source`);
      assert.equal(response.artifact.content_json.evidence_audit.invalid_citation_count, 0, `${type} should not cite invalid evidence`);
      assert.ok(response.artifact.content_json.evidence_audit.top_sources.length >= 1, `${type} should expose source audit details`);
      if (type === "report") {
        assert.ok(response.artifact.content_json.executive_summary.length >= 3, "report should include an executive summary");
        assert.ok(response.artifact.content_json.abstract.length >= 1, "report should include an abstract");
        assert.ok(response.artifact.content_json.scope.length >= 1, "report should define scope");
        assert.ok(response.artifact.content_json.methodology.length >= 1, "report should define methodology");
        assert.equal("tldr" in response.artifact.content_json, false, "report should not include a tldr field");
        assert.ok(response.artifact.content_json.detailed_sections.length >= 5, "report should include long-form sections");
        assert.match(response.artifact.text_content, /## Executive Summary/);
        assert.match(response.artifact.text_content, /## Scope and Method/);
        assert.match(response.artifact.text_content, /## Principal Findings/);
        assert.doesNotMatch(response.artifact.text_content, /TL\s*;?\s*DR/i);
        assert.match(response.artifact.text_content, /## Recommendations/);
        assert.ok(response.artifact.text_content.length > 2500, "report export should be substantive");
      }
      if (type === "slide-deck") {
        assert.equal(response.artifact.content_json.render_status, "rendered_svg_pptx");
        assert.ok(response.artifact.content_json.slides.every((slide) => /^<svg/.test(slide.svg_markup)));
        assert.match(response.artifact.content_json.pptx_url, /\/api\/artifacts\/.+\/media/);
        const media = engine.getArtifactMedia(response.artifact.id);
        assert.equal(media.content_type, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
        assert.match(media.file_name, /\.pptx$/);
        const pptxBytes = await readFile(media.path);
        assert.equal(pptxBytes.subarray(0, 2).toString("utf8"), "PK");
      }
    }
  });
});

test("sanitizes legacy report artifacts for client reads", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Legacy report test" });
    engine._state().artifacts.push({
      id: "artifact_legacy_report",
      notebook_id: notebook.id,
      type: "report",
      title: "Legacy Report",
      content_json: {
        title: "Legacy Report",
        executive_summary: ["This legacy report still contains TLDR wording. [1]"],
        tldr: ["Old short summary. [1]"],
        key_findings: [{ heading: "Finding 1", text: "Legacy reports should be formal. [1]", citation: "[1]" }],
        detailed_sections: [{ heading: "Evidence audit", body: ["Internal audit details. [1]"] }],
        recommendations: [],
        open_questions: [],
        risks_limitations: [],
        bibliography: [],
      },
      text_content: "## TLDR\nOld short summary.",
      file_path: "",
      source_refs_json: [],
      model_runs_json: [],
      created_at: new Date().toISOString(),
    });

    const clientArtifact = engine.getNotebook(notebook.id).artifacts.find((artifact) => artifact.id === "artifact_legacy_report");
    assert.ok(clientArtifact, "legacy report should be returned to the client");
    assert.equal("tldr" in clientArtifact.content_json, false, "legacy report client payload should not include tldr");
    assert.doesNotMatch(clientArtifact.text_content, /TL\s*;?\s*DR/i);
    assert.match(clientArtifact.text_content, /## Scope and Method/);
  });
});

test("deletes Studio outputs individually and in batches", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Delete outputs test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Delete source",
      body: "# Delete Source\n\nEvidence Packs keep generated reports, quizzes, and flashcards grounded in active source evidence.",
    });
    const report = await engine.createArtifact({ notebook_id: notebook.id, type: "report", options: {} });
    const flashcards = await engine.createArtifact({ notebook_id: notebook.id, type: "flashcards", options: { count: 6 } });
    assert.equal(engine.getNotebook(notebook.id).artifacts.length, 2);

    const single = await engine.deleteArtifact(report.artifact.id);
    assert.equal(single.deleted, 1);
    assert.equal(engine.getNotebook(notebook.id).artifacts.length, 1);
    assert.throws(() => engine.getArtifact(report.artifact.id), /Artifact not found/);
    await assert.rejects(() => stat(report.artifact.file_path));

    const deckId = flashcards.artifact.content_json.deck_id;
    assert.ok(engine._state().flashcardDecks.some((deck) => deck.id === deckId));
    const batch = await engine.deleteNotebookArtifacts(notebook.id);
    assert.equal(batch.deleted, 1);
    assert.equal(engine.getNotebook(notebook.id).artifacts.length, 0);
    assert.equal(engine._state().flashcardDecks.some((deck) => deck.id === deckId), false);
    assert.equal(engine._state().flashcards.some((card) => card.artifact_id === flashcards.artifact.id), false);
  });
});

test("generates synthesized multi-level mind maps instead of quote labels", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Werkvertrag Mängel und Vergütungsstreit" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Werkvertrag Fallnotizen",
      body: [
        "# Ausgangslage",
        "",
        "Der Besteller rügt Mängel an der Werkleistung und verweigert deshalb die Abnahme.",
        "Die Vergütung wird erst fällig, wenn die Abnahme erfolgt oder rechtlich entbehrlich ist.",
        "Vor einer Minderung oder einem Schadensersatzanspruch muss die Nacherfüllung mit angemessener Frist geprüft werden.",
        "E-Mails, Abnahmeprotokolle und Fotos sichern die Beweisführung zum Mangel und zur Vergütung.",
        "Offen bleibt, ob der Unternehmer die Mängel bestritten oder eine Nachbesserung angeboten hat.",
      ].join("\n"),
    });

    const response = await engine.createArtifact({ notebook_id: notebook.id, type: "mindmap", options: {} });
    const mindMap = response.artifact.content_json;
    const labels = mindMap.nodes.map((node) => node.label);
    const root = mindMap.nodes.find((node) => node.type === "notebook");
    const firstLevel = mindMap.edges
      .filter((edge) => edge.source === root.id)
      .map((edge) => mindMap.nodes.find((node) => node.id === edge.target))
      .filter(Boolean);
    const childMap = new Map();
    for (const edge of mindMap.edges) {
      if (!childMap.has(edge.source)) childMap.set(edge.source, []);
      childMap.get(edge.source).push(edge.target);
    }
    const depth = (nodeId, current = 0) => Math.max(current, ...(childMap.get(nodeId) || []).map((childId) => depth(childId, current + 1)));

    assert.equal(response.job.status, "completed");
    assert.ok(mindMap.nodes.length >= 8);
    assert.ok(firstLevel.length >= 2);
    assert.ok(depth(root.id) >= 2);
    assert.ok(labels.some((label) => /Mängelrechte|Vergütung|Abnahme|Beweisführung/.test(label)));
    assert.ok(labels.some((label) => /Abnahme steuert Fälligkeit|Nacherfüllung zuerst prüfen|Belege systematisch sichern|Klärungsbedarf markieren/.test(label)));
    assert.ok(mindMap.nodes.every((node) => node.type === "notebook" || String(node.label).length <= 68));
    assert.ok(mindMap.nodes.every((node) => !/\[\d+\]|\d{1,2}:\d{2}/.test(String(node.label))));
    assert.ok(labels.every((label) => !/Der Besteller rügt Mängel an der Werkleistung/i.test(label)));
  });
});

test("keeps mind maps focused on the notebook topic when sources are noisy", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "ENYP Guitar-Duo Live Techno" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "enypguitarduo.com",
      body: [
        "# ENYP Guitar-Duo Live Techno",
        "",
        "Das ENYP Guitar-Duo spielt Akustik-Techno live mit zwei Gitarren, ohne Laptop und ohne Loops.",
        "Kick, Bass, Hi-Hat und Melodie entstehen über selbst gebaute Gitarrentechnik, 10 Tonabnehmer und große Pedalboards.",
        "Das Duo ist buchbar für Festivals, Clubs, Corporate Events und private Veranstaltungen.",
        "Veranstalter finden EPK, Technical Rider und Pressefotos als Booking-Unterlagen.",
      ].join("\n"),
    });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "format_pdf",
      body: "SEC Chair Gary Gensler discussed Nasdaq approval, Bitcoin ETF comments, and market structure concerns.",
    });

    const response = await engine.createArtifact({ notebook_id: notebook.id, type: "mindmap", options: {} });
    const mindMap = response.artifact.content_json;
    const labels = mindMap.nodes.map((node) => node.label).join(" ");

    assert.equal(response.job.status, "completed");
    assert.ok(/Live-Konzept|Sound & Technik|Auftritte & Booking|Profil & Stil/.test(labels));
    assert.ok(/Zwei Gitarren live|Gitarren erzeugen das Setup|Buchbar für Shows|Booking-Unterlagen verfügbar/.test(labels));
    assert.equal(/SEC Chair|Nasdaq|Bitcoin|format[_\s-]pdf/i.test(labels), false);
    assert.equal(mindMap.nodes.some((node) => node.type === "claim"), false);
  });
});

test("renders Video Overview as playable MP4 media", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Video test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Video source",
      body: "# Video Source\n\nVideo overviews should turn cited Evidence Pack passages into a rendered MP4 with captions, scenes, narration metadata, and source references.",
    });
    const response = await engine.createArtifact({ notebook_id: notebook.id, type: "video", options: {} });
    assert.equal(response.job.status, "completed");
    assert.equal(response.artifact.type, "video");
    assert.equal(response.artifact.content_json.render_status, "rendered_mp4");
    assert.equal(response.artifact.content_json.video_status, "rendered");
    assert.match(response.artifact.content_json.video_url, /\/api\/artifacts\/.+\/media/);
    assert.match(response.artifact.content_json.video_file_name, /\.mp4$/);
    assert.ok(response.artifact.content_json.video_duration_seconds > 0);
    assert.ok(response.artifact.content_json.storyboard.length >= 1);
    const media = engine.getArtifactMedia(response.artifact.id);
    assert.equal(media.content_type, "video/mp4");
    assert.match(media.file_name, /\.mp4$/);
    const savedVideo = await stat(media.path);
    assert.ok(savedVideo.size > 1000);
  });
});

test("renders Video Overview narration through ElevenLabs TTS", async () => {
  await withVideoElevenLabsEngine(async (engine, calls) => {
    const notebook = await engine.createNotebook({ title: "Video voice test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Voice source",
      body: "# Voice Source\n\nVideo overviews should use high-quality narration while the visual track stays image-led, cartoon-like, and free of dense text slides.",
    });
    const response = await engine.createArtifact({ notebook_id: notebook.id, type: "video", options: {} });
    assert.equal(response.job.status, "completed");
    assert.equal(response.artifact.content_json.video_status, "rendered");
    assert.equal(response.artifact.content_json.video_narration_status, "rendered_elevenlabs");
    assert.equal(response.artifact.content_json.video_tts_provider, "elevenlabs");
    assert.equal(response.artifact.content_json.video_visual_status, "rendered_local_cartoon");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /elevenlabs\.io\/v1\/text-to-speech\/voice-video/);
    const body = JSON.parse(calls[0].options.body);
    assert.match(body.text, /Video voice test/i);
    const media = engine.getArtifactMedia(response.artifact.id);
    assert.equal(media.content_type, "video/mp4");
  });
});

test("creates interactive flashcard decks with reviews, missed practice, and source refs", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Flashcard deck test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Learning source",
      body: [
        "# Learning Source",
        "",
        "Evidence Packs preserve retrieved passages, source ids, block ids, and constraints so generated answers remain auditable.",
        "Citation Ledgers check each answer claim against cited Evidence Pack passages before the answer is shown.",
        "Flashcards should test a single source-backed concept and should keep explanations tied to the source quote.",
      ].join("\n"),
    });
    const response = await engine.createArtifact({
      notebook_id: notebook.id,
      type: "flashcards",
      options: {
        topic: "Evidence Packs",
        difficulty: "hard",
        count: 8,
        card_types: ["concept", "application", "cloze", "caveat", "source-check", "compare"],
      },
    });
    assert.equal(response.artifact.type, "flashcards");
    assert.ok(response.artifact.content_json.deck_id);
    assert.ok(response.artifact.content_json.cards.length >= 3);

    const deck = await engine.getFlashcardDeckForArtifact(response.artifact.id);
    assert.equal(deck.id, response.artifact.content_json.deck_id);
    assert.ok(deck.cards.length >= 3);
    assert.equal(deck.progress.total, deck.cards.length);
    assert.equal(response.artifact.content_json.progress.total, deck.cards.length);
    assert.equal(deck.options_json.difficulty, "hard");
    assert.ok(deck.cards.every((card) => card.source_refs.length >= 1));
    assert.ok(deck.cards.every((card) => ["supported", "partially_supported"].includes(card.support_level)));

    const reviewed = await engine.recordFlashcardReview(deck.id, {
      card_id: deck.cards[0].id,
      result: "missed",
      session_id: "unit-test",
    });
    assert.equal(reviewed.progress.missed, 1);
    assert.equal(reviewed.cards[0].review_state, "missed");
    const reviewedArtifact = engine.getArtifact(response.artifact.id);
    assert.equal(reviewedArtifact.content_json.progress.missed, 1);
    assert.equal(reviewedArtifact.content_json.cards[0].review_state, "missed");

    const adapted = await engine.createAdaptiveFlashcards(deck.id, { limit: 1 });
    assert.ok(adapted.cards.length > reviewed.cards.length);
    assert.ok(adapted.cards.some((card) => card.tags.includes("adaptive")));
    assert.equal(engine.getArtifact(response.artifact.id).content_json.cards.length, adapted.cards.length);

    const reset = await engine.resetFlashcardDeck(deck.id);
    assert.equal(reset.progress.reviewed, 0);
    assert.equal(reset.progress.missed, 0);

    const deleted = await engine.deleteFlashcard(deck.id, reset.cards[0].id);
    assert.equal(deleted.progress.total, reset.progress.total - 1);
    const savedPayload = JSON.parse(await readFile(response.artifact.file_path, "utf8"));
    assert.equal(savedPayload.progress.total, deleted.progress.total);
    assert.equal(savedPayload.cards.length, deleted.cards.length);
  });
});

test("builds flashcards as learning questions instead of quote-only cards", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Signal Pipe flashcards" });
    await engine.ingestSource(notebook.id, {
      type: "youtube",
      title: "TradingView Signal Pipe setup",
      body: [
        "# Transcript",
        "",
        "And from there, you would create not a [10:35] watch list alert, but a single alert on Vin Premium 1 second time frame.",
        "You cannot send TradingView strategy signals directly to your broker for automated trading, so you need an intermediate signal forwarder.",
        "In the TradingView alert, paste the Signal Pipe webhook URL and the alert message.",
      ].join("\n"),
    });
    const response = await engine.createArtifact({
      notebook_id: notebook.id,
      type: "flashcards",
      options: {
        topic: "Signal Pipe",
        count: 4,
        card_types: ["concept", "application", "caveat", "source-check"],
      },
    });
    const deck = await engine.getFlashcardDeckForArtifact(response.artifact.id);
    assert.ok(deck.cards.length >= 3);
    assert.ok(deck.cards.every((card) => /\?$/.test(card.question)));
    assert.ok(deck.cards.every((card) => !/And from there|watch list alert, but a single alert/.test(card.question)));
    assert.ok(deck.cards.some((card) => /single alert|intermediate forwarder|webhook/i.test(card.answer)));
    assert.ok(deck.cards.every((card) => !card.answer.startsWith("And from there")));
  });
});

test("routes Studio artifact generation through a configured provider with local citation control", async () => {
  await withArtifactProviderEngine(async (engine, calls) => {
    const notebook = await engine.createNotebook({ title: "Artifact provider test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Grounding source",
      body: "# Grounding\n\nSourceStudio uses Evidence Packs to make retrieval auditable. Citation Ledgers verify each answer claim against cited source blocks.",
    });
    const response = await engine.createArtifact({
      notebook_id: notebook.id,
      type: "report",
      options: { report_type: "Executive Brief" },
    });
    assert.equal(response.job.status, "completed");
    assert.equal(response.artifact.title, "Provider Executive Brief");
    assert.equal(response.artifact.content_json.generation_provider, "anthropic");
    assert.equal(response.artifact.content_json.generation_model, "test-claude-artifact-model");
    assert.equal(response.artifact.content_json.generation_fallback_reason, "");
    assert.ok(response.artifact.content_json.citations.length >= 1);
    assert.equal(response.artifact.content_json.evidence_audit.status, "passed");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /anthropic\.com\/v1\/messages/);
    const runs = engine.listModelRuns();
    assert.ok(runs.some((run) => run.provider === "anthropic" && run.role === "artifact_generation" && run.status === "completed"));
  });
});

test("keeps YouTube publish kits in English and rejects off-topic provider drift", async () => {
  await withYouTubeKitProviderEngine(async (engine, calls) => {
    const notebook = await engine.createNotebook({ title: "Prop Firm Trading Challenges" });
    await engine.ingestSource(notebook.id, {
      type: "youtube",
      title: "Prop firm risk workflow",
      body: [
        "# YouTube transcript",
        "",
        "[0:00] Prop firm traders must understand challenge rules before taking risk.",
        "[1:30] The core workflow is maximum daily loss, drawdown limits, payout timing, and account verification.",
        "[4:00] A trader should document executions, certificates, payout screenshots, and risk controls.",
        "[7:00] Passing a challenge is not enough if the prop firm rules invalidate the payout later.",
      ].join("\n"),
    });

    const response = await engine.createArtifact({
      notebook_id: notebook.id,
      type: "youtube-kit",
      options: {},
    });
    const kit = response.artifact.content_json;
    const combined = `${kit.titles.join(" ")} ${kit.description} ${kit.chapters.map((chapter) => chapter.label).join(" ")}`;

    assert.equal(response.job.status, "completed");
    assert.equal(kit.language, "English");
    assert.match(kit.warning, /rejected because it did not match/i);
    assert.match(combined, /Prop Firm Trading Challenges|prop firm|challenge|risk|drawdown/i);
    assert.doesNotMatch(combined, /sérülés|futás|térded|bemelegítés|futó/i);
    assert.equal(calls.length, 1);
    const providerRequest = JSON.parse(calls[0].options.body);
    assert.match(providerRequest.messages[0].content, /Write every title.*English/i);
  }, {
    titles: [
      "10 sérülés, ami minden hobbifutót utolér",
      "Futósérülések: ezt csináld, mielőtt fáj a térded",
      "A futás rejtett veszélyei",
      "Miért fáj futás után?",
      "Kezdő futó vagy?",
    ],
    description: "Fáj a térded, a bokád vagy a lábszárad futás után? Ebben a videóban végigvesszük a futósérüléseket.",
    chapters: [
      { time: "0:00", label: "Bevezető" },
      { time: "1:30", label: "A leggyakoribb futósérülések" },
      { time: "4:00", label: "Miért alakulnak ki?" },
    ],
    tags: ["futás", "sérülés", "térd"],
  });
});

test("generates a rendered source-grounded infographic SVG", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Infographic test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Infographic source",
      body: "# Infographic Source\n\nInfographics should turn cited Evidence Pack passages into short visual panels. Each panel should keep citations visible and include a source-backed evidence appendix.",
    });
    const response = await engine.createArtifact({
      notebook_id: notebook.id,
      type: "infographic",
      options: {
        orientation: "landscape",
        detail_level: "balanced",
        visual_style: "evidence-dashboard",
      },
    });
    assert.equal(response.job.status, "completed");
    assert.equal(response.artifact.type, "infographic");
    assert.match(response.artifact.file_path, /\.svg$/);
    assert.equal(response.artifact.content_json.render_status, "rendered_svg");
    assert.match(response.artifact.content_json.svg_markup, /^<svg/);
    assert.ok(response.artifact.content_json.panels.length >= 1);
    assert.equal(response.artifact.content_json.evidence_audit.status, "passed");
    assert.ok(response.artifact.content_json.evidence_audit.cited_evidence_items >= 1);
    assert.ok(response.artifact.content_json.evidence_audit.item_citation_coverage >= 0.8);
    const savedSvg = await readFile(response.artifact.file_path, "utf8");
    assert.match(savedSvg, /SOURCE-GROUNDED INFOGRAPHIC/);
  });
});

test("generates generic audio overview scripts with requested controls", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Policy review" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Governance notes",
      body: "# Governance Notes\n\nEvidence Packs make retrieval auditable by preserving source blocks, chunk IDs, and citations.\n\n## Risks\n\nCitation verification should check each displayed claim before an answer or artifact is trusted.\n\n## Follow-up\n\nThe implementation team should measure source coverage, unsupported claims, and review latency.",
    });
    const response = await engine.createArtifact({
      notebook_id: notebook.id,
      type: "audio",
      options: {
        format: "critique",
        length: "short",
        language: "German",
        prompt: "Focus on implementation risk and auditability.",
      },
    });
    const payload = response.artifact.content_json;
    assert.equal(payload.mode, "Critique");
    assert.equal(payload.language, "German");
    assert.equal(payload.length, "Shorter");
    assert.ok(payload.transcript.length >= 4);
    assert.ok(payload.quality_checks.cited_turns >= 1);
    assert.ok(payload.source_coverage.evidence_items >= 1);
    assert.doesNotMatch(JSON.stringify(payload.transcript), /trading|bot|website crawl/i);
    const runs = engine.listModelRuns();
    assert.ok(runs.some((run) => run.provider === "local" && run.role === "audio_script" && run.status === "completed"));
  });
});

test("uses configured provider for audio script generation and maps citation ids", async () => {
  await withAudioScriptProviderEngine(async (engine, calls) => {
    const notebook = await engine.createNotebook({ title: "Provider audio" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Evidence operations",
      body: "# Evidence Operations\n\nEvidence Packs make retrieval auditable by preserving source blocks and citations. Citation verification checks displayed claims against cited source blocks.",
    });
    const response = await engine.createArtifact({
      notebook_id: notebook.id,
      type: "audio",
      options: {
        format: "critique",
      },
    });
    const payload = response.artifact.content_json;
    assert.equal(payload.title, "Provider Audio Overview");
    assert.equal(payload.generation.script_provider, "anthropic");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /api\.anthropic\.com\/v1\/messages/);
    assert.ok(payload.transcript[0].text.endsWith("[1]"));
    assert.equal(payload.transcript[0].citations[0].evidence_id, "E1");
  });
});

test("renders audio overview media when ElevenLabs is configured", async () => {
  await withAudioEngine(async (engine, calls) => {
    const notebook = await engine.createNotebook({ title: "Audio test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Audio source",
      body: "# Audio Source\n\nAudio overviews should turn source-backed evidence into a two-host briefing while keeping source references visible.",
    });
    const response = await engine.createArtifact({ notebook_id: notebook.id, type: "audio", options: {} });
    assert.equal(response.job.status, "completed");
    assert.equal(response.artifact.content_json.evidence_audit.status, "passed");
    assert.ok(response.artifact.content_json.evidence_audit.item_citation_coverage >= 0.8);
    assert.equal(response.artifact.content_json.audio_status, "rendered");
    assert.match(response.artifact.content_json.audio_url, /\/api\/artifacts\/.+\/media/);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /elevenlabs\.io\/v1\/text-to-dialogue/);
    const media = engine.getArtifactMedia(response.artifact.id);
    assert.equal(media.content_type, "audio/mpeg");
    const runs = engine.listModelRuns();
    assert.ok(runs.some((run) => run.provider === "elevenlabs" && run.role === "audio_script" && run.status === "completed"));
  });
});
