import { AgentItem, AgentVoiceConfig, AgentThemeConfig } from "../types";
import { ORB_PRESETS } from "./preferencesStore";

const STORAGE_KEY = "cortex_agents_v1";
const ACTIVE_AGENT_KEY = "cortex_active_agent_id_v1";

export const DEFAULT_AGENTS: AgentItem[] = [
  {
    id: "cortex-main",
    name: "Cortex",
    tagline: "Orquestador del Lobby & IA Central",
    description: "Agente principal del Lobby. Coordina agentes, gestiona sesiones globales, crea nuevos especialistas y atiende cualquier consulta general.",
    systemPrompt: `Eres Cortex, el Agente Principal y Orquestador del Lobby.
Tienes una visión global del sistema y de todos los agentes especializados disponibles.
Tu tono es elegante, profesional, empático y resolutivo.
Puedes gestionar el lobby, presentar a los agentes disponibles, crear nuevos agentes según las necesidades del usuario, o transferir la conversación a un agente especializado cuando el usuario lo solicite.`,
    isPrimary: true,
    avatarIcon: "Sparkles",
    theme: {
      presetId: "cyan-cyber",
      primaryHex: "#06b6d4",
      secondaryHex: "#0284c7",
      glowHex: "#06b6d4",
    },
    voice: {
      voiceName: "default",
      pitch: 1.0,
      rate: 1.02,
      lang: "es-ES",
      timbreLabel: "Serena y Equilibrada",
    },
    tags: ["Lobby", "Orquestador", "Global", "Principal"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
  },
  {
    id: "agent-atlas",
    name: "Atlas",
    tagline: "Arquitecto de Software & Cloud",
    description: "Especialista en desarrollo full-stack, arquitecturas distribuidas, bases de datos, APIs y optimización de rendimiento.",
    systemPrompt: `Eres Atlas, un Agente Especialista en Arquitectura de Software, Cloud y Programación.
Tu enfoque es técnico, preciso, analítico y directo. Proporcionas soluciones de código robustas, mejores prácticas de ingeniería y optimización.
Solo tienes acceso a tus sesiones y proyectos asignados. Si el usuario te pide volver al lobby o hablar con otro agente general, indícale amablemente que regresarán al Lobby con Cortex.`,
    isPrimary: false,
    avatarIcon: "Cpu",
    theme: {
      presetId: "emerald-aurora",
      primaryHex: "#10b981",
      secondaryHex: "#047857",
      glowHex: "#10b981",
    },
    voice: {
      voiceName: "Jorge",
      pitch: 0.88,
      rate: 1.04,
      lang: "es-ES",
      timbreLabel: "Grave y Analítica",
    },
    tags: ["Arquitectura", "TypeScript", "Cloud", "Backend"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
  {
    id: "agent-nova",
    name: "Nova",
    tagline: "Estratega Creativa & Diseño UX",
    description: "Especialista en redacción persuasiva, storytelling de marca, diseño de microinteracciones, arte visual y conceptualización.",
    systemPrompt: `Eres Nova, una Agente Especialista en Creatividad, Diseño de Experiencia de Usuario (UX) y Storytelling.
Tu tono es inspirador, sofisticado, cálido y estéticamente refinado.
Solo tienes acceso a tus sesiones creativas. Si el usuario desea volver al lobby principal, facilítale el retorno con Cortex.`,
    isPrimary: false,
    avatarIcon: "PenTool",
    theme: {
      presetId: "magenta-twilight",
      primaryHex: "#e84cb8",
      secondaryHex: "#8020a0",
      glowHex: "#d946ef",
    },
    voice: {
      voiceName: "Paulina",
      pitch: 1.15,
      rate: 1.0,
      lang: "es-ES",
      timbreLabel: "Cálida y Expresiva",
    },
    tags: ["Diseño", "UX", "Storytelling", "Creatividad"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: "agent-vektor",
    name: "Vektor",
    tagline: "Analista Cuántico & Finanzas",
    description: "Especialista en análisis cuantitativo de métricas, proyecciones financieras, modelos de datos y optimización de recursos.",
    systemPrompt: `Eres Vektor, un Agente Especialista en Análisis de Datos, Métricas y Estrategia Cuantitativa.
Tu tono es dinámico, metódico, enfocado en números, KPIs e impacto medible.
Solo tienes acceso a tus sesiones de análisis. Si el usuario necesita coordinación global, transfórmale al Lobby con Cortex.`,
    isPrimary: false,
    avatarIcon: "BarChart2",
    theme: {
      presetId: "solar-amber",
      primaryHex: "#f59e0b",
      secondaryHex: "#d97706",
      glowHex: "#f59e0b",
    },
    voice: {
      voiceName: "Daniel",
      pitch: 0.95,
      rate: 1.08,
      lang: "es-ES",
      timbreLabel: "Dinámica y Precisa",
    },
    tags: ["Datos", "Finanzas", "Métricas", "KPIs"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 1,
  },
];

export class AgentStore {
  private static listeners: Array<(agents: AgentItem[]) => void> = [];
  private static activeAgentListeners: Array<(agent: AgentItem) => void> = [];

  public static getAgents(): AgentItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: AgentItem[] = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Guarantee primary Cortex exists
          if (!parsed.some((a) => a.isPrimary)) {
            parsed.unshift(DEFAULT_AGENTS[0]);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not read agents from localStorage:", e);
    }
    this.saveAgents(DEFAULT_AGENTS);
    return DEFAULT_AGENTS;
  }

  public static saveAgents(agents: AgentItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
    } catch (e) {
      console.warn("Could not save agents to localStorage:", e);
    }
    this.notifyListeners(agents);
  }

  public static getPrimaryAgent(): AgentItem {
    const agents = this.getAgents();
    return agents.find((a) => a.isPrimary) || DEFAULT_AGENTS[0];
  }

  public static getActiveAgentId(): string {
    try {
      return localStorage.getItem(ACTIVE_AGENT_KEY) || "cortex-main";
    } catch {
      return "cortex-main";
    }
  }

  public static getActiveAgent(): AgentItem {
    const id = this.getActiveAgentId();
    const agents = this.getAgents();
    const found = agents.find((a) => a.id === id);
    return found || this.getPrimaryAgent();
  }

  public static setActiveAgentId(id: string): AgentItem {
    const agents = this.getAgents();
    let target = agents.find((a) => a.id === id);
    if (!target) {
      target = this.getPrimaryAgent();
    }
    try {
      localStorage.setItem(ACTIVE_AGENT_KEY, target.id);
    } catch {}
    this.notifyActiveAgentListeners(target);
    return target;
  }

  public static setActiveAgent(id: string): AgentItem {
    return this.setActiveAgentId(id);
  }

  public static returnToLobby(): AgentItem {
    const primary = this.getPrimaryAgent();
    this.setActiveAgentId(primary.id);
    return primary;
  }

  public static isLobbyActive(): boolean {
    const current = this.getActiveAgent();
    return current.isPrimary || current.id === "cortex-main";
  }

  public static createAgent(params: {
    name: string;
    tagline?: string;
    description?: string;
    systemPrompt?: string;
    presetId?: string;
    primaryHex?: string;
    secondaryHex?: string;
    glowHex?: string;
    avatarIcon?: string;
    voice?: Partial<AgentVoiceConfig>;
    tags?: string[];
  }): AgentItem {
    const agents = this.getAgents();
    const cleanName = params.name.trim();
    const preset = ORB_PRESETS.find((p) => p.id === params.presetId) || ORB_PRESETS[1];

    const theme: AgentThemeConfig = {
      presetId: preset.id,
      primaryHex: params.primaryHex || preset.primaryHex,
      secondaryHex: params.secondaryHex || preset.secondaryHex,
      glowHex: params.glowHex || preset.glowHex,
    };

    const voice: AgentVoiceConfig = {
      voiceName: params.voice?.voiceName || "default",
      pitch: params.voice?.pitch ?? 1.0,
      rate: params.voice?.rate ?? 1.02,
      lang: params.voice?.lang || "es-ES",
      timbreLabel: params.voice?.timbreLabel || "Personalizada",
    };

    const newAgent: AgentItem = {
      id: `agent-${Date.now().toString().slice(-6)}`,
      name: cleanName,
      tagline: params.tagline || `Especialista en ${cleanName}`,
      description: params.description || `Agente especializado configurado a través del Lobby de Cortex.`,
      systemPrompt:
        params.systemPrompt ||
        `Eres ${cleanName}, un agente especialista enfocado en ${params.tagline || cleanName}.
Tu objetivo es brindar respuestas precisas, útiles y de alto valor en tu área de especialidad.
Mantienes tus conversaciones organizadas en tus propias sesiones aisladas.
Si el usuario solicita volver al lobby o hablar con la IA central, confirma y regresa al Lobby con Cortex.`,
      isPrimary: false,
      avatarIcon: params.avatarIcon || "Bot",
      theme,
      voice,
      tags: params.tags && params.tags.length > 0 ? params.tags : ["Especialista", cleanName],
      createdAt: Date.now(),
    };

    const updated = [...agents, newAgent];
    this.saveAgents(updated);
    return newAgent;
  }

  public static updateAgent(id: string, updates: Partial<AgentItem>): AgentItem | null {
    const agents = this.getAgents();
    let updatedAgent: AgentItem | null = null;

    const updated = agents.map((a) => {
      if (a.id === id) {
        // Prevent clearing primary status from Cortex
        const isPrimary = a.isPrimary;
        updatedAgent = {
          ...a,
          ...updates,
          isPrimary,
          theme: updates.theme ? { ...a.theme, ...updates.theme } : a.theme,
          voice: updates.voice ? { ...a.voice, ...updates.voice } : a.voice,
        };
        return updatedAgent;
      }
      return a;
    });

    if (updatedAgent) {
      this.saveAgents(updated);
      if (this.getActiveAgentId() === id) {
        this.notifyActiveAgentListeners(updatedAgent);
      }
    }
    return updatedAgent;
  }

  public static renameAgent(id: string, newName: string): AgentItem | null {
    if (!newName || !newName.trim()) return null;
    return this.updateAgent(id, { name: newName.trim() });
  }

  public static deleteAgent(id: string): { remaining: AgentItem[]; deleted: AgentItem | null } {
    const agents = this.getAgents();
    const target = agents.find((a) => a.id === id);

    // Primary agent Cortex can never be deleted
    if (!target || target.isPrimary) {
      return { remaining: agents, deleted: null };
    }

    const remaining = agents.filter((a) => a.id !== id);
    this.saveAgents(remaining);

    // If active agent was deleted, fallback to Lobby / Cortex
    if (this.getActiveAgentId() === id) {
      this.returnToLobby();
    }

    return { remaining, deleted: target };
  }

  public static findAgentByQuery(query: string): AgentItem | null {
    if (!query) return null;
    const q = query.toLowerCase().trim();
    const agents = this.getAgents();

    // Check for lobby aliases
    if (q === "lobby" || q === "cortex" || q === "principal" || q.includes("al lobby") || q.includes("ir al lobby")) {
      return this.getPrimaryAgent();
    }

    // 1. Direct ID match
    const byId = agents.find((a) => a.id.toLowerCase() === q);
    if (byId) return byId;

    // 2. Name match
    const byName = agents.find((a) => a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase()));
    if (byName) return byName;

    // 3. Tagline / description match
    const byRole = agents.find(
      (a) =>
        a.tagline.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => q.includes(t.toLowerCase()) || t.toLowerCase().includes(q))
    );
    if (byRole) return byRole;

    return null;
  }

  public static subscribe(callback: (agents: AgentItem[]) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public static subscribeActiveAgent(callback: (agent: AgentItem) => void): () => void {
    this.activeAgentListeners.push(callback);
    return () => {
      this.activeAgentListeners = this.activeAgentListeners.filter((l) => l !== callback);
    };
  }

  private static notifyListeners(agents: AgentItem[]) {
    this.listeners.forEach((l) => {
      try {
        l(agents);
      } catch (err) {
        console.error("Error in agent listener:", err);
      }
    });
  }

  private static notifyActiveAgentListeners(agent: AgentItem) {
    this.activeAgentListeners.forEach((l) => {
      try {
        l(agent);
      } catch (err) {
        console.error("Error in active agent listener:", err);
      }
    });
  }
}
