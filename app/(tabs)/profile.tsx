import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import ScreenWatermark from '@/components/ScreenWatermark';
import { signOut, useAuth } from '@/lib/auth';
import { getProfile, Profile, updateProfile } from '@/lib/profiles';

type ProfileActionProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  muted?: boolean;
};

function ProfileAction({ icon, label, onPress, disabled, muted }: ProfileActionProps) {
  const color = muted ? COLORS.textSecondary : COLORS.primary;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.profileAction,
        pressed && styles.profileActionPressed,
        disabled && styles.profileActionDisabled,
      ]}
    >
      {disabled ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <MaterialIcons color={color} name={icon} size={21} />
      )}
      <Text style={[styles.profileActionLabel, muted && styles.profileActionLabelMuted]}>{label}</Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadProfile = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    const nextProfile = await getProfile(session.user.id);
    setProfile(nextProfile);
    setFullName(nextProfile?.full_name ?? '');
    setMessage(nextProfile ? '' : 'Unable to load your profile.');
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  async function saveProfile() {
    if (!session?.user.id) return;
    setSaving(true);
    setMessage('');
    const { error } = await updateProfile(session.user.id, {
      full_name: fullName.trim() || null,
    });
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const nextProfile = await getProfile(session.user.id);
    setProfile(nextProfile);
    setEditing(false);
    setMessage('Profile updated.');
  }

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ScreenWatermark />
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  const displayName = profile?.full_name || 'No name set';
  const email = session?.user.email ?? 'No email available';
  const initial = (profile?.full_name || email).trim().charAt(0).toUpperCase() || '?';
  const roleLabel =
    profile?.role === 'teacher'
      ? 'Teacher'
      : profile?.role === 'admin'
        ? 'Administrator'
        : profile?.role === 'student'
          ? 'Student'
          : 'Unavailable';

  return (
    <View style={styles.container}>
      <ScreenWatermark />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.content}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.title}>My profile</Text>
        <Text style={styles.subtitle}>Manage your identity and account details.</Text>

        <View style={[styles.profileCard, isDesktop && styles.profileCardDesktop]}>
          <View style={[styles.identityPanel, isDesktop && styles.identityPanelDesktop]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
            <Text style={styles.identityName}>{displayName}</Text>
            <Text style={styles.identityEmail}>{email}</Text>
          </View>

          <View style={styles.detailsPanel}>
            <Text style={styles.sectionLabel}>PROFILE DETAILS</Text>
            <Text style={styles.sectionTitle}>{editing ? 'Edit your profile' : 'Account information'}</Text>
            <Text style={styles.sectionHint}>
              {editing ? 'Update the name shown across QR Attendance.' : 'Your sign-in and profile information.'}
            </Text>

            {editing ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full name</Text>
                <TextInput
                  accessibilityLabel="Full name"
                  autoCapitalize="words"
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor={COLORS.textSecondary}
                  style={styles.input}
                  value={fullName}
                />
                <Text style={styles.roleFieldLabel}>Account type</Text>
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <MaterialIcons
                      color={COLORS.primary}
                      name={profile?.role === 'admin' ? 'admin-panel-settings' : profile?.role === 'teacher' ? 'badge' : 'school'}
                      size={20}
                    />
                  </View>
                  <View style={styles.detailCopy}>
                    <Text style={styles.detailLabel}>Role (managed by administrators)</Text>
                    <Text style={styles.detailValue}>{roleLabel}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <MaterialIcons color={COLORS.primary} name="person" size={20} />
                </View>
                <View style={styles.detailCopy}>
                  <Text style={styles.detailLabel}>Display name</Text>
                  <Text style={styles.detailValue}>{displayName}</Text>
                </View>
              </View>
            )}

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <MaterialIcons color={COLORS.primary} name="fingerprint" size={20} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>User ID</Text>
                <Text selectable style={styles.detailId}>{session?.user.id}</Text>
              </View>
            </View>

            {!!message && (
              <Text style={[styles.message, message === 'Profile updated.' && styles.successMessage]}>
                {message}
              </Text>
            )}

            <View style={styles.actions}>
              <ProfileAction
                disabled={saving}
                icon={editing ? 'check' : 'edit'}
                label={saving ? 'Saving…' : editing ? 'Save Changes' : 'Edit Profile'}
                onPress={editing ? saveProfile : () => setEditing(true)}
              />
              {editing && (
                <ProfileAction
                  icon="close"
                  label="Cancel"
                  muted
                  onPress={() => {
                    setFullName(profile?.full_name ?? '');
                    setEditing(false);
                    setMessage('');
                  }}
                />
              )}
              <ProfileAction icon="logout" label="Sign Out" muted onPress={signOut} />
            </View>
          </View>
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 104 },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: COLORS.background },
  loadingText: { color: COLORS.textSecondary, fontSize: 15 },
  eyebrow: { color: COLORS.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '700', marginTop: 8 },
  subtitle: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 5, marginBottom: 22 },
  profileCard: {
    width: '100%',
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  profileCardDesktop: { flexDirection: 'row', minHeight: 360 },
  identityPanel: { backgroundColor: COLORS.primarySoft, alignItems: 'center', paddingHorizontal: 28, paddingVertical: 32 },
  identityPanelDesktop: { width: '38%', justifyContent: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.elevated, marginBottom: 14 },
  avatarText: { color: COLORS.primary, fontSize: 30, fontWeight: '700' },
  roleBadge: { backgroundColor: COLORS.elevated, borderRadius: 3, paddingHorizontal: 11, paddingVertical: 6, marginBottom: 14 },
  roleText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  identityName: { color: COLORS.textPrimary, fontSize: 21, lineHeight: 27, fontWeight: '700', textAlign: 'center' },
  identityEmail: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  detailsPanel: { flex: 1, padding: 26 },
  sectionLabel: { color: COLORS.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 21, fontWeight: '700', marginTop: 7 },
  sectionHint: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 5, marginBottom: 24 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.surface, borderRadius: 4, padding: 12, marginBottom: 10 },
  detailIcon: { width: 34, height: 34, borderRadius: 4, backgroundColor: COLORS.elevated, alignItems: 'center', justifyContent: 'center' },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  detailValue: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  detailId: { color: COLORS.textPrimary, fontSize: 12, lineHeight: 18 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  roleFieldLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  input: { width: '100%', minHeight: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, backgroundColor: COLORS.card, color: COLORS.textPrimary, paddingHorizontal: 14, fontSize: 16 },
  roleOptions: { width: '100%', flexDirection: 'row', gap: 10 },
  roleOption: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, backgroundColor: COLORS.card },
  roleOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  roleOptionText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  roleOptionTextActive: { color: COLORS.primary },
  message: { color: COLORS.danger, fontSize: 13, lineHeight: 19, marginTop: 2, marginBottom: 10 },
  successMessage: { color: COLORS.success },
  actions: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 32, rowGap: 8, marginTop: 8 },
  profileAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  profileActionPressed: { opacity: 0.6 },
  profileActionDisabled: { opacity: 0.5 },
  profileActionLabel: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  profileActionLabelMuted: { color: COLORS.textSecondary },
});
