import { createElement, useCallback, useState, type ChangeEvent } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  Platform,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import PickerField from '@/components/PickerField';
import ScreenWatermark from '@/components/ScreenWatermark';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  createEvent,
  getAllEvents,
  getEventsByTeacher,
  setEventStatus,
  updateEvent,
  type CloudEvent,
} from '@/lib/events';
import { getProfile, type ProfileRole } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';

const isAndroid = Platform.OS === 'android';
const isWeb = Platform.OS === 'web';

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function toWebPickerValue(date: Date, mode: 'date' | 'time') {
  const pad = (value: number) => String(value).padStart(2, '0');
  return mode === 'date'
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toSheetInputValue(date: Date, part: 'date' | 'time') {
  const pad = (value: number) => String(value).padStart(2, '0');
  return part === 'date'
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseSheetInput(text: string, part: 'date' | 'time', base: Date): Date | null {
  if (part === 'date') {
    const match = /^\s*(\d{1,4})[-/.]\s*(\d{1,2})[-/.]\s*(\d{1,2})\s*$/.exec(text);
    if (!match) return null;
    const year = Math.max(2000, Math.min(2100, Number(match[1])));
    const month = Math.max(1, Math.min(12, Number(match[2])));
    const day = Math.max(1, Math.min(31, Number(match[3])));
    const next = new Date(base);
    next.setFullYear(year, month - 1, day);
    next.setSeconds(0, 0);
    return next;
  }
  const match = /^\s*(\d{1,2})[:.]\s*(\d{1,2})\s*$/.exec(text);
  if (!match) return null;
  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export default function TeacherScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );
  const [editTarget, setEditTarget] = useState<'start' | 'end' | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [pickerDraft, setPickerDraft] = useState(() => new Date());
  const [payload, setPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [events, setEvents] = useState<CloudEvent[]>([]);

  const loadEvents = useCallback(
    async (currentRole: ProfileRole) => {
      if (!user) return;
      const list =
        currentRole === 'admin'
          ? await getAllEvents()
          : await getEventsByTeacher(user.id);
      setEvents(list);
    },
    [user]
  );

  useFocusEffect(useCallback(() => {
    let active = true;
    if (user)
      getProfile(user.id).then((profile) => {
        if (!active) return;
        const nextRole = profile?.role ?? 'student';
        setRole(nextRole);
        void loadEvents(nextRole);
      });
    return () => { active = false; };
  }, [user, loadEvents]));

  const openPicker = (target: 'start' | 'end', part: 'date' | 'time') => {
    setPickerDraft(new Date(target === 'start' ? startDate : endDate));
    setEditTarget(target);
    setEditingPart(part);
  };

  const applyPickerValue = (selected: Date) => {
    if (!editTarget) return;
    const current = editTarget === 'start' ? startDate : endDate;
    const updated = editingPart === 'date'
      ? new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), current.getHours(), current.getMinutes())
      : new Date(current.getFullYear(), current.getMonth(), current.getDate(), selected.getHours(), selected.getMinutes());
    if (editTarget === 'start') setStartDate(updated);
    else setEndDate(updated);
  };

  const onWebPickerChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!editTarget || !event.currentTarget.value) return;
    const updated = new Date(pickerDraft);
    if (editingPart === 'date') {
      const [year, month, day] = event.currentTarget.value.split('-').map(Number);
      updated.setFullYear(year, month - 1, day);
    } else {
      const [hours, minutes] = event.currentTarget.value.split(':').map(Number);
      updated.setHours(hours, minutes, 0, 0);
    }
    setPickerDraft(updated);
  };

  const confirmPicker = () => {
    applyPickerValue(pickerDraft);
    setEditTarget(null);
  };

  const handleSaveEvent = async () => {
    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: toLocalISO(startDate),
      end: toLocalISO(endDate),
      venue: venue.trim(),
      description: description.trim(),
    };

    if (!event.eventId || !event.title) {
      setMessage('Event name and code are required.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('Start time must be before end time.');
      return;
    }

    const result = editingId
      ? await updateEvent(editingId, event)
      : await createEvent(event);

    if (result.error) {
      setMessage(result.error.message);
      setPayload(null);
      return;
    }
    setMessage(
      editingId
        ? 'Event updated! The QR code below reflects the latest details.'
        : 'Event saved! Students can now scan this QR code.'
    );
    setPayload(buildQRPayload(event));
    resetForm();
    if (role) void loadEvents(role);
  };

  const resetForm = () => {
    setTitle('');
    setEventId('');
    setVenue('');
    setDescription('');
    setEditingId(null);
  };

  const startEditEvent = (event: CloudEvent) => {
    setEditingId(event.id);
    setTitle(event.title);
    setEventId(event.event_code);
    setVenue(event.venue ?? '');
    setDescription(event.description ?? '');
    if (event.start_time) setStartDate(new Date(event.start_time));
    if (event.end_time) setEndDate(new Date(event.end_time));
    setPayload(null);
    setMessage(`Editing "${event.title}".`);
  };

  const handleToggleStatus = async (event: CloudEvent) => {
    const next = event.status === 'open' ? 'closed' : 'open';
    const { error } = await setEventStatus(event.id, next);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(
      next === 'closed'
        ? `"${event.title}" is now closed. Attendance is blocked.`
        : `"${event.title}" is open again.`
    );
    if (role) void loadEvents(role);
  };

  const generateQR = (event: CloudEvent) => {
    setPayload(
      buildQRPayload({
        eventId: event.event_code,
        title: event.title,
        start: event.start_time ?? '',
        end: event.end_time ?? '',
      })
    );
    setMessage(`QR code ready for "${event.title}".`);
  };

  const setEndOffset = (minutes: number) => {
    setEndDate(new Date(startDate.getTime() + minutes * 60 * 1000));
  };

  if (!role) {
    return (
      <View style={styles.gate}>
        <ScreenWatermark />
        <Text style={styles.title}>Checking your account...</Text>
        <Text style={styles.subtitle}>If this message does not clear, try reopening the app or check your connection.</Text>
      </View>
    );
  }

  if (role !== 'teacher' && role !== 'admin') {
    return (
      <View style={styles.gate}>
        <ScreenWatermark />
        <Text style={styles.title}>Teachers Only</Text>
        <Text style={styles.subtitle}>
          Your account is currently set to Student. Event management requires a
          Teacher or Administrator account — ask an administrator to upgrade
          your account.
        </Text>
        <AppButton
          theme="primary"
          title="Open Profile"
          icon="person"
          onPress={() => router.push('/profile')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenWatermark />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={styles.title}>{editingId ? 'Edit Event' : 'Create Event QR'}</Text>
      <Text style={styles.subtitle}>
        Fill in the event details, then scan the generated QR with the Scan tab.
      </Text>

      <Text style={styles.label}>Event Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Founders Day Assembly"
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Event Code</Text>
      <TextInput
        style={styles.input}
        value={eventId}
        onChangeText={setEventId}
        placeholder="e.g. EVT-2026-0002"
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Venue</Text>
      <TextInput
        style={styles.input}
        value={venue}
        onChangeText={setVenue}
        placeholder="e.g. School Gymnasium"
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.descriptionInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="What is this event about?"
        placeholderTextColor={COLORS.textSecondary}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <Text style={styles.label}>Start</Text>
      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeColumn}>
          <Text style={styles.pickerLabel}>Date</Text>
          <PickerField value={formatDate(startDate)} icon="date-range" label="Choose start date" onPress={() => openPicker('start', 'date')} />
        </View>
        <View style={styles.dateTimeColumn}>
          <Text style={styles.pickerLabel}>Time</Text>
          <PickerField value={formatTime(startDate)} icon="schedule" label="Choose start time" onPress={() => openPicker('start', 'time')} />
        </View>
      </View>

      <Text style={styles.label}>Ends</Text>
      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeColumn}>
          <Text style={styles.pickerLabel}>Date</Text>
          <PickerField value={formatDate(endDate)} icon="date-range" label="Choose end date" onPress={() => openPicker('end', 'date')} />
        </View>
        <View style={styles.dateTimeColumn}>
          <Text style={styles.pickerLabel}>Time</Text>
          <PickerField value={formatTime(endDate)} icon="schedule" label="Choose end time" onPress={() => openPicker('end', 'time')} />
        </View>
      </View>

      <View style={styles.chipRow}>
        <Text style={styles.chipLabel}>Quick add:</Text>
        <PressableChip label="+30 min" onPress={() => setEndOffset(30)} />
        <PressableChip label="+1 hour" onPress={() => setEndOffset(60)} />
        <PressableChip label="+2 hours" onPress={() => setEndOffset(120)} />
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={!!editTarget}
        onRequestClose={() => setEditTarget(null)}
      >
        <View style={styles.modalScrim}>
          <View accessibilityViewIsModal style={styles.pickerSheet}>
            <Text style={styles.pickerSheetTitle}>
              Choose {editTarget} {editingPart}
            </Text>
            <Text style={styles.pickerSheetValue}>
              {editingPart === 'date' ? formatDate(pickerDraft) : formatTime(pickerDraft)}
            </Text>
            {isWeb ? createElement('input', {
              'aria-label': `Choose ${editTarget} ${editingPart}`,
              type: editingPart,
              value: toWebPickerValue(pickerDraft, editingPart),
              onChange: onWebPickerChange,
              style: {
                width: '100%',
                minHeight: 48,
                boxSizing: 'border-box',
                border: `1px solid ${COLORS.border}`,
                borderRadius: 4,
                backgroundColor: COLORS.card,
                color: '#000000',
                fontFamily: 'inherit',
                fontSize: 16,
                padding: '10px 14px',
              },
            }) : (
              <TextInput
                accessibilityLabel={`Choose ${editTarget} ${editingPart}`}
                value={toSheetInputValue(pickerDraft, editingPart)}
                onChangeText={(text) => {
                  const next = parseSheetInput(text, editingPart, pickerDraft);
                  if (next) setPickerDraft(next);
                }}
                inputMode="numeric"
                keyboardType={isAndroid ? 'numeric' : 'number-pad'}
                placeholder={editingPart === 'date' ? 'YYYY-MM-DD' : 'HH:MM'}
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
              />
            )}
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditTarget(null)}
                style={({ pressed }) => [styles.modalButton, pressed && styles.modalButtonPressed]}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={confirmPicker}
                style={({ pressed }) => [styles.modalButton, styles.modalButtonPrimary, pressed && styles.modalButtonPressed]}
              >
                <Text style={styles.modalButtonPrimaryText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {message && <Text style={styles.message}>{message}</Text>}

      <AppButton
        theme="primary"
        title={editingId ? 'Save Changes' : 'Create Event'}
        icon={editingId ? 'save' : 'add-circle'}
        onPress={handleSaveEvent}
      />
      {editingId && (
        <AppButton
          title="Cancel Editing"
          icon="close"
          onPress={() => {
            resetForm();
            setMessage(null);
          }}
        />
      )}

      {payload && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            Scan this QR code with the Scan tab:
          </Text>
          <View style={styles.qrBox}>
            <QRCode value={payload} size={200} />
          </View>
          <Text style={styles.payloadText}>{payload}</Text>
        </View>
      )}

      <Text style={[styles.title, styles.listTitle]}>Manage Events</Text>
      <Text style={styles.subtitle}>
        {events.length === 0
          ? 'No events yet — create your first event above.'
          : 'Edit details, generate QR codes, or close an event to stop attendance.'}
      </Text>

      {events.map((event) => (
        <View key={event.id} style={styles.eventCard}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <View
              style={[
                styles.statusBadge,
                event.status === 'closed' && styles.statusBadgeClosed,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  event.status === 'closed' && styles.statusBadgeTextClosed,
                ]}
              >
                {event.status === 'closed' ? 'CLOSED' : 'OPEN'}
              </Text>
            </View>
          </View>
          <Text style={styles.eventMeta}>Code: {event.event_code}</Text>
          {!!event.venue && <Text style={styles.eventMeta}>Venue: {event.venue}</Text>}
          {!!event.description && (
            <Text style={styles.eventMeta}>Description: {event.description}</Text>
          )}
          <Text style={styles.eventMeta}>
            {event.start_time ? formatDate(new Date(event.start_time)) : '—'}{' '}
            {event.start_time ? formatTime(new Date(event.start_time)) : ''} →{' '}
            {event.end_time ? formatDate(new Date(event.end_time)) : '—'}{' '}
            {event.end_time ? formatTime(new Date(event.end_time)) : ''}
          </Text>
          <View style={styles.eventActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => startEditEvent(event)}
              style={({ pressed }) => [styles.eventButton, pressed && styles.modalButtonPressed]}
            >
              <Text style={styles.eventButtonText}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => generateQR(event)}
              style={({ pressed }) => [styles.eventButton, pressed && styles.modalButtonPressed]}
            >
              <Text style={styles.eventButtonText}>QR Code</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleToggleStatus(event)}
              style={({ pressed }) => [
                styles.eventButton,
                event.status === 'open' && styles.eventButtonDanger,
                pressed && styles.modalButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.eventButtonText,
                  event.status === 'open' && styles.eventButtonTextDanger,
                ]}
              >
                {event.status === 'open' ? 'Close' : 'Reopen'}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
      </ScrollView>
    </View>
  );
}

