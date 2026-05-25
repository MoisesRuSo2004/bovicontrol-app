import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line, Text as SvgText } from 'react-native-svg';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';
import { Animal, AnimalSex, AnimalStatus } from '../../../types/animal.types';

const { width: SCREEN_W } = Dimensions.get('window');
const MAX_GALLERY = 5;

// ─── constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<AnimalStatus, { label: string; color: string; bg: string }> = {
  ACTIVE:      { label: 'Activo',      color: Colors.primary,    bg: Colors.primaryLight },
  SOLD:        { label: 'Vendido',     color: Colors.info,       bg: '#dbeafe' },
  DECEASED:    { label: 'Fallecido',   color: Colors.gray[500],  bg: Colors.gray[100] },
  TRANSFERRED: { label: 'Transferido', color: Colors.warning,    bg: '#fef3c7' },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function age(birthDate?: string): string {
  if (!birthDate) return '—';
  const diff = Date.now() - new Date(birthDate).getTime();
  const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 1) return 'Recién nacido';
  if (months < 12) return `${months} mes${months !== 1 ? 'es' : ''}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0
    ? `${years} año${years !== 1 ? 's' : ''} y ${rem} mes${rem !== 1 ? 'es' : ''}`
    : `${years} año${years !== 1 ? 's' : ''}`;
}

function sexIconColor(sex: AnimalSex): { iconColor: string; bg: string } {
  return sex === 'FEMALE'
    ? { iconColor: '#be185d', bg: '#fce7f3' }
    : { iconColor: '#1d4ed8', bg: '#dbeafe' };
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es');
}

// ─── WeightChart ──────────────────────────────────────────────────────────────

function WeightChart({ data }: { data: { recordDate: string; weightKg: number }[] }) {
  const W = SCREEN_W - 40 - 32; // card padding
  const H = 160;
  const PAD = { top: 16, right: 12, bottom: 36, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  if (data.length < 2) {
    // Single point — show centered dot + label
    const pt = data[0];
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24, gap: 6 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.primary }} />
        <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.primary }}>{pt.weightKg} kg</Text>
        <Text style={{ fontSize: 12, color: Colors.textMuted }}>
          {new Date(pt.recordDate).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Text>
        <Text style={{ fontSize: 11, color: Colors.gray[400] }}>Agrega más pesajes para ver la evolución</Text>
      </View>
    );
  }

  const weights = data.map((d) => d.weightKg);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  // Map data → SVG coords
  const pts = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * chartW,
    y: PAD.top + chartH - ((d.weightKg - minW) / range) * chartH,
    w: d.weightKg,
    date: d.recordDate,
  }));

  // Smooth cubic bezier path
  const linePath = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = pts[i - 1];
    const cpX = (prev.x + pt.x) / 2;
    return `${acc} C ${cpX} ${prev.y} ${cpX} ${pt.y} ${pt.x} ${pt.y}`;
  }, '');

  // Closed fill path
  const fillPath = `${linePath} L ${pts[pts.length - 1].x} ${PAD.top + chartH} L ${pts[0].x} ${PAD.top + chartH} Z`;

  // Y axis labels (3 levels)
  const yLabels = [
    { val: maxW, y: PAD.top },
    { val: Math.round((minW + maxW) / 2), y: PAD.top + chartH / 2 },
    { val: minW, y: PAD.top + chartH },
  ];

  // X axis: show first, last, and middle if enough space
  const xLabels = data.length <= 6
    ? data.map((d, i) => ({ i, date: d.recordDate }))
    : [
        { i: 0, date: data[0].recordDate },
        { i: Math.floor((data.length - 1) / 2), date: data[Math.floor((data.length - 1) / 2)].recordDate },
        { i: data.length - 1, date: data[data.length - 1].recordDate },
      ];

  const gain = weights[weights.length - 1] - weights[0];
  const gainPositive = gain >= 0;

  return (
    <View>
      {/* Gain badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 4, gap: 6 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: gainPositive ? '#d1fae5' : '#fee2e2',
          paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
        }}>
          <Ionicons
            name={gainPositive ? 'trending-up' : 'trending-down'}
            size={13}
            color={gainPositive ? '#065f46' : Colors.danger}
          />
          <Text style={{ fontSize: 12, fontWeight: '700', color: gainPositive ? '#065f46' : Colors.danger }}>
            {gainPositive ? '+' : ''}{gain.toFixed(1)} kg
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: Colors.textMuted }}>{data.length} registros</Text>
      </View>

      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={Colors.primary} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={Colors.primary} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid lines */}
        {yLabels.map((l, i) => (
          <Line
            key={i}
            x1={PAD.left}
            y1={l.y}
            x2={PAD.left + chartW}
            y2={l.y}
            stroke={Colors.border}
            strokeWidth="1"
            strokeDasharray={i === 0 || i === 2 ? undefined : '4 4'}
          />
        ))}

        {/* Y axis labels */}
        {yLabels.map((l, i) => (
          <SvgText
            key={i}
            x={PAD.left - 6}
            y={l.y + 4}
            textAnchor="end"
            fontSize="10"
            fill={Colors.textMuted}
            fontWeight="600"
          >
            {l.val}
          </SvgText>
        ))}

        {/* Fill area */}
        <Path d={fillPath} fill="url(#weightGrad)" />

        {/* Line */}
        <Path
          d={linePath}
          stroke={Colors.primary}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {pts.map((pt, i) => (
          <Circle key={i} cx={pt.x} cy={pt.y} r={4} fill="#fff" stroke={Colors.primary} strokeWidth="2.5" />
        ))}

        {/* Last point bigger + label */}
        {(() => {
          const last = pts[pts.length - 1];
          return (
            <>
              <Circle cx={last.x} cy={last.y} r={6} fill={Colors.primary} />
              <SvgText
                x={last.x}
                y={last.y - 11}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={Colors.primary}
              >
                {last.w} kg
              </SvgText>
            </>
          );
        })()}

        {/* X axis labels */}
        {xLabels.map(({ i, date }) => {
          const x = PAD.left + (i / (data.length - 1)) * chartW;
          const d = new Date(date);
          const label = `${d.getDate()} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]}`;
          return (
            <SvgText
              key={i}
              x={x}
              y={H - 4}
              textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
              fontSize="10"
              fill={Colors.textMuted}
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

// ─── shared card wrapper ──────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View
      style={[
        {
          backgroundColor: Colors.card,
          borderRadius: 16,
          padding: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function InfoRow({
  ionIcon,
  mciIcon,
  label,
  value,
  last,
}: {
  ionIcon?: IoniconName;
  mciIcon?: MCIName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: Colors.border,
        gap: 10,
      }}
    >
      <View style={{ width: 20, alignItems: 'center' }}>
        {ionIcon ? (
          <Ionicons name={ionIcon} size={16} color={Colors.primary} />
        ) : mciIcon ? (
          <MaterialCommunityIcons name={mciIcon} size={16} color={Colors.primary} />
        ) : null}
      </View>
      <Text style={{ flex: 1, fontSize: 13, color: Colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text, textAlign: 'right', maxWidth: '55%' }}>
        {value}
      </Text>
    </View>
  );
}

// ─── ActionButton ─────────────────────────────────────────────────────────────

function ActionButton({
  ionIcon,
  mciIcon,
  label,
  bg,
  textColor,
  border,
  onPress,
}: {
  ionIcon?: IoniconName;
  mciIcon?: MCIName;
  label: string;
  bg: string;
  textColor: string;
  border?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: bg,
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: pressed ? 0.82 : 1,
        borderWidth: border ? 1 : 0,
        borderColor: border ?? 'transparent',
      })}
    >
      {ionIcon ? (
        <Ionicons name={ionIcon} size={22} color={textColor} />
      ) : mciIcon ? (
        <MaterialCommunityIcons name={mciIcon} size={22} color={textColor} />
      ) : null}
      <Text style={{ fontSize: 12, fontWeight: '600', color: textColor, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Zoomable image (pinch + double-tap) ─────────────────────────────────────

function ZoomableImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .enabled(true)
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedX.value + e.translationX;
        translateY.value = savedY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan);
  const allGestures = Gesture.Exclusive(doubleTap, composed);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={allGestures}>
      <Animated.View style={[{ width: SCREEN_W, height: SCREEN_W, justifyContent: 'center', alignItems: 'center' }, animatedStyle]}>
        <Image
          source={{ uri }}
          style={{ width: SCREEN_W, height: SCREEN_W }}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Fullscreen Gallery Viewer ────────────────────────────────────────────────

function GalleryViewer({
  photos,
  initialIndex,
  visible,
  onClose,
  onDelete,
}: {
  photos: { id: string; url: string }[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
  onDelete: (photoId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(initialIndex);

  const photo = photos[current];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: 8,
            zIndex: 10,
          }}
        >
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
            {current + 1} / {photos.length}
          </Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Eliminar foto', '¿Eliminar esta foto?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Eliminar',
                  style: 'destructive',
                  onPress: () => {
                    onDelete(photo.id);
                    if (current > 0) setCurrent(current - 1);
                    if (photos.length === 1) onClose();
                  },
                },
              ])
            }
            hitSlop={12}
          >
            <Ionicons name="trash-outline" size={24} color="#ff6b6b" />
          </TouchableOpacity>
        </View>

        {/* Image carousel con zoom */}
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setCurrent(idx);
          }}
          contentContainerStyle={{ alignItems: 'center' }}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_W, flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
              <ZoomableImage uri={item.url} />
            </View>
          )}
        />

        {/* Hint zoom */}
        <View style={{ alignItems: 'center', paddingTop: 6 }}>
          <Text style={{ color: '#ffffff55', fontSize: 11 }}>
            Pellizca para hacer zoom · Doble tap para ampliar
          </Text>
        </View>

        {/* Dots */}
        {photos.length > 1 && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
              paddingBottom: insets.bottom + 16,
              paddingTop: 10,
            }}
          >
            {photos.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === current ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === current ? '#fff' : '#ffffff55',
                }}
              />
            ))}
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function AnimalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: animal, isLoading, refetch } = useQuery<Animal>({
    queryKey: ['animal', id],
    queryFn: () => api.get(`/animals/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: weightHistory } = useQuery<{ id: string; recordDate: string; weightKg: number }[]>({
    queryKey: ['animal', id, 'weights'],
    queryFn: () =>
      api
        .get('/production/weights', { params: { animalId: id, limit: 20 } })
        .then((r) => r.data.data ?? []),
    enabled: !!id,
  });

  const { data: vaccinations } = useQuery<{ id: string; appliedDate: string; vaccine?: { name: string } }[]>({
    queryKey: ['animal', id, 'vaccinations'],
    queryFn: () =>
      api
        .get('/health/vaccinations', { params: { animalId: id, limit: 3 } })
        .then((r) => r.data.data ?? []),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: AnimalStatus) => api.patch(`/animals/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['animal', id] });
      qc.invalidateQueries({ queryKey: ['animals'] });
      Toast.show({ type: 'success', text1: 'Estado actualizado' });
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/animals/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['animals'] });
      Toast.show({ type: 'success', text1: 'Animal eliminado' });
      router.back();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  // ── Photo mutations ──────────────────────────────────────────────────────

  const [photoUploading, setPhotoUploading] = useState(false);

  const uploadPhotoMutation = useMutation({
    mutationFn: async (uri: string) => {
      const formData = new FormData();
      formData.append('photo', {
        uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any);
      return api.patch(`/animals/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['animal', id] });
      qc.invalidateQueries({ queryKey: ['animals'] });
      Toast.show({ type: 'success', text1: 'Foto actualizada' });
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error al subir la foto', text2: getErrorMessage(e) }),
    onSettled: () => setPhotoUploading(false),
  });

  const removePhotoMutation = useMutation({
    mutationFn: () => api.delete(`/animals/${id}/photo`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['animal', id] });
      qc.invalidateQueries({ queryKey: ['animals'] });
      Toast.show({ type: 'success', text1: 'Foto eliminada' });
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const handlePhotoOptions = () => {
    const options: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' | 'default' }[] = [
      {
        text: animal?.photoUrl ? 'Cambiar foto' : 'Agregar foto',
        onPress: pickAndUpload,
      },
    ];
    if (animal?.photoUrl) {
      options.push({
        text: 'Eliminar foto',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Eliminar foto', '¿Estás seguro?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: () => removePhotoMutation.mutate() },
          ]),
      });
    }
    options.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Foto del animal', 'Selecciona una opción', options);
  };

  const pickAndUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permiso requerido', text2: 'Permite acceso a la galería para subir fotos.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUploading(true);
      uploadPhotoMutation.mutate(result.assets[0].uri);
    }
  };

  // ── Gallery ───────────────────────────────────────────────────────────────

  const [profilePhotoViewerVisible, setProfilePhotoViewerVisible] = useState(false);

  const [galleryViewerVisible, setGalleryViewerVisible] = useState(false);
  const [galleryViewerIndex, setGalleryViewerIndex] = useState(0);
  const [galleryUploading, setGalleryUploading] = useState(false);

  const { data: galleryPhotos = [] } = useQuery<{ id: string; url: string; createdAt: string }[]>({
    queryKey: ['animal', id, 'gallery'],
    queryFn: () => api.get(`/animals/${id}/gallery`).then((r) => r.data.data ?? []),
    enabled: !!id,
  });

  const addGalleryPhotoMutation = useMutation({
    mutationFn: async (uri: string) => {
      const formData = new FormData();
      formData.append('photo', { uri, type: 'image/jpeg', name: 'gallery.jpg' } as any);
      return api.post(`/animals/${id}/gallery`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['animal', id, 'gallery'] });
      Toast.show({ type: 'success', text1: 'Foto agregada a la galería' });
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error al subir', text2: getErrorMessage(e) }),
    onSettled: () => setGalleryUploading(false),
  });

  const removeGalleryPhotoMutation = useMutation({
    mutationFn: (photoId: string) => api.delete(`/animals/${id}/gallery/${photoId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['animal', id, 'gallery'] });
      Toast.show({ type: 'success', text1: 'Foto eliminada' });
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const pickGalleryPhoto = async () => {
    if (galleryPhotos.length >= MAX_GALLERY) {
      Toast.show({ type: 'info', text1: `Máximo ${MAX_GALLERY} fotos`, text2: 'Elimina una foto para agregar otra' });
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permiso requerido', text2: 'Permite acceso a la galería.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setGalleryUploading(true);
      addGalleryPhotoMutation.mutate(result.assets[0].uri);
    }
  };

  const openGalleryViewer = (index: number) => {
    setGalleryViewerIndex(index);
    setGalleryViewerVisible(true);
  };

  // ── Refresh ───────────────────────────────────────────────────────────────

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const confirmDelete = () =>
    Alert.alert(
      'Eliminar animal',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );

  const changeStatus = () => {
    const options = (['ACTIVE', 'SOLD', 'DECEASED', 'TRANSFERRED'] as AnimalStatus[])
      .filter((s) => s !== animal?.status)
      .map((s) => ({ text: STATUS_META[s].label, onPress: () => statusMutation.mutate(s) }));
    Alert.alert('Cambiar estado', 'Selecciona el nuevo estado del animal', [
      ...options,
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}
      >
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!animal) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}
      >
        <MaterialCommunityIcons name="cow-off" size={52} color={Colors.gray[300]} />
        <Text style={{ color: Colors.textMuted, marginTop: 12, fontSize: 15 }}>
          Animal no encontrado
        </Text>
      </View>
    );
  }

  const statusInfo = STATUS_META[animal.status];
  const av = sexIconColor(animal.sex);

  // Weight chart data (oldest → newest, max 4)
  // Oldest → newest for chart line (API returns newest first)
  const weightData = Array.isArray(weightHistory)
    ? [...weightHistory].reverse()
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── Header verde ── */}
        <View
          style={{
            backgroundColor: Colors.primary,
            paddingTop: insets.top + 16,
            paddingBottom: 52,
            paddingHorizontal: 20,
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Círculos decorativos */}
          <View
            style={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: '#ffffff10',
              top: -60,
              right: -50,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 130,
              height: 130,
              borderRadius: 65,
              backgroundColor: '#ffffff0d',
              bottom: -30,
              left: -10,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#ffffff0a',
              top: 30,
              right: 110,
            }}
          />

          {/* Botón atrás */}
          <Pressable
            onPress={() => router.back()}
            style={{ position: 'absolute', top: insets.top + 14, left: 16 }}
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>

          {/* Avatar / Foto */}
          <View style={{ marginBottom: 12 }}>
            {/* Tap en la foto → ver en fullscreen (o abrir picker si no hay foto) */}
            <Pressable
              onPress={() => {
                if (animal.photoUrl) {
                  setProfilePhotoViewerVisible(true);
                } else {
                  pickAndUpload();
                }
              }}
            >
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  borderWidth: 3,
                  borderColor: '#ffffff50',
                }}
              >
                {photoUploading ? (
                  <ActivityIndicator color={Colors.primary} size="large" />
                ) : animal.photoUrl ? (
                  <Image
                    source={{ uri: animal.photoUrl }}
                    style={{ width: 96, height: 96, borderRadius: 48 }}
                    resizeMode="cover"
                  />
                ) : (
                  <MaterialCommunityIcons name="cow" size={52} color={av.iconColor} />
                )}
              </View>
            </Pressable>

            {/* Badge cámara → opciones (cambiar / eliminar) */}
            <Pressable
              onPress={handlePhotoOptions}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: Colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: '#fff',
              }}
            >
              <Ionicons name="camera" size={14} color="#fff" />
            </Pressable>
          </View>

          {/* Nombre */}
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
            {animal.name ?? animal.tagNumber}
          </Text>

          {/* Chip arete */}
          <View
            style={{
              backgroundColor: '#ffffff25',
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 20,
              marginTop: 6,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
              Arete: {animal.tagNumber}
            </Text>
          </View>

          {/* Chip estado */}
          <View
            style={{
              backgroundColor: statusInfo.bg,
              paddingHorizontal: 14,
              paddingVertical: 5,
              borderRadius: 20,
              marginTop: 8,
            }}
          >
            <Text style={{ color: statusInfo.color, fontWeight: '700', fontSize: 13 }}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* ── Sección blanca ── */}
        <View
          style={{
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            marginTop: -24,
            paddingTop: 20,
            paddingHorizontal: 20,
            paddingBottom: Platform.OS === 'ios' ? 100 : 80,
            backgroundColor: Colors.background,
          }}
        >
          {/* ── A) Grid 4 stats ── */}
          <Animated.View
            entering={FadeInDown.delay(0).duration(400)}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {/* Peso actual */}
            <Card
              style={{
                flex: 1,
                minWidth: '45%',
                alignItems: 'center',
                padding: 14,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#ede9fe',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                <MaterialCommunityIcons name="scale" size={18} color="#7c3aed" />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.text }}>
                {animal.currentWeight ? `${animal.currentWeight} kg` : '—'}
              </Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>Peso actual</Text>
            </Card>

            {/* Edad */}
            <Card
              style={{
                flex: 1,
                minWidth: '45%',
                alignItems: 'center',
                padding: 14,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#dbeafe',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                <Ionicons name="time-outline" size={18} color={Colors.info} />
              </View>
              <Text
                style={{ fontSize: 14, fontWeight: '700', color: Colors.text, textAlign: 'center' }}
                numberOfLines={2}
              >
                {age(animal.birthDate)}
              </Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>Edad</Text>
            </Card>

            {/* Sexo */}
            <Card
              style={{
                flex: 1,
                minWidth: '45%',
                alignItems: 'center',
                padding: 14,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: av.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                <MaterialCommunityIcons
                  name={animal.sex === 'FEMALE' ? 'gender-female' : 'gender-male'}
                  size={18}
                  color={av.iconColor}
                />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.text }}>
                {animal.sex === 'FEMALE' ? 'Hembra' : 'Macho'}
              </Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>Sexo</Text>
            </Card>

            {/* Raza */}
            <Card
              style={{
                flex: 1,
                minWidth: '45%',
                alignItems: 'center',
                padding: 14,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: Colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                <Ionicons name="pricetag-outline" size={18} color={Colors.primary} />
              </View>
              <Text
                style={{ fontSize: 13, fontWeight: '700', color: Colors.text, textAlign: 'center' }}
                numberOfLines={2}
              >
                {animal.breed?.name ?? 'Sin raza'}
              </Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>Raza</Text>
            </Card>
          </Animated.View>

          {/* ── B) Gráfica de evolución de peso ── */}
          {weightData.length > 0 && (
            <Animated.View entering={FadeInDown.delay(100).duration(400)} style={{ marginBottom: 14 }}>
              <Card style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="trending-up" size={15} color={Colors.primary} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 }}>
                    Evolución de peso
                  </Text>
                  {animal.currentWeight && (
                    <View style={{ backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>
                        {animal.currentWeight} kg
                      </Text>
                    </View>
                  )}
                </View>

                <WeightChart data={weightData} />
              </Card>
            </Animated.View>
          )}

          {/* ── C) Información general ── */}
          <Animated.View entering={FadeInDown.delay(180).duration(400)} style={{ marginBottom: 14 }}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>
                  Información general
                </Text>
              </View>
              <InfoRow ionIcon="barcode-outline" label="Arete" value={animal.tagNumber} />
              <InfoRow ionIcon="pricetag-outline" label="Raza" value={animal.breed?.name ?? 'Sin raza'} />
              <InfoRow
                ionIcon="calendar-outline"
                label="Nacimiento"
                value={formatDate(animal.birthDate)}
              />
              <InfoRow
                mciIcon="scale"
                label="Peso al nacer"
                value={animal.birthWeight ? `${animal.birthWeight} kg` : '—'}
              />
              {animal.notes ? (
                <InfoRow
                  ionIcon="document-text-outline"
                  label="Notas"
                  value={animal.notes}
                  last
                />
              ) : null}
            </Card>
          </Animated.View>

          {/* ── D) Genealogía ── */}
          <Animated.View entering={FadeInDown.delay(260).duration(400)} style={{ marginBottom: 14 }}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Ionicons name="git-network-outline" size={16} color={Colors.primary} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>Genealogía</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {/* Padre */}
                {(() => {
                  const hasFather = !!animal.father;
                  return (
                    <Pressable
                      onPress={() =>
                        hasFather && router.push(`/(app)/animals/${animal.father!.id}` as any)
                      }
                      style={({ pressed }) => ({
                        flex: 1,
                        backgroundColor: hasFather ? (pressed ? '#dbeafe' : '#eff6ff') : Colors.gray[50],
                        borderRadius: 14,
                        padding: 12,
                        borderWidth: hasFather ? 1.5 : 1,
                        borderColor: hasFather ? '#93c5fd' : Colors.border,
                        opacity: pressed && hasFather ? 0.85 : 1,
                      })}
                    >
                      {/* Label row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="male" size={11} color="#1d4ed8" />
                        </View>
                        <Text style={{ fontSize: 11, color: '#1d4ed8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>
                          Padre
                        </Text>
                        {hasFather && (
                          <Ionicons name="chevron-forward" size={14} color="#1d4ed8" />
                        )}
                      </View>
                      {hasFather ? (
                        <>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <MaterialCommunityIcons name="cow" size={15} color="#1d4ed8" />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1d4ed8', flex: 1 }} numberOfLines={1}>
                              {animal.father!.tagNumber}
                            </Text>
                          </View>
                          {animal.father!.name ? (
                            <Text style={{ fontSize: 12, color: Colors.textMuted, marginLeft: 21 }} numberOfLines={1}>
                              {animal.father!.name}
                            </Text>
                          ) : null}
                          <Text style={{ fontSize: 10, color: '#93c5fd', marginTop: 6, fontWeight: '600' }}>
                            Toca para ver detalles
                          </Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 12, color: Colors.textMuted }}>Sin registrar</Text>
                      )}
                    </Pressable>
                  );
                })()}

                {/* Madre */}
                {(() => {
                  const hasMother = !!animal.mother;
                  return (
                    <Pressable
                      onPress={() =>
                        hasMother && router.push(`/(app)/animals/${animal.mother!.id}` as any)
                      }
                      style={({ pressed }) => ({
                        flex: 1,
                        backgroundColor: hasMother ? (pressed ? '#f3e8ff' : '#fdf4ff') : Colors.gray[50],
                        borderRadius: 14,
                        padding: 12,
                        borderWidth: hasMother ? 1.5 : 1,
                        borderColor: hasMother ? '#d8b4fe' : Colors.border,
                        opacity: pressed && hasMother ? 0.85 : 1,
                      })}
                    >
                      {/* Label row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#f3e8ff', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="female" size={11} color="#7c3aed" />
                        </View>
                        <Text style={{ fontSize: 11, color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>
                          Madre
                        </Text>
                        {hasMother && (
                          <Ionicons name="chevron-forward" size={14} color="#7c3aed" />
                        )}
                      </View>
                      {hasMother ? (
                        <>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <MaterialCommunityIcons name="cow" size={15} color="#7c3aed" />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#7c3aed', flex: 1 }} numberOfLines={1}>
                              {animal.mother!.tagNumber}
                            </Text>
                          </View>
                          {animal.mother!.name ? (
                            <Text style={{ fontSize: 12, color: Colors.textMuted, marginLeft: 21 }} numberOfLines={1}>
                              {animal.mother!.name}
                            </Text>
                          ) : null}
                          <Text style={{ fontSize: 10, color: '#d8b4fe', marginTop: 6, fontWeight: '600' }}>
                            Toca para ver detalles
                          </Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 12, color: Colors.textMuted }}>Sin registrar</Text>
                      )}
                    </Pressable>
                  );
                })()}
              </View>
            </Card>
          </Animated.View>

          {/* ── E) Vacunaciones ── */}
          {Array.isArray(vaccinations) && vaccinations.length > 0 && (
            <Animated.View entering={FadeInDown.delay(320).duration(400)} style={{ marginBottom: 14 }}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>
                    Vacunaciones
                  </Text>
                </View>
                {vaccinations.map((v, idx) => (
                  <Pressable
                    key={v.id}
                    onPress={() => router.push({
                      pathname: '/(app)/health/vaccination-new',
                      params: { vaccinationId: v.id, animalId: id },
                    } as any)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderBottomWidth: idx < vaccinations.length - 1 ? 1 : 0,
                      borderBottomColor: Colors.border,
                      gap: 10,
                      backgroundColor: pressed ? Colors.gray[50] : 'transparent',
                      borderRadius: 8,
                      marginHorizontal: -4,
                      paddingHorizontal: 4,
                    })}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: Colors.primary,
                      }}
                    />
                    <Text style={{ flex: 1, fontSize: 13, color: Colors.text }}>
                      {v.vaccine?.name ?? '—'}
                    </Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                      {formatDate(v.appliedDate)}
                    </Text>
                    <Ionicons name="create-outline" size={14} color={Colors.textMuted} />
                  </Pressable>
                ))}
              </Card>
            </Animated.View>
          )}

          {/* ── F) Galería de fotos ── */}
          <Animated.View entering={FadeInDown.delay(340).duration(400)} style={{ marginBottom: 14 }}>
            <Card>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <Ionicons name="images-outline" size={16} color={Colors.primary} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 }}>
                  Galería
                </Text>
                <View
                  style={{
                    backgroundColor: Colors.primaryLight,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 12,
                    marginRight: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary }}>
                    {galleryPhotos.length}/{MAX_GALLERY}
                  </Text>
                </View>
                {galleryPhotos.length < MAX_GALLERY && (
                  <Pressable
                    onPress={pickGalleryPhoto}
                    disabled={galleryUploading}
                    style={({ pressed }) => ({
                      backgroundColor: Colors.primary,
                      borderRadius: 20,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    {galleryUploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="add" size={16} color="#fff" />
                    )}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
                      {galleryUploading ? 'Subiendo...' : 'Agregar'}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Grid de fotos */}
              {galleryPhotos.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: Colors.gray[100],
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="camera-outline" size={26} color={Colors.gray[400]} />
                  </View>
                  <Text style={{ fontSize: 13, color: Colors.textMuted, fontWeight: '600' }}>
                    Sin fotos en la galería
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.gray[400], textAlign: 'center' }}>
                    Agrega hasta {MAX_GALLERY} fotos para mostrar al comprador
                  </Text>
                  <Pressable
                    onPress={pickGalleryPhoto}
                    disabled={galleryUploading}
                    style={({ pressed }) => ({
                      marginTop: 4,
                      backgroundColor: Colors.primaryLight,
                      borderRadius: 20,
                      paddingHorizontal: 18,
                      paddingVertical: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    {galleryUploading ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Ionicons name="cloud-upload-outline" size={16} color={Colors.primary} />
                    )}
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>
                      {galleryUploading ? 'Subiendo...' : 'Subir primera foto'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {galleryPhotos.map((photo, index) => (
                    <Pressable
                      key={photo.id}
                      onPress={() => openGalleryViewer(index)}
                      style={({ pressed }) => ({
                        width: (SCREEN_W - 40 - 16 - 16) / 3,
                        aspectRatio: 1,
                        borderRadius: 12,
                        overflow: 'hidden',
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Image
                        source={{ uri: photo.url }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                      {/* Overlay con lupa */}
                      <View
                        style={{
                          position: 'absolute',
                          bottom: 4,
                          right: 4,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: '#00000070',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="expand-outline" size={12} color="#fff" />
                      </View>
                    </Pressable>
                  ))}

                  {/* Slot vacío si hay espacio */}
                  {galleryPhotos.length < MAX_GALLERY && (
                    <Pressable
                      onPress={pickGalleryPhoto}
                      disabled={galleryUploading}
                      style={({ pressed }) => ({
                        width: (SCREEN_W - 40 - 16 - 16) / 3,
                        aspectRatio: 1,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderStyle: 'dashed',
                        borderColor: Colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: Colors.gray[50],
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      {galleryUploading ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Ionicons name="add" size={24} color={Colors.gray[400]} />
                      )}
                    </Pressable>
                  )}
                </View>
              )}
            </Card>
          </Animated.View>

          {/* ── H) Genealogía (botón) ── */}
          <Animated.View entering={FadeInDown.delay(350).duration(400)} style={{ marginBottom: 14 }}>
            <Pressable
              onPress={() => router.push({ pathname: '/(app)/animals/genealogy', params: { animalId: animal.id } } as any)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#0f172a' : '#1e293b',
                borderRadius: 16, padding: 16,
                flexDirection: 'row', alignItems: 'center', gap: 14,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#ffffff15', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="family-tree" size={24} color="#94a3b8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#f1f5f9' }}>Árbol genealógico</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {animal.father || animal.mother
                    ? `Padre: ${animal.father?.tagNumber ?? '—'} · Madre: ${animal.mother?.tagNumber ?? '—'}`
                    : 'Ver y asignar padres, descendientes y consanguinidad'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#475569" />
            </Pressable>
          </Animated.View>

          {/* ── H) Crías / Descendencia ── */}
          {((animal.fatherOf && animal.fatherOf.length > 0) ||
            (animal.motherOf && animal.motherOf.length > 0)) && (
            <Animated.View entering={FadeInDown.delay(360).duration(400)} style={{ marginBottom: 14 }}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <MaterialCommunityIcons name="family-tree" size={16} color={Colors.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>Crías</Text>
                  <View
                    style={{
                      marginLeft: 'auto',
                      backgroundColor: Colors.primaryLight,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary }}>
                      {(animal.fatherOf?.length ?? 0) + (animal.motherOf?.length ?? 0)}
                    </Text>
                  </View>
                </View>

                {/* Hijos como padre (machos) */}
                {animal.fatherOf && animal.fatherOf.length > 0 && (
                  <>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: '#1d4ed8',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      Como padre
                    </Text>
                    {animal.fatherOf.map((child, idx) => (
                      <Pressable
                        key={child.id}
                        onPress={() => router.push(`/(app)/animals/${child.id}` as any)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 9,
                          borderBottomWidth:
                            idx < (animal.fatherOf!.length - 1) ||
                            (animal.motherOf && animal.motherOf.length > 0)
                              ? 1
                              : 0,
                          borderBottomColor: Colors.border,
                          gap: 10,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor:
                              child.sex === 'FEMALE' ? '#fce7f3' : '#dbeafe',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MaterialCommunityIcons
                            name="cow"
                            size={17}
                            color={child.sex === 'FEMALE' ? '#be185d' : '#1d4ed8'}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>
                            {child.name ?? child.tagNumber}
                          </Text>
                          {child.name && (
                            <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                              Arete: {child.tagNumber}
                            </Text>
                          )}
                        </View>
                        <View
                          style={{
                            backgroundColor: STATUS_META[child.status].bg,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '700',
                              color: STATUS_META[child.status].color,
                            }}
                          >
                            {STATUS_META[child.status].label}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                      </Pressable>
                    ))}
                  </>
                )}

                {/* Hijos como madre (hembras) */}
                {animal.motherOf && animal.motherOf.length > 0 && (
                  <>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: '#7c3aed',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 6,
                        marginTop: animal.fatherOf && animal.fatherOf.length > 0 ? 10 : 0,
                      }}
                    >
                      Como madre
                    </Text>
                    {animal.motherOf.map((child, idx) => (
                      <Pressable
                        key={child.id}
                        onPress={() => router.push(`/(app)/animals/${child.id}` as any)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 9,
                          borderBottomWidth: idx < animal.motherOf!.length - 1 ? 1 : 0,
                          borderBottomColor: Colors.border,
                          gap: 10,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor:
                              child.sex === 'FEMALE' ? '#fce7f3' : '#dbeafe',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MaterialCommunityIcons
                            name="cow"
                            size={17}
                            color={child.sex === 'FEMALE' ? '#be185d' : '#1d4ed8'}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>
                            {child.name ?? child.tagNumber}
                          </Text>
                          {child.name && (
                            <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                              Arete: {child.tagNumber}
                            </Text>
                          )}
                        </View>
                        <View
                          style={{
                            backgroundColor: STATUS_META[child.status].bg,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '700',
                              color: STATUS_META[child.status].color,
                            }}
                          >
                            {STATUS_META[child.status].label}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                      </Pressable>
                    ))}
                  </>
                )}
              </Card>
            </Animated.View>
          )}

          {/* ── I) Grid de acciones ── */}
          <Animated.View entering={FadeInDown.delay(420).duration(400)} style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <ActionButton
                ionIcon="create-outline"
                label="Editar"
                bg={Colors.primary}
                textColor="#fff"
                onPress={() =>
                  router.push({ pathname: '/(app)/animals/edit', params: { id } } as any)
                }
              />
              <ActionButton
                ionIcon="swap-horizontal-outline"
                label="Cambiar estado"
                bg={Colors.card}
                textColor={Colors.text}
                border={Colors.border}
                onPress={changeStatus}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <ActionButton
                mciIcon="scale"
                label="Registrar pesaje"
                bg="#ede9fe"
                textColor="#7c3aed"
                onPress={() =>
                  router.push({
                    pathname: '/(app)/production/weight-new',
                    params: { animalId: id },
                  } as any)
                }
              />
              <ActionButton
                ionIcon="shield-checkmark-outline"
                label="Registrar vacuna"
                bg="#d1fae5"
                textColor="#065f46"
                onPress={() =>
                  router.push({
                    pathname: '/(app)/health/vaccination-new',
                    params: { animalId: id },
                  } as any)
                }
              />
            </View>
            <ActionButton
              ionIcon="trash-outline"
              label="Eliminar animal"
              bg="#fef2f2"
              textColor={Colors.danger}
              border="#fecaca"
              onPress={confirmDelete}
            />
          </Animated.View>
        </View>
      </ScrollView>

      {/* Foto de perfil — visor fullscreen */}
      {animal.photoUrl && (
        <GalleryViewer
          photos={[{ id: 'profile', url: animal.photoUrl }]}
          initialIndex={0}
          visible={profilePhotoViewerVisible}
          onClose={() => setProfilePhotoViewerVisible(false)}
          onDelete={() => {
            removePhotoMutation.mutate();
            setProfilePhotoViewerVisible(false);
          }}
        />
      )}

      {/* Galería — visor fullscreen */}
      {galleryPhotos.length > 0 && (
        <GalleryViewer
          photos={galleryPhotos}
          initialIndex={galleryViewerIndex}
          visible={galleryViewerVisible}
          onClose={() => setGalleryViewerVisible(false)}
          onDelete={(photoId) => {
            removeGalleryPhotoMutation.mutate(photoId);
            setGalleryViewerVisible(galleryPhotos.length > 1);
          }}
        />
      )}
    </View>
  );
}
