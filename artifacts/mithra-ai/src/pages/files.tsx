import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useListFiles, useGetStorageSummary, useDeleteFile, getListFilesQueryKey, getGetStorageSummaryQueryKey } from "@workspace/api-client-react";
import { queryClient, BASE_URL } from "@/lib/queryClient";
import { FileIcon, ImageIcon, FileTextIcon, HardDrive, Trash2, UploadCloud, SearchIcon, Filter, Sparkles, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

const fmtBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface FileAnalysis {
  fileId: number;
  summary: string;
  keyPoints: string[];
  loading?: boolean;
}

export default function FilesPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [search, setSearch] = useState("");
  const [analyses, setAnalyses] = useState<Record<number, FileAnalysis>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: files, isLoading } = useListFiles(search ? { search } : undefined);
  const { data: storage } = useGetStorageSummary();
  const deleteFile = useDeleteFile();

  const handleDelete = (id: number) => {
    if (confirm("Delete this file permanently?")) {
      deleteFile.mutate({ fileId: id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStorageSummaryQueryKey() });
        }
      });
    }
  };

  const handleAnalyze = async (fileId: number) => {
    setAnalyses(a => ({ ...a, [fileId]: { fileId, summary: "", keyPoints: [], loading: true } }));
    setExpanded(fileId);
    try {
      const tok = await getToken();
      const res = await fetch(`${BASE_URL}api/files/${fileId}/analyze`, {
        method: "POST", credentials: "include",
        headers: { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setAnalyses(a => ({ ...a, [fileId]: { fileId, summary: data.summary, keyPoints: data.keyPoints || [], loading: false } }));
    } catch {
      setAnalyses(a => ({ ...a, [fileId]: { fileId, summary: "Analysis failed. Try again.", keyPoints: [], loading: false } }));
      toast({ title: "Analysis failed", variant: "destructive" });
    }
  };

  const getIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-cyan-400" />;
    if (type.includes('pdf') || type.includes('text')) return <FileTextIcon className="w-8 h-8 text-purple-400" />;
    return <FileIcon className="w-8 h-8 text-slate-400" />;
  };

  const usedPerc = storage ? (storage.usedBytes / storage.totalBytes) * 100 : 0;

  return (
    <div className="h-full flex flex-col space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Vault</h1>
          <p className="text-muted-foreground text-sm mt-1">Encrypted family storage with AI analysis.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-border bg-muted/30">
            <Filter className="w-4 h-4 mr-2" /> Filter
          </Button>
          <Button variant="premium" className="gap-2">
            <UploadCloud className="w-4 h-4" /> Upload
          </Button>
        </div>
      </div>

      {storage && (
        <Card className="glass-card border-border bg-black/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <HardDrive className="w-4 h-4 text-purple-400" />
              Storage Usage
            </div>
            <div className="text-xs text-muted-foreground">
              {fmtBytes(storage.usedBytes)} of {fmtBytes(storage.totalBytes)} used
            </div>
          </div>
          <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, usedPerc))}%` }}
            />
          </div>
        </Card>
      )}

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search files by name..."
          className="pl-9 bg-background/50 border-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="aspect-square rounded-xl bg-muted/30" />)}
          </div>
        ) : files?.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-2xl bg-white/[0.02]">
            <UploadCloud className="w-10 h-10 mb-4 opacity-20" />
            <p>Vault is empty</p>
            <p className="text-xs mt-1">Upload files to share with the family.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {files?.map(file => {
              const analysis = analyses[file.id];
              const isExpanded = expanded === file.id;
              return (
                <div key={file.id} className={cn("glass-card border border-border/50 bg-background/40 rounded-xl overflow-hidden transition-all", isDark ? "hover:border-border/80" : "hover:shadow-sm")}>
                  <div className="p-4 flex items-center gap-4 group">
                    <div className="w-12 h-12 bg-muted/30 rounded-xl flex items-center justify-center shrink-0">
                      {getIcon(file.mimeType || file.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">{fmtBytes(file.size)}</p>
                        {analysis && !analysis.loading && (
                          <Badge variant="outline" className="text-[10px] h-4 gap-1 text-purple-400 border-purple-400/40">
                            <Sparkles className="w-2.5 h-2.5" /> Analyzed
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => {
                          if (!analysis || analysis.loading === false) handleAnalyze(file.id);
                          else setExpanded(isExpanded ? null : file.id);
                        }}
                        disabled={analysis?.loading}>
                        {analysis?.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {analysis?.loading ? "Analyzing…" : analysis ? (isExpanded ? "Hide" : "Show") : "Analyze"}
                      </Button>
                      {analysis && !analysis.loading && (
                        <button onClick={() => setExpanded(isExpanded ? null : file.id)} className="p-1 text-muted-foreground hover:text-foreground">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(file.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* AI Analysis Panel */}
                  {isExpanded && analysis && !analysis.loading && (
                    <div className={cn("px-4 pb-4 border-t", isDark ? "border-border/40 bg-white/[0.02]" : "border-border bg-muted/20")}>
                      <div className="pt-3 space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">AI Analysis</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{analysis.summary}</p>
                        {analysis.keyPoints.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Key Points</p>
                            <ul className="space-y-1">
                              {analysis.keyPoints.map((kp, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                                  <span className="text-primary mt-0.5 shrink-0">•</span>{kp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={() => handleAnalyze(file.id)}>
                          <Sparkles className="w-3 h-3" /> Re-analyze
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
