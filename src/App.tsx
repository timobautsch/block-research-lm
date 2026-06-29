import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ChangeEvent, CSSProperties, DragEvent, FormEvent, ReactNode } from "react";
import {
  ArrowRight,
  AudioLines,
  Bot,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
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
  Map,
  Maximize2,
  MessageSquareText,
  Minimize2,
  MoreVertical,
  NotebookPen,
  PanelLeft,
  PlayCircle,
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

type SourceType = "markdown" | "text" | "pdf" | "url" | "note" | "docx" | "youtube" | "audio" | "google_doc" | "image";
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
type MobilePanel = "sources" | "chat" | "studio";
const AUTH_MODES = ["login", "signup", "reset-request", "reset-confirm"] as const;
type AuthMode = (typeof AUTH_MODES)[number];
type ApiInit = Parameters<typeof fetch>[1];
const BRAND_NAME = "Block Research LM";
const BRAND_EYEBROW = "Block Research AI";
const BRAND_LOGO_PATH = "/brand/blockresearch-mark.svg";
const ASSISTANT_NAME = "Block Research LM";

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
}

interface SlidePayload {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  speaker_notes?: string;
  visual_suggestion?: string;
  layout_type?: string;
  citations?: Citation[];
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

interface ReportPointPayload {
  text?: string;
  citation?: string;
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

interface SourceBlock {
  block_id: string;
  source_id: string;
  type: string;
  text: string;
  heading_path: string[];
  order_index: number;
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

interface ArtifactEvidenceAudit {
  status?: string;
  evidence_pack_id?: string;
  retrieval_run_id?: string;
  retrieval_intent?: string;
  query?: string;
  evidence_items?: number;
  cited_evidence_items?: number;
  uncited_evidence_ids?: string[];
  invalid_evidence_ids?: string[];
  invalid_citation_count?: number;
  evidence_coverage?: number;
  active_source_count?: number;
  source_count?: number;
  cited_source_count?: number;
  source_coverage?: number;
  artifact_items?: number;
  cited_artifact_items?: number;
  item_citation_coverage?: number;
  summary?: string;
  constraints?: Record<string, unknown>;
  top_sources?: Array<{
    source_id?: string;
    title?: string;
    references?: number;
    evidence_items?: number;
    cited_items?: number;
    coverage?: number;
    support_types?: string[];
  }>;
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

const emptySourceForm: SourceForm = {
  type: "markdown",
  title: "",
  original_url: "",
  body: "",
};

const artifactTypes: Array<{
  type: ArtifactType;
  title: string;
  action: string;
  icon: ReactNode;
}> = [
  { type: "youtube-kit", title: "Title & Description", action: "YouTube", icon: <Youtube size={18} /> },
  { type: "thumbnail", title: "Thumbnail", action: "Image", icon: <Image size={18} /> },
  { type: "audio", title: "Audio Overview", action: "Script", icon: <AudioLines size={18} /> },
  { type: "slide-deck", title: "Slide Deck", action: "Slides", icon: <Presentation size={18} /> },
  { type: "video", title: "Video Overview", action: "Storyboard", icon: <Video size={18} /> },
  { type: "mindmap", title: "Mind Map", action: "Map", icon: <Map size={18} /> },
  { type: "report", title: "Reports", action: "Write", icon: <ClipboardList size={18} /> },
  { type: "flashcards", title: "Flashcards", action: "Cards", icon: <Layers3 size={18} /> },
  { type: "quiz", title: "Quiz", action: "Test", icon: <ListChecks size={18} /> },
  { type: "infographic", title: "Infographic", action: "Visual", icon: <Sparkles size={18} /> },
  { type: "data-table", title: "Data Table", action: "Extract", icon: <Table2 size={18} /> },
];

const sourceTypeOptions: Array<{ type: SourceType; label: string }> = [
  { type: "markdown", label: "Document" },
  { type: "note", label: "Note" },
  { type: "url", label: "Website" },
  { type: "youtube", label: "YouTube" },
  { type: "google_doc", label: "Google Doc" },
  { type: "pdf", label: "PDF" },
  { type: "docx", label: "DOCX" },
  { type: "audio", label: "Audio" },
];

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

export default function App() {
  const [showLanding, setShowLanding] = useState(() => window.location.hash !== "#workspace");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>(() => initialAuthState().mode);
  const [resetToken, setResetToken] = useState(() => initialAuthState().token);
  const [authChecked, setAuthChecked] = useState(false);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("chat");
  const [sourceForm, setSourceForm] = useState<SourceForm>(emptySourceForm);
  const [activeSourceId, setActiveSourceId] = useState("");
  const [sourceBlocks, setSourceBlocks] = useState<SourceBlock[]>([]);
  const [highlightedBlockIds, setHighlightedBlockIds] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [answerStyle, setAnswerStyle] = useState<AnswerStyle>("Balanced");
  const [selectedArtifactId, setSelectedArtifactId] = useState("");
  const [audioOptions, setAudioOptions] = useState<AudioOverviewOptions>(defaultAudioOverviewOptions);
  const [flashcardOptions, setFlashcardOptions] = useState<FlashcardOptions>(defaultFlashcardOptions);
  const [isArtifactDetailOpen, setIsArtifactDetailOpen] = useState(false);
  const [isGroundingDetailOpen, setIsGroundingDetailOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [customizeType, setCustomizeType] = useState<"" | "audio" | "flashcards" | "thumbnail">("");
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [thumbnailRefs, setThumbnailRefs] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [openMenu, setOpenMenu] = useState<"" | "settings" | "account" | "notebooks">("");
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugStatus, setDebugStatus] = useState<DebugStatusResponse | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isCreatingArtifact, setIsCreatingArtifact] = useState<ArtifactType | "">("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [sourceFormNotice, setSourceFormNotice] = useState("");
  const didBootRef = useRef(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const sourceBodyRef = useRef<HTMLTextAreaElement | null>(null);

  const activeSource = useMemo(
    () => notebook?.sources.find((source) => source.id === activeSourceId) || notebook?.sources[0] || null,
    [activeSourceId, notebook],
  );
  const selectedArtifact = useMemo(
    () =>
      notebook?.artifacts.find((artifact) => artifact.id === selectedArtifactId) ||
      notebook?.artifacts[0] ||
      null,
    [notebook, selectedArtifactId],
  );
  const latestAssistant = useMemo(
    () => [...(notebook?.messages || [])].reverse().find((message) => message.role === "assistant"),
    [notebook?.messages],
  );
  const isSourceReady = useMemo(() => {
    const body = sourceForm.body.trim();
    const url = sourceForm.original_url.trim();
    const hasFile = Boolean(sourceForm.base64);
    if (sourceNeedsUrl(sourceForm.type)) return Boolean(url || body);
    if (sourceAcceptsFile(sourceForm.type)) return Boolean(hasFile || body);
    return Boolean(body || hasFile);
  }, [sourceForm]);

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
    if (!activeSourceId) return;
    void loadSourceBlocks(activeSourceId);
  }, [activeSourceId]);

