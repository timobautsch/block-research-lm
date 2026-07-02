import express from "express";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { createSourceStudioEngine } from "./sourcestudio/engine.js";
import {
  SESSION_COOKIE_NAME,
  createAuthStore,
  hashClientIp,
  parseCookies,
  serializeClearSessionCookie,
  serializeSessionCookie,
} from "./sourcestudio/auth-store.js";
import { createDebugLogger } from "./sourcestudio/logger.js";
import { createDurableStore } from "./sourcestudio/durable-store.js";
import { MAX_SOURCE_REQUEST_BODY_BYTES, MAX_SOURCE_UPLOAD_MB } from "./sourcestudio/schemas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 5173);

loadEnvironment();

const logger = createDebugLogger();
const engine = await createSourceStudioEngine({ root, logger });
const durable = createDurableStore({ env: process.env, logger });
const authSnapshot = durable.enabled ? await durable.get("auth_snapshot") : null;
const authStore = createAuthStore({
  root,
  env: process.env,
  // Persist auth in Supabase so logins survive Cloud Run restarts/redeploys.
  snapshot: authSnapshot,
  onChange: () => {
    void durable.set("auth_snapshot", authStore.snapshot());
  },
});
const app = express();

// The large body limit exists only for source uploads (base64 files). Applying
// it to every route — including unauthenticated auth endpoints — lets anyone
// POST hundreds of MB and stall the event loop / exhaust memory. Scope the big
// limit to the two upload routes; everything else gets a small 1 MB cap.
const largeJson = express.json({ limit: MAX_SOURCE_REQUEST_BODY_BYTES });
const smallJson = express.json({ limit: "1mb" });
app.use((req, res, next) => {
  const isUpload = req.method === "POST"
    && (/^\/api\/notebooks\/[^/]+\/sources\/?$/.test(req.path) || req.path === "/api/sources");
  return (isUpload ? largeJson : smallJson)(req, res, next);
});
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(apiRequestLogger);

app.get("/api/health", (_req, res) => {
  const health = engine.health();
  res.json({
    ...health,
    auth: authStore.status(),
    providers: {
      ...health.providers,
      auth_database: authStore.status(),
    },
  });
});

app.get("/api/providers", (_req, res) => {
  res.json({
    ...engine.providerStatus(),
    auth_database: authStore.status(),
  });
});

app.get("/api/auth/session", (req, res) => {
  const session = currentSession(req);
  if (!session) {
    res.json({ authenticated: false, user: null });
    return;
  }
  res.json({ authenticated: true, user: session.user, session: session.session });
});

app.post("/api/auth/signup", asyncHandler(async (req, res) => {
  const user = authStore.createUser(req.body);
  const session = authStore.createSession(user.id, requestMetadata(req));
  res.setHeader("Set-Cookie", serializeSessionCookie(session.token, process.env));
  res.status(201).json({ authenticated: true, user: session.user, session: { expires_at: session.expires_at } });
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const user = authStore.loginUser(req.body);
  const session = authStore.createSession(user.id, requestMetadata(req));
  res.setHeader("Set-Cookie", serializeSessionCookie(session.token, process.env));
  res.json({ authenticated: true, user: session.user, session: { expires_at: session.expires_at } });
}));

app.post("/api/auth/logout", (req, res) => {
  authStore.revokeSession(sessionToken(req));
  res.setHeader("Set-Cookie", serializeClearSessionCookie(process.env));
  res.json({ ok: true });
});

app.post("/api/auth/password-reset", asyncHandler(async (req, res) => {
  res.json(authStore.requestPasswordReset(req.body));
}));

app.post("/api/auth/password-reset/confirm", asyncHandler(async (req, res) => {
  const user = authStore.resetPassword(req.body);
  const session = authStore.createSession(user.id, requestMetadata(req));
  res.setHeader("Set-Cookie", serializeSessionCookie(session.token, process.env));
  res.json({ authenticated: true, user: session.user, session: { expires_at: session.expires_at } });
}));

app.use("/api", requireAuth);

app.post("/api/auth/password", asyncHandler(async (req, res) => {
  const user = authStore.changePassword({
    userId: req.user.id,
    currentPassword: req.body?.current_password,
    newPassword: req.body?.new_password,
    keepSessionToken: sessionToken(req),
  });
  res.json({ ok: true, user });
}));

app.get("/api/debug/status", routeHandler((req) => ({
  debug: engine.debugSnapshot(userContext(req)),
  events: logger.events(req.query.limit || 180),
})));

app.get("/api/notebooks", (_req, res) => {
  res.json({ notebooks: engine.listNotebooks(userContext(_req)) });
});

app.post("/api/notebooks", asyncHandler(async (req, res) => {
  res.status(201).json({ notebook: await engine.createNotebook(req.body, userContext(req)) });
}));

app.get("/api/notebooks/:id", routeHandler((req) => ({
  notebook: engine.getNotebook(req.params.id, userContext(req)),
})));

