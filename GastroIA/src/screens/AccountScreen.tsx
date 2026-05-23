// src/screens/AccountScreen.tsx
import React, { useContext, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import HeaderComponent from '../components/HeaderComponent';
import ProSideMenu from '../components/ProSideMenu';
import { ProfileContext } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { RootStackParamList, Theme } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

interface DietOption {
  key: string;
  label: string;
}

const dietOptions: DietOption[] = [
  { key: 'carnivoro', label: 'Carnivoro' },
  { key: 'vegetariano', label: 'Vegetariano' },
  { key: 'vegano', label: 'Vegano' },
  { key: 'ambos', label: 'Ambos' },
];

export default function AccountScreen({ navigation }: Props) {
  // Ajuste responsive para mantener jerarquia visual en movil/tablet/web.
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
  const isLargeScreen = width >= 980;
  const horizontalPadding = isLargeScreen ? 26 : isTablet ? 20 : 14;
  const contentMaxWidth = isLargeScreen ? 980 : isTablet ? 760 : undefined;
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);
  const { dietType, setDietType, allergyInput, setAllergyInput, allergies } = useContext(ProfileContext);
  const { currentUser, isAuthenticated, login, register, resetPassword, logout } = useAuth();
  const { theme } = useSettings();
  const styles = getStyles(theme, horizontalPadding, contentMaxWidth);

  const handleAuthSubmit = async () => {
    if (authSubmitting) return;

    try {
      setAuthSubmitting(true);

      if (isRegisterMode) {
        // Registro y login dejan sesion activa automaticamente.
        await register({
          name: nameInput,
          email: emailInput,
          password: passwordInput,
        });
        Alert.alert('Registro exitoso', 'Tu cuenta fue creada y ya iniciaste sesión.');
      } else {
        await login({ email: emailInput, password: passwordInput });
        Alert.alert('Sesión iniciada', 'Ahora puedes finalizar pedidos.');
      }

      setNameInput('');
      setEmailInput('');
      setPasswordInput('');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo completar la autenticación.';
      Alert.alert('Autenticación', message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    Alert.alert('Sesión cerrada', 'Puedes seguir explorando la app sin restricciones.');
  };

  const handleResetPassword = async () => {
    if (authSubmitting) return;

    try {
      setAuthSubmitting(true);
      await resetPassword({
        email: emailInput,
        newPassword: passwordInput,
      });
      Alert.alert(
        'Contraseña actualizada',
        'Tu contraseña fue restablecida. Ya puedes iniciar sesión con la nueva clave.'
      );
      setIsRegisterMode(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo recuperar la contraseña.';
      Alert.alert('Recuperar contraseña', message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProSideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, minHeight: 0 }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerShell}>
            <HeaderComponent onOpenMenu={() => setMenuVisible(true)} />
          </View>

          <View style={styles.stack}>
            <View style={styles.profileHeader}>
              <MaterialCommunityIcons name="account-circle" size={76} color={theme.primary} />
              <Text style={styles.title}>Mi Perfil</Text>
              <Text style={styles.subtitle}>
                Define tu alimentacion y alergias para filtrar las recomendaciones.
              </Text>
            </View>

            <View style={styles.authCard}>
              <View style={styles.authHero}>
                <View style={styles.authAvatar}>
                  <MaterialCommunityIcons name="shield-account" size={26} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Acceso de usuario</Text>
                  <Text style={styles.helpText}>
                    Explora libremente. Solo necesitas sesión para confirmar y pagar pedidos.
                  </Text>
                </View>
              </View>

              {isAuthenticated && currentUser ? (
                // Vista reducida para usuario autenticado.
                <View style={styles.sessionCard}>
                  <View style={styles.sessionCardTop}>
                    <View>
                      <Text style={styles.currentLabel}>Sesión activa</Text>
                      <Text style={styles.currentValue}>{currentUser.name}</Text>
                      <Text style={styles.currentEmail}>{currentUser.email}</Text>
                    </View>
                    <View style={styles.sessionStatusPill}>
                      <Text style={styles.sessionStatusText}>Activa</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // Formulario completo cuando no hay sesion activa.
                <>
                  <View style={styles.modeSwitchRow}>
                    <TouchableOpacity
                      style={[styles.modeSwitchButton, !isRegisterMode && styles.modeSwitchButtonActive]}
                      onPress={() => setIsRegisterMode(false)}
                    >
                      <Text
                        style={[
                          styles.modeSwitchText,
                          !isRegisterMode && styles.modeSwitchTextActive,
                        ]}
                      >
                        Iniciar sesión
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modeSwitchButton, isRegisterMode && styles.modeSwitchButtonActive]}
                      onPress={() => setIsRegisterMode(true)}
                    >
                      <Text
                        style={[
                          styles.modeSwitchText,
                          isRegisterMode && styles.modeSwitchTextActive,
                        ]}
                      >
                        Crear cuenta
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.formStack}>
                    {isRegisterMode ? (
                      <TextInput
                        value={nameInput}
                        onChangeText={setNameInput}
                        placeholder="Nombre"
                        placeholderTextColor={theme.textSecondary}
                        style={styles.authInput}
                      />
                    ) : null}

                    <TextInput
                      value={emailInput}
                      onChangeText={setEmailInput}
                      placeholder="Correo"
                      placeholderTextColor={theme.textSecondary}
                      style={styles.authInput}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />

                    <TextInput
                      value={passwordInput}
                      onChangeText={setPasswordInput}
                      placeholder={isRegisterMode ? 'Contraseña (mínimo 6)' : 'Contraseña'}
                      placeholderTextColor={theme.textSecondary}
                      style={styles.authInput}
                      secureTextEntry
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.authButton}
                    onPress={handleAuthSubmit}
                    disabled={authSubmitting}
                  >
                    <Text style={styles.authButtonText}>
                      {authSubmitting
                        ? 'Procesando...'
                        : isRegisterMode
                        ? 'Crear cuenta'
                        : 'Iniciar sesión'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.authFooterNote}>
                    {isRegisterMode
                      ? 'Tu cuenta quedará guardada en MySQL para futuros pedidos.'
                      : 'Tu sesión se guarda en el dispositivo hasta que cierres sesión.'}
                  </Text>

                  {!isRegisterMode ? (
                    <TouchableOpacity
                      style={styles.recoveryButton}
                      onPress={handleResetPassword}
                      disabled={authSubmitting}
                    >
                      <Text style={styles.recoveryButtonText}>Recuperar contraseña (demo)</Text>
                      <Text style={styles.recoveryHelpText}>
                        Ingresa tu correo y una nueva contraseña para actualizarla.
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.card}>
              {/* Preferencias de perfil que impactan el motor de recomendaciones */}
              <Text style={styles.sectionTitle}>Tipo de alimentacion</Text>
              <View style={styles.optionRow}>
                {dietOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.optionButton, dietType === option.key && styles.optionButtonActive]}
                    onPress={() => setDietType(option.key)}
                  >
                    <Text
                      style={[styles.optionText, dietType === option.key && styles.optionTextActive]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.allergiesSection}>
                <Text style={styles.sectionTitle}>Alergias o intolerancias</Text>
                <Text style={styles.helpText}>
                  Escribe tus alergias separadas por comas, por ejemplo: gluten, lacteos, mariscos.
                </Text>
                <TextInput
                  value={allergyInput}
                  onChangeText={setAllergyInput}
                  placeholder="Gluten, lacteos, mani..."
                  placeholderTextColor={theme.textSecondary}
                  style={styles.textInput}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.currentProfile}>
                <Text style={styles.currentLabel}>Estado actual:</Text>
                <Text style={styles.currentValue}>
                  {dietOptions.find((option) => option.key === dietType)?.label || 'Carnivoro'}
                  {allergies.length > 0
                    ? ` • Alergias: ${allergies.join(', ')}`
                    : ' • Sin alergias registradas'}
                </Text>
              </View>

              <Text style={styles.notice}>
                Las recomendaciones en la pantalla principal se ajustaran a tus preferencias y ocultaran
                opciones no compatibles.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme, horizontalPadding: number, contentMaxWidth?: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 28, backgroundColor: theme.background },
    headerShell: { paddingHorizontal: horizontalPadding },
    stack: {
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: horizontalPadding,
      paddingTop: 8,
    },
    profileHeader: { paddingTop: 14, marginBottom: 6 },
    title: { fontSize: 28, fontWeight: '800', color: theme.text, marginTop: 15 },
    subtitle: { fontSize: 15, color: theme.textSecondary, marginTop: 8, lineHeight: 21 },
    card: {
      marginTop: 16,
      marginBottom: 18,
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 18,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 4,
    },
    authCard: {
      marginTop: 10,
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 4,
    },
    authHero: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 16,
    },
    authAvatar: {
      width: 54,
      height: 54,
      borderRadius: 18,
      backgroundColor: theme.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.primary + '35',
    },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 12 },
    sessionCard: {
      padding: 16,
      borderRadius: 20,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sessionCardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    currentEmail: {
      marginTop: 4,
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    sessionStatusPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: theme.successBackground,
      borderWidth: 1,
      borderColor: theme.success + '30',
    },
    sessionStatusText: {
      color: theme.success,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    modeSwitchRow: {
      flexDirection: 'row',
      backgroundColor: theme.background,
      borderRadius: 16,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 14,
    },
    modeSwitchButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 11,
      borderRadius: 12,
    },
    modeSwitchButtonActive: {
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    modeSwitchText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    modeSwitchTextActive: {
      color: theme.text,
    },
    formStack: {
      gap: 12,
    },
    authInput: {
      backgroundColor: theme.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      height: 48,
      color: theme.text,
      fontSize: 15,
    },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap' },
    optionButton: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 10,
      marginBottom: 10,
    },
    optionButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    optionText: { fontSize: 14, color: theme.text, fontWeight: '600' },
    optionTextActive: { color: theme.surface },
    allergiesSection: { marginTop: 10 },
    helpText: { fontSize: 14, color: theme.textSecondary, marginBottom: 10, lineHeight: 20 },
    textInput: {
      backgroundColor: theme.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      color: theme.text,
      fontSize: 15,
      minHeight: 82,
      textAlignVertical: 'top',
    },
    currentProfile: { marginTop: 20 },
    currentLabel: { fontSize: 14, color: theme.textSecondary, marginBottom: 6 },
    currentValue: { fontSize: 16, color: theme.text, fontWeight: '600' },
    notice: { marginTop: 20, fontSize: 14, color: theme.textSecondary, lineHeight: 22 },
    authButton: {
      marginTop: 2,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
    },
    authButtonText: {
      color: theme.surface,
      fontSize: 15,
      fontWeight: '700',
    },
    authFooterNote: {
      marginTop: 10,
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    logoutButton: {
      marginTop: 14,
      borderWidth: 1,
      borderColor: theme.error,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    logoutButtonText: {
      color: theme.error,
      fontSize: 14,
      fontWeight: '700',
    },
    recoveryButton: {
      marginTop: 10,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    recoveryButtonText: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 4,
    },
    recoveryHelpText: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
  });
