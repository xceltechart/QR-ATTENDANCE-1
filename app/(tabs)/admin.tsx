import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  deleteAttendance,
  getAllAttendance,
  subscribeToAttendance,
  updateAttendanceStatus,
  type AttendanceStatus,
  type SystemAttendanceRecord,
} from '@/lib/attendance';
import { getAllEvents, subscribeToEvents, type CloudEvent } from '@/lib/events';
import { getAllProfiles, setUserRole, type Profile, type ProfileRole } from '@/lib/profiles';

const ROLE_OPTIONS: ProfileRole[] = ['student', 'teacher', 'admin'];
const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'late', 'absent'];

export default function AdminScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [records, setRecords] = useState<SystemAttendanceRecord[]>([]);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [profileList, attendanceList, eventList] = await Promise.all([
      getAllProfiles(),
      getAllAttendance(),
      getAllEvents(),
    ]);
    setProfiles(profileList);
    setRecords(attendanceList);
    setEvents(eventList);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAll();
      const unsubscribeAttendance = subscribeToAttendance(() => void loadAll());
      const unsubscribeEvents = subscribeToEvents(() => void loadAll());
      return () => {
        unsubscribeAttendance();
        unsubscribeEvents();
      };
    }, [loadAll])
  );

  const handleChangeRole = async (profile: Profile, role: ProfileRole) => {
    if (profile.id === user?.id) {
      setMessage('You cannot change your own role.');
      return;
    }
    setBusyId(profile.id);
    const { error } = await setUserRole(profile.id, role);
    setBusyId(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`${profile.full_name ?? profile.email} is now ${role}.`);
    await loadAll();
  };

  const handleChangeStatus = async (record: SystemAttendanceRecord, status: AttendanceStatus) => {
    setBusyId(record.id);
    const { error } = await updateAttendanceStatus(record.id, status);
    setBusyId(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Record updated to "${status}".`);
    await loadAll();
  };

  const handleDelete = async (record: SystemAttendanceRecord) => {
    setBusyId(record.id);
    const { error } = await deleteAttendance(record.id);
    setBusyId(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Attendance record removed.');
    await loadAll();
  };

  if (loading) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading system records…</Text>
      </View>
    );
  }

  const presentCount = records.filter((r) => r.status === 'present').length;
  const lateCount = records.filter((r) => r.status === 'late').length;
  const absentCount = records.filter((r) => r.status === 'absent').length;
  const studentCount = profiles.filter((profile) => profile.role === 'student').length;
  const teacherCount = profiles.filter((profile) => profile.role === 'teacher').length;
  const adminCount = profiles.filter((profile) => profile.role === 'admin').length;
  const openEventCount = events.filter((event) => event.status === 'open').length;
  const closedEventCount = events.filter((event) => event.status === 'closed').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>ADMINISTRATION</Text>
      <Text style={styles.title}>System overview</Text>
      <Text style={styles.subtitle}>
        Manage users, review attendance, and correct records.
      </Text>

      <Text style={styles.sectionTitle}>System Reports</Text>
      <Text style={styles.sectionHint}>
        Live totals across all users, events, and attendance records.
      </Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profiles.length}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{studentCount}</Text>
          <Text style={styles.statLabel}>Students</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{teacherCount}</Text>
          <Text style={styles.statLabel}>Teachers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{adminCount}</Text>
          <Text style={styles.statLabel}>Admins</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{events.length}</Text>
          <Text style={styles.statLabel}>Total Events</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{openEventCount}</Text>
          <Text style={styles.statLabel}>Open Events</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.danger }]}>{closedEventCount}</Text>
          <Text style={styles.statLabel}>Closed Events</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{records.length}</Text>
          <Text style={styles.statLabel}>Attendance Records</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{presentCount}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.warning }]}>{lateCount}</Text>
          <Text style={styles.statLabel}>Late</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.danger }]}>{absentCount}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
      </View>

      {!!message && <Text style={styles.message}>{message}</Text>}

      <Text style={styles.sectionTitle}>Manage Users</Text>
      <Text style={styles.sectionHint}>
        Grant Teacher or Administrator access. Only admins can change roles.
      </Text>
      {profiles.length === 0 ? (
        <Text style={styles.empty}>No user accounts found.</Text>
      ) : (
        profiles.map((profile) => (
          <View key={profile.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {profile.full_name ?? 'No name set'}
              {profile.id === user?.id ? ' (you)' : ''}
            </Text>
            <Text style={styles.cardMeta}>{profile.email}</Text>
            <View style={styles.chipRow}>
              {ROLE_OPTIONS.map((role) => {
                const active = profile.role === role;
                return (
                  <Pressable
                    key={role}
                    accessibilityRole="button"
                    accessibilityLabel={`Set ${profile.email} role to ${role}`}
                    disabled={busyId === profile.id || profile.id === user?.id}
                    onPress={() => void handleChangeRole(profile, role)}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.chipPressed,
                      (busyId === profile.id || profile.id === user?.id) && styles.chipDisabled,
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'Student'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Attendance Records</Text>
      <Text style={styles.sectionHint}>
        View overall attendance and correct or remove invalid records.
      </Text>
      {records.length === 0 ? (
        <Text style={styles.empty}>No attendance records yet.</Text>
      ) : (
        records.map((record) => (
          <View key={record.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {record.studentName ?? record.studentEmail ?? 'Unknown student'}
            </Text>
            <Text style={styles.cardMeta}>
              {record.eventTitle} ({record.eventCode})
            </Text>
            <Text style={styles.cardMeta}>{new Date(record.scannedAt).toLocaleString()}</Text>
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((status) => {
                const active = record.status === status;
                return (
                  <Pressable
                    key={status}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark as ${status}`}
                    disabled={busyId === record.id}
                    onPress={() => void handleChangeStatus(record, status)}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.chipPressed,
                      busyId === record.id && styles.chipDisabled,
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {status === 'present' ? 'Present' : status === 'late' ? 'Late' : 'Absent'}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete record"
                disabled={busyId === record.id}
                onPress={() => void handleDelete(record)}
                style={({ pressed }) => [styles.chip, styles.chipDanger, pressed && styles.chipPressed]}
              >
                <Text style={[styles.chipText, styles.chipTextDanger]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 104,
  },
  gate: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: 15 },
  eyebrow: { color: COLORS.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '700', marginTop: 8 },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 4,
  },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  statCard: {
    flexGrow: 1,
    flexBasis: 130,
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 16,
    alignItems: 'flex-start',
  },
  statValue: { color: COLORS.primary, fontSize: 25, fontWeight: '700' },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  message: { color: COLORS.success, fontSize: 14, marginTop: 16, textAlign: 'center' },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 30,
    marginBottom: 4,
  },
  sectionHint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginVertical: 18 },
  card: {
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: COLORS.textSecondary, fontSize: 13, marginTop: 3, lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  chipDanger: { borderColor: COLORS.danger, backgroundColor: 'rgba(255, 107, 107, 0.1)' },
  chipPressed: { opacity: 0.6 },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary },
  chipTextDanger: { color: COLORS.danger },
});
