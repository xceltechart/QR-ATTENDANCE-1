import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import ScreenWatermark from '@/components/ScreenWatermark';
import { COLORS } from '@/constants/colors';
import { getAvailableEvents, subscribeToEvents, type CloudEvent } from '@/lib/events';

export default function Index() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const loadEvents = useCallback(async () => {
    const list = await getAvailableEvents();
    setEvents(list);
    setLoadingEvents(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
      // Realtime: students see new/closed events without refreshing.
      return subscribeToEvents(() => void loadEvents());
    }, [loadEvents])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenWatermark />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          desktop && styles.desktopScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.layout, desktop && styles.desktopLayout]}>
          <View style={[styles.hero, desktop && styles.desktopHero]}>
            <View style={styles.brandRow}>
              <View style={styles.logoCircle}>
                <MaterialIcons name="school" size={27} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.brandName}>QR Attendance</Text>
                <Text style={styles.brandMeta}>SCHOOL CHECK-IN</Text>
              </View>
            </View>

            <Text style={[styles.heroTitle, desktop && styles.desktopHeroTitle]}>
              Attendance, made clear.
            </Text>
            <Text style={styles.heroText}>
              Find school events, check in with a QR code, and keep your
              attendance record close at hand.
            </Text>

            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Your school attendance workspace</Text>
            </View>
          </View>

          <View style={[styles.actionCard, desktop && styles.desktopActionCard]}>
            <Text style={styles.actionEyebrow}>GET STARTED</Text>
            <Text style={styles.actionTitle}>Your next step</Text>
            <Text style={styles.actionText}>
              Scan an event code or review your recent attendance.
            </Text>

            <AppButton
              theme="primary"
              title="Scan QR Code"
              icon="qr-code-scanner"
              onPress={() => router.push('/scan')}
            />
            <AppButton
              title="Attendance History"
              icon="history"
              onPress={() => router.push('/history')}
            />
            <AppButton
              title="View Profile"
              icon="person"
              onPress={() => router.push('/profile')}
            />
          </View>
        </View>

        <View style={styles.eventsSection}>
          <Text style={styles.eventsEyebrow}>AVAILABLE EVENTS</Text>
          <Text style={styles.eventsTitle}>Open for attendance</Text>
          {loadingEvents ? (
            <View style={styles.eventsState}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.eventsStateText}>Loading events…</Text>
            </View>
          ) : events.length === 0 ? (
            <View style={styles.eventsState}>
              <MaterialIcons name="event-busy" size={30} color={COLORS.textSecondary} />
              <Text style={styles.eventsStateText}>
                No open events yet. Check back when your teacher announces one.
              </Text>
            </View>
          ) : (
            events.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventCardHeader}>
                  <Text style={styles.eventCardTitle}>{event.title}</Text>
                  <View style={styles.eventCodeBadge}>
                    <Text style={styles.eventCodeText}>{event.event_code}</Text>
                  </View>
                </View>
                {!!event.venue && (
                  <View style={styles.eventMetaRow}>
                    <MaterialIcons name="place" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.eventCardMeta}>{event.venue}</Text>
                  </View>
                )}
                {!!event.description && (
                  <Text style={styles.eventCardMeta}>{event.description}</Text>
                )}
                <View style={styles.eventMetaRow}>
                  <MaterialIcons name="schedule" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.eventCardMeta}>
                  {event.start_time
                    ? new Date(event.start_time).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'TBA'}
                  {event.end_time
                    ? ` – ${new Date(event.end_time).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : ''}
                  </Text>
                </View>
                <AppButton
                  theme="primary"
                  title="Scan Into This Event"
                  icon="qr-code-scanner"
                  onPress={() => router.push('/scan')}
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { backgroundColor: 'transparent' },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 104,
  },
  desktopScrollContent: { paddingHorizontal: 40, paddingTop: 40, paddingBottom: 104 },
  layout: { width: '100%', maxWidth: 1040, alignSelf: 'center', gap: 20 },
  desktopLayout: { flexDirection: 'row', alignItems: 'stretch', gap: 24 },
  hero: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 6,
    padding: 24,
  },
  desktopHero: { flex: 1, minHeight: 360, padding: 36, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 42 },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: COLORS.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  brandName: { fontSize: 17, fontWeight: '700', color: COLORS.textOnPrimary },
  brandMeta: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, color: COLORS.onPrimaryMuted, marginTop: 3 },
  heroTitle: { fontSize: 32, lineHeight: 39, fontWeight: '700', color: COLORS.textOnPrimary, maxWidth: 540 },
  desktopHeroTitle: { fontSize: 40, lineHeight: 47 },
  heroText: { fontSize: 16, lineHeight: 24, color: COLORS.onPrimarySoft, maxWidth: 500, marginTop: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 28 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.successLight, marginRight: 9 },
  statusText: { fontSize: 13, fontWeight: '600', color: COLORS.onPrimarySoft },
  actionCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 24,
  },
  desktopActionCard: { width: 360, justifyContent: 'center', padding: 28 },
  actionEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: COLORS.primary, marginBottom: 8 },
  actionTitle: { fontSize: 23, lineHeight: 29, fontWeight: '700', color: COLORS.textPrimary },
  actionText: { fontSize: 14, lineHeight: 21, color: COLORS.textSecondary, marginTop: 6, marginBottom: 20 },
  eventsSection: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 20,
  },
  eventsEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: COLORS.primary },
  eventsTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginTop: 5, marginBottom: 14 },
  eventsState: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  eventsStateText: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  eventCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
  },
  eventCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  eventCardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  eventCodeBadge: { backgroundColor: COLORS.accent, borderRadius: 3, paddingHorizontal: 8, paddingVertical: 4 },
  eventCodeText: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary },
  eventCardMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6, lineHeight: 18 },
  eventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
