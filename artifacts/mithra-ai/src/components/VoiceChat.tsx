import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Volume2, VolumeX, X, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

interface VoiceChatProps {
  onTranscript: (text: string) => void;
  lastAiMessage?: string;
  disabled?: boolean;
}

type VoiceState = "idle" | "wake-listening" | "active-listening" | "speaking" | "error";

const WAKE_WORD = "hey mithra";
const WAKE_VARIANTS = ["hey mithra", "hi mithra", "okay mithra", "mithra"];

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export default function VoiceChat({ onTranscript, lastAiMessage, disabled }: VoiceChatProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wakeRecognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SpeechRecognitionClass;

  // TTS: speak AI response
  useEffect(() => {
    if (!ttsEnabled || !lastAiMessage || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(lastAiMessage.slice(0, 500));
    utter.rate = 1.05;
    utter.pitch = 1.0;
    // Prefer a natural voice
    const voices = window.speechSynthesis.getVoices();
    const pref = voices.find((v) =>
      v.name.includes("Samantha") || v.name.includes("Google UK") || v.name.includes("Karen")
    );
    if (pref) utter.voice = pref;
    setState("speaking");
    utter.onend = () => setState("idle");
    window.speechSynthesis.speak(utter);
  }, [lastAiMessage, ttsEnabled]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setState("idle");
    setTranscript("");
  }, []);

  const startActiveListening = useCallback(() => {
    if (!SpeechRecognitionClass) return;
    setState("active-listening");
    setTranscript("");

    const rec = new SpeechRecognitionClass();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      if (final) {
        onTranscript(final.trim());
        stopListening();
      }
    };

    rec.onerror = (e) => {
      if (e.error !== "no-speech") {
        setErrorMsg("Mic error: " + e.error);
        setState("error");
      } else {
        setState("idle");
      }
    };

    rec.onend = () => {
      if (state === "active-listening") setState("idle");
    };

    recognitionRef.current = rec;
    rec.start();
  }, [SpeechRecognitionClass, onTranscript, stopListening, state]);

  // Wake word detection
  const startWakeListening = useCallback(() => {
    if (!SpeechRecognitionClass || !wakeEnabled) return;

    const rec = new SpeechRecognitionClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase().trim();
        if (WAKE_VARIANTS.some((w) => t.includes(w))) {
          rec.stop();
          wakeRecognitionRef.current = null;
          setState("active-listening");
          // Small delay before starting active listen
          setTimeout(startActiveListening, 300);
          return;
        }
      }
    };

    rec.onerror = () => {
      // Restart wake listener after brief pause
      restartTimerRef.current = setTimeout(() => {
        if (wakeEnabled) startWakeListening();
      }, 2000);
    };

    rec.onend = () => {
      if (wakeEnabled && wakeRecognitionRef.current === rec) {
        restartTimerRef.current = setTimeout(() => {
          if (wakeEnabled) startWakeListening();
        }, 500);
      }
    };

    wakeRecognitionRef.current = rec;
    setState("wake-listening");
    rec.start();
  }, [SpeechRecognitionClass, wakeEnabled, startActiveListening]);

  useEffect(() => {
    if (wakeEnabled) {
      startWakeListening();
    } else {
      wakeRecognitionRef.current?.stop();
      wakeRecognitionRef.current = null;
      if (state === "wake-listening") setState("idle");
    }
    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, [wakeEnabled]);

  if (!supported) return null;

  const isListening = state === "active-listening";
  const isWake = state === "wake-listening";
  const isSpeaking = state === "speaking";

  return (
    <div className="flex items-center gap-2">
      {/* Wake word toggle */}
      <button
        onClick={() => setWakeEnabled((e) => !e)}
        title={wakeEnabled ? "Disable wake word" : 'Enable "Hey Mithra" wake word'}
        className={cn(
          "relative w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
          wakeEnabled
            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
            : isDark
              ? "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10"
              : "bg-muted text-muted-foreground border border-border hover:bg-accent"
        )}
      >
        <Radio className="w-3.5 h-3.5" />
        {isWake && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        )}
      </button>

      {/* TTS toggle */}
      <button
        onClick={() => {
          setTtsEnabled((e) => !e);
          if (isSpeaking) window.speechSynthesis?.cancel();
        }}
        title={ttsEnabled ? "Mute AI voice" : "Unmute AI voice"}
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
          ttsEnabled
            ? isDark
              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
              : "bg-cyan-50 text-cyan-600 border border-cyan-200"
            : isDark
              ? "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10"
              : "bg-muted text-muted-foreground border border-border hover:bg-accent"
        )}
      >
        {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
      </button>

      {/* Main mic button */}
      <button
        onClick={() => {
          if (isListening) { stopListening(); return; }
          setErrorMsg("");
          startActiveListening();
        }}
        disabled={disabled || isSpeaking}
        title={isListening ? "Stop listening" : "Start voice input"}
        className={cn(
          "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
          isListening
            ? "bg-red-500 text-white border-0 shadow-lg shadow-red-500/30"
            : isSpeaking
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 cursor-not-allowed"
              : isDark
                ? "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10 hover:text-foreground"
                : "bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-foreground"
        )}
      >
        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        {isListening && (
          <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-30" />
        )}
      </button>

      {/* Live transcript overlay */}
      {(isListening || transcript) && (
        <div className={cn(
          "absolute bottom-full left-0 right-0 mb-2 mx-4 px-4 py-3 rounded-xl border text-sm text-foreground shadow-xl",
          isDark ? "bg-background border-white/10" : "bg-background border-border shadow-lg"
        )}>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
            <span className="text-xs text-muted-foreground">Listening…</span>
            <button onClick={stopListening} className="ml-auto text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className={cn("italic", transcript ? "text-foreground" : "text-muted-foreground")}>
            {transcript || "Waiting for speech…"}
          </p>
        </div>
      )}

      {/* Wake word status tooltip */}
      {isWake && (
        <span className="text-xs text-purple-400 hidden sm:block animate-pulse">
          Listening for "Hey Mithra"…
        </span>
      )}

      {/* Error */}
      {state === "error" && errorMsg && (
        <span className="text-xs text-destructive">{errorMsg}</span>
      )}
    </div>
  );
}
