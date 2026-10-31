import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Ordered list of fast, highly-available models with distinct quota pools
const CANDIDATE_FLASH_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
];

const CANDIDATE_AUDIO_MODELS = [
  "gemini-2.5-flash",
];

function buildCleanGeminiContents(history: any[], currentMessage: string) {
  const rawTurns: Array<{ role: "user" | "model"; text: string }> = [];

  if (Array.isArray(history)) {
    for (const h of history) {
      if (h && (h.role === "user" || h.role === "model")) {
        const cleanText = (h.text || "").replace(/\[\[\[ACTION:.*?\]\]\]/g, "").trim();
        if (cleanText) {
          rawTurns.push({ role: h.role, text: cleanText });
        }
      }
    }
  }

  const cleanCurrent = (currentMessage || "").replace(/\[\[\[ACTION:.*?\]\]\]/g, "").trim();
  if (cleanCurrent) {
    const lastTurn = rawTurns[rawTurns.length - 1];
    if (!lastTurn || lastTurn.role !== "user" || lastTurn.text !== cleanCurrent) {
      rawTurns.push({ role: "user", text: cleanCurrent });
    }
  }

  // Multiturn requests require alternating user/model roles and must start with user
  const alternating: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
  for (const turn of rawTurns) {
    if (alternating.length > 0 && alternating[alternating.length - 1].role === turn.role) {
      alternating[alternating.length - 1].parts[0].text += `\n\n${turn.text}`;
    } else {
      alternating.push({
        role: turn.role,
        parts: [{ text: turn.text }],
      });
    }
  }

  // If the conversation starts with 'model' (e.g. initial greeting), shift it out
  while (alternating.length > 0 && alternating[0].role === "model") {
    alternating.shift();
  }

  // Ensure there is at least one turn with user role
  if (alternating.length === 0) {
    alternating.push({
      role: "user",
      parts: [{ text: cleanCurrent || "Hola" }],
    });
  }

  return alternating;
}

