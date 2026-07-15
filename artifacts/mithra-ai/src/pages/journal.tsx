import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { BookOpen, Plus, Sparkles, Trash2, ChevronLeft, Flame, BarChart2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, subDays } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type JournalEntry = {
  id: number; date: string; title?: string; content: string;
  mood?: number; moodLabel?: string; tags?: string;
  aiReflection?: string; aiReflectedAt?: string;
};
type MoodStats = { total: number; avgMood: number | null; streak: number; moodByDay: { date: string; mood: number | null; label: string | null }[] };

const MOODS = [
  { val: 1, label: "Terrible", emoji: "😢", color: "#ef4444" },
  { val: 2, label: "Bad", emoji: "😕", color: "#f97316" },
  { val: 3, label: "Okay", emoji: "😐", color: "#eab308" },
  { val: 4, label: "Good", emoji: "🙂", color: "#22c55e" },
  { val: 5, label: "Amazing", emoji: "😄", color: "#8b5cf6" },
];

export default function JournalPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState<MoodStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: "", content: "", mood: 0, moodLabel: "", tags: "",
  });
  const [activeView, setActiveView] = useState<"entries"|"stats">("entries");

  const auth = async () => {
    const tok = await getToken();
    return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), "Content-Type": "application/json" };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesR, statsR] = await Promise.all([
        fetch(`${BASE}/api/journal`, { headers: await auth() }),
        fetch(`${BASE}/api/journal/stats/mood`, { headers: await auth() }),
      ]);
      if (entriesR.ok) setEntries(await entriesR.json());
      if (statsR.ok) setStats(await statsR.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    const today = new Date().toISOString().slice(0, 10);
    const existing = entries.find(e => e.date === today);
    if (existing) {
      openEntry(existing);
      return;
    }
    setForm({ date: today, title: "", content: "", mood: 0, moodLabel: "", tags: "" });
    setSelectedEntry(null);
    setIsNew(true);
    setShowEditor(true);
  };

  const openEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setForm({
      date: entry.date, title: entry.title ?? "", content: entry.content,
      mood: entry.mood ?? 0, moodLabel: entry.moodLabel ?? "",
      tags: entry.tags ? (() => { try { return JSON.parse(entry.tags!).join(", "); } catch { return ""; } })() : "",
    });
    setIsNew(false);
    setShowEditor(true);
  };

  const save = async () => {
    if (!form.content.trim()) return;
    const body = {
      date: form.date, title: form.title || undefined, content: form.content,
      mood: form.mood || undefined, moodLabel: form.moodLabel || undefined,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    };
    if (isNew) {
      const r = await fetch(`${BASE}/api/journal`, {
        method: "POST", headers: await auth(), body: JSON.stringify(body),
      });
      if (r.ok) {
        const entry = await r.json();
        setEntries(prev => [entry, ...prev]);
        setSelectedEntry(entry);
        setIsNew(false);
        toast({ title: "Entry saved!" });
      } else if (r.status === 409) {
        const d = await r.json();
        const existing = entries.find(e => e.id === d.id);
        if (existing) openEntry(existing);
        toast({ title: "Entry for today already exists", description: "Opening it for editing." });
        return;
      }
    } else if (selectedEntry) {
      const r = await fetch(`${BASE}/api/journal/${selectedEntry.id}`, {
        method: "PUT", headers: await auth(), body: JSON.stringify(body),
      });
      if (r.ok) {
        const updated = await r.json();
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
        setSelectedEntry(updated);
        toast({ title: "Entry updated!" });
      }
    }
    await load();
  };

  const deleteEntry = async (id: number) => {
    const r = await fetch(`${BASE}/api/journal/${id}`, { method: "DELETE", headers: await auth() });
    if (r.ok) {
      setEntries(prev => prev.filter(e => e.id !== id));
      if (selectedEntry?.id === id) { setShowEditor(false); setSelectedEntry(null); }
      toast({ title: "Entry deleted" });
    }
  };

  const reflect = async () => {
    if (!selectedEntry) return;
    // Save first if dirty
    await save();
    setReflecting(true);
    try {
      const r = await fetch(`${BASE}/api/journal/${selectedEntry.id}/reflect`, {
        method: "POST", headers: await auth(), body: "{}",
      });
      if (r.ok) {
        const d = await r.json();
        setSelectedEntry(d.entry);
        setEntries(prev => prev.map(e => e.id === d.entry.id ? d.entry : e));
        toast({ title: "AI reflection generated!" });
      }
    } finally { setReflecting(false); }
  };

  const moodFor = (val: number) => MOODS.find(m => m.val === val);

  // Mood heatmap last 30 days
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i).toISOString().slice(0, 10);
    const stat = stats?.moodByDay.find(m => m.date === d);
    return { date: d, mood: stat?.mood ?? null };
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your private AI-powered diary</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> New Entry</Button>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Entries</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground flex items-center justify-center gap-1.5">
              <Flame className="w-5 h-5 text-orange-500" /> {stats.streak}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Day Streak</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {stats.avgMood ? moodFor(Math.round(stats.avgMood))?.emoji : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Avg Mood</p>
          </div>
        </div>
      )}

      {/* Mood heatmap */}
      {stats && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Last 30 Days</p>
          <div className="flex gap-1 flex-wrap">
            {last30.map(day => {
              const mood = day.mood ? moodFor(day.mood) : null;
              return (
                <div key={day.date} title={`${day.date}${mood ? ` — ${mood.label}` : ""}`}
                  className="w-6 h-6 rounded-md transition-all cursor-default"
                  style={{ backgroundColor: mood ? mood.color + "88" : "hsl(var(--muted))" }} />
              );
            })}
          </div>
          <div className="flex gap-4 mt-2">
            {MOODS.map(m => (
              <div key={m.val} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: m.color + "88" }} />
                <span className="text-xs text-muted-foreground">{m.emoji}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entries list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Start your journal</p>
          <p className="text-sm mt-1">Write your first entry today</p>
          <Button className="mt-4" onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Write Today</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            const mood = entry.mood ? moodFor(entry.mood) : null;
            return (
              <div key={entry.id}
                className="bg-card border border-border rounded-2xl p-5 cursor-pointer hover:border-primary/30 transition-all group"
                onClick={() => openEntry(entry)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {format(parseISO(entry.date), "EEEE, MMMM d, yyyy")}
                      </span>
                      {mood && <span className="text-base" title={mood.label}>{mood.emoji}</span>}
                      {entry.aiReflection && <Sparkles className="w-3.5 h-3.5 text-primary opacity-70" />}
                    </div>
                    {entry.title && <h3 className="font-semibold text-foreground mb-1">{entry.title}</h3>}
                    <p className="text-sm text-muted-foreground line-clamp-2">{entry.content}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={e => { e.stopPropagation(); deleteEntry(entry.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={v => { if (!v) { setShowEditor(false); setSelectedEntry(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-4.5 h-4.5 text-primary" />
              {isNew ? "New Entry" : `Journal — ${form.date}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3">
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="w-auto text-sm" disabled={!isNew} />
              <Input placeholder="Title (optional)" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="flex-1" />
            </div>

            {/* Mood picker */}
            <div>
              <label className="text-sm font-medium mb-2 block">How are you feeling?</label>
              <div className="flex gap-2">
                {MOODS.map(m => (
                  <button key={m.val}
                    onClick={() => setForm(p => ({ ...p, mood: m.val, moodLabel: m.label.toLowerCase() }))}
                    className={cn("flex-1 py-2 rounded-xl text-xl flex flex-col items-center gap-0.5 transition-all border",
                      form.mood === m.val ? "ring-2 border-transparent scale-105" : "border-border bg-muted/30 hover:bg-muted")}
                    style={{ ...(form.mood === m.val ? { boxShadow: `0 0 0 2px ${m.color}` } : {}) }}
                    title={m.label}>
                    {m.emoji}
                    <span className="text-[10px] text-muted-foreground hidden sm:block">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              placeholder="Write about your day, thoughts, or anything on your mind..."
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              className="min-h-[200px] resize-none" />

            <Input placeholder="Tags (comma-separated, e.g. work, family, gratitude)" value={form.tags}
              onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />

            {/* AI Reflection */}
            {selectedEntry && !isNew && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-primary flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> AI Reflection
                  </p>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={reflect} disabled={reflecting}>
                    {reflecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {selectedEntry.aiReflection ? "Regenerate" : "Generate"}
                  </Button>
                </div>
                {selectedEntry.aiReflection ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedEntry.aiReflection}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Get AI-powered insights and reflections on your journal entry.</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            {!isNew && selectedEntry && (
              <Button variant="destructive" size="sm" onClick={() => deleteEntry(selectedEntry.id)}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowEditor(false)}>Close</Button>
            <Button onClick={save}>Save Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
