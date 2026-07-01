import { promisify } from "node:util";
import { brotliCompress, brotliDecompress, constants as zlibConstants } from "node:zlib";

const brotliCompressAsync = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);
const COMPRESSED_VALUE_MARKER = "br-json-v1";
const COMPRESS_MIN_BYTES = 512 * 1024;

// Durable key/value store backed by Supabase Postgres. Used to persist auth
// (users + sessions) and the engine state across Cloud Run restarts/redeploys —
// the container filesystem is ephemeral, so anything stored only on disk is lost
// on every deploy (which is why sessions and notebooks disappeared).
export function createDurableStore({ env = process.env, logger } = {}) {
  const url = String(env.SUPABASE_DB_URL || "").trim();
  if (!url) {
    return {
      enabled: false,
      async get() {
        return null;
      },
      async set() {},
      async ready() {},
    };
  }

  const queryTimeoutMs = positiveNumber(env.SOURCESTUDIO_DURABLE_QUERY_TIMEOUT_MS, 15000);
  let poolPromise = null;
  let readyPromise = null;

  async function getPool() {
    if (!poolPromise) {
      poolPromise = import("pg").then(({ default: pg }) => {
        const pool = new pg.Pool({
          connectionString: url,
          max: 3,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: Math.min(queryTimeoutMs, 8000),
          query_timeout: queryTimeoutMs,
          statement_timeout: queryTimeoutMs,
          idle_in_transaction_session_timeout: queryTimeoutMs,
        });
        pool.on("error", (error) =>
          logger?.warn?.("kv.pool.error", { error: String(error?.message || error).slice(0, 160) }),
        );
        return pool;
      });
    }
    return poolPromise;
  }

  async function ready() {
    if (!readyPromise) {
      readyPromise = (async () => {
        const pool = await getPool();
        await pool.query(
          "create table if not exists app_kv (key text primary key, value jsonb not null, updated_at timestamptz not null default now())",
        );
      })().catch((error) => {
        readyPromise = null;
        throw error;
      });
    }
    return readyPromise;
  }

  async function get(key) {
    try {
      await ready();
      const pool = await getPool();
      const result = await pool.query("select value from app_kv where key = $1", [key]);
      return decodeValue(result.rows[0]?.value ?? null);
    } catch (error) {
      logger?.warn?.("kv.get.failed", { key, error: String(error?.message || error).slice(0, 160) });
      return null;
    }
  }

  async function set(key, value) {
    try {
      await ready();
      const pool = await getPool();
      const storedValue = await encodeValue(value);
      await pool.query(
        "insert into app_kv(key, value, updated_at) values($1, $2, now()) on conflict (key) do update set value = excluded.value, updated_at = now()",
        [key, storedValue],
      );
      return true;
    } catch (error) {
      logger?.warn?.("kv.set.failed", { key, error: String(error?.message || error).slice(0, 160) });
      return false;
    }
  }

  return { enabled: true, get, set, ready };
}

async function encodeValue(value) {
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) < COMPRESS_MIN_BYTES) return value;
  const compressed = await brotliCompressAsync(Buffer.from(json), {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
    },
  });
  return {
    __ssai_compressed: COMPRESSED_VALUE_MARKER,
    data: compressed.toString("base64"),
  };
}

async function decodeValue(value) {
  if (!value || typeof value !== "object") return value;
  if (value.__ssai_compressed !== COMPRESSED_VALUE_MARKER || typeof value.data !== "string") return value;
  const decompressed = await brotliDecompressAsync(Buffer.from(value.data, "base64"));
  return JSON.parse(decompressed.toString("utf8"));
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
