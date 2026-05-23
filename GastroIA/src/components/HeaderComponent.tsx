// src/components/HeaderComponent.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Theme } from '../types';

interface HeaderComponentProps {
  onOpenMenu: () => void;
  onOpenCart?: () => void;
  cartCount?: number;
}

export default function HeaderComponent({ onOpenMenu, onOpenCart, cartCount = 0 }: HeaderComponentProps) {
  const { theme } = useSettings();
  const { isAuthenticated } = useAuth();
  const styles = getStyles(theme);

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity onPress={onOpenMenu} style={styles.menuButton}>
        <Ionicons name="menu" size={32} color={theme.text} />
      </TouchableOpacity>

      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name="chef-hat" size={28} color={theme.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.brandTitle}>
          Gastro<Text style={{ color: theme.primary }}>IA</Text>
        </Text>
        <View style={styles.subtitleRow}>
          <Text style={styles.brandSubtitle}>Asistente gourmet</Text>
          <View
            style={[
              styles.sessionPill,
              isAuthenticated ? styles.sessionPillOn : styles.sessionPillOff,
            ]}
          >
            <Text
              style={[
                styles.sessionPillText,
                isAuthenticated ? styles.sessionPillTextOn : styles.sessionPillTextOff,
              ]}
            >
              {isAuthenticated ? 'Sesión activa' : 'Invitado'}
            </Text>
          </View>
        </View>
      </View>

      {onOpenCart && (
        <TouchableOpacity onPress={onOpenCart} style={styles.cartButton}>
          <Ionicons name="cart-outline" size={28} color={theme.text} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginBottom: 22,
      backgroundColor: theme.background,
    },
    menuButton: {
      marginRight: 14,
    },
    iconCircle: {
      width: 46,
      height: 46,
      borderRadius: 18,
      backgroundColor: theme.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    subtitleRow: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    brandTitle: {
      fontSize: 23,
      fontWeight: '900',
      color: theme.text,
    },
    cartButton: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    cartBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    cartBadgeText: {
      color: theme.surface,
      fontSize: 10,
      fontWeight: '700',
    },
    brandSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    sessionPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
    },
    sessionPillOn: {
      backgroundColor: '#ECF8EE',
      borderColor: '#B7E1C3',
    },
    sessionPillOff: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
    },
    sessionPillText: {
      fontSize: 10,
      fontWeight: '700',
    },
    sessionPillTextOn: {
      color: '#276749',
    },
    sessionPillTextOff: {
      color: theme.textSecondary,
    },
  });
