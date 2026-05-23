// src/components/CustomButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { Theme } from '../types';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function CustomButton({ title, onPress, style, textStyle }: CustomButtonProps) {
  const { theme } = useSettings();
  const styles = getStyles(theme);

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.text, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      backgroundColor: theme.primary,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.primaryLight,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 1,
      alignSelf: 'stretch',
    },
    text: {
      color: theme.surface,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0.1,
    },
  });
