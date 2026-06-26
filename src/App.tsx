import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent, FormEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ClipboardList,
  Compass,
  Copy,
  Download,
  FileText,
  FolderOpen,
  GitBranch,
  GraduationCap,
  Images,
  Library,
  Link2,
  MessageSquareText,
  MoreHorizontal,
  NotebookPen,
  PanelLeft,
  Pause,
  Play,
  Plus,
  Presentation,
  Search,
  Send,
  Settings2,
  Share2,
  Sparkles,
  StickyNote,
  Target,
  Trash2,
  UploadCloud,
  UserRound,
  Video,
  X,
} from "lucide-react";

type SourceKind =
  | "doc"
  | "pdf"
  | "url"
  | "youtube"
  | "text"
  | "slide"
  | "ebook"
  | "image";

type ChatRole = "assistant" | "user";
type MobilePanel = "sources" | "chat" | "studio";
type AddMode = "upload" | "paste" | "link" | "discover";
type UtilityModal = "navigation" | "share" | "notebook" | "studio" | null;
type ArtifactKind =
  | "audio"
  | "video"
  | "mindmap"
  | "report"
  | "flashcards"
  | "quiz"
  | "infographic";

type ArtifactStatus = "ready" | "draft";

interface Source {
  id: string;
  title: string;
  kind: SourceKind;
  body: string;
  createdAt: number;
  selected: boolean;
  accent: string;
}

interface Citation {
  index: number;
  sourceId: string;
  sourceTitle: string;
  quote: string;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  citations?: Citation[];
  provider?: string;
  model?: string;
  mode?: "llm" | "local";
}

interface Artifact {
  id: string;
  kind: ArtifactKind;
  title: string;
  subtitle: string;
  body: string;
  createdAt: number;
  sourceCount: number;
  status: ArtifactStatus;
  provider?: string;
  model?: string;
}

interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  pinned?: boolean;
}

interface RankedSnippet {
  source: Source;
  text: string;
  score: number;
}

interface LlmHealth {
  configured: boolean;
  provider: string;
  model: string;
}

interface ApiChatResponse {
  content: string;
  citations?: Citation[];
  provider?: string;
  model?: string;
}

interface ApiArtifactResponse {
  title?: string;
  subtitle?: string;
  body: string;
  provider?: string;
  model?: string;
}

interface ApiDiscoverResponse {
  sources: Array<{
    title: string;
    kind: SourceKind;
    body: string;
  }>;
  provider?: string;
  model?: string;
}

const ACCENTS = [
  "#4285f4",
  "#34a853",
  "#fbbc04",
  "#ea4335",
  "#7e57c2",
  "#00acc1",
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "of",
  "on",
  "or",
  "our",
  "the",
  "this",
  "to",
  "was",
  "we",
  "what",
  "when",
  "where",
  "which",
  "with",
  "you",
]);

const sampleSources: Source[] = [
  {
    id: "source-release-brief",
    title: "Notebook research workspace brief",
    kind: "doc",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    selected: true,
    accent: ACCENTS[0],
    body: `NotebookLM-style research workspaces are organized around three core activities: collecting sources, asking grounded questions, and generating new study or communication assets.

Sources can include documents, links, video transcripts, ebooks, slides, and notes. Users expect to select which sources are active for a chat so the answer stays grounded in the right material.

The chat experience should clearly show when an answer is based on sources. Citations are critical because researchers need to inspect the exact evidence before trusting a summary or using it in finished work.

The Studio surface turns selected sources into artifacts such as audio overviews, video overviews, mind maps, reports, study guides, flashcards, quizzes, slide decks, and infographics. Multiple outputs of the same type should be stored for later review.

Long-term projects benefit from saved conversation history, reusable notes, and configurable chat goals. A project may need a tutor, analyst, editor, debate partner, or briefing assistant depending on the moment.`,
  },
  {
    id: "source-interviews",
    title: "Customer interview synthesis",
    kind: "text",
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
    selected: true,
    accent: ACCENTS[1],
    body: `Interviewees described the best research tools as calm, dense, and easy to scan. They want the left side to hold source management, the center to preserve the conversation, and the right side to collect outputs without interrupting the main task.

The most repeated frustration was uncertainty. Users do not want a generic chatbot that answers from memory. They want a clear source count, obvious citations, and a fast way to open the original material.

Teams asked for share controls, stable project history, output export, and a way to create several versions of the same artifact. A product manager might create a short report for executives and a longer study guide for the product team from the same source collection.

Students wanted flashcards and quizzes that remember progress across sessions. Analysts wanted mind maps to reveal relationships across dense PDFs and transcripts. Content teams wanted infographics and presentations with quick revision instructions.`,
  },
  {
    id: "source-video",
    title: "Design review meeting transcript",
    kind: "youtube",
    createdAt: Date.now() - 1000 * 60 * 28,
    selected: true,
    accent: ACCENTS[2],
    body: `The design review opened with a reminder that the app should feel like a working surface, not a marketing page. The first screen should be the product: sources, chat, and studio visible together on desktop.

The team agreed to keep the visual system close to modern Material patterns: soft panels, clear borders, rounded controls, compact density, and color used for status or source identity. Oversized hero content was rejected because the target user is already inside a research workflow.

For responsiveness, the three-panel desktop layout should become a tabbed mobile workspace. The active tab should preserve context and avoid forcing users to reload or lose draft questions.

The review also called out trust details: every generated answer needs an AI or local-generation disclosure, and destructive actions need clear labels. Empty states should offer direct actions rather than explaining the whole product.`,
  },
];

const initialMessages: ChatMessage[] = [
  {
    id: "message-welcome",
    role: "assistant",
    createdAt: Date.now() - 1000 * 60 * 10,
    content:
      "Select sources on the left, ask a question in the center, and create outputs in Studio. Answers in this clone are generated locally from selected source text and include citations when matching evidence is found.",
  },
];

const initialArtifacts: Artifact[] = [
  {
    id: "artifact-briefing",
    kind: "report",
    title: "Workspace briefing",
    subtitle: "Generated from 3 selected sources",
    createdAt: Date.now() - 1000 * 60 * 7,
    sourceCount: 3,
    status: "ready",
    body: `# Workspace briefing

The research workspace should prioritize grounded answers, visible source control, and reusable outputs.

Key points:
- Keep Sources, Chat, and Studio visible together on desktop.
- Make citations and selected source count impossible to miss.
- Store multiple outputs per artifact type for long-running projects.
- Treat mobile as a tabbed workspace rather than a reduced landing page.

Recommended next step: test the upload and chat loop with a dense source collection.`,
  },
];

const initialNotes: Note[] = [
  {
    id: "note-source-grounding",
    title: "Source grounding",
    createdAt: Date.now() - 1000 * 60 * 22,
    pinned: true,
    body: "Answers should show the selected source count and citations so the user can inspect the evidence before trusting a generated summary.",
  },
];

const sourceKindConfig: Record<
  SourceKind,
  { label: string; icon: LucideIcon }
> = {
  doc: { label: "Doc", icon: FileText },
  pdf: { label: "PDF", icon: FileText },
  url: { label: "Website", icon: Link2 },
  youtube: { label: "Video", icon: Video },
  text: { label: "Text", icon: NotebookPen },
  slide: { label: "Slides", icon: Presentation },
  ebook: { label: "EPUB", icon: BookOpen },
  image: { label: "Image", icon: Images },
};

const artifactConfig: Record<
  ArtifactKind,
  {
    title: string;
    action: string;
    description: string;
    icon: LucideIcon;
  }
> = {
  audio: {
    title: "Audio Overview",
    action: "Generate",
    description: "Podcast-style discussion with playable controls.",
    icon: AudioLines,
  },
  video: {
    title: "Video Overview",
    action: "Generate",
    description: "Narrated visual outline with scenes and chapters.",
    icon: Video,
  },
  mindmap: {
    title: "Mind Map",
    action: "Create",
    description: "Relationship map from selected source themes.",
    icon: GitBranch,
  },
  report: {
    title: "Report",
    action: "Write",
    description: "Briefing doc, study guide, or analysis summary.",
    icon: ClipboardList,
  },
  flashcards: {
    title: "Flashcards",
    action: "Build",
    description: "Question and answer cards that track review.",
    icon: GraduationCap,
  },
  quiz: {
    title: "Quiz",
    action: "Build",
    description: "Multiple-choice checks based on your material.",
    icon: Check,
  },
  infographic: {
    title: "Infographic",
    action: "Draft",
    description: "Visual summary in structured content blocks.",
    icon: Images,
  },
};

