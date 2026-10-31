import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { LiquidOrb } from "./LiquidOrb";
import { VoiceEngine, soundFx } from "../lib/audioManager";
import { SentenceSplitter } from "../lib/sentenceSplitter";
import { SessionStore } from "../lib/sessionStore";
import { AgentStore } from "../lib/agentStore";
import { SessionModal } from "./SessionModal";
import { AgentLobbyModal } from "./AgentLobbyModal";
import { VirtualDiagnosticsModal } from "./VirtualDiagnosticsModal";
import { VadLoggerOverlay } from "./VadLoggerOverlay";
import { PreferencesModal } from "./PreferencesModal";
import { BrowserOverlayModal } from "./BrowserOverlayModal";
import { IntegrationsModal } from "./IntegrationsModal";
import { ConversationLogsModal } from "./ConversationLogsModal";
import { PreferencesStore, ORB_PRESETS } from "../lib/preferencesStore";
import {
  AgentItem,
  ChatMessage,
  ConversationLogItem,
  BehaviorModerationPolicy,
  SessionItem,
  UserPreferences,
  VadLogItem,
  VadTelemetry,
  VoiceAction,
  VoiceState,
} from "../types";
import {
  AlertCircle,
  Radio,
  Sparkles,
  Layers,
  Zap,
  Activity,
  Terminal,
  MicOff,
  Mic,
  Send,
  ExternalLink,
  RefreshCw,
  HelpCircle,
  X,
  MessageSquare,
  Palette,
  Sliders,
  Globe,
  Shield,
  Compass,
  ArrowLeft,
  Bot,
  Cpu,
  PenTool,
  BarChart2,
} from "lucide-react";

const DEFAULT_MODERATION_POLICY: BehaviorModerationPolicy = {
  autoClosePopupsOnSelect: true,
  voiceFirstStrictReturn: true,
  proactiveSessionMatch: true,
  safetyFilterEnabled: true,
  languageEnforceStrict: true,
  verbosityLevel: "concise",
};

const INITIAL_CONVERSATION_LOGS: ConversationLogItem[] = [
  {
    id: "log-seed-1",
    timestamp: Date.now() - 1000 * 60 * 4,
    formattedTime: "Hace 4 min",
    speaker: "user",
    text: "Hola Cortex, ¿qué sesiones tenemos disponibles?",
    moderationStatus: "approved",
  },
  {
    id: "log-seed-2",
    timestamp: Date.now() - 1000 * 60 * 4 + 450,
    formattedTime: "Hace 4 min",
    speaker: "cortex",
    agentName: "Cortex",
    agentColor: "#06b6d4",
    agentId: "cortex-main",
    text: "Tienes cuatro sesiones registradas: Estrategia de Producto Q3, Diseño de Arquitectura Cloud, Sprint Review Alpha y Brainstorming de Agentes. ¿Cuál te gustaría reanudar?",
    latencyMs: 380,
    actionDispatched: { type: "LIST_SESSIONS" },
    engine: "gemini-flash",
    moderationStatus: "approved",
    userFeedback: "thumbs_up",
    moderationTags: ["session_query", "ultra_low_latency"],
  },
];