let aiClient: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!aiClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. Responses will be simulated if offline.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", model: "gemini-3.8-flash", app: "Cortex" });
  });

  // Intelligent Context-Aware Conversational Generator (Handles session routing, browser, integrations, logs, and fluid conversation)
  function generateSmartResponse(message: string, context: any = {}): { text: string; action: any } {
    const {
      sessions = [],
      activeSessionTitle = null,
      activeSessionId = null,
      isConnectModalOpen = false,
      isBrowserOpen = false,
      isIntegrationsOpen = false,
      isConversationLogsOpen = false,
      language = "es-ES",
    } = context;

    const lower = (message || "").toLowerCase().trim();
    const isSpanish = !language || language.startsWith("es");

    // Extract any URL, domain name or website request
    // Matches patterns like: example.com, www.example.com, https://example.com, http://example.com, github.com, etc.
    const urlPattern = /(?:https?:\/\/|www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(?:\/[^\s]*)?/i;
    const urlMatch = message.match(urlPattern);

    // Check if the user is asking to close the browser
    if (
      lower.includes("cierra el navegador") ||
      lower.includes("cerrar navegador") ||
      lower.includes("cierra la web") ||
      lower.includes("cerrar la web") ||
      lower.includes("oculta el navegador") ||
      lower.includes("close browser") ||
      lower.includes("close the browser") ||
      lower.includes("exit browser")
    ) {
      return {
        text: isSpanish
          ? "Navegador cerrado. Regresando a la interfaz principal de voz."
          : "Browser closed. Returning to main Voice First interface.",
        action: { type: "CLOSE_BROWSER" },
      };
    }

    // 1. Explicit URL or Web Domain Navigation (e.g. "entra a example.com", "ve a google.com", "visita github.com", "example.com")
    if (urlMatch && !lower.includes("sesión") && !lower.includes("sesion") && !lower.includes("session")) {
      const rawUrl = urlMatch[0];
      let targetUrl = rawUrl;
      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = "https://" + targetUrl;
      }
      return {
        text: isSpanish
          ? `Abriendo ${rawUrl} en el navegador web. Di 'cierra el navegador' cuando gustes regresar a la voz.`
          : `Opening ${rawUrl} in the web browser. Say 'close browser' when you want to return to voice.`,
        action: { type: "OPEN_BROWSER", url: targetUrl },
      };
    }

    // 2. Named Web Site Navigation & Commands (Open, Navigate, Search)
    if (
      lower.includes("navega a") ||
      lower.includes("navegar a") ||
      lower.includes("visita ") ||
      lower.includes("visitar ") ||
      lower.includes("busca en la web") ||
      lower.includes("buscar en la web") ||
      lower.includes("abre la web") ||
      lower.includes("abrir la web") ||
      lower.includes("abre wikipedia") ||
      lower.includes("abre google") ||
      lower.includes("abre youtube") ||
      lower.includes("abre github") ||
      lower.includes("abrir navegador") ||
      lower.includes("abre el navegador") ||
      lower.includes("muestra el navegador") ||
      lower.includes("ver navegador") ||
      lower.includes("open browser") ||
      lower.includes("navigate to") ||
      lower.includes("entra a la web") ||
      lower.includes("entra a internet")
    ) {
      let targetUrl = "https://en.m.wikipedia.org/wiki/Artificial_intelligence";
      if (lower.includes("wikipedia")) {
        targetUrl = "https://en.m.wikipedia.org/wiki/Special:Random";
      } else if (lower.includes("google") || lower.includes("busca") || lower.includes("buscar")) {
        const query = lower
          .replace(/navega a|navegar a|visita|visitar|busca en la web|buscar en la web|abre la web|abrir navegador|abre el navegador|open browser|navigate to/gi, "")
          .trim();
        targetUrl = query
          ? `https://www.google.com/search?igu=1&q=${encodeURIComponent(query)}`
          : "https://www.google.com/search?igu=1&q=artificial+intelligence";
      } else if (lower.includes("youtube")) {
        targetUrl = "https://www.youtube.com";
      } else if (lower.includes("github")) {
        targetUrl = "https://github.com";
      } else if (lower.includes("news") || lower.includes("noticias")) {
        targetUrl = "https://news.ycombinator.com";
      } else if (lower.includes("mdn") || lower.includes("docs") || lower.includes("documentacion") || lower.includes("documentación")) {
        targetUrl = "https://developer.mozilla.org/en-US/docs/Web/API";
      } else if (lower.includes("ejemplo") || lower.includes("example")) {
        targetUrl = "https://example.com";
      }

      return {
        text: isSpanish
          ? "Abriendo el navegador web. Puedes pedirme que navegue a cualquier dirección o decir 'cierra el navegador'."
          : "Opening the web browser. You can ask me to navigate to any address or say 'close browser'.",
        action: { type: "OPEN_BROWSER", url: targetUrl },
      };
    }

    // 3. Enter / Connect to a specific session (Fuzzy matching, Ordinals, Titles, Numbers)
    const isExplicitSessionWord =
      lower.includes("sesión") ||
      lower.includes("sesion") ||
      lower.includes("session");

    const isSessionActionVerb =
      lower.includes("entra") ||
      lower.includes("entrar") ||
      lower.includes("conecta") ||
      lower.includes("conectar") ||
      lower.includes("abre la sesión") ||
      lower.includes("abre sesion") ||
      lower.includes("abrir sesion") ||
      lower.includes("abrir la sesión") ||
      lower.includes("reanuda") ||
      lower.includes("reanudar") ||
      lower.includes("connect session") ||
      lower.includes("open session") ||
      lower.includes("resume session");

    if (isSessionActionVerb) {
      // Check for Strategy / Q3 / First
      if (
        lower.includes("estrategia") ||
        lower.includes("strategy") ||
        lower.includes("producto") ||
        lower.includes("q3") ||
        lower.includes("primera") ||
        lower.includes("primero") ||
        lower.includes("1") ||
        lower.includes("one") ||
        lower.includes("first")
      ) {
        const match = sessions.find((s: any) => s.id === "session-1") || { id: "session-1", title: "Estrategia de Producto Q3" };
        return {
          text: isSpanish
            ? `Entrando a la sesión "${match.title}". Cerrando panel de sesiones y sincronizando contexto.`
            : `Entering session "${match.title}". Closing sessions view and synchronizing context.`,
          action: { type: "CONNECT_SESSION", sessionId: match.id, sessionTitle: match.title },
        };
      }

      // Check for Architecture / Cloud / Second
      if (
        lower.includes("arquitectura") ||
        lower.includes("architecture") ||
        lower.includes("cloud") ||
        lower.includes("diseño") ||
        lower.includes("segunda") ||
        lower.includes("segundo") ||
        lower.includes("2") ||
        lower.includes("two") ||
        lower.includes("second")
      ) {
        const match = sessions.find((s: any) => s.id === "session-2") || { id: "session-2", title: "Diseño de Arquitectura Cloud" };
        return {
          text: isSpanish
            ? `Entrando a la sesión "${match.title}". Cerrando el selector de sesiones.`
            : `Entering session "${match.title}". Closing sessions selector.`,
          action: { type: "CONNECT_SESSION", sessionId: match.id, sessionTitle: match.title },
        };
      }

      // Check for Sprint / Review / Third
      if (
        lower.includes("sprint") ||
        lower.includes("review") ||
        lower.includes("alpha") ||
        lower.includes("tercera") ||
        lower.includes("tercero") ||
        lower.includes("3") ||
        lower.includes("three") ||
        lower.includes("third")
      ) {
        const match = sessions.find((s: any) => s.id === "session-3") || { id: "session-3", title: "Sprint Review Alpha" };
        return {
          text: isSpanish
            ? `Conectando con la sesión "${match.title}". Cerrando el panel de sesiones.`
            : `Connecting to "${match.title}" session. Closing sessions view.`,
          action: { type: "CONNECT_SESSION", sessionId: match.id, sessionTitle: match.title },
        };
      }

      // Check for Brainstorming / Agents / Fourth
      if (
        lower.includes("brainstorming") ||
        lower.includes("agentes") ||
        lower.includes("agent") ||
        lower.includes("cuarta") ||
        lower.includes("cuarto") ||
        lower.includes("4") ||
        lower.includes("four") ||
        lower.includes("fourth")
      ) {
        const match = sessions.find((s: any) => s.id === "session-4") || { id: "session-4", title: "Brainstorming de Agentes Autónomos" };
        return {
          text: isSpanish
            ? `Entrando a la sesión "${match.title}". Panel cerrado, listo para interactuar.`
            : `Entering session "${match.title}". Panel closed, ready to proceed.`,
          action: { type: "CONNECT_SESSION", sessionId: match.id, sessionTitle: match.title },
        };
      }

      // If user specifically said "entra a la sesión" or "conectar sesión" without naming which one
      if (isExplicitSessionWord || isConnectModalOpen) {
        const firstSession = sessions[0] || { id: "session-1", title: "Estrategia de Producto Q3" };
        return {
          text: isSpanish
            ? `Conectando con "${firstSession.title}". Panel de sesiones cerrado.`
            : `Connecting to "${firstSession.title}". Session modal closed.`,
          action: { type: "CONNECT_SESSION", sessionId: firstSession.id, sessionTitle: firstSession.title },
        };
      }
    }

    // Direct session keyword triggers without "entra"
    if (lower.includes("estrategia") || lower.includes("strategy") || lower.includes("q3")) {
      const match = sessions.find((s: any) => s.id === "session-1") || { id: "session-1", title: "Estrategia de Producto Q3" };
      return {
        text: isSpanish ? `Conectando a ${match.title}. Cerrando selector.` : `Connecting to ${match.title}. Closing selector.`,
        action: { type: "CONNECT_SESSION", sessionId: match.id, sessionTitle: match.title },
      };
    }
    if (lower.includes("arquitectura") || lower.includes("cloud")) {
      const match = sessions.find((s: any) => s.id === "session-2") || { id: "session-2", title: "Diseño de Arquitectura Cloud" };
      return {
        text: isSpanish ? `Conectando a ${match.title}. Cerrando selector.` : `Connecting to ${match.title}. Closing selector.`,
        action: { type: "CONNECT_SESSION", sessionId: match.id, sessionTitle: match.title },
      };
    }
    if (lower.includes("sprint review") || (lower.includes("sprint") && !lower.includes("correr"))) {
      const match = sessions.find((s: any) => s.id === "session-3") || { id: "session-3", title: "Sprint Review Alpha" };
      return {
        text: isSpanish ? `Conectando a ${match.title}. Cerrando selector.` : `Connecting to ${match.title}. Closing selector.`,
        action: { type: "CONNECT_SESSION", sessionId: match.id, sessionTitle: match.title },
      };
    }
    if (lower.includes("brainstorming") || (lower.includes("agentes") && !lower.includes("quién"))) {
      const match = sessions.find((s: any) => s.id === "session-4") || { id: "session-4", title: "Brainstorming de Agentes Autónomos" };
      return {
        text: isSpanish ? `Conectando a ${match.title}. Cerrando selector.` : `Connecting to ${match.title}. Closing selector.`,
        action: { type: "CONNECT_SESSION", sessionId: match.id, sessionTitle: match.title },
      };
    }

    // 4. Integrations (Google Suite & Composio Dev)
    if (
      lower.includes("integraciones") ||
      lower.includes("integracion") ||
      lower.includes("integración") ||
      lower.includes("google suite") ||
      lower.includes("google workspace") ||
      lower.includes("composio") ||
      lower.includes("aplicaciones conectadas") ||
      lower.includes("apps conectadas") ||
      lower.includes("open integrations") ||
      lower.includes("show integrations")
    ) {
      if (lower.includes("cierra") || lower.includes("cerrar") || lower.includes("close")) {
        return {
          text: isSpanish ? "Cerrando el centro de integraciones." : "Closing integrations hub.",
          action: { type: "CLOSE_INTEGRATIONS" },
        };
      }
      return {
        text: isSpanish
          ? "Abriendo el centro de integraciones. Aquí puedes ver Google Suite y las herramientas de Composio Dev."
          : "Opening Integrations Hub. You can manage Google Suite and Composio Dev toolkits here.",
        action: { type: "OPEN_INTEGRATIONS" },
      };
    }

    if (
      lower.includes("cierra integraciones") ||
      lower.includes("cerrar integraciones") ||
      lower.includes("oculta integraciones") ||
      lower.includes("close integrations")
    ) {
      return {
        text: isSpanish ? "Panel de integraciones cerrado." : "Integrations panel closed.",
        action: { type: "CLOSE_INTEGRATIONS" },
      };
    }

    // 4. Conversation Logs & Moderation
    if (
      lower.includes("logs") ||
      lower.includes("registro de conversacion") ||
      lower.includes("registro de conversación") ||
      lower.includes("historial de conversación") ||
      lower.includes("moderación") ||
      lower.includes("moderacion") ||
      lower.includes("revisar comportamiento") ||
      lower.includes("conversation logs") ||
      lower.includes("open logs")
    ) {
      if (lower.includes("cierra") || lower.includes("cerrar") || lower.includes("close")) {
        return {
          text: isSpanish ? "Cerrando el registro de logs." : "Closing conversation logs.",
          action: { type: "CLOSE_CONVERSATION_LOGS" },
        };
      }
      return {
        text: isSpanish
          ? "Abriendo el registro de conversaciones y moderación para auditoría de latencia y comportamiento."
          : "Opening conversation logs and behavior moderation panel.",
        action: { type: "OPEN_CONVERSATION_LOGS" },
      };
    }

    if (
      lower.includes("cierra los logs") ||
      lower.includes("cerrar logs") ||
      lower.includes("cierra el registro") ||
      lower.includes("close logs")
    ) {
      return {
        text: isSpanish ? "Registro de logs cerrado." : "Conversation logs closed.",
        action: { type: "CLOSE_CONVERSATION_LOGS" },
      };
    }

    // 5. General Close / Dismiss any open popup & return to Voice-First
    if (
      lower === "cierra" ||
      lower === "cerrar" ||
      lower === "cerrar modal" ||
      lower === "cierra el modal" ||
      lower === "cierra el popup" ||
      lower === "cerrar popup" ||
      lower === "cierra la ventana" ||
      lower === "cerrar ventana" ||
      lower === "volver a la voz" ||
      lower === "pantalla principal" ||
      lower === "cerrar todo" ||
      lower === "close" ||
      lower === "close modal" ||
      lower === "close popup" ||
      lower === "back to voice"
    ) {
      return {
        text: isSpanish
          ? "Cerrando ventana y regresando al modo principal de voz."
          : "Closing window and returning to Voice-First view.",
        action: { type: "CLOSE_MODAL" },
      };
    }

    // 6. Session listing intent
    if (
      lower.includes("listar") ||
      lower.includes("list ") ||
      lower.includes("últimas") ||
      lower.includes("ultimas") ||
      lower.includes("sesiones") ||
      lower.includes("sessions") ||
      lower.includes("qué sesión") ||
      lower.includes("que sesion")
    ) {
      if (isSpanish) {
        return {
          text: "Tienes cuatro sesiones registradas: Estrategia de Producto Q3, Diseño de Arquitectura Cloud, Sprint Review Alpha y Brainstorming de Agentes. ¿A cuál deseas entrar?",
          action: { type: "LIST_SESSIONS" },
        };
      } else {
        return {
          text: "You have four recent sessions: Q3 Product Strategy, Cloud Architecture Design, Sprint Review Alpha, and Agent Brainstorming. Which one would you like to enter?",
          action: { type: "LIST_SESSIONS" },
        };
      }
    }

    // 7. Open session modal intent
    if (
      lower.includes("abrir panel de sesiones") ||
      lower.includes("ver sesiones") ||
      lower.includes("mostrar sesiones") ||
      lower.includes("panel de sesiones") ||
      lower.includes("open session modal")
    ) {
      if (isSpanish) {
        return {
          text: "Abriendo el panel de sesiones.",
          action: { type: "OPEN_CONNECT_MODAL" },
        };
      } else {
        return {
          text: "Opening the session connection modal.",
          action: { type: "OPEN_CONNECT_MODAL" },
        };
      }
    }

    // 8. Disconnect session
    if (lower.includes("desconectar") || lower.includes("disconnect") || lower.includes("salir de la sesión") || lower.includes("salir de sesion")) {
      return {
        text: isSpanish ? "Desconectando la sesión activa y regresando al modo general." : "Disconnecting the active session and returning to global mode.",
        action: { type: "DISCONNECT_SESSION" },
      };
    }

    // 9. Latency / Architecture / How it works
    if (lower.includes("cómo funcionas") || lower.includes("como funcionas") || lower.includes("latencia") || lower.includes("chunks") || lower.includes("split")) {
      return {
        text: isSpanish
          ? "Funciono mediante un pipeline de voz por fragmentos oracionales. En cuanto se generan las primeras palabras, comienzo a reproducir el audio de inmediato sin esperar la respuesta completa."
          : "I run on a real-time sentence chunking pipeline. As soon as the first words are generated, audio playback begins immediately without waiting for the full response.",
        action: { type: "NONE" },
      };
    }

    // 10. Greetings & Identity & Chit-chat
    if (
      lower.includes("quién eres") ||
      lower.includes("quien eres") ||
      lower.includes("who are you") ||
      lower.includes("cómo te llamas") ||
      lower.includes("como te llamas") ||
      lower.includes("cuál es tu nombre") ||
      lower.includes("cual es tu nombre") ||
      lower.includes("what is your name")
    ) {
      return {
        text: isSpanish
          ? "Soy Cortex, tu asistente de voz conversacional de ultra baja latencia. Puedo conectarte a tus sesiones de trabajo, abrir el navegador web o ayudarte con tus proyectos."
          : "I am Cortex, your ultra low-latency conversational voice assistant. I can connect to your work sessions, open the web browser, or assist with your projects.",
        action: { type: "NONE" },
      };
    }

    if (lower.includes("hola") || lower.includes("buenas") || lower.includes("hello") || lower.includes("hey") || lower.includes("hi")) {
      return {
        text: isSpanish
          ? "¡Hola! Te escucho con total claridad. Puedes pedirme entrar a una sesión de trabajo, abrir el navegador web o hacerme cualquier consulta."
          : "Hello! I hear you loud and clear. You can ask me to join a work session, browse the web, or ask any question.",
        action: { type: "NONE" },
      };
    }

    if (lower.includes("cómo estás") || lower.includes("como estas") || lower.includes("how are you")) {
      return {
        text: isSpanish
          ? "Estoy excelente, listo y atento a tus instrucciones de voz en tiempo real. ¿En qué te gustaría trabajar hoy?"
          : "I am doing great, ready and listening to your voice commands in real-time. What would you like to work on today?",
        action: { type: "NONE" },
      };
    }

    if (lower.includes("gracias") || lower.includes("thank")) {
      return {
        text: isSpanish
          ? "Con mucho gusto. Aquí estoy disponible para lo que necesites."
          : "You are welcome. I am right here whenever you need me.",
        action: { type: "NONE" },
      };
    }

    // Active session inquiry
    if (
      lower.includes("en qué sesión estoy") ||
      lower.includes("que sesion") ||
      lower.includes("qué sesión") ||
      lower.includes("sesión actual") ||
      lower.includes("sesion actual") ||
      lower.includes("current session")
    ) {
      if (activeSessionTitle) {
        return {
          text: isSpanish
            ? `Actualmente estás conectado a la sesión "${activeSessionTitle}". Puedo resumirte sus notas o ayudarte con su temática.`
            : `You are currently connected to the "${activeSessionTitle}" session. I can summarize its notes or help with its topic.`,
          action: { type: "NONE" },
        };
      } else {
        return {
          text: isSpanish
            ? "No tienes ninguna sesión activa en este momento. Di 'abrir sesiones' o 'entra a la de producto' para conectar una."
            : "You don't have an active session right now. Say 'open sessions' or 'join product strategy' to connect.",
          action: { type: "OPEN_CONNECT_MODAL" },
        };
      }
    }

    // Dynamic, natural response when fallback is invoked
    if (isSpanish) {
      return {
        text: `Te escucho con claridad. Estoy listo para ayudarte con tus sesiones de trabajo, abrir el navegador web o responder a tus preguntas.`,
        action: { type: "NONE" },
      };
    } else {
      return {
        text: `I hear you clearly. I am ready to help you navigate your work sessions, open the web browser, or answer any inquiries.`,
        action: { type: "NONE" },
      };
    }
  }

  // Streaming chat endpoint with sentence-by-sentence delivery for ElevenLabs-style low latency
  app.post("/api/chat-stream", async (req, res) => {
    console.log("[CHAT-STREAM] Incoming voice query:", req.body?.message);
    try {
      const { message, history = [], context = {} } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const {
        activeAgent = { id: "cortex-main", name: "Cortex", tagline: "Orquestador del Lobby", isPrimary: true },
        availableAgents = [],
        sessions = [],
        activeSessionTitle = null,
        activeSessionId = null,
        activeSessionTopic = null,
        activeSessionSummary = null,
        isConnectModalOpen = false,
        isLobbyModalOpen = false,
        isBrowserOpen = false,
        isIntegrationsOpen = false,
        isConversationLogsOpen = false,
        language = "es-ES",
      } = context;

      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });

      let clientDisconnected = false;
      res.on("close", () => {
        if (!res.writableEnded) {
          clientDisconnected = true;
        }
      });

      let streamedSuccessfully = false;
      let fullAccumulated = "";

      const resStreamWrite = (text: string) => {
        if (clientDisconnected || res.writableEnded) return;
        res.write(`data: ${JSON.stringify({ text, done: false })}\n\n`);
        if (typeof (res as any).flush === "function") (res as any).flush();
      };

      // If GEMINI_API_KEY is present, perform genuine streaming with Gemini AI
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
        try {
          const ai = getGenAI();

          const isPrimaryLobby = activeAgent?.isPrimary || activeAgent?.id === "cortex-main";

          const agentsListInfo = availableAgents && availableAgents.length > 0
            ? `\nREGISTERED AGENTS IN LOBBY (${availableAgents.length} total):
${availableAgents.map((a: any) => `* [ID: "${a.id}"] ${a.name} (Tagline: "${a.tagline || ''}", Tags: [${(a.tags || []).join(', ')}], isPrimary: ${Boolean(a.isPrimary)})`).join("\n")}`
            : "";

          const activeSessionInfo = activeSessionTitle
            ? `\nCURRENT ACTIVE SESSION (Scoped to ${activeAgent?.name || 'Agent'}):
- Title: "${activeSessionTitle}"
- ID: "${activeSessionId || 'ses-active'}"
- Topic: "${activeSessionTopic || 'Estrategia y ejecución'}"
- Summary / Notes: "${activeSessionSummary || 'Discusión y avances de trabajo'}"
- Status: Connected and active.`
            : `\nCURRENT ACTIVE SESSION: None (Active agent: ${activeAgent?.name || 'Cortex'}).`;

          const availableSessionsInfo = sessions && sessions.length > 0
            ? `\nAVAILABLE SESSIONS FOR THIS AGENT (${sessions.length} total):\n` +
              sessions
                .map(
                  (s: any) =>
                    `* [ID: "${s.id}"] Title: "${s.title}" | Topic: "${s.topic || ''}" | Notes: "${s.summary || ''}" | Last Active: "${s.lastActive || 'Reciente'}"`
                )
                .join("\n")
            : "\nAVAILABLE SESSIONS: None";

          let systemInstruction = "";

          if (isPrimaryLobby) {
            // Cortex (Lobby / Master Agent) Persona & Directives
            systemInstruction = `You are Cortex, the Primary Master Agent and Lobby Orchestrator.
You reside at the Lobby level of the multi-agent system.
Through you, users can explore all specialized agents, navigate the lobby, create new custom agents, switch between agents, manage global sessions, or ask any general question.

${agentsListInfo}
${activeSessionInfo}
${availableSessionsInfo}

CURRENT UI INTERACTION STATE:
- Lobby / Agents Modal: ${isLobbyModalOpen ? "OPEN (Visible on screen)" : "CLOSED"}
- Sessions Modal: ${isConnectModalOpen ? "OPEN (Visible on screen)" : "CLOSED"}
- Web Browser Window: ${isBrowserOpen ? "OPEN (Visible on screen)" : "CLOSED"}
- Integrations Hub: ${isIntegrationsOpen ? "OPEN (Visible on screen)" : "CLOSED"}
- Conversation Moderation Logs: ${isConversationLogsOpen ? "OPEN (Visible on screen)" : "CLOSED"}

LOBBY & MULTI-AGENT ACTIONS:
1. Switch to a Specialized Agent (e.g. "pásame con Atlas", "hablar con Nova", "quiero consultar al arquitecto", "cambiar a Vektor"):
   Confirm the transfer warmly and append: [[[ACTION:{"type":"SWITCH_AGENT","agentId":"<target_id>","agentName":"<target_name>"}]]]
2. Create a New Specialized Agent (e.g. "crea un nuevo agente llamado Sophia para análisis de datos con color morado", "crea un agente de ciberseguridad"):
   Confirm the agent creation enthusiastically and append: [[[ACTION:{"type":"CREATE_AGENT","agentName":"<name>","role":"<role/tagline>","themePreset":"<preset_id_e.g_violet-nebula|emerald-aurora|solar-amber|ruby-crimson|arctic-frost|cyan-cyber>"}]]]
3. Rename an Agent (e.g. "renombra al agente Atlas a Titan", "cambia el nombre del agente X"):
   Confirm and append: [[[ACTION:{"type":"RENAME_AGENT","agentId":"<agent_id>","newAgentName":"<new_name>"}]]]
4. Delete an Agent (e.g. "elimina el agente Nova", "borra el agente 104"):
   Confirm and append: [[[ACTION:{"type":"DELETE_AGENT","agentId":"<agent_id>"}]]]
5. List or Mention Registered Agents (e.g. "qué agentes tengo?", "cuéntame los agentes del lobby", "quiénes están disponibles?"):
   Describe the available agents conversationally and append: [[[ACTION:{"type":"LIST_AGENTS"}]]]
6. Open Lobby / Agent Hub Modal (e.g. "abrir el lobby", "mostrar agentes", "ver lobby"):
   Append: [[[ACTION:{"type":"OPEN_LOBBY"}]]]

SESSION MANAGEMENT CAPABILITIES:
- Create a new session: [[[ACTION:{"type":"CREATE_SESSION","sessionTitle":"<title>","topic":"<topic>"}]]]
- Switch/Connect session: [[[ACTION:{"type":"CONNECT_SESSION","sessionId":"<target_id>","sessionTitle":"<target_title>"}]]]
- Delete a session: [[[ACTION:{"type":"DELETE_SESSION","sessionId":"<target_id>","sessionTitle":"<target_title>"}]]]
- Rename a session: [[[ACTION:{"type":"RENAME_SESSION","sessionId":"<target_id>","newTitle":"<new_title>"}]]]
- Summarize a session: [[[ACTION:{"type":"SUMMARIZE_SESSION","sessionId":"<target_id>","sessionTitle":"<target_title>"}]]]
- List sessions: [[[ACTION:{"type":"LIST_SESSIONS"}]]]
- Disconnect active session: [[[ACTION:{"type":"DISCONNECT_SESSION"}]]]
- Open/Close Browser: [[[ACTION:{"type":"OPEN_BROWSER","url":"<url>"}]]] / [[[ACTION:{"type":"CLOSE_BROWSER"}]]]
- Open/Close Integrations: [[[ACTION:{"type":"OPEN_INTEGRATIONS"}]]] / [[[ACTION:{"type":"CLOSE_INTEGRATIONS"}]]]
- Close any open modal: [[[ACTION:{"type":"CLOSE_MODAL"}]]]
- If no UI action is required, DO NOT include any action tag (or use [[[ACTION:{"type":"NONE"}]]]).`;
          } else {
            // Specialized Agent Persona & Context Isolation Directives
            systemInstruction = `${activeAgent?.systemPrompt || `You are ${activeAgent?.name}, a specialized AI agent focused on ${activeAgent?.tagline || 'your designated domain'}.`}

YOU ARE CURRENTLY IN YOUR OWN DEDICATED WORKSPACE.
Your name: ${activeAgent?.name}
Your domain: ${activeAgent?.tagline || 'Specialized Domain'}
${activeSessionInfo}
${availableSessionsInfo}

STRICT CONTEXT ISOLATION & PRIVACY:
- You ONLY have access to your own sessions, questions, and assigned domain.
- You do NOT possess global workspace history or other agents' private conversations.
- If the user asks to return to the Lobby, speak to Cortex, or switch to another agent, warmly confirm and append: [[[ACTION:{"type":"RETURN_TO_LOBBY"}]]] or [[[ACTION:{"type":"SWITCH_AGENT","agentId":"<id>","agentName":"<name>"}]]]
- You can manage your own sessions:
  - Create session: [[[ACTION:{"type":"CREATE_SESSION","sessionTitle":"<title>","topic":"<topic>"}]]]
  - Switch session: [[[ACTION:{"type":"CONNECT_SESSION","sessionId":"<target_id>"}]]]
  - Delete session: [[[ACTION:{"type":"DELETE_SESSION","sessionId":"<target_id>"}]]]
  - Summarize session: [[[ACTION:{"type":"SUMMARIZE_SESSION","sessionId":"<target_id>"}]]]
  - Return to Lobby: [[[ACTION:{"type":"RETURN_TO_LOBBY"}]]]`;
          }

          systemInstruction += `

SPOKEN VOICE CONSTRAINTS:
- Keep your reply concise, articulate, and fluid for speech synthesis (1 to 3 natural conversational sentences).
- Strictly speak in ${language.startsWith("es") ? "Spanish" : "English"}.
- NEVER use markdown formatting (no bold **, no asterisks *, no bullet points -, no backticks \`\`\`), because the output is fed directly into speech synthesis.`;

          const contents = buildCleanGeminiContents(history, message);

          for (const modelName of CANDIDATE_FLASH_MODELS) {
            if (streamedSuccessfully || clientDisconnected) break;

            try {
              const streamResult = await ai.models.generateContentStream({
                model: modelName,
                contents: contents as any,
                config: {
                  systemInstruction,
                  temperature: 0.7,
                },
              });

              for await (const chunk of streamResult) {
                if (clientDisconnected) break;
                const chunkText = chunk.text;
                if (chunkText) {
                  resStreamWrite(chunkText);
                  fullAccumulated += chunkText;
                  streamedSuccessfully = true;
                }
              }

              if (streamedSuccessfully) {
                break;
              }
            } catch (modelErr: any) {
              const errMsg = modelErr?.message || String(modelErr);
              let reason = "busy";
              if (errMsg.includes("429") || errMsg.includes("quota")) reason = "quota_limited";
              else if (errMsg.includes("503")) reason = "high_demand";
              else if (errMsg.includes("500")) reason = "service_hiccup";
              console.log(`[Gemini API] Failover switching from ${modelName} (${reason})`);
              continue;
            }
          }
        } catch (e: any) {
          console.warn("[Gemini API] Stream handler notice:", e?.message || e);
        }
      }

      // If Gemini was not available or didn't produce tokens, stream via the fallback engine
      if (!streamedSuccessfully && !clientDisconnected) {
        console.log("[CHAT-STREAM] Falling back to intelligent response generator for message:", message);
        const smart = generateSmartResponse(message, context);
        const actionTag = smart.action && smart.action.type !== "NONE"
          ? ` [[[ACTION:${JSON.stringify(smart.action)}]]]`
          : "";

        const words = smart.text.split(" ").filter(Boolean);
        let currentGroup: string[] = [];

        for (let i = 0; i < words.length; i++) {
          if (clientDisconnected) break;
          currentGroup.push(words[i]);

          const word = words[i];
          const isPunctuation = word.endsWith(".") || word.endsWith("?") || word.endsWith("!") || word.endsWith(":");
          const isBatchReady = currentGroup.length >= 2 || i === words.length - 1 || isPunctuation;

          if (isBatchReady) {
            const tokenText = currentGroup.join(" ") + (i < words.length - 1 ? " " : "");
            resStreamWrite(tokenText);
            fullAccumulated += tokenText;
            currentGroup = [];
            await new Promise((r) => setTimeout(r, 12));
          }
        }

        if (actionTag) {
          fullAccumulated += actionTag;
        }
      }

      // Parse any action tag at the end
      let action: any = { type: "NONE" };
      const actionMatch = fullAccumulated.match(/\[\[\[ACTION:(.*?)\]\]\]/);
      if (actionMatch) {
        try {
          action = JSON.parse(actionMatch[1]);
        } catch {
          // Ignore
        }
      }

      // Send final completion message
      if (!clientDisconnected && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({ done: true, action })}\n\n`);
        res.end();
      }
    } catch (error: any) {
      console.error("Error in /api/chat-stream:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error?.message || "Stream failed" });
      } else {
        const fallback = generateSmartResponse("error", {});
        res.write(`data: ${JSON.stringify({ text: fallback.text, done: false })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, action: fallback.action })}\n\n`);
        res.end();
      }
    }
  });

  // Voice conversational chat endpoint with contextual view & session management (non-streaming fallback)
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history = [], context = {} } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const {
        sessions = [],
        activeSessionTitle = null,
        activeSessionId = null,
        activeSessionTopic = null,
        activeSessionSummary = null,
        isConnectModalOpen = false,
        language = "es-ES",
      } = context;

      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
        try {
          const ai = getGenAI();

          const systemInstruction = `You are Cortex, a lucid, articulate, and deeply intelligent voice AI assistant.

