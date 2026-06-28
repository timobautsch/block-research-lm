const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5173";
const smokeEmail = process.env.SMOKE_AUTH_EMAIL || "e2e@sourcestudio.local";
const smokePassword = process.env.SMOKE_AUTH_PASSWORD || "SourceStudio123!";
let cookieHeader = "";

async function json(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
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

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(options?.headers || {}),
    },
  });
  storeCookies(response);
  const body = await json(response);
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function ensureAuth() {
  try {
    return await request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name: "E2E User",
        email: smokeEmail,
        password: smokePassword,
      }),
    });
  } catch (error) {
    if (!String(error.message).includes("409")) throw error;
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: smokeEmail, password: smokePassword }),
    });
  }
}

await ensureAuth();

const notebookResponse = await request("/api/notebooks", {
  method: "POST",
  body: JSON.stringify({ title: `E2E Smoke ${Date.now()}` }),
});
const notebook = notebookResponse.notebook;

await request(`/api/notebooks/${notebook.id}/sources`, {
  method: "POST",
  body: JSON.stringify({
    type: "markdown",
    title: "E2E source",
    body: "# E2E Source\n\nSourceStudio uses Evidence Packs to answer only from active sources. Citations point to source blocks.",
  }),
});

const chat = await request("/api/chat", {
  method: "POST",
  body: JSON.stringify({
    notebook_id: notebook.id,
    question: "What does SourceStudio use to answer questions?",
  }),
});

if (!chat.message?.citations?.length) {
  throw new Error("Expected chat citations.");
}

const artifact = await request("/api/artifacts", {
  method: "POST",
  body: JSON.stringify({
    notebook_id: notebook.id,
    type: "quiz",
    options: {},
  }),
});

if (!artifact.artifact?.content_json?.questions?.length) {
  throw new Error("Expected quiz questions.");
}

const flashcards = await request("/api/artifacts", {
  method: "POST",
  body: JSON.stringify({
    notebook_id: notebook.id,
    type: "flashcards",
    options: {
      topic: "Evidence Packs",
      difficulty: "medium",
      count: 6,
      card_types: ["concept", "application", "source-check"],
    },
  }),
});

if (!flashcards.artifact?.content_json?.deck_id || !flashcards.artifact?.content_json?.cards?.length) {
  throw new Error("Expected flashcard deck and cards.");
}

const deckResponse = await request(`/api/artifacts/${flashcards.artifact.id}/flashcard-deck`);
const deck = deckResponse.deck;
if (!deck?.cards?.length) {
  throw new Error("Expected flashcard deck cards from API.");
}

const reviewedDeck = await request(`/api/flashcard-decks/${deck.id}/reviews`, {
  method: "POST",
  body: JSON.stringify({
    card_id: deck.cards[0].id,
    result: "missed",
    session_id: "e2e-smoke",
  }),
});

if (reviewedDeck.deck?.progress?.missed !== 1) {
  throw new Error("Expected one missed flashcard review.");
}

const adaptiveDeck = await request(`/api/flashcard-decks/${deck.id}/adaptive`, {
  method: "POST",
  body: JSON.stringify({ limit: 1 }),
});

if ((adaptiveDeck.deck?.cards?.length || 0) <= deck.cards.length) {
  throw new Error("Expected adaptive flashcards to be added.");
}

console.log(
  JSON.stringify(
    {
      notebook_id: notebook.id,
      citation_count: chat.message.citations.length,
      artifact_type: artifact.artifact.type,
      job_status: artifact.job.status,
      flashcard_cards: adaptiveDeck.deck.cards.length,
      flashcard_missed: adaptiveDeck.deck.progress.missed,
    },
    null,
    2,
  ),
);