export function VoiceInterface() {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [lastUserPrompt, setLastUserPrompt] = useState<string>("");
  const [cortexResponse, setCortexResponse] = useState<string>("");
  const [currentSpokenSentence, setCurrentSpokenSentence] = useState<string>("");
  const [continuousMode, setContinuousMode] = useState<boolean>(true);
  const [language, setLanguage] = useState<"es-ES" | "en-US">("es-ES");
  const [wasInterrupted, setWasInterrupted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMicPermissionDenied, setIsMicPermissionDenied] = useState<boolean>(false);
  const [showPermissionGuide, setShowPermissionGuide] = useState<boolean>(false);
  const [textInput, setTextInput] = useState<string>("");
  const [showTextInput, setShowTextInput] = useState<boolean>(false);

  // User Preferences & Orb Customization State
  const [userPrefs, setUserPrefs] = useState<UserPreferences>(() => PreferencesStore.getPreferences());
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);

  // Multi-Agent & Lobby System State
  const [agents, setAgents] = useState<AgentItem[]>(() => AgentStore.getAgents());
  const [activeAgent, setActiveAgent] = useState<AgentItem>(() => AgentStore.getActiveAgent());
  const [isLobbyModalOpen, setIsLobbyModalOpen] = useState<boolean>(false);

  // Session Management State
  const [sessions, setSessions] = useState<SessionItem[]>(() => SessionStore.getSessions());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => SessionStore.getActiveSessionId());
  const [isSessionModalOpen, setIsSessionModalOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);

  // Web Browser Overlay Popup State
  const [isBrowserOpen, setIsBrowserOpen] = useState<boolean>(false);
  const [browserUrl, setBrowserUrl] = useState<string>("https://en.m.wikipedia.org/wiki/Artificial_intelligence");

  // Integrations Modal State
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState<boolean>(false);

  // Conversation Logs & Moderation State
  const [isConversationLogsOpen, setIsConversationLogsOpen] = useState<boolean>(false);
  const [conversationLogs, setConversationLogs] = useState<ConversationLogItem[]>(() => {
    try {
      const saved = localStorage.getItem("cortex_conversation_logs");
      return saved ? JSON.parse(saved) : INITIAL_CONVERSATION_LOGS;
    } catch {
      return INITIAL_CONVERSATION_LOGS;
    }
  });

  const [behaviorPolicy, setBehaviorPolicy] = useState<BehaviorModerationPolicy>(() => {
    try {
      const saved = localStorage.getItem("cortex_behavior_policy");
      return saved ? JSON.parse(saved) : DEFAULT_MODERATION_POLICY;
    } catch {
      return DEFAULT_MODERATION_POLICY;
    }
  });

  // Real-time VAD & Audio Chunk Logger Overlay State
  const [isLoggerOpen, setIsLoggerOpen] = useState<boolean>(false);
  const [vadTelemetry, setVadTelemetry] = useState<VadTelemetry | null>(null);
  const [vadLogs, setVadLogs] = useState<VadLogItem[]>([]);

  const engineRef = useRef<VoiceEngine | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);
  const transcriptTimeoutRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const isSubmittingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const continuousModeRef = useRef<boolean>(continuousMode);
  const sessionsRef = useRef<SessionItem[]>([]);
  const activeSessionIdRef = useRef<string | null>(null);
  const isSessionModalOpenRef = useRef<boolean>(isSessionModalOpen);
  const isBrowserOpenRef = useRef<boolean>(isBrowserOpen);
  const isIntegrationsOpenRef = useRef<boolean>(isIntegrationsOpen);
  const isConversationLogsOpenRef = useRef<boolean>(isConversationLogsOpen);
  const isLobbyModalOpenRef = useRef<boolean>(isLobbyModalOpen);
  const activeAgentRef = useRef<AgentItem>(activeAgent);
  const agentsRef = useRef<AgentItem[]>(agents);
  const behaviorPolicyRef = useRef<BehaviorModerationPolicy>(behaviorPolicy);
  const partialSpokenTextRef = useRef<string>("");
  const textInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus text input when expanded
  useEffect(() => {
    if (showTextInput) {
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showTextInput]);

  // Synchronize state to refs for real-time async voice callbacks
  useEffect(() => {
    continuousModeRef.current = continuousMode;
  }, [continuousMode]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    isSessionModalOpenRef.current = isSessionModalOpen;
  }, [isSessionModalOpen]);

  useEffect(() => {
    isBrowserOpenRef.current = isBrowserOpen;
  }, [isBrowserOpen]);

  useEffect(() => {
    isIntegrationsOpenRef.current = isIntegrationsOpen;
  }, [isIntegrationsOpen]);

  useEffect(() => {
    isConversationLogsOpenRef.current = isConversationLogsOpen;
  }, [isConversationLogsOpen]);

  useEffect(() => {
    isLobbyModalOpenRef.current = isLobbyModalOpen;
  }, [isLobbyModalOpen]);

  useEffect(() => {
    activeAgentRef.current = activeAgent;
    engineRef.current?.setAgentVoiceConfig(activeAgent.voice);
    engineRef.current?.setAgentName(activeAgent.name);

    // Synchronize sessions list to this agent's scope
    const scopedSessions = SessionStore.getSessions(activeAgent.id);
    setSessions(scopedSessions);
  }, [activeAgent]);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    behaviorPolicyRef.current = behaviorPolicy;
    try {
      localStorage.setItem("cortex_behavior_policy", JSON.stringify(behaviorPolicy));
    } catch {}
  }, [behaviorPolicy]);

  useEffect(() => {
    try {
      localStorage.setItem("cortex_conversation_logs", JSON.stringify(conversationLogs.slice(-100)));
    } catch {}
  }, [conversationLogs]);

  // Load initial local sessions & preferences & agent subscriptions
  useEffect(() => {
    const loaded = SessionStore.getSessions(activeAgent.id);
    const activeId = SessionStore.getActiveSessionId();
    setSessions(loaded);
    setActiveSessionId(activeId);

    const initialPrefs = PreferencesStore.getPreferences();
    soundFx.setEnabled(initialPrefs.soundEffects ?? false);

    const unsubPrefs = PreferencesStore.subscribe((updated) => {
      setUserPrefs(updated);
      soundFx.setEnabled(updated.soundEffects ?? false);
    });

    const unsubAgents = AgentStore.subscribe((list) => {
      setAgents(list);
    });

    const unsubActiveAgent = AgentStore.subscribeActiveAgent((curr) => {
      setActiveAgent(curr);
    });

    return () => {
      unsubPrefs();
      unsubAgents();
      unsubActiveAgent();
    };
  }, []);

  // Multi-Agent Switch & Management Handlers
  function handleSelectAgent(agentId: string) {
    const switched = AgentStore.setActiveAgent(agentId);
    if (switched) {
      setActiveAgent(switched);
      if (switched.theme?.presetId) {
        PreferencesStore.savePreferences({ orbPresetId: switched.theme.presetId });
      }
      historyRef.current = []; // Strict context isolation per agent!
      setCortexResponse("");
      setCurrentSpokenSentence("");
      soundFx.playWake();
    }
  }

  function handleReturnToLobby() {
    const lobby = AgentStore.returnToLobby();
    setActiveAgent(lobby);
    if (lobby.theme?.presetId) {
      PreferencesStore.savePreferences({ orbPresetId: lobby.theme.presetId });
    }
    historyRef.current = []; // Clean context
    setCortexResponse("");
    setCurrentSpokenSentence("");
    soundFx.playComplete();
  }

  function handleCreateAgent(agentData: Omit<AgentItem, "id" | "createdAt" | "sessionsCount" | "isPrimaryLobby">) {
    const newAgent = AgentStore.createAgent(agentData);
    soundFx.playWake();
    return newAgent;
  }

  function handleUpdateAgent(agentId: string, updates: Partial<AgentItem>) {
    const updated = AgentStore.updateAgent(agentId, updates);
    soundFx.playComplete();
    return updated;
  }

  function handleDeleteAgent(agentId: string) {
    const res = AgentStore.deleteAgent(agentId);
    soundFx.playComplete();
    return res;
  }

  function handleAuditionVoice(voice: Partial<AgentItem["voice"]>) {
    engineRef.current?.auditionVoice(
      voice,
      language === "es-ES"
        ? `Hola, soy ${activeAgent.name}. Esta es una prueba interactiva de mi voz y timbre.`
        : `Hello, I am ${activeAgent.name}. This is an interactive test of my voice.`
    );
  }

  // Session actions with instant popup closure on connect as requested
  function handleConnectSession(id: string) {
    const res = SessionStore.connectSession(id);
    if (res) {
      setSessions(SessionStore.getSessions());
      setActiveSessionId(id);
      
      // Load this session's isolated message history
      const sessionMsgs = SessionStore.getSessionMessages(id);
      historyRef.current = sessionMsgs.slice(-10);

      // Auto-close session popup when entering a session to maintain Voice-First focus
      if (behaviorPolicyRef.current.autoClosePopupsOnSelect) {
        setIsSessionModalOpen(false);
      }
      soundFx.playWake();
    }
  }

  function handleDisconnectSession() {
    SessionStore.disconnectSession();
    setSessions(SessionStore.getSessions());
    setActiveSessionId(null);
    historyRef.current = []; // Clean context
    soundFx.playComplete();
  }

  function handleCreateSession(title?: string, topic?: string) {
    const newSession = SessionStore.createSession(title, topic);
    setSessions(SessionStore.getSessions());
    setActiveSessionId(newSession.id);
    // Crucial: Clean conversational history context for the new session!
    historyRef.current = [];
    if (behaviorPolicyRef.current.autoClosePopupsOnSelect) {
      setIsSessionModalOpen(false);
    }
    soundFx.playWake();
    return newSession;
  }

  function handleDeleteSession(sessionId: string) {
    const { remaining, deleted } = SessionStore.deleteSession(sessionId);
    setSessions(remaining);
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      historyRef.current = [];
    }
    soundFx.playComplete();
    return deleted;
  }

  function handleRenameSession(sessionId: string, newTitle: string) {
    const updated = SessionStore.renameSession(sessionId, newTitle);
    if (updated) {
      setSessions(SessionStore.getSessions());
      soundFx.playComplete();
    }
    return updated;
  }

  function handleSummarizeSession(sessionId: string) {
    const summary = SessionStore.summarizeSession(sessionId);
    return summary;
  }

  // Conversation logs moderation handlers
  function handleClearLogs() {
    setConversationLogs([]);
    soundFx.playComplete();
  }

  function handleUpdateLogFeedback(logId: string, feedback: "thumbs_up" | "thumbs_down" | null) {
    setConversationLogs((prev) =>
      prev.map((log) => (log.id === logId ? { ...log, userFeedback: feedback } : log))
    );
    soundFx.playWake();
  }

  function handleToggleLogFlag(logId: string) {
    setConversationLogs((prev) =>
      prev.map((log) =>
        log.id === logId
          ? {
              ...log,
              moderationStatus: log.moderationStatus === "flagged" ? "approved" : "flagged",
            }
          : log
      )
    );
    soundFx.playWake();
  }

  // Initialize Voice Engine
  useEffect(() => {
    const engine = new VoiceEngine();
    engine.setLanguage(language);
    if (activeAgentRef.current?.voice) {
      engine.setAgentVoiceConfig(activeAgentRef.current.voice);
    }
    if (activeAgentRef.current?.name) {
      engine.setAgentName(activeAgentRef.current.name);
    }
    engineRef.current = engine;

    engine.setCallbacks(
      (transcript, isFinal) => {
        setLiveTranscript(transcript);
        setLastUserPrompt(transcript);
        setWasInterrupted(false);

        // Reset silence timer on every new speech piece
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // Automatic hands-free submission: triggers when user stops speaking (silence after speech)
        if (isFinal && transcript.trim().length > 1) {
          silenceTimerRef.current = setTimeout(() => {
            submitVoiceTurn(transcript.trim());
          }, 220);
        } else if (transcript.trim().length > 1) {
          // If interim with speech pause, submit after 380ms
          silenceTimerRef.current = setTimeout(() => {
            submitVoiceTurn(transcript.trim());
          }, 380);
        }
      },
      (state) => {
        setVoiceState(state);

        if (state === "speaking") {
          setLiveTranscript("");
        }

        if (state === "listening") {
          setCurrentSpokenSentence("");
        }

        // In continuous conversation mode, when Cortex finishes speaking all split sentences, auto resume listening silently!
        if (state === "idle" && continuousModeRef.current && !isSubmittingRef.current) {
          setTimeout(() => {
            if (continuousModeRef.current && !isSubmittingRef.current) {
              setVoiceState("listening");
              engineRef.current?.resumeListeningSilently();
            }
          }, 150);
        }
      },
      (error) => {
        setErrorMessage(error);
        if (
          error.toLowerCase().includes("denied") ||
          error.toLowerCase().includes("permission") ||
          error.toLowerCase().includes("denegado") ||
          error.toLowerCase().includes("permiso")
        ) {
          setIsMicPermissionDenied(true);
        }
        setTimeout(() => setErrorMessage(null), 8000);
      },
      () => {
        // User Barge-In (Interruption) triggered!
        handleUserBargeIn();
      },
      (sentence) => {
        setLiveTranscript("");
        setCurrentSpokenSentence(sentence);
        partialSpokenTextRef.current += (partialSpokenTextRef.current ? " " : "") + sentence;
      },
      (silenceTranscript) => {
        // Active VAD Silence Detected! User paused speaking -> submit turn immediately
        const textToSubmit = silenceTranscript || liveTranscript || engineRef.current?.getLastCapturedText();
        if (textToSubmit && textToSubmit.trim()) {
          submitVoiceTurn(textToSubmit.trim());
        }
      }
    );

    // Register real-time VAD telemetry and chunk processing callbacks
    engine.setVadTelemetryCallback((telemetry) => {
      setVadTelemetry(telemetry);
    });

    engine.setVadLogCallback((item) => {
      setVadLogs((prev) => {
        if (prev.length > 200) {
          return [...prev.slice(-150), item];
        }
        return [...prev, item];
      });
    });

    // Visual animation loop tracking RMS audio level
    let animId = 0;
    function updateAudioVisuals() {
      if (engineRef.current) {
        const visuals = engineRef.current.getVisualLevels();
        setAudioLevel(visuals.volume);
      }
      animId = requestAnimationFrame(updateAudioVisuals);
    }
    animId = requestAnimationFrame(updateAudioVisuals);

    const unlockOnGesture = () => {
      engineRef.current?.unlockAudioAndTTS();
    };
    window.addEventListener("pointerdown", unlockOnGesture, { passive: true });
    window.addEventListener("keydown", unlockOnGesture, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointerdown", unlockOnGesture);
      window.removeEventListener("keydown", unlockOnGesture);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      engine.dispose();
    };
  }, []);

  // Update language on change
  function handleLanguageChange(newLang: "es-ES" | "en-US") {
    setLanguage(newLang);
    engineRef.current?.setLanguage(newLang);
    soundFx.playWake();
  }

  // Handle immediate barge-in interruption when user speaks during playback/thinking
  function handleUserBargeIn() {
    setWasInterrupted(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isSubmittingRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    // Save whatever Cortex had spoken up to the point of interruption
    const spokenSoFar = partialSpokenTextRef.current.trim();
    if (spokenSoFar) {
      historyRef.current = [
        ...historyRef.current.slice(-5),
        {
          role: "model",
          text: `[Interrumpido por el usuario mientras decía: "${spokenSoFar}"]`,
          timestamp: Date.now(),
        },
      ];
    }
    partialSpokenTextRef.current = "";

    setVoiceState("listening");
    setTimeout(() => {
      setWasInterrupted(false);
    }, 3000);
  }

  // Execute voice action returned by the model or smart response engine
  function executeVoiceAction(action?: VoiceAction) {
    if (!action || action.type === "NONE") return;

    switch (action.type) {
      case "OPEN_CONNECT_MODAL":
      case "LIST_SESSIONS":
        setIsSessionModalOpen(true);
        soundFx.playWake();
        break;

      case "CLOSE_MODAL":
        // Closes any open modal/popup and returns smoothly to voice-first view
        setIsSessionModalOpen(false);
        setIsBrowserOpen(false);
        setIsIntegrationsOpen(false);
        setIsConversationLogsOpen(false);
        setIsDiagnosticsOpen(false);
        setIsPreferencesOpen(false);
        soundFx.playComplete();
        break;

      case "CONNECT_SESSION":
      case "SWITCH_SESSION": {
        let targetId = action.sessionId;
        if (!targetId && (action.sessionTitle || action.query)) {
          const match = SessionStore.findSessionByQuery(action.sessionTitle || action.query || "");
          if (match) targetId = match.id;
        }
        if (targetId) {
          handleConnectSession(targetId);
          setIsSessionModalOpen(false);
          soundFx.playWake();
        }
        break;
      }

      case "DISCONNECT_SESSION":
        handleDisconnectSession();
        soundFx.playComplete();
        break;

      case "CREATE_SESSION":
        handleCreateSession(action.sessionTitle, action.topic);
        setIsSessionModalOpen(false);
        soundFx.playWake();
        break;

      case "DELETE_SESSION": {
        let targetId = action.sessionId;
        if (!targetId && (action.sessionTitle || action.query)) {
          const match = SessionStore.findSessionByQuery(action.sessionTitle || action.query || "");
          if (match) targetId = match.id;
        }
        if (!targetId && activeSessionId) {
          targetId = activeSessionId;
        }
        if (targetId) {
          handleDeleteSession(targetId);
          soundFx.playComplete();
        }
        break;
      }

      case "RENAME_SESSION": {
        let targetId = action.sessionId;
        if (!targetId && action.sessionTitle) {
          const match = SessionStore.findSessionByQuery(action.sessionTitle);
          if (match) targetId = match.id;
        }
        if (!targetId && activeSessionId) {
          targetId = activeSessionId;
        }
        const newTitle = action.newTitle || action.sessionTitle;
        if (targetId && newTitle) {
          handleRenameSession(targetId, newTitle);
          soundFx.playComplete();
        }
        break;
      }

      case "SUMMARIZE_SESSION": {
        let targetId = action.sessionId || activeSessionId;
        if (!targetId && (action.sessionTitle || action.query)) {
          const match = SessionStore.findSessionByQuery(action.sessionTitle || action.query || "");
          if (match) targetId = match.id;
        }
        if (targetId) {
          const summary = handleSummarizeSession(targetId);
          setCortexResponse(summary);
          soundFx.playComplete();
        }
        break;
      }

      case "OPEN_BROWSER":
        if (action.url) {
          setBrowserUrl(action.url);
        }
        setIsBrowserOpen(true);
        soundFx.playWake();
        break;

      case "NAVIGATE_BROWSER":
        if (action.url) {
          setBrowserUrl(action.url);
        }
        setIsBrowserOpen(true);
        soundFx.playWake();
        break;

      case "CLOSE_BROWSER":
        setIsBrowserOpen(false);
        soundFx.playComplete();
        break;

      case "OPEN_INTEGRATIONS":
        setIsIntegrationsOpen(true);
        soundFx.playWake();
        break;

      case "CLOSE_INTEGRATIONS":
        setIsIntegrationsOpen(false);
        soundFx.playComplete();
        break;

      case "OPEN_CONVERSATION_LOGS":
        setIsConversationLogsOpen(true);
        soundFx.playWake();
        break;

      case "CLOSE_CONVERSATION_LOGS":
        setIsConversationLogsOpen(false);
        soundFx.playComplete();
        break;

      case "OPEN_LOBBY":
      case "LIST_AGENTS":
        setIsLobbyModalOpen(true);
        soundFx.playWake();
        break;

      case "CLOSE_LOBBY":
        setIsLobbyModalOpen(false);
        soundFx.playComplete();
        break;

      case "RETURN_TO_LOBBY":
        handleReturnToLobby();
        setIsLobbyModalOpen(false);
        break;

      case "SWITCH_AGENT": {
        let targetId = action.agentId;
        if (!targetId && action.agentName) {
          const match = AgentStore.findAgentByQuery(action.agentName);
          if (match) targetId = match.id;
        }
        if (targetId) {
          handleSelectAgent(targetId);
          setIsLobbyModalOpen(false);
        }
        break;
      }

      case "CREATE_AGENT": {
        if (action.agentName) {
          const created = AgentStore.createAgent({
            name: action.agentName,
            tagline: action.tagline || action.role || (language === "es-ES" ? "Agente Especializado" : "Specialized Agent"),
            description: action.agentDescription || (language === "es-ES" ? "Agente creado interactivamente desde el Lobby" : "Interactive agent created from Lobby"),
            avatarIcon: "Bot",
            voice: {
              pitch: action.pitch ?? 1.0,
              rate: action.rate ?? 1.0,
              voiceName: action.voiceName,
              lang: language,
            },
            primaryHex: "#06b6d4",
            glowHex: "#22d3ee",
          });
          handleSelectAgent(created.id);
          setIsLobbyModalOpen(false);
        }
        break;
      }

      case "DELETE_AGENT": {
        let targetId = action.agentId;
        if (!targetId && action.agentName) {
          const match = AgentStore.findAgentByQuery(action.agentName);
          if (match) targetId = match.id;
        }
        if (targetId) {
          handleDeleteAgent(targetId);
        }
        break;
      }

      case "RENAME_AGENT": {
        let targetId = action.agentId || activeAgent.id;
        if (!targetId && action.agentName) {
          const match = AgentStore.findAgentByQuery(action.agentName);
          if (match) targetId = match.id;
        }
        const newName = action.newAgentName || action.agentName;
        if (targetId && newName) {
          handleUpdateAgent(targetId, { name: newName });
        }
        break;
      }

      case "AUDITION_VOICE": {
        const voiceCfg = {
          pitch: action.pitch ?? 1.0,
          rate: action.rate ?? 1.0,
          voiceName: action.voiceName,
        };
        handleAuditionVoice(voiceCfg);
        break;
      }
    }
  }

  // Submit voice turn with low-latency sentence-by-sentence stream (ElevenLabs style)
  async function submitVoiceTurn(queryText?: string) {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const capturedText = queryText || liveTranscript || engineRef.current?.getLastCapturedText() || "";

      if (
        capturedText.trim() &&
        capturedText.trim() !== "[Audio Speech Chunk]" &&
        capturedText.trim() !== "[Audio Stream Turn]"
      ) {
        setLiveTranscript(capturedText.trim());
        setLastUserPrompt(capturedText.trim());
        await handleUserVoiceQueryStream(capturedText.trim());
      } else {
        // Audio chunks from intentional speech interaction processed directly via Gemini
        const audioBlob = engineRef.current?.getRecordedAudioBlob(true);
        if (audioBlob && audioBlob.size > 800) {
          await handleAudioBlobVoiceTurn(audioBlob);
        } else {
          // No spoken words detected (likely ambient noise/breath). Return cleanly to listening state without false trigger.
          setVoiceState("listening");
        }
      }
    } finally {
      isSubmittingRef.current = false;
    }
  }

  // Raw Audio Blob fallback understanding when Web Speech Recognition doesn't emit transcripts
  async function handleAudioBlobVoiceTurn(audioBlob: Blob) {
    setVoiceState("thinking");
    setCortexResponse("");
    setCurrentSpokenSentence("");
    partialSpokenTextRef.current = "";

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const audioBase64 = await base64Promise;
      const res = await fetch("/api/audio-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mimeType: audioBlob.type || "audio/webm",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.transcription && data.transcription.trim()) {
          setLiveTranscript(data.transcription.trim());
          setLastUserPrompt(data.transcription.trim());
          await handleUserVoiceQueryStream(data.transcription.trim());
          return;
        }
        if (data.text) {
          engineRef.current?.beginStreamTurn();
          const sentenceSplitter = new SentenceSplitter((chunk) => {
            engineRef.current?.enqueueSentence(chunk);
          });
          sentenceSplitter.feed(data.text);
          sentenceSplitter.finish();
          setCortexResponse(data.text);
          engineRef.current?.markStreamFinished();
          return;
        }
      }
    } catch (e) {
      console.warn("Audio input fallback notice:", e);
    }

    // Fallback to chat stream
    await handleUserVoiceQueryStream(language === "es-ES" ? "Hola Cortex" : "Hello Cortex");
  }

  // Virtual Speech Simulation Handlers for Diagnostics
  function handleSimulateSpeech(text: string) {
    setLiveTranscript(text);
    setLastUserPrompt(text);
    setVoiceState("listening");
  }

  async function handleForceSubmitTurn(text: string) {
    setLiveTranscript(text);
    setLastUserPrompt(text);
    await handleUserVoiceQueryStream(text);
  }

  // Live VAD calibration & Logger handlers
  function handleUpdateVadThreshold(threshold: number) {
    engineRef.current?.setSpeechEnergyThreshold(threshold);
  }

  function handleUpdateSilenceDuration(durationMs: number) {
    engineRef.current?.setSilenceThresholdMs(durationMs);
  }

  function handleClearVadLogs() {
    setVadLogs([]);
  }

  // Main streaming voice query handler with real-time Sentence Splitter & Conversation Logging
  async function handleUserVoiceQueryStream(query: string) {
    if (!query) {
      setVoiceState("idle");
      return;
    }

    const turnStartTime = Date.now();
    setLiveTranscript(query);
    setLastUserPrompt(query);
    setVoiceState("thinking");
    setCortexResponse("");
    setCurrentSpokenSentence("");
    partialSpokenTextRef.current = "";

    // Record User Turn in conversation logs
    const now = new Date();
    const userLogItem: ConversationLogItem = {
      id: `log-user-${Date.now()}`,
      timestamp: Date.now(),
      formattedTime: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      speaker: "user",
      text: query,
      moderationStatus: "approved",
    };
    setConversationLogs((prev) => [userLogItem, ...prev]);

    // Abort previous in-flight call if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    // Add user message to history
    const userMsg: ChatMessage = {
      role: "user",
      text: query,
      timestamp: Date.now(),
    };
    historyRef.current = [...historyRef.current.slice(-6), userMsg];

    try {
      engineRef.current?.beginStreamTurn();
      const activeSes = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current);

      // Initialize sentence splitter: sends completed sentences directly to the voice playback queue
      const sentenceSplitter = new SentenceSplitter((sentenceChunk) => {
        engineRef.current?.enqueueSentence(sentenceChunk);
      });

      const response = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortCtrl.signal,
        body: JSON.stringify({
          message: query,
          history: historyRef.current,
          context: {
            sessions: sessionsRef.current,
            activeSessionTitle: activeSes ? activeSes.title : null,
            activeSessionId: activeSessionIdRef.current,
            activeSessionTopic: activeSes ? activeSes.topic : null,
            activeSessionSummary: activeSes ? activeSes.summary : null,
            activeSessionTags: activeSes ? activeSes.tags : [],
            activeAgent: activeAgentRef.current,
            availableAgents: agentsRef.current,
            isLobbyModalOpen: isLobbyModalOpenRef.current,
            isConnectModalOpen: isSessionModalOpenRef.current,
            isBrowserOpen: isBrowserOpenRef.current,
            isIntegrationsOpen: isIntegrationsOpenRef.current,
            isConversationLogsOpen: isConversationLogsOpenRef.current,
            language,
          },
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Streaming connection failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullAccumulated = "";
      let sseBuffer = "";
      let lastDispatchedAction: VoiceAction | undefined = undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n\n");
        sseBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const jsonStr = trimmed.replace(/^data:\s*/, "");
          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.text) {
              fullAccumulated += parsed.text;
              sentenceSplitter.feed(parsed.text);

              // Update clean display text removing internal action tags
              const cleanDisplay = fullAccumulated.replace(/\[\[\[ACTION:.*?\]\]\]/g, "").trim();
              setCortexResponse(cleanDisplay);
            }

            if (parsed.done) {
              sentenceSplitter.finish();
              engineRef.current?.markStreamFinished();
              if (parsed.action) {
                lastDispatchedAction = parsed.action;
                executeVoiceAction(parsed.action);
              }
            }
          } catch {
            // Ignore parse chunks
          }
        }
      }

      sentenceSplitter.finish();
      engineRef.current?.markStreamFinished();

      const finalCleanText = fullAccumulated.replace(/\[\[\[ACTION:.*?\]\]\]/g, "").trim();
      const totalLatency = Date.now() - turnStartTime;

      if (finalCleanText) {
        historyRef.current = [
          ...historyRef.current.slice(-10),
          {
            role: "model",
            text: finalCleanText,
            timestamp: Date.now(),
          },
        ];

        // Persist message history in current active session if connected
        if (activeSessionIdRef.current) {
          SessionStore.saveSessionMessages(activeSessionIdRef.current, historyRef.current);
        }

        // Record Agent Turn in conversation logs with latency & action
        const agentLogItem: ConversationLogItem = {
          id: `log-${activeAgentRef.current.id}-${Date.now()}`,
          timestamp: Date.now(),
          formattedTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          speaker: "cortex",
          agentName: activeAgentRef.current.name,
          agentColor: activeAgentRef.current.theme.primaryHex,
          agentId: activeAgentRef.current.id,
          text: finalCleanText,
          latencyMs: totalLatency,
          actionDispatched: lastDispatchedAction,
          engine: "gemini-flash",
          moderationStatus: "approved",
          moderationTags: lastDispatchedAction?.type !== "NONE" ? [lastDispatchedAction?.type.toLowerCase() || "action"] : undefined,
        };
        setConversationLogs((prev) => [agentLogItem, ...prev]);
      }
    } catch (err: any) {
      engineRef.current?.clearSentenceQueue();
      engineRef.current?.stopSpeaking();
      if (err.name === "AbortError") {
        console.log("Stream aborted due to user interruption / barge-in.");
        return;
      }
      console.error("Error in streaming voice turn:", err);
      setVoiceState("idle");
      setErrorMessage(
        language === "es-ES"
          ? "No pude conectar con el núcleo de Cortex."
          : "Could not connect to Cortex core."
      );
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      isSubmittingRef.current = false;
    }
  }

  // Helper to extract active live speech segment (prevents endless paragraph expansion and layout shifts)
  function getActiveLiveSegment(text: string): string {
    if (!text) return "";
    const clean = text.trim();
    const sentences = clean.split(/[.!?]+\s+/).filter(Boolean);
    const last = sentences[sentences.length - 1] || clean;
    const words = last.split(/\s+/).filter(Boolean);
    if (words.length > 11) {
      return "…" + words.slice(-9).join(" ");
    }
    return last;
  }

  function getLatestSentence(text: string): string {
    if (!text) return "";
    const clean = text.trim();
    const sentences = clean.split(/[.!?]+\s+/).filter(Boolean);
    return sentences[sentences.length - 1] || clean;
  }

  async function handleStartListening() {
    engineRef.current?.unlockAudioAndTTS();
    setLiveTranscript("");
    setCortexResponse("");
    setCurrentSpokenSentence("");
    setErrorMessage(null);
    setWasInterrupted(false);
    const success = await engineRef.current?.startListening();
    if (success) {
      setIsMicPermissionDenied(false);
    }
  }

  // Handle direct text prompt submission (instant fallback for iframe or mic restricted environments)
  async function handleTextQuerySubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    engineRef.current?.unlockAudioAndTTS();
    const query = textInput.trim();
    if (!query) return;

    setTextInput("");
    setLiveTranscript(query);
    soundFx.playWake();
    await handleUserVoiceQueryStream(query);
  }

  function handleQuickPrompt(promptText: string) {
    engineRef.current?.unlockAudioAndTTS();
    setLiveTranscript(promptText);
    soundFx.playWake();
    handleUserVoiceQueryStream(promptText);
  }

  // Toggle voice interaction when tapping orb or pill button
  async function handleToggleVoice() {
    engineRef.current?.unlockAudioAndTTS();
    if (voiceState === "speaking" || voiceState === "thinking") {
      engineRef.current?.triggerBargeIn();
      return;
    }

    if (voiceState === "listening") {
      await submitVoiceTurn();
      return;
    }

    // Start listening
    await handleStartListening();
  }

  // Fade out subtitles after idle
  useEffect(() => {
    if (voiceState === "idle" && (liveTranscript || cortexResponse)) {
      if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
      transcriptTimeoutRef.current = setTimeout(() => {
        setLiveTranscript("");
        setCortexResponse("");
        setCurrentSpokenSentence("");
      }, 7000);
    }
    return () => {
      if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
    };
  }, [voiceState, liveTranscript, cortexResponse]);

  // Compute dynamic heights for the 5-bar equalizer
  const normalizedLevel = Math.min(1, Math.max(0, audioLevel));
  const isActiveAudio = voiceState === "listening" || voiceState === "speaking";

  const barHeights = isActiveAudio
    ? [
        Math.max(4, Math.round(4 + normalizedLevel * 16)),
        Math.max(6, Math.round(6 + normalizedLevel * 24)),
        Math.max(8, Math.round(8 + normalizedLevel * 30)),
        Math.max(5, Math.round(5 + normalizedLevel * 22)),
        Math.max(3, Math.round(3 + normalizedLevel * 14)),
      ]
    : voiceState === "thinking"
    ? [8, 14, 20, 14, 8]
    : [3, 6, 8, 5, 2];

  const activeSession = sessions.find((s) => s.id === activeSessionId || s.connected);
  const activePalette = useMemo(
    () => PreferencesStore.getPaletteForAgent(activeAgent),
    [activeAgent, userPrefs]
  );

  return (
    <div
      id="cortex-immersive-app"
      className="w-full h-full min-h-dvh bg-[#030303] flex flex-col items-center justify-between px-4 py-3 sm:px-8 sm:py-5 md:px-10 md:py-6 text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-hidden select-none relative"
      style={{
        background: "radial-gradient(circle at center, #0a0a0f 0%, #030303 100%)",
      }}
    >
      {/* Ambient background glows tied to active color palette */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-30 pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: activePalette.glowHex }}
      />
      <div
        className="absolute w-[300px] h-[300px] rounded-full blur-[80px] opacity-20 pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: activePalette.primaryHex }}
      />
      <div
        className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none ${
          voiceState === "listening"
            ? "opacity-40"
            : voiceState === "speaking"
            ? "opacity-50"
            : "opacity-0"
        }`}
        style={{
          background: `radial-gradient(circle at center, ${activePalette.glowHex}22 0%, transparent 70%)`,
        }}
      />

      {/* Navigation Header */}
      <nav id="cortex-nav" className="w-full flex justify-between items-center relative z-10 max-w-2xl gap-2 flex-wrap sm:flex-nowrap">
        {/* Language switch */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-full p-0.5 backdrop-blur-md">
          <button
            id="cortex-lang-es"
            onClick={() => handleLanguageChange("es-ES")}
            className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider transition-all duration-200 ${
              language === "es-ES"
                ? "bg-cyan-500/20 text-cyan-200 font-medium"
                : "text-white/30 hover:text-white/70"
            }`}
          >
            ES
          </button>
          <button
            id="cortex-lang-en"
            onClick={() => handleLanguageChange("en-US")}
            className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider transition-all duration-200 ${
              language === "en-US"
                ? "bg-cyan-500/20 text-cyan-200 font-medium"
                : "text-white/30 hover:text-white/70"
            }`}
          >
            EN
          </button>
        </div>

        {/* Center Navigation Capsule Row: Agents/Lobby, Sessions, Browser, Integrations, Logs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Active Agent / Lobby Capsule Button */}
          <div className="flex items-center">
            <button
              id="cortex-lobby-indicator-btn"
              onClick={() => {
                setIsLobbyModalOpen(true);
                soundFx.playWake();
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border backdrop-blur-md transition-all duration-300"
              style={{
                backgroundColor: `${activePalette.primaryHex}18`,
                borderColor: `${activePalette.primaryHex}55`,
                color: activePalette.primaryHex,
                boxShadow: `0 0 12px ${activePalette.glowHex}25`,
              }}
              title={
                language === "es-ES"
                  ? "Lobby Multi-Agente & Configuración interactiva"
                  : "Multi-Agent Lobby & Interactive config"
              }
            >
              <span className="text-xs">{activeAgent.avatarEmoji || (activeAgent.isPrimary ? "🌐" : "🤖")}</span>
              <span className="text-[10px] font-semibold tracking-wide">
                {activeAgent.isPrimary ? "Lobby (Cortex)" : activeAgent.name}
              </span>
            </button>

            {/* If in specialized agent, quick button to return to Lobby */}
            {!activeAgent.isPrimary && (
              <button
                id="cortex-quick-return-lobby"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReturnToLobby();
                }}
                className="ml-1 px-2 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-[9px] text-white/70 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                title={language === "es-ES" ? "Volver al Lobby con Cortex" : "Return to Lobby with Cortex"}
              >
                <ArrowLeft className="w-2.5 h-2.5" style={{ color: activePalette.primaryHex }} />
                <span className="hidden sm:inline">{language === "es-ES" ? "Lobby" : "Lobby"}</span>
              </button>
            )}
          </div>

          {/* Active Session Capsule */}
          <button
            id="cortex-session-indicator-btn"
            onClick={() => {
              setIsSessionModalOpen(true);
              soundFx.playWake();
            }}
            className={`flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-md transition-all duration-300 ${
              activeSession
                ? "bg-cyan-950/40 border-cyan-500/40 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                : "bg-white/5 border-white/5 text-white/40 hover:text-white/70 hover:border-white/10"
            }`}
            title={language === "es-ES" ? "Gestionar o conectar sesión" : "Manage or connect session"}
          >
            {activeSession ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                <span className="text-[10px] font-medium tracking-wide truncate max-w-[90px] sm:max-w-[120px]">
                  {activeSession.title}
                </span>
              </>
            ) : (
              <>
                <Layers className="w-3 h-3 text-white/40" />
                <span className="text-[10px] tracking-wider uppercase">
                  {language === "es-ES" ? "Sesiones" : "Sessions"}
                </span>
              </>
            )}
          </button>

          {/* Browser Overlay Button */}
          <button
            id="cortex-browser-toggle-btn"
            onClick={() => {
              setIsBrowserOpen(!isBrowserOpen);
              soundFx.playWake();
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] uppercase tracking-wider transition-all duration-200 backdrop-blur-md ${
              isBrowserOpen
                ? "border-cyan-500/50 bg-cyan-950/50 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                : "border-white/5 bg-white/5 text-white/50 hover:text-white hover:border-white/10"
            }`}
            title={language === "es-ES" ? "Abrir navegador web / iframe" : "Open web browser / iframe"}
          >
            <Globe className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">{language === "es-ES" ? "WEB" : "BROWSER"}</span>
          </button>

          {/* Integrations Hub Button */}
          <button
            id="cortex-integrations-toggle-btn"
            onClick={() => {
              setIsIntegrationsOpen(true);
              soundFx.playWake();
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] uppercase tracking-wider transition-all duration-200 backdrop-blur-md ${
              isIntegrationsOpen
                ? "border-cyan-500/50 bg-cyan-950/50 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                : "border-white/5 bg-white/5 text-white/50 hover:text-white hover:border-white/10"
            }`}
            title={language === "es-ES" ? "Google Suite y Composio Dev" : "Google Suite & Composio Dev"}
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">{language === "es-ES" ? "APPS" : "INTEGRATIONS"}</span>
          </button>

          {/* Conversation Logs & Moderation Button */}
          <button
            id="cortex-logs-toggle-btn"
            onClick={() => {
              setIsConversationLogsOpen(true);
              soundFx.playWake();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] uppercase tracking-wider transition-all duration-200 backdrop-blur-md ${
              isConversationLogsOpen
                ? "border-cyan-500/50 bg-cyan-950/50 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                : "border-white/5 bg-white/5 text-white/50 hover:text-white hover:border-white/10"
            }`}
            title={language === "es-ES" ? "Registro de conversaciones y moderación" : "Conversation logs & moderation"}
          >
            <Shield className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">LOGS</span>
            <span className="text-[8px] font-mono text-cyan-300">({conversationLogs.length})</span>
          </button>
        </div>

        {/* Right Action Icons: Preferences & Continuous Hands-free */}
        <div className="flex items-center gap-1.5">
          {/* Preferences / Orb Color Palette Button */}
          <button
            id="cortex-preferences-toggle"
            onClick={() => {
              setIsPreferencesOpen(true);
              soundFx.playWake();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 text-[9px] uppercase tracking-wider transition-all duration-200 backdrop-blur-md"
            title={language === "es-ES" ? "Preferencias y color de la burbuja" : "Preferences & Orb color"}
          >
            <Palette className="w-3 h-3" style={{ color: activePalette.glowHex }} />
          </button>

          {/* VAD Logger Toggle */}
          <button
            id="cortex-logger-toggle"
            onClick={() => {
              setIsLoggerOpen(!isLoggerOpen);
              soundFx.playWake();
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[9px] uppercase tracking-wider transition-all duration-200 ${
              isLoggerOpen
                ? "border-cyan-500/50 bg-cyan-950/50 text-cyan-200"
                : "border-white/5 bg-white/5 text-white/40 hover:text-white/70"
            }`}
            title={language === "es-ES" ? "Logger VAD en pantalla" : "VAD Telemetry HUD"}
          >
            <Terminal className="w-3 h-3 text-cyan-400" />
          </button>

          {/* Continuous Conversation Switch */}
          <button
            id="cortex-conversation-mode"
            onClick={() => {
              setContinuousMode(!continuousMode);
              soundFx.playWake();
            }}
            className={`flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border transition-all duration-300 ${
              continuousMode
                ? "border-cyan-500/40 bg-cyan-950/40 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                : "border-white/5 bg-white/5 text-white/35 hover:text-white/60"
            }`}
            title={
              language === "es-ES"
                ? "Modo manos libres fluido (Split + Streaming estilo ElevenLabs con interrupción inmediata)"
                : "Hands-free continuous mode"
            }
          >
            {continuousMode ? (
              <>
                <Radio className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                <span className="hidden sm:inline">{language === "es-ES" ? "VOICE-FIRST" : "VOICE-FIRST"}</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                <span className="hidden sm:inline">{language === "es-ES" ? "PULSAR" : "PUSH"}</span>
              </>
            )}
          </button>
        </div>
      </nav>

      {/* Main Center Section */}
      <main
        id="cortex-main-stage"
        className="relative flex flex-col items-center justify-center flex-grow w-full max-w-lg z-10 my-1 sm:my-3 min-h-0"
      >
        {/* Real-time Transition Stepper Pill / Interruption Live Indicator */}
        {wasInterrupted ? (
          <div className="absolute top-0 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-[10px] uppercase tracking-widest animate-fade-in flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            <Zap className="w-3 h-3 text-amber-300 animate-bounce" />
            <span>{language === "es-ES" ? "Interrupción detectada • Reanalizando" : "Interrupted • Re-analyzing"}</span>
          </div>
        ) : vadTelemetry?.lastTransition ? (
          <button
            onClick={() => setIsLoggerOpen(true)}
            className="absolute top-0 px-3 py-0.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400/50 text-cyan-200 text-[9px] font-mono tracking-wider animate-fade-in flex items-center gap-1.5 backdrop-blur-md shadow-[0_0_12px_rgba(6,182,212,0.15)] transition-all cursor-pointer"
            title="Click to view full transition telemetry in Analyzer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-300 font-bold uppercase">{vadTelemetry.lastTransition.fromState}</span>
            <span className="text-white/40">──▶</span>
            <span className="text-cyan-200 font-bold uppercase">{vadTelemetry.lastTransition.toState}</span>
            <span className="text-white/30 text-[8px]">({vadTelemetry.lastTransition.durationMs}ms)</span>
          </button>
        ) : voiceState === "speaking" ? (
          <div className="absolute top-0 px-3 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[9px] uppercase tracking-widest animate-fade-in flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>{language === "es-ES" ? "Streaming Split en Vivo • Habla para cortar" : "Live Split Stream • Speak to interrupt"}</span>
          </div>
        ) : null}

        {/* Orb Container with Concentric Ring Framing */}
        <div
          id="cortex-orb-interaction"
          className="relative group cursor-pointer"
          onClick={handleToggleVoice}
        >
          {/* Ambient interactive glow */}
          <div
            className={`absolute -inset-8 rounded-full blur-2xl transition-all duration-700 pointer-events-none ${
              voiceState === "listening"
                ? "bg-cyan-500/30 opacity-60 scale-105"
                : voiceState === "thinking"
                ? "bg-indigo-500/30 opacity-50 scale-100"
                : voiceState === "speaking"
                ? "bg-fuchsia-500/30 opacity-60 scale-105"
                : "bg-cyan-500/20 opacity-20 group-hover:opacity-35"
            }`}
          />

          {/* Ethereal Outer Ring 2 */}
          <div
            className={`absolute w-full h-full rounded-full border border-white/5 scale-[1.25] pointer-events-none transition-transform duration-700 ${
              voiceState !== "idle" ? "scale-[1.3] border-white/10" : ""
            }`}
          />

          {/* Ethereal Outer Ring 1 */}
          <div
            className={`absolute w-full h-full rounded-full border opacity-40 scale-[1.1] pointer-events-none transition-all duration-700 ${
              voiceState === "listening"
                ? "opacity-70 scale-[1.14]"
                : voiceState === "speaking"
                ? "opacity-70 scale-[1.14]"
                : ""
            }`}
            style={{
              borderColor: `${activePalette.primaryHex}40`,
            }}
          />

          {/* Outer Glass Shell Framing */}
          <div
            className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-full border border-white/5 flex items-center justify-center overflow-hidden transition-all duration-500"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
              boxShadow: `0 0 100px ${activePalette.glowHex}18`,
            }}
          >
            <LiquidOrb
              voiceState={voiceState}
              audioLevel={audioLevel}
              preferences={userPrefs}
              palette={activePalette}
              onOrbClick={handleToggleVoice}
            />
          </div>
        </div>

        {/* Dynamic Voice Status & Sentence-by-Sentence Visualizer */}
        <div
          id="cortex-feedback"
          className="mt-6 sm:mt-8 flex flex-col items-center justify-center text-center h-28 max-h-28 min-h-[112px] w-full max-w-lg px-4 overflow-hidden select-none"
        >
          {errorMessage ? (
            <div className="flex items-center space-x-2 text-rose-400/90 text-xs font-light tracking-wide animate-fade-in bg-rose-950/30 border border-rose-500/20 px-3 py-1.5 rounded-full">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : voiceState === "listening" ? (
            <div className="flex flex-col items-center justify-center gap-1.5 w-full h-full animate-fade-in">
              {liveTranscript ? (
                <div className="flex flex-col items-center gap-1.5 w-full max-w-md">
                  <div
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase font-mono tracking-widest border transition-all duration-300"
                    style={{
                      backgroundColor: `${activePalette.primaryHex}18`,
                      borderColor: `${activePalette.primaryHex}45`,
                      color: activePalette.primaryHex,
                      boxShadow: `0 0 14px ${activePalette.glowHex}25`,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-ping"
                      style={{ backgroundColor: activePalette.primaryHex }}
                    />
                    <span className="font-semibold">
                      {activeAgent.name} [{language === "es-ES" ? "Escuchando en vivo" : "Live Listening"}]
                    </span>
                  </div>
                  <p
                    className="text-white text-base sm:text-lg font-medium tracking-wide px-4 py-1.5 rounded-2xl bg-white/[0.04] backdrop-blur-md line-clamp-1 max-w-md"
                    style={{
                      borderWidth: 1,
                      borderColor: `${activePalette.primaryHex}35`,
                      boxShadow: `0 0 20px ${activePalette.glowHex}20`,
                    }}
                  >
                    "{getActiveLiveSegment(liveTranscript)}"
                  </p>
                  <button
                    id="cortex-instant-submit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      submitVoiceTurn(liveTranscript);
                    }}
                    className="mt-0.5 px-3.5 py-1 rounded-full text-[10px] font-medium flex items-center gap-1.5 transition-all cursor-pointer border"
                    style={{
                      backgroundColor: `${activePalette.primaryHex}25`,
                      borderColor: `${activePalette.primaryHex}55`,
                      color: activePalette.primaryHex,
                      boxShadow: `0 0 15px ${activePalette.glowHex}25`,
                    }}
                  >
                    <Zap className="w-3 h-3 animate-pulse" style={{ color: activePalette.primaryHex }} />
                    <span>{language === "es-ES" ? "Responder ahora" : "Send Now"}</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1">
                  {lastUserPrompt && cortexResponse && (
                    <p className="text-white/35 text-xs font-light line-clamp-1 max-w-sm mb-0.5">
                      {getLatestSentence(cortexResponse)}
                    </p>
                  )}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono tracking-widest border mb-1"
                    style={{
                      backgroundColor: `${activePalette.primaryHex}15`,
                      borderColor: `${activePalette.primaryHex}35`,
                      color: activePalette.primaryHex,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-ping"
                      style={{ backgroundColor: activePalette.primaryHex }}
                    />
                    <span className="font-semibold">
                      {activeAgent.name} [{language === "es-ES" ? "Escuchando" : "Listening"}]
                    </span>
                  </div>
                  <p className="text-white/70 text-sm sm:text-base font-light italic tracking-wider">
                    {language === "es-ES"
                      ? "Te escucho, habla libremente..."
                      : "Listening hands-free, speak naturally..."}
                  </p>
                </div>
              )}
            </div>
          ) : voiceState === "thinking" ? (
            <div className="flex flex-col items-center justify-center gap-2 w-full h-full animate-fade-in">
              {(liveTranscript || lastUserPrompt) && (
                <div className="px-3.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-white/90 text-xs font-normal max-w-sm truncate shadow-sm">
                  <span
                    className="mr-1.5 font-mono text-[10px] uppercase font-semibold"
                    style={{ color: activePalette.primaryHex }}
                  >
                    {language === "es-ES" ? "Tú:" : "You:"}
                  </span>
                  "{getActiveLiveSegment(liveTranscript || lastUserPrompt)}"
                </div>
              )}
              <div
                className="flex items-center gap-2 text-xs tracking-wider px-3.5 py-1.5 rounded-full border transition-all duration-300"
                style={{
                  backgroundColor: `${activePalette.primaryHex}18`,
                  borderColor: `${activePalette.primaryHex}45`,
                  color: activePalette.primaryHex,
                  boxShadow: `0 0 16px ${activePalette.glowHex}30`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full animate-ping"
                  style={{ backgroundColor: activePalette.primaryHex }}
                />
                <span className="font-semibold tracking-wide">
                  {activeAgent.name} [{language === "es-ES" ? "Generando respuesta..." : "Generating response..."}]
                </span>
              </div>
            </div>
          ) : voiceState === "speaking" ? (
            <div className="flex flex-col items-center justify-center gap-2 w-full h-full animate-fade-in">
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase font-mono tracking-widest border transition-all duration-300"
                style={{
                  backgroundColor: `${activePalette.primaryHex}18`,
                  borderColor: `${activePalette.primaryHex}45`,
                  color: activePalette.primaryHex,
                  boxShadow: `0 0 16px ${activePalette.glowHex}30`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-ping"
                  style={{ backgroundColor: activePalette.primaryHex }}
                />
                <span className="font-semibold">
                  {activeAgent.name} [{language === "es-ES" ? "Respondiendo" : "Responding"}]
                </span>
              </div>
              <p
                key={currentSpokenSentence}
                className="text-white text-base sm:text-lg font-medium tracking-wide px-4 text-center line-clamp-2 max-w-lg animate-fade-in"
                style={{
                  textShadow: `0 0 14px ${activePalette.glowHex}66`,
                }}
              >
                "{currentSpokenSentence || getLatestSentence(cortexResponse)}"
              </p>
            </div>
          ) : cortexResponse ? (
            <div className="flex flex-col items-center justify-center gap-1 animate-fade-in">
              <div
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wide border mb-0.5"
                style={{
                  backgroundColor: `${activePalette.primaryHex}15`,
                  borderColor: `${activePalette.primaryHex}35`,
                  color: activePalette.primaryHex,
                }}
              >
                <span className="font-semibold">{activeAgent.name}</span>
                <span className="text-white/40">•</span>
                <span className="text-white/60">{language === "es-ES" ? "Respuesta lista" : "Response ready"}</span>
              </div>
              <p className="text-white/70 text-xs sm:text-sm font-light tracking-wide line-clamp-2 max-w-sm">
                "{getLatestSentence(cortexResponse)}"
              </p>
              <p
                className="text-[11px] font-mono tracking-wider mt-0.5"
                style={{ color: `${activePalette.primaryHex}bb` }}
              >
                {language === "es-ES" ? "Modo conversación activo • Continúa hablando" : "Conversational mode active • Speak next"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1">
              <div
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wide border"
                style={{
                  backgroundColor: `${activePalette.primaryHex}12`,
                  borderColor: `${activePalette.primaryHex}30`,
                  color: activePalette.primaryHex,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activePalette.primaryHex }} />
                <span>{activeAgent.name} [{language === "es-ES" ? "Listo" : "Ready"}]</span>
              </div>
              <p className="text-white/40 text-sm sm:text-base font-light italic tracking-wider">
                {continuousMode
                  ? language === "es-ES"
                    ? "Conversación manos libres activa"
                    : "Live hands-free conversation active"
                  : language === "es-ES"
                  ? "Toca para hablar"
                  : "Ready"}
              </p>
            </div>
          )}

          {/* Equalizer Visualizer Bars */}
          <div className="flex gap-1.5 items-center justify-center h-5 mt-1.5">
            <div
              className="w-0.5 bg-white/20 rounded-full transition-all duration-150"
              style={{ height: `${barHeights[0]}px` }}
            />
            <div
              className="w-0.5 rounded-full transition-all duration-150"
              style={{
                height: `${barHeights[1]}px`,
                backgroundColor: `${activePalette.primaryHex}80`,
              }}
            />
            <div
              className="w-0.5 rounded-full transition-all duration-150"
              style={{
                height: `${barHeights[2]}px`,
                backgroundColor: activePalette.primaryHex,
                boxShadow: `0 0 10px ${activePalette.glowHex}`,
              }}
            />
            <div
              className="w-0.5 rounded-full transition-all duration-150"
              style={{
                height: `${barHeights[3]}px`,
                backgroundColor: `${activePalette.primaryHex}80`,
              }}
            />
            <div
              className="w-0.5 bg-white/20 rounded-full transition-all duration-150"
              style={{ height: `${barHeights[4]}px` }}
            />
          </div>
        </div>
      </main>

      {/* Footer Interactive Pill & Guide */}
      <footer id="cortex-footer" className="w-full flex flex-col items-center gap-2 sm:gap-2.5 pb-2 sm:pb-3 relative z-10 max-w-lg">
        {/* Permission Denied / Blocked Notice & Quick Recovery Banner */}
        {isMicPermissionDenied && (
          <div
            id="cortex-mic-permission-banner"
            className="w-full bg-rose-950/40 border border-rose-500/40 rounded-2xl p-3.5 backdrop-blur-lg animate-fade-in shadow-[0_0_20px_rgba(244,63,94,0.15)] flex flex-col gap-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
                <MicOff className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>
                  {language === "es-ES"
                    ? "Acceso al micrófono restringido"
                    : "Microphone Access Restricted"}
                </span>
              </div>
              <button
                onClick={() => setIsMicPermissionDenied(false)}
                className="text-white/40 hover:text-white/80 p-0.5 rounded-full"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-white/70 leading-relaxed">
              {language === "es-ES"
                ? "El navegador o el entorno bloqueó el micrófono. Haz clic en 'Reintentar' tras permitir el acceso en la barra del navegador, o abre en una pestaña nueva."
                : "The browser or iframe blocked microphone access. Click 'Retry' after allowing access in your browser bar, or open in a new tab."}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleStartListening}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-[10px] font-medium tracking-wide transition-all"
              >
                <RefreshCw className="w-3 h-3 text-rose-300" />
                <span>{language === "es-ES" ? "Reintentar Micrófono" : "Retry Microphone"}</span>
              </button>

              <button
                onClick={() => window.open(window.location.href, "_blank")}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white/80 text-[10px] font-medium tracking-wide transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                <span>{language === "es-ES" ? "Abrir en nueva pestaña" : "Open in new tab"}</span>
              </button>

              <button
                onClick={() => setShowPermissionGuide(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white/40 hover:text-white/80 text-[10px] tracking-wide ml-auto"
              >
                <HelpCircle className="w-3 h-3" />
                <span>{language === "es-ES" ? "Guía" : "Guide"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div
          className={`flex items-center justify-center gap-1.5 w-full transition-all duration-300 ${
            showTextInput
              ? "overflow-x-auto no-scrollbar py-0.5 flex-nowrap max-w-full justify-start sm:justify-center opacity-75 scale-[0.98]"
              : "flex-wrap"
          }`}
        >
          {[
            {
              label: language === "es-ES" ? "🌐 Entra a example.com" : "🌐 Go to example.com",
              prompt: language === "es-ES" ? "Entra a example.com" : "Navigate to example.com",
            },
            {
              label: language === "es-ES" ? "📁 Entrar a Sesión" : "📁 Join Session",
              prompt: language === "es-ES" ? "Entra en la sesión Estrategia de Producto Q3 y cierra el popup de sesiones." : "Join the Product Strategy Q3 session and close the popup.",
            },
            {
              label: language === "es-ES" ? "🌐 Abrir Navegador" : "🌐 Open Browser",
              prompt: language === "es-ES" ? "Abre el navegador web para consultar Wikipedia sobre Inteligencia Artificial." : "Open the browser overlay on Wikipedia AI.",
            },
            {
              label: language === "es-ES" ? "❌ Cerrar Navegador" : "❌ Close Browser",
              prompt: language === "es-ES" ? "Cierra el navegador y vuelve a la vista de voz." : "Close browser and return to voice first view.",
            },
            {
              label: language === "es-ES" ? "⚡ Ver Integraciones" : "⚡ View Integrations",
              prompt: language === "es-ES" ? "Abre el panel de integraciones para ver Google Suite y Composio Dev." : "Show the integrations hub for Google Suite and Composio Dev.",
            },
            {
              label: language === "es-ES" ? "🛡️ Logs y Moderación" : "🛡️ Logs & Policy",
              action: () => {
                setIsConversationLogsOpen(true);
                soundFx.playWake();
              },
            },
          ].map((chip, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (chip.action) {
                  chip.action();
                } else if (chip.prompt) {
                  handleQuickPrompt(chip.prompt);
                }
              }}
              className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/30 text-white/50 hover:text-cyan-200 text-[10px] tracking-wide transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Expandable Fallback Keyboard Input Bar - Elevated ABOVE the action pill so it never goes off-screen */}
        {showTextInput && (
          <div className="w-full animate-fade-in transition-all px-1">
            <form
              onSubmit={handleTextQuerySubmit}
              className="w-full flex items-center gap-2 bg-[#0c0d15]/95 border rounded-full px-3.5 py-2 backdrop-blur-xl transition-all shadow-xl shadow-black/70"
              style={{
                borderColor: `${activePalette.primaryHex}70`,
                boxShadow: `0 0 24px ${activePalette.glowHex}30`,
              }}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" style={{ color: activePalette.primaryHex }} />
              <input
                ref={textInputRef}
                type="text"
                autoFocus
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowTextInput(false);
                  }
                }}
                placeholder={
                  language === "es-ES"
                    ? `Escribe tu consulta para ${activeAgent.name}...`
                    : `Type your query for ${activeAgent.name}...`
                }
                className="flex-grow bg-transparent text-white text-xs sm:text-sm placeholder:text-white/30 focus:outline-none px-1"
              />
              {textInput && (
                <button
                  type="button"
                  onClick={() => setTextInput("")}
                  className="p-1 rounded-full text-white/40 hover:text-white/80 transition-colors cursor-pointer"
                  title={language === "es-ES" ? "Limpiar" : "Clear"}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                type="submit"
                disabled={!textInput.trim()}
                className="p-1.5 px-3 rounded-full flex items-center gap-1.5 text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                style={{
                  backgroundColor: `${activePalette.primaryHex}30`,
                  color: activePalette.primaryHex,
                  border: `1px solid ${activePalette.primaryHex}60`,
                }}
              >
                <Send className="w-3 h-3" />
                <span className="hidden sm:inline">{language === "es-ES" ? "Enviar" : "Send"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowTextInput(false)}
                className="p-1.5 rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors cursor-pointer ml-0.5"
                title={language === "es-ES" ? "Cerrar entrada" : "Close input"}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Main Voice Toggle Pill */}
        <div className="flex items-center gap-2">
          <button
            id="cortex-action-pill"
            onClick={handleToggleVoice}
            className={`px-7 py-3 rounded-full border backdrop-blur-md text-[10px] uppercase tracking-[0.2em] transition-all duration-300 cursor-pointer active:scale-95 ${
              voiceState === "idle"
                ? "border-white/10 bg-white/5 text-white/50 hover:text-white/90 hover:border-white/20 hover:bg-white/10"
                : ""
            }`}
            style={
              voiceState !== "idle"
                ? {
                    borderColor: `${activePalette.primaryHex}60`,
                    backgroundColor: `${activePalette.primaryHex}20`,
                    color: activePalette.primaryHex,
                    boxShadow: `0 0 20px ${activePalette.glowHex}30`,
                  }
                : undefined
            }
          >
            {voiceState === "listening"
              ? language === "es-ES"
                ? liveTranscript
                  ? "Escuchando voz en vivo..."
                  : "Manos libres activo"
                : liveTranscript
                ? "Live speech detected..."
                : "Hands-Free Active"
              : voiceState === "speaking"
              ? language === "es-ES"
                ? "Habla para interrumpir"
                : "Speak to Interrupt"
              : voiceState === "thinking"
              ? language === "es-ES"
                ? "Generando respuesta..."
                : "Generating response..."
              : language === "es-ES"
              ? "Iniciar manos libres"
              : "Start Hands-Free"}
          </button>

          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className={`p-3 rounded-full border backdrop-blur-md transition-all ${
              showTextInput
                ? ""
                : "border-white/10 bg-white/5 text-white/40 hover:text-white/80 hover:border-white/20"
            }`}
            style={
              showTextInput
                ? {
                    borderColor: `${activePalette.primaryHex}60`,
                    backgroundColor: `${activePalette.primaryHex}20`,
                    color: activePalette.primaryHex,
                    boxShadow: `0 0 14px ${activePalette.glowHex}25`,
                  }
                : undefined
            }
            title={language === "es-ES" ? "Escribir mensaje de texto" : "Type text message"}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>

        {continuousMode && (
          <span className="text-[9px] text-white/25 uppercase tracking-widest font-light pointer-events-none">
            {language === "es-ES"
              ? "Totalmente manos libres • La interfaz vuelve a la burbuja principal tras cada acción"
              : "Fully hands-free • Interface always returns to voice first view after actions"}
          </span>
        )}
      </footer>

      {/* Permission Guide Modal */}
      {showPermissionGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-[#0d0d12] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-cyan-400" />
                </div>
                <h3 className="text-sm font-semibold tracking-wide">
                  {language === "es-ES" ? "Cómo permitir el micrófono" : "How to Enable Microphone"}
                </h3>
              </div>
              <button
                onClick={() => setShowPermissionGuide(false)}
                className="text-white/40 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-white/70 space-y-3 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-cyan-300 flex-shrink-0 font-bold">
                  1
                </span>
                <p>
                  {language === "es-ES"
                    ? "Busca el icono de candado o controles de sitio en la barra de direcciones de tu navegador (junto a la URL)."
                    : "Look for the lock or site settings icon in your browser address bar (next to the URL)."}
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-cyan-300 flex-shrink-0 font-bold">
                  2
                </span>
                <p>
                  {language === "es-ES"
                    ? "Cambia la opción 'Micrófono' de 'Bloqueado' a 'Permitir' o 'Preguntar siempre'."
                    : "Change 'Microphone' from 'Block' to 'Allow' or 'Ask'."}
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-cyan-300 flex-shrink-0 font-bold">
                  3
                </span>
                <p>
                  {language === "es-ES"
                    ? "Si estás dentro de un iframe o previsualización restringida, haz clic en 'Abrir en pestaña nueva' para obtener permisos nativos completos."
                    : "If running in an embedded preview iframe, click 'Open in new tab' for full native browser permissions."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => window.open(window.location.href, "_blank")}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{language === "es-ES" ? "Abrir en nueva pestaña" : "Open in new tab"}</span>
              </button>
              <button
                onClick={() => {
                  setShowPermissionGuide(false);
                  handleStartListening();
                }}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                {language === "es-ES" ? "Reintentar ahora" : "Retry Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Lobby & Interactive Multi-Agent Hub Modal */}
      <AgentLobbyModal
        isOpen={isLobbyModalOpen}
        onClose={() => {
          setIsLobbyModalOpen(false);
          soundFx.playComplete();
        }}
        agents={agents}
        activeAgentId={activeAgent.id}
        onSelectAgent={handleSelectAgent}
        onCreateAgent={handleCreateAgent}
        onUpdateAgent={handleUpdateAgent}
        onDeleteAgent={handleDeleteAgent}
        onAuditionVoice={handleAuditionVoice}
        onReturnToLobby={handleReturnToLobby}
        language={language}
      />

      {/* Session Management Transparent Popup */}
      <SessionModal
        isOpen={isSessionModalOpen}
        onClose={() => {
          setIsSessionModalOpen(false);
          soundFx.playWake();
        }}
        sessions={sessions}
        activeSessionId={activeSessionId}
        activeAgent={activeAgent}
        onConnectSession={handleConnectSession}
        onDisconnectSession={handleDisconnectSession}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onSummarizeSession={handleSummarizeSession}
        language={language}
      />

      {/* Web Browser Overlay Modal */}
      <BrowserOverlayModal
        isOpen={isBrowserOpen}
        onClose={() => {
          setIsBrowserOpen(false);
          soundFx.playComplete();
        }}
        currentUrl={browserUrl}
        onNavigate={(newUrl) => setBrowserUrl(newUrl)}
        language={language}
      />

      {/* Integrations Hub Modal (Google Suite & Composio Dev) */}
      <IntegrationsModal
        isOpen={isIntegrationsOpen}
        onClose={() => {
          setIsIntegrationsOpen(false);
          soundFx.playComplete();
        }}
        language={language}
      />

      {/* Conversation Logs & Moderation Audit Modal */}
      <ConversationLogsModal
        isOpen={isConversationLogsOpen}
        onClose={() => {
          setIsConversationLogsOpen(false);
          soundFx.playWake();
        }}
        logs={conversationLogs}
        policy={behaviorPolicy}
        onUpdatePolicy={(updated) => setBehaviorPolicy(updated)}
        onClearLogs={handleClearLogs}
        onUpdateFeedback={handleUpdateLogFeedback}
        onToggleFlag={handleToggleLogFlag}
        language={language}
      />

      {/* Internal Diagnostics & Virtualized Process Sandbox Modal */}
      <VirtualDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => {
          setIsDiagnosticsOpen(false);
          soundFx.playWake();
        }}
        voiceState={voiceState}
        audioLevel={audioLevel}
        continuousMode={continuousMode}
        language={language}
        currentSpokenSentence={currentSpokenSentence}
        cortexResponse={cortexResponse}
        liveTranscript={liveTranscript}
        onSimulateSpeech={handleSimulateSpeech}
        onTriggerBargeIn={handleUserBargeIn}
        onForceSubmitTurn={handleForceSubmitTurn}
      />

      {/* Real-time On-Screen Audio Chunk & VAD Logger HUD Overlay */}
      <VadLoggerOverlay
        isOpen={isLoggerOpen}
        onClose={() => {
          setIsLoggerOpen(false);
          soundFx.playWake();
        }}
        telemetry={vadTelemetry}
        logs={vadLogs}
        voiceState={voiceState}
        onClearLogs={handleClearVadLogs}
        onUpdateVadThreshold={handleUpdateVadThreshold}
        onUpdateSilenceDuration={handleUpdateSilenceDuration}
        onSimulateBargeIn={handleUserBargeIn}
      />

      {/* User Preferences & Orb Color Customizer Modal */}
      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => {
          setIsPreferencesOpen(false);
          soundFx.playWake();
        }}
        language={language}
      />
    </div>
  );
}



