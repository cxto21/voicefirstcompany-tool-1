import { AudioVisuals, VadLogItem, VadTelemetry, VoiceState, RealtimeTransition, AgentVoiceConfig } from "../types";

// Micro-audio sound effects completely disabled to eliminate unwanted clicking and notification sounds
class SoundFx {
  public setEnabled(_enabled: boolean) {}
  public isEnabled(): boolean {
    return false;
  }
  playWake() {}
  playThinking() {}
  playComplete() {}
  playBargeIn() {}
  playHover() {}
  playClick() {}
}

export const soundFx = new SoundFx();

export class VoiceEngine {
  private micStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private recognition: any = null;
  private isRecognitionRunning = false;
  private isListening = false;
  private isSpeaking = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private currentLanguage = "en-US";
  private lastCapturedText = "";
  private speechActiveDuration = 0;

  // ElevenLabs-style Sentence Streaming Queue
  private sentenceQueue: string[] = [];
  private isQueuePlaying = false;
  private isStreamIncoming = false;
  private onSentenceSpokenCallback?: (sentence: string) => void;

  // Active Voice Activity & Silence Detection (VAD) - Ultra-fast conversational turnaround
  private userIsSpeaking = false;
  private voiceConfirmed = false;
  private speechConfidence = 0;
  private consecutiveVoiceFrames = 0;
  private consecutiveNoiseFrames = 0;
  private noiseFilteredCount = 0;
  private lastNoiseLogTimestamp = 0;
  private lastSpeechTimestamp = 0;
  private silenceThresholdMs = 240; // 240ms of silence after speaking triggers prompt agent response
  private speechEnergyThreshold = 0.024; // Sensitive vocal energy threshold for fast interruption
  private ambientNoiseFloor = 0.015;
  private vadInterval: any = null;
  private onSilenceCallback?: (capturedText: string) => void;
  private onVadTelemetryCallback?: (telemetry: VadTelemetry) => void;
  private onVadLogCallback?: (item: VadLogItem) => void;
  private peakEnergyObserved = 0;
  private totalBytesAccumulated = 0;

  // Real-time State Transition Pipeline Tracker
  private currentTransitionStage: "idle" | "listening" | "speech_active" | "silence_countdown" | "thinking_ttft" | "speaking_split" = "idle";
  private lastTransition: RealtimeTransition | null = null;
  private transitionHistory: RealtimeTransition[] = [];
  private lastTransitionTimestamp = Date.now();

  // Output audio analyser for TTS playback reactivity
  private outputAudioCtx: AudioContext | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  private speechSynthUtterance: SpeechSynthesisUtterance | null = null;
  private speechAnimInterval: any = null;

  private availableVoices: SpeechSynthesisVoice[] = [];
  private currentAgentVoiceConfig: AgentVoiceConfig | null = null;
  private agentName: string = "Cortex";
  private isPausedForSpeaking = false;
  private onTranscriptCallback?: (transcript: string, isFinal: boolean) => void;
  private onStateChangeCallback?: (state: VoiceState) => void;
  private onErrorCallback?: (errorMsg: string) => void;
  private onBargeInCallback?: () => void;

  private smoothVolume = 0;
  private rawWaveform = new Float32Array(128);

  constructor() {
    this.initSpeechRecognition();
    this.initVoices();
  }

  public setAgentVoiceConfig(config?: Partial<AgentVoiceConfig> | null) {
    if (!config) {
      this.currentAgentVoiceConfig = null;
      return;
    }
    this.currentAgentVoiceConfig = {
      voiceName: config.voiceName || "default",
      pitch: config.pitch ?? 1.0,
      rate: config.rate ?? 1.02,
      lang: config.lang || "es-ES",
      timbreLabel: config.timbreLabel,
    };
    if (this.currentAgentVoiceConfig.lang) {
      this.currentLanguage = this.currentAgentVoiceConfig.lang;
      if (this.recognition) {
        this.recognition.lang = this.currentAgentVoiceConfig.lang;
      }
    }
  }

  public setAgentName(name: string) {
    if (name && name.trim()) {
      this.agentName = name.trim();
    }
  }

