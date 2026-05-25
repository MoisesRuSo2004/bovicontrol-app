import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOfflineMutation } from '../../../hooks/use-offline-mutation';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Modal,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { z } from 'zod';
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';
import { Animal } from '../../../types/animal.types';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  animalId:   z.string().min(1, 'Selecciona un animal'),
  recordDate: z.string().min(1, 'La fecha es requerida'),
  weightKg:   z.number().positive('El peso debe ser mayor a 0'),
  method:     z.string().optional(),
  notes:      z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const G       = Colors.primary;
const G_LIGHT = Colors.primaryLight;
const G_DARK  = '#14532d';

const METHODS = [
  { value: 'Báscula digital',    icon: 'scale' as const },
  { value: 'Cinta métrica',      icon: 'tape-measure' as const },
  { value: 'Báscula mecánica',   icon: 'scale-balance' as const },
  { value: 'Estimación visual',  icon: 'eye-outline' as const },
];

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4, marginLeft: 2 }}>
      {message}
    </Text>
  );
}

// ─── DatePickerModal ──────────────────────────────────────────────────────────

const W_PICKER_ITEM_H  = 44;
const W_PICKER_VISIBLE = 5;
const W_PICKER_H       = W_PICKER_ITEM_H * W_PICKER_VISIBLE; // 220