CURRENT VIEW CONTEXT:
- Active Session: ${activeSessionTitle ? `"${activeSessionTitle}" (Topic: "${activeSessionTopic || ''}", Summary: "${activeSessionSummary || ''}")` : "None (No session connected)"}
- Connect Modal Popup Open: ${isConnectModalOpen ? "YES" : "NO"}
- Available User Sessions (${sessions.length} total):
${sessions
  .map(
    (s: any, idx: number) =>
      `  [${idx + 1}] ID: "${s.id}", Title: "${s.title}", Topic: "${s.topic || ''}", Notes: "${s.summary || ''}"`
  )
  .join("\n")}

SESSION MANAGEMENT DIRECTIVES:
1. If the user mentions sessions, asking what session to resume, or generic session inquiries, naturally mention the recent sessions available or ask specifically which one they would like to resume.
2. If the user asks to list sessions, concisely list them and set action.type to "LIST_SESSIONS".
3. If the user asks to open/connect the popup modal, set action.type to "OPEN_CONNECT_MODAL".
4. If the user asks to connect to a specific session, set action.type to "CONNECT_SESSION" and action.sessionId to the matching ID.
5. If the user asks to disconnect or close, set action.type to "DISCONNECT_SESSION" or "CLOSE_MODAL".
6. If no session action is requested, set action.type to "NONE".

