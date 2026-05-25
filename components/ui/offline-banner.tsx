/**
 * OfflineBanner — shown at the top of the screen when there's no connection.
 * Slides in/out smoothly with Reanimated.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../../hooks/use-network';

export function OfflineBanner() {
  const { isOnline } = useNetwork();
  const insets       = useSafeAreaInsets();

  const translateY = useSharedValue(-80);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    if (!isOnline) {
      translateY.value = withSpring(0, { damping: 16, stiffness: 120 });
      opacity.value    = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(-80, { damping: 16, stiffness: 120 });
      opacity.value    = withTiming(0, { duration: 200 });
    }
  }, [isOnline]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        animStyle,
        { paddingTop: insets.top + 6 },
      ]}
      pointerEvents="none"
    >
      <View style={styles.pill}>
        <Ionicons name="cloud-offline-outline" size={15} color="#fff" />
        <Text style={styles.text}>Sin conexión  ·  mostrando datos guardados</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    zIndex:         999,
    alignItems:     'center',
    paddingBottom:  10,
  },
  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             7,
    backgroundColor: '#374151',   // gray-700 — neutral, not alarming
    paddingHorizontal: 18,
    paddingVertical:   9,
    borderRadius:    100,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.18,
    shadowRadius:    8,
    elevation:       6,
  },
  text: {
    color:      '#f9fafb',
    fontSize:   12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
