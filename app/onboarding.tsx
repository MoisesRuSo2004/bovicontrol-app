import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');

/* ─── Slides ──────────────────────────────────────────────────────────────── */
const SLIDES = [
  {
    id: '1',
    bg: '#064E3B',
    accent: '#10B981',
    icon: 'cow' as const,
    title: 'Bienvenido a\nBoviControl',
    body: 'La app que todo ganadero necesita para llevar su finca desde la palma de su mano.',
  },
  {
    id: '2',
    bg: '#1C3448',
    accent: '#38BDF8',
    icon: 'clipboard-list-outline' as const,
    title: 'Gestiona\ntu hato',
    body: 'Registra todos tus animales, razas, categorías, genealogía y su historial completo.',
  },
  {
    id: '3',
    bg: '#1E3A5F',
    accent: '#60A5FA',
    icon: 'chart-areaspline' as const,
    title: 'Controla\ntu producción',
    body: 'Lleva el registro diario de leche, pesos y ventas. Genera reportes en segundos.',
  },
  {
    id: '4',
    bg: '#3B1F5E',
    accent: '#A78BFA',
    icon: 'needle' as const,
    title: 'Sanidad\nal día',
    body: 'Vacunas, tratamientos y alertas inteligentes para que tu ganado esté siempre protegido.',
  },
  {
    id: '5',
    bg: '#14532D',
    accent: '#4ADE80',
    icon: 'check-decagram-outline' as const,
    title: '¡Todo listo!\nComencemos',
    body: 'Crea tu cuenta o inicia sesión para empezar a gestionar tu finca ahora mismo.',
    isLast: true,
  },
] as const;

type Slide = (typeof SLIDES)[number];

/* ─── Dot ─────────────────────────────────────────────────────────────────── */
function Dot({ index, scrollX, accent }: { index: number; scrollX: SharedValue<number>; accent: string }) {
  const style = useAnimatedStyle(() => {
    const w = interpolate(
      scrollX.value,
      [(index - 1) * SCREEN_W, index * SCREEN_W, (index + 1) * SCREEN_W],
      [8, 24, 8],
      'clamp',
    );
    const opacity = interpolate(
      scrollX.value,
      [(index - 1) * SCREEN_W, index * SCREEN_W, (index + 1) * SCREEN_W],
      [0.35, 1, 0.35],
      'clamp',
    );
    return { width: w, opacity };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: accent },
        style,
      ]}
    />
  );
}

/* ─── SlideItem ───────────────────────────────────────────────────────────── */
function SlideItem({ item }: { item: Slide }) {
  return (
    <View style={[styles.slide, { backgroundColor: item.bg, width: SCREEN_W }]}>
      {/* Background circles */}
      <View style={[styles.circleLg, { borderColor: item.accent + '22' }]} />
      <View style={[styles.circleSm, { borderColor: item.accent + '33' }]} />

      {/* Icon illustration */}
      <View style={[styles.iconWrap, { backgroundColor: item.accent + '1A', borderColor: item.accent + '44' }]}>
        <MaterialCommunityIcons name={item.icon} size={80} color={item.accent} />
      </View>

      {/* Text */}
      <Text style={[styles.title, { color: item.accent }]}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
    </View>
  );
}

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useSharedValue(0);

  const currentSlide = SLIDES[activeIndex];

  /* track visible item */
  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setActiveIndex(Number(viewableItems[0].index ?? 0));
  });
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.value = e.nativeEvent.contentOffset.x;
  };

  const goNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  const finish = async () => {
    await AsyncStorage.setItem('onboarding_done', '1');
    router.replace('/(auth)/login');
  };

  const skip = async () => {
    await AsyncStorage.setItem('onboarding_done', '1');
    router.replace('/(auth)/login');
  };

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: currentSlide.bg }]}>
      {/* Skip */}
      {!isLast && (
        <Pressable
          onPress={skip}
          style={[styles.skipBtn, { top: insets.top + 16 }]}
          hitSlop={12}
        >
          <Text style={[styles.skipText, { color: currentSlide.accent }]}>Omitir</Text>
        </Pressable>
      )}

      {/* Logo small */}
      <View style={[styles.logoWrap, { top: insets.top + 12 }]}>
        <Image
          source={require('../assets/images/icono.png')}
          style={styles.logoIcon}
          resizeMode="contain"
        />
      </View>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES as unknown as Slide[]}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <SlideItem item={item} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfig.current}
        style={styles.list}
      />

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Dot key={i} index={i} scrollX={scrollX} accent={currentSlide.accent} />
          ))}
        </View>

        {/* CTA button */}
        <Pressable
          onPress={isLast ? finish : goNext}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: currentSlide.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.btnText, { color: currentSlide.bg }]}>
            {isLast ? '¡Empezar ahora!' : 'Siguiente'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1 },

  skipBtn: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: { fontSize: 15, fontWeight: '600' },

  logoWrap: {
    position: 'absolute',
    left: 24,
    zIndex: 10,
  },
  logoIcon: { width: 36, height: 36 },

  list: { flex: 1 },

  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 40,
  },

  /* decorative circles */
  circleLg: {
    position: 'absolute',
    width: SCREEN_W * 1.4,
    height: SCREEN_W * 1.4,
    borderRadius: SCREEN_W * 0.7,
    borderWidth: 80,
    top: -SCREEN_W * 0.5,
    right: -SCREEN_W * 0.6,
  },
  circleSm: {
    position: 'absolute',
    width: SCREEN_W * 0.8,
    height: SCREEN_W * 0.8,
    borderRadius: SCREEN_W * 0.4,
    borderWidth: 50,
    bottom: -SCREEN_W * 0.3,
    left: -SCREEN_W * 0.3,
  },

  iconWrap: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },

  title: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 20,
  },
  body: {
    fontSize: 17,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 300,
  },

  /* bottom */
  bottom: {
    paddingHorizontal: 32,
    paddingTop: 16,
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  btn: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
