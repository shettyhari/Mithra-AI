import { useState } from "react";
import {
  useAdminGetSystemStats,
  useAdminGetAiKeys,
  useAdminUpdateAiKeys,
  useAdminGetDefaultAiConfig,
  useAdminUpdateDefaultAiConfig,
  useAdminListAuditLogs,
  getAdminGetAiKeysQueryKey,
  getAdminGetDefaultAiConfigQueryKey,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  Users, Server, Database, Activity, ShieldAlert,
  Key, Eye, EyeOff, CheckCircle, XCircle, Save,
  BrainCircuit, Settings2, ClipboardList, LayoutDashboard,
  RefreshCw, Zap, Globe, Bot,
} from "lucide-react";
import { Link } from "wouter";

const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4o-mini, o1, o3",
    icon: "🤖",
    color: "from-green-500/20 to-emerald-500/20",
    border: "border-green-500/20",
    badge: "bg-green-500/10 text-green-400",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-mini", "o3-mini"],
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude 3.5 Sonnet, Claude 3 Opus, Haiku",
    icon: "🧠",
    color: "from-amber-500/20 to-orange-500/20",
    border: "border-amber-500/20",
    badge: "bg-amber-500/10 text-amber-400",
    models: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini 2.0 Flash, Gemini 1.5 Pro",
    icon: "✨",
    color: "from-blue-500/20 to-cyan-500/20",
    border: "border-blue-500/20",
    badge: "bg-blue-500/10 text-blue-400",
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Llama 3.3, Mixtral — ultra-fast inference",
    icon: "⚡",
    color: "from-purple-500/20 to-violet-500/20",
    border: "border-purple-500/20",
    badge: "bg-purple-500/10 text-purple-400",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    docsUrl: "https://console.groq.com/keys",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "100+ models from one API endpoint",
    icon: "🌐",
    color: "from-rose-500/20 to-pink-500/20",
    border: "border-rose-500/20",
    badge: "bg-rose-500/10 text-rose-400",
    models: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.3-70b"],
    docsUrl: "https://openrouter.ai/keys",
  },
];

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "providers", label: "AI Providers", icon: BrainCircuit },
  { id: "config", label: "AI Config", icon: Settings2 },
  { id: "audit", label: "Audit Logs", icon: ClipboardList },
];

const fmtBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

