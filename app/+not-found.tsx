import { View, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';

import { COLORS } from '@/constants/colors';
import ScreenWatermark from '@/components/ScreenWatermark';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops! Not Found' }} />
      <View style={styles.container}>
        <ScreenWatermark />
        <Link href="/" style={styles.button}>
          Go back to Home screen!
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  button: { fontSize: 16, textDecorationLine: 'underline', color: COLORS.primary },
});
