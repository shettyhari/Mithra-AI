import { useEffect, useRef, useState, useId } from "react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

let mermaidPromise: Promise<typeof import("mermaid")["default"]> | null = null;
function loadMermaid() {
  if (!mermaidPromise) mermaidPromise = import("mermaid").then((m) => m.default);
  return mermaidPromise;
}

export default function MermaidDiagram({ chart }: { chart: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    let cancelled = false;
    setError(null);

    loadMermaid()
      .then(async (mermaid) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "strict",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          flowchart: { htmlLabels: false },
          // Mermaid renders a graphical "bomb" error diagram inline by default
          // on parse failure instead of rejecting. We want to show our own
          // themed error state, so force it to throw instead.
          suppressErrorRendering: true,
        });
        const { svg } = await mermaid.render(`mermaid-${uid}`, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to render diagram");
      });

    return () => { cancelled = true; };
  }, [chart, isDark, uid]);

  if (error) {
    return (
      <div className="my-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Couldn't render diagram</p>
          <p className="text-destructive/70 mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "my-3 rounded-xl border overflow-x-auto p-4 flex justify-center",
        isDark ? "bg-white/[0.03] border-border" : "bg-muted/30 border-border"
      )}
      ref={containerRef}
    >
      <span className="text-xs text-muted-foreground">Rendering diagram…</span>
    </div>
  );
}
