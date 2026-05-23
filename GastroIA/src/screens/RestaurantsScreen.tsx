import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  ListRenderItemInfo,
  TextInput,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import HeaderComponent from '../components/HeaderComponent';
import ProSideMenu from '../components/ProSideMenu';
import { fetchRestaurants } from '../services/apiService';
import { CartContext } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { Restaurant, RootStackParamList, Theme } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Restaurants'>;

export default function RestaurantsScreen() {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp>();
  const { cartCount } = useContext(CartContext);
  const { theme } = useSettings();
  const styles = getStyles(theme, width);

  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const listAnim = useRef(new Animated.Value(0)).current;

  const filteredRestaurants = restaurants.filter((restaurant) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      restaurant.nombre.toLowerCase().includes(query) ||
      restaurant.categoria.toLowerCase().includes(query)
    );
  });

  const loadRestaurants = useCallback(async () => {
    try {
      setError('');
      const data = await fetchRestaurants();
      setRestaurants(data);
    } catch (err) {
      setError('No se pudo cargar la lista de restaurantes.');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadRestaurants();
    }, [loadRestaurants])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadRestaurants();
  };

  useEffect(() => {
    if (loading || filteredRestaurants.length === 0) {
      listAnim.setValue(0);
      return;
    }

    listAnim.setValue(0);
    Animated.timing(listAnim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [filteredRestaurants.length, loading, listAnim]);

  const getAnimatedItemStyle = (index: number) => {
    const delayPoint = Math.min(0.8, index * 0.08);
    return {
      opacity: listAnim.interpolate({
        inputRange: [0, delayPoint, 1],
        outputRange: [0, 0, 1],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          translateY: listAnim.interpolate({
            inputRange: [0, delayPoint, 1],
            outputRange: [10, 10, 0],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProSideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />

      <HeaderComponent
        onOpenMenu={() => setMenuVisible(true)}
        onOpenCart={() => navigation.navigate('Cart')}
        cartCount={cartCount}
      />

      <View style={styles.content}>
        <Text style={styles.title}>Restaurantes disponibles</Text>
        <Text style={styles.subtitle}>Explora los aliados conectados a GastroIA.</Text>

        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="storefront-outline" size={20} color={theme.primary} />
            </View>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroTitle}>Explora con criterio, sin ruido visual</Text>
              <Text style={styles.heroSubtitle}>
                Toca una tarjeta para ver su menú filtrado y seguir el flujo sin perder contexto.
              </Text>
            </View>
          </View>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatChip}>
              <Text style={styles.heroStatValue}>{restaurants.length}</Text>
              <Text style={styles.heroStatLabel}>Locales</Text>
            </View>
            <View style={styles.heroStatChip}>
              <Text style={styles.heroStatValue}>1 toque</Text>
              <Text style={styles.heroStatLabel}>Acceso al menú</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre o categoría"
            placeholderTextColor={theme.textSecondary}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Cargando restaurantes...</Text>
          </View>
        ) : error !== '' ? (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={22} color={theme.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadRestaurants}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredRestaurants}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }: ListRenderItemInfo<Restaurant>) => (
              <Animated.View style={getAnimatedItemStyle(index)}>
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate('Home', {
                      restaurantId: item.id,
                      restaurantName: item.nombre,
                    })
                  }
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.nameBlock}>
                      <Text style={styles.restaurantName}>{item.nombre}</Text>
                      <Text style={styles.restaurantCategory}>{item.categoria}</Text>
                    </View>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={14} color={theme.primary} />
                      <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="restaurant-outline" size={16} color={theme.textSecondary} />
                      <Text style={styles.metaText}>{item.categoria}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="timer-outline" size={16} color={theme.textSecondary} />
                      <Text style={styles.metaText}>{item.entrega}</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.cardFooterText}>Toca para abrir su menú filtrado</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {search.trim().length > 0
                    ? 'No hay resultados para esa búsqueda.'
                    : 'No hay restaurantes registrados todavía.'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme, screenWidth: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 18,
      paddingTop: 6,
      width: '100%',
      alignSelf: 'center',
      maxWidth: screenWidth >= 980 ? 980 : screenWidth >= 700 ? 760 : undefined,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.4,
    },
    subtitle: {
      marginTop: 6,
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 16,
      fontWeight: '500',
    },
    heroCard: {
      borderRadius: 22,
      padding: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
      elevation: 3,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    heroIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: theme.primaryLight + '90',
      borderWidth: 1,
      borderColor: theme.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTextBlock: {
      flex: 1,
    },
    heroTitle: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 4,
    },
    heroSubtitle: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    heroStatChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    heroStatValue: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 2,
    },
    heroStatLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: 16,
      paddingHorizontal: 11,
      paddingVertical: 10,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      marginLeft: 8,
      color: theme.text,
      fontSize: 14,
      fontWeight: '500',
    },
    clearButton: {
      paddingLeft: 6,
    },
    listContent: {
      paddingBottom: 22,
    },
    loadingWrapper: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      gap: 10,
    },
    nameBlock: {
      flex: 1,
      paddingRight: 8,
    },
    restaurantName: {
      fontSize: 17,
      color: theme.text,
      fontWeight: '800',
      marginBottom: 3,
      letterSpacing: -0.2,
    },
    restaurantCategory: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    ratingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.primaryLight + '35',
      borderColor: theme.primaryLight,
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    ratingText: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    metaRow: {
      flexDirection: 'row',
      gap: 14,
      marginTop: 4,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    metaText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '500',
      flexShrink: 1,
    },
    cardFooter: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardFooterText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    errorCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.error + '66',
      backgroundColor: theme.error + '12',
      padding: 16,
      gap: 10,
      alignItems: 'flex-start',
    },
    errorText: {
      color: theme.error,
      fontWeight: '600',
      fontSize: 14,
      lineHeight: 20,
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    retryButtonText: {
      color: theme.surface,
      fontWeight: '700',
      fontSize: 13,
    },
    emptyState: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 18,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      fontWeight: '500',
    },
  });
