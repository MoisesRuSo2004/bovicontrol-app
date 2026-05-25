import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { useState } from 'react';
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';
import { Animal } from '../../../types/animal.types';
import { Medication } from '../../../types/health.types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const AMBER      = '#d97706';
const AMBER_LIGHT = '#fef3c7';
const AMBER_DARK  = '#92400e';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  animalId:     z.string().uuid('Selecciona un animal'),
  diagnosis:    z.string().min(1, 'El diagnostico es requerido'),
  medicationId: z.string().uuid().optional().or(z.literal('')),
  startDate:    z.string().min(1, 'La fecha de inicio es requerida'),
  endDate:      z.string().optional(),
  dosage:       z.number().positive().optional(),
  dosageUnit:   z.string().optional(),
  frequency:    z.string().optional(),
  notes:        z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ─── Estilos compartidos ──────────────────────────────────────────────────────

const INPUT_STYLE = {
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: 12,
  padding: 14,
  fontSize: 15,
  backgroundColor: Colors.gray[50],
  color: Colors.text,
} as const;

const INPUT_ERROR_STYLE = {
  ...INPUT_STYLE,
  borderColor: Colors.danger,
} as const;

// ─── Componentes de UI ────────────────────────────────────────────────────────

function SectionHeader({ label, icon }: { label: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 }}>
      <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: AMBER }} />
      {icon && <Ionicons name={icon} size={14} color={AMBER} />}
      <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>{label}</Text>
    </View>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.gray[600], marginBottom: 6, marginTop: 12 }}>
      {label}{required ? <Text style={{ color: Colors.danger }}> *</Text> : null}
    </Text>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
      <Ionicons name="alert-circle-outline" size={13} color={Colors.danger} />
      <Text style={{ color: Colors.danger, fontSize: 12 }}>{message}</Text>
    </View>
  );
}

// ─── AnimalSearch ─────────────────────────────────────────────────────────────

