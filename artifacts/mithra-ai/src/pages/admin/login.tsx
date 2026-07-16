import { useState } from "react";
import { useUser } from "@clerk/react";
import { Redirect, useLocation } from "wouter";
import { ShieldAlert, Lock, Eye, EyeOff, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import ThemeToggle from "@/components/ThemeToggle";

const ADMIN_PASSCODE = "mithra-admin-2024";

export default function AdminLoginPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { data: me, isLoading: meLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: isSignedIn ?? false } });
  const [, setLocation] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);

  if (!isLoaded || (isSignedIn && meLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  if (me?.role === "admin" && sessionStorage.getItem("admin-verified") === "1") {
    return <Redirect to="/admin" />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (me?.role !== "admin") {
      setError("Your account does not have admin privileges.");
      return;
    }
    if (passcode === ADMIN_PASSCODE) {
      sessionStorage.setItem("admin-verified", "1");
      setLocation("/admin");
    } else {
      setAttempts((a) => a + 1);
      setError(attempts >= 2 ? "Too many incorrect attempts. Contact your system administrator." : "Incorrect admin passcode.");
      setPasscode("");
    }
  };

  return (
    <div className={cn(
      "min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden px-4"
    )}>
      {/* BG effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/10 via-background to-background pointer-events-none" />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className={cn(
        "w-full max-w-sm rounded-2xl border p-8 shadow-2xl relative z-10",
        isDark ? "bg-background/80 border-white/10 backdrop-blur-xl" : "bg-card border-border"
      )}>
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">Mithra</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Admin Portal</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Restricted access. Enter your admin passcode to continue.
          </p>
        </div>

        {/* Role check */}
        {me && me.role !== "admin" && (
          <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">
              Your account (<span className="font-medium">{me.email}</span>) does not have admin privileges.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Admin Passcode</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPasscode ? "text" : "password"}
                value={passcode}
                onChange={(e) => { setPasscode(e.target.value); setError(""); }}
                placeholder="Enter admin passcode"
                className={cn(
                  "w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors",
                  isDark ? "border-white/10 focus:border-primary/50" : "border-border focus:border-primary"
                )}
                disabled={me?.role !== "admin"}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPasscode((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white border-0"
            disabled={!passcode || me?.role !== "admin" || attempts >= 3}
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            Access Admin Portal
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Signed in as <span className="font-medium text-foreground">{me?.email}</span>
          {me?.role === "admin" && (
            <span className="ml-1 text-green-500 font-medium">(Admin)</span>
          )}
        </p>
      </div>
    </div>
  );
}
