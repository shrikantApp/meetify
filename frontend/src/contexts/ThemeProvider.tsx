/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ThemePresetId =
  | "aubergine"
  | "huddle"
  | "monument"
  | "dark"
  | "ocean"
  | "light";

export interface CustomThemeColors {
  systemNav: string;
  selectedItems: string;
  presence: string;
  notifications: string;
  windowGradient: boolean;
}

interface ThemeContextType {
  mode: ThemeMode;
  accentColor: string;
  presetId: ThemePresetId;
  customTheme: CustomThemeColors;
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: string) => void;
  setPresetId: (presetId: ThemePresetId) => void;
  updateCustomTheme: (patch: Partial<CustomThemeColors>) => void;
  resetCustomTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const SLACK_THEMES: Record<
  ThemePresetId,
  {
    label: string;
    primary: string;
    primary_text?: string;
    sidebar: string;
    sidebar_text?: string;
    active: string;
  }
> = {
  aubergine: {
    label: "Aubergine",
    primary: "#3F0E40",
    sidebar: "#3F0E40",
    active: "#1164A3",
    primary_text: "#ffffff",
    sidebar_text: "#ffffff",
  },
  huddle: {
    label: "Huddle",
    primary: "#1D1C1D",
    sidebar: "#1D1C1D",
    active: "#1164A3",
    primary_text: "#ffffff",
    sidebar_text: "#ffffff",
  },
  monument: {
    label: "Monument",
    primary: "#004A5E",
    sidebar: "#004A5E",
    active: "#E8912D",
    primary_text: "#ffffff",
    sidebar_text: "#ffffff",
  },
  dark: {
    label: "Gray",
    primary: "#1A1D21",
    sidebar: "#19171D",
    active: "#1164A3",
    primary_text: "#ffffff",
    sidebar_text: "#ffffff",
  },
  ocean: {
    label: "Lagoon",
    primary: "#2D545E",
    sidebar: "#2D545E",
    active: "#C89666",
    primary_text: "#ffffff",
    sidebar_text: "#ffffff",
  },
  light: {
    label: "Light",
    primary: "#ffffff",
    sidebar: "#f8f8f8",
    primary_text: "#1d1c1d",
    sidebar_text: "#1d1c1d",
    active: "#1164A3",
  },
};

const DEFAULT_PRESET_ID: ThemePresetId = "aubergine";

const DEFAULT_CUSTOM_THEME: CustomThemeColors = {
  systemNav: "#3F0E40",
  selectedItems: "#1164A3",
  presence: "#007A5A",
  notifications: "#E01E5A",
  windowGradient: true,
};

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

const isThemePresetId = (value: string | null): value is ThemePresetId =>
  value === "aubergine" ||
  value === "huddle" ||
  value === "monument" ||
  value === "dark" ||
  value === "ocean" ||
  value === "light";

