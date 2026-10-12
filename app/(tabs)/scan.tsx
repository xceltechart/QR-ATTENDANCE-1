import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import ScreenWatermark from '@/components/ScreenWatermark';
import { COLORS } from '@/constants/colors';
import { registerAttendance } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getProfile, type ProfileRole } from '@/lib/profiles';

export default function ScanScreen() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [scanned, setScanned] = useState(false);
  const [lastData, setLastData] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (user) getProfile(user.id).then((profile) => active && setRole(profile?.role ?? 'student'));
    return () => { active = false; };
  }, [user]));

  if (!role) return <CenteredMessage title="Checking your account..." />;
  if (role !== 'student') return <CenteredMessage title="Students Only" subtitle="QR attendance scanning is available to student accounts." />;
  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) return <View style={styles.container}><ScreenWatermark /><Text style={styles.title}>Camera Permission Needed</Text><Text style={styles.subtitle}>We need access to your camera to scan QR codes.</Text><AppButton theme="primary" title="Grant Permission" icon="camera-alt" onPress={requestPermission} /></View>;

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    setLastData(data);
    const result = await registerAttendance(data);
    setMessage(result.message);
    setSuccess(result.success);
  };

  return <View style={styles.container}><CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned ? undefined : handleBarcodeScanned} /><View style={styles.overlay}><Text style={styles.overlayText}>{scanned ? 'QR Code detected!' : 'Point your camera at a QR code'}</Text>{message && <Text style={[styles.result, { color: success ? COLORS.success : COLORS.danger }]}>{message}</Text>}{lastData && <Text style={styles.data} numberOfLines={3}>{lastData}</Text>}{scanned && <AppButton theme="primary" title="Scan Again" icon="refresh" onPress={() => { setScanned(false); setLastData(null); setMessage(null); }} />}</View></View>;
}

function CenteredMessage({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={styles.container}><ScreenWatermark /><Text style={styles.title}>{title}</Text>{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  camera: StyleSheet.absoluteFillObject,
  title: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  overlay: { position: 'absolute', left: 20, right: 20, bottom: 60, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 16, alignItems: 'center', maxWidth: 520, alignSelf: 'center' },
  overlayText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6, textAlign: 'center' },
  result: { fontSize: 14, textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  data: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 12 },
});
