import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

export default function ScreenWatermark() {
  const { width, height } = useWindowDimensions();
  const size = Math.max(280, width * 0.92);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.watermark,
        {
          width: size,
          height: size,
          top: height * 0.34 - size * 0.5,
          right: -size * 0.45,
        },
      ]}
    >
      <Image
        accessible={false}
        resizeMode="contain"
        source={require('../assets/images/college-seal-watermark.png')}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  watermark: {
    position: 'absolute',
    zIndex: 1,
    opacity: 0.11,
  },
});