const parseCustomTheme = (): CustomThemeColors => {
  try {
    const raw = localStorage.getItem("meetify_custom_theme");
    if (!raw) return DEFAULT_CUSTOM_THEME;
    const parsed = JSON.parse(raw) as Partial<CustomThemeColors>;
    return {
      systemNav: parsed.systemNav || DEFAULT_CUSTOM_THEME.systemNav,
      selectedItems: parsed.selectedItems || DEFAULT_CUSTOM_THEME.selectedItems,
      presence: parsed.presence || DEFAULT_CUSTOM_THEME.presence,
      notifications: parsed.notifications || DEFAULT_CUSTOM_THEME.notifications,
      windowGradient:
        parsed.windowGradient ?? DEFAULT_CUSTOM_THEME.windowGradient,
    };
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("meetify_theme_mode");
    return isThemeMode(saved) ? saved : "light";
  });

  const [presetId, setPresetId] = useState<ThemePresetId>(() => {
    const saved = localStorage.getItem("meetify_theme_preset");
    return isThemePresetId(saved) ? saved : DEFAULT_PRESET_ID;
  });

  const [customTheme, setCustomTheme] = useState<CustomThemeColors>(() =>
    parseCustomTheme(),
  );

  const accentColor = useMemo(() => SLACK_THEMES[presetId].sidebar, [presetId]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyMode = () => {
      const systemTheme = mediaQuery.matches ? "dark" : "light";
      // "light" preset always forces light class
      const activeTheme =
        presetId === "light" ? "light" : mode === "system" ? systemTheme : mode;
      root.classList.remove("light", "dark");
      root.classList.add(activeTheme);
    };

    applyMode();
    mediaQuery.addEventListener?.("change", applyMode);
    localStorage.setItem("meetify_theme_mode", mode);

    return () => mediaQuery.removeEventListener?.("change", applyMode);
  }, [mode, presetId]);

  useEffect(() => {
    const root = window.document.documentElement;
    const preset = SLACK_THEMES[presetId];
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    // "light" preset always forces light appearance regardless of mode setting
    const activeTheme =
      presetId === "light" ? "light" : mode === "system" ? systemTheme : mode;

    root.style.setProperty("--slack-primary", customTheme.systemNav);
    root.style.setProperty("--slack-sidebar", preset.sidebar);
    root.style.setProperty("--slack-active", customTheme.selectedItems);
    root.style.setProperty("--slack-accent", customTheme.presence);
    root.style.setProperty("--slack-notification", customTheme.notifications);
    root.style.setProperty(
      "--meetify-window-gradient",
      customTheme.windowGradient ? "1" : "0",
    );

    // Preset-specific text colors for elements sitting ON TOP of primary/sidebar backgrounds.
    // Dark presets default to white; light preset uses dark text.
    const defaultPrimaryText = activeTheme === "dark" ? "#ffffff" : "#1d1c1d";
    root.style.setProperty(
      "--slack-primary-text",
      preset.primary_text ?? defaultPrimaryText,
    );
    root.style.setProperty(
      "--slack-sidebar-text",
      preset.sidebar_text ?? defaultPrimaryText,
    );
    // Button Theme Variables
    root.style.setProperty("--button-primary-bg", customTheme.selectedItems);
    root.style.setProperty("--button-primary-text", "#ffffff");

    root.style.setProperty("--button-secondary-bg", preset.sidebar);
    root.style.setProperty(
      "--button-secondary-text",
      preset.sidebar_text ?? "#ffffff",
    );

    root.style.setProperty("--button-ghost-text", "var(--slack-text-muted)");

    root.style.setProperty("--button-danger-bg", customTheme.notifications);
    root.style.setProperty("--button-danger-text", "#ffffff");

    if (activeTheme === "dark") {
      root.style.setProperty("--slack-bg", "#1A1D21");
      root.style.setProperty("--slack-text", "#D1D2D3");
      root.style.setProperty("--slack-border", "#35373B");
      root.style.setProperty("--slack-input-bg", "#222529");
      root.style.setProperty("--slack-hover", "#2D3136");
      root.style.setProperty("--slack-text-muted", "#9E9FA1");
      root.style.setProperty("--button-outline-border", "#ffffff");
      root.style.setProperty("--button-outline-text", "#ffffff");
    } else {
      root.style.setProperty("--slack-bg", "#ffffff");
      root.style.setProperty("--slack-text", "#1D1C1D");
      root.style.setProperty("--slack-border", "#E2E2E2");
      root.style.setProperty("--slack-input-bg", "#FFFFFF");
      root.style.setProperty("--slack-hover", "#F0F0F0");
      root.style.setProperty("--slack-text-muted", "#616061");

      root.style.setProperty("--button-outline-border", "var(--slack-border)");
      root.style.setProperty("--button-outline-text", "var(--slack-text)");
    }

    localStorage.setItem("meetify_theme_preset", presetId);
    localStorage.setItem("meetify_accent_color", preset.sidebar);
    localStorage.setItem("meetify_custom_theme", JSON.stringify(customTheme));
  }, [customTheme, mode, presetId]);

  const updateCustomTheme = (patch: Partial<CustomThemeColors>) => {
    setCustomTheme((current) => ({ ...current, ...patch }));
  };

  const resetCustomTheme = () => {
    setCustomTheme(DEFAULT_CUSTOM_THEME);
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        accentColor,
        presetId,
        customTheme,
        setMode,
        setAccentColor: (color) => {
          const matchedPreset = (Object.entries(SLACK_THEMES).find(
            ([, theme]) => theme.sidebar === color,
          )?.[0] ?? DEFAULT_PRESET_ID) as ThemePresetId;
          setPresetId(matchedPreset);
        },
        setPresetId,
        updateCustomTheme,
        resetCustomTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
