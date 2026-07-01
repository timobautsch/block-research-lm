import { z } from "zod";

export const MAX_SOURCE_UPLOAD_MB = 200;
export const MAX_SOURCE_UPLOAD_BYTES = MAX_SOURCE_UPLOAD_MB * 1024 * 1024;
export const MAX_SOURCE_UPLOAD_BASE64_CHARS = Math.ceil((MAX_SOURCE_UPLOAD_BYTES * 4) / 3) + 4096;
export const MAX_SOURCE_REQUEST_BODY_BYTES = MAX_SOURCE_UPLOAD_BASE64_CHARS + (4 * 1024 * 1024);

export const SourceTypeSchema = z.enum([
  "markdown",
  "text",
  "pdf",
  "url",
  "note",
  "docx",
  "pptx",
  "epub",
  "youtube",
  "audio",
  "google_doc",
  "image",
]);

export const SourceStatusSchema = z.enum(["pending", "parsing", "indexed", "failed"]);

export const ArtifactTypeSchema = z.enum([
  "report",
  "mindmap",
  "flashcards",
  "quiz",
  "data-table",
  "slide-deck",
  "audio",
  "video",
  "infographic",
  "youtube-kit",
  "thumbnail",
]);

export const ModelRoleSchema = z.enum([
  "grounded_answer",
  "reasoning",
  "long_context",
  "summarization",
  "extraction",
  "reranking",
  "citation_verification",
  "artifact_generation",
  "slide_generation",
  "audio_script",
  "table_extraction",
]);

export const CreateNotebookSchema = z.object({
  title: z.string().trim().min(1).max(160).default("Untitled notebook"),
  description: z.string().trim().max(1000).optional().default(""),
});

export const CreateSourceSchema = z.object({
  type: SourceTypeSchema,
  title: z.string().trim().min(1).max(220).optional(),
  body: z.string().max(2_500_000).optional().default(""),
  original_url: z.string().trim().url().optional().or(z.literal("")),
  file_name: z.string().trim().max(260).optional(),
  mime_type: z.string().trim().max(120).optional(),
  base64: z.string().max(MAX_SOURCE_UPLOAD_BASE64_CHARS, `Uploaded files can be up to ${MAX_SOURCE_UPLOAD_MB} MB.`).optional(),
  active: z.boolean().optional().default(true),
  crawl: z.boolean().optional().default(true),
  crawl_max_pages: z.number().int().min(1).max(200).optional(),
  defer_indexing: z.boolean().optional().default(false),
});

export const ChatRequestSchema = z.object({
  notebook_id: z.string().trim().min(1).optional(),
  question: z.string().trim().min(1).max(4000),
  session_id: z.string().trim().max(120).optional(),
  source_mode: z.enum(["active", "selected", "all"]).optional().default("active"),
  selected_source_ids: z.array(z.string()).optional().default([]),
  answer_style: z.string().trim().max(80).optional().default("Balanced"),
  chat_goal: z.string().trim().max(800).optional().default("Answer only from source evidence."),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .optional()
    .default([]),
  selectedSources: z.array(z.any()).optional(),
});

export const ArtifactRequestSchema = z.object({
  notebook_id: z.string().trim().min(1),
  type: ArtifactTypeSchema,
  options: z.record(z.string(), z.any()).optional().default({}),
});

export const FlashcardReviewSchema = z.object({
  card_id: z.string().trim().min(1),
  result: z.enum(["got_it", "missed"]),
  session_id: z.string().trim().max(120).optional().default("default"),
});

export const ActiveSourceSchema = z.object({
  active: z.boolean(),
});

export const ProviderStatusSchema = z.object({
  anthropic: z.boolean(),
  openai: z.boolean(),
  google: z.boolean(),
  elevenlabs: z.boolean(),
  database: z.boolean(),
  redis: z.boolean(),
  storage: z.string(),
  storage_dir: z.string(),
  available_reasoning_providers: z.array(z.string()),
  active_grounded_answer_provider: z.string(),
  grounded_answer_model: z.string(),
  external_grounded_answer_enabled: z.boolean(),
  roles: z.record(z.string(), z.any()),
});
