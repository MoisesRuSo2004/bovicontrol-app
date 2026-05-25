import { zodResolver } from '@hookform/resolvers/zod';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { z } from 'zod';
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';
import { Animal, AnimalStatus } from '../../../types/animal.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const STATUS_OPTIONS: { value: AnimalStatus; label: string; color: string; bg: string }[] = [
  { value: 'ACTIVE',      label: 'Activo',       color: Colors.primary,   bg: Colors.primaryLight },
  { value: 'SOLD',        label: 'Vendido',      color: Colors.info,      bg: '#dbeafe' },
  { value: 'DECEASED',    label: 'Fallecido',    color: Colors.gray[500], bg: Colors.gray[100] },
  { value: 'TRANSFERRED', label: 'Transferido',  color: Colors.warning,   bg: '#fef3c7' },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  tagNumber:     z.string().min(1, 'El número de arete es requerido'),
  name:          z.string().optional(),
  sex:           z.enum(['MALE', 'FEMALE']),
  status:        z.enum(['ACTIVE', 'SOLD', 'DECEASED', 'TRANSFERRED']),
  birthDate:     z.string().optional(),
  birthWeight:   z.number().positive('Debe ser mayor a 0').optional(),
  currentWeight: z.number().positive('Debe ser mayor a 0').optional(),
  breedId:       z.string().optional(),
  fatherId:      z.string().optional(),
  motherId:      z.string().optional(),
  notes:         z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function formatDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function InfoIcon({ message }: { message: string }) {
  return (
    <Pressable onPress={() => Alert.alert('Información', message)} hitSlop={10}>
      <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

function SectionHeader({
  label,
  icon,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 }}>
      <View style={{ width: 3, height: 18, backgroundColor: Colors.primary, borderRadius: 2 }} />
      {icon && <Ionicons name={icon} size={15} color={Colors.primary} />}
      <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>{label}</Text>
    </View>
  );
}

function FieldLabel({
  label,
  required,
  optional,
  info,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  info?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, marginTop: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.gray[600] }}>
        {label}
        {required && <Text style={{ color: Colors.danger }}> *</Text>}
        {optional && (
          <Text style={{ color: Colors.textMuted, fontWeight: '400', fontSize: 12 }}> (opcional)</Text>
        )}
      </Text>
      {info && <InfoIcon message={info} />}
    </View>
  );
}

function FieldInput({ error, style, ...props }: any) {
  return (
    <>
      <TextInput
        style={[
          {
            borderWidth: 1,
            borderColor: error ? Colors.danger : Colors.border,
            borderRadius: 12,
            padding: 14,
            fontSize: 15,
            backgroundColor: Colors.gray[50],
            color: Colors.text,
          },
          style,
        ]}
        placeholderTextColor={Colors.textMuted}
        {...props}
      />
      {error ? (
        <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>
      ) : null}
    </>
  );
}

// ─── DatePickerModal ──────────────────────────────────────────────────────────

