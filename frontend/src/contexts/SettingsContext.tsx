import React, { createContext, useContext, useState, useEffect } from 'react';

interface Settings {
  fontSize: number; // 12-20
  iconSize: number; // 16-28
  buttonSize: number; // 32-56
  theme: 'light' | 'dark';
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
  fontSize: 14,
  iconSize: 20,
  buttonSize: 42,
  theme: 'dark',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('meetify_ui_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('meetify_ui_settings', JSON.stringify(settings));
    
    // Apply settings to document root
    const root = document.documentElement;
    root.style.setProperty('--ui-font-size', `${settings.fontSize}px`);
    root.style.setProperty('--ui-icon-size', `${settings.iconSize}px`);
    root.style.setProperty('--ui-button-size', `${settings.buttonSize}px`);
    
    if (settings.theme === 'light') {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    } else {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
