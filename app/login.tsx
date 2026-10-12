import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Link } from 'expo-router';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import ScreenWatermark from '@/components/ScreenWatermark';
import { COLORS } from '@/constants/colors';
import { signIn } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 480;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Add your Supabase URL and anon key to .env, then restart Expo.');
      return;
    }

    setLoading(true);
    setError(null);
    const { error: authError } = await signIn(email.trim(), password);
    setLoading(false);
    if (authError) setError(authError.message);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenWatermark />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.panel, compact && styles.compactPanel]}>
          <Header title="QR Attendance" />
          <Text style={styles.eyebrow}>SECURE CHECK-IN</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to manage your events and attendance.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your.email@school.edu"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          placeholderTextColor={COLORS.textSecondary}
          secureTextEntry
          editable={!loading}
        />

          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            {loading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
            ) : (
              <AppButton title="Sign In" icon="login" theme="primary" onPress={handleLogin} />
            )}
            <Link href="/register" style={styles.link}>Don&apos;t have an account? Sign Up</Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  panel: { width: '100%', maxWidth: 460, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 30, paddingTop: 12, paddingBottom: 28 },
  compactPanel: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: COLORS.primary, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6, marginTop: 10 },
  input: { minHeight: 48, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, paddingHorizontal: 13, paddingVertical: 11, fontSize: 16, color: COLORS.textPrimary },
  error: { color: COLORS.danger, marginTop: 12, textAlign: 'center' },
  actions: { width: '100%', marginTop: 20, alignItems: 'center' },
  loader: { marginVertical: 10 },
  link: { color: COLORS.primary, textAlign: 'center', fontWeight: '600', paddingVertical: 10 },
});
