import { useState, useEffect } from "react";
import {
  ORB_PRESETS,
  PreferencesStore,
  DEFAULT_PREFERENCES,
  buildCustomPalette,
} from "../lib/preferencesStore";
import { UserPreferences, OrbColorPalette } from "../types";
import {
  X,
  Palette,
  Sliders,
  Sparkles,
  RotateCcw,
  Check,
  Zap,
  Volume2,
  VolumeX,
  Eye,
  Layers,
} from "lucide-react";

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: "es-ES" | "en-US";
}

export function PreferencesModal({ isOpen, onClose, language }: PreferencesModalProps) {
  const [prefs, setPrefs] = useState<UserPreferences>(() => PreferencesStore.getPreferences());
  const [activeTab, setActiveTab] = useState<"colors" | "dynamics" | "audio">("colors");

  useEffect(() => {
    if (isOpen) {
      setPrefs(PreferencesStore.getPreferences());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activePalette = PreferencesStore.getActivePalette(prefs);
  const isEs = language === "es-ES";

  function handleSelectPreset(presetId: string) {
    const updated = PreferencesStore.savePreferences({ orbPresetId: presetId });
    setPrefs(updated);
  }

  function handleCustomColorChange(key: "customPrimaryColor" | "customSecondaryColor" | "customGlowColor", value: string) {
    const updated = PreferencesStore.savePreferences({
      orbPresetId: "custom",
      [key]: value,
    });
    setPrefs(updated);
  }

  function handleSliderChange(key: keyof UserPreferences, value: number | boolean) {
    const updated = PreferencesStore.savePreferences({ [key]: value });
    setPrefs(updated);
  }

  function handleReset() {
    const reset = PreferencesStore.resetPreferences();
    setPrefs(reset);
  }

  return (
    <div
      id="cortex-preferences-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
    >
      <div
        id="cortex-preferences-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] bg-[#0c0c14] border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-white"
        style={{
          boxShadow: `0 0 40px ${activePalette.glowHex}22, 0 20px 40px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center border transition-colors duration-500"
              style={{
                backgroundColor: `${activePalette.glowHex}20`,
                borderColor: `${activePalette.glowHex}50`,
                color: activePalette.glowHex,
              }}
            >
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide flex items-center gap-2">
                <span>{isEs ? "Preferencias de Cortex" : "Cortex Preferences"}</span>
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: activePalette.glowHex }}
                />
              </h2>
              <p className="text-[11px] text-white/40">
                {isEs
                  ? "Personaliza el color de la burbuja, dinámica fluida y audio"
                  : "Customize orb colors, fluid dynamics and audio"}
              </p>
            </div>
          </div>

          <button
            id="cortex-preferences-close"
            onClick={onClose}
            className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title={isEs ? "Cerrar" : "Close"}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 flex gap-2 border-b border-white/5 bg-black/20">
          <button
            onClick={() => setActiveTab("colors")}
            className={`pb-2.5 px-3 text-xs font-medium tracking-wide flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "colors"
                ? "border-cyan-400 text-cyan-200"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>{isEs ? "Color de la Burbuja" : "Orb Color & Theme"}</span>
          </button>

          <button
            onClick={() => setActiveTab("dynamics")}
            className={`pb-2.5 px-3 text-xs font-medium tracking-wide flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "dynamics"
                ? "border-cyan-400 text-cyan-200"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isEs ? "Dinámica y Aura" : "Dynamics & Aura"}</span>
          </button>

          <button
            onClick={() => setActiveTab("audio")}
            className={`pb-2.5 px-3 text-xs font-medium tracking-wide flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "audio"
                ? "border-cyan-400 text-cyan-200"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{isEs ? "Audio & Sistema" : "Audio & System"}</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-grow custom-scrollbar max-h-[60vh]">
          {/* TAB 1: ORB COLORS */}
          {activeTab === "colors" && (
            <div className="space-y-6 animate-fade-in">
              {/* Live Preview Swatch Banner */}
              <div
                className="p-4 rounded-2xl border flex items-center justify-between relative overflow-hidden transition-all duration-500"
                style={{
                  backgroundColor: `${activePalette.glowHex}10`,
                  borderColor: `${activePalette.glowHex}30`,
                }}
              >
                <div className="flex items-center gap-3.5 relative z-10">
                  <div
                    className="w-11 h-11 rounded-full border border-white/20 shadow-lg flex items-center justify-center transition-all duration-500"
                    style={{
                      background: `linear-gradient(135deg, ${activePalette.primaryHex} 0%, ${activePalette.secondaryHex} 50%, ${activePalette.accentHex} 100%)`,
                      boxShadow: `0 0 20px ${activePalette.glowHex}`,
                    }}
                  >
                    <Sparkles className="w-5 h-5 text-white/90 drop-shadow" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold block">
                      {isEs ? "Paleta Activa" : "Active Palette"}
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      {isEs ? activePalette.nameEs : activePalette.name}
                    </h3>
                    <p className="text-[11px] text-white/60">
                      {isEs ? activePalette.descriptionEs : activePalette.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 relative z-10">
                  {[activePalette.primaryHex, activePalette.secondaryHex, activePalette.accentHex, activePalette.glowHex].map((hex, i) => (
                    <span
                      key={i}
                      className="w-4 h-4 rounded-full border border-white/20"
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                </div>

                <div
                  className="absolute right-0 top-0 bottom-0 w-32 blur-3xl opacity-30 pointer-events-none transition-colors duration-500"
                  style={{ backgroundColor: activePalette.glowHex }}
                />
              </div>

              {/* Preset Color Grid */}
              <div>
                <label className="text-[11px] uppercase tracking-widest text-white/50 font-semibold block mb-3">
                  {isEs ? "Colección de Paletas Prediseñadas" : "Curated Color Themes"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ORB_PRESETS.map((preset) => {
                    const isSelected = prefs.orbPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        id={`cortex-preset-${preset.id}`}
                        onClick={() => handleSelectPreset(preset.id)}
                        className={`p-3 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "border-white/40 bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                            : "border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/15"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full border border-white/20 flex-shrink-0 transition-transform"
                            style={{
                              background: `linear-gradient(135deg, ${preset.primaryHex}, ${preset.secondaryHex})`,
                              boxShadow: isSelected ? `0 0 12px ${preset.glowHex}` : "none",
                            }}
                          />
                          <div>
                            <div className="text-xs font-semibold text-white/90">
                              {isEs ? preset.nameEs : preset.name}
                            </div>
                            <div className="text-[10px] text-white/40 line-clamp-1">
                              {isEs ? preset.descriptionEs : preset.description}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-black font-bold flex-shrink-0"
                            style={{ backgroundColor: preset.glowHex }}
                          >
                            <Check className="w-3 h-3 text-white stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Color Creator */}
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-widest text-white/50 font-semibold block">
                      {isEs ? "Personalizador de Color Libre" : "Custom Color Spectrum"}
                    </label>
                    <span className="text-[10px] text-white/40">
                      {isEs
                        ? "Define tus propios colores hexadecimales y resplandor para el fluido"
                        : "Define your own hex colors and aura glow for the fluid"}
                    </span>
                  </div>

                  {prefs.orbPresetId === "custom" && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-semibold tracking-wide border border-cyan-500/30">
                      {isEs ? "Personalizado Activo" : "Custom Active"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Primary Color Picker */}
                  <div className="bg-white/[0.03] border border-white/5 p-3 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] text-white/60 font-medium">
                      {isEs ? "Color Primario" : "Primary Fluid"}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={prefs.customPrimaryColor}
                        onChange={(e) => handleCustomColorChange("customPrimaryColor", e.target.value)}
                        className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={prefs.customPrimaryColor}
                        onChange={(e) => handleCustomColorChange("customPrimaryColor", e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-mono uppercase text-white focus:outline-none focus:border-cyan-500"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Secondary Color Picker */}
                  <div className="bg-white/[0.03] border border-white/5 p-3 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] text-white/60 font-medium">
                      {isEs ? "Color Secundario" : "Secondary Fluid"}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={prefs.customSecondaryColor}
                        onChange={(e) => handleCustomColorChange("customSecondaryColor", e.target.value)}
                        className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={prefs.customSecondaryColor}
                        onChange={(e) => handleCustomColorChange("customSecondaryColor", e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-mono uppercase text-white focus:outline-none focus:border-cyan-500"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Glow Aura Picker */}
                  <div className="bg-white/[0.03] border border-white/5 p-3 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] text-white/60 font-medium">
                      {isEs ? "Resplandor (Aura)" : "Aura Glow"}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={prefs.customGlowColor}
                        onChange={(e) => handleCustomColorChange("customGlowColor", e.target.value)}
                        className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={prefs.customGlowColor}
                        onChange={(e) => handleCustomColorChange("customGlowColor", e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-mono uppercase text-white focus:outline-none focus:border-cyan-500"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DYNAMICS & AURA */}
          {activeTab === "dynamics" && (
            <div className="space-y-6 animate-fade-in">
              {/* Glow Intensity Slider */}
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-white/90">
                      {isEs ? "Intensidad del Resplandor (Glow Aura)" : "Glow & Aura Intensity"}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {Math.round(prefs.glowIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="2.0"
                  step="0.05"
                  value={prefs.glowIntensity}
                  onChange={(e) => handleSliderChange("glowIntensity", parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[9px] text-white/30 uppercase tracking-wider">
                  <span>{isEs ? "Sutil" : "Subtle"}</span>
                  <span>{isEs ? "Estándar" : "Standard"}</span>
                  <span>{isEs ? "Luminiscente" : "Vibrant"}</span>
                </div>
              </div>

              {/* Speed Multiplier Slider */}
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-white/90">
                      {isEs ? "Velocidad de Ondulación Fluida" : "Fluid Wave Speed"}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {prefs.speedMultiplier}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={prefs.speedMultiplier}
                  onChange={(e) => handleSliderChange("speedMultiplier", parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[9px] text-white/30 uppercase tracking-wider">
                  <span>{isEs ? "Calma" : "Calm (0.5x)"}</span>
                  <span>1.0x</span>
                  <span>{isEs ? "Dinámico" : "Dynamic (2.0x)"}</span>
                </div>
              </div>

              {/* Fluid Reactivity Slider */}
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-white/90">
                      {isEs ? "Reactividad Acústica de Deformación" : "Acoustic Deform Reactivity"}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {Math.round(prefs.fluidReactivity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={prefs.fluidReactivity}
                  onChange={(e) => handleSliderChange("fluidReactivity", parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[9px] text-white/30 uppercase tracking-wider">
                  <span>{isEs ? "Suave" : "Soft"}</span>
                  <span>{isEs ? "Balanceado" : "Balanced"}</span>
                  <span>{isEs ? "Alta Resonancia" : "High Resonance"}</span>
                </div>
              </div>

              {/* Glass Shell Refraction Toggle */}
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white/90 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span>{isEs ? "Capa de Refracción de Cristal" : "Glass Liquid Shell"}</span>
                  </div>
                  <span className="text-[10px] text-white/40 block mt-0.5">
                    {isEs
                      ? "Añade reflejos especulares ópticos y aberración cromática realista"
                      : "Adds specular highlights and realistic optical chromatic refraction"}
                  </span>
                </div>
                <button
                  onClick={() => handleSliderChange("glassRefraction", !prefs.glassRefraction)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                    prefs.glassRefraction ? "bg-cyan-500" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      prefs.glassRefraction ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIO & SYSTEM */}
          {activeTab === "audio" && (
            <div className="space-y-6 animate-fade-in">
              {/* Sound Effects Toggle */}
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white/90 flex items-center gap-2">
                    {prefs.soundEffects ? (
                      <Volume2 className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    )}
                    <span>{isEs ? "Efectos de Audio de Interfaz" : "Interface Sound FX"}</span>
                  </div>
                  <span className="text-[10px] text-white/40 block mt-0.5">
                    {isEs
                      ? "Tonos sintéticos al despertar, pausar, interrumpir o conectar sesiones"
                      : "Synthesizer feedback tones upon wake, interrupt, or session connect"}
                  </span>
                </div>
                <button
                  onClick={() => handleSliderChange("soundEffects", !prefs.soundEffects)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                    prefs.soundEffects ? "bg-cyan-500" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      prefs.soundEffects ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Reset to Factory Defaults */}
              <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-950/20 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-rose-200">
                    {isEs ? "Restablecer Ajustes Predeterminados" : "Reset to Defaults"}
                  </div>
                  <span className="text-[10px] text-rose-300/60 block mt-0.5">
                    {isEs
                      ? "Restaura la paleta original y valores iniciales del sistema"
                      : "Restores the original palette and default parameters"}
                  </span>
                </div>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs font-medium transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isEs ? "Restablecer" : "Reset"}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-3.5 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{isEs ? "Restablecer" : "Reset"}</span>
          </button>

          <button
            id="cortex-preferences-save-close"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-black font-semibold text-xs transition-all shadow-lg cursor-pointer"
            style={{
              backgroundColor: activePalette.glowHex,
              boxShadow: `0 0 20px ${activePalette.glowHex}40`,
            }}
          >
            {isEs ? "Listo" : "Done"}
          </button>
        </footer>
      </div>
    </div>
  );
}
