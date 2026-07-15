export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-gradient">404</h1>
        <p className="text-xl text-muted-foreground">This sector is empty.</p>
        <div className="pt-8">
          <a href="/" className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors bg-muted/40 px-6 py-3 rounded-md border border-border">
            Return to Base
          </a>
        </div>
      </div>
    </div>
  );
}