import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../types';
import { useSettings } from '../context/SettingsContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useSettings();
  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgBlobTop} />
      <View style={styles.bgBlobBottom} />

      <View style={styles.content}>
        <Text style={styles.kicker}>GastroIA</Text>
        <Text style={styles.title}>Bienvenido</Text>
        <Text style={styles.subtitle}>
          Encuentra opciones de comida con una experiencia rápida, limpia y personalizada.
        </Text>

        <TouchableOpacity
          style={styles.enterButton}
          activeOpacity={0.9}
          onPress={() => navigation.replace('Home')}
        >
          <Text style={styles.enterButtonText}>Entrar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: {
  primary: string;
  primaryLight: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  shadow: string;
}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      overflow: 'hidden',
    },
    bgBlobTop: {
      position: 'absolute',
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: theme.primary + '18',
      top: -90,
      right: -80,
    },
    bgBlobBottom: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: theme.primaryLight + '55',
      bottom: -90,
      left: -70,
    },
    content: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 24,
      paddingVertical: 34,
      paddingHorizontal: 24,
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 5,
    },
    kicker: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    title: {
      fontSize: 36,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 10,
      letterSpacing: -0.8,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      color: theme.textSecondary,
      marginBottom: 28,
      fontWeight: '500',
    },
    enterButton: {
      width: '100%',
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
    },
    enterButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  });