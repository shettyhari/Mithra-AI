import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  useGetChat,
  useListMessages,
  useSendMessage,
  useListAiModels,
  getGetChatQueryKey,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { useTheme } from "@/lib/theme";
import {
  ArrowLeft, Send, Sparkles, User, BrainCircuit, Loader2,
  Copy, RefreshCw, Trash2, ChevronDown, Zap, Globe, CheckSquare,
  Bell, BarChart3, Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import VoiceChat from "@/components/VoiceChat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useEditMessage, useDeleteMessage, useRegenerateMessage } from "@workspace/api-client-react";

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

export default function ChatRoomPage() {
  const { id } = useParams();
  const chatId = parseInt(id || "0", 10);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [content, setContent] = useState("");
  const [agentMode, setAgentMode] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const { data: chat, isLoading: chatLoading } = useGetChat(chatId, {
    query: { enabled: !!chatId, queryKey: getGetChatQueryKey(chatId) },
  });

  const { data: messages, isLoading: msgsLoading } = useListMessages(chatId, {
    query: { enabled: !!chatId, queryKey: getListMessagesQueryKey(chatId) },
  });

  const { data: models } = useListAiModels();
  const sendMessage = useSendMessage();
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const regenerateMessage = useRegenerateMessage();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }, [content]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() || sendMessage.isPending) return;
    const messageContent = content;
    setContent("");
    sendMessage.mutate(
      { chatId, data: { content: messageContent, model: selectedModel ?? chat?.model ?? undefined, agentMode } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId) });
          queryClient.invalidateQueries({ queryKey: getGetChatQueryKey(chatId) });
        },
      }
    );
  };

  const handleCopy = (msgId: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 1500);
    });
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
        onClick={() => setModelDropdownOpen(false)}
      >
        {msgsLoading ? (
          <div className="space-y-8 max-w-3xl mx-auto">
            <Skeleton className="h-20 w-3/4 ml-auto rounded-2xl" />
            <Skeleton className="h-32 w-4/5 rounded-2xl" />
          </div>
        ) : messages?.length === 0 ? (
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
                        ? <p className="whitespace-pre-wrap">{msg.content}</p>
                        : <MessageContent content={msg.content} isDark={isDark} />
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

            {/* Typing indicator */}
            {sendMessage.isPending && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-600 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-foreground animate-pulse" />
                </div>
                <div className={cn(
                  "px-4 py-3 rounded-2xl rounded-tl-sm border flex items-center gap-2",
                  isDark ? "bg-background border-border" : "bg-card border-border"
                )}>
                  {agentMode && (
                    <span className="text-xs text-muted-foreground mr-1">Thinking</span>
                  )}
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </span>
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
                  <VoiceChat
                    onTranscript={(text) => { setContent(text); setTimeout(handleSend, 100); }}
                    lastAiMessage={messages?.filter(m => m.role === "assistant").at(-1)?.content}
                    disabled={sendMessage.isPending}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/50 hidden sm:block">Shift+Enter for new line</span>
                  <button
                    type="submit"
                    disabled={!content.trim() || sendMessage.isPending}
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
                      content.trim() && !sendMessage.isPending
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    {sendMessage.isPending
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
