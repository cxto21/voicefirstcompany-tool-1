import React, { useState } from "react";
import {
  X,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  RefreshCw,
  Search,
  Filter,
  Plus,
  Mail,
  Calendar,
  FileText,
  Table,
  Video,
  FolderGit2,
  MessageSquare,
  Trello,
  Database,
  Terminal,
} from "lucide-react";
import { IntegrationItem } from "../types";
import { soundFx } from "../lib/audioManager";

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: "es-ES" | "en-US";
  onVoiceAction?: (prompt: string) => void;
}

const INITIAL_INTEGRATIONS: IntegrationItem[] = [
  // Google Suite (Google Workspace)
  {
    id: "google-drive",
    name: "Google Drive",
    category: "google_workspace",
    description: "Search documents, read PDFs, download session transcripts and sync team folders.",
    descriptionEs: "Busca documentos, lee PDFs, descarga transcripciones de sesiones y sincroniza carpetas.",
    iconName: "FolderGit2",
    connected: true,
    authStatus: "ready",
    scopes: ["drive.readonly", "drive.file"],
    actionsCount: 42,
    lastSync: "Hace 5 min",
    provider: "Google Suite",
  },
  {
    id: "google-gmail",
    name: "Gmail",
    category: "google_workspace",
    description: "Read email summaries, draft reply proposals, and flag urgent conversation threads.",
    descriptionEs: "Lee resúmenes de correo, redacta borradores de respuesta y destaca hilos urgentes.",
    iconName: "Mail",
    connected: true,
    authStatus: "ready",
    scopes: ["gmail.readonly", "gmail.compose"],
    actionsCount: 19,
    lastSync: "Hace 12 min",
    provider: "Google Suite",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "google_workspace",
    description: "Schedule voice debriefings, query upcoming meetings, and check agenda availability.",
    descriptionEs: "Agenda reuniones por voz, consulta próximos eventos y revisa disponibilidad.",
    iconName: "Calendar",
    connected: true,
    authStatus: "ready",
    scopes: ["calendar.events", "calendar.readonly"],
    actionsCount: 31,
    lastSync: "Hace 1 hora",
    provider: "Google Suite",
  },
  {
    id: "google-docs",
    name: "Google Docs",
    category: "google_workspace",
    description: "Append voice notes directly to living documents, generate meeting executive summaries.",
    descriptionEs: "Agrega notas de voz a documentos activos y genera minutas ejecutivas.",
    iconName: "FileText",
    connected: false,
    authStatus: "unlinked",
    scopes: ["documents.modify"],
    actionsCount: 0,
    provider: "Google Suite",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    category: "google_workspace",
    description: "Log voice analytics, update numeric metrics, and export real-time tables.",
    descriptionEs: "Registra métricas y análisis de voz, actualiza tablas y exporta datos.",
    iconName: "Table",
    connected: false,
    authStatus: "unlinked",
    scopes: ["spreadsheets"],
    actionsCount: 0,
    provider: "Google Suite",
  },
  {
    id: "google-meet",
    name: "Google Meet",
    category: "google_workspace",
    description: "Join live meeting audio streams with Cortex live transcription and action extraction.",
    descriptionEs: "Conéctate a llamadas en vivo para transcripción en tiempo real y extracción de acuerdos.",
    iconName: "Video",
    connected: true,
    authStatus: "ready",
    scopes: ["meetings.space.readonly"],
    actionsCount: 8,
    lastSync: "Hace 2 horas",
    provider: "Google Suite",
  },

  // Composio Dev Toolkits
  {
    id: "composio-github",
    name: "GitHub (Composio Dev)",
    category: "composio_dev",
    description: "Create Pull Requests, check CI/CD action runs, review commits and query issues by voice.",
    descriptionEs: "Crea Pull Requests, revisa pipelines CI/CD, examina commits y consulta issues por voz.",
    iconName: "FolderGit2",
    connected: true,
    authStatus: "ready",
    scopes: ["repo", "read:user", "workflow"],
    actionsCount: 56,
    lastSync: "Hace 3 min",
    provider: "Composio",
  },
  {
    id: "composio-notion",
    name: "Notion (Composio Dev)",
    category: "composio_dev",
    description: "Sync product roadmaps, create database items, and update sprint backlog documentation.",
    descriptionEs: "Sincroniza roadmaps, crea elementos en bases de datos y actualiza documentación de sprints.",
    iconName: "FileText",
    connected: true,
    authStatus: "ready",
    scopes: ["pages:read", "pages:write", "databases:read"],
    actionsCount: 27,
    lastSync: "Hace 15 min",
    provider: "Composio",
  },
  {
    id: "composio-slack",
    name: "Slack (Composio Dev)",
    category: "composio_dev",
    description: "Broadcast voice summaries to #engineering channels and receive instant mentions.",
    descriptionEs: "Publica resúmenes por voz en canales de Slack y recibe alertas de menciones.",
    iconName: "MessageSquare",
    connected: false,
    authStatus: "unlinked",
    scopes: ["chat:write", "channels:read"],
    actionsCount: 0,
    provider: "Composio",
  },
  {
    id: "composio-linear",
    name: "Linear (Composio Dev)",
    category: "composio_dev",
    description: "Voice-driven issue creation, backlog triage, sprint estimation, and status transitions.",
    descriptionEs: "Creación de tickets por voz, triaje de backlog, estimaciones y cambio de estados.",
    iconName: "Trello",
    connected: false,
    authStatus: "unlinked",
    scopes: ["issues:create", "read"],
    actionsCount: 0,
    provider: "Composio",
  },
  {
    id: "composio-postgres",
    name: "PostgreSQL Database",
    category: "composio_dev",
    description: "Execute natural language queries on schemas, tables, and analytics data warehouses.",
    descriptionEs: "Ejecuta consultas en lenguaje natural sobre esquemas y bases de datos relacionales.",
    iconName: "Database",
    connected: true,
    authStatus: "ready",
    scopes: ["readonly_queries", "schema_inspect"],
    actionsCount: 88,
    lastSync: "Hace 1 min",
    provider: "Composio",
  },
];

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({
  isOpen,
  onClose,
  language,
  onVoiceAction,
}) => {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>(INITIAL_INTEGRATIONS);
  const [selectedTab, setSelectedTab] = useState<"all" | "google_workspace" | "composio_dev">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [connectingId, setConnectingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEs = language === "es-ES";

  const toggleConnection = (id: string) => {
    setConnectingId(id);
    soundFx.playWake();

    setTimeout(() => {
      setIntegrations((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            const nextConnected = !item.connected;
            return {
              ...item,
              connected: nextConnected,
              authStatus: nextConnected ? "ready" : "unlinked",
              lastSync: nextConnected ? (isEs ? "Recién conectado" : "Just now") : undefined,
            };
          }
          return item;
        })
      );
      setConnectingId(null);
      soundFx.playComplete();
    }, 600);
  };

  const filteredIntegrations = integrations.filter((item) => {
    const matchesTab = selectedTab === "all" || item.category === selectedTab;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.descriptionEs.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.provider.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const connectedCount = integrations.filter((i) => i.connected).length;

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Mail":
        return Mail;
      case "Calendar":
        return Calendar;
      case "FileText":
        return FileText;
      case "Table":
        return Table;
      case "Video":
        return Video;
      case "MessageSquare":
        return MessageSquare;
      case "Trello":
        return Trello;
      case "Database":
        return Database;
      default:
        return FolderGit2;
    }
  };

  return (
    <div
      id="cortex-integrations-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="cortex-integrations-card"
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-neutral-950/90 border border-white/10 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-900/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium tracking-wide text-white/90">
                  {isEs ? "Centro de Integraciones" : "Integrations Hub"}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-[10px] text-cyan-300 font-mono">
                  {connectedCount} {isEs ? "activas" : "active"}
                </span>
              </div>
              <p className="text-[11px] text-white/40 tracking-wider">
                {isEs
                  ? "Google Suite (Workspace) y Composio Dev para automatización por voz"
                  : "Google Suite (Workspace) & Composio Dev for voice-driven execution"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-white/40 hover:text-white/90 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 w-full sm:w-auto">
            <button
              onClick={() => setSelectedTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedTab === "all"
                  ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {isEs ? "Todas" : "All"} ({integrations.length})
            </button>
            <button
              onClick={() => setSelectedTab("google_workspace")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedTab === "google_workspace"
                  ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Google Suite ({integrations.filter((i) => i.category === "google_workspace").length})
            </button>
            <button
              onClick={() => setSelectedTab("composio_dev")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedTab === "composio_dev"
                  ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Composio Dev ({integrations.filter((i) => i.category === "composio_dev").length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEs ? "Buscar integración..." : "Search integrations..."}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50"
            />
          </div>
        </div>

        {/* Integrations Grid / List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
          {filteredIntegrations.map((item) => {
            const Icon = getIcon(item.iconName);
            const isConn = item.connected;
            const isPending = connectingId === item.id;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isConn
                    ? "bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-500/50"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/15"
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isConn
                        ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                        : "bg-white/5 border-white/10 text-white/40"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-semibold text-white/90">{item.name}</h3>
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] text-white/50 font-mono">
                        {item.provider}
                      </span>
                      {isConn ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          {isEs ? "Conectado" : "Connected"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/40">
                          {isEs ? "No vinculado" : "Unlinked"}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-white/60 font-light mt-1 line-clamp-2">
                      {isEs ? item.descriptionEs : item.description}
                    </p>

                    {/* Scopes & Stats */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-[9px] text-white/40 font-mono">
                      {item.scopes.map((scope, sIdx) => (
                        <span key={sIdx} className="px-1.5 py-0.5 rounded bg-white/5 text-white/50">
                          {scope}
                        </span>
                      ))}
                      {isConn && (
                        <span className="text-cyan-300/80">
                          {item.actionsCount} {isEs ? "acciones ejecutadas" : "actions run"}
                        </span>
                      )}
                      {item.lastSync && (
                        <span className="text-white/30">• {item.lastSync}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Connect Toggle Button */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => toggleConnection(item.id)}
                    disabled={isPending}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      isConn
                        ? "bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-300"
                        : "bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400/40 text-cyan-200"
                    }`}
                  >
                    {isPending ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : isConn ? (
                      isEs ? "Desvincular" : "Disconnect"
                    ) : (
                      isEs ? "Conectar" : "Connect"
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with Voice-First Hint */}
        <div className="p-4 border-t border-white/5 bg-black/40 flex items-center justify-between text-[11px] text-white/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {isEs
                ? "Di por voz: 'Conecta Google Drive', 'Abre Gmail' o 'Cierra integraciones'"
                : "Say: 'Connect Google Drive', 'Open Gmail' or 'Close integrations'"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs transition-colors"
          >
            {isEs ? "Cerrar" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
};
