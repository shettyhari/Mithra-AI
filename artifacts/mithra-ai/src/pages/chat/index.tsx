import { useEffect, useRef, useState } from "react";
import { useListChats, useCreateChat, useUpdateChat, useDeleteChat, getListChatsQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Plus, Search, MessageSquare, Pin, Archive, Trash2, MoreVertical, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

export default function ChatListPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  
  const { data: chats, isLoading } = useListChats(
    search ? { search } : undefined
  );
  
  const createChat = useCreateChat();
  const updateChat = useUpdateChat();
  const deleteChat = useDeleteChat();

  const handleNewChat = () => {
    createChat.mutate({ data: { title: "New Conversation" } }, {
      onSuccess: (chat) => {
        queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
        setLocation(`/chat/${chat.id}`);
      }
    });
  };

  // Land directly in a live conversation: jump into the most recent chat, or
  // auto-create one, so /chat is a real AI chat screen rather than an empty list.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (search || isLoading || autoOpenedRef.current || !chats) return;
    autoOpenedRef.current = true;
    if (chats.length > 0) {
      setLocation(`/chat/${chats[0].id}`);
    } else if (!createChat.isPending) {
      handleNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, isLoading, search]);

  const handlePin = (id: number, isPinned: boolean) => {
    updateChat.mutate({ chatId: id, data: { isPinned: !isPinned } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() })
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this conversation?")) {
      deleteChat.mutate({ chatId: id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() })
      });
    }
  };

  const pinnedChats = chats?.filter(c => c.isPinned) || [];
  const regularChats = chats?.filter(c => !c.isPinned) || [];

  return (
    <div className="h-full flex flex-col space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Intelligence</h1>
        <Button onClick={handleNewChat} variant="premium" className="gap-2" disabled={createChat.isPending}>
          <Plus className="w-4 h-4" /> New Session
        </Button>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search archives..." 
          className="pl-9 bg-background/50 border-border focus-visible:ring-purple-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pb-20">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 w-full rounded-xl bg-muted/30" />
            ))}
          </div>
        ) : chats?.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground flex flex-col items-center">
            <MessageSquare className="w-12 h-12 opacity-20 mb-4" />
            <p>No conversations found.</p>
          </div>
        ) : (
          <>
            {pinnedChats.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 flex items-center gap-2">
                  <Pin className="w-3 h-3" /> Pinned
                </h3>
                <div className="grid gap-2">
                  {pinnedChats.map(chat => (
                    <ChatCard key={chat.id} chat={chat} onClick={() => setLocation(`/chat/${chat.id}`)} onPin={() => handlePin(chat.id, true)} onDelete={() => handleDelete(chat.id)} />
                  ))}
                </div>
              </div>
            )}
            
            {regularChats.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Recent</h3>
                <div className="grid gap-2">
                  {regularChats.map(chat => (
                    <ChatCard key={chat.id} chat={chat} onClick={() => setLocation(`/chat/${chat.id}`)} onPin={() => handlePin(chat.id, false)} onDelete={() => handleDelete(chat.id)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ChatCard({ chat, onClick, onPin, onDelete }: any) {
  return (
    <div 
      className="glass-card bg-background/40 hover:bg-white/[0.04] border-border/50 p-4 rounded-xl flex items-center gap-4 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-full bg-muted/30 border border-border flex items-center justify-center flex-shrink-0">
        <MessageSquare className="w-4 h-4 text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1">
          <h4 className="text-base font-medium text-foreground truncate">{chat.title}</h4>
          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
            {format(new Date(chat.updatedAt), "MMM d")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {chat.lastMessage || "Empty session"}
        </p>
      </div>
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-background/95 backdrop-blur-xl border-border">
            <DropdownMenuItem onClick={onPin} className="text-foreground hover:bg-muted/40">
              <Pin className="w-4 h-4 mr-2" /> {chat.isPinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-muted/40" />
            <DropdownMenuItem onClick={onDelete} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}