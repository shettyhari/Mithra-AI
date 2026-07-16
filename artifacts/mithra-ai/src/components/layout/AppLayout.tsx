import React, { useState, useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import ThemeToggle from "@/components/ThemeToggle";
import GlobalSearch from "@/components/GlobalSearch";
import VoiceAgent from "@/components/VoiceAgent";
import {
  LayoutDashboard, MessageSquare, FolderOpen, CheckSquare, Bell,
  Settings, ShieldAlert, LogOut, Menu, X, Search, Zap, Bot, Users,
  Brain, Calendar, Target, BarChart3, ShoppingCart, DollarSign,
  BookOpen, Flag, StickyNote, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetMe, useGetUnreadNotificationCount, getGetMeQueryKey, getGetUnreadNotificationCountQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

// ── Navigation categories ──────────────────────────────────────────
type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | null;
};
type NavCategory = { label: string; items: NavItem[] };

function buildNav(unreadCount: number, isAdmin: boolean): NavCategory[] {
  const categories: NavCategory[] = [
    {
      label: "AI",
      items: [
        { name: "Chat", href: "/chat", icon: MessageSquare },
        { name: "Personas", href: "/personas", icon: Bot },
        { name: "Memory", href: "/memories", icon: Brain },
      ],
    },
    {
      label: "Planning",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Calendar", href: "/calendar", icon: Calendar },
        { name: "Habits", href: "/habits", icon: Target },
        { name: "Goals", href: "/goals", icon: Flag },
        { name: "Tasks", href: "/tasks", icon: CheckSquare },
      ],
    },
    {
      label: "Personal",
      items: [
        { name: "Journal", href: "/journal", icon: BookOpen },
        { name: "Notes", href: "/notes", icon: StickyNote },
        { name: "Shopping", href: "/shopping", icon: ShoppingCart },
        { name: "Budget", href: "/budget", icon: DollarSign },
      ],
    },
    {
      label: "Insights",
      items: [
        { name: "Insights", href: "/insights", icon: BarChart3 },
        { name: "Automations", href: "/automations", icon: Zap },
      ],
    },
    {
      label: "Family",
      items: [
        { name: "Family", href: "/family", icon: Users },
        { name: "Files", href: "/files", icon: FolderOpen },
      ],
    },
    {
      label: "System",
      items: [
        { name: "Notifications", href: "/notifications", icon: Bell, badge: unreadCount > 0 ? unreadCount : null },
        { name: "Settings", href: "/settings", icon: Settings },
      ],
    },
  ];

  if (isAdmin) {
    categories[categories.length - 1].items.push({ name: "Admin", href: "/admin", icon: ShieldAlert, badge: null });
  }

  return categories;
}

