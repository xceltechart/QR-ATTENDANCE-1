import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  theme?: 'primary';
  onPress: () => void;
  disabled?: boolean;
};

export default function AppButton({ title, icon, theme, onPress, disabled }: Props) {
  const primary = theme === 'primary';
  return (
    <View style={[styles.buttonOuter, disabled && styles.disabled]}>
      <Pressable
        style={({ pressed }) => [
          styles.buttonInner,
          primary && styles.primaryButton,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <MaterialIcons
          name={icon}
          size={22}
          color={primary ? COLORS.textOnPrimary : COLORS.textSecondary}
          style={styles.icon}
        />
        <Text style={[styles.label, primary && styles.primaryLabel]}>{title}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonOuter: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    marginBottom: 14,
  },
  buttonInner: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    minHeight: 52,
  },
  primaryButton: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  primaryLabel: { color: COLORS.textOnPrimary },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
  icon: { paddingRight: 10 },
  label: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
});
