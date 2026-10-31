import { AgentItem, OrbColorPalette, UserPreferences } from "../types";

export const ORB_PRESETS: OrbColorPalette[] = [
  {
    id: "magenta-twilight",
    name: "Twilight Magenta",
    nameEs: "Magenta Crepúsculo",
    primaryHex: "#e84cb8",
    secondaryHex: "#8020a0",
    accentHex: "#ff5c8a",
    glowHex: "#d946ef",
    description: "Original deep violet with vibrant neon magenta fluid waves",
    descriptionEs: "Violeta profundo original con ondas fluidas en magenta neón",
    colorA: [0.035, 0.012, 0.055],
    colorB: [0.808, 0.173, 0.796],
    colorC: [1.0, 0.361, 0.443],
    colorD: [0.482, 0.325, 1.0],
    highlightColor: [1.0, 0.851, 0.941],
    glowColor: [0.85, 0.27, 0.93],
  },
  {
    id: "cyan-cyber",
    name: "Cyber Cyan",
    nameEs: "Cian Cibernético",
    primaryHex: "#06b6d4",
    secondaryHex: "#0284c7",
    accentHex: "#38bdf8",
    glowHex: "#06b6d4",
    description: "Futuristic luminescent aqua and crystalline blue pulses",
    descriptionEs: "Aqua luminiscente futurista y pulsos azul cristalino",
    colorA: [0.008, 0.025, 0.045],
    colorB: [0.024, 0.714, 0.831],
    colorC: [0.22, 0.741, 0.973],
    colorD: [0.008, 0.518, 0.78],
    highlightColor: [0.8, 0.96, 1.0],
    glowColor: [0.024, 0.714, 0.831],
  },
  {
    id: "emerald-aurora",
    name: "Emerald Aurora",
    nameEs: "Aurora Esmeralda",
    primaryHex: "#10b981",
    secondaryHex: "#047857",
    accentHex: "#a3e635",
    glowHex: "#10b981",
    description: "Vibrant organic bioluminescence and northern green shimmer",
    descriptionEs: "Bioluminiscencia orgánica vibrante y destellos verde boreal",
    colorA: [0.008, 0.04, 0.02],
    colorB: [0.063, 0.725, 0.506],
    colorC: [0.639, 0.902, 0.208],
    colorD: [0.016, 0.471, 0.341],
    highlightColor: [0.85, 1.0, 0.9],
    glowColor: [0.063, 0.725, 0.506],
  },
  {
    id: "solar-amber",
    name: "Solar Amber",
    nameEs: "Ámbar Solar",
    primaryHex: "#f59e0b",
    secondaryHex: "#d97706",
    accentHex: "#ef4444",
    glowHex: "#f59e0b",
    description: "Warm radiant plasma, molten gold and fiery solar flares",
    descriptionEs: "Plasma radiante cálido, oro fundido y destellos solares",
    colorA: [0.05, 0.02, 0.008],
    colorB: [0.961, 0.62, 0.043],
    colorC: [0.937, 0.267, 0.267],
    colorD: [0.851, 0.467, 0.024],
    highlightColor: [1.0, 0.95, 0.82],
    glowColor: [0.961, 0.62, 0.043],
  },
  {
    id: "violet-nebula",
    name: "Cosmic Nebula",
    nameEs: "Nebulosa Cósmica",
    primaryHex: "#8b5cf6",
    secondaryHex: "#6d28d9",
    accentHex: "#ec4899",
    glowHex: "#8b5cf6",
    description: "Deep interstellar ultraviolet with electric starlight accents",
    descriptionEs: "Ultravioleta interestelar profundo con acentos de luz estelar",
    colorA: [0.025, 0.01, 0.05],
    colorB: [0.545, 0.361, 0.965],
    colorC: [0.925, 0.282, 0.6],
    colorD: [0.427, 0.157, 0.851],
    highlightColor: [0.92, 0.88, 1.0],
    glowColor: [0.545, 0.361, 0.965],
  },
  {
    id: "ruby-crimson",
    name: "Ruby Crimson",
    nameEs: "Carmesí Rubí",
    primaryHex: "#f43f5e",
    secondaryHex: "#be123c",
    accentHex: "#fda4af",
    glowHex: "#f43f5e",
    description: "High-energy velvet red and deep volcanic thermal glow",
    descriptionEs: "Rojo terciopelo de alta energía y brillo térmico volcánico",
    colorA: [0.045, 0.008, 0.015],
    colorB: [0.957, 0.247, 0.369],
    colorC: [0.992, 0.643, 0.686],
    colorD: [0.745, 0.071, 0.235],
    highlightColor: [1.0, 0.88, 0.9],
    glowColor: [0.957, 0.247, 0.369],
  },
  {
    id: "arctic-frost",
    name: "Arctic Frost",
    nameEs: "Escarcha Ártica",
    primaryHex: "#38bdf8",
    secondaryHex: "#0284c7",
    accentHex: "#ffffff",
    glowHex: "#38bdf8",
    description: "Crisp glacial blue and pure crystalline diamond reflections",
    descriptionEs: "Azul glacial nítido y reflejos puros de diamante cristalino",
    colorA: [0.01, 0.02, 0.04],
    colorB: [0.22, 0.741, 0.973],
    colorC: [0.85, 0.95, 1.0],
    colorD: [0.008, 0.518, 0.78],
    highlightColor: [1.0, 1.0, 1.0],
    glowColor: [0.22, 0.741, 0.973],
  },
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  orbPresetId: "magenta-twilight",
  customPrimaryColor: "#06b6d4",
  customSecondaryColor: "#8b5cf6",
  customGlowColor: "#06b6d4",
  glowIntensity: 1.0,
  speedMultiplier: 1.0,
  fluidReactivity: 1.0,
  glassRefraction: true,
  soundEffects: false, // Default false to eliminate noisy state transition beeps
};

