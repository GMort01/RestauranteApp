import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import HeaderComponent from '../components/HeaderComponent';
import ProSideMenu from '../components/ProSideMenu';
import { useSettings } from '../context/SettingsContext';
import { ownerFetchProfile, ownerUpdateBusinessProfile } from '../services/apiService';
import { OwnerBusinessProfile, RootStackParamList, Theme } from '../types';

const OWNER_SESSION_KEY = '@gastroia/owner/session';

type OwnerSession = {
  token: string;
  restaurantId: string;
  restaurantName: string;
  ownerName: string;
  email: string;
};

export default function OwnerProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useSettings();
  const styles = getStyles(theme);

  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [profile, setProfile] = useState<OwnerBusinessProfile | null>(null);

  const [nit, setNit] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        const rawSession = await AsyncStorage.getItem(OWNER_SESSION_KEY);
        if (!rawSession) {
          setSession(null);
          return;
        }

        const parsedSession = JSON.parse(rawSession) as OwnerSession;
        if (!parsedSession?.token || !parsedSession?.restaurantId) {
          setSession(null);
          return;
        }

        setSession(parsedSession);
        const data = await ownerFetchProfile(parsedSession.restaurantId, parsedSession.token);
        setProfile(data);
        setNit(data.nit);
        setAddress(data.address);
        setPhone(data.phone);
      } catch (error) {
        setFeedback('No se pudo cargar el perfil del restaurante.');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const handleSave = async () => {
    if (!session) {
      setFeedback('Primero inicia sesión como dueño.');
      return;
    }

    if (!nit.trim() || !address.trim() || !phone.trim()) {
      setFeedback('Completa NIT, dirección y teléfono.');
      return;
    }

    setSaving(true);
    try {
      const updated = await ownerUpdateBusinessProfile(session.restaurantId, session.token, {
        nit: nit.trim(),
        address: address.trim(),
        phone: phone.trim(),
      });
      setProfile(updated);
      setFeedback('Perfil actualizado correctamente.');
    } catch (error) {
      setFeedback('No se pudo guardar el perfil.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <ProSideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
        <HeaderComponent onOpenMenu={() => setMenuVisible(true)} onOpenCart={() => {}} cartCount={0} />

        <View style={styles.centeredCard}>
          <Text style={styles.title}>Perfil restaurante</Text>
          <Text style={styles.subtitle}>Debes iniciar sesión como dueño para ver esta página.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Owner')}>
            <Text style={styles.primaryButtonText}>Ir a Modo dueño</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ProSideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
      <HeaderComponent onOpenMenu={() => setMenuVisible(true)} onOpenCart={() => {}} cartCount={0} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Perfil restaurante</Text>
          <Text style={styles.subtitle}>{profile?.restaurant_name ?? session.restaurantName}</Text>
          <Text style={styles.metaText}>Dueño: {profile?.owner_name ?? session.ownerName}</Text>
          <Text style={styles.metaText}>Correo: {session.email}</Text>
          <Text style={styles.metaText}>Categoría: {profile?.category ?? 'N/D'}</Text>
          <Text style={styles.metaText}>Entrega: {profile?.delivery_time ?? 'Por calcular'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos editables</Text>
          <TextInput style={styles.input} placeholder="NIT" value={nit} onChangeText={setNit} placeholderTextColor={theme.textSecondary} />
          <TextInput style={styles.input} placeholder="Dirección" value={address} onChangeText={setAddress} placeholderTextColor={theme.textSecondary} />
          <TextInput style={styles.input} placeholder="Teléfono" value={phone} onChangeText={setPhone} placeholderTextColor={theme.textSecondary} />
          <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryButtonText}>{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Owner')}>
          <Text style={styles.secondaryButtonText}>Volver al panel de negocio</Text>
        </TouchableOpacity>

        {feedback !== '' && <Text style={styles.feedback}>{feedback}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: theme.textSecondary },
    centeredCard: { margin: 16, padding: 16, borderWidth: 1, borderColor: theme.border, borderRadius: 14, backgroundColor: theme.surface, gap: 10 },
    content: { padding: 16, gap: 12, paddingBottom: 40 },
    card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 12, gap: 8 },
    title: { fontSize: 24, fontWeight: '800', color: theme.text },
    subtitle: { color: theme.textSecondary },
    metaText: { color: theme.textSecondary, fontSize: 12 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: theme.text, backgroundColor: theme.background },
    primaryButton: { backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    primaryButtonText: { color: '#fff', fontWeight: '700' },
    secondaryButton: { borderWidth: 1, borderColor: theme.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: theme.primary + '10' },
    secondaryButtonText: { color: theme.primary, fontWeight: '700' },
    feedback: { color: theme.primary, fontWeight: '600' },
  });
