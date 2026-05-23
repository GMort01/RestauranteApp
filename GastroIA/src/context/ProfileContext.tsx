// src/context/ProfileContext.tsx
import React, { createContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_STORAGE_KEY = '@gastroia/profile';

interface ProfileContextType {
  dietType: string;
  allergyInput: string;
  allergies: string[];
  setDietType: (diet: string) => void;
  setAllergyInput: (input: string) => void;
}

export const ProfileContext = createContext<ProfileContextType>({
  dietType: 'carnivoro',
  allergyInput: '',
  allergies: [],
  setDietType: () => {},
  setAllergyInput: () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [dietType, setDietType] = useState<string>('carnivoro');
  const [allergyInput, setAllergyInput] = useState<string>('');
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as { dietType?: string; allergyInput?: string };

        if (typeof parsed.dietType === 'string') {
          setDietType(parsed.dietType);
        }
        if (typeof parsed.allergyInput === 'string') {
          setAllergyInput(parsed.allergyInput);
        }
      } catch {
        // Ignorar datos corruptos para no romper la app.
      } finally {
        setHydrated(true);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ dietType, allergyInput }));
  }, [dietType, allergyInput, hydrated]);

  const allergies = useMemo(
    () =>
      allergyInput
        .split(',')
        .map((allergy) => allergy.trim().toLowerCase())
        .filter(Boolean),
    [allergyInput]
  );

  return (
    <ProfileContext.Provider
      value={{
        dietType,
        allergyInput,
        allergies,
        setDietType,
        setAllergyInput,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}
