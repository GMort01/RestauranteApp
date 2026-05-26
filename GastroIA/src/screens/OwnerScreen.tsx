import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HeaderComponent from '../components/HeaderComponent';
import ProSideMenu from '../components/ProSideMenu';
import { useSettings } from '../context/SettingsContext';
import {
  ownerAdjustInventory,
  ownerCreateInventoryItem,
  ownerCreateMenuItem,
  ownerDeleteMenuItem,
  ownerFetchInventory,
  ownerFetchInventoryInsights,
  ownerFetchMenu,
  ownerFetchOrders,
  ownerLogin,
  ownerRegister,
  ownerUpdateMenuItem,
  ownerUpdateOrderStatus,
} from '../services/apiService';
import { InventoryInsight, InventoryItem, MenuItem, OwnerOrder, Theme } from '../types';

const OWNER_SESSION_KEY = '@gastroia/owner/session';
const OWNER_CATEGORY_OPTIONS = [
  'Colombiana',
  'Mariscos',
  'Asiática',
  'Pizza',
  'Hamburguesas',
  'Mexicana',
  'Saludable',
  'General',
] as const;

const OWNER_INVENTORY_UNIT_OPTIONS = ['unidades', 'g', 'kg'] as const;

type OwnerSession = {
  token: string;
  restaurantId: string;
  restaurantName: string;
  ownerName: string;
  email: string;
};

type OwnerTab = 'products' | 'orders' | 'inventory' | 'ai';
type InsightRisk = 'critical' | 'high' | 'medium' | 'stable';

