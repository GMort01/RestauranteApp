// src/context/ProfileContext.tsx
import React, { createContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_STORAGE_KEY = '@gastroia/profile';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  photoUrl: string;
  isActive: boolean;
}

interface ProfileContextType {
  profile: UserProfile;
  dietType: string;
  allergyInput: string;
  allergies: string[];
  updateProfile: (changes: Partial<UserProfile>) => void;
  resetProfile: () => void;
  setDietType: (diet: string) => void;
  setAllergyInput: (input: string) => void;
}

export const ProfileContext = createContext<ProfileContextType>({
  profile: {
    name: '',
    email: '',
    phone: '',
    photoUrl: '',
    isActive: true,
  },
  dietType: 'carnivoro',
  allergyInput: '',
  allergies: [],
  updateProfile: () => {},
  resetProfile: () => {},
  setDietType: () => {},
  setAllergyInput: () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  // Estado global del perfil y preferencias alimentarias usado por varias pantallas.
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    phone: '',
    photoUrl: '',
    isActive: true,
  });
  const [dietType, setDietType] = useState<string>('carnivoro');
  const [allergyInput, setAllergyInput] = useState<string>('');
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    // Recupera perfil y preferencias persistidas antes de volver a escribir en storage.
    const loadProfile = async () => {
      try {
        const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as {
          name?: string;
          email?: string;
          phone?: string;
          photoUrl?: string;
          isActive?: boolean;
          dietType?: string;
          allergyInput?: string;
        };

        if (typeof parsed.name === 'string') {
          setProfile((prev) => ({ ...prev, name: parsed.name ?? prev.name }));
        }
        if (typeof parsed.email === 'string') {
          setProfile((prev) => ({ ...prev, email: parsed.email ?? prev.email }));
        }
        if (typeof parsed.phone === 'string') {
          setProfile((prev) => ({ ...prev, phone: parsed.phone ?? prev.phone }));
        }
        if (typeof parsed.photoUrl === 'string') {
          setProfile((prev) => ({ ...prev, photoUrl: parsed.photoUrl ?? prev.photoUrl }));
        }
        if (typeof parsed.isActive === 'boolean') {
          setProfile((prev) => ({ ...prev, isActive: parsed.isActive ?? prev.isActive }));
        }

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
    AsyncStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ ...profile, dietType, allergyInput })
    );
  }, [profile, dietType, allergyInput, hydrated]);

  // Aplica cambios parciales al perfil sin reconstruir todo el objeto manualmente.
  const updateProfile = (changes: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...changes }));
  };

  // Reinicia el perfil local y las preferencias a un estado limpio consistente.
  const resetProfile = () => {
    setProfile({
      name: '',
      email: '',
      phone: '',
      photoUrl: '',
      isActive: true,
    });
    setDietType('carnivoro');
    setAllergyInput('');
  };

  // Deriva y normaliza alergias desde el input libre para reutilizarlas como lista.
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
        profile,
        dietType,
        allergyInput,
        allergies,
        updateProfile,
        resetProfile,
        setDietType,
        setAllergyInput,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}
