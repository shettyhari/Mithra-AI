import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Brain, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

type MemoryCategory = "general" | "preference" | "fact" | "goal" | "relationship";

interface Memory {
  id: number;
  content: string;
  category: MemoryCategory;
  sourceChatId: number | null;
  createdAt: string;
}

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  general: "secondary",
  preference: "outline",
  fact: "outline",
  goal: "outline",
  relationship: "outline",
};

const CATEGORY_EMOJI: Record<MemoryCategory, string> = {
  general: "💡",
  preference: "❤️",
  fact: "📌",
  goal: "🎯",
  relationship: "👥",
};

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  general: "General",
  preference: "Preference",
  fact: "Fact",
  goal: "Goal",
  relationship: "Relationship",
};

export default function MemoriesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteAll, setDeleteAll] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("general");

  const authHeaders = async (extra?: Record<string, string>) => {
    const tok = await getToken();
    return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...extra };
  };

  const { data: memories = [], isLoading } = useQuery<Memory[]>({
    queryKey: ["memories"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}api/memories`, { credentials: "include", headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { content: string; category: MemoryCategory }) => {
      const res = await fetch(`${BASE_URL}api/memories`, {
        method: "POST", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories"] });
      setShowCreate(false); setNewContent(""); setNewCategory("general");
      toast({ title: "Memory saved" });
    },
    onError: () => toast({ title: "Failed to save memory", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE_URL}api/memories/${id}`, { method: "DELETE", credentials: "include", headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memories"] }); toast({ title: "Memory deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const ids = memories.map(m => m.id);
      const res = await fetch(`${BASE_URL}api/memories`, {
        method: "DELETE", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memories"] }); setDeleteAll(false); toast({ title: "All memories cleared" }); },
    onError: () => toast({ title: "Failed to clear memories", variant: "destructive" }),
  });

  const filtered = filterCategory === "all" ? memories : memories.filter(m => m.category === filterCategory);

  const groupedByCategory = (["preference", "goal", "fact", "relationship", "general"] as MemoryCategory[])
    .map(cat => ({ cat, items: filtered.filter(m => m.category === cat) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Memory</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Facts Mithra remembers about you — injected into every conversation for personalised responses.
          </p>
        </div>
        <div className="flex gap-2">
          {memories.length > 0 && (
            <Button variant="outline" onClick={() => setDeleteAll(true)} className="gap-2 text-destructive hover:text-destructive border-destructive/30">
              <Trash2 className="w-4 h-4" /> Clear All
            </Button>
          )}
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Memory
          </Button>
        </div>
      </div>

      {/* Filter */}
      {memories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterCategory("all")}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterCategory === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            All ({memories.length})
          </button>
          {(["preference", "goal", "fact", "relationship", "general"] as MemoryCategory[]).map(cat => {
            const count = memories.filter(m => m.category === cat).length;
            if (!count) return null;
            return (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                {CATEGORY_EMOJI[cat]} {CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : memories.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">No memories yet</h3>
            <p className="text-muted-foreground text-sm mb-2">Add things you want Mithra to always remember about you.</p>
            <p className="text-muted-foreground/60 text-xs mb-6">Memories are also extracted automatically from chats when you use the <Sparkles className="w-3 h-3 inline" /> extract button.</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="w-4 h-4" /> Add Memory</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByCategory.map(({ cat, items }) => (
            <div key={cat}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <span>{CATEGORY_EMOJI[cat]}</span> {CATEGORY_LABELS[cat]}
              </h3>
              <div className="space-y-2">
                {items.map(mem => (
                  <div key={mem.id} className="group flex items-start justify-between gap-3 p-3 rounded-xl border border-border hover:border-primary/20 bg-card transition-colors">
                    <p className="text-sm leading-relaxed flex-1">{mem.content}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground/60 hidden sm:block">
                        {formatDistanceToNow(new Date(mem.createdAt), { addSuffix: true })}
                      </span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteMutation.mutate(mem.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Memory Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Memory</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={newCategory} onValueChange={v => setNewCategory(v as MemoryCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CATEGORY_LABELS) as [MemoryCategory, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{CATEGORY_EMOJI[v]} {l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Memory</Label>
              <Input value={newContent} onChange={e => setNewContent(e.target.value)}
                placeholder={newCategory === "preference" ? "e.g. I prefer vegetarian meals" :
                  newCategory === "goal" ? "e.g. I'm training for a 5K in June" :
                  newCategory === "fact" ? "e.g. I'm a software engineer in Seattle" :
                  newCategory === "relationship" ? "e.g. My partner's name is Alex" : "Something Mithra should always know…"}
                onKeyDown={e => e.key === "Enter" && newContent.trim() && createMutation.mutate({ content: newContent.trim(), category: newCategory })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => newContent.trim() && createMutation.mutate({ content: newContent.trim(), category: newCategory })}
              disabled={!newContent.trim() || createMutation.isPending}>
              Save Memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear all confirm */}
      <AlertDialog open={deleteAll} onOpenChange={setDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all memories?</AlertDialogTitle>
            <AlertDialogDescription>All {memories.length} memories will be permanently deleted. Mithra will start fresh without any remembered context.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteAllMutation.mutate()}>Clear All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
