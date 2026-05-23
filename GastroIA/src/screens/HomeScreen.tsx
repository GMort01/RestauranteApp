// src/screens/HomeScreen.tsx
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  ListRenderItemInfo,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '../components/CustomButton';
import HeaderComponent from '../components/HeaderComponent';
import ProSideMenu from '../components/ProSideMenu';
import GastroBot from '../components/GastroBot';
import { getAIRecommendations, getNearbyRecommendations } from '../services/aiService';
import { fetchMenuItems } from '../services/apiService';
import { CartContext } from '../context/CartContext';
import { ProfileContext } from '../context/ProfileContext';
import { useFavorites } from '../context/FavoritesContext';
import { useSettings } from '../context/SettingsContext';
import { RootStackParamList, MenuItem, Theme } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type HomeRouteProp = RouteProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  // Breakpoints usados para no estirar contenido en tablet/web.
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<HomeRouteProp>();
  const { addItem, cartCount } = useContext(CartContext);
  const { dietType, allergies } = useContext(ProfileContext);
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  const { notificationsEnabled, theme } = useSettings();
  const [antojo, setAntojo] = useState<string>('');
  const [respuestaIA, setRespuestaIA] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [recommendations, setRecommendations] = useState<MenuItem[]>([]);
  const [budget, setBudget] = useState<string>('');
  const [budgetFeedback, setBudgetFeedback] = useState<string>('');
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const [gastroBotVisible, setGastroBotVisible] = useState<boolean>(false);
  const recommendationsAnim = useRef(new Animated.Value(0)).current;
  const styles = getStyles(theme, width);
  const quickSearches = [
    { label: 'Hamburguesa', query: 'hamburguesa con papas' },
    { label: 'Tacos', query: 'tacos al pastor' },
    { label: 'Ligero', query: 'comida ligera y saludable' },
  ];
  const activeSearchLabel = route.params?.restaurantName
    ? `Menú de ${route.params.restaurantName}`
    : antojo.trim();

  useEffect(() => {
    const restaurantId = route.params?.restaurantId;
    const restaurantName = route.params?.restaurantName;

    if (!restaurantId) return;

    const loadRestaurantMenu = async () => {
      // Si llega desde la pantalla de restaurantes, precarga menu contextual.
      setLoading(true);
      setRespuestaIA('');
      setBudgetFeedback('');

      try {
        const menu = await fetchMenuItems({ restaurant_id: restaurantId });
        setRecommendations(menu);
        setRespuestaIA(
          `Mostrando ${menu.length} platos de ${restaurantName ?? 'este restaurante'}.`
        );
      } catch (error) {
        setRespuestaIA('No pude cargar el menú de ese restaurante. Inténtalo de nuevo.');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadRestaurantMenu();
  }, [route.params?.restaurantId, route.params?.restaurantName]);

  useEffect(() => {
    if (recommendations.length === 0) {
      recommendationsAnim.setValue(0);
      return;
    }

    // Animacion de entrada suave para mejorar legibilidad en listas largas.
    recommendationsAnim.setValue(0);
    Animated.timing(recommendationsAnim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [recommendations.length, recommendationsAnim]);

  const runRecommendationSearch = async (searchTerm: string) => {
    const cleanSearch = searchTerm.trim();

    if (cleanSearch === '') {
      setRespuestaIA('Dime qué te gustaría comer hoy para empezar a buscar. ✨');
      setRecommendations([]);
      return;
    }
    setLoading(true);
    setRespuestaIA('');
    setRecommendations([]);
    setBudgetFeedback('');

    try {
      const results = await getAIRecommendations({ search: cleanSearch, dietType, allergies });
      if (results.length > 0) {
        setRecommendations(results);
        setRespuestaIA(`¡Encontré ${results.length} recomendaciones basadas en "${cleanSearch}"!`);
      } else {
        // Fallback para no dejar la UI vacia cuando no hay match exacto.
        const nearby = await getNearbyRecommendations({ search: cleanSearch, dietType, allergies });
        setRecommendations(nearby);
        if (nearby.length > 0) {
          setRespuestaIA(
            `No encontré coincidencias exactas para "${cleanSearch}", pero aquí tienes ${nearby.length} sugerencias cercanas.`
          );
        } else {
          setRespuestaIA(
            `No encontré resultados para "${cleanSearch}" con tus filtros actuales. Prueba con otra palabra o ajusta dieta/alergias.`
          );
        }
      }
    } catch (error) {
      setRespuestaIA('Lo siento, hubo un error al buscar recomendaciones. Inténtalo de nuevo.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const analizarAntojo = async () => {
    await runRecommendationSearch(antojo);
  };

  const handleQuickSearch = async (query: string) => {
    setAntojo(query);
    await runRecommendationSearch(query);
  };

  // Callback cuando GastroBot termina la conversación con Gemini
  const handleBotRecommendations = async (prefs: {
    search: string;
    dietType: string;
    allergies: string[];
    budget: number | null;
    message: string;
  }) => {
    setAntojo(prefs.search);
    if (prefs.budget) setBudget(String(prefs.budget));
    setRespuestaIA(prefs.message);
    await runRecommendationSearch(prefs.search);
  };

  const budgetAmount = Number(budget.replace(/[^0-9]/g, '')) || 0;
  // El filtro por presupuesto se aplica sobre las recomendaciones ya calculadas.
  const budgetRecommendations =
    budgetAmount > 0
      ? recommendations.filter((item) => Number(item.precio) <= budgetAmount)
      : recommendations;
  const budgetMessage =
    budgetAmount > 0
      ? `Mostrando ${budgetRecommendations.length} platillos dentro de tu presupuesto de $${budgetAmount}.`
      : '';

  const handleBudgetChange = (value: string) => {
    const formatted = value.replace(/[^0-9]/g, '');
    setBudget(formatted);
  };

  const getDishEmoji = (item: MenuItem): string => {
    const categoria = item.categoria?.toLowerCase() || '';
    if (categoria.includes('pasta')) return '🍝';
    if (categoria.includes('pizza')) return '🍕';
    if (categoria.includes('tacos') || categoria.includes('taco')) return '🌮';
    if (categoria.includes('sushi')) return '🍣';
    if (categoria.includes('burger')) return '🍔';
    if (categoria.includes('ensalada')) return '🥗';
    if (categoria.includes('postre') || categoria.includes('dessert')) return '🍰';
    return '🍽️';
  };

  const getAnimatedItemStyle = (index: number) => {
    const delayPoint = Math.min(0.82, index * 0.08);
    return {
      opacity: recommendationsAnim.interpolate({
        inputRange: [0, delayPoint, 1],
        outputRange: [0, 0, 1],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          translateY: recommendationsAnim.interpolate({
            inputRange: [0, delayPoint, 1],
            outputRange: [12, 12, 0],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  };

  const openGastroBot = () => {
    setGastroBotVisible(true);
  };

  const handleApplyBudget = async () => {
    if (budgetAmount <= 0) {
      setBudgetFeedback('Ingresa un presupuesto válido.');
      return;
    }

    let sourceItems = recommendations;

    if (sourceItems.length === 0) {
      setLoading(true);
      try {
        const fallbackMenu = await fetchMenuItems(
          route.params?.restaurantId
            ? { restaurant_id: route.params.restaurantId }
            : undefined
        );
        setRecommendations(fallbackMenu);
        sourceItems = fallbackMenu;
      } catch (error) {
        setBudgetFeedback('No pude cargar productos para aplicar el presupuesto.');
        console.error(error);
        return;
      } finally {
        setLoading(false);
      }
    }

    const withinBudget = sourceItems.filter((item) => Number(item.precio) <= budgetAmount);
    setBudgetFeedback(
      withinBudget.length > 0
        ? `Mostrando ${withinBudget.length} platillos dentro de tu presupuesto de $${budgetAmount}.`
        : `No hay productos por debajo de $${budgetAmount}. Prueba con un monto mayor.`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProSideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, minHeight: 0 }}>
          <HeaderComponent
            onOpenMenu={() => setMenuVisible(true)}
            onOpenCart={() => navigation.navigate('Cart')}
            cartCount={cartCount}
          />

          <FlatList
            style={styles.listShell}
            data={budgetRecommendations}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <>
                <View style={styles.heroCard}>
                  {route.params?.restaurantId && (
                    <TouchableOpacity
                      style={styles.backToRestaurantsButton}
                      activeOpacity={0.82}
                      onPress={() => navigation.navigate('Restaurants')}
                    >
                      <Ionicons name="chevron-back" size={16} color={theme.primary} />
                      <Text style={styles.backToRestaurantsText}>Volver a restaurantes</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.heroTitle}>
                    {route.params?.restaurantName
                      ? `Explorando ${route.params.restaurantName}`
                      : 'Encuentra algo rico sin perder tiempo'}
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    {route.params?.restaurantName
                      ? 'Vista compacta para decidir rápido.'
                      : 'Busca, filtra y ve resultados claros en una sola pantalla.'}
                  </Text>
                </View>

                <View style={styles.inputSection}>
                  <View style={styles.sectionTopRow}>
                    <Text style={styles.sectionTitle}>Buscar y filtrar</Text>
                    <Text style={styles.sectionBadge}>
                      {recommendations.length > 0 ? `${recommendations.length} resultados` : 'Inicio'}
                    </Text>
                  </View>
                  <Text style={styles.profileHint}>
                    Filtros activos:{' '}
                    {dietType === 'ambos'
                      ? 'Sin restricción'
                      : dietType === 'carnivoro'
                      ? 'Carnívoro'
                      : dietType === 'vegetariano'
                      ? 'Vegetariano'
                      : 'Vegano'}
                    {allergies.length > 0 ? ` • Alergias: ${allergies.join(', ')}` : ''}
                  </Text>

                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="search-outline"
                      size={18}
                      color={theme.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Busca un plato o un antojo"
                      placeholderTextColor={theme.textSecondary}
                      value={antojo}
                      onChangeText={setAntojo}
                      multiline={false}
                      returnKeyType="search"
                      blurOnSubmit={true}
                      onSubmitEditing={analizarAntojo}
                    />
                    <TouchableOpacity
                      style={styles.chatActionButton}
                      onPress={openGastroBot}
                      activeOpacity={0.82}
                    >
                      <Ionicons name="chatbubbles" size={16} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.searchActionButton, (!antojo.trim() || loading) && styles.searchActionButtonDisabled]}
                      onPress={analizarAntojo}
                      disabled={loading || !antojo.trim()}
                      activeOpacity={0.82}
                    >
                      <Ionicons name="search" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inlineInfoRow}>
                    <Text style={styles.notificationInfo}>
                      {notificationsEnabled ? 'Notificaciones activas.' : 'Notificaciones desactivadas.'}
                    </Text>
                    <Text style={styles.notificationInfoAccent}>
                      {notificationsEnabled
                        ? 'Te avisaremos si hay sugerencias nuevas.'
                        : 'Actívalas en Configuración.'}
                    </Text>
                  </View>

                  <View style={styles.budgetCard}>
                    <Text style={styles.budgetLabel}>Presupuesto opcional</Text>
                    <View style={styles.budgetInputRow}>
                      <TextInput
                        style={styles.budgetInput}
                        placeholder="Ej: 25000"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="numeric"
                        value={budget}
                        onChangeText={handleBudgetChange}
                      />
                      <CustomButton
                        title="Aplicar"
                        onPress={handleApplyBudget}
                        style={styles.budgetButton}
                      />
                    </View>
                    {budgetFeedback !== '' && (
                      <Text style={styles.budgetFeedback}>{budgetFeedback}</Text>
                    )}
                  </View>

                  <View style={styles.quickSearchRow}>
                    {quickSearches.map((item) => (
                      <TouchableOpacity
                        key={item.label}
                        style={styles.quickSearchChip}
                        activeOpacity={0.82}
                        onPress={() => handleQuickSearch(item.query)}
                      >
                        <Text style={styles.quickSearchChipText}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.secondaryButtonWrapper}>
                    <CustomButton
                      title="Ver lista de restaurantes"
                      onPress={() => navigation.navigate('Restaurants')}
                      style={styles.secondaryButton}
                      textStyle={styles.secondaryButtonText}
                    />
                  </View>
                </View>

                {respuestaIA !== '' && (
                  <View style={styles.aiResponseSection}>
                    <View style={styles.aiHeader}>
                      <Ionicons name="logo-electron" size={20} color={theme.primary} />
                      <Text style={styles.aiHeaderText}>Respuesta de GastroIA</Text>
                    </View>
                    <View style={styles.aiBubble}>
                      <Text style={styles.aiText}>{respuestaIA}</Text>
                    </View>
                  </View>
                )}

                {loading && (
                  <View style={styles.loadingSection}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={styles.loadingText}>Analizando tus preferencias...</Text>
                  </View>
                )}

                {!loading && (recommendations.length > 0 || respuestaIA !== '') && (
                  <View style={styles.resultsSummaryCard}>
                    <View style={styles.resultsSummaryTopRow}>
                      <View style={styles.resultsSummaryTextWrap}>
                        <Text style={styles.resultsSummaryLabel}>
                          {recommendations.length > 0 ? 'Resultados listos' : 'Resultado de la búsqueda'}
                        </Text>
                        <Text style={styles.resultsSummaryTitle} numberOfLines={2}>
                          {activeSearchLabel || 'Explora recomendaciones'}
                        </Text>
                      </View>
                      {recommendations.length > 0 && (
                        <View style={styles.resultsSummaryBadge}>
                          <Text style={styles.resultsSummaryBadgeText}>
                            {budgetRecommendations.length}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.resultsSummaryText}>
                      {recommendations.length > 0
                        ? budgetAmount > 0
                          ? `Hay ${budgetRecommendations.length} opciones dentro de tu presupuesto y filtros actuales.`
                          : `Hay ${budgetRecommendations.length} opciones compatibles con tu búsqueda.`
                        : respuestaIA || 'Escribe una idea y aquí aparecerán los resultados.'}
                    </Text>
                    <View style={styles.resultsSummaryChips}>
                      <View style={styles.resultsSummaryChip}>
                        <Text style={styles.resultsSummaryChipText}>
                          {dietType === 'ambos'
                            ? 'Sin restricción'
                            : dietType === 'carnivoro'
                            ? 'Carnívoro'
                            : dietType === 'vegetariano'
                            ? 'Vegetariano'
                            : 'Vegano'}
                        </Text>
                      </View>
                      {budgetAmount > 0 && (
                        <View style={styles.resultsSummaryChip}>
                          <Text style={styles.resultsSummaryChipText}>Presupuesto $${budgetAmount}</Text>
                        </View>
                      )}
                      {recommendations.length > 0 && (
                        <View style={styles.resultsSummaryChip}>
                          <Text style={styles.resultsSummaryChipText}>Desliza hacia abajo</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {recommendations.length > 0 && (
                  <View style={styles.recommendationsHeader}>
                    <Ionicons name="sparkles" size={24} color={theme.primary} />
                    <Text style={styles.recommendationsTitle}>Recomendaciones para ti</Text>
                  </View>
                )}
                {budgetAmount > 0 && budgetRecommendations.length === 0 && !loading && (
                  <Text style={styles.budgetWarning}>
                    No hay recomendaciones dentro de ese presupuesto. Ajusta el monto o prueba otra
                    búsqueda.
                  </Text>
                )}
              </>
            }
            renderItem={({ item, index }: ListRenderItemInfo<MenuItem>) => {
              const isVegetarian =
                item.isVegan ||
                (item.tags &&
                  item.tags.some(
                    (tag) =>
                      tag.toLowerCase().includes('vegetariana') ||
                      tag.toLowerCase().includes('vegana')
                  ));

              return (
                <Animated.View
                  style={[styles.recommendationItem, getAnimatedItemStyle(index)]}
                >
                  <View style={styles.itemHeaderNew}>
                    <View style={styles.emojiContainer}>
                      <Text style={styles.emojiText}>{getDishEmoji(item)}</Text>
                    </View>
                    <View style={styles.itemTitleSection}>
                      <Text style={styles.itemNameNew} numberOfLines={2}>
                        {item.nombre}
                      </Text>
                      <Text style={styles.itemPrice}>${item.precio.toFixed(2)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.favoriteBtnCompact}
                      onPress={() =>
                        isFavorite(item.id) ? removeFavorite(item.id) : addFavorite(item)
                      }
                    >
                      <Ionicons
                        name={isFavorite(item.id) ? 'heart' : 'heart-outline'}
                        size={20}
                        color={isFavorite(item.id) ? theme.primary : theme.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  {item.isVegan ? (
                    <View style={[styles.badgeNew, styles.veganBadge]}>
                      <Text style={styles.badgeText}>🌱 Vegano</Text>
                    </View>
                  ) : isVegetarian ? (
                    <View style={[styles.badgeNew, styles.vegetarianBadge]}>
                      <Text style={styles.badgeText}>🥦 Vegetariano</Text>
                    </View>
                  ) : null}

                  <Text style={styles.itemDescription}>{item.descripcion}</Text>

                  <View style={styles.itemMetaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {item.restaurantName}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="timer-outline" size={14} color={theme.textSecondary} />
                      <Text style={styles.metaText}>{item.deliveryTime}</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.addButtonNew} onPress={() => addItem(item)}>
                    <Ionicons
                      name="add-circle"
                      size={18}
                      color={theme.surface}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.addButtonTextNew}>Añadir al carrito</Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            ListEmptyComponent={
              !loading && !respuestaIA ? <View style={{ paddingBottom: 20 }} /> : null
            }
          />
        </View>
      </KeyboardAvoidingView>

      {/* Botón flotante del chat IA */}
      {!gastroBotVisible && (
        <TouchableOpacity
          style={styles.botFab}
          onPress={openGastroBot}
          activeOpacity={0.9}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chatbubbles" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal del chatbot */}
      <GastroBot
        theme={theme}
        visible={gastroBotVisible}
        onClose={() => setGastroBotVisible(false)}
        onRecommendations={handleBotRecommendations}
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme, screenWidth: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    listShell: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      alignSelf: 'center',
      maxWidth: screenWidth >= 980 ? 980 : screenWidth >= 700 ? 760 : undefined,
    },
    scrollContent: { paddingBottom: 40 },
    heroCard: {
      marginHorizontal: 20,
      marginTop: 8,
      marginBottom: 8,
      padding: 12,
      borderRadius: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 10,
      elevation: 1,
    },
    heroTitle: {
      fontSize: 18,
      lineHeight: 23,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.4,
      marginBottom: 6,
    },
    backToRestaurantsButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.primary + '40',
      backgroundColor: theme.primary + '10',
    },
    backToRestaurantsText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
    },
    heroSubtitle: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.textSecondary,
      fontWeight: '500',
      marginBottom: 0,
    },
    inputSection: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: theme.background,
      marginBottom: 6,
    },
    sectionTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.5,
    },
    sectionBadge: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.primary,
      backgroundColor: theme.primary + '08',
      borderWidth: 1,
      borderColor: theme.primary + '12',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    profileHint: {
      fontSize: 11,
      color: theme.textSecondary,
      marginBottom: 10,
      fontWeight: '500',
      lineHeight: 16,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      shadowOpacity: 0,
      elevation: 0,
    },
    inputIcon: { marginRight: 8 },
    input: {
      flex: 1,
      fontSize: 12,
      color: theme.text,
      minHeight: 32,
      paddingVertical: 0,
      textAlignVertical: 'center',
      fontWeight: '500',
    },
    searchActionButton: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      marginLeft: 8,
    },
    searchActionButtonDisabled: { opacity: 0.5 },
    chatActionButton: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      marginLeft: 6,
    },
    buttonWrapper: { marginTop: 14 },
    secondaryButtonWrapper: { marginTop: 8 },
    secondaryButton: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.primary,
      shadowOpacity: 0,
      elevation: 0,
    },
    secondaryButtonText: {
      color: theme.primary,
      fontWeight: '700',
    },
    aiResponseSection: { marginTop: 16, paddingHorizontal: 20 },
    aiHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      paddingLeft: 2,
    },
    aiHeaderText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
      marginLeft: 8,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
    notificationInfo: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 8,
      fontWeight: '500',
    },
    notificationInfoAccent: {
      fontSize: 11,
      color: theme.primary,
      fontWeight: '600',
    },
    inlineInfoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    aiBubble: {
      backgroundColor: theme.primary + '12',
      padding: 16,
      borderRadius: 20,
      borderBottomLeftRadius: 6,
      borderWidth: 1.5,
      borderColor: theme.primary + '30',
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
    },
    aiText: { fontSize: 15, color: theme.text, lineHeight: 24, fontWeight: '500' },
    loadingSection: {
      alignItems: 'center',
      marginTop: 28,
      marginBottom: 28,
      paddingVertical: 20,
    },
    loadingText: { marginTop: 12, fontSize: 15, color: theme.textSecondary, fontWeight: '500' },
    resultsSummaryCard: {
      marginTop: 8,
      marginHorizontal: 20,
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.primary + '08',
      borderWidth: 1,
      borderColor: theme.primary + '18',
    },
    resultsSummaryTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    resultsSummaryTextWrap: { flex: 1 },
    resultsSummaryLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.primary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    resultsSummaryTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
    },
    resultsSummaryBadge: {
      minWidth: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
    },
    resultsSummaryBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
    },
    resultsSummaryText: {
      marginTop: 8,
      fontSize: 12,
      lineHeight: 17,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    resultsSummaryChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    resultsSummaryChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    resultsSummaryChipText: {
      fontSize: 11,
      color: theme.text,
      fontWeight: '600',
    },
    recommendationsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginTop: 14,
      marginBottom: 12,
    },
    recommendationsTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginLeft: 10,
      letterSpacing: -0.3,
    },
    recommendationItem: {
      backgroundColor: theme.surface,
      marginHorizontal: 20,
      marginBottom: 14,
      paddingTop: 14,
      paddingHorizontal: 16,
      paddingBottom: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 4,
    },
    budgetCard: {
      marginTop: 10,
      marginHorizontal: 0,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      shadowOpacity: 0,
      elevation: 0,
    },
    budgetLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 6,
    },
    budgetInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    budgetInput: {
      flex: 1,
      backgroundColor: theme.surface,
      color: theme.text,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: theme.border,
      fontWeight: '500',
      fontSize: 12,
    },
    budgetButton: { minWidth: 72 },
    budgetFeedback: {
      marginTop: 6,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '500',
      backgroundColor: theme.background,
      padding: 6,
      borderRadius: 8,
      textAlign: 'center',
    },
    quickSearchRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    quickSearchChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    quickSearchChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.text,
    },
    budgetWarning: {
      marginHorizontal: 20,
      marginBottom: 14,
      color: theme.text,
      backgroundColor: theme.primaryLight + '88',
      padding: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.primaryLight,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    itemHeaderNew: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
      gap: 12,
    },
    emojiContainer: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: theme.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.primary + '30',
    },
    emojiText: { fontSize: 28 },
    itemTitleSection: { flex: 1 },
    itemNameNew: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
      lineHeight: 20,
      letterSpacing: -0.2,
    },
    itemPrice: { fontSize: 15, fontWeight: '800', color: theme.primary, letterSpacing: -0.3 },
    favoriteBtnCompact: { padding: 8 },
    badgeNew: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: 1.5,
      marginBottom: 10,
    },
    badgeText: { fontSize: 11, fontWeight: '700' },
    veganBadge: {
      backgroundColor: theme.background,
      borderColor: theme.primary,
    },
    vegetarianBadge: {
      backgroundColor: theme.successBackground,
      borderColor: theme.success,
    },
    itemDescription: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 12,
      lineHeight: 19,
      fontWeight: '500',
    },
    itemMetaRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    metaText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '600',
      flex: 1,
    },
    addButtonNew: {
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
    addButtonTextNew: {
      color: theme.surface,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    // ── GastroBot boton flotante ────────────────────────────────────
    botFab: {
      position: 'absolute',
      right: 18,
      bottom: 26,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.24,
      shadowRadius: 12,
      elevation: 20,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
    },
  });