RULES:
- Respond in 1 to 2 short, spoken sentences maximum.
- Always respond in the EXACT same language as the user (${language.startsWith("es") ? "Spanish" : "English"}).
- Return pure JSON only with keys: "text" (your spoken reply) and "action" ({ "type": "LIST_SESSIONS" | "OPEN_CONNECT_MODAL" | "CONNECT_SESSION" | "DISCONNECT_SESSION" | "CREATE_SESSION" | "CLOSE_MODAL" | "NONE", "sessionId"?: string }).
- Do NOT use markdown code blocks or bullet points.`;

          const contents = buildCleanGeminiContents(history, message);

          let response: any = null;
          for (const modelName of CANDIDATE_FLASH_MODELS) {
            try {
              response = await ai.models.generateContent({
                model: modelName,
                contents: contents as any,
                config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                  temperature: 0.7,
                },
              });
              if (response?.text) break;
            } catch (err: any) {
              // If JSON schema/parsing fails with 500, retry once with plain text format
              try {
                response = await ai.models.generateContent({
                  model: modelName,
                  contents: contents as any,
                  config: {
                    systemInstruction,
                    temperature: 0.7,
                  },
                });
                if (response?.text) break;
              } catch {
                continue;
              }
            }
          }

          if (response) {
            let replyText = language.startsWith("es") ? "Te escucho." : "I hear you.";
            let action = { type: "NONE" };

            try {
              const raw = (response.text || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
              const parsed = JSON.parse(raw);
              replyText = parsed.text || replyText;
              action = parsed.action || { type: "NONE" };
            } catch {
              replyText = response.text || replyText;
            }

            return res.json({ text: replyText, action });
          }
        } catch (geminiError: any) {
          console.warn("Gemini chat fallback notice:", geminiError?.message);
        }
      }

      // Fallback
      const smart = generateSmartResponse(message, context);
      return res.json(smart);
    } catch (error: any) {
      console.error("Error in /api/chat:", error);
      const fallback = generateSmartResponse(req.body?.message || "", req.body?.context || {});
      res.json(fallback);
    }
  });

  // TTS endpoint using Gemini TTS or fallback
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice = "Puck" } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        return res.status(404).json({ error: "No audio generated" });
      }

      res.json({ audio: base64Audio, sampleRate: 24000 });
    } catch (error: any) {
      console.warn("TTS notice (will use browser synthesis):", error?.message);
      res.status(500).json({ error: error?.message || "TTS error" });
    }
  });

  // Audio transcription and understanding (when client records raw mic audio)
  app.post("/api/audio-input", async (req, res) => {
    try {
      const { audioBase64, mimeType = "audio/webm" } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "Audio data is required" });
      }

      // Normalize MIME type to standard types accepted by Gemini API (e.g. strip ;codecs=opus)
      let cleanMimeType = (mimeType || "audio/webm").split(";")[0].trim().toLowerCase();
      if (cleanMimeType === "audio/m4a" || cleanMimeType === "audio/x-m4a") {
        cleanMimeType = "audio/mp4";
      }
      if (!cleanMimeType.startsWith("audio/")) {
        cleanMimeType = "audio/webm";
      }

      const ai = getGenAI();
      const systemInstruction = `You are Cortex, a minimal and intelligent voice AI.
