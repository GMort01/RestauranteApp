// src/screens/CartScreen.tsx
import React, { useContext, useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  ListRenderItemInfo,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CartContext } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { useHistory } from '../context/HistoryContext';
import { useAuth } from '../context/AuthContext';
import { createOrder, fetchMenuItems } from '../services/apiService';
import CustomButton from '../components/CustomButton';
import { RootStackParamList, CartItem, MenuItem, Theme } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;

interface CartSuggestion {
  original: CartItem;
  alternative: MenuItem;
  savings: number;
}

type PaymentMethod = 'tarjeta' | 'billetera' | 'efectivo';

const PAYMENT_METHOD_OPTIONS: {
  key: PaymentMethod;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { key: 'tarjeta', label: 'Tarjeta', icon: 'card-outline' },
  { key: 'billetera', label: 'Billetera virtual', icon: 'phone-portrait-outline' },
  { key: 'efectivo', label: 'Efectivo', icon: 'cash-outline' },
];

export default function CartScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = width > 768;
  const mobileBottomPadding = Math.max(120, insets.bottom + 96);
  const {
    cartItems = [],
    cartCount = 0,
    subtotal = 0,
    tip = 0,
    total = 0,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    setTip,
    clearCart,
  } = useContext(CartContext);
  const [tipInput, setTipInput] = useState<string>(String(tip || 0));
  const [receiptVisible, setReceiptVisible] = useState<boolean>(false);
  const [receiptText, setReceiptText] = useState<string>('');
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [showAuthRequired, setShowAuthRequired] = useState<boolean>(false);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [cartSuggestions, setCartSuggestions] = useState<CartSuggestion[]>([]);
  const { theme } = useSettings();
  const { isAuthenticated, currentUser } = useAuth();
  const { addPurchase } = useHistory();
  const styles = getStyles(theme);

  useEffect(() => {
    if (cartItems.length === 0) {
      setCartSuggestions([]);
      return;
    }
    fetchMenuItems()
      .then((allItems) => {
        const suggestions = cartItems
          .flatMap((item) => {
            const cheaper = allItems.filter(
              (m) => m.categoria === item.categoria && m.id !== item.id && m.precio < item.precio
            );
            if (!cheaper.length) return [];
            const best = cheaper.reduce((prev, cur) => (cur.precio < prev.precio ? cur : prev));
            const savings = item.precio - best.precio;
            if (savings <= 0) return [];
            return [{ original: item, alternative: best, savings }];
          })
          .slice(0, 2);
        setCartSuggestions(suggestions);
      })
      .catch(() => setCartSuggestions([]));
  }, [cartItems]);

  const handleSetTip = () => {
    const parsed = Number(tipInput.replace(/[^0-9]/g, ''));
    setTip(isNaN(parsed) ? 0 : parsed);
  };

  const handleSetTipPercent = (percent: number) => {
    const computedTip = Math.round((subtotal * percent) / 100);
    setTip(computedTip);
    setTipInput(String(computedTip));
  };

  const handleClearCart = () => {
    setShowClearConfirm(true);
  };

  const confirmClearCart = () => {
    clearCart();
    setShowClearConfirm(false);
  };

  const cancelClearCart = () => {
    setShowClearConfirm(false);
  };

  const handleFinalizeOrder = async () => {
    if (submittingOrder) return;

    if (cartItems.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos al carrito antes de finalizar.');
      return;
    }

    if (!selectedPaymentMethod) {
      Alert.alert('Método de pago', 'Selecciona un método de pago para continuar.');
      return;
    }

    try {
      setSubmittingOrder(true);

      const payload = {
        subtotal,
        tip,
        total,
        items: cartItems.map((item) => ({
          menu_item_id: item.id,
          quantity: item.quantity,
        })),
      };

      const createdOrder = await createOrder(payload);
      const receipt = generateReceipt(createdOrder.id, selectedPaymentMethod);

      addPurchase({
        id: String(createdOrder.id),
        date: new Date(createdOrder.created_at).toLocaleDateString(),
        backendOrderId: createdOrder.id,
        paymentMethod: selectedPaymentMethod,
        items: cartItems,
        subtotal: createdOrder.subtotal,
        tip: createdOrder.tip,
        total: createdOrder.total,
      });

      setReceiptText(receipt);
      setReceiptVisible(true);
      setShowPaymentConfirm(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo procesar el pedido en este momento.';
      Alert.alert('Error al finalizar pedido', message);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const openPaymentConfirmation = () => {
    if (submittingOrder) return;

    if (cartItems.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos al carrito antes de finalizar.');
      return;
    }

    if (!selectedPaymentMethod) {
      Alert.alert('Método de pago', 'Selecciona un método de pago para continuar.');
      return;
    }

    if (!isAuthenticated) {
      setShowAuthRequired(true);
      return;
    }

    setShowPaymentConfirm(true);
  };

  const closeReceipt = () => {
    clearCart();
    setTip(0);
    setTipInput('0');
    setReceiptVisible(false);
  };



  const generateReceipt = (orderId?: number, paymentMethod?: PaymentMethod): string => {
    let receipt = '🍕 Recibo de pedido - GastroIA\n\n';
    if (orderId) {
      receipt += `Pedido #${orderId}\n\n`;
    }
    cartItems.forEach((item) => {
      receipt += `${item.nombre}\n`;
      receipt += `  Cantidad: ${item.quantity} x $${item.precio} = $${item.precio * item.quantity}\n`;
      receipt += `  Restaurante: ${item.restaurantName || 'N/A'}\n\n`;
    });
    receipt += `Subtotal: $${subtotal}\n`;
    receipt += `Propina: $${tip}\n`;
    receipt += `Pago: ${paymentMethod ?? 'No definido'}\n`;
    receipt += `Total: $${total}\n\n`;
    receipt += '¡Gracias por tu pedido! Tu comida estará lista pronto. 🍽️';
    return receipt;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
          <Text style={styles.backText}>Seguir buscando</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Carrito</Text>
      </View>

      {cartCount === 0 ? (
        <View style={styles.emptyCartContainer}>
          <Ionicons name="cart-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.emptyCartText}>Tu carrito está vacío.</Text>
          <Text style={styles.emptyCartSubText}>
            Agrega platillos desde la búsqueda y vuelve cuando quieras.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={[styles.content, isWeb && styles.contentWeb]}
          contentContainerStyle={!isWeb ? [styles.mobileContentContainer, { paddingBottom: mobileBottomPadding }] : undefined}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          scrollEnabled
        >
          {isWeb ? (
            <ScrollView
              contentContainerStyle={styles.webContainer}
              showsVerticalScrollIndicator={Platform.OS === 'web'}
            >
              <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.tableColName]}>Platillo</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableColRest]}>Restaurante</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableColPrice]}>Precio</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableColQty]}>Cantidad</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableColTotal]}>Total</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableColAction]} />
                </View>
                {cartItems.map((item) => (
                  <View key={item.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableColName]} numberOfLines={1}>
                      {item.nombre}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableColRest]} numberOfLines={1}>
                      {item.restaurantName}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableColPrice]}>${item.precio}</Text>
                    <View
                      style={[
                        styles.tableCell,
                        styles.tableColQty,
                        styles.quantityRowCompact,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.quantityButtonSmall}
                        onPress={() => decreaseQuantity(item.id)}
                      >
                        <Text style={styles.quantityButtonSmallText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityValueCompact}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButtonSmall}
                        onPress={() => increaseQuantity(item.id)}
                      >
                        <Text style={styles.quantityButtonSmallText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.tableCell, styles.tableColTotal, styles.cellBold]}>
                      ${item.precio * item.quantity}
                    </Text>
                    <TouchableOpacity
                      style={[styles.tableCell, styles.tableColAction]}
                      onPress={() => removeItem(item.id)}
                    >
                      <Ionicons name="trash-bin-outline" size={18} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            // En movil renderizamos items en el mismo scroll para evitar recortes en la zona de pago.
            <View style={styles.mobileItemsList}>
              {cartItems.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemCardHeader}>
                    <Text style={styles.itemName}>{item.nombre}</Text>
                    <TouchableOpacity onPress={() => removeItem(item.id)}>
                      <Ionicons name="trash-bin-outline" size={22} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemRestaurant}>{item.restaurantName}</Text>
                  <Text style={styles.itemPrice}>
                    {item.quantity} × ${item.precio}
                  </Text>
                  <View style={styles.quantityRow}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => decreaseQuantity(item.id)}
                    >
                      <Text style={styles.quantityButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityValue}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => increaseQuantity(item.id)}
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {!isWeb && cartSuggestions.length > 0 && (
            <View style={styles.suggestionsCard}>
              <Text style={styles.suggestionsTitle}>Sugerencias inteligentes</Text>
              {cartSuggestions.map((suggestion, index) => (
                <View key={index} style={styles.suggestionItem}>
                  <Text style={styles.suggestionText}>
                    Cambia {suggestion.original.nombre} por {suggestion.alternative.nombre} y ahorra $
                    {suggestion.savings}.
                  </Text>
                  <Text style={styles.suggestionHint}>
                    Misma categoría: {suggestion.original.categoria}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.summaryCard, isWeb && styles.summaryCardWeb]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>${subtotal}</Text>
            </View>
            {!isAuthenticated && (
              <View style={styles.authNoticeCard}>
                <View style={styles.authNoticeIconWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme.primary} />
                </View>
                <View style={styles.authNoticeTextContainer}>
                  <Text style={styles.authNoticeTitle}>Necesitas iniciar sesión para pedir</Text>
                  <Text style={styles.authNoticeText}>
                    Puedes explorar la app libremente, pero para pagar y finalizar el pedido debes
                    tener una cuenta.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.authNoticeButton}
                  onPress={() => navigation.navigate('Account')}
                >
                  <Text style={styles.authNoticeButtonText}>Ir a perfil</Text>
                </TouchableOpacity>
              </View>
            )}
            {!isWeb && (
              <>
                <View style={styles.tipRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryLabel}>Propina (COP)</Text>
                    <TextInput
                      style={[styles.tipInput, styles.tipInputCompact]}
                      placeholder="0"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={tipInput}
                      onChangeText={setTipInput}
                      onEndEditing={handleSetTip}
                    />
                  </View>
                  <TouchableOpacity style={styles.tipButton} onPress={handleSetTip}>
                    <Text style={styles.tipButtonText}>Agregar</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.tipHelperText}>
                  Elige una propina rápida basada en tu subtotal:
                </Text>
                <View style={styles.tipOptionsRow}>
                  {[10, 15, 20, 25].map((percent, index, arr) => (
                    <TouchableOpacity
                      key={percent}
                      style={[
                        styles.tipOptionButton,
                        index === arr.length - 1 ? styles.tipOptionButtonLast : undefined,
                      ]}
                      onPress={() => handleSetTipPercent(percent)}
                    >
                      <Text style={styles.tipOptionText}>{percent}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.tipQuickSummary}>
                  <Text style={styles.tipQuickText}>10% = ${Math.round(subtotal * 0.1)}</Text>
                  <Text style={styles.tipQuickText}>15% = ${Math.round(subtotal * 0.15)}</Text>
                  <Text style={styles.tipQuickText}>20% = ${Math.round(subtotal * 0.2)}</Text>
                </View>
              </>
            )}
            {isWeb && (
              <View style={styles.tipRowWeb}>
                <View style={styles.tipInputWebContainer}>
                  <Text style={styles.summaryLabelWeb}>Propina:</Text>
                  <TextInput
                    style={styles.tipInputWeb}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    value={tipInput}
                    onChangeText={setTipInput}
                    onEndEditing={handleSetTip}
                  />
                </View>
                <View style={styles.tipButtonsWebRow}>
                  {[10, 15, 20].map((percent) => (
                    <TouchableOpacity
                      key={percent}
                      style={styles.tipButtonWeb}
                      onPress={() => handleSetTipPercent(percent)}
                    >
                      <Text style={styles.tipButtonWebText}>{percent}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${total}</Text>
            </View>
            <View style={styles.paymentSection}>
              <Text style={styles.paymentTitle}>Método de pago (demo)</Text>
              <Text style={styles.paymentSubtitle}>
                Solo usuarios con sesión activa pueden finalizar pedidos.
              </Text>
              <View style={styles.paymentOptionsRow}>
                {PAYMENT_METHOD_OPTIONS.map((option) => {
                  const isSelected = selectedPaymentMethod === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.paymentOptionButton, isSelected && styles.paymentOptionSelected]}
                      onPress={() => setSelectedPaymentMethod(option.key)}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={option.icon}
                        size={16}
                        color={isSelected ? theme.surface : theme.primary}
                      />
                      <Text
                        style={[
                          styles.paymentOptionText,
                          isSelected && styles.paymentOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <CustomButton
              title={submittingOrder ? 'Procesando pedido...' : 'Finalizar pedido'}
              onPress={openPaymentConfirmation}
            />
            <TouchableOpacity style={styles.dangerButton} onPress={handleClearCart}>
              <Text style={styles.dangerButtonText}>Vaciar carrito</Text>
            </TouchableOpacity>
            {!isWeb && <View style={{ height: insets.bottom + 18 }} />}
          </View>

          <Modal visible={receiptVisible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Factura de tu pedido</Text>
                <ScrollView style={styles.modalScroll}>
                  <Text style={styles.modalText}>{receiptText}</Text>
                </ScrollView>
                <CustomButton title="Cerrar" onPress={closeReceipt} />
              </View>
            </View>
          </Modal>

          <Modal visible={showPaymentConfirm} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.confirmModal}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="card-outline" size={22} color={theme.primary} />
                </View>
                <Text style={styles.modalTitle}>Confirmar pago</Text>
                <Text style={styles.modalText}>Usuario: {currentUser?.name || 'N/A'}</Text>
                <Text style={styles.modalText}>Método: {selectedPaymentMethod || 'N/A'}</Text>
                <Text style={styles.modalText}>Total a pagar: ${total}</Text>
                <View style={styles.confirmButtonsRow}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.cancelButton]}
                    onPress={() => setShowPaymentConfirm(false)}
                  >
                    <Text style={[styles.modalActionButtonText, { color: theme.text }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.confirmButton]}
                    onPress={handleFinalizeOrder}
                    disabled={submittingOrder}
                  >
                    <Text style={styles.modalActionButtonText}>
                      {submittingOrder ? 'Procesando...' : 'Pagar y pedir'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal visible={showAuthRequired} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.confirmModal}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="person-circle-outline" size={24} color={theme.primary} />
                </View>
                <Text style={styles.modalTitle}>Iniciar sesión para pagar</Text>
                <Text style={styles.modalText}>
                  Para finalizar tu pedido y procesar el pago demo necesitas una cuenta creada o
                  una sesión activa.
                </Text>
                <Text style={styles.modalText}>
                  Puedes seguir explorando toda la app sin problema mientras no pagues.
                </Text>
                <View style={styles.confirmButtonsRow}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.cancelButton]}
                    onPress={() => setShowAuthRequired(false)}
                  >
                    <Text style={[styles.modalActionButtonText, { color: theme.text }]}>Seguir explorando</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.confirmButton]}
                    onPress={() => {
                      setShowAuthRequired(false);
                      navigation.navigate('Account');
                    }}
                  >
                    <Text style={styles.modalActionButtonText}>Ir a perfil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal visible={showClearConfirm} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.confirmModal}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="warning-outline" size={22} color={theme.error} />
                </View>
                <Text style={styles.modalTitle}>Vaciar carrito</Text>
                <Text style={styles.modalText}>
                  ¿Deseas eliminar todos los productos del carrito?
                </Text>
                <View style={styles.confirmButtonsRow}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.cancelButton]}
                    onPress={cancelClearCart}
                  >
                    <Text style={[styles.modalActionButtonText, { color: theme.text }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.confirmButton]}
                    onPress={confirmClearCart}
                  >
                    <Text style={styles.modalActionButtonText}>Confirmar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: { flexDirection: 'row', alignItems: 'center' },
    backText: { color: theme.text, fontSize: 14, marginLeft: 8 },
    title: { fontSize: 22, fontWeight: '800', color: theme.text },
    emptyCartContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 30,
    },
    emptyCartText: { marginTop: 20, fontSize: 20, fontWeight: '700', color: theme.text },
    emptyCartSubText: {
      marginTop: 8,
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    content: { flex: 1, paddingHorizontal: 18, paddingTop: 8 },
    mobileContentContainer: { paddingBottom: 42 },
    mobileItemsList: {
      marginBottom: 8,
    },
    itemCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 13,
      marginBottom: 9,
      borderWidth: 1,
      borderColor: theme.border,
    },
    itemCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    itemName: { fontSize: 15, fontWeight: '700', color: theme.text, flex: 1, marginRight: 10 },
    itemRestaurant: { color: theme.textSecondary, fontSize: 12, marginBottom: 8 },
    itemPrice: { fontSize: 14, color: theme.text, marginBottom: 10 },
    quantityRow: { flexDirection: 'row', alignItems: 'center' },
    quantityButton: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quantityButtonText: { fontSize: 16, color: theme.primary, fontWeight: '700' },
    quantityValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginHorizontal: 10,
      minWidth: 24,
      textAlign: 'center',
    },
    summaryCard: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    summaryLabel: { color: theme.textSecondary, fontSize: 15 },
    summaryValue: { color: theme.text, fontSize: 15, fontWeight: '700' },
    tipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    tipInput: {
      backgroundColor: theme.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text,
      height: 44,
      paddingHorizontal: 14,
      marginTop: 8,
    },
    tipInputCompact: { height: 44 },
    tipButton: {
      marginLeft: 10,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 15,
    },
    tipButtonText: { color: theme.surface, fontWeight: '700' },
    tipHelperText: { marginTop: 4, color: theme.textSecondary, fontSize: 13, marginBottom: 8 },
    tipOptionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    tipOptionButton: {
      flex: 1,
      backgroundColor: theme.primaryLight,
      paddingVertical: 9,
      borderRadius: 12,
      marginRight: 6,
      alignItems: 'center',
    },
    tipOptionButtonLast: {
      marginRight: 0,
    },
    tipOptionText: { color: theme.primary, fontWeight: '700' },
    tipQuickSummary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
    tipQuickText: { color: theme.textSecondary, fontSize: 13, flex: 1 },
    suggestionsCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 3,
    },
    suggestionsTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 10 },
    suggestionItem: { marginBottom: 10 },
    suggestionText: { color: theme.text, fontSize: 14, marginBottom: 3 },
    suggestionHint: { color: theme.textSecondary, fontSize: 13 },
    totalRow: { marginBottom: 20 },
    totalLabel: { fontSize: 18, fontWeight: '700', color: theme.text },
    totalValue: { fontSize: 18, fontWeight: '900', color: theme.primary },
    authNoticeCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: theme.primary + '0F',
      borderWidth: 1,
      borderColor: theme.primary + '25',
      borderRadius: 14,
      padding: 14,
      marginBottom: 16,
    },
    authNoticeIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.primary + '25',
      alignItems: 'center',
      justifyContent: 'center',
    },
    authNoticeTextContainer: {
      flex: 1,
      paddingRight: 8,
    },
    authNoticeTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 4,
    },
    authNoticeText: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '500',
    },
    authNoticeButton: {
      alignSelf: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.primary,
    },
    authNoticeButtonText: {
      color: theme.surface,
      fontWeight: '700',
      fontSize: 12,
    },
    paymentSection: { marginBottom: 14 },
    paymentTitle: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 14,
      marginBottom: 10,
    },
    paymentSubtitle: {
      color: theme.textSecondary,
      fontSize: 12,
      marginBottom: 10,
      lineHeight: 18,
      fontWeight: '500',
    },
    paymentOptionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    paymentOptionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 11,
      backgroundColor: theme.surface,
    },
    paymentOptionSelected: {
      backgroundColor: theme.primary,
    },
    paymentOptionText: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    paymentOptionTextSelected: {
      color: theme.surface,
    },
    dangerButton: {
      marginTop: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.error,
      backgroundColor: theme.background,
    },
    dangerButtonText: { color: theme.error, fontSize: 14, fontWeight: '700' },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 520,
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 22,
      borderWidth: 1,
      borderColor: theme.border,
    },
    confirmModal: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: theme.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 14 },
    modalText: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 14,
    },
    modalScroll: { maxHeight: 240, marginBottom: 16 },
    confirmButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    modalActionButton: {
      minHeight: 42,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalActionButtonText: { color: theme.surface, fontSize: 13, fontWeight: '700' },
    cancelButton: { flex: 1, marginRight: 10, borderColor: theme.border },
    confirmButton: { flex: 1, backgroundColor: theme.error, borderColor: theme.error },
    contentWeb: { paddingHorizontal: 20 },
    webContainer: { paddingVertical: 16 },
    tableContainer: {
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: theme.primary + '15',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tableHeaderCell: { fontSize: 14, fontWeight: '700', color: theme.text },
    tableRow: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: theme.border + '40',
      alignItems: 'center',
    },
    tableCell: { fontSize: 13, color: theme.text, paddingRight: 8 },
    tableColName: { flex: 2 },
    tableColRest: { flex: 1.5 },
    tableColPrice: { flex: 0.7, textAlign: 'center' },
    tableColQty: { flex: 1, justifyContent: 'center' },
    tableColTotal: { flex: 0.8, textAlign: 'center' },
    tableColAction: { flex: 0.5, justifyContent: 'center', alignItems: 'center' },
    quantityRowCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: 0,
    },
    quantityButtonSmall: {
      width: 24,
      height: 24,
      borderRadius: 4,
      backgroundColor: theme.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 3,
    },
    quantityButtonSmallText: { color: theme.primary, fontSize: 12, fontWeight: '600' },
    quantityValueCompact: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
      minWidth: 20,
      textAlign: 'center',
    },
    cellBold: { fontWeight: '700' },
    summaryCardWeb: { marginHorizontal: 20, marginBottom: 14 },
    tipRowWeb: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginTop: 12,
    },
    tipInputWebContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
    summaryLabelWeb: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginRight: 8 },
    tipInputWeb: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      color: theme.text,
      backgroundColor: theme.background,
      minHeight: 36,
    },
    tipButtonsWebRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    tipButtonWeb: {
      minWidth: 60,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipButtonWebText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  });
