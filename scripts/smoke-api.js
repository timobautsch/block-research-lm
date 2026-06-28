const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5173";
const shouldRunChat = process.env.SMOKE_CHAT === "true";
const smokeEmail = process.env.SMOKE_AUTH_EMAIL || "smoke@sourcestudio.local";
const smokePassword = process.env.SMOKE_AUTH_PASSWORD || "SourceStudio123!";
let cookieHeader = "";

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(options.headers || {}),
    },
  });
  storeCookies(response);
  return response;
}

function storeCookies(response) {
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  if (!setCookies.length) return;
  const nextCookies = new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...value] = part.split("=");
        return [key, value.join("=")];
      }),
  );
  for (const setCookie of setCookies) {
    const [cookie] = setCookie.split(";");
    const [key, ...value] = cookie.split("=");
    if (key) nextCookies.set(key.trim(), value.join("=").trim());
  }
  cookieHeader = [...nextCookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function ensureAuth() {
  const signup = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "Smoke User",
      email: smokeEmail,
      password: smokePassword,
    }),
  });
  if (signup.status === 409) {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: smokeEmail, password: smokePassword }),
    });
    const loginBody = await readJson(login);
    if (!login.ok) {
      console.error("Smoke login failed:", login.status, loginBody);
      process.exit(1);
    }
    return loginBody;
  }
  const signupBody = await readJson(signup);
  if (!signup.ok) {
    console.error("Smoke signup failed:", signup.status, signupBody);
    process.exit(1);
  }
  return signupBody;
}

const health = await fetch(`${baseUrl}/api/health`);
const healthBody = await readJson(health);

if (!health.ok) {
  console.error("Health check failed:", health.status, healthBody);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      health: {
        status: health.status,
        configured: Boolean(healthBody.configured),
        provider: healthBody.provider,
        model: healthBody.model,
      },
    },
    null,
    2,
  ),
);

if (!shouldRunChat) {
  process.exit(0);
}

await ensureAuth();
await request("/api/seed", {
  method: "POST",
  body: JSON.stringify({ reset: false }),
});

const chat = await request("/api/chat", {
  method: "POST",
  body: JSON.stringify({
    question: "Why are citations useful? Answer in one sentence.",
    selectedSources: [
      {
        id: "smoke-source",
        title: "Smoke source",
        kind: "doc",
        body: "Citations help users verify generated answers against exact source evidence before relying on them.",
      },
    ],
    chatGoal: "Answer briefly with citations.",
    chatPersona: "Research analyst",
    answerStyle: "Concise",
    history: [],
  }),
});
const chatBody = await readJson(chat);

if (!chat.ok || !chatBody.content) {
  console.error("Chat smoke check failed:", chat.status, chatBody);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      chat: {
        status: chat.status,
        provider: chatBody.provider,
        model: chatBody.model,
        citationCount: chatBody.citations?.length ?? 0,
      },
    },
    null,
    2,
  ),
);
