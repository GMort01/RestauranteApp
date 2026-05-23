// src/context/SettingsContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../theme/colors';
import { Theme } from '../types';

const SETTINGS_STORAGE_KEY = '@gastroia/settings';

interface SettingsContextType {
  darkMode: boolean;
  notificationsEnabled: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  setNotificationsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  theme: Theme;
}

export const SettingsContext = createContext<SettingsContextType>({
  darkMode: false,
  notificationsEnabled: true,
  setDarkMode: () => {},
  setNotificationsEnabled: () => {},
  theme: lightTheme,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Carga preferencias visuales y de notificaciones desde almacenamiento local.
        const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as {
          darkMode?: boolean;
          notificationsEnabled?: boolean;
        };

        if (typeof parsed.darkMode === 'boolean') {
          setDarkMode(parsed.darkMode);
        }
        if (typeof parsed.notificationsEnabled === 'boolean') {
          setNotificationsEnabled(parsed.notificationsEnabled);
        }
      } catch {
        // Ignorar datos corruptos para no romper la app.
      } finally {
        setHydrated(true);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Persistencia reactiva de ajustes del usuario.
    AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ darkMode, notificationsEnabled })
    );
  }, [darkMode, notificationsEnabled, hydrated]);

  // Seleccion de paleta global derivada del modo actual.
  const theme = useMemo<Theme>(() => (darkMode ? darkTheme : lightTheme), [darkMode]);

  return (
    <SettingsContext.Provider
      value={{
        darkMode,
        notificationsEnabled,
        setDarkMode,
        setNotificationsEnabled,
        theme,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  return useContext(SettingsContext);
}
