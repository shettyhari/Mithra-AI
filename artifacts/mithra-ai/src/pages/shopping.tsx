import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ShoppingCart, Plus, Trash2, Check, X, Sparkles, ChevronDown, ChevronUp,
  Edit2, RefreshCw, Share2
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ShoppingItem = {
  id: number; listId: number; name: string; quantity?: string; category?: string;
  note?: string; isChecked: boolean; sortOrder: number;
};
type ShoppingList = {
  id: number; title: string; emoji: string; color: string; isSharedWithFamily: boolean;
  items: ShoppingItem[]; total: number; checked: number;
};

export default function ShoppingPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedList, setExpandedList] = useState<number | null>(null);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showAddItem, setShowAddItem] = useState<number | null>(null);
  const [editList, setEditList] = useState<ShoppingList | null>(null);
  const [newListForm, setNewListForm] = useState({ title: "", emoji: "🛒", color: "#10b981" });
  const [newItem, setNewItem] = useState({ name: "", quantity: "", category: "", note: "" });
  const [suggesting, setSuggesting] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, string[]>>({});

  const auth = async (extra?: Record<string, string>) => {
    const tok = await getToken();
    return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), "Content-Type": "application/json", ...extra };
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/shopping`, { headers: await auth() });
      if (r.ok) {
        const data = await r.json();
        setLists(data);
        if (data.length > 0 && expandedList === null) setExpandedList(data[0].id);
      }
    } finally { setLoading(false); }
  };

  useState(() => { load(); });

  const createList = async () => {
    if (!newListForm.title.trim()) return;
    const r = await fetch(`${BASE}/api/shopping`, {
      method: "POST", headers: await auth(),
      body: JSON.stringify(newListForm),
    });
    if (r.ok) {
      const list = await r.json();
      setLists(prev => [list, ...prev]);
      setExpandedList(list.id);
      setShowCreateList(false);
      setNewListForm({ title: "", emoji: "🛒", color: "#10b981" });
      toast({ title: "List created!" });
    }
  };

  const updateList = async () => {
    if (!editList) return;
    const r = await fetch(`${BASE}/api/shopping/${editList.id}`, {
      method: "PUT", headers: await auth(),
      body: JSON.stringify(editList),
    });
    if (r.ok) {
      setLists(prev => prev.map(l => l.id === editList.id ? { ...l, ...editList } : l));
      setEditList(null);
    }
  };

  const deleteList = async (id: number) => {
    const r = await fetch(`${BASE}/api/shopping/${id}`, { method: "DELETE", headers: await auth() });
    if (r.ok) {
      setLists(prev => prev.filter(l => l.id !== id));
      if (expandedList === id) setExpandedList(null);
      toast({ title: "List deleted" });
    }
  };

  const addItem = async (listId: number) => {
    if (!newItem.name.trim()) return;
    const r = await fetch(`${BASE}/api/shopping/${listId}/items`, {
      method: "POST", headers: await auth(),
      body: JSON.stringify(newItem),
    });
    if (r.ok) {
      const item = await r.json();
      setLists(prev => prev.map(l => l.id === listId
        ? { ...l, items: [...l.items, item], total: l.total + 1 }
        : l));
      setNewItem({ name: "", quantity: "", category: "", note: "" });
    }
  };

  const toggleItem = async (listId: number, item: ShoppingItem) => {
    const r = await fetch(`${BASE}/api/shopping/${listId}/items/${item.id}`, {
      method: "PUT", headers: await auth(),
      body: JSON.stringify({ isChecked: !item.isChecked }),
    });
    if (r.ok) {
      setLists(prev => prev.map(l => l.id === listId ? {
        ...l,
        items: l.items.map(i => i.id === item.id ? { ...i, isChecked: !i.isChecked } : i),
        checked: !item.isChecked ? l.checked + 1 : l.checked - 1,
      } : l));
    }
  };

  const deleteItem = async (listId: number, itemId: number) => {
    const r = await fetch(`${BASE}/api/shopping/${listId}/items/${itemId}`, {
      method: "DELETE", headers: await auth(),
    });
    if (r.ok) {
      setLists(prev => prev.map(l => l.id === listId
        ? { ...l, items: l.items.filter(i => i.id !== itemId), total: l.total - 1, checked: l.checked }
        : l));
    }
  };

  const clearChecked = async (listId: number) => {
    const r = await fetch(`${BASE}/api/shopping/${listId}/items/checked/all`, {
      method: "DELETE", headers: await auth(),
    });
    if (r.ok) {
      setLists(prev => prev.map(l => l.id === listId
        ? { ...l, items: l.items.filter(i => !i.isChecked), checked: 0 }
        : l));
      toast({ title: "Checked items cleared" });
    }
  };

  const getSuggestions = async (listId: number) => {
    setSuggesting(listId);
    try {
      const r = await fetch(`${BASE}/api/shopping/${listId}/suggest`, {
        method: "POST", headers: await auth(), body: JSON.stringify({}),
      });
      if (r.ok) {
        const data = await r.json();
        setSuggestions(prev => ({ ...prev, [listId]: data.suggestions }));
      }
    } finally { setSuggesting(null); }
  };

  const addSuggestion = async (listId: number, name: string) => {
    const r = await fetch(`${BASE}/api/shopping/${listId}/items`, {
      method: "POST", headers: await auth(),
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      const item = await r.json();
      setLists(prev => prev.map(l => l.id === listId
        ? { ...l, items: [...l.items, item], total: l.total + 1 }
        : l));
      setSuggestions(prev => ({
        ...prev,
        [listId]: (prev[listId] || []).filter(s => s !== name),
      }));
    }
  };

  const EMOJIS = ["🛒", "🍎", "🧴", "🏠", "👕", "💊", "🐾", "🎉"];
  const COLORS = ["#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Shopping Lists</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Collaborative family shopping</p>
        </div>
        <Button onClick={() => setShowCreateList(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New List
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No shopping lists yet</p>
          <p className="text-sm mt-1">Create your first list to get started</p>
          <Button className="mt-4" onClick={() => setShowCreateList(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create List
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {lists.map(list => {
            const isExpanded = expandedList === list.id;
            const pct = list.total > 0 ? Math.round((list.checked / list.total) * 100) : 0;
            const unchecked = list.items.filter(i => !i.isChecked);
            const checked = list.items.filter(i => i.isChecked);

            return (
              <div key={list.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedList(isExpanded ? null : list.id)}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: list.color + "20" }}>
                    {list.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{list.title}</h3>
                      {list.isSharedWithFamily && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Share2 className="w-3 h-3" /> Shared
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{list.checked}/{list.total} items</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full max-w-[120px]">
                        <div className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: list.color }} />
                      </div>
                      <span className="text-xs font-medium" style={{ color: list.color }}>{pct}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={e => { e.stopPropagation(); setEditList(list); }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); deleteList(list.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/50">
                    {/* Unchecked items */}
                    <div className="pt-3 space-y-1.5">
                      {unchecked.map(item => (
                        <div key={item.id} className="flex items-center gap-3 group py-1">
                          <button onClick={() => toggleItem(list.id, item)}
                            className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center hover:border-primary transition-colors shrink-0">
                          </button>
                          <span className="flex-1 text-sm text-foreground">{item.name}</span>
                          {item.quantity && <span className="text-xs text-muted-foreground">{item.quantity}</span>}
                          {item.category && <Badge variant="outline" className="text-xs">{item.category}</Badge>}
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={() => deleteItem(list.id, item.id)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Checked items */}
                    {checked.length > 0 && (
                      <div className="border-t border-border/50 pt-2 space-y-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{checked.length} checked</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground"
                            onClick={() => clearChecked(list.id)}>
                            Clear checked
                          </Button>
                        </div>
                        {checked.map(item => (
                          <div key={item.id} className="flex items-center gap-3 group py-1 opacity-50">
                            <button onClick={() => toggleItem(list.id, item)}
                              className="w-5 h-5 rounded-full border-2 bg-primary border-primary flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 text-primary-foreground" />
                            </button>
                            <span className="flex-1 text-sm line-through text-muted-foreground">{item.name}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                              onClick={() => deleteItem(list.id, item.id)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add item */}
                    {showAddItem === list.id ? (
                      <div className="flex gap-2 pt-2">
                        <Input placeholder="Item name" value={newItem.name}
                          onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") { addItem(list.id); } if (e.key === "Escape") setShowAddItem(null); }}
                          className="h-8 text-sm" autoFocus />
                        <Input placeholder="Qty" value={newItem.quantity}
                          onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))}
                          className="h-8 text-sm w-20" />
                        <Button size="sm" className="h-8" onClick={() => addItem(list.id)}>Add</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowAddItem(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                          onClick={() => setShowAddItem(list.id)}>
                          <Plus className="w-3.5 h-3.5" /> Add item
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                          onClick={() => getSuggestions(list.id)} disabled={suggesting === list.id}>
                          {suggesting === list.id
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <Sparkles className="w-3.5 h-3.5" />}
                          AI Suggest
                        </Button>
                      </div>
                    )}

                    {/* AI suggestions */}
                    {suggestions[list.id]?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {suggestions[list.id].map(s => (
                          <button key={s}
                            onClick={() => addSuggestion(list.id, s)}
                            className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors">
                            + {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create List Dialog */}
      <Dialog open={showCreateList} onOpenChange={setShowCreateList}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Shopping List</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">List Name</label>
              <Input placeholder="e.g. Weekly Groceries" value={newListForm.title}
                onChange={e => setNewListForm(p => ({ ...p, title: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && createList()} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Emoji</label>
              <div className="flex gap-2 flex-wrap">
                {EMOJIS.map(em => (
                  <button key={em} onClick={() => setNewListForm(p => ({ ...p, emoji: em }))}
                    className={cn("w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all",
                      newListForm.emoji === em ? "ring-2 ring-primary bg-primary/10" : "bg-muted/50 hover:bg-muted")}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setNewListForm(p => ({ ...p, color: c }))}
                    className={cn("w-7 h-7 rounded-full transition-all", newListForm.color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateList(false)}>Cancel</Button>
            <Button onClick={createList}>Create List</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit List Dialog */}
      <Dialog open={!!editList} onOpenChange={v => !v && setEditList(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit List</DialogTitle></DialogHeader>
          {editList && (
            <div className="space-y-4">
              <Input value={editList.title}
                onChange={e => setEditList(p => p ? { ...p, title: e.target.value } : null)} />
              <div className="flex gap-2 flex-wrap">
                {EMOJIS.map(em => (
                  <button key={em} onClick={() => setEditList(p => p ? { ...p, emoji: em } : null)}
                    className={cn("w-9 h-9 rounded-xl text-lg flex items-center justify-center",
                      editList.emoji === em ? "ring-2 ring-primary bg-primary/10" : "bg-muted/50 hover:bg-muted")}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditList(null)}>Cancel</Button>
            <Button onClick={updateList}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
