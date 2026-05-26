// src/screens/AccountScreen.tsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
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
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import HeaderComponent from '../components/HeaderComponent';
import ProSideMenu from '../components/ProSideMenu';
import { ProfileContext } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { useHistory } from '../context/HistoryContext';
import { useSettings } from '../context/SettingsContext';
import { getHistoryVisualSystem } from '../theme/historyVisual';
import { Purchase, RootStackParamList, Theme } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

interface DietOption {
  key: string;
  label: string;
  description: string;
}

type SpendingPeriod = 'week' | 'month';

interface SpendingBucket {
  id: string;
  label: string;
  amount: number;
  count: number;
  startTime: number;
  color: string;
}

const dietOptions: DietOption[] = [
  { key: 'carnivoro', label: 'Carnívoro', description: 'Recomendaciones centradas en carnes y preparaciones tradicionales.' },
  { key: 'vegetariano', label: 'Vegetariano', description: 'Prioriza platos sin carne y con mayor presencia de vegetales.' },
  { key: 'vegano', label: 'Vegano', description: 'Oculta ingredientes de origen animal en las sugerencias.' },
  { key: 'ambos', label: 'Flexible', description: 'Mantiene abiertas todas las sugerencias compatibles.' },
];

const parseStoredTimestamp = (purchase: Purchase) => {
  if (typeof purchase.timestamp === 'number' && Number.isFinite(purchase.timestamp)) {
    return purchase.timestamp;
  }

  const directParse = Date.parse(purchase.date);
  if (!Number.isNaN(directParse)) {
    return directParse;
  }

  const dateMatch = purchase.date.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (dateMatch) {
    const first = Number(dateMatch[1]);
    const second = Number(dateMatch[2]);
    const year = Number(dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]);

    if (first > 12 && second <= 12) {
      return new Date(year, second - 1, first).getTime();
    }

    return new Date(year, first - 1, second).getTime();
  }

  return Date.now();
};

const formatCompactDate = (timestamp: number) => {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(timestamp));
};

const formatPeriodLabel = (startTime: number, period: SpendingPeriod) => {
  const date = new Date(startTime);

  if (period === 'month') {
    return new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' }).format(date);
  }

  const endDate = new Date(startTime);
  endDate.setDate(endDate.getDate() + 6);

  return `${formatCompactDate(startTime)} - ${formatCompactDate(endDate.getTime())}`;
};

