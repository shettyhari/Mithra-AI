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
import { Plus, Zap, Play, Trash2, Edit2, Bell, CheckSquare, Brain, MessageSquare, Clock, ToggleRight, AlertCircle } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

interface Automation {
  id: number;
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig?: string;
  actionType: string;
  actionConfig?: string;
  isActive: boolean;
  lastRunAt?: string;
  runCount: number;
}

const TRIGGER_TYPES = [
  { value: "daily_digest", label: "Daily Digest", description: "Run every day at a set time" },
  { value: "weekly_summary", label: "Weekly Summary", description: "Run every week" },
  { value: "birthday_check", label: "Birthday Check", description: "Remind before family birthdays" },
  { value: "task_reminder", label: "Task Reminder", description: "Remind about pending tasks" },
  { value: "custom", label: "Custom", description: "Custom trigger configuration" },
];

const ACTION_TYPES = [
  { value: "send_notification", label: "Send Notification", icon: Bell, color: "text-blue-400" },
  { value: "create_task", label: "Create Task", icon: CheckSquare, color: "text-green-400" },
  { value: "ai_summary", label: "AI Summary → Notification", icon: Brain, color: "text-purple-400" },
  { value: "chat_message", label: "Send to Chat", icon: MessageSquare, color: "text-orange-400" },
];

const AUTOMATION_TEMPLATES = [
  {
    name: "Daily Morning Briefing",
    description: "AI generates a daily summary and sends it as a notification",
    triggerType: "daily_digest",
    actionType: "ai_summary",
    actionConfig: { prompt: "Generate a motivating morning briefing for today. Include: weather tip, productivity suggestion, and an encouraging quote. Keep it brief and warm." },
  },
  {
    name: "Weekly Family Summary",
    description: "Weekly AI recap of tasks, habits, and achievements",
    triggerType: "weekly_summary",
    actionType: "ai_summary",
    actionConfig: { prompt: "Generate a warm weekly family summary. Celebrate wins, note areas to improve, and set intentions for next week. Be encouraging." },
  },
  {
    name: "Birthday Reminder",
    description: "Check for upcoming family birthdays",
    triggerType: "birthday_check",
    actionType: "send_notification",
    actionConfig: { notificationTitle: "Birthday Coming Up", body: "Don't forget — a family member has a birthday coming up!" },
  },
  {
    name: "Pending Tasks Alert",
    description: "Remind about overdue or pending high-priority tasks",
    triggerType: "task_reminder",
    actionType: "send_notification",
    actionConfig: { notificationTitle: "Tasks Need Attention", body: "You have pending tasks that need your attention today." },
  },
];

