// src/components/GastroBot.tsx
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuItem, Theme } from '../types';
import { ApiError, sendChatMessage } from '../services/apiService';
import { getAIRecommendations, getNearbyRecommendations } from '../services/aiService';
import { CartContext } from '../context/CartContext';

// ── Tipos locales ──────────────────────────────────────────────────────────────

interface GastroBotProps {
  theme: Theme;
  visible: boolean;                       // Controlado desde HomeScreen
  onClose: () => void;
  onRecommendations: (prefs: {
    search: string;
    dietType: string;
    allergies: string[];
    budget: number | null;
    message: string;
  }) => void;
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  recommendations?: {
    item: MenuItem;
    reason: string;
    reasonType: 'price' | 'match' | 'popular' | 'similar';
  }[];
}

const WELCOME = '¡Hola! 👋 Soy GastroBot. ¿Qué te apetece comer hoy? Cuéntame algo y te ayudo a encontrar el plato perfecto 🍽️';
const RATE_LIMIT_COOLDOWN_SECONDS = 12;
const MIN_SEND_INTERVAL_MS = 800;
const QUICK_REPLIES = [
  { label: 'Salado', text: 'algo salado y contundente' },
  { label: 'Dulce', text: 'algo dulce para antojo' },
  { label: 'Ligero', text: 'algo ligero y saludable' },
  { label: 'Rápido', text: 'algo rápido y fácil' },
  { label: 'Barato', text: 'algo barato y rico' },
];

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const tokenizeText = (value: string): string[] =>
  normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);

function buildCardReason(
  menuItem: MenuItem,
  search: string,
  cheapestPrice: number,
  wantsBudget: boolean
): { reason: string; reasonType: 'price' | 'match' | 'popular' | 'similar' } {
  const queryTokens = tokenizeText(search);
  const itemName = normalizeText(menuItem.nombre);
  const itemCategory = normalizeText(menuItem.categoria);
  const itemTags = (menuItem.tags || []).map((tag) => normalizeText(tag));

  const matchedToken = queryTokens.find(
    (token) =>
      itemName.includes(token) ||
      itemCategory.includes(token) ||
      itemTags.some((tag) => tag.includes(token))
  );

  if (wantsBudget && menuItem.precio <= cheapestPrice * 1.15) {
    return {
      reason: 'Te la sugiero por precio accesible dentro de tu idea.',
      reasonType: 'price',
    };
  }

  if (matchedToken) {
    return {
      reason: `Te la sugiero porque coincide con "${matchedToken}".`,
      reasonType: 'match',
    };
  }

  if (menuItem.popular) {
    return {
      reason: 'Te la sugiero porque es una opción popular entre clientes.',
      reasonType: 'popular',
    };
  }

  return {
    reason: 'Te la sugiero porque mantiene un estilo similar a tu antojo.',
    reasonType: 'similar',
  };
}

function buildChatRecommendationCards(
  items: MenuItem[],
  search: string
): {
  item: MenuItem;
  reason: string;
  reasonType: 'price' | 'match' | 'popular' | 'similar';
}[] {
  if (items.length === 0) return [];

  const cheapestPrice = Math.min(...items.map((item) => item.precio));
  const normalizedSearch = normalizeText(search);
  const wantsBudget = /barat|econom|promo|combo/.test(normalizedSearch);

  return items.map((item) => ({
    item,
    ...buildCardReason(item, search, cheapestPrice, wantsBudget),
  }));
}

function getReasonVisual(reasonType: 'price' | 'match' | 'popular' | 'similar') {
  switch (reasonType) {
    case 'price':
      return { icon: 'wallet-outline' as const, label: 'Precio', color: '#0F766E' };
    case 'match':
      return { icon: 'checkmark-circle-outline' as const, label: 'Coincidencia', color: '#1D4ED8' };
    case 'popular':
      return { icon: 'flame-outline' as const, label: 'Popular', color: '#B45309' };
    default:
      return { icon: 'sparkles-outline' as const, label: 'Similar', color: '#6D28D9' };
  }
}

function buildRecommendationsReply(
  items: MenuItem[],
  search: string,
  hasExactMatch: boolean
): string {
  if (items.length === 0) {
    return 'No encontré opciones claras con esa idea. Si quieres, te hago otra búsqueda con un antojo más específico.';
  }

  const intro = hasExactMatch
    ? `Te propongo estas opciones para "${search || 'tu búsqueda'}":`
    : `No tengo exactamente "${search || 'eso'}", pero creo que estas opciones te pueden gustar:`;

  return [
    intro,
    'Si no te convence, dime otro antojo y lo ajustamos aquí mismo.',
  ].join('\n');
}

// ── Componente ─────────────────────────────────────────────────────────────────

