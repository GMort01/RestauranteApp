// src/screens/AboutScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettings } from '../context/SettingsContext';
import { RootStackParamList, Theme } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'About'>;

export default function AboutScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 980 ? 26 : width >= 700 ? 20 : 14;
  const contentMaxWidth = width >= 980 ? 980 : width >= 700 ? 760 : undefined;
  const { theme } = useSettings();
  const styles = getStyles(theme, horizontalPadding, contentMaxWidth);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={theme.primary} />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="sparkles-outline" size={24} color={theme.primary} />
          </View>
          <Text style={styles.title}>Sobre GastroIA</Text>
          <Text style={styles.subtitle}>Comer bien, decidir fácil, pedir con confianza.</Text>
          <Text style={styles.paragraph}>
            GastroIA es una app pensada para ayudarte a elegir qué comer según tu antojo,
            presupuesto y preferencias, sin perder tiempo entre opciones confusas.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Nuestra misión</Text>
          <Text style={styles.paragraph}>
            Convertir la decisión de comida en una experiencia intuitiva: rápida para el día a día,
            personalizada para cada perfil y conectada a datos reales del menú.
          </Text>
          <View style={styles.tagRow}>
            <View style={styles.tagChip}>
              <Text style={styles.tagText}>Personalización</Text>
            </View>
            <View style={styles.tagChip}>
              <Text style={styles.tagText}>Presupuesto</Text>
            </View>
            <View style={styles.tagChip}>
              <Text style={styles.tagText}>Recomendaciones</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>¿Qué hace diferente a GastroIA?</Text>

          <View style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.primary} />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureTitle}>Búsqueda guiada</Text>
              <Text style={styles.featureDescription}>
                Te ayudamos a descubrir platos según contexto real, no solo por palabras clave.
              </Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Ionicons name="wallet-outline" size={16} color={theme.primary} />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureTitle}>Control de gasto</Text>
              <Text style={styles.featureDescription}>
                Filtras por presupuesto y ves opciones alcanzables de manera clara.
              </Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Ionicons name="cart-outline" size={16} color={theme.primary} />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureTitle}>Flujo completo</Text>
              <Text style={styles.featureDescription}>
                Desde recomendación hasta carrito, pago demo e historial en una sola experiencia.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Proyecto académico en evolución</Text>
          <Text style={styles.footerText}>
            Este producto nace como entregable del Reto Expo MVP para la asignatura de Desarrollo
            de Aplicaciones Móviles en UNICATÓLICA y sigue mejorando con foco en usabilidad real.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme, horizontalPadding: number, contentMaxWidth?: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      paddingTop: 14,
      paddingHorizontal: horizontalPadding,
      paddingBottom: 10,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backText: {
      color: theme.primary,
      marginLeft: 8,
      fontSize: 15,
      fontWeight: '700',
    },
    scrollContent: {
      paddingHorizontal: horizontalPadding,
      paddingTop: 14,
      paddingBottom: 26,
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      width: '100%',
      gap: 12,
    },
    heroCard: {
      padding: 18,
      backgroundColor: theme.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 3,
    },
    heroIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: theme.primaryLight,
      borderWidth: 1,
      borderColor: theme.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 6,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '700',
      marginBottom: 12,
    },
    paragraph: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 21,
      fontWeight: '500',
    },
    sectionCard: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 10,
      letterSpacing: -0.2,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    tagChip: {
      borderRadius: 999,
      backgroundColor: theme.primaryLight + '88',
      borderWidth: 1,
      borderColor: theme.primaryLight,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    tagText: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 0.2,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 10,
      gap: 10,
    },
    featureIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: theme.primaryLight,
      borderWidth: 1,
      borderColor: theme.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    featureTextWrap: {
      flex: 1,
    },
    featureTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 2,
    },
    featureDescription: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '500',
    },
    footerCard: {
      backgroundColor: theme.primary + '12',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.primary + '2F',
      padding: 15,
    },
    footerTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 6,
    },
    footerText: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '500',
    },
  });
