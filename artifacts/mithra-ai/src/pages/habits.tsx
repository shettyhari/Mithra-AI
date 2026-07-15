import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Flame, CheckCircle2, Circle, Trash2, Edit2, Target, Trophy, TrendingUp, AlertCircle } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

interface Habit {
  id: number;
  title: string;
  description?: string;
  emoji: string;
  color: string;
  frequency: string;
  targetDaysPerWeek: number;
  isActive: boolean;
  startDate: string;
  completedToday: boolean;
  current: number;
  longest: number;
  recentDates: string[];
}

const HABIT_COLORS = ["#8b5cf6","#3b82f6","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6"];
const HABIT_EMOJIS = ["⭐","🏃","💪","📚","🧘","💧","🥗","😴","✍️","🎯","🎨","🎵"];

function HabitHeatmap({ dates, color }: { dates: string[]; color: string }) {
  const today = new Date();
  const last30 = Array.from({ length: 30 }, (_, i) => format(subDays(today, 29 - i), "yyyy-MM-dd"));
  return (
    <div className="flex gap-1 flex-wrap">
      {last30.map(d => (
        <div key={d} className="w-4 h-4 rounded-sm transition-colors" title={d}
          style={{ backgroundColor: dates.includes(d) ? color : "rgb(var(--muted) / 0.3)" }} />
      ))}
    </div>
  );
}

export default function HabitsPage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [form, setForm] = useState({ title: "", description: "", emoji: "⭐", color: "#8b5cf6", frequency: "daily", targetDaysPerWeek: 7 });

  const authHeaders = async (extra?: Record<string, string>) => {
    const tok = await getToken();
    return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...extra };
  };

  const { data: habits = [], isLoading, error: habitsError } = useQuery<Habit[]>({
    queryKey: ["habits"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}api/habits`, { credentials: "include", headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed to load habits");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (habitId: number) => {
      const res = await fetch(`${BASE_URL}api/habits/${habitId}/complete`, {
        method: "POST", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ date: format(new Date(), "yyyy-MM-dd") }),
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
    onError: () => toast({ title: "Failed to toggle", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`${BASE_URL}api/habits`, {
        method: "POST", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["habits"] }); setShowCreate(false); resetForm(); toast({ title: "Habit created 🎯" }); },
    onError: () => toast({ title: "Failed to create habit", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof form> }) => {
      const res = await fetch(`${BASE_URL}api/habits/${id}`, {
        method: "PUT", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["habits"] }); setEditing(null); toast({ title: "Habit updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE_URL}api/habits/${id}`, { method: "DELETE", credentials: "include", headers: await authHeaders() });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["habits"] }); toast({ title: "Habit deleted" }); },
  });

  const resetForm = () => setForm({ title: "", description: "", emoji: "⭐", color: "#8b5cf6", frequency: "daily", targetDaysPerWeek: 7 });

  const openEdit = (h: Habit) => {
    setEditing(h);
    setForm({ title: h.title, description: h.description || "", emoji: h.emoji, color: h.color, frequency: h.frequency, targetDaysPerWeek: h.targetDaysPerWeek });
  };

  const completedToday = habits.filter(h => h.completedToday).length;
  const totalActive = habits.filter(h => h.isActive).length;
  const maxStreak = Math.max(0, ...habits.map(h => h.current));

  if (habitsError) return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
      <AlertCircle className="w-8 h-8 text-destructive" />
      <p className="text-sm">Failed to load habits. Please refresh the page.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Goals & Habits</h1>
          <p className="text-muted-foreground text-sm mt-1">Build consistency, one day at a time</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Habit
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: CheckCircle2, label: "Done Today", value: `${completedToday}/${totalActive}`, color: "text-green-400" },
          { icon: Flame, label: "Best Streak", value: `${maxStreak}d`, color: "text-orange-400" },
          { icon: Target, label: "Active Habits", value: totalActive, color: "text-purple-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className={cn("rounded-2xl border p-4 flex items-center gap-3", isDark ? "bg-background/40 border-border/50" : "bg-card border-border")}>
            <Icon className={cn("w-8 h-8", color)} />
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Habits List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-36 rounded-2xl bg-muted/20 animate-pulse" />)}</div>
      ) : habits.length === 0 ? (
        <div className={cn("rounded-2xl border p-12 text-center", isDark ? "bg-background/40 border-border/50" : "bg-card border-border")}>
          <Target className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground">No habits yet. Build one to get started.</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>Create First Habit</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {habits.map(habit => (
            <div key={habit.id} className={cn("rounded-2xl border p-5 group transition-all", isDark ? "bg-background/40 border-border/50 hover:border-border" : "bg-card border-border hover:shadow-sm")}>
              <div className="flex items-start gap-4">
                {/* Check button */}
                <button
                  onClick={() => toggleMutation.mutate(habit.id)}
                  disabled={toggleMutation.isPending}
                  className="mt-0.5 shrink-0 transition-transform hover:scale-110 active:scale-95"
                >
                  {habit.completedToday
                    ? <CheckCircle2 className="w-7 h-7" style={{ color: habit.color }} />
                    : <Circle className="w-7 h-7 text-muted-foreground/40" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{habit.emoji}</span>
                    <h3 className={cn("font-semibold text-base", habit.completedToday && "line-through opacity-60")}>{habit.title}</h3>
                    {habit.current > 0 && (
                      <Badge variant="outline" className="gap-1 text-xs" style={{ borderColor: habit.color, color: habit.color }}>
                        <Flame className="w-3 h-3" /> {habit.current}d
                      </Badge>
                    )}
                    {habit.longest > 0 && habit.longest === habit.current && (
                      <Badge variant="outline" className="gap-1 text-xs text-yellow-500 border-yellow-500/50">
                        <Trophy className="w-3 h-3" /> Best!
                      </Badge>
                    )}
                  </div>
                  {habit.description && <p className="text-sm text-muted-foreground mb-3">{habit.description}</p>}
                  <div className="mb-2">
                    <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Last 30 days</p>
                    <HabitHeatmap dates={habit.recentDates} color={habit.color} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                    <span>{habit.frequency} · {habit.targetDaysPerWeek}x/week</span>
                    {habit.longest > 0 && <span>Best: {habit.longest}d streak</span>}
                  </div>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEdit(habit)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => { if (confirm("Delete this habit?")) deleteMutation.mutate(habit.id); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editing} onOpenChange={o => { if (!o) { setShowCreate(false); setEditing(null); resetForm(); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit Habit" : "New Habit"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Morning run" className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Why this habit matters…" className="mt-1 resize-none" rows={2} /></div>
            <div>
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {HABIT_EMOJIS.map(e => (
                  <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                    className={cn("w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors hover:bg-muted/50", form.emoji === e && "bg-primary/20 ring-2 ring-primary")}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {HABIT_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={cn("w-7 h-7 rounded-full transition-transform hover:scale-110", form.color === c && "ring-2 ring-offset-2 ring-primary scale-110")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequency</Label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-input bg-background">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div>
                <Label>Times/week</Label>
                <Input type="number" min={1} max={7} value={form.targetDaysPerWeek}
                  onChange={e => setForm(f => ({ ...f, targetDaysPerWeek: parseInt(e.target.value) || 7 }))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditing(null); resetForm(); }}>Cancel</Button>
            <Button onClick={() => editing ? updateMutation.mutate({ id: editing.id, data: form }) : createMutation.mutate(form)}
              disabled={!form.title || createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
