import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';
import { CostCategory } from '../../../types/finance.types';

// ─── Colors ───────────────────────────────────────────────────────────────────

const RED       = '#ef4444';
const RED_LIGHT = '#fee2e2';
const RED_DARK  = '#7f1d1d';

// ─── Data ─────────────────────────────────────────────────────────────────────

const COST_OPTIONS: { value: CostCategory; label: string; icon: string }[] = [
  { value: 'FEED',             label: 'Alimentación',    icon: 'leaf-outline' },
  { value: 'VETERINARY',      label: 'Veterinaria',     icon: 'medkit-outline' },
  { value: 'LABOR',           label: 'Mano de obra',    icon: 'people-outline' },
  { value: 'MEDICINE',        label: 'Medicamentos',    icon: 'flask-outline' },
  { value: 'EQUIPMENT',       label: 'Equipos',         icon: 'construct-outline' },
  { value: 'INFRASTRUCTURE',  label: 'Infraestructura', icon: 'business-outline' },
  { value: 'TRANSPORT',       label: 'Transporte',      icon: 'car-outline' },
  { value: 'SEED_FERTILIZER', label: 'Semillas/Abonos', icon: 'flower-outline' },
  { value: 'OTHER',           label: 'Otros',           icon: 'ellipsis-horizontal-outline' },
];

