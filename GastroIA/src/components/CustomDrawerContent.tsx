// src/components/CustomDrawerContent.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { Theme } from '../types';

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { theme } = useSettings();
  const styles = getStyles(theme);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <MaterialCommunityIcons name="account-circle" size={80} color={theme.surface} />
        </View>
        <Text style={styles.userName}>Gourmet User</Text>
        <Text style={styles.userEmail}>usuario@gastroia.com</Text>
      </View>

      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
        <View style={styles.drawerItemsContainer}>
          <DrawerItemList {...props} />
        </View>
      </DrawerContentScrollView>

      <View style={styles.logoutSection}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => alert('Cerrando sesión...')}
        >
          <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    profileHeader: {
      backgroundColor: theme.primary,
      paddingTop: 60,
      paddingBottom: 30,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    avatarContainer: {
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 5,
      elevation: 8,
    },
    userName: {
      color: theme.surface,
      fontSize: 20,
      fontWeight: 'bold',
    },
    userEmail: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 14,
      marginTop: 2,
    },
    drawerItemsContainer: {
      flex: 1,
      paddingTop: 10,
      backgroundColor: theme.background,
    },
    logoutSection: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FF3B30',
      marginLeft: 10,
    },
  });