  public getAgentVoiceConfig(): AgentVoiceConfig | null {
    return this.currentAgentVoiceConfig;
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        this.availableVoices = v;
      }
    }
    return this.availableVoices;
  }

  public auditionVoice(config: Partial<AgentVoiceConfig>, sampleText?: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve();
        return;
      }
      this.stopSpeaking();

      const lang = config.lang || "es-ES";
      const textToSpeak =
        sampleText ||
        (lang.startsWith("es")
          ? `Hola, soy tu agente especializado. Mi voz está configurada y lista para trabajar contigo.`
          : `Hello, I am your specialized agent. My voice profile is calibrated and ready.`);

      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.volume = 1.0;
        utterance.rate = config.rate ?? 1.0;
        utterance.pitch = config.pitch ?? 1.0;
        utterance.lang = lang;

        const allVoices = this.getAvailableVoices();
        if (config.voiceName && config.voiceName !== "default") {
          const matched = allVoices.find(
            (v) => v.name.toLowerCase().includes(config.voiceName!.toLowerCase()) || config.voiceName!.toLowerCase().includes(v.name.toLowerCase())
          );
          if (matched) {
            utterance.voice = matched;
          }
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        // Safety timeout
        setTimeout(resolve, 5000);

        window.speechSynthesis.speak(utterance);
      } catch {
        resolve();
      }
    });
  }

  private initVoices() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const load = () => {
        try {
          this.availableVoices = window.speechSynthesis.getVoices();
        } catch {
          this.availableVoices = [];
        }
      };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }

  /**
   * Explicitly unlock AudioContext and SpeechSynthesis on user interaction gesture.
   */
  public unlockAudioAndTTS() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === "closed") {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        if (this.availableVoices.length === 0) {
          this.availableVoices = window.speechSynthesis.getVoices();
        }
      }
    } catch {
      // Ignore
    }
  }

  public emitTransition(
    fromState: string,
    toState: string,
    trigger: RealtimeTransition["trigger"],
    details?: string
  ) {
    const now = Date.now();
    const durationMs = now - this.lastTransitionTimestamp;
    this.lastTransitionTimestamp = now;

    const timeFormatted = new Date().toLocaleTimeString("es-ES", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + "." + String(now % 1000).padStart(3, "0");

    const transition: RealtimeTransition = {
      id: "tr-" + now + "-" + Math.random().toString(36).substring(2, 6),
      fromState,
      toState,
      timestamp: now,
      timeFormatted,
      durationMs,
      trigger,
      details,
    };

    this.lastTransition = transition;
    this.transitionHistory = [...this.transitionHistory.slice(-40), transition];

    this.emitLog(
      "TRANSITION",
      "success",
      `[TRANSITION] ${fromState} ──▶ ${toState} (${trigger}${details ? `: ${details}` : ""}) [Δ ${durationMs}ms]`,
      { transition }
    );
  }

  public setPipelineStage(stage: "idle" | "listening" | "speech_active" | "silence_countdown" | "thinking_ttft" | "speaking_split") {
    const previous = this.currentTransitionStage;
    if (previous !== stage) {
      this.currentTransitionStage = stage;
      this.emitTransition(previous.toUpperCase(), stage.toUpperCase(), "STATE" as any);
    }
  }

  private emitLog(
    category: VadLogItem["category"],
    level: VadLogItem["level"],
    message: string,
    meta?: Record<string, any>
  ) {
    if (this.onVadLogCallback) {
      const time = new Date().toLocaleTimeString("es-ES", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      });
      this.onVadLogCallback({
        id: Math.random().toString(36).slice(2, 9),
        timestamp: time,
        category,
        level,
        message,
        meta,
      });
    }
  }

  public setVadTelemetryCallback(cb?: (t: VadTelemetry) => void) {
    this.onVadTelemetryCallback = cb;
  }

  public setVadLogCallback(cb?: (item: VadLogItem) => void) {
    this.onVadLogCallback = cb;
  }

  public setSpeechEnergyThreshold(threshold: number) {
    this.speechEnergyThreshold = Math.max(0.005, Math.min(0.2, threshold));
    this.emitLog("VAD", "info", `VAD Energy Threshold adjusted to: ${this.speechEnergyThreshold.toFixed(4)}`);
  }

  public setSilenceThresholdMs(durationMs: number) {
    this.silenceThresholdMs = Math.max(150, Math.min(2000, durationMs));
    this.emitLog("VAD", "info", `VAD Silence Duration Threshold adjusted to: ${this.silenceThresholdMs}ms`);
  }

  public getVadConfig() {
    return {
      speechEnergyThreshold: this.speechEnergyThreshold,
      silenceThresholdMs: this.silenceThresholdMs,
    };
  }

  public setLanguage(lang: string) {
    this.currentLanguage = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public getLanguage(): string {
    return this.currentLanguage;
  }

  private safeStartRecognition() {
    if (!this.recognition || this.isRecognitionRunning) return;
    try {
      this.recognition.lang = this.currentLanguage;
      this.recognition.start();
    } catch {
      // Already running or busy
    }
  }

  private safeStopRecognition() {
    if (!this.recognition || !this.isRecognitionRunning) return;
    try {
      this.recognition.stop();
    } catch {
      // Ignore
    }
  }

  private initSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
        this.recognition.lang = this.currentLanguage;

        this.recognition.onstart = () => {
          this.isRecognitionRunning = true;
          this.emitLog("SPEECH_REC", "info", `Reconocimiento de voz activo [${this.currentLanguage}]`);
        };

        this.recognition.onresult = (event: any) => {
          let interim = "";
          let final = "";

          for (let i = 0; i < event.results.length; ++i) {
            const resultItem = event.results[i];
            if (resultItem.isFinal) {
              final += resultItem[0].transcript + " ";
            } else {
              interim += resultItem[0].transcript;
            }
          }

          const combined = (final + interim).trim();

          // Rapid Barge-In: If the agent is currently speaking and user vocalizes words, interrupt immediately!
          if (this.isSpeaking || this.isQueuePlaying || this.isPausedForSpeaking) {
            if (combined.length > 0) {
              this.emitLog("BARGE_IN", "info", `[BARGE_IN] Interrupción inmediata por voz: "${combined}"`);
              this.lastCapturedText = combined;
              this.userIsSpeaking = true;
              this.voiceConfirmed = true;
              this.lastSpeechTimestamp = Date.now();
              this.triggerBargeIn();
              this.onTranscriptCallback?.(combined, Boolean(final.trim()));
            }
            return;
          }

          if (combined.length > 0) {
            this.lastCapturedText = combined;
            this.userIsSpeaking = true;
            this.voiceConfirmed = true;
            this.speechConfidence = 1.0;
            this.consecutiveVoiceFrames = 5;
            this.lastSpeechTimestamp = Date.now();

            this.onTranscriptCallback?.(combined, Boolean(final.trim()));
          }
        };

        this.recognition.onerror = (event: any) => {
          if (event.error === "no-speech") return;
          if (event.error === "not-allowed") {
            this.isRecognitionRunning = false;
            this.emitLog("SPEECH_REC", "error", "Permiso de micrófono denegado en reconocimiento");
            this.onErrorCallback?.("Microphone permission was denied.");
          }
        };

        this.recognition.onend = () => {
          this.isRecognitionRunning = false;
          // Smooth continuous keepalive: only restart if user is actively in listening session
          if (this.isListening) {
            setTimeout(() => {
              if (this.isListening && !this.isRecognitionRunning) {
                this.safeStartRecognition();
              }
            }, 300);
          }
        };
      } catch (e) {
        console.warn("SpeechRecognition init error:", e);
      }
    }
  }

  public setCallbacks(
    onTranscript: (t: string, isFinal: boolean) => void,
    onStateChange: (s: VoiceState) => void,
    onError: (err: string) => void,
    onBargeIn?: () => void,
    onSentenceSpoken?: (sentence: string) => void,
    onSilenceDetected?: (capturedText: string) => void
  ) {
    this.onTranscriptCallback = onTranscript;
    this.onStateChangeCallback = onStateChange;
    this.onErrorCallback = onError;
    this.onBargeInCallback = onBargeIn;
    this.onSentenceSpokenCallback = onSentenceSpoken;
    this.onSilenceCallback = onSilenceDetected;
  }

  public triggerBargeIn() {
    this.isStreamIncoming = false;
    this.clearSentenceQueue();
    this.stopSpeaking();
    this.isSpeaking = false;
    this.isPausedForSpeaking = false;
    this.isListening = true;
    this.currentTransitionStage = "listening";
    this.emitTransition("SPEAKING_SPLIT", "LISTENING", "BARGE_IN", "User voice detected during agent playback");
    this.emitLog("BARGE_IN", "info", `[BARGE_IN] Agente interrumpido inmediatamente. Retomando escucha activa.`);

    this.safeStartRecognition();

    this.onBargeInCallback?.();
    this.onStateChangeCallback?.("listening");
  }

  public beginStreamTurn() {
    this.isStreamIncoming = true;
    this.lastCapturedText = "";
    this.clearSentenceQueue();
    this.stopSpeaking();
    this.emitLog("TTS_QUEUE", "info", `New streaming turn started`);
  }

  public markStreamFinished() {
    this.isStreamIncoming = false;
    this.emitLog("TTS_QUEUE", "info", `Stream tokens finished. Remaining queued chunks: ${this.sentenceQueue.length}`);
    if (!this.isQueuePlaying && this.sentenceQueue.length === 0 && !this.isSpeaking) {
      this.currentTransitionStage = "idle";
      this.emitTransition("SPEAKING_SPLIT", "IDLE", "TTS_COMPLETE", "Turn playback complete");
      this.onStateChangeCallback?.("idle");
    }
  }

  private isQueueProcessing = false;

  // Enqueue sentence chunk for split streaming playback (ElevenLabs style)
  public enqueueSentence(sentence: string) {
    const clean = sentence.trim();
    if (!clean) return;
    this.sentenceQueue.push(clean);
    this.emitLog("TTS_QUEUE", "info", `Enqueued sentence chunk: "${clean}" (queue: ${this.sentenceQueue.length})`);
    if (!this.isQueueProcessing) {
      this.processSentenceQueue();
    }
  }

  public clearSentenceQueue() {
    this.sentenceQueue = [];
    this.isQueuePlaying = false;
    this.isQueueProcessing = false;
  }

  private async processSentenceQueue() {
    if (this.isQueueProcessing) return;
    this.isQueueProcessing = true;
    this.isQueuePlaying = true;

    while (this.sentenceQueue.length > 0) {
      // If queue was stopped/cleared during playback or user interrupted
      if (!this.isQueuePlaying) break;

      const nextSentence = this.sentenceQueue.shift();
      if (!nextSentence) continue;

      this.currentTransitionStage = "speaking_split";
      this.emitTransition(
        "THINKING_TTFT",
        "SPEAKING_SPLIT",
        "TTS_CHUNK",
        `Playing sentence chunk: "${nextSentence.substring(0, 35)}..."`
      );

      this.onSentenceSpokenCallback?.(nextSentence);
      await this.playSpeechChunk(nextSentence);

      // Acoustic pause between sentences (50ms) to ensure clean separation without overlap
      if (this.sentenceQueue.length > 0 && this.isQueuePlaying) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    this.isQueueProcessing = false;
    this.isQueuePlaying = false;
    this.isSpeaking = false;

    if (!this.isStreamIncoming) {
      this.isPausedForSpeaking = false;
      this.currentTransitionStage = "listening";
      this.emitTransition("SPEAKING_SPLIT", "LISTENING", "TTS_COMPLETE", "All audio chunks spoken, auto-resuming listening loop");
      this.onStateChangeCallback?.("listening");
      if (this.isListening && !this.isRecognitionRunning) {
        this.safeStartRecognition();
      }
    }
  }

  private startVadMonitor() {
    this.stopVadMonitor();
    this.vadInterval = setInterval(() => {
      if (!this.analyser) {
        return;
      }

      const micData = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(micData);
      let sum = 0;
      let lowSum = 0;
      let midSum = 0;
      let highSum = 0;

      const binCount = micData.length;
      for (let i = 0; i < binCount; i++) {
        const val = micData[i];
        sum += val;
        if (i < 6) {
          lowSum += val;
        } else if (i < 30) {
          midSum += val;
        } else {
          highSum += val;
        }
      }

      const micVol = sum / (binCount * 255);
      const lowEnergy = lowSum / (6 * 255);
      const midEnergy = midSum / (24 * 255);
      const highEnergy = highSum / (Math.max(1, binCount - 30) * 255);

      if (micVol > this.peakEnergyObserved) {
        this.peakEnergyObserved = micVol;
      }

      // Adaptive ambient noise baseline tracking (Exponential Moving Average)
      if (!this.userIsSpeaking && micVol < this.speechEnergyThreshold * 1.8) {
        this.ambientNoiseFloor = this.ambientNoiseFloor * 0.96 + micVol * 0.04;
      }

      // Dynamic effective threshold: speech must exceed baseline noise floor + margin
      const effectiveThreshold = Math.max(
        this.speechEnergyThreshold,
        this.ambientNoiseFloor + 0.012
      );

      // Voice Formant Ratio: human voice acoustic resonance is heavily concentrated in 300Hz-3000Hz (mid band)
      // vs low-frequency mechanical rumble (<150Hz) and high-frequency clicks/hiss (>3500Hz)
      const nonVocalEnergy = lowEnergy * 0.45 + highEnergy * 0.55 + 0.002;
      const voiceFormantRatio = midEnergy / nonVocalEnergy;
      const isEnergyActive = micVol > effectiveThreshold;
      const hasVoiceCharacteristics = isEnergyActive && (voiceFormantRatio > 0.65 || midEnergy > effectiveThreshold * 0.7);

      if (hasVoiceCharacteristics) {
        this.consecutiveVoiceFrames = Math.min(10, this.consecutiveVoiceFrames + 1);
        this.consecutiveNoiseFrames = 0;
        this.speechConfidence = Math.min(1.0, this.speechConfidence + 0.25);
      } else if (isEnergyActive) {
        // High energy but acoustic spectrum does not match human speech (e.g. click, fan, cough, desk bump)
        this.consecutiveNoiseFrames++;
        this.consecutiveVoiceFrames = Math.max(0, this.consecutiveVoiceFrames - 1);
        this.speechConfidence = Math.max(0, this.speechConfidence - 0.1);
      } else {
        this.consecutiveVoiceFrames = Math.max(0, this.consecutiveVoiceFrames - 1);
        this.consecutiveNoiseFrames = Math.max(0, this.consecutiveNoiseFrames - 1);
        this.speechConfidence = Math.max(0, this.speechConfidence - 0.05);
      }

      const hasRecognizedWords = Boolean(this.lastCapturedText.trim());
      this.voiceConfirmed = hasRecognizedWords || (this.consecutiveVoiceFrames >= 1 && this.speechConfidence >= 0.25);

      // Is human voice currently being produced in this exact frame?
      const isCurrentlyProducingVoice = isEnergyActive && (hasVoiceCharacteristics || this.consecutiveVoiceFrames >= 1);

      let silenceElapsed = 0;
      let summaryText = "";

      if (!this.isListening) {
        summaryText = "Micrófono inactivo (Idle)";
      } else if (this.isSpeaking || this.isQueuePlaying) {
        // Active agent is currently speaking / playing split audio chunks!
        // Fast Barge-In: Interrupt immediately when the user starts speaking!
        if (hasVoiceCharacteristics && (this.consecutiveVoiceFrames >= 1 || micVol > effectiveThreshold * 1.2)) {
          this.emitLog(
            "BARGE_IN",
            "info",
            `[BARGE_IN] Interrupción temprana detectada por voz del usuario (${(micVol * 100).toFixed(1)}%). Deteniendo reproducción.`
          );
          this.triggerBargeIn();
          return;
        }

        if (isEnergyActive && !this.voiceConfirmed && !hasRecognizedWords) {
          const now = Date.now();
          this.noiseFilteredCount++;
          if (now - this.lastNoiseLogTimestamp > 1200) {
            this.lastNoiseLogTimestamp = now;
            this.emitLog(
              "NOISE_FILTER",
              "info",
              `[NOISE_FILTER] Ruido ambiental filtrado (${(micVol * 100).toFixed(1)}% | Conf: ${(this.speechConfidence * 100).toFixed(0)}%).`
            );
          }
          summaryText = `${this.agentName} hablando • Ruido ambiental filtrado (${(micVol * 100).toFixed(1)}%)`;
        } else {
          summaryText = `${this.agentName} hablando (Habla para interrumpir al instante)`;
        }
      } else if (isCurrentlyProducingVoice) {
        // Active human speech sound actively being produced in this frame!
        const wasSpeaking = this.userIsSpeaking;
        this.userIsSpeaking = true;
        this.lastSpeechTimestamp = Date.now();
        summaryText = `Voz activa detectada (${(micVol * 100).toFixed(1)}% | Conf: ${(this.speechConfidence * 100).toFixed(0)}%)`;
        if (!wasSpeaking || this.currentTransitionStage !== "speech_active") {
          this.currentTransitionStage = "speech_active";
          this.emitTransition(
            "LISTENING",
            "USER_SPEAKING",
            "VAD_ENERGY",
            `Voz detectada: ${(micVol * 100).toFixed(1)}% (Confianza: ${(this.speechConfidence * 100).toFixed(0)}%)`
          );
        }
      } else if (this.userIsSpeaking || hasRecognizedWords) {
        // User finished vocalizing and is now in silence countdown (Stage 4)
        if (this.lastSpeechTimestamp === 0) {
          this.lastSpeechTimestamp = Date.now();
        }

        if (this.currentTransitionStage !== "silence_countdown") {
          this.currentTransitionStage = "silence_countdown";
          this.emitTransition(
            "USER_SPEAKING",
            "SILENCE_COUNTDOWN",
            "VAD_PAUSE",
            `Pausa en la voz detectada. Iniciando cuenta regresiva de silencio (${this.silenceThresholdMs}ms)`
          );
        }

        silenceElapsed = Date.now() - this.lastSpeechTimestamp;
        const remaining = Math.max(0, this.silenceThresholdMs - silenceElapsed);
        summaryText = `Pausa/Silencio: ${silenceElapsed}ms (${remaining}ms para enviar)`;

        if (silenceElapsed >= this.silenceThresholdMs) {
          const text = this.lastCapturedText.trim();
          this.userIsSpeaking = false;
          this.lastCapturedText = "";
          this.lastSpeechTimestamp = 0;
          this.consecutiveVoiceFrames = 0;

          if (text.length > 0) {
            this.currentTransitionStage = "thinking_ttft";
            this.emitTransition(
              "SILENCE_COUNTDOWN",
              "THINKING_TTFT",
              "VAD_SILENCE",
              `Silencio completado (${silenceElapsed}ms >= ${this.silenceThresholdMs}ms). Enviando: "${text}"`
            );
            this.onSilenceCallback?.(text);
            summaryText = `Silencio alcanzado -> Procesando turno de voz`;
          } else if (this.voiceConfirmed || this.audioChunks.length > 0) {
            this.currentTransitionStage = "thinking_ttft";
            this.emitTransition(
              "SILENCE_COUNTDOWN",
              "THINKING_TTFT",
              "VAD_SILENCE",
              `Silencio completado tras detección de voz. Procesando audio...`
            );
            this.onSilenceCallback?.("");
            summaryText = `Silencio alcanzado -> Procesando audio capturado`;
          } else {
            // Silence reached but no words captured (was a transient sound/cough)
            this.currentTransitionStage = "listening";
            this.emitLog(
              "VAD",
              "info",
              `Fin de sonido sin palabras reconocidas. Manteniendo modo escucha sin interrumpir.`
            );
            summaryText = `Escuchando... (Ruido disipado, esperando voz)`;
          }
        }
      } else {
        if (this.currentTransitionStage !== "listening" && this.currentTransitionStage !== "idle") {
          this.currentTransitionStage = "listening";
        }
        summaryText = `Escuchando... (Ambiente: ${(micVol * 100).toFixed(1)}% | Umbral: ${(effectiveThreshold * 100).toFixed(1)}%)`;
      }

      // Emit telemetry snapshot for live debug overlay and visualizer
      if (this.onVadTelemetryCallback) {
        this.onVadTelemetryCallback({
          timestamp: Date.now(),
          micEnergy: micVol,
          peakEnergy: this.peakEnergyObserved,
          speechEnergyThreshold: this.speechEnergyThreshold,
          isUserSpeaking: this.userIsSpeaking,
          voiceConfirmed: this.voiceConfirmed,
          speechConfidence: this.speechConfidence,
          noiseFilteredCount: this.noiseFilteredCount,
          silenceElapsedMs: silenceElapsed,
          silenceThresholdMs: this.silenceThresholdMs,
          lastCapturedText: this.lastCapturedText,
          chunkCount: this.audioChunks.length,
          totalBytesRecorded: this.totalBytesAccumulated,
          isListening: this.isListening,
          isSpeaking: this.isSpeaking || this.isQueuePlaying,
          speechRecognitionActive: Boolean(this.recognition),
          frequencyBands: {
            low: lowEnergy,
            mid: midEnergy,
            high: highEnergy,
          },
          silenceStatusSummary: summaryText,
          currentTransitionStage: this.currentTransitionStage,
          lastTransition: this.lastTransition || undefined,
          transitionHistory: this.transitionHistory,
        });
      }
    }, 40);
  }

  private stopVadMonitor() {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
  }

  public async startListening(playChime: boolean = false): Promise<boolean> {
    try {
      this.stopSpeaking();
      this.clearSentenceQueue();
      this.lastCapturedText = "";
      this.userIsSpeaking = false;
      this.lastSpeechTimestamp = 0;
      this.peakEnergyObserved = 0;
      this.totalBytesAccumulated = 0;
      if (playChime) {
        soundFx.playWake();
      }

      this.emitLog("STATE", "info", `Starting listening session with language [${this.currentLanguage}]`);

      await this.ensureMicStream();

      this.isListening = true;
      this.isSpeaking = false;
      this.currentTransitionStage = "listening";
      this.emitTransition("IDLE", "LISTENING", "MIC_START", `Microphone active [${this.currentLanguage}]`);
      this.onStateChangeCallback?.("listening");

      // Start concurrent MediaRecorder buffer
      this.startMediaRecorder();

      // Start speech recognition
      this.safeStartRecognition();

      // Start continuous VAD silence detector
      this.startVadMonitor();

      return true;
    } catch (err: any) {
      console.warn("Microphone access notice:", err);
      const isPermissionDenied =
        err?.name === "NotAllowedError" ||
        err?.name === "PermissionDeniedError" ||
        err?.name === "SecurityError" ||
        String(err?.message || "").toLowerCase().includes("permission denied") ||
        String(err?.message || "").toLowerCase().includes("not allowed");

      let userFriendlyMsg = this.currentLanguage.startsWith("es")
        ? "Permiso de micrófono denegado. Permite el acceso en el navegador o escribe tu consulta."
        : "Microphone permission denied. Allow microphone access in your browser or type below.";

      if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        userFriendlyMsg = this.currentLanguage.startsWith("es")
          ? "No se detectó ningún micrófono en este equipo."
          : "No microphone device detected on this system.";
      } else if (err?.name === "NotReadableError") {
        userFriendlyMsg = this.currentLanguage.startsWith("es")
          ? "El micrófono está en uso por otra aplicación."
          : "Microphone is currently in use by another application.";
      }

      this.emitLog(
        "STATE",
        "error",
        `Mic initialization: ${err?.name || "Error"} - ${err?.message || err}`
      );
      this.onErrorCallback?.(userFriendlyMsg);
      this.onStateChangeCallback?.("idle");
      return false;
    }
  }

  public async resumeListeningSilently(): Promise<boolean> {
    return this.startListening(false);
  }

  public async checkMicrophonePermission(): Promise<"granted" | "denied" | "prompt" | "unsupported"> {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: "microphone" as any });
        return status.state as any;
      }
    } catch {
      // Permissions API not supported or microphone not queryable
    }
    return "unsupported";
  }

  private async ensureMicStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia is not supported on this browser/environment");
    }

    if (!this.micStream || !this.micStream.active) {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.emitLog("STATE", "info", `Microphone media stream initialized with echoCancellation & noiseSuppression`);
    }

    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!this.audioCtx || this.audioCtx.state === "closed") {
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }

    if (!this.analyser) {
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.7;
    }

    if (!this.micSource) {
      this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);
      this.micSource.connect(this.analyser);
    }
  }

  private startMediaRecorder() {
    if (!this.micStream) return;
    try {
      this.audioChunks = [];
      this.totalBytesAccumulated = 0;
      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        options.mimeType = "audio/mp4";
      }

      this.mediaRecorder = new MediaRecorder(this.micStream, options);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
          this.totalBytesAccumulated += e.data.size;
          this.emitLog(
            "AUDIO_CHUNK",
            "info",
            `Audio chunk #${this.audioChunks.length} processed (${(e.data.size / 1024).toFixed(1)} KB, total ${(this.totalBytesAccumulated / 1024).toFixed(1)} KB)`
          );
        }
      };
      this.mediaRecorder.start(200);
      this.emitLog("AUDIO_CHUNK", "info", `MediaRecorder stream chunk processor started (200ms slice interval)`);
    } catch (e: any) {
      console.warn("MediaRecorder start error:", e);
      this.emitLog("AUDIO_CHUNK", "warn", `MediaRecorder notice: ${e.message || e}`);
    }
  }

  public stopListening(): Promise<Blob | null> {
    this.stopVadMonitor();
    this.userIsSpeaking = false;
    this.currentTransitionStage = "idle";
    this.emitTransition("LISTENING", "IDLE", "MANUAL", "Microphone turned off");
    return new Promise((resolve) => {
      this.isListening = false;
      this.safeStopRecognition();

      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.onstop = () => {
          const mime = this.mediaRecorder?.mimeType || "audio/webm";
          const blob = new Blob(this.audioChunks, { type: mime });
          resolve(blob);
        };
        try {
          this.mediaRecorder.stop();
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  }

  public getRecordedAudioBlob(clearAfter: boolean = true): Blob | null {
    if (this.audioChunks.length === 0) return null;
    const mime = this.mediaRecorder?.mimeType || "audio/webm";
    const blob = new Blob(this.audioChunks, { type: mime });
    if (clearAfter) {
      this.audioChunks = [];
      this.totalBytesAccumulated = 0;
    }
    return blob;
  }

  public getLastCapturedText(): string {
    return this.lastCapturedText;
  }

  public getVisualLevels(): AudioVisuals {
    let currentVol = 0;
    let currentFreq = 0;

    // Check mic or TTS output analyser
    const activeAnalyser =
      (this.isSpeaking || this.isQueuePlaying) && this.currentAudioSource && this.outputAnalyser
        ? this.outputAnalyser
        : this.analyser;

    if (activeAnalyser) {
      const dataArray = new Uint8Array(activeAnalyser.frequencyBinCount);
      activeAnalyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const rawVol = sum / (dataArray.length * 255);
      // Smoothed interpolation
      this.smoothVolume = this.smoothVolume * 0.7 + rawVol * 0.3;
      currentVol = this.smoothVolume;

      // Calculate dominant frequency band
      let maxVal = 0;
      let maxIdx = 0;
      for (let i = 0; i < dataArray.length; i++) {
        if (dataArray[i] > maxVal) {
          maxVal = dataArray[i];
          maxIdx = i;
        }
      }
      currentFreq = maxIdx / dataArray.length;
    }

    return {
      volume: Math.min(1, Math.max(0, currentVol)),
      frequency: currentFreq,
      rawWaveform: this.rawWaveform,
    };
  }

  // Play a single sentence chunk with instant interruptibility and speech synthesis
  private playSpeechChunk(text: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.isSpeaking = true;
      this.isPausedForSpeaking = true;
      this.onStateChangeCallback?.("speaking");

      let finished = false;
      let resumeInterval: any = null;
      let watchdogTimer: any = null;
      let maxDurationTimer: any = null;

      // Start animation immediately for instant responsive feedback
      let phase = 0;
      if (this.speechAnimInterval) clearInterval(this.speechAnimInterval);
      this.speechAnimInterval = setInterval(() => {
        phase += 0.35;
        this.smoothVolume = 0.35 + Math.sin(phase) * 0.22 + Math.random() * 0.1;
      }, 40);

      const cleanup = () => {
        if (finished) return;
        finished = true;
        if (resumeInterval) {
          clearInterval(resumeInterval);
          resumeInterval = null;
        }
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = null;
        }
        if (maxDurationTimer) {
          clearTimeout(maxDurationTimer);
          maxDurationTimer = null;
        }
        if (this.speechAnimInterval) {
          clearInterval(this.speechAnimInterval);
          this.speechAnimInterval = null;
        }
        this.smoothVolume = 0;
        this.speechSynthUtterance = null;
        (window as any)._activeUtterance = null;
        resolve();
      };

      const hasTTS = typeof window !== "undefined" && "speechSynthesis" in window;
      let ttsStarted = false;

      if (hasTTS) {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }

          const utterance = new SpeechSynthesisUtterance(text);
          utterance.volume = 1.0;
          utterance.rate = this.currentAgentVoiceConfig?.rate ?? 1.03;
          utterance.pitch = this.currentAgentVoiceConfig?.pitch ?? 1.0;

          const isSpanish = /[áéíóúñ¿¡]/i.test(text) || this.currentLanguage.startsWith("es");
          utterance.lang = this.currentAgentVoiceConfig?.lang || (isSpanish ? "es-ES" : "en-US");

          const allVoices = this.availableVoices.length > 0 ? this.availableVoices : window.speechSynthesis.getVoices();
          let preferred: SpeechSynthesisVoice | undefined;

          // If current agent has a custom voice selected
          if (this.currentAgentVoiceConfig?.voiceName && this.currentAgentVoiceConfig.voiceName !== "default") {
            preferred = allVoices.find(
              (v) =>
                v.name.toLowerCase().includes(this.currentAgentVoiceConfig!.voiceName.toLowerCase()) ||
                this.currentAgentVoiceConfig!.voiceName.toLowerCase().includes(v.name.toLowerCase())
            );
          }

          if (!preferred) {
            preferred =
              allVoices.find((v) => {
                const langMatch = isSpanish ? v.lang.startsWith("es") : v.lang.startsWith("en");
                return (
                  langMatch &&
                  (v.name.includes("Natural") ||
                    v.name.includes("Google") ||
                    v.name.includes("Samantha") ||
                    v.name.includes("Daniel") ||
                    v.name.includes("Paulina") ||
                    v.name.includes("Jorge") ||
                    v.name.includes("Lucia") ||
                    v.name.includes("Neural") ||
                    v.name.includes("Monica") ||
                    v.name.includes("Diego") ||
                    v.name.includes("Carlos") ||
                    v.name.includes("Helena"))
                );
              }) || allVoices.find((v) => (isSpanish ? v.lang.startsWith("es") : v.lang.startsWith("en")));
          }

          if (preferred) {
            utterance.voice = preferred;
          }

          utterance.onstart = () => {
            ttsStarted = true;
            if (watchdogTimer) {
              clearTimeout(watchdogTimer);
              watchdogTimer = null;
            }
          };

          utterance.onend = () => {
            cleanup();
          };

          utterance.onerror = (err) => {
            console.warn("Speech synthesis chunk notice:", err);
            cleanup();
          };

          this.speechSynthUtterance = utterance;
          (window as any)._activeUtterance = utterance;

          window.speechSynthesis.speak(utterance);

          // Keep speech synthesis active in Chromium/Blink engines (prevents pause bug)
          resumeInterval = setInterval(() => {
            try {
              if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
              }
            } catch {}
          }, 600);

          // Safe generous guard timer per sentence to guarantee execution never permanently hangs
          const durationMs = Math.max(4000, text.split(" ").length * 600 + 2000);
          maxDurationTimer = setTimeout(() => {
            if (!finished) cleanup();
          }, durationMs);

          return;
        } catch {
          // If window.speechSynthesis.speak threw synchronously
        }
      }

      cleanup();
    });
  }

  public async playSpeech(
    text: string,
    base64Audio?: string
  ): Promise<void> {
    this.stopSpeaking();
    this.enqueueSentence(text);
  }

  public stopSpeaking() {
    this.isSpeaking = false;
    this.isQueuePlaying = false;
    if (this.speechAnimInterval) {
      clearInterval(this.speechAnimInterval);
      this.speechAnimInterval = null;
    }
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
      } catch {
        // Ignore
      }
      this.currentAudioSource = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  public dispose() {
    this.stopSpeaking();
    this.clearSentenceQueue();
    this.stopListening();
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
    }
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close();
    }
    if (this.outputAudioCtx && this.outputAudioCtx.state !== "closed") {
      this.outputAudioCtx.close();
    }
  }
}

export const voiceEngine = new VoiceEngine();

