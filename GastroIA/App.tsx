// App.tsx
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { CartProvider } from './src/context/CartContext';
import { ProfileProvider } from './src/context/ProfileContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { HistoryProvider } from './src/context/HistoryContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { AuthProvider } from './src/context/AuthContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <HistoryProvider>
          <FavoritesProvider>
            <CartProvider>
              <AuthProvider>
                <ProfileProvider>
                  <StatusBar style="auto" />
                  <AppNavigator />
                </ProfileProvider>
              </AuthProvider>
            </CartProvider>
          </FavoritesProvider>
        </HistoryProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
