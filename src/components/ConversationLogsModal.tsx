import React, { useState } from "react";
import {
  X,
  MessageSquare,
  Sparkles,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Download,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Zap,
  Activity,
  Sliders,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { BehaviorModerationPolicy, ConversationLogItem } from "../types";
import { soundFx } from "../lib/audioManager";

interface ConversationLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ConversationLogItem[];
  onClearLogs: () => void;
  onUpdateFeedback: (logId: string, feedback: "thumbs_up" | "thumbs_down" | null) => void;
  onToggleFlag: (logId: string) => void;
  policy: BehaviorModerationPolicy;
  onUpdatePolicy: (policy: BehaviorModerationPolicy) => void;
  language: "es-ES" | "en-US";
}

export const ConversationLogsModal: React.FC<ConversationLogsModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
  onUpdateFeedback,
  onToggleFlag,
  policy,
  onUpdatePolicy,
  language,
}) => {
  const [activeTab, setActiveTab] = useState<"logs" | "moderation">("logs");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [speakerFilter, setSpeakerFilter] = useState<"all" | "user" | "cortex">("all");
  const [onlyFlagged, setOnlyFlagged] = useState<boolean>(false);

  if (!isOpen) return null;

  const isEs = language === "es-ES";

  const filteredLogs = logs.filter((log) => {
    const matchesSpeaker = speakerFilter === "all" || log.speaker === speakerFilter;
    const matchesSearch =
      log.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.intent && log.intent.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.actionDispatched && log.actionDispatched.type.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFlag = !onlyFlagged || log.moderationStatus === "flagged";
    return matchesSpeaker && matchesSearch && matchesFlag;
  });

  const exportLogsAsJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cortex_conversation_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    soundFx.playComplete();
  };

  return (
    <div
      id="cortex-conversation-logs-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="cortex-conversation-logs-card"
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-neutral-950/90 border border-white/10 backdrop-blur-2xl shadow-[0_25px_80px_rgba(0,0,0,0.9)] text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-900/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium tracking-wide text-white/90">
                  {isEs ? "Registro de Conversación y Moderación" : "Conversation Logs & Moderation"}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-[10px] text-cyan-300 font-mono">
                  {logs.length} {isEs ? "turnos grabados" : "turns logged"}
                </span>
              </div>
              <p className="text-[11px] text-white/40 tracking-wider">
                {isEs
                  ? "Monitorea la latencia, intenciones, acciones y modera las respuestas del agente"
                  : "Audit latency, user intents, dispatched actions and moderate agent behavior"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportLogsAsJson}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/70 hover:text-white flex items-center gap-1.5 transition-colors"
              title={isEs ? "Exportar JSON" : "Export JSON"}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEs ? "Exportar" : "Export"}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-white/40 hover:text-white/90 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="px-6 py-3 border-b border-white/5 bg-black/30 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "logs"
                  ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{isEs ? "Historial de Turnos" : "Turn Logs"}</span>
            </button>
            <button
              onClick={() => setActiveTab("moderation")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "moderation"
                  ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isEs ? "Políticas de Moderación" : "Behavior Policies"}</span>
            </button>
          </div>

          {activeTab === "logs" && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isEs ? "Buscar en diálogo..." : "Search dialog..."}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50"
                />
              </div>

              <select
                value={speakerFilter}
                onChange={(e) => setSpeakerFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 focus:outline-none"
              >
                <option value="all">{isEs ? "Todos" : "All"}</option>
                <option value="user">{isEs ? "Usuario" : "User"}</option>
                <option value="cortex">{isEs ? "Agentes" : "Agents"}</option>
              </select>

              <button
                onClick={() => setOnlyFlagged(!onlyFlagged)}
                className={`p-2 rounded-xl border text-xs transition-colors ${
                  onlyFlagged
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"
                }`}
                title={isEs ? "Mostrar solo marcados" : "Only flagged"}
              >
                <Flag className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onClearLogs}
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs transition-colors"
                title={isEs ? "Limpiar registros" : "Clear logs"}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        {activeTab === "logs" ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-white/40">
                <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm font-medium">{isEs ? "No hay registros coincidentes" : "No matching logs"}</p>
                <p className="text-xs text-white/30 mt-1">
                  {isEs
                    ? "Habla con Cortex para ver los turnos transcritos, latencias y acciones."
                    : "Speak with Cortex to inspect transcribed turns, latencies, and actions."}
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isUser = log.speaker === "user";
                const isFlagged = log.moderationStatus === "flagged";

                return (
                  <div
                    key={log.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isFlagged
                        ? "bg-amber-950/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                        : isUser
                        ? "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                        : "bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-500/40"
                    }`}
                  >
                    {/* Log Item Header */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/5 text-[10px]">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium ${
                            isUser
                              ? "bg-neutral-800 text-white/80 border border-white/10"
                              : "border"
                          }`}
                          style={
                            !isUser && log.agentColor
                              ? {
                                  backgroundColor: `${log.agentColor}22`,
                                  borderColor: `${log.agentColor}55`,
                                  color: log.agentColor,
                                }
                              : !isUser
                              ? {
                                  backgroundColor: "rgba(6,182,212,0.2)",
                                  borderColor: "rgba(6,182,212,0.4)",
                                  color: "#67e8f9",
                                }
                              : undefined
                          }
                        >
                          {isUser ? (isEs ? "Usuario" : "User") : log.agentName || "Cortex"}
                        </span>
                        <span className="text-white/30 font-mono flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {log.formattedTime}
                        </span>
                        {log.engine && (
                          <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-mono">
                            {log.engine}
                          </span>
                        )}
                        {log.latencyMs !== undefined && (
                          <span className="text-emerald-400 font-mono">
                            {log.latencyMs}ms
                          </span>
                        )}
                      </div>

                      {/* Moderation Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            onUpdateFeedback(
                              log.id,
                              log.userFeedback === "thumbs_up" ? null : "thumbs_up"
                            )
                          }
                          className={`p-1.5 rounded-lg border transition-colors ${
                            log.userFeedback === "thumbs_up"
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                              : "bg-white/5 border-white/5 text-white/40 hover:text-white"
                          }`}
                          title={isEs ? "Buena respuesta" : "Good response"}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() =>
                            onUpdateFeedback(
                              log.id,
                              log.userFeedback === "thumbs_down" ? null : "thumbs_down"
                            )
                          }
                          className={`p-1.5 rounded-lg border transition-colors ${
                            log.userFeedback === "thumbs_down"
                              ? "bg-red-500/20 border-red-500/40 text-red-300"
                              : "bg-white/5 border-white/5 text-white/40 hover:text-white"
                          }`}
                          title={isEs ? "Respuesta a mejorar" : "Needs improvement"}
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onToggleFlag(log.id)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isFlagged
                              ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                              : "bg-white/5 border-white/5 text-white/40 hover:text-amber-300"
                          }`}
                          title={isEs ? "Marcar para revisión" : "Flag for moderation"}
                        >
                          <Flag className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Dialog Text */}
                    <p className="text-xs text-white/90 leading-relaxed mt-2.5 font-light">
                      {log.text}
                    </p>

                    {/* Action badge if dispatched */}
                    {log.actionDispatched && log.actionDispatched.type !== "NONE" && (
                      <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center gap-2 flex-wrap text-[10px]">
                        <span className="text-cyan-400/70 uppercase tracking-wider font-semibold">
                          {isEs ? "Acción Ejecutada:" : "Action Dispatched:"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 font-mono">
                          {log.actionDispatched.type}
                        </span>
                        {log.actionDispatched.sessionId && (
                          <span className="text-white/40 font-mono">
                            id: {log.actionDispatched.sessionId}
                          </span>
                        )}
                        {log.actionDispatched.url && (
                          <span className="text-white/40 font-mono truncate max-w-xs">
                            url: {log.actionDispatched.url}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Moderation tags */}
                    {log.moderationTags && log.moderationTags.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {log.moderationTags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-white/40"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Moderation & Behavior Policy Config */
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                {isEs ? "Reglas de Comportamiento del Agente" : "Agent Behavior & Interaction Policy"}
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                {isEs
                  ? "Configura cómo Cortex responde a intenciones, cierra ventanas y modera sus intervenciones."
                  : "Control how Cortex handles user intents, closes popups and returns to voice first."}
              </p>
            </div>

            <div className="space-y-3">
              {/* Auto close popup rule */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-medium text-white/90">
                    {isEs ? "Cerrar popups al seleccionar sesión" : "Auto-close popups on session selection"}
                  </h4>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    {isEs
                      ? "Al pedir entrar a una sesión, cierra automáticamente el modal y vuelve a la visualización de voz."
                      : "When entering a session, instantly close the session modal and return focus to Voice First."}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={policy.autoClosePopupsOnSelect}
                  onChange={(e) =>
                    onUpdatePolicy({ ...policy, autoClosePopupsOnSelect: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-cyan-500 bg-neutral-900 border-white/20 focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Strict Voice-First Return */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-medium text-white/90">
                    {isEs ? "Prioridad Voice-First siempre activa" : "Strict Voice-First Always Active"}
                  </h4>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    {isEs
                      ? "Permite comandos globales como 'cierra el navegador' o 'cierra integraciones' sin perder el flujo."
                      : "Allows voice dismissals ('close browser', 'close integrations') while keeping microphone active."}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={policy.voiceFirstStrictReturn}
                  onChange={(e) =>
                    onUpdatePolicy({ ...policy, voiceFirstStrictReturn: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-cyan-500 bg-neutral-900 border-white/20 focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Proactive session matching */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-medium text-white/90">
                    {isEs ? "Emparejamiento difuso de sesiones" : "Fuzzy Session Matching"}
                  </h4>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    {isEs
                      ? "Reconoce frases como 'entra a la primera', 'sesión de arquitectura' o 'retoma la de estrategia'."
                      : "Matches natural phrasing like 'open the first one', 'architecture session', or 'resume strategy'."}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={policy.proactiveSessionMatch}
                  onChange={(e) =>
                    onUpdatePolicy({ ...policy, proactiveSessionMatch: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-cyan-500 bg-neutral-900 border-white/20 focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Verbosity level */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-medium text-white/90">
                    {isEs ? "Nivel de concisión en voz" : "Voice Verbosity Level"}
                  </h4>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    {isEs
                      ? "Respuestas concisas reducen la latencia de TTS y permiten interacción ágil."
                      : "Concise spoken answers minimize TTS latency and optimize natural back-and-forth."}
                  </p>
                </div>
                <select
                  value={policy.verbosityLevel}
                  onChange={(e) =>
                    onUpdatePolicy({ ...policy, verbosityLevel: e.target.value as any })
                  }
                  className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none"
                >
                  <option value="concise">{isEs ? "Conciso (Recomendado)" : "Concise (Recommended)"}</option>
                  <option value="balanced">{isEs ? "Equilibrado" : "Balanced"}</option>
                  <option value="detailed">{isEs ? "Detallado" : "Detailed"}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-black/40 flex items-center justify-between text-[11px] text-white/50">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {isEs
                ? "Moderación continua para asegurar latencia ultra baja y ejecución precisa"
                : "Continuous moderation ensuring ultra-low latency & reliable action dispatch"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 text-cyan-200 text-xs font-medium transition-colors"
          >
            {isEs ? "Guardar y Cerrar" : "Save & Close"}
          </button>
        </div>
      </div>
    </div>
  );
};
