import { zodResolver } from '@hookform/resolvers/zod';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOfflineMutation } from '../../../hooks/use-offline-mutation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { z } from 'zod';
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';
import type { DairyConfig, MilkSale } from '../../../types/milk.types';

// ─── Theme ────────────────────────────────────────────────────────────────────
const C       = '#0ea5e9';
const C_LIGHT = '#e0f2fe';
const C_DARK  = '#0c4a6e';

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const PICKER_ITEM_H  = 44;
const PICKER_VISIBLE = 5;
const PICKER_H       = PICKER_ITEM_H * PICKER_VISIBLE;

// ─── DatePicker ───────────────────────────────────────────────────────────────
function SalePickerCol({ data, selected, onSelect, visible }: {
  data: (number | { label: string; value: number })[];
  selected: number; onSelect: (v: number) => void; visible: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const idx = data.findIndex((d) => (typeof d === 'number' ? d : (d as any).value) === selected);
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => ref.current?.scrollTo({ y: idx * PICKER_ITEM_H, animated: false }), 80);
    return () => clearTimeout(t);
  }, [visible, idx]);

  return (
    <ScrollView ref={ref} style={{ height: PICKER_H }} contentContainerStyle={{ paddingVertical: PICKER_ITEM_H * 2 }}
      showsVerticalScrollIndicator={false} snapToInterval={PICKER_ITEM_H} decelerationRate="fast"
      onMomentumScrollEnd={(e) => {
        const i = Math.round(e.nativeEvent.contentOffset.y / PICKER_ITEM_H);
        const item = data[Math.max(0, Math.min(i, data.length - 1))];
        onSelect(typeof item === 'number' ? item : (item as any).value);
      }}>
      {data.map((item) => {
        const v = typeof item === 'number' ? item : (item as any).value;
        const l = typeof item === 'number' ? String(item).padStart(2, '0') : (item as any).label;
        const sel = v === selected;
        return (
          <Pressable key={v} onPress={() => { onSelect(v); const i2 = data.findIndex((d) => (typeof d === 'number' ? d : (d as any).value) === v); ref.current?.scrollTo({ y: i2 * PICKER_ITEM_H, animated: true }); }}
            style={{ height: PICKER_ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: sel ? 18 : 15, fontWeight: sel ? '800' : '400', color: sel ? C : Colors.textMuted }}>{l}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function DatePickerModal({ visible, value, onConfirm, onClose }: {
  visible: boolean; value: string; onConfirm: (d: string) => void; onClose: () => void;
}) {
  const now = new Date();
  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00') : now;
  const [selYear, setSelYear]   = useState(parsed.getFullYear());
  const [selMonth, setSelMonth] = useState(parsed.getMonth());
  const [selDay, setSelDay]     = useState(parsed.getDate());

  useEffect(() => {
    if (visible) {
      const d = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00') : now;
      setSelYear(d.getFullYear()); setSelMonth(d.getMonth()); setSelDay(d.getDate());
    }
  }, [visible]);

  const years = Array.from({ length: 10 }, (_, i) => now.getFullYear() - i);
  const months = MONTHS_ES.map((m, i) => ({ label: m, value: i }));
  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const safeDay = Math.min(selDay, daysInMonth);
  const preview = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000066' }} onPress={onClose} />
        <View style={{ backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 28 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text }}>Seleccionar fecha</Text>
            <View style={{ backgroundColor: C_LIGHT, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C }}>{preview}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', height: PICKER_H, position: 'relative' }}>
            <View style={{ position: 'absolute', left: 0, right: 0, top: PICKER_ITEM_H * 2, height: PICKER_ITEM_H, backgroundColor: C_LIGHT, borderRadius: 12 }} />
            <View style={{ flex: 1 }}><SalePickerCol data={days} selected={safeDay} onSelect={setSelDay} visible={visible} /></View>
            <View style={{ flex: 2 }}><SalePickerCol data={months} selected={selMonth} onSelect={setSelMonth} visible={visible} /></View>
            <View style={{ flex: 2 }}><SalePickerCol data={years} selected={selYear} onSelect={setSelYear} visible={visible} /></View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 4, marginBottom: 20 }}>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Día</Text>
            <Text style={{ flex: 2, textAlign: 'center', fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Mes</Text>
            <Text style={{ flex: 2, textAlign: 'center', fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Año</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={onClose} style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', color: Colors.textMuted }}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={() => { onConfirm(preview); onClose(); }} style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: C, alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Confirmar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  saleDate: z.string().min(1, 'Selecciona la fecha'),
  liters:   z.coerce.number().positive('Debe ser mayor a 0'),
  notes:    z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MilkSaleNewScreen() {
  const router  = useRouter();
  const qc      = useQueryClient();
  const insets  = useSafeAreaInsets();
  const { saleId } = useLocalSearchParams<{ saleId?: string }>();
  const isEditing   = !!saleId;
  const [dateOpen,  setDateOpen]  = useState(false);
  const [formReady, setFormReady] = useState(!isEditing);

  const { data: config } = useQuery<DairyConfig>({
    queryKey: ['dairy-config'],
    queryFn: () => api.get('/production/dairy-config').then((r) => r.data.data ?? r.data),
  });

  const { data: existing } = useQuery<MilkSale>({
    queryKey: ['milk-sale', saleId],
    queryFn: () => api.get(`/production/milk-sales/${saleId}`).then((r) => r.data.data ?? r.data),
    enabled: isEditing,
  });

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { saleDate: new Date().toISOString().split('T')[0] },
  });

  useEffect(() => {
    if (existing && isEditing) {
      reset({ saleDate: existing.saleDate?.slice(0, 10) ?? '', liters: existing.liters, notes: existing.notes ?? '' });
      setFormReady(true);
    }
  }, [existing]);

  const saleDate = watch('saleDate');
  const liters   = watch('liters');

  const handleClose = () => { if (router.canDismiss()) router.dismiss(); else router.back(); };

  const mutation = useOfflineMutation({
    mutationFn: (data: FormData) => isEditing
      ? api.patch(`/production/milk-sales/${saleId}`, data)
      : api.post('/production/milk-sales', data),
    offline: {
      url:     (data) => isEditing ? `/production/milk-sales/${saleId}` : '/production/milk-sales',
      method:  isEditing ? 'PATCH' : 'POST',
      getData: (data) => ({ ...data }),
      getLabel: (data) => `Leche ${(data as any).saleDate ?? 'sin fecha'}`,
      invalidateKeys: [['milk-sales'], ['milk-summary']],
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milk-sales'] });
      qc.invalidateQueries({ queryKey: ['milk-summary'] });
      Toast.show({ type: 'success', text1: isEditing ? 'Registro actualizado' : 'Leche registrada' });
      handleClose();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/production/milk-sales/${saleId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milk-sales'] });
      qc.invalidateQueries({ queryKey: ['milk-summary'] });
      Toast.show({ type: 'success', text1: 'Registro eliminado' });
      handleClose();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const handleDelete = () => Alert.alert('Eliminar registro', '¿Seguro?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate() },
  ]);

  const estimatedEarnings = liters && config?.pricePerLiter
    ? (liters * config.pricePerLiter).toLocaleString('es-CO', { maximumFractionDigits: 0 })
    : null;

  const isBusy = mutation.isPending || deleteMutation.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: C_LIGHT, borderBottomWidth: 1, borderBottomColor: '#bae6fd', paddingTop: insets.top + 10, paddingBottom: 18, paddingHorizontal: 20 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C + '50', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C + '20', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="water" size={26} color={C} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C_DARK }}>{isEditing ? 'Editar Registro' : 'Registrar Leche'}</Text>
            <Text style={{ fontSize: 12, color: C, fontWeight: '500', marginTop: 2 }}>
              {config?.buyerName ? `Venta a ${config.buyerName}` : 'Producción del día'}
            </Text>
          </View>
          {isEditing && (
            <Pressable onPress={handleDelete} disabled={isBusy} hitSlop={8}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.danger + '15', alignItems: 'center', justifyContent: 'center' }}>
              {deleteMutation.isPending ? <ActivityIndicator size="small" color={Colors.danger} /> : <Ionicons name="trash-outline" size={18} color={Colors.danger} />}
            </Pressable>
          )}
          <Pressable onPress={handleClose} hitSlop={12}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C + '15', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color={C} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Litros — campo grande */}
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Litros vendidos *</Text>
            <View style={{ backgroundColor: C_LIGHT, borderRadius: 20, borderWidth: 2, borderColor: errors.liters ? Colors.danger : C, padding: 20, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                <Controller control={control} name="liters" render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={{ fontSize: 64, fontWeight: '900', color: C_DARK, minWidth: 120, textAlign: 'center' }}
                    placeholder="0"
                    placeholderTextColor={C + '40'}
                    keyboardType="decimal-pad"
                    onBlur={onBlur}
                    onChangeText={(t) => onChange(t ? parseFloat(t.replace(',', '.')) : undefined)}
                    value={value !== undefined ? String(value) : ''}
                  />
                )} />
                <Text style={{ fontSize: 22, fontWeight: '700', color: C, marginBottom: 12 }}>L</Text>
              </View>
              {/* Estimado ganancia */}
              {estimatedEarnings && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 }}>
                  <Ionicons name="cash-outline" size={16} color={Colors.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>≈ ${estimatedEarnings}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>estimado</Text>
                </View>
              )}
            </View>
            {errors.liters && <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 6 }}>{errors.liters.message}</Text>}
          </Animated.View>

          {/* Fecha */}
          <Animated.View entering={FadeInDown.delay(120).springify()} style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fecha *</Text>
            <Pressable onPress={() => setDateOpen(true)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 10,
                borderWidth: 1.5, borderColor: saleDate ? C : Colors.border,
                borderRadius: 14, backgroundColor: saleDate ? C_LIGHT : Colors.gray[50],
                padding: 16, opacity: pressed ? 0.85 : 1,
              })}>
              <Ionicons name="calendar-outline" size={20} color={saleDate ? C : Colors.textMuted} />
              <Text style={{ flex: 1, fontSize: 16, fontWeight: saleDate ? '700' : '400', color: saleDate ? C_DARK : Colors.textMuted }}>
                {saleDate || 'Seleccionar fecha'}
              </Text>
              {saleDate
                ? <Pressable onPress={() => setValue('saleDate', '')} hitSlop={8}><Ionicons name="close-circle" size={18} color={C} /></Pressable>
                : <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              }
            </Pressable>
            <DatePickerModal visible={dateOpen} value={saleDate} onConfirm={(d) => setValue('saleDate', d, { shouldValidate: true })} onClose={() => setDateOpen(false)} />
          </Animated.View>

          {/* Notas */}
          <Animated.View entering={FadeInDown.delay(180).springify()} style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notas <Text style={{ fontWeight: '400', textTransform: 'none' }}>(opcional)</Text></Text>
            <Controller control={control} name="notes" render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 14, color: Colors.text, backgroundColor: Colors.gray[50], minHeight: 80, textAlignVertical: 'top' }}
                placeholder="Ej: Recogida normal, leche de buena calidad..."
                placeholderTextColor={Colors.textMuted}
                multiline onBlur={onBlur} onChangeText={onChange} value={value}
              />
            )} />
          </Animated.View>

          {/* Submit */}
          <Animated.View entering={FadeInDown.delay(240).springify()} style={{ marginTop: 32 }}>
            <Pressable onPress={handleSubmit((d) => mutation.mutate(d))} disabled={isBusy}
              style={({ pressed }) => ({
                backgroundColor: C, borderRadius: 16, padding: 18,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                shadowColor: C, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
                opacity: pressed || isBusy ? 0.8 : 1,
              })}>
              {mutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <>
                    <MaterialCommunityIcons name="water" size={22} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                      {isEditing ? 'Guardar cambios' : 'Registrar leche'}
                    </Text>
                  </>
              }
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
