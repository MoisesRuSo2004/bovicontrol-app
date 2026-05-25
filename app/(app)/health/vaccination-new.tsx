import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOfflineMutation } from '../../../hooks/use-offline-mutation';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { z } from 'zod';
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';
import { Animal } from '../../../types/animal.types';
import { Vaccine } from '../../../types/health.types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const OTHER_ID = '__other__';

const schema = z.object({
  animalId:    z.string().min(1, 'Selecciona un animal'),
  vaccineId:   z.string().min(1, 'Selecciona una vacuna'),
  appliedDate: z.string().min(1, 'La fecha de aplicación es requerida'),
  nextDueDate: z.string().optional(),
  doseMl:      z.number().positive().optional(),
  batchNumber: z.string().optional(),
  notes:       z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ─── Theme ────────────────────────────────────────────────────────────────────

const A       = '#d97706';
const A_LIGHT = '#fef3c7';
const A_DARK  = '#92400e';

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4, marginLeft: 2 }}>{message}</Text>;
}

function InfoIcon({ text }: { text: string }) {
  return (
    <Pressable
      onPress={() => Alert.alert('ℹ️ Información', text, [{ text: 'Entendido' }])}
      hitSlop={10}
      style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="information" size={12} color={Colors.textMuted} />
    </Pressable>
  );
}

function SectionLabel({
  icon, label, optional, info,
}: { icon: string; label: string; optional?: boolean; info?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <View style={{ width: 3, height: 16, backgroundColor: A, borderRadius: 2 }} />
      <Ionicons name={icon as any} size={14} color={A} />
      <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.text }}>{label}</Text>
      {optional && <Text style={{ fontSize: 12, color: Colors.textMuted }}>(opcional)</Text>}
      {info && <InfoIcon text={info} />}
    </View>
  );
}

function FieldLabel({
  label, optional, info,
}: { label: string; optional?: boolean; info?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textMuted }}>{label}</Text>
      {!optional && <Text style={{ fontSize: 11, color: Colors.danger }}>*</Text>}
      {info && <InfoIcon text={info} />}
    </View>
  );
}

// ─── DatePickerModal ──────────────────────────────────────────────────────────

const PICKER_ITEM_H = 44;
const PICKER_VISIBLE = 5; // cuántos items se ven a la vez
const PICKER_H = PICKER_ITEM_H * PICKER_VISIBLE; // 220