export default function OwnerScreen() {
  const { theme } = useSettings();
  const styles = getStyles(theme);

  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [activeTab, setActiveTab] = useState<OwnerTab>('inventory');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerPasswordConfirm, setOwnerPasswordConfirm] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [nit, setNit] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<string>(OWNER_CATEGORY_OPTIONS[0]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<OwnerOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [insightsSummary, setInsightsSummary] = useState('');
  const [insights, setInsights] = useState<InventoryInsight[]>([]);

  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('General');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientStock, setNewIngredientStock] = useState('');
  const [newIngredientMin, setNewIngredientMin] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState<string>(OWNER_INVENTORY_UNIT_OPTIONS[0]);
  const [inventoryUnitDropdownOpen, setInventoryUnitDropdownOpen] = useState(false);
  const [inventoryDelta, setInventoryDelta] = useState<Record<number, string>>({});

  const ownerStats = useMemo(
    () => ({
      products: menuItems.length,
      orders: orders.length,
      inventoryItems: inventory.length,
      criticalCount: insights.filter((item) => item.estimated_days_left !== null && (item.estimated_days_left ?? 999) <= 2).length,
    }),
    [inventory.length, insights, menuItems.length, orders.length]
  );

  const getInsightRisk = (insight: InventoryInsight): InsightRisk => {
    const days = insight.estimated_days_left;
    if (days === null || days === undefined) return 'stable';
    if (days <= 1) return 'critical';
    if (days <= 2) return 'high';
    if (days <= 5) return 'medium';
    return 'stable';
  };

  const executiveSummary = useMemo(() => {
    const counters = {
      critical: 0,
      high: 0,
      medium: 0,
      stable: 0,
    };

    insights.forEach((insight) => {
      const risk = getInsightRisk(insight);
      counters[risk] += 1;
    });

    return {
      ...counters,
      total: insights.length,
      headline:
        counters.critical > 0
          ? `Atención inmediata: ${counters.critical} insumo(s) en riesgo crítico.`
          : counters.high > 0
            ? `Prioridad alta: ${counters.high} insumo(s) podrían agotarse pronto.`
            : 'Operación estable: no hay alertas críticas en este momento.',
    };
  }, [insights]);

  const findInventoryItemByInsight = (insight: InventoryInsight): InventoryItem | null => {
    const normalized = insight.ingredient_name.trim().toLowerCase();
    return (
      inventory.find((item) => item.ingredient_name.trim().toLowerCase() === normalized) ?? null
    );
  };

  const getSuggestedRestock = (item: InventoryItem): number => {
    const target = Math.max(item.minimum_quantity * 2, item.minimum_quantity + 1);
    const needed = Math.ceil(target - item.stock_quantity);
    return Math.max(needed, 1);
  };

  const clearProductForm = () => {
    setEditingProductId(null);
    setNewProductName('');
    setNewProductPrice('');
    setNewProductCategory('General');
    setNewProductDescription('');
  };

  const saveSession = async (nextSession: OwnerSession) => {
    setSession(nextSession);
    await AsyncStorage.setItem(OWNER_SESSION_KEY, JSON.stringify(nextSession));
  };

  const clearSession = async () => {
    setSession(null);
    await AsyncStorage.removeItem(OWNER_SESSION_KEY);
  };

  const loadOwnerData = async (token: string, restaurantId: string) => {
    setSyncing(true);
    try {
      const [menuData, orderData, inventoryData, insightData] = await Promise.all([
        ownerFetchMenu(restaurantId, token),
        ownerFetchOrders(restaurantId, token),
        ownerFetchInventory(restaurantId, token),
        ownerFetchInventoryInsights(restaurantId, token),
      ]);

      setMenuItems(menuData);
      setOrders(orderData);
      setInventory(inventoryData);
      setInsightsSummary(insightData.summary);
      setInsights(insightData.insights);
    } catch (error) {
      setFeedback('No se pudo cargar la vista de dueño.');
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        const storedSessionRaw = await AsyncStorage.getItem(OWNER_SESSION_KEY);
        if (storedSessionRaw) {
          const storedSession = JSON.parse(storedSessionRaw) as OwnerSession;
          if (storedSession?.token && storedSession?.restaurantId) {
            setSession(storedSession);
            await loadOwnerData(storedSession.token, storedSession.restaurantId);
          }
        }
      } catch (error) {
        setFeedback('No se pudo cargar la vista de dueño.');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const handleOwnerRegister = async () => {
    if (!ownerName.trim() || !ownerEmail.trim() || !ownerPassword.trim()) {
      setFeedback('Completa datos del dueño para registrarte.');
      return;
    }
    if (ownerPassword.trim() !== ownerPasswordConfirm.trim()) {
      setFeedback('Las contraseñas no coinciden.');
      return;
    }
    if (!restaurantName.trim() || !nit.trim() || !address.trim() || !phone.trim() || !category.trim()) {
      setFeedback('Completa los datos del restaurante: nombre, NIT, dirección, teléfono y categoría.');
      return;
    }
    if (ownerPassword.trim().length < 6) {
      setFeedback('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      const result = await ownerRegister({
        owner_name: ownerName.trim(),
        email: ownerEmail.trim(),
        password: ownerPassword.trim(),
        confirm_password: ownerPasswordConfirm.trim(),
        restaurant_name: restaurantName.trim(),
        nit: nit.trim(),
        address: address.trim(),
        phone: phone.trim(),
        category: category.trim(),
      });

      const nextSession: OwnerSession = {
        token: result.token,
        restaurantId: result.restaurant_id,
        restaurantName: result.restaurant_name,
        ownerName: result.owner_name,
        email: ownerEmail.trim(),
      };
      await saveSession(nextSession);
      setFeedback(result.message);
      setActiveTab('inventory');
      await loadOwnerData(result.token, result.restaurant_id);
    } catch (error) {
      setFeedback('No se pudo registrar el restaurante y el dueño.');
      console.error(error);
    }
  };

  const handleOwnerLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setFeedback('Ingresa correo y contraseña.');
      return;
    }

    try {
      const result = await ownerLogin({
        email: loginEmail.trim(),
        password: loginPassword.trim(),
      });

      const nextSession: OwnerSession = {
        token: result.token,
        restaurantId: result.restaurant_id,
        restaurantName: result.restaurant_name,
        ownerName: result.owner_name,
        email: loginEmail.trim(),
      };
      await saveSession(nextSession);
      setFeedback(result.message);
      setActiveTab('inventory');
      await loadOwnerData(result.token, result.restaurant_id);
    } catch (error) {
      setFeedback('No se pudo iniciar sesión de dueño.');
      console.error(error);
    }
  };

  const handleCreateOrUpdateProduct = async () => {
    if (!session) {
      setFeedback('Primero inicia sesión como dueño.');
      return;
    }

    const price = Number(newProductPrice.replace(/[^0-9]/g, ''));
    if (!newProductName.trim() || !newProductDescription.trim() || price <= 0) {
      setFeedback('Completa nombre, precio y descripción para guardar el producto.');
      return;
    }

    try {
      const payload = {
        nombre: newProductName.trim(),
        precio: price,
        categoria: newProductCategory.trim() || 'General',
        descripcion: newProductDescription.trim(),
      };

      if (editingProductId) {
        await ownerUpdateMenuItem(session.restaurantId, session.token, editingProductId, payload);
        setFeedback('Producto actualizado correctamente.');
      } else {
        await ownerCreateMenuItem(session.restaurantId, session.token, payload);
        setFeedback('Producto creado correctamente.');
      }

      clearProductForm();
      await loadOwnerData(session.token, session.restaurantId);
    } catch (error) {
      setFeedback('No se pudo guardar el producto.');
      console.error(error);
    }
  };

  const handleStartEditProduct = (item: MenuItem) => {
    setEditingProductId(item.id);
    setNewProductName(item.nombre);
    setNewProductPrice(String(item.precio));
    setNewProductCategory(item.categoria);
    setNewProductDescription(item.descripcion);
    setActiveTab('products');
  };

  const handleDeleteProduct = async (itemId: string) => {
    if (!session) return;
    try {
      await ownerDeleteMenuItem(session.restaurantId, session.token, itemId);
      setFeedback('Producto eliminado.');
      if (editingProductId === itemId) clearProductForm();
      await loadOwnerData(session.token, session.restaurantId);
    } catch (error) {
      setFeedback('No se pudo eliminar el producto.');
      console.error(error);
    }
  };

  const handleUpdateStatus = async (
    orderId: number,
    status: 'accepted' | 'preparing' | 'delivered' | 'cancelled'
  ) => {
    if (!session) return;
    try {
      await ownerUpdateOrderStatus(session.restaurantId, session.token, orderId, status);
      setFeedback(`Pedido #${orderId} actualizado a ${status}.`);
      await loadOwnerData(session.token, session.restaurantId);
    } catch (error) {
      setFeedback('No se pudo actualizar el pedido.');
      console.error(error);
    }
  };

  const handleCreateInventoryItem = async () => {
    if (!session) return;
    const stock = Number(newIngredientStock.replace(/[^0-9.]/g, ''));
    const min = Number(newIngredientMin.replace(/[^0-9.]/g, '')) || 0;

    if (!newIngredientName.trim() || stock <= 0) {
      setFeedback('Ingresa un insumo y stock inicial válido.');
      return;
    }

    try {
      await ownerCreateInventoryItem(session.restaurantId, session.token, {
        ingredient_name: newIngredientName.trim(),
        stock_quantity: stock,
        minimum_quantity: min,
        unit: newIngredientUnit,
      });
      setNewIngredientName('');
      setNewIngredientStock('');
      setNewIngredientMin('');
      setNewIngredientUnit(OWNER_INVENTORY_UNIT_OPTIONS[0]);
      setInventoryUnitDropdownOpen(false);
      setFeedback('Insumo creado en inventario.');
      await loadOwnerData(session.token, session.restaurantId);
    } catch (error) {
      setFeedback('No se pudo crear el insumo.');
      console.error(error);
    }
  };

  const handleAdjustInventory = async (itemId: number) => {
    if (!session) return;
    const raw = (inventoryDelta[itemId] ?? '').trim();
    const delta = Number(raw);
    if (!raw || Number.isNaN(delta) || delta === 0) {
      setFeedback('Ingresa un ajuste válido (ej: -2 o 5).');
      return;
    }

    try {
      await ownerAdjustInventory(session.restaurantId, session.token, itemId, delta, 'Ajuste manual desde app dueño');
      setInventoryDelta((prev) => ({ ...prev, [itemId]: '' }));
      setFeedback('Inventario ajustado.');
      await loadOwnerData(session.token, session.restaurantId);
    } catch (error) {
      setFeedback('No se pudo ajustar inventario.');
      console.error(error);
    }
  };

  const handleQuickRestock = async (item: InventoryItem) => {
    if (!session) return;
    const qty = getSuggestedRestock(item);
    try {
      await ownerAdjustInventory(
        session.restaurantId,
        session.token,
        item.id,
        qty,
        `Reposición sugerida IA (+${qty})`
      );
      setFeedback(`Reposición aplicada para ${item.ingredient_name}: +${qty}.`);
      setActiveTab('inventory');
      await loadOwnerData(session.token, session.restaurantId);
    } catch (error) {
      setFeedback('No se pudo aplicar la reposición sugerida.');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Preparando modo dueño...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <ProSideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
        <HeaderComponent onOpenMenu={() => setMenuVisible(true)} onOpenCart={() => {}} cartCount={0} />

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Modo dueño</Text>
          <Text style={styles.subtitle}>Accede con tu cuenta o registra un restaurante nuevo.</Text>

          <View style={styles.segmentRow}>
            <TouchableOpacity
              style={[styles.segmentButton, mode === 'login' && styles.segmentButtonActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>Ingresar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentButton, mode === 'register' && styles.segmentButtonActive]}
              onPress={() => setMode('register')}
            >
              <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>Registrar restaurante</Text>
            </TouchableOpacity>
          </View>

          {mode === 'login' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Inicio de sesión dueño</Text>
              <TextInput
                style={styles.input}
                placeholder="Correo de dueño"
                value={loginEmail}
                onChangeText={setLoginEmail}
                autoCapitalize="none"
                placeholderTextColor={theme.textSecondary}
              />
              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry
                placeholderTextColor={theme.textSecondary}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={handleOwnerLogin}>
                <Text style={styles.primaryButtonText}>Entrar al panel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Registro de restaurante y dueño</Text>
              <TextInput style={styles.input} placeholder="Nombre del dueño" value={ownerName} onChangeText={setOwnerName} placeholderTextColor={theme.textSecondary} />
              <TextInput style={styles.input} placeholder="Correo del dueño" value={ownerEmail} onChangeText={setOwnerEmail} autoCapitalize="none" placeholderTextColor={theme.textSecondary} />
              <TextInput style={styles.input} placeholder="Contraseña" value={ownerPassword} onChangeText={setOwnerPassword} secureTextEntry placeholderTextColor={theme.textSecondary} />
              <TextInput style={styles.input} placeholder="Confirmar contraseña" value={ownerPasswordConfirm} onChangeText={setOwnerPasswordConfirm} secureTextEntry placeholderTextColor={theme.textSecondary} />
              <TextInput style={styles.input} placeholder="Nombre del local" value={restaurantName} onChangeText={setRestaurantName} placeholderTextColor={theme.textSecondary} />
              <TextInput style={styles.input} placeholder="NIT" value={nit} onChangeText={setNit} placeholderTextColor={theme.textSecondary} />
              <TextInput style={styles.input} placeholder="Dirección" value={address} onChangeText={setAddress} placeholderTextColor={theme.textSecondary} />
              <TextInput style={styles.input} placeholder="Teléfono" value={phone} onChangeText={setPhone} placeholderTextColor={theme.textSecondary} />
              <View style={styles.dropdownWrapper}>
                <TouchableOpacity style={styles.dropdownButton} onPress={() => setCategoryDropdownOpen((value) => !value)}>
                  <Text style={styles.dropdownButtonText}>{category}</Text>
                  <Ionicons name={categoryDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
                </TouchableOpacity>
                {categoryDropdownOpen && (
                  <View style={styles.dropdownMenu}>
                    {OWNER_CATEGORY_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[styles.dropdownOption, category === option && styles.dropdownOptionActive]}
                        onPress={() => {
                          setCategory(option);
                          setCategoryDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.dropdownOptionText, category === option && styles.dropdownOptionTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={handleOwnerRegister}>
                <Text style={styles.primaryButtonText}>Crear restaurante</Text>
              </TouchableOpacity>
            </View>
          )}

          {feedback !== '' && <Text style={styles.feedback}>{feedback}</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ProSideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
      <HeaderComponent onOpenMenu={() => setMenuVisible(true)} onOpenCart={() => {}} cartCount={0} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Panel de negocio</Text>
          <Text style={styles.subtitle}>{session.restaurantName} · {session.ownerName}</Text>
          <View style={styles.statGrid}>
            <View style={styles.statCard}><Text style={styles.statValue}>{ownerStats.products}</Text><Text style={styles.statLabel}>Productos</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{ownerStats.orders}</Text><Text style={styles.statLabel}>Pedidos</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{ownerStats.inventoryItems}</Text><Text style={styles.statLabel}>Insumos</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{ownerStats.criticalCount}</Text><Text style={styles.statLabel}>Críticos IA</Text></View>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={clearSession}>
            <Ionicons name="log-out-outline" size={18} color={theme.error} />
            <Text style={styles.logoutText}>Cerrar sesión dueño</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'products' && styles.tabButtonActive]} onPress={() => setActiveTab('products')}>
            <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>Productos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'orders' && styles.tabButtonActive]} onPress={() => setActiveTab('orders')}>
            <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>Pedidos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'inventory' && styles.tabButtonActive]} onPress={() => setActiveTab('inventory')}>
            <Text style={[styles.tabText, activeTab === 'inventory' && styles.tabTextActive]}>Inventario</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'ai' && styles.tabButtonActive]} onPress={() => setActiveTab('ai')}>
            <Text style={[styles.tabText, activeTab === 'ai' && styles.tabTextActive]}>IA</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'products' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Gestión de productos</Text>
            <TextInput style={styles.input} placeholder="Nombre del producto" value={newProductName} onChangeText={setNewProductName} placeholderTextColor={theme.textSecondary} />
            <TextInput style={styles.input} placeholder="Precio (ej: 18000)" value={newProductPrice} onChangeText={setNewProductPrice} keyboardType="numeric" placeholderTextColor={theme.textSecondary} />
            <TextInput style={styles.input} placeholder="Categoría" value={newProductCategory} onChangeText={setNewProductCategory} placeholderTextColor={theme.textSecondary} />
            <TextInput style={[styles.input, styles.inputMultiline]} placeholder="Descripción" value={newProductDescription} onChangeText={setNewProductDescription} multiline placeholderTextColor={theme.textSecondary} />
            <View style={styles.segmentRow}>
              <TouchableOpacity style={styles.primaryButtonFlex} onPress={handleCreateOrUpdateProduct}>
                <Text style={styles.primaryButtonText}>{editingProductId ? 'Guardar cambios' : 'Añadir producto'}</Text>
              </TouchableOpacity>
              {editingProductId && (
                <TouchableOpacity style={styles.smallButton} onPress={clearProductForm}>
                  <Text style={styles.smallButtonText}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </View>

            {menuItems.map((item) => (
              <View key={item.id} style={styles.rowCard}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{item.nombre}</Text>
                  <Text style={styles.rowSubtitle}>${item.precio.toFixed(0)} · {item.categoria}</Text>
                </View>
                <View style={styles.iconActions}>
                  <TouchableOpacity onPress={() => handleStartEditProduct(item)}>
                    <Ionicons name="create-outline" size={20} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteProduct(item.id)}>
                    <Ionicons name="trash-outline" size={20} color={theme.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'orders' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Gestión de pedidos</Text>
            {orders.length === 0 ? (
              <Text style={styles.emptyText}>Sin pedidos por ahora.</Text>
            ) : (
              orders.map((order) => (
                <View key={order.id} style={styles.rowCardColumn}>
                  <Text style={styles.rowTitle}>Pedido #{order.id}</Text>
                  <Text style={styles.rowSubtitle}>Estado: {order.status}</Text>
                  <Text style={styles.rowSubtitle}>Total: ${order.total.toFixed(0)}</Text>
                  <Text style={styles.rowSubtitle}>
                    Items: {order.items.map((i) => `${i.menu_item?.nombre ?? i.menu_item_id} x${i.quantity}`).join(', ')}
                  </Text>
                  <View style={styles.statusButtonsRow}>
                    <TouchableOpacity style={styles.smallButton} onPress={() => handleUpdateStatus(order.id, 'accepted')}><Text style={styles.smallButtonText}>Aceptar</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.smallButton} onPress={() => handleUpdateStatus(order.id, 'preparing')}><Text style={styles.smallButtonText}>Preparar</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.smallButton} onPress={() => handleUpdateStatus(order.id, 'delivered')}><Text style={styles.smallButtonText}>Entregar</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.smallButton} onPress={() => handleUpdateStatus(order.id, 'cancelled')}><Text style={styles.smallButtonText}>Cancelar</Text></TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'inventory' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Inventario (persistente en MySQL)</Text>
            <TextInput style={styles.input} placeholder="Insumo (ej: peperoni)" value={newIngredientName} onChangeText={setNewIngredientName} placeholderTextColor={theme.textSecondary} />
            <TextInput style={styles.input} placeholder="Stock inicial" value={newIngredientStock} onChangeText={setNewIngredientStock} keyboardType="numeric" placeholderTextColor={theme.textSecondary} />
            <TextInput style={styles.input} placeholder="Stock mínimo" value={newIngredientMin} onChangeText={setNewIngredientMin} keyboardType="numeric" placeholderTextColor={theme.textSecondary} />
            <View style={styles.dropdownWrapper}>
              <TouchableOpacity style={styles.dropdownButton} onPress={() => setInventoryUnitDropdownOpen((value) => !value)}>
                <Text style={styles.dropdownButtonText}>Unidad: {newIngredientUnit}</Text>
                <Ionicons name={inventoryUnitDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
              </TouchableOpacity>
              {inventoryUnitDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {OWNER_INVENTORY_UNIT_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.dropdownOption, newIngredientUnit === option && styles.dropdownOptionActive]}
                      onPress={() => {
                        setNewIngredientUnit(option);
                        setInventoryUnitDropdownOpen(false);
                      }}
                    >
                      <Text style={[styles.dropdownOptionText, newIngredientUnit === option && styles.dropdownOptionTextActive]}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateInventoryItem}>
              <Text style={styles.primaryButtonText}>Añadir insumo</Text>
            </TouchableOpacity>

            {inventory.map((item) => (
              <View key={item.id} style={styles.rowCardColumn}>
                <Text style={styles.rowTitle}>{item.ingredient_name}</Text>
                <Text style={styles.rowSubtitle}>Stock: {item.stock_quantity} {item.unit} (mín: {item.minimum_quantity})</Text>
                <View style={styles.adjustRow}>
                  <TextInput
                    style={styles.adjustInput}
                    placeholder="Ajuste (+/-)"
                    value={inventoryDelta[item.id] ?? ''}
                    onChangeText={(value) => setInventoryDelta((prev) => ({ ...prev, [item.id]: value }))}
                    placeholderTextColor={theme.textSecondary}
                  />
                  <TouchableOpacity style={styles.smallButton} onPress={() => handleAdjustInventory(item.id)}>
                    <Text style={styles.smallButtonText}>Aplicar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'ai' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Asistente IA de inventario</Text>
            <View style={styles.executiveCard}>
              <Text style={styles.executiveTitle}>Resumen ejecutivo del día</Text>
              <Text style={styles.executiveHeadline}>{executiveSummary.headline}</Text>
              <View style={styles.executiveStatsRow}>
                <View style={[styles.executiveStatChip, styles.riskChipCritical]}>
                  <Text style={styles.executiveStatText}>Crítico: {executiveSummary.critical}</Text>
                </View>
                <View style={[styles.executiveStatChip, styles.riskChipHigh]}>
                  <Text style={styles.executiveStatText}>Alto: {executiveSummary.high}</Text>
                </View>
                <View style={[styles.executiveStatChip, styles.riskChipMedium]}>
                  <Text style={styles.executiveStatText}>Medio: {executiveSummary.medium}</Text>
                </View>
                <View style={[styles.executiveStatChip, styles.riskChipStable]}>
                  <Text style={styles.executiveStatText}>Estable: {executiveSummary.stable}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.aiSummaryBig}>{insightsSummary || 'Sin resumen aún.'}</Text>
            {insights.length === 0 ? (
              <Text style={styles.emptyText}>Aún no hay datos para recomendaciones.</Text>
            ) : (
              insights.map((insight) => (
                <View key={insight.ingredient_name} style={styles.aiCardMini}>
                  <View style={styles.aiHeaderRow}>
                    <Text style={styles.rowTitle}>{insight.ingredient_name}</Text>
                    {getInsightRisk(insight) === 'critical' && <Text style={[styles.riskBadge, styles.riskBadgeCritical]}>ROJO</Text>}
                    {getInsightRisk(insight) === 'high' && <Text style={[styles.riskBadge, styles.riskBadgeHigh]}>NARANJA</Text>}
                    {getInsightRisk(insight) === 'medium' && <Text style={[styles.riskBadge, styles.riskBadgeMedium]}>MEDIO</Text>}
                    {getInsightRisk(insight) === 'stable' && <Text style={[styles.riskBadge, styles.riskBadgeStable]}>VERDE</Text>}
                  </View>
                  <Text style={styles.rowSubtitle}>Stock actual: {insight.current_stock} {insight.unit}</Text>
                  <Text style={styles.rowSubtitle}>Cobertura estimada: {insight.estimated_days_left ?? 'N/A'} días</Text>
                  <Text style={styles.insightText}>{insight.recommendation}</Text>
                  <View style={styles.quickActionsRow}>
                    <TouchableOpacity style={styles.smallButton} onPress={() => setActiveTab('inventory')}>
                      <Text style={styles.smallButtonText}>Ir a inventario</Text>
                    </TouchableOpacity>
                    {(() => {
                      const item = findInventoryItemByInsight(insight);
                      const risk = getInsightRisk(insight);
                      if (!item || (risk !== 'critical' && risk !== 'high')) return null;
                      return (
                        <TouchableOpacity style={styles.smallButton} onPress={() => handleQuickRestock(item)}>
                          <Text style={styles.smallButtonText}>Reponer +{getSuggestedRestock(item)}</Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {syncing && (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.syncText}>Actualizando datos...</Text>
          </View>
        )}

        {feedback !== '' && <Text style={styles.feedback}>{feedback}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: theme.textSecondary },
    content: { padding: 16, gap: 12, paddingBottom: 40 },
    title: { fontSize: 24, fontWeight: '800', color: theme.text },
    subtitle: { color: theme.textSecondary, marginBottom: 6 },
    card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 12, gap: 8 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: theme.text, backgroundColor: theme.background },
    inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
    primaryButton: { backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    primaryButtonFlex: { flex: 1, backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    primaryButtonText: { color: '#fff', fontWeight: '700' },
    smallButton: { borderWidth: 1, borderColor: theme.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.primary + '10' },
    smallButtonText: { color: theme.primary, fontSize: 12, fontWeight: '700' },
    rowCard: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowMain: { flex: 1 },
    rowCardColumn: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, gap: 4 },
    rowTitle: { color: theme.text, fontWeight: '700' },
    rowSubtitle: { color: theme.textSecondary, fontSize: 12 },
    statusButtonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    adjustRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
    adjustInput: { flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: theme.text, backgroundColor: theme.background },
    insightText: { color: theme.text, fontSize: 12, marginTop: 4, fontWeight: '500' },
    emptyText: { color: theme.textSecondary, fontSize: 12 },
    segmentRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    segmentButton: { flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: theme.surface },
    segmentButtonActive: { borderColor: theme.primary, backgroundColor: theme.primary + '12' },
    segmentText: { color: theme.textSecondary, fontWeight: '700', fontSize: 12 },
    segmentTextActive: { color: theme.primary },
    logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    logoutText: { color: theme.error, fontWeight: '700' },
    iconActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    syncText: { color: theme.textSecondary, fontSize: 12 },
    feedback: { color: theme.primary, fontWeight: '600', marginTop: 2 },
    aiSummaryBig: { color: theme.text, fontWeight: '800', fontSize: 14 },
    aiCardMini: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, gap: 4, backgroundColor: theme.background },
    aiHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    riskBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontSize: 11, fontWeight: '800' },
    riskBadgeCritical: { color: '#991b1b', backgroundColor: '#fee2e2' },
    riskBadgeHigh: { color: '#9a3412', backgroundColor: '#ffedd5' },
    riskBadgeMedium: { color: '#374151', backgroundColor: '#E5E7EB' },
    riskBadgeStable: { color: '#166534', backgroundColor: '#dcfce7' },
    executiveCard: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, backgroundColor: theme.background, gap: 6 },
    executiveTitle: { color: theme.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    executiveHeadline: { color: theme.text, fontSize: 14, fontWeight: '700' },
    executiveStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    executiveStatChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    executiveStatText: { fontSize: 11, fontWeight: '800', color: '#0f172a' },
    riskChipCritical: { backgroundColor: '#fee2e2' },
    riskChipHigh: { backgroundColor: '#ffedd5' },
    riskChipMedium: { backgroundColor: '#E5E7EB' },
    riskChipStable: { backgroundColor: '#dcfce7' },
    quickActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    dropdownWrapper: { gap: 6 },
    dropdownButton: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 12,
      backgroundColor: theme.background,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dropdownButtonText: { color: theme.text, fontWeight: '600' },
    dropdownMenu: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      backgroundColor: theme.surface,
      overflow: 'hidden',
    },
    dropdownOption: { paddingHorizontal: 10, paddingVertical: 10 },
    dropdownOptionActive: { backgroundColor: theme.primary + '12' },
    dropdownOptionText: { color: theme.textSecondary, fontWeight: '600' },
    dropdownOptionTextActive: { color: theme.primary },
    tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tabButton: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 999, backgroundColor: theme.surface },
    tabButtonActive: { borderColor: theme.primary, backgroundColor: theme.primary + '12' },
    tabText: { color: theme.textSecondary, fontWeight: '700', fontSize: 12 },
    tabTextActive: { color: theme.primary },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statCard: { flexGrow: 1, minWidth: '22%', borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 8, backgroundColor: theme.background },
    statValue: { color: theme.text, fontSize: 16, fontWeight: '800' },
    statLabel: { color: theme.textSecondary, fontSize: 11 },
  });