function PressableChip({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.chip}
      onPress={onPress}
      android_ripple={{ color: COLORS.surface }}
      accessibilityRole="button"
      accessibilityLabel={`Set event duration to ${label.replace('+', '')}`}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: { flex: 1, backgroundColor: 'transparent' },
  gate: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 104,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.elevated,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  dateTimeRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dateTimeColumn: { flexGrow: 1, flexBasis: 240, minWidth: 0 },
  pickerLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  modalScrim: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: 20 },
  pickerSheet: { width: '100%', maxWidth: 430, backgroundColor: COLORS.elevated, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, padding: 20 },
  pickerSheetTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700', textTransform: 'capitalize' },
  pickerSheetValue: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 12 },
  iosPicker: { width: '100%' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  modalButton: { minWidth: 96, minHeight: 46, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  modalButtonPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modalButtonPressed: { opacity: 0.7 },
  modalButtonText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '700' },
  modalButtonPrimaryText: { color: COLORS.textOnPrimary, fontSize: 15, fontWeight: '700' },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  chipLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    paddingHorizontal: 12,
    minHeight: 44,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  message: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 12,
  },
  resultCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  payloadText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  descriptionInput: {
    minHeight: 84,
    paddingTop: 12,
  },
  listTitle: {
    marginTop: 30,
    marginBottom: 0,
  },
  eventCard: {
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 16,
    marginBottom: 14,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  eventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statusBadge: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeClosed: {
    backgroundColor: COLORS.surface,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.success,
    letterSpacing: 0.5,
  },
  statusBadgeTextClosed: {
    color: COLORS.danger,
  },
  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  eventActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  eventButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  eventButtonDanger: {
    borderColor: COLORS.danger,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  eventButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  eventButtonTextDanger: {
    color: COLORS.danger,
  },
});