function ProviderCard({
  provider,
  isSet,
  onSave,
}: {
  provider: typeof PROVIDERS[0];
  isSet: boolean;
  onSave: (key: string) => void;
}) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const handleSave = async () => {
    setSaving(true);
    await onSave(key);
    setSaving(false);
    setKey("");
  };

  return (
    <div className={cn(
      "rounded-2xl border p-5 space-y-4 transition-all",
      isDark
        ? `bg-gradient-to-br ${provider.color} ${provider.border}`
        : `border-border bg-card hover:border-primary/30`
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{provider.icon}</span>
          <div>
            <h3 className="font-semibold text-foreground">{provider.name}</h3>
            <p className="text-xs text-muted-foreground">{provider.description}</p>
          </div>
        </div>
        {isSet ? (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle className="w-3 h-3 mr-1" /> Active
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <XCircle className="w-3 h-3 mr-1" /> Not set
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {provider.models.slice(0, 3).map((m) => (
          <span key={m} className={cn("text-[10px] px-2 py-0.5 rounded-full font-mono", provider.badge)}>
            {m.split("/").pop()}
          </span>
        ))}
        {provider.models.length > 3 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            +{provider.models.length - 3} more
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type={show ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={isSet ? "Enter new key to replace…" : "Paste API key…"}
            className={cn(
              "w-full pl-9 pr-9 py-2 text-sm rounded-xl border bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30",
              isDark ? "border-white/10" : "border-border"
            )}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!key.trim() || saving}
          className="shrink-0"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        </Button>
      </div>

      <a
        href={provider.docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary hover:underline flex items-center gap-1"
      >
        <Globe className="w-3 h-3" />
        Get API key →
      </a>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading, isError: statsError } = useAdminGetSystemStats();
  const { data: aiKeys } = useAdminGetAiKeys();
  const { data: aiConfig } = useAdminGetDefaultAiConfig();
  const { data: auditLogs } = useAdminListAuditLogs();

  const updateAiKeys = useAdminUpdateAiKeys();
  const updateAiConfig = useAdminUpdateDefaultAiConfig();

  const [configState, setConfigState] = useState({
    defaultModel: aiConfig?.defaultModel ?? "gpt-4o-mini",
    temperature: aiConfig?.temperature ?? 0.7,
    maxTokens: aiConfig?.maxTokens ?? 2048,
    systemPrompt: aiConfig?.systemPrompt ?? "",
  });

  const handleSaveProviderKey = (providerId: string, key: string) => {
    const fieldMap: Record<string, string> = {
      openai: "openaiKey",
      anthropic: "anthropicKey",
      gemini: "geminiKey",
      groq: "groqKey",
      openrouter: "openrouterKey",
    };
    const fieldName = fieldMap[providerId];
    if (!fieldName) return;
    updateAiKeys.mutate(
      { data: { [fieldName]: key } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminGetAiKeysQueryKey() });
          toast({ title: "API key saved", description: `${providerId} key updated successfully.` });
        },
        onError: () => toast({ title: "Error", description: "Failed to save key.", variant: "destructive" }),
      }
    );
  };

  const handleSaveConfig = () => {
    updateAiConfig.mutate(
      { data: configState as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminGetDefaultAiConfigQueryKey() });
          toast({ title: "Config saved", description: "Default AI configuration updated." });
        },
        onError: () => toast({ title: "Error", description: "Failed to save config.", variant: "destructive" }),
      }
    );
  };

  const keyStatus: Record<string, boolean> = {
    openai: aiKeys?.openaiKeySet ?? false,
    anthropic: aiKeys?.anthropicKeySet ?? false,
    gemini: aiKeys?.geminiKeySet ?? false,
    groq: aiKeys?.groqKeySet ?? false,
    openrouter: aiKeys?.openrouterKeySet ?? false,
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-500" />
            Command Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">System overview and family management.</p>
        </div>
        <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
          <ShieldAlert className="w-3 h-3 mr-1" /> Admin
        </Badge>
      </div>

      {/* Tab navigation */}
      <div className={cn("flex gap-1 p-1 rounded-xl w-fit", isDark ? "bg-white/5" : "bg-muted")}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === tab.id
                ? isDark
                  ? "bg-background text-foreground shadow-sm"
                  : "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: "Family Members", value: stats?.totalUsers ?? 0, icon: Users, color: "text-purple-400" },
              { label: "Total Chats", value: (stats?.totalChats ?? 0).toLocaleString(), icon: Server, color: "text-blue-400" },
              { label: "Total Messages", value: (stats?.totalMessages ?? 0).toLocaleString(), icon: Activity, color: "text-yellow-400" },
              { label: "Tokens Used", value: (stats?.totalTokensUsed ?? 0).toLocaleString(), icon: Zap, color: "text-cyan-400" },
              { label: "Storage Used", value: fmtBytes(stats?.storageUsedBytes ?? 0), icon: Database, color: "text-red-400" },
            ].map((stat) => (
              <Card key={stat.label} className={cn(isDark ? "bg-background/50 border-border" : "border-border")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                </CardHeader>
                <CardContent>
                  {statsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className={cn(isDark ? "bg-background/50 border-border" : "border-border")}>
              <CardHeader>
                <CardTitle className="text-lg text-foreground">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    name: "API Services",
                    ok: !statsError,
                    label: statsLoading ? "Checking…" : statsError ? "Degraded" : "Operational",
                  },
                  {
                    name: "Database",
                    ok: !!stats && !statsError,
                    label: statsLoading ? "Checking…" : statsError ? "Unavailable" : `${stats!.totalUsers} users · ${stats!.totalChats} chats`,
                  },
                  {
                    name: "AI Providers",
                    ok: Object.values(keyStatus).some(Boolean),
                    label: (() => {
                      const n = Object.values(keyStatus).filter(Boolean).length;
                      return n === 0 ? "No keys configured" : `${n} provider${n > 1 ? "s" : ""} active`;
                    })(),
                  },
                ].map(({ name, ok, label }) => (
                  <div key={name} className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    isDark ? "border-border/50 bg-muted/10" : "border-border bg-muted/30"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        ok ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]"
                      )} />
                      <span className="text-sm text-foreground">{name}</span>
                    </div>
                    <span className={cn("text-xs font-medium", ok ? "text-green-500" : "text-yellow-500")}>{label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className={cn(isDark ? "bg-background/50 border-border" : "border-border")}>
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Provider Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {PROVIDERS.map((p) => (
                  <div key={p.id} className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    isDark ? "border-border/50 bg-muted/10" : "border-border bg-muted/30"
                  )}>
                    <div className="flex items-center gap-2">
                      <span>{p.icon}</span>
                      <span className="text-sm text-foreground">{p.name}</span>
                    </div>
                    {keyStatus[p.id] ? (
                      <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> No key
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── USERS TAB ────────────────────────────────────── */}
      {activeTab === "users" && (
        <div>
          <Link href="/admin/users">
            <Button variant="outline" className="mb-4">
              <Users className="w-4 h-4 mr-2" /> Manage Users →
            </Button>
          </Link>
        </div>
      )}

      {/* ── AI PROVIDERS TAB ────────────────────────────── */}
      {activeTab === "providers" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600 dark:text-amber-400">
            <Zap className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              API keys are stored encrypted. Add a key for each provider you want to use.
              At least one active provider is required for chat to work.
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {PROVIDERS.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                isSet={keyStatus[p.id]}
                onSave={(key) => handleSaveProviderKey(p.id, key)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── AI CONFIG TAB ────────────────────────────────── */}
      {activeTab === "config" && (
        <div className="max-w-2xl space-y-6">
          <Card className={cn(isDark ? "bg-background/50 border-border" : "border-border")}>
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                Default AI Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Default Model</label>
                <select
                  value={configState.defaultModel}
                  onChange={(e) => setConfigState((s) => ({ ...s, defaultModel: e.target.value }))}
                  className={cn(
                    "w-full px-3 py-2.5 rounded-xl border text-sm bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30",
                    isDark ? "border-white/10" : "border-border"
                  )}
                >
                  {PROVIDERS.flatMap((p) => p.models).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Temperature: <span className="text-primary font-mono">{configState.temperature}</span>
                </label>
                <input
                  type="range"
                  min="0" max="2" step="0.1"
                  value={configState.temperature}
                  onChange={(e) => setConfigState((s) => ({ ...s, temperature: parseFloat(e.target.value) }))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Precise (0)</span>
                  <span>Balanced (1)</span>
                  <span>Creative (2)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Max Tokens: <span className="text-primary font-mono">{configState.maxTokens.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min="256" max="16384" step="256"
                  value={configState.maxTokens}
                  onChange={(e) => setConfigState((s) => ({ ...s, maxTokens: parseInt(e.target.value) }))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>256</span>
                  <span>8192</span>
                  <span>16384</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">System Prompt</label>
                <textarea
                  rows={5}
                  value={configState.systemPrompt}
                  onChange={(e) => setConfigState((s) => ({ ...s, systemPrompt: e.target.value }))}
                  placeholder="You are Mithra, a helpful AI assistant for a family. Be warm, concise, and supportive…"
                  className={cn(
                    "w-full px-3 py-2.5 rounded-xl border text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none",
                    isDark ? "border-white/10" : "border-border"
                  )}
                />
              </div>

              <Button onClick={handleSaveConfig} disabled={updateAiConfig.isPending}>
                {updateAiConfig.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Configuration
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── AUDIT LOGS TAB ───────────────────────────────── */}
      {activeTab === "audit" && (
        <Card className={cn(isDark ? "bg-background/50 border-border" : "border-border")}>
          <CardHeader>
            <CardTitle className="text-foreground">Audit Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn("text-xs text-muted-foreground uppercase border-b", isDark ? "border-border" : "border-border")}>
                    <th className="pb-3 text-left font-medium px-2">Time</th>
                    <th className="pb-3 text-left font-medium px-2">User</th>
                    <th className="pb-3 text-left font-medium px-2">Action</th>
                    <th className="pb-3 text-left font-medium px-2">Entity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditLogs?.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-3 px-2 text-foreground">{log.userEmail || "—"}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="font-mono text-xs">{log.action}</Badge>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{log.entityType || "—"}</td>
                    </tr>
                  ))}
                  {!auditLogs?.length && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-muted-foreground">No audit logs yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
