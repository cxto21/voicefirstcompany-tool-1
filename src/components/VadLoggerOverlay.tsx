import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Sliders,
  Terminal,
  Volume2,
  Minimize2,
  Maximize2,
  X,
  Copy,
  Trash2,
  Check,
  Pause,
  Play,
  Zap,
  Mic,
  Cpu,
  Radio,
  Layers,
  Wand2,
  Flame,
  Info,
  ArrowRight,
  Sparkles,
  GitBranch,
  Timer,
  ShieldCheck,
  VolumeX,
} from "lucide-react";
import { VadLogItem, VadTelemetry, VoiceState, RealtimeTransition } from "../types";

interface VadLoggerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: VadTelemetry | null;
  logs: VadLogItem[];
  voiceState: VoiceState;
  onClearLogs: () => void;
  onUpdateVadThreshold: (threshold: number) => void;
  onUpdateSilenceDuration: (durationMs: number) => void;
  onSimulateBargeIn: () => void;
}

const PIPELINE_STEPS = [
  { id: "idle", label: "1. En Reposo", desc: "Idle" },
  { id: "listening", label: "2. Escuchando", desc: "Mic + VAD activo" },
  { id: "speech_active", label: "3. Voz Detectada", desc: "Energía > Umbral" },
  { id: "silence_countdown", label: "4. Silencio VAD", desc: "Cuenta regresiva" },
  { id: "thinking_ttft", label: "5. Generando", desc: "Stream SSE (TTFT)" },
  { id: "speaking_split", label: "6. Hablando", desc: "Split Audio TTS" },
] as const;

