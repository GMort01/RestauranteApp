// src/components/ProSideMenu.tsx
import React from 'react';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList, Theme } from '../types';

const OWNER_SESSION_KEY = '@gastroia/owner/session';

interface ProSideMenuProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuItemProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  onPress: () => void;
  active: boolean;
  styles: ReturnType<typeof getStyles>;
  theme: Theme;
}

const MenuItem = ({ icon, title, onPress, active, styles, theme }: MenuItemProps) => (
  <TouchableOpacity
    style={[
      styles.menuItem,
      active && {
        backgroundColor: theme.primaryLight + '55',
        borderRightWidth: 4,
        borderRightColor: theme.primary,
      },
    ]}
    onPress={onPress}
  >
    <Ionicons name={icon} size={22} color={active ? theme.primary : theme.textSecondary} />
    <Text style={[styles.menuItemText, active && { color: theme.primary, fontWeight: 'bold' }]}>
      {title}
    </Text>
  </TouchableOpacity>
);

export default function ProSideMenu({ visible, onClose }: ProSideMenuProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const currentScreen = route.name;
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { theme } = useSettings();
  const styles = getStyles(theme);
  const [hasOwnerSession, setHasOwnerSession] = useState(false);

  useEffect(() => {
    const loadOwnerSession = async () => {
      if (!visible) return;

      try {
        const rawSession = await AsyncStorage.getItem(OWNER_SESSION_KEY);
        setHasOwnerSession(Boolean(rawSession));
      } catch (error) {
        setHasOwnerSession(false);
      }
    };

    loadOwnerSession();
  }, [visible]);

  const handleNavigation = (screenName: keyof RootStackParamList) => {
    onClose();
    setTimeout(() => {
      navigation.dispatch(CommonActions.navigate({ name: screenName }));
    }, 150);
  };

  const handleLogout = async () => {
    await logout();
    onClose();
    setTimeout(() => {
      navigation.navigate('Home');
    }, 150);
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backgroundTouch} onPress={onClose} activeOpacity={1} />

        <View style={styles.menuContainer}>
          <SafeAreaView style={{ flex: 1 }}>

            <View style={styles.profileHeader}>
              <MaterialCommunityIcons name="account-circle" size={70} color={theme.surface} />
              <Text style={styles.userName}>{currentUser?.name || 'Invitado'}</Text>
              <Text style={styles.userEmail}>
                {currentUser?.email || 'Explora sin iniciar sesión'}
              </Text>
            </View>

            <ScrollView
              style={styles.menuItems}
              contentContainerStyle={styles.menuItemsContent}
              showsVerticalScrollIndicator
              bounces={false}
            >
              <View style={styles.sectionGroup}>
                <Text style={styles.sectionLabel}>Principal</Text>
                <View style={styles.sectionDivider} />
              </View>
              <MenuItem
                icon="home-outline"
                title="Explorar Menús"
                active={currentScreen === 'Home'}
                onPress={() => handleNavigation('Home')}
                styles={styles}
                theme={theme}
              />
              <MenuItem
                icon="storefront-outline"
                title="Restaurantes"
                active={currentScreen === 'Restaurants'}
                onPress={() => handleNavigation('Restaurants')}
                styles={styles}
                theme={theme}
              />

              <View style={styles.sectionGroup}>
                <Text style={styles.sectionLabel}>Modo dueño</Text>
                <View style={styles.sectionDivider} />
              </View>
              <MenuItem
                icon="business-outline"
                title="Modo dueño"
                active={currentScreen === 'Owner'}
                onPress={() => handleNavigation('Owner')}
                styles={styles}
                theme={theme}
              />
              {hasOwnerSession && (
                <MenuItem
                  icon="id-card-outline"
                  title="Perfil restaurante"
                  active={currentScreen === 'OwnerProfile'}
                  onPress={() => handleNavigation('OwnerProfile')}
                  styles={styles}
                  theme={theme}
                />
              )}

              <View style={styles.sectionGroup}>
                <Text style={styles.sectionLabel}>Mi cuenta</Text>
                <View style={styles.sectionDivider} />
              </View>
              <MenuItem
                icon="person-outline"
                title="Mi Perfil"
                active={currentScreen === 'Account'}
                onPress={() => handleNavigation('Account')}
                styles={styles}
                theme={theme}
              />
              <MenuItem
                icon="cart-outline"
                title="Carrito"
                active={currentScreen === 'Cart'}
                onPress={() => handleNavigation('Cart')}
                styles={styles}
                theme={theme}
              />
              <MenuItem
                icon="heart-outline"
                title="Favoritos"
                active={currentScreen === 'Favorites'}
                onPress={() => handleNavigation('Favorites')}
                styles={styles}
                theme={theme}
              />
              <MenuItem
                icon="time-outline"
                title="Historial"
                active={currentScreen === 'History'}
                onPress={() => handleNavigation('History')}
                styles={styles}
                theme={theme}
              />

              <View style={styles.sectionGroup}>
                <Text style={styles.sectionLabel}>Aplicación</Text>
                <View style={styles.sectionDivider} />
              </View>
              <MenuItem
                icon="settings-outline"
                title="Configuración"
                active={currentScreen === 'Settings'}
                onPress={() => handleNavigation('Settings')}
                styles={styles}
                theme={theme}
              />
              <MenuItem
                icon="information-circle-outline"
                title="Sobre la app"
                active={currentScreen === 'About'}
                onPress={() => handleNavigation('About')}
                styles={styles}
                theme={theme}
              />
            </ScrollView>

            <View style={styles.logoutSection}>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={isAuthenticated ? handleLogout : () => handleNavigation('Account')}
              >
                <Ionicons
                  name={isAuthenticated ? 'log-out-outline' : 'person-add-outline'}
                  size={24}
                  color="#FF3B30"
                />
                <Text style={styles.logoutText}>
                  {isAuthenticated ? 'Cerrar Sesión' : 'Crear / Iniciar Sesión'}
                </Text>
              </TouchableOpacity>
            </View>

          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(15,23,42,0.42)' },
    backgroundTouch: { flex: 1 },
    menuContainer: {
      width: Platform.OS === 'web' ? 320 : '78%',
      maxWidth: Platform.OS === 'web' ? 360 : undefined,
      height: '100%',
      backgroundColor: theme.surface,
      position: 'absolute',
      left: 0,
      shadowColor: '#000',
      shadowOffset: { width: 8, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 14,
    },
    profileHeader: { backgroundColor: theme.primary, paddingTop: 44, paddingBottom: 32, paddingHorizontal: 20, alignItems: 'flex-start' },
    userName: { color: theme.surface, fontSize: 21, fontWeight: '800', marginTop: 10 },
    userEmail: { color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 4 },
    menuItems: { flex: 1, paddingTop: 18 },
    menuItemsContent: { paddingBottom: 16 },
    sectionGroup: { marginTop: 4, marginBottom: 8, paddingHorizontal: 20 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.textSecondary,
      marginBottom: 8,
    },
    sectionDivider: {
      height: 1,
      backgroundColor: theme.border,
      opacity: 0.75,
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, marginHorizontal: 10, marginBottom: 6 },
    menuItemText: { fontSize: 15, color: theme.text, marginLeft: 14, fontWeight: '600' },
    logoutSection: { padding: 20, borderTopWidth: 1, borderTopColor: theme.border, marginBottom: 10, backgroundColor: theme.surface },
    logoutButton: { flexDirection: 'row', alignItems: 'center' },
    logoutText: { fontSize: 16, fontWeight: 'bold', color: '#FF3B30', marginLeft: 15 },
  });
