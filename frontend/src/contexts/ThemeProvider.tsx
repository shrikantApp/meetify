import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  accentColor: string;
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const SLACK_THEMES = {
  aubergine: { primary: '#3F0E40', sidebar: '#3F0E40', active: '#1164A3' },
  huddle: { primary: '#1D1C1D', sidebar: '#1D1C1D', active: '#1164A3' },
  monument: { primary: '#004A5E', sidebar: '#004A5E', active: '#E8912D' },
  dark: { primary: '#1A1D21', sidebar: '#19171D', active: '#1164A3' },
  ocean: { primary: '#2D545E', sidebar: '#2D545E', active: '#C89666' },
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('meetify_theme_mode') as ThemeMode) || 'light';
  });
  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('meetify_accent_color') || '#3F0E40';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const activeTheme = mode === 'system' ? systemTheme : mode;
    root.classList.add(activeTheme);

    localStorage.setItem('meetify_theme_mode', mode);
  }, [mode]);

  useEffect(() => {
    const root = window.document.documentElement;
    const theme = Object.values(SLACK_THEMES).find(t => t.sidebar === accentColor) || SLACK_THEMES.aubergine;

    root.style.setProperty('--slack-primary', accentColor);
    root.style.setProperty('--slack-sidebar', theme.sidebar);
    root.style.setProperty('--slack-active', theme.active);

    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const activeTheme = mode === 'system' ? systemTheme : mode;

    if (activeTheme === 'dark') {
      root.style.setProperty('--slack-bg', '#1A1D21');
      root.style.setProperty('--slack-text', '#D1D2D3');
      root.style.setProperty('--slack-border', '#35373B');
    } else {
      root.style.setProperty('--slack-bg', '#ffffff');
      root.style.setProperty('--slack-text', '#1D1C1D');
      root.style.setProperty('--slack-border', '#E2E2E2');
    }

    localStorage.setItem('meetify_accent_color', accentColor);
  }, [accentColor, mode]);

  return (
    <ThemeContext.Provider value={{ mode, accentColor, setMode, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
