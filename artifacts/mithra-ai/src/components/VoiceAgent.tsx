import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Mic, MicOff, Volume2, VolumeX, Radio, X, Zap, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const WAKE_VARIANTS = ["hey mithra", "hi mithra", "okay mithra", "mithra", "hey mitra", "hi mitra"];

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

type AgentState = "idle" | "wake" | "listening" | "processing" | "speaking" | "error";

function speak(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text.slice(0, 400));
  utter.rate = 1.05;
  utter.pitch = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.includes("Samantha") || v.name.includes("Google UK English Female") ||
    v.name.includes("Karen") || v.name.includes("Moira")
  );
  if (preferred) utter.voice = preferred;
  if (onEnd) utter.onend = onEnd;
  window.speechSynthesis.speak(utter);
}

export default function VoiceAgent() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();
  const { getToken } = useAuth();

  const [state, setState] = useState<AgentState>("idle");
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const SpeechRecognitionClass =
    typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  const activeRecRef = useRef<SpeechRecognition | null>(null);
  const wakeRecRef = useRef<SpeechRecognition | null>(null);
  const wakeRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const wakeEnabledRef = useRef(wakeEnabled);
  wakeEnabledRef.current = wakeEnabled;

  const stopAll = useCallback(() => {
    activeRecRef.current?.stop();
    activeRecRef.current = null;
    window.speechSynthesis?.cancel();
  }, []);

  // ── Process voice command via API ─────────────────────────────
  const processCommand = useCallback(async (text: string) => {
    setState("processing");
    setTranscript(text);
    try {
      const tok = await getToken();
      const r = await fetch(`${BASE}/api/voice/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify({ transcript: text }),
      });

      if (!r.ok) throw new Error("API error");
      const action = await r.json();

      const spoken = action.spoken || "Done!";
      setLastResponse(spoken);

      if (action.navigateTo) {
        navigate(action.navigateTo);
        // Dispatch a refresh event so pages can react
        window.dispatchEvent(new CustomEvent("mithra-voice-action", { detail: action }));
      }

      if (ttsEnabled) {
        setState("speaking");
        speak(spoken, () => setState("idle"));
      } else {
        setState("idle");
      }
    } catch {
      const errText = "Sorry, I had trouble with that. Please try again.";
      setLastResponse(errText);
      if (ttsEnabled) { setState("speaking"); speak(errText, () => setState("idle")); }
      else setState("error");
    }
  }, [getToken, navigate, ttsEnabled]);

  // ── Active listening ──────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognitionClass) return;
    stopAll();
    setState("listening");
    setTranscript("");
    setLastResponse("");

    const rec = new SpeechRecognitionClass();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      if (final) {
        activeRecRef.current = null;
        processCommand(final.trim());
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "no-speech") { setState("idle"); return; }
      setErrorMsg("Mic error: " + e.error);
      setState("error");
    };

    rec.onend = () => {
      if (stateRef.current === "listening") setState("idle");
    };

    activeRecRef.current = rec;
    rec.start();
    setExpanded(true);
  }, [SpeechRecognitionClass, processCommand, stopAll]);

  // ── Wake word loop ────────────────────────────────────────────
  const startWakeLoop = useCallback(() => {
    if (!SpeechRecognitionClass || !wakeEnabledRef.current) return;
    if (wakeRecRef.current) return; // already running

    const rec = new SpeechRecognitionClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: SpeechRecognitionEvent) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase().trim();
        if (WAKE_VARIANTS.some(w => t.includes(w))) {
          rec.stop();
          wakeRecRef.current = null;
          setState("listening");
          if (ttsEnabled) {
            speak("Yes?", () => {
              setTimeout(() => startListening(), 300);
            });
          } else {
            setTimeout(() => startListening(), 300);
          }
          return;
        }
      }
    };

    rec.onerror = () => {
      wakeRecRef.current = null;
      if (wakeEnabledRef.current) {
        wakeRestartRef.current = setTimeout(startWakeLoop, 1500);
      }
    };

    rec.onend = () => {
      if (wakeRecRef.current === rec) wakeRecRef.current = null;
      if (wakeEnabledRef.current && stateRef.current === "wake") {
        wakeRestartRef.current = setTimeout(startWakeLoop, 300);
      }
    };

    wakeRecRef.current = rec;
    setState("wake");
    rec.start();
  }, [SpeechRecognitionClass, startListening, ttsEnabled]);

  // Toggle wake word
  useEffect(() => {
    if (wakeEnabled) {
      startWakeLoop();
    } else {
      if (wakeRestartRef.current) clearTimeout(wakeRestartRef.current);
      wakeRecRef.current?.stop();
      wakeRecRef.current = null;
      if (stateRef.current === "wake") setState("idle");
    }
    return () => {
      if (wakeRestartRef.current) clearTimeout(wakeRestartRef.current);
    };
  }, [wakeEnabled]);

  // After speaking, restart wake loop
  useEffect(() => {
    if (state === "idle" && wakeEnabled && !wakeRecRef.current) {
      setTimeout(startWakeLoop, 500);
    }
  }, [state, wakeEnabled]);

  if (!SpeechRecognitionClass) return null;

  const isListening = state === "listening";
  const isWake = state === "wake";
  const isProcessing = state === "processing";
  const isSpeaking = state === "speaking";
  const isActive = isListening || isProcessing || isSpeaking;

  // ── UI ─────────────────────────────────────────────────────────
  return (
    <div className={cn(
      "fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 transition-all duration-300",
      minimized ? "opacity-60 hover:opacity-100" : ""
    )}>
      {/* Response card */}
      {(lastResponse || isListening || isProcessing) && expanded && !minimized && (
        <div className={cn(
          "w-72 rounded-2xl border shadow-2xl p-4 text-sm animate-in slide-in-from-bottom-2 duration-200",
          isDark
            ? "bg-background/95 border-white/10 backdrop-blur-xl"
            : "bg-white border-border shadow-xl"
        )}>
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-semibold text-foreground">Mithra Voice</span>
            <div className="ml-auto flex gap-1">
              <button onClick={() => setExpanded(false)}
                className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Transcript */}
          {transcript && (
            <div className={cn(
              "mb-2 px-3 py-2 rounded-xl text-xs",
              isDark ? "bg-white/5" : "bg-muted/50"
            )}>
              <p className="text-muted-foreground italic">"{transcript}"</p>
            </div>
          )}

          {/* State indicator + response */}
          {isListening && (
            <div className="flex items-center gap-2 text-primary">
              <span className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1 h-3 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.12}s` }} />
                ))}
              </span>
              <span className="text-xs font-medium">Listening…</span>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Thinking…</span>
            </div>
          )}

          {isSpeaking && lastResponse && (
            <div className="flex items-start gap-2">
              <Volume2 className="w-3.5 h-3.5 text-cyan-500 mt-0.5 shrink-0" />
              <p className="text-xs text-foreground leading-relaxed">{lastResponse}</p>
            </div>
          )}

          {!isActive && lastResponse && (
            <p className="text-xs text-foreground leading-relaxed">{lastResponse}</p>
          )}
        </div>
      )}

      {/* Wake listening indicator */}
      {isWake && !minimized && (
        <div className={cn(
          "px-3 py-1.5 rounded-full text-xs font-medium border animate-pulse",
          isDark
            ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
            : "bg-purple-50 border-purple-200 text-purple-600"
        )}>
          Listening for "Hey Mithra"…
        </div>
      )}

      {/* Main floating button group */}
      <div className="flex items-center gap-2">
        {/* TTS toggle */}
        {!minimized && (
          <button
            onClick={() => { setTtsEnabled(e => !e); if (isSpeaking) window.speechSynthesis?.cancel(); }}
            title={ttsEnabled ? "Mute responses" : "Unmute responses"}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg border",
              ttsEnabled
                ? isDark
                  ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-400"
                  : "bg-cyan-50 border-cyan-200 text-cyan-600"
                : isDark
                  ? "bg-background border-white/10 text-muted-foreground"
                  : "bg-white border-border text-muted-foreground"
            )}>
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}

        {/* Wake word toggle */}
        {!minimized && (
          <button
            onClick={() => setWakeEnabled(e => !e)}
            title={wakeEnabled ? 'Disable "Hey Mithra"' : 'Enable "Hey Mithra" wake word'}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg border relative",
              wakeEnabled
                ? isDark
                  ? "bg-purple-500/20 border-purple-500/30 text-purple-400"
                  : "bg-purple-50 border-purple-200 text-purple-600"
                : isDark
                  ? "bg-background border-white/10 text-muted-foreground"
                  : "bg-white border-border text-muted-foreground"
            )}>
            <Radio className="w-4 h-4" />
            {isWake && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
            )}
          </button>
        )}

        {/* Main mic button */}
        <button
          onClick={() => {
            if (minimized) { setMinimized(false); return; }
            if (isListening) { stopAll(); setState("idle"); return; }
            if (isProcessing || isSpeaking) { stopAll(); setState("idle"); return; }
            setExpanded(true);
            startListening();
          }}
          title={isListening ? "Stop" : "Talk to Mithra"}
          className={cn(
            "relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl",
            isListening
              ? "bg-red-500 text-white scale-110"
              : isProcessing
                ? "bg-amber-500 text-white"
                : isSpeaking
                  ? "bg-cyan-500 text-white"
                  : isWake
                    ? "bg-gradient-to-br from-purple-500 to-cyan-500 text-white"
                    : isDark
                      ? "bg-gradient-to-br from-purple-600 to-cyan-600 text-white hover:scale-105"
                      : "bg-gradient-to-br from-purple-500 to-cyan-500 text-white hover:scale-105"
          )}>
          {/* Pulse rings */}
          {(isListening || isWake) && (
            <>
              <span className={cn(
                "absolute inset-0 rounded-full animate-ping opacity-30",
                isListening ? "bg-red-500" : "bg-purple-500"
              )} />
              <span className={cn(
                "absolute -inset-2 rounded-full animate-ping opacity-15",
                isListening ? "bg-red-500" : "bg-purple-500"
              )} style={{ animationDelay: "0.3s" }} />
            </>
          )}
          {isListening ? (
            <MicOff className="w-5 h-5 relative z-10" />
          ) : isProcessing ? (
            <Loader2 className="w-5 h-5 relative z-10 animate-spin" />
          ) : isSpeaking ? (
            <Volume2 className="w-5 h-5 relative z-10" />
          ) : (
            <Mic className="w-5 h-5 relative z-10" />
          )}
        </button>

        {/* Minimize toggle */}
        {!minimized && isActive && (
          <button onClick={() => setMinimized(true)}
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 shadow-md border text-muted-foreground hover:text-foreground",
              isDark ? "bg-background border-white/10" : "bg-white border-border"
            )}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Keyboard shortcut hint */}
      {!minimized && !isActive && !isWake && (
        <p className="text-[10px] text-muted-foreground text-center opacity-70">
          Press mic or say "Hey Mithra"
        </p>
      )}
    </div>
  );
}
