import { z } from "zod";

const SourceTypeSchema = z.enum([
  "markdown",
  "text",
  "pdf",
  "url",
  "note",
  "docx",
  "youtube",
  "audio",
  "google_doc",
  "image",
]);

const ArtifactTypeSchema = z.enum([
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
  base64: z.string().max(12_000_000).optional(),
  active: z.boolean().optional().default(true),
  crawl: z.boolean().optional().default(true),
  crawl_max_pages: z.number().int().min(1).max(200).optional(),
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
