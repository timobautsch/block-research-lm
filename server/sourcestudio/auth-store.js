import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";

// Must be "__session" so Firebase Hosting forwards it to the Cloud Run backend
// (Firebase strips every other cookie name when proxying through its CDN).
export const SESSION_COOKIE_NAME = "__session";

const PASSWORD_KEY_LENGTH = 64;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const RESET_TTL_MS = 1000 * 60 * 30;

export function createAuthStore(options = {}) {
  const root = options.root || process.cwd();
  const env = options.env || process.env;
  const dbPath = resolve(env.AUTH_DB_PATH || join(root, ".data", "sourcestudio", "auth.sqlite"));

  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT NOT NULL DEFAULT '',
      ip_hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
  `);

  function createUser(input = {}) {
    const email = normalizeEmail(input.email);
    const name = normalizeName(input.name, email);
    const password = validatePassword(input.password);
    const existing = findUserByEmail(email);
    if (existing) throw authError(409, "An account with this email already exists.");

    const timestamp = now();
    const credentials = hashPassword(password);
    const user = {
      id: id("user"),
      email,
      name,
      password_hash: credentials.hash,
      password_salt: credentials.salt,
      created_at: timestamp,
      updated_at: timestamp,
      last_login_at: null,
    };

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, password_salt, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.email,
      user.name,
      user.password_hash,
      user.password_salt,
      user.created_at,
      user.updated_at,
      user.last_login_at,
    );

    return publicUser(user);
  }

  function loginUser(input = {}) {
    const email = normalizeEmail(input.email);
    const password = String(input.password || "");
    const user = findUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      throw authError(401, "Email or password is incorrect.");
    }
    const timestamp = now();
    db.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(timestamp, timestamp, user.id);
    return publicUser({ ...user, last_login_at: timestamp, updated_at: timestamp });
  }

  function createSession(userId, metadata = {}) {
    const user = findUserById(userId);
    if (!user) throw authError(404, "Account not found.");

    const token = randomToken();
    const timestamp = now();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_hash, created_at, expires_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      id("session"),
      user.id,
      hashToken(token),
      String(metadata.userAgent || "").slice(0, 240),
      metadata.ipHash || "",
      timestamp,
      expiresAt,
    );

    return {
      token,
      expires_at: expiresAt,
      user: publicUser(user),
    };
  }

  function getSession(token) {
    if (!token) return null;
    const row = db.prepare(`
      SELECT
        sessions.id AS session_id,
        sessions.expires_at,
        sessions.revoked_at,
        users.id,
        users.email,
        users.name,
        users.created_at,
        users.updated_at,
        users.last_login_at
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
      LIMIT 1
    `).get(hashToken(token));

    if (!row || row.revoked_at || Date.parse(row.expires_at) <= Date.now()) return null;
    return {
      session: {
        id: row.session_id,
        expires_at: row.expires_at,
      },
      user: publicUser(row),
    };
  }

  function revokeSession(token) {
    if (!token) return;
    db.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").run(now(), hashToken(token));
  }

  function requestPasswordReset(input = {}) {
    const email = normalizeEmail(input.email);
    const user = findUserByEmail(email);
    if (!user) {
      return { ok: true, delivery: "not-disclosed" };
    }

    const token = randomToken();
    const timestamp = now();
    const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
    db.prepare(`
      INSERT INTO password_resets (id, user_id, token_hash, created_at, expires_at, used_at)
      VALUES (?, ?, ?, ?, ?, NULL)
    `).run(id("reset"), user.id, hashToken(token), timestamp, expiresAt);

    const exposeToken = env.AUTH_EXPOSE_RESET_TOKEN === "true" || env.NODE_ENV !== "production";
    return {
      ok: true,
      delivery: exposeToken ? "local-development-response" : "email-provider",
      expires_at: expiresAt,
      reset_token: exposeToken ? token : undefined,
    };
  }

  function resetPassword(input = {}) {
    const token = String(input.token || "").trim();
    const password = validatePassword(input.password);
    if (!token) throw authError(400, "Reset token is required.");

    const reset = db.prepare(`
      SELECT password_resets.id, password_resets.user_id, password_resets.expires_at, password_resets.used_at
      FROM password_resets
      WHERE password_resets.token_hash = ?
      LIMIT 1
    `).get(hashToken(token));

    if (!reset || reset.used_at || Date.parse(reset.expires_at) <= Date.now()) {
      throw authError(400, "Password reset link is invalid or expired.");
    }

    const credentials = hashPassword(password);
    const timestamp = now();
    db.prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?").run(
      credentials.hash,
      credentials.salt,
      timestamp,
      reset.user_id,
    );
    db.prepare("UPDATE password_resets SET used_at = ? WHERE id = ?").run(timestamp, reset.id);
    db.prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(timestamp, reset.user_id);

    return publicUser(findUserById(reset.user_id));
  }

  function status() {
    return {
      provider: "node-sqlite",
      database: "local-auth-sqlite",
      storage_path: storageLabel(root, dbPath),
      session_cookie: SESSION_COOKIE_NAME,
    };
  }

  return {
    createUser,
    loginUser,
    createSession,
    getSession,
    revokeSession,
    requestPasswordReset,
    resetPassword,
    status,
  };

  function findUserByEmail(email) {
    return db.prepare("SELECT * FROM users WHERE email = ? LIMIT 1").get(email) || null;
  }

  function findUserById(userId) {
    return db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1").get(userId) || null;
  }
}

export function parseCookies(header = "") {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return cookies;
      const key = decodeURIComponent(part.slice(0, separator).trim());
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      cookies[key] = value;
      return cookies;
    }, {});
}

function cookieIsSecure(env) {
  return env.AUTH_COOKIE_SECURE === "true" || env.NODE_ENV === "production";
}

export function serializeSessionCookie(token, env = process.env) {
  return serializeCookie(SESSION_COOKIE_NAME, token, {
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: cookieIsSecure(env),
  });
}

export function serializeClearSessionCookie(env = process.env) {
  return serializeCookie(SESSION_COOKIE_NAME, "", {
    maxAge: 0,
    secure: cookieIsSecure(env),
  });
}

export function hashClientIp(input = "") {
  if (!input) return "";
  return createHash("sha256").update(String(input)).digest("hex").slice(0, 24);
}

function serializeCookie(name, value, options = {}) {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${options.maxAge}`,
  ];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function normalizeEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw authError(400, "Enter a valid email address.");
  }
  return normalized;
}

function normalizeName(name, email) {
  const clean = String(name || "").replace(/\s+/g, " ").trim();
  if (clean) return clean.slice(0, 120);
  return email.split("@")[0].slice(0, 80);
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 8) throw authError(400, "Password must be at least 8 characters.");
  if (value.length > 200) throw authError(400, "Password is too long.");
  return value;
}

function hashPassword(password) {
  const salt = randomBytes(18).toString("base64url");
  return {
    salt,
    hash: scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("base64url"),
  };
}

function verifyPassword(password, salt, storedHash) {
  const expected = Buffer.from(storedHash, "base64url");
  const actual = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function randomToken() {
  return randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login_at: user.last_login_at || "",
  };
}

function id(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
}

function now() {
  return new Date().toISOString();
}

function storageLabel(root, filePath) {
  const rel = relative(root, filePath);
  return rel.startsWith("..") ? filePath : rel;
}

function authError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
