// src/context/SettingsContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../theme/colors';
import { Theme } from '../types';

const SETTINGS_STORAGE_KEY = '@gastroia/settings';

export type AppLanguage = 'es' | 'en';

interface SettingsContextType {
  darkMode: boolean;
  notificationsEnabled: boolean;
  language: AppLanguage;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  setNotificationsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setLanguage: React.Dispatch<React.SetStateAction<AppLanguage>>;
  theme: Theme;
}

export const SettingsContext = createContext<SettingsContextType>({
  darkMode: false,
  notificationsEnabled: true,
  language: 'es',
  setDarkMode: () => {},
  setNotificationsEnabled: () => {},
  setLanguage: () => {},
  theme: lightTheme,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Centraliza ajustes globales de apariencia, idioma y notificaciones.
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [language, setLanguage] = useState<AppLanguage>('es');
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    // Rehidrata preferencias persistidas antes de aceptar nuevas escrituras.
    const loadSettings = async () => {
      try {
        // Carga preferencias visuales y de notificaciones desde almacenamiento local.
        const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as {
          darkMode?: boolean;
          notificationsEnabled?: boolean;
          language?: AppLanguage;
        };

        if (typeof parsed.darkMode === 'boolean') {
          setDarkMode(parsed.darkMode);
        }
        if (typeof parsed.notificationsEnabled === 'boolean') {
          setNotificationsEnabled(parsed.notificationsEnabled);
        }
        if (parsed.language === 'es' || parsed.language === 'en') {
          setLanguage(parsed.language);
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
      JSON.stringify({ darkMode, notificationsEnabled, language })
    );
  }, [darkMode, notificationsEnabled, language, hydrated]);

  // Deriva la paleta global a partir del modo visual activo.
  // Seleccion de paleta global derivada del modo actual.
  const theme = useMemo<Theme>(() => (darkMode ? darkTheme : lightTheme), [darkMode]);

  return (
    <SettingsContext.Provider
      value={{
        darkMode,
        notificationsEnabled,
        language,
        setDarkMode,
        setNotificationsEnabled,
        setLanguage,
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
