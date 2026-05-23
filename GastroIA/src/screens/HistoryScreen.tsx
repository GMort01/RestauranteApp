// src/screens/HistoryScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ListRenderItemInfo,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettings } from '../context/SettingsContext';
import { useHistory } from '../context/HistoryContext';
import { RootStackParamList, Purchase, CartItem, Theme } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'History'>;

export default function HistoryScreen() {
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 980 ? 26 : width >= 700 ? 20 : 14;
  const contentMaxWidth = width >= 980 ? 980 : width >= 700 ? 760 : undefined;
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useSettings();
  const { purchaseHistory = [] } = useHistory();
  const styles = getStyles(theme, horizontalPadding, contentMaxWidth);

  const totalSpent = purchaseHistory.reduce((sum, purchase) => sum + purchase.total, 0);
  const averageTip =
    purchaseHistory.length > 0
      ? Math.round(
          purchaseHistory.reduce((sum, purchase) => sum + purchase.tip, 0) / purchaseHistory.length
        )
      : 0;
  const ordersCount = purchaseHistory.length;

  const categoryCounts = purchaseHistory.reduce<Record<string, number>>((counts, purchase) => {
    purchase.items.forEach((item: CartItem) => {
      const category = item.categoria || 'Otros';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, {});

  const mostCommonCategory = Object.keys(categoryCounts).reduce<string | null>((best, category) => {
    if (!best || categoryCounts[category] > categoryCounts[best]) {
      return category;
    }
    return best;
  }, null);

  const renderPurchase = ({ item }: ListRenderItemInfo<Purchase>) => (
    <View style={styles.purchaseCard}>
      <Text style={styles.purchaseDate}>{item.date}</Text>
      {item.backendOrderId ? (
        <Text style={styles.orderIdText}>Pedido backend #{item.backendOrderId}</Text>
      ) : null}
      {item.paymentMethod ? (
        <Text style={styles.paymentMethodText}>Pago: {item.paymentMethod}</Text>
      ) : null}
      <FlatList
        data={item.items}
        keyExtractor={(purchaseItem, index) => `${purchaseItem.id || purchaseItem.nombre}-${index}`}
        renderItem={({ item: purchaseItem }: ListRenderItemInfo<CartItem>) => (
          <Text style={styles.purchaseItem}>
            {purchaseItem.nombre} x{purchaseItem.quantity} - ${purchaseItem.precio * purchaseItem.quantity}
          </Text>
        )}
      />
      <View style={styles.purchaseSummary}>
        <Text style={styles.purchaseText}>Subtotal: ${item.subtotal}</Text>
        <Text style={styles.purchaseText}>Propina: ${item.tip}</Text>
        <Text style={styles.purchaseTotal}>Total: ${item.total}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerShell}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={theme.primary} />
            <Text style={styles.backText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Historial de Compras</Text>

        {ordersCount > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Pedidos totales: {ordersCount}</Text>
            <Text style={styles.summaryLabel}>Gasto total: ${totalSpent}</Text>
            <Text style={styles.summaryLabel}>Propina promedio: ${averageTip}</Text>
            <Text style={styles.summaryLabel}>Categoría favorita: {mostCommonCategory || 'N/A'}</Text>
          </View>
        )}

        {purchaseHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>Aún no tienes compras anteriores.</Text>
          </View>
        ) : (
          <FlatList
            data={purchaseHistory}
            keyExtractor={(item) => item.id}
            renderItem={renderPurchase}
            contentContainerStyle={styles.historyList}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme, horizontalPadding: number, contentMaxWidth?: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    headerShell: {
      paddingHorizontal: horizontalPadding,
    },
    header: {
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backText: {
      color: theme.primary,
      marginLeft: 8,
      fontSize: 16,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      paddingHorizontal: horizontalPadding,
      paddingTop: 20,
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 18,
    },
    summaryCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    summaryLabel: {
      color: theme.text,
      fontSize: 14,
      marginBottom: 6,
    },
    historyList: {
      paddingBottom: 30,
    },
    purchaseCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    purchaseDate: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.primary,
      marginBottom: 10,
    },
    orderIdText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 10,
      fontWeight: '600',
    },
    paymentMethodText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 10,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    purchaseItem: {
      fontSize: 13,
      color: theme.text,
      marginBottom: 4,
    },
    purchaseSummary: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    purchaseText: {
      color: theme.textSecondary,
      fontSize: 13,
      marginBottom: 3,
    },
    purchaseTotal: {
      color: theme.primary,
      fontWeight: '800',
      fontSize: 14,
      marginTop: 4,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.textSecondary,
    },
  });