// PickerCol FUERA del componente padre — evita desmontaje en cada render
function WPickerCol({
  data, selected, onSelect, accentColor, accentLight, visible,
}: {
  data: (number | { label: string; value: number })[];
  selected: number;
  onSelect: (v: number) => void;
  accentColor: string;
  accentLight: string;
  visible: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const idx = data.findIndex((d) => (typeof d === 'number' ? d : (d as any).value) === selected);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: idx * W_PICKER_ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, [visible, idx]);

  return (
    <ScrollView
      ref={ref}
      style={{ height: W_PICKER_H }}
      contentContainerStyle={{ paddingVertical: W_PICKER_ITEM_H * 2 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={W_PICKER_ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={(e) => {
        const i    = Math.round(e.nativeEvent.contentOffset.y / W_PICKER_ITEM_H);
        const item = data[Math.max(0, Math.min(i, data.length - 1))];
        onSelect(typeof item === 'number' ? item : (item as any).value);
      }}
    >
      {data.map((item) => {
        const v   = typeof item === 'number' ? item : (item as any).value;
        const lbl = typeof item === 'number' ? String(item).padStart(2, '0') : (item as any).label;
        const sel = v === selected;
        return (
          <Pressable
            key={v}
            onPress={() => {
              onSelect(v);
              const i2 = data.findIndex((d) => (typeof d === 'number' ? d : (d as any).value) === v);
              ref.current?.scrollTo({ y: i2 * W_PICKER_ITEM_H, animated: true });
            }}
            style={{ height: W_PICKER_ITEM_H, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ fontSize: sel ? 18 : 15, fontWeight: sel ? '800' : '400', color: sel ? accentColor : Colors.textMuted }}>
              {lbl}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function DatePickerModal({
  visible, value, onConfirm, onClose,
}: {
  visible: boolean;
  value: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
}) {
  const now    = new Date();
  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00') : now;

  const [selYear,  setSelYear]  = useState(parsed.getFullYear());
  const [selMonth, setSelMonth] = useState(parsed.getMonth());
  const [selDay,   setSelDay]   = useState(parsed.getDate());

  useEffect(() => {
    if (visible) {
      const d = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00') : now;
      setSelYear(d.getFullYear());
      setSelMonth(d.getMonth());
      setSelDay(d.getDate());
    }
  }, [visible]);

  const years        = Array.from({ length: 30 }, (_, i) => now.getFullYear() - i);
  const months       = MONTHS_ES.map((m, i) => ({ label: m, value: i }));
  const daysInMonth  = new Date(selYear, selMonth + 1, 0).getDate();
  const days         = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const safeDay      = Math.min(selDay, daysInMonth);
  const preview      = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Backdrop */}
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000066' }}
          onPress={onClose}
        />

        {/* Sheet */}
        <View style={{ backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 28 }}>
          {/* Handle */}
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 16 }} />

          {/* Título + preview */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text }}>Seleccionar fecha</Text>
            <View style={{ backgroundColor: G_LIGHT, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: G }}>{preview}</Text>
            </View>
          </View>

          {/* Columnas — altura explícita */}
          <View style={{ flexDirection: 'row', height: W_PICKER_H, position: 'relative' }}>
            {/* Franja selección */}
            <View style={{ position: 'absolute', left: 0, right: 0, top: W_PICKER_ITEM_H * 2, height: W_PICKER_ITEM_H, backgroundColor: G_LIGHT, borderRadius: 12 }} />

            <View style={{ flex: 1 }}>
              <WPickerCol data={days} selected={safeDay} onSelect={setSelDay} accentColor={G} accentLight={G_LIGHT} visible={visible} />
            </View>
            <View style={{ flex: 2 }}>
              <WPickerCol data={months} selected={selMonth} onSelect={setSelMonth} accentColor={G} accentLight={G_LIGHT} visible={visible} />
            </View>
            <View style={{ flex: 2 }}>
              <WPickerCol data={years} selected={selYear} onSelect={setSelYear} accentColor={G} accentLight={G_LIGHT} visible={visible} />
            </View>
          </View>

          {/* Etiquetas */}
          <View style={{ flexDirection: 'row', marginTop: 4, marginBottom: 20 }}>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Día</Text>
            <Text style={{ flex: 2, textAlign: 'center', fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Mes</Text>
            <Text style={{ flex: 2, textAlign: 'center', fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Año</Text>
          </View>

          {/* Botones */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={onClose} style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', color: Colors.textMuted }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => { onConfirm(preview); onClose(); }}
              style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: G, alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Confirmar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── AnimalSearch ─────────────────────────────────────────────────────────────

function AnimalSearch({
  value, onSelect, error, preloadId,
}: {
  value?: string;
  onSelect: (id: string, label: string) => void;
  error?: string;
  preloadId?: string;
}) {
  const [query, setQuery]             = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [showResults, setShowResults] = useState(false);

  const { data: preloadData, isLoading: preloading } = useQuery<Animal>({
    queryKey: ['animal', preloadId],
    queryFn: () => api.get(`/animals/${preloadId}`).then((r) => r.data.data),
    enabled: !!preloadId && !selectedLabel,
  });

  useEffect(() => {
    if (preloadData && !selectedLabel) {
      const label = `${preloadData.tagNumber}${preloadData.name ? ` · ${preloadData.name}` : ''}`;
      setSelectedLabel(label);
      onSelect(preloadData.id, label);
    }
  }, [preloadData]);

  const { data, isFetching } = useQuery({
    queryKey: ['animals-search', query],
    queryFn: () =>
      api.get('/animals', { params: { search: query, limit: 5 } })
         .then((r) => r.data.data ?? []),
    enabled: showResults && query.length >= 1,
  });

  const animals: Animal[] = data ?? [];

  const handleSelect = (animal: Animal) => {
    const label = `${animal.tagNumber}${animal.name ? ` · ${animal.name}` : ''}`;
    setSelectedLabel(label);
    setQuery('');
    setShowResults(false);
    onSelect(animal.id, label);
  };

  const clear = () => { setSelectedLabel(''); setQuery(''); onSelect('', ''); };

  if (preloading) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: G_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: G + '40' }}>
        <ActivityIndicator size="small" color={G} />
        <Text style={{ color: G, fontSize: 14 }}>Cargando animal...</Text>
      </View>
    );
  }

  if (value && selectedLabel) {
    return (
      <Pressable
        onPress={clear}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: G, borderRadius: 12, padding: 14, backgroundColor: G_LIGHT }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: G + '20', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="cow" size={18} color={G} />
          </View>
          <Text style={{ fontSize: 14, color: G, fontWeight: '700', flex: 1 }} numberOfLines={1}>{selectedLabel}</Text>
        </View>
        <Ionicons name="close-circle" size={20} color={G} />
      </Pressable>
    );
  }

  return (
    <View>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: error ? Colors.danger : Colors.border,
        borderRadius: 12, backgroundColor: Colors.gray[50],
      }}>
        <View style={{ paddingLeft: 14 }}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        </View>
        <TextInput
          style={{ flex: 1, padding: 14, paddingLeft: 8, fontSize: 15, color: Colors.text }}
          placeholder="Buscar por arete o nombre..."
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={(t) => { setQuery(t); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
        />
        {isFetching && <ActivityIndicator size="small" color={G} style={{ marginRight: 12 }} />}
      </View>

      {showResults && query.length >= 1 && (
        <View style={{ backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginTop: 6, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
          {animals.length === 0 && !isFetching ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Sin resultados</Text>
            </View>
          ) : animals.map((a, idx) => (
            <Pressable
              key={a.id}
              onPress={() => handleSelect(a)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 12,
                borderBottomWidth: idx < animals.length - 1 ? 1 : 0,
                borderBottomColor: Colors.border,
                backgroundColor: pressed ? G_LIGHT : Colors.card,
              })}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: a.sex === 'FEMALE' ? '#fce7f3' : '#dbeafe', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="cow" size={16} color={a.sex === 'FEMALE' ? '#be185d' : '#1d4ed8'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 14 }}>{a.tagNumber}</Text>
                {a.name && <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{a.name}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
            </Pressable>
          ))}
        </View>
      )}
      <FieldError message={error} />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function WeightNewScreen() {
  const router  = useRouter();
  const qc      = useQueryClient();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{ animalId?: string }>();

  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      recordDate: new Date().toISOString().split('T')[0],
    },
  });

  const animalId   = watch('animalId');
  const recordDate = watch('recordDate');
  const selMethod  = watch('method');

  const mutation = useOfflineMutation({
    mutationFn: (data: FormData) => {
      const clean = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined),
      );
      return api.post('/production/weights', clean);
    },
    offline: {
      url:      () => '/production/weights',
      method:   'POST',
      getData:  (data) => ({ ...data }),
      getLabel: (data) => `Pesaje ${(data as any).animalId ? `animal ${(data as any).animalId.slice(0, 6)}` : ''} — ${(data as any).recordDate ?? ''}`,
      invalidateKeys: [['production', 'weights'], ['animals']],
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['production', 'weights'] });
      qc.invalidateQueries({ queryKey: ['animal', vars.animalId] });
      qc.invalidateQueries({ queryKey: ['animal', vars.animalId, 'weights'] });
      qc.invalidateQueries({ queryKey: ['animals'] });
      Toast.show({ type: 'success', text1: 'Pesaje registrado', text2: 'El peso del animal fue actualizado' });
      if (vars.animalId) {
        router.navigate(`/(app)/animals/${vars.animalId}` as any);
      } else {
        handleClose();
      }
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const onInvalid = () => {
    Toast.show({ type: 'error', text1: 'Revisa el formulario', text2: 'Hay campos requeridos sin completar' });
  };

  const handleClose = () => {
    if (params.animalId) {
      router.navigate(`/(app)/animals/${params.animalId}` as any);
    } else if (router.canDismiss()) {
      router.dismiss();
    } else {
      router.back();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View
        style={{
          backgroundColor: G_LIGHT,
          borderBottomWidth: 1,
          borderBottomColor: '#bbf7d0',
          paddingTop: insets.top + 10,
          paddingBottom: 18,
          paddingHorizontal: 20,
        }}
      >
        {/* Drag handle */}
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: G + '50', marginBottom: 16 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {/* Ícono */}
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: G + '18', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="scale" size={26} color={G} />
          </View>

          {/* Título */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: G_DARK }}>Registrar Pesaje</Text>
            <Text style={{ fontSize: 12, color: G, marginTop: 2, fontWeight: '500' }}>Control de peso del animal</Text>
          </View>

          {/* Cerrar */}
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: G + '15', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={20} color={G} />
          </Pressable>
        </View>
      </View>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 120,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* ── Animal ──────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={{ width: 3, height: 16, backgroundColor: G, borderRadius: 2 }} />
            <Ionicons name="paw-outline" size={14} color={G} />
            <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.text }}>Animal *</Text>
          </View>
          <AnimalSearch
            value={animalId}
            onSelect={(id) => setValue('animalId', id, { shouldValidate: true })}
            error={errors.animalId?.message}
            preloadId={params.animalId}
          />
        </Animated.View>

        {/* ── Peso destacado ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <View
            style={{
              marginTop: 20,
              backgroundColor: G_LIGHT,
              borderRadius: 20,
              padding: 24,
              borderWidth: 2,
              borderColor: G + '50',
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <MaterialCommunityIcons name="scale" size={18} color={G} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: G }}>Peso registrado *</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
              <Controller
                control={control}
                name="weightKg"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={{
                      fontSize: 52,
                      fontWeight: '800',
                      color: G,
                      minWidth: 120,
                      textAlign: 'center',
                      padding: 0,
                      includeFontPadding: false,
                    }}
                    placeholder="0"
                    placeholderTextColor={G + '50'}
                    keyboardType="decimal-pad"
                    onBlur={onBlur}
                    onChangeText={(t) => {
                      const cleaned = t.replace(',', '.');
                      onChange(cleaned ? parseFloat(cleaned) : undefined);
                    }}
                    value={value?.toString() ?? ''}
                  />
                )}
              />
              <Text style={{ fontSize: 22, fontWeight: '700', color: G + '80', marginBottom: 10 }}>kg</Text>
            </View>

            {errors.weightKg && (
              <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>
                {errors.weightKg.message}
              </Text>
            )}

            <Text style={{ fontSize: 12, color: G + '80', marginTop: 6 }}>
              Toca el número para editar
            </Text>
          </View>
        </Animated.View>

        {/* ── Fecha ────────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(180).springify()} style={{ marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={{ width: 3, height: 16, backgroundColor: G, borderRadius: 2 }} />
            <Ionicons name="calendar-outline" size={14} color={G} />
            <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.text }}>Fecha del pesaje *</Text>
          </View>

          <Pressable
            onPress={() => setDatePickerOpen(true)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: errors.recordDate ? Colors.danger : Colors.border,
              borderRadius: 12,
              backgroundColor: Colors.gray[50],
              padding: 14,
              gap: 10,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="calendar-outline" size={20} color={G} />
            <Text style={{ flex: 1, fontSize: 15, color: recordDate ? Colors.text : Colors.textMuted, fontWeight: recordDate ? '600' : '400' }}>
              {recordDate || 'Seleccionar fecha'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
          </Pressable>

          {/* También permite escribir directo */}
          <Controller
            control={control}
            name="recordDate"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 10,
                  padding: 10,
                  paddingLeft: 14,
                  fontSize: 13,
                  color: Colors.textMuted,
                  backgroundColor: Colors.gray[50],
                }}
                placeholder="O escribe: YYYYMMDD"
                placeholderTextColor={Colors.gray[400]}
                keyboardType="numeric"
                maxLength={10}
                onBlur={onBlur}
                onChangeText={(t) => onChange(formatDateMask(t))}
                value={value}
              />
            )}
          />
          <FieldError message={errors.recordDate?.message} />
        </Animated.View>

        {/* ── Método (chips) ────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(240).springify()} style={{ marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={{ width: 3, height: 16, backgroundColor: G, borderRadius: 2 }} />
            <MaterialCommunityIcons name="scale-balance" size={14} color={G} />
            <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.text }}>Método de pesaje</Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted }}>(opcional)</Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {METHODS.map((m) => {
              const active = selMethod === m.value;
              return (
                <Pressable
                  key={m.value}
                  onPress={() => setValue('method', active ? undefined : m.value)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: active ? 0 : 1,
                    borderColor: Colors.border,
                    backgroundColor: active ? G : Colors.gray[50],
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <MaterialCommunityIcons
                    name={m.icon}
                    size={15}
                    color={active ? '#fff' : Colors.textMuted}
                  />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : Colors.textMuted }}>
                    {m.value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Observaciones ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={{ marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={{ width: 3, height: 16, backgroundColor: G, borderRadius: 2 }} />
            <Ionicons name="create-outline" size={14} color={G} />
            <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.text }}>Observaciones</Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted }}>(opcional)</Text>
          </View>
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 15,
                  color: Colors.text,
                  backgroundColor: Colors.gray[50],
                  minHeight: 90,
                  textAlignVertical: 'top',
                }}
                placeholder="Ej: Pesaje post-parto, animal en buenas condiciones..."
                placeholderTextColor={Colors.textMuted}
                multiline
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
        </Animated.View>

        {/* ── Submit ────────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(360).springify()} style={{ marginTop: 28 }}>
          <Pressable
            onPress={handleSubmit((d) => mutation.mutate(d as unknown as FormData), onInvalid)}
            disabled={mutation.isPending}
            style={({ pressed }) => ({
              backgroundColor: G,
              borderRadius: 16,
              padding: 18,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
              shadowColor: G,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 6,
              opacity: pressed || mutation.isPending ? 0.78 : 1,
            })}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="scale" size={22} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Guardar pesaje</Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Date picker modal ─────────────────────────────────────────────── */}
      <DatePickerModal
        visible={datePickerOpen}
        value={recordDate}
        onConfirm={(d) => { setValue('recordDate', d, { shouldValidate: true }); }}
        onClose={() => setDatePickerOpen(false)}
      />
    </View>
  );
}
