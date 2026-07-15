import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  useGetChat,
  useListMessages,
  useListAiModels,
  getGetChatQueryKey,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient as useRQClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BASE_URL } from "@/lib/queryClient";
import { useTheme } from "@/lib/theme";
import {
  ArrowLeft, Send, Sparkles, User, BrainCircuit, Loader2,
  Copy, RefreshCw, Trash2, ChevronDown, Zap, Globe, CheckSquare,
  Bell, BarChart3, Bot, Brain, Paperclip, X, Download, FileText, FileType,
  Share2, Check, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import VoiceChat from "@/components/VoiceChat";
import MermaidDiagram from "@/components/MermaidDiagram";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useEditMessage, useDeleteMessage, useRegenerateMessage } from "@workspace/api-client-react";
import { exportAsMarkdown, exportAsPdf, exportAsDocx } from "@/lib/exportChat";

const TOOL_ICONS: Record<string, typeof Bot> = {
  web_search: Globe,
  create_task: CheckSquare,
  create_reminder: Bell,
  analyze_and_summarize: BarChart3,
  generate_plan: Zap,
};

function ToolCallBadge({ name, result }: { name: string; result: string }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[name] || Bot;
  const label = name.replace(/_/g, " ");

  return (
    <div className="my-2 border border-primary/20 rounded-xl overflow-hidden bg-primary/5 text-xs">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary/10 transition-colors text-left"
      >
        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="font-medium text-primary capitalize">{label}</span>
        <span className="text-muted-foreground ml-auto truncate max-w-[200px]">{result.slice(0, 60)}</span>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-primary/10 text-muted-foreground leading-relaxed">
          {result}
        </div>
      )}
    </div>
  );
}

// Assistant messages may contain a leading <think>...</think> block (emitted
// when reasoning mode is on). Split it out so it can render as a collapsible
// "Reasoning" panel above the final answer, rather than as visible prose.
function splitReasoning(content: string): { reasoning: string | null; answer: string } {
  const match = /^\s*<think>([\s\S]*?)<\/think>/.exec(content);
  if (!match) return { reasoning: null, answer: content };
  return { reasoning: match[1].trim(), answer: content.slice(match[0].length).trim() };
}

