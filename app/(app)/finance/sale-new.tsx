import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
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
import { Animal } from '../../../types/animal.types';
import { SaleType } from '../../../types/finance.types';

// ─── Colors ───────────────────────────────────────────────────────────────────

const EMERALD       = '#059669';
const EMERALD_LIGHT = '#d1fae5';
const EMERALD_DARK  = '#064e3b';

// ─── Data ─────────────────────────────────────────────────────────────────────

// MILK se excluye: la leche se gestiona íntegramente en el módulo Leche (litros, períodos, pagos)
const SALE_OPTIONS: { value: SaleType; label: string; unit: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'ANIMAL',     label: 'Animal',      unit: 'cabezas', icon: 'paw-outline' },
  { value: 'MEAT',       label: 'Carne',       unit: 'kg',      icon: 'restaurant-outline' },
  { value: 'SUBPRODUCT', label: 'Subproducto', unit: 'und',     icon: 'cube-outline' },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  type:          z.enum(['ANIMAL', 'MILK', 'MEAT', 'SUBPRODUCT']),
  saleDate:      z.string().min(1, 'La fecha es requerida'),
  quantity:      z.number().positive('Cantidad requerida'),
  unit:          z.string().optional(),
  unitPrice:     z.number().min(0, 'Precio requerido'),
  totalAmount:   z.number().min(0, 'Total requerido'),
  animalId:      z.string().uuid().optional().or(z.literal('')),
  buyerName:     z.string().optional(),
  buyerContact:  z.string().optional(),
  invoiceNumber: z.string().optional(),
  notes:         z.string().optional(),
});
type SaleForm = z.infer<typeof schema>;

// ─── Helpers de formato ───────────────────────────────────────────────────────

/** 1500000 → "1.500.000" (separador de miles es-CO) */
function toAmt(n: number | undefined): string {
  if (n == null || isNaN(n)) return '';
  return Math.round(n).toLocaleString('es-CO');
}
/** "1.500.000" → 1500000 (elimina puntos antes de parsear) */
function fromAmt(text: string): number | undefined {
  const digits = text.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : undefined;
}

// ─── Componentes ─────────────────────────────────────────────────────────────

const INPUT_STYLE = {
  borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
  padding: 14, fontSize: 15, backgroundColor: Colors.gray[50], color: Colors.text,
} as const;

function SectionHeader({ label, icon }: { label: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 }}>
      <View style={{ width: 3, height: 18, backgroundColor: EMERALD, borderRadius: 2 }} />
      {icon && <Ionicons name={icon} size={14} color={EMERALD} />}
      <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.text }}>{label}</Text>
    </View>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.gray[600], marginBottom: 6, marginTop: 12 }}>
      {label}{required && <Text style={{ color: Colors.danger }}> *</Text>}
    </Text>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
      <Ionicons name="alert-circle-outline" size={13} color={Colors.danger} />
      <Text style={{ color: Colors.danger, fontSize: 12 }}>{msg}</Text>
    </View>
  );
}

// ─── AnimalSearch ─────────────────────────────────────────────────────────────

