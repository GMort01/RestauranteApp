// src/screens/FavoritesScreen.tsx
import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ListRenderItemInfo,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FavoritesContext } from '../context/FavoritesContext';
import { CartContext } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import CustomButton from '../components/CustomButton';
import { RootStackParamList, MenuItem, Theme } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Favorites'>;

export default function FavoritesScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 980 ? 26 : width >= 700 ? 20 : 14;
  const contentMaxWidth = width >= 980 ? 980 : width >= 700 ? 760 : undefined;
  const { favoriteItems, removeFavorite } = useContext(FavoritesContext);
  const { addItem } = useContext(CartContext);
  const { theme } = useSettings();
  const styles = getStyles(theme, horizontalPadding, contentMaxWidth);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerShell}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
            <Text style={styles.goBackText}>Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Favoritos</Text>
        </View>
      </View>

      {favoriteItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={64} color={theme.textSecondary} />
          <Text style={styles.emptyTitle}>Tu lista de favoritos está vacía</Text>
          <Text style={styles.emptySubtitle}>
            Marca platillos como favoritos y encuentra tus antojos más rápido.
          </Text>
        </View>
      ) : (
        <FlatList
          data={favoriteItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }: ListRenderItemInfo<MenuItem>) => (
            <View style={styles.card}>
              <View>
                <Text style={styles.itemName}>{item.nombre}</Text>
                <Text style={styles.itemRestaurant}>{item.restaurantName}</Text>
                <Text style={styles.itemPrice}>${item.precio}</Text>
              </View>
              <View style={styles.actionsRow}>
                <CustomButton
                  title="Agregar al carrito"
                  onPress={() => addItem(item)}
                  style={styles.addButton}
                />
                <TouchableOpacity onPress={() => removeFavorite(item.id)} style={styles.removeButton}>
                  <Ionicons name="trash-bin-outline" size={22} color={theme.error} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme, horizontalPadding: number, contentMaxWidth?: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    headerShell: {
      paddingHorizontal: horizontalPadding,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    goBackButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    goBackText: {
      marginLeft: 6,
      fontSize: 16,
      color: theme.text,
      fontWeight: '600',
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.text,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 30,
    },
    emptyTitle: {
      marginTop: 20,
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      marginTop: 8,
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    listContainer: {
      paddingHorizontal: horizontalPadding,
      paddingTop: 12,
      paddingBottom: 20,
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    itemName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    itemRestaurant: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 6,
    },
    itemPrice: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.primary,
      marginBottom: 12,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    addButton: {
      flex: 1,
      marginRight: 10,
    },
    removeButton: {
      padding: 8,
    },
  });
