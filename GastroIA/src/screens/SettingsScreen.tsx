// src/screens/SettingsScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import HeaderComponent from '../components/HeaderComponent';
import ProSideMenu from '../components/ProSideMenu';
import { useSettings } from '../context/SettingsContext';
import { RootStackParamList, Theme } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const [menuVisible, setMenuVisible] = React.useState<boolean>(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
  const isLargeScreen = width >= 980;
  const horizontalPadding = isLargeScreen ? 26 : isTablet ? 20 : 14;
  const contentMaxWidth = isLargeScreen ? 980 : isTablet ? 760 : undefined;
  const { darkMode, notificationsEnabled, setDarkMode, setNotificationsEnabled, theme } = useSettings();
  const styles = getStyles(theme, horizontalPadding, contentMaxWidth);

  return (
    <SafeAreaView style={styles.container}>
      <ProSideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />

      <View style={styles.headerShell}>
        <HeaderComponent onOpenMenu={() => setMenuVisible(true)} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        <View style={styles.stack}>
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="options-outline" size={22} color={theme.primary} />
            </View>
            <Text style={styles.title}>Configuración</Text>
            <Text style={styles.subtitle}>
              Personaliza la experiencia de GastroIA para que se adapte a tu ritmo y estilo.
            </Text>
          </View>

          <View style={styles.settingSection}>
            <Text style={styles.sectionTitle}>Preferencias de la app</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingIconText}>
                <Ionicons name="notifications-outline" size={22} color={theme.primary} />
                <View style={styles.settingTextBlock}>
                  <Text style={styles.settingText}>Notificaciones</Text>
                  <Text style={styles.settingHint}>Recibe avisos de novedades y recomendaciones.</Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: theme.border, true: theme.primaryLight }}
                thumbColor={notificationsEnabled ? theme.primary : theme.surface}
              />
            </View>
            <Text style={styles.statusText}>
              {notificationsEnabled ? 'Activadas' : 'Desactivadas'}
            </Text>

            <View style={styles.separator} />

            <View style={styles.settingRow}>
              <View style={styles.settingIconText}>
                <Ionicons name="moon-outline" size={22} color={theme.primary} />
                <View style={styles.settingTextBlock}>
                  <Text style={styles.settingText}>Modo oscuro</Text>
                  <Text style={styles.settingHint}>
                    Cambia el esquema visual para entornos con poca luz.
                  </Text>
                </View>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: theme.border, true: theme.primaryLight }}
                thumbColor={darkMode ? theme.primary : theme.surface}
              />
            </View>
            <Text style={styles.statusText}>{darkMode ? 'Activado' : 'Desactivado'}</Text>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
            <Text style={styles.infoText}>
              Tus ajustes se guardan automáticamente y se aplican en toda la aplicación.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme, horizontalPadding: number, contentMaxWidth?: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    headerShell: { paddingHorizontal: horizontalPadding },
    content: {
      paddingHorizontal: horizontalPadding,
      paddingBottom: 28,
      paddingTop: 8,
      backgroundColor: theme.background,
    },
    stack: {
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      gap: 12,
    },
    heroCard: {
      backgroundColor: theme.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 3,
    },
    heroIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: theme.primaryLight,
      borderWidth: 1,
      borderColor: theme.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 6,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 21,
      fontWeight: '500',
    },
    settingSection: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: 4,
    },
    settingIconText: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 },
    settingTextBlock: { flex: 1, marginLeft: 12 },
    settingText: {
      fontSize: 15,
      color: theme.text,
      fontWeight: '700',
      flexShrink: 1,
    },
    settingHint: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 2,
      fontWeight: '500',
    },
    separator: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginVertical: 10,
    },
    statusText: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 6,
      marginLeft: 34,
      fontWeight: '600',
    },
    infoCard: {
      backgroundColor: theme.primary + '12',
      borderWidth: 1,
      borderColor: theme.primary + '2B',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    infoText: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '500',
      flex: 1,
    },
  });
