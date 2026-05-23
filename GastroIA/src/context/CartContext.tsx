// src/context/CartContext.tsx
import React, { createContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MenuItem, CartItem } from '../types';

const CART_STORAGE_KEY = '@gastroia/cart';

interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  subtotal: number;
  tip: number;
  total: number;
  addItem: (item: MenuItem) => void;
  removeItem: (itemId: string) => void;
  increaseQuantity: (itemId: string) => void;
  decreaseQuantity: (itemId: string) => void;
  setTip: React.Dispatch<React.SetStateAction<number>>;
  clearCart: () => void;
}

export const CartContext = createContext<CartContextType>({
  cartItems: [],
  cartCount: 0,
  subtotal: 0,
  tip: 0,
  total: 0,
  addItem: () => {},
  removeItem: () => {},
  increaseQuantity: () => {},
  decreaseQuantity: () => {},
  setTip: () => {},
  clearCart: () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [tip, setTip] = useState<number>(0);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    const loadCart = async () => {
      try {
        // Restaura carrito y propina para mantener continuidad entre sesiones.
        const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as { cartItems?: CartItem[]; tip?: number };
        if (Array.isArray(parsed.cartItems)) {
          setCartItems(parsed.cartItems);
        }
        if (typeof parsed.tip === 'number') {
          setTip(parsed.tip);
        }
      } catch {
        // Ignorar datos corruptos para no romper la app.
      } finally {
        setHydrated(true);
      }
    };

    loadCart();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Se persiste solo despues de hidratar para no sobrescribir datos previos.
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ cartItems, tip }));
  }, [cartItems, tip, hydrated]);

  const addItem = (item: MenuItem) => {
    setCartItems((prevItems) => {
      const existing = prevItems.find((cartItem) => cartItem.id === item.id);
      if (existing) {
        // Si el item ya existe, solo incrementa cantidad.
        return prevItems.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prevItems, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (itemId: string) => {
    setCartItems((prevItems) => prevItems.filter((cartItem) => cartItem.id !== itemId));
  };

  const increaseQuantity = (itemId: string) => {
    setCartItems((prevItems) =>
      prevItems.map((cartItem) =>
        cartItem.id === itemId ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
      )
    );
  };

  const decreaseQuantity = (itemId: string) => {
    setCartItems((prevItems) =>
      prevItems
        .map((cartItem) =>
          cartItem.id === itemId
            ? { ...cartItem, quantity: Math.max(1, cartItem.quantity - 1) }
            : cartItem
        )
        // Regla defensiva para evitar items con cantidad invalida.
        .filter((cartItem) => cartItem.quantity > 0)
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setTip(0);
  };

  const subtotal = useMemo(
    // Derivado memoizado para evitar recalculos en cada render.
    () => cartItems.reduce((sum, item) => sum + item.precio * item.quantity, 0),
    [cartItems]
  );

  const total = useMemo(() => subtotal + tip, [subtotal, tip]);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        subtotal,
        tip,
        total,
        addItem,
        removeItem,
        increaseQuantity,
        decreaseQuantity,
        setTip,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
