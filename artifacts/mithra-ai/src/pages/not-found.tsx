export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-gradient">404</h1>
        <p className="text-xl text-muted-foreground">This sector is empty.</p>
        <div className="pt-8">
          <a href="/" className="text-sm font-medium text-white/70 hover:text-white transition-colors bg-white/10 px-6 py-3 rounded-md border border-white/10">
            Return to Base
          </a>
        </div>
      </div>
    </div>
  );
}