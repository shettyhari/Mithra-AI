import { lazy, Suspense, useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "./pages/landing";
import AppLayout from "./components/layout/AppLayout";

const DashboardPage    = lazy(() => import("./pages/dashboard"));
const ChatListPage     = lazy(() => import("./pages/chat"));
const ChatRoomPage     = lazy(() => import("./pages/chat/[id]"));
const FilesPage        = lazy(() => import("./pages/files"));
const TasksPage        = lazy(() => import("./pages/tasks"));
const NotificationsPage = lazy(() => import("./pages/notifications"));
const SettingsPage     = lazy(() => import("./pages/settings"));
const AdminPage        = lazy(() => import("./pages/admin"));
const AdminUsersPage   = lazy(() => import("./pages/admin/users"));
const AdminLoginPage   = lazy(() => import("./pages/admin/login"));
const PersonasPage     = lazy(() => import("./pages/personas"));
const FamilyPage       = lazy(() => import("./pages/family"));
const MemoriesPage     = lazy(() => import("./pages/memories"));
const CalendarPage     = lazy(() => import("./pages/calendar"));
const HabitsPage       = lazy(() => import("./pages/habits"));
const InsightsPage     = lazy(() => import("./pages/insights"));
const AutomationsPage  = lazy(() => import("./pages/automations"));
const ShoppingPage     = lazy(() => import("./pages/shopping"));
const BudgetPage       = lazy(() => import("./pages/budget"));
const JournalPage      = lazy(() => import("./pages/journal"));
const GoalsPage        = lazy(() => import("./pages/goals"));
const NotesPage        = lazy(() => import("./pages/notes"));
const SharedChatPage   = lazy(() => import("./pages/shared/[token]"));
const NotFound         = lazy(() => import("./pages/not-found"));

const PageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
  </div>
);
import { ThemeProvider } from "./lib/theme";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(271.5 81.3% 55.9%)",
    colorForeground: "hsl(0 0% 98%)",
    colorMutedForeground: "hsl(240 5% 64.9%)",
    colorDanger: "hsl(0 62.8% 30.6%)",
    colorBackground: "hsl(240 10% 3.9%)",
    colorInput: "hsl(240 3.7% 15.9%)",
    colorInputForeground: "hsl(0 0% 98%)",
    colorNeutral: "hsl(240 3.7% 15.9%)",
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-background border border-white/10 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl glass-card",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-semibold text-2xl tracking-tight text-gradient",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-green-500",
    alertText: "text-destructive-foreground",
    logoBox: "flex justify-center mb-4",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "bg-background/50 border border-white/10 hover:bg-white/5",
    formButtonPrimary: "bg-gradient-premium text-white hover:opacity-90 luxury-glow border border-white/20",
    formFieldInput: "bg-background/50 border border-white/10 text-foreground focus:ring-primary focus:border-primary",
    footerAction: "mt-6",
    dividerLine: "bg-white/10",
    alert: "bg-destructive/20 border border-destructive text-destructive-foreground",
    otpCodeFieldInput: "bg-background/50 border border-white/10 text-foreground",
    formFieldRow: "mb-4",
    main: "p-8",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-background to-background" />
      <div className="relative z-10">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-background to-background" />
      <div className="relative z-10">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}


function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClientInstance = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClientInstance.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClientInstance]);

  return null;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  // Show the public landing page immediately — don't wait for Clerk to
  // initialise (which can take several seconds in production and leaves
  // users staring at a black screen).  Only redirect once we are certain
  // the user IS signed in.
  if (isLoaded && isSignedIn) return <Redirect to="/chat" />;
  return <LandingPage />;
}

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) {
  const { user, isLoaded } = useUser();
  
  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  if (!user) return <Redirect to="/" />;
  if (adminOnly && (user.publicMetadata as Record<string, unknown>)?.role !== "admin") return <Redirect to="/dashboard" />;

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome to Mithra",
            subtitle: "Sign in to access your family AI",
          },
        },
        signUp: {
          start: {
            title: "Join Mithra",
            subtitle: "Set up your family intelligence",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Suspense fallback={<PageSpinner />}>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
            <Route path="/chat" component={() => <ProtectedRoute component={ChatListPage} />} />
            <Route path="/chat/:id" component={() => <ProtectedRoute component={ChatRoomPage} />} />
            <Route path="/files" component={() => <ProtectedRoute component={FilesPage} />} />
            <Route path="/tasks" component={() => <ProtectedRoute component={TasksPage} />} />
            <Route path="/notifications" component={() => <ProtectedRoute component={NotificationsPage} />} />
            <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
            <Route path="/admin-login" component={AdminLoginPage} />
            <Route path="/admin" component={() => <ProtectedRoute component={AdminPage} adminOnly />} />
            <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsersPage} adminOnly />} />
            <Route path="/personas" component={() => <ProtectedRoute component={PersonasPage} />} />
            <Route path="/family" component={() => <ProtectedRoute component={FamilyPage} />} />
            <Route path="/memories" component={() => <ProtectedRoute component={MemoriesPage} />} />
            <Route path="/calendar" component={() => <ProtectedRoute component={CalendarPage} />} />
            <Route path="/habits" component={() => <ProtectedRoute component={HabitsPage} />} />
            <Route path="/insights" component={() => <ProtectedRoute component={InsightsPage} />} />
            <Route path="/automations" component={() => <ProtectedRoute component={AutomationsPage} />} />
            <Route path="/shopping" component={() => <ProtectedRoute component={ShoppingPage} />} />
            <Route path="/budget" component={() => <ProtectedRoute component={BudgetPage} />} />
            <Route path="/journal" component={() => <ProtectedRoute component={JournalPage} />} />
            <Route path="/goals" component={() => <ProtectedRoute component={GoalsPage} />} />
            <Route path="/notes" component={() => <ProtectedRoute component={NotesPage} />} />
            <Route path="/shared/:token" component={SharedChatPage} />
            
            <Route component={NotFound} />
          </Switch>
          </Suspense>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;