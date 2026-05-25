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
import { IncomeCategory } from '../../../types/finance.types';

// ─── Colors ───────────────────────────────────────────────────────────────────

const PURPLE       = '#7c3aed';
const PURPLE_LIGHT = '#ede9fe';
const PURPLE_DARK  = '#4c1d95';

// ─── Data ─────────────────────────────────────────────────────────────────────

// Solo categorías que NO son ventas directas de productos.
// Las ventas de animales/carne/subproductos van en "Nueva Venta" (con cantidad, precio y comprador).
// La leche va en el módulo Leche.
const INCOME_OPTIONS: { value: IncomeCategory; label: string; icon: string; hint: string }[] = [
  { value: 'SUBSIDY',  label: 'Subsidio / Ayuda',  icon: 'cash-outline',              hint: 'Apoyo gubernamental, bono, transferencia' },
  { value: 'OTHER',    label: 'Otro ingreso',       icon: 'ellipsis-horizontal-outline', hint: 'Alquiler de potreros, servicios, etc.' },
];

const schema = z.object({
  category:    z.enum(['ANIMAL_SALE','MILK_SALE','MEAT_SALE','SUBPRODUCT_SALE','SUBSIDY','OTHER']),
  description: z.string().min(1, 'La descripción es requerida'),
  incomeDate:  z.string().min(1, 'La fecha es requerida'),
  amount:      z.number().positive('El monto debe ser mayor a 0'),
  reference:   z.string().optional(),
  notes:       z.string().optional(),
});
type IncomeForm = z.infer<typeof schema>;

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
  borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
  padding: 14, fontSize: 15, backgroundColor: Colors.gray[50], color: Colors.text,
} as const;

function FE({ msg }: { msg?: string }) {
  return msg ? <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>{msg}</Text> : null;
}

