import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ChangeEvent,
  CSSProperties,
  DragEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import {
  ArrowRight,
  AudioLines,
  Bot,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Compass,
  Copy,
  Database,
  Download,
  FileText,
  GitBranch,
  Globe,
  Image,
  KeyRound,
  Layers3,
  Library,
  ListChecks,
  Loader2,
  Lock,
  LogOut,
  Map as MapIcon,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Minus,
  NotebookPen,
  PanelLeft,
  PlayCircle,
  PauseCircle,
  Pencil,
  Plus,
  Presentation,
  RefreshCw,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Table2,
  Trash2,
  UploadCloud,
  Mail,
  UserCircle,
  UserPlus,
  Video,
  X,
  XCircle,
  Youtube,
} from "lucide-react";

type SourceType = "markdown" | "text" | "pdf" | "url" | "note" | "docx" | "pptx" | "epub" | "youtube" | "audio" | "google_doc" | "image";
type SourceStatus = "pending" | "parsing" | "indexed" | "failed";
type AnswerStyle = "Strict" | "Balanced" | "Exploratory";
type ArtifactType =
  | "report"
  | "mindmap"
  | "flashcards"
  | "quiz"
  | "data-table"
  | "slide-deck"
  | "audio"
  | "video"
  | "infographic"
  | "youtube-kit"
  | "thumbnail";
type AudioFormat = "deep_dive" | "brief" | "critique" | "debate";
type AudioLength = "short" | "default" | "long";
type FlashcardDifficulty = "mixed" | "easy" | "medium" | "hard";
type FlashcardCountPreset = "fewer" | "standard" | "more";
type FlashcardCardType = "concept" | "application" | "cloze" | "caveat" | "source-check" | "compare";
type SourceMode = "active" | "selected" | "all";
type ReportFormatKind = "custom" | "template" | "suggested";
interface AudioOverviewOptions {
  format: AudioFormat;
  length: AudioLength;
  language: string;
  prompt: string;
}
interface FlashcardOptions {
  topic: string;
  difficulty: FlashcardDifficulty;
  countPreset: FlashcardCountPreset;
  count: number;
  language: string;
  audience: string;
  cardTypes: FlashcardCardType[];
  sourceMode: SourceMode;
  selectedSourceIds: string[];
}
interface ReportFormatOption {
  id: string;
  title: string;
  description: string;
  kind: ReportFormatKind;
  prompt: string;
}
type MobilePanel = "sources" | "chat" | "studio";
type WorkspaceResizeTarget = "sources" | "studio";
const AUTH_MODES = ["login", "signup", "reset-request", "reset-confirm"] as const;
type AuthMode = (typeof AUTH_MODES)[number];
type ApiInit = Parameters<typeof fetch>[1];
const BRAND_NAME = "blockresearch.ai LM";
const BRAND_EYEBROW = "Block Research AI";
const BRAND_LOGO_PATH = "/brand/blockresearch-mark.svg";
const ASSISTANT_NAME = "Block Research LM";
const LAST_NOTEBOOK_STORAGE_KEY = "sourcestudio:last-notebook-id";
const WORKSPACE_LAYOUT_STORAGE_KEY = "sourcestudio:workspace-layout";
const WORKSPACE_RESIZER_WIDTH = 14;
const WORKSPACE_MIN_SOURCE = 260;
const WORKSPACE_MIN_CHAT = 360;
const WORKSPACE_MIN_STUDIO = 280;
const WORKSPACE_MAX_SOURCE = 620;
const WORKSPACE_MAX_STUDIO = 680;
const DEFAULT_WORKSPACE_LAYOUT = { sources: 340, studio: 400 };
type WorkspaceLayout = typeof DEFAULT_WORKSPACE_LAYOUT;

interface AuthUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
  last_login_at: string;
}

interface AuthResponse {
  authenticated: boolean;
  user: AuthUser;
  session?: {
    expires_at?: string;
  };
}

interface AuthSessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

interface PasswordResetResponse {
  ok: boolean;
  delivery: string;
  expires_at?: string;
  reset_token?: string;
}

interface MindMapNode {
  id?: string;
  label?: string;
  type?: string;
  source_refs?: Array<Record<string, unknown>>;
}

interface MindMapEdge {
  id?: string;
  source?: string;
  target?: string;
  label?: string;
}

interface FlashcardPayload {
  id?: string;
  card_type?: string;
  learning_goal?: string;
  question?: string;
  answer?: string;
  explanation?: string;
  hint?: string;
  difficulty?: string;
  tags?: string[];
  citation?: string;
  evidence_id?: string;
  evidence_quote?: string;
  source_title?: string;
  source_refs?: SourceRef[];
  support_level?: string;
  confidence?: number;
  attempts?: number;
  got_it_count?: number;
  missed_count?: number;
  review_state?: string;
  last_reviewed_at?: string;
  mastery_score?: number;
  due_state?: string;
}

interface FlashcardProgressPayload {
  total?: number;
  active?: number;
  deleted?: number;
  reviewed?: number;
  remaining?: number;
  due?: number;
  got_it?: number;
  missed?: number;
  mastery_score?: number;
  session_complete?: boolean;
}

interface FlashcardProgress {
  total: number;
  active: number;
  deleted: number;
  reviewed: number;
  remaining: number;
  due: number;
  got_it: number;
  missed: number;
  mastery_score: number;
  session_complete: boolean;
}

interface SourceRef {
  source_id?: string;
  block_ids?: string[];
  chunk_id?: string;
  quote?: string;
}

interface FlashcardDeck {
  id: string;
  notebook_id: string;
  artifact_id: string;
  title: string;
  options_json: Record<string, unknown>;
  progress: FlashcardProgress;
  cards: FlashcardPayload[];
  source_coverage?: {
    cited_source_count?: number;
    cited_sources?: string[];
  };
}

interface QuizPayload {
  id?: string;
  type?: string;
  learning_goal?: string;
  question?: string;
  options?: string[];
  correct_index?: number;
  correct_answer?: string;
  explanation?: string;
  distractor_rationales?: string[];
  source_refs?: Array<Record<string, unknown>>;
  difficulty?: string;
  citation?: string;
  tags?: string[];
  evidence_quote?: string;
}

interface TableRowPayload {
  cells?: Record<string, unknown>;
  cell_support?: Record<string, string>;
  source_refs?: Array<Record<string, unknown>>;
  support?: string;
}

interface SlidePayload {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  speaker_notes?: string;
  visual_suggestion?: string;
  layout_type?: string;
  citations?: Citation[];
  svg_markup?: string;
}

interface TranscriptPayload {
  host?: string;
  text?: string;
}

interface StoryboardPayload {
  scene?: number;
  title?: string;
  narration?: string;
}

interface InfographicPanelPayload {
  panel?: number;
  headline?: string;
  copy?: string;
  citation?: string;
  evidence_id?: string;
  source_title?: string;
  metric_label?: string;
  metric_value?: string;
}

interface KnowledgeObject {
  id: string;
  type: string;
  source_id: string;
  data: Record<string, unknown>;
}

interface Source {
  id: string;
  notebook_id: string;
  type: SourceType;
  title: string;
  original_url: string;
  status: SourceStatus;
  cleaned_text: string;
  metadata_json: Record<string, unknown>;
  active: boolean;
  block_count: number;
  chunk_count: number;
  word_count: number;
  summary: string;
  knowledge: KnowledgeObject[];
  created_at?: string;
  updated_at?: string;
}

interface Citation {
  index: number;
  evidence_id: string;
  source_id: string;
  sourceId?: string;
  source_title: string;
  sourceTitle?: string;
  block_ids: string[];
  chunk_id: string;
  quote: string;
  heading_path: string[];
  page_number?: number | null;
}

interface SourceBlock {
  // The blocks API returns `block_id` (not `id`) — matching citation.block_ids.
  block_id: string;
  text: string;
  heading_path?: string[];
  page_number?: number | null;
}

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  resolve: (confirmed: boolean) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  citations?: Citation[];
  provider?: string;
  model?: string;
  mode?: string;
  fallback_reason?: string;
  claim_stats?: {
    claims_checked: number;
    supported: number;
    partially_supported: number;
    unsupported: number;
    not_checkable: number;
    citation_coverage?: number;
    support_score?: number;
  };
}

interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content_json: Record<string, unknown>;
  text_content: string;
  file_path: string;
  source_refs_json: Array<Record<string, unknown>>;
  created_at: string;
}

interface ArtifactJob {
  id: string;
  type: ArtifactType;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  result_artifact_id: string;
  error: string;
  created_at: string;
  updated_at?: string;
}

interface Notebook {
  id: string;
  title: string;
  description: string;
  summary: string;
  active_source_count: number;
  source_count: number;
  sources: Source[];
  artifacts: Artifact[];
  jobs: ArtifactJob[];
  knowledge: KnowledgeObject[];
  messages: ChatMessage[];
  suggested_questions: string[];
  suggested_artifacts: ArtifactType[];
  created_at?: string;
  updated_at?: string;
}

interface ProviderStatus {
  anthropic: boolean;
  openai: boolean;
  google: boolean;
  elevenlabs: boolean;
  database: boolean;
  redis: boolean;
  storage: string;
  storage_dir: string;
  available_reasoning_providers: string[];
  active_grounded_answer_provider: string;
  grounded_answer_model: string;
  external_grounded_answer_enabled: boolean;
}

interface DebugJob {
  id: string;
  notebook_id: string;
  type: ArtifactType;
  status: ArtifactJob["status"];
  progress: number;
  result_artifact_id: string;
  error: string;
  created_at: string;
  updated_at: string;
}

interface DebugModelRun {
  id: string;
  role: string;
  provider: string;
  model: string;
  status: string;
  input_tokens_estimate: number;
  output_tokens_estimate: number;
  latency_ms: number;
  error: string;
  created_at: string;
}

interface DebugEvent {
  id: string;
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  event: string;
  details: Record<string, unknown>;
}

interface DebugSnapshot {
  server_time: string;
  storage_dir: string;
  provider: ProviderStatus;
  counts: Record<string, number>;
  running_jobs: DebugJob[];
  failed_jobs: DebugJob[];
  recent_jobs: DebugJob[];
  recent_model_runs: DebugModelRun[];
  recent_messages: Array<Record<string, unknown>>;
}

interface DebugStatusResponse {
  debug: DebugSnapshot;
  events: DebugEvent[];
}

interface SourceForm {
  type: SourceType;
  title: string;
  original_url: string;
  body: string;
  file_name?: string;
  mime_type?: string;
  base64?: string;
}

type QueuedSourceFileStatus = "queued" | "adding" | "added" | "failed";

interface QueuedSourceFile {
  id: string;
  file: File;
  type: SourceType;
  title: string;
  file_name: string;
  mime_type: string;
  size: number;
  status: QueuedSourceFileStatus;
  error?: string;
  sourceId?: string;
  progress?: number;
  progressLabel?: string;
  progressDetail?: string;
}

const MAX_SOURCE_UPLOAD_MB = 200;
const MAX_SOURCE_UPLOAD_BYTES = MAX_SOURCE_UPLOAD_MB * 1024 * 1024;
const SOURCE_UPLOAD_LIMIT_LABEL = `${MAX_SOURCE_UPLOAD_MB} MB`;
const SOURCE_UPLOAD_PARALLELISM = 3;
const LARGE_UPLOAD_SEQUENTIAL_BYTES = 32 * 1024 * 1024;

const emptySourceForm: SourceForm = {
  type: "markdown",
  title: "",
  original_url: "",
  body: "",
};

type StudioArtifactTool = {
  type: ArtifactType;
  title: string;
  action: string;
  icon: ReactNode;
};

const youtubeStudioTypes: StudioArtifactTool[] = [
  { type: "youtube-kit", title: "Title & Description", action: "Metadata", icon: <Youtube size={18} /> },
  { type: "thumbnail", title: "Thumbnail", action: "Visual", icon: <Image size={18} /> },
];

const coreStudioTypes: StudioArtifactTool[] = [
  { type: "audio", title: "Audio Overview", action: "Script", icon: <AudioLines size={18} /> },
  { type: "slide-deck", title: "Slide Deck", action: "Slides", icon: <Presentation size={18} /> },
  { type: "video", title: "Video Overview", action: "Render", icon: <Video size={18} /> },
  { type: "mindmap", title: "Mind Map", action: "Map", icon: <MapIcon size={18} /> },
  { type: "report", title: "Reports", action: "Write", icon: <ClipboardList size={18} /> },
  { type: "flashcards", title: "Flashcards", action: "Cards", icon: <Layers3 size={18} /> },
  { type: "quiz", title: "Quiz", action: "Test", icon: <ListChecks size={18} /> },
  { type: "infographic", title: "Infographic", action: "Visual", icon: <Sparkles size={18} /> },
  { type: "data-table", title: "Data Table", action: "Extract", icon: <Table2 size={18} /> },
];

const artifactTypes: StudioArtifactTool[] = [...youtubeStudioTypes, ...coreStudioTypes];

const sourceTabs: Array<{ type: SourceType; label: string; icon: ReactNode }> = [
  { type: "markdown", label: "Paste text", icon: <FileText size={15} /> },
  { type: "url", label: "Website", icon: <Globe size={15} /> },
  { type: "youtube", label: "YouTube", icon: <Youtube size={15} /> },
  { type: "note", label: "Note", icon: <NotebookPen size={15} /> },
];

const audioFormatOptions: Array<{ value: AudioFormat; label: string }> = [
  { value: "deep_dive", label: "Deep Dive" },
  { value: "brief", label: "Brief" },
  { value: "critique", label: "Critique" },
  { value: "debate", label: "Debate" },
];

const audioLengthOptions: Array<{ value: AudioLength; label: string }> = [
  { value: "default", label: "Default" },
  { value: "short", label: "Shorter" },
  { value: "long", label: "Longer" },
];