function ReasoningPanel({ text, defaultOpen = false }: { text: string; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  return (
    <div className="my-2 border border-purple-400/20 rounded-xl overflow-hidden bg-purple-400/5 text-xs">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-purple-400/10 transition-colors text-left"
      >
        <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        <span className="font-medium text-purple-400">Reasoning</span>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground shrink-0 transition-transform ml-auto", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-purple-400/10 text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}

function MessageContent({ content, isDark }: { content: string; isDark: boolean }) {
  const copyCode = (code: string) => navigator.clipboard.writeText(code).catch(() => {});

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const code = String(children).replace(/\n$/, "");
          const isBlock = match || code.includes("\n");

          if (match?.[1] === "mermaid") {
            return <MermaidDiagram chart={code} />;
          }

          if (isBlock) {
            return (
              <div className="relative my-3 rounded-xl overflow-hidden border border-border group">
                <div className={cn(
                  "flex items-center justify-between px-3 py-1.5 text-[11px] font-mono border-b border-border",
                  isDark ? "bg-zinc-900 text-zinc-400" : "bg-zinc-100 text-zinc-500"
                )}>
                  <span>{match?.[1] || "code"}</span>
                  <button
                    onClick={() => copyCode(code)}
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <SyntaxHighlighter
                  style={isDark ? oneDark : oneLight}
                  language={match?.[1] || "text"}
                  PreTag="div"
                  customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.8rem" }}
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            );
          }
          return (
            <code
              className={cn(
                "px-1.5 py-0.5 rounded-md font-mono text-[0.85em]",
                isDark ? "bg-muted/40 text-purple-300" : "bg-primary/10 text-primary"
              )}
              {...props}
            >
              {children}
            </code>
          );
        },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{children}</a>;
        },
        blockquote({ children }) {
          return <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground my-3">{children}</blockquote>;
        },
        table({ children }) {
          return <div className="overflow-x-auto my-3"><table className="text-sm border-collapse w-full">{children}</table></div>;
        },
        th({ children }) {
          return <th className="border border-border px-3 py-2 text-left font-semibold bg-muted/50 text-foreground">{children}</th>;
        },
        td({ children }) {
          return <td className="border border-border px-3 py-2 text-foreground">{children}</td>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

const SUGGESTED_PROMPTS = [
  { icon: Zap, text: "Create a task for me", color: "text-yellow-400" },
  { icon: Globe, text: "Search the web for something", color: "text-blue-400" },
  { icon: BarChart3, text: "Analyze and summarize a topic", color: "text-green-400" },
  { icon: CheckSquare, text: "Help me plan a goal", color: "text-purple-400" },
];

interface StreamMessage {
  id: number;
  chatId: number;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string | null;
  tokensUsed?: number | null;
  imageUrl?: string | null;
  createdAt: string;
}

export default function ChatRoomPage() {
  const { id } = useParams();
  const chatId = parseInt(id || "0", 10);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [content, setContent] = useState("");
  const [agentMode, setAgentMode] = useState(false);
  const [reasoningMode, setReasoningMode] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [personaDropdownOpen, setPersonaDropdownOpen] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [extractingMemories, setExtractingMemories] = useState(false);
  const rqClient = useRQClient();

  // Streaming state — a synthetic in-flight assistant message rendered while
  // tokens are still arriving over SSE, replaced by the persisted message
  // (via query invalidation) once the stream completes.
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const streamAbortRef = useRef<AbortController | null>(null);

  const { data: chat, isLoading: chatLoading } = useGetChat(chatId, {
    query: { enabled: !!chatId, queryKey: getGetChatQueryKey(chatId) },
  });

  const { data: messages, isLoading: msgsLoading } = useListMessages(chatId, {
    query: { enabled: !!chatId, queryKey: getListMessagesQueryKey(chatId) },
  }) as { data: StreamMessage[] | undefined; isLoading: boolean };

  const { data: models } = useListAiModels();
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const regenerateMessage = useRegenerateMessage();

  // Personas
  const { data: personas = [] } = useQuery<Array<{ id: number; name: string; avatarEmoji: string; isDefault: boolean }>>({
    queryKey: ["personas"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}api/personas`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
  });
  const activePersona = personas.find(p => p.id === selectedPersonaId) ?? personas.find(p => p.isDefault) ?? null;

  // Share helpers
  const handleShare = async () => {
    if (shareToken) {
      setShareMenuOpen(o => !o);
      return;
    }
    try {
      const r = await fetch(`${BASE_URL}api/chats/${chatId}/share`, { method: "POST", credentials: "include" });
      if (r.ok) {
        const { shareToken: token } = await r.json() as { shareToken: string };
        setShareToken(token);
        setShareMenuOpen(true);
      }
    } catch {}
  };
  const handleCopyShareLink = () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}shared/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); });
  };
  const handleRevokeShare = async () => {
    await fetch(`${BASE_URL}api/chats/${chatId}/share`, { method: "DELETE", credentials: "include" });
    setShareToken(null);
    setShareMenuOpen(false);
  };

  // Memory extraction — asks the AI to pull key facts from the conversation
  const handleExtractMemories = async () => {
    if (!messages?.length || extractingMemories) return;
    setExtractingMemories(true);
    try {
      const convo = messages.filter(m => m.role !== "system").slice(-20)
        .map(m => `${m.role}: ${m.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim()}`).join("\n");
      const r = await fetch(`${BASE_URL}api/chats/${chatId}/messages/stream`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Based on this conversation, extract 3-5 memorable facts about the user (preferences, goals, personal details, relationships). Return ONLY a JSON array of objects like: [{"content":"...","category":"preference|fact|goal|relationship|general"}]. No explanation, just the JSON.\n\nConversation:\n${convo}`,
          model: "gpt-4o-mini",
        }),
      });
      if (!r.ok || !r.body) throw new Error("Failed");
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "", full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const evts = buf.split("\n\n"); buf = evts.pop() ?? "";
        for (const evt of evts) {
          const dl = evt.split("\n").find(l => l.startsWith("data:"));
          if (!dl) continue;
          try {
            const p = JSON.parse(dl.slice(5).trim()) as Record<string, unknown>;
            if (typeof p.content === "string") full += p.content;
          } catch {}
        }
      }
      // Parse and save memories
      const jsonMatch = /\[[\s\S]*\]/.exec(full);
      if (jsonMatch) {
        const items = JSON.parse(jsonMatch[0]) as Array<{ content: string; category: string }>;
        await Promise.all(items.map(item =>
          fetch(`${BASE_URL}api/memories`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: item.content, category: item.category ?? "general" }),
          })
        ));
        rqClient.invalidateQueries({ queryKey: ["memories"] });
        // Invalidate message list to remove the extraction response
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) });
      }
    } catch {}
    setExtractingMemories(false);
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamContent, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }, [content]);

  useEffect(() => () => streamAbortRef.current?.abort(), []);

  const handleAttachImage = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!content.trim() && !attachedImage) || isStreaming) return;
    const messageContent = content;
    const imageUrl = attachedImage;
    setContent("");
    setAttachedImage(null);
    setIsStreaming(true);
    setStreamContent("");

    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const response = await fetch(`${BASE_URL}api/chats/${chatId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: messageContent,
          model: selectedModel ?? chat?.model ?? undefined,
          agentMode,
          reasoningMode,
          imageUrl,
          personaId: selectedPersonaId ?? undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) throw new Error(`Request failed: ${response.status}`);

      // Optimistically show the user's message immediately.
      queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const lines = evt.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const eventName = eventLine?.slice(6).trim() ?? "message";
          let payload: Record<string, unknown> = {};
          try { payload = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }

          if (eventName === "delta" && typeof payload.content === "string") {
            acc += payload.content;
            setStreamContent(acc);
          } else if (eventName === "done" || eventName === "error") {
            queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) });
            queryClient.invalidateQueries({ queryKey: getGetChatQueryKey(chatId) });
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) });
      }
    } finally {
      setIsStreaming(false);
      setStreamContent("");
      streamAbortRef.current = null;
    }
  };

  const handleCopy = (msgId: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const handleExport = (format: "md" | "pdf" | "docx") => {
    setExportMenuOpen(false);
    const title = chat?.title ?? "Conversation";
    const exportable = (messages ?? []).map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt }));
    if (format === "md") exportAsMarkdown(title, exportable);
    else if (format === "pdf") void exportAsPdf(title, exportable);
    else void exportAsDocx(title, exportable);
  };

  const activeModel = selectedModel ?? chat?.model ?? "gpt-4o-mini";
  const activeModelName = models?.find((m) => m.id === activeModel)?.name ?? activeModel;

  if (!chatId) return <div className="p-8 text-destructive">Invalid chat</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.14))] md:h-[calc(100vh-0px)] -m-4 md:-m-6 lg:-m-8">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className={cn(
        "h-14 flex items-center justify-between px-4 border-b shrink-0 gap-3",
        isDark ? "border-border/50 bg-background/50 backdrop-blur-xl" : "border-border bg-background/80 backdrop-blur-xl"
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/chat">
            <button className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
              isDark ? "hover:bg-muted/40 text-muted-foreground" : "hover:bg-accent text-muted-foreground"
            )}>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="min-w-0">
            {chatLoading
              ? <Skeleton className="h-5 w-40" />
              : <h2 className="text-sm font-semibold text-foreground truncate">{chat?.title}</h2>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Share */}
          <div className="relative">
            <button
              onClick={handleShare}
              title="Share conversation"
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                shareToken
                  ? "text-primary"
                  : isDark ? "hover:bg-muted/40 text-muted-foreground" : "hover:bg-accent text-muted-foreground"
              )}
            >
              <Share2 className="w-4 h-4" />
            </button>
            {shareMenuOpen && (
              <div className={cn(
                "absolute right-0 top-full mt-1 w-64 rounded-xl border shadow-xl z-50 p-3 space-y-2",
                "bg-background border-border"
              )}>
                <p className="text-xs font-medium text-foreground">Share link</p>
                <div className="flex gap-2">
                  <input readOnly value={`${window.location.origin}${import.meta.env.BASE_URL}shared/${shareToken}`}
                    className="flex-1 text-xs bg-muted rounded-lg px-2 py-1.5 text-muted-foreground truncate border border-border" />
                  <button onClick={handleCopyShareLink}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1">
                    {shareCopied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <button onClick={handleRevokeShare} className="text-xs text-destructive hover:underline">Revoke link</button>
              </div>
            )}
          </div>

          {/* Extract memories */}
          <button
            onClick={handleExtractMemories}
            disabled={!messages?.length || extractingMemories}
            title="Extract key facts into memory"
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40",
              isDark ? "hover:bg-muted/40 text-muted-foreground" : "hover:bg-accent text-muted-foreground"
            )}
          >
            {extractingMemories ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </button>

          {/* Export */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((o) => !o)}
              disabled={!messages?.length}
              title="Export conversation"
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40",
                isDark ? "hover:bg-muted/40 text-muted-foreground" : "hover:bg-accent text-muted-foreground"
              )}
            >
              <Download className="w-4 h-4" />
            </button>
            {exportMenuOpen && (
              <div className={cn(
                "absolute right-0 top-full mt-1 w-44 rounded-xl border shadow-xl z-50 overflow-hidden",
                "bg-background border-border"
              )}>
                <button onClick={() => handleExport("md")} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent text-foreground">
                  <FileText className="w-4 h-4 text-muted-foreground" /> Markdown (.md)
                </button>
                <button onClick={() => handleExport("pdf")} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent text-foreground">
                  <FileType className="w-4 h-4 text-muted-foreground" /> PDF (.pdf)
                </button>
                <button onClick={() => handleExport("docx")} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent text-foreground">
                  <FileText className="w-4 h-4 text-muted-foreground" /> Word (.docx)
                </button>
              </div>
            )}
          </div>

          {/* Persona selector */}
          {personas.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setPersonaDropdownOpen(o => !o)}
                title="Switch AI persona"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                  activePersona && selectedPersonaId
                    ? "bg-cyan-400/15 border-cyan-400/30 text-cyan-400"
                    : isDark
                      ? "bg-muted/30 border-border text-muted-foreground hover:text-foreground"
                      : "bg-muted border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-sm leading-none">{activePersona?.avatarEmoji ?? "🤖"}</span>
                <span className="max-w-[60px] truncate hidden sm:block">{activePersona?.name ?? "Default"}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {personaDropdownOpen && (
                <div className={cn(
                  "absolute right-0 top-full mt-1 w-52 rounded-xl border shadow-xl z-50 overflow-hidden",
                  isDark ? "bg-background border-border" : "bg-background border-border shadow-lg"
                )}>
                  <button
                    onClick={() => { setSelectedPersonaId(null); setPersonaDropdownOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors",
                      !selectedPersonaId ? "bg-primary/10 text-primary" : isDark ? "hover:bg-muted/30 text-foreground" : "hover:bg-accent text-foreground"
                    )}
                  >
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium">Default</span>
                  </button>
                  {personas.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPersonaId(p.id); setPersonaDropdownOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors",
                        selectedPersonaId === p.id ? "bg-primary/10 text-primary" : isDark ? "hover:bg-muted/30 text-foreground" : "hover:bg-accent text-foreground"
                      )}
                    >
                      <span className="text-base leading-none">{p.avatarEmoji}</span>
                      <div>
                        <p className="font-medium text-xs">{p.name}</p>
                        {p.isDefault && <p className="text-[10px] text-muted-foreground">Default</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reasoning mode toggle */}
          <button
            onClick={() => setReasoningMode((v) => !v)}
            title="Show the model's step-by-step reasoning"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
              reasoningMode
                ? "bg-purple-400/15 border-purple-400/30 text-purple-400"
                : isDark
                  ? "bg-muted/30 border-border text-muted-foreground hover:text-foreground"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Brain className={cn("w-3.5 h-3.5", reasoningMode && "text-purple-400")} />
            Reasoning {reasoningMode ? "On" : "Off"}
          </button>

          {/* Agent mode toggle */}
          <button
            onClick={() => setAgentMode((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
              agentMode
                ? "bg-primary/15 border-primary/30 text-primary"
                : isDark
                  ? "bg-muted/30 border-border text-muted-foreground hover:text-foreground"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Bot className={cn("w-3.5 h-3.5", agentMode && "text-primary")} />
            Agent {agentMode ? "On" : "Off"}
          </button>

          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen((o) => !o)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                isDark
                  ? "bg-muted/30 border-border text-muted-foreground hover:text-foreground"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
              <span className="max-w-[80px] truncate">{activeModelName}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {modelDropdownOpen && (
              <div className={cn(
                "absolute right-0 top-full mt-1 w-56 rounded-xl border shadow-xl z-50 overflow-hidden",
                isDark ? "bg-background border-border" : "bg-background border-border shadow-lg"
              )}>
                {models?.filter((m) => m.isEnabled).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setModelDropdownOpen(false); }}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-3 py-2.5 text-left text-sm transition-colors",
                      activeModel === m.id
                        ? "bg-primary/10 text-primary"
                        : isDark ? "hover:bg-muted/30 text-foreground" : "hover:bg-accent text-foreground"
                    )}
                  >
                    <BrainCircuit className="w-4 h-4 mt-0.5 shrink-0 text-purple-400" />
                    <div>
                      <p className="font-medium text-xs">{m.name}</p>
                      <p className="text-[11px] text-muted-foreground">{m.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
        onClick={() => { setModelDropdownOpen(false); setExportMenuOpen(false); setPersonaDropdownOpen(false); setShareMenuOpen(false); }}
      >
        {msgsLoading ? (
          <div className="space-y-8 max-w-3xl mx-auto">
            <Skeleton className="h-20 w-3/4 ml-auto rounded-2xl" />
            <Skeleton className="h-32 w-4/5 rounded-2xl" />
          </div>
        ) : messages?.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto gap-8 py-12">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">How can I help you?</h3>
              <p className="text-sm text-muted-foreground">
                {agentMode
                  ? "Agent mode is on — I can create tasks, search the web, and take actions for you."
                  : "Ask me anything, or enable Agent mode for autonomous actions."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p.text}
                  onClick={() => { setContent(p.text); textareaRef.current?.focus(); }}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-xl border text-sm text-left transition-colors",
                    isDark
                      ? "bg-white/[0.03] border-border hover:bg-white/[0.06] text-muted-foreground hover:text-foreground"
                      : "bg-muted/50 border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <p.icon className={cn("w-4 h-4 shrink-0", p.color)} />
                  <span>{p.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6 pb-2">
            {messages?.map((msg) => {
              const isUser = msg.role === "user";
              const toolCalls = (msg as unknown as { toolCalls?: Array<{ name: string; result: string }> }).toolCalls;
              const { reasoning, answer } = isUser ? { reasoning: null, answer: msg.content } : splitReasoning(msg.content);

              return (
                <div key={msg.id} className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}>
                  {/* Avatar */}
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1 border",
                    isUser
                      ? isDark ? "bg-muted/40 border-white/20" : "bg-muted border-border"
                      : "bg-gradient-to-br from-purple-500 to-cyan-600 border-transparent"
                  )}>
                    {isUser
                      ? <User className="w-3.5 h-3.5 text-foreground" />
                      : <Sparkles className="w-3.5 h-3.5 text-foreground" />
                    }
                  </div>

                  {/* Content */}
                  <div className={cn("max-w-[85%] flex flex-col", isUser ? "items-end" : "items-start")}>
                    {/* Tool calls (only on assistant) */}
                    {!isUser && toolCalls && toolCalls.length > 0 && (
                      <div className="w-full mb-1">
                        {toolCalls.map((tc, i) => (
                          <ToolCallBadge key={i} name={tc.name} result={tc.result} />
                        ))}
                      </div>
                    )}

                    {!isUser && reasoning && (
                      <div className="w-full mb-1">
                        <ReasoningPanel text={reasoning} />
                      </div>
                    )}

                    {isUser && msg.imageUrl && (
                      <img src={msg.imageUrl} alt="Attached" className="max-w-[240px] max-h-[240px] rounded-xl mb-1.5 border border-border object-cover" />
                    )}

                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      isUser
                        ? isDark
                          ? "bg-primary/20 text-foreground rounded-tr-sm border border-primary/20"
                          : "bg-primary/10 text-foreground rounded-tr-sm border border-primary/20"
                        : isDark
                          ? "bg-background border border-border text-gray-200 rounded-tl-sm shadow-sm"
                          : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                    )}>
                      {isUser
                        ? <p className="whitespace-pre-wrap">{answer}</p>
                        : <MessageContent content={answer} isDark={isDark} />
                      }
                    </div>

                    {/* Message actions */}
                    <div className={cn(
                      "flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity",
                      isUser ? "flex-row-reverse" : "flex-row"
                    )}>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Copy"
                      >
                        <Copy className={cn("w-3.5 h-3.5", copiedId === msg.id && "text-green-400")} />
                      </button>
                      {!isUser && (
                        <button
                          onClick={() => regenerateMessage.mutate({ messageId: msg.id }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) })
                          })}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Regenerate"
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5", regenerateMessage.isPending && "animate-spin")} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteMessage.mutate({ messageId: msg.id }, {
                          onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) })
                        })}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {msg.tokensUsed ? (
                        <span className="text-[10px] text-muted-foreground/60 px-1">{msg.tokensUsed} tokens</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Streaming assistant message */}
            {isStreaming && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-600 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-foreground animate-pulse" />
                </div>
                <div className="max-w-[85%] flex flex-col items-start">
                  {streamContent ? (
                    (() => {
                      const { reasoning, answer } = splitReasoning(streamContent);
                      return (
                        <>
                          {reasoning !== null && <ReasoningPanel text={reasoning} defaultOpen />}
                          <div className={cn(
                            "px-4 py-3 rounded-2xl rounded-tl-sm border text-sm leading-relaxed",
                            isDark ? "bg-background border-border text-gray-200" : "bg-card border-border text-foreground"
                          )}>
                            <MessageContent content={answer || streamContent} isDark={isDark} />
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <div className={cn(
                      "px-4 py-3 rounded-2xl rounded-tl-sm border flex items-center gap-2",
                      isDark ? "bg-background border-border" : "bg-card border-border"
                    )}>
                      {agentMode && <span className="text-xs text-muted-foreground mr-1">Thinking</span>}
                      <span className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        )}
      </div>

      {/* ── Input ──────────────────────────────────────────────── */}
      <div className={cn(
        "px-4 py-4 shrink-0 border-t",
        isDark ? "border-border/50 bg-background/80 backdrop-blur-xl" : "border-border bg-background"
      )}>
        <div className="max-w-3xl mx-auto">
          {attachedImage && (
            <div className="mb-2 relative inline-block">
              <img src={attachedImage} alt="Attachment preview" className="h-16 w-16 object-cover rounded-lg border border-border" />
              <button
                onClick={() => setAttachedImage(null)}
                className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <form onSubmit={handleSend} className="relative">
            <div className={cn(
              "flex flex-col rounded-2xl border transition-all duration-200",
              isDark
                ? "bg-white/[0.03] border-border focus-within:border-primary/40 focus-within:bg-white/[0.05]"
                : "bg-background border-border focus-within:border-primary/60 shadow-sm"
            )}>
              <textarea
                ref={textareaRef}
                className="w-full min-h-[52px] max-h-[200px] resize-none bg-transparent px-4 pt-3.5 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
                placeholder={agentMode ? "Ask me to do anything — I can search, create tasks, and more…" : "Message Mithra…"}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                rows={1}
              />
              <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                <div className="relative flex items-center gap-1.5">
                  {agentMode && (
                    <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 text-[11px]">
                      <Bot className="w-3 h-3" />
                      Agent Mode
                    </span>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAttachImage(f); e.target.value = ""; }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach an image"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <VoiceChat
                    onTranscript={(text) => { setContent(text); setTimeout(handleSend, 100); }}
                    lastAiMessage={messages?.filter(m => m.role === "assistant").at(-1)?.content}
                    disabled={isStreaming}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/50 hidden sm:block">Shift+Enter for new line</span>
                  <button
                    type="submit"
                    disabled={(!content.trim() && !attachedImage) || isStreaming}
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
                      (content.trim() || attachedImage) && !isStreaming
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    {isStreaming
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Send className="w-3.5 h-3.5 translate-x-px" />
                    }
                  </button>
                </div>
              </div>
            </div>
          </form>
          <p className="text-center text-[10px] text-muted-foreground/40 mt-2">
            Mithra can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
