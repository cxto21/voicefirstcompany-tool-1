// Global type augmentations for WebGPU in environments without @webgpu/types
declare global {
  interface Navigator {
    gpu?: {
      requestAdapter: (options?: any) => Promise<any>;
      getPreferredCanvasFormat: () => any;
    };
  }

  const GPUBufferUsage: {
    MAP_READ: number;
    MAP_WRITE: number;
    COPY_SRC: number;
    COPY_DST: number;
    INDEX: number;
    VERTEX: number;
    UNIFORM: number;
    STORAGE: number;
    INDIRECT: number;
    QUERY_RESOLVE: number;
  };
}

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export interface AgentVoiceConfig {
  voiceName: string;
  pitch: number;
  rate: number;
  lang: string;
  timbreLabel?: string;
}

export interface AgentThemeConfig {
  presetId: string;
  primaryHex: string;
  secondaryHex: string;
  glowHex: string;
}

export interface AgentItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  systemPrompt: string;
  isPrimary: boolean;
  avatarIcon: string;
  theme: AgentThemeConfig;
  voice: AgentVoiceConfig;
  tags: string[];
  createdAt: number;
}

export interface SessionItem {
  id: string;
  agentId?: string; // Belongs to specific agent ("cortex-main", "agent-atlas", etc.)
  title: string;
  topic: string;
  lastActive: string;
  timestamp: number;
  tags: string[];
  summary: string;
  connected?: boolean;
  messages?: ChatMessage[];
}

export type VoiceActionType =
  | "OPEN_LOBBY"
  | "CLOSE_LOBBY"
  | "RETURN_TO_LOBBY"
  | "SWITCH_AGENT"
  | "CREATE_AGENT"
  | "DELETE_AGENT"
  | "RENAME_AGENT"
  | "LIST_AGENTS"
  | "AUDITION_VOICE"
  | "LIST_SESSIONS"
  | "OPEN_CONNECT_MODAL"
  | "CONNECT_SESSION"
  | "SWITCH_SESSION"
  | "DISCONNECT_SESSION"
  | "CREATE_SESSION"
  | "DELETE_SESSION"
  | "RENAME_SESSION"
  | "SUMMARIZE_SESSION"
  | "OPEN_BROWSER"
  | "NAVIGATE_BROWSER"
  | "CLOSE_BROWSER"
  | "OPEN_INTEGRATIONS"
  | "CLOSE_INTEGRATIONS"
  | "OPEN_CONVERSATION_LOGS"
  | "CLOSE_CONVERSATION_LOGS"
  | "CLOSE_MODAL"
  | "NONE";

export interface VoiceAction {
  type: VoiceActionType;
  agentId?: string;
  agentName?: string;
  newAgentName?: string;
  role?: string;
  tagline?: string;
  agentDescription?: string;
  specialization?: string;
  themePreset?: string;
  voiceName?: string;
  pitch?: number;
  rate?: number;
  sessionId?: string;
  sessionTitle?: string;
  newTitle?: string;
  topic?: string;
  summaryText?: string;
  url?: string;
  query?: string;
  integrationId?: string;
  limit?: number;
}

export interface UIContext {
  activeAgentId: string;
  activeAgentName: string;
  isLobby: boolean;
  availableAgents?: Array<{ id: string; name: string; tagline: string; isPrimary: boolean; tags: string[] }>;
  activeSessionId: string | null;
  activeSessionTitle: string | null;
  isConnectModalOpen: boolean;
  isLobbyModalOpen?: boolean;
  isBrowserOpen?: boolean;
  browserUrl?: string;
  isIntegrationsOpen?: boolean;
  isConversationLogsOpen?: boolean;
  sessions: SessionItem[];
  language: "es-ES" | "en-US";
}

export interface ConversationLogItem {
  id: string;
  timestamp: number;
  formattedTime: string;
  speaker: "user" | "cortex";
  agentName?: string;
  agentColor?: string;
  agentId?: string;
  text: string;
  intent?: string;
  actionDispatched?: VoiceAction;
  latencyMs?: number;
  engine?: "gemini-flash" | "smart-engine" | "vad-direct";
  confidence?: number;
  moderationStatus?: "approved" | "flagged" | "reviewed";
  moderationTags?: string[];
  userFeedback?: "thumbs_up" | "thumbs_down" | null;
}

