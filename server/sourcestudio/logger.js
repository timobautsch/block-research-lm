import { randomUUID } from "node:crypto";

const DEFAULT_EVENT_LIMIT = 500;
const SECRET_KEY_PATTERN = /(api[_-]?key|authorization|cookie|password|secret|token)/i;

export function createDebugLogger(options = {}) {
  const eventLimit = Number(options.eventLimit || process.env.SOURCESTUDIO_LOG_LIMIT || DEFAULT_EVENT_LIMIT);
  const consoleEnabled = options.consoleEnabled ?? process.env.SOURCESTUDIO_LOGS !== "silent";
  const events = [];

  function createId(prefix = "evt") {
    return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  }

  function record(level, event, details = {}) {
    const entry = {
      id: createId("log"),
      timestamp: new Date().toISOString(),
      level,
      event,
      details: sanitize(details),
    };
    events.push(entry);
    while (events.length > eventLimit) events.shift();

    if (consoleEnabled) {
      const serialized = Object.keys(entry.details).length ? ` ${JSON.stringify(entry.details)}` : "";
      const line = `[${entry.timestamp}] ${level.toUpperCase()} ${event}${serialized}`;
      if (level === "error") console.error(line);
      else if (level === "warn") console.warn(line);
      else console.log(line);
    }
    return entry;
  }

  return {
    createId,
    debug: (event, details) => record("debug", event, details),
    info: (event, details) => record("info", event, details),
    warn: (event, details) => record("warn", event, details),
    error: (event, details) => record("error", event, details),
    events: (limit = 120) => events.slice(-Math.max(1, Number(limit) || 120)).reverse(),
  };
}

export function noopLogger() {
  return {
    createId: (prefix = "evt") => `${prefix}_noop`,
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    events: () => [],
  };
}

function sanitize(value, depth = 0) {
  if (depth > 5) return "[depth-limit]";
  if (value == null) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      status: value.status,
    };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? "[redacted]" : sanitize(item, depth + 1),
      ]),
    );
  }
  if (typeof value === "string") return value.length > 800 ? `${value.slice(0, 800)}...` : value;
  return value;
}
