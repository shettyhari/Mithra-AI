import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Mic, MicOff, Volume2, VolumeX, X, Zap, Loader2, ChevronDown, StopCircle } from "lucide-react";
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
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const SpeechRecognitionClass =
    typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  const activeRecRef = useRef<SpeechRecognition | null>(null);
  const wakeRecRef = useRef<SpeechRecognition | null>(null);
  const wakeRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const ttsEnabledRef = useRef(ttsEnabled);
  ttsEnabledRef.current = ttsEnabled;

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
        window.dispatchEvent(new CustomEvent("mithra-voice-action", { detail: action }));
      }

      if (ttsEnabledRef.current) {
        setState("speaking");
        speak(spoken, () => {
          setState("idle");
        });
      } else {
        setState("idle");
      }
    } catch {
      const errText = "Sorry, I had trouble with that.";
      setLastResponse(errText);
      if (ttsEnabledRef.current) { setState("speaking"); speak(errText, () => setState("idle")); }
      else setState("idle");
    }
  }, [getToken, navigate]);

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
      setState("error");
    };

    rec.onend = () => {
      if (stateRef.current === "listening") setState("idle");
    };

    activeRecRef.current = rec;
    rec.start();
    setExpanded(true);
  }, [SpeechRecognitionClass, processCommand, stopAll]);

  // ── Wake word loop — always active ───────────────────────────
  const startWakeLoop = useCallback(() => {
    if (!SpeechRecognitionClass) return;
    if (wakeRecRef.current) return;
    // Don't start wake loop if already in an active state
    if (["listening", "processing", "speaking"].includes(stateRef.current)) return;

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
          if (ttsEnabledRef.current) {
            speak("Yes?", () => setTimeout(() => startListening(), 200));
          } else {
            setTimeout(() => startListening(), 300);
          }
          return;
        }
      }
    };

    rec.onerror = () => {
      wakeRecRef.current = null;
      wakeRestartRef.current = setTimeout(startWakeLoop, 1500);
    };

    rec.onend = () => {
      if (wakeRecRef.current === rec) wakeRecRef.current = null;
      if (stateRef.current === "wake" || stateRef.current === "idle") {
        wakeRestartRef.current = setTimeout(startWakeLoop, 400);
      }
    };

    wakeRecRef.current = rec;
    setState("wake");
    rec.start();
  }, [SpeechRecognitionClass, startListening]);

  // Start wake loop on mount, always-on
  useEffect(() => {
    if (!SpeechRecognitionClass) return;
    const t = setTimeout(startWakeLoop, 500);
    return () => {
      clearTimeout(t);
      if (wakeRestartRef.current) clearTimeout(wakeRestartRef.current);
      wakeRecRef.current?.stop();
      wakeRecRef.current = null;
      activeRecRef.current?.stop();
      activeRecRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  // After returning to idle, restart wake loop
  useEffect(() => {
    if (state === "idle" && SpeechRecognitionClass && !wakeRecRef.current) {
      const t = setTimeout(startWakeLoop, 600);
      return () => clearTimeout(t);
    }
  }, [state]);

  if (!SpeechRecognitionClass) return null;

  const isListening = state === "listening";
  const isWake = state === "wake";
  const isProcessing = state === "processing";
  const isSpeaking = state === "speaking";
  const isActive = isListening || isProcessing || isSpeaking;

  return (
    <div className={cn(
      "fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 transition-all duration-300",
      minimized ? "opacity-50 hover:opacity-100" : ""
    )}>
      {/* Response / transcript card */}
      {(lastResponse || isListening || isProcessing) && expanded && !minimized && (
        <div className={cn(
          "w-72 rounded-2xl border shadow-2xl p-4 text-sm animate-in slide-in-from-bottom-2 duration-200",
          isDark
            ? "bg-background/95 border-white/10 backdrop-blur-xl"
            : "bg-white border-border shadow-xl"
        )}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shrink-0">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-semibold text-foreground">Mithra</span>
            <button onClick={() => setExpanded(false)} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {transcript && (
            <div className={cn("mb-2.5 px-3 py-2 rounded-xl text-xs", isDark ? "bg-white/5" : "bg-muted/50")}>
              <p className="text-muted-foreground italic">"{transcript}"</p>
            </div>
          )}

          {isListening && (
            <div className="flex items-center gap-2 text-primary">
              <span className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1 h-4 rounded-full bg-primary animate-bounce"
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

          {(isSpeaking || (!isActive && lastResponse)) && (
            <div className="flex items-start gap-2">
              {isSpeaking && <Volume2 className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0 animate-pulse" />}
              <p className="text-xs text-foreground leading-relaxed">{lastResponse}</p>
            </div>
          )}
        </div>
      )}

      {/* Wake indicator pill */}
      {isWake && !minimized && (
        <div className={cn(
          "px-3 py-1 rounded-full text-[11px] font-medium border animate-pulse pointer-events-none",
          isDark
            ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
            : "bg-purple-50 border-purple-200 text-purple-600"
        )}>
          Say "Hey Mithra"…
        </div>
      )}

      {/* Controls row */}
      <div className="flex items-center gap-2">
        {/* TTS toggle */}
        {!minimized && (
          <button
            onClick={() => {
              setTtsEnabled(e => !e);
              if (isSpeaking) window.speechSynthesis?.cancel();
            }}
            title={ttsEnabled ? "Mute AI voice" : "Unmute AI voice"}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-md border",
              ttsEnabled
                ? isDark
                  ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-400"
                  : "bg-cyan-50 border-cyan-200 text-cyan-600"
                : isDark
                  ? "bg-background/80 border-white/10 text-muted-foreground hover:text-foreground"
                  : "bg-white border-border text-muted-foreground hover:text-foreground"
            )}>
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}

        {/* Main mic button */}
        <button
          onClick={() => {
            if (minimized) { setMinimized(false); return; }
            if (isListening || isProcessing) { stopAll(); setState("idle"); return; }
            if (isSpeaking) { window.speechSynthesis?.cancel(); setState("idle"); return; }
            setExpanded(true);
            startListening();
          }}
          title={isListening ? "Stop listening" : "Talk to Mithra"}
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
                      ? "bg-gradient-to-br from-purple-600 to-cyan-600 text-white hover:scale-105 hover:shadow-purple-500/25"
                      : "bg-gradient-to-br from-purple-500 to-cyan-500 text-white hover:scale-105 hover:shadow-lg"
          )}>
          {/* Pulse rings */}
          {(isListening || isWake) && (
            <>
              <span className={cn(
                "absolute inset-0 rounded-full animate-ping opacity-25",
                isListening ? "bg-red-400" : "bg-purple-400"
              )} />
              <span className={cn(
                "absolute -inset-2 rounded-full animate-ping opacity-10",
                isListening ? "bg-red-400" : "bg-purple-400"
              )} style={{ animationDelay: "0.3s" }} />
            </>
          )}
          <span className="relative z-10">
            {isListening ? <MicOff className="w-5 h-5" /> :
             isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> :
             isSpeaking ? <StopCircle className="w-5 h-5" /> :
             <Mic className="w-5 h-5" />}
          </span>
        </button>

        {/* Dismiss card */}
        {!minimized && (lastResponse || isActive) && (
          <button
            onClick={() => { stopAll(); setState("idle"); setLastResponse(""); setTranscript(""); setExpanded(false); }}
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 shadow border text-muted-foreground hover:text-foreground",
              isDark ? "bg-background/80 border-white/10" : "bg-white border-border"
            )}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