const promptSuggestions = [
  "Summarize the selected sources with citations",
  "What should I create in Studio first?",
  "Where do the sources disagree?",
  "Turn this into a study plan",
];

function App() {
  const [notebookTitle, setNotebookTitle] = useState("Customer discovery sprint");
  const [sources, setSources] = useState<Source[]>(sampleSources);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [artifacts, setArtifacts] = useState<Artifact[]>(initialArtifacts);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [activeSourceId, setActiveSourceId] = useState(sampleSources[0].id);
  const [activeArtifactId, setActiveArtifactId] = useState(initialArtifacts[0].id);
  const [question, setQuestion] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("upload");
  const [isConfigureOpen, setIsConfigureOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("chat");
  const [chatGoal, setChatGoal] = useState(
    "Act as a research partner. Prioritize concise answers with citations.",
  );
  const [chatPersona, setChatPersona] = useState("Research analyst");
  const [answerStyle, setAnswerStyle] = useState("Balanced");
  const [quickNote, setQuickNote] = useState("");
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [utilityModal, setUtilityModal] = useState<UtilityModal>(null);
  const [llmHealth, setLlmHealth] = useState<LlmHealth | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [generatingKind, setGeneratingKind] = useState<ArtifactKind | null>(null);
  const [toast, setToast] = useState("");
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/health")
      .then((response) => response.json())
      .then((health: LlmHealth) => {
        if (isMounted) setLlmHealth(health);
      })
      .catch(() => {
        if (isMounted) {
          setLlmHealth({ configured: false, provider: "Claude", model: "unavailable" });
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectedSources = useMemo(
    () => sources.filter((source) => source.selected),
    [sources],
  );

  const activeSource = useMemo(
    () => sources.find((source) => source.id === activeSourceId) ?? sources[0],
    [activeSourceId, sources],
  );

  const filteredSources = useMemo(() => {
    const query = sourceSearch.trim().toLowerCase();
    if (!query) return sources;
    return sources.filter((source) => {
      return (
        source.title.toLowerCase().includes(query) ||
        source.body.toLowerCase().includes(query) ||
        sourceKindConfig[source.kind].label.toLowerCase().includes(query)
      );
    });
  }, [sourceSearch, sources]);

  const activeArtifact = useMemo(
    () =>
      artifacts.find((artifact) => artifact.id === activeArtifactId) ??
      artifacts[0],
    [activeArtifactId, artifacts],
  );

  const selectedWordCount = useMemo(
    () =>
      selectedSources.reduce(
        (total, source) => total + countWords(source.body),
        0,
      ),
    [selectedSources],
  );

  const handleToggleSource = (sourceId: string) => {
    setSources((currentSources) =>
      currentSources.map((source) =>
        source.id === sourceId
          ? { ...source, selected: !source.selected }
          : source,
      ),
    );
  };

  const handleSelectAllSources = () => {
    const shouldSelectAll = selectedSources.length !== sources.length;
    setSources((currentSources) =>
      currentSources.map((source) => ({
        ...source,
        selected: shouldSelectAll,
      })),
    );
  };

  const handleDeleteSource = (sourceId: string) => {
    setSources((currentSources) => {
      const nextSources = currentSources.filter((source) => source.id !== sourceId);
      if (activeSourceId === sourceId && nextSources.length) {
        setActiveSourceId(nextSources[0].id);
      }
      return nextSources;
    });
  };

  const handleAddSources = (incomingSources: Source[]) => {
    if (!incomingSources.length) return;
    setSources((currentSources) => [...incomingSources, ...currentSources]);
    setActiveSourceId(incomingSources[0].id);
    setIsAddOpen(false);
    setMobilePanel("sources");
  };

  const handleAsk = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion || isAsking) return;

    const userMessage: ChatMessage = {
      id: makeId("message"),
      role: "user",
      content: cleanQuestion,
      createdAt: Date.now(),
    };

    const priorMessages = messages;
    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setQuestion("");
    setMobilePanel("chat");
    setIsAsking(true);

    try {
      const response = await askClaudeForAnswer({
        question: cleanQuestion,
        selectedSources,
        chatGoal,
        chatPersona,
        answerStyle,
        history: priorMessages,
      });
      const assistantMessage: ChatMessage = {
        id: makeId("message"),
        role: "assistant",
        content: response.content,
        citations: response.citations,
        provider: response.provider,
        model: response.model,
        mode: "llm",
        createdAt: Date.now(),
      };
      setMessages((currentMessages) => [...currentMessages, assistantMessage]);
    } catch (error) {
      const generated = createGroundedResponse(
        cleanQuestion,
        selectedSources,
        chatGoal,
        chatPersona,
        answerStyle,
      );
      const assistantMessage: ChatMessage = {
        id: makeId("message"),
        role: "assistant",
        content: `${generated.content}\n\nLLM status: ${getErrorMessage(error)} The local grounded fallback answered from selected source snippets.`,
        citations: generated.citations,
        provider: "Local fallback",
        mode: "local",
        createdAt: Date.now(),
      };
      setMessages((currentMessages) => [...currentMessages, assistantMessage]);
      setToast("Claude was unavailable; local fallback used.");
    } finally {
      setIsAsking(false);
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setQuestion(suggestion);
  };

  const handleGenerateArtifact = async (kind: ArtifactKind) => {
    if (generatingKind) return;
    setGeneratingKind(kind);
    setMobilePanel("studio");
    const title = `${artifactConfig[kind].title} ${artifacts.length + 1}`;
    try {
      const response = await createClaudeArtifact({
        kind,
        title,
        selectedSources,
        notes,
      });
      const artifact: Artifact = {
        id: makeId("artifact"),
        kind,
        title: response.title || title,
        subtitle:
          response.subtitle ||
          `Generated by ${response.provider || "Claude"} from ${selectedSources.length} selected source${selectedSources.length === 1 ? "" : "s"}`,
        sourceCount: selectedSources.length,
        body: response.body,
        status: "ready",
        provider: response.provider,
        model: response.model,
        createdAt: Date.now(),
      };
      setArtifacts((currentArtifacts) => [artifact, ...currentArtifacts]);
      setActiveArtifactId(artifact.id);
      setToast(`${artifactConfig[kind].title} generated with Claude.`);
    } catch (error) {
      const artifact = {
        ...createArtifact(kind, selectedSources, artifacts.length + 1),
        subtitle: `Local fallback; Claude error: ${getErrorMessage(error)}`,
        provider: "Local fallback",
      };
      setArtifacts((currentArtifacts) => [artifact, ...currentArtifacts]);
      setActiveArtifactId(artifact.id);
      setToast("Claude was unavailable; local artifact fallback used.");
    } finally {
      setGeneratingKind(null);
    }
  };

  const handleSaveMessageAsNote = (message: ChatMessage) => {
    const newNote: Note = {
      id: makeId("note"),
      title: "Saved chat answer",
      body: message.content,
      createdAt: Date.now(),
      pinned: false,
    };
    setNotes((currentNotes) => [newNote, ...currentNotes]);
    setMobilePanel("studio");
    setToast("Saved answer to notes.");
  };

  const handleAddQuickNote = () => {
    const body = quickNote.trim();
    if (!body) return;
    const firstLine = body.split("\n")[0] || "Untitled note";
    const note: Note = {
      id: makeId("note"),
      title: truncate(firstLine, 44),
      body,
      createdAt: Date.now(),
    };
    setNotes((currentNotes) => [note, ...currentNotes]);
    setQuickNote("");
    setToast("Note added.");
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== noteId));
    setToast("Note deleted.");
  };

  const handleDiscoverSources = async (topic: string) => {
    try {
      const response = await discoverClaudeSources(topic);
      const nextSources = response.sources.map((source) =>
        buildSource({
          title: source.title,
          body: source.body,
          kind: source.kind,
        }),
      );
      handleAddSources(nextSources);
      setToast(`Claude discovered ${nextSources.length} starter sources.`);
    } catch (error) {
      const nextSources = createDiscoveredSources(topic);
      handleAddSources(nextSources);
      setToast(`Claude discovery failed; local starter sources added. ${getErrorMessage(error)}`);
    }
  };

  const handleNewNotebook = () => {
    const now = Date.now();
    setNotebookTitle("Untitled notebook");
    setSources([]);
    setMessages([
      {
        id: "message-welcome-new",
        role: "assistant",
        createdAt: now,
        content:
          "New notebook created. Add sources first, then ask questions or generate Studio outputs.",
      },
    ]);
    setArtifacts([]);
    setNotes([]);
    setActiveSourceId("");
    setActiveArtifactId("");
    setUtilityModal(null);
    setToast("New notebook created.");
  };

  const handleDuplicateNotebook = () => {
    setNotebookTitle(`${notebookTitle} copy`);
    setUtilityModal(null);
    setToast("Notebook duplicated as a local copy.");
  };

  const handleClearChat = () => {
    setMessages(initialMessages);
    setUtilityModal(null);
    setToast("Chat history cleared.");
  };

  const handleClearArtifacts = () => {
    setArtifacts([]);
    setActiveArtifactId("");
    setUtilityModal(null);
    setToast("Studio outputs cleared.");
  };

  const handleCopy = async (text: string, successMessage: string) => {
    const copied = await copyToClipboard(text);
    setToast(copied ? successMessage : "Copy failed; browser denied clipboard access.");
  };

  const handleToggleAudio = () => {
    if (!activeArtifact) return;
    if (!("speechSynthesis" in window)) {
      setToast("Speech playback is not supported in this browser.");
      return;
    }

    if (isAudioPlaying) {
      window.speechSynthesis.cancel();
      speechRef.current = null;
      setIsAudioPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      activeArtifact.body.replace(/[#*_`>-]/g, " ").replace(/\s+/g, " ").slice(0, 12000),
    );
    utterance.rate = 0.96;
    utterance.onend = () => setIsAudioPlaying(false);
    utterance.onerror = () => {
      setIsAudioPlaying(false);
      setToast("Audio playback failed.");
    };
    speechRef.current = utterance;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsAudioPlaying(true);
  };

  return (
    <div className="app-shell">
      <TopBar
        title={notebookTitle}
        selectedCount={selectedSources.length}
        totalSources={sources.length}
        llmHealth={llmHealth}
        onNavigation={() => setUtilityModal("navigation")}
        onNotebookMenu={() => setUtilityModal("notebook")}
        onShare={() => setUtilityModal("share")}
        onConfigure={() => setIsConfigureOpen(true)}
      />

      <main className="workspace" data-active-panel={mobilePanel}>
        <SourcePanel
          sources={filteredSources}
          allSources={sources}
          activeSource={activeSource}
          selectedCount={selectedSources.length}
          selectedWordCount={selectedWordCount}
          search={sourceSearch}
          onSearch={setSourceSearch}
          onAdd={() => {
            setAddMode("upload");
            setIsAddOpen(true);
          }}
          onDiscover={() => {
            setAddMode("discover");
            setIsAddOpen(true);
          }}
          onSelectAll={handleSelectAllSources}
          onOpenSource={setActiveSourceId}
          onToggleSource={handleToggleSource}
          onDeleteSource={handleDeleteSource}
        />

        <ChatPanel
          messages={messages}
          question={question}
          selectedSources={selectedSources}
          chatGoal={chatGoal}
          answerStyle={answerStyle}
          isAsking={isAsking}
          onQuestionChange={setQuestion}
          onSubmit={handleAsk}
          onSuggestion={handleSuggestion}
          onConfigure={() => setIsConfigureOpen(true)}
          onSaveNote={handleSaveMessageAsNote}
          onCopy={handleCopy}
        />

        <StudioPanel
          artifacts={artifacts}
          activeArtifact={activeArtifact}
          notes={notes}
          selectedCount={selectedSources.length}
          quickNote={quickNote}
          isAudioPlaying={isAudioPlaying}
          generatingKind={generatingKind}
          onGenerate={handleGenerateArtifact}
          onSelectArtifact={setActiveArtifactId}
          onQuickNoteChange={setQuickNote}
          onAddQuickNote={handleAddQuickNote}
          onDeleteNote={handleDeleteNote}
          onToggleAudio={handleToggleAudio}
          onOpenStudioMenu={() => setUtilityModal("studio")}
          onCopy={handleCopy}
        />
      </main>

      <MobileTabs activePanel={mobilePanel} onChange={setMobilePanel} />

      {isAddOpen ? (
        <AddSourceModal
          mode={addMode}
          onModeChange={setAddMode}
          onClose={() => setIsAddOpen(false)}
          onAddSources={handleAddSources}
          onDiscoverSources={handleDiscoverSources}
        />
      ) : null}

      {isConfigureOpen ? (
        <ConfigureChatModal
          goal={chatGoal}
          persona={chatPersona}
          answerStyle={answerStyle}
          onGoalChange={setChatGoal}
          onPersonaChange={setChatPersona}
          onAnswerStyleChange={setAnswerStyle}
          onClose={() => setIsConfigureOpen(false)}
        />
      ) : null}

      {utilityModal === "navigation" ? (
        <NavigationModal
          title={notebookTitle}
          sources={sources}
          artifacts={artifacts}
          notes={notes}
          onNewNotebook={handleNewNotebook}
          onExport={() => {
            downloadNotebook({ title: notebookTitle, sources, messages, artifacts, notes });
            setToast("Notebook exported.");
          }}
          onClose={() => setUtilityModal(null)}
        />
      ) : null}

      {utilityModal === "share" ? (
        <ShareModal
          shareUrl={createShareUrl(notebookTitle)}
          onCopy={(text) => handleCopy(text, "Share link copied.")}
          onExport={() => {
            downloadNotebook({ title: notebookTitle, sources, messages, artifacts, notes });
            setToast("Notebook export downloaded.");
          }}
          onClose={() => setUtilityModal(null)}
        />
      ) : null}

      {utilityModal === "notebook" ? (
        <NotebookMenuModal
          title={notebookTitle}
          onTitleChange={setNotebookTitle}
          onDuplicate={handleDuplicateNotebook}
          onClearChat={handleClearChat}
          onClose={() => setUtilityModal(null)}
        />
      ) : null}

      {utilityModal === "studio" ? (
        <StudioMenuModal
          artifactCount={artifacts.length}
          onExport={() => {
            downloadArtifacts(artifacts);
            setToast("Studio outputs exported.");
          }}
          onClear={handleClearArtifacts}
          onClose={() => setUtilityModal(null)}
        />
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}

interface TopBarProps {
  title: string;
  selectedCount: number;
  totalSources: number;
  llmHealth: LlmHealth | null;
  onNavigation: () => void;
  onNotebookMenu: () => void;
  onShare: () => void;
  onConfigure: () => void;
}

function TopBar({
  title,
  selectedCount,
  totalSources,
  llmHealth,
  onNavigation,
  onNotebookMenu,
  onShare,
  onConfigure,
}: TopBarProps) {
  const llmLabel = !llmHealth
    ? "Checking Claude"
    : llmHealth.configured
      ? `${llmHealth.provider} connected`
      : `${llmHealth.provider} not configured`;

  return (
    <header className="topbar">
      <div className="brand-cluster">
        <button className="icon-button brand-menu" type="button" onClick={onNavigation} aria-label="Open navigation">
          <PanelLeft size={20} />
        </button>
        <div className="brand-mark" aria-hidden="true">
          <span />
        </div>
        <div>
          <p className="brand-eyebrow">Notebook</p>
          <h1>{title}</h1>
        </div>
        <button className="title-button" type="button" onClick={onNotebookMenu} aria-label="Notebook menu">
          <ChevronDown size={16} />
        </button>
      </div>

      <div className="topbar-status" aria-label="Notebook status">
        <span className="status-pill">
          <Library size={15} />
          {selectedCount}/{totalSources} sources
        </span>
        <span className="status-pill success" title={llmHealth?.model}>
          <Sparkles size={15} />
          {llmLabel}
        </span>
      </div>

      <div className="topbar-actions">
        <button className="ghost-button" type="button" onClick={onConfigure}>
          <Settings2 size={17} />
          Configure
        </button>
        <button className="primary-button" type="button" onClick={onShare}>
          <Share2 size={17} />
          Share
        </button>
      </div>
    </header>
  );
}

interface SourcePanelProps {
  sources: Source[];
  allSources: Source[];
  activeSource?: Source;
  selectedCount: number;
  selectedWordCount: number;
  search: string;
  onSearch: (search: string) => void;
  onAdd: () => void;
  onDiscover: () => void;
  onSelectAll: () => void;
  onOpenSource: (sourceId: string) => void;
  onToggleSource: (sourceId: string) => void;
  onDeleteSource: (sourceId: string) => void;
}

function SourcePanel({
  sources,
  allSources,
  activeSource,
  selectedCount,
  selectedWordCount,
  search,
  onSearch,
  onAdd,
  onDiscover,
  onSelectAll,
  onOpenSource,
  onToggleSource,
  onDeleteSource,
}: SourcePanelProps) {
  return (
    <section className="panel source-panel" aria-label="Sources panel">
      <PanelHeader
        icon={Library}
        title="Sources"
        count={allSources.length}
        action={
          <button className="icon-button filled" type="button" onClick={onAdd} aria-label="Add source">
            <Plus size={18} />
          </button>
        }
      />

      <div className="source-metrics">
        <div>
          <strong>{selectedCount}</strong>
          <span>selected</span>
        </div>
        <div>
          <strong>{formatNumber(selectedWordCount)}</strong>
          <span>words</span>
        </div>
      </div>

      <div className="source-actions">
        <button className="secondary-button" type="button" onClick={onAdd}>
          <UploadCloud size={16} />
          Add
        </button>
        <button className="secondary-button" type="button" onClick={onDiscover}>
          <Compass size={16} />
          Discover
        </button>
      </div>

      <label className="search-box">
        <Search size={17} />
        <input
          value={search}
          placeholder="Search sources"
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>

      <div className="source-list-toolbar">
        <span>All sources</span>
        <button type="button" onClick={onSelectAll}>
          {selectedCount === allSources.length ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="source-list">
        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            isActive={activeSource?.id === source.id}
            onOpen={() => onOpenSource(source.id)}
            onToggle={() => onToggleSource(source.id)}
            onDelete={() => onDeleteSource(source.id)}
          />
        ))}
        {!sources.length ? (
          <div className="empty-compact">
            <FileText size={28} />
            <p>No matching sources.</p>
          </div>
        ) : null}
      </div>

      {activeSource ? (
        <article className="source-viewer">
          <div className="source-viewer-top">
            <div>
              <p>{sourceKindConfig[activeSource.kind].label}</p>
              <h3>{activeSource.title}</h3>
            </div>
            <span
              className="source-accent"
              style={{ backgroundColor: activeSource.accent }}
            />
          </div>
          <p>{truncate(activeSource.body, 520)}</p>
        </article>
      ) : null}
    </section>
  );
}

interface SourceCardProps {
  source: Source;
  isActive: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function SourceCard({
  source,
  isActive,
  onOpen,
  onToggle,
  onDelete,
}: SourceCardProps) {
  const Icon = sourceKindConfig[source.kind].icon;
  return (
    <article
      className="source-card"
      data-active={isActive}
      style={{ "--source-color": source.accent } as CSSProperties}
    >
      <button
        className="source-check"
        type="button"
        data-selected={source.selected}
        onClick={onToggle}
        aria-label={source.selected ? "Deselect source" : "Select source"}
      >
        {source.selected ? <Check size={13} /> : null}
      </button>
      <button className="source-card-main" type="button" onClick={onOpen}>
        <span className="source-icon">
          <Icon size={17} />
        </span>
        <span>
          <strong>{source.title}</strong>
          <small>
            {sourceKindConfig[source.kind].label} · {formatNumber(countWords(source.body))} words
          </small>
        </span>
      </button>
      <button
        className="icon-button subtle"
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${source.title}`}
      >
        <Trash2 size={15} />
      </button>
    </article>
  );
}

interface ChatPanelProps {
  messages: ChatMessage[];
  question: string;
  selectedSources: Source[];
  chatGoal: string;
  answerStyle: string;
  isAsking: boolean;
  onQuestionChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSuggestion: (suggestion: string) => void;
  onConfigure: () => void;
  onSaveNote: (message: ChatMessage) => void;
  onCopy: (text: string, successMessage: string) => void;
}

function ChatPanel({
  messages,
  question,
  selectedSources,
  chatGoal,
  answerStyle,
  isAsking,
  onQuestionChange,
  onSubmit,
  onSuggestion,
  onConfigure,
  onSaveNote,
  onCopy,
}: ChatPanelProps) {
  return (
    <section className="panel chat-panel" aria-label="Chat panel">
      <div className="chat-toolbar">
        <div>
          <p className="panel-eyebrow">Chat</p>
          <h2>Ask your sources</h2>
        </div>
        <button className="ghost-button compact" type="button" onClick={onConfigure}>
          <Target size={16} />
          Goal
        </button>
      </div>

      <div className="chat-context">
        <span className="context-chip">
          <Library size={15} />
          {selectedSources.length} selected sources
        </span>
        <span className="context-chip">
          <MessageSquareText size={15} />
          {answerStyle}
        </span>
        <span className="context-chip wide" title={chatGoal}>
          <Target size={15} />
          {truncate(chatGoal, 58)}
        </span>
      </div>

      <div className="messages" role="log" aria-live="polite">
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            onSaveNote={() => onSaveNote(message)}
            onCopy={() => onCopy(message.content, "Answer copied.")}
          />
        ))}
      </div>

      <div className="prompt-suggestions" aria-label="Suggested prompts">
        {promptSuggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSuggestion(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form className="chat-input" onSubmit={onSubmit}>
        <textarea
          value={question}
          placeholder="Ask anything about your selected sources..."
          rows={1}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              const form = event.currentTarget.form;
              form?.requestSubmit();
            }
          }}
        />
        <button
          className="send-button"
          type="submit"
          disabled={!question.trim() || isAsking}
          aria-label="Send message"
        >
          {isAsking ? <Sparkles size={18} /> : <Send size={18} />}
        </button>
      </form>

      <p className="ai-disclaimer">
        Claude answers are grounded in selected sources. If the API is unavailable,
        a local source-matched fallback keeps the notebook usable.
      </p>
    </section>
  );
}

interface ChatBubbleProps {
  message: ChatMessage;
  onSaveNote: () => void;
  onCopy: () => void;
}

function ChatBubble({ message, onSaveNote, onCopy }: ChatBubbleProps) {
  const isAssistant = message.role === "assistant";
  const Icon = isAssistant ? Bot : UserRound;

  return (
    <article className="chat-bubble" data-role={message.role}>
      <div className="avatar" aria-hidden="true">
        <Icon size={18} />
      </div>
      <div className="bubble-body">
        <div className="bubble-topline">
          <span>{isAssistant ? message.provider || "Notebook" : "You"}</span>
          <time>{formatRelativeTime(message.createdAt)}</time>
        </div>
        <FormattedText text={message.content} />
        {message.citations?.length ? (
          <div className="citation-list" aria-label="Citations">
            {message.citations.map((citation) => (
              <div className="citation-card" key={`${message.id}-${citation.index}`}>
                <span>{citation.index}</span>
                <div>
                  <strong>{citation.sourceTitle}</strong>
                  <p>{citation.quote}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {isAssistant && message.id !== "message-welcome" ? (
          <div className="bubble-actions">
            <button type="button" onClick={onSaveNote}>
              <StickyNote size={15} />
              Save to note
            </button>
            <button
              type="button"
              onClick={onCopy}
            >
              <Copy size={15} />
              Copy
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

interface StudioPanelProps {
  artifacts: Artifact[];
  activeArtifact?: Artifact;
  notes: Note[];
  selectedCount: number;
  quickNote: string;
  isAudioPlaying: boolean;
  generatingKind: ArtifactKind | null;
  onGenerate: (kind: ArtifactKind) => void;
  onSelectArtifact: (artifactId: string) => void;
  onQuickNoteChange: (value: string) => void;
  onAddQuickNote: () => void;
  onDeleteNote: (noteId: string) => void;
  onToggleAudio: () => void;
  onOpenStudioMenu: () => void;
  onCopy: (text: string, successMessage: string) => void;
}

function StudioPanel({
  artifacts,
  activeArtifact,
  notes,
  selectedCount,
  quickNote,
  isAudioPlaying,
  generatingKind,
  onGenerate,
  onSelectArtifact,
  onQuickNoteChange,
  onAddQuickNote,
  onDeleteNote,
  onToggleAudio,
  onOpenStudioMenu,
  onCopy,
}: StudioPanelProps) {
  const primaryTiles: ArtifactKind[] = ["audio", "video", "mindmap", "report"];
  const secondaryTiles: ArtifactKind[] = ["flashcards", "quiz", "infographic"];

  return (
    <section className="panel studio-panel" aria-label="Studio panel">
      <PanelHeader
        icon={Sparkles}
        title="Studio"
        count={artifacts.length}
        action={
          <button className="icon-button subtle" type="button" onClick={onOpenStudioMenu} aria-label="Studio menu">
            <MoreHorizontal size={18} />
          </button>
        }
      />

      <div className="studio-source-banner">
        <Sparkles size={17} />
        <div>
          <strong>{selectedCount || "No"} selected sources</strong>
          <span>Generate new outputs from the active source set.</span>
        </div>
      </div>

      <div className="studio-grid primary">
        {primaryTiles.map((kind) => (
          <StudioTile key={kind} kind={kind} loading={generatingKind === kind} disabled={Boolean(generatingKind)} onGenerate={onGenerate} />
        ))}
      </div>

      <div className="studio-grid secondary">
        {secondaryTiles.map((kind) => (
          <StudioTile key={kind} kind={kind} loading={generatingKind === kind} disabled={Boolean(generatingKind)} onGenerate={onGenerate} compact />
        ))}
      </div>

      <div className="artifact-section">
        <div className="section-heading">
          <h3>Generated outputs</h3>
          <span>{artifacts.length}</span>
        </div>

        {activeArtifact ? (
          <ArtifactPreview
            artifact={activeArtifact}
            isAudioPlaying={isAudioPlaying}
            onToggleAudio={onToggleAudio}
            onCopy={() => onCopy(activeArtifact.body, "Artifact copied.")}
          />
        ) : (
          <div className="empty-compact">
            <Sparkles size={28} />
            <p>Create an output to preview it here.</p>
          </div>
        )}

        <div className="artifact-list">
          {artifacts.map((artifact) => (
            <button
              key={artifact.id}
              className="artifact-row"
              data-active={artifact.id === activeArtifact?.id}
              type="button"
              onClick={() => onSelectArtifact(artifact.id)}
            >
              <ArtifactIcon kind={artifact.kind} />
              <span>
                <strong>{artifact.title}</strong>
                <small>{artifact.subtitle}</small>
              </span>
              <time>{formatRelativeTime(artifact.createdAt)}</time>
            </button>
          ))}
        </div>
      </div>

      <div className="notes-section">
        <div className="section-heading">
          <h3>Notes</h3>
          <span>{notes.length}</span>
        </div>
        <div className="quick-note">
          <textarea
            value={quickNote}
            rows={3}
            placeholder="Save a note..."
            onChange={(event) => onQuickNoteChange(event.target.value)}
          />
          <button type="button" onClick={onAddQuickNote} disabled={!quickNote.trim()}>
            <Plus size={16} />
            Add note
          </button>
        </div>
        <div className="note-list">
          {notes.map((note) => (
            <article className="note-card" key={note.id}>
              <div>
                <strong>{note.title}</strong>
                <time>{formatRelativeTime(note.createdAt)}</time>
              </div>
              <p>{truncate(note.body, 180)}</p>
              <button
                type="button"
                onClick={() => onDeleteNote(note.id)}
                aria-label={`Delete note ${note.title}`}
              >
                <Trash2 size={14} />
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

interface StudioTileProps {
  kind: ArtifactKind;
  compact?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onGenerate: (kind: ArtifactKind) => void;
}

function StudioTile({
  kind,
  compact = false,
  loading = false,
  disabled = false,
  onGenerate,
}: StudioTileProps) {
  const config = artifactConfig[kind];
  const Icon = config.icon;
  return (
    <button
      className="studio-tile"
      data-kind={kind}
      data-compact={compact}
      type="button"
      disabled={disabled}
      onClick={() => onGenerate(kind)}
    >
      <span className="studio-icon">
        {loading ? <Sparkles size={compact ? 18 : 21} /> : <Icon size={compact ? 18 : 21} />}
      </span>
      <span>
        <strong>{config.title}</strong>
        {!compact ? <small>{config.description}</small> : null}
      </span>
      <em>{loading ? "Generating" : config.action}</em>
    </button>
  );
}

interface ArtifactPreviewProps {
  artifact: Artifact;
  isAudioPlaying: boolean;
  onToggleAudio: () => void;
  onCopy: () => void;
}

function ArtifactPreview({
  artifact,
  isAudioPlaying,
  onToggleAudio,
  onCopy,
}: ArtifactPreviewProps) {
  return (
    <article className="artifact-preview" data-kind={artifact.kind}>
      <div className="artifact-preview-top">
        <div>
          <p>{artifactConfig[artifact.kind].title}</p>
          <h3>{artifact.title}</h3>
        </div>
        <span className="ready-pill">{artifact.status}</span>
      </div>

      {artifact.kind === "audio" ? (
        <div className="audio-player">
          <button type="button" onClick={onToggleAudio} aria-label="Play audio">
            {isAudioPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <div className="waveform" data-playing={isAudioPlaying}>
            {Array.from({ length: 28 }).map((_, index) => (
              <span key={index} style={{ "--bar": `${20 + (index % 7) * 7}%` } as CSSProperties} />
            ))}
          </div>
          <span>12:48</span>
        </div>
      ) : null}

      {artifact.kind === "video" ? (
        <div className="video-board">
          <div className="video-scene large" />
          <div className="video-scene" />
          <div className="video-scene accent" />
          <div className="video-caption">Scene outline</div>
        </div>
      ) : null}

      {artifact.kind === "mindmap" ? <MindMapGraphic /> : null}

      <FormattedText text={artifact.body} />

      <div className="artifact-actions">
        <button
          type="button"
          onClick={onCopy}
        >
          <Copy size={15} />
          Copy
        </button>
        <button type="button" onClick={() => downloadText(artifact)}>
          <Download size={15} />
          Export
        </button>
      </div>
    </article>
  );
}

function MindMapGraphic() {
  return (
    <div className="mind-map" aria-hidden="true">
      <span className="node root">Sources</span>
      <span className="node n1">Themes</span>
      <span className="node n2">Evidence</span>
      <span className="node n3">Outputs</span>
      <span className="node n4">Actions</span>
      <span className="link l1" />
      <span className="link l2" />
      <span className="link l3" />
      <span className="link l4" />
    </div>
  );
}

interface AddSourceModalProps {
  mode: AddMode;
  onModeChange: (mode: AddMode) => void;
  onClose: () => void;
  onAddSources: (sources: Source[]) => void;
  onDiscoverSources: (topic: string) => Promise<void>;
}

function AddSourceModal({
  mode,
  onModeChange,
  onClose,
  onAddSources,
  onDiscoverSources,
}: AddSourceModalProps) {
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkNotes, setLinkNotes] = useState("");
  const [discoverTopic, setDiscoverTopic] = useState("AI study tools");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addPastedSource = () => {
    const body = pasteText.trim();
    if (!body) return;
    onAddSources([
      buildSource({
        title: pasteTitle.trim() || "Pasted source",
        body,
        kind: "text",
      }),
    ]);
  };

  const addLinkSource = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const title = getReadableUrlTitle(url);
    onAddSources([
      buildSource({
        title,
        kind: inferKindFromUrl(url),
        body: `${url}

${linkNotes.trim() || "Imported linked source. Add notes here or paste page text for grounded chat."}`,
      }),
    ]);
  };

  const addDiscoveredSources = async () => {
    const topic = discoverTopic.trim() || "research topic";
    setIsDiscovering(true);
    await onDiscoverSources(topic);
    setIsDiscovering(false);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploadMessage(`Reading ${files.length} file${files.length === 1 ? "" : "s"}...`);
    const nextSources = await Promise.all(files.map(readFileAsSource));
    onAddSources(nextSources);
    setUploadMessage("");
  };

  return (
    <Modal title="Add sources" onClose={onClose}>
      <div className="modal-tabs" role="tablist" aria-label="Source add modes">
        <ModeTab icon={UploadCloud} label="Upload" mode="upload" active={mode} onClick={onModeChange} />
        <ModeTab icon={NotebookPen} label="Paste text" mode="paste" active={mode} onClick={onModeChange} />
        <ModeTab icon={Link2} label="Link" mode="link" active={mode} onClick={onModeChange} />
        <ModeTab icon={Compass} label="Discover" mode="discover" active={mode} onClick={onModeChange} />
      </div>

      {mode === "upload" ? (
        <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept=".txt,.md,.csv,.json,.html,.pdf,.doc,.docx,.epub,.ppt,.pptx"
            onChange={handleFileChange}
          />
          <UploadCloud size={34} />
          <strong>Upload sources</strong>
          <p>Choose documents, transcripts, text files, EPUBs, slides, or PDFs. Text-like files are read directly in the browser.</p>
          <button
            className="primary-button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Select files
          </button>
          {uploadMessage ? <small>{uploadMessage}</small> : null}
        </div>
      ) : null}

      {mode === "paste" ? (
        <div className="modal-form">
          <label>
            Title
            <input
              value={pasteTitle}
              placeholder="Example: Market research notes"
              onChange={(event) => setPasteTitle(event.target.value)}
            />
          </label>
          <label>
            Source text
            <textarea
              value={pasteText}
              rows={9}
              placeholder="Paste article text, notes, transcripts, or documents..."
              onChange={(event) => setPasteText(event.target.value)}
            />
          </label>
          <button
            className="primary-button"
            type="button"
            onClick={addPastedSource}
            disabled={!pasteText.trim()}
          >
            <Plus size={17} />
            Add source
          </button>
        </div>
      ) : null}

      {mode === "link" ? (
        <div className="modal-form">
          <label>
            URL
            <input
              value={linkUrl}
              placeholder="https://example.com/research"
              onChange={(event) => setLinkUrl(event.target.value)}
            />
          </label>
          <label>
            Notes or copied page text
            <textarea
              value={linkNotes}
              rows={7}
              placeholder="Browser security may block direct page extraction. Paste important text here for grounded chat."
              onChange={(event) => setLinkNotes(event.target.value)}
            />
          </label>
          <button
            className="primary-button"
            type="button"
            onClick={addLinkSource}
            disabled={!linkUrl.trim()}
          >
            <Link2 size={17} />
            Add link
          </button>
        </div>
      ) : null}

      {mode === "discover" ? (
        <div className="modal-form">
          <label>
            Topic
            <input
              value={discoverTopic}
              placeholder="What do you want sources about?"
              onChange={(event) => setDiscoverTopic(event.target.value)}
            />
          </label>
          <div className="discover-preview">
            <Compass size={24} />
            <div>
              <strong>Claude source discovery</strong>
              <p>Asks Claude to create three research starter sources for the topic, then adds them to the notebook as selected sources.</p>
            </div>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={addDiscoveredSources}
            disabled={!discoverTopic.trim() || isDiscovering}
          >
            <Sparkles size={17} />
            {isDiscovering ? "Discovering..." : "Discover sources"}
          </button>
        </div>
      ) : null}
    </Modal>
  );
}

interface ConfigureChatModalProps {
  goal: string;
  persona: string;
  answerStyle: string;
  onGoalChange: (goal: string) => void;
  onPersonaChange: (persona: string) => void;
  onAnswerStyleChange: (style: string) => void;
  onClose: () => void;
}

function ConfigureChatModal({
  goal,
  persona,
  answerStyle,
  onGoalChange,
  onPersonaChange,
  onAnswerStyleChange,
  onClose,
}: ConfigureChatModalProps) {
  return (
    <Modal title="Configure chat" onClose={onClose}>
      <div className="modal-form">
        <label>
          Role
          <select value={persona} onChange={(event) => onPersonaChange(event.target.value)}>
            <option>Research analyst</option>
            <option>Study tutor</option>
            <option>Product strategist</option>
            <option>Executive briefer</option>
            <option>Skeptical reviewer</option>
          </select>
        </label>
        <label>
          Response style
          <select value={answerStyle} onChange={(event) => onAnswerStyleChange(event.target.value)}>
            <option>Balanced</option>
            <option>Concise</option>
            <option>Detailed</option>
            <option>Study guide</option>
            <option>Action-oriented</option>
          </select>
        </label>
        <label>
          Goal instructions
          <textarea
            value={goal}
            rows={6}
            onChange={(event) => onGoalChange(event.target.value)}
          />
        </label>
        <button className="primary-button" type="button" onClick={onClose}>
          <Check size={17} />
          Save
        </button>
      </div>
    </Modal>
  );
}

interface NavigationModalProps {
  title: string;
  sources: Source[];
  artifacts: Artifact[];
  notes: Note[];
  onNewNotebook: () => void;
  onExport: () => void;
  onClose: () => void;
}

function NavigationModal({
  title,
  sources,
  artifacts,
  notes,
  onNewNotebook,
  onExport,
  onClose,
}: NavigationModalProps) {
  return (
    <Modal title="Navigation" onClose={onClose}>
      <div className="modal-form">
        <div className="notebook-summary">
          <FolderOpen size={28} />
          <div>
            <strong>{title}</strong>
            <p>{sources.length} sources · {artifacts.length} outputs · {notes.length} notes</p>
          </div>
        </div>
        <div className="modal-action-grid">
          <button className="secondary-button" type="button" onClick={onNewNotebook}>
            <Plus size={17} />
            New notebook
          </button>
          <button className="secondary-button" type="button" onClick={onExport}>
            <Download size={17} />
            Export notebook
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface ShareModalProps {
  shareUrl: string;
  onCopy: (text: string) => void;
  onExport: () => void;
  onClose: () => void;
}

function ShareModal({ shareUrl, onCopy, onExport, onClose }: ShareModalProps) {
  return (
    <Modal title="Share notebook" onClose={onClose}>
      <div className="modal-form">
        <label>
          Share link
          <input value={shareUrl} readOnly />
        </label>
        <div className="modal-action-grid">
          <button className="primary-button" type="button" onClick={() => onCopy(shareUrl)}>
            <Copy size={17} />
            Copy link
          </button>
          <button className="secondary-button" type="button" onClick={onExport}>
            <Download size={17} />
            Export JSON
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface NotebookMenuModalProps {
  title: string;
  onTitleChange: (title: string) => void;
  onDuplicate: () => void;
  onClearChat: () => void;
  onClose: () => void;
}

function NotebookMenuModal({
  title,
  onTitleChange,
  onDuplicate,
  onClearChat,
  onClose,
}: NotebookMenuModalProps) {
  const [draftTitle, setDraftTitle] = useState(title);
  return (
    <Modal title="Notebook menu" onClose={onClose}>
      <div className="modal-form">
        <label>
          Notebook title
          <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
        </label>
        <div className="modal-action-grid">
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              onTitleChange(draftTitle.trim() || "Untitled notebook");
              onClose();
            }}
          >
            <Check size={17} />
            Save title
          </button>
          <button className="secondary-button" type="button" onClick={onDuplicate}>
            <Copy size={17} />
            Duplicate
          </button>
          <button className="secondary-button" type="button" onClick={onClearChat}>
            <Trash2 size={17} />
            Clear chat
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface StudioMenuModalProps {
  artifactCount: number;
  onExport: () => void;
  onClear: () => void;
  onClose: () => void;
}

function StudioMenuModal({
  artifactCount,
  onExport,
  onClear,
  onClose,
}: StudioMenuModalProps) {
  return (
    <Modal title="Studio menu" onClose={onClose}>
      <div className="modal-form">
        <div className="discover-preview">
          <Sparkles size={24} />
          <div>
            <strong>{artifactCount} generated outputs</strong>
            <p>Export generated artifacts or clear the Studio list for this local notebook.</p>
          </div>
        </div>
        <div className="modal-action-grid">
          <button className="secondary-button" type="button" onClick={onExport} disabled={!artifactCount}>
            <Download size={17} />
            Export outputs
          </button>
          <button className="secondary-button" type="button" onClick={onClear} disabled={!artifactCount}>
            <Trash2 size={17} />
            Clear outputs
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button subtle" type="button" onClick={onClose} aria-label="Close modal">
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

interface ModeTabProps {
  icon: LucideIcon;
  label: string;
  mode: AddMode;
  active: AddMode;
  onClick: (mode: AddMode) => void;
}

function ModeTab({ icon: Icon, label, mode, active, onClick }: ModeTabProps) {
  return (
    <button type="button" role="tab" aria-selected={mode === active} onClick={() => onClick(mode)}>
      <Icon size={16} />
      {label}
    </button>
  );
}

interface PanelHeaderProps {
  icon: LucideIcon;
  title: string;
  count?: number;
  action?: ReactNode;
}

function PanelHeader({ icon: Icon, title, count, action }: PanelHeaderProps) {
  return (
    <div className="panel-header">
      <div>
        <span className="panel-icon">
          <Icon size={18} />
        </span>
        <h2>{title}</h2>
        {typeof count === "number" ? <span className="count-badge">{count}</span> : null}
      </div>
      {action}
    </div>
  );
}

interface MobileTabsProps {
  activePanel: MobilePanel;
  onChange: (panel: MobilePanel) => void;
}

function MobileTabs({ activePanel, onChange }: MobileTabsProps) {
  const items: Array<{ panel: MobilePanel; label: string; icon: LucideIcon }> = [
    { panel: "sources", label: "Sources", icon: Library },
    { panel: "chat", label: "Chat", icon: MessageSquareText },
    { panel: "studio", label: "Studio", icon: Sparkles },
  ];

  return (
    <nav className="mobile-tabs" aria-label="Workspace panels">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.panel}
            type="button"
            data-active={activePanel === item.panel}
            onClick={() => onChange(item.panel)}
          >
            <Icon size={18} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function ArtifactIcon({ kind }: { kind: ArtifactKind }) {
  const Icon = artifactConfig[kind].icon;
  return (
    <span className="artifact-icon" data-kind={kind}>
      <Icon size={17} />
    </span>
  );
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="formatted-text">
      {lines.map((line, index) => {
        const cleanLine = line.trim();
        if (!cleanLine) return <br key={index} />;
        if (cleanLine.startsWith("# ")) {
          return <h4 key={index}>{cleanLine.replace("# ", "")}</h4>;
        }
        if (cleanLine.startsWith("- ")) {
          return <p className="bullet-line" key={index}>{cleanLine}</p>;
        }
        return <p key={index}>{cleanLine}</p>;
      })}
    </div>
  );
}

async function askClaudeForAnswer(payload: {
  question: string;
  selectedSources: Source[];
  chatGoal: string;
  chatPersona: string;
  answerStyle: string;
  history: ChatMessage[];
}): Promise<ApiChatResponse> {
  return postJson<ApiChatResponse>("/api/chat", {
    question: payload.question,
    selectedSources: payload.selectedSources.map(toApiSource),
    chatGoal: payload.chatGoal,
    chatPersona: payload.chatPersona,
    answerStyle: payload.answerStyle,
    history: payload.history
      .filter((message) => message.id !== "message-welcome")
      .map((message) => ({
        role: message.role,
        content: message.content,
      })),
  });
}

async function createClaudeArtifact(payload: {
  kind: ArtifactKind;
  title: string;
  selectedSources: Source[];
  notes: Note[];
}): Promise<ApiArtifactResponse> {
  return postJson<ApiArtifactResponse>("/api/artifact", {
    kind: payload.kind,
    title: payload.title,
    selectedSources: payload.selectedSources.map(toApiSource),
    notes: payload.notes.map((note) => ({
      title: note.title,
      body: note.body,
    })),
  });
}

async function discoverClaudeSources(topic: string): Promise<ApiDiscoverResponse> {
  const response = await postJson<ApiDiscoverResponse>("/api/discover", { topic });
  return {
    ...response,
    sources: response.sources.map((source) => ({
      ...source,
      kind: normalizeSourceKind(source.kind),
    })),
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `${response.status} ${response.statusText}`);
  }
  return data as T;
}

function toApiSource(source: Source) {
  return {
    id: source.id,
    title: source.title,
    kind: source.kind,
    body: source.body,
  };
}

function normalizeSourceKind(kind: string): SourceKind {
  const allowed: SourceKind[] = ["doc", "pdf", "url", "youtube", "text", "slide", "ebook", "image"];
  return allowed.includes(kind as SourceKind) ? (kind as SourceKind) : "doc";
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

function createShareUrl(title: string): string {
  const url = new URL(window.location.href);
  url.hash = `notebook=${encodeURIComponent(title)}`;
  return url.toString();
}

function downloadNotebook({
  title,
  sources,
  messages,
  artifacts,
  notes,
}: {
  title: string;
  sources: Source[];
  messages: ChatMessage[];
  artifacts: Artifact[];
  notes: Note[];
}) {
  downloadJson(`${title || "notebook"}.json`, {
    title,
    exportedAt: new Date().toISOString(),
    sources,
    messages,
    artifacts,
    notes,
  });
}

function downloadArtifacts(artifacts: Artifact[]) {
  downloadJson("studio-outputs.json", {
    exportedAt: new Date().toISOString(),
    artifacts,
  });
}

function downloadJson(fileName: string, data: unknown) {
  const safeName = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

function createGroundedResponse(
  query: string,
  selectedSources: Source[],
  goal: string,
  persona: string,
  answerStyle: string,
): { content: string; citations: Citation[] } {
  if (!selectedSources.length) {
    return {
      citations: [],
      content:
        "No sources are selected yet. Select one or more sources in the Sources panel, then ask again so the answer can be grounded in your material.",
    };
  }

  const rankedSnippets = rankSnippets(query, selectedSources).slice(0, 4);
  const snippets = rankedSnippets.length
    ? rankedSnippets
    : selectedSources.slice(0, 3).map((source) => ({
        source,
        text: getChunks(source.body)[0] ?? source.body,
        score: 1,
      }));

  const citations: Citation[] = snippets.map((snippet, index) => ({
    index: index + 1,
    sourceId: snippet.source.id,
    sourceTitle: snippet.source.title,
    quote: truncate(snippet.text, 180),
  }));

  const styleInstruction =
    answerStyle === "Concise"
      ? "short answer"
      : answerStyle === "Detailed"
        ? "detailed synthesis"
        : answerStyle === "Study guide"
          ? "study guide"
          : answerStyle === "Action-oriented"
            ? "action plan"
            : "balanced answer";

  const mainPoints = snippets.map((snippet, index) => {
    const citationNumber = index + 1;
    return `- ${rewriteSnippet(snippet.text)} [${citationNumber}]`;
  });

  const nextStep = inferNextStep(query);
  const sourceTitles = selectedSources
    .slice(0, 3)
    .map((source) => source.title)
    .join(", ");

  return {
    citations,
    content: `${persona} response (${styleInstruction}) based on ${selectedSources.length} selected source${selectedSources.length === 1 ? "" : "s"}: ${sourceTitles}${selectedSources.length > 3 ? ", and more" : ""}.

${mainPoints.join("\n")}

Suggested next step: ${nextStep}

Configuration used: ${truncate(goal, 120)}`,
  };
}

function rankSnippets(query: string, selectedSources: Source[]): RankedSnippet[] {
  const terms = tokenize(query);
  if (!terms.length) return [];

  return selectedSources
    .flatMap((source) =>
      getChunks(source.body).map((text) => {
        const textTokens = tokenize(`${source.title} ${text}`);
        const score = terms.reduce(
          (total, term) =>
            total + textTokens.filter((token) => token === term || token.includes(term)).length,
          0,
        );
        return { source, text, score };
      }),
    )
    .filter((snippet) => snippet.score > 0)
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length);
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function getChunks(body: string): string[] {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.flatMap((paragraph) => {
    if (paragraph.length <= 520) return [paragraph];
    const chunks = paragraph.match(/.{1,520}(\s|$)/g);
    return chunks?.map((chunk) => chunk.trim()).filter(Boolean) ?? [paragraph];
  });
}

function rewriteSnippet(snippet: string): string {
  const clean = snippet.replace(/\s+/g, " ").trim();
  if (clean.length < 150) return clean;
  return truncate(clean, 230);
}

function inferNextStep(query: string): string {
  const lower = query.toLowerCase();
  if (lower.includes("studio") || lower.includes("create") || lower.includes("artifact")) {
    return "open Studio and generate the output type that matches the audience.";
  }
  if (lower.includes("study") || lower.includes("learn")) {
    return "generate flashcards or a quiz, then save missed items as notes.";
  }
  if (lower.includes("disagree") || lower.includes("risk")) {
    return "ask a follow-up that compares evidence source by source.";
  }
  if (lower.includes("summar")) {
    return "save this answer as a note and turn it into a Report in Studio.";
  }
  return "ask a narrower follow-up or create a Studio output from the current answer.";
}

function createArtifact(
  kind: ArtifactKind,
  selectedSources: Source[],
  sequence: number,
): Artifact {
  const sourceCount = selectedSources.length;
  const title = `${artifactConfig[kind].title} ${sequence}`;
  const subtitle =
    sourceCount > 0
      ? `Generated from ${sourceCount} selected source${sourceCount === 1 ? "" : "s"}`
      : "Generated without selected sources";
  const body = createArtifactBody(kind, selectedSources);

  return {
    id: makeId("artifact"),
    kind,
    title,
    subtitle,
    sourceCount,
    body,
    status: "ready",
    createdAt: Date.now(),
  };
}

function createArtifactBody(kind: ArtifactKind, selectedSources: Source[]): string {
  const sourceLine = selectedSources.length
    ? selectedSources.map((source) => source.title).join(", ")
    : "No selected sources";
  const themes = extractThemes(selectedSources);

  if (kind === "audio") {
    return `# Audio Overview script

Hosts open with the central question: what do these sources help us understand?

- Segment 1: introduce the source set (${sourceLine}).
- Segment 2: explain the top themes: ${themes.slice(0, 4).join(", ")}.
- Segment 3: compare evidence and identify practical takeaways.
- Closing: invite the listener to inspect citations and create a follow-up report.`;
  }

  if (kind === "video") {
    return `# Video Overview outline

- Scene 1: title card with the source collection.
- Scene 2: animated source stack showing ${selectedSources.length || "no"} active items.
- Scene 3: visual map of themes: ${themes.slice(0, 5).join(", ")}.
- Scene 4: summary board with recommended next actions.

Use the video board above as a storyboard reference for generated visuals.`;
  }

  if (kind === "mindmap") {
    return `# Mind Map

- Center: ${selectedSources[0]?.title ?? "Source collection"}.
- Branch: source grounding and citations.
- Branch: generated outputs and reusable notes.
- Branch: user workflows and responsive panels.
- Branch: risks, gaps, and follow-up questions.

Promising connection: ${themes[0] ?? "source selection"} influences ${themes[1] ?? "answer quality"} and should shape each Studio output.`;
  }

  if (kind === "flashcards") {
    return `# Flashcards

- Front: Why are citations important in this workspace?
  Back: They let users verify generated answers against source evidence.
- Front: What are the three main workspace areas?
  Back: Sources, Chat, and Studio.
- Front: What should happen on mobile?
  Back: The desktop panels should become tabs while preserving state.
- Front: Name one expected Studio output.
  Back: Audio overview, video overview, mind map, report, flashcards, quiz, or infographic.`;
  }

  if (kind === "quiz") {
    return `# Quiz

1. Which action keeps chat answers grounded?
- Correct: selecting relevant sources before asking.

2. What does Studio produce?
- Correct: reusable outputs such as reports, audio overviews, videos, and mind maps.

3. What is the main trust signal?
- Correct: citations and clear generation disclosure.`;
  }

  if (kind === "infographic") {
    return `# Infographic copy

- Header: From sources to grounded outputs
- Block 1: Collect documents, links, transcripts, and notes.
- Block 2: Ask focused questions with citations.
- Block 3: Generate Studio artifacts for different audiences.
- Block 4: Save notes and continue the project history.`;
  }

  return `# Report

Source set: ${sourceLine}

Summary:
- The selected sources point to a workspace built around source control, grounded chat, and generated artifacts.
- Users need clear evidence trails, fast switching between panels, and persistent outputs.
- Studio should support multiple artifacts of the same type for different audiences.

Recommended actions:
- Use selected sources for every important answer.
- Save strong chat responses as notes.
- Generate a report and study tools for downstream use.`;
}

function extractThemes(selectedSources: Source[]): string[] {
  const allTokens = selectedSources.flatMap((source) => tokenize(source.body));
  const counts = new Map<string, number>();
  allTokens.forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
  const themes = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([token]) => token);
  return themes.length ? themes : ["sources", "chat", "studio", "citations"];
}

function readFileAsSource(file: File): Promise<Source> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(
        buildSource({
          title: file.name,
          kind: inferKindFromName(file.name),
          body:
            result.trim() ||
            `${file.name}\n\nThe browser could not extract readable text from this file. Paste important passages manually for grounded chat.`,
        }),
      );
    };
    reader.onerror = () => {
      resolve(
        buildSource({
          title: file.name,
          kind: inferKindFromName(file.name),
          body: `${file.name}\n\nThis file could not be read locally. Paste source text to make it available to chat.`,
        }),
      );
    };
    reader.readAsText(file);
  });
}

function buildSource({
  title,
  body,
  kind,
}: {
  title: string;
  body: string;
  kind: SourceKind;
}): Source {
  const id = makeId("source");
  return {
    id,
    title,
    body,
    kind,
    selected: true,
    createdAt: Date.now(),
    accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
  };
}

function createDiscoveredSources(topic: string): Source[] {
  return [
    buildSource({
      title: `${topic}: overview`,
      kind: "url",
      body: `${topic} overview

This generated starter source introduces the main vocabulary, known stakeholders, and practical use cases around ${topic}. It highlights the need to compare multiple sources before making decisions.

Useful research questions include: what changed recently, who is affected, what evidence is strongest, and what remains uncertain?`,
    }),
    buildSource({
      title: `${topic}: expert notes`,
      kind: "doc",
      body: `${topic} expert notes

Experts describe ${topic} as a topic where synthesis matters more than collecting raw links. A useful notebook should preserve source provenance and separate direct evidence from interpretation.

The strongest outputs combine concise summaries, clear citations, and next-step recommendations for the reader's role.`,
    }),
    buildSource({
      title: `${topic}: study prompts`,
      kind: "text",
      body: `${topic} study prompts

Key prompts:
- Define the core terms in plain language.
- Compare benefits, risks, and open questions.
- Create a timeline of important changes.
- Generate flashcards and a quiz for retention.

These prompts are designed for chat, reports, and Studio study tools.`,
    }),
  ];
}

function inferKindFromName(fileName: string): SourceKind {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".epub")) return "ebook";
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "slide";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "url";
  return "doc";
}

function inferKindFromUrl(url: string): SourceKind {
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".epub")) return "ebook";
  return "url";
}

function getReadableUrlTitle(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Linked source";
  }
}

function downloadText(artifact: Artifact) {
  const blob = new Blob([artifact.body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function countWords(input: string): number {
  const words = input.match(/\b[\w-]+\b/g);
  return words?.length ?? 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: value > 9999 ? "compact" : "standard" }).format(value);
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function truncate(input: string, maxLength: number): string {
  const clean = input.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}...`;
}

function makeId(prefix: string): string {
  if ("crypto" in window && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export default App;