function AnimalSearch({ value, onSelect }: { value?: string; onSelect: (id: string) => void }) {
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
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: EMERALD, borderRadius: 12, padding: 14, backgroundColor: EMERALD_LIGHT }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: EMERALD + '20', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="cow" size={16} color={EMERALD} />
            </View>
            <Text style={{ fontSize: 14, color: EMERALD_DARK, fontWeight: '700' }}>{selectedLabel}</Text>
          </View>
          <Ionicons name="close-circle" size={18} color={EMERALD} />
        </Pressable>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50] }}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={{ marginLeft: 14 }} />
            <TextInput
              style={{ flex: 1, padding: 14, fontSize: 15, color: Colors.text }}
              placeholder="Buscar animal por arete o nombre..."
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={(t) => { setQuery(t); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
            />
          </View>
          {showResults && query.length >= 1 && animals.length > 0 && (
            <View style={{ backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginTop: 4, overflow: 'hidden', elevation: 3 }}>
              {animals.map((a) => (
                <Pressable key={a.id} onPress={() => handleSelect(a)}
                  style={({ pressed }) => ({ padding: 13, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: pressed ? EMERALD_LIGHT : Colors.card, flexDirection: 'row', alignItems: 'center', gap: 10 })}
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
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SaleNewScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { saleId } = useLocalSearchParams<{ saleId?: string }>();
  const isEditing = !!saleId;

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<SaleForm>({
    resolver: zodResolver(schema) as any,
    defaultValues: { saleDate: new Date().toISOString().split('T')[0], type: 'MILK', unit: 'litros' },
  });

  // Load existing data in edit mode
  const { data: existing } = useQuery({
    queryKey: ['finance', 'sale', saleId],
    queryFn: () => api.get(`/finance/sales/${saleId}`).then((r) => r.data.data),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existing) {
      reset({
        type:          existing.type,
        saleDate:      existing.saleDate?.split('T')[0] ?? existing.saleDate,
        quantity:      existing.quantity,
        unit:          existing.unit ?? '',
        unitPrice:     existing.unitPrice,
        totalAmount:   existing.totalAmount,
        animalId:      existing.animalId ?? '',
        buyerName:     existing.buyerName ?? '',
        buyerContact:  existing.buyerContact ?? '',
        invoiceNumber: existing.invoiceNumber ?? '',
        notes:         existing.notes ?? '',
      });
    }
  }, [existing, reset]);

  const dismiss = () => (router.canDismiss() ? router.dismiss() : router.back());

  const saveMutation = useMutation({
    mutationFn: (data: SaleForm) => {
      const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined));
      return isEditing
        ? api.patch(`/finance/sales/${saleId}`, clean)
        : api.post('/finance/sales', clean);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      Toast.show({ type: 'success', text1: isEditing ? 'Venta actualizada' : 'Venta registrada' });
      dismiss();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/finance/sales/${saleId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      Toast.show({ type: 'success', text1: 'Venta eliminada' });
      dismiss();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error al eliminar', text2: getErrorMessage(e) }),
  });

  const confirmDelete = () => {
    Alert.alert('Eliminar venta', '¿Estás seguro de que deseas eliminar esta venta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  const selectedType = watch('type');
  const animalId     = watch('animalId');
  const qty          = watch('quantity');
  const price        = watch('unitPrice');

  const autoTotal = () => {
    // Usa setTimeout para leer los valores ya actualizados en el form
    setTimeout(() => {
      const q = parseFloat(String(watch('quantity') ?? 0));
      const p = parseFloat(String(watch('unitPrice') ?? 0));
      const total = q * p;
      if (total > 0) setValue('totalAmount', Math.round(total));
    }, 0);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Header */}
      <View style={{ backgroundColor: EMERALD_LIGHT, borderBottomWidth: 1, borderBottomColor: '#a7f3d0', paddingTop: 10, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: EMERALD + '50' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: EMERALD + '18', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="cart" size={26} color={EMERALD} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: EMERALD_DARK }}>
              {isEditing ? 'Editar Venta' : 'Registrar Venta'}
            </Text>
            <Text style={{ fontSize: 12, color: EMERALD, marginTop: 1 }}>Transacción comercial</Text>
          </View>
          {isEditing && (
            <Pressable onPress={confirmDelete} disabled={deleteMutation.isPending} style={{ padding: 6, marginRight: 4 }}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            </Pressable>
          )}
          <Pressable onPress={dismiss} style={{ padding: 6 }}>
            <Ionicons name="close" size={22} color={EMERALD} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* Aviso explicativo */}
        <Animated.View entering={FadeInDown.delay(0)}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: EMERALD_LIGHT, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#a7f3d0', marginTop: 8 }}>
            <Ionicons name="information-circle" size={20} color={EMERALD} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: EMERALD_DARK, marginBottom: 4 }}>
                ¿Cuándo usar "Venta"?
              </Text>
              <Text style={{ fontSize: 12, color: '#065f46', lineHeight: 18 }}>
                Cuando vendiste un <Text style={{ fontWeight: '700' }}>producto o animal</Text> a un comprador con precio y cantidad.{'\n'}
                • Leche → usa el módulo <Text style={{ fontWeight: '700' }}>Leche</Text>{'\n'}
                • Subsidios / bonos → usa <Text style={{ fontWeight: '700' }}>Ingreso</Text>
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Tipo de venta */}
        <Animated.View entering={FadeInDown.delay(60)}>
          <SectionHeader label="Tipo de venta" icon="pricetag-outline" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SALE_OPTIONS.map((opt) => {
              const active = selectedType === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => { setValue('type', opt.value); setValue('unit', opt.unit); }}
                  style={{
                    flex: 1, borderRadius: 14, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4,
                    borderWidth: 1.5,
                    borderColor: active ? EMERALD : Colors.border,
                    backgroundColor: active ? EMERALD_LIGHT : Colors.gray[50],
                    gap: 4,
                  }}
                >
                  <Ionicons name={opt.icon} size={20} color={active ? EMERALD : Colors.textMuted} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: active ? EMERALD : Colors.textMuted }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Animal vendido (condicional) */}
        {selectedType === 'ANIMAL' && (
          <Animated.View entering={FadeInDown.delay(120)}>
            <SectionHeader label="Animal vendido" icon="paw-outline" />
            <AnimalSearch value={animalId} onSelect={(id) => setValue('animalId', id)} />
          </Animated.View>
        )}

        {/* Fecha */}
        <Animated.View entering={FadeInDown.delay(120)}>
          <SectionHeader label="Fecha de venta" icon="calendar-outline" />
          <Controller control={control} name="saleDate" render={({ field: { onChange, onBlur, value } }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: errors.saleDate ? Colors.danger : Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50] }}>
              <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} style={{ marginLeft: 14 }} />
              <TextInput
                style={{ flex: 1, padding: 14, fontSize: 15, color: Colors.text }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            </View>
          )} />
          <FieldError msg={errors.saleDate?.message} />
        </Animated.View>

        {/* Cantidad y precio */}
        <Animated.View entering={FadeInDown.delay(180)}>
          <SectionHeader label="Cantidad y precio" icon="calculator-outline" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Cantidad" required />
              <Controller control={control} name="quantity" render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={{ ...INPUT_STYLE, borderColor: errors.quantity ? Colors.danger : Colors.border, textAlign: 'center' }}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  onBlur={onBlur}
                  onChangeText={(t) => { onChange(t ? parseFloat(t.replace(/\D/g, '')) : undefined); autoTotal(); }}
                  value={value?.toString() ?? ''}
                />
              )} />
              <FieldError msg={errors.quantity?.message} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Unidad" />
              <Controller control={control} name="unit" render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={{ ...INPUT_STYLE, textAlign: 'center' }}
                  placeholder="litros"
                  placeholderTextColor={Colors.textMuted}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )} />
            </View>
          </View>

          <FieldLabel label="Precio unitario (COP)" required />
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: errors.unitPrice ? Colors.danger : Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50] }}>
            <Text style={{ paddingLeft: 14, fontSize: 15, color: Colors.textMuted }}>$</Text>
            <Controller control={control} name="unitPrice" render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{ flex: 1, padding: 14, fontSize: 15, color: Colors.text }}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={(t) => { onChange(fromAmt(t)); autoTotal(); }}
                value={toAmt(value)}
              />
            )} />
          </View>
          <FieldError msg={errors.unitPrice?.message} />
        </Animated.View>

        {/* Total */}
        <Animated.View entering={FadeInDown.delay(240)}>
          <View style={{ marginTop: 16, backgroundColor: EMERALD_LIGHT, borderRadius: 16, padding: 18, borderWidth: 2, borderColor: EMERALD }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="trending-up-outline" size={16} color={EMERALD} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: EMERALD }}>Total de la venta (COP)</Text>
            </View>
            <Controller control={control} name="totalAmount" render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{ fontSize: 32, fontWeight: '800', color: EMERALD_DARK, textAlign: 'center', padding: 4, backgroundColor: 'transparent' }}
                placeholder="$ 0"
                placeholderTextColor={EMERALD + '60'}
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={(t) => onChange(fromAmt(t))}
                value={toAmt(value)}
              />
            )} />
            <FieldError msg={errors.totalAmount?.message} />
            <Text style={{ fontSize: 11, color: EMERALD, textAlign: 'center', marginTop: 4, opacity: 0.7 }}>
              Se calcula automáticamente · puedes ajustar
            </Text>
          </View>
        </Animated.View>

        {/* Comprador */}
        <Animated.View entering={FadeInDown.delay(300)}>
          <SectionHeader label="Comprador" icon="person-outline" />
          <View style={{ backgroundColor: Colors.gray[50], borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border }}>
              <Ionicons name="person-outline" size={16} color={Colors.textMuted} style={{ marginLeft: 14 }} />
              <Controller control={control} name="buyerName" render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={{ flex: 1, padding: 14, fontSize: 15, color: Colors.text }}
                  placeholder="Nombre del comprador"
                  placeholderTextColor={Colors.textMuted}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border }}>
              <Ionicons name="call-outline" size={16} color={Colors.textMuted} style={{ marginLeft: 14 }} />
              <Controller control={control} name="buyerContact" render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={{ flex: 1, padding: 14, fontSize: 15, color: Colors.text }}
                  placeholder="+57 300 000 0000"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="receipt-outline" size={16} color={Colors.textMuted} style={{ marginLeft: 14 }} />
              <Controller control={control} name="invoiceNumber" render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={{ flex: 1, padding: 14, fontSize: 15, color: Colors.text }}
                  placeholder="No. Factura (ej: FAC-001)"
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
        <Animated.View entering={FadeInDown.delay(360)}>
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
        <Animated.View entering={FadeInDown.delay(420)} style={{ marginTop: 28 }}>
          <Pressable
            onPress={handleSubmit((d) => saveMutation.mutate(d as unknown as SaleForm))}
            disabled={saveMutation.isPending}
            style={({ pressed }) => ({
              backgroundColor: EMERALD, borderRadius: 14, padding: 16, alignItems: 'center',
              shadowColor: EMERALD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
              opacity: pressed || saveMutation.isPending ? 0.75 : 1,
            })}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  {isEditing ? 'Guardar cambios' : 'Registrar venta'}
                </Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
