import { useAdminGetSystemStats, useAdminListUsers } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Server, Database, Activity, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { formatBytes } from "@/lib/utils";

const fmtBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function AdminPage() {
  const { data: stats, isLoading: statsLoading } = useAdminGetSystemStats();
  
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-500" />
            Command Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">System overview and family management.</p>
        </div>
      </div>

      <div className="flex border-b border-white/10 mb-6">
        <Link href="/admin" className="px-4 py-2 border-b-2 border-primary text-white font-medium">Overview</Link>
        <Link href="/admin/users" className="px-4 py-2 border-b-2 border-transparent text-muted-foreground hover:text-white transition-colors">Users</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card border-white/10 bg-background/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Family Members</CardTitle>
            <Users className="w-4 h-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-white">{stats?.totalUsers || 0}</div>}
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 bg-background/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Tokens</CardTitle>
            <Activity className="w-4 h-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-white">{stats?.totalTokensUsed?.toLocaleString() || 0}</div>}
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 bg-background/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Messages</CardTitle>
            <Server className="w-4 h-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-white">{stats?.totalMessages?.toLocaleString() || 0}</div>}
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 bg-background/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Storage Used</CardTitle>
            <Database className="w-4 h-4 text-red-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-white">{fmtBytes(stats?.storageUsedBytes || 0)}</div>}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card className="glass-card border-white/10 bg-background/50">
          <CardHeader>
            <CardTitle className="text-lg text-white">System Status</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                    <span className="text-sm text-white">API Services</span>
                  </div>
                  <span className="text-xs text-green-400">Operational</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                    <span className="text-sm text-white">Database</span>
                  </div>
                  <span className="text-xs text-green-400">Operational</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                    <span className="text-sm text-white">AI Providers</span>
                  </div>
                  <span className="text-xs text-green-400">Operational</span>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}