export function VadLoggerOverlay({
  isOpen,
  onClose,
  telemetry,
  logs,
  voiceState,
  onClearLogs,
  onUpdateVadThreshold,
  onUpdateSilenceDuration,
  onSimulateBargeIn,
}: VadLoggerOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  const logListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log feed
  useEffect(() => {
    if (autoScroll && logListRef.current) {
      logListRef.current.scrollTop = logListRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((item) => {
    if (filterCategory === "ALL") return true;
    return item.category === filterCategory;
  });

  const handleCopyLogs = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.category}] [${l.level.toUpperCase()}]: ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAutoCalibrate = () => {
    if (!telemetry || isCalibrating) return;
    setIsCalibrating(true);
    setCalibrationProgress(0);

    const samples: number[] = [];
    const startTime = Date.now();
    const duration = 1500;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / duration) * 100));
      setCalibrationProgress(progress);

      if (telemetry) {
        samples.push(telemetry.micEnergy);
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        setIsCalibrating(false);
        setCalibrationProgress(0);

        if (samples.length > 0) {
          const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
          // Set threshold slightly above background ambient noise
          const optimalThreshold = Math.max(0.015, Math.min(0.12, avg + 0.018));
          onUpdateVadThreshold(optimalThreshold);
        }
      }
    }, 50);
  };

  const micEnergyPercent = telemetry ? Math.min(100, Math.round(telemetry.micEnergy * 100)) : 0;
  const thresholdPercent = telemetry
    ? Math.min(100, Math.round(telemetry.speechEnergyThreshold * 100))
    : 3.5;
  const silenceElapsed = telemetry?.silenceElapsedMs || 0;
  const silenceThreshold = telemetry?.silenceThresholdMs || 240;
  const silencePercent = Math.min(100, Math.round((silenceElapsed / silenceThreshold) * 100));

  // Determine current active pipeline transition stage
  let activeStage: string = "idle";
  if (telemetry?.currentTransitionStage) {
    activeStage = telemetry.currentTransitionStage;
  } else if (voiceState === "listening") {
    if (telemetry?.isUserSpeaking) {
      activeStage = "speech_active";
    } else if (silenceElapsed > 0) {
      activeStage = "silence_countdown";
    } else {
      activeStage = "listening";
    }
  } else if (voiceState === "thinking") {
    activeStage = "thinking_ttft";
  } else if (voiceState === "speaking") {
    activeStage = "speaking_split";
  }

  const lastTransition = telemetry?.lastTransition;

  return (
    <div
      id="cortex-vad-logger-overlay"
      className={`fixed z-50 transition-all duration-300 ${
        isMinimized
          ? "bottom-4 right-4 w-88 shadow-2xl"
          : "bottom-4 right-4 md:right-6 w-full max-w-2xl max-h-[88vh] shadow-[0_0_50px_rgba(6,182,212,0.25)]"
      } bg-[#080911]/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl flex flex-col overflow-hidden text-white/90 font-sans`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-cyan-500/20 select-none">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
            <Terminal className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider text-white uppercase font-mono">
                Analizador VAD & Transiciones en Tiempo Real
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            </div>
            {!isMinimized && (
              <p className="text-[10px] text-cyan-300/60 font-mono">
                Telemetría de voz, detección de silencio y transiciones de estado
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title={isMinimized ? "Expand diagnostics" : "Minimize"}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Close overlay"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Minimized Quick Status Strip */}
      {isMinimized && (
        <div className="p-3 bg-black/40 space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-[11px]">Transición Actual:</span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/30">
              {activeStage.replace("_", " ")}
            </span>
          </div>
          {lastTransition && (
            <div className="text-[10px] text-white/70 flex items-center gap-1.5 bg-white/[0.02] p-1.5 rounded border border-white/5">
              <GitBranch className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate text-cyan-200">
                {lastTransition.fromState} ──▶ {lastTransition.toState}
              </span>
              <span className="text-white/40 ml-auto shrink-0">{lastTransition.durationMs}ms</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/50">Mic: {micEnergyPercent}%</span>
            <span className="text-white/50">Silencio: {silenceElapsed}ms</span>
            <span className="text-cyan-400 font-bold">{voiceState.toUpperCase()}</span>
          </div>
        </div>
      )}

      {/* Full Expanded Diagnostic Dashboard */}
      {!isMinimized && (
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Real-Time Transition Pipeline Stage Stepper */}
          <div className="p-3.5 bg-cyan-950/20 border-b border-cyan-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                Pipeline de Transición en Tiempo Real:
              </span>
              {lastTransition && (
                <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 flex items-center gap-1">
                  <Timer className="w-3 h-3 text-cyan-400" />
                  Última transición: {lastTransition.fromState} ➔ {lastTransition.toState} (Δ {lastTransition.durationMs}ms)
                </span>
              )}
            </div>

            {/* Stepper Flow Cards */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 font-mono">
              {PIPELINE_STEPS.map((step, idx) => {
                const isActive = activeStage === step.id;
                const isPast =
                  (activeStage === "listening" && idx < 1) ||
                  (activeStage === "speech_active" && idx < 2) ||
                  (activeStage === "silence_countdown" && idx < 3) ||
                  (activeStage === "thinking_ttft" && idx < 4) ||
                  (activeStage === "speaking_split" && idx < 5);

                return (
                  <div
                    key={step.id}
                    className={`relative p-2 rounded-lg border transition-all duration-300 text-center flex flex-col justify-between ${
                      isActive
                        ? "bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] text-cyan-200"
                        : isPast
                        ? "bg-white/[0.04] border-cyan-500/20 text-white/70"
                        : "bg-white/[0.01] border-white/5 text-white/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-cyan-400 animate-ping" : isPast ? "bg-emerald-400" : "bg-white/20"}`} />
                      {isActive && <Sparkles className="w-2.5 h-2.5 text-cyan-300 animate-spin" />}
                    </div>
                    <div className={`text-[10px] font-bold leading-tight ${isActive ? "text-cyan-300 font-black" : ""}`}>
                      {step.label}
                    </div>
                    <div className="text-[8px] text-white/40 mt-1 truncate">
                      {step.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time Telemetry & Live Gauges Section */}
          <div className="p-4 space-y-4 bg-black/40 border-b border-white/5">
            {/* Top Metric Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col">
                <span className="text-[10px] text-white/50 uppercase tracking-wider">Voice State</span>
                <span
                  className={`text-sm font-bold mt-0.5 uppercase ${
                    voiceState === "listening"
                      ? "text-cyan-300 animate-pulse"
                      : voiceState === "thinking"
                      ? "text-indigo-300 animate-pulse"
                      : voiceState === "speaking"
                      ? "text-emerald-300"
                      : "text-white/40"
                  }`}
                >
                  {voiceState}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col">
                <span className="text-[10px] text-white/50 uppercase tracking-wider">Voz vs Ruido (Confianza)</span>
                <span className={`text-sm font-bold mt-0.5 ${telemetry?.voiceConfirmed ? "text-emerald-300" : "text-white/50"}`}>
                  {Math.round((telemetry?.speechConfidence || 0) * 100)}%{" "}
                  <span className="text-[9px] font-normal">
                    {telemetry?.voiceConfirmed ? "(Voz Real)" : "(No Vocal)"}
                  </span>
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col">
                <span className="text-[10px] text-white/50 uppercase tracking-wider">Silence VAD Timer</span>
                <span
                  className={`text-sm font-bold mt-0.5 ${
                    silenceElapsed > 0 ? "text-amber-300" : "text-white/40"
                  }`}
                >
                  {silenceElapsed}ms{" "}
                  <span className="text-[10px] text-white/40">/ {silenceThreshold}ms</span>
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col">
                <span className="text-[10px] text-white/50 uppercase tracking-wider">Ruidos Filtrados</span>
                <span className="text-sm font-bold text-cyan-300 mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 inline" />
                  {telemetry?.noiseFilteredCount || 0}{" "}
                  <span className="text-[10px] text-white/40">bloqueados</span>
                </span>
              </div>
            </div>

            {/* Gauge 1: Mic Energy vs Speech Threshold */}
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/70 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-cyan-400" />
                  Live Mic Energy vs. VAD Trigger Threshold:
                </span>
                <span
                  className={`font-bold ${
                    telemetry?.voiceConfirmed
                      ? "text-emerald-400"
                      : telemetry?.isUserSpeaking
                      ? "text-amber-400"
                      : "text-cyan-300"
                  }`}
                >
                  {telemetry?.voiceConfirmed
                    ? "VOZ HUMANA CONFIRMADA"
                    : telemetry?.isUserSpeaking
                    ? "SONIDO DETECTADO (ANALIZANDO)"
                    : "AMBIENTE LIMPIO"}
                </span>
              </div>

              <div className="relative w-full h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    telemetry?.voiceConfirmed
                      ? "bg-emerald-400"
                      : micEnergyPercent >= thresholdPercent
                      ? "bg-amber-400"
                      : "bg-cyan-400"
                  }`}
                  style={{ width: `${Math.min(100, micEnergyPercent * 2.5)}%` }}
                />
                {/* Threshold Marker Pin */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-400 z-10"
                  style={{ left: `${Math.min(100, thresholdPercent * 2.5)}%` }}
                  title={`Trigger threshold: ${(telemetry?.speechEnergyThreshold || 0.035).toFixed(3)}`}
                />
              </div>
            </div>

            {/* Gauge 2: Silence Countdown Progress */}
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/70 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  VAD Silence Detection Countdown to Auto-Submit:
                </span>
                <span className="text-amber-300 font-bold">{silencePercent}%</span>
              </div>

              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    silencePercent >= 100 ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                  style={{ width: `${silencePercent}%` }}
                />
              </div>
            </div>

            {/* Real-time Status Summary Banner */}
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-white/80">
                <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">
                  {telemetry?.silenceStatusSummary || "Awaiting microphone input..."}
                </span>
              </div>
              <button
                onClick={onSimulateBargeIn}
                className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-[10px] font-semibold uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1"
                title="Test instantaneous speech interruption while Cortex is talking"
              >
                <Flame className="w-3 h-3" />
                Barge-In Test
              </button>
            </div>

            {/* Threshold Fine-Tuning Slider */}
            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white/70 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  Live Threshold Tuning:
                </span>
                <button
                  onClick={handleAutoCalibrate}
                  disabled={isCalibrating}
                  className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1"
                >
                  <Wand2 className={`w-3 h-3 ${isCalibrating ? "animate-spin" : ""}`} />
                  {isCalibrating ? `Calibrating ${calibrationProgress}%` : "Auto-Calibrate Noise"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-white/60">
                    <span>Sensitivity Threshold:</span>
                    <span className="text-cyan-300">
                      {(telemetry?.speechEnergyThreshold || 0.035).toFixed(4)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.010"
                    max="0.120"
                    step="0.002"
                    value={telemetry?.speechEnergyThreshold || 0.035}
                    onChange={(e) => onUpdateVadThreshold(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <div className="flex justify-between text-[9px] text-white/30">
                    <span>More sensitive (0.01)</span>
                    <span>Less sensitive (0.12)</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-white/60">
                    <span>Silence Timeout:</span>
                    <span className="text-cyan-300">
                      {telemetry?.silenceThresholdMs || 240}ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min="180"
                    max="1200"
                    step="20"
                    value={telemetry?.silenceThresholdMs || 240}
                    onChange={(e) => onUpdateSilenceDuration(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <div className="flex justify-between text-[9px] text-white/30">
                    <span>Faster (180ms)</span>
                    <span>Patient (1200ms)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Event Log Controls & Filter Bar */}
          <div className="px-4 py-2 bg-black/60 border-b border-white/5 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto text-[10px] font-mono">
              {["ALL", "TRANSITION", "NOISE_FILTER", "VAD", "AUDIO_CHUNK", "SPEECH_REC", "TRIGGER", "BARGE_IN", "STATE"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                    filterCategory === cat
                      ? "bg-cyan-500 text-black font-bold"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {cat === "NOISE_FILTER" ? "FILTRO RUIDO" : cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1 rounded transition-colors ${
                  autoScroll ? "text-cyan-400" : "text-white/30"
                }`}
                title={autoScroll ? "Auto-scroll ON" : "Auto-scroll PAUSED"}
              >
                {autoScroll ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleCopyLogs}
                className="p-1 rounded text-white/50 hover:text-white transition-colors"
                title="Copy logs to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onClearLogs}
                className="p-1 rounded text-white/50 hover:text-rose-400 transition-colors"
                title="Clear log console"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Log Stream Console */}
          <div
            ref={logListRef}
            className="flex-1 overflow-y-auto p-4 bg-black/80 font-mono text-[11px] space-y-1.5 min-h-[160px] max-h-[260px]"
          >
            {filteredLogs.length === 0 ? (
              <div className="py-6 text-center text-white/20 text-xs">
                No logs recorded yet. Speak into the microphone to observe real-time chunk & VAD activity.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 hover:bg-white/[0.02] py-0.5 px-1 rounded transition-colors leading-relaxed"
                >
                  <span className="text-white/30 shrink-0 text-[10px]">{log.timestamp}</span>
                  <span
                    className={`px-1 rounded text-[9px] font-bold shrink-0 uppercase ${
                      log.category === "TRANSITION"
                        ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400/50"
                        : log.category === "NOISE_FILTER"
                        ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                        : log.category === "TRIGGER"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : log.category === "VAD"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : log.category === "AUDIO_CHUNK"
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        : log.category === "SPEECH_REC"
                        ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30"
                        : log.category === "BARGE_IN"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-white/10 text-white/70"
                    }`}
                  >
                    {log.category}
                  </span>
                  <span
                    className={`flex-1 break-all ${
                      log.category === "TRANSITION"
                        ? "text-cyan-200 font-semibold"
                        : log.category === "NOISE_FILTER"
                        ? "text-teal-200 font-mono"
                        : log.level === "success"
                        ? "text-emerald-300 font-medium"
                        : log.level === "warn"
                        ? "text-amber-300"
                        : log.level === "error"
                        ? "text-rose-400"
                        : "text-white/80"
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
