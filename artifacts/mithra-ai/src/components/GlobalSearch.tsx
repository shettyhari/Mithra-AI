import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Search, MessageSquare, FileText, CheckSquare, Hash, Sparkles, Loader2, X, ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { BASE_URL } from "@/lib/queryClient";

interface SearchResult {
  type: "chat" | "file" | "task" | "message";
  id: number;
  title: string;
  subtitle?: string;
  url: string;
  relevance: number;
}

interface SearchResponse {
  results: SearchResult[];
  answer: string | null;
  query: string;
}

const TYPE_ICONS = {
  chat: MessageSquare,
  message: Hash,
  file: FileText,
  task: CheckSquare,
};

const TYPE_COLORS = {
  chat: "text-purple-400",
  message: "text-blue-400",
  file: "text-amber-400",
  task: "text-green-400",
};

const SUGGESTED = [
  "Show me recent chats",
  "What tasks are due this week?",
  "Find my uploaded files",
  "Summarize my activity",
];

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setAnswer(null);
    }
  }, [open]);

  // Global Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
        else {
          // trigger open — parent handles this, but we expose a custom event
          window.dispatchEvent(new CustomEvent("mithra-search-open"));
        }
      }
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setAnswer(null);
      return;
    }
    setLoading(true);
    try {
      const tok = await getToken();
      const resp = await fetch(`${BASE_URL}api/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ query: q, aiAnswer: true }),
      });
      if (resp.ok) {
        const data: SearchResponse = await resp.json();
        setResults(data.results);
        setAnswer(data.answer);
        setSelectedIndex(0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  const handleSelect = (url: string) => {
    setLocation(url);
    onClose();
  };

  const allItems = results;
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = allItems[selectedIndex];
      if (item) handleSelect(item.url);
      else if (query.trim()) doSearch(query);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="Search everything or ask AI anything..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {/* AI Answer */}
          {answer && (
            <div className="px-4 py-3 border-b border-border bg-primary/5">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-primary mb-1">AI Answer</p>
                  <p className="text-sm text-foreground leading-relaxed">{answer}</p>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Results</p>
              {results.map((item, idx) => {
                const Icon = TYPE_ICONS[item.type] || Hash;
                const color = TYPE_COLORS[item.type] || "text-muted-foreground";
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item.url)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      selectedIndex === idx ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", color)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                      {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty with suggestions */}
          {!query && !loading && (
            <div className="py-3">
              <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Suggestions</p>
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setQuery(s);
                    doSearch(s);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors"
                >
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">{s}</span>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {query && !loading && results.length === 0 && !answer && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No results for <span className="font-medium text-foreground">"{query}"</span></p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-4">
            <span><kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">↵</kbd> Open</span>
            <span><kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> Close</span>
          </div>
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary" />
            <span>AI-powered</span>
          </div>
        </div>
      </div>
    </div>
  );
}
