import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { BASE_URL } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Users, Cake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface FamilyMember {
  id: number;
  name: string;
  relationship: "spouse" | "child" | "parent" | "sibling" | "other";
  birthday: string | null;
  notes: string | null;
  avatarUrl: string | null;
  preferences: string | null;
  createdAt: string;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: "Spouse / Partner",
  child: "Child",
  parent: "Parent",
  sibling: "Sibling",
  other: "Other",
};

const RELATIONSHIP_EMOJI: Record<string, string> = {
  spouse: "💑",
  child: "🧒",
  parent: "👴",
  sibling: "👫",
  other: "🧑",
};

function getAge(birthday: string | null): string | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--;
  return `${age} years old`;
}

function upcomingBirthday(birthday: string | null): string | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  const today = new Date();
  const nextBday = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (nextBday < today) nextBday.setFullYear(today.getFullYear() + 1);
  const diff = Math.round((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "🎂 Birthday today!";
  if (diff <= 7) return `🎂 Birthday in ${diff} day${diff > 1 ? "s" : ""}!`;
  return null;
}

function MemberForm({ member, onSave, onCancel }: {
  member?: FamilyMember;
  onSave: (data: Partial<FamilyMember>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<{
    name: string;
    relationship: FamilyMember["relationship"];
    birthday: string;
    notes: string;
    preferences: string;
  }>({
    name: member?.name ?? "",
    relationship: member?.relationship ?? "child",
    birthday: member?.birthday ?? "",
    notes: member?.notes ?? "",
    preferences: member?.preferences ?? "",
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
        </div>
        <div className="space-y-1">
          <Label>Relationship</Label>
          <Select value={form.relationship} onValueChange={v => setForm(f => ({ ...f, relationship: v as FamilyMember["relationship"] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(RELATIONSHIP_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Birthday <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input type="date" value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
      </div>
      <div className="space-y-1">
        <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Interests, school, work, anything helpful for Mithra to know…" className="min-h-[80px]" />
      </div>
      <div className="space-y-1">
        <Label>AI Context Preferences <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Textarea value={form.preferences} onChange={e => setForm(f => ({ ...f, preferences: e.target.value }))}
          placeholder="Special dietary needs, allergies, likes/dislikes to inject into AI context…" className="min-h-[60px]" />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name.trim() || !form.relationship}>
          {member ? "Save Changes" : "Add Member"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function FamilyPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [deleting, setDeleting] = useState<FamilyMember | null>(null);

  const authHeaders = async (extra?: Record<string, string>) => {
    const tok = await getToken();
    return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...extra };
  };

  const { data: members = [], isLoading } = useQuery<FamilyMember[]>({
    queryKey: ["family"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}api/family`, { credentials: "include", headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<FamilyMember>) => {
      const res = await fetch(`${BASE_URL}api/family`, {
        method: "POST", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["family"] }); setShowCreate(false); toast({ title: "Family member added" }); },
    onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FamilyMember> }) => {
      const res = await fetch(`${BASE_URL}api/family/${id}`, {
        method: "PUT", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["family"] }); setEditing(null); toast({ title: "Member updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE_URL}api/family/${id}`, { method: "DELETE", credentials: "include", headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["family"] }); setDeleting(null); toast({ title: "Member removed" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Family Profiles</h1>
          <p className="text-muted-foreground text-sm mt-1">Add family members so Mithra can personalise advice and remember context.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Member
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : members.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">No family members yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Add your family so Mithra can better assist everyone.</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="w-4 h-4" /> Add Member</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {members.map(m => {
            const bAlert = upcomingBirthday(m.birthday);
            const age = getAge(m.birthday);
            return (
              <Card key={m.id} className="group relative hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{RELATIONSHIP_EMOJI[m.relationship] ?? "🧑"}</span>
                      <div>
                        <CardTitle className="text-base">{m.name}</CardTitle>
                        <Badge variant="outline" className="text-[10px] mt-0.5">{RELATIONSHIP_LABELS[m.relationship]}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(m)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {m.birthday && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Cake className="w-3 h-3" />
                      <span>{new Date(m.birthday).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</span>
                      {age && <span className="text-muted-foreground/70">· {age}</span>}
                    </div>
                  )}
                  {bAlert && <p className="text-xs text-amber-500 font-medium">{bAlert}</p>}
                  {m.notes && <p className="text-xs text-muted-foreground line-clamp-2">{m.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Family Member</DialogTitle></DialogHeader>
          <MemberForm onSave={data => createMutation.mutate(data)} onCancel={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Family Member</DialogTitle></DialogHeader>
          {editing && <MemberForm member={editing}
            onSave={data => updateMutation.mutate({ id: editing.id, data })}
            onCancel={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This profile will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleting && deleteMutation.mutate(deleting.id)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
