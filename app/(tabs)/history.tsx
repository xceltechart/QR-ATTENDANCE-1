import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import ScreenWatermark from '@/components/ScreenWatermark';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  subscribeToAttendance,
  type AttendanceRecord,
  type AttendanceStatus,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getProfile, type ProfileRole } from '@/lib/profiles';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<ProfileRole>('student');
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const profileRole = (await getProfile(user.id))?.role ?? 'student';
    setRole(profileRole);
    if (profileRole === 'teacher' || profileRole === 'admin') {
      setTeacherEvents(await getTeacherEventAttendance(user.id));
    } else {
      setStudentRecords(await getAttendanceHistory(user.id));
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
      // Realtime: attendance updates live without switching tabs.
      return subscribeToAttendance(() => void load());
    }, [load])
  );

  const isStaff = role === 'teacher' || role === 'admin';
  const empty = isStaff ? teacherEvents.length === 0 : studentRecords.length === 0;
  return <View style={styles.container}><ScreenWatermark /><ScrollView style={styles.scrollView} contentContainerStyle={styles.content}><Text style={styles.title}>{isStaff ? 'Event Attendance' : 'Attendance History'}</Text><Text style={styles.subtitle}>{isStaff ? 'Attendance for events you created. Updates in real time.' : 'Your past attendance records.'}</Text>{loading ? <Text style={styles.center}>Loading...</Text> : empty ? <Text style={styles.center}>No attendance records yet.</Text> : isStaff ? teacherEvents.map((event) => <TeacherCard key={event.eventId} event={event} />) : studentRecords.map((record) => <StudentCard key={record.id} record={record} />)}</ScrollView></View>;
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const color =
    status === 'present' ? COLORS.success : status === 'late' ? COLORS.warning : COLORS.danger;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

function StudentCard({ record }: { record: AttendanceRecord }) {
  return <View style={styles.card}><View style={styles.cardHeader}><Text style={styles.cardTitle}>{record.eventTitle}</Text><StatusBadge status={record.status} /></View><Text style={styles.meta}>Event: {record.eventId}</Text><Text style={styles.meta}>Scanned: {new Date(record.scannedAt).toLocaleString()}</Text></View>;
}

function TeacherCard({ event }: { event: TeacherEventAttendance }) {
  return <View style={styles.card}><View style={styles.cardHeader}><View style={styles.grow}><Text style={styles.cardTitle}>{event.title}</Text><Text style={styles.meta}>{event.eventCode}</Text></View><Text style={styles.count}>{event.attendees.length}</Text></View>{event.attendees.length === 0 ? <Text style={styles.meta}>No attendees yet.</Text> : event.attendees.map((attendee) => <View key={`${attendee.studentId}-${attendee.scannedAt}`} style={styles.attendee}><View style={styles.attendeeHeader}><Text style={styles.attendeeName}>{attendee.studentName || `Student …${attendee.studentId.slice(-8)}`}</Text><StatusBadge status={attendee.status} /></View><Text style={styles.meta}>{new Date(attendee.scannedAt).toLocaleString()}</Text></View>)}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1, backgroundColor: 'transparent' },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 32, paddingBottom: 104 },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 5 },
  subtitle: { fontSize: 14, lineHeight: 20, color: COLORS.textSecondary, marginBottom: 20 },
  center: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 28 },
  card: { backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 18, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  grow: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  count: { backgroundColor: COLORS.primarySoft, color: COLORS.primary, fontWeight: '700', minWidth: 34, textAlign: 'center', padding: 8, borderRadius: 4 },
  attendee: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 10 },
  attendeeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  attendeeName: { flex: 1, color: COLORS.textPrimary, fontWeight: '600' },
  badge: { borderWidth: 1, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