const schema = z.object({
  category:    z.enum(['FEED','VETERINARY','LABOR','INFRASTRUCTURE','EQUIPMENT','TRANSPORT','MEDICINE','SEED_FERTILIZER','OTHER']),
  description: z.string().min(1, 'La descripción es requerida'),
  costDate:    z.string().min(1, 'La fecha es requerida'),
  amount:      z.number().positive('El monto debe ser mayor a 0'),
  supplier:    z.string().optional(),
  reference:   z.string().optional(),
  notes:       z.string().optional(),
});
type CostForm = z.infer<typeof schema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convierte número a string con separador de miles es-CO: 1500000 → "1.500.000" */
function toAmt(n: number | undefined): string {
  if (n == null || isNaN(n)) return '';
  return Math.round(n).toLocaleString('es-CO');
}
/** Limpia separadores y parsea a entero: "1.500.000" → 1500000 */
function fromAmt(text: string): number | undefined {
  const digits = text.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : undefined;
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

function FE({ msg }: { msg?: string }) {
  return msg ? <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>{msg}</Text> : null;
}

function SectionHeader({ label, icon }: { label: string; icon?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 20, gap: 8 }}>
      <View style={{ width: 3, height: 18, backgroundColor: RED, borderRadius: 2 }} />
      {icon && <Ionicons name={icon as any} size={14} color={RED} />}
      <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.text }}>{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CostNewScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { costId } = useLocalSearchParams<{ costId?: string }>();
  const isEditing = !!costId;

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<CostForm>({
    resolver: zodResolver(schema) as any,
    defaultValues: { costDate: new Date().toISOString().split('T')[0], category: 'FEED' },
  });

  // Load existing data in edit mode
  const { data: existing } = useQuery({
    queryKey: ['finance', 'cost', costId],
    queryFn: () => api.get(`/finance/costs/${costId}`).then((r) => r.data.data),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existing) {
      reset({
        category:    existing.category,
        description: existing.description,
        costDate:    existing.costDate?.split('T')[0] ?? existing.costDate,
        amount:      existing.amount,
        supplier:    existing.supplier ?? '',
        reference:   existing.reference ?? '',
        notes:       existing.notes ?? '',
      });
    }
  }, [existing, reset]);

  const dismiss = () => (router.canDismiss() ? router.dismiss() : router.back());

  const saveMutation = useMutation({
    mutationFn: (data: CostForm) => {
      const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined));
      return isEditing
        ? api.patch(`/finance/costs/${costId}`, clean)
        : api.post('/finance/costs', clean);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      Toast.show({ type: 'success', text1: isEditing ? 'Gasto actualizado' : 'Gasto registrado' });
      dismiss();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/finance/costs/${costId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      Toast.show({ type: 'success', text1: 'Gasto eliminado' });
      dismiss();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error al eliminar', text2: getErrorMessage(e) }),
  });

  const confirmDelete = () => {
    Alert.alert('Eliminar gasto', '¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  const selectedCategory = watch('category');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Header */}
      <View style={{ backgroundColor: RED_LIGHT, borderBottomWidth: 1, borderBottomColor: '#fca5a5', paddingTop: 10, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: RED + '50' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: RED + '18', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="trending-down" size={24} color={RED} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: RED_DARK }}>
              {isEditing ? 'Editar Gasto' : 'Registrar Gasto'}
            </Text>
            <Text style={{ fontSize: 12, color: RED, marginTop: 1 }}>Costo operacional</Text>
          </View>
          {isEditing && (
            <Pressable onPress={confirmDelete} disabled={deleteMutation.isPending} style={{ padding: 6, marginRight: 4 }}>
              <Ionicons name="trash-outline" size={20} color={RED} />
            </Pressable>
          )}
          <Pressable onPress={dismiss} style={{ padding: 6 }}>
            <Ionicons name="close" size={22} color={RED} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Aviso explicativo */}
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: RED_LIGHT, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#fca5a5', marginTop: 8 }}>
            <Ionicons name="information-circle" size={20} color={RED} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: RED_DARK, marginBottom: 4 }}>
                ¿Cuándo usar "Gasto"?
              </Text>
              <Text style={{ fontSize: 12, color: '#991b1b', lineHeight: 18 }}>
                Cualquier dinero que <Text style={{ fontWeight: '700' }}>sale de la finca</Text> para operarla.{'\n'}
                • Concentrado, sal, forraje → <Text style={{ fontWeight: '700' }}>Alimentación</Text>{'\n'}
                • Vacunas, consultas → <Text style={{ fontWeight: '700' }}>Veterinario / Medicamentos</Text>{'\n'}
                • Jornales, empleados → <Text style={{ fontWeight: '700' }}>Mano de obra</Text>{'\n'}
                • Cercas, corrales, bebederos → <Text style={{ fontWeight: '700' }}>Infraestructura</Text>
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Categoría */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <SectionHeader label="Categoría *" icon="pricetag-outline" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {COST_OPTIONS.map((opt) => {
              const active = selectedCategory === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setValue('category', opt.value)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: active ? RED_LIGHT : Colors.gray[50],
                    borderWidth: 1.5, borderColor: active ? RED : Colors.border,
                  }}
                >
                  <Ionicons name={opt.icon as any} size={13} color={active ? RED : Colors.textMuted} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: active ? RED : Colors.text }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <FE msg={errors.category?.message} />
        </Animated.View>

        {/* Descripción */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <SectionHeader label="Descripción *" icon="document-text-outline" />
          <Controller control={control} name="description" render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={{ ...INPUT_STYLE, borderColor: errors.description ? Colors.danger : Colors.border, minHeight: 80, textAlignVertical: 'top' }}
              placeholder="Ej: Compra de concentrado 40kg..."
              placeholderTextColor={Colors.textMuted}
              multiline
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )} />
          <FE msg={errors.description?.message} />
        </Animated.View>

        {/* Fecha */}
        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <SectionHeader label="Fecha *" icon="calendar-outline" />
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: errors.costDate ? Colors.danger : Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50], overflow: 'hidden' }}>
            <View style={{ paddingLeft: 14, paddingRight: 8 }}>
              <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
            </View>
            <Controller control={control} name="costDate" render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{ flex: 1, padding: 14, paddingLeft: 0, fontSize: 15, color: Colors.text }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )} />
          </View>
          <FE msg={errors.costDate?.message} />
        </Animated.View>

        {/* Monto */}
        <Animated.View entering={FadeInDown.delay(240).springify()}>
          <View style={{ marginTop: 20, backgroundColor: RED_LIGHT, borderRadius: 16, padding: 20, borderWidth: 2, borderColor: RED + '60' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Ionicons name="trending-down" size={16} color={RED} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: RED }}>Monto total (COP) *</Text>
            </View>
            <Controller control={control} name="amount" render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{ fontSize: 32, fontWeight: '800', color: RED, textAlign: 'center', padding: 4 }}
                placeholder="0"
                placeholderTextColor={RED + '60'}
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={(t) => onChange(fromAmt(t))}
                value={toAmt(value)}
              />
            )} />
            <FE msg={errors.amount?.message} />
          </View>
        </Animated.View>

        {/* Proveedor y referencia */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <SectionHeader label="Proveedor y referencia" icon="storefront-outline" />
          <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50], overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 14, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
              <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
              <Controller control={control} name="supplier" render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={{ flex: 1, padding: 14, paddingLeft: 10, fontSize: 15, color: Colors.text }}
                  placeholder="Nombre del proveedor"
                  placeholderTextColor={Colors.textMuted}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 14 }}>
              <Ionicons name="receipt-outline" size={16} color={Colors.textMuted} />
              <Controller control={control} name="reference" render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={{ flex: 1, padding: 14, paddingLeft: 10, fontSize: 15, color: Colors.text }}
                  placeholder="Factura / Referencia (Ej: FAC-001)"
                  placeholderTextColor={Colors.textMuted}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )} />
            </View>
          </View>
        </Animated.View>

        {/* Notas */}
        <Animated.View entering={FadeInDown.delay(360).springify()}>
          <SectionHeader label="Notas" icon="create-outline" />
          <Controller control={control} name="notes" render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={{ ...INPUT_STYLE, minHeight: 80, textAlignVertical: 'top' }}
              placeholder="Observaciones adicionales..."
              placeholderTextColor={Colors.textMuted}
              multiline
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )} />
        </Animated.View>

        {/* Submit */}
        <Animated.View entering={FadeInDown.delay(420).springify()} style={{ marginTop: 28, marginBottom: 8 }}>
          <Pressable
            onPress={handleSubmit((d) => saveMutation.mutate(d as unknown as CostForm))}
            disabled={saveMutation.isPending}
            style={({ pressed }) => ({
              backgroundColor: RED, borderRadius: 14, padding: 16, alignItems: 'center',
              shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
              opacity: pressed || saveMutation.isPending ? 0.75 : 1,
            })}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  {isEditing ? 'Guardar cambios' : 'Registrar gasto'}
                </Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
