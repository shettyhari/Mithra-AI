import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Star, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Persona {
  id: number;
  name: string;
  description: string | null;
  systemPrompt: string;
  avatarEmoji: string;
  isDefault: boolean;
  createdAt: string;
}

const PRESET_PROMPTS = [
  { label: "Family Assistant", emoji: "👨‍👩‍👧‍👦", prompt: "You are a warm, supportive family assistant. Help with family schedules, activities, and decisions with care and positivity." },
  { label: "Study Coach", emoji: "📚", prompt: "You are an educational coach. Break down complex topics clearly, encourage learning, and adapt explanations to the user's level." },
  { label: "Health Guide", emoji: "💪", prompt: "You are a wellness advisor. Provide balanced guidance on health, nutrition, and fitness. Always remind users to consult professionals for medical decisions." },
  { label: "Creative Partner", emoji: "🎨", prompt: "You are a creative collaborator. Help brainstorm ideas, write stories, plan projects, and think outside the box with enthusiasm." },
  { label: "Finance Helper", emoji: "💰", prompt: "You are a practical finance guide. Help with budgeting, savings goals, and financial decisions in a clear, jargon-free way." },
];

function PersonaForm({ persona, onSave, onCancel }: {
  persona?: Persona;
  onSave: (data: Partial<Persona>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: persona?.name ?? "",
    description: persona?.description ?? "",
    systemPrompt: persona?.systemPrompt ?? "",
    avatarEmoji: persona?.avatarEmoji ?? "🤖",
    isDefault: persona?.isDefault ?? false,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="space-y-1 w-20">
          <Label>Emoji</Label>
          <Input value={form.avatarEmoji} onChange={e => setForm(f => ({ ...f, avatarEmoji: e.target.value }))}
            className="text-center text-2xl h-12" maxLength={4} />
        </div>
        <div className="space-y-1 flex-1">
          <Label>Name</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Study Coach" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Brief description of this persona" />
      </div>
      <div className="space-y-1">
        <Label>System Prompt</Label>
        <Textarea value={form.systemPrompt} onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
          placeholder="Instructions that define how this AI persona behaves…"
          className="min-h-[120px] resize-y" />
        <p className="text-xs text-muted-foreground">Or use a preset:</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_PROMPTS.map(p => (
            <button key={p.label} onClick={() => setForm(f => ({ ...f, systemPrompt: p.prompt, avatarEmoji: p.emoji, name: f.name || p.label }))}
              className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors border border-border">
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.isDefault} onCheckedChange={v => setForm(f => ({ ...f, isDefault: v }))} id="is-default" />
        <Label htmlFor="is-default">Set as default persona</Label>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name.trim() || !form.systemPrompt.trim()}>
          {persona ? "Save Changes" : "Create Persona"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function PersonasPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Persona | null>(null);
  const [deleting, setDeleting] = useState<Persona | null>(null);

  const authHeaders = async (extra?: Record<string, string>) => {
    const tok = await getToken();
    return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...extra };
  };

  const { data: personas = [], isLoading } = useQuery<Persona[]>({
    queryKey: ["personas"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}api/personas`, { credentials: "include", headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed to load personas");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Persona>) => {
      const res = await fetch(`${BASE_URL}api/personas`, {
        method: "POST", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["personas"] }); setShowCreate(false); toast({ title: "Persona created" }); },
    onError: () => toast({ title: "Failed to create persona", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Persona> }) => {
      const res = await fetch(`${BASE_URL}api/personas/${id}`, {
        method: "PUT", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["personas"] }); setEditing(null); toast({ title: "Persona updated" }); },
    onError: () => toast({ title: "Failed to update persona", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE_URL}api/personas/${id}`, { method: "DELETE", credentials: "include", headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["personas"] }); setDeleting(null); toast({ title: "Persona deleted" }); },
    onError: () => toast({ title: "Failed to delete persona", variant: "destructive" }),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Personas</h1>
          <p className="text-muted-foreground text-sm mt-1">Create custom AI personalities for different tasks and moods.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Persona
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : personas.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">No personas yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first AI persona to get started.</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="w-4 h-4" /> Create Persona</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {personas.map(p => (
            <Card key={p.id} className="group relative hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{p.avatarEmoji}</span>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {p.name}
                        {p.isDefault && <Badge variant="secondary" className="text-[10px] gap-1"><Star className="w-2.5 h-2.5" />Default</Badge>}
                      </CardTitle>
                      {p.description && <CardDescription className="text-xs mt-0.5">{p.description}</CardDescription>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground line-clamp-3">{p.systemPrompt}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Persona</DialogTitle></DialogHeader>
          <PersonaForm onSave={data => createMutation.mutate(data)} onCancel={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Persona</DialogTitle></DialogHeader>
          {editing && <PersonaForm persona={editing}
            onSave={data => updateMutation.mutate({ id: editing.id, data })}
            onCancel={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This persona will be permanently removed. Any chats using it will keep their messages.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleting && deleteMutation.mutate(deleting.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
