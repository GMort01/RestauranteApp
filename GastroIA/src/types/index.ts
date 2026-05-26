// src/types/index.ts
// Tipos globales compartidos en toda la aplicación GastroIA

// ==================== DATOS ====================

export interface MenuItem {
  id: string;
  restaurantId: string;
  nombre: string;
  precio: number;
  categoria: string;
  descripcion: string;
  popular?: boolean;
  isVegan: boolean;
  tags: string[];
  restaurantName: string;
  deliveryTime: string;
  restaurantRating?: number | string;
}

export interface Restaurant {
  id: string;
  nombre: string;
  categoria: string;
  rating: number;
  entrega: string;
}

// ==================== CARRITO ====================

export interface CartItem extends MenuItem {
  quantity: number;
}

// ==================== HISTORIAL ====================

export interface Purchase {
  id: string;
  date: string;
  timestamp?: number;
  backendOrderId?: number;
  paymentMethod?: 'tarjeta' | 'billetera' | 'efectivo';
  items: CartItem[];
  subtotal: number;
  tip: number;
  total: number;
}

// ==================== IA ====================

export interface AIPreferences {
  search?: string;
  dietType?: string;
  allergies?: string[];
}

export interface OwnerOrder {
  id: number;
  created_at: string;
  subtotal: number;
  tip: number;
  total: number;
  status: 'pending' | 'accepted' | 'preparing' | 'delivered' | 'cancelled' | string;
  items: {
    id: number;
    menu_item_id: string;
    quantity: number;
    menu_item?: {
      nombre: string;
      precio: number;
      descripcion: string;
    };
  }[];
}

export interface InventoryItem {
  id: number;
  restaurant_id: string;
  ingredient_name: string;
  stock_quantity: number;
  minimum_quantity: number;
  unit: string;
  updated_at?: string;
}

export interface InventoryInsight {
  ingredient_name: string;
  current_stock: number;
  unit: string;
  estimated_days_left?: number | null;
  recommendation: string;
}

export interface OwnerBusinessProfile {
  restaurant_id: string;
  restaurant_name: string;
  owner_name: string;
  nit: string;
  address: string;
  phone: string;
  category: string;
  delivery_time: string;
}

// ==================== NAVEGACIÓN ====================

export type RootStackParamList = {
  Welcome: undefined;
  Home: { restaurantId?: string; restaurantName?: string } | undefined;
  Restaurants: undefined;
  Owner: undefined;
  OwnerProfile: undefined;
  Cart: undefined;
  Favorites: undefined;
  Account: undefined;
  Settings: undefined;
  About: undefined;
  History: undefined;
};

// ==================== TEMA ====================

export interface Theme {
  primary: string;
  primaryLight: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  successBackground: string;
  shadow: string;
  error: string;
}