// PickerCol debe estar FUERA del componente padre para que React no lo desmonte en cada render
function PickerCol({
  data, selected, onSelect, accentColor, visible,
}: {
  data: (number | { label: string; value: number })[];
  selected: number;
  onSelect: (v: number) => void;
  accentColor: string;
  visible: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const idx = data.findIndex((d) => (typeof d === 'number' ? d : (d as any).value) === selected);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      ref.current?.scrollTo({ y: idx * PICKER_ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, [visible, idx]);

  return (
    <ScrollView
      ref={ref}
      style={{ height: PICKER_H }}
      contentContainerStyle={{ paddingVertical: PICKER_ITEM_H * 2 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={PICKER_ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={(e) => {
        const i = Math.round(e.nativeEvent.contentOffset.y / PICKER_ITEM_H);
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
              ref.current?.scrollTo({ y: data.findIndex((d) => (typeof d === 'number' ? d : (d as any).value) === v) * PICKER_ITEM_H, animated: true });
            }}
            style={{ height: PICKER_ITEM_H, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{
              fontSize: sel ? 18 : 15,
              fontWeight: sel ? '800' : '400',
              color: sel ? accentColor : Colors.textMuted,
            }}>
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
  pastYears = 20, futureYears = 0,
  accentColor = A,
}: {
  visible: boolean;
  value: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
  pastYears?: number;
  futureYears?: number;
  accentColor?: string;
}) {
  const now     = new Date();
  const parsed  = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(value + 'T12:00:00')
    : now;

  const [selYear,  setSelYear]  = useState(parsed.getFullYear());
  const [selMonth, setSelMonth] = useState(parsed.getMonth());
  const [selDay,   setSelDay]   = useState(parsed.getDate());

  // Reset al abrir con un nuevo valor
  useEffect(() => {
    if (visible) {
      const d = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(value + 'T12:00:00') : now;
      setSelYear(d.getFullYear());
      setSelMonth(d.getMonth());
      setSelDay(d.getDate());
    }
  }, [visible]);

  const currentYear  = now.getFullYear();
  const years  = Array.from({ length: pastYears + futureYears + 1 }, (_, i) => currentYear + futureYears - i);
  const months = MONTHS_ES.map((m, i) => ({ label: m, value: i }));
  const daysInMonth  = new Date(selYear, selMonth + 1, 0).getDate();
  const days   = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const safeDay = Math.min(selDay, daysInMonth);

  const preview = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;

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
            <View style={{ backgroundColor: accentColor + '22', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: accentColor }}>{preview}</Text>
            </View>
          </View>

          {/* Columnas — altura explícita para que no colapsen */}
          <View style={{ flexDirection: 'row', height: PICKER_H, position: 'relative' }}>
            {/* Franja de selección */}
            <View style={{
              position: 'absolute', left: 0, right: 0,
              top: PICKER_ITEM_H * 2, height: PICKER_ITEM_H,
              backgroundColor: accentColor + '18',
              borderRadius: 12,
            }} />

            {/* Día */}
            <View style={{ flex: 1 }}>
              <PickerCol data={days} selected={safeDay} onSelect={setSelDay} accentColor={accentColor} visible={visible} />
            </View>

            {/* Mes */}
            <View style={{ flex: 2 }}>
              <PickerCol data={months} selected={selMonth} onSelect={setSelMonth} accentColor={accentColor} visible={visible} />
            </View>

            {/* Año */}
            <View style={{ flex: 2 }}>
              <PickerCol data={years} selected={selYear} onSelect={setSelYear} accentColor={accentColor} visible={visible} />
            </View>
          </View>

          {/* Etiquetas debajo de las columnas */}
          <View style={{ flexDirection: 'row', marginTop: 4, marginBottom: 20 }}>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Día</Text>
            <Text style={{ flex: 2, textAlign: 'center', fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Mes</Text>
            <Text style={{ flex: 2, textAlign: 'center', fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Año</Text>
          </View>

          {/* Botones */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={onClose}
              style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '700', color: Colors.textMuted }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => { onConfirm(preview); onClose(); }}
              style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: accentColor, alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Confirmar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── DateField ────────────────────────────────────────────────────────────────

function DateField({
  label, value, onChange, error, optional, info, futureYears = 0, pastYears = 20,
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  error?: string; optional?: boolean; info?: string; futureYears?: number; pastYears?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <FieldLabel label={label} optional={optional} info={info} />
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 8,
          borderWidth: 1, borderColor: error ? Colors.danger : (value ? A : Colors.border),
          borderRadius: 12, backgroundColor: value ? A_LIGHT : Colors.gray[50],
          padding: 12, opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons name="calendar-outline" size={16} color={value ? A : Colors.textMuted} />
        <Text style={{ flex: 1, fontSize: 13, color: value ? A_DARK : Colors.textMuted, fontWeight: value ? '700' : '400' }}>
          {value || 'Seleccionar fecha'}
        </Text>
        {value
          ? <Pressable onPress={(e) => { e.stopPropagation?.(); onChange(''); }} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={A} />
            </Pressable>
          : <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
        }
      </Pressable>
      <FieldError message={error} />
      <DatePickerModal
        visible={open}
        value={value}
        onConfirm={onChange}
        onClose={() => setOpen(false)}
        futureYears={futureYears}
        pastYears={pastYears}
      />
    </View>
  );
}

// ─── AnimalSearch ─────────────────────────────────────────────────────────────

function AnimalSearch({
  value, onSelect, error, preloadedAnimal,
}: {
  value?: string;
  onSelect: (id: string, label: string) => void;
  error?: string;
  preloadedAnimal?: Animal | null;
}) {
  const [query, setQuery]             = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (preloadedAnimal && !selectedLabel) {
      const label = `${preloadedAnimal.tagNumber}${preloadedAnimal.name ? ` · ${preloadedAnimal.name}` : ''}`;
      setSelectedLabel(label);
      onSelect(preloadedAnimal.id, label);
    }
  }, [preloadedAnimal]);

  const { data, isFetching } = useQuery({
    queryKey: ['animals-search-vax', query],
    queryFn: () => api.get('/animals', { params: { search: query, limit: 5 } }).then((r) => r.data.data ?? []),
    enabled: showResults && query.length >= 1,
  });
  const animals: Animal[] = data ?? [];

  const handleSelect = (animal: Animal) => {
    const label = `${animal.tagNumber}${animal.name ? ` · ${animal.name}` : ''}`;
    setSelectedLabel(label); setQuery(''); setShowResults(false);
    onSelect(animal.id, label);
  };

  if (value && selectedLabel) {
    return (
      <Pressable
        onPress={() => { setSelectedLabel(''); onSelect('', ''); }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12, padding: 14, backgroundColor: Colors.primaryLight }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="cow" size={18} color={Colors.primary} />
          </View>
          <Text style={{ fontSize: 14, color: Colors.primary, fontWeight: '700', flex: 1 }} numberOfLines={1}>{selectedLabel}</Text>
        </View>
        <Ionicons name="close-circle" size={20} color={Colors.primary} />
      </Pressable>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: error ? Colors.danger : Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50] }}>
        <View style={{ paddingLeft: 14 }}><Ionicons name="search-outline" size={18} color={Colors.textMuted} /></View>
        <TextInput
          style={{ flex: 1, padding: 14, paddingLeft: 8, fontSize: 15, color: Colors.text }}
          placeholder="Buscar por arete o nombre..."
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={(t) => { setQuery(t); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
        />
        {isFetching && <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 12 }} />}
      </View>
      {showResults && query.length >= 1 && (
        <View style={{ backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginTop: 6, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
          {animals.length === 0 && !isFetching
            ? <View style={{ padding: 16, alignItems: 'center' }}><Text style={{ color: Colors.textMuted, fontSize: 13 }}>Sin resultados</Text></View>
            : animals.map((a, idx) => (
              <Pressable key={a.id} onPress={() => handleSelect(a)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: idx < animals.length - 1 ? 1 : 0, borderBottomColor: Colors.border, backgroundColor: pressed ? Colors.primaryLight : Colors.card })}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: a.sex === 'FEMALE' ? '#fce7f3' : '#dbeafe', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="cow" size={16} color={a.sex === 'FEMALE' ? '#be185d' : '#1d4ed8'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 14 }}>{a.tagNumber}</Text>
                  {a.name && <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{a.name}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </Pressable>
            ))
          }
        </View>
      )}
      <FieldError message={error} />
    </View>
  );
}

// ─── VaccinePicker ────────────────────────────────────────────────────────────

function VaccinePicker({
  value, onSelect, error, customName, onCustomNameChange,
}: {
  value?: string;
  onSelect: (id: string, name: string) => void;
  error?: string;
  customName: string;
  onCustomNameChange: (v: string) => void;
}) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['vaccines'],
    queryFn: () => api.get('/health/vaccines').then((r) => r.data.data ?? []),
  });

  const allVaccines: Vaccine[] = data ?? [];
  const vaccines = allVaccines.filter((v) =>
    !search || v.name.toLowerCase().includes(search.toLowerCase()),
  );

  const isOther = value === OTHER_ID;

  return (
    <View>
      {/* Search bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50], marginBottom: 10 }}>
        <View style={{ paddingLeft: 12 }}><Ionicons name="search-outline" size={16} color={Colors.textMuted} /></View>
        <TextInput
          style={{ flex: 1, padding: 12, paddingLeft: 8, fontSize: 14, color: Colors.text }}
          placeholder="Filtrar vacuna..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} style={{ paddingRight: 12 }}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator color={A} />
          <Text style={{ color: Colors.textMuted, fontSize: 13, marginTop: 8 }}>Cargando vacunas...</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {/* Vaccines list */}
          {vaccines.map((v) => {
            const selected = value === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => onSelect(v.id, v.name)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  padding: 14, borderRadius: 14,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? A : Colors.border,
                  backgroundColor: selected ? A_LIGHT : pressed ? Colors.gray[100] : Colors.gray[50],
                })}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: selected ? A + '25' : Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={selected ? A : Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: selected ? A_DARK : Colors.text }}>{v.name}</Text>
                  {v.manufacturer && (
                    <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>{v.manufacturer}</Text>
                  )}
                  {v.doseIntervalDays && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>Refuerzo cada {v.doseIntervalDays} días</Text>
                      <InfoIcon text="Intervalo recomendado por el fabricante entre dosis de esta vacuna. La próxima dosis se debería aplicar pasado ese tiempo." />
                    </View>
                  )}
                </View>
                {selected && (
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: A, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                )}
              </Pressable>
            );
          })}

          {/* Opción "Otro" */}
          {(!search || 'otro'.includes(search.toLowerCase())) && (
            <Pressable
              onPress={() => onSelect(OTHER_ID, '')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 14, borderRadius: 14,
                borderWidth: isOther ? 2 : 1,
                borderColor: isOther ? A : Colors.border,
                borderStyle: isOther ? 'solid' : 'dashed',
                backgroundColor: isOther ? A_LIGHT : pressed ? Colors.gray[100] : Colors.gray[50],
              })}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isOther ? A + '25' : Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add-circle-outline" size={20} color={isOther ? A : Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: isOther ? A_DARK : Colors.text }}>
                  Otro / Vacuna personalizada
                </Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>
                  Escribe el nombre si no aparece en la lista
                </Text>
              </View>
              {isOther && (
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: A, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
              )}
            </Pressable>
          )}

          {/* Campo libre cuando se selecciona "Otro" */}
          {isOther && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <View style={{ backgroundColor: A_LIGHT, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: A + '60' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Ionicons name="create-outline" size={14} color={A} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: A_DARK }}>Nombre de la vacuna</Text>
                  <Text style={{ fontSize: 12, color: Colors.danger }}>*</Text>
                </View>
                <TextInput
                  style={{ borderWidth: 1, borderColor: customName.trim() ? A : Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: '#fff' }}
                  placeholder="Ej: Brucelosis RB51, Carbón bacteridiano..."
                  placeholderTextColor={Colors.textMuted}
                  value={customName}
                  onChangeText={onCustomNameChange}
                  autoCapitalize="words"
                  autoFocus
                />
                <Text style={{ fontSize: 11, color: A_DARK, marginTop: 8, lineHeight: 16 }}>
                  💡 Esta vacuna se guardará en tu catálogo para usarla en futuros registros.
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Sin resultados en búsqueda */}
          {vaccines.length === 0 && search.length > 0 && (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Sin coincidencias — selecciona "Otro" para escribir el nombre</Text>
            </View>
          )}
        </View>
      )}

      <FieldError message={error} />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function VaccinationNewScreen() {
  const router  = useRouter();
  const qc      = useQueryClient();
  const insets  = useSafeAreaInsets();
  const { animalId: preloadAnimalId, vaccinationId } = useLocalSearchParams<{ animalId?: string; vaccinationId?: string }>();

  const isEditing = !!vaccinationId;
  const [customVaccineName, setCustomVaccineName] = useState('');
  const [formReady, setFormReady] = useState(!isEditing); // en edición esperamos a cargar datos

  const { data: preloadedAnimal } = useQuery<Animal>({
    queryKey: ['animal', preloadAnimalId],
    queryFn: () => api.get(`/animals/${preloadAnimalId}`).then((r) => r.data.data),
    enabled: !!preloadAnimalId,
  });

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      appliedDate: new Date().toISOString().split('T')[0],
      ...(preloadAnimalId ? { animalId: preloadAnimalId } : {}),
    },
  });

  // Cargar datos de la vacunación existente en modo edición
  const { data: existingVaccination, isLoading: loadingExisting } = useQuery({
    queryKey: ['vaccination', vaccinationId],
    queryFn: () => api.get(`/health/vaccinations/${vaccinationId}`).then((r) => r.data.data ?? r.data),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingVaccination && isEditing) {
      reset({
        animalId:    existingVaccination.animalId,
        vaccineId:   existingVaccination.vaccineId,
        appliedDate: existingVaccination.appliedDate?.slice(0, 10) ?? '',
        nextDueDate: existingVaccination.nextDueDate?.slice(0, 10) ?? '',
        doseMl:      existingVaccination.doseMl ?? undefined,
        batchNumber: existingVaccination.batchNumber ?? '',
        notes:       existingVaccination.notes ?? '',
      });
      setFormReady(true);
    }
  }, [existingVaccination]);

  const animalId  = watch('animalId');
  const vaccineId = watch('vaccineId');

  // Animal precargado en modo edición
  const animalForEdit = isEditing ? existingVaccination?.animal : undefined;
  const effectivePreloadedAnimal = preloadedAnimal ?? (animalForEdit ? {
    id: animalForEdit.id,
    tagNumber: animalForEdit.tagNumber,
    name: animalForEdit.name,
  } as Animal : undefined);

  const handleClose = () => {
    // vaccination-new es un modal → dismiss regresa exactamente a la pantalla anterior
    // (detalle del animal si venías de Animales, índice de Sanidad si venías de allá)
    if (router.canDismiss()) router.dismiss();
    else router.back();
  };

  // ── Save mutation (create o update) ──
  const mutation = useOfflineMutation({
    mutationFn: async (data: FormData) => {
      let finalVaccineId = data.vaccineId;

      if (data.vaccineId === OTHER_ID) {
        if (!customVaccineName.trim()) throw new Error('Escribe el nombre de la vacuna');
        const res = await api.post('/health/vaccines', { name: customVaccineName.trim() });
        finalVaccineId = res.data.data?.id ?? res.data.id;
        qc.invalidateQueries({ queryKey: ['vaccines'] });
      }

      const payload = { ...data, vaccineId: finalVaccineId };
      Object.keys(payload).forEach((k) => {
        if ((payload as any)[k] === '' || (payload as any)[k] === undefined) delete (payload as any)[k];
      });

      if (isEditing) {
        return api.patch(`/health/vaccinations/${vaccinationId}`, payload);
      }
      return api.post('/health/vaccinations', payload);
    },
    offline: {
      url:      (data) => isEditing ? `/health/vaccinations/${vaccinationId}` : '/health/vaccinations',
      method:   isEditing ? 'PATCH' : 'POST',
      getData:  (data) => ({ ...data }),
      getLabel: (data) => `Vacuna ${(data as any).vaccineId ?? ''} — ${(data as any).appliedDate ?? ''}`,
      invalidateKeys: [['health', 'vaccinations'], ['health', 'alerts']],
    },
    onSuccess: () => {
      const targetAnimalId = preloadAnimalId ?? existingVaccination?.animalId;
      qc.invalidateQueries({ queryKey: ['health', 'vaccinations'] });
      qc.invalidateQueries({ queryKey: ['health', 'alerts'] });
      qc.invalidateQueries({ queryKey: ['vaccination', vaccinationId] });
      if (targetAnimalId) {
        qc.invalidateQueries({ queryKey: ['animal', targetAnimalId, 'vaccinations'] });
        qc.invalidateQueries({ queryKey: ['animal', targetAnimalId] });
      }
      Toast.show({ type: 'success', text1: isEditing ? 'Vacunación actualizada' : 'Vacunación registrada' });
      handleClose();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/health/vaccinations/${vaccinationId}`),
    onSuccess: () => {
      const targetAnimalId = preloadAnimalId ?? existingVaccination?.animalId;
      qc.invalidateQueries({ queryKey: ['health', 'vaccinations'] });
      if (targetAnimalId) {
        qc.invalidateQueries({ queryKey: ['animal', targetAnimalId, 'vaccinations'] });
        qc.invalidateQueries({ queryKey: ['animal', targetAnimalId] });
      }
      Toast.show({ type: 'success', text1: 'Vacunación eliminada' });
      handleClose();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error al eliminar', text2: getErrorMessage(e) }),
  });

  const handleDelete = () => {
    Alert.alert(
      'Eliminar vacunación',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  };

  const onInvalid = () => {
    if (vaccineId === OTHER_ID && !customVaccineName.trim()) {
      Toast.show({ type: 'error', text1: 'Falta el nombre', text2: 'Escribe el nombre de la vacuna personalizada' });
      return;
    }
    Toast.show({ type: 'error', text1: 'Revisa el formulario', text2: 'Hay campos requeridos sin completar' });
  };

  const handleSubmitForm = handleSubmit((d) => {
    if (d.vaccineId === OTHER_ID && !customVaccineName.trim()) {
      Toast.show({ type: 'error', text1: 'Falta el nombre', text2: 'Escribe el nombre de la vacuna personalizada' });
      return;
    }
    mutation.mutate(d as unknown as FormData);
  }, onInvalid);

  const isBusy = mutation.isPending || deleteMutation.isPending;

  // Pantalla de carga en modo edición mientras llegan los datos
  if (isEditing && (loadingExisting || !formReady)) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={{ backgroundColor: A_LIGHT, borderBottomWidth: 1, borderBottomColor: '#fde68a', paddingTop: insets.top + 10, paddingBottom: 18, paddingHorizontal: 20 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: A + '50', marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: A + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="shield-checkmark-outline" size={26} color={A} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: A_DARK }}>Editar Vacunación</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={12} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: A + '15', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color={A} />
            </Pressable>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={A} />
          <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Cargando vacunación...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: A_LIGHT,
        borderBottomWidth: 1,
        borderBottomColor: '#fde68a',
        paddingTop: insets.top + 10,
        paddingBottom: 18,
        paddingHorizontal: 20,
      }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: A + '50', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: A + '18', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={isEditing ? 'create-outline' : 'shield-checkmark-outline'} size={26} color={A} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: A_DARK }}>
              {isEditing ? 'Editar Vacunación' : 'Registrar Vacunación'}
            </Text>
            <Text style={{ fontSize: 12, color: A, marginTop: 2, fontWeight: '500' }}>Control sanitario del animal</Text>
          </View>
          {/* Botón eliminar — solo en edición */}
          {isEditing && (
            <Pressable
              onPress={handleDelete}
              disabled={isBusy}
              hitSlop={8}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.danger + '15', alignItems: 'center', justifyContent: 'center' }}
            >
              {deleteMutation.isPending
                ? <ActivityIndicator size="small" color={Colors.danger} />
                : <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              }
            </Pressable>
          )}
          <Pressable onPress={handleClose} hitSlop={12}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: A + '15', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color={A} />
          </Pressable>
        </View>
      </View>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          bounces
        >
          {/* ── Animal ── */}
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <SectionLabel icon="paw-outline" label="Animal *" />
            <AnimalSearch
              value={animalId}
              onSelect={(id) => setValue('animalId', id, { shouldValidate: true })}
              error={errors.animalId?.message}
              preloadedAnimal={effectivePreloadedAnimal}
            />
          </Animated.View>

          {/* ── Vacuna ── */}
          <Animated.View entering={FadeInDown.delay(120).springify()} style={{ marginTop: 24 }}>
            <SectionLabel
              icon="shield-checkmark-outline"
              label="Vacuna *"
              info="Selecciona la vacuna aplicada. Si no aparece en la lista, usa la opción 'Otro' para escribir el nombre."
            />
            <VaccinePicker
              value={vaccineId}
              onSelect={(id) => setValue('vaccineId', id, { shouldValidate: true })}
              error={errors.vaccineId?.message}
              customName={customVaccineName}
              onCustomNameChange={setCustomVaccineName}
            />
          </Animated.View>

          {/* ── Fechas ── */}
          <Animated.View entering={FadeInDown.delay(180).springify()} style={{ marginTop: 24 }}>
            <SectionLabel icon="calendar-outline" label="Fechas" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Controller
                control={control}
                name="appliedDate"
                render={({ field: { onChange, value } }) => (
                  <DateField
                    label="Fecha de aplicación"
                    value={value ?? ''}
                    onChange={onChange}
                    error={errors.appliedDate?.message}
                    pastYears={20}
                    futureYears={0}
                  />
                )}
              />
              <Controller
                control={control}
                name="nextDueDate"
                render={({ field: { onChange, value } }) => (
                  <DateField
                    label="Próxima dosis"
                    value={value ?? ''}
                    onChange={onChange}
                    optional
                    info="Fecha en que se debe aplicar el siguiente refuerzo de esta vacuna. Puedes seleccionar fechas futuras."
                    futureYears={5}
                    pastYears={2}
                  />
                )}
              />
            </View>
          </Animated.View>

          {/* ── Detalles ── */}
          <Animated.View entering={FadeInDown.delay(240).springify()} style={{ marginTop: 24 }}>
            <SectionLabel
              icon="flask-outline"
              label="Detalles de aplicación"
              optional
              info="Información adicional sobre la dosis aplicada. Útil para trazabilidad y seguimiento veterinario."
            />

            {/* Dosis + Lote */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel
                  label="Dosis"
                  optional
                  info="Cantidad en mililitros (ml) de vacuna aplicada en esta dosis. Lo indica el frasco o el veterinario."
                />
                <Controller
                  control={control}
                  name="doseMl"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50] }}>
                      <View style={{ paddingLeft: 12 }}>
                        <Ionicons name="beaker-outline" size={16} color={Colors.textMuted} />
                      </View>
                      <TextInput
                        style={{ flex: 1, padding: 12, paddingLeft: 8, fontSize: 15, color: Colors.text }}
                        placeholder="0.0"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                        onBlur={onBlur}
                        onChangeText={(t) => onChange(t ? parseFloat(t.replace(',', '.')) : undefined)}
                        value={value?.toString() ?? ''}
                      />
                      <Text style={{ paddingRight: 12, fontSize: 13, color: Colors.textMuted, fontWeight: '600' }}>ml</Text>
                    </View>
                  )}
                />
              </View>

              <View style={{ flex: 1 }}>
                <FieldLabel
                  label="N° de lote"
                  optional
                  info="Número de lote del producto. Lo encontrarás impreso en el frasco o caja de la vacuna. Importante para retiros del mercado y trazabilidad."
                />
                <Controller
                  control={control}
                  name="batchNumber"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50] }}>
                      <View style={{ paddingLeft: 12 }}>
                        <Ionicons name="barcode-outline" size={16} color={Colors.textMuted} />
                      </View>
                      <TextInput
                        style={{ flex: 1, padding: 12, paddingLeft: 8, fontSize: 14, color: Colors.text }}
                        placeholder="LOTE-24A"
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="characters"
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                      />
                    </View>
                  )}
                />
              </View>
            </View>

            {/* Notas */}
            <FieldLabel
              label="Observaciones"
              optional
              info="Puedes registrar: reacciones del animal, lugar de aplicación (cuello, anca...), condición del animal, o cualquier dato relevante para el historial."
            />
            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.text, backgroundColor: Colors.gray[50], minHeight: 90, textAlignVertical: 'top' }}
                  placeholder="Ej: Aplicada en cuello izquierdo. Animal sin reacciones adversas..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
          </Animated.View>

          {/* ── Submit ── */}
          <Animated.View entering={FadeInDown.delay(300).springify()} style={{ marginTop: 28 }}>
            <Pressable
              onPress={handleSubmitForm}
              disabled={isBusy}
              style={({ pressed }) => ({
                backgroundColor: A,
                borderRadius: 16, padding: 18,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10,
                shadowColor: A, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
                opacity: pressed || isBusy ? 0.78 : 1,
              })}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name={isEditing ? 'save-outline' : 'shield-checkmark-outline'} size={22} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                    {isEditing ? 'Guardar cambios' : 'Registrar vacunación'}
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
