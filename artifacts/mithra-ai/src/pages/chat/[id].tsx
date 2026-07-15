import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import {
  useGetChat, useListMessages, useListAiModels, useListChats, useCreateChat,
  useUpdateChat, useDeleteChat, getGetChatQueryKey, getListMessagesQueryKey,
  getListChatsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient as useRQClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BASE_URL } from "@/lib/queryClient";
import { useTheme } from "@/lib/theme";
import {
  Send, Sparkles, User, BrainCircuit, Loader2, Copy, RefreshCw, Trash2,
  ChevronDown, Zap, Globe, CheckSquare, Bell, BarChart3, Bot, Brain,
  Paperclip, X, Download, FileText, FileType, Share2, Check, Cpu,
  PanelLeftOpen, PanelLeftClose, Plus, MessageSquare, Pin, MoreVertical,
  Pencil, Mic, MicOff, Volume2, VolumeX, StopCircle, Layers, Wand2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import MermaidDiagram from "@/components/MermaidDiagram";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useEditMessage, useDeleteMessage, useRegenerateMessage } from "@workspace/api-client-react";
import { exportAsMarkdown, exportAsPdf, exportAsDocx } from "@/lib/exportChat";
import { format, isToday, isYesterday } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────
interface StreamMessage {
  id: number; chatId: number;
  role: "user" | "assistant" | "system";
  content: string; model?: string | null;
  tokensUsed?: number | null; imageUrl?: string | null;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TOOL_ICONS: Record<string, typeof Bot> = {
  web_search: Globe, create_task: CheckSquare,
  create_reminder: Bell, analyze_and_summarize: BarChart3, generate_plan: Zap,
};

function splitReasoning(content: string): { reasoning: string | null; answer: string } {
  const match = /^\s*<think>([\s\S]*?)<\/think>/.exec(content);
  if (!match) return { reasoning: null, answer: content };
  return { reasoning: match[1].trim(), answer: content.slice(match[0].length).trim() };
}

function groupChatsByDate(chats: any[]) {
  const today: any[] = [], yesterday: any[] = [], older: any[] = [];
  for (const c of chats) {
    const d = new Date(c.updatedAt);
    if (isToday(d)) today.push(c);
    else if (isYesterday(d)) yesterday.push(c);
    else older.push(c);
  }
  return [
    ...(today.length ? [{ label: "Today", chats: today }] : []),
    ...(yesterday.length ? [{ label: "Yesterday", chats: yesterday }] : []),
    ...(older.length ? [{ label: "Earlier", chats: older }] : []),
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ToolCallBadge({ name, result }: { name: string; result: string }) {
  const [open, setOpen] = useState(false);
  const Icon = TOOL_ICONS[name] || Bot;
  return (
    <div className="my-2 rounded-xl overflow-hidden border border-cyan-500/20 bg-cyan-500/5 text-xs">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cyan-500/10 transition-colors text-left">
        <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="font-medium text-cyan-400 capitalize">{name.replace(/_/g, " ")}</span>
        <span className="text-muted-foreground ml-auto truncate max-w-[180px]">{result.slice(0, 50)}…</span>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-3 py-2 border-t border-cyan-500/10 text-muted-foreground leading-relaxed whitespace-pre-wrap">{result}</div>}
    </div>
  );
}

function ReasoningPanel({ text, defaultOpen = false }: { text: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="my-2 rounded-xl overflow-hidden border border-purple-500/20 bg-purple-500/5 text-xs">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-purple-500/10 transition-colors text-left">
        <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        <span className="font-medium text-purple-400">Chain of thought</span>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground shrink-0 ml-auto transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-3 py-2 border-t border-purple-500/10 text-muted-foreground leading-relaxed whitespace-pre-wrap">{text}</div>}
    </div>
  );
}

function MessageContent({ content, isDark }: { content: string; isDark: boolean }) {
  const copyCode = (code: string) => navigator.clipboard.writeText(code).catch(() => {});
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      code({ className, children }) {
        const match = /language-(\w+)/.exec(className || "");
        const code = String(children).replace(/\n$/, "");
        const isBlock = match || code.includes("\n");
        if (match?.[1] === "mermaid") return <MermaidDiagram chart={code} />;
        if (isBlock) return (
          <div className="relative my-3 rounded-xl overflow-hidden border border-border group">
            <div className={cn("flex items-center justify-between px-3 py-1.5 text-[11px] font-mono border-b border-border",
              isDark ? "bg-zinc-900/80 text-zinc-400" : "bg-zinc-100 text-zinc-500")}>
              <span>{match?.[1] || "code"}</span>
              <button onClick={() => copyCode(code)}
                className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <SyntaxHighlighter style={isDark ? oneDark : oneLight} language={match?.[1] || "text"}
              PreTag="div" customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.8rem" }}>
              {code}
            </SyntaxHighlighter>
          </div>
        );
        return <code className={cn("px-1.5 py-0.5 rounded-md font-mono text-[0.85em]",
          isDark ? "bg-white/10 text-purple-300" : "bg-primary/10 text-primary")}>{children}</code>;
      },
      a({ href, children }) {
        return <a href={href} target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80">{children}</a>;
      },
      blockquote({ children }) {
        return <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground my-3">{children}</blockquote>;
      },
      table({ children }) {
        return <div className="overflow-x-auto my-3"><table className="text-sm border-collapse w-full">{children}</table></div>;
      },
      th({ children }) {
        return <th className="border border-border px-3 py-2 text-left font-semibold bg-muted/50">{children}</th>;
      },
      td({ children }) {
        return <td className="border border-border px-3 py-2">{children}</td>;
      },
    }}>
      {content}
    </ReactMarkdown>
  );
}