// ── Collapsed category state key ──────────────────────────────────
const COLLAPSED_KEY = "mithra-nav-collapsed";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]")); }
    catch { return new Set(); }
  });

  const { data: me, isLoading: meLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 1000 * 60 * 5 },
  });
  const { data: unreadData } = useGetUnreadNotificationCount({
    query: { queryKey: getGetUnreadNotificationCountQueryKey(), refetchInterval: 1000 * 60 },
  });

  const isAdmin = me?.role === "admin";
  const unreadCount = unreadData?.count || 0;
  const navCategories = buildNav(unreadCount, isAdmin);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsedCats]));
  }, [collapsedCats]);

  const toggleCategory = (label: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Global shortcuts
  useEffect(() => {
    const onSearch = () => setSearchOpen(true);
    window.addEventListener("mithra-search-open", onSearch);
    return () => window.removeEventListener("mithra-search-open", onSearch);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(o => !o); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleLogout = () => signOut({ redirectUrl: "/" });
  const isActive = (href: string) =>
    href === "/chat" ? location === "/chat" || location.startsWith("/chat/") : location.startsWith(href);

  // ── Shared nav renderer ──────────────────────────────────────────
  const renderNav = (onClickItem?: () => void) => (
    <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scroll-thin">
      {navCategories.map(cat => {
        const isCollapsed = collapsedCats.has(cat.label);
        const hasActive = cat.items.some(i => isActive(i.href));
        return (
          <div key={cat.label} className="mb-1">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(cat.label)}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1 mb-0.5 rounded-lg group transition-colors",
                isDark ? "hover:bg-white/5" : "hover:bg-muted/50"
              )}
            >
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-widest transition-colors",
                hasActive && isCollapsed
                  ? "text-primary"
                  : isDark ? "text-white/30 group-hover:text-white/50" : "text-muted-foreground/60 group-hover:text-muted-foreground"
              )}>
                {cat.label}
                {hasActive && isCollapsed && (
                  <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                )}
              </span>
              <ChevronDown className={cn(
                "w-3 h-3 transition-transform duration-200",
                isDark ? "text-white/20" : "text-muted-foreground/40",
                isCollapsed ? "-rotate-90" : ""
              )} />
            </button>

            {/* Items */}
            {!isCollapsed && (
              <div className="space-y-0.5">
                {cat.items.map(item => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onClickItem}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150",
                        active
                          ? isDark
                            ? "bg-primary/15 text-primary border border-primary/20"
                            : "bg-primary/10 text-primary border border-primary/15"
                          : isDark
                            ? "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate">{item.name}</span>
                      {item.badge ? (
                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground min-w-[18px] text-center">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">

      {/* ── Desktop Sidebar ───────────────────────────────────────── */}
      <aside className={cn(
        "hidden md:flex w-60 flex-col border-r shrink-0 relative z-20 transition-colors duration-300",
        isDark ? "border-white/5 bg-background/60 backdrop-blur-xl" : "border-border bg-background shadow-sm"
      )}>
        {/* Logo */}
        <div className="p-4 flex items-center gap-2.5 border-b border-border/50">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-sm shrink-0">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className={cn("font-bold text-lg tracking-tight", isDark ? "text-gradient" : "text-foreground")}>
            Mithra
          </span>
          <div className="ml-auto"><ThemeToggle size="sm" /></div>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground transition-all duration-200 border",
              isDark
                ? "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:text-foreground"
                : "bg-muted/50 border-border hover:bg-muted hover:text-foreground"
            )}>
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left text-xs truncate">Search everything…</span>
            <kbd className={cn(
              "text-[10px] font-mono px-1.5 py-0.5 rounded border hidden lg:block",
              isDark ? "bg-white/5 border-white/10" : "bg-background border-border"
            )}>⌘K</kbd>
          </button>
        </div>

        {/* Categorized nav */}
        {renderNav()}

        {/* User profile */}
        <div className={cn("p-3 border-t", isDark ? "border-white/5" : "border-border")}>
          {meLoading ? (
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <Skeleton className="w-7 h-7 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-2.5 w-28" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <img
                src={me?.avatarUrl || clerkUser?.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(me?.name || "U")}&background=8b5cf6&color=fff`}
                alt="Avatar"
                className="w-7 h-7 rounded-full border border-border shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium truncate text-foreground">{me?.name || clerkUser?.fullName}</span>
                <span className="text-[10px] text-muted-foreground truncate">{me?.email}</span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-muted-foreground transition-all duration-200 mt-0.5",
              isDark ? "hover:bg-white/5 hover:text-foreground" : "hover:bg-accent hover:text-foreground"
            )}>
            <LogOut className="w-3.5 h-3.5" />
            <span className="text-xs">Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Header ─────────────────────────────────────────── */}
      <div className={cn(
        "md:hidden absolute top-0 left-0 right-0 h-14 border-b z-30 flex items-center justify-between px-4",
        isDark ? "border-white/5 bg-background/90 backdrop-blur-xl" : "border-border bg-background shadow-sm"
      )}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className={cn("font-bold text-base", isDark ? "text-gradient" : "text-foreground")}>Mithra</span>
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

      {/* ── Mobile Sidebar ────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className={cn(
            "w-72 h-full flex flex-col animate-in slide-in-from-left duration-200",
            isDark ? "bg-background border-r border-white/10" : "bg-background border-r border-border shadow-xl"
          )}>
            <div className="p-4 flex items-center justify-between border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <span className={cn("font-bold text-base", isDark ? "text-gradient" : "text-foreground")}>Mithra</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderNav(() => setMobileMenuOpen(false))}
            <div className="p-4 border-t border-border space-y-2">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-muted-foreground">Appearance</span>
                <ThemeToggle size="sm" />
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* ── Main Content ──────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {isDark && (
          <>
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none" />
          </>
        )}
        {location.startsWith("/chat") ? (
          <div className="flex-1 overflow-hidden flex flex-col pt-14 md:pt-0">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pt-14 md:pt-0">
            <div className="min-h-full p-4 md:p-6 lg:p-8">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </div>
        )}
      </main>

      {/* Global Search Modal */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Global Voice Agent */}
      <VoiceAgent />
    </div>
  );
}