function DatePickerModal({
  visible,
  initial,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  initial?: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}) {
  const today = new Date();
  const currentYear = today.getFullYear();

  const parseInit = (val?: string) => {
    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      return { d, m, y };
    }
    return { d: today.getDate(), m: today.getMonth() + 1, y: currentYear };
  };

  const [day, setDay] = useState(() => parseInit(initial).d);
  const [month, setMonth] = useState(() => parseInit(initial).m);
  const [year, setYear] = useState(() => parseInit(initial).y);

  useEffect(() => {
    if (visible) {
      const init = parseInit(initial);
      setDay(init.d);
      setMonth(init.m);
      setYear(init.y);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const maxDays = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, maxDays);
  const days = Array.from({ length: maxDays }, (_, i) => i + 1);
  const years = Array.from({ length: 33 }, (_, i) => currentYear + 1 - i);

  const confirm = () => {
    const d = safeDay.toString().padStart(2, '0');
    const m = month.toString().padStart(2, '0');
    onConfirm(`${year}-${m}-${d}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onCancel}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            backgroundColor: Colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: Platform.OS === 'ios' ? 36 : 24,
          }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontSize: 17, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 20 }}>
            Selecciona la fecha
          </Text>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            {/* Day */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textMuted, textAlign: 'center', letterSpacing: 0.8, marginBottom: 6 }}>DÍA</Text>
              <ScrollView style={{ height: 210 }} showsVerticalScrollIndicator={false}>
                {days.map((d) => {
                  const sel = safeDay === d;
                  return (
                    <Pressable key={d} onPress={() => setDay(d)}
                      style={{ paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10, backgroundColor: sel ? Colors.primaryLight : 'transparent', marginBottom: 2, alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: sel ? '700' : '400', color: sel ? Colors.primary : Colors.text }}>
                        {d.toString().padStart(2, '0')}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            {/* Month */}
            <View style={{ flex: 2.2 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textMuted, textAlign: 'center', letterSpacing: 0.8, marginBottom: 6 }}>MES</Text>
              <ScrollView style={{ height: 210 }} showsVerticalScrollIndicator={false}>
                {MONTHS_ES.map((name, i) => {
                  const sel = month === i + 1;
                  return (
                    <Pressable key={i} onPress={() => setMonth(i + 1)}
                      style={{ paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10, backgroundColor: sel ? Colors.primaryLight : 'transparent', marginBottom: 2, alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: sel ? '700' : '400', color: sel ? Colors.primary : Colors.text }}>
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            {/* Year */}
            <View style={{ flex: 1.4 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textMuted, textAlign: 'center', letterSpacing: 0.8, marginBottom: 6 }}>AÑO</Text>
              <ScrollView style={{ height: 210 }} showsVerticalScrollIndicator={false}>
                {years.map((y) => {
                  const sel = year === y;
                  return (
                    <Pressable key={y} onPress={() => setYear(y)}
                      style={{ paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10, backgroundColor: sel ? Colors.primaryLight : 'transparent', marginBottom: 2, alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: sel ? '700' : '400', color: sel ? Colors.primary : Colors.text }}>
                        {y}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Preview */}
          <View style={{ backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 12, marginTop: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <Ionicons name="calendar" size={16} color={Colors.primary} />
            <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 15 }}>
              {safeDay.toString().padStart(2, '0')} de {MONTHS_ES[month - 1]} de {year}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable onPress={onCancel}
              style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
              <Text style={{ fontWeight: '600', color: Colors.textMuted }}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={confirm}
              style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Confirmar fecha</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── DateInput ────────────────────────────────────────────────────────────────

function DateInput({ value, onChange, error }: { value?: string; onChange: (v: string) => void; error?: string }) {
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          style={{ flex: 1, borderWidth: 1, borderColor: error ? Colors.danger : Colors.border, borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: Colors.gray[50], color: Colors.text }}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={Colors.textMuted}
          value={value ?? ''}
          onChangeText={(t) => onChange(formatDateMask(t))}
          keyboardType="numeric"
          maxLength={10}
        />
        <Pressable
          onPress={() => setShowPicker(true)}
          style={({ pressed }) => ({
            width: 50, height: 50, borderRadius: 12,
            backgroundColor: pressed ? Colors.primary : Colors.primaryLight,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: Colors.primary + '50',
          })}
        >
          <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
        </Pressable>
      </View>
      {error ? <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
      <DatePickerModal
        visible={showPicker}
        initial={value}
        onConfirm={(date) => { onChange(date); setShowPicker(false); }}
        onCancel={() => setShowPicker(false)}
      />
    </>
  );
}

// ─── AnimalSearch ─────────────────────────────────────────────────────────────

function AnimalSearch({
  value,
  onSelect,
  sexFilter,
  initialLabel,
}: {
  value?: string;
  onSelect: (id: string) => void;
  sexFilter?: 'MALE' | 'FEMALE';
  initialLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState(initialLabel ?? '');
  const [showResults, setShowResults] = useState(false);

  // Sync when animal data loads asynchronously
  useEffect(() => {
    if (initialLabel && !selectedLabel) {
      setSelectedLabel(initialLabel);
    }
  }, [initialLabel]);

  const { data, isFetching } = useQuery({
    queryKey: ['animals-search', { q: query, sex: sexFilter }],
    queryFn: () =>
      api.get('/animals', {
        params: { search: query, limit: 6, ...(sexFilter ? { sex: sexFilter } : {}) },
      }).then((r) => r.data.data ?? []),
    enabled: showResults && query.length >= 1,
  });

  const animals: Animal[] = data ?? [];

  const handleSelect = (animal: Animal) => {
    const lbl = `${animal.tagNumber}${animal.name ? ` · ${animal.name}` : ''}`;
    setSelectedLabel(lbl);
    setQuery('');
    setShowResults(false);
    onSelect(animal.id);
  };

  const sexColor = sexFilter === 'FEMALE' ? '#be185d' : '#1d4ed8';
  const sexBg = sexFilter === 'FEMALE' ? '#fce7f3' : '#dbeafe';

  if (value && selectedLabel) {
    return (
      <Pressable
        onPress={() => { setSelectedLabel(''); onSelect(''); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: sexColor, borderRadius: 12, padding: 12, backgroundColor: sexBg + '60' }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: sexBg, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="cow" size={18} color={sexColor} />
        </View>
        <Text style={{ flex: 1, fontSize: 14, color: sexColor, fontWeight: '700' }}>{selectedLabel}</Text>
        <Ionicons name="close-circle" size={20} color={sexColor} />
      </Pressable>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50], paddingHorizontal: 12, paddingVertical: 4 }}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={{ flex: 1, marginLeft: 8, paddingVertical: 10, fontSize: 15, color: Colors.text }}
          placeholder="Buscar por arete o nombre…"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={(t) => { setQuery(t); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
        />
        {isFetching ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : query.length > 0 ? (
          <Pressable onPress={() => { setQuery(''); setShowResults(false); }}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {showResults && query.length >= 1 && (
        <View style={{ backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginTop: 4, overflow: 'hidden' }}>
          {animals.length === 0 && !isFetching ? (
            <View style={{ padding: 16, alignItems: 'center', gap: 4 }}>
              <MaterialCommunityIcons name="cow-off" size={24} color={Colors.gray[300]} />
              <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Sin resultados para "{query}"</Text>
            </View>
          ) : (
            animals.map((a, idx) => (
              <Pressable
                key={a.id}
                onPress={() => handleSelect(a)}
                style={({ pressed }) => ({
                  padding: 12,
                  borderBottomWidth: idx < animals.length - 1 ? 1 : 0,
                  borderBottomColor: Colors.border,
                  backgroundColor: pressed ? Colors.primaryLight : Colors.card,
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                })}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: a.sex === 'FEMALE' ? '#fce7f3' : '#dbeafe', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="cow" size={20} color={a.sex === 'FEMALE' ? '#be185d' : '#1d4ed8'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 14 }}>{a.tagNumber}</Text>
                  {a.name ? <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 1 }}>{a.name}</Text> : null}
                </View>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: a.sex === 'FEMALE' ? '#fce7f3' : '#dbeafe' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: a.sex === 'FEMALE' ? '#be185d' : '#1d4ed8' }}>
                    {a.sex === 'FEMALE' ? 'Hembra' : 'Macho'}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EditAnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: animal, isLoading } = useQuery<Animal>({
    queryKey: ['animal', id],
    queryFn: () => api.get(`/animals/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: breedsData } = useQuery({
    queryKey: ['breeds'],
    queryFn: () => api.get('/breeds').then((r) => r.data.data ?? []),
  });
  const breeds: { id: string; name: string }[] = breedsData ?? [];

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    values: animal
      ? {
          tagNumber:     animal.tagNumber,
          name:          animal.name ?? '',
          sex:           animal.sex,
          status:        animal.status,
          birthDate:     animal.birthDate ? animal.birthDate.split('T')[0] : '',
          birthWeight:   animal.birthWeight ?? undefined,
          currentWeight: animal.currentWeight ?? undefined,
          breedId:       animal.breedId ?? '',
          fatherId:      animal.fatherId ?? '',
          motherId:      animal.motherId ?? '',
          notes:         animal.notes ?? '',
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const clean = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined),
      );
      return api.patch(`/animals/${id}`, clean);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['animal', id] });
      qc.invalidateQueries({ queryKey: ['animals'] });
      Toast.show({ type: 'success', text1: 'Animal actualizado', text2: 'Los cambios fueron guardados' });
      router.back();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error al guardar', text2: getErrorMessage(e) }),
  });

  const sex = watch('sex');
  const status = watch('status');
  const selectedBreedId = watch('breedId');
  const fatherId = watch('fatherId');
  const motherId = watch('motherId');

  const onInvalid = () => {
    Toast.show({ type: 'error', text1: 'Faltan campos', text2: 'Revisa los campos marcados en rojo' });
  };

  if (isLoading || !animal) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  // Build initial labels for pre-selected parents
  const fatherInitialLabel = animal.father
    ? `${animal.father.tagNumber}${animal.father.name ? ` · ${animal.father.name}` : ''}`
    : undefined;
  const motherInitialLabel = animal.mother
    ? `${animal.mother.tagNumber}${animal.mother.name ? ` · ${animal.mother.name}` : ''}`
    : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* ── Header modal ── */}
      <View
        style={{
          backgroundColor: Colors.primaryLight,
          borderBottomWidth: 1,
          borderBottomColor: '#bbf7d0',
          paddingTop: 10,
          paddingBottom: 16,
          paddingHorizontal: 20,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.primary + '40' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: Colors.primary + '18',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="create-outline" size={24} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: Colors.primaryDark }}>
              Editar Animal
            </Text>
            <Text style={{ fontSize: 12, color: Colors.primary, marginTop: 1 }} numberOfLines={1}>
              {animal.name ?? animal.tagNumber}
            </Text>
          </View>
          <Pressable onPress={() => router.back()} style={{ padding: 6 }}>
            <Ionicons name="close" size={22} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Identificación ── */}
        <Animated.View entering={FadeInDown.delay(0)}>
          <SectionHeader label="Identificación" icon="pricetag-outline" />

          <FieldLabel label="Número de arete" required info="Identificación única del animal en tu finca." />
          <Controller
            control={control}
            name="tagNumber"
            render={({ field: { onChange, onBlur, value } }) => (
              <FieldInput
                placeholder="Ej: BOV-001"
                error={errors.tagNumber?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                autoCapitalize="characters"
              />
            )}
          />

          <FieldLabel label="Nombre" optional />
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <FieldInput
                placeholder="Ej: Estrella, La Negra…"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
        </Animated.View>

        {/* ── Sexo ── */}
        <Animated.View entering={FadeInDown.delay(60)}>
          <SectionHeader label="Sexo" icon="male-female-outline" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['FEMALE', 'MALE'] as const).map((s) => {
              const active = sex === s;
              const bgColor = s === 'FEMALE' ? '#fce7f3' : '#dbeafe';
              const activeColor = s === 'FEMALE' ? '#be185d' : '#1d4ed8';
              return (
                <Pressable
                  key={s}
                  onPress={() => setValue('sex', s)}
                  style={{
                    flex: 1, padding: 16, borderRadius: 14,
                    borderWidth: 2,
                    borderColor: active ? activeColor : Colors.border,
                    backgroundColor: active ? bgColor : Colors.gray[50],
                    alignItems: 'center', gap: 6,
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: active ? activeColor + '20' : Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={s === 'FEMALE' ? 'female' : 'male'} size={22} color={active ? activeColor : Colors.textMuted} />
                  </View>
                  <Text style={{ fontWeight: '700', fontSize: 14, color: active ? activeColor : Colors.textMuted }}>
                    {s === 'FEMALE' ? 'Hembra' : 'Macho'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Estado ── */}
        <Animated.View entering={FadeInDown.delay(120)}>
          <SectionHeader label="Estado del animal" icon="pulse-outline" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STATUS_OPTIONS.map((opt) => {
              const active = status === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setValue('status', opt.value)}
                  style={{
                    paddingVertical: 9,
                    paddingHorizontal: 16,
                    borderRadius: 20,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? opt.color : Colors.border,
                    backgroundColor: active ? opt.bg : Colors.gray[50],
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {active && <Ionicons name="checkmark" size={14} color={opt.color} />}
                  <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? opt.color : Colors.textMuted }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Datos físicos ── */}
        <Animated.View entering={FadeInDown.delay(180)}>
          <SectionHeader label="Datos físicos" icon="bar-chart-outline" />

          <FieldLabel
            label="Fecha de nacimiento"
            optional
            info="Escribe solo dígitos y el sistema formatea automáticamente, o toca el ícono de calendario para elegir."
          />
          <Controller
            control={control}
            name="birthDate"
            render={({ field: { onChange, value } }) => (
              <DateInput value={value} onChange={onChange} error={errors.birthDate?.message} />
            )}
          />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel
                label="Peso al nacer"
                optional
                info="Peso en kg al momento del nacimiento."
              />
              <Controller
                control={control}
                name="birthWeight"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FieldInput
                    placeholder="kg"
                    keyboardType="numeric"
                    error={errors.birthWeight?.message}
                    onBlur={onBlur}
                    onChangeText={(t: string) => onChange(t ? parseFloat(t) : undefined)}
                    value={value?.toString() ?? ''}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Peso actual" optional info="Peso actual en kg. Se actualiza con cada pesaje registrado." />
              <Controller
                control={control}
                name="currentWeight"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FieldInput
                    placeholder="kg"
                    keyboardType="numeric"
                    error={errors.currentWeight?.message}
                    onBlur={onBlur}
                    onChangeText={(t: string) => onChange(t ? parseFloat(t) : undefined)}
                    value={value?.toString() ?? ''}
                  />
                )}
              />
            </View>
          </View>
        </Animated.View>

        {/* ── Raza ── */}
        {breeds.length > 0 && (
          <Animated.View entering={FadeInDown.delay(240)}>
            <SectionHeader label="Raza" icon="ribbon-outline" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {breeds.map((b) => {
                const active = selectedBreedId === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => setValue('breedId', active ? '' : b.id)}
                    style={{
                      paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: active ? Colors.primary : Colors.border,
                      backgroundColor: active ? Colors.primaryLight : Colors.gray[50],
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? Colors.primary : Colors.text }}>
                      {b.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ── Genealogía ── */}
        <Animated.View entering={FadeInDown.delay(300)}>
          <SectionHeader label="Genealogía" icon="git-network-outline" />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.gray[50], borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: Colors.border }}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={{ flex: 1, fontSize: 12, color: Colors.textMuted }}>
              Ambos son opcionales. Solo puedes seleccionar animales registrados en tu finca.
            </Text>
          </View>

          <View style={{ backgroundColor: Colors.gray[50], borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 14 }}>
            {/* Padre */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="male" size={14} color="#1d4ed8" />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1d4ed8' }}>Padre</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>(opcional · solo machos)</Text>
              </View>
              <AnimalSearch
                value={fatherId}
                onSelect={(animalId) => setValue('fatherId', animalId)}
                sexFilter="MALE"
                initialLabel={fatherInitialLabel}
              />
            </View>

            <View style={{ height: 1, backgroundColor: Colors.border }} />

            {/* Madre */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#fce7f3', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="female" size={14} color="#be185d" />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#be185d' }}>Madre</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>(opcional · solo hembras)</Text>
              </View>
              <AnimalSearch
                value={motherId}
                onSelect={(animalId) => setValue('motherId', animalId)}
                sexFilter="FEMALE"
                initialLabel={motherInitialLabel}
              />
            </View>
          </View>
        </Animated.View>

        {/* ── Notas ── */}
        <Animated.View entering={FadeInDown.delay(360)}>
          <SectionHeader label="Notas" icon="document-text-outline" />
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{
                  borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
                  padding: 14, fontSize: 15, backgroundColor: Colors.gray[50],
                  color: Colors.text, minHeight: 90, textAlignVertical: 'top',
                }}
                placeholder="Observaciones, comportamiento, historial…"
                placeholderTextColor={Colors.textMuted}
                multiline
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
        </Animated.View>

        {/* ── Errores globales ── */}
        {Object.keys(errors).length > 0 && (
          <View style={{ backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, marginTop: 16, borderWidth: 1, borderColor: '#fecaca', gap: 4 }}>
            <Text style={{ color: Colors.danger, fontSize: 13, fontWeight: '700' }}>Corrige los siguientes campos:</Text>
            {Object.entries(errors).map(([key, err]) => (
              <Text key={key} style={{ color: Colors.danger, fontSize: 12 }}>
                • {(err as any)?.message ?? key}
              </Text>
            ))}
          </View>
        )}

        {/* ── Submit ── */}
        <Animated.View entering={FadeInDown.delay(400)}>
          <Pressable
            onPress={handleSubmit((d) => mutation.mutate(d as unknown as FormData), onInvalid)}
            disabled={mutation.isPending}
            style={({ pressed }) => ({
              backgroundColor: Colors.primary,
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
              marginTop: 28,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 6,
              opacity: pressed || mutation.isPending ? 0.75 : 1,
            })}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Guardar cambios</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