// Inline voice hook
declare global { interface Window { SpeechRecognition: typeof SpeechRecognition; webkitSpeechRecognition: typeof SpeechRecognition; } }
const WAKE_VARIANTS = ["hey mithra", "hi mithra", "okay mithra", "mithra"];

function speakTTS(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 500));
  u.rate = 1.05;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find(v => v.name.includes("Samantha") || v.name.includes("Google UK English Female") || v.name.includes("Karen"));
  if (v) u.voice = v;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

const SUGGESTED_PROMPTS = [
  { icon: Wand2,      text: "What should I focus on today?",          color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
  { icon: Globe,      text: "Search the web and summarize findings",   color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
  { icon: Layers,     text: "Help me break down a complex goal",       color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20" },
  { icon: CheckSquare,text: "Create a step-by-step plan for me",       color: "text-green-400",   bg: "bg-green-500/10 border-green-500/20" },
  { icon: BarChart3,  text: "Analyze my budget and give advice",       color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  { icon: Brain,      text: "Reflect on my recent journal entries",    color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20" },
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ChatRoomPage() {
  const { id } = useParams();
  const chatId = parseInt(id || "0", 10);
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // ── chat state ──
  const [content, setContent] = useState("");
  const [agentMode, setAgentMode] = useState(false);
  const [reasoningMode, setReasoningMode] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [personaDropdownOpen, setPersonaDropdownOpen] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [extractingMemories, setExtractingMemories] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── streaming ──
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const streamAbortRef = useRef<AbortController | null>(null);

  // ── voice ──
  const SpeechRecognitionClass = typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const [voiceState, setVoiceState] = useState<"idle" | "wake" | "listening" | "speaking">("idle");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const voiceRecRef = useRef<SpeechRecognition | null>(null);
  const wakeRecRef = useRef<SpeechRecognition | null>(null);
  const wakeRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const rqClient = useRQClient();
  const { getToken } = useAuth();

  // ── queries ──
  const { data: chat, isLoading: chatLoading } = useGetChat(chatId, {
    query: { enabled: !!chatId, queryKey: getGetChatQueryKey(chatId) },
  });
  const { data: messages, isLoading: msgsLoading } = useListMessages(chatId, {
    query: { enabled: !!chatId, queryKey: getListMessagesQueryKey(chatId) },
  }) as { data: StreamMessage[] | undefined; isLoading: boolean };
  const { data: models } = useListAiModels();
  const { data: allChats } = useListChats();
  const { data: personas = [] } = useQuery<Array<{ id: number; name: string; avatarEmoji: string; isDefault: boolean }>>({
    queryKey: ["personas"],
    queryFn: async () => {
      const tok = await getToken();
      const r = await fetch(`${BASE_URL}api/personas`, { credentials: "include", headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
      return r.ok ? r.json() : [];
    },
  });
  const createChat = useCreateChat();
  const updateChat = useUpdateChat();
  const deleteChat = useDeleteChat();
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const regenerateMessage = useRegenerateMessage();

  const activePersona = personas.find(p => p.id === selectedPersonaId) ?? personas.find(p => p.isDefault) ?? null;
  const activeModel = selectedModel ?? chat?.model ?? "gpt-4o-mini";
  const activeModelName = models?.find(m => m.id === activeModel)?.name ?? activeModel;
  const isEmpty = !msgsLoading && !messages?.length && !isStreaming;

  const groupedChats = groupChatsByDate(allChats ?? []);
  const pinnedChats = allChats?.filter(c => c.isPinned) ?? [];

  // ── scroll ──
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);
  useEffect(() => { scrollToBottom(); }, [messages, streamContent]);

  // ── textarea auto-resize ──
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 180) + "px"; }
  }, [content]);

  useEffect(() => () => { streamAbortRef.current?.abort(); }, []);

  // ── voice: wake word loop ──
  const startWakeLoop = useCallback(() => {
    if (!SpeechRecognitionClass) return;
    if (wakeRecRef.current) return;
    const rec = new SpeechRecognitionClass();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = (e: SpeechRecognitionEvent) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase().trim();
        if (WAKE_VARIANTS.some(w => t.includes(w))) {
          rec.stop(); wakeRecRef.current = null;
          setVoiceState("listening");
          setTimeout(() => startActiveListening(), 300);
          return;
        }
      }
    };
    rec.onerror = () => {
      wakeRecRef.current = null;
      wakeRestartRef.current = setTimeout(startWakeLoop, 1500);
    };
    rec.onend = () => {
      if (wakeRecRef.current === rec) wakeRecRef.current = null;
      if (voiceStateRef.current === "wake") wakeRestartRef.current = setTimeout(startWakeLoop, 400);
    };
    wakeRecRef.current = rec; setVoiceState("wake"); rec.start();
  }, [SpeechRecognitionClass]);

  const startActiveListening = useCallback(() => {
    if (!SpeechRecognitionClass) return;
    voiceRecRef.current?.stop();
    setVoiceState("listening");
    const rec = new SpeechRecognitionClass();
    rec.continuous = false; rec.interimResults = false; rec.lang = "en-US";
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) { setContent(text); setTimeout(() => handleSendVoice(text), 80); }
    };
    rec.onerror = () => { setVoiceState("idle"); };
    rec.onend = () => { if (voiceStateRef.current === "listening") setVoiceState("wake"); };
    voiceRecRef.current = rec; rec.start();
  }, [SpeechRecognitionClass]);

  // Start wake loop on mount
  useEffect(() => {
    if (SpeechRecognitionClass) {
      const t = setTimeout(startWakeLoop, 800);
      return () => { clearTimeout(t); if (wakeRestartRef.current) clearTimeout(wakeRestartRef.current); wakeRecRef.current?.stop(); voiceRecRef.current?.stop(); };
    }
  }, []);

  // After streaming done, restart wake loop
  useEffect(() => {
    if (!isStreaming && voiceState === "idle" && SpeechRecognitionClass && !wakeRecRef.current) {
      const t = setTimeout(startWakeLoop, 600);
      return () => clearTimeout(t);
    }
  }, [isStreaming]);

  // ── send ──
  const doSend = async (msgContent: string, imgUrl?: string | null) => {
    if ((!msgContent.trim() && !imgUrl) || isStreaming) return;
    setContent(""); setAttachedImage(null);
    setIsStreaming(true); setStreamContent("");
    const controller = new AbortController();
    streamAbortRef.current = controller;
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}api/chats/${chatId}/messages/stream`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: msgContent, model: selectedModel ?? chat?.model ?? undefined, agentMode, reasoningMode, imageUrl: imgUrl, personaId: selectedPersonaId ?? undefined }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`${response.status}`);
      queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n"); buffer = events.pop() ?? "";
        for (const evt of events) {
          const lines = evt.split("\n");
          const eventName = lines.find(l => l.startsWith("event:"))?.slice(6).trim() ?? "message";
          const dataLine = lines.find(l => l.startsWith("data:"));
          if (!dataLine) continue;
          let payload: Record<string, unknown> = {};
          try { payload = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
          if (eventName === "delta" && typeof payload.content === "string") { acc += payload.content; setStreamContent(acc); }
          else if (eventName === "done" || eventName === "error") {
            queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) });
            queryClient.invalidateQueries({ queryKey: getGetChatQueryKey(chatId) });
            queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
            // TTS read-back for voice-triggered messages
            if (ttsEnabled && acc) {
              setVoiceState("speaking");
              speakTTS(acc, () => { setVoiceState("idle"); });
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) });
    } finally { setIsStreaming(false); setStreamContent(""); streamAbortRef.current = null; }
  };

  const handleSend = (e?: React.FormEvent) => { e?.preventDefault(); doSend(content, attachedImage); };
  const handleSendVoice = (text: string) => doSend(text);

  // ── copy ──
  const handleCopy = (msgId: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopiedId(msgId); setTimeout(() => setCopiedId(null), 1500); });
  };

  // ── export ──
  const handleExport = (format: "md" | "pdf" | "docx") => {
    setExportMenuOpen(false);
    const title = chat?.title ?? "Conversation";
    const exportable = (messages ?? []).map(m => ({ role: m.role, content: m.content, createdAt: m.createdAt }));
    if (format === "md") exportAsMarkdown(title, exportable);
    else if (format === "pdf") void exportAsPdf(title, exportable);
    else void exportAsDocx(title, exportable);
  };

  // ── share ──
  const handleShare = async () => {
    if (shareToken) { setShareMenuOpen(o => !o); return; }
    const tok = await getToken();
    const r = await fetch(`${BASE_URL}api/chats/${chatId}/share`, { method: "POST", credentials: "include", headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
    if (r.ok) { const { shareToken: token } = await r.json(); setShareToken(token); setShareMenuOpen(true); }
  };
  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}${import.meta.env.BASE_URL}shared/${shareToken}`)
      .then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); });
  };

  // ── extract memories ──
  const handleExtractMemories = async () => {
    if (!messages?.length || extractingMemories) return;
    setExtractingMemories(true);
    try {
      const convo = messages.filter(m => m.role !== "system").slice(-20)
        .map(m => `${m.role}: ${m.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim()}`).join("\n");
      const tok = await getToken();
      const r = await fetch(`${BASE_URL}api/chats/${chatId}/messages/stream`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ content: `Extract 3-5 key facts about the user from this conversation as JSON array: [{"content":"...","category":"preference|fact|goal|relationship|general"}]\n\n${convo}`, model: "gpt-4o-mini" }),
      });
      if (!r.ok || !r.body) throw new Error();
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "", full = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const evts = buf.split("\n\n"); buf = evts.pop() ?? "";
        for (const evt of evts) {
          const dl = evt.split("\n").find(l => l.startsWith("data:"));
          if (!dl) continue;
          try { const p = JSON.parse(dl.slice(5).trim()) as Record<string, unknown>; if (typeof p.content === "string") full += p.content; } catch {}
        }
      }
      const jsonMatch = /\[[\s\S]*\]/.exec(full);
      if (jsonMatch) {
        const items = JSON.parse(jsonMatch[0]) as Array<{ content: string; category: string }>;
        await Promise.all(items.map(item => fetch(`${BASE_URL}api/memories`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) })));
        rqClient.invalidateQueries({ queryKey: ["memories"] });
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) });
      }
    } catch {}
    setExtractingMemories(false);
  };

  // ── title edit ──
  const startEditTitle = () => { setTitleDraft(chat?.title ?? ""); setEditingTitle(true); setTimeout(() => titleInputRef.current?.select(), 50); };
  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft !== chat?.title) {
      updateChat.mutate({ chatId, data: { title: titleDraft.trim() } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetChatQueryKey(chatId) }) });
    }
    setEditingTitle(false);
  };

  if (!chatId) return <div className="p-8 text-destructive">Invalid chat</div>;

  const closeDropdowns = () => { setModelDropdownOpen(false); setExportMenuOpen(false); setPersonaDropdownOpen(false); setShareMenuOpen(false); };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full -m-4 md:-m-6 lg:-m-8 overflow-hidden">

      {/* ── Chat sidebar ──────────────────────────────────────────── */}
      <aside className={cn(
        "hidden md:flex flex-col shrink-0 border-r transition-all duration-300 overflow-hidden",
        isDark ? "border-white/5 bg-background/40" : "border-border bg-muted/20",
        sidebarOpen ? "w-64" : "w-0 border-0"
      )}>
        {sidebarOpen && (
          <>
            {/* New chat */}
            <div className="p-3 border-b border-border/50">
              <button
                onClick={() => createChat.mutate({ data: { title: "New Conversation" } }, { onSuccess: c => { queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() }); navigate(`/chat/${c.id}`); } })}
                disabled={createChat.isPending}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isDark ? "bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20" : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}>
                <Plus className="w-4 h-4" />
                New conversation
              </button>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
              {pinnedChats.length > 0 && (
                <div>
                  <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                    <Pin className="w-2.5 h-2.5" /> Pinned
                  </p>
                  {pinnedChats.map(c => (
                    <SidebarChatItem key={c.id} chat={c} active={c.id === chatId} isDark={isDark}
                      onClick={() => navigate(`/chat/${c.id}`)}
                      onPin={() => updateChat.mutate({ chatId: c.id, data: { isPinned: !c.isPinned } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() }) })}
                      onDelete={() => { if (confirm("Delete?")) deleteChat.mutate({ chatId: c.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() }); if (c.id === chatId) navigate("/chat"); } }); }}
                    />
                  ))}
                </div>
              )}
              {groupedChats.map(group => (
                <div key={group.label}>
                  <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{group.label}</p>
                  {group.chats.filter(c => !c.isPinned).map((c: any) => (
                    <SidebarChatItem key={c.id} chat={c} active={c.id === chatId} isDark={isDark}
                      onClick={() => navigate(`/chat/${c.id}`)}
                      onPin={() => updateChat.mutate({ chatId: c.id, data: { isPinned: !c.isPinned } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() }) })}
                      onDelete={() => { if (confirm("Delete?")) deleteChat.mutate({ chatId: c.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() }); if (c.id === chatId) navigate("/chat"); } }); }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* ── Main chat area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────── */}
        <header className={cn(
          "h-14 flex items-center px-3 gap-2 border-b shrink-0",
          isDark ? "border-white/5 bg-background/60 backdrop-blur-xl" : "border-border bg-background/80 backdrop-blur-sm"
        )}>
          {/* Sidebar toggle */}
          <button onClick={() => setSidebarOpen(o => !o)}
            className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
              isDark ? "text-muted-foreground hover:bg-white/5 hover:text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          {/* Persona avatar */}
          {activePersona && (
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 border",
              isDark ? "bg-white/5 border-white/10" : "bg-muted border-border")}>
              {activePersona.avatarEmoji}
            </div>
          )}

          {/* Title */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            {editingTitle ? (
              <input ref={titleInputRef} value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                onBlur={saveTitle} onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                className="flex-1 bg-transparent text-sm font-semibold text-foreground focus:outline-none border-b border-primary/60 min-w-0" />
            ) : (
              <button onClick={startEditTitle} className="flex items-center gap-1.5 min-w-0 group">
                {chatLoading
                  ? <Skeleton className="h-4 w-32" />
                  : <span className="text-sm font-semibold text-foreground truncate">{chat?.title}</span>}
                <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Reasoning */}
            <button onClick={() => setReasoningMode(v => !v)} title="Chain of thought"
              className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200",
                reasoningMode ? "bg-purple-500/15 border-purple-500/30 text-purple-400" : isDark ? "bg-transparent border-transparent text-muted-foreground hover:border-border hover:text-foreground" : "bg-transparent border-transparent text-muted-foreground hover:border-border hover:text-foreground")}>
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Think</span>
            </button>

            {/* Agent */}
            <button onClick={() => setAgentMode(v => !v)} title="Agent mode — tools + actions"
              className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200",
                agentMode ? "bg-primary/15 border-primary/30 text-primary" : isDark ? "bg-transparent border-transparent text-muted-foreground hover:border-border hover:text-foreground" : "bg-transparent border-transparent text-muted-foreground hover:border-border hover:text-foreground")}>
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Agent</span>
            </button>

            {/* Persona picker */}
            <div className="relative">
              <button onClick={() => setPersonaDropdownOpen(o => !o)} title="Switch persona"
                className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200",
                  selectedPersonaId ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400" : isDark ? "bg-transparent border-transparent text-muted-foreground hover:border-border hover:text-foreground" : "bg-transparent border-transparent text-muted-foreground hover:border-border hover:text-foreground")}>
                <span className="text-sm leading-none">{activePersona?.avatarEmoji ?? "🤖"}</span>
                <span className="hidden md:block max-w-[56px] truncate">{activePersona?.name ?? "Persona"}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {personaDropdownOpen && (
                <div className={cn("absolute right-0 top-full mt-1 w-52 rounded-xl border shadow-xl z-50 overflow-hidden", isDark ? "bg-background border-border" : "bg-background border-border shadow-lg")}>
                  <button onClick={() => { setSelectedPersonaId(null); setPersonaDropdownOpen(false); }}
                    className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors", !selectedPersonaId ? "bg-primary/10 text-primary" : isDark ? "hover:bg-muted/30 text-foreground" : "hover:bg-accent")}>
                    <Cpu className="w-4 h-4 text-muted-foreground" /><span className="text-xs font-medium">Default</span>
                  </button>
                  {personas.map(p => (
                    <button key={p.id} onClick={() => { setSelectedPersonaId(p.id); setPersonaDropdownOpen(false); }}
                      className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors", selectedPersonaId === p.id ? "bg-primary/10 text-primary" : isDark ? "hover:bg-muted/30 text-foreground" : "hover:bg-accent")}>
                      <span className="text-base leading-none">{p.avatarEmoji}</span>
                      <div><p className="font-medium text-xs">{p.name}</p>{p.isDefault && <p className="text-[10px] text-muted-foreground">Default</p>}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model picker */}
            <div className="relative">
              <button onClick={() => setModelDropdownOpen(o => !o)}
                className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200",
                  isDark ? "bg-transparent border-transparent text-muted-foreground hover:border-border hover:text-foreground" : "bg-transparent border-transparent text-muted-foreground hover:border-border hover:text-foreground")}>
                <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden md:block max-w-[72px] truncate">{activeModelName}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {modelDropdownOpen && (
                <div className={cn("absolute right-0 top-full mt-1 w-60 rounded-xl border shadow-xl z-50 overflow-hidden", isDark ? "bg-background border-border" : "bg-background border-border shadow-lg")}>
                  {models?.filter(m => m.isEnabled).map(m => (
                    <button key={m.id} onClick={() => { setSelectedModel(m.id); setModelDropdownOpen(false); }}
                      className={cn("w-full flex items-start gap-2.5 px-3 py-2.5 text-left text-sm transition-colors", activeModel === m.id ? "bg-primary/10 text-primary" : isDark ? "hover:bg-muted/30 text-foreground" : "hover:bg-accent")}>
                      <BrainCircuit className="w-4 h-4 mt-0.5 shrink-0 text-purple-400" />
                      <div><p className="font-medium text-xs">{m.name}</p><p className="text-[11px] text-muted-foreground">{m.description}</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Extract memories */}
            <button onClick={handleExtractMemories} disabled={!messages?.length || extractingMemories} title="Extract memories from conversation"
              className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30",
                isDark ? "text-muted-foreground hover:bg-white/5 hover:text-foreground" : "text-muted-foreground hover:bg-accent")}>
              {extractingMemories ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </button>

            {/* Share */}
            <div className="relative">
              <button onClick={handleShare} title="Share conversation"
                className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  shareToken ? "text-primary" : isDark ? "text-muted-foreground hover:bg-white/5 hover:text-foreground" : "text-muted-foreground hover:bg-accent")}>
                <Share2 className="w-4 h-4" />
              </button>
              {shareMenuOpen && (
                <div className={cn("absolute right-0 top-full mt-1 w-64 rounded-xl border shadow-xl z-50 p-3 space-y-2", "bg-background border-border")}>
                  <p className="text-xs font-semibold text-foreground">Share link</p>
                  <div className="flex gap-2">
                    <input readOnly value={`${window.location.origin}${import.meta.env.BASE_URL}shared/${shareToken}`}
                      className="flex-1 text-xs bg-muted rounded-lg px-2 py-1.5 text-muted-foreground truncate border border-border" />
                    <button onClick={handleCopyShareLink} className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1">
                      {shareCopied ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                    </button>
                  </div>
                  <button onClick={async () => { const tok = await getToken(); await fetch(`${BASE_URL}api/chats/${chatId}/share`, { method: "DELETE", credentials: "include", headers: tok ? { Authorization: `Bearer ${tok}` } : {} }); setShareToken(null); setShareMenuOpen(false); }}
                    className="text-xs text-destructive hover:underline">Revoke link</button>
                </div>
              )}
            </div>

            {/* Export */}
            <div className="relative">
              <button onClick={() => setExportMenuOpen(o => !o)} disabled={!messages?.length} title="Export"
                className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30",
                  isDark ? "text-muted-foreground hover:bg-white/5 hover:text-foreground" : "text-muted-foreground hover:bg-accent")}>
                <Download className="w-4 h-4" />
              </button>
              {exportMenuOpen && (
                <div className={cn("absolute right-0 top-full mt-1 w-44 rounded-xl border shadow-xl z-50 overflow-hidden", "bg-background border-border")}>
                  {[["md", "Markdown (.md)", FileText], ["pdf", "PDF (.pdf)", FileType], ["docx", "Word (.docx)", FileText]].map(([fmt, label, Icon]) => (
                    <button key={fmt as string} onClick={() => handleExport(fmt as "md" | "pdf" | "docx")}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent text-foreground">
                      {/* @ts-ignore */}
                      <Icon className="w-4 h-4 text-muted-foreground" /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Messages ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto" onClick={closeDropdowns}>

          {/* EMPTY STATE */}
          {isEmpty && (
            <div className="h-full flex flex-col items-center justify-center px-4 py-8">
              <div className="w-full max-w-2xl space-y-8">
                {/* Hero */}
                <div className="text-center">
                  <div className={cn(
                    "w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center relative",
                    "bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-primary/20"
                  )}>
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 blur-xl" />
                    {activePersona
                      ? <span className="text-3xl relative z-10">{activePersona.avatarEmoji}</span>
                      : <Sparkles className="w-9 h-9 text-primary relative z-10" />}
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    {activePersona ? `${activePersona.name} is ready` : "What can I help with?"}
                  </h2>
                  <p className={cn("text-sm max-w-md mx-auto", isDark ? "text-muted-foreground" : "text-muted-foreground")}>
                    {agentMode
                      ? "Agent mode is on — I can create tasks, search the web, and take autonomous actions on your behalf."
                      : "Ask me anything. I know your goals, habits, journal, and family context."}
                  </p>
                  {/* Mode badges */}
                  <div className="flex items-center justify-center gap-2 mt-3">
                    {agentMode && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/25 text-primary text-xs font-medium">
                        <Bot className="w-3 h-3" /> Agent mode on
                      </span>
                    )}
                    {reasoningMode && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-400 text-xs font-medium">
                        <Brain className="w-3 h-3" /> Thinking on
                      </span>
                    )}
                    {voiceState === "wake" && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium animate-pulse">
                        <Mic className="w-3 h-3" /> Say "Hey Mithra"
                      </span>
                    )}
                  </div>
                </div>

                {/* Suggested prompts */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {SUGGESTED_PROMPTS.map(p => (
                    <button key={p.text}
                      onClick={() => { setContent(p.text); textareaRef.current?.focus(); }}
                      className={cn("flex items-start gap-2.5 p-3.5 rounded-2xl border text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                        isDark ? "bg-white/[0.02] border-white/8 hover:bg-white/[0.05] hover:border-white/15" : "bg-white border-border hover:bg-muted/50 shadow-sm")}>
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border", p.bg)}>
                        <p.icon className={cn("w-3.5 h-3.5", p.color)} />
                      </div>
                      <span className="text-xs text-muted-foreground leading-snug">{p.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MESSAGES */}
          {!isEmpty && (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-2 pb-4">
              {msgsLoading ? (
                <div className="space-y-8">
                  <Skeleton className="h-16 w-3/5 ml-auto rounded-2xl" />
                  <Skeleton className="h-28 w-4/5 rounded-2xl" />
                  <Skeleton className="h-16 w-2/5 ml-auto rounded-2xl" />
                </div>
              ) : (
                <>
                  {messages?.map(msg => {
                    const isUser = msg.role === "user";
                    const toolCalls = (msg as any).toolCalls as Array<{ name: string; result: string }> | undefined;
                    const { reasoning, answer } = isUser ? { reasoning: null, answer: msg.content } : splitReasoning(msg.content);

                    return (
                      <div key={msg.id} className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}>
                        {/* Avatar */}
                        <div className={cn(
                          "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-1 text-xs font-bold",
                          isUser
                            ? isDark ? "bg-white/10 text-foreground border border-white/10" : "bg-muted text-foreground border border-border"
                            : "bg-gradient-to-br from-purple-500 to-cyan-500 text-white shadow-sm"
                        )}>
                          {isUser ? <User className="w-3.5 h-3.5" /> : (activePersona ? activePersona.avatarEmoji[0] : <Sparkles className="w-3.5 h-3.5" />)}
                        </div>

                        {/* Bubble */}
                        <div className={cn("max-w-[82%] flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
                          {!isUser && toolCalls?.length && toolCalls.map((tc, i) => <ToolCallBadge key={i} name={tc.name} result={tc.result} />)}
                          {!isUser && reasoning && <ReasoningPanel text={reasoning} />}
                          {isUser && msg.imageUrl && (
                            <img src={msg.imageUrl} alt="Attached" className="max-w-[220px] rounded-xl border border-border object-cover mb-1" />
                          )}

                          <div className={cn(
                            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                            isUser
                              ? "bg-gradient-to-br from-purple-500/25 to-cyan-500/15 border border-primary/20 text-foreground rounded-tr-sm"
                              : isDark
                                ? "text-gray-200"
                                : "text-foreground"
                          )}>
                            {isUser
                              ? <p className="whitespace-pre-wrap">{answer}</p>
                              : <MessageContent content={answer} isDark={isDark} />}
                          </div>

                          {/* Message meta + actions */}
                          <div className={cn(
                            "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150",
                            isUser ? "flex-row-reverse" : "flex-row"
                          )}>
                            <button onClick={() => handleCopy(msg.id, msg.content)} title="Copy"
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            {!isUser && (
                              <button onClick={() => regenerateMessage.mutate({ messageId: msg.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) }) })}
                                title="Regenerate" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                                <RefreshCw className={cn("w-3.5 h-3.5", regenerateMessage.isPending && "animate-spin")} />
                              </button>
                            )}
                            <button onClick={() => deleteMessage.mutate({ messageId: msg.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) }) })}
                              title="Delete" className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {msg.tokensUsed ? (
                              <span className="text-[10px] text-muted-foreground/50 px-1.5">{msg.tokensUsed.toLocaleString()} tokens</span>
                            ) : null}
                            {msg.model && (
                              <span className="text-[10px] text-muted-foreground/40 px-1">{msg.model}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Streaming message */}
                  {isStreaming && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shrink-0 mt-1 shadow-sm relative">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                        <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 animate-ping opacity-20" />
                      </div>
                      <div className="max-w-[82%] flex flex-col items-start gap-1">
                        {streamContent ? (
                          (() => {
                            const { reasoning, answer } = splitReasoning(streamContent);
                            return (
                              <>
                                {reasoning !== null && <ReasoningPanel text={reasoning} defaultOpen />}
                                <div className={cn("px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed", isDark ? "text-gray-200" : "text-foreground")}>
                                  <MessageContent content={answer || streamContent} isDark={isDark} />
                                </div>
                              </>
                            );
                          })()
                        ) : (
                          <div className={cn("px-4 py-3 rounded-2xl rounded-tl-sm border flex items-center gap-3",
                            isDark ? "bg-white/[0.03] border-white/5" : "bg-muted/30 border-border")}>
                            {agentMode && <span className="text-xs text-muted-foreground font-medium">Working</span>}
                            <span className="flex gap-1.5">
                              {[0, 1, 2].map(i => (
                                <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce"
                                  style={{ animationDelay: `${i * 0.18}s` }} />
                              ))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </div>

        {/* ── Input bar ─────────────────────────────────────────────── */}
        <div className={cn("px-4 pb-4 pt-3 shrink-0", isDark ? "bg-background/80 backdrop-blur-xl" : "bg-background")}>
          <div className="max-w-3xl mx-auto">
            {/* Image preview */}
            {attachedImage && (
              <div className="mb-2 relative inline-flex">
                <img src={attachedImage} alt="Attachment" className="h-14 w-14 object-cover rounded-xl border border-border" />
                <button onClick={() => setAttachedImage(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Mode strip above input */}
            {(agentMode || reasoningMode || voiceState === "wake" || voiceState === "listening") && (
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {agentMode && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium">
                    <Bot className="w-2.5 h-2.5" /> Agent
                  </span>
                )}
                {reasoningMode && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[11px] font-medium">
                    <Brain className="w-2.5 h-2.5" /> Thinking
                  </span>
                )}
                {voiceState === "wake" && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[11px] font-medium animate-pulse">
                    <Mic className="w-2.5 h-2.5" /> Listening for "Hey Mithra"
                  </span>
                )}
                {voiceState === "listening" && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                    Listening…
                  </span>
                )}
                {voiceState === "speaking" && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-medium">
                    <Volume2 className="w-2.5 h-2.5" /> Speaking…
                  </span>
                )}
              </div>
            )}

            {/* Main input */}
            <form onSubmit={handleSend}>
              <div className={cn(
                "flex flex-col rounded-2xl border transition-all duration-200",
                agentMode
                  ? isDark ? "bg-white/[0.03] border-primary/30 focus-within:border-primary/60 shadow-[0_0_20px_rgba(139,92,246,0.08)]"
                    : "bg-background border-primary/30 focus-within:border-primary/60 shadow-sm"
                  : isDark ? "bg-white/[0.03] border-white/8 focus-within:border-white/20"
                    : "bg-background border-border focus-within:border-primary/40 shadow-sm"
              )}>
                <textarea ref={textareaRef}
                  className="w-full min-h-[54px] max-h-[180px] resize-none bg-transparent px-4 pt-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
                  placeholder={agentMode ? "Ask me to do anything — search, create, plan, analyze…" : "Message Mithra…"}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  rows={1}
                  autoFocus={isEmpty}
                />

                {/* Toolbar row */}
                <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                  <div className="flex items-center gap-1">
                    {/* Attach */}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setAttachedImage(r.result as string); r.readAsDataURL(f); } e.target.value = ""; }} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach image"
                      className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                        isDark ? "text-muted-foreground hover:bg-white/8 hover:text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                      <Paperclip className="w-4 h-4" />
                    </button>

                    {/* Voice mic */}
                    {SpeechRecognitionClass && (
                      <button type="button"
                        onClick={() => {
                          if (voiceState === "listening") { voiceRecRef.current?.stop(); setVoiceState("wake"); }
                          else if (voiceState === "speaking") { window.speechSynthesis?.cancel(); setVoiceState("idle"); }
                          else startActiveListening();
                        }}
                        title={voiceState === "listening" ? "Stop listening" : "Voice input"}
                        className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 relative",
                          voiceState === "listening" ? "bg-red-500/15 text-red-400 border border-red-500/25" :
                          voiceState === "speaking" ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25" :
                          voiceState === "wake" ? "bg-purple-500/15 text-purple-400 border border-purple-500/25" :
                          isDark ? "text-muted-foreground hover:bg-white/8 hover:text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                        {voiceState === "listening" ? <MicOff className="w-4 h-4" /> :
                         voiceState === "speaking" ? <StopCircle className="w-4 h-4" /> :
                         <Mic className="w-4 h-4" />}
                        {(voiceState === "listening") && (
                          <span className="absolute inset-0 rounded-xl bg-red-500/20 animate-ping" />
                        )}
                      </button>
                    )}

                    {/* TTS toggle */}
                    <button type="button" onClick={() => { setTtsEnabled(e => !e); if (voiceState === "speaking") window.speechSynthesis?.cancel(); }}
                      title={ttsEnabled ? "Mute voice response" : "Unmute voice response"}
                      className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                        ttsEnabled ? isDark ? "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20" : "text-cyan-600 bg-cyan-50 border border-cyan-200"
                        : isDark ? "text-muted-foreground hover:bg-white/8 hover:text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                      {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {isStreaming && (
                      <button type="button" onClick={() => streamAbortRef.current?.abort()}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-border">
                        <StopCircle className="w-3.5 h-3.5" /> Stop
                      </button>
                    )}
                    <button type="submit"
                      disabled={(!content.trim() && !attachedImage) || isStreaming}
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 shadow-sm",
                        (content.trim() || attachedImage) && !isStreaming
                          ? "bg-gradient-to-br from-purple-500 to-cyan-500 text-white hover:opacity-90 hover:scale-105"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      )}>
                      {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 translate-x-px" />}
                    </button>
                  </div>
                </div>
              </div>
            </form>
            <p className="text-center text-[10px] text-muted-foreground/30 mt-2">Mithra can make mistakes. Verify important information.</p>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Sidebar chat item ────────────────────────────────────────────────────────
function SidebarChatItem({ chat, active, isDark, onClick, onPin, onDelete }: {
  chat: any; active: boolean; isDark: boolean;
  onClick: () => void; onPin: () => void; onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer group transition-all duration-150 relative",
        active
          ? isDark ? "bg-white/8 text-foreground" : "bg-primary/8 text-primary border border-primary/15"
          : isDark ? "text-muted-foreground hover:bg-white/5 hover:text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}>
      <MessageSquare className={cn("w-3.5 h-3.5 shrink-0", active ? "text-primary" : "")} />
      <span className="flex-1 text-xs truncate">{chat.title}</span>
      {chat.isPinned && <Pin className="w-2.5 h-2.5 text-primary/60 shrink-0" />}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}>
        <MoreVertical className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
      </div>
      {menuOpen && (
        <div className={cn("absolute right-0 top-full mt-1 w-36 rounded-xl border shadow-xl z-50 overflow-hidden",
          isDark ? "bg-background border-border" : "bg-background border-border shadow-lg")}
          onClick={e => e.stopPropagation()}>
          <button onClick={() => { onPin(); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-foreground">
            <Pin className="w-3.5 h-3.5" /> {chat.isPinned ? "Unpin" : "Pin"}
          </button>
          <button onClick={() => { onDelete(); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-destructive/10 text-destructive">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