const STORAGE_KEY = "cortex_user_preferences_v1";

// Helper: Convert hex string to RGB tuple [0..1, 0..1, 0..1]
export function hexToRgb01(hex: string): [number, number, number] {
  let cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (cleanHex.length !== 6) {
    return [0.5, 0.5, 0.5];
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
}

// Generate full dynamic color palette from custom user primary & secondary colors
export function buildCustomPalette(
  primaryHex: string,
  secondaryHex: string,
  glowHex: string
): OrbColorPalette {
  const pRgb = hexToRgb01(primaryHex);
  const sRgb = hexToRgb01(secondaryHex);
  const gRgb = hexToRgb01(glowHex);

  return {
    id: "custom",
    name: "Custom Palette",
    nameEs: "Paleta Personalizada",
    primaryHex,
    secondaryHex,
    accentHex: primaryHex,
    glowHex,
    description: "Custom user-defined spectrum and fluid resonance",
    descriptionEs: "Espectro y resonancia fluida definida por el usuario",
    colorA: [pRgb[0] * 0.08, pRgb[1] * 0.08, pRgb[2] * 0.08],
    colorB: pRgb,
    colorC: [(pRgb[0] + sRgb[0]) * 0.5, (pRgb[1] + sRgb[1]) * 0.5, (pRgb[2] + sRgb[2]) * 0.5],
    colorD: sRgb,
    highlightColor: [
      Math.min(1, pRgb[0] * 0.6 + 0.4),
      Math.min(1, pRgb[1] * 0.6 + 0.4),
      Math.min(1, pRgb[2] * 0.6 + 0.4),
    ],
    glowColor: gRgb,
  };
}

export class PreferencesStore {
  private static listeners: Array<(prefs: UserPreferences) => void> = [];

  public static getPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn("Could not load user preferences from localStorage:", e);
    }
    return { ...DEFAULT_PREFERENCES };
  }

  public static savePreferences(prefs: Partial<UserPreferences>): UserPreferences {
    const current = this.getPreferences();
    const updated = { ...current, ...prefs };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save preferences to localStorage:", e);
    }
    this.notifyListeners(updated);
    return updated;
  }

  public static resetPreferences(): UserPreferences {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Could not clear preferences:", e);
    }
    this.notifyListeners(DEFAULT_PREFERENCES);
    return DEFAULT_PREFERENCES;
  }

  public static getActivePalette(prefs: UserPreferences): OrbColorPalette {
    if (prefs.orbPresetId === "custom") {
      return buildCustomPalette(
        prefs.customPrimaryColor,
        prefs.customSecondaryColor,
        prefs.customGlowColor
      );
    }
    const found = ORB_PRESETS.find((p) => p.id === prefs.orbPresetId);
    return found || ORB_PRESETS[0];
  }

  public static getPaletteForAgent(agent?: AgentItem | null): OrbColorPalette {
    if (!agent) {
      return this.getActivePalette(this.getPreferences());
    }
    if (agent.theme?.presetId) {
      const found = ORB_PRESETS.find((p) => p.id === agent.theme.presetId);
      if (found) {
        return found;
      }
    }
    if (agent.theme?.primaryHex) {
      return buildCustomPalette(
        agent.theme.primaryHex,
        agent.theme.secondaryHex || agent.theme.primaryHex,
        agent.theme.glowHex || agent.theme.primaryHex
      );
    }
    return ORB_PRESETS.find((p) => p.id === "cyan-cyber") || ORB_PRESETS[0];
  }

  public static subscribe(callback: (prefs: UserPreferences) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private static notifyListeners(prefs: UserPreferences) {
    this.listeners.forEach((l) => {
      try {
        l(prefs);
      } catch (err) {
        console.error("Error in preference listener:", err);
      }
    });
  }
}
