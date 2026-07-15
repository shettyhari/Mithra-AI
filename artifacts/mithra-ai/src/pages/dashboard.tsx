import { useGetDashboardSummary, useListUpcomingTasks, useListRecentChats } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FolderOpen, CheckSquare, Bell, Clock, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: tasks, isLoading: tasksLoading } = useListUpcomingTasks();
  const { data: chats, isLoading: chatsLoading } = useListRecentChats();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
        {summary?.activeModel && (
          <Badge variant="outline" className="border-border bg-muted/30 text-foreground/80 font-mono text-xs">
            Model: {summary.activeModel}
          </Badge>
        )}
      </div>

      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border bg-background/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Chats</CardTitle>
              <MessageSquare className="w-4 h-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-foreground">{summary?.totalChats || 0}</div>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border bg-background/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tasks</CardTitle>
              <CheckSquare className="w-4 h-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-foreground">{summary?.completedTasks || 0} <span className="text-sm text-muted-foreground font-normal">/ {summary?.totalTasks || 0} done</span></div>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border bg-background/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Files</CardTitle>
              <FolderOpen className="w-4 h-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-foreground">{summary?.totalFiles || 0}</div>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border bg-background/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Notifications</CardTitle>
              <Bell className="w-4 h-4 text-red-400" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-foreground">{summary?.unreadNotifications || 0}</div>}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[300px]">
        {/* Recent Chats */}
        <Card className="glass-card border-border flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
            <CardTitle className="text-lg font-semibold text-foreground">Recent Intel</CardTitle>
            <Link href="/chat" className="text-sm text-primary hover:text-primary/80 flex items-center">
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {chatsLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                ))}
              </div>
            ) : !chats?.length ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {chats.slice(0, 5).map(chat => (
                  <Link key={chat.id} href={`/chat/${chat.id}`} className="flex flex-col p-4 hover:bg-white/[0.02] transition-colors cursor-pointer group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">{chat.title}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {new Date(chat.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {chat.lastMessage && (
                      <span className="text-sm text-muted-foreground truncate">{chat.lastMessage}</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card className="glass-card border-border flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
            <CardTitle className="text-lg font-semibold text-foreground">Action Items</CardTitle>
            <Link href="/tasks" className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center">
              Board <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {tasksLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
              </div>
            ) : !tasks?.length ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                <CheckSquare className="w-8 h-8 mb-2 opacity-20" />
                <p>All clear</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-start p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="mt-1 w-4 h-4 rounded border border-white/20 flex-shrink-0" />
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                      <div className="flex items-center mt-1 gap-2">
                        {task.dueDate && (
                          <span className="text-xs text-muted-foreground flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        <Badge variant="outline" className={
                          task.priority === 'high' ? "border-red-500/30 text-red-400" :
                          task.priority === 'medium' ? "border-yellow-500/30 text-yellow-400" :
                          "border-border text-muted-foreground"
                        }>
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}