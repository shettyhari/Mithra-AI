import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, getListNotificationsQueryKey, getGetUnreadNotificationCountQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Bell, Check, CheckCheck, MessageSquare, CheckSquare, FileText, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useListNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkRead = (id: number) => {
    markRead.mutate({ notificationId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUnreadNotificationCountQueryKey() });
      }
    });
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUnreadNotificationCountQueryKey() });
      }
    });
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'message': return <MessageSquare className="w-4 h-4 text-purple-400" />;
      case 'task': return <CheckSquare className="w-4 h-4 text-cyan-400" />;
      case 'file_share': return <FileText className="w-4 h-4 text-yellow-400" />;
      default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <div className="h-full flex flex-col space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Comms</h1>
          <p className="text-muted-foreground text-sm mt-1">System and family updates.</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="border-border bg-muted/30" disabled={markAllRead.isPending}>
            <CheckCheck className="w-4 h-4 mr-2" /> Mark all read
          </Button>
        )}
      </div>

      <Card className="glass-card border-border flex-1 overflow-hidden flex flex-col bg-background/40">
        <div className="flex-1 overflow-y-auto p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-4 flex gap-4">
                  <Skeleton className="w-10 h-10 rounded-full bg-muted/30" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3 bg-muted/30" />
                    <Skeleton className="h-3 w-2/3 bg-muted/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
              <Bell className="w-12 h-12 opacity-20 mb-4" />
              <p>No new comms</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications?.map(notif => (
                <div key={notif.id} className={`p-4 flex gap-4 transition-colors ${notif.isRead ? 'opacity-60' : 'bg-white/[0.02]'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${notif.isRead ? 'bg-muted/30' : 'bg-muted/40 border border-white/20'}`}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className={`text-sm ${notif.isRead ? 'text-foreground/80' : 'text-foreground font-medium'}`}>{notif.title}</p>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                        {new Date(notif.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {notif.body && (
                      <p className="text-sm text-muted-foreground mt-1">{notif.body}</p>
                    )}
                    {notif.fromUserName && (
                      <p className="text-xs text-muted-foreground mt-2">From: {notif.fromUserName}</p>
                    )}
                  </div>
                  {!notif.isRead && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0" onClick={() => handleMarkRead(notif.id)} disabled={markRead.isPending}>
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}