Listen carefully to the user's spoken audio.
1. Transcribe the user's spoken words into the "transcription" field.
2. Formulate a short, natural, conversational 1-2 sentence spoken reply in the EXACT SAME language in the "response" field.
3. Return valid JSON only with keys: "transcription" and "response". Do not use markdown backticks or bullet points.`;

      let response: any = null;

      for (const modelName of CANDIDATE_AUDIO_MODELS) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: cleanMimeType,
                      data: audioBase64,
                    },
                  },
                  {
                    text: "Transcribe what was said in the audio and provide a direct response.",
                  },
                ],
              },
            ],
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.7,
            },
          });
          if (response) break;
        } catch (modelErr: any) {
          // If high demand or temporary unavailable, seamlessly continue to next candidate
          continue;
        }
      }

      let transcription = "";
      let replyText = "";
      if (response && response.text) {
        try {
          const rawText = response.text || "{}";
          const cleanedJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleanedJson);
          transcription = parsed.transcription || "";
          replyText = parsed.response || response.text || "Te escucho.";
        } catch {
          replyText = response.text || "Te escucho.";
        }
      } else {
        transcription = "Entrada de voz recibida";
        replyText = "Te escucho con total claridad. ¿En qué sesión te gustaría trabajar hoy o qué deseas consultar?";
      }

      res.json({
        transcription,
        text: replyText,
      });
    } catch (error: any) {
      console.warn("Audio input fallback notice:", error?.message);
      res.json({
        transcription: "Entrada de audio detectada",
        text: "Audio procesado correctamente. ¿Cómo te puedo ayudar?",
      });
    }
  });

  // Vite middleware in dev or static files in prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cortex Server running at http://localhost:${PORT}`);
  });
}

startServer();