export default function AutomationsPage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [running, setRunning] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: "", description: "", triggerType: "daily_digest", actionType: "ai_summary",
    triggerConfig: {} as Record<string, unknown>,
    actionConfig: { prompt: "", notificationTitle: "", body: "", taskTitle: "" } as Record<string, unknown>,
  });

  const authHeaders = async (extra?: Record<string, string>) => {
    const tok = await getToken();
    return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...extra };
  };

  const { data: automations = [], isLoading, error: automationsError } = useQuery<Automation[]>({
    queryKey: ["automations"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}api/automations`, { credentials: "include", headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed to load automations");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`${BASE_URL}api/automations`, {
        method: "POST", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ...data, triggerConfig: data.triggerConfig, actionConfig: data.actionConfig }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automations"] }); setShowCreate(false); resetForm(); toast({ title: "Automation created ⚡" }); },
    onError: () => toast({ title: "Failed to create automation", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Automation> }) => {
      const res = await fetch(`${BASE_URL}api/automations/${id}`, {
        method: "PUT", credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automations"] }); setEditing(null); toast({ title: "Automation updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE_URL}api/automations/${id}`, { method: "DELETE", credentials: "include", headers: await authHeaders() });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automations"] }); toast({ title: "Automation deleted" }); },
  });

  const runAutomation = async (id: number) => {
    setRunning(id);
    try {
      const tok = await getToken();
      const res = await fetch(`${BASE_URL}api/automations/${id}/run`, {
        method: "POST", credentials: "include",
        headers: { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: "Automation ran successfully", description: data.result });
    } catch (e) {
      toast({ title: "Failed to run automation", description: String(e), variant: "destructive" });
    } finally { setRunning(null); }
  };

  const resetForm = () => setForm({
    name: "", description: "", triggerType: "daily_digest", actionType: "ai_summary",
    triggerConfig: {}, actionConfig: { prompt: "", notificationTitle: "", body: "", taskTitle: "" },
  });

  const applyTemplate = (t: typeof AUTOMATION_TEMPLATES[0]) => {
    setForm({ ...form, name: t.name, description: t.description, triggerType: t.triggerType, actionType: t.actionType, triggerConfig: {}, actionConfig: t.actionConfig as Record<string, unknown> });
  };

  const activeCount = automations.filter(a => a.isActive).length;

  if (automationsError) return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
      <AlertCircle className="w-8 h-8 text-destructive" />
      <p className="text-sm">Failed to load automations. Please refresh the page.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automations</h1>
          <p className="text-muted-foreground text-sm mt-1">Set AI to work automatically for your family</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Automation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: automations.length, icon: Zap, color: "text-purple-400" },
          { label: "Active", value: activeCount, icon: ToggleRight, color: "text-green-400" },
          { label: "Total Runs", value: automations.reduce((a, b) => a + b.runCount, 0), icon: Play, color: "text-blue-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={cn("rounded-2xl border p-4 flex items-center gap-3", isDark ? "bg-background/40 border-border/50" : "bg-card border-border")}>
            <Icon className={cn("w-8 h-8", color)} />
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Templates */}
      <div>
        <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Quick Templates</h3>
        <div className="grid grid-cols-2 gap-3">
          {AUTOMATION_TEMPLATES.map(t => (
            <button key={t.name} onClick={() => { applyTemplate(t); setShowCreate(true); }}
              className={cn("p-4 rounded-xl border text-left transition-colors group", isDark ? "bg-background/30 border-border/50 hover:border-primary/40 hover:bg-primary/5" : "bg-muted/30 border-border hover:border-primary/40 hover:bg-primary/5")}>
              <p className="font-medium text-sm group-hover:text-primary transition-colors">{t.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Automations List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-muted/20 animate-pulse" />)}</div>
      ) : automations.length === 0 ? (
        <div className={cn("rounded-2xl border p-10 text-center", isDark ? "bg-background/40 border-border/50" : "bg-card border-border")}>
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground">No automations yet. Start with a template above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map(a => {
            const actionType = ACTION_TYPES.find(t => t.value === a.actionType);
            const ActionIcon = actionType?.icon || Zap;
            return (
              <div key={a.id} className={cn("rounded-2xl border p-5 group", isDark ? "bg-background/40 border-border/50" : "bg-card border-border")}>
                <div className="flex items-start gap-4">
                  <div className={cn("w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0")}>
                    <ActionIcon className={cn("w-5 h-5", actionType?.color || "text-primary")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{a.name}</h3>
                      <Badge variant={a.isActive ? "default" : "outline"} className="text-[10px] h-4">
                        {a.isActive ? "Active" : "Paused"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-4">{TRIGGER_TYPES.find(t => t.value === a.triggerType)?.label}</Badge>
                    </div>
                    {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Play className="w-3 h-3" /> {a.runCount} runs</span>
                      {a.lastRunAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDistanceToNow(parseISO(a.lastRunAt), { addSuffix: true })}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={a.isActive} onCheckedChange={v => updateMutation.mutate({ id: a.id, data: { isActive: v } })} />
                    <button onClick={() => runAutomation(a.id)} disabled={running === a.id}
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Run now">
                      {running === a.id ? <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { if (confirm("Delete this automation?")) deleteMutation.mutate(a.id); }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editing} onOpenChange={o => { if (!o) { setShowCreate(false); setEditing(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Automation" : "New Automation"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Morning Briefing" className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this automation do?" className="mt-1 resize-none" rows={2} /></div>

            <div>
              <Label>Trigger</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {TRIGGER_TYPES.map(t => (
                  <button key={t.value} onClick={() => setForm(f => ({ ...f, triggerType: t.value }))}
                    className={cn("p-3 rounded-xl border text-left transition-colors", form.triggerType === t.value ? "border-primary bg-primary/10" : isDark ? "border-border/50 hover:border-border" : "border-border hover:bg-muted/30")}>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Action</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ACTION_TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.value} onClick={() => setForm(f => ({ ...f, actionType: t.value }))}
                      className={cn("p-3 rounded-xl border flex items-center gap-2 transition-colors", form.actionType === t.value ? "border-primary bg-primary/10" : isDark ? "border-border/50 hover:border-border" : "border-border hover:bg-muted/30")}>
                      <Icon className={cn("w-4 h-4 shrink-0", t.color)} />
                      <p className="text-xs font-medium text-left">{t.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {(form.actionType === "ai_summary" || form.actionType === "chat_message") && (
              <div>
                <Label>AI Prompt</Label>
                <Textarea value={String(form.actionConfig.prompt || "")} onChange={e => setForm(f => ({ ...f, actionConfig: { ...f.actionConfig, prompt: e.target.value } }))}
                  placeholder="What should the AI generate?" className="mt-1 resize-none" rows={3} />
              </div>
            )}
            {form.actionType === "send_notification" && (
              <>
                <div><Label>Notification Title</Label><Input value={String(form.actionConfig.notificationTitle || "")} onChange={e => setForm(f => ({ ...f, actionConfig: { ...f.actionConfig, notificationTitle: e.target.value } }))} className="mt-1" /></div>
                <div><Label>Message</Label><Textarea value={String(form.actionConfig.body || "")} onChange={e => setForm(f => ({ ...f, actionConfig: { ...f.actionConfig, body: e.target.value } }))} className="mt-1 resize-none" rows={2} /></div>
              </>
            )}
            {form.actionType === "create_task" && (
              <div><Label>Task Title</Label><Input value={String(form.actionConfig.taskTitle || "")} onChange={e => setForm(f => ({ ...f, actionConfig: { ...f.actionConfig, taskTitle: e.target.value } }))} className="mt-1" /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditing(null); resetForm(); }}>Cancel</Button>
            <Button onClick={() => editing ? updateMutation.mutate({ id: editing.id, data: form }) : createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
