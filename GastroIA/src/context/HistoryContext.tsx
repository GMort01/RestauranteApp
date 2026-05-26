// src/context/HistoryContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, Purchase } from '../types';

const HISTORY_STORAGE_KEY = '@gastroia/history';

interface AddPurchaseInput {
  id?: string;
  date?: string;
  timestamp?: number;
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
  clearHistory: () => void;
}

export const HistoryContext = createContext<HistoryContextType>({
  purchaseHistory: [],
  addPurchase: () => {},
  clearHistory: () => {},
});

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  // Fuente global del historial consumida por perfil, gráfica y pantalla completa.
  const [purchaseHistory, setPurchaseHistory] = useState<Purchase[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    // Rehidrata historial y normaliza timestamps para análisis temporal estable.
    const loadHistory = async () => {
      try {
        // Recupera historial local para analitica y reconsulta de compras.
        const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as Purchase[];
        if (Array.isArray(parsed)) {
          setPurchaseHistory(
            parsed.map((purchase) => ({
              ...purchase,
              timestamp:
                typeof purchase.timestamp === 'number' && Number.isFinite(purchase.timestamp)
                  ? purchase.timestamp
                  : Date.parse(purchase.date) || Date.now(),
            }))
          );
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

  // Inserta cada compra al inicio para mantener orden descendente por recencia.
  const addPurchase = (purchase: AddPurchaseInput) => {
    const newPurchase: Purchase = {
      id: purchase.id || Date.now().toString(),
      date: purchase.date || new Date().toLocaleDateString(),
      timestamp: purchase.timestamp || Date.now(),
      ...purchase,
    };
    // Se inserta al inicio para mostrar primero lo mas reciente.
    setPurchaseHistory((prev) => [newPurchase, ...prev]);
  };

  // Limpia la copia local del historial sin tocar otras fuentes del sistema.
  const clearHistory = () => {
    setPurchaseHistory([]);
  };

  return (
    <HistoryContext.Provider value={{ purchaseHistory, addPurchase, clearHistory }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory(): HistoryContextType {
  return useContext(HistoryContext);
}
