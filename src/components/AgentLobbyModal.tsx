import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Bot,
  Cpu,
  PenTool,
  BarChart2,
  Plus,
  Volume2,
  VolumeX,
  Check,
  Trash2,
  Edit2,
  Play,
  Square,
  ArrowRight,
  Shield,
  Layers,
  Palette,
  Mic,
  Sliders,
  X,
  Compass,
  RotateCcw,
  MessageSquare,
  Globe,
  Wand2,
  Music,
  Activity,
  UserCheck,
  Zap,
} from "lucide-react";
import { AgentItem, AgentThemeConfig, AgentVoiceConfig } from "../types";
import { AgentStore } from "../lib/agentStore";
import { SessionStore } from "../lib/sessionStore";
import { ORB_PRESETS } from "../lib/preferencesStore";
import { voiceEngine, soundFx } from "../lib/audioManager";

interface AgentLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents?: AgentItem[];
  activeAgentId: string;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent?: (agent: Partial<AgentItem>) => void;
  onUpdateAgent?: (id: string, updates: Partial<AgentItem>) => void;
  onDeleteAgent?: (id: string) => void;
  onAuditionVoice?: (voice: Partial<AgentVoiceConfig>) => void;
  onReturnToLobby?: () => void;
  language?: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Sparkles: <Sparkles className="w-5 h-5" />,
  Bot: <Bot className="w-5 h-5" />,
  Cpu: <Cpu className="w-5 h-5" />,
  PenTool: <PenTool className="w-5 h-5" />,
  BarChart2: <BarChart2 className="w-5 h-5" />,
  Shield: <Shield className="w-5 h-5" />,
  Zap: <Zap className="w-5 h-5" />,
};

interface VoiceArchetype {
  id: string;
  name: string;
  timbreLabel: string;
  description: string;
  icon: string;
  pitch: number;
  rate: number;
  samplePhraseEs: string;
  samplePhraseEn: string;
  tag: string;
}

const VOICE_ARCHETYPES: VoiceArchetype[] = [
  {
    id: "cortex-balanced",
    name: "Cortex Neuronal",
    timbreLabel: "Equilibrada & Neuronal",
    description: "Voz natural balanceada con dicción clara de alta fidelidad.",
    icon: "🧠",
    pitch: 1.0,
    rate: 1.02,
    samplePhraseEs: "Hola, soy tu asistente neural. Todos los canales y subsistemas están operativos.",
    samplePhraseEn: "Hello, I am your neural assistant. All channels and subsystems are fully operational.",
    tag: "Estándar",
  },
  {
    id: "analytical-sharp",
    name: "Analítica & Precisa",
    timbreLabel: "Analítica & Firme",
    description: "Cadencia ágil, tono sobrio y firme, ideal para código, datos y finanzas.",
    icon: "⚡",
    pitch: 0.92,
    rate: 1.08,
    samplePhraseEs: "Análisis completado: patrones detectados con un 99.8% de precisión en los registros.",
    samplePhraseEn: "Analysis complete: telemetry patterns detected with 99.8% confidence in the records.",
    tag: "Técnica",
  },
  {
    id: "authoritative-deep",
    name: "Autoritaria & Formal",
    timbreLabel: "Grave & Solemne",
    description: "Tono bajo y profundo, ritmo reposado para seguridad y decisiones críticas.",
    icon: "🛡️",
    pitch: 0.82,
    rate: 0.94,
    samplePhraseEs: "Protocolo verificado. Las directivas de seguridad se ejecutan con estricto aislamiento.",
    samplePhraseEn: "Protocol verified. Security directives are executing with strict context isolation.",
    tag: "Solemne",
  },
  {
    id: "warm-empathic",
    name: "Cálida & Cercana",
    timbreLabel: "Cálida & Melódica",
    description: "Tono agradable y cadencia suave, ideal para asistencia general y creatividad.",
    icon: "✨",
    pitch: 1.08,
    rate: 0.98,
    samplePhraseEs: "¡Hola! Estoy aquí para acompañarte y resolver cualquier duda paso a paso.",
    samplePhraseEn: "Hello there! I am right here with you to work through any challenges together.",
    tag: "Empática",
  },
  {
    id: "dynamic-energetic",
    name: "Enérgica & Rápida",
    timbreLabel: "Enérgica & Brillante",
    description: "Ritmo dinámico y brillante para lluvia de ideas, innovación y productividad.",
    icon: "🚀",
    pitch: 1.14,
    rate: 1.15,
    samplePhraseEs: "¡Excelente idea! Iniciemos el sprint de desarrollo de inmediato.",
    samplePhraseEn: "Great concept! Let's kick off the development sprint without delay.",
    tag: "Ágil",
  },
  {
    id: "zen-reflective",
    name: "Calma & Zen",
    timbreLabel: "Pausada & Serena",
    description: "Cadencia pausada y frecuencia baja para concentración profunda.",
    icon: "🧘",
    pitch: 0.88,
    rate: 0.88,
    samplePhraseEs: "Respira hondo. Analicemos este problema con calma y claridad paso a paso.",
    samplePhraseEn: "Take a breath. Let us examine this challenge with calmness and clarity.",
    tag: "Reflexiva",
  },
  {
    id: "cyber-synth",
    name: "Cibernética / Sci-Fi",
    timbreLabel: "Sintetizador Sci-Fi",
    description: "Tono agudo y sintético con estética de interfaz espacial futurista.",
    icon: "🤖",
    pitch: 1.25,
    rate: 1.05,
    samplePhraseEs: "Núcleo cibernético en línea. Secuencia de procesamiento neuronal lista.",
    samplePhraseEn: "Cybernetic core online. Neural computation sequence initialized.",
    tag: "Futurista",
  },
  {
    id: "elegant-articulate",
    name: "Elegante & Articulada",
    timbreLabel: "Elegante & Clara",
    description: "Dicción refinada con timbre balanceado para consultoría y presentaciones.",
    icon: "💎",
    pitch: 0.96,
    rate: 0.96,
    samplePhraseEs: "Bienvenido. He estructurado la propuesta para su revisión ejecutiva.",
    samplePhraseEn: "Welcome. I have prepared the structured brief for your executive review.",
    tag: "Ejecutiva",
  },
];