function AnimalSearch({ value, onSelect, error }: { value?: string; onSelect: (id: string) => void; error?: string }) {
  const [query, setQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [showResults, setShowResults] = useState(false);

  const { data } = useQuery({
    queryKey: ['animals', { search: query }],
    queryFn: () => api.get('/animals', { params: { search: query, limit: 5 } }).then((r) => r.data.data ?? []),
    enabled: showResults && query.length >= 1,
  });

  const animals: Animal[] = data ?? [];

  const handleSelect = (animal: Animal) => {
    const label = `${animal.tagNumber}${animal.name ? ` · ${animal.name}` : ''}`;
    setSelectedLabel(label);
    setQuery('');
    setShowResults(false);
    onSelect(animal.id);
  };

  return (
    <View>
      {value && selectedLabel ? (
        <Pressable
          onPress={() => { setSelectedLabel(''); onSelect(''); }}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            borderWidth: 1.5, borderColor: AMBER, borderRadius: 12,
            padding: 14, backgroundColor: AMBER_LIGHT,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: AMBER + '20', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="cow" size={16} color={AMBER} />
            </View>
            <Text style={{ fontSize: 14, color: AMBER_DARK, fontWeight: '700' }}>{selectedLabel}</Text>
          </View>
          <Ionicons name="close-circle" size={18} color={AMBER} />
        </Pressable>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: error ? Colors.danger : Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50] }}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={{ marginLeft: 14 }} />
            <TextInput
              style={{ flex: 1, padding: 14, fontSize: 15, color: Colors.text }}
              placeholder="Buscar por arete o nombre..."
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={(t) => { setQuery(t); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
            />
          </View>
          {showResults && query.length >= 1 && animals.length > 0 && (
            <View style={{ backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginTop: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 }}>
              {animals.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => handleSelect(a)}
                  style={({ pressed }) => ({ padding: 13, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: pressed ? AMBER_LIGHT : Colors.card, flexDirection: 'row', alignItems: 'center', gap: 10 })}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="cow" size={16} color={Colors.textMuted} />
                  </View>
                  <View>
                    <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 14 }}>{a.tagNumber}</Text>
                    {a.name && <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{a.name}</Text>}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
      <FieldError message={error} />
    </View>
  );
}

// ─── MedicationPicker ─────────────────────────────────────────────────────────

function MedicationPicker({ value, onSelect }: { value?: string; onSelect: (id: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['medications'],
    queryFn: () => api.get('/health/medications').then((r) => r.data.data ?? []),
  });

  const meds: Medication[] = data ?? [];

  if (isLoading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <ActivityIndicator color={AMBER} size="small" />
        <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 8 }}>Cargando medicamentos...</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {/* Sin medicamento */}
      <Pressable
        onPress={() => onSelect('')}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 12,
          padding: 14, borderRadius: 12, borderWidth: 1.5,
          borderColor: !value ? AMBER : Colors.border,
          backgroundColor: !value ? AMBER_LIGHT : Colors.gray[50],
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: !value ? AMBER + '20' : Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close-circle-outline" size={20} color={!value ? AMBER : Colors.textMuted} />
        </View>
        <Text style={{ fontWeight: '600', fontSize: 14, color: !value ? AMBER_DARK : Colors.textMuted, flex: 1 }}>
          Sin medicamento especifico
        </Text>
        {!value && <Ionicons name="checkmark-circle" size={20} color={AMBER} />}
      </Pressable>

      {meds.map((m) => {
        const active = value === m.id;
        return (
          <Pressable
            key={m.id}
            onPress={() => onSelect(m.id)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 12,
              padding: 14, borderRadius: 12, borderWidth: 1.5,
              borderColor: active ? AMBER : Colors.border,
              backgroundColor: active ? AMBER_LIGHT : Colors.gray[50],
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: active ? AMBER + '20' : Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="needle" size={18} color={active ? AMBER : Colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: active ? AMBER_DARK : Colors.text }}>{m.name}</Text>
              {m.activeIngredient && (
                <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>{m.activeIngredient}</Text>
              )}
            </View>
            {active && <Ionicons name="checkmark-circle" size={20} color={AMBER} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function TreatmentNewScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { startDate: new Date().toISOString().split('T')[0] },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const clean = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined),
      );
      return api.post('/health/treatments', clean);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health', 'treatments'] });
      Toast.show({ type: 'success', text1: 'Tratamiento registrado' });
      router.back();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const animalId = watch('animalId');
  const medicationId = watch('medicationId');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* ── Header modal unificado ── */}
      <View style={{
        backgroundColor: AMBER_LIGHT,
        borderBottomWidth: 1,
        borderBottomColor: '#fde68a',
        paddingTop: 10,
        paddingBottom: 16,
        paddingHorizontal: 20,
      }}>
        {/* Drag handle */}
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: AMBER + '50' }} />
        </View>
        {/* Titulo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: AMBER + '18', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="needle" size={26} color={AMBER} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: AMBER_DARK }}>Nuevo Tratamiento</Text>
            <Text style={{ fontSize: 12, color: AMBER, marginTop: 1 }}>Diagnostico y medicacion</Text>
          </View>
          <Pressable onPress={() => router.back()} style={{ padding: 6 }}>
            <Ionicons name="close" size={22} color={AMBER} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Animal ── */}
        <Animated.View entering={FadeInDown.delay(0)}>
          <SectionHeader label="Animal" icon="paw-outline" />
          <AnimalSearch
            value={animalId}
            onSelect={(id) => setValue('animalId', id)}
            error={errors.animalId?.message}
          />
        </Animated.View>

        {/* ── Diagnostico ── */}
        <Animated.View entering={FadeInDown.delay(80)}>
          <SectionHeader label="Diagnostico" icon="document-text-outline" />
          <Controller
            control={control}
            name="diagnosis"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{
                  ...(errors.diagnosis ? INPUT_ERROR_STYLE : INPUT_STYLE),
                  minHeight: 90,
                  textAlignVertical: 'top',
                }}
                placeholder="Ej: Mastitis aguda, cojera, fiebre de leche..."
                placeholderTextColor={Colors.textMuted}
                multiline
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          <FieldError message={errors.diagnosis?.message} />
        </Animated.View>

        {/* ── Medicamento ── */}
        <Animated.View entering={FadeInDown.delay(160)}>
          <SectionHeader label="Medicamento" icon="medkit-outline" />
          <MedicationPicker
            value={medicationId}
            onSelect={(id) => setValue('medicationId', id)}
          />
        </Animated.View>

        {/* ── Fechas ── */}
        <Animated.View entering={FadeInDown.delay(240)}>
          <SectionHeader label="Periodo de tratamiento" icon="calendar-outline" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Fecha inicio" required />
              <Controller
                control={control}
                name="startDate"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={errors.startDate ? INPUT_ERROR_STYLE : INPUT_STYLE}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.textMuted}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              <FieldError message={errors.startDate?.message} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Fecha fin" />
              <Controller
                control={control}
                name="endDate"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={INPUT_STYLE}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.textMuted}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
            </View>
          </View>
        </Animated.View>

        {/* ── Dosis ── */}
        <Animated.View entering={FadeInDown.delay(300)}>
          <SectionHeader label="Dosis y frecuencia" icon="flask-outline" />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Cantidad" />
              <Controller
                control={control}
                name="dosage"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={INPUT_STYLE}
                    placeholder="0.0"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    onBlur={onBlur}
                    onChangeText={(t) => onChange(t ? parseFloat(t) : undefined)}
                    value={value?.toString() ?? ''}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Unidad" />
              <Controller
                control={control}
                name="dosageUnit"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={INPUT_STYLE}
                    placeholder="ml, mg, cc..."
                    placeholderTextColor={Colors.textMuted}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
            </View>
          </View>

          <FieldLabel label="Frecuencia" />
          <Controller
            control={control}
            name="frequency"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50] }}>
                <Ionicons name="time-outline" size={18} color={Colors.textMuted} style={{ marginLeft: 14 }} />
                <TextInput
                  style={{ flex: 1, padding: 14, fontSize: 15, color: Colors.text }}
                  placeholder="Ej: Cada 24h por 5 dias"
                  placeholderTextColor={Colors.textMuted}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              </View>
            )}
          />
        </Animated.View>

        {/* ── Notas ── */}
        <Animated.View entering={FadeInDown.delay(360)}>
          <SectionHeader label="Notas" icon="create-outline" />
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{ ...INPUT_STYLE, minHeight: 90, textAlignVertical: 'top' }}
                placeholder="Observaciones adicionales, evolucion del paciente..."
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
        <Animated.View entering={FadeInDown.delay(420)} style={{ marginTop: 28 }}>
          <Pressable
            onPress={handleSubmit((d) => mutation.mutate(d as unknown as FormData))}
            disabled={mutation.isPending}
            style={({ pressed }) => ({
              backgroundColor: AMBER,
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
              shadowColor: AMBER,
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
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Registrar tratamiento</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
