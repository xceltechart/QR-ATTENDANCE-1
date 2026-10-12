import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  value: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  label?: string;
};

export default function PickerField({ value, icon, onPress, label }: Props) {
  return (
    <View style={styles.fieldOuter}>
      <Pressable accessibilityLabel={label} accessibilityRole="button" style={styles.fieldInner} onPress={onPress}>
        <MaterialIcons
          name={icon}
          size={22}
          color={COLORS.primary}
          style={styles.icon}
        />
        <Text style={styles.value}>{value}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldOuter: {
    width: '100%',
    marginBottom: 14,
  },
  fieldInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  icon: { paddingRight: 10 },
  value: {
    fontSize: 16,
    color: COLORS.textPrimary,
    flex: 1,
  },
});
