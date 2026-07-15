import { useAdminListUsers, useAdminUpdateUser } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Shield, User, MoreVertical, Ban, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export default function AdminUsersPage() {
  const { data: users, isLoading } = useAdminListUsers();
  const updateUser = useAdminUpdateUser();

  const handleToggleStatus = (id: number, currentStatus: boolean) => {
    updateUser.mutate({ userId: id, data: { isActive: !currentStatus } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }) // Or appropriate query key
    });
  };

  const handleToggleRole = (id: number, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    updateUser.mutate({ userId: id, data: { role: newRole as any } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    });
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-500" />
            Command Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage family access and roles.</p>
        </div>
      </div>

      <div className="flex border-b border-border mb-6">
        <Link href="/admin" className="px-4 py-2 border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors">Overview</Link>
        <Link href="/admin/users" className="px-4 py-2 border-b-2 border-primary text-foreground font-medium">Users</Link>
      </div>

      <Card className="glass-card border-border bg-background/50 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Usage</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-8 w-40 bg-muted/30" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-16 bg-muted/30" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-16 bg-muted/30" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-24 bg-muted/30" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-8 ml-auto bg-muted/30" /></td>
                  </tr>
                ))
              ) : (
                users?.map(user => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.name}&background=random`} 
                          alt="" 
                          className="w-8 h-8 rounded-full border border-border"
                        />
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={
                        user.role === 'admin' 
                          ? 'border-red-500/30 text-red-400 bg-red-500/10' 
                          : 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                      }>
                        {user.role === 'admin' ? <Shield className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={
                        user.isActive 
                          ? 'border-green-500/30 text-green-400 bg-green-500/10' 
                          : 'border-slate-500/30 text-slate-400 bg-slate-500/10'
                      }>
                        {user.isActive ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p><span className="text-foreground/70">{user.totalChats || 0}</span> chats</p>
                        <p><span className="text-foreground/70">{(user.tokensUsed || 0).toLocaleString()}</span> tokens</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-xl border-border">
                          <DropdownMenuItem onClick={() => handleToggleRole(user.id, user.role)} className="text-foreground hover:bg-muted/40">
                            <Shield className="w-4 h-4 mr-2" /> Make {user.role === 'admin' ? 'Member' : 'Admin'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-muted/40" />
                          <DropdownMenuItem onClick={() => handleToggleStatus(user.id, user.isActive)} className={user.isActive ? "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10" : "text-green-400 hover:text-green-300 hover:bg-green-400/10"}>
                            {user.isActive ? <Ban className="w-4 h-4 mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />} 
                            {user.isActive ? "Suspend User" : "Activate User"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}