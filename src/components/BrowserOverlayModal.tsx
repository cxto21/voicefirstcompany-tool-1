import React, { useState, useEffect } from "react";
import {
  X,
  Globe,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  ExternalLink,
  Search,
  Maximize2,
  Minimize2,
  Mic,
  Sparkles,
  BookOpen,
  Code2,
  Newspaper,
  Compass,
} from "lucide-react";
import { soundFx } from "../lib/audioManager";

interface BrowserOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
  onNavigate?: (url: string) => void;
  language: "es-ES" | "en-US";
  isVoiceActive?: boolean;
}

const PRESET_BOOKMARKS = [
  {
    name: "Wikipedia",
    url: "https://en.m.wikipedia.org/wiki/Special:Random",
    icon: BookOpen,
    category: "Knowledge",
  },
  {
    name: "MDN Web Docs",
    url: "https://developer.mozilla.org/en-US/docs/Web/API",
    icon: Code2,
    category: "Docs",
  },
  {
    name: "Hacker News",
    url: "https://news.ycombinator.com",
    icon: Newspaper,
    category: "Tech",
  },
  {
    name: "Google Search",
    url: "https://www.google.com/search?igu=1&q=artificial+intelligence",
    icon: Search,
    category: "Search",
  },
];

export const BrowserOverlayModal: React.FC<BrowserOverlayModalProps> = ({
  isOpen,
  onClose,
  initialUrl = "https://en.m.wikipedia.org/wiki/Artificial_intelligence",
  onNavigate,
  language,
  isVoiceActive = true,
}) => {
  const [currentUrl, setCurrentUrl] = useState<string>(initialUrl);
  const [inputUrl, setInputUrl] = useState<string>(initialUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [historyStack, setHistoryStack] = useState<string[]>([initialUrl]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [iframeKey, setIframeKey] = useState<number>(0);

  const isEs = language === "es-ES";

  useEffect(() => {
    if (initialUrl && initialUrl !== currentUrl) {
      setCurrentUrl(initialUrl);
      setInputUrl(initialUrl);
      setHistoryStack((prev) => [...prev, initialUrl]);
      setHistoryIndex((prev) => prev + 1);
    }
  }, [initialUrl]);

  if (!isOpen) return null;

  const navigateTo = (rawUrl: string) => {
    let target = rawUrl.trim();
    if (!target) return;

    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      if (target.includes(".") && !target.includes(" ")) {
        target = `https://${target}`;
      } else {
        target = `https://www.google.com/search?igu=1&q=${encodeURIComponent(target)}`;
      }
    }

    setIsLoading(true);
    setCurrentUrl(target);
    setInputUrl(target);
    setIframeKey((k) => k + 1);

    const newStack = historyStack.slice(0, historyIndex + 1);
    newStack.push(target);
    setHistoryStack(newStack);
    setHistoryIndex(newStack.length - 1);

    onNavigate?.(target);
    soundFx.playWake();

    setTimeout(() => setIsLoading(false), 800);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo(inputUrl);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prevUrl = historyStack[historyIndex - 1];
      setHistoryIndex((idx) => idx - 1);
      setCurrentUrl(prevUrl);
      setInputUrl(prevUrl);
      setIframeKey((k) => k + 1);
    }
  };

  const handleForward = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextUrl = historyStack[historyIndex + 1];
      setHistoryIndex((idx) => idx + 1);
      setCurrentUrl(nextUrl);
      setInputUrl(nextUrl);
      setIframeKey((k) => k + 1);
    }
  };

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey((k) => k + 1);
    setTimeout(() => setIsLoading(false), 600);
  };

  return (
    <div
      id="cortex-browser-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="cortex-browser-card"
        className={`w-full flex flex-col rounded-3xl bg-neutral-950/90 border border-white/10 backdrop-blur-2xl shadow-[0_30px_90px_rgba(0,0,0,0.9)] text-white overflow-hidden transition-all duration-300 ${
          isFullscreen
            ? "h-[96vh] max-w-[98vw]"
            : "h-[85vh] max-w-5xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Browser Top Navigation Bar */}
        <div className="flex flex-col border-b border-white/10 bg-neutral-900/60 p-3 sm:px-4 sm:py-3 gap-2.5">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3">
            {/* Window buttons & title */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onClose}
                  className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors"
                  title={isEs ? "Cerrar navegador" : "Close browser"}
                />
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 transition-colors"
                  title={isEs ? "Alternar tamaño" : "Toggle size"}
                />
                <button
                  onClick={handleReload}
                  className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-400 transition-colors"
                  title={isEs ? "Recargar" : "Reload"}
                />
              </div>

              <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                <div className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                  <Globe className="w-3 h-3" />
                </div>
                <span className="text-xs font-medium text-white/80 tracking-wide hidden sm:inline">
                  {isEs ? "Navegador Web Cortex" : "Cortex Web Browser"}
                </span>
              </div>
            </div>

            {/* Voice-first listener indicator */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-[10px] text-cyan-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="truncate max-w-[200px] sm:max-w-none">
                {isEs ? "Voz activa: 'Cierra el navegador' o 'Navega a...'" : "Voice active: 'Close browser' or 'Navigate to...'"}
              </span>
            </div>

            {/* Window controls */}
            <div className="flex items-center gap-1.5">
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title={isEs ? "Abrir en nueva pestaña" : "Open in new tab"}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-red-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Navigation URL Bar & Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={handleBack}
                disabled={historyIndex <= 0}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-white/70"
                title={isEs ? "Atrás" : "Back"}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleForward}
                disabled={historyIndex >= historyStack.length - 1}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-white/70"
                title={isEs ? "Adelante" : "Forward"}
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleReload}
                className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 ${
                  isLoading ? "animate-spin text-cyan-400" : ""
                }`}
                title={isEs ? "Recargar" : "Reload"}
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Input URL form */}
            <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center gap-2">
              <div className="flex-1 relative flex items-center">
                <Search className="absolute left-3 w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder={isEs ? "Escribe una URL o busca en la web..." : "Enter URL or search the web..."}
                  className="w-full pl-9 pr-24 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-white/[0.09] transition-all font-mono"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 text-[10px] text-cyan-200 font-medium transition-colors"
                >
                  {isEs ? "Ir" : "Go"}
                </button>
              </div>
            </form>
          </div>

          {/* Quick preset bookmarks */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 custom-scrollbar">
            <span className="text-[9px] uppercase tracking-wider text-white/30 shrink-0 font-medium">
              {isEs ? "Accesos Rápidos:" : "Quick Links:"}
            </span>
            {PRESET_BOOKMARKS.map((bookmark) => {
              const Icon = bookmark.icon;
              return (
                <button
                  key={bookmark.name}
                  onClick={() => navigateTo(bookmark.url)}
                  className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] text-white/60 hover:text-white transition-colors"
                >
                  <Icon className="w-2.5 h-2.5 text-cyan-400" />
                  <span>{bookmark.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Browser Content Area (Iframe + Reader Fallback) */}
        <div className="flex-1 relative bg-neutral-900/40 overflow-hidden flex flex-col">
          {isLoading && (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse z-10" />
          )}

          <iframe
            key={iframeKey}
            src={currentUrl}
            title="Cortex Web Viewer"
            className="w-full flex-1 border-0 bg-neutral-900"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
            referrerPolicy="no-referrer"
            loading="lazy"
          />

          {/* Voice-First Floating Bar at Bottom of Browser */}
          <div className="px-4 py-2 bg-neutral-950/80 border-t border-white/5 flex items-center justify-between text-[11px] text-white/50">
            <div className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-mono text-[10px] text-white/70 truncate max-w-sm sm:max-w-md">
                {currentUrl}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-[10px] px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors"
            >
              {isEs ? "Cerrar Navegador (Esc)" : "Close Browser (Esc)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
