import { SessionItem, ChatMessage } from "../types";

const STORAGE_KEY = "cortex_user_sessions_v1";
const ACTIVE_SESSION_KEY = "cortex_active_session_id_v1";
const SESSION_MESSAGES_PREFIX = "cortex_session_msgs_";

const INITIAL_SESSIONS: SessionItem[] = [
  {
    id: "ses-101",
    agentId: "cortex-main",
    title: "Estrategia de Producto Q3",
    topic: "Planificación de roadmap y modelos de voz en tiempo real",
    lastActive: "Hace 2 horas",
    timestamp: Date.now() - 1000 * 60 * 120,
    tags: ["Estrategia", "Roadmap", "Audio"],
    summary: "Discusión sobre arquitectura de baja latencia y UX mobile-first con interrupción activa.",
    connected: false,
    messages: [
      { role: "user", text: "¿Cuáles son las prioridades para el roadmap de audio en tiempo real?", timestamp: Date.now() - 1000 * 60 * 115 },
      { role: "model", text: "Las prioridades clave son: 1. Detección VAD ultra reactiva, 2. Cancelación de eco acústico y 3. Síntesis neuronal con streaming oracional.", timestamp: Date.now() - 1000 * 60 * 110 }
    ],
  },
  {
    id: "ses-102",
    agentId: "agent-atlas",
    title: "Diseño de Arquitectura Cloud",
    topic: "Optimización de costos y microservicios serverless",
    lastActive: "Ayer a las 18:40",
    timestamp: Date.now() - 1000 * 60 * 60 * 20,
    tags: ["Infraestructura", "Cloud", "Costos"],
    summary: "Revisión de consumo sin servidores de pago y aprovechamiento de APIs gratuitas.",
    connected: false,
    messages: [
      { role: "user", text: "¿Cómo optimizamos la latencia de Edge a Cloud Run?", timestamp: Date.now() - 1000 * 60 * 60 * 19 },
      { role: "model", text: "Usando streaming HTTP/2 SSE sin buffering intermedio y manteniendo conexiones calientes.", timestamp: Date.now() - 1000 * 60 * 60 * 18 }
    ],
  },
  {
    id: "ses-103",
    agentId: "agent-atlas",
    title: "Investigación Modelos Multimodales",
    topic: "Comparativa Gemini 3.7 Flash y síntesis neuronal",
    lastActive: "Hace 2 días",
    timestamp: Date.now() - 1000 * 60 * 60 * 48,
    tags: ["IA", "Investigación", "Gemini"],
    summary: "Pruebas de reconocimiento acústico y tiempo de respuesta para habla en vivo.",
    connected: false,
    messages: [
      { role: "user", text: "¿Qué ventajas ofrece la inferencia por tokens streaming?", timestamp: Date.now() - 1000 * 60 * 60 * 47 },
      { role: "model", text: "Permite iniciar la síntesis de voz en menos de 200 milisegundos tras recibir el primer fragmento sintáctico.", timestamp: Date.now() - 1000 * 60 * 60 * 46 }
    ],
  },
  {
    id: "ses-104",
    agentId: "agent-nova",
    title: "Brainstorming Creativo UX & Branding",
    topic: "Orbe líquido reactivo y microinteracciones sonoras",
    lastActive: "Hace 3 días",
    timestamp: Date.now() - 1000 * 60 * 60 * 72,
    tags: ["UX", "Branding", "Sonido"],
    summary: "Ajuste de física de fluidos mediante Canvas 2D/WebGL y animaciones orgánicas.",
    connected: false,
    messages: [
      { role: "user", text: "¿Qué paleta transmite innovación sin saturar la vista?", timestamp: Date.now() - 1000 * 60 * 60 * 71 },
      { role: "model", text: "Recomiendo tonalidades cian cibernético y magenta twilight con destellos bioluminiscentes.", timestamp: Date.now() - 1000 * 60 * 60 * 70 }
    ],
  },
  {
    id: "ses-105",
    agentId: "agent-vektor",
    title: "Métricas y Proyecciones Q4",
    topic: "Análisis de costes de inferencia y retención de usuarios",
    lastActive: "Hace 5 días",
    timestamp: Date.now() - 1000 * 60 * 60 * 120,
    tags: ["Finanzas", "KPIs", "Inferencia"],
    summary: "Cálculo de ahorro por token utilizando streaming selectivo y VAD en el cliente.",
    connected: false,
  },
];

