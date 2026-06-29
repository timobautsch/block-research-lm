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

  let poolPromise = null;
  let readyPromise = null;

  async function getPool() {
    if (!poolPromise) {
      poolPromise = import("pg").then(({ default: pg }) => {
        const pool = new pg.Pool({
          connectionString: url,
          max: 3,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 8000,
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
      })();
    }
    return readyPromise;
  }

  async function get(key) {
    try {
      await ready();
      const pool = await getPool();
      const result = await pool.query("select value from app_kv where key = $1", [key]);
      return result.rows[0]?.value ?? null;
    } catch (error) {
      logger?.warn?.("kv.get.failed", { key, error: String(error?.message || error).slice(0, 160) });
      return null;
    }
  }

  async function set(key, value) {
    try {
      await ready();
      const pool = await getPool();
      await pool.query(
        "insert into app_kv(key, value, updated_at) values($1, $2, now()) on conflict (key) do update set value = excluded.value, updated_at = now()",
        [key, value],
      );
      return true;
    } catch (error) {
      logger?.warn?.("kv.set.failed", { key, error: String(error?.message || error).slice(0, 160) });
      return false;
    }
  }

  return { enabled: true, get, set, ready };
}
