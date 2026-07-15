import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { BASE_URL } from "@/lib/queryClient";
import { Zap, Lock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SharedChat {
  chat: { id: number; title: string; model: string | null; createdAt: string };
  messages: Array<{ id: number; role: string; content: string; model: string | null; createdAt: string }>;
}

function MessageBubble({ msg }: { msg: SharedChat["messages"][0] }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold mt-0.5",
        isUser ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-purple-500 to-cyan-500 text-white")}>
        {isUser ? "U" : "M"}
      </div>
      <div className={cn("max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
        isUser ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm")}>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {msg.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim()}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export default function SharedChatPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery<SharedChat>({
    queryKey: ["shared", token],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}api/shared/${token}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4">
        <Lock className="w-12 h-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Chat not found</h1>
        <p className="text-muted-foreground text-sm text-center">This shared link may have expired or been revoked.</p>
        <a href="/" className="text-primary hover:underline text-sm">Go to Mithra →</a>
      </div>
    );
  }

  const userMessages = data.messages.filter(m => m.role !== "system");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm truncate">{data.chat.title}</h1>
            <p className="text-xs text-muted-foreground">Shared via Mithra · {new Date(data.chat.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground border border-border/50 rounded-full px-2.5 py-1">
            <MessageSquare className="w-3 h-3" />
            {userMessages.length} messages
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {userMessages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-4 py-8 text-center">
        <a href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Zap className="w-3.5 h-3.5 text-primary" />
          Powered by Mithra — your family AI
        </a>
      </footer>
    </div>
  );
}