export class SessionStore {
  public static getSessions(agentId?: string): SessionItem[] {
    let list: SessionItem[] = [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        list = JSON.parse(data);
      } else {
        this.saveSessions(INITIAL_SESSIONS);
        list = INITIAL_SESSIONS;
      }
    } catch (e) {
      console.warn("Could not read sessions from localStorage:", e);
      list = INITIAL_SESSIONS;
    }

    // Ensure all items have an agentId
    list = list.map((s) => ({
      ...s,
      agentId: s.agentId || "cortex-main",
    }));

    if (agentId) {
      return list.filter((s) => s.agentId === agentId);
    }
    return list;
  }

  public static getSessionsForAgent(agentId: string): SessionItem[] {
    return this.getSessions(agentId);
  }

  public static getLobbySessions(): SessionItem[] {
    // In Lobby, show all or primary Cortex sessions
    return this.getSessions();
  }

  public static saveSessions(sessions: SessionItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn("Could not save sessions to localStorage:", e);
    }
  }

  public static getActiveSessionId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_SESSION_KEY) || null;
    } catch {
      return null;
    }
  }

  public static getActiveSession(): SessionItem | null {
    const id = this.getActiveSessionId();
    if (!id) return null;
    const sessions = this.getSessions();
    return sessions.find((s) => s.id === id) || null;
  }

  public static setActiveSessionId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(ACTIVE_SESSION_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }
    } catch {
      // Ignore
    }
  }

  public static connectSession(id: string): SessionItem | null {
    const sessions = this.getSessions();
    let connectedSession: SessionItem | null = null;

    const updated = sessions.map((s) => {
      if (s.id === id) {
        connectedSession = { ...s, connected: true, lastActive: "Ahora mismo", timestamp: Date.now() };
        return connectedSession;
      }
      return { ...s, connected: false };
    });

    if (connectedSession) {
      this.saveSessions(updated);
      this.setActiveSessionId(id);
    }
    return connectedSession;
  }

  public static disconnectSession(): void {
    const sessions = this.getSessions();
    const updated = sessions.map((s) => ({ ...s, connected: false }));
    this.saveSessions(updated);
    this.setActiveSessionId(null);
  }

  public static createSession(
    title?: string,
    topic?: string,
    tags: string[] = ["Nueva", "Enfoque"],
    agentId: string = "cortex-main"
  ): SessionItem {
    const sessions = this.getSessions();
    const sessionTitle = title && title.trim() ? title.trim() : `Nueva Sesión ${sessions.length + 1}`;
    const sessionTopic = topic && topic.trim() ? topic.trim() : "Espacio de trabajo y conversación enfocado";

    const newSession: SessionItem = {
      id: `ses-${Date.now().toString().slice(-6)}`,
      agentId: agentId || "cortex-main",
      title: sessionTitle,
      topic: sessionTopic,
      lastActive: "Ahora mismo",
      timestamp: Date.now(),
      tags: tags.length > 0 ? tags : ["Nueva", "Voz"],
      summary: `Sesión iniciada con contexto limpio sobre ${sessionTitle}.`,
      connected: true,
      messages: [], // Context starts fresh and clean
    };

    // Save empty messages store for the clean session
    this.saveSessionMessages(newSession.id, []);

    const updated = [
      newSession,
      ...sessions.map((s) => ({ ...s, connected: false })),
    ];
    this.saveSessions(updated);
    this.setActiveSessionId(newSession.id);
    return newSession;
  }

  public static deleteSession(sessionId: string): { remaining: SessionItem[]; deleted: SessionItem | null } {
    const sessions = this.getSessions();
    const target = sessions.find((s) => s.id === sessionId);
    const activeId = this.getActiveSessionId();

    const remaining = sessions.filter((s) => s.id !== sessionId);
    this.saveSessions(remaining);

    // Clean stored messages
    try {
      localStorage.removeItem(SESSION_MESSAGES_PREFIX + sessionId);
    } catch {}

    if (activeId === sessionId) {
      if (remaining.length > 0) {
        // Disconnect or switch to null
        this.setActiveSessionId(null);
      } else {
        this.setActiveSessionId(null);
      }
    }

    return { remaining, deleted: target || null };
  }

  public static renameSession(sessionId: string, newTitle: string): SessionItem | null {
    if (!newTitle || !newTitle.trim()) return null;
    const sessions = this.getSessions();
    let updatedSession: SessionItem | null = null;

    const updated = sessions.map((s) => {
      if (s.id === sessionId) {
        updatedSession = { ...s, title: newTitle.trim(), lastActive: "Ahora mismo" };
        return updatedSession;
      }
      return s;
    });

    if (updatedSession) {
      this.saveSessions(updated);
    }
    return updatedSession;
  }

  public static updateSession(sessionId: string, updates: Partial<SessionItem>): SessionItem | null {
    const sessions = this.getSessions();
    let updatedSession: SessionItem | null = null;

    const updated = sessions.map((s) => {
      if (s.id === sessionId) {
        updatedSession = { ...s, ...updates, timestamp: Date.now(), lastActive: "Ahora mismo" };
        return updatedSession;
      }
      return s;
    });

    if (updatedSession) {
      this.saveSessions(updated);
    }
    return updatedSession;
  }

  public static getSessionMessages(sessionId: string): ChatMessage[] {
    try {
      const data = localStorage.getItem(SESSION_MESSAGES_PREFIX + sessionId);
      if (data) {
        return JSON.parse(data);
      }
      const session = this.getSessions().find((s) => s.id === sessionId);
      return session?.messages || [];
    } catch {
      return [];
    }
  }

  public static saveSessionMessages(sessionId: string, messages: ChatMessage[]): void {
    try {
      localStorage.setItem(SESSION_MESSAGES_PREFIX + sessionId, JSON.stringify(messages.slice(-50)));
      // Also sync back to session list
      const sessions = this.getSessions();
      const updated = sessions.map((s) => {
        if (s.id === sessionId) {
          return { ...s, messages: messages.slice(-50), timestamp: Date.now(), lastActive: "Ahora mismo" };
        }
        return s;
      });
      this.saveSessions(updated);
    } catch (e) {
      console.warn("Could not save session messages:", e);
    }
  }

  public static appendMessageToActiveSession(message: ChatMessage): void {
    const activeId = this.getActiveSessionId();
    if (!activeId) return;
    const current = this.getSessionMessages(activeId);
    const updated = [...current, message];
    this.saveSessionMessages(activeId, updated);
  }

  public static summarizeSession(sessionId: string): string {
    const session = this.getSessions().find((s) => s.id === sessionId);
    if (!session) return "No se encontró información de la sesión solicitada.";

    const msgs = this.getSessionMessages(sessionId);
    if (msgs.length === 0) {
      return session.summary || `Sesión "${session.title}" enfocada en: ${session.topic}. No hay intercambios recientes registrados aún.`;
    }

    const topicsMentioned = session.tags.join(", ");
    return `Resumen de la sesión "${session.title}": Se centra en ${session.topic}. Temas clave: [${topicsMentioned}]. Cuenta con ${msgs.length} mensajes conversacionales registrados con contexto enfocado.`;
  }

  public static findSessionByQuery(query: string): SessionItem | null {
    if (!query) return null;
    const q = query.toLowerCase().trim();
    const sessions = this.getSessions();

    // 1. Direct ID match
    const byId = sessions.find((s) => s.id.toLowerCase() === q);
    if (byId) return byId;

    // 2. Title exact or strong match
    const byTitle = sessions.find((s) => s.title.toLowerCase().includes(q) || q.includes(s.title.toLowerCase()));
    if (byTitle) return byTitle;

    // 3. Keyword / Topic / Tag match
    const byTopic = sessions.find((s) =>
      s.topic.toLowerCase().includes(q) ||
      s.tags.some((t) => q.includes(t.toLowerCase()) || t.toLowerCase().includes(q))
    );
    if (byTopic) return byTopic;

    // 4. Token overlap matching
    const qWords = q.split(/\s+/).filter((w) => w.length > 3);
    for (const word of qWords) {
      const match = sessions.find(
        (s) =>
          s.title.toLowerCase().includes(word) ||
          s.topic.toLowerCase().includes(word) ||
          s.tags.some((t) => t.toLowerCase().includes(word))
      );
      if (match) return match;
    }

    return null;
  }
}

