import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Target, Plus, Trash2, Sparkles, CheckCircle2, Circle, Flag, Edit2,
  TrendingUp, RefreshCw, ChevronDown, ChevronUp, Share2
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Milestone = { id: number; goalId: number; title: string; targetValue?: string; isCompleted: boolean; dueDate?: string; sortOrder: number };
type Goal = {
  id: number; title: string; description?: string; emoji: string; color: string;
  category: string; status: string; targetValue?: string; currentValue?: string;
  unit?: string; dueDate?: string; isSharedWithFamily: boolean;
  milestones: Milestone[]; progress: number;
};

const CATEGORIES = [
  { id: "personal", label: "Personal", emoji: "✨" },
  { id: "health", label: "Health", emoji: "💪" },
  { id: "finance", label: "Finance", emoji: "💰" },
  { id: "learning", label: "Learning", emoji: "📚" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { id: "career", label: "Career", emoji: "💼" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "#3b82f6", completed: "#22c55e", paused: "#f59e0b", abandoned: "#ef4444",
};

export default function GoalsPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [coaching, setCoaching] = useState<Record<number, string>>({});
  const [loadingCoach, setLoadingCoach] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("active");
  const [progressInput, setProgressInput] = useState<Record<number, string>>({});
  const [newMilestone, setNewMilestone] = useState<Record<number, string>>({});
  const [form, setForm] = useState({
    title: "", description: "", emoji: "🎯", color: "#f59e0b", category: "personal",
    targetValue: "", currentValue: "0", unit: "", dueDate: "", isSharedWithFamily: false,
  });

  const auth = async () => {
    const tok = await getToken();
    return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), "Content-Type": "application/json" };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/goals?status=${filterStatus}`, { headers: await auth() });
      if (r.ok) setGoals(await r.json());
    } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const createGoal = async () => {
    if (!form.title) return;
    const r = await fetch(`${BASE}/api/goals`, {
      method: "POST", headers: await auth(),
      body: JSON.stringify({ ...form, targetValue: form.targetValue || undefined, currentValue: form.currentValue || "0" }),
    });
    if (r.ok) {
      const goal = await r.json();
      setGoals(prev => [goal, ...prev]);
      setShowCreate(false);
      setForm({ title: "", description: "", emoji: "🎯", color: "#f59e0b", category: "personal", targetValue: "", currentValue: "0", unit: "", dueDate: "", isSharedWithFamily: false });
      toast({ title: "Goal created!" });
    }
  };

  const updateGoal = async () => {
    if (!editGoal) return;
    const r = await fetch(`${BASE}/api/goals/${editGoal.id}`, {
      method: "PUT", headers: await auth(), body: JSON.stringify(editGoal),
    });
    if (r.ok) {
      const updated = await r.json();
      setGoals(prev => prev.map(g => g.id === updated.id ? { ...updated, milestones: g.milestones, progress: g.progress } : g));
      setEditGoal(null);
    }
  };

  const deleteGoal = async (id: number) => {
    const r = await fetch(`${BASE}/api/goals/${id}`, { method: "DELETE", headers: await auth() });
    if (r.ok) { setGoals(prev => prev.filter(g => g.id !== id)); toast({ title: "Goal deleted" }); }
  };

  const updateProgress = async (goal: Goal) => {
    const val = progressInput[goal.id];
    if (!val) return;
    const r = await fetch(`${BASE}/api/goals/${goal.id}/progress`, {
      method: "PATCH", headers: await auth(), body: JSON.stringify({ value: parseFloat(val) }),
    });
    if (r.ok) {
      const updated = await r.json();
      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, ...updated, milestones: g.milestones } : g));
      setProgressInput(p => ({ ...p, [goal.id]: "" }));
      toast({ title: updated.status === "completed" ? "🎉 Goal completed!" : "Progress updated!" });
    }
  };

  const toggleMilestone = async (goalId: number, milestone: Milestone) => {
    const r = await fetch(`${BASE}/api/goals/${goalId}/milestones/${milestone.id}`, {
      method: "PATCH", headers: await auth(),
      body: JSON.stringify({ isCompleted: !milestone.isCompleted }),
    });
    if (r.ok) {
      setGoals(prev => prev.map(g => g.id === goalId ? {
        ...g,
        milestones: g.milestones.map(m => m.id === milestone.id ? { ...m, isCompleted: !m.isCompleted } : m),
      } : g));
    }
  };

  const addMilestone = async (goalId: number) => {
    const title = newMilestone[goalId];
    if (!title?.trim()) return;
    const r = await fetch(`${BASE}/api/goals/${goalId}/milestones`, {
      method: "POST", headers: await auth(), body: JSON.stringify({ title }),
    });
    if (r.ok) {
      const m = await r.json();
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, milestones: [...g.milestones, m] } : g));
      setNewMilestone(p => ({ ...p, [goalId]: "" }));
    }
  };

  const getCoaching = async (goal: Goal) => {
    setLoadingCoach(goal.id);
    try {
      const r = await fetch(`${BASE}/api/goals/${goal.id}/coach`, {
        method: "POST", headers: await auth(), body: "{}",
      });
      if (r.ok) { const d = await r.json(); setCoaching(p => ({ ...p, [goal.id]: d.advice })); }
    } finally { setLoadingCoach(null); }
  };

  const EMOJIS = ["🎯","💪","📚","💰","🏃","🧘","✈️","🏠","🎨","💼","❤️","🌱"];
  const COLORS = ["#f59e0b","#8b5cf6","#10b981","#ef4444","#3b82f6","#ec4899","#14b8a6","#f97316"];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Goals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your progress and milestones</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Goal
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
        {["active","completed","paused","abandoned"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
              filterStatus === s ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No {filterStatus} goals</p>
          {filterStatus === "active" && (
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create First Goal
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const isExpanded = expandedGoal === goal.id;
            const cat = CATEGORIES.find(c => c.id === goal.category);
            const current = parseFloat(goal.currentValue ?? "0");
            const target = goal.targetValue ? parseFloat(goal.targetValue) : null;
            const completedMilestones = goal.milestones.filter(m => m.isCompleted).length;

            return (
              <div key={goal.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Header */}
                <div className="p-5 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ backgroundColor: goal.color + "20" }}>
                      {goal.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-foreground">{goal.title}</h3>
                        {cat && <Badge variant="outline" className="text-xs">{cat.emoji} {cat.label}</Badge>}
                        {goal.isSharedWithFamily && <Badge variant="secondary" className="text-xs gap-1"><Share2 className="w-3 h-3" />Shared</Badge>}
                        {goal.dueDate && <span className="text-xs text-muted-foreground">Due {goal.dueDate}</span>}
                      </div>
                      {goal.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{goal.description}</p>}
                      {/* Progress bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-muted rounded-full">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${goal.progress}%`, backgroundColor: goal.color }} />
                        </div>
                        <span className="text-xs font-medium tabular-nums" style={{ color: goal.color }}>
                          {goal.progress}%
                        </span>
                        {target && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {current}{goal.unit ? ` ${goal.unit}` : ""} / {target}{goal.unit ? ` ${goal.unit}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={e => { e.stopPropagation(); setEditGoal(goal); }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={e => { e.stopPropagation(); deleteGoal(goal.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border/50 pt-4">
                    {/* Update progress */}
                    {goal.status === "active" && target && (
                      <div className="flex gap-2">
                        <Input
                          placeholder={`Update progress (${goal.unit || "value"})`}
                          type="number" value={progressInput[goal.id] ?? ""}
                          onChange={e => setProgressInput(p => ({ ...p, [goal.id]: e.target.value }))}
                          className="h-8 text-sm" />
                        <Button size="sm" className="h-8" onClick={() => updateProgress(goal)}>
                          <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Update
                        </Button>
                      </div>
                    )}

                    {/* Milestones */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                        Milestones ({completedMilestones}/{goal.milestones.length})
                      </p>
                      <div className="space-y-1.5">
                        {goal.milestones.map(m => (
                          <div key={m.id} className="flex items-center gap-2.5 group">
                            <button onClick={() => toggleMilestone(goal.id, m)}
                              className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                              {m.isCompleted
                                ? <CheckCircle2 className="w-4.5 h-4.5 text-primary" />
                                : <Circle className="w-4.5 h-4.5" />}
                            </button>
                            <span className={cn("text-sm flex-1", m.isCompleted && "line-through text-muted-foreground")}>
                              {m.title}
                            </span>
                            {m.dueDate && <span className="text-xs text-muted-foreground">{m.dueDate}</span>}
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <Input placeholder="Add milestone…" value={newMilestone[goal.id] ?? ""}
                            onChange={e => setNewMilestone(p => ({ ...p, [goal.id]: e.target.value }))}
                            onKeyDown={e => e.key === "Enter" && addMilestone(goal.id)}
                            className="h-7 text-sm" />
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => addMilestone(goal.id)}>Add</Button>
                        </div>
                      </div>
                    </div>

                    {/* AI Coaching */}
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> AI Coach
                        </p>
                        <Button size="sm" variant="ghost" className="h-6 text-xs gap-1"
                          onClick={() => getCoaching(goal)} disabled={loadingCoach === goal.id}>
                          {loadingCoach === goal.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {coaching[goal.id] ? "Refresh" : "Get Coaching"}
                        </Button>
                      </div>
                      {coaching[goal.id] ? (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{coaching[goal.id]}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Get personalized action steps from your AI coach.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Goal Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Goal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Goal title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <Textarea placeholder="Description (optional)" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="resize-none" rows={2} />
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(c => (
                  <button key={c.id} onClick={() => setForm(p => ({ ...p, category: c.id }))}
                    className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
                      form.category === c.id ? "bg-primary/15 border-primary/30 text-primary" : "bg-muted/30 border-transparent text-muted-foreground hover:text-foreground")}>
                    {c.emoji} {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {EMOJIS.map(em => (
                <button key={em} onClick={() => setForm(p => ({ ...p, emoji: em }))}
                  className={cn("w-9 h-9 rounded-xl text-lg flex items-center justify-center",
                    form.emoji === em ? "ring-2 ring-primary bg-primary/10" : "bg-muted/50 hover:bg-muted")}>
                  {em}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={cn("w-7 h-7 rounded-full", form.color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "")}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Target value (e.g. 100)" type="number" value={form.targetValue}
                onChange={e => setForm(p => ({ ...p, targetValue: e.target.value }))} />
              <Input placeholder="Unit (km, $, lbs…)" value={form.unit}
                onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} />
            </div>
            <Input type="date" value={form.dueDate}
              onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createGoal}>Create Goal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Dialog */}
      <Dialog open={!!editGoal} onOpenChange={v => !v && setEditGoal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Goal</DialogTitle></DialogHeader>
          {editGoal && (
            <div className="space-y-4">
              <Input value={editGoal.title} onChange={e => setEditGoal(p => p ? { ...p, title: e.target.value } : null)} />
              <div className="flex gap-2">
                {["active","paused","abandoned","completed"].map(s => (
                  <button key={s} onClick={() => setEditGoal(p => p ? { ...p, status: s } : null)}
                    className={cn("flex-1 py-1.5 rounded-xl text-xs font-medium capitalize border transition-all",
                      editGoal.status === s ? "bg-primary/15 border-primary/30 text-primary" : "bg-muted/30 border-transparent text-muted-foreground")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGoal(null)}>Cancel</Button>
            <Button onClick={updateGoal}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