function SectionHeader({ label, icon }: { label: string; icon?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 20, gap: 8 }}>
      <View style={{ width: 3, height: 18, backgroundColor: PURPLE, borderRadius: 2 }} />
      {icon && <Ionicons name={icon as any} size={14} color={PURPLE} />}
      <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.text }}>{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function IncomeNewScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { incomeId } = useLocalSearchParams<{ incomeId?: string }>();
  const isEditing = !!incomeId;

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<IncomeForm>({
    resolver: zodResolver(schema) as any,
    defaultValues: { incomeDate: new Date().toISOString().split('T')[0], category: 'SUBSIDY' },
  });

  // Load existing data in edit mode
  const { data: existing } = useQuery({
    queryKey: ['finance', 'income', incomeId],
    queryFn: () => api.get(`/finance/incomes/${incomeId}`).then((r) => r.data.data),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existing) {
      reset({
        category:    existing.category,
        description: existing.description,
        incomeDate:  existing.incomeDate?.split('T')[0] ?? existing.incomeDate,
        amount:      existing.amount,
        reference:   existing.reference ?? '',
        notes:       existing.notes ?? '',
      });
    }
  }, [existing, reset]);

  const dismiss = () => (router.canDismiss() ? router.dismiss() : router.back());

  const saveMutation = useMutation({
    mutationFn: (data: IncomeForm) => {
      const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined));
      return isEditing
        ? api.patch(`/finance/incomes/${incomeId}`, clean)
        : api.post('/finance/incomes', clean);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      Toast.show({ type: 'success', text1: isEditing ? 'Ingreso actualizado' : 'Ingreso registrado' });
      dismiss();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/finance/incomes/${incomeId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      Toast.show({ type: 'success', text1: 'Ingreso eliminado' });
      dismiss();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error al eliminar', text2: getErrorMessage(e) }),
  });

  const confirmDelete = () => {
    Alert.alert('Eliminar ingreso', '¿Estás seguro de que deseas eliminar este ingreso?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  const selectedCategory = watch('category');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Header */}
      <View style={{ backgroundColor: PURPLE_LIGHT, borderBottomWidth: 1, borderBottomColor: '#c4b5fd', paddingTop: 10, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: PURPLE + '50' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: PURPLE + '18', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="trending-up" size={24} color={PURPLE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: PURPLE_DARK }}>
              {isEditing ? 'Editar Ingreso' : 'Registrar Ingreso'}
            </Text>
            <Text style={{ fontSize: 12, color: PURPLE, marginTop: 1 }}>Entrada de capital</Text>
          </View>
          {isEditing && (
            <Pressable onPress={confirmDelete} disabled={deleteMutation.isPending} style={{ padding: 6, marginRight: 4 }}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            </Pressable>
          )}
          <Pressable onPress={dismiss} style={{ padding: 6 }}>
            <Ionicons name="close" size={22} color={PURPLE} />
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
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#f5f3ff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#ddd6fe', marginTop: 8 }}>
            <Ionicons name="information-circle" size={20} color={PURPLE} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: PURPLE_DARK, marginBottom: 4 }}>
                ¿Cuándo usar "Ingreso"?
              </Text>
              <Text style={{ fontSize: 12, color: '#5b21b6', lineHeight: 18 }}>
                Usa esto para dinero recibido que <Text style={{ fontWeight: '700' }}>no es una venta directa</Text> de producto o animal.{'\n'}
                • Ventas de animales / carne → usa <Text style={{ fontWeight: '700' }}>Nueva Venta</Text>{'\n'}
                • Leche → usa el módulo <Text style={{ fontWeight: '700' }}>Leche</Text>
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Categoría */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <SectionHeader label="Tipo de ingreso *" icon="pricetag-outline" />
          <View style={{ gap: 10 }}>
            {INCOME_OPTIONS.map((opt) => {
              const active = selectedCategory === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setValue('category', opt.value)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
                    backgroundColor: active ? PURPLE_LIGHT : Colors.gray[50],
                    borderWidth: 1.5, borderColor: active ? PURPLE : Colors.border,
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: active ? PURPLE + '20' : Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={opt.icon as any} size={18} color={active ? PURPLE : Colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: active ? PURPLE : Colors.text }}>
                      {opt.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: active ? PURPLE + 'aa' : Colors.textMuted, marginTop: 1 }}>
                      {opt.hint}
                    </Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color={PURPLE} />}
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
              placeholder="Ej: Venta de leche semana 23..."
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
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: errors.incomeDate ? Colors.danger : Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50], overflow: 'hidden' }}>
            <View style={{ paddingLeft: 14, paddingRight: 8 }}>
              <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
            </View>
            <Controller control={control} name="incomeDate" render={({ field: { onChange, onBlur, value } }) => (
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
          <FE msg={errors.incomeDate?.message} />
        </Animated.View>

        {/* Monto */}
        <Animated.View entering={FadeInDown.delay(240).springify()}>
          <View style={{ marginTop: 20, backgroundColor: PURPLE_LIGHT, borderRadius: 16, padding: 20, borderWidth: 2, borderColor: PURPLE + '60' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Ionicons name="trending-up" size={16} color={PURPLE} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: PURPLE }}>Monto total (COP) *</Text>
            </View>
            <Controller control={control} name="amount" render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{ fontSize: 32, fontWeight: '800', color: PURPLE, textAlign: 'center', padding: 4 }}
                placeholder="0"
                placeholderTextColor={PURPLE + '60'}
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={(t) => onChange(fromAmt(t))}
                value={toAmt(value)}
              />
            )} />
            <FE msg={errors.amount?.message} />
          </View>
        </Animated.View>

        {/* Referencia */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <SectionHeader label="Referencia / Recibo" icon="receipt-outline" />
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50], overflow: 'hidden' }}>
            <View style={{ paddingLeft: 14, paddingRight: 8 }}>
              <Ionicons name="barcode-outline" size={18} color={Colors.textMuted} />
            </View>
            <Controller control={control} name="reference" render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{ flex: 1, padding: 14, paddingLeft: 0, fontSize: 15, color: Colors.text }}
                placeholder="Ej: REC-001"
                placeholderTextColor={Colors.textMuted}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )} />
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
            onPress={handleSubmit((d) => saveMutation.mutate(d as unknown as IncomeForm))}
            disabled={saveMutation.isPending}
            style={({ pressed }) => ({
              backgroundColor: PURPLE, borderRadius: 14, padding: 16, alignItems: 'center',
              shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
              opacity: pressed || saveMutation.isPending ? 0.75 : 1,
            })}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  {isEditing ? 'Guardar cambios' : 'Registrar ingreso'}
                </Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
