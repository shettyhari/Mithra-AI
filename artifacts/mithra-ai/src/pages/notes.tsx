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
  StickyNote, Plus, Trash2, Sparkles, Pin, PinOff, Search, X, RefreshCw, Tag
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Note = {
  id: number; title: string; content: string; color: string; emoji: string;
  isPinned: boolean; tags: string[]; aiSummary?: string; aiSummarizedAt?: string;
  createdAt: string; updatedAt: string;
};

const NOTE_COLORS = [
  "#ffffff", "#fef3c7", "#dcfce7", "#dbeafe", "#fce7f3", "#ede9fe", "#ffedd5", "#f1f5f9"
];
const NOTE_EMOJIS = ["📝","💡","⭐","🔥","✅","📌","🎯","💭","📖","🔑","💎","🌟"];

export default function NotesPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [summarizing, setSummarizing] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "", content: "", color: "#ffffff", emoji: "📝", isPinned: false, tags: "",
  });

  const auth = async () => {
    const tok = await getToken();
    return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), "Content-Type": "application/json" };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedTag) params.set("tag", selectedTag);
      const [notesR, tagsR] = await Promise.all([
        fetch(`${BASE}/api/notes?${params}`, { headers: await auth() }),
        fetch(`${BASE}/api/notes/meta/tags`, { headers: await auth() }),
      ]);
      if (notesR.ok) setNotes(await notesR.json());
      if (tagsR.ok) setAllTags(await tagsR.json());
    } finally { setLoading(false); }
  }, [search, selectedTag]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditNote(null);
    setForm({ title: "", content: "", color: "#ffffff", emoji: "📝", isPinned: false, tags: "" });
    setShowEditor(true);
  };

  const openEdit = (note: Note) => {
    setEditNote(note);
    setForm({
      title: note.title, content: note.content, color: note.color,
      emoji: note.emoji, isPinned: note.isPinned,
      tags: note.tags.join(", "),
    });
    setShowEditor(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    const body = {
      ...form,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    };
    if (!editNote) {
      const r = await fetch(`${BASE}/api/notes`, {
        method: "POST", headers: await auth(), body: JSON.stringify(body),
      });
      if (r.ok) {
        const note = await r.json();
        setNotes(prev => note.isPinned ? [note, ...prev] : [...prev, note]);
        setShowEditor(false);
        toast({ title: "Note created!" });
        await load();
      }
    } else {
      const r = await fetch(`${BASE}/api/notes/${editNote.id}`, {
        method: "PUT", headers: await auth(), body: JSON.stringify(body),
      });
      if (r.ok) {
        const note = await r.json();
        setNotes(prev => prev.map(n => n.id === note.id ? note : n));
        setShowEditor(false);
        toast({ title: "Note updated!" });
        await load();
      }
    }
  };

  const deleteNote = async (id: number) => {
    const r = await fetch(`${BASE}/api/notes/${id}`, { method: "DELETE", headers: await auth() });
    if (r.ok) {
      setNotes(prev => prev.filter(n => n.id !== id));
      setShowEditor(false);
      toast({ title: "Note deleted" });
    }
  };

  const togglePin = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    const r = await fetch(`${BASE}/api/notes/${note.id}/pin`, {
      method: "PATCH", headers: await auth(), body: "{}",
    });
    if (r.ok) {
      const updated = await r.json();
      setNotes(prev => {
        const filtered = prev.filter(n => n.id !== note.id);
        return updated.isPinned ? [updated, ...filtered] : [...filtered, updated];
      });
    }
  };

  const summarize = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    setSummarizing(note.id);
    try {
      const r = await fetch(`${BASE}/api/notes/${note.id}/summarize`, {
        method: "POST", headers: await auth(), body: "{}",
      });
      if (r.ok) {
        const d = await r.json();
        setNotes(prev => prev.map(n => n.id === note.id ? d.note : n));
        if (editNote?.id === note.id) setEditNote(d.note);
        toast({ title: "Summary generated!" });
      }
    } finally { setSummarizing(null); }
  };

  const pinnedNotes = notes.filter(n => n.isPinned);
  const unpinnedNotes = notes.filter(n => !n.isPinned);

  const NoteCard = ({ note }: { note: Note }) => {
    const isDark = note.color === "#ffffff" || note.color === "#f1f5f9";
    return (
      <div
        className="group rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all border border-black/5 relative overflow-hidden"
        style={{ backgroundColor: note.color }}
        onClick={() => openEdit(note)}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{note.emoji}</span>
            <h3 className="font-semibold text-sm text-gray-800 line-clamp-1">{note.title}</h3>
          </div>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={e => togglePin(note, e)}
              className="p-1 rounded-lg hover:bg-black/10 transition-colors text-gray-600">
              {note.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
            <button onClick={e => summarize(note, e)}
              className="p-1 rounded-lg hover:bg-black/10 transition-colors text-gray-600"
              title="AI Summarize">
              {summarizing === note.id
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <Sparkles className="w-3.5 h-3.5" />}
            </button>
            <button onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
              className="p-1 rounded-lg hover:bg-red-100 transition-colors text-gray-600 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {note.aiSummary ? (
          <p className="text-xs text-gray-600 line-clamp-3 italic mb-2">"{note.aiSummary}"</p>
        ) : (
          <p className="text-xs text-gray-600 line-clamp-4 mb-2 whitespace-pre-wrap">{note.content || <span className="opacity-50">Empty note</span>}</p>
        )}

        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {note.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/8 text-gray-600">#{tag}</span>
            ))}
          </div>
        )}

        <p className="text-[10px] text-gray-400 mt-2 absolute bottom-3 right-4">
          {format(parseISO(note.updatedAt), "MMM d")}
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{notes.length} notes</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> New Note</Button>
      </div>

      {/* Search and tags */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search notes…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {allTags.map(tag => (
          <button key={tag}
            onClick={() => setSelectedTag(selectedTag === tag ? "" : tag)}
            className={cn("text-xs px-3 py-1.5 rounded-full border transition-all",
              selectedTag === tag
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/30 border-border text-muted-foreground hover:text-foreground")}>
            #{tag}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-36 rounded-2xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <StickyNote className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">{search ? "No matching notes" : "No notes yet"}</p>
          {!search && <Button className="mt-4" onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Create First Note</Button>}
        </div>
      ) : (
        <div className="space-y-6">
          {pinnedNotes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5" /> Pinned
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pinnedNotes.map(note => <NoteCard key={note.id} note={note} />)}
              </div>
            </div>
          )}
          {unpinnedNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Other</p>}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {unpinnedNotes.map(note => <NoteCard key={note.id} note={note} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={v => !v && setShowEditor(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: form.color }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-800">
              {form.emoji} {editNote ? "Edit Note" : "New Note"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Color picker */}
            <div className="flex gap-2 flex-wrap">
              {NOTE_COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={cn("w-7 h-7 rounded-full border border-black/10 transition-all",
                    form.color === c ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-105")}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            {/* Emoji picker */}
            <div className="flex gap-1.5 flex-wrap">
              {NOTE_EMOJIS.map(em => (
                <button key={em} onClick={() => setForm(p => ({ ...p, emoji: em }))}
                  className={cn("w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all",
                    form.emoji === em ? "ring-2 ring-primary bg-black/10" : "hover:bg-black/10")}>
                  {em}
                </button>
              ))}
            </div>
            <Input placeholder="Title" value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="bg-white/60 border-black/10 text-gray-800 placeholder:text-gray-400" />
            <Textarea placeholder="Write your note here…" value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              className="min-h-[180px] resize-none bg-white/60 border-black/10 text-gray-800 placeholder:text-gray-400" />
            <Input placeholder="Tags (comma-separated)" value={form.tags}
              onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
              className="bg-white/60 border-black/10 text-gray-800 placeholder:text-gray-400" />

            {/* AI Summary preview */}
            {editNote?.aiSummary && (
              <div className="rounded-xl bg-black/5 p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> AI Summary
                </p>
                <p className="text-xs text-gray-600 italic leading-relaxed">{editNote.aiSummary}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            {editNote && (
              <Button variant="destructive" size="sm" onClick={() => deleteNote(editNote.id)}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
              </Button>
            )}
            {editNote && (
              <Button variant="outline" size="sm" onClick={e => { summarize(editNote, e as any); }}
                disabled={summarizing === editNote.id} className="gap-1.5">
                {summarizing === editNote.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Summarize
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
