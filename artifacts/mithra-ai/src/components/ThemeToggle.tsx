import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export default function ThemeToggle({ className, size = "md" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative inline-flex items-center rounded-full border transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        size === "md" ? "h-8 w-14 px-1" : "h-6 w-11 px-0.5",
        isDark
          ? "bg-primary/20 border-primary/30 hover:bg-primary/30"
          : "bg-amber-100 border-amber-300 hover:bg-amber-200",
        className
      )}
    >
      {/* Track icons */}
      <Sun className={cn(
        "absolute transition-all duration-300",
        size === "md" ? "w-4 h-4 left-1.5" : "w-3 h-3 left-1",
        isDark ? "opacity-30 text-muted-foreground" : "opacity-100 text-amber-500"
      )} />
      <Moon className={cn(
        "absolute transition-all duration-300",
        size === "md" ? "w-4 h-4 right-1.5" : "w-3 h-3 right-1",
        isDark ? "opacity-100 text-primary" : "opacity-30 text-muted-foreground"
      )} />

      {/* Thumb */}
      <span
        className={cn(
          "inline-block rounded-full shadow-sm transition-all duration-300 z-10",
          size === "md" ? "h-6 w-6" : "h-4 w-4",
          isDark
            ? [size === "md" ? "translate-x-6" : "translate-x-5", "bg-primary"]
            : ["translate-x-0", "bg-amber-400"]
        )}
      />
    </button>
  );
}
