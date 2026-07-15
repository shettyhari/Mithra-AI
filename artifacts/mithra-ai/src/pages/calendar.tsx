import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Sparkles, Trash2, Edit2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  isAllDay: boolean;
  location?: string;
  recurrence: string;
  color: string;
  isSharedWithFamily: boolean;
}

const EVENT_COLORS = [
  { label: "Purple", value: "#8b5cf6" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#10b981" },
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Pink", value: "#ec4899" },
];

export default function CalendarPage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", startAt: "", endAt: "", isAllDay: false,
    location: "", recurrence: "none", color: "#8b5cf6", isSharedWithFamily: false,
  });

  const authHeaders = async (extra?: Record<string, string>) => {
    const tok = await getToken();
    return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...extra };
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start with empty days
  const startPad = monthStart.getDay();
  const paddedDays = Array(startPad).fill(null).concat(days);

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["events", format(monthStart, "yyyy-MM"), format(monthEnd, "yyyy-MM")],
    queryFn: async () => {
      const res = await fetch(
        `${BASE_URL}api/events?start=${monthStart.toISOString()}&end=${monthEnd.toISOString()}`,
        { credentials: "include", headers: await authHeaders() }
      );
      return res.ok ? res.json() : [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`${BASE_URL}api/events`, {
        method: "POST", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ...data, startAt: data.startAt ? new Date(data.startAt).toISOString() : undefined, endAt: data.endAt ? new Date(data.endAt).toISOString() : undefined }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); setShowCreate(false); resetForm(); toast({ title: "Event created" }); },
    onError: () => toast({ title: "Failed to create event", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof form> }) => {
      const res = await fetch(`${BASE_URL}api/events/${id}`, {
        method: "PUT", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); setEditing(null); toast({ title: "Event updated" }); },
    onError: () => toast({ title: "Failed to update event", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE_URL}api/events/${id}`, { method: "DELETE", credentials: "include", headers: await authHeaders() });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); toast({ title: "Event deleted" }); },
  });

  const resetForm = () => setForm({ title: "", description: "", startAt: "", endAt: "", isAllDay: false, location: "", recurrence: "none", color: "#8b5cf6", isSharedWithFamily: false });

  const openCreate = (day?: Date) => {
    resetForm();
    if (day) {
      const iso = format(day, "yyyy-MM-dd'T'HH:mm");
      setForm(f => ({ ...f, startAt: iso }));
    }
    setShowCreate(true);
  };

  const openEdit = (e: CalendarEvent) => {
    setEditing(e);
    setForm({
      title: e.title, description: e.description || "", isAllDay: e.isAllDay,
      startAt: format(parseISO(e.startAt), "yyyy-MM-dd'T'HH:mm"),
      endAt: e.endAt ? format(parseISO(e.endAt), "yyyy-MM-dd'T'HH:mm") : "",
      location: e.location || "", recurrence: e.recurrence, color: e.color,
      isSharedWithFamily: e.isSharedWithFamily,
    });
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const tok = await getToken();
      const res = await fetch(`${BASE_URL}api/chats`, { credentials: "include", headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
      const chats = res.ok ? await res.json() : [];
      if (!chats.length) { toast({ title: "Create a chat first to use AI suggestions" }); return; }
      toast({ title: "AI Scheduling", description: "Ask Mithra in chat: 'Help me schedule my week' for smart suggestions!" });
    } finally { setAiLoading(false); }
  };

  const eventsOnDay = (day: Date) => events.filter(e => isSameDay(parseISO(e.startAt), day));
  const selectedEvents = eventsOnDay(selectedDay);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">Family schedule & upcoming events</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAiSuggest} disabled={aiLoading} className="gap-2">
            <Sparkles className="w-4 h-4" /> AI Schedule
          </Button>
          <Button onClick={() => openCreate()} className="gap-2">
            <Plus className="w-4 h-4" /> New Event
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className={cn("lg:col-span-2 rounded-2xl border p-6", isDark ? "bg-background/40 border-border/50" : "bg-card border-border")}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {paddedDays.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />;
              const dayEvents = eventsOnDay(day);
              const selected = isSameDay(day, selectedDay);
              const today = isToday(day);
              return (
                <button key={day.toISOString()} onClick={() => setSelectedDay(day)}
                  onDoubleClick={() => openCreate(day)}
                  className={cn(
                    "min-h-[72px] p-1.5 rounded-xl text-left transition-colors border",
                    selected ? "border-primary/60 bg-primary/10" : "border-transparent hover:border-border/50 hover:bg-muted/30",
                    !isSameMonth(day, currentMonth) && "opacity-30"
                  )}>
                  <span className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                    today && "bg-primary text-primary-foreground",
                    !today && "text-foreground"
                  )}>{format(day, "d")}</span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className="text-[10px] truncate rounded px-1 py-0.5 text-white font-medium" style={{ backgroundColor: e.color }}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day Detail */}
        <div className={cn("rounded-2xl border p-5 space-y-4", isDark ? "bg-background/40 border-border/50" : "bg-card border-border")}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{format(selectedDay, "EEEE")}</p>
              <h3 className="text-2xl font-bold">{format(selectedDay, "MMM d")}</h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => openCreate(selectedDay)} className="gap-1">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          {selectedEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No events</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => openCreate(selectedDay)}>Add one</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map(e => (
                <div key={e.id} className={cn("p-3 rounded-xl border-l-4 group relative")} style={{ borderColor: e.color, backgroundColor: `${e.color}15` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{e.title}</p>
                      {e.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{e.description}</p>}
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {!e.isAllDay && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="w-3 h-3" />{format(parseISO(e.startAt), "h:mm a")}</span>}
                        {e.location && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="w-3 h-3" />{e.location}</span>}
                        {e.isAllDay && <Badge variant="outline" className="text-[10px] h-4">All day</Badge>}
                        {e.recurrence !== "none" && <Badge variant="outline" className="text-[10px] h-4">{e.recurrence}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => openEdit(e)} className="p-1 rounded hover:bg-muted/50"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      <button onClick={() => deleteMutation.mutate(e.id)} className="p-1 rounded hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editing} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditing(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Event" : "New Event"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" className="mt-1 resize-none" rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start</Label><Input type="datetime-local" value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))} className="mt-1" /></div>
              <div><Label>End</Label><Input type="datetime-local" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label>Location</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Optional location" className="mt-1" /></div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Switch checked={form.isAllDay} onCheckedChange={v => setForm(f => ({ ...f, isAllDay: v }))} />
                <Label className="cursor-pointer">All day</Label>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Switch checked={form.isSharedWithFamily} onCheckedChange={v => setForm(f => ({ ...f, isSharedWithFamily: v }))} />
                <Label className="cursor-pointer">Family</Label>
              </div>
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {EVENT_COLORS.map(c => (
                  <button key={c.value} onClick={() => setForm(f => ({ ...f, color: c.value }))}
                    className={cn("w-7 h-7 rounded-full transition-transform hover:scale-110", form.color === c.value && "ring-2 ring-offset-2 ring-primary scale-110")}
                    style={{ backgroundColor: c.value }} title={c.label} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditing(null); resetForm(); }}>Cancel</Button>
            <Button onClick={() => editing ? updateMutation.mutate({ id: editing.id, data: form }) : createMutation.mutate(form)}
              disabled={!form.title || !form.startAt || createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
