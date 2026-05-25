import { useRef, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
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

// ─── Colors ──────────────────────────────────────────────────────────────────
const P = '#8b5cf6';
const P_LIGHT = '#ede9fe';
const P_DARK = '#4c1d95';
const GREEN = Colors.primary;
const GREEN_LIGHT = Colors.primaryLight;
const GREEN_DARK = '#14532d';
const GESTATION_DAYS = 283;

// ─── Date Picker ─────────────────────────────────────────────────────────────
const PICKER_ITEM_H = 44;
const PICKER_H = PICKER_ITEM_H * 5;

const MONTHS = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
];

function DPickerCol({ data, selected, onSelect, accentColor, visible }: {
  data: (number | { value: number; label: string })[];
  selected: number; onSelect: (v: number) => void;
  accentColor: string; visible: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const idx = data.findIndex((d) => (typeof d === 'number' ? d : d.value) === selected);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => ref.current?.scrollTo({ y: idx * PICKER_ITEM_H, animated: false }), 80);
    return () => clearTimeout(timer);
  }, [visible, idx]);
  return (
    <ScrollView ref={ref} style={{ height: PICKER_H }}
      contentContainerStyle={{ paddingVertical: PICKER_ITEM_H * 2 }}
      showsVerticalScrollIndicator={false} snapToInterval={PICKER_ITEM_H} decelerationRate="fast"
      onMomentumScrollEnd={(e) => {
        const i = Math.round(e.nativeEvent.contentOffset.y / PICKER_ITEM_H);
        const item = data[Math.max(0, Math.min(i, data.length - 1))];
        onSelect(typeof item === 'number' ? item : item.value);
      }}>
      {data.map((item) => {
        const val = typeof item === 'number' ? item : item.value;
        const lbl = typeof item === 'number' ? String(item).padStart(2, '0') : item.label;
        const active = val === selected;
        return (
          <Pressable key={val} onPress={() => onSelect(val)}
            style={{ height: PICKER_ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: active ? 18 : 15, fontWeight: active ? '800' : '400', color: active ? accentColor : Colors.textMuted }}>
              {lbl}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function DatePickerModal({ visible, value, onClose, onConfirm, title, accentColor = GREEN }: {
  visible: boolean; value: string; onClose: () => void;
  onConfirm: (date: string) => void; title?: string; accentColor?: string;
}) {
  const parsed = value && value.length >= 10 ? new Date(value) : new Date();
  const [day, setDay] = useState(parsed.getDate());
  const [month, setMonth] = useState(parsed.getMonth() + 1);
  const [year, setYear] = useState(parsed.getFullYear());

  useEffect(() => {
    if (visible) {
      const d = value && value.length >= 10 ? new Date(value) : new Date();
      setDay(d.getDate()); setMonth(d.getMonth() + 1); setYear(d.getFullYear());
    }
  }, [visible, value]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  const handleConfirm = () => {
    const safeDay = Math.min(day, daysInMonth);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
    onConfirm(dateStr);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000066' }} onPress={onClose} />
        <View style={{ backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 16 }} />
          {title && <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 12 }}>{title}</Text>}
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' }}>Día</Text>
            <Text style={{ flex: 2, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' }}>Mes</Text>
            <Text style={{ flex: 2, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' }}>Año</Text>
          </View>
          <View style={{ position: 'relative' }}>
            <View style={{ position: 'absolute', top: PICKER_ITEM_H * 2, left: 0, right: 0, height: PICKER_ITEM_H, backgroundColor: accentColor + '15', borderRadius: 10, zIndex: 0 }} />
            <View style={{ flexDirection: 'row', height: PICKER_H, zIndex: 1 }}>
              <View style={{ flex: 1 }}><DPickerCol data={days} selected={day} onSelect={setDay} accentColor={accentColor} visible={visible} /></View>
              <View style={{ flex: 2 }}><DPickerCol data={MONTHS} selected={month} onSelect={setMonth} accentColor={accentColor} visible={visible} /></View>
              <View style={{ flex: 2 }}><DPickerCol data={years} selected={year} onSelect={setYear} accentColor={accentColor} visible={visible} /></View>
            </View>
          </View>
          <Pressable onPress={handleConfirm}
            style={({ pressed }) => ({ backgroundColor: accentColor, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16, opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Confirmar fecha</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function DateField({ value, onPress, accentColor, error }: { value: string; onPress: () => void; accentColor: string; error?: string }) {
  const fmtDisplay = (iso: string) => {
    if (!iso || iso.length < 10) return 'Seleccionar fecha';
    const [y, m, d] = iso.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${+d} · ${months[+m - 1]} · ${y}`;
  };
  return (
    <Pressable onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center',
      borderWidth: value ? 1.5 : 1,
      borderColor: error ? Colors.danger : value ? accentColor : Colors.border,
      borderRadius: 12, backgroundColor: value ? accentColor + '10' : Colors.gray[50], padding: 14, gap: 10,
    }}>
      <Ionicons name="calendar-outline" size={20} color={value ? accentColor : Colors.textMuted} />
      <Text style={{ flex: 1, fontSize: 15, fontWeight: value ? '700' : '400', color: value ? accentColor : Colors.textMuted }}>
        {fmtDisplay(value)}
      </Text>
      <Ionicons name="chevron-down" size={16} color={value ? accentColor : Colors.textMuted} />
    </Pressable>
  );
}

// ─── AnimalSearch ─────────────────────────────────────────────────────────────
function AnimalSearch({ value, selectedLabel, onSelect, onClear, error, accentColor }: {
  value: string; selectedLabel: string; onSelect: (id: string, label: string) => void;
  onClear: () => void; error?: string; accentColor: string;
}) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  const { data } = useQuery({
    queryKey: ['animals', { search: query, sex: 'FEMALE' }],
    queryFn: () => api.get('/animals', { params: { search: query, limit: 6 } })
      .then((r) => (r.data.data ?? []).filter((a: any) => a.sex === 'FEMALE')),
    enabled: showResults && query.length >= 1,
  });
  const animals: any[] = data ?? [];

  if (value && selectedLabel) {
    return (
      <Pressable onPress={onClear} style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderWidth: 1.5, borderColor: accentColor, borderRadius: 12, padding: 14, backgroundColor: accentColor + '10',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MaterialCommunityIcons name="cow" size={18} color={accentColor} />
          <Text style={{ fontSize: 14, color: accentColor, fontWeight: '700' }}>{selectedLabel}</Text>
        </View>
        <Ionicons name="close-circle" size={18} color={accentColor} />
      </Pressable>
    );
  }

  return (
    <View>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: error ? Colors.danger : Colors.border,
        borderRadius: 12, backgroundColor: Colors.gray[50], overflow: 'hidden',
      }}>
        <View style={{ paddingLeft: 14 }}><Ionicons name="search-outline" size={18} color={Colors.textMuted} /></View>
        <TextInput style={{ flex: 1, padding: 14, paddingLeft: 8, fontSize: 15, color: Colors.text }}
          placeholder="Buscar hembra por arete o nombre..."
          placeholderTextColor={Colors.textMuted} value={query}
          onChangeText={(t) => { setQuery(t); setShowResults(true); }}
          onFocus={() => setShowResults(true)} />
      </View>
      {showResults && query.length >= 1 && animals.length > 0 && (
        <View style={{ backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginTop: 4, overflow: 'hidden' }}>
          {animals.map((a) => (
            <Pressable key={a.id} onPress={() => { onSelect(a.id, `${a.tagNumber}${a.name ? ' · ' + a.name : ''}`); setQuery(''); setShowResults(false); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
                borderBottomWidth: 1, borderBottomColor: Colors.border,
                backgroundColor: pressed ? accentColor + '15' : Colors.card,
              })}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: accentColor + '15', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="cow" size={14} color={accentColor} />
              </View>
              <View>
                <Text style={{ color: Colors.text, fontWeight: '600' }}>{a.tagNumber}</Text>
                {a.name && <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{a.name}</Text>}
              </View>
            </Pressable>
          ))}
        </View>
      )}
      {error && <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  femaleId:          z.string().uuid('Selecciona una hembra'),
  conceptionDate:    z.string().min(1, 'La fecha de concepción es requerida'),
  expectedBirthDate: z.string().min(1, 'La fecha de parto es requerida'),
  status:            z.enum(['IN_PROGRESS', 'COMPLETED', 'ABORTED', 'LOST']).optional(),
  gestationDays:     z.number().int().min(0).optional(),
  offspringCount:    z.number().int().positive().optional(),
  notes:             z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function SectionHeader({ label, icon, accentColor = GREEN }: { label: string; icon?: string; accentColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 20, gap: 8 }}>
      <View style={{ width: 3, height: 18, backgroundColor: accentColor, borderRadius: 2 }} />
      {icon && <Ionicons name={icon as any} size={14} color={accentColor} />}
      <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.text }}>{label}</Text>
    </View>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>{message}</Text>;
}

const INPUT_STYLE = {
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: 12,
  padding: 14,
  fontSize: 15,
  backgroundColor: Colors.gray[50],
  color: Colors.text,
} as const;

function autoExpectedDate(conceptionDate: string): string {
  if (!conceptionDate || conceptionDate.length < 10) return '';
  const d = new Date(conceptionDate);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + GESTATION_DAYS);
  return d.toISOString().split('T')[0];
}

const STATUS_OPTIONS: { value: 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED' | 'LOST'; label: string; desc: string; color: string; icon: string }[] = [
  { value: 'IN_PROGRESS', label: 'En gestación',       desc: 'Preñez activa en curso',      color: Colors.primary, icon: 'baby-carriage' },
  { value: 'COMPLETED',   label: 'Parto completado',   desc: 'Nacimiento exitoso',           color: Colors.info,    icon: 'check-circle-outline' },
  { value: 'ABORTED',     label: 'Pérdida / Aborto',   desc: 'Pérdida de la gestación',     color: Colors.danger,  icon: 'close-circle-outline' },
  { value: 'LOST',        label: 'Perdida',            desc: 'Sin información adicional',    color: Colors.gray[500], icon: 'help-circle-outline' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PregnancyNewScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { pregnancyId, femaleId: paramFemaleId } = useLocalSearchParams<{ pregnancyId?: string; femaleId?: string }>();
  const isEditing = !!pregnancyId;

  const [selectedFemaleLabel, setSelectedFemaleLabel] = useState('');
  const [showConceptionPicker, setShowConceptionPicker] = useState(false);
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [expectedDateManuallySet, setExpectedDateManuallySet] = useState(false);

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      conceptionDate: '',
      expectedBirthDate: '',
      status: 'IN_PROGRESS',
      gestationDays: GESTATION_DAYS,
      offspringCount: 1,
      femaleId: paramFemaleId ?? '',
    },
  });

  // Load existing pregnancy for editing
  const { data: existingPregnancy, isLoading: loadingPregnancy } = useQuery({
    queryKey: ['reproduction', 'pregnancies', pregnancyId],
    queryFn: () => api.get(`/reproduction/pregnancies/${pregnancyId}`).then((r) => r.data),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingPregnancy) {
      reset({
        femaleId: existingPregnancy.femaleId ?? '',
        conceptionDate: existingPregnancy.conceptionDate ? existingPregnancy.conceptionDate.split('T')[0] : '',
        expectedBirthDate: existingPregnancy.expectedBirthDate ? existingPregnancy.expectedBirthDate.split('T')[0] : '',
        status: existingPregnancy.status ?? 'IN_PROGRESS',
        gestationDays: existingPregnancy.gestationDays ?? GESTATION_DAYS,
        offspringCount: existingPregnancy.offspringCount ?? 1,
        notes: existingPregnancy.notes ?? '',
      });
      setExpectedDateManuallySet(true);
      if (existingPregnancy.female) {
        const lbl = `${existingPregnancy.female.tagNumber}${existingPregnancy.female.name ? ' · ' + existingPregnancy.female.name : ''}`;
        setSelectedFemaleLabel(lbl);
      }
    }
  }, [existingPregnancy, reset]);

  const femaleId = watch('femaleId');
  const conceptionDate = watch('conceptionDate');
  const expectedBirthDate = watch('expectedBirthDate');
  const currentStatus = watch('status');

  const dismiss = () => {
    if (router.canDismiss()) router.dismiss();
    else router.back();
  };

  const handleConceptionConfirm = (date: string) => {
    setValue('conceptionDate', date);
    if (!expectedDateManuallySet) {
      const expected = autoExpectedDate(date);
      if (expected) setValue('expectedBirthDate', expected);
    }
  };

  const handleBirthConfirm = (date: string) => {
    setValue('expectedBirthDate', date);
    setExpectedDateManuallySet(true);
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const clean = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined),
      );
      if (isEditing) return api.patch(`/reproduction/pregnancies/${pregnancyId}`, clean);
      return api.post('/reproduction/pregnancies', clean);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reproduction', 'pregnancies'] });
      qc.invalidateQueries({ queryKey: ['animals', 'stats'] });
      Toast.show({ type: 'success', text1: isEditing ? 'Gestación actualizada' : 'Gestación registrada' });
      dismiss();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/reproduction/pregnancies/${pregnancyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reproduction', 'pregnancies'] });
      qc.invalidateQueries({ queryKey: ['animals', 'stats'] });
      Toast.show({ type: 'success', text1: 'Gestación eliminada' });
      dismiss();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const handleDelete = () => {
    Alert.alert(
      'Eliminar gestación',
      '¿Estás seguro de que deseas eliminar este registro de gestación? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  };

  const accentColor = isEditing ? P : GREEN;

  if (isEditing && loadingPregnancy) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={accentColor} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={{
        backgroundColor: isEditing ? P_LIGHT : GREEN_LIGHT,
        borderBottomWidth: 1,
        borderBottomColor: isEditing ? '#ddd6fe' : '#bbf7d0',
        paddingTop: 10,
        paddingBottom: 16,
        paddingHorizontal: 20,
      }}>
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: accentColor + '50' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: accentColor + '18', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="baby-carriage" size={24} color={accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: isEditing ? P_DARK : GREEN_DARK }}>
              {isEditing ? 'Editar Gestación' : 'Registrar Gestación'}
            </Text>
            <Text style={{ fontSize: 12, color: accentColor, marginTop: 1 }}>Seguimiento de preñez</Text>
          </View>
          <Pressable onPress={dismiss} style={{ padding: 6 }}>
            <Ionicons name="close" size={22} color={accentColor} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: Colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hembra gestante */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <SectionHeader label="Hembra gestante *" icon="female-outline" accentColor={accentColor} />
          <AnimalSearch
            value={femaleId ?? ''}
            selectedLabel={selectedFemaleLabel}
            onSelect={(id, label) => { setValue('femaleId', id); setSelectedFemaleLabel(label); }}
            onClear={() => { setValue('femaleId', ''); setSelectedFemaleLabel(''); }}
            error={errors.femaleId?.message}
            accentColor={accentColor}
          />
        </Animated.View>

        {/* Fechas */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <SectionHeader label="Fechas" icon="calendar-outline" accentColor={accentColor} />

          {/* Info chip */}
          <View style={{
            backgroundColor: accentColor + '15', borderRadius: 12, padding: 12,
            flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
          }}>
            <Ionicons name="information-circle-outline" size={18} color={accentColor} />
            <Text style={{ flex: 1, fontSize: 12, color: accentColor }}>
              La fecha de parto se calcula automáticamente ({GESTATION_DAYS} días)
            </Text>
          </View>

          <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.gray[600], marginBottom: 8 }}>
            Fecha de concepción <Text style={{ color: Colors.danger }}>*</Text>
          </Text>
          <DateField
            value={conceptionDate ?? ''}
            onPress={() => setShowConceptionPicker(true)}
            accentColor={accentColor}
            error={errors.conceptionDate?.message}
          />
          <FieldError message={errors.conceptionDate?.message} />

          <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.gray[600], marginTop: 14, marginBottom: 8 }}>
            Parto esperado <Text style={{ color: Colors.danger }}>*</Text>
          </Text>
          <DateField
            value={expectedBirthDate ?? ''}
            onPress={() => setShowBirthPicker(true)}
            accentColor={accentColor}
            error={errors.expectedBirthDate?.message}
          />
          <FieldError message={errors.expectedBirthDate?.message} />
        </Animated.View>

        <DatePickerModal
          visible={showConceptionPicker}
          value={conceptionDate ?? ''}
          onClose={() => setShowConceptionPicker(false)}
          onConfirm={handleConceptionConfirm}
          title="Fecha de concepción"
          accentColor={accentColor}
        />
        <DatePickerModal
          visible={showBirthPicker}
          value={expectedBirthDate ?? ''}
          onClose={() => setShowBirthPicker(false)}
          onConfirm={handleBirthConfirm}
          title="Parto esperado"
          accentColor={accentColor}
        />

        {/* Datos adicionales */}
        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <SectionHeader label="Datos adicionales" icon="options-outline" accentColor={accentColor} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.gray[600], marginBottom: 8 }}>Días gestación</Text>
              <Controller control={control} name="gestationDays"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput style={INPUT_STYLE}
                    placeholder="283"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    onBlur={onBlur}
                    onChangeText={(t) => onChange(t ? parseInt(t, 10) : undefined)}
                    value={value?.toString() ?? ''} />
                )} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.gray[600], marginBottom: 8 }}>Crías esperadas</Text>
              <Controller control={control} name="offspringCount"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput style={INPUT_STYLE}
                    placeholder="1"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    onBlur={onBlur}
                    onChangeText={(t) => onChange(t ? parseInt(t, 10) : undefined)}
                    value={value?.toString() ?? ''} />
                )} />
            </View>
          </View>
        </Animated.View>

        {/* Status selector (edit mode only) */}
        {isEditing && (
          <Animated.View entering={FadeInDown.delay(220).springify()}>
            <SectionHeader label="Estado" icon="swap-horizontal-outline" accentColor={accentColor} />
            <View style={{ gap: 8 }}>
              {STATUS_OPTIONS.map((opt) => {
                const active = currentStatus === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setValue('status', opt.value)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      padding: 13, borderRadius: 12, borderWidth: 2,
                      borderColor: active ? opt.color : Colors.border,
                      backgroundColor: active ? opt.color + '15' : Colors.gray[50],
                    }}
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: active ? opt.color + '25' : Colors.border + '40',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <MaterialCommunityIcons name={opt.icon as any} size={18} color={active ? opt.color : Colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: active ? opt.color : Colors.text, fontSize: 14 }}>{opt.label}</Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 1 }}>{opt.desc}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color={opt.color} />}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Notas */}
        <Animated.View entering={FadeInDown.delay(260).springify()}>
          <SectionHeader label="Notas" icon="create-outline" accentColor={accentColor} />
          <Controller control={control} name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput style={{ ...INPUT_STYLE, minHeight: 80, textAlignVertical: 'top' }}
                placeholder="Ej: Confirmado por ecografía a los 45 días..."
                placeholderTextColor={Colors.textMuted}
                multiline onBlur={onBlur} onChangeText={onChange} value={value} />
            )} />
        </Animated.View>

        {/* Save button */}
        <Animated.View entering={FadeInDown.delay(320).springify()} style={{ marginTop: 28 }}>
          <Pressable
            onPress={handleSubmit((d) => mutation.mutate(d as unknown as FormData))}
            disabled={mutation.isPending}
            style={({ pressed }) => ({
              backgroundColor: accentColor,
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
              shadowColor: accentColor,
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
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  {isEditing ? 'Guardar cambios' : 'Registrar gestación'}
                </Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Delete button (edit mode only) */}
        {isEditing && (
          <Animated.View entering={FadeInDown.delay(380).springify()} style={{ marginTop: 12, marginBottom: 8 }}>
            <Pressable
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              style={({ pressed }) => ({
                borderWidth: 1.5,
                borderColor: Colors.danger,
                borderRadius: 14,
                padding: 16,
                alignItems: 'center',
                opacity: pressed || deleteMutation.isPending ? 0.7 : 1,
                backgroundColor: Colors.card,
              })}
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator color={Colors.danger} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  <Text style={{ color: Colors.danger, fontSize: 15, fontWeight: '700' }}>Eliminar gestación</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
