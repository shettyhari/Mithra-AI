import { useListFiles, useGetStorageSummary, useDeleteFile, getListFilesQueryKey, getGetStorageSummaryQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { FileIcon, ImageIcon, FileTextIcon, HardDrive, Trash2, UploadCloud, SearchIcon, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { formatBytes } from "@/lib/utils";

// Add formatBytes helper to utils later, or mock it here:
const fmtBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function FilesPage() {
  const [search, setSearch] = useState("");
  
  const { data: files, isLoading } = useListFiles(search ? { search } : undefined);
  const { data: storage } = useGetStorageSummary();
  const deleteFile = useDeleteFile();

  const handleDelete = (id: number) => {
    if(confirm("Delete this file permanently?")) {
      deleteFile.mutate({ fileId: id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStorageSummaryQueryKey() });
        }
      });
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Vault</h1>
          <p className="text-muted-foreground text-sm mt-1">Encrypted family storage.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-white/10 bg-white/5">
            <Filter className="w-4 h-4 mr-2" /> Filter
          </Button>
          <Button variant="premium" className="gap-2">
            <UploadCloud className="w-4 h-4" /> Upload
          </Button>
        </div>
      </div>

      {storage && (
        <Card className="glass-card border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <HardDrive className="w-4 h-4 text-purple-400" />
              Storage Usage
            </div>
            <div className="text-xs text-muted-foreground">
              {fmtBytes(storage.usedBytes)} of {fmtBytes(storage.totalBytes)} used
            </div>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
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
          className="pl-9 bg-background/50 border-white/10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="aspect-square rounded-xl bg-white/5" />)}
          </div>
        ) : files?.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
            <UploadCloud className="w-10 h-10 mb-4 opacity-20" />
            <p>Vault is empty</p>
            <p className="text-xs mt-1">Upload files to share with the family.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {files?.map(file => (
              <div key={file.id} className="glass-card border border-white/5 bg-background/40 p-4 rounded-xl flex flex-col items-center text-center group hover:bg-white/[0.04] transition-colors relative cursor-pointer">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-400 hover:bg-red-400/10" onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-3">
                  {getIcon(file.mimeType || file.type)}
                </div>
                <p className="text-sm font-medium text-white w-full truncate px-2">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{fmtBytes(file.size)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}