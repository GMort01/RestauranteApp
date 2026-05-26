// src/services/apiService.ts
// URL base del backend FastAPI
// - Emulador Android  → http://10.0.2.2:8000
// - Simulador iOS     → http://localhost:8000
// - Dispositivo físico → http://<TU_IP_LOCAL>:8000  (ej: http://192.168.1.5:8000)
import { Platform } from 'react-native';
import { InventoryInsight, InventoryItem, MenuItem, OwnerOrder, Restaurant } from '../types';

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

function getDefaultApiUrl(): string {
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  return 'http://127.0.0.1:8000';
}

function normalizeApiUrlForPlatform(url: string): string {
  if (Platform.OS !== 'android') return url;

  try {
    const parsed = new URL(url);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      parsed.hostname = '10.0.2.2';
      return parsed.toString().replace(/\/$/, '');
    }
    return url;
  } catch {
    return url;
  }
}

export const API_BASE_URL = ENV_API_URL
  ? normalizeApiUrlForPlatform(ENV_API_URL)
  : getDefaultApiUrl();

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Candado global para evitar rafagas/concurrencia accidental en /ai/chat.
let isRequestActive = false;

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  // Helper centralizado para estandarizar manejo de errores HTTP.
  const response = await fetch(url, init);

  if (!response.ok) {
    let detail = `Error HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData?.detail) detail = String(errorData.detail);
    } catch {
      // Mantener mensaje por estado cuando el backend no responda JSON.
    }
    throw new ApiError(detail, response.status);
  }

  return response.json() as Promise<T>;
}

// ==================== RESTAURANTES ====================

export async function fetchRestaurants(): Promise<Restaurant[]> {
  const response = await fetch(`${API_BASE_URL}/restaurants/`);
  if (!response.ok) {
    throw new Error(`Error al obtener restaurantes: ${response.status}`);
  }
  const data = await response.json();
  // Mapear snake_case del backend a camelCase del frontend
  return data.map((r: any) => ({
    id: r.id,
    nombre: r.nombre,
    categoria: r.categoria,
    rating: r.rating,
    entrega: r.entrega,
  })) as Restaurant[];
}

// ==================== MENÚ ====================

export interface MenuFilters {
  restaurant_id?: string;
  categoria?: string;
  is_vegan?: boolean;
}

export async function fetchMenuItems(filters?: MenuFilters): Promise<MenuItem[]> {
  // Construye filtros opcionales para reutilizar un único endpoint de menú.
  // Query params opcionales para mantener una API de filtros flexible.
  const params = new URLSearchParams();
  if (filters?.restaurant_id) params.append('restaurant_id', filters.restaurant_id);
  if (filters?.categoria) params.append('categoria', filters.categoria);
  if (filters?.is_vegan !== undefined) params.append('is_vegan', String(filters.is_vegan));

  const url = `${API_BASE_URL}/menus/${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error al obtener menú: ${response.status}`);
  }
  const data = await response.json();
  // Mapear snake_case → camelCase
  return data.map((item: any) => ({
    id: item.id,
    restaurantId: item.restaurant_id,
    nombre: item.nombre,
    precio: Number(item.precio),
    categoria: item.categoria,
    descripcion: item.descripcion,
    popular: item.popular,
    isVegan: item.is_vegan,
    tags: item.tags ?? [],
    restaurantName: item.restaurant_name,
    deliveryTime: item.delivery_time,
  })) as MenuItem[];
}

// ==================== PEDIDOS ====================

export interface OrderPayload {
  subtotal: number;
  tip: number;
  total: number;
  items: { menu_item_id: string; quantity: number }[];
}

export interface CreatedOrderResponse {
  id: number;
  created_at: string;
  subtotal: number;
  tip: number;
  total: number;
  items: {
    id: number;
    order_id: number;
    menu_item_id: string;
    quantity: number;
  }[];
}

export async function createOrder(payload: OrderPayload): Promise<CreatedOrderResponse> {
  // Envía la intención de compra y deja el recálculo de montos al backend.
  // El backend recalcula subtotal/total; este payload es una intencion de compra.
  return requestJson<CreatedOrderResponse>(`${API_BASE_URL}/orders/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ==================== AUTH ====================

export interface AuthUserResponse {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  user: AuthUserResponse;
  message: string;
}

export async function registerUser(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return requestJson<AuthResponse>(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return requestJson<AuthResponse>(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(payload: {
  email: string;
  new_password: string;
}): Promise<{ message: string }> {
  return requestJson<{ message: string }>(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ── IA / Gemini ────────────────────────────────────────────────────────────────

export interface GeminiPreferences {
  search: string;
  dietType: string;
  allergies: string[];
  budget: number | null;
  message: string;
}

export interface ChatMessagePayload {
  role: string;
  text: string;
}

export interface ChatResult {
  reply: string;
  resolved: boolean;
  preferences?: GeminiPreferences;
}

export async function analyzeIntent(text: string): Promise<GeminiPreferences> {
  return requestJson<GeminiPreferences>(`${API_BASE_URL}/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function sendChatMessage(
  history: ChatMessagePayload[],
  message: string
): Promise<ChatResult> {
  // Bloquea concurrencia accidental para no duplicar turnos ni saturar el chat.
  if (isRequestActive) {
    throw new ApiError(
      '¡Vas muy rápido! Por favor, espera unos segundos antes de enviar otro mensaje.',
      429
    );
  }

  isRequestActive = true;
  try {
    return await requestJson<ChatResult>(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, message }),
    });
  } finally {
    isRequestActive = false;
  }
}

// ==================== OWNER ====================

export async function ownerRegister(payload: {
  owner_name: string;
  email: string;
  password: string;
  confirm_password: string;
  restaurant_name: string;
  nit: string;
  address: string;
  phone: string;
  category: string;
}): Promise<{
  token: string;
  restaurant_id: string;
  restaurant_name: string;
  owner_name: string;
  message: string;
}> {
  return requestJson(`${API_BASE_URL}/owner/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function ownerLogin(payload: {
  email: string;
  password: string;
}): Promise<{
  token: string;
  restaurant_id: string;
  restaurant_name: string;
  owner_name: string;
  message: string;
}> {
  return requestJson(`${API_BASE_URL}/owner/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function ownerFetchProfile(restaurantId: string, token: string): Promise<{
  restaurant_id: string;
  restaurant_name: string;
  owner_name: string;
  nit: string;
  address: string;
  phone: string;
  category: string;
  delivery_time: string;
}> {
  return requestJson(`${API_BASE_URL}/owner/restaurants/${restaurantId}/profile`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'x-owner-token': token },
  });
}

export async function ownerUpdateBusinessProfile(
  restaurantId: string,
  token: string,
  payload: {
    nit: string;
    address: string;
    phone: string;
  }
): Promise<{
  restaurant_id: string;
  restaurant_name: string;
  owner_name: string;
  nit: string;
  address: string;
  phone: string;
  category: string;
  delivery_time: string;
}> {
  return requestJson(`${API_BASE_URL}/owner/restaurants/${restaurantId}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-owner-token': token },
    body: JSON.stringify(payload),
  });
}

export async function ownerFetchMenu(restaurantId: string, token: string): Promise<MenuItem[]> {
  const data = await requestJson<any[]>(`${API_BASE_URL}/owner/restaurants/${restaurantId}/menu`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'x-owner-token': token },
  });

  return data.map((item) => ({
    id: item.id,
    restaurantId: item.restaurant_id,
    nombre: item.nombre,
    precio: Number(item.precio),
    categoria: item.categoria,
    descripcion: item.descripcion,
    popular: item.popular,
    isVegan: item.is_vegan,
    tags: item.tags ?? [],
    restaurantName: item.restaurant_name,
    deliveryTime: item.delivery_time,
  }));
}

export async function ownerCreateMenuItem(
  restaurantId: string,
  token: string,
  payload: {
    nombre: string;
    precio: number;
    categoria: string;
    descripcion: string;
    popular?: boolean;
    is_vegan?: boolean;
    tags?: string[];
  }
): Promise<void> {
  await requestJson(`${API_BASE_URL}/owner/restaurants/${restaurantId}/menu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-owner-token': token },
    body: JSON.stringify(payload),
  });
}

export async function ownerUpdateMenuItem(
  restaurantId: string,
  token: string,
  itemId: string,
  payload: {
    nombre: string;
    precio: number;
    categoria: string;
    descripcion: string;
    popular?: boolean;
    is_vegan?: boolean;
    tags?: string[];
  }
): Promise<void> {
  await requestJson(`${API_BASE_URL}/owner/restaurants/${restaurantId}/menu/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-owner-token': token },
    body: JSON.stringify(payload),
  });
}

export async function ownerDeleteMenuItem(
  restaurantId: string,
  token: string,
  itemId: string
): Promise<void> {
  await fetch(`${API_BASE_URL}/owner/restaurants/${restaurantId}/menu/${itemId}`, {
    method: 'DELETE',
    headers: { 'x-owner-token': token },
  });
}

export async function ownerFetchOrders(restaurantId: string, token: string): Promise<OwnerOrder[]> {
  return requestJson<OwnerOrder[]>(`${API_BASE_URL}/owner/restaurants/${restaurantId}/orders`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'x-owner-token': token },
  });
}

export async function ownerUpdateOrderStatus(
  restaurantId: string,
  token: string,
  orderId: number,
  status: 'pending' | 'accepted' | 'preparing' | 'delivered' | 'cancelled'
): Promise<void> {
  await requestJson(`${API_BASE_URL}/owner/restaurants/${restaurantId}/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-owner-token': token },
    body: JSON.stringify({ status }),
  });
}

export async function ownerFetchInventory(restaurantId: string, token: string): Promise<InventoryItem[]> {
  return requestJson<InventoryItem[]>(
    `${API_BASE_URL}/owner/restaurants/${restaurantId}/inventory`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-owner-token': token },
    }
  );
}

export async function ownerCreateInventoryItem(
  restaurantId: string,
  token: string,
  payload: {
    ingredient_name: string;
    stock_quantity: number;
    minimum_quantity?: number;
    unit?: string;
  }
): Promise<void> {
  await requestJson(`${API_BASE_URL}/owner/restaurants/${restaurantId}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-owner-token': token },
    body: JSON.stringify(payload),
  });
}

export async function ownerAdjustInventory(
  restaurantId: string,
  token: string,
  inventoryItemId: number,
  delta: number,
  note?: string
): Promise<void> {
  await requestJson(
    `${API_BASE_URL}/owner/restaurants/${restaurantId}/inventory/${inventoryItemId}/adjust`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-owner-token': token },
      body: JSON.stringify({ delta, note }),
    }
  );
}

export async function ownerFetchInventoryInsights(restaurantId: string, token: string): Promise<{
  summary: string;
  insights: InventoryInsight[];
}> {
  return requestJson(`${API_BASE_URL}/owner/restaurants/${restaurantId}/inventory/insights`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'x-owner-token': token },
  });
}