export interface IntegrationItem {
  id: string;
  name: string;
  category: "google_workspace" | "composio_dev";
  description: string;
  descriptionEs: string;
  iconName: string;
  connected: boolean;
  authStatus: "ready" | "connecting" | "unlinked";
  scopes: string[];
  actionsCount: number;
  lastSync?: string;
  provider: "Google Suite" | "Composio";
}

export interface BehaviorModerationPolicy {
  autoClosePopupsOnSelect: boolean;
  voiceFirstStrictReturn: boolean;
  verbosityLevel: "concise" | "balanced" | "detailed";
  proactiveSessionMatch: boolean;
  safetyFilterEnabled: boolean;
  languageEnforceStrict: boolean;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  timestamp: number;
}

export interface AudioVisuals {
  volume: number; // 0 to 1
  frequency: number; // 0 to 1
  rawWaveform: Float32Array;
}

export interface RealtimeTransition {
  id: string;
  fromState: string;
  toState: string;
  timestamp: number;
  timeFormatted: string;
  durationMs?: number;
  trigger: "MIC_START" | "VAD_ENERGY" | "VAD_SILENCE" | "VAD_PAUSE" | "VAD_DISMISSED" | "BARGE_IN" | "STREAM_START" | "TTS_CHUNK" | "TTS_COMPLETE" | "AUTO_RESUME" | "MANUAL" | "AUDIO_CHUNK";
  details?: string;
}

export interface VadTelemetry {
  timestamp: number;
  micEnergy: number; // 0 to 1
  peakEnergy: number;
  speechEnergyThreshold: number;
  isUserSpeaking: boolean;
  voiceConfirmed: boolean; // Confirmed human voice vs environmental noise
  speechConfidence: number; // 0 to 1 confidence score of speech vs noise
  noiseFilteredCount: number; // Count of transient noises prevented from interrupting
  silenceElapsedMs: number;
  silenceThresholdMs: number;
  lastCapturedText: string;
  chunkCount: number;
  totalBytesRecorded: number;
  isListening: boolean;
  isSpeaking: boolean;
  speechRecognitionActive: boolean;
  frequencyBands: {
    low: number; // bass / voice fundamental
    mid: number; // formants (human voice band 300-3000Hz)
    high: number; // fricatives / noise
  };
  triggerReason?: string;
  silenceStatusSummary: string;
  currentTransitionStage?: "idle" | "listening" | "speech_active" | "silence_countdown" | "thinking_ttft" | "speaking_split";
  lastTransition?: RealtimeTransition;
  transitionHistory?: RealtimeTransition[];
  pipelineLatencyMs?: {
    vadToTrigger?: number;
    triggerToFirstToken?: number;
    ttsChunkDelay?: number;
  };
}

export interface VadLogItem {
  id: string;
  timestamp: string;
  category: "VAD" | "AUDIO_CHUNK" | "SPEECH_REC" | "STREAM_SSE" | "TRIGGER" | "BARGE_IN" | "STATE" | "TRANSITION" | "NOISE_FILTER" | "TTS_QUEUE";
  level: "info" | "success" | "warn" | "error";
  message: string;
  meta?: Record<string, any>;
}

export interface OrbColorPalette {
  id: string;
  name: string;
  nameEs: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  glowHex: string;
  description: string;
  descriptionEs: string;
  colorA: [number, number, number];
  colorB: [number, number, number];
  colorC: [number, number, number];
  colorD: [number, number, number];
  highlightColor: [number, number, number];
  glowColor: [number, number, number];
}

export interface UserPreferences {
  orbPresetId: string;
  customPrimaryColor: string;
  customSecondaryColor: string;
  customGlowColor: string;
  glowIntensity: number;
  speedMultiplier: number;
  fluidReactivity: number;
  glassRefraction: boolean;
  soundEffects: boolean;
}
