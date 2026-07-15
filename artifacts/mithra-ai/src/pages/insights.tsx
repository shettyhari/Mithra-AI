import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, TrendingUp, MessageSquare, CheckSquare, Brain, Zap, BarChart3, Loader2, RefreshCw, FolderOpen } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { RadialBarChart, RadialBar, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

interface Stats {
  totalChats: number;
  messagesThisWeek: number;
  totalTasks: number;
  completedTasks: number;
  totalFiles: number;
  tokensThisMonth: number;
  activeHabits: number;
  habitCompletionsThisWeek: number;
  upcomingEvents: number;
}

interface Insight {
  id: number;
  type: string;
  title: string;
  content: string;
  metadata?: string;
  generatedAt: string;
}

const INSIGHT_TYPES = [
  { value: "weekly_summary", label: "Weekly Summary", icon: BarChart3, color: "text-purple-400" },
  { value: "productivity_tip", label: "Productivity Tip", icon: Zap, color: "text-yellow-400" },
  { value: "habit_insight", label: "Habit Insight", icon: TrendingUp, color: "text-green-400" },
];

export default function InsightsPage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [generating, setGenerating] = useState<string | null>(null);

  const authHeaders = async (extra?: Record<string, string>) => {
    const tok = await getToken();
    return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...extra };
  };

  const { data: stats } = useQuery<Stats>({
    queryKey: ["insights-stats"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}api/insights/stats`, { credentials: "include", headers: await authHeaders() });
      return res.ok ? res.json() : null;
    },
  });

  const { data: insights = [], isLoading } = useQuery<Insight[]>({
    queryKey: ["insights"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}api/insights`, { credentials: "include", headers: await authHeaders() });
      return res.ok ? res.json() : [];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async ({ type, force }: { type: string; force?: boolean }) => {
      setGenerating(type);
      const res = await fetch(`${BASE_URL}api/insights/generate`, {
        method: "POST", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ type, force }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["insights"] }); toast({ title: "Insight generated ✨" }); },
    onError: () => toast({ title: "Failed to generate insight", variant: "destructive" }),
    onSettled: () => setGenerating(null),
  });

  const taskCompletion = stats ? Math.round((stats.completedTasks / Math.max(stats.totalTasks, 1)) * 100) : 0;
  const habitCompletion = stats ? Math.round((stats.habitCompletionsThisWeek / Math.max(stats.activeHabits * 7, 1)) * 100) : 0;

  const statCards = stats ? [
    { icon: MessageSquare, label: "Chats", value: stats.totalChats, sub: `${stats.messagesThisWeek} msgs this week`, color: "text-blue-400", bg: "bg-blue-400/10" },
    { icon: CheckSquare, label: "Task Rate", value: `${taskCompletion}%`, sub: `${stats.completedTasks}/${stats.totalTasks} done`, color: "text-green-400", bg: "bg-green-400/10" },
    { icon: TrendingUp, label: "Habit Rate", value: `${habitCompletion}%`, sub: `${stats.habitCompletionsThisWeek} completions/week`, color: "text-purple-400", bg: "bg-purple-400/10" },
    { icon: Brain, label: "AI Tokens", value: stats.tokensThisMonth.toLocaleString(), sub: "this month", color: "text-orange-400", bg: "bg-orange-400/10" },
    { icon: FolderOpen, label: "Files", value: stats.totalFiles, sub: "stored", color: "text-cyan-400", bg: "bg-cyan-400/10" },
    { icon: Zap, label: "Upcoming", value: stats.upcomingEvents, sub: "events ahead", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  ] : [];

  const radialData = stats ? [
    { name: "Tasks", value: taskCompletion, fill: "#10b981" },
    { name: "Habits", value: habitCompletion, fill: "#8b5cf6" },
  ] : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Insights</h1>
          <p className="text-muted-foreground text-sm mt-1">Intelligence about your family's patterns and productivity</p>
        </div>
        <Button onClick={() => generateMutation.mutate({ type: "weekly_summary" })} disabled={!!generating} className="gap-2">
          {generating === "weekly_summary" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Summary
        </Button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {statCards.map(({ icon: Icon, label, value, sub, color, bg }) => (
            <div key={label} className={cn("rounded-2xl border p-4", isDark ? "bg-background/40 border-border/50" : "bg-card border-border")}>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", bg)}>
                <Icon className={cn("w-5 h-5", color)} />
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Progress Rings + Generate Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Completion Visual */}
        {stats && (
          <div className={cn("rounded-2xl border p-5", isDark ? "bg-background/40 border-border/50" : "bg-card border-border")}>
            <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Completion Overview</h3>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="40%" outerRadius="90%" data={radialData}>
                    <RadialBar dataKey="value" cornerRadius={4} background={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-sm">Tasks: {taskCompletion}%</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-violet-500" /><span className="text-sm">Habits: {habitCompletion}%</span></div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>{stats.messagesThisWeek} AI messages this week</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Generate Insight Types */}
        <div className={cn("rounded-2xl border p-5", isDark ? "bg-background/40 border-border/50" : "bg-card border-border")}>
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Generate Insight</h3>
          <div className="space-y-2">
            {INSIGHT_TYPES.map(({ value, label, icon: Icon, color }) => (
              <button key={value} onClick={() => generateMutation.mutate({ type: value })}
                disabled={!!generating}
                className={cn("w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors",
                  isDark ? "border-border/50 hover:bg-white/[0.04]" : "border-border hover:bg-muted/50")}>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  {generating === value ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Icon className={cn("w-4 h-4", color)} />}
                </div>
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Insights Feed */}
      <div>
        <h3 className="font-semibold text-lg mb-4">Recent Insights</h3>
        {isLoading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-32 rounded-2xl bg-muted/20 animate-pulse" />)}</div>
        ) : insights.length === 0 ? (
          <div className={cn("rounded-2xl border p-10 text-center", isDark ? "bg-background/40 border-border/50" : "bg-card border-border")}>
            <Brain className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground">No insights yet. Generate your first one above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.map(insight => {
              const type = INSIGHT_TYPES.find(t => t.value === insight.type);
              const Icon = type?.icon || Sparkles;
              return (
                <div key={insight.id} className={cn("rounded-2xl border p-5", isDark ? "bg-background/40 border-border/50" : "bg-card border-border")}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className={cn("w-4 h-4", type?.color || "text-primary")} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{insight.title}</h4>
                        <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(parseISO(insight.generatedAt), { addSuffix: true })}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-[10px]">{type?.label || insight.type}</Badge>
                      <button onClick={() => generateMutation.mutate({ type: insight.type, force: true })} className="p-1 rounded hover:bg-muted/50" title="Regenerate">
                        <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{insight.content}</p>
                  {insight.metadata && (() => {
                    try {
                      const m = JSON.parse(insight.metadata);
                      return (
                        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                          {Object.entries(m).slice(0, 5).map(([k, v]) => (
                            <span key={k}>{k.replace(/([A-Z])/g, ' $1').trim()}: <strong className="text-foreground">{String(v)}</strong></span>
                          ))}
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