app.patch("/api/notebooks/:id", asyncHandler(async (req, res) => {
  res.json({ notebook: await engine.renameNotebook(req.params.id, req.body, userContext(req)) });
}));

app.post("/api/notebooks/:id/sources", asyncHandler(async (req, res) => {
  res.status(201).json({ source: await engine.ingestSource(req.params.id, req.body, userContext(req)) });
}));

app.post("/api/notebooks/:id/sources/youtube-batch", asyncHandler(async (req, res) => {
  res.status(201).json(await engine.ingestYouTubeChannel(req.params.id, req.body, userContext(req)));
}));

app.patch("/api/sources/:id/active", asyncHandler(async (req, res) => {
  res.json({ source: await engine.setSourceActive(req.params.id, req.body, userContext(req)) });
}));

app.delete("/api/sources/:id", asyncHandler(async (req, res) => {
  res.json(await engine.deleteSource(req.params.id, userContext(req)));
}));

app.delete("/api/notebooks/:id", asyncHandler(async (req, res) => {
  res.json(await engine.deleteNotebook(req.params.id, userContext(req)));
}));

app.get("/api/sources/:id/blocks", routeHandler((req) => ({
  blocks: engine.getSourceBlocks(req.params.id, userContext(req)),
})));

app.post("/api/chat", asyncHandler(async (req, res) => {
  res.json(await engine.askChat(req.body, userContext(req)));
}));

app.get("/api/messages/:id/citations", routeHandler((req) => ({
  citation_ledger: engine.getCitationLedger(req.params.id, userContext(req)),
})));

app.post("/api/artifacts", asyncHandler(async (req, res) => {
  res.status(201).json(await engine.createArtifact(req.body, userContext(req)));
}));

app.post("/api/artifact", asyncHandler(async (req, res) => {
  const context = userContext(req);
  const notebook = engine.listNotebooks(context)[0] ||
    (await engine.createNotebook({ title: "Artifact notebook" }, context));
  const response = await engine.createArtifact({
    notebook_id: req.body?.notebook_id || notebook.id,
    type: normalizeLegacyArtifactType(req.body?.kind || req.body?.type || "report"),
    options: req.body?.options || {},
  }, { ...context, sync: true });
  res.json({
    title: response.artifact.title,
    subtitle: `Generated by Block Research LM from ${response.evidence_pack.active_source_ids.length} active source(s).`,
    body: response.artifact.text_content,
    artifact: response.artifact,
    job: response.job,
    provider: "local",
    model: "local-grounded-v1",
  });
}));

app.get("/api/artifacts/:id", routeHandler((req) => ({
  artifact: engine.getArtifactForClient(req.params.id, userContext(req)),
})));

app.delete("/api/artifacts/:id", asyncHandler(async (req, res) => {
  res.json(await engine.deleteArtifact(req.params.id, userContext(req)));
}));

app.delete("/api/notebooks/:id/artifacts", asyncHandler(async (req, res) => {
  res.json(await engine.deleteNotebookArtifacts(req.params.id, userContext(req)));
}));

app.get("/api/artifacts/:id/flashcard-deck", asyncHandler(async (req, res) => {
  res.json({ deck: await engine.getFlashcardDeckForArtifact(req.params.id, userContext(req)) });
}));

app.post("/api/flashcard-decks/:id/reviews", asyncHandler(async (req, res) => {
  res.json({ deck: await engine.recordFlashcardReview(req.params.id, req.body, userContext(req)) });
}));

app.post("/api/flashcard-decks/:id/reset", asyncHandler(async (req, res) => {
  res.json({ deck: await engine.resetFlashcardDeck(req.params.id, userContext(req)) });
}));

app.post("/api/flashcard-decks/:id/adaptive", asyncHandler(async (req, res) => {
  res.json({ deck: await engine.createAdaptiveFlashcards(req.params.id, req.body, userContext(req)) });
}));

app.delete("/api/flashcard-decks/:id/cards/:cardId", asyncHandler(async (req, res) => {
  res.json({ deck: await engine.deleteFlashcard(req.params.id, req.params.cardId, userContext(req)) });
}));