const audioLanguageOptions = ["English", "German", "Spanish", "French", "Italian"];
const flashcardDifficultyOptions: Array<{ value: FlashcardDifficulty; label: string }> = [
  { value: "mixed", label: "Mixed" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];
const flashcardCountOptions: Array<{ value: FlashcardCountPreset; label: string; count: number }> = [
  { value: "fewer", label: "Fewer", count: 6 },
  { value: "standard", label: "Standard", count: 10 },
  { value: "more", label: "More", count: 16 },
];
const flashcardCardTypeOptions: Array<{ value: FlashcardCardType; label: string }> = [
  { value: "concept", label: "Concept" },
  { value: "application", label: "Apply" },
  { value: "cloze", label: "Cloze" },
  { value: "caveat", label: "Caveat" },
  { value: "source-check", label: "Source check" },
  { value: "compare", label: "Compare" },
];
const sourceModeOptions: Array<{ value: SourceMode; label: string }> = [
  { value: "active", label: "Active" },
  { value: "selected", label: "Selected" },
  { value: "all", label: "All" },
];

const baseReportFormatOptions: ReportFormatOption[] = [
  {
    id: "custom",
    title: "Custom Report",
    description: "Define the report question, audience, scope, and decision context",
    kind: "custom",
    prompt: "Create a formal source-grounded report using the user's requested scope, audience, and decision context.",
  },
  {
    id: "research-report",
    title: "Research Report",
    description: "Formal synthesis with abstract, scope, method, findings, analysis, and appendix",
    kind: "template",
    prompt: "Create a formal research report with abstract, scope, methodology, principal findings, analytical sections, recommendations, limitations, and bibliography.",
  },
  {
    id: "decision-report",
    title: "Decision Report",
    description: "Decision-ready analysis of context, options, tradeoffs, recommendation, and risks",
    kind: "template",
    prompt: "Create a decision report with context, decision question, options, evidence-backed analysis, recommended course of action, risk register, and next steps.",
  },
  {
    id: "technical-report",
    title: "Technical Report",
    description: "Precise analysis of architecture, workflow, implementation state, gaps, and controls",
    kind: "template",
    prompt: "Create a technical report with system context, architecture or workflow analysis, observed evidence, implementation gaps, operational risks, and recommendations.",
  },
];

const defaultAudioOverviewOptions: AudioOverviewOptions = {
  format: "deep_dive",
  length: "default",
  language: "English",
  prompt: "",
};

const defaultFlashcardOptions: FlashcardOptions = {
  topic: "",
  difficulty: "mixed",
  countPreset: "standard",
  count: 10,
  language: "English",
  audience: "general",
  cardTypes: ["concept", "application", "cloze", "caveat", "source-check", "compare"],
  sourceMode: "active",
  selectedSourceIds: [],
};

function initialAuthState(): { mode: AuthMode; token: string } {
  const hash = window.location.hash || "";
  if (hash.startsWith("#reset-password=")) {
    return { mode: "reset-confirm", token: decodeURIComponent(hash.replace("#reset-password=", "")) };
  }
  if (hash.startsWith("#reset-password?")) {
    const params = new URLSearchParams(hash.replace("#reset-password?", ""));
    return { mode: "reset-confirm", token: params.get("token") || "" };
  }
  return { mode: "login", token: "" };
}

function isAuthMode(value: unknown): value is AuthMode {
  return typeof value === "string" && AUTH_MODES.includes(value as AuthMode);
}

function normalizeAuthMode(value: unknown): AuthMode {
  return isAuthMode(value) ? value : "login";
}

function flashcardArtifactOptions(options: FlashcardOptions) {
  return {
    topic: options.topic.trim(),
    difficulty: options.difficulty,
    count_preset: options.countPreset,
    count: options.count,
    language: options.language,
    audience: options.audience.trim() || "general",
    card_types: options.cardTypes,
    source_mode: options.sourceMode,
    selected_source_ids: options.sourceMode === "selected" ? options.selectedSourceIds : [],
  };
}

function reportArtifactOptions(format: ReportFormatOption, customPrompt = ""): Record<string, unknown> {
  const instructions = customPrompt.trim();
  const title = format.kind === "custom" ? customReportTitle(instructions) : format.title;
  return {
    report_type: title,
    report_format: format.id,
    report_format_kind: format.kind,
    prompt: [format.prompt, instructions ? `User instructions: ${instructions}` : ""].filter(Boolean).join("\n\n"),
  };
}

export default function App() {
  const [showLanding, setShowLanding] = useState(() => window.location.hash !== "#workspace");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>(() => initialAuthState().mode);
  const [resetToken, setResetToken] = useState(() => initialAuthState().token);
  const [authChecked, setAuthChecked] = useState(false);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const deletingSourceIdsRef = useRef<Set<string>>(new Set());
  const pendingSourceActiveOverridesRef = useRef<globalThis.Map<string, boolean>>(new globalThis.Map());
  // Ref (not state): two Enter keydowns can land in the same render batch, where
  // isAsking is still stale — the disabled send button doesn't cover the key path.
  const askInFlightRef = useRef(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("chat");
  const workspacePreferredLayoutRef = useRef<WorkspaceLayout>(readWorkspaceLayout());
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayout>(() => workspacePreferredLayoutRef.current);
  const [workspaceResizeTarget, setWorkspaceResizeTarget] = useState<WorkspaceResizeTarget | "">("");
  const [sourceForm, setSourceForm] = useState<SourceForm>(emptySourceForm);
  // Batch channel import: "channel" pulls the newest N uploads of a channel in
  // one go; each video still becomes its own transcribed source.
  const [youtubeImportMode, setYoutubeImportMode] = useState<"video" | "channel">("video");
  const [youtubeBatchCount, setYoutubeBatchCount] = useState(10);
  // Citation chips open the cited source passage with its blocks highlighted.
  const [citationViewer, setCitationViewer] = useState<{ citation: Citation; blocks: SourceBlock[] | null } | null>(null);
  const citedScrolledRef = useRef(false);
  // In-app replacement for window.confirm — the browser dialog looks foreign.
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [sourceFileQueue, setSourceFileQueue] = useState<QueuedSourceFile[]>([]);
  const [activeSourceId, setActiveSourceId] = useState("");
  const [, setHighlightedBlockIds] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [answerStyle, setAnswerStyle] = useState<AnswerStyle>("Balanced");
  const [selectedArtifactId, setSelectedArtifactId] = useState("");
  const [audioOptions, setAudioOptions] = useState<AudioOverviewOptions>(defaultAudioOverviewOptions);
  const [flashcardOptions, setFlashcardOptions] = useState<FlashcardOptions>(defaultFlashcardOptions);
  const [isArtifactDetailOpen, setIsArtifactDetailOpen] = useState(false);
  const [playingArtifactId, setPlayingArtifactId] = useState("");
  const inlineAudioRef = useRef<HTMLAudioElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [customizeType, setCustomizeType] = useState<"" | "audio" | "flashcards" | "thumbnail" | "report">("");
  const [customReportPrompt, setCustomReportPrompt] = useState("");
  const [isCustomReportPromptOpen, setIsCustomReportPromptOpen] = useState(false);
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [thumbnailRefs, setThumbnailRefs] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [openMenu, setOpenMenu] = useState<"" | "settings" | "account" | "notebooks">("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const renameEscapeRef = useRef(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugStatus, setDebugStatus] = useState<DebugStatusResponse | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [creatingTypes, setCreatingTypes] = useState<Set<ArtifactType>>(() => new Set());
  const [deletingArtifactIds, setDeletingArtifactIds] = useState<Set<string>>(() => new Set());
  const [isDeletingAllArtifacts, setIsDeletingAllArtifacts] = useState(false);
  const [sourcePanelFocusTick, setSourcePanelFocusTick] = useState(0);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [sourceFormNotice, setSourceFormNotice] = useState("");
  const [sourceFormNoticeTone, setSourceFormNoticeTone] = useState<"success" | "warning" | "error">("error");
  const didBootRef = useRef(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const sourceBodyRef = useRef<HTMLTextAreaElement | null>(null);
  const sourcePanelRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);

  const selectedArtifact = useMemo(
    () => notebook?.artifacts.find((artifact) => artifact.id === selectedArtifactId) || null,
    [notebook, selectedArtifactId],
  );
  const visibleMessages = useMemo(
    () => visibleNotebookMessages(notebook?.messages || []),
    [notebook?.messages],
  );
  const suggestedReportFormats = useMemo(() => buildSuggestedReportFormats(notebook), [notebook]);
  const isSourceReady = useMemo(() => {
    const body = sourceForm.body.trim();
    const url = sourceForm.original_url.trim();
    const hasFile = Boolean(sourceForm.base64 || sourceFileQueue.length);
    if (sourceNeedsUrl(sourceForm.type)) return Boolean(url || body);
    if (sourceAcceptsFile(sourceForm.type)) return Boolean(hasFile || body);
    return Boolean(body || hasFile);
  }, [sourceFileQueue.length, sourceForm]);
  const sourceUploadDone = sourceFileQueue.filter((file) => file.status === "added" || file.status === "failed").length;

  useEffect(() => {
    if (didBootRef.current) return;
    didBootRef.current = true;
    void boot();
    // boot intentionally runs once to initialize persisted notebook state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (notebook?.sources.length && !activeSourceId) {
      setActiveSourceId(notebook.sources[0].id);
    }
  }, [activeSourceId, notebook]);

  useEffect(() => {
    if (!selectedArtifactId || !notebook) return;
    if (notebook.artifacts.some((artifact) => artifact.id === selectedArtifactId)) return;
    setSelectedArtifactId("");
    setIsArtifactDetailOpen(false);
  }, [notebook, selectedArtifactId]);

  // Switching notebooks (or landing on a different one after a delete) must not
  // leave the inline artifact audio playing with no visible control to stop it.
  useEffect(() => {
    inlineAudioRef.current?.pause();
    setPlayingArtifactId("");
  }, [notebook?.id]);

  useEffect(() => {
    const messagesNode = messagesRef.current;
    if (!messagesNode) return;
    messagesNode.scrollTop = messagesNode.scrollHeight;
  }, [visibleMessages.length, isAsking]);

  useEffect(() => {
    if (!authUser || showLanding) return;
    let isCancelled = false;
    async function refreshDebug() {
      try {
        const status = await api<DebugStatusResponse>("/api/debug/status?limit=140");
        if (!isCancelled) setDebugStatus(status);
      } catch {
        if (!isCancelled) setDebugStatus(null);
      }
    }
    void refreshDebug();
    const timer = window.setInterval(() => void refreshDebug(), 3500);
    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [authUser, showLanding]);

  useEffect(() => {
    const node = workspaceRef.current;
    if (!node) return undefined;
    const syncLayout = () => {
      if (window.getComputedStyle(node).display !== "grid") return;
      const width = workspaceInnerWidth(node);
      setWorkspaceLayout(normalizeWorkspaceLayout(workspacePreferredLayoutRef.current, width));
    };
    syncLayout();
    const observer = new ResizeObserver(syncLayout);
    observer.observe(node);
    window.addEventListener("resize", syncLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncLayout);
    };
  }, [authUser, showLanding]);

  async function boot() {
    setIsBooting(true);
    setError("");
    try {
      const health = await api<{ providers: ProviderStatus }>("/api/health");
      setProviderStatus(health.providers);
      const session = await api<AuthSessionResponse>("/api/auth/session");
      setAuthUser(session.authenticated ? session.user : null);
      if (!session.authenticated || !session.user) {
        setNotebook(null);
        setActiveSourceId("");
        setSelectedArtifactId("");
        return;
      }
      await loadWorkspaceData();
    } catch (bootError) {
      setError(messageFromError(bootError));
    } finally {
      setAuthChecked(true);
      setIsBooting(false);
    }
  }

  async function loadWorkspaceData() {
    const list = await api<{ notebooks: Notebook[] }>("/api/notebooks");
    if (list.notebooks.length) {
      const rememberedId = readRememberedNotebookId();
      const target = list.notebooks.find((item) => item.id === rememberedId) || list.notebooks[0];
      setNotebooks(list.notebooks);
      const loaded = await loadNotebook(target.id);
      setNotebook(loaded);
      rememberNotebookId(loaded.id);
    } else {
      // Start with an empty notebook (NotebookLM-style) — no pre-seeded demo sources.
      const created = await api<{ notebook: Notebook }>("/api/notebooks", {
        method: "POST",
        body: JSON.stringify({ title: "Untitled notebook" }),
      });
      const fresh = await loadNotebook(created.notebook.id);
      setNotebooks([fresh]);
      setNotebook(fresh);
      rememberNotebookId(fresh.id);
    }
  }

  async function refreshNotebookList() {
    try {
      const list = await api<{ notebooks: Notebook[] }>("/api/notebooks");
      setNotebooks(list.notebooks);
    } catch {
      // notebook list is non-critical chrome; ignore refresh failures.
    }
  }

  function exitRename(save: boolean) {
    const next = titleDraft.trim();
    setIsRenaming(false);
    if (!save || !notebook || !next || next === notebook.title) return;
    void (async () => {
      setError("");
      try {
        const response = await api<{ notebook: Notebook }>(`/api/notebooks/${notebook.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: next }),
        });
        setNotebook((current) => (current?.id === response.notebook.id ? response.notebook : current));
        await refreshNotebookList();
        setToast("Notebook renamed.");
      } catch (renameError) {
        setError(messageFromError(renameError));
      }
    })();
  }

  async function createNotebook() {
    if (isCreatingNotebook) return;
    const previousNotebook = notebook;
    const previousNotebooks = notebooks;
    const previousActiveSourceId = activeSourceId;
    const previousSelectedArtifactId = selectedArtifactId;
    const pendingNotebook: Notebook = {
      id: "pending-new-notebook",
      title: "Untitled notebook",
      description: "",
      summary: "",
      active_source_count: 0,
      source_count: 0,
      sources: [],
      artifacts: [],
      jobs: [],
      knowledge: [],
      messages: [],
      suggested_questions: [],
      suggested_artifacts: [],
    };
    setOpenMenu("");
    setError("");
    setToast("Creating notebook…");
    setIsCreatingNotebook(true);
    setNotebook(pendingNotebook);
    setActiveSourceId("");
    setSelectedArtifactId("");
    setMobilePanel("chat");
    setIsAddSourceOpen(false);
    setIsNotepadOpen(false);
    setIsArtifactDetailOpen(false);
    setIsShareOpen(false);
    setCustomizeType("");
    setSourceFileQueue([]);
    setSourceForm(emptySourceForm);
    setSourceFormNotice("");
    setSourceFormNoticeTone("error");
    setIsDragging(false);
    try {
      const created = await api<{ notebook: Partial<Notebook> & { id: string; title?: string } }>("/api/notebooks", {
        method: "POST",
        body: JSON.stringify({ title: "Untitled notebook" }),
      });
      const shell: Notebook = {
        id: created.notebook.id,
        title: created.notebook.title || "Untitled notebook",
        description: created.notebook.description || "",
        summary: created.notebook.summary || "",
        active_source_count: 0,
        source_count: 0,
        sources: [],
        artifacts: [],
        jobs: [],
        knowledge: [],
        messages: [],
        suggested_questions: [],
        suggested_artifacts: [],
        created_at: created.notebook.created_at,
        updated_at: created.notebook.updated_at,
      };
      setNotebook(shell);
      setNotebooks((current) => [shell, ...current.filter((item) => item.id !== shell.id)]);
      rememberNotebookId(shell.id);
      setActiveSourceId("");
      setSelectedArtifactId("");
      setMobilePanel("chat");
      const loaded = await loadNotebook(shell.id);
      setNotebook(loaded);
      rememberNotebookId(loaded.id);
      setActiveSourceId("");
      setSelectedArtifactId("");
      await refreshNotebookList();
      setToast("New notebook opened.");
    } catch (createError) {
      setNotebook((current) => (current?.id === pendingNotebook.id ? previousNotebook : current));
      setNotebooks(previousNotebooks);
      setActiveSourceId(previousActiveSourceId);
      setSelectedArtifactId(previousSelectedArtifactId);
      setToast("");
      setError(messageFromError(createError));
    } finally {
      setIsCreatingNotebook(false);
    }
  }

  async function switchNotebook(id: string) {
    setOpenMenu("");
    if (!id || id === notebook?.id) return;
    setError("");
    setIsBooting(true);
    try {
      const loaded = await loadNotebook(id);
      setNotebook(loaded);
      rememberNotebookId(loaded.id);
      setActiveSourceId(loaded.sources[0]?.id || "");
      setSelectedArtifactId("");
    } catch (switchError) {
      setError(messageFromError(switchError));
    } finally {
      setIsBooting(false);
    }
  }

  async function deleteNotebookById(item: Notebook) {
    const label = item.title || "Untitled notebook";
    const confirmed = await askConfirm({
      title: "Delete notebook?",
      message: `"${label}" will be deleted with all its sources and outputs. This cannot be undone.`,
      confirmLabel: "Delete notebook",
    });
    if (!confirmed) return;
    setOpenMenu("");
    setError("");
    try {
      await api(`/api/notebooks/${item.id}`, { method: "DELETE" });
      const remaining = notebooks.filter((entry) => entry.id !== item.id);
      setNotebooks(remaining);
      if (notebook?.id === item.id) {
        forgetRememberedNotebookId();
        const next = remaining[0];
        if (next) {
          await switchNotebook(next.id);
        } else {
          setNotebook(null);
          setActiveSourceId("");
          setSelectedArtifactId("");
        }
      }
      setToast(`Notebook "${label}" deleted.`);
      refreshDebugSilently();
    } catch (deleteError) {
      setError(messageFromError(deleteError));
    }
  }

  function openAddSource(type: SourceType = "markdown") {
    setSourceForm({ ...emptySourceForm, type });
    setSourceFileQueue([]);
    setSourceFormNotice("");
    setSourceFormNoticeTone("error");
    setIsAddSourceOpen(true);
    window.requestAnimationFrame(() => sourceBodyRef.current?.focus());
  }

  function closeAddSourceDialog() {
    if (isAddingSource) return;
    setIsAddSourceOpen(false);
    setIsDragging(false);
    setSourceFileQueue([]);
    setSourceForm(emptySourceForm);
    setSourceFormNotice("");
    setSourceFormNoticeTone("error");
  }

  async function setAllSourcesActive(active: boolean) {
    const previousNotebook = notebook;
    if (!previousNotebook) return;
    setError("");
    const targets = previousNotebook.sources.filter((source) => source.active !== active);
    if (!targets.length) return;
    const targetIds = targets.map((source) => source.id);
    trackPendingSourceActiveState(targetIds, active);
    applySourceActiveState(targetIds, active);
    try {
      await Promise.all(
        targets.map((source) =>
          api(`/api/sources/${source.id}/active`, {
            method: "PATCH",
            body: JSON.stringify({ active }),
          }),
        ),
      );
      clearPendingSourceActiveState(targetIds, active);
      await refreshNotebookAfterSourceToggle(previousNotebook.id);
      refreshDebugSilently();
    } catch (toggleError) {
      clearPendingSourceActiveState(targetIds, active);
      setNotebook((current) => (current?.id === previousNotebook.id ? previousNotebook : current));
      setError(messageFromError(toggleError));
    }
  }

  async function loadDebugStatus() {
    const status = await api<DebugStatusResponse>("/api/debug/status?limit=180");
    setDebugStatus(status);
    return status;
  }

  function refreshDebugSilently() {
    void loadDebugStatus().catch(() => undefined);
  }

  async function handleAuthSuccess(response: AuthResponse) {
    setAuthUser(response.user);
    setAuthChecked(true);
    setError("");
    setShowLanding(false);
    setMobilePanel("chat");
    window.history.replaceState(null, "", "#workspace");
    setIsBooting(true);
    try {
      await loadWorkspaceData();
      refreshDebugSilently();
    } catch (authError) {
      setError(messageFromError(authError));
    } finally {
      setIsBooting(false);
    }
  }

  async function handleLogout() {
    setError("");
    try {
      await api<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } finally {
      setAuthUser(null);
      setNotebook(null);
      setActiveSourceId("");
      setSelectedArtifactId("");
      forgetRememberedNotebookId();
      setShowLanding(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  async function refreshNotebook(id = notebook?.id) {
    if (!id) return;
    const fresh = notebookWithPendingSourceOverrides(await loadNotebook(id));
    // Guard against late responses hijacking the UI after a notebook switch.
    setNotebook((current) => (current?.id === id ? fresh : current));
  }

  async function loadNotebook(id: string) {
    const response = await api<{ notebook: Notebook }>(`/api/notebooks/${id}`);
    return response.notebook;
  }

  function withSourceActiveState(current: Notebook, sourceIds: Set<string>, active: boolean) {
    const sources = current.sources.map((source) => (sourceIds.has(source.id) ? { ...source, active } : source));
    return {
      ...current,
      sources,
      active_source_count: sources.filter((source) => source.active).length,
    };
  }

  function applySourceActiveState(sourceIds: string[], active: boolean) {
    if (!sourceIds.length) return;
    const idSet = new Set(sourceIds);
    setNotebook((current) => (current ? withSourceActiveState(current, idSet, active) : current));
  }

  function trackPendingSourceActiveState(sourceIds: string[], active: boolean) {
    sourceIds.forEach((sourceId) => pendingSourceActiveOverridesRef.current.set(sourceId, active));
  }

  function clearPendingSourceActiveState(sourceIds: string[], active: boolean) {
    sourceIds.forEach((sourceId) => {
      if (pendingSourceActiveOverridesRef.current.get(sourceId) === active) {
        pendingSourceActiveOverridesRef.current.delete(sourceId);
      }
    });
  }

  function notebookWithPendingSourceOverrides(current: Notebook) {
    const overrides = pendingSourceActiveOverridesRef.current;
    if (!overrides.size) return current;
    const sources = current.sources.map((source) => {
      if (!overrides.has(source.id)) return source;
      return { ...source, active: Boolean(overrides.get(source.id)) };
    });
    return {
      ...current,
      sources,
      active_source_count: sources.filter((source) => source.active).length,
    };
  }

  async function refreshNotebookAfterSourceToggle(notebookId: string) {
    const fresh = notebookWithPendingSourceOverrides(await loadNotebook(notebookId));
    setNotebook((current) => (current?.id === notebookId ? fresh : current));
  }

  function openSourcesPanel() {
    setOpenMenu("");
    setMobilePanel("sources");
    window.requestAnimationFrame(() => {
      sourcePanelRef.current?.focus({ preventScroll: true });
      sourcePanelRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
      setSourcePanelFocusTick(Date.now());
      window.setTimeout(() => setSourcePanelFocusTick(0), 900);
    });
  }

  function workspacePointerWidth(target: WorkspaceResizeTarget, clientX: number) {
    const node = workspaceRef.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    const paddingLeft = Number.parseFloat(style.paddingLeft || "0");
    const paddingRight = Number.parseFloat(style.paddingRight || "0");
    const innerWidth = Math.max(0, rect.width - paddingLeft - paddingRight);
    const x = clampNumber(clientX - rect.left - paddingLeft, 0, innerWidth);
    return {
      innerWidth,
      width: target === "sources" ? x : innerWidth - x,
    };
  }

  function updateWorkspaceLayout(target: WorkspaceResizeTarget, width: number, innerWidth?: number) {
    const next = normalizeWorkspaceLayout({ ...workspacePreferredLayoutRef.current, [target]: width }, innerWidth);
    workspacePreferredLayoutRef.current = next;
    rememberWorkspaceLayout(next);
    setWorkspaceLayout(next);
  }

  function resizeWorkspaceFromPointer(target: WorkspaceResizeTarget, clientX: number) {
    const metrics = workspacePointerWidth(target, clientX);
    if (!metrics) return;
    updateWorkspaceLayout(target, metrics.width, metrics.innerWidth);
  }

  function startWorkspaceResize(target: WorkspaceResizeTarget, event: ReactPointerEvent<HTMLButtonElement>) {
    if (!workspaceRef.current) return;
    event.preventDefault();
    setWorkspaceResizeTarget(target);
    resizeWorkspaceFromPointer(target, event.clientX);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const handleMove = (moveEvent: PointerEvent) => resizeWorkspaceFromPointer(target, moveEvent.clientX);
    const stopResize = () => {
      setWorkspaceResizeTarget("");
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }

  function handleWorkspaceResizeKey(target: WorkspaceResizeTarget, event: ReactKeyboardEvent<HTMLButtonElement>) {
    const keyStep = event.shiftKey ? 48 : 24;
    let delta = 0;
    if (event.key === "Home") {
      event.preventDefault();
      updateWorkspaceLayout(target, target === "sources" ? WORKSPACE_MIN_SOURCE : WORKSPACE_MIN_STUDIO, workspaceRef.current ? workspaceInnerWidth(workspaceRef.current) : undefined);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      updateWorkspaceLayout(target, target === "sources" ? WORKSPACE_MAX_SOURCE : WORKSPACE_MAX_STUDIO, workspaceRef.current ? workspaceInnerWidth(workspaceRef.current) : undefined);
      return;
    }
    if (target === "sources") {
      if (event.key === "ArrowLeft") delta = -keyStep;
      if (event.key === "ArrowRight") delta = keyStep;
    } else {
      if (event.key === "ArrowLeft") delta = keyStep;
      if (event.key === "ArrowRight") delta = -keyStep;
    }
    if (!delta) return;
    event.preventDefault();
    const innerWidth = workspaceRef.current ? workspaceInnerWidth(workspaceRef.current) : undefined;
    updateWorkspaceLayout(target, workspaceLayout[target] + delta, innerWidth);
  }

  function resetWorkspaceLayout() {
    const innerWidth = workspaceRef.current ? workspaceInnerWidth(workspaceRef.current) : undefined;
    const next = normalizeWorkspaceLayout(DEFAULT_WORKSPACE_LAYOUT, innerWidth);
    workspacePreferredLayoutRef.current = DEFAULT_WORKSPACE_LAYOUT;
    rememberWorkspaceLayout(DEFAULT_WORKSPACE_LAYOUT);
    setWorkspaceLayout(next);
  }

  function closeArtifactDetail() {
    setIsArtifactDetailOpen(false);
  }

  async function pollSourcesUntilReady(sourceIds: string[], notebookId: string) {
    const pendingSourceIds = new Set(sourceIds.filter(Boolean));
    if (!pendingSourceIds.size) return;
    const deadline = Date.now() + 8 * 60 * 1000;
    while (Date.now() < deadline && pendingSourceIds.size) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      let fresh: Notebook;
      try {
        fresh = await loadNotebook(notebookId);
      } catch {
        break;
      }
      setNotebook((current) => {
        if (current?.id !== notebookId) return current;
        const withOverrides = notebookWithPendingSourceOverrides(fresh);
        if (!deletingSourceIdsRef.current.size) return withOverrides;
        const sources = withOverrides.sources.filter((source) => !deletingSourceIdsRef.current.has(source.id));
        return {
          ...withOverrides,
          sources,
          source_count: sources.length,
          active_source_count: sources.filter((source) => source.active).length,
        };
      });
      let indexedAny = false;
      for (const sourceId of Array.from(pendingSourceIds)) {
        const source = fresh.sources.find((item) => item.id === sourceId);
        if (!source || source.status === "indexed" || source.status === "failed") {
          pendingSourceIds.delete(sourceId);
          if (source?.status === "failed") {
            setError(sourceIds.length > 1
              ? "One source could not be indexed. Try again, or paste the text/transcript directly."
              : "That source could not be indexed. Try again, or paste the text/transcript directly.");
          }
          if (source?.status === "indexed") indexedAny = true;
        }
      }
      if (!pendingSourceIds.size) {
        if (indexedAny) {
          // The server auto-names the notebook just after indexing finishes; poll a few
          // more times so the AI-suggested title appears without a manual refresh.
          for (let attempt = 0; attempt < 5 && isDefaultNotebookTitle(fresh.title); attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            try {
              fresh = await loadNotebook(notebookId);
            } catch {
              break;
            }
            setNotebook((current) => (current?.id === notebookId ? notebookWithPendingSourceOverrides(fresh) : current));
          }
        }
        refreshDebugSilently();
        break;
      }
    }
  }

  async function pollSourceUntilReady(sourceId: string, notebookId: string) {
    await pollSourcesUntilReady([sourceId], notebookId);
  }

  async function handleSeedReset() {
    setIsBooting(true);
    setError("");
    try {
      const seeded = await api<{ notebook: Notebook }>("/api/seed", {
        method: "POST",
        body: JSON.stringify({ reset: true }),
      });
      setNotebook(seeded.notebook);
      rememberNotebookId(seeded.notebook.id);
      setActiveSourceId(seeded.notebook.sources[0]?.id || "");
      setSelectedArtifactId(seeded.notebook.artifacts[0]?.id || "");
      setToast("Notebook rebuilt.");
      refreshDebugSilently();
    } catch (seedError) {
      setError(messageFromError(seedError));
    } finally {
      setIsBooting(false);
    }
  }

  function openNotepad(initial: { title?: string; body?: string } = {}) {
    setNoteTitle(initial.title || "");
    setNoteBody(initial.body || "");
    setIsNotepadOpen(true);
  }

  async function handleSaveNote() {
    if (!notebook) return;
    const body = noteBody.trim();
    if (!body) {
      setError("Write something in the note before saving it as a source.");
      return;
    }
    setNoteSaving(true);
    setError("");
    try {
      const response = await api<{ source: Source }>(`/api/notebooks/${notebook.id}/sources`, {
        method: "POST",
        body: JSON.stringify({
          type: "note",
          title: noteTitle.trim() || "Note",
          body,
          active: true,
        }),
      });
      setActiveSourceId(response.source.id);
      setIsNotepadOpen(false);
      setNoteTitle("");
      setNoteBody("");
      setToast("Note saved to sources.");
      await refreshNotebook();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save the note.");
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleSourceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!notebook) return;
    if (sourceFileQueue.length) {
      await uploadQueuedSourceFiles();
      return;
    }
    if (!isSourceReady) {
      const notice = sourceNeedsUrl(sourceForm.type)
        ? `Add a ${sourceTypeLabel(sourceForm.type)} URL or paste fallback text first.`
        : sourceAcceptsFile(sourceForm.type)
          ? `Choose a ${sourceTypeLabel(sourceForm.type)} file or paste extracted text first.`
          : "Paste source text or choose a file first.";
      setSourceFormNotice(notice);
      setSourceFormNoticeTone("error");
      sourceBodyRef.current?.focus();
      return;
    }
    // Be flexible about URLs: accept "blockresearch.ai" without a scheme by
    // defaulting to https:// (also covers youtu.be/... and www. links).
    let originalUrl = sourceForm.original_url.trim();
    if (sourceNeedsUrl(sourceForm.type) && originalUrl && !/^[a-z][a-z0-9+.-]*:\/\//i.test(originalUrl)) {
      originalUrl = `https://${originalUrl.replace(/^\/+/, "")}`;
    }
    setIsAddingSource(true);
    setError("");
    setSourceFormNotice("");
    setSourceFormNoticeTone("error");
    try {
      if (sourceForm.type === "youtube" && youtubeImportMode === "channel") {
        const batch = await api<{
          channel_title: string;
          queued: number;
          skipped_existing: number;
          sources: Source[];
        }>(`/api/notebooks/${notebook.id}/sources/youtube-batch`, {
          method: "POST",
          body: JSON.stringify({ channel_url: originalUrl, count: youtubeBatchCount }),
        });
        setActiveSourceId(batch.sources[0]?.id || "");
        setSourceForm(emptySourceForm);
        setIsAddSourceOpen(false);
        await refreshNotebook();
        const channelLabel = batch.channel_title ? `${batch.channel_title}: ` : "";
        const skippedLabel = batch.skipped_existing ? ` (${batch.skipped_existing} already imported)` : "";
        setToast(`${channelLabel}${batch.queued} video${batch.queued === 1 ? "" : "s"} queued — transcribing in the background…${skippedLabel}`);
        refreshDebugSilently();
        void pollSourcesUntilReady(batch.sources.map((item) => item.id), notebook.id);
        return;
      }
      const response = await api<{ source: Source }>(`/api/notebooks/${notebook.id}/sources`, {
        method: "POST",
        body: JSON.stringify({
          type: sourceForm.type,
          title: sourceForm.title.trim() || undefined,
          body: sourceForm.body.trim(),
          original_url: originalUrl,
          file_name: sourceForm.file_name,
          mime_type: sourceForm.mime_type,
          base64: sourceForm.base64,
          active: true,
          // Ingest the single linked page (NotebookLM-style), not a full-site crawl.
          crawl: false,
        }),
      });
      setActiveSourceId(response.source.id);
      setSourceForm(emptySourceForm);
      setIsAddSourceOpen(false);
      await refreshNotebook();
      setToast("Source added — transcribing and indexing…");
      refreshDebugSilently();
      // Parsing runs in the background (e.g. YouTube audio transcription); poll the
      // source until it finishes so the card updates from "Indexing…" to word count.
      void pollSourceUntilReady(response.source.id, notebook.id);
    } catch (sourceError) {
      // Surface the failure inside the modal (the global banner sits behind it).
      setSourceFormNotice(
        messageFromError(sourceError) || "Could not add this source. Check the link or file and try again.",
      );
      setSourceFormNoticeTone("error");
    } finally {
      setIsAddingSource(false);
    }
  }

  function queueSourceFiles(files: File[]) {
    if (!files.length) return false;
    const accepted = files.filter((file) => file.size <= MAX_SOURCE_UPLOAD_BYTES);
    const rejected = files.length - accepted.length;
    if (!accepted.length) {
      setSourceFormNotice(`Uploaded files can be up to ${SOURCE_UPLOAD_LIMIT_LABEL}.`);
      setSourceFormNoticeTone("error");
      return false;
    }
    setSourceFileQueue((current) => {
      const existing = new Set(current.map((item) => sourceFileFingerprint(item.file)));
      const additions = accepted
        .filter((file) => !existing.has(sourceFileFingerprint(file)))
        .map((file) => queuedSourceFile(file));
      return [...current, ...additions];
    });
    const first = accepted[0];
    setSourceForm((current) => ({
      ...current,
      type: sourceTypeFromFile(first),
      title: "",
      file_name: first.name,
      mime_type: first.type || "application/octet-stream",
      base64: undefined,
      body: "",
    }));
    setSourceFormNotice(
      rejected
        ? `${rejected} file${rejected === 1 ? "" : "s"} skipped because uploads are limited to ${SOURCE_UPLOAD_LIMIT_LABEL} each.`
        : `${accepted.length} file${accepted.length === 1 ? "" : "s"} ready to add.`,
    );
    setSourceFormNoticeTone(rejected ? "warning" : "success");
    return true;
  }

  async function uploadQueuedSourceFiles() {
    if (!notebook || !sourceFileQueue.length) return;
    const notebookId = notebook.id;
    const queue = sourceFileQueue.filter((item) => item.status !== "added");
    if (!queue.length) {
      setSourceFileQueue([]);
      setSourceForm(emptySourceForm);
      setIsAddSourceOpen(false);
      return;
    }
    const queuedIds = new Set(queue.map((item) => item.id));
    setIsAddingSource(true);
    setError("");
    setSourceFormNotice("");
    setSourceFormNoticeTone("error");
    try {
      setSourceFileQueue((current) => current.map((queued) =>
        queuedIds.has(queued.id)
          ? {
              ...queued,
              status: "adding",
              error: "",
              progress: 8,
              progressLabel: "Queued",
              progressDetail: "Waiting for upload slot",
            }
          : queued,
      ));
      const uploadOne = async (item: (typeof queue)[number]) => {
        let lastUploadPercent = 0;
        const updateQueuedFile = (patch: Partial<QueuedSourceFile>) => {
          setSourceFileQueue((current) => current.map((queued) =>
            queued.id === item.id ? { ...queued, ...patch } : queued,
          ));
        };
        try {
          const [base64, body] = await Promise.all([
            fileToBase64(item.file, (readProgress) => {
              const progress = 2 + Math.round(readProgress * 24);
              updateQueuedFile({
                progress,
                progressLabel: "Reading file",
                progressDetail: `${progress}% prepared`,
              });
            }),
            isTextLikeFile(item.file) ? item.file.text() : Promise.resolve(""),
          ]);
          updateQueuedFile({
            progress: 28,
            progressLabel: "Uploading file",
            progressDetail: `Starting transfer · ${formatFileSize(item.size)}`,
          });
          const response = await apiWithUploadProgress<{ source: Source }>(
            `/api/notebooks/${notebookId}/sources`,
            {
              type: item.type,
              title: sourceFileQueue.length === 1 ? sourceForm.title.trim() || item.title : item.title,
              body,
              file_name: item.file_name,
              mime_type: item.mime_type,
              base64,
              active: true,
              crawl: false,
              defer_indexing: true,
            },
            (uploadProgress) => {
              const transferRatio = uploadProgress.total ? uploadProgress.loaded / uploadProgress.total : uploadProgress.percent ?? 0;
              const progress = Math.min(96, 28 + Math.round(transferRatio * 68));
              if (progress <= lastUploadPercent) return;
              lastUploadPercent = progress;
              updateQueuedFile({
                progress,
                progressLabel: "Uploading file",
                progressDetail: uploadProgress.total
                  ? `${formatFileSize(uploadProgress.loaded)} / ${formatFileSize(uploadProgress.total)} transferred`
                  : `${progress}% transferred`,
              });
            },
          );
          updateQueuedFile({
            status: "added",
            sourceId: response.source.id,
            progress: 100,
            progressLabel: "Upload accepted",
            progressDetail: "Indexing continues in Sources",
          });
          return { itemId: item.id, source: response.source, sourceId: response.source.id, ok: true as const };
        } catch (uploadError) {
          updateQueuedFile({
            status: "failed",
            error: messageFromError(uploadError),
            progress: 100,
            progressLabel: "Failed",
            progressDetail: messageFromError(uploadError),
          });
          return { itemId: item.id, error: messageFromError(uploadError), ok: false as const };
        }
      };
      // Base64-encoding holds ~1.33x the file in memory per upload; big files in
      // parallel can OOM the tab, so anything above the threshold runs alone.
      const smallFiles = queue.filter((item) => item.size < LARGE_UPLOAD_SEQUENTIAL_BYTES);
      const largeFiles = queue.filter((item) => item.size >= LARGE_UPLOAD_SEQUENTIAL_BYTES);
      const results = [
        ...(await mapWithConcurrency(smallFiles, SOURCE_UPLOAD_PARALLELISM, uploadOne)),
        ...(await mapWithConcurrency(largeFiles, 1, uploadOne)),
      ];
      const addedSources = results.filter((result): result is Extract<typeof result, { ok: true }> => result.ok);
      const failed = results.length - addedSources.length;
      const sourceIds = addedSources.map((result) => result.sourceId);
      const acceptedSources = addedSources.map((result) => result.source);
      const lastSourceId = sourceIds[sourceIds.length - 1] || "";
      if (lastSourceId) setActiveSourceId(lastSourceId);
      if (!failed) {
        setNotebook((current) => {
          if (!current || current.id !== notebookId) return current;
          const existingIds = new Set(current.sources.map((source) => source.id));
          const mergedSources = [
            ...acceptedSources.filter((source) => !existingIds.has(source.id)),
            ...current.sources,
          ];
          return {
            ...current,
            sources: mergedSources,
            source_count: mergedSources.length,
            active_source_count: mergedSources.filter((source) => source.active).length,
          };
        });
        setSourceFileQueue([]);
        setSourceForm(emptySourceForm);
        setIsAddSourceOpen(false);
        setMobilePanel("sources");
        setToast(`${addedSources.length} file${addedSources.length === 1 ? "" : "s"} uploaded. Indexing continues in Sources.`);
        void refreshNotebook(notebookId);
        refreshDebugSilently();
        if (sourceIds.length) void pollSourcesUntilReady(sourceIds, notebookId);
      } else {
        if (sourceIds.length) {
          void refreshNotebook(notebookId);
          void pollSourcesUntilReady(sourceIds, notebookId);
        }
        setSourceFormNotice(`${failed} of ${queue.length} file${queue.length === 1 ? "" : "s"} could not be added. Fix or remove them and try again.`);
        setSourceFormNoticeTone("error");
        if (addedSources.length) setToast(`${addedSources.length} source${addedSources.length === 1 ? "" : "s"} added; ${failed} failed.`);
      }
    } finally {
      setIsAddingSource(false);
    }
  }

  function clearSourceFileQueue() {
    if (isAddingSource) return;
    setSourceFileQueue([]);
    setSourceForm((current) => ({ ...current, file_name: "", mime_type: "", base64: undefined }));
    setSourceFormNotice("");
    setSourceFormNoticeTone("error");
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length) queueSourceFiles(files);
    event.target.value = "";
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length) queueSourceFiles(files);
  }

  async function toggleSource(source: Source) {
    const previousNotebook = notebook;
    if (!previousNotebook) return;
    const currentSource = previousNotebook.sources.find((item) => item.id === source.id) || source;
    const nextActive = !currentSource.active;
    setError("");
    trackPendingSourceActiveState([source.id], nextActive);
    applySourceActiveState([source.id], nextActive);
    try {
      await api(`/api/sources/${source.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
      });
      clearPendingSourceActiveState([source.id], nextActive);
      await refreshNotebookAfterSourceToggle(previousNotebook.id);
      refreshDebugSilently();
    } catch (toggleError) {
      clearPendingSourceActiveState([source.id], nextActive);
      setNotebook((current) => (current?.id === previousNotebook.id ? previousNotebook : current));
      setError(messageFromError(toggleError));
    }
  }

  async function deleteSource(source: Source) {
    setError("");
    const previousNotebook = notebook;
    if (!previousNotebook) return;
    const remainingSources = previousNotebook.sources.filter((item) => item.id !== source.id);
    const nextActiveSourceId = remainingSources[0]?.id || "";
    deletingSourceIdsRef.current.add(source.id);
    setNotebook({
      ...previousNotebook,
      sources: remainingSources,
      source_count: remainingSources.length,
      active_source_count: remainingSources.filter((item) => item.active).length,
    });
    setActiveSourceId((current) => (current === source.id ? nextActiveSourceId : current));
    setToast("Removing source…");
    try {
      await api(`/api/sources/${source.id}`, { method: "DELETE" });
      setToast("Source removed from notebook and indexes.");
      void refreshNotebook(previousNotebook.id).catch(() => undefined);
      refreshDebugSilently();
    } catch (deleteError) {
      setNotebook((current) => (current?.id === previousNotebook.id ? previousNotebook : current));
      setActiveSourceId((current) => current || source.id);
      setError(messageFromError(deleteError));
    } finally {
      deletingSourceIdsRef.current.delete(source.id);
    }
  }

  async function askQuestion(input = question) {
    const trimmed = input.trim();
    if (!notebook || !trimmed || askInFlightRef.current) return;
    askInFlightRef.current = true;
    setIsAsking(true);
    setError("");
    setQuestion("");
    // Show the user's message on the right immediately (optimistic), before the answer returns.
    setPendingQuestion(trimmed);
    try {
      const response = await api<{
        message: ChatMessage;
        evidence_pack: { active_source_ids: string[] };
      }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          notebook_id: notebook.id,
          question: trimmed,
          answer_style: answerStyle,
          chat_goal: "Source-only mode. Cite every factual claim.",
        }),
      });
      // Load the fresh notebook, then swap in the persisted messages and drop the optimistic
      // copy in the same render so the user's bubble never flashes twice.
      const fresh = await loadNotebook(notebook.id);
      setNotebook((current) => (current?.id === fresh.id ? fresh : current));
      setPendingQuestion("");
      const firstCitation = response.message.citations?.[0];
      if (firstCitation) focusCitation(firstCitation);
      setToast(
        response.message.mode === "abstained"
          ? "Source-only mode abstained because evidence was insufficient."
          : "Answer grounded and verified.",
      );
      refreshDebugSilently();
    } catch (chatError) {
      // On failure nothing was saved server-side: clear the optimistic bubble and
      // restore the text to the input so the user doesn't lose it.
      setPendingQuestion("");
      setQuestion(trimmed);
      setError(messageFromError(chatError));
    } finally {
      askInFlightRef.current = false;
      setIsAsking(false);
    }
  }

  async function createArtifact(type: ArtifactType, overrideOptions: Record<string, unknown> = {}) {
    if (!notebook) return;
    if (creatingTypes.has(type)) return;
    const artifactLabel =
      type === "report" && typeof overrideOptions.report_type === "string"
        ? overrideOptions.report_type
        : artifactTitle(type);
    setCreatingTypes((current) => new Set(current).add(type));
    setToast(`Generating ${artifactLabel}…`);
    setError("");
    try {
      const start = await api<{ job: ArtifactJob }>("/api/artifacts", {
        method: "POST",
        body: JSON.stringify({
          notebook_id: notebook.id,
          type,
          options: type === "audio"
            ? {
                format: audioOptions.format,
                length: audioOptions.length,
                language: audioOptions.language,
                prompt: audioOptions.prompt.trim(),
              }
            : type === "flashcards"
              ? flashcardArtifactOptions(flashcardOptions)
            : type === "thumbnail"
              ? { prompt: thumbnailPrompt.trim(), reference_images: thumbnailRefs }
              : type === "youtube-kit"
                ? { language: "English", ...overrideOptions }
                : overrideOptions,
        }),
      });
      // The artifact is generated in the background; poll the job until it finishes.
      // Long outputs (audio/video, 60-120s) would otherwise exceed Firebase Hosting's
      // ~60s rewrite-proxy timeout. Each poll is a fast request, so it stays well under.
      let job = start.job;
      const deadline = Date.now() + artifactPollDeadlineMs(type);
      let pollFailures = 0;
      while (job && (job.status === "queued" || job.status === "running") && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          const poll = await api<{ job: ArtifactJob }>(`/api/jobs/${job.id}`);
          job = poll.job;
          pollFailures = 0;
        } catch (pollError) {
          // The job keeps running server-side; a transient network blip while
          // polling must not surface as a generation failure.
          pollFailures += 1;
          if (pollFailures >= 5) throw pollError;
          continue;
        }
        if (job?.status === "running" && job.progress > 0) {
          setToast(`Generating ${artifactLabel}… ${job.progress}%`);
        }
      }
      if (!job || job.status !== "completed" || !job.result_artifact_id) {
        if (job && (job.status === "queued" || job.status === "running")) {
          setToast(`${artifactLabel} is still generating in the background. Open Activity for status.`);
          refreshDebugSilently();
          return;
        }
        throw new Error(job?.error || "Generation failed. Please try again.");
      }
      await refreshNotebook();
      // Don't hijack the view: only auto-open the result if nothing else is open,
      // so concurrent generations finishing don't yank you between results.
      setSelectedArtifactId((current) => current || job.result_artifact_id);
      setToast(`${artifactLabel} ready.`);
      refreshDebugSilently();
    } catch (artifactError) {
      setError(messageFromError(artifactError));
    } finally {
      setCreatingTypes((current) => {
        const next = new Set(current);
        next.delete(type);
        return next;
      });
    }
  }

  function closeReportFormatModal() {
    setCustomizeType("");
    setIsCustomReportPromptOpen(false);
  }

  function handleReportFormat(format: ReportFormatOption) {
    if (creatingTypes.has("report")) return;
    if (format.kind === "custom") {
      setIsCustomReportPromptOpen(true);
      return;
    }
    closeReportFormatModal();
    void createArtifact("report", reportArtifactOptions(format));
  }

  function handleCustomReportGenerate() {
    if (creatingTypes.has("report")) return;
    const customFormat = baseReportFormatOptions[0];
    closeReportFormatModal();
    void createArtifact("report", reportArtifactOptions(customFormat, customReportPrompt));
  }

  function handleStudioArtifact(artifact: StudioArtifactTool) {
    if (artifact.type === "audio" || artifact.type === "flashcards" || artifact.type === "thumbnail" || artifact.type === "report") {
      if (artifact.type === "report") {
        setIsCustomReportPromptOpen(false);
      }
      setCustomizeType(artifact.type);
      return;
    }
    void createArtifact(artifact.type);
  }

  function toggleArtifactAudio(artifact: Artifact) {
    const el = inlineAudioRef.current;
    if (!el) return;
    if (playingArtifactId === artifact.id) {
      el.pause();
      setPlayingArtifactId("");
      return;
    }
    el.src = `/api/artifacts/${artifact.id}/media`;
    el.play()
      .then(() => setPlayingArtifactId(artifact.id))
      .catch(() => {
        setPlayingArtifactId("");
        setError("Audio isn't ready to play yet. Open the output to check its status.");
      });
  }

  async function deleteArtifactOutput(artifact: Artifact) {
    if (!notebook || deletingArtifactIds.has(artifact.id)) return;
    const previousNotebook = notebook;
    const wasSelected = selectedArtifactId === artifact.id;
    setDeletingArtifactIds((current) => new Set(current).add(artifact.id));
    if (playingArtifactId === artifact.id) {
      inlineAudioRef.current?.pause();
      setPlayingArtifactId("");
    }
    if (wasSelected) closeArtifactDetail();
    setNotebook({
      ...previousNotebook,
      artifacts: previousNotebook.artifacts.filter((item) => item.id !== artifact.id),
    });
    if (wasSelected) setSelectedArtifactId("");
    try {
      await api(`/api/artifacts/${artifact.id}`, { method: "DELETE" });
      setToast("Output deleted.");
      refreshDebugSilently();
    } catch (deleteError) {
      setNotebook((current) => (current?.id === previousNotebook.id ? previousNotebook : current));
      if (wasSelected) setSelectedArtifactId(artifact.id);
      setError(messageFromError(deleteError));
    } finally {
      setDeletingArtifactIds((current) => {
        const next = new Set(current);
        next.delete(artifact.id);
        return next;
      });
    }
  }

  async function deleteAllArtifactOutputs() {
    if (!notebook || !notebook.artifacts.length || isDeletingAllArtifacts) return;
    const confirmed = await askConfirm({
      title: "Clear all outputs?",
      message: `All ${notebook.artifacts.length} outputs will be deleted from this notebook. Sources and chat will stay.`,
      confirmLabel: "Delete outputs",
    });
    if (!confirmed) return;
    const previousNotebook = notebook;
    inlineAudioRef.current?.pause();
    setPlayingArtifactId("");
    setIsDeletingAllArtifacts(true);
    closeArtifactDetail();
    setSelectedArtifactId("");
    setNotebook({ ...previousNotebook, artifacts: [], jobs: [] });
    try {
      const result = await api<{ deleted?: number }>(`/api/notebooks/${previousNotebook.id}/artifacts`, { method: "DELETE" });
      setToast(`${result.deleted ?? previousNotebook.artifacts.length} outputs deleted.`);
      refreshDebugSilently();
    } catch (deleteError) {
      setNotebook((current) => (current?.id === previousNotebook.id ? previousNotebook : current));
      setError(messageFromError(deleteError));
    } finally {
      setIsDeletingAllArtifacts(false);
    }
  }

  const focusCitation = useCallback((citation: Citation) => {
    const sourceId = citation.source_id || citation.sourceId || "";
    setActiveSourceId(sourceId);
    setHighlightedBlockIds(citation.block_ids || []);
    setMobilePanel("sources");
    // Open the passage viewer immediately (with the quote as fallback content)
    // and pull the source's full blocks so the cited ones can be highlighted
    // in their surrounding context.
    citedScrolledRef.current = false;
    setCitationViewer({ citation, blocks: null });
    api<{ blocks: SourceBlock[] }>(`/api/sources/${sourceId}/blocks`)
      .then((response) =>
        setCitationViewer((current) =>
          current && current.citation === citation ? { ...current, blocks: response.blocks || [] } : current,
        ),
      )
      .catch(() =>
        setCitationViewer((current) => (current && current.citation === citation ? { ...current, blocks: [] } : current)),
      );
  }, []);

  const scrollCitedBlockIntoView = useCallback((node: HTMLElement | null) => {
    if (node && !citedScrolledRef.current) {
      citedScrolledRef.current = true;
      window.requestAnimationFrame(() => node.scrollIntoView({ block: "center", behavior: "smooth" }));
    }
  }, []);

  function askConfirm(options: { title: string; message: string; confirmLabel?: string }) {
    return new Promise<boolean>((resolve) => {
      setConfirmRequest({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel || "Delete",
        resolve,
      });
    });
  }

  function resolveConfirm(confirmed: boolean) {
    confirmRequest?.resolve(confirmed);
    setConfirmRequest(null);
  }

  useEffect(() => {
    if (!confirmRequest && !citationViewer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirmRequest) {
        confirmRequest.resolve(false);
        setConfirmRequest(null);
      } else {
        setCitationViewer(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmRequest, citationViewer]);

  function openWorkspace(nextAuthMode?: unknown) {
    setShowLanding(false);
    setMobilePanel("chat");
    if (!authUser) setAuthMode(normalizeAuthMode(nextAuthMode));
    window.history.replaceState(null, "", "#workspace");
  }

  function openHome() {
    setShowLanding(true);
    window.history.replaceState(null, "", window.location.pathname);
  }

  function saveOverviewToNote() {
    if (!notebook) return;
    const activeSources = notebook.sources.filter((source) => source.active);
    const summary = notebook.summary || activeSources.find((source) => source.summary)?.summary || "";
    const sourceLine = activeSources.length
      ? `Sources: ${activeSources.map((source) => source.title).join(", ")}`
      : "";
    openNotepad({
      title: `${notebook.title} overview`,
      body: [summary, sourceLine].filter(Boolean).join("\n\n"),
    });
  }

  async function handleThumbnailRefs(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    const urls = await Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.readAsDataURL(file);
          }),
      ),
    );
    setThumbnailRefs((current) => [...current, ...urls.filter(Boolean)].slice(0, 4));
  }

  function exportNotebook() {
    if (!notebook) return;
    const payload = {
      product: BRAND_NAME,
      exported_at: new Date().toISOString(),
      provider: {
        active_grounded_answer_provider: providerStatus?.active_grounded_answer_provider || "local",
        grounded_answer_model: providerStatus?.grounded_answer_model || "local-grounded-v1",
        external_grounded_answer_enabled: Boolean(providerStatus?.external_grounded_answer_enabled),
      },
      notebook: {
        id: notebook.id,
        title: notebook.title,
        description: notebook.description,
        summary: notebook.summary,
        active_source_count: notebook.active_source_count,
        source_count: notebook.source_count,
        sources: notebook.sources.map((source) => ({
          id: source.id,
          type: source.type,
          title: source.title,
          original_url: source.original_url,
          status: source.status,
          active: source.active,
          block_count: source.block_count,
          chunk_count: source.chunk_count,
          word_count: source.word_count,
          summary: source.summary,
        })),
        messages: notebook.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          provider: message.provider,
          model: message.model,
          mode: message.mode,
          claim_stats: message.claim_stats,
          citations: message.citations,
          created_at: message.created_at,
        })),
        artifacts: notebook.artifacts.map((artifact) => ({
          id: artifact.id,
          type: artifact.type,
          title: artifact.title,
          content_json: artifact.content_json,
          source_refs_json: artifact.source_refs_json,
          created_at: artifact.created_at,
        })),
      },
    };
    downloadText(`${downloadSlug(notebook.title)}-export.json`, JSON.stringify(payload, null, 2));
    setToast("Notebook export downloaded as JSON.");
  }

  function buildShareMarkdown() {
    if (!notebook) return "";
    const activeSources = notebook.sources.filter((source) => source.active);
    const latestAssistant = [...visibleMessages].reverse().find((message) => message.role === "assistant");
    const provider = [
      providerStatus?.active_grounded_answer_provider || "local",
      providerStatus?.grounded_answer_model || "local-grounded-v1",
    ].filter(Boolean).join(" · ");
    const sourceLines = activeSources.slice(0, 16).map((source, index) => {
      const meta = [
        sourceTypeLabel(source.type),
        source.word_count ? `${source.word_count} words` : "",
        source.original_url || "",
      ].filter(Boolean).join(" · ");
      return `${index + 1}. ${source.title}${meta ? ` (${meta})` : ""}`;
    });
    const artifactLines = notebook.artifacts.slice(0, 16).map((artifact, index) => {
      const meta = [
        artifactTitle(artifact.type),
        artifact.created_at ? formatArtifactTimestamp(artifact.created_at) : "",
      ].filter(Boolean).join(" · ");
      return `${index + 1}. ${artifact.title}${meta ? ` (${meta})` : ""}`;
    });

    const lines = [
      `# ${notebook.title || "Untitled notebook"}`,
      "",
      notebook.summary ? `> ${notebook.summary}` : "",
      "",
      "## Notebook",
      `- Active sources: ${activeSources.length} / ${notebook.sources.length}`,
      `- Studio outputs: ${notebook.artifacts.length}`,
      `- Grounded answer provider: ${provider}`,
      `- Exported: ${new Date().toISOString()}`,
      "",
      "## Sources",
      sourceLines.length ? sourceLines.join("\n") : "No active sources.",
      activeSources.length > sourceLines.length ? `...and ${activeSources.length - sourceLines.length} more active sources.` : "",
      "",
      "## Latest grounded answer",
      latestAssistant ? clipReportText(latestAssistant.content, 4500) : "No grounded answer yet.",
      "",
      "## Studio outputs",
      artifactLines.length ? artifactLines.join("\n") : "No Studio outputs yet.",
    ];
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  async function copyShareBrief() {
    if (!notebook) return;
    try {
      await copyTextToClipboard(buildShareMarkdown());
      setIsShareOpen(false);
      setToast("Share brief copied.");
    } catch (copyError) {
      setError(messageFromError(copyError));
    }
  }

  function downloadShareBrief() {
    if (!notebook) return;
    downloadText(`${downloadSlug(notebook.title)}-evidence-brief.md`, buildShareMarkdown(), "text/markdown");
    setIsShareOpen(false);
    setToast("Share brief downloaded as Markdown.");
  }

  const sourceCount = notebook?.sources.length || 0;
  const activeCount = notebook?.active_source_count || 0;
  const activeProviderLabel = providerLabel(providerStatus);
  const runningDebugJobs = debugStatus?.debug.running_jobs.length || notebook?.jobs.filter((job) => ["queued", "running"].includes(job.status)).length || 0;
  const isWorking = isBooting || isAddingSource || isAsking || creatingTypes.size > 0 || runningDebugJobs > 0;
  const workspaceStyle = {
    "--workspace-source-width": `${workspaceLayout.sources}px`,
    "--workspace-studio-width": `${workspaceLayout.studio}px`,
  } as CSSProperties;

  if (showLanding) {
    return (
      <LandingPage
        sourceCount={sourceCount}
        providerLabel={activeProviderLabel}
        isBooting={isBooting}
        isAuthenticated={Boolean(authUser)}
        onOpenWorkspace={() => openWorkspace()}
        onSignIn={() => openWorkspace("login")}
        onCreateAccount={() => openWorkspace("signup")}
      />
    );
  }

  if (!authUser) {
    return (
      <AuthPage
        mode={authMode}
        resetToken={resetToken}
        providerLabel={activeProviderLabel}
        isBooting={!authChecked && isBooting}
        onModeChange={setAuthMode}
        onResetTokenChange={setResetToken}
        onAuthenticated={(response) => void handleAuthSuccess(response)}
        onBackHome={openHome}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-cluster">
          <button className="title-button brand-menu" type="button" onClick={openSourcesPanel} aria-label="Open sources">
            <PanelLeft size={18} />
          </button>
          <button className="brand-mark" type="button" onClick={openHome} aria-label={`${BRAND_EYEBROW} home`} title="Home">
            <img src={BRAND_LOGO_PATH} alt="" />
          </button>
          <div className="notebook-title-cluster">
            {isRenaming ? (
              <input
                className="notebook-title-input"
                value={titleDraft}
                autoFocus
                maxLength={160}
                aria-label="Notebook title"
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => {
                  const save = !renameEscapeRef.current;
                  renameEscapeRef.current = false;
                  exitRename(save);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    renameEscapeRef.current = true;
                    event.currentTarget.blur();
                  }
                }}
              />
            ) : (
              <>
                <h1 className="notebook-title" title={notebook?.title || "Untitled notebook"}>
                  {notebook?.title || "Untitled notebook"}
                </h1>
                <button
                  className="title-switch"
                  type="button"
                  onClick={() => { setTitleDraft(notebook?.title || ""); setIsRenaming(true); }}
                  aria-label="Rename notebook"
                  title="Rename notebook"
                  disabled={!notebook}
                >
                  <Pencil size={14} />
                </button>
              </>
            )}
            {!isRenaming && notebooks.length > 1 ? (
              <div className="menu-anchor">
                <button
                  className="title-switch"
                  type="button"
                  onClick={() => setOpenMenu((current) => (current === "notebooks" ? "" : "notebooks"))}
                  aria-label="Switch notebook"
                  aria-expanded={openMenu === "notebooks"}
                >
                  <ChevronDown size={16} />
                </button>
                {openMenu === "notebooks" ? (
                  <Menu align="start" onClose={() => setOpenMenu("")}>
                    <p className="menu-label">Your notebooks</p>
                    {notebooks.map((item) => (
                      <div key={item.id} className="menu-item-row">
                        <button
                          type="button"
                          className="menu-item"
                          data-active={item.id === notebook?.id}
                          onClick={() => void switchNotebook(item.id)}
                        >
                          <Library size={15} />
                          <span>{item.title || "Untitled notebook"}</span>
                          {item.id === notebook?.id ? <CheckCircle2 size={15} /> : null}
                        </button>
                        <button
                          type="button"
                          className="menu-item-delete"
                          aria-label={`Delete notebook ${item.title || "Untitled notebook"}`}
                          title="Delete notebook"
                          onClick={() => void deleteNotebookById(item)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="menu-divider" />
                    <button type="button" className="menu-item" onClick={() => void createNotebook()} disabled={isCreatingNotebook}>
                      {isCreatingNotebook ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
                      <span>{isCreatingNotebook ? "Creating…" : "Create notebook"}</span>
                    </button>
                  </Menu>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="topbar-actions">
          <button className="ghost-button create-notebook" type="button" onClick={() => void createNotebook()} disabled={isCreatingNotebook} aria-busy={isCreatingNotebook}>
            {isCreatingNotebook ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
            {isCreatingNotebook ? "Creating…" : "Create notebook"}
          </button>
          <button className="primary-button" type="button" onClick={() => setIsShareOpen(true)} disabled={!notebook}>
            <Share2 size={15} />
            Share
          </button>
          <div className="menu-anchor">
            <button
              className="icon-button"
              type="button"
              onClick={() => setOpenMenu((current) => (current === "settings" ? "" : "settings"))}
              aria-label="Settings"
              aria-expanded={openMenu === "settings"}
            >
              <Settings size={17} />
            </button>
            {openMenu === "settings" ? (
              <Menu align="end" onClose={() => setOpenMenu("")}>
                <p className="menu-label">Workspace</p>
                <button type="button" className="menu-item" onClick={() => { setOpenMenu(""); openHome(); }}>
                  <Compass size={15} />
                  <span>Home</span>
                </button>
                <button type="button" className="menu-item" onClick={() => { setOpenMenu(""); void handleSeedReset(); }}>
                  <RefreshCw size={15} />
                  <span>Rebuild seed</span>
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setOpenMenu("");
                    setIsDebugOpen(true);
                    refreshDebugSilently();
                  }}
                >
                  <ClipboardList size={15} />
                  <span>Debug activity</span>
                  {isWorking ? <span className="menu-pill">{Math.max(1, runningDebugJobs)}</span> : null}
                </button>
              </Menu>
            ) : null}
          </div>
          <div className="menu-anchor">
            <button
              className="avatar-button"
              type="button"
              onClick={() => setOpenMenu((current) => (current === "account" ? "" : "account"))}
              aria-label="Account"
              aria-expanded={openMenu === "account"}
              title={authUser.email}
            >
              {accountInitials(authUser.name, authUser.email)}
            </button>
            {openMenu === "account" ? (
              <Menu align="end" onClose={() => setOpenMenu("")}>
                <div className="menu-account">
                  <strong>{authUser.name}</strong>
                  <span>{authUser.email}</span>
                </div>
                <div className="menu-divider" />
                <button type="button" className="menu-item" onClick={() => { setOpenMenu(""); setIsSettingsOpen(true); }}>
                  <Settings size={15} />
                  <span>Settings</span>
                </button>
                <button type="button" className="menu-item" onClick={() => { setOpenMenu(""); void handleLogout(); }}>
                  <LogOut size={15} />
                  <span>Sign out</span>
                </button>
              </Menu>
            ) : null}
          </div>
        </div>
      </header>

      {error ? (
        <div className="toast error">
          <XCircle size={16} />
          <span className="toast-text">{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
            <XCircle size={14} />
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className="toast">
          <CheckCircle2 size={16} />
          <span className="toast-text">{toast}</span>
          <button type="button" onClick={() => setToast("")} aria-label="Dismiss notification">
            <XCircle size={14} />
          </button>
        </div>
      ) : null}

      {confirmRequest ? (
        <div className="modal-backdrop confirm-backdrop" role="presentation" onClick={() => resolveConfirm(false)}>
          <section
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={confirmRequest.title}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2><Trash2 size={18} /> {confirmRequest.title}</h2>
              </div>
              <button className="icon-button subtle" type="button" onClick={() => resolveConfirm(false)} aria-label="Close dialog">
                <X size={18} />
              </button>
            </div>
            <p className="confirm-modal-message">{confirmRequest.message}</p>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => resolveConfirm(false)}>Cancel</button>
              <button className="danger-button" type="button" autoFocus onClick={() => resolveConfirm(true)}>
                <Trash2 size={15} /> {confirmRequest.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {citationViewer ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setCitationViewer(null)}>
          <section
            className="modal citation-viewer-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Cited source passage"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2><FileText size={18} /> {citationViewer.citation.source_title || citationViewer.citation.sourceTitle || "Source"}</h2>
                <p className="citation-viewer-meta">
                  Citation [{citationViewer.citation.index}]
                  {citationViewer.citation.heading_path?.length ? ` · ${citationViewer.citation.heading_path.join(" / ")}` : ""}
                  {citationViewer.citation.page_number ? ` · page ${citationViewer.citation.page_number}` : ""}
                </p>
              </div>
              <button className="icon-button subtle" type="button" onClick={() => setCitationViewer(null)} aria-label="Close citation viewer">
                <X size={18} />
              </button>
            </div>
            <div className="citation-viewer-body">
              {citationViewer.blocks === null ? (
                <blockquote className="citation-block cited">{citationViewer.citation.quote}</blockquote>
              ) : citationViewer.blocks.length ? (
                citationViewer.blocks.map((block) => {
                  const cited = citationViewer.citation.block_ids?.includes(block.block_id);
                  return (
                    <p
                      key={block.block_id}
                      className={cited ? "citation-block cited" : "citation-block"}
                      ref={cited ? scrollCitedBlockIntoView : undefined}
                    >
                      {block.text}
                    </p>
                  );
                })
              ) : (
                <blockquote className="citation-block cited">{citationViewer.citation.quote}</blockquote>
              )}
            </div>
            <p className="citation-viewer-hint">Highlighted passages are the evidence this citation points to.</p>
          </section>
        </div>
      ) : null}

      <main
        ref={workspaceRef}
        className="workspace"
        data-active-panel={mobilePanel}
        data-resizing={workspaceResizeTarget || undefined}
        style={workspaceStyle}
      >
        <section
          ref={sourcePanelRef}
          className="panel source-panel"
          aria-label="Sources panel"
          tabIndex={-1}
          data-focus-pulse={sourcePanelFocusTick > 0}
        >
          <PanelHeader icon={<Library size={18} />} title="Sources" count={sourceCount} />

          <div className="source-add">
            <button className="primary-button add-sources-button" type="button" onClick={() => openAddSource()}>
              <Plus size={16} />
              Add sources
            </button>
            <button className="ghost-button new-note-button" type="button" onClick={() => openNotepad()}>
              <NotebookPen size={15} />
              New note
            </button>
          </div>

          {sourceCount ? (
            <div className="source-select-row">
              <span>{activeCount} of {sourceCount} selected</span>
              <button
                type="button"
                className="select-all-button"
                onClick={() => void setAllSourcesActive(activeCount !== sourceCount)}
                aria-pressed={activeCount === sourceCount}
                aria-label={activeCount === sourceCount ? "Deselect all sources" : "Select all sources"}
              >
                {activeCount === sourceCount ? "Deselect all" : "Select all"}
                <span className="source-check" data-selected={activeCount === sourceCount} aria-hidden="true">
                  {activeCount === sourceCount ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </span>
              </button>
            </div>
          ) : null}

          <div className="source-list">
            {isBooting ? <SkeletonRows count={4} /> : null}
            {!isBooting && !sourceCount ? (
              <div className="source-empty">
                <Library size={22} />
                <p>No sources yet</p>
                <span>Add a document, note, or website to start grounding answers.</span>
              </div>
            ) : null}
            {notebook?.sources.map((source) => {
              const progress = sourceProgressInfo(source);
              return (
                <article
                  key={source.id}
                  className="source-card"
                  data-active={source.id === activeSourceId}
                  data-selected={source.active}
                  data-status={source.status}
                  data-working={Boolean(progress)}
                >
                  <button
                    type="button"
                    className="source-check"
                    data-selected={source.active}
                    onClick={() => void toggleSource(source)}
                    aria-label={source.active ? "Deselect source" : "Select source"}
                    aria-pressed={source.active}
                  >
                    {source.active ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                  <button className="source-card-main" type="button" onClick={() => setActiveSourceId(source.id)}>
                    <span className="source-icon" data-type={source.type}>{sourceIcon(source.type)}</span>
                    <span>
                      <strong>{source.title}</strong>
                      <small>{sourceStatusLine(source)}</small>
                      {progress ? (
                        <span className="source-progress" aria-label={`${progress.label}: ${progress.percent}%`}>
                          <span className="source-progress-track" aria-hidden="true">
                            <span className="source-progress-fill" style={{ width: `${progress.percent}%` }} />
                          </span>
                          <span className="source-progress-detail">{progress.detail}</span>
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <button className="icon-button subtle source-delete" type="button" onClick={() => void deleteSource(source)} aria-label="Delete source">
                    <Trash2 size={15} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <WorkspaceResizeHandle
          target="sources"
          active={workspaceResizeTarget === "sources"}
          onPointerDown={(event) => startWorkspaceResize("sources", event)}
          onKeyDown={(event) => handleWorkspaceResizeKey("sources", event)}
          onReset={resetWorkspaceLayout}
        />

        <section className="panel chat-panel" aria-label="Chat panel">
          <div className="chat-toolbar">
            <div className="panel-header-lead">
              <span className="panel-icon"><MessageSquareText size={18} /></span>
              <h2>Chat</h2>
            </div>
            <div className="chat-toolbar-actions">
              <div className="answer-mode" aria-label="Answer style">
            {(["Strict", "Balanced", "Exploratory"] as AnswerStyle[]).map((mode) => (
              <button
                key={mode}
                type="button"
                data-active={answerStyle === mode}
                onClick={() => setAnswerStyle(mode)}
              >
                {mode}
              </button>
            ))}
              </div>
            </div>
          </div>

          <div className="messages" ref={messagesRef} role="log" aria-live="polite">
            {!visibleMessages.length && !isAsking ? (
              <ResearchCanvas
                title={notebook?.title || BRAND_NAME}
                activeCount={activeCount}
                sources={notebook?.sources || []}
                summary={notebook?.summary || ""}
                createdAt={notebook?.created_at || notebook?.sources[0]?.created_at || ""}
                suggestions={notebook?.suggested_questions?.length ? notebook.suggested_questions : defaultQuestions}
                onAsk={(prompt) => void askQuestion(prompt)}
                onSaveSummary={saveOverviewToNote}
                onCopyOverview={(text) => {
                  void (async () => {
                    try {
                      await copyTextToClipboard(text);
                      setToast("Overview copied.");
                    } catch (copyError) {
                      setError(messageFromError(copyError));
                    }
                  })();
                }}
              />
            ) : (
              visibleMessages.map((message) => (
                <ChatBubble key={message.id} message={message} onCitationClick={focusCitation} />
              ))
            )}
            {pendingQuestion ? (
              <ChatBubble
                key="pending-question"
                message={{ id: "pending-question", role: "user", content: pendingQuestion, created_at: "", citations: [] }}
                onCitationClick={focusCitation}
              />
            ) : null}
            {isAsking ? <ThinkingBubble topic={notebook?.title || ""} /> : null}
          </div>

          <form className="chat-input" onSubmit={(event) => {
            event.preventDefault();
            void askQuestion();
          }}>
            <textarea
              value={question}
              placeholder={activeCount ? "Ask anything about your sources…" : "Add a source to start asking…"}
              rows={1}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void askQuestion();
                }
              }}
            />
            <div className="chat-input-tools">
              <span className="source-count-chip" title={`${activeCount} active source${activeCount === 1 ? "" : "s"}`}>
                <Library size={13} />
                {activeCount} {activeCount === 1 ? "source" : "sources"}
              </span>
              <button className="send-button" type="submit" disabled={!question.trim() || isAsking} aria-label="Send message">
                {isAsking ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
              </button>
            </div>
          </form>

          <p className="ai-disclaimer">
            {ASSISTANT_NAME} can be inaccurate — answers stay grounded in your active sources, but double-check anything important.
          </p>
        </section>

        <WorkspaceResizeHandle
          target="studio"
          active={workspaceResizeTarget === "studio"}
          onPointerDown={(event) => startWorkspaceResize("studio", event)}
          onKeyDown={(event) => handleWorkspaceResizeKey("studio", event)}
          onReset={resetWorkspaceLayout}
        />

        <section className="panel studio-panel" aria-label="Studio panel">
          <PanelHeader icon={<Sparkles size={18} />} title="Studio" count={notebook?.artifacts.length || 0} />

          {customizeType === "report" ? (
          <div className="modal-backdrop report-format-backdrop" role="presentation" onClick={closeReportFormatModal}>
          <section className="modal report-format-modal" role="dialog" aria-modal="true" aria-label="Create report" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header report-format-header">
            <div>
              <h2><ClipboardList size={21} /> Create report</h2>
            </div>
            <button className="icon-button subtle report-format-close" type="button" onClick={closeReportFormatModal} aria-label="Close report formats">
              <X size={24} />
            </button>
          </div>
          <section className="report-format-body" aria-label="Report formats">
            <div className="report-format-section">
              <h3>Format</h3>
              <div className="report-format-grid">
                {baseReportFormatOptions.map((format) => (
                  <button
                    key={format.id}
                    type="button"
                    className="report-format-card"
                    data-kind={format.kind}
                    data-selected={format.kind === "custom" && isCustomReportPromptOpen}
                    onClick={() => handleReportFormat(format)}
                    disabled={creatingTypes.has("report")}
                  >
                    {format.kind !== "custom" ? (
                      <span className="report-format-edit" aria-hidden="true"><Pencil size={18} /></span>
                    ) : null}
                    <strong>{format.title}</strong>
                    <span>{format.description}</span>
                  </button>
                ))}
              </div>
              {isCustomReportPromptOpen ? (
                <div className="report-custom-panel">
                  <label>
                    <span>Describe the report</span>
                    <textarea
                      value={customReportPrompt}
                      onChange={(event) => setCustomReportPrompt(event.target.value)}
                      placeholder="Structure, audience, tone, sections, or angle"
                      rows={3}
                      autoFocus
                    />
                  </label>
                  <div className="report-custom-actions">
                    <button className="secondary-button" type="button" onClick={() => setIsCustomReportPromptOpen(false)}>Back</button>
                    <button className="primary-button" type="button" onClick={handleCustomReportGenerate} disabled={creatingTypes.has("report")}>
                      {creatingTypes.has("report") ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
                      Generate
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="report-format-section">
              <div className="report-suggested-heading">
                <Sparkles size={22} />
                <h3>Suggested Format</h3>
              </div>
              <div className="report-format-grid">
                {suggestedReportFormats.map((format) => (
                  <button
                    key={format.id}
                    type="button"
                    className="report-format-card"
                    data-kind={format.kind}
                    onClick={() => handleReportFormat(format)}
                    disabled={creatingTypes.has("report")}
                  >
                    <span className="report-format-edit" aria-hidden="true"><Pencil size={18} /></span>
                    <strong>{format.title}</strong>
                    <span>{format.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
          </section>
          </div>
          ) : null}

          {customizeType === "audio" ? (
          <div className="modal-backdrop" role="presentation" onClick={() => setCustomizeType("")}>
          <section className="modal customize-modal" role="dialog" aria-modal="true" aria-label="Customize audio overview" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header">
            <div><h2>Customize Audio Overview</h2></div>
            <button className="icon-button subtle" type="button" onClick={() => setCustomizeType("")} aria-label="Close customize"><X size={18} /></button>
          </div>
          <section className="audio-config" aria-label="Audio overview settings">
            <div className="audio-config-row">
              <label>
                <span>Format</span>
                <select
                  value={audioOptions.format}
                  onChange={(event) => setAudioOptions((current) => ({ ...current, format: event.target.value as AudioFormat }))}
                  disabled={false}
                >
                  {audioFormatOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Length</span>
                <select
                  value={audioOptions.length}
                  onChange={(event) => setAudioOptions((current) => ({ ...current, length: event.target.value as AudioLength }))}
                  disabled={false}
                >
                  {audioLengthOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="audio-config-row">
              <label>
                <span>Language</span>
                <select
                  value={audioOptions.language}
                  onChange={(event) => setAudioOptions((current) => ({ ...current, language: event.target.value }))}
                  disabled={false}
                >
                  {audioLanguageOptions.map((language) => (
                    <option key={language} value={language}>{language}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="audio-focus">
              <span>Focus</span>
              <textarea
                value={audioOptions.prompt}
                onChange={(event) => setAudioOptions((current) => ({ ...current, prompt: event.target.value }))}
                disabled={false}
                placeholder="Topic, audience, or angle"
                rows={2}
              />
            </label>
          </section>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={() => setCustomizeType("")}>Cancel</button>
            <button className="primary-button" type="button" onClick={() => { setCustomizeType(""); void createArtifact("audio"); }}>
              <Sparkles size={15} /> Generate
            </button>
          </div>
          </section>
          </div>
          ) : null}

          {customizeType === "flashcards" ? (
          <div className="modal-backdrop" role="presentation" onClick={() => setCustomizeType("")}>
          <section className="modal customize-modal" role="dialog" aria-modal="true" aria-label="Customize flashcards" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header">
            <div><h2>Customize Flashcards</h2></div>
            <button className="icon-button subtle" type="button" onClick={() => setCustomizeType("")} aria-label="Close customize"><X size={18} /></button>
          </div>
          <section className="flashcard-config" aria-label="Flashcard settings">
            <div className="section-heading">
              <strong>Card options</strong>
              <span>{flashcardOptions.count} cards</span>
            </div>
            <div className="flashcard-config-grid">
              <label>
                <span>Topic</span>
                <input
                  value={flashcardOptions.topic}
                  onChange={(event) => setFlashcardOptions((current) => ({ ...current, topic: event.target.value }))}
                  disabled={false}
                  placeholder="Focus"
                />
              </label>
              <label>
                <span>Difficulty</span>
                <select
                  value={flashcardOptions.difficulty}
                  onChange={(event) => setFlashcardOptions((current) => ({ ...current, difficulty: event.target.value as FlashcardDifficulty }))}
                  disabled={false}
                >
                  {flashcardDifficultyOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Amount</span>
                <select
                  value={flashcardOptions.countPreset}
                  onChange={(event) => {
                    const preset = flashcardCountOptions.find((option) => option.value === event.target.value) || flashcardCountOptions[1];
                    setFlashcardOptions((current) => ({ ...current, countPreset: preset.value, count: preset.count }));
                  }}
                  disabled={false}
                >
                  {flashcardCountOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Language</span>
                <select
                  value={flashcardOptions.language}
                  onChange={(event) => setFlashcardOptions((current) => ({ ...current, language: event.target.value }))}
                  disabled={false}
                >
                  {audioLanguageOptions.map((language) => (
                    <option key={language} value={language}>{language}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flashcard-audience">
              <span>Audience</span>
              <input
                value={flashcardOptions.audience}
                onChange={(event) => setFlashcardOptions((current) => ({ ...current, audience: event.target.value }))}
                disabled={false}
                placeholder="general"
              />
            </label>
            <div className="flashcard-token-row" aria-label="Card types">
              {flashcardCardTypeOptions.map((option) => {
                const selected = flashcardOptions.cardTypes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-selected={selected}
                    disabled={false}
                    onClick={() =>
                      setFlashcardOptions((current) => {
                        const next = selected
                          ? current.cardTypes.filter((type) => type !== option.value)
                          : [...current.cardTypes, option.value];
                        return { ...current, cardTypes: next.length ? next : [option.value] };
                      })
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="flashcard-source-controls">
              <label>
                <span>Sources</span>
                <select
                  value={flashcardOptions.sourceMode}
                  onChange={(event) => {
                    const sourceMode = event.target.value as SourceMode;
                    setFlashcardOptions((current) => ({
                      ...current,
                      sourceMode,
                      selectedSourceIds:
                        sourceMode === "selected" && !current.selectedSourceIds.length
                          ? (notebook?.sources.filter((source) => source.active).map((source) => source.id) || [])
                          : current.selectedSourceIds,
                    }));
                  }}
                  disabled={false}
                >
                  {sourceModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {flashcardOptions.sourceMode === "selected" ? (
                <div className="flashcard-source-picks" aria-label="Selected flashcard sources">
                  {notebook?.sources.map((source) => {
                    const selected = flashcardOptions.selectedSourceIds.includes(source.id);
                    return (
                      <button
                        key={source.id}
                        type="button"
                        data-selected={selected}
                        disabled={false}
                        onClick={() =>
                          setFlashcardOptions((current) => ({
                            ...current,
                            selectedSourceIds: selected
                              ? current.selectedSourceIds.filter((id) => id !== source.id)
                              : [...current.selectedSourceIds, source.id],
                          }))
                        }
                      >
                        {source.title}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </section>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={() => setCustomizeType("")}>Cancel</button>
            <button className="primary-button" type="button" onClick={() => { setCustomizeType(""); void createArtifact("flashcards"); }}>
              <Sparkles size={15} /> Generate
            </button>
          </div>
          </section>
          </div>
          ) : null}

          {customizeType === "thumbnail" ? (
          <div className="modal-backdrop" role="presentation" onClick={() => setCustomizeType("")}>
          <section className="modal customize-modal" role="dialog" aria-modal="true" aria-label="Create thumbnail" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header">
            <div><h2>Create Thumbnail</h2></div>
            <button className="icon-button subtle" type="button" onClick={() => setCustomizeType("")} aria-label="Close customize"><X size={18} /></button>
          </div>
          <div className="thumbnail-config">
            <label className="modal-field">
              <span>Style / prompt (optional)</span>
              <textarea
                value={thumbnailPrompt}
                onChange={(event) => setThumbnailPrompt(event.target.value)}
                rows={3}
                placeholder="e.g. dramatic, big face on the left, bold colors, space for text on the right. Leave empty to auto-build from the video."
              />
            </label>
            <label className="upload-dropzone thumb-dropzone">
              <UploadCloud size={22} />
              <strong>{thumbnailRefs.length ? `${thumbnailRefs.length} reference image(s) attached` : "Add reference images (optional)"}</strong>
              <p>Face, logo, product — gpt-image-2 blends them into the thumbnail.</p>
              <input type="file" accept="image/*" multiple onChange={(event) => void handleThumbnailRefs(event)} />
            </label>
            {thumbnailRefs.length ? (
              <div className="thumb-ref-row">
                {thumbnailRefs.map((src, index) => (
                  <span key={index} className="thumb-ref">
                    <img src={src} alt="" />
                    <button type="button" onClick={() => setThumbnailRefs(thumbnailRefs.filter((_, position) => position !== index))} aria-label="Remove reference">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={() => setCustomizeType("")}>Cancel</button>
            <button className="primary-button" type="button" onClick={() => { setCustomizeType(""); void createArtifact("thumbnail"); }}>
              <Image size={15} /> Generate
            </button>
          </div>
          </section>
          </div>
          ) : null}

          <section className="youtube-studio-section" aria-label="YouTube Studio">
            <div className="youtube-studio-header">
              <span className="youtube-studio-badge">
                <Youtube size={14} />
                YouTube Studio
              </span>
            </div>
            <div className="youtube-studio-grid">
              {youtubeStudioTypes.map((artifact) => (
                <button
                  key={artifact.type}
                  className="studio-tile youtube-studio-tile"
                  data-kind={artifact.type}
                  type="button"
                  onClick={() => handleStudioArtifact(artifact)}
                  disabled={creatingTypes.has(artifact.type)}
                >
                  <span className="studio-icon">{creatingTypes.has(artifact.type) ? <Loader2 className="spin" size={18} /> : artifact.icon}</span>
                  <span>
                    <strong>{artifact.title}</strong>
                    <small>{artifact.action}</small>
                  </span>
                  <span className="studio-chevron">
                    <ArrowRight size={14} />
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className="studio-section-label" aria-hidden="true">
            <span>Notebook Studio</span>
          </div>

          <div className="studio-grid">
            {coreStudioTypes.map((artifact) => (
              <button
                key={artifact.type}
                className="studio-tile"
                data-kind={artifact.type}
                type="button"
                onClick={() => handleStudioArtifact(artifact)}
                disabled={creatingTypes.has(artifact.type)}
              >
                <span className="studio-icon">{creatingTypes.has(artifact.type) ? <Loader2 className="spin" size={18} /> : artifact.icon}</span>
                <span>
                  <strong>{artifact.title}</strong>
                </span>
                <span className="studio-chevron">
                  <ArrowRight size={14} />
                </span>
              </button>
            ))}
          </div>

          {notebook?.artifacts.length ? (
            <>
              <div className="studio-divider" />
              <div className="section-heading studio-list-heading">
                <div className="studio-list-title">
                  <strong>Outputs</strong>
                  <span>{notebook.artifacts.length}</span>
                </div>
                <button
                  type="button"
                  className="output-clear-button"
                  onClick={() => void deleteAllArtifactOutputs()}
                  disabled={isDeletingAllArtifacts || !notebook.artifacts.length}
                >
                  {isDeletingAllArtifacts ? <Loader2 className="spin" size={13} /> : <Trash2 size={13} />}
                  Clear all
                </button>
              </div>
              <div className="artifact-list">
                {notebook.artifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    role="button"
                    tabIndex={0}
                    className="artifact-row"
                    data-active={artifact.id === selectedArtifactId}
                    data-kind={artifact.type}
                    onClick={() => {
                      setSelectedArtifactId(artifact.id);
                      setIsArtifactDetailOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedArtifactId(artifact.id);
                        setIsArtifactDetailOpen(true);
                      }
                    }}
                  >
                    <span className="artifact-icon" data-kind={artifact.type}>{artifactIcon(artifact.type)}</span>
                    <span className="artifact-row-text">
                      <strong>{artifact.title}</strong>
                      <small>{artifactMetaLine(artifact)}</small>
                    </span>
                    <span className="artifact-row-actions">
                      {artifact.type === "audio" ? (
                        <button
                          type="button"
                          className="artifact-play"
                          aria-label={playingArtifactId === artifact.id ? "Pause audio" : "Play audio"}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleArtifactAudio(artifact);
                          }}
                        >
                          {playingArtifactId === artifact.id ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="artifact-delete"
                        aria-label={`Delete output ${artifact.title}`}
                        title="Delete output"
                        disabled={deletingArtifactIds.has(artifact.id) || isDeletingAllArtifacts}
                        onClick={(event) => {
                          event.stopPropagation();
                          void deleteArtifactOutput(artifact);
                        }}
                      >
                        {deletingArtifactIds.has(artifact.id) ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
              <audio ref={inlineAudioRef} onEnded={() => setPlayingArtifactId("")} hidden />
            </>
          ) : null}

        </section>
      </main>

      <nav className="mobile-tabs" aria-label="Workspace panels">
        <MobileTab panel="sources" active={mobilePanel} onChange={setMobilePanel} icon={<Library size={17} />} label="Sources" />
        <MobileTab panel="chat" active={mobilePanel} onChange={setMobilePanel} icon={<MessageSquareText size={17} />} label="Chat" />
        <MobileTab panel="studio" active={mobilePanel} onChange={setMobilePanel} icon={<Sparkles size={17} />} label="Studio" />
      </nav>

      {isShareOpen ? (
        <div className="modal-backdrop artifact-modal-backdrop" role="presentation" onClick={() => setIsShareOpen(false)}>
          <section className="modal share-modal" role="dialog" aria-modal="true" aria-label="Share notebook" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="panel-eyebrow">Notebook packet</p>
                <h2>Share notebook</h2>
              </div>
              <button className="icon-button subtle" type="button" onClick={() => setIsShareOpen(false)} aria-label="Close share">
                <XCircle size={17} />
              </button>
            </div>
            <div className="share-panel">
              <div className="share-summary">
                <span className="share-summary-icon">
                  <Share2 size={21} />
                </span>
                <div>
                  <h3>{notebook?.title || "Untitled notebook"}</h3>
                  <p>{notebook?.summary || "Source-grounded notebook packet with sources, latest answer, and Studio outputs."}</p>
                </div>
              </div>
              <div className="share-stats" aria-label="Notebook share contents">
                <span><Library size={14} /> {activeCount} active sources</span>
                <span><Sparkles size={14} /> {notebook?.artifacts.length || 0} outputs</span>
                <span><ShieldCheck size={14} /> Evidence brief</span>
              </div>
              <div className="share-action-grid">
                <button className="share-action-card" type="button" onClick={() => void copyShareBrief()}>
                  <span><Copy size={18} /></span>
                  <strong>Copy brief</strong>
                  <small>Markdown summary with sources and latest grounded answer</small>
                </button>
                <button className="share-action-card" type="button" onClick={downloadShareBrief}>
                  <span><Download size={18} /></span>
                  <strong>Download brief</strong>
                  <small>Portable Evidence Pack for docs, email, or Slack</small>
                </button>
                <button
                  className="share-action-card"
                  type="button"
                  onClick={() => {
                    exportNotebook();
                    setIsShareOpen(false);
                  }}
                >
                  <span><Database size={18} /></span>
                  <strong>Full archive</strong>
                  <small>Complete notebook JSON for backup or handoff</small>
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isAddSourceOpen ? (
        <div className="modal-backdrop artifact-modal-backdrop" role="presentation" onClick={closeAddSourceDialog}>
          <section className="modal add-source-modal" role="dialog" aria-modal="true" aria-label="Add sources" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Add sources</h2>
              </div>
              <button className="icon-button subtle" type="button" onClick={closeAddSourceDialog} aria-label="Close add sources" disabled={isAddingSource}>
                <X size={18} />
              </button>
            </div>
            <p className="modal-intro">
              {ASSISTANT_NAME} grounds every answer in the sources you add — upload files, paste text, or link a website or YouTube video.
            </p>
            <form className="add-source-form" onSubmit={(event) => void handleSourceSubmit(event)}>
              <label
                className="add-source-dropzone"
                data-drag={isDragging}
                data-has-queue={sourceFileQueue.length > 0}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => void handleDrop(event)}
              >
                <UploadCloud size={30} />
                <strong>Drop files here, or click to upload</strong>
                <p>PDF, Markdown, text, DOCX, images, audio, video — up to {SOURCE_UPLOAD_LIMIT_LABEL} each.</p>
                {sourceFileQueue.length ? (
                  <div className="add-source-queue" aria-label="Files ready to add">
                    {sourceFileQueue.map((item) => {
                      const progress = queuedSourceFileProgress(item);
                      return (
                        <div className="add-source-file" data-status={item.status} key={item.id}>
                          <span className="add-source-file-icon" aria-hidden="true">
                            {item.status === "adding" ? <Loader2 className="spin" size={14} /> : item.status === "added" ? <CheckCircle2 size={14} /> : item.status === "failed" ? <X size={14} /> : sourceIcon(item.type)}
                          </span>
                          <span className="add-source-file-copy">
                            <strong>{item.file_name}</strong>
                            <small>{sourceTypeLabel(item.type)} · {formatFileSize(item.size)}{item.error ? ` · ${item.error}` : ""}</small>
                            <span className="add-source-upload-progress" aria-label={`${progress.label}: ${progress.percent}%`}>
                              <span className="add-source-upload-track" aria-hidden="true">
                                <span className="add-source-upload-fill" style={{ width: `${progress.percent}%` }} />
                              </span>
                              <span className="add-source-upload-detail">{progress.detail}</span>
                            </span>
                          </span>
                          <em>{progress.label}</em>
                        </div>
                      );
                    })}
                  </div>
                ) : sourceForm.file_name ? (
                  <span className="add-source-attached">
                    <CheckCircle2 size={14} /> {sourceForm.file_name}
                  </span>
                ) : null}
                <input type="file" multiple accept={sourceFileAccept(sourceForm.type)} onChange={(event) => void handleFile(event)} />
              </label>

              {sourceFileQueue.length ? (
                <div className="add-source-batch-row">
                  <span>{sourceFileQueue.length} file{sourceFileQueue.length === 1 ? "" : "s"} queued as separate sources.</span>
                  <button className="secondary-button" type="button" onClick={clearSourceFileQueue} disabled={isAddingSource}>
                    Clear files
                  </button>
                </div>
              ) : null}

              {!sourceFileQueue.length ? (
                <>
                  <div className="add-source-or"><span>or</span></div>

                  <div className="add-source-types" role="tablist" aria-label="Source type">
                    {sourceTabs.map((tab) => (
                      <button
                        key={tab.type}
                        type="button"
                        role="tab"
                        aria-selected={sourceForm.type === tab.type}
                        onClick={() => {
                          setSourceFormNotice("");
                          setSourceFormNoticeTone("error");
                          setSourceFileQueue([]);
                          setSourceForm((current) => ({ ...current, type: tab.type, file_name: "", base64: undefined }));
                          window.requestAnimationFrame(() => sourceBodyRef.current?.focus());
                        }}
                      >
                        {tab.icon}
                        {tab.label}
                        {tab.type === "youtube" ? <span className="new-feature-badge">New</span> : null}
                      </button>
                    ))}
                  </div>

                  {sourceForm.type === "youtube" ? (
                    <div className="youtube-import-mode" role="radiogroup" aria-label="YouTube import mode">
                      <button
                        type="button"
                        aria-pressed={youtubeImportMode === "video"}
                        onClick={() => setYoutubeImportMode("video")}
                      >
                        Single video
                      </button>
                      <button
                        type="button"
                        className="youtube-channel-toggle"
                        aria-pressed={youtubeImportMode === "channel"}
                        onClick={() => setYoutubeImportMode("channel")}
                      >
                        <Sparkles size={14} aria-hidden />
                        Whole channel
                        <span className="new-feature-badge">New</span>
                      </button>
                    </div>
                  ) : null}

                  {sourceNeedsUrl(sourceForm.type) ? (
                    <label className="modal-field">
                      <span>
                        {sourceForm.type === "youtube"
                          ? youtubeImportMode === "channel"
                            ? "YouTube channel URL"
                            : "YouTube URL"
                          : "Website URL"}
                      </span>
                      <input
                        value={sourceForm.original_url}
                        onChange={(event) => setSourceForm((current) => ({ ...current, original_url: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                        placeholder={
                          sourceForm.type === "youtube" && youtubeImportMode === "channel"
                            ? "https://www.youtube.com/@channel"
                            : sourceUrlPlaceholder(sourceForm.type)
                        }
                        inputMode="url"
                        autoFocus
                      />
                    </label>
                  ) : null}

                  {sourceForm.type === "youtube" && youtubeImportMode === "channel" ? (
                    <label className="modal-field youtube-import-reveal">
                      <span>Latest videos to import</span>
                      <select
                        value={youtubeBatchCount}
                        onChange={(event) => setYoutubeBatchCount(Number(event.target.value))}
                      >
                        {[5, 10, 25, 50].map((count) => (
                          <option key={count} value={count}>
                            Last {count} videos
                          </option>
                        ))}
                      </select>
                      <small className="youtube-import-hint">
                        Every video is transcribed and indexed as its own source. Already-imported videos are skipped.
                      </small>
                    </label>
                  ) : null}

                  {sourceForm.type === "markdown" || sourceForm.type === "text" || sourceForm.type === "note" ? (
                    <label className="modal-field">
                      <span>{sourceBodyLabel(sourceForm.type)}</span>
                      <textarea
                        ref={sourceBodyRef}
                        value={sourceForm.body}
                        onChange={(event) => setSourceForm((current) => ({ ...current, body: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                        placeholder={sourceBodyPlaceholder(sourceForm.type)}
                        aria-invalid={Boolean(sourceFormNotice)}
                        rows={5}
                      />
                    </label>
                  ) : null}

                  <label className="modal-field">
                    <span>Title (optional)</span>
                    <input
                      value={sourceForm.title}
                      onChange={(event) => setSourceForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="We infer one from the content"
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="add-source-batch-note">
                    <strong>Batch upload</strong>
                    <span>File type and title are inferred per file. Each item becomes its own source and indexes independently.</span>
                  </div>
                  {sourceFileQueue.length === 1 ? (
                    <label className="modal-field">
                      <span>Title (optional)</span>
                      <input
                        value={sourceForm.title}
                        onChange={(event) => setSourceForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="We infer one from the file name"
                      />
                    </label>
                  ) : null}
                </>
              )}

              {sourceFormNotice ? <p className="source-form-help" data-tone={sourceFormNoticeTone}>{sourceFormNotice}</p> : null}
              <div className="modal-actions">
                <span style={{ marginRight: "auto", fontSize: "0.78rem", opacity: 0.55 }}>
                  {sourceNeedsUrl(sourceForm.type)
                    ? "Press Enter or click Add source"
                    : sourceFileQueue.length
                      ? `Click Add to create ${sourceFileQueue.length} source${sourceFileQueue.length === 1 ? "" : "s"}`
                    : sourceForm.type === "markdown" || sourceForm.type === "text" || sourceForm.type === "note"
                      ? "Press ⌘/Ctrl + Enter or click Add source"
                      : "Click Add source to finish"}
                </span>
                <button className="secondary-button" type="button" onClick={closeAddSourceDialog} disabled={isAddingSource}>Cancel</button>
                <button className="primary-button" type="submit" disabled={isAddingSource}>
                  {isAddingSource ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}
                  {isAddingSource && sourceFileQueue.length
                    ? `Adding ${sourceUploadDone}/${sourceFileQueue.length}…`
                    : isAddingSource
                      ? "Adding…"
                      : sourceFileQueue.length
                        ? `Add ${sourceFileQueue.length} file${sourceFileQueue.length === 1 ? "" : "s"}`
                        : "Add & analyze"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isNotepadOpen ? (
        <div className="notepad-backdrop" role="presentation" onClick={() => setIsNotepadOpen(false)}>
          <section
            className="notepad-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Note editor"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="notepad-header">
              <div className="notepad-breadcrumb">
                <NotebookPen size={15} />
                <span>Studio</span>
                <ChevronRight size={13} />
                <span>Note</span>
              </div>
              <button className="icon-button subtle" type="button" onClick={() => setIsNotepadOpen(false)} aria-label="Close note">
                <XCircle size={17} />
              </button>
            </div>
            <input
              className="notepad-title"
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              placeholder="Untitled note"
              aria-label="Note title"
            />
            <textarea
              className="notepad-body"
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Write your note here. Save it to make it a grounded source the assistant and Studio can use."
              aria-label="Note body"
              autoFocus
            />
            <div className="notepad-footer">
              <span className="notepad-hint">{noteBody.trim() ? `${noteBody.trim().split(/\s+/).length} words` : "Notes become source-grounded once saved"}</span>
              <div className="notepad-actions">
                <button type="button" className="secondary-button" onClick={() => setIsNotepadOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="primary-button" disabled={noteSaving || !noteBody.trim()} onClick={() => void handleSaveNote()}>
                  {noteSaving ? "Saving…" : "Save to sources"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isArtifactDetailOpen ? (
        <div className="modal-backdrop artifact-modal-backdrop" role="presentation" onClick={closeArtifactDetail}>
          <section
            className="modal artifact-modal"
            data-artifact-type={selectedArtifact?.type || "none"}
            role="dialog"
            aria-modal="true"
            aria-label="Artifact preview"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="panel-eyebrow">Studio artifact</p>
                <h2>{artifactTypeLabel(selectedArtifact?.type)}</h2>
                {selectedArtifact ? <p className="artifact-subhead">{artifactSubhead(selectedArtifact)}</p> : null}
              </div>
              <button className="icon-button subtle" type="button" onClick={closeArtifactDetail} aria-label="Close artifact preview">
                <XCircle size={17} />
              </button>
            </div>
            <ArtifactPreview
              artifact={selectedArtifact}
              onCitationClick={focusCitation}
              onArtifactRefresh={() => void refreshNotebook()}
              onToast={setToast}
              onError={setError}
            />
          </section>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <div className="modal-backdrop artifact-modal-backdrop" role="presentation" onClick={() => setIsSettingsOpen(false)}>
          <section className="modal settings-modal" role="dialog" aria-modal="true" aria-label="Account settings" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="panel-eyebrow">Account</p>
                <h2>Settings</h2>
              </div>
              <button className="icon-button subtle" type="button" onClick={() => setIsSettingsOpen(false)} aria-label="Close settings">
                <XCircle size={17} />
              </button>
            </div>
            <SettingsPanel authUser={authUser} onToast={setToast} />
          </section>
        </div>
      ) : null}

      {isDebugOpen ? (
        <div className="modal-backdrop artifact-modal-backdrop" role="presentation" onClick={() => setIsDebugOpen(false)}>
          <section className="modal debug-modal" role="dialog" aria-modal="true" aria-label="Debug activity" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="panel-eyebrow">Runtime diagnostics</p>
                <h2>Debug activity</h2>
              </div>
              <div className="modal-header-actions">
                <button className="ghost-button compact" type="button" onClick={() => refreshDebugSilently()}>
                  <RefreshCw size={15} />
                  Refresh
                </button>
                <button className="icon-button subtle" type="button" onClick={() => setIsDebugOpen(false)} aria-label="Close debug activity">
                  <XCircle size={17} />
                </button>
              </div>
            </div>
            <DebugPanel status={debugStatus} isWorking={isWorking} />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceResizeHandle({
  target,
  active,
  onPointerDown,
  onKeyDown,
  onReset,
}: {
  target: WorkspaceResizeTarget;
  active: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onReset: () => void;
}) {
  return (
    <button
      className="workspace-resizer"
      data-active={active}
      data-target={target}
      type="button"
      aria-label={target === "sources" ? "Resize sources column" : "Resize studio column"}
      title="Drag to resize. Double-click to reset."
      onClick={(event) => event.currentTarget.focus()}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
    >
      <span aria-hidden="true" />
    </button>
  );
}

function SettingsPanel({ authUser, onToast }: { authUser: AuthUser | null; onToast: (message: string) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (newPassword.length < 8) {
      setFormError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("New password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setFormError("New password must be different from the current password.");
      return;
    }
    setIsSaving(true);
    try {
      await api<{ ok: boolean }>("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onToast("Password updated.");
    } catch (error) {
      setFormError(messageFromError(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="settings-panel">
      <section className="settings-section">
        <p className="settings-section-label">Signed in as</p>
        <div className="settings-account">
          <strong>{authUser?.name || "Your account"}</strong>
          <span>{authUser?.email || ""}</span>
        </div>
      </section>

      <form className="modal-form settings-form" onSubmit={handleSubmit}>
        <p className="settings-section-label">Change password</p>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>
        {formError ? <p className="settings-form-error">{formError}</p> : null}
        <button
          type="submit"
          className="primary-button"
          disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
        >
          {isSaving ? <Loader2 className="spin" size={15} /> : null}
          {isSaving ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

function AuthPage({
  mode: rawMode,
  resetToken,
  providerLabel,
  isBooting,
  onModeChange,
  onResetTokenChange,
  onAuthenticated,
  onBackHome,
}: {
  mode: AuthMode;
  resetToken: string;
  providerLabel: string;
  isBooting: boolean;
  onModeChange: (mode: AuthMode) => void;
  onResetTokenChange: (token: string) => void;
  onAuthenticated: (response: AuthResponse) => void;
  onBackHome: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [localError, setLocalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mode = normalizeAuthMode(rawMode);

  const title =
    {
      login: `Sign in to ${BRAND_NAME}`,
      signup: `Create your ${BRAND_NAME} account`,
      "reset-request": "Reset your password",
      "reset-confirm": "Set a new password",
    }[mode] || `${BRAND_NAME} account`;
  const subtitle =
    mode === "signup"
      ? "Create an account, start a private notebook, and keep the research workspace scoped to your session."
      : mode === "reset-request"
        ? "Request a password reset token for your account."
        : mode === "reset-confirm"
          ? "Use the reset token to replace the password and create a fresh session."
          : "Use your account to access notebooks, sources, citations, and generated artifacts.";

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setLocalError("");
    setNotice("");
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const response = await api<AuthResponse>("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });
        onAuthenticated(response);
        return;
      }

      if (mode === "login") {
        const response = await api<AuthResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        onAuthenticated(response);
        return;
      }

      if (mode === "reset-request") {
        const response = await api<PasswordResetResponse>("/api/auth/password-reset", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        if (response.reset_token) {
          onResetTokenChange(response.reset_token);
          onModeChange("reset-confirm");
          setNotice("Reset token generated. Set a new password below.");
        } else {
          setNotice("If the email exists, a reset flow has been created.");
        }
        return;
      }

      if (password !== confirmPassword) throw new Error("Passwords do not match.");
      const response = await api<AuthResponse>("/api/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token: resetToken, password }),
      });
      onAuthenticated(response);
    } catch (authError) {
      setLocalError(messageFromError(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <header className="auth-nav">
        <button className="landing-brand auth-brand-button" type="button" onClick={onBackHome}>
          <span className="landing-brand-mark">
            <img src={BRAND_LOGO_PATH} alt="" />
          </span>
          <span>{BRAND_NAME}</span>
        </button>
        <button className="landing-secondary small" type="button" onClick={onBackHome}>
          Home
        </button>
      </header>

      <main className="auth-layout">
        <section className="auth-copy" aria-label="Account security overview">
          <p className="landing-kicker">Account workspace</p>
          <h1>Private notebooks need real accounts.</h1>
          <p>
            {BRAND_NAME} keeps the research workspace behind an HTTP-only session. Notebooks, sources, chats, citation
            ledgers, and artifacts are scoped to the signed-in user.
          </p>
          <div className="auth-proof-grid">
            <span>
              <Database size={16} />
              SQLite account store
            </span>
            <span>
              <ShieldCheck size={16} />
              HTTP-only session
            </span>
            <span>
              <KeyRound size={16} />
              Password reset flow
            </span>
            <span>
              <Sparkles size={16} />
              {providerLabel}
            </span>
          </div>
        </section>

        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card-top">
            <span className="auth-card-icon">
              {mode === "signup" ? <UserPlus size={20} /> : mode.startsWith("reset") ? <KeyRound size={20} /> : <Lock size={20} />}
            </span>
            <div>
              <p className="panel-eyebrow">Secure account access</p>
              <h2 id="auth-title">{title}</h2>
            </div>
          </div>
          <p className="auth-subtitle">{subtitle}</p>

          <form className="auth-form" onSubmit={submitAuth}>
            {mode === "signup" ? (
              <label>
                <span>Name</span>
                <div className="auth-input">
                  <UserCircle size={16} />
                  <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Timo Bautsch" />
                </div>
              </label>
            ) : null}

            {mode !== "reset-confirm" ? (
              <label>
                <span>Email</span>
                <div className="auth-input">
                  <Mail size={16} />
                  <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" placeholder="you@example.com" />
                </div>
              </label>
            ) : null}

            {mode === "reset-confirm" ? (
              <label>
                <span>Reset token</span>
                <div className="auth-input">
                  <KeyRound size={16} />
                  <input value={resetToken} onChange={(event) => onResetTokenChange(event.target.value)} autoComplete="one-time-code" placeholder="Paste reset token" />
                </div>
              </label>
            ) : null}

            {mode !== "reset-request" ? (
              <label>
                <span>{mode === "reset-confirm" ? "New password" : "Password"}</span>
                <div className="auth-input">
                  <Lock size={16} />
                  <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
                </div>
              </label>
            ) : null}

            {mode === "signup" || mode === "reset-confirm" ? (
              <label>
                <span>Confirm password</span>
                <div className="auth-input">
                  <Lock size={16} />
                  <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" />
                </div>
              </label>
            ) : null}

            {localError ? (
              <p className="auth-message error" role="alert">
                {localError}
              </p>
            ) : null}
            {notice ? <p className="auth-message">{notice}</p> : null}

            <button className="primary-button auth-submit" type="submit" disabled={isSubmitting || isBooting}>
              {isSubmitting || isBooting ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}
              {mode === "signup"
                ? "Create account"
                : mode === "reset-request"
                  ? "Request reset"
                  : mode === "reset-confirm"
                    ? "Set password"
                    : "Sign in"}
            </button>
          </form>

          <div className="auth-switcher">
            {mode !== "login" ? (
              <button type="button" onClick={() => onModeChange("login")}>
                Sign in
              </button>
            ) : null}
            {mode !== "signup" ? (
              <button type="button" onClick={() => onModeChange("signup")}>
                Create account
              </button>
            ) : null}
            {mode !== "reset-request" ? (
              <button type="button" onClick={() => onModeChange("reset-request")}>
                Forgot password?
              </button>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

function PanelHeader({ icon, title, count }: { icon: ReactNode; title: string; count: number }) {
  return (
    <div className="panel-header">
      <div>
        <span className="panel-icon">{icon}</span>
        <h2>{title}</h2>
      </div>
      <span className="count-badge">{count}</span>
    </div>
  );
}

function Menu({
  children,
  align,
  onClose,
}: {
  children: ReactNode;
  align: "start" | "end";
  onClose: () => void;
}) {
  // Render to document.body so the dropdown escapes the .topbar stacking context
  // (otherwise its z-index is capped inside the topbar and paints behind .workspace/Studio).
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; right: number } | null>(null);
  useEffect(() => {
    const trigger = anchorRef.current?.previousElementSibling as HTMLElement | null;
    if (!trigger) return;
    const update = () => {
      const r = trigger.getBoundingClientRect();
      setRect({ top: r.bottom, left: r.left, right: r.right });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, []);
  const menuStyle: CSSProperties = rect
    ? {
        top: rect.top + 8,
        ...(align === "end"
          ? { right: Math.max(8, window.innerWidth - rect.right) }
          : { left: rect.left }),
      }
    : { visibility: "hidden" };
  return (
    <>
      <span ref={anchorRef} aria-hidden style={{ display: "none" }} />
      {createPortal(
        <>
          <button className="menu-scrim" type="button" aria-label="Close menu" onClick={onClose} />
          <div className={`menu menu-${align}`} role="menu" style={menuStyle}>
            {children}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

function accountInitials(name: string, email: string) {
  const source = String(name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function LandingPage({
  sourceCount,
  providerLabel,
  isBooting,
  isAuthenticated,
  onOpenWorkspace,
  onSignIn,
  onCreateAccount,
}: {
  sourceCount: number;
  providerLabel: string;
  isBooting: boolean;
  isAuthenticated: boolean;
  onOpenWorkspace: () => void;
  onSignIn: () => void;
  onCreateAccount: () => void;
}) {
  const landingMetrics = [
    { value: "Hybrid", label: "BM25 + semantic vector search" },
    { value: "Rerank", label: "Cohere-ready second-stage ranking" },
    { value: providerLabel.includes("Anthropic") ? "Claude" : "Fallback", label: "grounded answer route" },
  ];
  const steps = [
    {
      icon: <UploadCloud size={18} />,
      title: "Normalize sources",
      body: "PDFs, URLs, YouTube, audio, notes and documents collapse into stable Source Blocks with heading and range metadata.",
    },
    {
      icon: <Layers3 size={18} />,
      title: "Semantic chunking",
      body: "Structured chunks keep heading boundaries and overlap, while semantic topic shifts create cleaner retrieval units.",
    },
    {
      icon: <Database size={18} />,
      title: "Hybrid search",
      body: "BM25, keyword overlap, vector cosine, query rewrites and entity signals produce a candidate set for reranking.",
    },
    {
      icon: <ShieldCheck size={18} />,
      title: "Grounded generation",
      body: "Evidence Packs feed chat and Studio artifacts; Citation Ledgers strip unsupported claims before users rely on them.",
    },
  ];
  const stack = [
    "Supabase pgvector",
    "Deterministic vector fallback",
    "Cohere rerank",
    "OpenAI / Voyage embeddings",
    "Deepgram transcription",
    "ElevenLabs audio",
  ];
  const outputs = [
    "Audio Overview",
    "Slide decks",
    "YouTube kit",
    "Flashcards",
    "Quizzes",
    "Infographics",
    "Data tables",
    "Mind maps",
  ];
  return (
    <div className="landing-shell">
      <header className="landing-nav" aria-label="Homepage navigation">
        <a className="landing-brand" href="#top" aria-label={`${BRAND_NAME} homepage`}>
          <span className="landing-brand-mark">
            <img src={BRAND_LOGO_PATH} alt="" />
          </span>
          <span>{BRAND_NAME}</span>
        </a>
        <nav>
          <a href="#overview">Overview</a>
          <a href="#audio">Audio</a>
          <a href="#plans">Outputs</a>
        </nav>
        <div className="landing-auth-actions">
          {isAuthenticated ? (
            <button className="landing-nav-cta" type="button" onClick={onOpenWorkspace}>
              Open workspace
            </button>
          ) : (
            <>
              <button className="landing-secondary small" type="button" onClick={onSignIn}>
                Sign in
              </button>
              <button className="landing-nav-cta" type="button" onClick={onCreateAccount}>
                Create account
              </button>
            </>
          )}
        </div>
      </header>

      <main id="top">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="hero-product-scene" aria-hidden="true">
            <div className="scene-window scene-sources">
              <span>01 · Sources</span>
              <strong>{isBooting ? "Indexing" : `${sourceCount || 4} source types`}</strong>
              <p>PDF · URL · YouTube · audio</p>
              <p>Markdown spine</p>
              <p>Stable Source Blocks</p>
            </div>
            <div className="scene-window scene-chat">
              <span>02 · Retrieval</span>
              <strong>Hybrid search + rerank</strong>
              <p>BM25 and semantic vectors retrieve candidates; a reranker promotes the passages most likely to answer the question.</p>
              <div>
                <mark>BM25</mark>
                <mark>Vector</mark>
                <mark>Rerank</mark>
              </div>
            </div>
            <div className="scene-window scene-studio">
              <span>03 · Evidence Pack</span>
              <strong>Cited answer layer</strong>
              <p>Claude or a deterministic fallback engine can only use retrieved evidence. Unsupported claims are removed.</p>
            </div>
          </div>

          <div className="landing-hero-copy">
            <p className="landing-kicker">Private RAG architecture</p>
            <h1 id="landing-title">A source-grounded RAG workbench.</h1>
            <p>
              Block Research LM turns private sources into semantic chunks, hybrid retrieval results, reranked Evidence
              Packs and cited Studio outputs.
            </p>
            <div className="landing-hero-actions">
              <button className="landing-primary" type="button" onClick={onOpenWorkspace}>
                {isAuthenticated ? `Open ${BRAND_NAME}` : "Start with an account"}
                <ArrowRight size={18} />
              </button>
              <a className="landing-secondary" href="#overview">
                <GitBranch size={18} />
                View pipeline
              </a>
            </div>
          </div>

          <div className="landing-metrics" aria-label="Pipeline metrics">
            {landingMetrics.map((metric) => (
              <div key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section intro-band" id="overview">
          <div>
            <p className="landing-kicker">Architecture, not generic PDF chat</p>
            <h2>Every answer starts as retrieval, not model memory.</h2>
          </div>
          <p>
            {BRAND_NAME} stores source blocks, chunks, embeddings, retrieval runs, Evidence Packs and Citation Ledgers
            as first-class objects. The UI exposes the workflow, but the reliability comes from the pipeline underneath.
          </p>
        </section>

        <section className="landing-section process-grid" aria-label={`How ${BRAND_NAME} works`}>
          {steps.map((step) => (
            <article key={step.title}>
              <span>{step.icon}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </section>

        <section className="landing-section stack-band" aria-label="Technical stack">
          <div>
            <p className="landing-kicker">Retrieval stack</p>
            <h2>BM25 recall, semantic recall, then rerank precision.</h2>
          </div>
          <div className="stack-list">
            {stack.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        <section className="landing-section audio-band" id="audio">
          <div className="audio-copy">
            <p className="landing-kicker">Studio artifacts</p>
            <h2>The same Evidence Pack drives every output.</h2>
            <p>
              Audio, slides, reports, flashcards and YouTube assets are generated from the selected source context.
              Each artifact keeps the retrieval audit attached instead of hiding source provenance.
            </p>
          </div>
          <div className="audio-script" aria-label="Audio overview example">
            <div>
              <span>Evidence Pack</span>
              <p>Top reranked chunks become the compact context window used for generation. [1]</p>
            </div>
            <div>
              <span>Citation Ledger</span>
              <p>Claims are checked against cited evidence before the answer or artifact is shown. [2]</p>
            </div>
          </div>
        </section>

        <section className="landing-section output-band" id="plans">
          <div>
            <p className="landing-kicker">Studio outputs</p>
            <h2>NotebookLM-style outputs, plus YouTube-specific tools.</h2>
          </div>
          <div className="output-list">
            {outputs.map((output) => (
              <span key={output}>
                <CheckCircle size={16} />
                {output}
              </span>
            ))}
          </div>
        </section>

        <section className="landing-final">
          <h2>Open the workspace and inspect the retrieval trace.</h2>
          <p>Sources, chunks, hybrid retrieval, reranking signals, citations and artifacts are wired into the workspace.</p>
          <button className="landing-primary" type="button" onClick={onOpenWorkspace}>
            Open {BRAND_NAME}
            <ArrowRight size={18} />
          </button>
        </section>
      </main>
    </div>
  );
}

function ResearchCanvas({
  title,
  activeCount,
  sources,
  summary,
  createdAt,
  suggestions,
  onAsk,
  onSaveSummary,
  onCopyOverview,
}: {
  title: string;
  activeCount: number;
  sources: Source[];
  summary: string;
  createdAt: string;
  suggestions: string[];
  onAsk: (prompt: string) => void;
  onSaveSummary: () => void;
  onCopyOverview: (text: string) => void;
}) {
  const activeSources = sources.filter((source) => source.active);
  const firstSourceSummary = activeSources.find((source) => source.summary)?.summary || "";
  const overview = (summary || firstSourceSummary).trim();
  const hasOverview = Boolean(activeCount && overview);
  const meta = [
    `${activeCount} source${activeCount === 1 ? "" : "s"}`,
    formatNotebookDate(createdAt || activeSources[0]?.created_at),
  ].filter(Boolean).join(" · ");
  return (
    <section className="research-canvas" data-overview={hasOverview} aria-label="Notebook overview">
      {hasOverview ? (
        <article className="source-overview">
          <span className="source-overview-symbol" aria-hidden="true">
            <ScaleIcon />
          </span>
          <h3>{title}</h3>
          <p className="source-overview-meta">{meta}</p>
          <p className="source-overview-text">{overview}</p>
          <div className="source-overview-actions" aria-label="Overview actions">
            <button type="button" onClick={onSaveSummary}>
              <ClipboardList size={15} />
              Save to note
            </button>
            <button
              type="button"
              onClick={() => onCopyOverview(overview)}
              aria-label="Copy overview"
              title="Copy overview"
            >
              <Copy size={16} />
            </button>
          </div>
        </article>
      ) : (
        <>
          <span className="canvas-mark">
            <Sparkles size={22} />
          </span>
          <h3>{activeCount ? "Ask anything about your sources" : "Add a source to get started"}</h3>
          <p>
            {activeCount
              ? `${ASSISTANT_NAME} answers only from your ${activeCount} active source${activeCount === 1 ? "" : "s"} — with a citation for every claim.`
              : "Upload a document, paste text, add a note, or link a website. Every answer stays grounded in what you add."}
          </p>
        </>
      )}
      {activeCount && suggestions.length ? (
        <div className="canvas-suggestions">
          {suggestions.slice(0, hasOverview ? 3 : 4).map((prompt) => (
            <button key={prompt} type="button" onClick={() => onAsk(prompt)}>
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ScaleIcon() {
  return (
    <span className="scale-icon" aria-hidden="true">
      ⚖
    </span>
  );
}

const ChatBubble = memo(function ChatBubble({
  message,
  onCitationClick,
}: {
  message: ChatMessage;
  onCitationClick: (citation: Citation) => void;
}) {
  // Parsing markdown is the expensive part of rendering a message. Memoize it so
  // unrelated App re-renders (typing in the input, the debug status poll) don't
  // re-parse every message's markdown on each keystroke/tick.
  const body = useMemo(
    () => renderMessageContent(message.content, message.citations || [], onCitationClick),
    [message.content, message.citations, onCitationClick],
  );
  return (
    <article className="chat-bubble" data-role={message.role}>
      <span className="avatar">{message.role === "assistant" ? <Bot size={17} /> : <NotebookPen size={17} />}</span>
      <div className="bubble-body">
        <div className="bubble-topline">
          <strong>{message.role === "assistant" ? ASSISTANT_NAME : "You"}</strong>
          {message.role === "assistant" && message.provider ? (
            <span
              title={
                message.provider === "local"
                  ? "The AI provider was unavailable for this reply, so it was assembled directly from quoted passages in your sources."
                  : undefined
              }
            >
              {providerMeta(message)}
            </span>
          ) : null}
          {message.mode === "abstained" ? <span>Abstained</span> : null}
        </div>
        <div className="answer-text">{body}</div>
      </div>
    </article>
  );
});

function renderInline(
  text: string,
  citations: Citation[],
  onCitationClick: (citation: Citation) => void,
  keyPrefix: string,
) {
  return text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    const bold = /^\*\*([^*]+)\*\*$/.exec(token);
    // Recurse into bold spans so citation markers nested in **…[1]** still render
    // as clickable chips instead of dead literal text.
    if (bold) return <strong key={key}>{renderInline(bold[1], citations, onCitationClick, key)}</strong>;
    const cite = /^\[(\d+)\]$/.exec(token);
    if (cite) {
      const marker = Number(cite[1]);
      const citation = citations.find((c) => c.index === marker) ?? citations[marker - 1];
      if (citation) {
        return (
          <button key={key} type="button" className="inline-citation" onClick={() => onCitationClick(citation)}>
            {token}
          </button>
        );
      }
    }
    return token ? <span key={key}>{token}</span> : null;
  });
}

function renderMessageContent(
  content: string,
  citations: Citation[],
  onCitationClick: (citation: Citation) => void,
) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const current = list;
    const key = `list-${blocks.length}`;
    const items = current.items.map((item, i) => (
      <li key={`${key}-${i}`}>{renderInline(item, citations, onCitationClick, `${key}-${i}`)}</li>
    ));
    blocks.push(current.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
    list = null;
  };

  content.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    const key = `b-${index}`;
    if (!line) {
      flushList();
      return;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const inner = renderInline(heading[2], citations, onCitationClick, key);
      blocks.push(heading[1].length === 1 ? <h4 key={key}>{inner}</h4> : <h5 key={key}>{inner}</h5>);
      return;
    }
    const unordered = /^[-*]\s+(.*)$/.exec(line);
    const ordered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (unordered) {
      if (list?.ordered) flushList();
      if (!list) list = { ordered: false, items: [] };
      list.items.push(unordered[1]);
      return;
    }
    if (ordered) {
      if (list && !list.ordered) flushList();
      if (!list) list = { ordered: true, items: [] };
      list.items.push(ordered[2]);
      return;
    }
    flushList();
    blocks.push(<p key={key}>{renderInline(line, citations, onCitationClick, key)}</p>);
  });
  flushList();
  return blocks;
}

function ThinkingBubble({ topic = "" }: { topic?: string }) {
  const phrases = useMemo(() => {
    const t = topic.trim().replace(/\s+/g, " ").split(" ").slice(0, 5).join(" ");
    return [
      "Skimming your sources for the good parts…",
      t ? `Connecting the dots on ${t}…` : "Connecting the dots…",
      "Pulling the exact quotes that back this up…",
      "Cross-checking every claim against the sources…",
      t ? `Thinking it through on ${t}…` : "Thinking it through…",
      "Lining up the citations…",
      "Making sure I only say what's actually in there…",
    ];
  }, [topic]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    const id = setInterval(() => setIndex((current) => (current + 1) % phrases.length), 1900);
    return () => clearInterval(id);
  }, [phrases]);
  return (
    <article className="chat-bubble">
      <span className="avatar">
        <Loader2 className="spin" size={17} />
      </span>
      <div className="bubble-body">
        <div className="bubble-topline">
          <strong>{ASSISTANT_NAME}</strong>
          <span>Thinking</span>
        </div>
        <p className="thinking-line">{phrases[index]}</p>
      </div>
    </article>
  );
}

function DebugPanel({ status, isWorking }: { status: DebugStatusResponse | null; isWorking: boolean }) {
  const debug = status?.debug;
  const events = status?.events || [];
  const runningJobs = debug?.running_jobs || [];
  const recentJobs = debug?.recent_jobs || [];
  const modelRuns = debug?.recent_model_runs || [];

  if (!debug) {
    return (
      <div className="debug-panel">
        <div className="debug-empty">
          <Loader2 className="spin" size={18} />
          <p>Loading runtime diagnostics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="debug-panel">
      <div className="debug-summary" data-working={isWorking}>
        <span>
          {isWorking ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
          <strong>{isWorking ? "Working" : "Idle"}</strong>
        </span>
        <span>
          <Database size={16} />
          {debug.storage_dir}
        </span>
        <span>{formatDebugTime(debug.server_time)}</span>
      </div>

      <div className="debug-count-grid">
        {Object.entries(debug.counts).map(([key, value]) => (
          <span key={key}>
            <strong>{value}</strong>
            {key.replaceAll("_", " ")}
          </span>
        ))}
      </div>

      <section className="debug-section">
        <div className="section-heading">
          <strong>Running jobs</strong>
          <span>{runningJobs.length}</span>
        </div>
        {runningJobs.length ? (
          <div className="debug-job-list">
            {runningJobs.map((job) => <DebugJobRow key={job.id} job={job} />)}
          </div>
        ) : (
          <p className="debug-muted">No queued or running artifact jobs.</p>
        )}
      </section>

      <section className="debug-section">
        <div className="section-heading">
          <strong>Recent jobs</strong>
          <span>{recentJobs.length}</span>
        </div>
        <div className="debug-job-list compact">
          {recentJobs.slice(0, 6).map((job) => <DebugJobRow key={job.id} job={job} />)}
        </div>
      </section>

      <section className="debug-section">
        <div className="section-heading">
          <strong>Model runs</strong>
          <span>{modelRuns.length}</span>
        </div>
        <div className="debug-run-list">
          {modelRuns.slice(0, 8).map((run) => (
            <article key={run.id} data-status={run.status}>
              <span>
                <strong>{run.role}</strong>
                {run.provider} · {run.model}
              </span>
              <span>{run.status}</span>
              <span>{run.latency_ms} ms</span>
              {run.error ? <small>{run.error}</small> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="debug-section">
        <div className="section-heading">
          <strong>Event log</strong>
          <span>{events.length}</span>
        </div>
        <div className="debug-event-list">
          {events.map((event) => (
            <article key={event.id} data-level={event.level}>
              <header>
                <span>{formatDebugTime(event.timestamp)}</span>
                <strong>{event.event}</strong>
                <em>{event.level}</em>
              </header>
              <pre>{formatDebugDetails(event.details)}</pre>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DebugJobRow({ job }: { job: DebugJob }) {
  return (
    <article data-status={job.status}>
      <span>
        <strong>{job.type}</strong>
        {job.id}
      </span>
      <span>{job.status}</span>
      <span>{job.progress}%</span>
      <small>{formatDebugTime(job.updated_at || job.created_at)}</small>
      {job.error ? <p>{job.error}</p> : null}
    </article>
  );
}

function providerLabel(status: ProviderStatus | null) {
  if (!status) return "Provider status";
  const label =
    {
      anthropic: "Anthropic grounded answer",
      openai: "OpenAI grounded answer",
      google: "Gemini grounded answer",
      local: "Deterministic fallback",
    }[status.active_grounded_answer_provider] || "Deterministic fallback";
  return status.external_grounded_answer_enabled ? label : "Deterministic fallback";
}

function providerMeta(message: ChatMessage) {
  // The local path assembles the answer from source quotes without an LLM —
  // say that in product language instead of leaking engine jargon.
  if (message.provider === "local") return "Built from source quotes";
  const provider =
    {
      anthropic: "Anthropic",
      openai: "OpenAI",
      google: "Gemini",
    }[message.provider || ""] || message.provider;
  return [provider, message.model].filter(Boolean).join(" · ");
}

function ArtifactPreview({
  artifact,
  onCitationClick,
  onArtifactRefresh,
  onToast,
  onError,
}: {
  artifact: Artifact | null;
  onCitationClick: (citation: Citation) => void;
  onArtifactRefresh: () => void;
  onToast: (message: string) => void;
  onError: (message: string) => void;
}) {
  if (!artifact) {
    return (
      <div className="artifact-preview">
        <p>Generate a source-backed Studio artifact to preview it here.</p>
      </div>
    );
  }
  const payload = artifact.content_json;
  const svgMarkup = typeof payload.svg_markup === "string" ? payload.svg_markup : "";
  return (
    <div className="artifact-preview">
      {artifact.type !== "quiz" && artifact.type !== "data-table" ? (
      <div className="artifact-preview-top">
        <div>
          <h3>{artifact.title}</h3>
        </div>
        <div className="artifact-downloads">
          {svgMarkup ? (
            <button className="icon-button subtle" type="button" onClick={() => downloadText(`${downloadSlug(artifact.title)}.svg`, svgMarkup, "image/svg+xml")} aria-label="Download infographic SVG">
              <Download size={15} />
            </button>
          ) : null}
          {artifact.type === "thumbnail" && payload?.image_data ? (
            <a className="icon-button subtle" href={String(payload.image_data)} download={`${downloadSlug(artifact.title)}.png`} aria-label="Download thumbnail image">
              <Download size={15} />
            </a>
          ) : artifact.type === "slide-deck" && typeof payload.pptx_url === "string" ? (
            <a className="icon-button subtle" href={payload.pptx_url} download={String(payload.pptx_file_name || `${downloadSlug(artifact.title)}.pptx`)} aria-label="Download slide deck presentation">
              <Download size={15} />
            </a>
          ) : artifact.type !== "thumbnail" ? (
            <button className="icon-button subtle" type="button" onClick={() => downloadText(`${downloadSlug(artifact.title)}.json`, JSON.stringify(payload, null, 2))} aria-label="Download artifact JSON">
              <Download size={15} />
            </button>
          ) : null}
        </div>
      </div>
      ) : null}
      <ArtifactPayload
        artifact={artifact}
        payload={payload}
        onCitationClick={onCitationClick}
        onArtifactRefresh={onArtifactRefresh}
        onToast={onToast}
        onError={onError}
      />
    </div>
  );
}

function ArtifactPayload({
  artifact,
  payload,
  onCitationClick,
  onArtifactRefresh,
  onToast,
  onError,
}: {
  artifact: Artifact;
  payload: Record<string, unknown>;
  onCitationClick: (citation: Citation) => void;
  onArtifactRefresh: () => void;
  onToast: (message: string) => void;
  onError: (message: string) => void;
}) {
  if (typeof payload.image_data === "string" || typeof payload.image_prompt === "string") {
    const image = String(payload.image_data || "");
    return (
      <div className="thumbnail-preview">
        {image ? (
          <img src={image} alt="Generated thumbnail" />
        ) : (
          <div className="thumb-empty">
            <Image size={28} />
            <p>{String(payload.image_status || "No image generated.")}</p>
          </div>
        )}
        <div className="thumbnail-preview-actions">
          {image ? (
            <a className="secondary-button" href={image} download="thumbnail.png">
              <Download size={15} /> Download
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (Array.isArray(payload.titles) && Array.isArray(payload.chapters)) {
    const titles = (payload.titles as string[]) || [];
    const description = String(payload.description || "");
    const chapters = (payload.chapters as Array<{ time?: string; label?: string }>) || [];
    const tags = (payload.tags as string[]) || [];
    const copy = async (text: string, label: string) => {
      try {
        await copyTextToClipboard(text);
        onToast(`${label} copied.`);
      } catch (error) {
        onError(error instanceof Error ? error.message : `${label} could not be copied.`);
      }
    };
    return (
      <div className="youtube-kit-preview">
        <section>
          <h4>Title options</h4>
          <div className="yt-titles">
            {titles.map((title, index) => (
              <button key={index} type="button" className="yt-title" onClick={() => void copy(title, "Title")} aria-label={`Copy title option ${index + 1}`}>
                <span>{title}</span>
                <span className="yt-title-copy" aria-hidden="true">
                  <Copy size={13} /> Copy
                </span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="yt-section-head">
            <h4>Description</h4>
            <button type="button" onClick={() => void copy(description, "Description")}>
              <Copy size={13} /> Copy
            </button>
          </div>
          <pre className="yt-description">{description}</pre>
        </section>
        {chapters.length ? (
          <section>
            <div className="yt-section-head">
              <h4>Chapters</h4>
              <button type="button" onClick={() => void copy(chapters.map((chapter) => `${chapter.time} ${chapter.label}`).join("\n"), "Chapters")}>
                <Copy size={13} /> Copy
              </button>
            </div>
            <div className="yt-chapters">
              {chapters.map((chapter, index) => (
                <div key={index}>
                  <strong>{chapter.time}</strong>
                  <span>{chapter.label}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {tags.length ? (
          <section>
            <h4>Tags</h4>
            <div className="yt-tags">
              {tags.map((tag, index) => (
                <span key={index}>{tag}</span>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  if (artifact.type === "report" || Array.isArray(payload.detailed_sections) || Array.isArray(payload.key_findings)) {
    return <ReportPreview payload={payload} onCitationClick={onCitationClick} />;
  }

  if (Array.isArray(payload.panels)) {
    return <InfographicPreview payload={payload} panels={payload.panels as InfographicPanelPayload[]} />;
  }

  if (Array.isArray(payload.nodes) && Array.isArray(payload.edges)) {
    return (
      <MindMapPreview
        nodes={payload.nodes as MindMapNode[]}
        edges={payload.edges as MindMapEdge[]}
        title={artifact.title || (typeof payload.title === "string" ? payload.title : "Mind map")}
        onCitationClick={onCitationClick}
      />
    );
  }
  if (Array.isArray(payload.cards)) {
    return (
      <FlashcardSession
        artifact={artifact}
        fallbackCards={payload.cards as FlashcardPayload[]}
        fallbackProgress={payload.progress as FlashcardProgressPayload | undefined}
        onCitationClick={onCitationClick}
        onArtifactRefresh={onArtifactRefresh}
        onToast={onToast}
        onError={onError}
      />
    );
  }
  if (Array.isArray(payload.questions)) {
    return <QuizSession payload={payload} questions={payload.questions as QuizPayload[]} />;
  }
  if (Array.isArray(payload.rows)) {
    if (artifact.type === "data-table") {
      return <DataTablePreview artifact={artifact} payload={payload} rows={payload.rows as TableRowPayload[]} onCitationClick={onCitationClick} />;
    }
    return (
      <div className="schema-table">
        {(payload.rows as TableRowPayload[]).slice(0, 6).map((row, index) => (
          <article key={index}>
            {Object.entries(row.cells || {}).map(([key, value]) => (
              <span key={key}>
                <strong>{key}</strong>
                {String(value)}
              </span>
            ))}
          </article>
        ))}
      </div>
    );
  }
  if (Array.isArray(payload.slides)) {
    return (
      <SlideDeckPreview
        slides={payload.slides as SlidePayload[]}
        title={artifact.title}
        pptxUrl={typeof payload.pptx_url === "string" ? payload.pptx_url : ""}
        pptxFileName={typeof payload.pptx_file_name === "string" ? payload.pptx_file_name : ""}
        renderStatus={typeof payload.render_status === "string" ? payload.render_status : ""}
        onCitationClick={onCitationClick}
        onToast={onToast}
        onError={onError}
      />
    );
  }
  if (Array.isArray(payload.transcript)) {
    const audioUrl = typeof payload.audio_url === "string" ? payload.audio_url : "";
    const audioStatus = typeof payload.audio_status === "string" ? payload.audio_status : "";
    const ttsStatus = typeof payload.tts_status === "string" ? payload.tts_status : "";
    const transcript = payload.transcript as TranscriptPayload[];
    const outline = Array.isArray(payload.episode_outline) ? payload.episode_outline : [];
    const sourceCoverage = typeof payload.source_coverage === "object" && payload.source_coverage
      ? payload.source_coverage as Record<string, unknown>
      : {};
    const qualityChecks = typeof payload.quality_checks === "object" && payload.quality_checks
      ? payload.quality_checks as Record<string, unknown>
      : {};
    return (
      <div className="artifact-json audio-artifact">
        <article className="audio-player-card">
          <strong>Audio rendering</strong>
          <p>{ttsStatus || audioStatus || "Transcript ready."}</p>
          {audioUrl ? <audio controls preload="metadata" src={audioUrl} /> : null}
          {audioUrl ? <a className="audio-download-link" href={audioUrl} download>Download audio</a> : null}
        </article>
        <div className="audio-meta-grid">
          <article>
            <strong>{String(payload.mode || "Audio Overview")}</strong>
            <p>{String(payload.language || "English")} · {String(payload.length || "Default")} · {transcript.length} turns</p>
          </article>
          <article>
            <strong>Source coverage</strong>
            <p>
              {String(sourceCoverage.cited_sources || 0)} cited sources · {String(sourceCoverage.evidence_items || 0)} evidence items · {String(qualityChecks.cited_turn_ratio || "0")} cited ratio
            </p>
          </article>
        </div>
        {outline.length ? (
          <div className="audio-outline">
            {outline.slice(0, 6).map((item, index) => (
              <span key={`${item}-${index}`}>{String(item)}</span>
            ))}
          </div>
        ) : null}
        <div className="audio-transcript">
          {transcript.slice(0, 12).map((line, index) => (
            <article key={index}>
              <strong>{line.host}</strong>
              <p>{line.text}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }
  if (Array.isArray(payload.storyboard)) {
    const videoUrl = typeof payload.video_url === "string" ? payload.video_url : "";
    const videoStatus = typeof payload.video_status === "string" ? payload.video_status.replaceAll("_", " ") : "";
    const renderStatus = typeof payload.render_status === "string" ? payload.render_status.replaceAll("_", " ") : "";
    const duration = typeof payload.video_duration_seconds === "number" ? `${Math.round(payload.video_duration_seconds)}s` : "Pending";
    const resolution = typeof payload.video_resolution === "string" ? payload.video_resolution : "1280x720";
    const narration = typeof payload.video_narration_status === "string" ? payload.video_narration_status.replaceAll("_", " ") : "captioned";
    const storyboard = payload.storyboard as StoryboardPayload[];
    return (
      <div className="artifact-json video-artifact">
        <article className="video-player-card">
          <strong>Video rendering</strong>
          <p>{videoUrl ? "MP4 rendered from the source-grounded storyboard." : String(payload.video_error || renderStatus || videoStatus || "Rendering video...")}</p>
          {videoUrl ? <video controls preload="metadata" src={videoUrl} /> : (
            <div className="video-empty">
              <Video size={28} />
              <span>{videoStatus || renderStatus || "Video not ready"}</span>
            </div>
          )}
          {videoUrl ? <a className="video-download-link" href={videoUrl} download>Download video</a> : null}
        </article>
        <div className="video-meta-grid">
          <article>
            <strong>Format</strong>
            <p>{resolution} · {duration} · MP4</p>
          </article>
          <article>
            <strong>Narration</strong>
            <p>{narration}</p>
          </article>
        </div>
        <div className="video-storyboard">
          {storyboard.slice(0, 8).map((scene, index) => (
            <article key={index}>
              <strong>Scene {scene.scene}: {scene.title}</strong>
              <p>{scene.narration}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }
  return <pre className="artifact-json">{JSON.stringify(payload, null, 2)}</pre>;
}

function reportItems(value: unknown): string[] {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map(reportItemText).filter(Boolean);
}

function reportItemText(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object") return String(item ?? "").trim();
  const record = item as Record<string, unknown>;
  if (typeof record.text === "string") return record.text.trim();
  if (typeof record.analysis === "string") return record.analysis.trim();
  if (typeof record.body === "string") return record.body.trim();
  if (typeof record.title === "string") return record.title.trim();
  const parts = ["action", "finding", "recommendation", "citation"]
    .map((key) => (typeof record[key] === "string" ? String(record[key]).trim() : ""))
    .filter(Boolean);
  if (parts.length) return parts.join(": ");
  return Object.entries(record)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}`)
    .join("; ");
}

function reportHeadingFromText(value: string, fallback: string) {
  const cleaned = value
    .replace(/\[[0-9]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fallback;
  const firstSentence = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;
  return clipReportText(firstSentence, 78);
}

function isReportAuditSection(section: Record<string, unknown>) {
  const heading = String(section.heading || section.title || "").trim();
  return /^(evidence\s+audit|citation\s+audit|source\s+audit|audit)$/i.test(heading);
}

function reportFindingDisplayHeading(finding: Record<string, unknown>, index: number) {
  const heading = String(finding.heading || finding.title || "").trim();
  if (heading && !/^finding\s+\d+$/i.test(heading)) return heading;
  return reportHeadingFromText(reportItemText(finding), `Finding ${index + 1}`);
}

function ReportPreview({
  payload,
  onCitationClick,
}: {
  payload: Record<string, unknown>;
  onCitationClick: (citation: Citation) => void;
}) {
  const citations = Array.isArray(payload.citations) ? payload.citations as Citation[] : [];
  const abstract = reportItems(payload.abstract);
  const executiveSummary = reportItems(payload.executive_summary);
  const scope = reportItems(payload.scope);
  const methodology = reportItems(payload.methodology);
  const findings = Array.isArray(payload.key_findings)
    ? payload.key_findings as Array<Record<string, unknown>>
    : (Array.isArray(payload.key_points) ? payload.key_points as Array<Record<string, unknown>> : []);
  const sections = Array.isArray(payload.detailed_sections)
    ? (payload.detailed_sections as Array<Record<string, unknown>>).filter((section) => !isReportAuditSection(section))
    : [];
  const recommendations = reportItems(payload.recommendations);
  const risks = reportItems(payload.risks_limitations);
  const questions = reportItems(payload.open_questions);
  const bibliography = reportItems(payload.bibliography);
  const intro = abstract.length ? abstract : executiveSummary;

  return (
    <article className="report-preview">
      {intro.length ? (
        <section className="report-section report-executive">
          <h4>Executive Summary</h4>
          {intro.map((paragraph, index) => (
            <p key={index}>{renderInline(paragraph, citations, onCitationClick, `report-exec-${index}`)}</p>
          ))}
        </section>
      ) : null}

      {scope.length || methodology.length ? (
        <section className="report-section report-method">
          <h4>Scope and Method</h4>
          {scope.map((paragraph, index) => (
            <p key={`scope-${index}`}>{renderInline(paragraph, citations, onCitationClick, `report-scope-${index}`)}</p>
          ))}
          {methodology.map((paragraph, index) => (
            <p key={`method-${index}`}>{renderInline(paragraph, citations, onCitationClick, `report-method-${index}`)}</p>
          ))}
        </section>
      ) : null}

      {findings.length ? (
        <section className="report-section">
          <h4>Principal Findings</h4>
          <div className="report-finding-list">
            {findings.slice(0, 8).map((finding, index) => {
              const heading = reportFindingDisplayHeading(finding, index);
              const text = reportItemText(finding);
              const analysis = typeof finding.analysis === "string" ? finding.analysis : "";
              return (
                <article key={`${heading}-${index}`} className="report-finding">
                  <strong>{heading}</strong>
                  {text ? <p>{renderInline(text, citations, onCitationClick, `report-finding-${index}`)}</p> : null}
                  {analysis ? <p>{renderInline(analysis, citations, onCitationClick, `report-finding-analysis-${index}`)}</p> : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {sections.map((section, index) => {
        const body = reportItems(section.body);
        const evidence = reportItems(section.evidence);
        const implications = reportItems(section.implications);
        return (
          <section key={`${section.heading || "section"}-${index}`} className="report-section">
            <h4>{String(section.heading || `Section ${index + 1}`)}</h4>
            {body.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex}>{renderInline(paragraph, citations, onCitationClick, `report-section-${index}-${paragraphIndex}`)}</p>
            ))}
            {evidence.length ? (
              <div className="report-mini-list">
                <strong>Evidence</strong>
                <ul>
                  {evidence.map((item, itemIndex) => (
                    <li key={itemIndex}>{renderInline(item, citations, onCitationClick, `report-evidence-${index}-${itemIndex}`)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {implications.length ? (
              <div className="report-mini-list">
                <strong>Implications</strong>
                <ul>
                  {implications.map((item, itemIndex) => (
                    <li key={itemIndex}>{renderInline(item, citations, onCitationClick, `report-implication-${index}-${itemIndex}`)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        );
      })}

      {recommendations.length ? (
        <section className="report-section">
          <h4>Recommendations</h4>
          <ol className="report-ordered">
            {recommendations.map((item, index) => (
              <li key={index}>{renderInline(item, citations, onCitationClick, `report-rec-${index}`)}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="report-section report-appendix">
        {risks.length ? (
          <div>
            <h4>Limitations and Risks</h4>
            <ul>{risks.map((item, index) => <li key={index}>{renderInline(item, citations, onCitationClick, `report-risk-${index}`)}</li>)}</ul>
          </div>
        ) : null}
        {questions.length ? (
          <div>
            <h4>Open questions</h4>
            <ul>{questions.map((item, index) => <li key={index}>{renderInline(item, citations, onCitationClick, `report-question-${index}`)}</li>)}</ul>
          </div>
        ) : null}
        {bibliography.length ? (
          <div>
            <h4>Bibliography</h4>
            <ul>{bibliography.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </div>
        ) : null}
      </section>
    </article>
  );
}

function DataTablePreview({
  artifact,
  payload,
  rows,
  onCitationClick,
}: {
  artifact: Artifact;
  payload: Record<string, unknown>;
  rows: TableRowPayload[];
  onCitationClick: (citation: Citation) => void;
}) {
  const columns = dataTableColumns(payload, rows);
  const sourceNotes = dataTableSourceNotes(payload, rows, artifact);
  const sourceCount = sourceNotes.length || artifact.source_refs_json?.length || 0;
  const tableStyle = { "--data-table-columns": Math.max(columns.length, 1) } as CSSProperties;
  const csv = () => {
    const csvRows = [
      columns,
      ...rows.map((row) => columns.map((column) => dataTableCellText(row.cells?.[column]))),
    ];
    downloadText(`${downloadSlug(artifact.title)}.csv`, csvRows.map((row) => row.map(csvTextCell).join(",")).join("\n"), "text/csv");
  };

  return (
    <div className="data-table-preview">
      <div className="data-table-breadcrumb">
        <span>Studio</span>
        <ChevronRight size={14} />
        <strong>Data Table</strong>
      </div>
      <div className="data-table-toolbar">
        <div>
          <h3>{String(payload.title || artifact.title)}</h3>
          <button type="button" className="data-table-source-pill" disabled={!sourceNotes.length}>
            View {sourceCount || 0} source{sourceCount === 1 ? "" : "s"}
          </button>
        </div>
        <div className="data-table-actions">
          <span>{rows.length} rows</span>
          <span>{columns.length} columns</span>
          <button type="button" onClick={csv} aria-label="Download data table CSV">
            <Download size={14} />
            CSV
          </button>
        </div>
      </div>

      <div className="data-table-scroll" style={tableStyle}>
        <table>
          <thead>
            <tr>
              <th className="data-table-index" scope="col">#</th>
              {columns.map((column) => (
                <th key={column} scope="col">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const refs = row.source_refs || [];
              const sourceFallback = dataTableCellText(row.cells?.Source || row.cells?.source || `Row ${rowIndex + 1}`);
              const rowCitation = refs[0] ? citationFromSourceRef(dataTableHydrateSourceRef(refs[0], sourceNotes), sourceFallback) : null;
              return (
                <tr key={rowIndex}>
                  <td className="data-table-index">
                    {rowCitation ? (
                      <button type="button" onClick={() => onCitationClick(rowCitation)} aria-label={`Open source for row ${rowIndex + 1}`}>
                        {rowIndex + 1}
                      </button>
                    ) : (
                      rowIndex + 1
                    )}
                  </td>
                  {columns.map((column) => {
                    const rawValue = row.cells?.[column];
                    const text = dataTableCellText(rawValue);
                    const support = dataTableSupport(rawValue, row, column);
                    const sourceRef = column.toLowerCase() === "source" && rowCitation;
                    return (
                      <td key={column} data-column={column}>
                        {sourceRef ? (
                          <button type="button" className="data-table-source-link" onClick={() => onCitationClick(sourceRef)}>
                            {text || dataTableSourceLabel(sourceRef)}
                          </button>
                        ) : column.toLowerCase() === "support" ? (
                          <span className="data-table-support" data-support={support || text}>{dataTableSupportLabel(support || text)}</span>
                        ) : (
                          <>
                            <span>{text || "—"}</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function dataTableColumns(payload: Record<string, unknown>, rows: TableRowPayload[]) {
  const payloadColumns = Array.isArray(payload.columns) ? payload.columns.map(String).filter(Boolean) : [];
  const inferredColumns = rows.flatMap((row) => Object.keys(row.cells || {}));
  return Array.from(new Set([...payloadColumns, ...inferredColumns]));
}

function dataTableCellText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(dataTableCellText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("value" in record) return dataTableCellText(record.value);
    if ("text" in record) return dataTableCellText(record.text);
    return JSON.stringify(record);
  }
  return String(value);
}

function dataTableSupport(value: unknown, row: TableRowPayload, column: string) {
  if (typeof value === "object" && value) {
    const record = value as Record<string, unknown>;
    if (typeof record.support === "string") return record.support;
    if (typeof record.status === "string") return record.status;
  }
  return row.cell_support?.[column] || row.support || "";
}

function dataTableSupportLabel(value: string) {
  return value.replaceAll("_", " ");
}

function dataTableSourceNotes(payload: Record<string, unknown>, rows: TableRowPayload[], artifact: Artifact) {
  const explicit = Array.isArray(payload.source_notes) ? payload.source_notes : [];
  const rawNotes = explicit.length
    ? explicit
    : rows.flatMap((row) => row.source_refs || artifact.source_refs_json || []);
  const notes = new globalThis.Map<string, Record<string, unknown>>();
  rawNotes.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const note = raw as Record<string, unknown>;
    const label = String(note.label || note.citation || `[${index + 1}]`);
    const key = String(note.source_id || note.source_title || label);
    if (notes.has(key)) return;
    notes.set(key, {
      ...note,
      label,
      source_title: String(note.source_title || note.sourceTitle || note.title || "Source"),
    });
  });
  return [...notes.values()];
}

function dataTableHydrateSourceRef(ref: Record<string, unknown>, sourceNotes: Array<Record<string, unknown>>) {
  const sourceId = String(ref.source_id || "");
  const label = String(ref.label || ref.citation || "");
  const note = sourceNotes.find((item) =>
    (sourceId && String(item.source_id || "") === sourceId) ||
    (label && [item.label, item.citation].map(String).includes(label)),
  );
  return note ? { ...note, ...ref, source_title: ref.source_title || note.source_title } : ref;
}

function dataTableSourceLabel(citation: Citation) {
  const match = /\[(\d+)\]/.exec(citation.evidence_id || citation.quote || "");
  return match ? `[${match[1]}]` : citation.source_title || "[1]";
}

// ---------------------------------------------------------------------------
// Interactive mind map (NotebookLM-style): a collapsible horizontal tree drawn
// in SVG. Branches unfold on click, the canvas pans/zooms, and leaves stay
// grounded — clicking one opens its source. The deterministic/LLM payload is a
// nodes+edges graph; we rebuild the hierarchy here and lay it out tidily.
// ---------------------------------------------------------------------------

interface MMLaidNode {
  id: string;
  label: string;
  type: string;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
  hasChildren: boolean;
  expanded: boolean;
  refs: Record<string, unknown>[];
}

interface MMLink {
  id: string;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface MMLayout {
  nodes: MMLaidNode[];
  links: MMLink[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  rootId: string;
}

const MM_FONT = '600 14px "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif';
const MM_TEXT_FONT_FAMILY = '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif';
const MM_PAD_X = 15;
const MM_PAD_Y = 11;
const MM_LINE_H = 18;
const MM_MAX_TEXT = 168;
const MM_MIN_W = 116;
const MM_H_GAP = 96;
const MM_V_GAP = 26;
const MM_TOGGLE_R = 11;
const MM_TOGGLE_OFF = 18;

let mmMeasureCtx: CanvasRenderingContext2D | null = null;
function mmMeasure(text: string): number {
  if (mmMeasureCtx === null) {
    const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    mmMeasureCtx = canvas ? canvas.getContext("2d") : null;
    if (mmMeasureCtx) mmMeasureCtx.font = MM_FONT;
  }
  if (!mmMeasureCtx) return text.length * 7.7;
  return mmMeasureCtx.measureText(text).width;
}

function mmTrimToWidth(line: string): string {
  let trimmed = line;
  while (trimmed.length > 1 && mmMeasure(trimmed) > MM_MAX_TEXT) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
}

function mmWrap(label: string): string[] {
  const text = String(label || "Node").replace(/\s+/g, " ").trim() || "Node";
  if (mmMeasure(text) <= MM_MAX_TEXT) return [text];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (mmMeasure(candidate) <= MM_MAX_TEXT || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === 3) {
        lines[2] = mmTrimToWidth(`${lines[2]} …`);
        return lines;
      }
    }
  }
  if (current) lines.push(current);
  if (lines.length > 3) {
    const kept = lines.slice(0, 3);
    kept[2] = mmTrimToWidth(`${kept[2]} …`);
    return kept;
  }
  return lines.map((line) => (mmMeasure(line) > MM_MAX_TEXT ? mmTrimToWidth(line) : line));
}

function mmFindRoot(nodes: MindMapNode[], edges: MindMapEdge[]): string {
  const ids = new Set(nodes.filter((node) => node && node.id).map((node) => node.id as string));
  if (ids.has("center")) return "center";
  const notebook = nodes.find((node) => node && node.id && (node.type === "notebook" || node.type === "root"));
  if (notebook?.id) return notebook.id;
  const hasParent = new Set<string>();
  for (const edge of edges) {
    if (!edge || !edge.source || !edge.target) continue;
    if (edge.source === edge.target) continue;
    if (ids.has(edge.source) && ids.has(edge.target)) hasParent.add(edge.target);
  }
  const orphan = nodes.find((node) => node && node.id && !hasParent.has(node.id));
  return orphan?.id || nodes[0]?.id || "";
}

function mmRefs(refs: unknown): Record<string, unknown>[] {
  if (Array.isArray(refs)) return refs.filter(Boolean) as Record<string, unknown>[];
  if (refs && typeof refs === "object") return [refs as Record<string, unknown>];
  return [];
}

function mmDisplayGraph(nodes: MindMapNode[], edges: MindMapEdge[]) {
  const hidden = new Set(
    nodes
      .filter((node) => {
        const label = String(node.label || "").trim();
        return node.type === "claim" || /^(Beleg:|Check Supporting Source|Link Source Proof|format[_\s-])/i.test(label);
      })
      .map((node) => node.id),
  );
  return {
    nodes: nodes.filter((node) => node.id && !hidden.has(node.id)),
    edges: edges.filter((edge) => edge.source && edge.target && !hidden.has(edge.source) && !hidden.has(edge.target)),
  };
}

function mmBuildLayout(nodes: MindMapNode[], edges: MindMapEdge[], expanded: Set<string>): MMLayout {
  const byId = new globalThis.Map<string, MindMapNode>();
  for (const node of nodes) if (node && node.id) byId.set(node.id, node);

  const childMap = new globalThis.Map<string, string[]>();
  const edgeLabels = new globalThis.Map<string, string>();
  for (const edge of edges) {
    if (!edge || !edge.source || !edge.target) continue;
    if (edge.source === edge.target || !byId.has(edge.source) || !byId.has(edge.target)) continue;
    const arr = childMap.get(edge.source) || [];
    if (!arr.includes(edge.target)) arr.push(edge.target);
    childMap.set(edge.source, arr);
    if (edge.label) edgeLabels.set(`${edge.source}->${edge.target}`, edge.label);
  }

  const rootId = mmFindRoot(nodes, edges);
  const laid: MMLaidNode[] = [];
  const visited = new Set<string>();
  let cursorY = 0;

  const measure = (node: MindMapNode) => {
    const lines = mmWrap(node.label || "Node");
    let maxLine = 0;
    for (const line of lines) maxLine = Math.max(maxLine, mmMeasure(line));
    const width = Math.min(MM_MAX_TEXT + MM_PAD_X * 2, Math.max(MM_MIN_W, Math.round(maxLine + MM_PAD_X * 2)));
    const height = Math.max(42, lines.length * MM_LINE_H + MM_PAD_Y * 2);
    return { lines, width, height };
  };

  const walk = (id: string, depth: number, x: number): MMLaidNode | null => {
    if (visited.has(id)) return null;
    const node = byId.get(id);
    if (!node) return null;
    visited.add(id);
    const { lines, width, height } = measure(node);
    const childIds = (childMap.get(id) || []).filter((cid) => byId.has(cid) && !visited.has(cid));
    const hasChildren = childIds.length > 0;
    const isExpanded = expanded.has(id);
    const laidNode: MMLaidNode = {
      id,
      label: node.label || "Node",
      type: node.type || "node",
      depth,
      x,
      y: 0,
      width,
      height,
      lines,
      hasChildren,
      expanded: isExpanded,
      refs: mmRefs(node.source_refs),
    };
    laid.push(laidNode);
    if (hasChildren && isExpanded) {
      const childX = x + width + MM_H_GAP;
      const children: MMLaidNode[] = [];
      for (const cid of childIds) {
        const child = walk(cid, depth + 1, childX);
        if (child) children.push(child);
      }
      if (children.length) {
        laidNode.y = (children[0].y + children[children.length - 1].y) / 2;
      } else {
        laidNode.y = cursorY + height / 2;
        cursorY += height + MM_V_GAP;
      }
    } else {
      laidNode.y = cursorY + height / 2;
      cursorY += height + MM_V_GAP;
    }
    return laidNode;
  };

  if (rootId) walk(rootId, 0, 0);

  const laidById = new globalThis.Map(laid.map((node) => [node.id, node] as [string, MMLaidNode]));
  const links: MMLink[] = [];
  for (const parent of laid) {
    if (!parent.expanded) continue;
    for (const cid of childMap.get(parent.id) || []) {
      const child = laidById.get(cid);
      if (!child) continue;
      const startX = parent.x + parent.width + MM_TOGGLE_OFF + MM_TOGGLE_R;
      const id = `${parent.id}->${cid}`;
      links.push({ id, label: edgeLabels.get(id) || "", x1: startX, y1: parent.y, x2: child.x, y2: child.y });
    }
  }

  const bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  if (laid.length) {
    bbox.minX = Math.min(...laid.map((node) => node.x));
    bbox.minY = Math.min(...laid.map((node) => node.y - node.height / 2));
    bbox.maxX = Math.max(...laid.map((node) => node.x + node.width + (node.hasChildren ? MM_TOGGLE_OFF + MM_TOGGLE_R : 0)));
    bbox.maxY = Math.max(...laid.map((node) => node.y + node.height / 2));
  }
  return { nodes: laid, links, bbox, rootId };
}

function mmComputeFit(
  bbox: MMLayout["bbox"],
  size: { w: number; h: number },
): { scale: number; tx: number; ty: number } {
  const contentW = Math.max(1, bbox.maxX - bbox.minX);
  const contentH = Math.max(1, bbox.maxY - bbox.minY);
  const padX = 48;
  const padY = 36;
  const scale = Math.max(0.35, Math.min(1.35, Math.min((size.w - padX * 2) / contentW, (size.h - padY * 2) / contentH)));
  const tx = (size.w - contentW * scale) / 2 - bbox.minX * scale;
  const ty = (size.h - contentH * scale) / 2 - bbox.minY * scale;
  return { scale, tx, ty };
}

function mmChevron(cx: number, cy: number, expanded: boolean): string {
  const dx = 2.6;
  const dy = 4.2;
  return expanded
    ? `M ${cx + dx} ${cy - dy} L ${cx - dx} ${cy} L ${cx + dx} ${cy + dy}`
    : `M ${cx - dx} ${cy - dy} L ${cx + dx} ${cy} L ${cx - dx} ${cy + dy}`;
}

function mmLinkPath(link: MMLink): string {
  const mx = (link.x1 + link.x2) / 2;
  return `M ${link.x1} ${link.y1} C ${mx} ${link.y1}, ${mx} ${link.y2}, ${link.x2} ${link.y2}`;
}

function mmPalette(depth: number, type: string): { fill: string; stroke: string; text: string } {
  if (depth === 0 || type === "notebook" || type === "root") {
    return { fill: "#f4f1e8", stroke: "#d8d0bd", text: "#24231f" };
  }
  if (depth === 1 || type === "topic") {
    return { fill: "#dceadf", stroke: "#8eb89b", text: "#18241d" };
  }
  if (type === "question") {
    return { fill: "#e8e1f5", stroke: "#b9a6d6", text: "#211c2d" };
  }
  if (type === "entity") {
    return { fill: "#e7edf5", stroke: "#9db1c9", text: "#172131" };
  }
  return { fill: "#f4e7d9", stroke: "#cfaa83", text: "#2c2117" };
}

function mmTypeLabel(type: string): string {
  const map: Record<string, string> = {
    notebook: "Notebook",
    root: "Notebook",
    topic: "Category",
    subtopic: "Subtopic",
    claim: "Evidence",
    entity: "Entity",
    question: "Question",
  };
  return map[type] || "Node";
}

function MindMapNodeView({
  node,
  selected,
  onActivate,
}: {
  node: MMLaidNode;
  selected: boolean;
  onActivate: () => void;
}) {
  const palette = mmPalette(node.depth, node.type);
  const top = node.y - node.height / 2;
  const cx = node.x + node.width / 2;
  const firstLineY = node.y - ((node.lines.length - 1) * MM_LINE_H) / 2;
  const toggleCx = node.x + node.width + MM_TOGGLE_OFF;
  const onKeyDown = (event: ReactKeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };
  return (
    <g
      className="mm-node"
      role="button"
      tabIndex={0}
      aria-label={`${mmTypeLabel(node.type)}: ${node.label}${node.hasChildren ? (node.expanded ? " (expanded)" : " (collapsed)") : ""}`}
      onClick={onActivate}
      onKeyDown={onKeyDown}
    >
      <rect
        className="mm-node-card"
        x={node.x}
        y={top}
        width={node.width}
        height={node.height}
        rx={11}
        ry={11}
        fill={palette.fill}
        stroke={selected ? "#16d07a" : palette.stroke}
        strokeWidth={selected ? 2.2 : 1.3}
      />
      <text
        x={node.x + MM_PAD_X}
        y={top + 15}
        fontFamily={MM_TEXT_FONT_FAMILY}
        fontSize={8.8}
        fontWeight={800}
        letterSpacing={0.6}
        fill={node.depth === 0 ? "#706a5d" : "#657064"}
      >
        {mmTypeLabel(node.type).toUpperCase()}
      </text>
      {node.lines.map((line, index) => (
        <text
          key={index}
          x={cx}
          y={firstLineY + index * MM_LINE_H + 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={MM_TEXT_FONT_FAMILY}
          fontSize={14}
          fontWeight={600}
          fill={palette.text}
        >
          {line}
        </text>
      ))}
      {node.hasChildren ? (
        <g>
          <circle className="mm-toggle-dot" cx={toggleCx} cy={node.y} r={MM_TOGGLE_R} fill="#fcfaf4" stroke={palette.stroke} strokeWidth={1.2} />
          <path
            d={mmChevron(toggleCx, node.y, node.expanded)}
            fill="none"
            stroke="#4f5b54"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : null}
    </g>
  );
}

function MindMapPreview({
  nodes,
  edges,
  title,
  onCitationClick,
}: {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  title?: string;
  onCitationClick: (citation: Citation) => void;
}) {
  const graph = useMemo(() => mmDisplayGraph(nodes, edges), [nodes, edges]);
  const rootId = useMemo(() => mmFindRoot(graph.nodes, graph.edges), [graph]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(rootId ? [rootId] : []));
  const [selectedId, setSelectedId] = useState<string>("");
  const [view, setView] = useState({ scale: 1, tx: 48, ty: 48 });
  const [size, setSize] = useState({ w: 880, h: 480 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const layout = useMemo(() => mmBuildLayout(graph.nodes, graph.edges, expanded), [graph, expanded]);

  // Always keep the central root open so there is something to unfold from.
  useEffect(() => {
    if (!rootId) return;
    setExpanded((prev) => {
      if (prev.has(rootId)) return prev;
      const next = new Set(prev);
      next.add(rootId);
      return next;
    });
  }, [rootId]);

  // Track the canvas size for fit-to-view, panning, and the viewBox.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => setSize({ w: element.clientWidth || 880, h: element.clientHeight || 480 });
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Refit after expansion/collapse so newly revealed branches do not start clipped.
  useEffect(() => {
    if (!layout.nodes.length || size.w <= 1) return;
    setView(mmComputeFit(layout.bbox, size));
  }, [layout.bbox, layout.nodes.length, size]);

  const selectedNode = layout.nodes.find((node) => node.id === selectedId) || null;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activateNode = (node: MMLaidNode) => {
    setSelectedId(node.id);
    if (node.hasChildren) {
      toggle(node.id);
      return;
    }
    const ref = node.refs[0];
    if (ref) onCitationClick(citationFromSourceRef(ref, node.label));
  };

  const zoomAround = (factor: number, cx: number, cy: number) => {
    setView((prev) => {
      const scale = Math.max(0.35, Math.min(2.2, prev.scale * factor));
      const k = scale / prev.scale;
      return { scale, tx: cx - (cx - prev.tx) * k, ty: cy - (cy - prev.ty) * k };
    });
  };

  // Native non-passive listener: React registers onWheel passively on the root,
  // so preventDefault() there is a no-op and the page scrolls while zooming.
  const zoomAroundRef = useRef(zoomAround);
  zoomAroundRef.current = zoomAround;
  const hasNodes = layout.nodes.length > 0;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !hasNodes) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomAroundRef.current(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top);
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [hasNodes]);

  const onPanDown = (event: ReactPointerEvent<SVGRectElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty };
  };
  const onPanMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    setView((prev) => ({ ...prev, tx: start.tx + dx, ty: start.ty + dy }));
  };
  const onPanUp = () => {
    drag.current = null;
  };

  const fitView = () => setView(mmComputeFit(layout.bbox, size));

  const downloadPng = () => {
    const group = contentRef.current;
    if (!group) return;
    const { minX, minY, maxX, maxY } = layout.bbox;
    const pad = 44;
    const width = Math.max(1, Math.round(maxX - minX + pad * 2));
    const height = Math.max(1, Math.round(maxY - minY + pad * 2));
    const clone = group.cloneNode(true) as SVGGElement;
    clone.setAttribute("transform", `translate(${pad - minX} ${pad - minY})`);
    const serialized = new XMLSerializer().serializeToString(clone);
    // The live SVG gets connector strokes from the app stylesheet; a standalone
    // export has no stylesheet, so without this the links rasterize invisible.
    const exportStyles = "<style>.mm-link{stroke:rgba(214,221,215,0.38);stroke-width:1.7px;stroke-linecap:round}.mm-link-label{display:none}</style>";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${exportStyles}<rect width="${width}" height="${height}" fill="#0d141c"/>${serialized}</svg>`;
    rasterizeSvg(svg, Math.min(2600, width * 2))
      .then(({ dataUrl }) => {
        const anchor = document.createElement("a");
        anchor.href = dataUrl;
        anchor.download = `${downloadSlug(title || "mind-map")}.png`;
        anchor.click();
      })
      .catch(() => {});
  };

  return (
    <div className="mm-wrap">
      <div className="mm-topline">
        <div>
          <span>Mind Map</span>
          <strong>{title || "Notebook map"}</strong>
        </div>
        <small>{layout.nodes.length} nodes · {layout.links.length} visible branches</small>
      </div>
      <div className="mm-canvas" ref={containerRef}>
        {layout.nodes.length ? (
          <svg
            ref={svgRef}
            className="mm-svg"
            width="100%"
            height="100%"
            viewBox={`0 0 ${size.w} ${size.h}`}
            role="img"
            aria-label={`Mind map: ${title || "Notebook"}`}
          >
            <rect
              className="mm-pan"
              x={0}
              y={0}
              width={size.w}
              height={size.h}
              fill="transparent"
              onPointerDown={onPanDown}
              onPointerMove={onPanMove}
              onPointerUp={onPanUp}
              onPointerCancel={onPanUp}
            />
            <g ref={contentRef} transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
              {layout.links.map((link) => (
                <g key={link.id}>
                  <path className="mm-link" d={mmLinkPath(link)} fill="none" />
                </g>
              ))}
              {layout.nodes.map((node) => (
                <MindMapNodeView
                  key={node.id}
                  node={node}
                  selected={node.id === selectedId}
                  onActivate={() => activateNode(node)}
                />
              ))}
            </g>
          </svg>
        ) : (
          <div className="mm-empty">No mind map nodes are available for this notebook yet.</div>
        )}
        <div className="mm-controls">
          <button type="button" className="mm-control-btn" onClick={() => zoomAround(1.18, size.w / 2, size.h / 2)} aria-label="Zoom in">
            <Plus size={16} />
          </button>
          <button type="button" className="mm-control-btn" onClick={() => zoomAround(1 / 1.18, size.w / 2, size.h / 2)} aria-label="Zoom out">
            <Minus size={16} />
          </button>
          <button type="button" className="mm-control-btn" onClick={fitView} aria-label="Fit mind map to view">
            <Maximize2 size={15} />
          </button>
          <button type="button" className="mm-control-btn" onClick={downloadPng} aria-label="Download mind map as PNG">
            <Download size={15} />
          </button>
        </div>
      </div>
      {selectedNode ? (
        <article className="mm-detail">
          <span className="mm-detail-type">{mmTypeLabel(selectedNode.type)}</span>
          <strong>{selectedNode.label}</strong>
          {selectedNode.refs[0] ? (
            <button
              type="button"
              className="mm-source-btn"
              onClick={() => onCitationClick(citationFromSourceRef(selectedNode.refs[0], selectedNode.label))}
            >
              <ShieldCheck size={14} />
              Open source
            </button>
          ) : selectedNode.hasChildren ? (
            <span className="mm-detail-meta">{selectedNode.expanded ? "Branches expanded — click to collapse." : "Click to unfold its branches."}</span>
          ) : (
            <span className="mm-detail-meta">Leaf node.</span>
          )}
        </article>
      ) : null}
    </div>
  );
}

// Rasterize an SVG string to a PNG data URL via an offscreen canvas (for PNG/PDF export).
function rasterizeSvg(svgMarkup: string, width = 1600): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new window.Image();
    img.onload = () => {
      const ratio = img.height && img.width ? img.height / img.width : 0.5625;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round(width * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not render SVG"));
    };
    img.src = url;
  });
}

async function downloadSlideDeckPdf(slides: SlidePayload[], title: string) {
  const withSvg = slides.filter((slide) => slide.svg_markup);
  if (!withSvg.length) return;
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1280, 720], compress: true });
  for (let index = 0; index < withSvg.length; index += 1) {
    const { dataUrl } = await rasterizeSvg(withSvg[index].svg_markup as string, 1920);
    if (index > 0) pdf.addPage([1280, 720], "landscape");
    pdf.addImage(dataUrl, "PNG", 0, 0, 1280, 720);
  }
  pdf.save(`${downloadSlug(title || "slide-deck")}.pdf`);
}

async function downloadSvgAsPng(svgMarkup: string, fileName: string) {
  const { dataUrl } = await rasterizeSvg(svgMarkup, 1920);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function SlideDeckPreview({
  slides,
  title,
  pptxUrl,
  pptxFileName,
  renderStatus,
  onCitationClick: _onCitationClick,
  onToast,
  onError,
}: {
  slides: SlidePayload[];
  title: string;
  pptxUrl: string;
  pptxFileName: string;
  renderStatus: string;
  onCitationClick: (citation: Citation) => void;
  onToast: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [presentationIndex, setPresentationIndex] = useState<number | null>(null);
  const [exporting, setExporting] = useState<"" | "pdf" | "png">("");
  const slideStackRef = useRef<HTMLDivElement | null>(null);
  const presenterCloseRef = useRef<HTMLButtonElement | null>(null);
  const presentationOpen = presentationIndex !== null;
  useEffect(() => {
    if (presentationOpen) presenterCloseRef.current?.focus();
  }, [presentationOpen]);
  useEffect(() => {
    setActiveIndex(0);
    setPresentationIndex(null);
  }, [slides.length, title]);
  useEffect(() => {
    const activeSlideNode = slideStackRef.current?.querySelector(`[data-slide-index="${activeIndex}"]`);
    activeSlideNode?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex]);
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
    };
    const moveDeck = (nextIndex: number) => {
      const safeNext = Math.min(slides.length - 1, Math.max(0, nextIndex));
      setActiveIndex(safeNext);
      setPresentationIndex((current) => (current === null ? current : safeNext));
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!slides.length || isTypingTarget(event.target)) return;
      const inPresentation = presentationIndex !== null;
      // Only steal keys app-wide in presentation mode; embedded in the studio
      // panel the deck responds only while it has focus.
      if (!inPresentation && !slideStackRef.current?.contains(document.activeElement)) return;
      if (event.key === "Escape" && inPresentation) {
        event.preventDefault();
        setPresentationIndex(null);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        const base = presentationIndex === null ? activeIndex : presentationIndex;
        moveDeck(base + 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        const base = presentationIndex === null ? activeIndex : presentationIndex;
        moveDeck(base - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        moveDeck(0);
      } else if (event.key === "End") {
        event.preventDefault();
        moveDeck(slides.length - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, presentationIndex, slides.length]);
  const activeSlide = slides[Math.min(activeIndex, Math.max(0, slides.length - 1))];
  if (!activeSlide) {
    return (
      <div className="artifact-json">
        <article>
          <strong>No slides available</strong>
          <p>The artifact did not include slide payloads.</p>
        </article>
      </div>
    );
  }
  const activeSvg = activeSlide.svg_markup || "";
  const hasRenderedDeck = slides.some((slide) => slide.svg_markup);
  const hasPresentationFile = Boolean(pptxUrl);
  const activeSlideNumber = Math.min(activeIndex + 1, slides.length);
  const currentPresentationIndex = presentationIndex === null ? null : Math.min(Math.max(presentationIndex, 0), slides.length - 1);
  const presentationSlide = currentPresentationIndex === null ? null : slides[currentPresentationIndex];

  const openPresentation = (index: number) => {
    setActiveIndex(index);
    setPresentationIndex(index);
  };

  const movePresentation = (direction: -1 | 1) => {
    setPresentationIndex((current) => {
      const base = current === null ? activeIndex : current;
      const next = Math.min(slides.length - 1, Math.max(0, base + direction));
      setActiveIndex(next);
      return next;
    });
  };

  const runExport = async (kind: "pdf" | "png") => {
    setExporting(kind);
    try {
      if (kind === "pdf") {
        await downloadSlideDeckPdf(slides, title);
        onToast("Slide deck PDF downloaded.");
      } else {
        if (!activeSvg) throw new Error("This slide is not rendered as an image yet.");
        await downloadSvgAsPng(activeSvg, `${downloadSlug(title || "slide")}-${activeSlideNumber}.png`);
        onToast("Slide PNG downloaded.");
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting("");
    }
  };

  return (
    <div className="slide-preview slide-deck-viewer">
      <div className="slide-viewer-toolbar">
        <div className="slide-viewer-title">
          <span>{renderStatus === "rendered_svg_pptx" ? "Presentation" : "Slide deck"}</span>
          <strong>{title || "Slide Deck"}</strong>
          <small>{activeSlideNumber}/{slides.length} selected</small>
        </div>
        <div className="slide-viewer-actions">
          <button type="button" className="secondary-button slide-play-button" onClick={() => openPresentation(activeIndex)}>
            <PlayCircle size={15} /> Play
          </button>
          {hasRenderedDeck ? (
            <>
              {hasPresentationFile ? (
                <a className="secondary-button" href={pptxUrl} download={pptxFileName || `${downloadSlug(title || "slide-deck")}.pptx`}>
                  <Download size={14} /> PPTX
                </a>
              ) : null}
              <button type="button" className="secondary-button" disabled={!!exporting} onClick={() => void runExport("pdf")}>
                <Download size={14} /> {exporting === "pdf" ? "PDF…" : "PDF"}
              </button>
              <button type="button" className="secondary-button" disabled={!!exporting || !activeSvg} onClick={() => void runExport("png")}>
                <Download size={14} /> {exporting === "png" ? "PNG…" : "PNG"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div
        ref={slideStackRef}
        className="slide-stack"
        aria-label="Slide deck pages"
        aria-keyshortcuts="ArrowRight ArrowDown ArrowLeft ArrowUp PageDown PageUp Home End"
        tabIndex={0}
      >
        {slides.map((slide, index) => {
          const slideSvg = slide.svg_markup || "";
          const slideSrc = slideSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(slideSvg)}` : "";
          return (
            <article key={`${slide.title || "slide"}-${index}`} className="slide-stack-item" data-active={index === activeIndex} data-slide-index={index}>
              <div className="slide-stack-topline">
                <span>{String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
                <strong>{slide.title || `Slide ${index + 1}`}</strong>
                <button
                  type="button"
                  className="icon-button subtle"
                  onClick={() => openPresentation(index)}
                  aria-label={`Play slide ${index + 1} fullscreen`}
                  title="Play"
                >
                  <PlayCircle size={16} />
                </button>
              </div>
              {slideSrc ? (
                <figure
                  className="slide-frame slide-stack-frame"
                  onClick={() => setActiveIndex(index)}
                >
                  <img src={slideSrc} alt={slide.title || `Slide ${index + 1}`} />
                </figure>
              ) : (
                <div
                  className="slide-stage slide-stack-stage"
                  onClick={() => setActiveIndex(index)}
                >
                  <span>{slide.layout_type || "slide"} · {index + 1}/{slides.length}</span>
                  <h4>{slide.title}</h4>
                  {slide.subtitle ? <p>{slide.subtitle}</p> : null}
                  <ul>
                    {(slide.bullets || []).slice(0, 5).map((bullet, bulletIndex) => (
                      <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {presentationSlide && currentPresentationIndex !== null ? createPortal(
        <div className="slide-presenter-backdrop" role="dialog" aria-modal="true" aria-label="Slide deck presentation" onClick={() => setPresentationIndex(null)}>
          <div className="slide-presenter" onClick={(event) => event.stopPropagation()}>
            <button ref={presenterCloseRef} type="button" className="icon-button subtle slide-presenter-close" onClick={() => setPresentationIndex(null)} aria-label="Close presentation">
              <XCircle size={22} />
            </button>
            <button
              type="button"
              className="icon-button subtle slide-presenter-nav slide-presenter-prev"
              onClick={() => movePresentation(-1)}
              disabled={currentPresentationIndex === 0}
              aria-label="Previous slide"
            >
              <ChevronLeft size={24} />
            </button>
            {presentationSlide.svg_markup ? (
              <figure className="slide-presenter-frame">
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(presentationSlide.svg_markup)}`}
                  alt={presentationSlide.title || `Slide ${currentPresentationIndex + 1}`}
                />
              </figure>
            ) : (
              <div className="slide-stage slide-presenter-stage">
                <span>{presentationSlide.layout_type || "slide"} · {currentPresentationIndex + 1}/{slides.length}</span>
                <h4>{presentationSlide.title}</h4>
                {presentationSlide.subtitle ? <p>{presentationSlide.subtitle}</p> : null}
                <ul>
                  {(presentationSlide.bullets || []).slice(0, 5).map((bullet, bulletIndex) => (
                    <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              className="icon-button subtle slide-presenter-nav slide-presenter-next"
              onClick={() => movePresentation(1)}
              disabled={currentPresentationIndex >= slides.length - 1}
              aria-label="Next slide"
            >
              <ChevronRight size={24} />
            </button>
            <div className="slide-presenter-count">{currentPresentationIndex + 1}/{slides.length}</div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

function FlashcardSession({
  artifact,
  fallbackCards,
  fallbackProgress,
  onCitationClick,
  onArtifactRefresh,
  onToast,
  onError,
}: {
  artifact: Artifact;
  fallbackCards: FlashcardPayload[];
  fallbackProgress?: FlashcardProgressPayload;
  onCitationClick: (citation: Citation) => void;
  onArtifactRefresh: () => void;
  onToast: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isExplanationVisible, setIsExplanationVisible] = useState(false);
  const [mode, setMode] = useState<"all" | "missed">("all");
  const [isExpanded, setIsExpanded] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const onArtifactRefreshRef = useRef(onArtifactRefresh);

  useEffect(() => {
    onArtifactRefreshRef.current = onArtifactRefresh;
  }, [onArtifactRefresh]);

  useEffect(() => {
    let cancelled = false;
    async function loadDeck() {
      setIsLoading(true);
      try {
        const response = await api<{ deck: FlashcardDeck }>(`/api/artifacts/${artifact.id}/flashcard-deck`);
        if (!cancelled) setDeck(response.deck);
      } catch (deckError) {
        if (!cancelled) {
          const message = messageFromError(deckError);
          if (message.toLowerCase().includes("artifact not found")) {
            onArtifactRefreshRef.current();
          } else {
            onError(message);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadDeck();
    return () => {
      cancelled = true;
    };
  }, [artifact.id, onError]);

  const cards = deck?.cards?.length ? deck.cards : fallbackCards;
  const progress = deck?.progress || normalizeFlashcardProgress(fallbackProgress, cards.length);
  const baseCards = mode === "missed" ? cards.filter((card) => card.review_state === "missed") : cards;
  const visibleCards = order.length
    ? [
        ...order.map((id) => baseCards.find((card) => card.id === id)).filter((card): card is FlashcardPayload => Boolean(card)),
        ...baseCards.filter((card) => !order.includes(card.id || "")),
      ]
    : baseCards;
  const activeCard = visibleCards[activeIndex] || visibleCards[0] || null;

  useEffect(() => {
    if (activeIndex > Math.max(0, visibleCards.length - 1)) setActiveIndex(Math.max(0, visibleCards.length - 1));
  }, [activeIndex, visibleCards.length]);

  async function refreshDeckFromResponse(request: Promise<{ deck: FlashcardDeck }>) {
    try {
      const response = await request;
      setDeck(response.deck);
      onArtifactRefresh();
      return response.deck;
    } catch (deckError) {
      onError(messageFromError(deckError));
      return null;
    }
  }

  async function markCard(result: "got_it" | "missed") {
    if (!deck || !activeCard?.id) return;
    const updated = await refreshDeckFromResponse(
      api<{ deck: FlashcardDeck }>(`/api/flashcard-decks/${deck.id}/reviews`, {
        method: "POST",
        body: JSON.stringify({ card_id: activeCard.id, result }),
      }),
    );
    if (!updated) return;
    setIsAnswerVisible(false);
    setIsExplanationVisible(false);
    setActiveIndex((current) => Math.min(current + 1, Math.max(0, visibleCards.length - 1)));
  }

  async function resetDeck() {
    if (!deck) return;
    const updated = await refreshDeckFromResponse(
      api<{ deck: FlashcardDeck }>(`/api/flashcard-decks/${deck.id}/reset`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    if (updated) {
      setActiveIndex(0);
      setIsAnswerVisible(false);
      setIsExplanationVisible(false);
      onToast("Flashcard session restarted.");
    }
  }

  async function deleteCard() {
    if (!deck || !activeCard?.id) return;
    const updated = await refreshDeckFromResponse(
      api<{ deck: FlashcardDeck }>(`/api/flashcard-decks/${deck.id}/cards/${activeCard.id}`, { method: "DELETE" }),
    );
    if (updated) {
      setIsAnswerVisible(false);
      setIsExplanationVisible(false);
      onToast("Flashcard removed from deck.");
    }
  }

  async function createAdaptive() {
    if (!deck) return;
    const updated = await refreshDeckFromResponse(
      api<{ deck: FlashcardDeck }>(`/api/flashcard-decks/${deck.id}/adaptive`, {
        method: "POST",
        body: JSON.stringify({ limit: 3 }),
      }),
    );
    if (updated) onToast("Adaptive review cards added.");
  }

  function shuffleCards() {
    const ids = [...baseCards].map((card) => card.id || card.question || "").filter(Boolean);
    for (let index = ids.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
    }
    setOrder(ids);
    setActiveIndex(0);
    setIsAnswerVisible(false);
    setIsExplanationVisible(false);
  }

  function exportCsv() {
    const rows = [
      ["Question", "Answer", "Explanation", "Difficulty", "Tags", "Citation", "Source"],
      ...cards.map((card) => [
        card.question || "",
        card.answer || "",
        card.explanation || "",
        card.difficulty || "",
        (card.tags || []).join("; "),
        card.citation || "",
        card.source_title || card.source_refs?.[0]?.source_id || "",
      ]),
    ];
    downloadText(`${downloadSlug(artifact.title)}-flashcards.csv`, rows.map((row) => row.map(csvTextCell).join(",")).join("\n"), "text/csv");
  }

  function openCardCitation(card: FlashcardPayload) {
    const ref = card.source_refs?.[0];
    if (!ref?.source_id) return;
    onCitationClick({
      index: citationIndex(card.citation),
      evidence_id: card.evidence_id || card.id || "flashcard",
      source_id: ref.source_id,
      source_title: card.source_title || "Flashcard source",
      block_ids: ref.block_ids || [],
      chunk_id: ref.chunk_id || "",
      quote: ref.quote || card.evidence_quote || card.answer || "",
      heading_path: [],
      page_number: null,
    });
  }

  return (
    <div className="flashcard-session" data-expanded={isExpanded}>
      <div className="flashcard-session-top">
        <div className="quiz-summary">
          <span>
            <strong>{progress.reviewed}/{progress.total}</strong>
            reviewed
          </span>
          <span>
            <strong>{progress.missed}</strong>
            missed
          </span>
          <span>
            <strong>{Math.round((progress.mastery_score || 0) * 100)}%</strong>
            mastery
          </span>
          <span>
            <strong>{deck?.source_coverage?.cited_source_count ?? "n/a"}</strong>
            sources
          </span>
        </div>
        {isLoading ? <Loader2 className="spin" size={16} /> : null}
      </div>

      <div className="flashcard-toolbar">
        <button type="button" data-active={mode === "all"} onClick={() => { setMode("all"); setActiveIndex(0); setIsAnswerVisible(false); setIsExplanationVisible(false); }}>All</button>
        <button type="button" data-active={mode === "missed"} onClick={() => { setMode("missed"); setActiveIndex(0); setIsAnswerVisible(false); setIsExplanationVisible(false); }}>Missed</button>
        <button type="button" onClick={shuffleCards} aria-label="Shuffle flashcards" title="Shuffle">
          <Shuffle size={15} />
        </button>
        <button type="button" onClick={() => void resetDeck()} disabled={!deck} aria-label="Restart flashcards" title="Restart">
          <RefreshCw size={15} />
        </button>
        <button type="button" onClick={() => void createAdaptive()} disabled={!deck} aria-label="Add adaptive flashcards" title="Adaptive">
          <Sparkles size={15} />
        </button>
        <button type="button" onClick={exportCsv} aria-label="Download flashcards CSV" title="CSV">
          <Download size={15} />
        </button>
        <button type="button" onClick={() => setIsExpanded((current) => !current)} aria-label={isExpanded ? "Collapse flashcards" : "Expand flashcards"} title={isExpanded ? "Collapse" : "Full screen"}>
          {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {activeCard ? (
        <>
          <article className="flashcard-study-card" data-side={isAnswerVisible ? "answer" : "question"}>
            <div className="flashcard-card-meta">
              <span>{activeCard.difficulty || "mixed"}</span>
              <span>{activeCard.card_type || "concept"}</span>
              <span>{activeCard.support_level || "supported"}</span>
            </div>
            <button
              type="button"
              className="flashcard-flip-card"
              data-side={isAnswerVisible ? "answer" : "question"}
              aria-pressed={isAnswerVisible}
              onClick={() => setIsAnswerVisible((current) => !current)}
            >
              <span className="flashcard-flip-inner">
                <span className="flashcard-card-face flashcard-card-front" aria-hidden={isAnswerVisible}>
                  <span className="flashcard-card-kicker">Question {activeIndex + 1} / {visibleCards.length}</span>
                  <span className="flashcard-card-copy">{activeCard.question}</span>
                  <span className="flashcard-card-support">
                    {activeCard.learning_goal || activeCard.hint || "Answer from memory, then flip."}
                  </span>
                </span>
                <span className="flashcard-card-face flashcard-card-back" aria-hidden={!isAnswerVisible}>
                  <span className="flashcard-card-kicker">Answer</span>
                  <span className="flashcard-card-copy">{activeCard.answer}</span>
                  <span className="flashcard-card-support">
                    {isExplanationVisible && activeCard.explanation ? activeCard.explanation : activeCard.hint || "Use Explain for the source-grounded reasoning."}
                  </span>
                </span>
              </span>
            </button>
            <div className="flashcard-card-footer">
              <button
                type="button"
                className="flashcard-action-button flashcard-evidence-button"
                onClick={() => openCardCitation(activeCard)}
                disabled={!activeCard.source_refs?.length}
              >
                <ShieldCheck size={15} />
                <span>{activeCard.citation || "Source"}</span>
              </button>
              <button
                type="button"
                className="flashcard-action-button flashcard-explain-button"
                onClick={() => { setIsAnswerVisible(true); setIsExplanationVisible((current) => !current); }}
                disabled={!activeCard.explanation}
              >
                <Sparkles size={15} />
                <span>Explain</span>
              </button>
              <button
                type="button"
                className="flashcard-action-button flashcard-delete-button"
                onClick={() => void deleteCard()}
                disabled={!deck}
                aria-label="Delete flashcard"
                title="Delete flashcard"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </article>

          <div className="flashcard-nav">
            <button type="button" onClick={() => { setActiveIndex((current) => Math.max(0, current - 1)); setIsAnswerVisible(false); setIsExplanationVisible(false); }} disabled={activeIndex === 0}>
              Previous
            </button>
            <button type="button" className="primary-button" onClick={() => { setIsAnswerVisible((current) => !current); setIsExplanationVisible(false); }}>
              {isAnswerVisible ? "Hide answer" : "Show answer"}
            </button>
            <button type="button" onClick={() => { setActiveIndex((current) => Math.min(visibleCards.length - 1, current + 1)); setIsAnswerVisible(false); setIsExplanationVisible(false); }} disabled={activeIndex >= visibleCards.length - 1}>
              Next
            </button>
          </div>

          <div className="flashcard-grade-row">
            <button type="button" onClick={() => void markCard("missed")} disabled={!deck}>
              <XCircle size={16} />
              Missed it
            </button>
            <button type="button" onClick={() => void markCard("got_it")} disabled={!deck}>
              <CheckCircle2 size={16} />
              Got it
            </button>
          </div>
        </>
      ) : (
        <div className="flashcard-empty">
          <Layers3 size={18} />
          <p>{mode === "missed" ? "No missed cards." : "No flashcards in this deck."}</p>
        </div>
      )}

      {progress.session_complete ? (
        <div className="flashcard-review-complete">
          <strong>Review complete</strong>
          <button type="button" onClick={() => void resetDeck()} disabled={!deck}>Same cards</button>
          <button type="button" onClick={() => { setMode("missed"); setActiveIndex(0); }}>Only missed</button>
          <button type="button" onClick={() => void createAdaptive()} disabled={!deck}>Adaptive set</button>
        </div>
      ) : null}
    </div>
  );
}

function InfographicPreview({ payload, panels }: { payload: Record<string, unknown>; panels: InfographicPanelPayload[] }) {
  const svgMarkup = typeof payload.svg_markup === "string" ? payload.svg_markup : "";
  const svgSrc = svgMarkup ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}` : "";
  const meta = [
    typeof payload.orientation === "string" ? payload.orientation : "",
    typeof payload.detail_level === "string" ? payload.detail_level : "",
    typeof payload.visual_style === "string" ? payload.visual_style : "",
    typeof payload.render_status === "string" ? payload.render_status.replaceAll("_", " ") : "",
  ].filter(Boolean);

  const panelList = (
    <div className="infographic-preview">
      {panels.slice(0, 8).map((panel, index) => (
        <article key={`${panel.headline}-${index}`}>
          <span>{String(panel.panel || index + 1).padStart(2, "0")}</span>
          <strong>{panel.headline}</strong>
          <p>{panel.copy}</p>
          {panel.source_title ? <small>{panel.source_title}{panel.citation ? ` · ${panel.citation}` : ""}</small> : null}
        </article>
      ))}
    </div>
  );

  return (
    <div className="infographic-artifact">
      {svgSrc ? (
        <figure className="infographic-frame">
          <img src={svgSrc} alt={typeof payload.title === "string" ? payload.title : "Source-grounded infographic"} />
        </figure>
      ) : (
        // No rendered SVG (e.g. legacy artifact): fall back to the panel breakdown.
        panelList
      )}
      {meta.length ? (
        <div className="infographic-meta">
          {meta.map((item) => <span key={item}>{item}</span>)}
        </div>
      ) : null}
      {svgSrc && panels.length ? (
        <details className="infographic-panels">
          <summary>Panel breakdown · {panels.length} source-grounded panels</summary>
          {panelList}
        </details>
      ) : null}
    </div>
  );
}

function QuizSession({ payload, questions }: { payload: Record<string, unknown>; questions: QuizPayload[] }) {
  const quizKey = questions.map((question, index) => question.id || question.question || index).join("|");
  const preparedQuestions = questions.filter((question) => question.question && (question.options || []).length >= 2);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setAnswers({});
    setReviewMode(false);
    setIsExpanded(false);
  }, [quizKey]);

  if (!preparedQuestions.length) {
    return (
      <div className="artifact-json">
        <article>
          <strong>No quiz questions available</strong>
          <p>The artifact did not contain answerable multiple-choice questions.</p>
        </article>
      </div>
    );
  }

  const current = preparedQuestions[Math.min(currentIndex, preparedQuestions.length - 1)];
  const correctIndex = normalizedCorrectIndex(current);
  const selected = answers[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const correctCount = preparedQuestions.reduce((sum, question, index) => (
    answers[index] === normalizedCorrectIndex(question) ? sum + 1 : sum
  ), 0);
  const progressPercent = Math.round((answeredCount / preparedQuestions.length) * 100);
  const scorePercent = preparedQuestions.length ? Math.round((correctCount / preparedQuestions.length) * 100) : 0;
  const passingScore = typeof payload.passing_score === "number" ? payload.passing_score : 0.8;
  const isComplete = answeredCount === preparedQuestions.length;
  const passed = preparedQuestions.length ? correctCount / preparedQuestions.length >= passingScore : false;

  function chooseAnswer(optionIndex: number) {
    if (selected !== undefined) return;
    setAnswers((currentAnswers) => ({ ...currentAnswers, [currentIndex]: optionIndex }));
  }

  function resetQuiz() {
    setAnswers({});
    setCurrentIndex(0);
    setReviewMode(false);
  }

  const showResults = isComplete && !reviewMode;
  const isLastQuestion = currentIndex === preparedQuestions.length - 1;

  return (
    <div className="quiz-session" data-expanded={isExpanded}>
      <div className="quiz-strip">
        <div className="quiz-strip-head">
          <span className="quiz-qno">Question {currentIndex + 1} of {preparedQuestions.length}</span>
          <span className="quiz-diff">{current.difficulty || "medium"}</span>
        </div>
        <div className="quiz-strip-stats">
          <span><strong>{answeredCount}</strong> answered</span>
          <span><strong>{scorePercent}%</strong> score</span>
          <span>pass {Math.round(passingScore * 100)}%</span>
          <button
            type="button"
            className="icon-button subtle"
            onClick={() => setIsExpanded((value) => !value)}
            aria-label={isExpanded ? "Collapse quiz" : "Expand quiz"}
            title={isExpanded ? "Collapse" : "Full screen"}
          >
            {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      <div className="quiz-progress" aria-label="Quiz progress">
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      {showResults ? (
        <div className="quiz-result-panel" data-passed={passed}>
          <span className="quiz-score-big">{scorePercent}%</span>
          <strong>{passed ? "Passed" : "Needs review"}</strong>
          <p>{correctCount} of {preparedQuestions.length} answers matched the cited evidence.</p>
        </div>
      ) : (
        <article className="quiz-card">
          <div className="quiz-card-top">
            {current.learning_goal ? <small>{current.learning_goal}</small> : null}
            <strong>{stripCitationMarkers(current.question)}</strong>
          </div>

          <div className="quiz-options">
            {(current.options || []).map((option, optionIndex) => {
              const state = quizOptionState(selected, correctIndex, optionIndex);
              return (
                <button
                  key={`${option}-${optionIndex}`}
                  type="button"
                  data-state={state}
                  onClick={() => chooseAnswer(optionIndex)}
                  disabled={selected !== undefined}
                >
                  <span>{String.fromCharCode(65 + optionIndex)}</span>
                  <strong>{stripCitationMarkers(option)}</strong>
                  {state === "correct" ? <CheckCircle2 size={16} /> : null}
                  {state === "wrong" ? <XCircle size={16} /> : null}
                </button>
              );
            })}
          </div>

          {selected !== undefined ? (
            <div className="quiz-explanation" data-correct={selected === correctIndex}>
              <strong>{selected === correctIndex ? "Correct" : "Review the evidence"}</strong>
              <p>{stripCitationMarkers(current.explanation)}</p>
              {current.evidence_quote ? <small>{current.evidence_quote}</small> : null}
              {current.tags?.length ? (
                <div className="quiz-tags">
                  {current.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
      )}

      <div className="quiz-actions" data-mode={showResults ? "results" : "quiz"}>
        {showResults ? (
          <>
            <button type="button" onClick={() => { setReviewMode(true); setCurrentIndex(0); }}>
              Review answers
            </button>
            <button type="button" onClick={resetQuiz}>
              <RefreshCw size={14} />
              Retry
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0}>
              Previous
            </button>
            {isComplete && isLastQuestion ? (
              <button type="button" onClick={() => setReviewMode(false)}>
                See results
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentIndex((index) => Math.min(preparedQuestions.length - 1, index + 1))}
                disabled={isLastQuestion}
              >
                Next
              </button>
            )}
            <button type="button" onClick={resetQuiz}>
              <RefreshCw size={14} />
              Reset
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function stripCitationMarkers(text: unknown): string {
  if (typeof text !== "string") return text == null ? "" : String(text);
  return text
    .replace(/\s*\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizedCorrectIndex(question: QuizPayload) {
  const options = question.options || [];
  const index = Number(question.correct_index ?? 0);
  if (!Number.isFinite(index) || index < 0 || index >= options.length) return 0;
  return index;
}

function quizOptionState(selected: number | undefined, correctIndex: number, optionIndex: number) {
  if (selected === undefined) return "idle";
  if (optionIndex === correctIndex) return "correct";
  if (selected === optionIndex) return "wrong";
  return "muted";
}

function MobileTab({
  panel,
  active,
  onChange,
  icon,
  label,
}: {
  panel: MobilePanel;
  active: MobilePanel;
  onChange: (panel: MobilePanel) => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button type="button" data-active={active === panel} onClick={() => onChange(panel)}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-row" key={index} />
      ))}
    </>
  );
}

const defaultQuestions = [
  "What are the key takeaways from the active sources?",
  "Which claims are directly supported by the sources?",
  "Find contradictions or open questions in the sources.",
  "What should I verify before acting on this material?",
];

// Legacy prompt used by earlier builds to auto-generate the opening overview.
// Keep it here so old persisted synthetic messages do not appear as normal chat.
const OVERVIEW_PROMPT =
  "Give me a quick, friendly overview of what these sources cover — and a couple of things worth digging into.";

function visibleNotebookMessages(messages: ChatMessage[]) {
  const visible: ChatMessage[] = [];
  let hideNextAssistant = false;
  for (const message of messages) {
    if (message.role === "user" && message.content.trim() === OVERVIEW_PROMPT) {
      hideNextAssistant = true;
      continue;
    }
    if (hideNextAssistant && message.role === "assistant") {
      hideNextAssistant = false;
      continue;
    }
    hideNextAssistant = false;
    visible.push(message);
  }
  return visible;
}

function buildSuggestedReportFormats(notebook: Notebook | null): ReportFormatOption[] {
  const topic = primaryReportTopic(notebook);
  const corpus = [
    notebook?.title,
    notebook?.summary,
    ...(notebook?.sources || []).filter((source) => source.active).map((source) => `${source.title} ${source.summary || ""}`),
  ].join(" ");
  const legalish = /\b(case|contract|legal|liability|settlement|dispute|claim|defense|damages|milestone)\b/i.test(corpus);
  const technical = /\b(api|architecture|software|system|workflow|automation|implementation|integration|data|model)\b/i.test(corpus);
  const communication = /\b(email|message|communication|protocol|stakeholder|client|vendor|customer)\b/i.test(corpus);

  return [
    {
      id: "suggested-assessment",
      title: legalish ? "Case Assessment Report" : `${topic} Assessment Report`,
      description: legalish
        ? "A comprehensive evaluation of the legal, technical, and evidentiary position"
        : `A comprehensive evaluation of the strongest evidence, risks, and decisions around ${topic.toLowerCase()}`,
      kind: "suggested",
      prompt: `Create a ${legalish ? "case assessment report" : `${topic} assessment report`} with findings, evidence, risks, contradictions, open questions, and recommended next steps.`,
    },
    {
      id: "suggested-communication",
      title: communication ? "Communication Protocol" : "Decision Memo",
      description: communication
        ? "A formal guide for managing sensitive correspondence and unresolved issues"
        : "A decision-ready memo that separates supported facts, options, tradeoffs, and next actions",
      kind: "suggested",
      prompt: communication
        ? "Create a communication protocol with goals, tone, escalation rules, evidence-backed talking points, and risks to avoid."
        : "Create a decision memo with context, options, evidence, tradeoffs, risks, and a recommendation.",
    },
    {
      id: "suggested-concept-guide",
      title: technical ? "Technical Concept Guide" : "Fundamental Concept Guide",
      description: technical
        ? "An introduction to the core architecture, workflows, dependencies, and implementation risks"
        : "An introduction to the core principles, terminology, and source-backed examples",
      kind: "suggested",
      prompt: technical
        ? "Create a technical concept guide explaining architecture, workflows, implementation dependencies, evidence, and open engineering questions."
        : "Create a fundamental concept guide with definitions, core principles, examples, citations, and a glossary.",
    },
    {
      id: "suggested-primer",
      title: legalish ? "Procedural Primer" : `${topic} Primer`,
      description: legalish
        ? "A simplified overview of the stages and risks involved in formal disputes"
        : `A simplified overview of the stages, risks, and important source-backed ideas in ${topic.toLowerCase()}`,
      kind: "suggested",
      prompt: `Create a primer for ${legalish ? "the dispute process" : topic} with a plain-language overview, key stages, risks, evidence, and open questions.`,
    },
  ];
}

function primaryReportTopic(notebook: Notebook | null) {
  const topicMap = notebook?.knowledge.find((object) => object.type === "topic_map");
  const topics = Array.isArray(topicMap?.data?.topics) ? topicMap.data.topics : [];
  const topic = topics
    .map((item) => (item && typeof item === "object" && "label" in item ? String((item as { label?: unknown }).label || "") : ""))
    .find((label) => label.trim().length > 2);
  const sourceTitle = notebook?.sources.find((source) => source.active)?.title || notebook?.sources[0]?.title || notebook?.title || "Source";
  return reportTitleCase(cleanReportTopic(topic || sourceTitle || "Source"));
}

function cleanReportTopic(value: string) {
  const cleaned = value
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(report|guide|brief|overview|source|document|markdown|pdf)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Source";
}

function reportTitleCase(value: string) {
  const smallWords = new Set(["and", "or", "of", "for", "the", "a", "an", "to", "in", "on", "with"]);
  return value
    .split(/\s+/)
    .slice(0, 4)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && smallWords.has(lower)) return lower;
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function customReportTitle(prompt: string) {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Custom Report";
  return `Custom Report: ${clipReportText(cleaned, 44)}`;
}

function clipReportText(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function sourceIcon(type: SourceType) {
  if (type === "url") return <Globe size={16} />;
  if (type === "youtube") return <Video size={16} />;
  if (type === "audio") return <AudioLines size={16} />;
  if (type === "google_doc") return <FileText size={16} />;
  if (type === "note") return <NotebookPen size={16} />;
  if (type === "pdf") return <FileText size={16} />;
  if (type === "docx") return <FileText size={16} />;
  if (type === "pptx") return <Presentation size={16} />;
  return <FileText size={16} />;
}

function sourceTypeLabel(type: SourceType) {
  return (
    {
      markdown: "Document",
      text: "Document",
      pdf: "PDF",
      url: "Website",
      note: "Note",
      docx: "DOCX",
      pptx: "PPTX",
      epub: "EPUB",
      youtube: "YouTube",
      audio: "Audio",
      google_doc: "Google Doc",
      image: "Image",
    } as Record<string, string>
  )[type] || "Source";
}

function sourceNeedsUrl(type: SourceType) {
  return ["url", "youtube", "google_doc"].includes(type);
}

function sourceAcceptsFile(type: SourceType) {
  return ["pdf", "docx", "pptx", "epub", "audio", "image", "markdown", "text"].includes(type);
}

const audioVideoSourceAccept = [
  "audio/*",
  "video/*",
  ".3g2",
  ".3gp",
  ".aac",
  ".aif",
  ".aifc",
  ".aiff",
  ".amr",
  ".au",
  ".avi",
  ".cda",
  ".m4a",
  ".mid",
  ".midi",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".ogg",
  ".opus",
  ".ra",
  ".ram",
  ".snd",
  ".wav",
  ".wma",
].join(",");

const imageSourceAccept = [
  "image/*",
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jp2",
  ".png",
  ".webp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
  ".jpeg",
  ".jpg",
  ".jpe",
].join(",");

function sourceFileAccept(type: SourceType) {
  if (type === "pdf") return ".pdf,application/pdf";
  if (type === "docx") return ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (type === "pptx") return ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (type === "epub") return ".epub,application/epub+zip";
  if (type === "audio") return audioVideoSourceAccept;
  if (type === "image") return imageSourceAccept;
  return [
    ".pdf",
    ".txt",
    ".md",
    ".markdown",
    ".docx",
    ".csv",
    ".pptx",
    ".epub",
    imageSourceAccept,
    audioVideoSourceAccept,
    "text/*",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/epub+zip",
  ].join(",");
}

function sourceTypeFromFile(file: File): SourceType {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".pptx")) return "pptx";
  if (name.endsWith(".epub")) return "epub";
  if (file.type.startsWith("image/") || /\.(png|jpe?g|jpe|webp|gif|heic|heif|bmp|tiff?|avif|ico|jp2)$/i.test(name)) return "image";
  if (file.type.startsWith("audio/") || file.type.startsWith("video/") || /\.(3g2|3gp|aac|aif|aifc|aiff|amr|au|avi|cda|m4a|mid|midi|mp3|mp4|mpe?g|mpg|ogg|opus|ra|ram|snd|wav|wma|mov)$/i.test(name)) return "audio";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "markdown";
  if (name.endsWith(".txt") || name.endsWith(".csv")) return "text";
  return "markdown";
}

function queuedSourceFile(file: File): QueuedSourceFile {
  return {
    id: `source-file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    type: sourceTypeFromFile(file),
    title: file.name.replace(/\.[^.]+$/, ""),
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size: file.size,
    status: "queued",
    progress: 0,
    progressLabel: "Ready",
    progressDetail: "Waiting to upload",
  };
}

function sourceFileFingerprint(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function sourceFileStatusLabel(status: QueuedSourceFileStatus) {
  if (status === "adding") return "Adding";
  if (status === "added") return "Added";
  if (status === "failed") return "Failed";
  return "Ready";
}

function queuedSourceFileProgress(item: QueuedSourceFile) {
  const fallbackDetail = item.status === "added"
    ? "Indexing continues in Sources"
    : item.status === "failed"
      ? item.error || "Upload failed"
      : item.status === "adding"
        ? "Uploading file"
        : "Waiting to upload";
  return {
    percent: Math.round(clampNumber(item.progress ?? (item.status === "added" || item.status === "failed" ? 100 : 0), 0, 100)),
    label: item.progressLabel || sourceFileStatusLabel(item.status),
    detail: item.progressDetail || fallbackDetail,
  };
}

function sourceProgressInfo(source: Source) {
  if (source.status === "indexed" || source.status === "failed") return null;
  const stage = String(source.metadata_json?.ingest_stage || source.status || "pending");
  const stages: Record<string, { label: string; detail: string; percent: number }> = {
    pending: { label: "Queued", detail: "Waiting for upload worker", percent: 8 },
    upload_accepted: { label: "Upload accepted", detail: "Preparing source card", percent: 14 },
    saving_file: { label: "Uploading file", detail: "Saving original file", percent: 22 },
    extracting_text: { label: "Extracting text", detail: "Reading document content", percent: 38 },
    chunking: { label: "Chunking", detail: "Splitting into RAG passages", percent: 56 },
    embedding: { label: "Embedding", detail: "Creating semantic vectors", percent: 72 },
    vector_indexing: { label: "Vector index", detail: "Writing search index", percent: 84 },
    knowledge: { label: "Knowledge map", detail: "Building summaries and citations", percent: 93 },
    parsing: { label: "Indexing", detail: "Preparing source", percent: 30 },
  };
  return stages[stage] || stages.parsing;
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / (1024 ** index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function isTextLikeFile(file: File) {
  return file.type.includes("text") || /\.(md|markdown|txt|csv)$/i.test(file.name);
}

function sourceUrlPlaceholder(type: SourceType) {
  if (type === "youtube") return "https://www.youtube.com/watch?v=...";
  if (type === "google_doc") return "https://docs.google.com/document/d/...";
  return "https://example.com/research-page";
}

function sourceBodyLabel(type: SourceType) {
  if (type === "youtube") return "Transcript fallback";
  if (type === "audio") return "Transcript";
  if (type === "pdf" || type === "docx") return "Extracted text fallback";
  return "Text";
}

function sourceBodyPlaceholder(type: SourceType) {
  if (type === "youtube") return "Paste transcript here if public captions are unavailable.";
  if (type === "audio") return "Paste transcript text for the audio file.";
  if (type === "google_doc") return "Paste document text if export is not accessible.";
  if (type === "pdf" || type === "docx") return "Paste extracted text if built-in parsing cannot read the file.";
  if (type === "note") return "Write a note that should become a citable source.";
  return "Paste source text or markdown.";
}

function sourceStatusLine(source: Source) {
  if (source.status === "failed") return "Failed to index";
  const progress = sourceProgressInfo(source);
  if (progress) return progress.label;
  const words = source.word_count ? `${formatCount(source.word_count)} words` : "";
  return [sourceTypeLabel(source.type), words].filter(Boolean).join(" · ");
}

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

function relativeTime(value: string) {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function formatNotebookDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function artifactIcon(type: ArtifactType) {
  return artifactTypes.find((artifact) => artifact.type === type)?.icon || <Sparkles size={18} />;
}

function artifactTitle(type: ArtifactType) {
  return artifactTypes.find((artifact) => artifact.type === type)?.title || type;
}

function artifactPollDeadlineMs(type: ArtifactType) {
  if (type === "video") return 15 * 60 * 1000;
  if (type === "audio") return 10 * 60 * 1000;
  if (type === "thumbnail" || type === "infographic") return 8 * 60 * 1000;
  return 5 * 60 * 1000;
}

function estimateArtifactDuration(artifact: Artifact) {
  if (artifact.type !== "audio" && artifact.type !== "video") return "";
  const payload = artifact.content_json || {};
  const transcript = (payload.transcript || payload.storyboard) as Array<{ text?: string; narration?: string }> | undefined;
  if (!Array.isArray(transcript)) return "";
  const words = transcript.reduce(
    (sum, line) => sum + String(line.text || line.narration || "").trim().split(/\s+/).filter(Boolean).length,
    0,
  );
  if (!words) return "";
  const seconds = Math.round((words / 150) * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function artifactMetaLine(artifact: Artifact) {
  const parts: string[] = [];
  const duration = estimateArtifactDuration(artifact);
  if (duration) parts.push(duration);
  parts.push(artifactTitle(artifact.type));
  const sourceCount = artifactSourceCount(artifact);
  if (sourceCount) parts.push(`${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`);
  const rel = relativeTime(artifact.created_at);
  if (rel) parts.push(rel);
  return parts.join(" · ");
}

function normalizeFlashcardProgress(progress: FlashcardProgressPayload | undefined, total: number): FlashcardProgress {
  const reviewed = progress?.reviewed ?? 0;
  const normalizedTotal = progress?.total ?? total;
  const remaining = progress?.remaining ?? Math.max(0, normalizedTotal - reviewed);
  return {
    total: normalizedTotal,
    active: progress?.active ?? normalizedTotal,
    deleted: progress?.deleted ?? 0,
    reviewed,
    remaining,
    due: progress?.due ?? remaining,
    got_it: progress?.got_it ?? 0,
    missed: progress?.missed ?? 0,
    mastery_score: progress?.mastery_score ?? 0,
    session_complete: progress?.session_complete ?? Boolean(normalizedTotal && reviewed >= normalizedTotal),
  };
}

function citationIndex(citation?: string) {
  const match = /\[(\d+)\]/.exec(citation || "");
  return match ? Number(match[1]) : 1;
}

function citationFromSourceRef(ref: Record<string, unknown>, fallbackTitle: string): Citation {
  return {
    index: 1,
    evidence_id: String(ref.evidence_id || ref.chunk_id || "source-ref"),
    source_id: String(ref.source_id || ref.sourceId || ""),
    source_title: String(ref.source_title || ref.sourceTitle || fallbackTitle),
    block_ids: Array.isArray(ref.block_ids) ? ref.block_ids.map(String) : [],
    chunk_id: String(ref.chunk_id || ""),
    quote: String(ref.quote || fallbackTitle),
    heading_path: Array.isArray(ref.heading_path) ? ref.heading_path.map(String) : [],
    page_number: null,
  };
}

function csvTextCell(value: unknown) {
  let text = String(value ?? "");
  // Source content is untrusted; a leading =/+/-/@ would execute as a formula
  // when the exported CSV is opened in Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function api<T>(path: string, init?: ApiInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed with ${response.status}`);
  }
  return body as T;
}

function apiWithUploadProgress<T>(
  path: string,
  payload: unknown,
  onProgress?: (progress: { loaded: number; total?: number; percent?: number }) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);
    xhr.withCredentials = true;
    xhr.setRequestHeader("content-type", "application/json");
    xhr.upload.onprogress = (event) => {
      onProgress?.({
        loaded: event.loaded,
        total: event.lengthComputable ? event.total : undefined,
        percent: event.lengthComputable && event.total ? event.loaded / event.total : undefined,
      });
    };
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        body = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
      } else {
        reject(new Error(String(body.error || `Request failed with ${xhr.status}`)));
      }
    };
    xhr.onerror = () => reject(new Error("Network upload failed."));
    xhr.send(JSON.stringify(payload));
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

function isDefaultNotebookTitle(title?: string) {
  const value = (title || "").trim();
  return value === "" || value === "Untitled notebook" || value === "SourceStudio Demo Notebook";
}

function readRememberedNotebookId() {
  try {
    return window.localStorage.getItem(LAST_NOTEBOOK_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function rememberNotebookId(id: string) {
  try {
    if (id) window.localStorage.setItem(LAST_NOTEBOOK_STORAGE_KEY, id);
  } catch {
    // Remembering the last notebook is convenience-only.
  }
}

function forgetRememberedNotebookId() {
  try {
    window.localStorage.removeItem(LAST_NOTEBOOK_STORAGE_KEY);
  } catch {
    // Remembering the last notebook is convenience-only.
  }
}

function readWorkspaceLayout(): WorkspaceLayout {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) || "{}") as Partial<WorkspaceLayout>;
    return normalizeWorkspaceLayout({
      sources: Number.isFinite(parsed.sources) ? Number(parsed.sources) : DEFAULT_WORKSPACE_LAYOUT.sources,
      studio: Number.isFinite(parsed.studio) ? Number(parsed.studio) : DEFAULT_WORKSPACE_LAYOUT.studio,
    });
  } catch {
    return DEFAULT_WORKSPACE_LAYOUT;
  }
}

function rememberWorkspaceLayout(layout: WorkspaceLayout) {
  try {
    window.localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeWorkspaceLayout(layout)));
  } catch {
    // Workspace layout persistence is convenience-only.
  }
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function workspaceInnerWidth(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  const padding = Number.parseFloat(style.paddingLeft || "0") + Number.parseFloat(style.paddingRight || "0");
  return Math.max(0, rect.width - padding);
}

function normalizeWorkspaceLayout(layout: WorkspaceLayout, innerWidth = Number.POSITIVE_INFINITY): WorkspaceLayout {
  const available = Math.max(0, innerWidth - (WORKSPACE_RESIZER_WIDTH * 2));
  const maxSideTotal = Number.isFinite(innerWidth)
    ? Math.max(WORKSPACE_MIN_SOURCE + WORKSPACE_MIN_STUDIO, available - WORKSPACE_MIN_CHAT)
    : WORKSPACE_MAX_SOURCE + WORKSPACE_MAX_STUDIO;
  let sources = clampNumber(layout.sources, WORKSPACE_MIN_SOURCE, Math.min(WORKSPACE_MAX_SOURCE, maxSideTotal - WORKSPACE_MIN_STUDIO));
  let studio = clampNumber(layout.studio, WORKSPACE_MIN_STUDIO, Math.min(WORKSPACE_MAX_STUDIO, maxSideTotal - WORKSPACE_MIN_SOURCE));
  const sideTotal = sources + studio;
  if (sideTotal > maxSideTotal) {
    const excess = sideTotal - maxSideTotal;
    const sourceFlex = Math.max(0, sources - WORKSPACE_MIN_SOURCE);
    const studioFlex = Math.max(0, studio - WORKSPACE_MIN_STUDIO);
    const flexTotal = sourceFlex + studioFlex;
    if (flexTotal > 0) {
      sources -= Math.min(sourceFlex, excess * (sourceFlex / flexTotal));
      studio -= Math.min(studioFlex, excess * (studioFlex / flexTotal));
    }
  }
  return {
    sources: Math.round(clampNumber(sources, WORKSPACE_MIN_SOURCE, WORKSPACE_MAX_SOURCE)),
    studio: Math.round(clampNumber(studio, WORKSPACE_MIN_STUDIO, WORKSPACE_MAX_STUDIO)),
  };
}

async function fileToBase64(file: File, onProgress?: (progress: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total) {
        onProgress?.(event.loaded / event.total);
      }
    };
    reader.onload = () => {
      onProgress?.(1);
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  "youtube-kit": "Title & Description",
  thumbnail: "Thumbnail",
  audio: "Audio Overview",
  "slide-deck": "Slide Deck",
  video: "Video Overview",
  mindmap: "Mind Map",
  report: "Report",
  flashcards: "Flashcards",
  quiz: "Quiz",
  infographic: "Infographic",
  "data-table": "Data Table",
};

function artifactTypeLabel(type?: string) {
  if (!type) return "Artifact";
  return ARTIFACT_TYPE_LABELS[type] || type.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function artifactSourceCount(artifact?: Artifact | null) {
  if (!artifact) return 0;
  const coverage = artifact.content_json?.source_coverage as { active_sources?: number } | undefined;
  if (coverage?.active_sources) return coverage.active_sources;
  const ids = new Set(
    (artifact.source_refs_json || [])
      .map((ref) => String((ref as Record<string, unknown>).source_id || ""))
      .filter(Boolean),
  );
  return ids.size;
}

function formatArtifactTimestamp(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function artifactSubhead(artifact?: Artifact | null) {
  if (!artifact) return "";
  const count = artifactSourceCount(artifact);
  const stamp = formatArtifactTimestamp(artifact.created_at);
  return [`${count} ${count === 1 ? "source" : "sources"}`, stamp].filter(Boolean).join(" · ");
}

function downloadText(fileName: string, text: string, mimeType = "application/json") {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back to a temporary textarea for browser contexts where clipboard
      // permission is denied even though the API exists.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy failed. Select the text and copy it manually.");
}

function downloadSlug(input: string) {
  return String(input || "sourcestudio-notebook")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "sourcestudio-notebook";
}

function formatDebugTime(value: string) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDebugDetails(details: Record<string, unknown>) {
  const text = JSON.stringify(details || {}, null, 2);
  return text.length > 1200 ? `${text.slice(0, 1200)}\n...` : text;
}
