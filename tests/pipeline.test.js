import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createAuthStore } from "../server/sourcestudio/auth-store.js";
import { createSourceStudioEngine } from "../server/sourcestudio/engine.js";

async function withEngine(fn) {
  const dir = await mkdtemp(join(tmpdir(), "sourcestudio-test-"));
  const engine = await createSourceStudioEngine({
    root: resolve("."),
    storageDir: dir,
    stateFile: join(dir, "state.json"),
    env: {},
  });
  try {
    await fn(engine);
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
              tldr: ["SourceStudio uses Evidence Packs to make retrieval auditable. [1]"],
              key_points: [
                {
                  text: "SourceStudio uses Evidence Packs to make retrieval auditable. [1]",
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

test("generates all required source-backed Studio artifacts", async () => {
  await withEngine(async (engine) => {
    const notebook = await engine.createNotebook({ title: "Artifact test" });
    await engine.ingestSource(notebook.id, {
      type: "markdown",
      title: "Artifact source",
      body: "# Artifact Source\n\nReports, mind maps, flashcards, quizzes, data tables, slide decks, audio scripts, and video storyboards should carry source references.",
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