  useEffect(() => {
    const messagesNode = messagesRef.current;
    if (!messagesNode) return;
    messagesNode.scrollTop = messagesNode.scrollHeight;
  }, [notebook?.messages.length, isAsking]);

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
      setNotebooks(list.notebooks);
      setNotebook(await loadNotebook(list.notebooks[0].id));
    } else {
      const seeded = await api<{ notebook: Notebook }>("/api/seed", {
        method: "POST",
        body: JSON.stringify({ reset: false }),
      });
      setNotebooks([seeded.notebook]);
      setNotebook(seeded.notebook);
      setToast("Seed notebook created.");
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

  async function createNotebook() {
    setOpenMenu("");
    setError("");
    setIsBooting(true);
    try {
      const created = await api<{ notebook: Notebook }>("/api/notebooks", {
        method: "POST",
        body: JSON.stringify({ title: "Untitled notebook" }),
      });
      const loaded = await loadNotebook(created.notebook.id);
      setNotebook(loaded);
      setActiveSourceId("");
      setSelectedArtifactId("");
      await refreshNotebookList();
      setMobilePanel("sources");
      openAddSource();
    } catch (createError) {
      setError(messageFromError(createError));
    } finally {
      setIsBooting(false);
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
      setActiveSourceId(loaded.sources[0]?.id || "");
      setSelectedArtifactId("");
    } catch (switchError) {
      setError(messageFromError(switchError));
    } finally {
      setIsBooting(false);
    }
  }

  function openAddSource(type: SourceType = "markdown") {
    setSourceForm({ ...emptySourceForm, type });
    setSourceFormNotice("");
    setIsAddSourceOpen(true);
    window.requestAnimationFrame(() => sourceBodyRef.current?.focus());
  }

  async function setAllSourcesActive(active: boolean) {
    if (!notebook) return;
    setError("");
    const targets = notebook.sources.filter((source) => source.active !== active);
    if (!targets.length) return;
    try {
      await Promise.all(
        targets.map((source) =>
          api(`/api/sources/${source.id}/active`, {
            method: "PATCH",
            body: JSON.stringify({ active }),
          }),
        ),
      );
      await refreshNotebook();
      refreshDebugSilently();
    } catch (toggleError) {
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
      setShowLanding(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  async function refreshNotebook(id = notebook?.id) {
    if (!id) return;
    setNotebook(await loadNotebook(id));
  }

  async function loadNotebook(id: string) {
    const response = await api<{ notebook: Notebook }>(`/api/notebooks/${id}`);
    return response.notebook;
  }

  async function loadSourceBlocks(sourceId: string) {
    try {
      const response = await api<{ blocks: SourceBlock[] }>(`/api/sources/${sourceId}/blocks`);
      setSourceBlocks(response.blocks);
    } catch (blockError) {
      setError(messageFromError(blockError));
    }
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
      setActiveSourceId(seeded.notebook.sources[0]?.id || "");
      setSelectedArtifactId(seeded.notebook.artifacts[0]?.id || "");
      setToast("Demo notebook rebuilt.");
      refreshDebugSilently();
    } catch (seedError) {
      setError(messageFromError(seedError));
    } finally {
      setIsBooting(false);
    }
  }

  async function handleSourceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!notebook) return;
    if (!isSourceReady) {
      const notice = sourceNeedsUrl(sourceForm.type)
        ? `Add a ${sourceTypeLabel(sourceForm.type)} URL or paste fallback text first.`
        : sourceAcceptsFile(sourceForm.type)
          ? `Choose a ${sourceTypeLabel(sourceForm.type)} file or paste extracted text first.`
          : "Paste source text or choose a file first.";
      setSourceFormNotice(notice);
      sourceBodyRef.current?.focus();
      return;
    }
    setIsAddingSource(true);
    setError("");
    setSourceFormNotice("");
    try {
      const response = await api<{ source: Source }>(`/api/notebooks/${notebook.id}/sources`, {
        method: "POST",
        body: JSON.stringify({
          type: sourceForm.type,
          title: sourceForm.title.trim() || undefined,
          body: sourceForm.body.trim(),
          original_url: sourceForm.original_url.trim(),
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
      setToast("Source added. Parsing and indexing into your notebook.");
      refreshDebugSilently();
    } catch (sourceError) {
      setError(messageFromError(sourceError));
    } finally {
      setIsAddingSource(false);
    }
  }

  async function processFile(file: File) {
    const base64 = await fileToBase64(file);
    const text = file.type.includes("text") || file.name.endsWith(".md") ? await file.text() : "";
    setSourceFormNotice("");
    setSourceForm((current) => ({
      ...current,
      type: sourceTypeFromFile(file),
      title: current.title || file.name.replace(/\.[^.]+$/, ""),
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      base64,
      body: text || current.body,
    }));
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) await processFile(file);
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) await processFile(file);
  }

  async function toggleSource(source: Source) {
    setError("");
    await api(`/api/sources/${source.id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ active: !source.active }),
    });
    await refreshNotebook();
    refreshDebugSilently();
  }

  async function deleteSource(source: Source) {
    setError("");
    await api(`/api/sources/${source.id}`, { method: "DELETE" });
    if (activeSourceId === source.id) setActiveSourceId("");
    await refreshNotebook();
    setToast("Source removed from notebook and indexes.");
    refreshDebugSilently();
  }

  async function askQuestion(input = question) {
    if (!notebook || !input.trim()) return;
    setIsAsking(true);
    setError("");
    setQuestion("");
    try {
      const response = await api<{
        message: ChatMessage;
        evidence_pack: { active_source_ids: string[] };
      }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          notebook_id: notebook.id,
          question: input,
          answer_style: answerStyle,
          chat_goal: "Source-only mode. Cite every factual claim.",
        }),
      });
      await refreshNotebook();
      const firstCitation = response.message.citations?.[0];
      if (firstCitation) focusCitation(firstCitation);
      setToast(
        response.message.mode === "abstained"
          ? "Source-only mode abstained because evidence was insufficient."
          : "Answer grounded and verified.",
      );
      refreshDebugSilently();
    } catch (chatError) {
      setError(messageFromError(chatError));
    } finally {
      setIsAsking(false);
    }
  }

  async function createArtifact(type: ArtifactType) {
    if (!notebook) return;
    setIsCreatingArtifact(type);
    setError("");
    try {
      const response = await api<{ artifact: Artifact; job: ArtifactJob }>("/api/artifacts", {
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
                : {},
        }),
      });
      await refreshNotebook();
      setSelectedArtifactId(response.artifact.id);
      setToast(`${artifactTitle(type)} generated from an Evidence Pack.`);
      refreshDebugSilently();
    } catch (artifactError) {
      setError(messageFromError(artifactError));
    } finally {
      setIsCreatingArtifact("");
    }
  }

  function focusCitation(citation: Citation) {
    const sourceId = citation.source_id || citation.sourceId || "";
    setActiveSourceId(sourceId);
    setHighlightedBlockIds(citation.block_ids || []);
    setMobilePanel("sources");
  }

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

  function startNoteSource() {
    setMobilePanel("sources");
    openAddSource("note");
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

  const sourceCount = notebook?.sources.length || 0;
  const activeCount = notebook?.active_source_count || 0;
  const activeProviderLabel = providerLabel(providerStatus);
  const runningDebugJobs = debugStatus?.debug.running_jobs.length || notebook?.jobs.filter((job) => ["queued", "running"].includes(job.status)).length || 0;
  const isWorking = isBooting || isAddingSource || isAsking || Boolean(isCreatingArtifact) || runningDebugJobs > 0;

  if (showLanding) {
    return (
      <LandingPage
        activeCount={activeCount}
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
          <button className="title-button brand-menu" type="button" onClick={() => setMobilePanel("sources")} aria-label="Open sources">
            <PanelLeft size={18} />
          </button>
          <button className="brand-mark" type="button" onClick={openHome} aria-label={`${BRAND_EYEBROW} home`} title="Home">
            <img src={BRAND_LOGO_PATH} alt="" />
          </button>
          <div className="notebook-title-cluster">
            <h1 className="notebook-title" title={notebook?.title || "Untitled notebook"}>
              {notebook?.title || "Untitled notebook"}
            </h1>
            {notebooks.length > 1 ? (
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
                      <button
                        key={item.id}
                        type="button"
                        className="menu-item"
                        data-active={item.id === notebook?.id}
                        onClick={() => void switchNotebook(item.id)}
                      >
                        <Library size={15} />
                        <span>{item.title || "Untitled notebook"}</span>
                        {item.id === notebook?.id ? <CheckCircle2 size={15} /> : null}
                      </button>
                    ))}
                    <div className="menu-divider" />
                    <button type="button" className="menu-item" onClick={() => void createNotebook()}>
                      <Plus size={15} />
                      <span>Create notebook</span>
                    </button>
                  </Menu>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="topbar-actions">
          <button className="ghost-button create-notebook" type="button" onClick={() => void createNotebook()}>
            <Plus size={15} />
            Create notebook
          </button>
          <button className="primary-button" type="button" onClick={exportNotebook}>
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
                <div className="menu-status">
                  <span><ShieldCheck size={13} /> Source-only mode</span>
                  <span><Database size={13} /> {activeProviderLabel}</span>
                </div>
                <div className="menu-divider" />
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
          {error}
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
            <XCircle size={14} />
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className="toast">
          <CheckCircle2 size={16} />
          {toast}
          <button type="button" onClick={() => setToast("")} aria-label="Dismiss notification">
            <XCircle size={14} />
          </button>
        </div>
      ) : null}

      <main className="workspace" data-active-panel={mobilePanel}>
        <section className="panel source-panel" aria-label="Sources panel">
          <PanelHeader icon={<Library size={18} />} title="Sources" count={sourceCount} />

          <div className="source-add">
            <button className="primary-button add-sources-button" type="button" onClick={() => openAddSource()}>
              <Plus size={16} />
              Add sources
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
              >
                Select all
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
            {notebook?.sources.map((source) => (
              <article
                key={source.id}
                className="source-card"
                data-active={source.id === activeSourceId}
                data-selected={source.active}
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
                  </span>
                </button>
                <button className="icon-button subtle source-delete" type="button" onClick={() => void deleteSource(source)} aria-label="Delete source">
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
        </section>

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
              <button className="ghost-button compact grounding-button" type="button" onClick={() => setIsGroundingDetailOpen(true)}>
                <ShieldCheck size={15} />
                Grounding
              </button>
            </div>
          </div>

          <div className="messages" ref={messagesRef} role="log" aria-live="polite">
            {!notebook?.messages.length ? (
              <ResearchCanvas
                activeCount={activeCount}
                suggestions={notebook?.suggested_questions?.length ? notebook.suggested_questions : defaultQuestions}
                onAsk={(prompt) => void askQuestion(prompt)}
              />
            ) : (
              notebook.messages.map((message) => (
                <ChatBubble key={message.id} message={message} onCitationClick={focusCitation} />
              ))
            )}
            {isAsking ? <ThinkingBubble /> : null}
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

        <section className="panel studio-panel" aria-label="Studio panel">
          <PanelHeader icon={<Sparkles size={18} />} title="Studio" count={notebook?.artifacts.length || 0} />

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
                  disabled={Boolean(isCreatingArtifact)}
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
                  disabled={Boolean(isCreatingArtifact)}
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
                  disabled={Boolean(isCreatingArtifact)}
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
                disabled={Boolean(isCreatingArtifact)}
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
                  disabled={Boolean(isCreatingArtifact)}
                  placeholder="Focus"
                />
              </label>
              <label>
                <span>Difficulty</span>
                <select
                  value={flashcardOptions.difficulty}
                  onChange={(event) => setFlashcardOptions((current) => ({ ...current, difficulty: event.target.value as FlashcardDifficulty }))}
                  disabled={Boolean(isCreatingArtifact)}
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
                  disabled={Boolean(isCreatingArtifact)}
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
                  disabled={Boolean(isCreatingArtifact)}
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
                disabled={Boolean(isCreatingArtifact)}
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
                    disabled={Boolean(isCreatingArtifact)}
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
                  disabled={Boolean(isCreatingArtifact)}
                >
                  {sourceModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {flashcardOptions.sourceMode === "selected" ? (
                <div className="flashcard-source-picks" aria-label="Selected flashcard sources">
                  {notebook?.sources.slice(0, 6).map((source) => {
                    const selected = flashcardOptions.selectedSourceIds.includes(source.id);
                    return (
                      <button
                        key={source.id}
                        type="button"
                        data-selected={selected}
                        disabled={Boolean(isCreatingArtifact)}
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
              <p>Face, logo, product — gpt-image-1 blends them into the thumbnail.</p>
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

          <div className="studio-grid">
            {artifactTypes.map((artifact) => (
              <button
                key={artifact.type}
                className="studio-tile"
                data-kind={artifact.type}
                type="button"
                onClick={() => {
                  if (artifact.type === "audio" || artifact.type === "flashcards" || artifact.type === "thumbnail") {
                    setCustomizeType(artifact.type);
                  } else {
                    void createArtifact(artifact.type);
                  }
                }}
                disabled={Boolean(isCreatingArtifact)}
              >
                <span className="studio-icon">{isCreatingArtifact === artifact.type ? <Loader2 className="spin" size={18} /> : artifact.icon}</span>
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
                <strong>Outputs</strong>
                <span>{notebook.artifacts.length}</span>
              </div>
              <div className="artifact-list">
                {notebook.artifacts.map((artifact) => (
                  <button
                    key={artifact.id}
                    type="button"
                    className="artifact-row"
                    data-active={artifact.id === selectedArtifact?.id}
                    data-kind={artifact.type}
                    onClick={() => {
                      setSelectedArtifactId(artifact.id);
                      setIsArtifactDetailOpen(true);
                    }}
                  >
                    <span className="artifact-icon" data-kind={artifact.type}>{artifactIcon(artifact.type)}</span>
                    <span>
                      <strong>{artifact.title}</strong>
                      <small>{artifactMetaLine(artifact)}</small>
                    </span>
                    <span className="artifact-row-actions">
                      {artifact.type === "audio" || artifact.type === "video" ? <PlayCircle size={16} /> : null}
                      <MoreVertical size={16} />
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <button className="add-note-button" type="button" onClick={startNoteSource}>
            <NotebookPen size={16} />
            Add note
          </button>
        </section>
      </main>

      <nav className="mobile-tabs" aria-label="Workspace panels">
        <MobileTab panel="sources" active={mobilePanel} onChange={setMobilePanel} icon={<Library size={17} />} label="Sources" />
        <MobileTab panel="chat" active={mobilePanel} onChange={setMobilePanel} icon={<MessageSquareText size={17} />} label="Chat" />
        <MobileTab panel="studio" active={mobilePanel} onChange={setMobilePanel} icon={<Sparkles size={17} />} label="Studio" />
      </nav>

      {isAddSourceOpen ? (
        <div className="modal-backdrop artifact-modal-backdrop" role="presentation" onClick={() => setIsAddSourceOpen(false)}>
          <section className="modal add-source-modal" role="dialog" aria-modal="true" aria-label="Add sources" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Add sources</h2>
              </div>
              <button className="icon-button subtle" type="button" onClick={() => setIsAddSourceOpen(false)} aria-label="Close add sources">
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
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => void handleDrop(event)}
              >
                <UploadCloud size={30} />
                <strong>Drop a file here, or click to upload</strong>
                <p>PDF, Markdown, text, DOCX, images, audio — and more.</p>
                {sourceForm.file_name ? (
                  <span className="add-source-attached">
                    <CheckCircle2 size={14} /> {sourceForm.file_name}
                  </span>
                ) : null}
                <input type="file" accept={sourceFileAccept(sourceForm.type)} onChange={(event) => void handleFile(event)} />
              </label>

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
                      setSourceForm((current) => ({ ...current, type: tab.type, file_name: "", base64: undefined }));
                      window.requestAnimationFrame(() => sourceBodyRef.current?.focus());
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {sourceNeedsUrl(sourceForm.type) ? (
                <label className="modal-field">
                  <span>{sourceForm.type === "youtube" ? "YouTube URL" : "Website URL"}</span>
                  <input
                    value={sourceForm.original_url}
                    onChange={(event) => setSourceForm((current) => ({ ...current, original_url: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder={sourceUrlPlaceholder(sourceForm.type)}
                    inputMode="url"
                    autoFocus
                  />
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

              {sourceFormNotice ? <p className="source-form-help">{sourceFormNotice}</p> : null}
              <div className="modal-actions">
                <span style={{ marginRight: "auto", fontSize: "0.78rem", opacity: 0.55 }}>
                  {sourceNeedsUrl(sourceForm.type)
                    ? "Press Enter or click Add source"
                    : sourceForm.type === "markdown" || sourceForm.type === "text" || sourceForm.type === "note"
                      ? "Press ⌘/Ctrl + Enter or click Add source"
                      : "Click Add source to finish"}
                </span>
                <button className="secondary-button" type="button" onClick={() => setIsAddSourceOpen(false)}>Cancel</button>
                <button className="primary-button" type="submit" disabled={isAddingSource}>
                  {isAddingSource ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                  Add source
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isArtifactDetailOpen ? (
        <div className="modal-backdrop artifact-modal-backdrop" role="presentation" onClick={() => setIsArtifactDetailOpen(false)}>
          <section className="modal artifact-modal" role="dialog" aria-modal="true" aria-label="Artifact preview" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="panel-eyebrow">Studio artifact</p>
                <h2>{selectedArtifact?.title || "Artifact preview"}</h2>
              </div>
              <button className="icon-button subtle" type="button" onClick={() => setIsArtifactDetailOpen(false)} aria-label="Close artifact preview">
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

      {isGroundingDetailOpen ? (
        <div className="modal-backdrop artifact-modal-backdrop" role="presentation" onClick={() => setIsGroundingDetailOpen(false)}>
          <section className="modal grounding-modal" role="dialog" aria-modal="true" aria-label="Grounding details" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="panel-eyebrow">Citation Ledger</p>
                <h2>Grounding details</h2>
              </div>
              <button className="icon-button subtle" type="button" onClick={() => setIsGroundingDetailOpen(false)} aria-label="Close grounding details">
                <XCircle size={17} />
              </button>
            </div>
            <GroundingDetail message={latestAssistant} providerStatus={providerStatus} />
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
      ? "Create a local account, seed a private notebook, and keep the research workspace scoped to your session."
      : mode === "reset-request"
        ? "Request a password reset token for the local demo account database."
        : mode === "reset-confirm"
          ? "Use the reset token to replace the password and create a fresh session."
          : "Use your local account to access notebooks, sources, citations, and generated artifacts.";

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
          setNotice("Local reset token generated. Set a new password below.");
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
              <p className="panel-eyebrow">Secure local access</p>
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
  activeCount,
  sourceCount,
  providerLabel,
  isBooting,
  isAuthenticated,
  onOpenWorkspace,
  onSignIn,
  onCreateAccount,
}: {
  activeCount: number;
  sourceCount: number;
  providerLabel: string;
  isBooting: boolean;
  isAuthenticated: boolean;
  onOpenWorkspace: () => void;
  onSignIn: () => void;
  onCreateAccount: () => void;
}) {
  const landingMetrics = [
    { value: isBooting ? "..." : String(sourceCount || 4), label: "seed sources" },
    { value: isBooting ? "..." : String(activeCount || 4), label: "active evidence streams" },
    { value: providerLabel.includes("Anthropic") ? "Claude" : "Local", label: "grounded answer route" },
  ];
  const steps = [
    {
      icon: <UploadCloud size={18} />,
      title: "Upload sources",
      body: "Markdown, notes, URLs and PDF text extraction become stable source blocks.",
    },
    {
      icon: <GitBranch size={18} />,
      title: "Build Evidence Packs",
      body: "Retrieval is scoped to active sources and saved as auditable evidence.",
    },
    {
      icon: <ShieldCheck size={18} />,
      title: "Verify every claim",
      body: "Citation Ledgers check support before answers and artifacts are shown.",
    },
  ];
  const outputs = [
    "Audio briefings",
    "Reports",
    "Mind maps",
    "Flashcards",
    "Quizzes",
    "Slide decks",
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
          <a href="#plans">Plans</a>
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
              <span>Sources</span>
              <strong>4 active</strong>
              <p>Notebook architecture notes</p>
              <p>SME automation playbook</p>
              <p>Grounding best practices</p>
            </div>
            <div className="scene-window scene-chat">
              <span>Evidence Pack</span>
              <strong>Ask anything from your sources</strong>
              <p>{BRAND_NAME} uses source blocks, retrieval runs and Citation Ledgers to keep answers auditable. [1]</p>
              <div>
                <mark>[1]</mark>
                <mark>[2]</mark>
                <mark>[3]</mark>
              </div>
            </div>
            <div className="scene-window scene-studio">
              <span>Studio</span>
              <strong>Audio Overview</strong>
              <p>Host A and Host B explain the Evidence Pack in a conversational briefing.</p>
            </div>
          </div>

          <div className="landing-hero-copy">
            <p className="landing-kicker">Source-grounded AI research</p>
            <h1 id="landing-title">Understand anything in your sources.</h1>
            <p>
              Upload research material, ask grounded questions, and generate reusable briefings from the same verified
              Evidence Pack.
            </p>
            <div className="landing-hero-actions">
              <button className="landing-primary" type="button" onClick={onOpenWorkspace}>
                {isAuthenticated ? `Open ${BRAND_NAME}` : "Start with an account"}
                <ArrowRight size={18} />
              </button>
              <a className="landing-secondary" href="#overview">
                <PlayCircle size={18} />
                See how it works
              </a>
            </div>
          </div>

          <div className="landing-metrics" aria-label="Live demo metrics">
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
            <p className="landing-kicker">Research, not generic PDF chat</p>
            <h2>Learn more about any subject with the help of your own sources.</h2>
          </div>
          <p>
            {BRAND_NAME} turns notes, documents and URLs into a controlled knowledge workspace. Responses stay
            grounded in the information you provide, and every generated output keeps source references attached.
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

        <section className="landing-section audio-band" id="audio">
          <div className="audio-copy">
            <p className="landing-kicker">Audio Overview</p>
            <h2>Turn source evidence into a podcast-style briefing.</h2>
            <p>
              The current demo creates a verified two-host transcript. The provider boundary is ready for ElevenLabs
              rendering while keeping citations and the transcript visible in the artifact.
            </p>
          </div>
          <div className="audio-script" aria-label="Audio overview example">
            <div>
              <span>Host A</span>
              <p>Let's anchor this in the source: Evidence Packs make retrieval auditable. [1]</p>
            </div>
            <div>
              <span>Host B</span>
              <p>And the Citation Ledger checks whether each answer claim is supported before the user relies on it. [2]</p>
            </div>
          </div>
        </section>

        <section className="landing-section output-band" id="plans">
          <div>
            <p className="landing-kicker">Studio outputs</p>
            <h2>One evidence layer, many reusable artifacts.</h2>
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
          <h2>Open the workspace and inspect the evidence.</h2>
          <p>Sources, chat, citations, artifacts and provider status are already wired into the local demo.</p>
          <button className="landing-primary" type="button" onClick={onOpenWorkspace}>
            Open {BRAND_NAME}
            <ArrowRight size={18} />
          </button>
        </section>
      </main>
    </div>
  );
}

function SourceDetail({
  source,
  blocks,
  highlightedBlockIds,
}: {
  source: Source | null;
  blocks: SourceBlock[];
  highlightedBlockIds: string[];
}) {
  if (!source) {
    return (
      <div className="source-viewer">
        <p>Select or add a source to inspect citation blocks.</p>
      </div>
    );
  }
  return (
    <div className="source-viewer">
      <div className="source-viewer-top">
        <div>
          <p>{source.type}</p>
          <h3>{source.title}</h3>
        </div>
        <span className="source-accent" />
      </div>
      <p>{source.summary || "Source indexed. Summary will appear after parsing."}</p>
      <div className="source-block-list">
        {blocks.slice(0, 24).map((block) => (
          <article key={block.block_id} data-highlight={highlightedBlockIds.includes(block.block_id)}>
            <small>
              {block.type} · {block.heading_path.join(" / ") || "Overview"} · {block.block_id}
            </small>
            <p>{block.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ResearchCanvas({
  activeCount,
  suggestions,
  onAsk,
}: {
  activeCount: number;
  suggestions: string[];
  onAsk: (prompt: string) => void;
}) {
  return (
    <section className="research-canvas" aria-label="Start a conversation">
      <span className="canvas-mark">
        <Sparkles size={22} />
      </span>
      <h3>{activeCount ? "Ask anything about your sources" : "Add a source to get started"}</h3>
      <p>
        {activeCount
          ? `${ASSISTANT_NAME} answers only from your ${activeCount} active source${activeCount === 1 ? "" : "s"} — with a citation for every claim.`
          : "Upload a document, paste text, add a note, or link a website. Every answer stays grounded in what you add."}
      </p>
      {activeCount && suggestions.length ? (
        <div className="canvas-suggestions">
          {suggestions.slice(0, 4).map((prompt) => (
            <button key={prompt} type="button" onClick={() => onAsk(prompt)}>
              <MessageSquareText size={15} />
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ChatBubble({
  message,
  onCitationClick,
}: {
  message: ChatMessage;
  onCitationClick: (citation: Citation) => void;
}) {
  return (
    <article className="chat-bubble" data-role={message.role}>
      <span className="avatar">{message.role === "assistant" ? <Bot size={17} /> : <NotebookPen size={17} />}</span>
      <div className="bubble-body">
        <div className="bubble-topline">
          <strong>{message.role === "assistant" ? ASSISTANT_NAME : "You"}</strong>
          {message.role === "assistant" && message.provider ? <span>{providerMeta(message)}</span> : null}
          {message.mode === "abstained" ? <span>Abstained</span> : null}
        </div>
        <div className="answer-text">{renderMessageContent(message.content, message.citations || [], onCitationClick)}</div>
        {message.citations?.length ? (
          <div className="citation-list">
            {message.citations.map((citation) => (
              <button key={citation.evidence_id} type="button" className="citation-card" onClick={() => onCitationClick(citation)}>
                <strong>[{citation.index}] {citation.source_title || citation.sourceTitle}</strong>
                <p>{truncate(citation.quote, 150)}</p>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function renderInline(
  text: string,
  citations: Citation[],
  onCitationClick: (citation: Citation) => void,
  keyPrefix: string,
) {
  return text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    const bold = /^\*\*([^*]+)\*\*$/.exec(token);
    if (bold) return <strong key={key}>{bold[1]}</strong>;
    const cite = /^\[(\d+)\]$/.exec(token);
    if (cite) {
      const citation = citations[Number(cite[1]) - 1];
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

function ThinkingBubble() {
  return (
    <article className="chat-bubble">
      <span className="avatar">
        <Loader2 className="spin" size={17} />
      </span>
      <div className="bubble-body">
        <div className="bubble-topline">
          <strong>{ASSISTANT_NAME}</strong>
          <span>Retrieving evidence</span>
        </div>
        <p>Building Evidence Pack, verifying citations, and preparing source-only answer...</p>
      </div>
    </article>
  );
}

function GroundingPanel({ message }: { message?: ChatMessage }) {
  if (!message?.claim_stats) {
    return (
      <p className="ai-disclaimer">
        Source-only mode is enforced server-side. Answers abstain when active sources do not support the question.
      </p>
    );
  }
  const stats = message.claim_stats;
  const citationCoverage = Math.round((stats.citation_coverage ?? 0) * 100);
  const supportScore = Math.round((stats.support_score ?? 0) * 100);
  return (
    <div className="ai-disclaimer grounding-strip">
      <span>
        <ShieldCheck size={14} />
        {stats.claims_checked} claims checked
      </span>
      <span>{stats.supported} supported</span>
      <span>{stats.partially_supported} partial</span>
      <span>{stats.unsupported} unsupported</span>
      <span>{citationCoverage}% citation coverage</span>
      <span>{supportScore}% support score</span>
    </div>
  );
}

function GroundingDetail({ message, providerStatus }: { message?: ChatMessage; providerStatus: ProviderStatus | null }) {
  const stats = message?.claim_stats;
  return (
    <div className="grounding-detail">
      <div className="grounding-meta-grid">
        <span>
          <strong>Provider</strong>
          {providerLabel(providerStatus)}
        </span>
        <span>
          <strong>Model</strong>
          {message?.model || providerStatus?.grounded_answer_model || "local-grounded-v1"}
        </span>
        <span>
          <strong>Mode</strong>
          {message?.mode || "source-only"}
        </span>
        <span>
          <strong>Citations</strong>
          {message?.citations?.length || 0}
        </span>
        <span>
          <strong>Coverage</strong>
          {stats?.citation_coverage !== undefined ? `${Math.round(stats.citation_coverage * 100)}%` : "n/a"}
        </span>
      </div>

      {stats ? <GroundingPanel message={message} /> : (
        <p className="ai-disclaimer">
          Ask a grounded question to create the next Citation Ledger. The server verifies cited claims before the answer is shown.
        </p>
      )}

      {message?.citations?.length ? (
        <div className="ledger-list">
          {message.citations.map((citation) => (
            <article key={citation.evidence_id}>
              <strong>[{citation.index}] {citation.source_title || citation.sourceTitle}</strong>
              <p>{citation.quote}</p>
              <small>
                {(citation.heading_path || []).join(" / ") || "Source passage"} · {citation.block_ids?.length || 0} source block{citation.block_ids?.length === 1 ? "" : "s"} referenced
              </small>
            </article>
          ))}
        </div>
      ) : (
        <div className="ledger-empty">
          <ShieldCheck size={18} />
          <p>No citation cards are attached to the latest answer yet.</p>
        </div>
      )}
    </div>
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
      local: "Local fallback",
    }[status.active_grounded_answer_provider] || "Local fallback";
  return status.external_grounded_answer_enabled ? label : "Local fallback";
}

function providerMeta(message: ChatMessage) {
  const provider =
    {
      anthropic: "Anthropic",
      openai: "OpenAI",
      google: "Gemini",
      local: "Local",
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
      <div className="artifact-preview-top">
        <div>
          <p>{artifact.type}</p>
          <h3>{artifact.title}</h3>
        </div>
        <div className="artifact-downloads">
          {svgMarkup ? (
            <button className="icon-button subtle" type="button" onClick={() => downloadText(`${downloadSlug(artifact.title)}.svg`, svgMarkup, "image/svg+xml")} aria-label="Download infographic SVG">
              <Download size={15} />
            </button>
          ) : null}
          <button className="icon-button subtle" type="button" onClick={() => downloadText(`${downloadSlug(artifact.title)}.json`, JSON.stringify(payload, null, 2))} aria-label="Download artifact JSON">
            <Download size={15} />
          </button>
        </div>
      </div>
      <ArtifactPayload
        artifact={artifact}
        payload={payload}
        onCitationClick={onCitationClick}
        onArtifactRefresh={onArtifactRefresh}
        onToast={onToast}
        onError={onError}
      />
      <ArtifactEvidenceAuditView audit={payload.evidence_audit as ArtifactEvidenceAudit | undefined} />
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
        {payload.image_prompt ? <p className="thumb-prompt">{String(payload.image_prompt)}</p> : null}
      </div>
    );
  }

  if (Array.isArray(payload.titles) && Array.isArray(payload.chapters)) {
    const titles = (payload.titles as string[]) || [];
    const description = String(payload.description || "");
    const chapters = (payload.chapters as Array<{ time?: string; label?: string }>) || [];
    const tags = (payload.tags as string[]) || [];
    const copy = (text: string, label: string) => {
      void navigator.clipboard?.writeText(text);
      onToast(`${label} copied.`);
    };
    return (
      <div className="youtube-kit-preview">
        <section>
          <h4>Title options</h4>
          <div className="yt-titles">
            {titles.map((title, index) => (
              <button key={index} type="button" className="yt-title" onClick={() => copy(title, "Title")}>
                <span>{title}</span>
                <Copy size={13} />
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="yt-section-head">
            <h4>Description</h4>
            <button type="button" onClick={() => copy(description, "Description")}>
              <Copy size={13} /> Copy
            </button>
          </div>
          <pre className="yt-description">{description}</pre>
        </section>
        {chapters.length ? (
          <section>
            <div className="yt-section-head">
              <h4>Chapters</h4>
              <button type="button" onClick={() => copy(chapters.map((chapter) => `${chapter.time} ${chapter.label}`).join("\n"), "Chapters")}>
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

  if (Array.isArray(payload.tldr) || Array.isArray(payload.key_points)) {
    return (
      <div className="report-preview">
        {Array.isArray(payload.tldr) ? (
          <section>
            <h4>TL;DR</h4>
            <ul>
              {(payload.tldr as string[]).slice(0, 5).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {Array.isArray(payload.key_points) ? (
          <section>
            <h4>Key points</h4>
            <div className="artifact-json">
              {(payload.key_points as ReportPointPayload[]).slice(0, 8).map((point, index) => (
                <article key={`${point.text}-${index}`}>
                  <strong>{point.citation || `[${index + 1}]`}</strong>
                  <p>{point.text}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  if (Array.isArray(payload.panels)) {
    return <InfographicPreview payload={payload} panels={payload.panels as InfographicPanelPayload[]} />;
  }

  if (Array.isArray(payload.nodes) && Array.isArray(payload.edges)) {
    return (
      <MindMapPreview
        nodes={payload.nodes as MindMapNode[]}
        edges={payload.edges as MindMapEdge[]}
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
      <SlideDeckPreview slides={payload.slides as SlidePayload[]} onCitationClick={onCitationClick} />
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
    return (
      <div className="artifact-json">
        {(payload.storyboard as StoryboardPayload[]).slice(0, 6).map((scene, index) => (
          <article key={index}>
            <strong>Scene {scene.scene}: {scene.title}</strong>
            <p>{scene.narration}</p>
          </article>
        ))}
      </div>
    );
  }
  return <pre className="artifact-json">{JSON.stringify(payload, null, 2)}</pre>;
}

function MindMapPreview({
  nodes,
  edges,
  onCitationClick,
}: {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  onCitationClick: (citation: Citation) => void;
}) {
  const [selectedId, setSelectedId] = useState(nodes[0]?.id || "center");
  const selected = nodes.find((node) => node.id === selectedId) || nodes[0];
  const connectedEdges = edges.filter((edge) => edge.source === selected?.id || edge.target === selected?.id);
  const connectedNodes = connectedEdges
    .map((edge) => nodes.find((node) => node.id === (edge.source === selected?.id ? edge.target : edge.source)))
    .filter((node): node is MindMapNode => Boolean(node));
  const sourceRef = selected?.source_refs?.[0];

  return (
    <div className="mindmap-interactive">
      <div className="mindmap-node-list">
        {nodes.slice(0, 14).map((node, index) => (
          <button
            key={node.id || index}
            type="button"
            data-selected={(node.id || "") === selectedId}
            onClick={() => setSelectedId(node.id || "")}
          >
            <span>{node.type || "node"}</span>
            <strong>{node.label || "Node"}</strong>
          </button>
        ))}
      </div>
      {selected ? (
        <article className="mindmap-detail">
          <span>{selected.type || "node"}</span>
          <strong>{selected.label || "Node"}</strong>
          {connectedNodes.length ? (
            <p>{connectedNodes.slice(0, 5).map((node) => node.label || "Node").join(" · ")}</p>
          ) : (
            <p>No connected child nodes in this artifact.</p>
          )}
          {sourceRef ? (
            <button type="button" onClick={() => onCitationClick(citationFromSourceRef(sourceRef, selected.label || "Mind map evidence"))}>
              <ShieldCheck size={15} />
              Open source
            </button>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}

function SlideDeckPreview({
  slides,
  onCitationClick,
}: {
  slides: SlidePayload[];
  onCitationClick: (citation: Citation) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
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

  return (
    <div className="slide-preview">
      <div className="slide-stage">
        <span>{activeSlide.layout_type || "slide"} · {activeIndex + 1}/{slides.length}</span>
        <h4>{activeSlide.title}</h4>
        {activeSlide.subtitle ? <p>{activeSlide.subtitle}</p> : null}
        <ul>
          {(activeSlide.bullets || []).slice(0, 5).map((bullet, index) => (
            <li key={`${bullet}-${index}`}>{bullet}</li>
          ))}
        </ul>
      </div>
      <div className="slide-notes">
        {activeSlide.visual_suggestion ? <p><strong>Visual</strong>{activeSlide.visual_suggestion}</p> : null}
        {activeSlide.speaker_notes ? <p><strong>Notes</strong>{activeSlide.speaker_notes}</p> : null}
        {activeSlide.citations?.length ? (
          <div className="slide-citations">
            {activeSlide.citations.slice(0, 4).map((citation, index) => (
              <button key={citation.evidence_id || index} type="button" onClick={() => onCitationClick(citation)}>
                [{citation.index || index + 1}] {citation.source_title || citation.sourceTitle || "Source"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="slide-controls">
        <button type="button" onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} disabled={activeIndex === 0}>
          Previous
        </button>
        <div>
          {slides.slice(0, 10).map((slide, index) => (
            <button
              key={`${slide.title}-${index}`}
              type="button"
              data-active={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              aria-label={`Open slide ${index + 1}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setActiveIndex((index) => Math.min(slides.length - 1, index + 1))} disabled={activeIndex >= slides.length - 1}>
          Next
        </button>
      </div>
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

  useEffect(() => {
    let cancelled = false;
    async function loadDeck() {
      setIsLoading(true);
      try {
        const response = await api<{ deck: FlashcardDeck }>(`/api/artifacts/${artifact.id}/flashcard-deck`);
        if (!cancelled) setDeck(response.deck);
      } catch (deckError) {
        if (!cancelled) onError(messageFromError(deckError));
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
            <button type="button" className="flashcard-card-face" onClick={() => setIsAnswerVisible((current) => !current)}>
              <strong>{isAnswerVisible ? "Answer" : `Card ${activeIndex + 1} of ${visibleCards.length}`}</strong>
              <p>{isAnswerVisible ? activeCard.answer : activeCard.question}</p>
              {isAnswerVisible && isExplanationVisible && activeCard.explanation ? <small>{activeCard.explanation}</small> : null}
              {!isAnswerVisible && activeCard.hint ? <small>{activeCard.hint}</small> : null}
            </button>
            <div className="flashcard-card-footer">
              <button type="button" onClick={() => openCardCitation(activeCard)} disabled={!activeCard.source_refs?.length}>
                <ShieldCheck size={15} />
                {activeCard.citation || "Source"}
              </button>
              <button type="button" onClick={() => { setIsAnswerVisible(true); setIsExplanationVisible((current) => !current); }} disabled={!activeCard.explanation}>
                <Sparkles size={15} />
                Explain
              </button>
              <button type="button" onClick={() => void deleteCard()} disabled={!deck}>
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

  return (
    <div className="infographic-artifact">
      {svgSrc ? (
        <figure className="infographic-frame">
          <img src={svgSrc} alt={typeof payload.title === "string" ? payload.title : "Source-grounded infographic"} />
        </figure>
      ) : null}
      {meta.length ? (
        <div className="infographic-meta">
          {meta.map((item) => <span key={item}>{item}</span>)}
        </div>
      ) : null}
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
    </div>
  );
}

function QuizSession({ payload, questions }: { payload: Record<string, unknown>; questions: QuizPayload[] }) {
  const quizKey = questions.map((question, index) => question.id || question.question || index).join("|");
  const preparedQuestions = questions.filter((question) => question.question && (question.options || []).length >= 2);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    setCurrentIndex(0);
    setAnswers({});
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
  }

  return (
    <div className="quiz-session">
      <div className="quiz-summary">
        <span>
          <strong>{answeredCount}/{preparedQuestions.length}</strong>
          answered
        </span>
        <span>
          <strong>{scorePercent}%</strong>
          score
        </span>
        <span>
          <strong>{Math.round(passingScore * 100)}%</strong>
          pass
        </span>
      </div>

      <div className="quiz-progress" aria-label="Quiz progress">
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <article className="quiz-card">
        <div className="quiz-card-top">
          <span>Question {currentIndex + 1} · {current.difficulty || "medium"}</span>
          {current.learning_goal ? <small>{current.learning_goal}</small> : null}
          <strong>{current.question}</strong>
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
                <strong>{option}</strong>
                {state === "correct" ? <CheckCircle2 size={16} /> : null}
                {state === "wrong" ? <XCircle size={16} /> : null}
              </button>
            );
          })}
        </div>

        {selected !== undefined ? (
          <div className="quiz-explanation" data-correct={selected === correctIndex}>
            <strong>{selected === correctIndex ? "Correct" : "Review the evidence"}</strong>
            <p>{current.explanation}</p>
            {current.evidence_quote ? <small>{current.evidence_quote}</small> : null}
            {current.tags?.length ? (
              <div className="quiz-tags">
                {current.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            ) : null}
          </div>
        ) : null}
      </article>

      <div className="quiz-actions">
        <button type="button" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0}>
          Previous
        </button>
        <button
          type="button"
          onClick={() => setCurrentIndex((index) => Math.min(preparedQuestions.length - 1, index + 1))}
          disabled={currentIndex === preparedQuestions.length - 1}
        >
          Next
        </button>
        <button type="button" onClick={resetQuiz}>
          <RefreshCw size={14} />
          Reset
        </button>
      </div>

      {isComplete ? (
        <div className="quiz-result" data-passed={passed}>
          <strong>{passed ? "Passed" : "Needs review"}</strong>
          <p>{correctCount} of {preparedQuestions.length} answers matched the cited evidence.</p>
        </div>
      ) : null}
    </div>
  );
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

function ArtifactEvidenceAuditView({ audit }: { audit?: ArtifactEvidenceAudit }) {
  if (!audit || typeof audit !== "object") return null;
  const sourceCoverage = Math.round((audit.source_coverage || 0) * 100);
  const evidenceCoverage = Math.round((audit.evidence_coverage || 0) * 100);
  const itemCoverage = Math.round((audit.item_citation_coverage || 0) * 100);
  const status = audit.status || "needs_review";
  return (
    <section className="artifact-audit" data-status={status}>
      <div className="section-heading">
        <strong>Evidence audit</strong>
        <span>{status.replaceAll("_", " ")}</span>
      </div>
      {audit.summary ? <p className="artifact-audit-summary">{audit.summary}</p> : null}
      <div className="artifact-audit-grid">
        <span>
          <strong>{audit.evidence_items || 0}</strong>
          evidence items
        </span>
        <span>
          <strong>{audit.cited_evidence_items || 0}</strong>
          cited items
        </span>
        <span>
          <strong>{evidenceCoverage}%</strong>
          evidence coverage
        </span>
        <span>
          <strong>{sourceCoverage}%</strong>
          source coverage
        </span>
        <span>
          <strong>{itemCoverage}%</strong>
          item citations
        </span>
        <span>
          <strong>{audit.invalid_citation_count || 0}</strong>
          invalid refs
        </span>
        <span>
          <strong>{audit.retrieval_intent || "artifact"}</strong>
          intent
        </span>
        <span>
          <strong>{audit.artifact_items || 0}</strong>
          audited items
        </span>
      </div>
      {audit.top_sources?.length ? (
        <div className="artifact-audit-sources">
          {audit.top_sources.slice(0, 4).map((source) => (
            <span key={source.source_id || source.title}>
              {source.title || "Source"} · {source.cited_items || 0}/{source.references || source.evidence_items || 0}
            </span>
          ))}
        </div>
      ) : null}
      {audit.uncited_evidence_ids?.length ? (
        <small className="artifact-audit-muted">
          Unused evidence: {audit.uncited_evidence_ids.slice(0, 6).join(", ")}
          {audit.uncited_evidence_ids.length > 6 ? "..." : ""}
        </small>
      ) : null}
    </section>
  );
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
  "What does Block Research AI appear to offer across the website and blog sources?",
  "Which trading-bot and automation themes appear most often in the sources?",
  "Find contradictions or open questions in the sources.",
  "Create an executive brief from all active sources.",
];

function sourceIcon(type: SourceType) {
  if (type === "url") return <Globe size={16} />;
  if (type === "youtube") return <Video size={16} />;
  if (type === "audio") return <AudioLines size={16} />;
  if (type === "google_doc") return <FileText size={16} />;
  if (type === "note") return <NotebookPen size={16} />;
  if (type === "pdf") return <FileText size={16} />;
  if (type === "docx") return <FileText size={16} />;
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
      youtube: "YouTube",
      audio: "Audio",
      google_doc: "Google Doc",
    } as Record<string, string>
  )[type] || "Source";
}

function sourceNeedsUrl(type: SourceType) {
  return ["url", "youtube", "google_doc"].includes(type);
}

function sourceAcceptsFile(type: SourceType) {
  return ["pdf", "docx", "audio", "markdown", "text"].includes(type);
}

function sourceFileAccept(type: SourceType) {
  if (type === "pdf") return ".pdf,application/pdf";
  if (type === "docx") return ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (type === "audio") return "audio/*,video/*,.mp3,.m4a,.wav,.aac,.ogg,.mp4,.mov";
  if (type === "image") return "image/*,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.bmp,.tiff";
  return ".md,.txt,.pdf,.docx,.csv,image/*,audio/*,video/*,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function sourceTypeFromFile(file: File): SourceType {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif|bmp|tiff?|avif|ico)$/i.test(name)) return "image";
  if (file.type.startsWith("audio/") || file.type.startsWith("video/") || /\.(mp3|m4a|wav|aac|ogg|opus|mp4|mov|avi|mpeg|wma)$/i.test(name)) return "audio";
  if (name.endsWith(".txt")) return "text";
  return "markdown";
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
  if (type === "pdf" || type === "docx") return "Paste extracted text if local parsing cannot read the file.";
  if (type === "note") return "Write a note that should become a citable source.";
  return "Paste source text or markdown.";
}

function sourceStatusLine(source: Source) {
  if (source.status === "failed") return "Failed to index";
  if (source.status === "parsing") return "Indexing…";
  if (source.status === "pending") return "Pending";
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

function artifactIcon(type: ArtifactType) {
  return artifactTypes.find((artifact) => artifact.type === type)?.icon || <Sparkles size={18} />;
}

function artifactTitle(type: ArtifactType) {
  return artifactTypes.find((artifact) => artifact.type === type)?.title || type;
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
  const refs = artifact.source_refs_json?.length || 0;
  parts.push(`${refs} ${refs === 1 ? "source" : "sources"}`);
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
  const text = String(value ?? "");
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

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
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

function downloadSlug(input: string) {
  return String(input || "sourcestudio-notebook")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "sourcestudio-notebook";
}

function truncate(input: string, maxLength: number) {
  const clean = String(input || "").replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trim()}...` : clean;
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