const PRESET_SAMPLE_PHRASES = [
  { label: "Saludo & Presentación", textEs: "Hola, soy tu agente especializado. Mi voz está calibrada y lista.", textEn: "Hello, I am your specialized agent. My voice profile is calibrated and ready." },
  { label: "Análisis Técnico", textEs: "He analizado los parámetros del sistema. El rendimiento es óptimo.", textEn: "I have analyzed system parameters. Performance metrics are optimal." },
  { label: "Confirmación Rápida", textEs: "Comando recibido y procesado con éxito.", textEn: "Command received and executed successfully." },
  { label: "Orientación y Ayuda", textEs: "¿En qué te gustaría que nos enfoquemos en esta sesión?", textEn: "What would you like us to focus on in this session?" },
];

export const AgentLobbyModal: React.FC<AgentLobbyModalProps> = ({
  isOpen,
  onClose,
  activeAgentId,
  onSelectAgent,
  onCreateAgent,
  onUpdateAgent,
  onDeleteAgent,
  onAuditionVoice,
  language = "es-ES",
}) => {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isAuditioning, setIsAuditioning] = useState(false);
  const [activeVoiceFilter, setActiveVoiceFilter] = useState<"es" | "en" | "all">("es");
  const [customAuditionText, setCustomAuditionText] = useState("");
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string>("cortex-balanced");

  // Create Form state
  const [formName, setFormName] = useState("");
  const [formTagline, setFormTagline] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSystemPrompt, setFormSystemPrompt] = useState("");
  const [formAvatarIcon, setFormAvatarIcon] = useState("Bot");
  const [formPresetId, setFormPresetId] = useState("cyan-cyber");
  const [formVoiceName, setFormVoiceName] = useState("default");
  const [formPitch, setFormPitch] = useState(1.0);
  const [formRate, setFormRate] = useState(1.02);
  const [formTimbreLabel, setFormTimbreLabel] = useState("Equilibrada & Neuronal");
  const [formLang, setFormLang] = useState("es-ES");

  // Edit Form state
  const [editName, setEditName] = useState("");
  const [editTagline, setEditTagline] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [editAvatarIcon, setEditAvatarIcon] = useState("Bot");
  const [editPresetId, setEditPresetId] = useState("cyan-cyber");
  const [editVoiceName, setEditVoiceName] = useState("default");
  const [editPitch, setEditPitch] = useState(1.0);
  const [editRate, setEditRate] = useState(1.02);
  const [editTimbreLabel, setEditTimbreLabel] = useState("Equilibrada & Neuronal");
  const [editLang, setEditLang] = useState("es-ES");

  const isEs = language.startsWith("es");

  useEffect(() => {
    const list = AgentStore.getAgents();
    setAgents(list);
    const active = list.find((a) => a.id === activeAgentId) || list[0];
    setSelectedAgent(active);

    const unsubscribe = AgentStore.subscribe((updated) => {
      setAgents(updated);
      if (selectedAgent) {
        const stillThere = updated.find((a) => a.id === selectedAgent.id);
        if (stillThere) {
          setSelectedAgent(stillThere);
        } else {
          setSelectedAgent(updated[0]);
        }
      }
    });

    const loadVoices = () => {
      const v = voiceEngine.getAvailableVoices();
      setAvailableVoices(v);
    };
    loadVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      unsubscribe();
    };
  }, [activeAgentId, isOpen]);

  // Filter available TTS voices based on selected language tab
  const filteredVoices = useMemo(() => {
    if (activeVoiceFilter === "es") {
      return availableVoices.filter(
        (v) =>
          v.lang.toLowerCase().startsWith("es") ||
          v.name.toLowerCase().includes("spanish") ||
          v.name.toLowerCase().includes("español")
      );
    }
    if (activeVoiceFilter === "en") {
      return availableVoices.filter(
        (v) =>
          v.lang.toLowerCase().startsWith("en") ||
          v.name.toLowerCase().includes("english")
      );
    }
    return availableVoices;
  }, [availableVoices, activeVoiceFilter]);

  const handleAudition = async (
    voiceConfig: Partial<AgentVoiceConfig>,
    agentName: string,
    sampleText?: string
  ) => {
    setIsAuditioning(true);
    soundFx.playHover();
    const textToSpeak =
      sampleText ||
      customAuditionText.trim() ||
      (isEs
        ? `Hola, soy ${agentName}. Mi perfil de voz y timbre están configurados a tu medida.`
        : `Hello, I am ${agentName}. My voice profile is calibrated and ready.`);

    try {
      if (onAuditionVoice) {
        onAuditionVoice(voiceConfig);
      } else {
        await voiceEngine.auditionVoice(voiceConfig, textToSpeak);
      }
    } finally {
      setIsAuditioning(false);
    }
  };

  const applyArchetypeToForm = (arch: VoiceArchetype, isEditMode: boolean) => {
    setSelectedArchetypeId(arch.id);
    soundFx.playHover();
    if (isEditMode) {
      setEditPitch(arch.pitch);
      setEditRate(arch.rate);
      setEditTimbreLabel(arch.timbreLabel);
    } else {
      setFormPitch(arch.pitch);
      setFormRate(arch.rate);
      setFormTimbreLabel(arch.timbreLabel);
    }
  };

  const handleStartEdit = (agent: AgentItem) => {
    setIsEditing(true);
    setIsCreating(false);
    setEditName(agent.name);
    setEditTagline(agent.tagline);
    setEditDescription(agent.description || "");
    setEditSystemPrompt(agent.systemPrompt || "");
    setEditAvatarIcon(agent.avatarIcon || "Bot");
    setEditPresetId(agent.theme.presetId);
    setEditVoiceName(agent.voice.voiceName || "default");
    setEditPitch(agent.voice.pitch ?? 1.0);
    setEditRate(agent.voice.rate ?? 1.02);
    setEditTimbreLabel(agent.voice.timbreLabel || "Personalizada");
    setEditLang(agent.voice.lang || "es-ES");

    // Match closest archetype
    const match = VOICE_ARCHETYPES.find(
      (a) => Math.abs(a.pitch - (agent.voice.pitch ?? 1.0)) < 0.05 && Math.abs(a.rate - (agent.voice.rate ?? 1.02)) < 0.05
    );
    if (match) setSelectedArchetypeId(match.id);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent || !editName.trim()) return;

    const preset = ORB_PRESETS.find((p) => p.id === editPresetId) || ORB_PRESETS[0];

    const updates: Partial<AgentItem> = {
      name: editName.trim(),
      tagline: editTagline.trim(),
      description: editDescription.trim(),
      systemPrompt: editSystemPrompt.trim(),
      avatarIcon: editAvatarIcon,
      theme: {
        presetId: preset.id,
        primaryHex: preset.primaryHex,
        secondaryHex: preset.secondaryHex,
        glowHex: preset.glowHex,
      },
      voice: {
        voiceName: editVoiceName,
        pitch: editPitch,
        rate: editRate,
        lang: editLang,
        timbreLabel: editTimbreLabel,
      },
    };

    if (onUpdateAgent) {
      onUpdateAgent(selectedAgent.id, updates);
    } else {
      AgentStore.updateAgent(selectedAgent.id, updates);
    }

    const updated = AgentStore.getAgents().find((a) => a.id === selectedAgent.id);
    if (updated) setSelectedAgent(updated);
    setIsEditing(false);
    soundFx.playComplete();
  };

  const handleCreateAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const preset = ORB_PRESETS.find((p) => p.id === formPresetId) || ORB_PRESETS[0];

    const newAgentData = {
      name: formName.trim(),
      tagline: formTagline.trim() || `Especialista en ${formName.trim()}`,
      description: formDescription.trim() || `Agente especializado creado en el Lobby de Cortex.`,
      systemPrompt: formSystemPrompt.trim(),
      avatarIcon: formAvatarIcon,
      presetId: preset.id,
      primaryHex: preset.primaryHex,
      secondaryHex: preset.secondaryHex,
      glowHex: preset.glowHex,
      voice: {
        voiceName: formVoiceName,
        pitch: formPitch,
        rate: formRate,
        lang: formLang,
        timbreLabel: formTimbreLabel,
      },
    };

    let created: AgentItem;
    if (onCreateAgent) {
      created = onCreateAgent(newAgentData) as any;
    } else {
      created = AgentStore.createAgent(newAgentData);
    }

    setIsCreating(false);
    setSelectedAgent(created || AgentStore.getAgents().slice(-1)[0]);
    setFormName("");
    setFormTagline("");
    setFormDescription("");
    setFormSystemPrompt("");
    soundFx.playWake();
  };

  const handleDelete = (agent: AgentItem) => {
    if (agent.isPrimary) return;
    if (confirm(isEs ? `¿Estás seguro de eliminar el agente "${agent.name}"?` : `Delete agent "${agent.name}"?`)) {
      if (onDeleteAgent) {
        onDeleteAgent(agent.id);
      } else {
        AgentStore.deleteAgent(agent.id);
      }
      setSelectedAgent(AgentStore.getPrimaryAgent());
      soundFx.playComplete();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="agent-lobby-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-lg animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="agent-lobby-modal-container"
        className="relative w-full max-w-5xl h-[90vh] bg-[#0a0f18] border border-cyan-500/25 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden text-slate-100 font-sans"
      >
        {/* Header */}
        <div
          id="agent-lobby-header"
          className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/70"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  {isEs ? "Lobby & Configuración de Agentes" : "Agent Lobby & Voice Studio"}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono font-semibold">
                  CORTEX MULTI-AGENT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isEs
                  ? "Crea y personaliza agentes con perfiles de voz avanzados, timbres acústicos y aislamiento de contexto."
                  : "Create and customize agents with advanced neural voice profiles, acoustic timbres, and isolated contexts."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCreating && (
              <button
                id="btn-open-create-agent"
                onClick={() => {
                  setIsCreating(true);
                  setIsEditing(false);
                  soundFx.playWake();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shadow-lg shadow-cyan-600/25"
              >
                <Plus className="w-4 h-4" />
                <span>{isEs ? "Nuevo Agente" : "New Agent"}</span>
              </button>
            )}
            <button
              id="btn-close-lobby-modal"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
              title={isEs ? "Cerrar" : "Close"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Layout: Left Sidebar / Right Studio Config */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Column: Agents List */}
          <div
            id="agent-lobby-list"
            className="md:col-span-4 border-r border-slate-800/80 bg-slate-950/60 p-3.5 flex flex-col gap-2 overflow-y-auto"
          >
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-2 mb-1 flex items-center justify-between">
              <span>{isEs ? `Agentes Registrados (${agents.length})` : `Registered Agents (${agents.length})`}</span>
              <span className="text-[9px] text-cyan-400 font-mono">ISOLATED CONTEXT</span>
            </div>

            {agents.map((agent) => {
              const isSelected = selectedAgent?.id === agent.id;
              const isActive = activeAgentId === agent.id;
              const sessionsCount = SessionStore.getSessionsForAgent(agent.id).length;

              return (
                <div
                  key={agent.id}
                  id={`agent-card-${agent.id}`}
                  onClick={() => {
                    setSelectedAgent(agent);
                    setIsCreating(false);
                    setIsEditing(false);
                    soundFx.playHover();
                  }}
                  className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? "bg-slate-800/90 border-cyan-500/60 shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-500/30"
                      : "bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/50 hover:border-slate-700"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 shadow-md"
                    style={{
                      backgroundColor: `${agent.theme.primaryHex}20`,
                      border: `1px solid ${agent.theme.primaryHex}60`,
                      color: agent.theme.primaryHex,
                    }}
                  >
                    {ICON_MAP[agent.avatarIcon] || <Bot className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-xs sm:text-sm text-slate-100 truncate">{agent.name}</span>
                        {agent.isPrimary && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono uppercase font-bold">
                            Lobby
                          </span>
                        )}
                      </div>
                      {isActive && (
                        <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {isEs ? "Activo" : "Active"}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{agent.tagline}</p>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 flex items-center gap-1 border border-slate-700/50">
                        <Layers className="w-2.5 h-2.5 text-cyan-400" />
                        {sessionsCount} {sessionsCount === 1 ? (isEs ? "sesión" : "session") : (isEs ? "sesiones" : "sessions")}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300/80 truncate flex items-center gap-1 border border-slate-700/50">
                        <Volume2 className="w-2.5 h-2.5 text-cyan-400" />
                        {agent.voice.timbreLabel || `${agent.voice.pitch}x • ${agent.voice.rate}x`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Creation Form / Edit Form / Selected Agent Details */}
          <div
            id="agent-lobby-detail-view"
            className="md:col-span-8 p-5 sm:p-6 overflow-y-auto bg-slate-900/30 flex flex-col justify-between"
          >
            {isCreating ? (
              /* ======================= CREATE AGENT FORM ======================= */
              <form onSubmit={handleCreateAgentSubmit} className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">
                        {isEs ? "Crear Nuevo Agente Especialista" : "Create Specialized Agent"}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {isEs
                          ? "Configura identidad, especialidad, paleta visual y perfil acústico de voz."
                          : "Configure identity, specialization, visual theme, and custom acoustic voice profile."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
                  >
                    {isEs ? "Cancelar" : "Cancel"}
                  </button>
                </div>

                {/* Agent Identity Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      {isEs ? "Nombre del Agente" : "Agent Name"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Sophia, Hermes, DataBot, Nexus..."
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      {isEs ? "Rol / Especialidad" : "Role / Specialization"}
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Arquitectura Cloud, Análisis Financiero..."
                      value={formTagline}
                      onChange={(e) => setFormTagline(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      {isEs ? "Descripción del Propósito" : "Purpose Description"}
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Asistente enfocado en revisión de código y testing..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      {isEs ? "Icono del Agente" : "Agent Icon"}
                    </label>
                    <div className="flex gap-2">
                      {["Bot", "Cpu", "Sparkles", "PenTool", "BarChart2", "Shield", "Zap"].map((iconKey) => (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setFormAvatarIcon(iconKey)}
                          className={`p-2 rounded-lg border transition ${
                            formAvatarIcon === iconKey
                              ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          {ICON_MAP[iconKey] || <Bot className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {isEs ? "Prompt del Sistema / Personalidad" : "System Prompt / Personality"}
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Instrucciones sobre su estilo, tono de respuesta y directivas principales..."
                    value={formSystemPrompt}
                    onChange={(e) => setFormSystemPrompt(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Visual Theme */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isEs ? "Color y Shader Reactivo" : "Color & Reactive Shader"}</span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {ORB_PRESETS.map((p) => {
                      const isSel = formPresetId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setFormPresetId(p.id)}
                          className={`p-1.5 rounded-lg border flex flex-col items-center gap-1 transition ${
                            isSel ? "border-cyan-400 bg-cyan-950/40" : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{
                              background: `linear-gradient(135deg, ${p.primaryHex}, ${p.secondaryHex})`,
                              boxShadow: `0 0 6px ${p.glowHex}80`,
                            }}
                          />
                          <span className="text-[9px] text-slate-300 truncate w-full text-center">{p.name.split(" ")[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Advanced Voice Options Section */}
                <div className="p-4 rounded-xl bg-slate-950/90 border border-cyan-500/20 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-white tracking-wide">
                        {isEs ? "Opciones y Calibración de Voz" : "Voice Options & Calibration"}
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                      {formTimbreLabel}
                    </span>
                  </div>

                  {/* Archetype Quick Pickers */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                      {isEs ? "Estilos / Arquetipos de Voz Preconfigurados" : "Pre-tuned Voice Styles & Archetypes"}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {VOICE_ARCHETYPES.map((arch) => {
                        const isSel = selectedArchetypeId === arch.id;
                        return (
                          <button
                            key={arch.id}
                            type="button"
                            onClick={() => applyArchetypeToForm(arch, false)}
                            className={`p-2 rounded-lg border text-left transition flex flex-col justify-between ${
                              isSel
                                ? "bg-cyan-950/50 border-cyan-400 text-cyan-200 ring-1 ring-cyan-500/40"
                                : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm">{arch.icon}</span>
                              <span className="text-[8px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                {arch.tag}
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-white truncate">{arch.name}</div>
                            <div className="text-[9px] text-slate-400 truncate">{arch.timbreLabel}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* System Voice Selection & Filters */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-cyan-400" />
                        <span>{isEs ? "Motor de Voz del Sistema" : "System TTS Voice Engine"}</span>
                      </span>
                      <div className="flex gap-1 text-[9px]">
                        <button
                          type="button"
                          onClick={() => setActiveVoiceFilter("es")}
                          className={`px-2 py-0.5 rounded transition ${
                            activeVoiceFilter === "es" ? "bg-cyan-600 text-white font-bold" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          🇪🇸 Español
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveVoiceFilter("en")}
                          className={`px-2 py-0.5 rounded transition ${
                            activeVoiceFilter === "en" ? "bg-cyan-600 text-white font-bold" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          🇺🇸 English
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveVoiceFilter("all")}
                          className={`px-2 py-0.5 rounded transition ${
                            activeVoiceFilter === "all" ? "bg-cyan-600 text-white font-bold" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          🌐 Todas ({availableVoices.length})
                        </button>
                      </div>
                    </div>

                    <select
                      value={formVoiceName}
                      onChange={(e) => setFormVoiceName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="default">
                        {isEs ? "⚡ Voz Predeterminada Inteligente" : "⚡ Intelligent Default Voice"}
                      </option>
                      {filteredVoices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.lang}) {v.localService ? "• Local" : "• Cloud"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sliders: Pitch, Rate & Timbre Tag */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                        <span>{isEs ? "Tono (Frecuencia)" : "Pitch"}</span>
                        <span className="font-mono text-cyan-400 font-bold">{formPitch.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.6"
                        max="1.5"
                        step="0.05"
                        value={formPitch}
                        onChange={(e) => setFormPitch(parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                      <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-0.5">
                        <span>{isEs ? "Grave (0.6x)" : "Deep"}</span>
                        <span>{isEs ? "Natural (1.0x)" : "Normal"}</span>
                        <span>{isEs ? "Agudo (1.5x)" : "High"}</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                        <span>{isEs ? "Velocidad (Cadencia)" : "Speaking Rate"}</span>
                        <span className="font-mono text-cyan-400 font-bold">{formRate.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.7"
                        max="1.4"
                        step="0.05"
                        value={formRate}
                        onChange={(e) => setFormRate(parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                      <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-0.5">
                        <span>{isEs ? "Pausado (0.7x)" : "Slow"}</span>
                        <span>{isEs ? "Estándar (1.0x)" : "Standard"}</span>
                        <span>{isEs ? "Rápido (1.4x)" : "Fast"}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-300 block mb-1">
                        {isEs ? "Etiqueta de Timbre" : "Timbre Label"}
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Grave & Solemne, Enérgica..."
                        value={formTimbreLabel}
                        onChange={(e) => setFormTimbreLabel(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Audition Bar */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-400">
                      {isEs ? "Prueba cómo suena esta combinación en tiempo real:" : "Test how this configuration sounds in real time:"}
                    </span>
                    <button
                      type="button"
                      disabled={isAuditioning}
                      onClick={() =>
                        handleAudition(
                          {
                            voiceName: formVoiceName,
                            pitch: formPitch,
                            rate: formRate,
                            lang: formLang,
                            timbreLabel: formTimbreLabel,
                          },
                          formName || "Nuevo Agente"
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-300 text-xs font-semibold transition shadow-sm"
                    >
                      {isAuditioning ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>{isAuditioning ? (isEs ? "Reproduciendo..." : "Playing...") : (isEs ? "Probar Voz" : "Audition Voice")}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
                  >
                    {isEs ? "Cancelar" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isEs ? "Guardar y Registrar Agente" : "Save & Register Agent"}</span>
                  </button>
                </div>
              </form>
            ) : isEditing && selectedAgent ? (
              /* ======================= EDIT AGENT FORM (EXPANDED VOICE OPTIONS) ======================= */
              <form onSubmit={handleSaveEdit} className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Edit2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">
                        {isEs ? `Editar Propiedades & Voz: ${selectedAgent.name}` : `Edit Properties & Voice: ${selectedAgent.name}`}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {isEs
                          ? "Modifica rol, prompt de sistema, color reactivo y personaliza el perfil completo de voz."
                          : "Modify role, system prompt, reactive color, and customize full acoustic voice profile."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
                  >
                    {isEs ? "Cancelar" : "Cancel"}
                  </button>
                </div>

                {/* Main details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      {isEs ? "Nombre del Agente" : "Agent Name"}
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      {isEs ? "Rol / Especialidad" : "Specialization"}
                    </label>
                    <input
                      type="text"
                      value={editTagline}
                      onChange={(e) => setEditTagline(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      {isEs ? "Descripción Breve" : "Brief Description"}
                    </label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      {isEs ? "Icono del Agente" : "Icon"}
                    </label>
                    <div className="flex gap-2">
                      {["Bot", "Cpu", "Sparkles", "PenTool", "BarChart2", "Shield", "Zap"].map((iconKey) => (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setEditAvatarIcon(iconKey)}
                          className={`p-1.5 rounded-lg border transition ${
                            editAvatarIcon === iconKey
                              ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          {ICON_MAP[iconKey] || <Bot className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {isEs ? "Directiva / Prompt de Sistema" : "System Directive"}
                  </label>
                  <textarea
                    rows={2}
                    value={editSystemPrompt}
                    onChange={(e) => setEditSystemPrompt(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none resize-none font-sans"
                  />
                </div>

                {/* Color Theme Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isEs ? "Paleta Visual y Shader Reactivo" : "Visual Palette"}</span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {ORB_PRESETS.map((p) => {
                      const isSel = editPresetId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setEditPresetId(p.id)}
                          className={`p-1.5 rounded-lg border flex flex-col items-center gap-1 transition ${
                            isSel ? "border-cyan-400 bg-cyan-950/40" : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{
                              background: `linear-gradient(135deg, ${p.primaryHex}, ${p.secondaryHex})`,
                              boxShadow: `0 0 6px ${p.glowHex}80`,
                            }}
                          />
                          <span className="text-[9px] text-slate-300 truncate w-full text-center">{p.name.split(" ")[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* COMPREHENSIVE VOICE CONFIGURATION SUITE IN EDIT MODE */}
                <div className="p-4 rounded-xl bg-slate-950/90 border border-cyan-500/30 space-y-3.5 shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-white tracking-wide">
                        {isEs ? "Opciones y Calibración Avanzada de Voz" : "Advanced Voice Options & Acoustic Studio"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-semibold">
                        {editTimbreLabel}
                      </span>
                    </div>
                  </div>

                  {/* Archetype Quick Buttons */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 flex items-center justify-between">
                      <span>{isEs ? "1. Selecciona un Estilo / Arquetipo de Voz Base:" : "1. Select a Base Voice Style / Archetype:"}</span>
                      <span className="text-[9px] text-slate-400 font-normal">
                        {isEs ? "Aplica tono y velocidad ideales al instante" : "Instantly applies ideal pitch & rate"}
                      </span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {VOICE_ARCHETYPES.map((arch) => {
                        const isSel = selectedArchetypeId === arch.id;
                        return (
                          <button
                            key={arch.id}
                            type="button"
                            onClick={() => applyArchetypeToForm(arch, true)}
                            className={`p-2 rounded-lg border text-left transition flex flex-col justify-between ${
                              isSel
                                ? "bg-cyan-950/60 border-cyan-400 text-cyan-200 ring-1 ring-cyan-500/40"
                                : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm">{arch.icon}</span>
                              <span className="text-[8px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                {arch.tag}
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-white truncate">{arch.name}</div>
                            <div className="text-[9px] text-slate-400 truncate">{arch.timbreLabel}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Voice Engine & Language Filter */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-cyan-400" />
                        <span>{isEs ? "2. Motor de Voz del Dispositivo (TTS)" : "2. System TTS Voice Engine"}</span>
                      </span>
                      <div className="flex gap-1 text-[9px]">
                        <button
                          type="button"
                          onClick={() => setActiveVoiceFilter("es")}
                          className={`px-2 py-0.5 rounded transition ${
                            activeVoiceFilter === "es" ? "bg-cyan-600 text-white font-bold" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          🇪🇸 Español
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveVoiceFilter("en")}
                          className={`px-2 py-0.5 rounded transition ${
                            activeVoiceFilter === "en" ? "bg-cyan-600 text-white font-bold" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          🇺🇸 English
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveVoiceFilter("all")}
                          className={`px-2 py-0.5 rounded transition ${
                            activeVoiceFilter === "all" ? "bg-cyan-600 text-white font-bold" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          🌐 Todas ({availableVoices.length})
                        </button>
                      </div>
                    </div>

                    <select
                      value={editVoiceName}
                      onChange={(e) => setEditVoiceName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="default">
                        {isEs ? "⚡ Voz Inteligente Predeterminada (Óptima)" : "⚡ Intelligent Default Voice"}
                      </option>
                      {filteredVoices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.lang}) {v.localService ? "• Local" : "• Cloud"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sliders: Fine Pitch & Rate Tuning */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                        <span>{isEs ? "Tono (Pitch / Altura)" : "Pitch"}</span>
                        <span className="font-mono text-cyan-400 font-bold">{editPitch.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.6"
                        max="1.5"
                        step="0.05"
                        value={editPitch}
                        onChange={(e) => setEditPitch(parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                      <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-0.5">
                        <span>{isEs ? "Grave (0.6x)" : "Deep"}</span>
                        <span>{isEs ? "Normal (1.0x)" : "Normal"}</span>
                        <span>{isEs ? "Agudo (1.5x)" : "High"}</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                        <span>{isEs ? "Velocidad (Cadencia)" : "Speed / Rate"}</span>
                        <span className="font-mono text-cyan-400 font-bold">{editRate.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.7"
                        max="1.4"
                        step="0.05"
                        value={editRate}
                        onChange={(e) => setEditRate(parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                      <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-0.5">
                        <span>{isEs ? "Pausado (0.7x)" : "Slow"}</span>
                        <span>{isEs ? "Normal (1.0x)" : "Normal"}</span>
                        <span>{isEs ? "Rápido (1.4x)" : "Fast"}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-300 block mb-1">
                        {isEs ? "Etiqueta Personalizada de Timbre" : "Custom Timbre Tag"}
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Grave & Solemne, Dinámica..."
                        value={editTimbreLabel}
                        onChange={(e) => setEditTimbreLabel(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Sample Phrases & Live Audition Input */}
                  <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-cyan-400" />
                        <span>{isEs ? "Frases de Prueba Rápida:" : "Quick Test Phrases:"}</span>
                      </span>
                      <button
                        type="button"
                        disabled={isAuditioning}
                        onClick={() =>
                          handleAudition(
                            {
                              voiceName: editVoiceName,
                              pitch: editPitch,
                              rate: editRate,
                              lang: editLang,
                              timbreLabel: editTimbreLabel,
                            },
                            editName || selectedAgent.name
                          )
                        }
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600/40 hover:bg-cyan-600/60 border border-cyan-500/50 text-cyan-300 text-xs font-bold transition shadow-sm"
                      >
                        {isAuditioning ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        <span>{isAuditioning ? (isEs ? "Reproduciendo..." : "Playing...") : (isEs ? "Probar Voz en Vivo" : "Live Voice Test")}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_SAMPLE_PHRASES.map((ph, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const text = isEs ? ph.textEs : ph.textEn;
                            setCustomAuditionText(text);
                            handleAudition(
                              {
                                voiceName: editVoiceName,
                                pitch: editPitch,
                                rate: editRate,
                                lang: editLang,
                                timbreLabel: editTimbreLabel,
                              },
                              editName || selectedAgent.name,
                              text
                            );
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 transition"
                        >
                          {ph.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      placeholder={isEs ? "O escribe cualquier frase personalizada para audicionar..." : "Or type any custom test sentence here..."}
                      value={customAuditionText}
                      onChange={(e) => setCustomAuditionText(e.target.value)}
                      className="w-full px-2.5 py-1 text-[11px] rounded bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
                  >
                    {isEs ? "Cancelar" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isEs ? "Guardar Todos los Cambios" : "Save All Changes"}</span>
                  </button>
                </div>
              </form>
            ) : selectedAgent ? (
              /* ======================= SELECTED AGENT DETAIL VIEW ======================= */
              <div className="space-y-4 animate-fade-in">
                {/* Agent Header Banner */}
                <div
                  className="p-5 rounded-2xl border relative overflow-hidden flex flex-col gap-3"
                  style={{
                    backgroundColor: `${selectedAgent.theme.primaryHex}12`,
                    borderColor: `${selectedAgent.theme.primaryHex}45`,
                  }}
                >
                  <div
                    className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full blur-3xl opacity-30 pointer-events-none"
                    style={{ backgroundColor: selectedAgent.theme.glowHex }}
                  />

                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg"
                        style={{
                          backgroundColor: `${selectedAgent.theme.primaryHex}25`,
                          border: `1px solid ${selectedAgent.theme.primaryHex}80`,
                          color: selectedAgent.theme.primaryHex,
                        }}
                      >
                        {ICON_MAP[selectedAgent.avatarIcon] || <Bot className="w-6 h-6" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg sm:text-xl font-bold text-white">{selectedAgent.name}</h3>
                          {selectedAgent.isPrimary ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                              Lobby Central
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                              Especialista Aislado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5 font-medium">{selectedAgent.tagline}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        id={`btn-edit-agent-${selectedAgent.id}`}
                        onClick={() => handleStartEdit(selectedAgent)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 transition text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                        title={isEs ? "Editar todas las propiedades y voz" : "Edit properties and voice"}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{isEs ? "Editar / Ajustar Voz" : "Edit / Voice Options"}</span>
                      </button>

                      {!selectedAgent.isPrimary && (
                        <button
                          onClick={() => handleDelete(selectedAgent)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-900/50 transition text-xs"
                          title={isEs ? "Eliminar Agente" : "Delete Agent"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed relative z-10">{selectedAgent.description}</p>
                </div>

                {/* Voice Profile Card & Instant Audition Studio */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200">
                            {isEs ? "Perfil Acústico de Voz Activo" : "Active Voice Profile"}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                            {selectedAgent.voice.timbreLabel || "Configurada"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {selectedAgent.voice.voiceName === "default" ? "Voz Inteligente por Defecto" : selectedAgent.voice.voiceName} • {isEs ? "Tono" : "Pitch"}: {selectedAgent.voice.pitch}x • {isEs ? "Vel" : "Rate"}: {selectedAgent.voice.rate}x
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(selectedAgent)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
                      >
                        <Sliders className="w-3 h-3 inline mr-1 text-cyan-400" />
                        <span>{isEs ? "Más Opciones" : "More Options"}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isAuditioning}
                        onClick={() => handleAudition(selectedAgent.voice, selectedAgent.name)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-lg shadow-cyan-600/25"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isAuditioning ? (isEs ? "Audicionando..." : "Auditioning...") : (isEs ? "Escuchar Voz" : "Audition Voice")}</span>
                      </button>
                    </div>
                  </div>

                  {/* Archetypes quick preview row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {VOICE_ARCHETYPES.slice(0, 4).map((arch) => (
                      <div
                        key={arch.id}
                        className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[10px]"
                      >
                        <div className="flex items-center gap-1 text-slate-200 font-bold mb-0.5">
                          <span>{arch.icon}</span>
                          <span className="truncate">{arch.name}</span>
                        </div>
                        <div className="text-slate-400 text-[9px] truncate">{arch.timbreLabel}</div>
                      </div>
                    ))}
                  </div>

                  {/* Context Isolation Banner */}
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 text-xs">
                    <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-200">
                        {isEs ? "Aislamiento de Contexto Neural:" : "Isolated Neural Context:"}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {selectedAgent.isPrimary
                          ? isEs
                            ? "Cortex tiene visibilidad del Lobby global y coordina transferencias fluidas entre agentes."
                            : "Cortex has global lobby visibility and orchestrates seamless transitions between agents."
                          : isEs
                            ? `${selectedAgent.name} opera con aislamiento total: sus sesiones, prompts y memorias son privadas e independientes.`
                            : `${selectedAgent.name} operates in total isolation: its sessions, prompts, and memory logs are strictly private.`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Switch Agent Button */}
                <div className="pt-3 flex items-center justify-between border-t border-slate-800/80">
                  <div className="text-xs text-slate-400">
                    {activeAgentId === selectedAgent.id ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        {isEs ? "Agente activo actualmente en tu sesión de voz" : "Currently active agent in your voice session"}
                      </span>
                    ) : (
                      <span>{isEs ? `Transfiere tu conversación y contexto a ${selectedAgent.name}` : `Transfer voice conversation to ${selectedAgent.name}`}</span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      onSelectAgent(selectedAgent.id);
                      onClose();
                    }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-lg ${
                      activeAgentId === selectedAgent.id
                        ? "bg-slate-800 text-slate-300 border border-slate-700"
                        : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30"
                    }`}
                  >
                    <span>
                      {activeAgentId === selectedAgent.id
                        ? isEs ? "Continuar con este Agente" : "Continue with this Agent"
                        : isEs ? `Conectar con ${selectedAgent.name}` : `Connect with ${selectedAgent.name}`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
