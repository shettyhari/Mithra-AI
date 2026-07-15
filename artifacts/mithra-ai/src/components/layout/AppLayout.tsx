import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import ThemeToggle from "@/components/ThemeToggle";
import GlobalSearch from "@/components/GlobalSearch";
import {
  LayoutDashboard,
  MessageSquare,
  FolderOpen,
  CheckSquare,
  Bell,
  Settings,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Search,
  Zap,
  Bot,
  Users,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetMe, useGetUnreadNotificationCount } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const { theme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: me, isLoading: meLoading } = useGetMe({
    query: { retry: false, staleTime: 1000 * 60 * 5 }
  });

  const { data: unreadData } = useGetUnreadNotificationCount({
    query: { refetchInterval: 1000 * 60 }
  });

  const isAdmin = me?.role === "admin";
  const unreadCount = unreadData?.count || 0;

  // Listen for global Cmd+K shortcut
  useEffect(() => {
    const handler = () => setSearchOpen(true);
    window.addEventListener("mithra-search-open", handler);
    return () => window.removeEventListener("mithra-search-open", handler);
  }, []);

  // Keyboard shortcut in layout scope too
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const navigation = [
    { name: "Chat", href: "/chat", icon: MessageSquare },
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Personas", href: "/personas", icon: Bot },
    { name: "Family", href: "/family", icon: Users },
    { name: "Memory", href: "/memories", icon: Brain },
    { name: "Files", href: "/files", icon: FolderOpen },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Notifications", href: "/notifications", icon: Bell, badge: unreadCount > 0 ? unreadCount : null },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  if (isAdmin) {
    navigation.push({ name: "Admin", href: "/admin", icon: ShieldAlert, badge: null } as typeof navigation[0]);
  }

  const handleLogout = () => signOut({ redirectUrl: "/" });

  const isActive = (href: string) =>
    href === "/chat"
      ? location === "/chat" || location.startsWith("/chat/")
      : location.startsWith(href);

  return (
    <div className={cn("flex h-screen overflow-hidden bg-background text-foreground")}>
      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className={cn(
        "hidden md:flex w-64 flex-col border-r shrink-0 relative z-20 transition-colors duration-300",
        theme === "dark"
          ? "border-white/5 bg-background/60 backdrop-blur-xl"
          : "border-border bg-background shadow-sm"
      )}>
        {/* Logo */}
        <div className="p-5 flex items-center gap-3 border-b border-border/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className={cn(
            "font-bold text-xl tracking-tight",
            theme === "dark" ? "text-gradient" : "text-foreground"
          )}>
            Mithra
          </span>
          {/* Theme toggle right in header */}
          <div className="ml-auto">
            <ThemeToggle size="sm" />
          </div>
        </div>

        {/* Search trigger */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-muted-foreground transition-all duration-200 border",
              theme === "dark"
                ? "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:text-foreground"
                : "bg-muted/50 border-border hover:bg-muted hover:text-foreground"
            )}
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left truncate">Search everything…</span>
            <kbd className={cn(
              "text-[10px] font-mono px-1.5 py-0.5 rounded border hidden lg:block",
              theme === "dark" ? "bg-white/5 border-white/10" : "bg-background border-border"
            )}>⌘K</kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  active
                    ? theme === "dark"
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "bg-primary/10 text-primary border border-primary/15"
                    : theme === "dark"
                      ? "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-4.5 h-4.5", active ? "text-primary" : "text-muted-foreground")} />
                <span>{item.name}</span>
                {item.badge ? (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground min-w-[18px] text-center">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className={cn("p-4 border-t", theme === "dark" ? "border-white/5" : "border-border")}>
          {meLoading ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-2 py-2 group">
              <img
                src={me?.avatarUrl || clerkUser?.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(me?.name || "U")}&background=8b5cf6&color=fff`}
                alt="Avatar"
                className="w-8 h-8 rounded-full border border-border shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate text-foreground">{me?.name || clerkUser?.fullName}</span>
                <span className="text-xs text-muted-foreground truncate">{me?.email}</span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground transition-all duration-200 mt-1",
              theme === "dark" ? "hover:bg-white/5 hover:text-foreground" : "hover:bg-accent hover:text-foreground"
            )}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile Header ───────────────────────────────────────── */}
      <div className={cn(
        "md:hidden absolute top-0 left-0 right-0 h-14 border-b z-30 flex items-center justify-between px-4 transition-colors duration-300",
        theme === "dark" ? "border-white/5 bg-background/90 backdrop-blur-xl" : "border-border bg-background shadow-sm"
      )}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className={cn("font-bold text-base", theme === "dark" ? "text-gradient" : "text-foreground")}>Mithra</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSearchOpen(true)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Search className="w-4.5 h-4.5" />
          </button>
          <ThemeToggle size="sm" />
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Menu className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* ── Mobile Sidebar Overlay ──────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className={cn(
            "w-72 h-full flex flex-col animate-in slide-in-from-left duration-200",
            theme === "dark" ? "bg-background border-r border-white/10" : "bg-background border-r border-border shadow-xl"
          )}>
            <div className="p-4 flex items-center justify-between border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <span className={cn("font-bold text-base", theme === "dark" ? "text-gradient" : "text-foreground")}>Mithra</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {navigation.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("w-4.5 h-4.5", active ? "text-primary" : "")} />
                    {item.name}
                    {item.badge ? (
                      <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-border space-y-2">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-muted-foreground">Appearance</span>
                <ThemeToggle size="sm" />
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* ── Main Content ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {theme === "dark" && (
          <>
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none" />
          </>
        )}
        <div className="flex-1 overflow-y-auto pt-14 md:pt-0">
          <div className="h-full p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </div>
      </main>

      {/* Global Search Modal */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
