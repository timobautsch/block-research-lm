const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5173";
const shouldRunChat = process.env.SMOKE_CHAT === "true";

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
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

const chat = await fetch(`${baseUrl}/api/chat`, {
  method: "POST",
  headers: { "content-type": "application/json" },
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
