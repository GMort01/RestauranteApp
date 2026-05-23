// src/context/FavoritesContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MenuItem } from '../types';

const FAVORITES_STORAGE_KEY = '@gastroia/favorites';

interface FavoritesContextType {
  favoriteItems: MenuItem[];
  addFavorite: (item: MenuItem) => void;
  removeFavorite: (itemId: string) => void;
  isFavorite: (itemId: string) => boolean;
}

export const FavoritesContext = createContext<FavoritesContextType>({
  favoriteItems: [],
  addFavorite: () => {},
  removeFavorite: () => {},
  isFavorite: () => false,
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favoriteItems, setFavoriteItems] = useState<MenuItem[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        // Carga favoritos guardados para que el usuario no pierda su lista.
        const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as MenuItem[];
        if (Array.isArray(parsed)) {
          setFavoriteItems(parsed);
        }
      } catch {
        // Ignorar datos corruptos para no romper la app.
      } finally {
        setHydrated(true);
      }
    };

    loadFavorites();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Persistencia diferida hasta terminar hidratacion inicial.
    AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteItems));
  }, [favoriteItems, hydrated]);

  const addFavorite = (item: MenuItem) => {
    setFavoriteItems((prevItems) => {
      if (prevItems.some((favorite) => favorite.id === item.id)) {
        // Evita duplicados en la coleccion de favoritos.
        return prevItems;
      }
      return [...prevItems, item];
    });
  };

  const removeFavorite = (itemId: string) => {
    setFavoriteItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
  };

  const isFavorite = (itemId: string) => favoriteItems.some((item) => item.id === itemId);

  return (
    <FavoritesContext.Provider value={{ favoriteItems, addFavorite, removeFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextType {
  return useContext(FavoritesContext);
}