app.get("/api/artifacts/:id/media", (req, res, next) => {
  try {
    const media = engine.getArtifactMedia(req.params.id, userContext(req));
    res.type(media.content_type);
    res.setHeader("content-disposition", `inline; filename="${media.file_name}"`);
    res.sendFile(media.path, { dotfiles: "allow" }, (error) => {
      if (error) next(error);
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/jobs/:id", routeHandler((req) => ({
  job: engine.getJob(req.params.id, userContext(req)),
})));

app.get("/api/model-runs", (req, res) => {
  res.json({ model_runs: engine.listModelRuns(userContext(req)) });
});

app.post("/api/seed", asyncHandler(async (req, res) => {
  res.json({ notebook: await engine.seedDemo({ resetFirst: req.body?.reset === true, ownerUserId: req.user.id, requestId: req.requestId }) });
}));

// Unknown /api routes must return a JSON 404, not the SPA HTML with a 200 —
// otherwise a client fetch to a mistyped endpoint silently gets index.html.
app.use("/api", (req, res) => {
  res.status(404).json({ error: `Unknown API route: ${req.method} ${req.path}` });
});

if (isProduction) {
  app.use(express.static(join(root, "dist")));
  app.get(/.*/, (_req, res) => {
    res.sendFile(join(root, "dist", "index.html"));
  });
} else {
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.use((error, req, res, next) => {
  void next;
  // Zod validation failures are client errors; without this they surface as
  // opaque 500s (e.g. POST /sources without a "type" field).
  const isValidationError = error?.name === "ZodError" || Array.isArray(error?.issues);
  const status = Number(error?.status || (isValidationError ? 400 : 500));
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const publicMessage = error?.type === "entity.too.large"
    ? `Uploaded files can be up to ${MAX_SOURCE_UPLOAD_MB} MB.`
    : isValidationError
      ? validationMessage(error)
      : error.message;
  logger.error("http.request.error", {
    request_id: req.requestId,
    method: req.method,
    path: req.path,
    status: safeStatus,
    error: safeStatus === 500 ? "SourceStudio request failed." : publicMessage,
    // Always record the real cause server-side (never sent to the client) so 500s are diagnosable.
    detail: String(error?.message || error).slice(0, 300),
    stack: String(error?.stack || "").split("\n").slice(1, 4).join(" | "),
  });
  res.status(safeStatus).json({
    error: safeStatus === 500 ? "SourceStudio request failed." : publicMessage,
  });
});

const host = process.env.HOST || (isProduction ? "0.0.0.0" : "127.0.0.1");
const server = app.listen(port, host, () => {
  const health = engine.health();
  console.log(
    `Block Research LM running at http://${host}:${port}/ (${health.provider}, storage: ${health.providers.storage_dir})`,
  );
});
// Cloud Run's load balancer keeps idle connections ~60s; a shorter Node
// keep-alive races it and surfaces as random ECONNRESETs on clients.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

// A transient DB-socket error on an idle pg client can slip past the pool's
// error handler and would otherwise take down the whole server (observed as
// "read EADDRNOTAVAIL" killing the process mid-session). State is in memory
// plus persisted snapshots, so logging and continuing is strictly better than
// dying for this single-process server.
process.on("uncaughtException", (error) => {
  logger.error("process.uncaught_exception", {
    error: String(error?.message || error).slice(0, 300),
    stack: String(error?.stack || "").split("\n").slice(1, 5).join(" | "),
  });
});
process.on("unhandledRejection", (reason) => {
  logger.error("process.unhandled_rejection", {
    error: String(reason?.message || reason).slice(0, 300),
    stack: String(reason?.stack || "").split("\n").slice(1, 5).join(" | "),
  });
});

function validationMessage(error) {
  const issue = Array.isArray(error?.issues) ? error.issues[0] : null;
  if (!issue) return "Request validation failed.";
  const path = Array.isArray(issue.path) && issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `Request validation failed. ${path}${issue.message || ""}`.trim();
}

function loadEnvironment() {
  const envPaths = [
    join(root, ".env.local"),
    join(root, ".env"),
  ];

  for (const path of envPaths) {
    if (existsSync(path)) {
      dotenv.config({ path, override: false, quiet: true });
    }
  }
}

function requireAuth(req, res, next) {
  const session = currentSession(req);
  if (!session) {
    res.status(401).json({ error: "Sign in required." });
    return;
  }
  req.user = session.user;
  req.session = session.session;
  next();
}

function apiRequestLogger(req, res, next) {
  if (!req.path.startsWith("/api")) {
    next();
    return;
  }
  const requestId = logger.createId("req");
  const startedAt = Date.now();
  req.requestId = requestId;
  logger.info("http.request.start", {
    request_id: requestId,
    method: req.method,
    path: req.path,
    content_length: Number(req.headers["content-length"] || 0),
  });
  res.on("finish", () => {
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level]("http.request.finish", {
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
      user_id: req.user?.id || "",
    });
  });
  next();
}

function userContext(req) {
  return {
    ownerUserId: req.user.id,
    requestId: req.requestId,
  };
}

function currentSession(req) {
  return authStore.getSession(sessionToken(req));
}

function sessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[SESSION_COOKIE_NAME] || "";
}

function requestMetadata(req) {
  return {
    userAgent: req.get("user-agent") || "",
    ipHash: hashClientIp(req.ip || req.socket?.remoteAddress || ""),
  };
}

function routeHandler(handler) {
  return (req, res, next) => {
    try {
      res.json(handler(req));
    } catch (error) {
      next(error);
    }
  };
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function normalizeLegacyArtifactType(type) {
  return (
    {
      mindmap: "mindmap",
      report: "report",
      flashcards: "flashcards",
      quiz: "quiz",
      audio: "audio",
      video: "video",
      infographic: "infographic",
      table: "data-table",
      slides: "slide-deck",
    }[type] || type
  );
}