export default function GastroBot({ theme, visible, onClose, onRecommendations }: GastroBotProps) {
  const { addItem } = useContext(CartContext);
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'bot', text: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [history, setHistory] = useState<{ role: string; text: string }[]>([]);
  const listRef = useRef<FlatList>(null);
  const requestInFlightRef = useRef(false);
  const lastSendAtRef = useRef(0);
  const typingAnim = useRef(new Animated.Value(0)).current;

  // Animación del indicador de escritura
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(typingAnim, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
    } else {
      typingAnim.stopAnimation();
      typingAnim.setValue(0);
    }
  }, [loading, typingAnim]);

  // Resetear chat cuando se abre de nuevo
  useEffect(() => {
    if (visible) {
      setMessages([{ id: '0', role: 'bot', text: WELCOME }]);
      setHistory([]);
      setInput('');
      setCooldownSeconds(0);
      requestInFlightRef.current = false;
      lastSendAtRef.current = 0;
    }
  }, [visible]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const send = async (messageOverride?: string) => {
    const text = (messageOverride ?? input).trim();
    if (loading || requestInFlightRef.current || !text || cooldownSeconds > 0) return;

    const now = Date.now();
    if (now - lastSendAtRef.current < MIN_SEND_INTERVAL_MS) {
      return;
    }
    lastSendAtRef.current = now;

    requestInFlightRef.current = true;
    setLoading(true);
    setInput('');

    try {
      const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
      setMessages((prev) => [...prev, userMsg]);
      scrollToBottom();

      const newHistory = [...history, { role: 'user', text }];
      // El mensaje actual viaja en `message`; en `history` enviamos solo el contexto previo.
      const result = await sendChatMessage(history, text);

      const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'bot', text: result.reply };
      setMessages((prev) => [...prev, botMsg]);
      setHistory([...newHistory, { role: 'model', text: result.reply }]);

      if (result.resolved && result.preferences) {
        onRecommendations(result.preferences);

        const exact = await getAIRecommendations({
          search: result.preferences.search,
          dietType: result.preferences.dietType,
          allergies: result.preferences.allergies,
        });
        const chatResults =
          exact.length > 0
            ? exact
            : await getNearbyRecommendations(
                {
                  search: result.preferences.search,
                  dietType: result.preferences.dietType,
                  allergies: result.preferences.allergies,
                },
                3
              );

        const normalizedSearch = (result.preferences.search || '').toLowerCase();
        const hasExactMatch = exact.some((item) => {
          const corpus = [item.nombre, item.categoria, item.descripcion, item.restaurantName, ...(item.tags || [])]
            .join(' ')
            .toLowerCase();
          return normalizedSearch.length > 0 && corpus.includes(normalizedSearch);
        });

        const resolvedMsg: Message = {
          id: (Date.now() + 2).toString(),
          role: 'bot',
          text: buildRecommendationsReply(chatResults, result.preferences.search, hasExactMatch),
          recommendations: buildChatRecommendationCards(
            chatResults.slice(0, 3),
            result.preferences.search
          ),
        };
        setMessages((prev) => [...prev, resolvedMsg]);
      }
    } catch (error) {
      let friendlyMessage = `Lo siento, tuve un problema: ${error instanceof Error ? error.message : 'error desconocido'} 😅`;
      if (error instanceof ApiError && error.status === 429) {
        console.warn('⚠️ /ai/chat rate limit o protección anti-ráfaga:', error.message);
        setCooldownSeconds(RATE_LIMIT_COOLDOWN_SECONDS);
        Keyboard.dismiss();
        friendlyMessage = `¡Vas muy rápido! Espera ${RATE_LIMIT_COOLDOWN_SECONDS}s antes de enviar otro mensaje.`;
      } else {
        console.error('❌ Error en /ai/chat:', error);
      }

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'bot', text: friendlyMessage },
      ]);
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
      scrollToBottom();
    }
  };

  const styles = getStyles(theme);
  const inputText = input;

  const handleSubmitEditing = () => {
    if (!loading && !requestInFlightRef.current && inputText.trim() && cooldownSeconds === 0) {
      void send();
    }
  };

  const handleQuickReply = (text: string) => {
    if (loading || requestInFlightRef.current || cooldownSeconds > 0) return;
    setInput(text);
    void send(text);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isBot = item.role === 'bot';

    const handleAddToCart = (menuItem: MenuItem) => {
      addItem(menuItem);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + Math.random()).toString(),
          role: 'bot',
          text: `Añadí "${menuItem.nombre}" al carrito. Si quieres, te muestro más opciones parecidas.`,
        },
      ]);
      scrollToBottom();
    };

    return (
      <View style={[styles.bubble, isBot ? styles.bubbleBot : styles.bubbleUser]}>
        {isBot && (
          <View style={styles.botAvatar}>
            <Text style={styles.botAvatarText}>G</Text>
          </View>
        )}
        <View style={[styles.bubbleContent, isBot ? styles.bubbleContentBot : styles.bubbleContentUser]}>
          <Text style={[styles.bubbleText, isBot ? styles.bubbleTextBot : styles.bubbleTextUser]}>
            {item.text}
          </Text>

          {isBot && item.recommendations && item.recommendations.length > 0 && (
            <View style={styles.recommendationsWrap}>
              {item.recommendations.map((rec) => (
                <View key={`${item.id}-${rec.item.id}`} style={styles.recommendationCard}>
                  <View style={styles.recommendationTopRow}>
                    <Text style={styles.recommendationName} numberOfLines={1}>
                      {rec.item.nombre}
                    </Text>
                    <Text style={styles.recommendationPrice}>${rec.item.precio.toFixed(0)}</Text>
                  </View>
                  <Text style={styles.recommendationRestaurant} numberOfLines={1}>
                    {rec.item.restaurantName}
                  </Text>
                  <View style={styles.recommendationReasonRow}>
                    <View
                      style={[
                        styles.reasonBadge,
                        { borderColor: getReasonVisual(rec.reasonType).color + '66', backgroundColor: getReasonVisual(rec.reasonType).color + '14' },
                      ]}
                    >
                      <Ionicons
                        name={getReasonVisual(rec.reasonType).icon}
                        size={12}
                        color={getReasonVisual(rec.reasonType).color}
                      />
                      <Text style={[styles.reasonBadgeText, { color: getReasonVisual(rec.reasonType).color }]}>
                        {getReasonVisual(rec.reasonType).label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.recommendationReason}>{rec.reason}</Text>
                  <TouchableOpacity
                    style={styles.recommendationButton}
                    onPress={() => handleAddToCart(rec.item)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.recommendationButtonText}>Añadir al carrito</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerAvatar}>
                <Text style={styles.headerAvatarText}>G</Text>
              </View>
              <View>
                <Text style={styles.headerTitle}>GastroBot</Text>
                <Text style={styles.headerSubtitle}>Tu asistente de comida 🍴</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Mensajes */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={scrollToBottom}
          />

          <View style={styles.quickRepliesWrap}>
            <FlatList
              data={QUICK_REPLIES}
              keyExtractor={(item) => item.label}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickReplies}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.quickReplyChip, (loading || cooldownSeconds > 0) && styles.quickReplyChipDisabled]}
                  onPress={() => handleQuickReply(item.text)}
                  disabled={loading || cooldownSeconds > 0}
                >
                  <Text style={styles.quickReplyText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Indicador de escritura */}
          {loading && (
            <View style={styles.typingRow}>
              <View style={styles.botAvatar}>
                <Text style={styles.botAvatarText}>G</Text>
              </View>
              <Animated.View style={[styles.typingBubble, { opacity: typingAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]}>
                <Text style={[styles.bubbleTextBot, { letterSpacing: 3 }]}>●●●</Text>
              </Animated.View>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={cooldownSeconds > 0 ? `Espera ${cooldownSeconds}s para volver a enviar...` : 'Escribe aquí...'}
              placeholderTextColor={theme.textSecondary}
              onSubmitEditing={handleSubmitEditing}
              returnKeyType="send"
              blurOnSubmit={true}
              editable={!loading && cooldownSeconds === 0}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || loading || cooldownSeconds > 0) && styles.sendBtnDisabled]}
              onPress={() => {
                void send();
              }}
              disabled={loading || !input.trim() || cooldownSeconds > 0}
            >
              <Ionicons name={cooldownSeconds > 0 ? 'time-outline' : 'send'} size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '82%',
      minHeight: '55%',
      paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    headerTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
    headerSubtitle: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
    closeBtn: { padding: 6 },
    messageList: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 10 },
    quickRepliesWrap: { paddingHorizontal: 14, paddingBottom: 6 },
    quickReplies: { gap: 8, paddingVertical: 2 },
    quickReplyChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 8,
    },
    quickReplyChipDisabled: { opacity: 0.45 },
    quickReplyText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.text,
    },
    bubble: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    bubbleBot: { justifyContent: 'flex-start' },
    bubbleUser: { justifyContent: 'flex-end', flexDirection: 'row-reverse' },
    botAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    botAvatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    bubbleContent: {
      maxWidth: '75%',
      borderRadius: 16,
      paddingHorizontal: 13,
      paddingVertical: 9,
    },
    bubbleContentBot: {
      backgroundColor: theme.surface,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    bubbleContentUser: {
      backgroundColor: theme.primary,
      borderBottomRightRadius: 4,
    },
    bubbleText: { fontSize: 14, lineHeight: 20 },
    bubbleTextBot: { color: theme.text },
    bubbleTextUser: { color: '#fff' },
    recommendationsWrap: {
      marginTop: 10,
      gap: 8,
    },
    recommendationCard: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 10,
    },
    recommendationTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    recommendationName: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    recommendationPrice: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: '800',
    },
    recommendationRestaurant: {
      marginTop: 4,
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },
    recommendationReason: {
      marginTop: 6,
      color: theme.textSecondary,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '500',
    },
    recommendationReasonRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    reasonBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderRadius: 999,
      paddingVertical: 3,
      paddingHorizontal: 8,
    },
    reasonBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    recommendationButton: {
      marginTop: 10,
      height: 34,
      borderRadius: 10,
      backgroundColor: theme.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    recommendationButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    typingRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 14,
      marginBottom: 6,
    },
    typingBubble: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    input: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      fontSize: 14,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.45 },
  });