export default function AccountScreen({ navigation }: Props) {
  // Ajuste responsive para mantener jerarquia visual en movil/tablet/web.
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
  const isLargeScreen = width >= 980;
  const isCompactScreen = width < 430;
  const horizontalPadding = isLargeScreen ? 26 : isTablet ? 20 : 14;
  const contentMaxWidth = isLargeScreen ? 980 : isTablet ? 760 : undefined;
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);
  const [profileNameInput, setProfileNameInput] = useState<string>('');
  const [profileEmailInput, setProfileEmailInput] = useState<string>('');
  const [profilePhoneInput, setProfilePhoneInput] = useState<string>('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [newPasswordConfirmInput, setNewPasswordConfirmInput] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [savingPassword, setSavingPassword] = useState<boolean>(false);
  const [profileModalVisible, setProfileModalVisible] = useState<boolean>(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState<boolean>(false);
  // Conecta el estado local del perfil con los contextos globales usados por la pantalla.
  const { profile, updateProfile, resetProfile, dietType, setDietType, allergyInput, setAllergyInput, allergies } = useContext(ProfileContext);
  const { currentUser, isAuthenticated, login, register, resetPassword, updateCurrentUser, logout } = useAuth();
  const { purchaseHistory, clearHistory } = useHistory();
  const { theme, darkMode, notificationsEnabled, setDarkMode, setNotificationsEnabled, language, setLanguage } = useSettings();
  const styles = getStyles(theme, horizontalPadding, contentMaxWidth, isCompactScreen);
  const visualSystem = getHistoryVisualSystem(theme);

  // Limita el mini-historial visual a las 2 compras más recientes sin tocar el historial global.
  const recentPurchases = useMemo(() => {
    return [...purchaseHistory]
      .sort((left, right) => parseStoredTimestamp(right) - parseStoredTimestamp(left))
      .slice(0, 2);
  }, [purchaseHistory]);

  // Controla el nivel de agregación de la gráfica entre semana y mes.
  const [spendingPeriod, setSpendingPeriod] = useState<SpendingPeriod>('week');

  // Agrupa las compras por periodo y recalcula las barras cuando cambia el historial o el filtro temporal.
  const spendingBuckets = useMemo(() => {
    const buckets = new Map<string, SpendingBucket>();

    purchaseHistory.forEach((purchase) => {
      const timestamp = parseStoredTimestamp(purchase);
      const date = new Date(timestamp);
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);

      if (spendingPeriod === 'week') {
        const dayOffset = (startDate.getDay() + 6) % 7;
        startDate.setDate(startDate.getDate() - dayOffset);
      } else {
        startDate.setDate(1);
      }

      const startTime = startDate.getTime();
      const bucketKey = spendingPeriod === 'week'
        ? `week-${startDate.getFullYear()}-${startDate.getMonth()}-${startDate.getDate()}`
        : `month-${startDate.getFullYear()}-${startDate.getMonth()}`;

      const existing = buckets.get(bucketKey);
      if (existing) {
        existing.amount += purchase.total;
        existing.count += 1;
        return;
      }

      buckets.set(bucketKey, {
        id: bucketKey,
        label: formatPeriodLabel(startTime, spendingPeriod),
        amount: purchase.total,
        count: 1,
        startTime,
        color: theme.primary,
      });
    });

    return Array.from(buckets.values())
      .sort((left, right) => left.startTime - right.startTime)
      .slice(-6)
      .map((bucket) => {
        const ratio = bucket.amount / Math.max(...Array.from(buckets.values()).map((item) => item.amount), 1);
        let color = theme.primary;
        if (ratio < 0.35) color = theme.success;
        else if (ratio >= 0.7) color = theme.error;

        return { ...bucket, color };
      });
  }, [purchaseHistory, spendingPeriod, theme.error, theme.primary, theme.success]);

  // Obtiene el valor máximo para escalar visualmente la altura de las barras.
  const maxSpendingValue = useMemo(() => {
    if (spendingBuckets.length === 0) return 0;
    return Math.max(...spendingBuckets.map((item) => item.amount));
  }, [spendingBuckets]);

  // Calcula el gasto promedio por periodo para la leyenda y la guía horizontal de referencia.
  const averageSpendingPerPeriod = useMemo(() => {
    if (spendingBuckets.length === 0) return 0;
    return Math.round(
      spendingBuckets.reduce((sum, bucket) => sum + bucket.amount, 0) / spendingBuckets.length
    );
  }, [spendingBuckets]);

  // Convierte el promedio en un porcentaje para ubicar la línea guía dentro de la gráfica.
  const averageLinePercent = useMemo(() => {
    if (maxSpendingValue === 0 || averageSpendingPerPeriod === 0) return 0;
    return Math.min(Math.max((averageSpendingPerPeriod / maxSpendingValue) * 100, 0), 100);
  }, [averageSpendingPerPeriod, maxSpendingValue]);

  const selectedDiet = useMemo(
    () => dietOptions.find((option) => option.key === dietType) || dietOptions[0],
    [dietType]
  );

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const isValidPhone = (phone: string) => /^[+]?([0-9\s-()]){7,}$/.test(phone.trim());

  // Sincroniza los inputs del perfil y la contraseña con la sesión actual al abrir o cambiar de usuario.
  useEffect(() => {
    if (!isAuthenticated) {
      setProfileNameInput('');
      setProfileEmailInput('');
      setProfilePhoneInput('');
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setNewPasswordConfirmInput('');
      return;
    }

    setProfileNameInput(profile.name || currentUser?.name || '');
    setProfileEmailInput(profile.email || currentUser?.email || '');
    setProfilePhoneInput(profile.phone || '');
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setNewPasswordConfirmInput('');
  }, [currentUser?.email, currentUser?.name, isAuthenticated, profile.email, profile.name, profile.phone]);

  // Si el perfil local aún no está hidratado, toma nombre y correo desde la sesión autenticada.
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    if (!profile.name && !profile.email) {
      updateProfile({ name: currentUser.name, email: currentUser.email });
    }
  }, [currentUser, isAuthenticated, profile.email, profile.name, updateProfile]);

  const userInitials = (profileNameInput || currentUser?.name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

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

  const closeProfileModal = () => {
    setProfileNameInput(profile.name || currentUser?.name || '');
    setProfileEmailInput(profile.email || currentUser?.email || '');
    setProfilePhoneInput(profile.phone || '');
    setProfileModalVisible(false);
  };

  const closePasswordModal = () => {
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setNewPasswordConfirmInput('');
    setPasswordModalVisible(false);
  };

  // Guarda solo cambios reales del perfil; si no hubo modificaciones, reutiliza el botón como cierre del modal.
  const handleSaveProfile = async () => {
    if (savingProfile) return;

    const safeName = profileNameInput.trim();
    const safeEmail = profileEmailInput.trim().toLowerCase();
    const safePhone = profilePhoneInput.trim();
    const originalName = (profile.name || currentUser?.name || '').trim();
    const originalEmail = (profile.email || currentUser?.email || '').trim().toLowerCase();
    const originalPhone = (profile.phone || '').trim();
    const hasProfileChanges =
      safeName !== originalName ||
      safeEmail !== originalEmail ||
      safePhone !== originalPhone;

    if (!hasProfileChanges) {
      closeProfileModal();
      return;
    }

    if (!safeName || !safeEmail) {
      Alert.alert('Perfil', 'El nombre y el correo son obligatorios.');
      return;
    }

    if (!isValidEmail(safeEmail)) {
      Alert.alert('Perfil', 'Ingresa un correo válido.');
      return;
    }

    if (safePhone && !isValidPhone(safePhone)) {
      Alert.alert('Perfil', 'Ingresa un teléfono válido.');
      return;
    }

    setSavingProfile(true);
    try {
      updateProfile({
        name: safeName,
        email: safeEmail,
        phone: safePhone,
      });

      await updateCurrentUser({
        name: safeName,
        email: safeEmail,
      });

      closeProfileModal();

      Alert.alert(
        'Perfil guardado',
        'Los cambios quedaron guardados en este dispositivo y se verán en la sesión actual.'
      );
    } catch (error) {
      Alert.alert('Perfil', 'No se pudo guardar el perfil.');
      console.error(error);
    } finally {
      setSavingProfile(false);
    }
  };

  // Valida el cambio de contraseña y también permite cerrar el modal si no se ingresó ningún dato.
  const handleChangePassword = async () => {
    if (savingPassword) return;

    const safeEmail = (currentUser?.email || profileEmailInput).trim();
    const safeCurrentPassword = currentPasswordInput.trim();
    const safePassword = newPasswordInput.trim();
    const safeConfirm = newPasswordConfirmInput.trim();

    if (!safeCurrentPassword && !safePassword && !safeConfirm) {
      closePasswordModal();
      return;
    }

    if (!safeEmail) {
      Alert.alert('Contraseña', 'Necesitas un correo para cambiar la contraseña.');
      return;
    }

    if (!safeCurrentPassword) {
      Alert.alert('Contraseña', 'Ingresa tu contraseña actual para continuar.');
      return;
    }

    if (!safePassword || safePassword.length < 6) {
      Alert.alert('Contraseña', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (safePassword !== safeConfirm) {
      Alert.alert('Contraseña', 'Las contraseñas no coinciden.');
      return;
    }

    setSavingPassword(true);
    try {
      await resetPassword({
        email: safeEmail,
        newPassword: safePassword,
      });
      closePasswordModal();
      Alert.alert('Contraseña actualizada', 'Ya puedes iniciar sesión con la nueva contraseña.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.';
      Alert.alert('Contraseña', message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggleProfileStatus = () => {
    updateProfile({ isActive: !profile.isActive });
  };

  const handleDeactivateAndClear = () => {
    Alert.alert(
      'Eliminar datos locales',
      'Esto cerrará la sesión y borrará tu perfil, historial y preferencias en este dispositivo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await logout();
            resetProfile();
            clearHistory();
            setDarkMode(false);
            setNotificationsEnabled(true);
            setLanguage('es');
            Alert.alert('Listo', 'La cuenta local fue eliminada de este dispositivo.');
          },
        },
      ]
    );
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
                <View style={styles.profileWorkspace}>
                  <View style={styles.profileCard}>
                    <View style={styles.profileAvatarWrap}>
                      <View style={styles.profileAvatarFallback}>
                        <MaterialCommunityIcons name="account" size={34} color={theme.primary} />
                        <Text style={styles.profileAvatarFallbackText}>{userInitials || 'U'}</Text>
                      </View>
                    </View>
                    <View style={styles.profileHeaderCopy}>
                      <Text style={styles.sectionTitle}>Panel personal</Text>
                      <Text style={styles.helpText}>
                        Todo está agrupado por acciones para que no tengas que recorrer formularios largos.
                      </Text>
                      <View style={styles.statusRow}>
                        <View style={styles.sessionStatusPill}>
                          <Text style={styles.sessionStatusText}>{profile.isActive ? 'Activo' : 'Desactivado'}</Text>
                        </View>
                        <TouchableOpacity style={styles.ghostActionButton} onPress={() => setProfileModalVisible(true)}>
                          <Text style={styles.ghostActionButtonText}>Editar perfil</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.ghostActionButton} onPress={() => setPasswordModalVisible(true)}>
                          <Text style={styles.ghostActionButtonText}>Cambiar contraseña</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.formCard}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionHeaderCopy}>
                        <Text style={styles.sectionEyebrow}>Preferencias</Text>
                        <Text style={styles.sectionTitle}>Tipo de alimentación</Text>
                      </View>
                      <View style={styles.sectionBadge}>
                        <Text style={styles.sectionBadgeText}>{selectedDiet.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.sectionLead}>
                      Define el estilo de dieta para que las recomendaciones se sientan coherentes desde la primera pantalla.
                    </Text>

                    <View style={styles.dietGrid}>
                      {dietOptions.map((option) => {
                        const isSelected = dietType === option.key;

                        return (
                          <TouchableOpacity
                            key={option.key}
                            style={[styles.dietCard, isSelected && styles.dietCardActive]}
                            onPress={() => setDietType(option.key)}
                            activeOpacity={0.9}
                          >
                            <View style={[styles.dietDot, isSelected && styles.dietDotActive]} />
                            <View style={{ flex: 1 }}>
                              <View style={styles.dietCardTopRow}>
                                <Text style={[styles.dietLabel, isSelected && styles.dietLabelActive]}>{option.label}</Text>
                                <View style={[styles.dietCheckPill, isSelected && styles.dietCheckPillActive]}>
                                  <MaterialCommunityIcons
                                    name={isSelected ? 'check' : 'circle-outline'}
                                    size={14}
                                    color={isSelected ? theme.surface : theme.textSecondary}
                                  />
                                </View>
                              </View>
                              <Text style={[styles.dietDescription, isSelected && styles.dietDescriptionActive]}>
                                {option.description}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.selectedDietPanel}>
                      <MaterialCommunityIcons name="food-outline" size={16} color={theme.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectedDietTitle}>{selectedDiet.label}</Text>
                        <Text style={styles.selectedDietText}>{selectedDiet.description}</Text>
                      </View>
                    </View>

                    <View style={styles.allergyBlock}>
                      <View style={styles.allergyHeaderRow}>
                        <Text style={styles.allergyTitle}>Alergias o intolerancias</Text>
                        <Text style={styles.allergyCounter}>{allergies.length} registradas</Text>
                      </View>
                      <Text style={styles.allergyHint}>
                        Sepáralas con comas. Ejemplos: gluten, lacteos, mariscos.
                      </Text>
                      <View style={styles.allergyChipsWrap}>
                        {allergies.length > 0 ? (
                          allergies.map((allergy) => (
                            <View key={allergy} style={styles.allergyChip}>
                              <MaterialCommunityIcons name="alert-circle-outline" size={12} color={theme.error} />
                              <Text style={styles.allergyChipText}>{allergy}</Text>
                            </View>
                          ))
                        ) : (
                          <View style={styles.allergyEmptyState}>
                            <MaterialCommunityIcons name="shield-check-outline" size={16} color={theme.textSecondary} />
                            <Text style={styles.allergyEmptyStateText}>Sin alergias guardadas por ahora</Text>
                          </View>
                        )}
                      </View>
                      <TextInput
                        value={allergyInput}
                        onChangeText={setAllergyInput}
                        placeholder="Gluten, lacteos, mani..."
                        placeholderTextColor={theme.textSecondary}
                        style={styles.allergyInputCompact}
                        returnKeyType="done"
                      />
                    </View>

                    <View style={styles.currentProfile}>
                      <Text style={styles.currentLabel}>Estado actual</Text>
                      <Text style={styles.currentValue}>
                        {dietOptions.find((option) => option.key === dietType)?.label || 'Carnívoro'}
                        {allergies.length > 0
                          ? ` · ${allergies.join(', ')}`
                          : ' · Sin alergias registradas'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.formCard}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionHeaderCopy}>
                        <Text style={styles.sectionEyebrow}>Resumen</Text>
                        <Text style={styles.sectionTitle}>Gasto personal</Text>
                      </View>
                      <TouchableOpacity style={styles.sectionLinkButton} onPress={() => navigation.navigate('History')}>
                        <Text style={styles.sectionLinkButtonText}>Ver todo</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.sectionLead}>
                      Una gráfica de barras compacta para ver tu gasto por semana o por mes.
                    </Text>

                    {purchaseHistory.length === 0 ? (
                      <View style={styles.emptyActivityCard}>
                        <View style={styles.emptyActivityIconWrap}>
                          <MaterialCommunityIcons name="chart-bar" size={22} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.emptyActivityTitle}>Todavía no hay gasto registrado</Text>
                          <Text style={styles.emptyActivityText}>
                            Cuando hagas tu primera compra, verás una gráfica con tus gastos personales.
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={styles.statsRow}>
                          <View style={[styles.statPill, visualSystem.surfaces.muted, visualSystem.thinShadow]}>
                            <Text style={styles.statPillValue}>{purchaseHistory.length}</Text>
                            <Text style={styles.statPillLabel}>Compras</Text>
                          </View>
                          <View style={[styles.statPill, visualSystem.surfaces.muted, visualSystem.thinShadow]}>
                            <Text style={styles.statPillValue}>${purchaseHistory.reduce((sum, purchase) => sum + purchase.total, 0)}</Text>
                            <Text style={styles.statPillLabel}>Gastado</Text>
                          </View>
                          <View style={[styles.statPill, visualSystem.surfaces.muted, visualSystem.thinShadow]}>
                            <Text style={styles.statPillValue}>{recentPurchases.length}</Text>
                            <Text style={styles.statPillLabel}>Recientes</Text>
                          </View>
                        </View>

                        <View style={[styles.spendingChartCard, visualSystem.surfaces.muted, visualSystem.thinShadow]}>
                          <View style={styles.spendingChartHeader}>
                            <View style={styles.spendingChartHeaderCopy}>
                              <Text style={styles.spendingChartTitle}>Gasto por {spendingPeriod === 'week' ? 'semana' : 'mes'}</Text>
                              <Text style={styles.spendingChartHint}>
                                {spendingBuckets.length > 0 ? `${spendingBuckets.length} periodos visualizados` : 'Sin periodos para mostrar'}
                              </Text>
                            </View>
                            <View style={styles.spendingPeriodToggle}>
                              <TouchableOpacity
                                style={[styles.spendingPeriodButton, spendingPeriod === 'week' && styles.spendingPeriodButtonActive]}
                                onPress={() => setSpendingPeriod('week')}
                                activeOpacity={0.85}
                              >
                                <Text style={[styles.spendingPeriodText, spendingPeriod === 'week' && styles.spendingPeriodTextActive]}>Semana</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.spendingPeriodButton, spendingPeriod === 'month' && styles.spendingPeriodButtonActive]}
                                onPress={() => setSpendingPeriod('month')}
                                activeOpacity={0.85}
                              >
                                <Text style={[styles.spendingPeriodText, spendingPeriod === 'month' && styles.spendingPeriodTextActive]}>Mes</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          <View style={styles.spendingChartLegend}>
                            <View style={styles.spendingLegendItem}>
                              <View style={[styles.spendingLegendDot, { backgroundColor: theme.success }]} />
                              <Text style={styles.spendingLegendText}>Bajo</Text>
                            </View>
                            <View style={styles.spendingLegendItem}>
                              <View style={[styles.spendingLegendDot, { backgroundColor: theme.primary }]} />
                              <Text style={styles.spendingLegendText}>Medio</Text>
                            </View>
                            <View style={styles.spendingLegendItem}>
                              <View style={[styles.spendingLegendDot, { backgroundColor: theme.error }]} />
                              <Text style={styles.spendingLegendText}>Alto</Text>
                            </View>
                            <Text style={styles.spendingLegendNote}>Promedio ${averageSpendingPerPeriod}</Text>
                          </View>

                          <View style={styles.spendingChartArea}>
                            {averageLinePercent > 0 ? (
                              <View
                                pointerEvents="none"
                                style={[
                                  styles.averageGuideLine,
                                  { bottom: `${averageLinePercent}%` },
                                ]}
                              >
                                <View style={styles.averageGuideStroke} />
                              </View>
                            ) : null}
                            {spendingBuckets.map((item) => {
                              const heightPercent = maxSpendingValue > 0 ? Math.max((item.amount / maxSpendingValue) * 100, 14) : 14;

                              return (
                                <View key={item.id} style={styles.spendingBarItem}>
                                  <Text style={styles.spendingBarAmount}>${item.amount}</Text>
                                  <View style={styles.spendingBarTrack}>
                                    <View
                                      style={[
                                        styles.spendingBarFill,
                                        { height: `${heightPercent}%`, backgroundColor: item.color },
                                      ]}
                                    />
                                  </View>
                                  <Text style={styles.spendingBarLabel}>{item.label}</Text>
                                  <Text style={styles.spendingBarMeta}>{item.count} compras</Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>

                        <View style={styles.historyTimeline}>
                          {recentPurchases.map((purchase, index) => (
                            <View key={purchase.id} style={styles.historyRow}>
                              <View style={styles.historyRail}>
                                <View style={styles.historyDot} />
                                {index < recentPurchases.length - 1 && <View style={styles.historyLine} />}
                              </View>
                              <View style={[styles.historyContentCard, visualSystem.surfaces.muted, visualSystem.thinShadow]}>
                                <View style={styles.historyContentTop}>
                                  <Text style={styles.historyDate}>{purchase.date}</Text>
                                  <Text style={styles.historyAmount}>${purchase.total}</Text>
                                </View>
                                <Text style={styles.historyMeta}>
                                  {purchase.items.length} productos · Propina ${purchase.tip}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </View>

                  <View style={styles.formCard}>
                    <Text style={styles.cardTitle}>Zona peligrosa</Text>
                    <View style={styles.dangerActionsRow}>
                      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.warningButton} onPress={handleToggleProfileStatus}>
                        <Text style={styles.warningButtonText}>
                          {profile.isActive ? 'Desactivar' : 'Activar'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.warningButton} onPress={handleDeactivateAndClear}>
                        <Text style={styles.warningButtonText}>Eliminar datos</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.smallNote}>
                      Todavía no existe revocación remota de sesiones; estas acciones aplican a este dispositivo.
                    </Text>
                  </View>
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

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={profileModalVisible} transparent animationType="fade" onRequestClose={() => setProfileModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar perfil</Text>
            <Text style={styles.modalSubtitle}>Actualiza nombre, correo y teléfono. La foto se omitirá por ahora.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre"
              value={profileNameInput}
              onChangeText={setProfileNameInput}
              placeholderTextColor={theme.textSecondary}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Correo"
              value={profileEmailInput}
              onChangeText={setProfileEmailInput}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={theme.textSecondary}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Teléfono"
              value={profilePhoneInput}
              onChangeText={setProfilePhoneInput}
              keyboardType="phone-pad"
              placeholderTextColor={theme.textSecondary}
            />
            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={closeProfileModal}>
                <Text style={styles.modalSecondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryButton} onPress={handleSaveProfile} disabled={savingProfile}>
                <Text style={styles.modalPrimaryButtonText}>{savingProfile ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={passwordModalVisible} transparent animationType="fade" onRequestClose={() => setPasswordModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cambiar contraseña</Text>
            <Text style={styles.modalSubtitle}>Te pedimos la contraseña actual, la nueva y su confirmación.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Contraseña actual"
              value={currentPasswordInput}
              onChangeText={setCurrentPasswordInput}
              secureTextEntry
              placeholderTextColor={theme.textSecondary}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Nueva contraseña"
              value={newPasswordInput}
              onChangeText={setNewPasswordInput}
              secureTextEntry
              placeholderTextColor={theme.textSecondary}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Confirmar nueva contraseña"
              value={newPasswordConfirmInput}
              onChangeText={setNewPasswordConfirmInput}
              secureTextEntry
              placeholderTextColor={theme.textSecondary}
            />
            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={closePasswordModal}>
                <Text style={styles.modalSecondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryButton} onPress={handleChangePassword} disabled={savingPassword}>
                <Text style={styles.modalPrimaryButtonText}>{savingPassword ? 'Actualizando...' : 'Cambiar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme, horizontalPadding: number, contentMaxWidth?: number, isCompactScreen = false) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: isCompactScreen ? 18 : 28, backgroundColor: theme.background },
    headerShell: { paddingHorizontal: horizontalPadding },
    stack: {
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: horizontalPadding,
      paddingTop: isCompactScreen ? 4 : 8,
    },
    profileHeader: { paddingTop: isCompactScreen ? 8 : 14, marginBottom: isCompactScreen ? 2 : 6 },
    title: { fontSize: isCompactScreen ? 25 : 28, fontWeight: '800', color: theme.text, marginTop: 15 },
    subtitle: { fontSize: isCompactScreen ? 14 : 15, color: theme.textSecondary, marginTop: 8, lineHeight: isCompactScreen ? 19 : 21 },
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
      borderRadius: 22,
      padding: 16,
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
      marginBottom: isCompactScreen ? 12 : 16,
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
    sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 12 },
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
      marginTop: 0,
      flexGrow: 1,
      borderWidth: 1,
      borderColor: theme.error,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    logoutButtonText: {
      color: theme.error,
      fontSize: 13,
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
    profileWorkspace: {
      gap: isCompactScreen ? 8 : 10,
      marginTop: 10,
      marginBottom: isCompactScreen ? 12 : 16,
    },
    profileCard: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      padding: 14,
      shadowColor: theme.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    profileAvatarWrap: {
      width: 84,
      height: 84,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileAvatarFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primaryLight,
      borderRadius: 28,
    },
    profileAvatarFallbackText: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    profileHeaderCopy: { flex: 1, gap: 8 },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    formCard: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      padding: isCompactScreen ? 12 : 14,
      gap: isCompactScreen ? 8 : 10,
      shadowColor: theme.shadow,
      shadowOpacity: 0.05,
      shadowRadius: 14,
      elevation: 2,
    },
    cardTitle: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 2 },
    secondaryActionButton: {
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
      backgroundColor: theme.primary + '10',
    },
    secondaryActionButtonText: { color: theme.primary, fontSize: 14, fontWeight: '700' },
    smallNote: { color: theme.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 2 },
    ghostActionButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    ghostActionButtonText: { color: theme.text, fontWeight: '700', fontSize: 12 },
    preferenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 6,
    },
    preferenceTextBlock: { flex: 1, paddingRight: 10 },
    preferenceTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
    preferenceHint: { fontSize: 12, color: theme.textSecondary, marginTop: 2, lineHeight: 17 },
    languageRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
    languageChip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    languageChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    languageChipText: { color: theme.textSecondary, fontWeight: '700', fontSize: 12 },
    languageChipTextActive: { color: theme.surface },
    statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    statPill: {
      paddingHorizontal: 10,
      paddingVertical: isCompactScreen ? 8 : 9,
      borderRadius: 14,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      minWidth: isCompactScreen ? 92 : 110,
      flexBasis: isCompactScreen ? '31%' : undefined,
      flexGrow: 1,
    },
    statPillValue: { color: theme.text, fontSize: isCompactScreen ? 15 : 16, fontWeight: '800' },
    statPillLabel: { color: theme.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 2 },
    historyPreviewCard: {
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      gap: 4,
    },
    historyPreviewDate: { color: theme.primary, fontWeight: '700', fontSize: 13 },
    historyPreviewText: { color: theme.textSecondary, fontSize: 12, lineHeight: 18 },
    warningButton: {
      flexGrow: 1,
      borderWidth: 1,
      borderColor: theme.error,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignItems: 'center',
      backgroundColor: theme.error + '10',
    },
    warningButtonText: { color: theme.error, fontWeight: '700', fontSize: 13 },
    dangerActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 4,
    },
    sectionHeaderCopy: { flex: 1 },
    sectionEyebrow: {
      color: theme.primary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      fontSize: 11,
      fontWeight: '800',
      marginBottom: 6,
    },
    sectionLead: { color: theme.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 14 },
    sectionBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.primaryLight,
      alignSelf: 'flex-start',
    },
    sectionBadgeText: { color: theme.primary, fontSize: 11, fontWeight: '800' },
    sectionLinkButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      alignSelf: 'center',
    },
    sectionLinkButtonText: { color: theme.text, fontSize: 12, fontWeight: '700' },
    dietGrid: { gap: 8 },
    dietCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: theme.background,
      gap: 8,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    dietCardActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '10',
      shadowColor: theme.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    dietCardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    dietDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: theme.border,
    },
    dietDotActive: { backgroundColor: theme.primary },
    dietCheckPill: {
      width: 24,
      height: 24,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dietCheckPillActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    dietLabel: { fontSize: 14, fontWeight: '800', color: theme.text },
    dietLabelActive: { color: theme.primary },
    dietDescription: { fontSize: 11, color: theme.textSecondary, lineHeight: 16 },
    dietDescriptionActive: { color: theme.text },
    selectedDietPanel: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
      padding: 12,
      borderRadius: 16,
      backgroundColor: theme.primaryLight,
      borderWidth: 1,
      borderColor: theme.primary + '20',
      marginTop: 2,
    },
    selectedDietTitle: { color: theme.text, fontSize: 13, fontWeight: '800', marginBottom: 2 },
    selectedDietText: { color: theme.textSecondary, fontSize: 12, lineHeight: 18 },
    allergyBlock: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 8,
    },
    allergyHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
    allergyTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
    allergyCounter: { color: theme.primary, fontSize: 12, fontWeight: '700' },
    allergyHint: { color: theme.textSecondary, fontSize: 12, lineHeight: 18 },
    allergyChipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    allergyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: theme.error + '10',
      borderWidth: 1,
      borderColor: theme.error + '20',
    },
    allergyChipText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    allergyEmptyState: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    allergyEmptyStateText: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
    allergyInputCompact: {
      backgroundColor: theme.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      height: 44,
      color: theme.text,
      fontSize: 14,
    },
    emptyActivityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 16,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyActivityIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: theme.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyActivityTitle: { color: theme.text, fontSize: 14, fontWeight: '800' },
    emptyActivityText: { color: theme.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 2 },
    historyTimeline: { gap: isCompactScreen ? 8 : 10 },
    historyRow: { flexDirection: 'row', gap: isCompactScreen ? 10 : 12, alignItems: 'flex-start' },
    historyRail: { width: 18, alignItems: 'center', position: 'relative', paddingTop: 4 },
    historyDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: theme.primary,
      zIndex: 1,
    },
    historyLine: {
      position: 'absolute',
      top: 14,
      bottom: -6,
      width: 2,
      borderRadius: 999,
      backgroundColor: theme.border,
    },
    historyContentCard: {
      flex: 1,
      padding: isCompactScreen ? 10 : 12,
      borderRadius: 18,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 4,
    },
    historyContentTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
    historyDate: { color: theme.text, fontSize: 13, fontWeight: '800' },
    historyAmount: { color: theme.primary, fontSize: 13, fontWeight: '900' },
    historyMeta: { color: theme.textSecondary, fontSize: isCompactScreen ? 11 : 12, lineHeight: isCompactScreen ? 16 : 18 },
    spendingChartCard: {
      padding: 12,
      borderRadius: 18,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    spendingChartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    spendingChartHeaderCopy: {
      flex: 1,
      gap: 2,
    },
    spendingChartTitle: { color: theme.text, fontSize: 14, fontWeight: '800' },
    spendingChartHint: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
    spendingPeriodToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 2,
      borderRadius: 999,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    spendingPeriodButton: {
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 999,
    },
    spendingPeriodButtonActive: {
      backgroundColor: theme.primary,
    },
    spendingPeriodText: { color: theme.textSecondary, fontSize: 11, fontWeight: '800' },
    spendingPeriodTextActive: { color: theme.surface },
    spendingChartLegend: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: 8,
      alignItems: 'center',
      paddingHorizontal: 2,
    },
    spendingLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
    },
    spendingLegendDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.primary,
    },
    spendingLegendText: { color: theme.textSecondary, fontSize: 11, fontWeight: '700' },
    spendingLegendNote: { color: theme.textSecondary, fontSize: 11, textAlign: 'right', flexShrink: 1, marginLeft: 'auto' },
    spendingChartArea: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: isCompactScreen ? 6 : 10,
      marginTop: 4,
      minHeight: isCompactScreen ? 184 : 220,
      paddingTop: 28,
    },
    averageGuideLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 0,
    },
    averageGuideStroke: {
      borderTopWidth: 1,
      borderTopColor: theme.primary + '35',
      borderStyle: 'dashed',
    },
    spendingBarItem: {
      flex: 1,
      alignItems: 'center',
      gap: isCompactScreen ? 4 : 6,
      minWidth: 0,
      zIndex: 1,
    },
    spendingBarAmount: {
      color: theme.text,
      fontSize: isCompactScreen ? 10 : 11,
      fontWeight: '800',
      textAlign: 'center',
    },
    spendingBarTrack: {
      width: isCompactScreen ? 12 : 16,
      height: isCompactScreen ? 108 : 136,
      borderRadius: 999,
      backgroundColor: theme.primaryLight,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      shadowColor: theme.shadow,
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 1,
    },
    spendingBarFill: {
      width: '100%',
      borderRadius: 999,
    },
    spendingBarLabel: {
      color: theme.text,
      fontSize: isCompactScreen ? 10 : 11,
      fontWeight: '800',
      textAlign: 'center',
    },
    spendingBarMeta: {
      color: theme.textSecondary,
      fontSize: 10,
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.56)',
      justifyContent: 'center',
      padding: 18,
    },
    modalCard: {
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOpacity: 0.16,
      shadowRadius: 24,
      elevation: 6,
      gap: 10,
    },
    modalTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
    modalSubtitle: { color: theme.textSecondary, fontSize: 13, lineHeight: 18 },
    modalInput: {
      backgroundColor: theme.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 15,
    },
    modalActionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalSecondaryButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      alignItems: 'center',
    },
    modalSecondaryButtonText: { color: theme.textSecondary, fontWeight: '700', fontSize: 14 },
    modalPrimaryButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.primary,
      alignItems: 'center',
    },
    modalPrimaryButtonText: { color: theme.surface, fontWeight: '800', fontSize: 14 },
  });
