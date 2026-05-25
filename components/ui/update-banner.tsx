/**
 * UpdateBanner
 * Appears at the bottom when an OTA update has been downloaded and is ready.
 * Slides up smoothly. The user can apply it now or dismiss.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useOTAUpdate } from '../../hooks/use-ota-update';

export function UpdateBanner() {
  const { updateReady, applying, applyUpdate } = useOTAUpdate();
  const insets = useSafeAreaInsets();

  if (!updateReady) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(1500).springify()}
      exiting={FadeOutDown.duration(250)}
      style={[styles.container, { paddingBottom: insets.bottom + 12 }]}
    >
      <View style={styles.card}>
        {/* Ícono */}
        <View style={styles.iconWrap}>
          <Ionicons name="arrow-up-circle" size={26} color={Colors.primary} />
        </View>

        {/* Texto */}
        <View style={styles.textBlock}>
          <Text style={styles.title}>Nueva versión disponible</Text>
          <Text style={styles.subtitle}>Descargada y lista para instalar</Text>
        </View>

        {/* Botón actualizar */}
        <Pressable
          onPress={applyUpdate}
          disabled={applying}
          style={({ pressed }) => [
            styles.button,
            { opacity: pressed || applying ? 0.75 : 1 },
          ]}
        >
          {applying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Actualizar</Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:   'absolute',
    bottom:     0,
    left:       0,
    right:      0,
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex:     998,
  },
  card: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    backgroundColor: Colors.card,
    borderRadius:   16,
    paddingVertical:   14,
    paddingHorizontal: 16,
    borderWidth:    1,
    borderColor:    Colors.primaryLight,
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: -2 },
    shadowOpacity:  0.08,
    shadowRadius:   12,
    elevation:      8,
  },
  iconWrap: {
    width:  44,
    height: 44,
    borderRadius:    22,
    backgroundColor: Colors.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap:  2,
  },
  title: {
    fontSize:   14,
    fontWeight: '700',
    color:      Colors.text,
  },
  subtitle: {
    fontSize: 12,
    color:    Colors.textMuted,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius:    10,
    paddingHorizontal: 14,
    paddingVertical:   10,
    minWidth: 90,
    alignItems: 'center',
  },
  buttonText: {
    color:      '#fff',
    fontSize:   13,
    fontWeight: '700',
  },
});
