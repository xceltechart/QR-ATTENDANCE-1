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
import { signUp } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function RegisterScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 480;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Add your Supabase URL and anon key to .env, then restart Expo.');
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: authError } = await signUp(email.trim(), password, {
      full_name: fullName.trim(),
    });
    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else if (
      data.user &&
      (!data.user.identities || data.user.identities.length === 0)
    ) {
      if (data.user.email_confirmed_at || data.user.confirmed_at) {
        setError('An account with this email already exists. Sign in instead.');
      } else {
        setError(
          `This email is already registered in Supabase Auth but was never confirmed (probably an earlier sign-up before confirmation emails worked). A new confirmation link was just sent to ${email.trim()} - check your inbox and Junk/Spam. If it never arrives, an admin must enable email (SMTP) in Authentication settings, or delete the pending user under Authentication > Users so you can sign up again.`
        );
      }
    } else if (!data.session) {
      setError(
        `Confirmation link sent to ${email.trim()}. Check your inbox (and Junk/Spam), then sign in. If it never arrives, the Supabase project needs an email/SMTP provider enabled in Authentication settings.`
      );
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenWatermark />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.panel, compact && styles.compactPanel]}>
        <Header title="QR Attendance" />
        <Text style={styles.eyebrow}>JOIN QR ATTENDANCE</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>New accounts start as Students. An administrator can upgrade you to Teacher.</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={COLORS.textSecondary} />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="your.email@school.edu" placeholderTextColor={COLORS.textSecondary} autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor={COLORS.textSecondary} secureTextEntry />
        <Text style={styles.label}>Confirm Password</Text>
        <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat your password" placeholderTextColor={COLORS.textSecondary} secureTextEntry />

        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}>
          {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} /> : <AppButton title="Create Account" icon="person-add" theme="primary" onPress={handleRegister} />}
          <Link href="/login" style={styles.link}>Already have an account? Sign In</Link>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  panel: { width: '100%', maxWidth: 480, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 30, paddingVertical: 20 },
  compactPanel: { paddingHorizontal: 20, paddingVertical: 18 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: COLORS.primary, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6, marginTop: 10 },
  input: { minHeight: 48, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, paddingHorizontal: 13, paddingVertical: 11, fontSize: 16, color: COLORS.textPrimary },
  roles: { flexDirection: 'row', gap: 10 },
  role: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, borderRadius: 4, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  activeRole: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  roleText: { color: COLORS.textSecondary, fontWeight: '600' },
  activeRoleText: { color: COLORS.primary, fontWeight: '700' },
  error: { color: COLORS.danger, marginTop: 12, textAlign: 'center' },
  actions: { width: '100%', marginTop: 20, alignItems: 'center' },
  loader: { marginVertical: 10 },
  link: { color: COLORS.primary, textAlign: 'center', fontWeight: '600', paddingVertical: 10 },
});
