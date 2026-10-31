import React, { useState } from "react";
import { AgentItem, SessionItem } from "../types";
import {
  X,
  Plus,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Layers,
  Trash2,
  Edit2,
  FileText,
  Search,
  Check,
  Zap,
  Info,
  Bot,
} from "lucide-react";
import { soundFx } from "../lib/audioManager";

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionItem[];
  activeSessionId: string | null;
  activeAgent?: AgentItem;
  onConnectSession: (sessionId: string) => void;
  onDisconnectSession: () => void;
  onCreateSession: (title: string, topic?: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onSummarizeSession?: (sessionId: string) => void;
  language: "es-ES" | "en-US";
}

export const SessionModal: React.FC<SessionModalProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  activeAgent,
  onConnectSession,
  onDisconnectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  onSummarizeSession,
  language,
}) => {
  const [newTitle, setNewTitle] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEs = language === "es-ES";
  const activeSession = sessions.find((s) => s.id === activeSessionId || s.connected);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      onCreateSession(newTitle.trim(), newTopic.trim() || undefined);
      setNewTitle("");
      setNewTopic("");
      setIsCreating(false);
      soundFx.playWake();
    }
  };

  const handleStartRename = (session: SessionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (sessionId: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim());
      setEditingSessionId(null);
      soundFx.playComplete();
    }
  };

  const handleDeleteClick = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId === sessionId) {
      onDeleteSession(sessionId);
      setConfirmDeleteId(null);
      soundFx.playComplete();
    } else {
      setConfirmDeleteId(sessionId);
      setTimeout(() => setConfirmDeleteId(null), 4000);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.topic.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div
      id="cortex-session-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="cortex-session-modal-card"
        className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-3xl bg-neutral-950/85 border border-white/10 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-wide text-white/90">
                  {isEs ? "Gestión de Sesiones & Contexto" : "Session & Context Hub"}
                </h2>
                {activeAgent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 font-mono">
                    {activeAgent.avatarEmoji} {activeAgent.name}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-white/40 tracking-wider">
                {isEs
                  ? activeAgent?.isPrimaryLobby
                    ? "Sesiones globales coordinadas por Cortex en el Lobby"
                    : `Sesiones aisladas del agente especializado ${activeAgent?.name || ""}`
                  : "Clean context isolation & active focus"}
              </p>
            </div>
          </div>
          <button
            id="session-modal-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-white/40 hover:text-white/90 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clean Context Info Banner */}
        <div className="mx-6 mt-3 px-3.5 py-2 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-center gap-2.5 text-[11px] text-cyan-200/80">
          <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            {isEs
              ? "Cada nueva sesión inicia con el contexto limpio para máxima concentración."
              : "Each new session starts with a clean context for maximum focus."}
          </span>
        </div>

        {/* Active Connected Card if any */}
        {activeSession && (
          <div className="mx-6 mt-3 p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-blue-950/30 border border-cyan-500/35 shadow-[0_0_20px_rgba(6,182,212,0.1)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                </span>
                <span className="text-[10px] uppercase tracking-widest text-cyan-300 font-semibold">
                  {isEs ? "Sesión Activa Conectada" : "Active Connected Session"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    onDisconnectSession();
                    soundFx.playComplete();
                  }}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  {isEs ? "Desconectar" : "Disconnect"}
                </button>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-white/95">{activeSession.title}</h3>
                <p className="text-[11px] text-white/60 font-light mt-0.5 line-clamp-1">
                  {activeSession.topic}
                </p>
              </div>
              <button
                onClick={() =>
                  setExpandedSummaryId(expandedSummaryId === activeSession.id ? null : activeSession.id)
                }
                className="shrink-0 text-[10px] px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 flex items-center gap-1 hover:bg-cyan-500/25 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-cyan-300" />
                <span>{isEs ? "Resumen" : "Summary"}</span>
              </button>
            </div>

            {expandedSummaryId === activeSession.id && (
              <div className="mt-1 p-2.5 rounded-xl bg-black/40 border border-white/5 text-[11px] text-cyan-100/90 leading-relaxed animate-fade-in">
                {activeSession.summary || (isEs ? "Sin resumen disponible." : "No summary available.")}
              </div>
            )}
          </div>
        )}

        {/* Search & Filter Header */}
        <div className="px-6 pt-3 pb-1 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 focus-within:border-cyan-500/40 transition-colors">
            <Search className="w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEs ? "Buscar sesión por nombre o tema..." : "Search sessions..."}
              className="w-full bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-white/30 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <span className="text-[10px] text-white/40 font-mono shrink-0">
            {filteredSessions.length} {isEs ? "sesiones" : "sessions"}
          </span>
        </div>

        {/* Sessions Scrollable List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2.5 custom-scrollbar">
          {filteredSessions.length === 0 ? (
            <div className="py-8 text-center text-white/40 text-xs">
              {isEs ? "No se encontraron sesiones coincidentes." : "No matching sessions found."}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isConn = session.id === activeSessionId || session.connected;
              const isEditing = editingSessionId === session.id;
              const isSummaryOpen = expandedSummaryId === session.id;
              const isConfirmingDelete = confirmDeleteId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    if (!isEditing) {
                      onConnectSession(session.id);
                      soundFx.playWake();
                    }
                  }}
                  className={`group p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col gap-2 ${
                    isConn
                      ? "bg-cyan-950/25 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.12)]"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/15"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            autoFocus
                            className="flex-1 px-2.5 py-1 rounded-lg bg-neutral-900 border border-cyan-500/50 text-xs text-white focus:outline-none"
                          />
                          <button
                            onClick={(e) => handleSaveRename(session.id, e)}
                            className="p-1 rounded-lg bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(null);
                            }}
                            className="p-1 rounded-lg bg-white/5 text-white/40 hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-semibold text-white/90 truncate group-hover:text-cyan-200 transition-colors">
                              {session.title}
                            </h3>
                            {isConn && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-white/50 font-light mt-0.5 line-clamp-1">
                            {session.topic}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Quick action icons */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        title={isEs ? "Ver resumen" : "View summary"}
                        onClick={() => setExpandedSummaryId(isSummaryOpen ? null : session.id)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isSummaryOpen
                            ? "bg-cyan-500/20 border-cyan-400/30 text-cyan-200"
                            : "bg-white/5 border-transparent text-white/40 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>

                      <button
                        title={isEs ? "Renombrar sesión" : "Rename session"}
                        onClick={(e) => handleStartRename(session, e)}
                        className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        title={isConfirmingDelete ? (isEs ? "¿Confirmar eliminar?" : "Confirm delete?") : (isEs ? "Eliminar sesión" : "Delete session")}
                        onClick={(e) => handleDeleteClick(session.id, e)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isConfirmingDelete
                            ? "bg-red-500/30 border border-red-500/50 text-red-200 animate-pulse"
                            : "bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-950/30"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          onConnectSession(session.id);
                          soundFx.playWake();
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 ${
                          isConn
                            ? "bg-cyan-500/20 border-cyan-400/30 text-cyan-200"
                            : "bg-white/5 border-white/5 text-white/50 group-hover:text-white/90 group-hover:border-white/20"
                        }`}
                      >
                        <span>{isConn ? (isEs ? "Activa" : "Active") : (isEs ? "Mover aquí" : "Switch")}</span>
                        <ChevronRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>

                  {/* Summary expanded details */}
                  {isSummaryOpen && (
                    <div
                      className="p-3 rounded-xl bg-black/40 border border-white/5 text-[11px] text-cyan-100/90 leading-relaxed animate-fade-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5 text-cyan-300 font-medium text-[10px] mb-1">
                        <Sparkles className="w-3 h-3" />
                        <span>{isEs ? "Resumen de la sesión" : "Session Summary"}</span>
                      </div>
                      <p>{session.summary || (isEs ? "Sin resumen disponible." : "No summary available.")}</p>
                    </div>
                  )}

                  {/* Tags and timestamp footer */}
                  <div className="flex items-center justify-between text-[9px] text-white/35 pt-1 border-t border-white/5">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {session.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-white/5 text-white/45 font-mono">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <span className="font-mono shrink-0">{session.lastActive}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer / Create New Session */}
        <div className="p-4 border-t border-white/5 bg-black/40">
          {isCreating ? (
            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-2 animate-fade-in">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={isEs ? "Título de la nueva sesión..." : "New session title..."}
                  autoFocus
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
                >
                  {isEs ? "Crear Limpia" : "Create Fresh"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-2.5 py-2 rounded-xl bg-white/5 text-white/40 text-xs hover:text-white/70"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder={isEs ? "Tema / Enfoque específico (opcional)..." : "Specific topic / focus (optional)..."}
                className="w-full px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-cyan-400/30"
              />
            </form>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setIsCreating(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-white/80 hover:text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isEs ? "Crear Nueva Sesión (Contexto Limpio)" : "New Clean Session"}</span>
              </button>
              <button
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-xs text-cyan-200 font-medium transition-colors"
              >
                {isEs ? "Listo" : "Done"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

