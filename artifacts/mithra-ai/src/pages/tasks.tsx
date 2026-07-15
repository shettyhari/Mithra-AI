import { useState } from "react";
import { useListTasks, useCreateTask, useUpdateTask, useDeleteTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Plus, GripVertical, CheckCircle2, Circle, Clock, Trash2, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function TasksPage() {
  const { data: tasks, isLoading, error } = useListTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", priority: "medium" as any });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    
    createTask.mutate({ data: newTask }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        setIsNewOpen(false);
        setNewTask({ title: "", priority: "medium" });
      }
    });
  };

  const handleStatusChange = (id: number, status: 'todo' | 'in_progress' | 'done') => {
    updateTask.mutate({ taskId: id, data: { status } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() })
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this task?")) {
      deleteTask.mutate({ taskId: id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() })
      });
    }
  };

  const columns = [
    { id: 'todo', title: 'To Do', color: 'text-slate-400', border: 'border-slate-500/20' },
    { id: 'in_progress', title: 'In Progress', color: 'text-cyan-400', border: 'border-cyan-500/20' },
    { id: 'done', title: 'Done', color: 'text-purple-400', border: 'border-purple-500/20' },
  ];

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <AlertCircle className="w-8 h-8 text-destructive" />
      <p className="text-sm">Failed to load tasks. Please refresh the page.</p>
    </div>
  );

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Action Items</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and track family tasks.</p>
        </div>
        
        <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
          <DialogTrigger asChild>
            <Button variant="premium" className="gap-2">
              <Plus className="w-4 h-4" /> Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-border text-foreground sm:max-w-[425px]">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>New Action Item</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title" className="text-muted-foreground">Task</Label>
                  <Input 
                    id="title" 
                    autoFocus
                    placeholder="E.g., Renew passports" 
                    value={newTask.title} 
                    onChange={e => setNewTask({...newTask, title: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Priority</Label>
                  <Select value={newTask.priority} onValueChange={(v: any) => setNewTask({...newTask, priority: v})}>
                    <SelectTrigger className="bg-background/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background/95 border-border">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsNewOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!newTask.title.trim() || createTask.isPending} className="bg-white text-black hover:bg-white/90">
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden pb-4">
        {columns.map(col => {
          const columnTasks = tasks?.filter(t => t.status === col.id) || [];
          return (
            <div key={col.id} className="flex-1 flex flex-col min-w-[280px] bg-white/[0.02] border border-border/50 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border/50 flex items-center justify-between bg-black/20">
                <h3 className={`font-semibold text-sm ${col.color} uppercase tracking-wider`}>{col.title}</h3>
                <span className="text-xs bg-muted/40 px-2 py-0.5 rounded-full text-foreground/70">{columnTasks.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {isLoading ? (
                  [1,2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl bg-muted/30" />)
                ) : columnTasks.length === 0 ? (
                  <div className="h-20 flex items-center justify-center text-sm text-muted-foreground/50 border-2 border-dashed border-border/50 rounded-xl">
                    Drop items here
                  </div>
                ) : (
                  columnTasks.map(task => (
                    <div key={task.id} className={`glass-card bg-background/60 border ${col.border} p-4 rounded-xl group hover:border-white/20 transition-colors relative`}>
                      <div className="flex justify-between items-start mb-2">
                        <p className={`font-medium text-sm leading-snug ${col.id === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {task.title}
                        </p>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1"
                          onClick={() => handleDelete(task.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex gap-2">
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${
                            task.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            task.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                            'bg-muted/30 text-muted-foreground border-border'
                          }`}>
                            {task.priority}
                          </Badge>
                          {task.dueDate && (
                            <Badge variant="outline" className="bg-muted/30 text-muted-foreground border-border text-[10px] h-5 px-1.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          {col.id !== 'todo' && (
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handleStatusChange(task.id, 'todo')}>
                              <Circle className="w-4 h-4" />
                            </Button>
                          )}
                          {col.id !== 'in_progress' && (
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-cyan-400/50 hover:text-cyan-400" onClick={() => handleStatusChange(task.id, 'in_progress')}>
                              <Clock className="w-4 h-4" />
                            </Button>
                          )}
                          {col.id !== 'done' && (
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-purple-400/50 hover:text-purple-400" onClick={() => handleStatusChange(task.id, 'done')}>
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}