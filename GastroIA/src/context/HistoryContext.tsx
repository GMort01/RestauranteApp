// src/context/HistoryContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, Purchase } from '../types';

const HISTORY_STORAGE_KEY = '@gastroia/history';

interface AddPurchaseInput {
  id?: string;
  date?: string;
  backendOrderId?: number;
  paymentMethod?: 'tarjeta' | 'billetera' | 'efectivo';
  items: CartItem[];
  subtotal: number;
  tip: number;
  total: number;
}

interface HistoryContextType {
  purchaseHistory: Purchase[];
  addPurchase: (purchase: AddPurchaseInput) => void;
}

export const HistoryContext = createContext<HistoryContextType>({
  purchaseHistory: [],
  addPurchase: () => {},
});

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [purchaseHistory, setPurchaseHistory] = useState<Purchase[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        // Recupera historial local para analitica y reconsulta de compras.
        const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as Purchase[];
        if (Array.isArray(parsed)) {
          setPurchaseHistory(parsed);
        }
      } catch {
        // Ignorar datos corruptos para no romper la app.
      } finally {
        setHydrated(true);
      }
    };

    loadHistory();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Guarda cambios de historial solo cuando ya termino la carga inicial.
    AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(purchaseHistory));
  }, [purchaseHistory, hydrated]);

  const addPurchase = (purchase: AddPurchaseInput) => {
    const newPurchase: Purchase = {
      id: purchase.id || Date.now().toString(),
      date: purchase.date || new Date().toLocaleDateString(),
      ...purchase,
    };
    // Se inserta al inicio para mostrar primero lo mas reciente.
    setPurchaseHistory((prev) => [newPurchase, ...prev]);
  };

  return (
    <HistoryContext.Provider value={{ purchaseHistory, addPurchase }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory(): HistoryContextType {
  return useContext(HistoryContext);
}
