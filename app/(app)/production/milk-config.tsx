import { zodResolver } from '@hookform/resolvers/zod';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { z } from 'zod';
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';
import type { DairyConfig, PaymentFrequency } from '../../../types/milk.types';

const B       = '#0ea5e9'; // sky-500
const B_LIGHT = '#e0f2fe';
const B_DARK  = '#0c4a6e';

const schema = z.object({
  buyerName:        z.string().optional(),
  pricePerLiter:    z.coerce.number().min(0),
  paymentFrequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  notes:            z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const FREQS: { value: PaymentFrequency; label: string; desc: string; icon: string }[] = [
  { value: 'WEEKLY',   label: 'Semanal',   desc: 'Te pagan cada semana',           icon: 'calendar-week' },
  { value: 'BIWEEKLY', label: 'Quincenal', desc: 'Te pagan cada 15 días',          icon: 'calendar-range' },
  { value: 'MONTHLY',  label: 'Mensual',   desc: 'Te pagan una vez al mes',        icon: 'calendar-month' },
];

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>{msg}</Text>;
}

export default function MilkConfigScreen() {
  const router  = useRouter();
  const qc      = useQueryClient();
  const insets  = useSafeAreaInsets();

  const { data: config, isLoading } = useQuery<DairyConfig>({
    queryKey: ['dairy-config'],
    queryFn: () => api.get('/production/dairy-config').then((r) => r.data.data ?? r.data),
  });

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    values: config ? {
      buyerName:        config.buyerName ?? '',
      pricePerLiter:    config.pricePerLiter ?? 0,
      paymentFrequency: config.paymentFrequency ?? 'MONTHLY',
      notes:            config.notes ?? '',
    } : undefined,
    defaultValues: { pricePerLiter: 0, paymentFrequency: 'MONTHLY' },
  });

  const freq = watch('paymentFrequency');

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.put('/production/dairy-config', {
      ...data,
      buyerName: data.buyerName || undefined,
      notes:     data.notes     || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dairy-config'] });
      qc.invalidateQueries({ queryKey: ['milk-summary'] });
      Toast.show({ type: 'success', text1: 'Configuración guardada' });
      if (router.canDismiss()) router.dismiss();
      else router.back();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={B} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: B_LIGHT, borderBottomWidth: 1, borderBottomColor: '#bae6fd', paddingTop: insets.top + 10, paddingBottom: 18, paddingHorizontal: 20 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: B + '50', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: B + '20', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="truck-delivery-outline" size={26} color={B} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: B_DARK }}>Configurar Lechera</Text>
            <Text style={{ fontSize: 12, color: B, fontWeight: '500', marginTop: 2 }}>Precio, pagos y comprador</Text>
          </View>
          <Pressable onPress={() => router.canDismiss() ? router.dismiss() : router.back()} hitSlop={12}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: B + '15', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color={B} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Nombre lechera */}
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <View style={{ width: 3, height: 16, backgroundColor: B, borderRadius: 2 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>Nombre del comprador</Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>(opcional)</Text>
            </View>
            <Controller control={control} name="buyerName" render={({ field: { onChange, onBlur, value } }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.gray[50] }}>
                <View style={{ paddingLeft: 14 }}><MaterialCommunityIcons name="truck-delivery-outline" size={18} color={Colors.textMuted} /></View>
                <TextInput
                  style={{ flex: 1, padding: 13, paddingLeft: 10, fontSize: 15, color: Colors.text }}
                  placeholder="Ej: Coolechera del Valle"
                  placeholderTextColor={Colors.textMuted}
                  onBlur={onBlur} onChangeText={onChange} value={value}
                  autoCapitalize="words"
                />
              </View>
            )} />
          </Animated.View>

          {/* Precio por litro */}
          <Animated.View entering={FadeInDown.delay(120).springify()} style={{ marginTop: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <View style={{ width: 3, height: 16, backgroundColor: B, borderRadius: 2 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>Precio por litro *</Text>
            </View>
            <Controller control={control} name="pricePerLiter" render={({ field: { onChange, onBlur, value } }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: errors.pricePerLiter ? Colors.danger : B, borderRadius: 12, backgroundColor: B_LIGHT }}>
                <View style={{ paddingLeft: 16 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: B }}>$</Text>
                </View>
                <TextInput
                  style={{ flex: 1, padding: 16, fontSize: 28, fontWeight: '800', color: B_DARK }}
                  placeholder="0"
                  placeholderTextColor={B + '60'}
                  keyboardType="decimal-pad"
                  onBlur={onBlur}
                  onChangeText={(t) => onChange(t ? parseFloat(t.replace(',', '.')) : 0)}
                  value={value ? String(value) : ''}
                />
                <Text style={{ paddingRight: 16, fontSize: 15, fontWeight: '700', color: B }}>/ litro</Text>
              </View>
            )} />
            <FieldError msg={errors.pricePerLiter?.message} />
          </Animated.View>

          {/* Frecuencia de pago */}
          <Animated.View entering={FadeInDown.delay(180).springify()} style={{ marginTop: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 3, height: 16, backgroundColor: B, borderRadius: 2 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>¿Cada cuánto te pagan? *</Text>
            </View>
            <Controller control={control} name="paymentFrequency" render={({ field: { onChange, value } }) => (
              <View style={{ gap: 10 }}>
                {FREQS.map((f) => {
                  const sel = value === f.value;
                  return (
                    <Pressable key={f.value} onPress={() => onChange(f.value)}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14,
                        borderWidth: sel ? 2 : 1, borderColor: sel ? B : Colors.border,
                        backgroundColor: sel ? B_LIGHT : pressed ? Colors.gray[100] : Colors.gray[50],
                      })}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: sel ? B + '20' : Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialCommunityIcons name={f.icon as any} size={22} color={sel ? B : Colors.textMuted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: sel ? B_DARK : Colors.text }}>{f.label}</Text>
                        <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>{f.desc}</Text>
                      </View>
                      {sel && (
                        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: B, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )} />
          </Animated.View>

          {/* Notas */}
          <Animated.View entering={FadeInDown.delay(240).springify()} style={{ marginTop: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <View style={{ width: 3, height: 16, backgroundColor: B, borderRadius: 2 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>Notas</Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>(opcional)</Text>
            </View>
            <Controller control={control} name="notes" render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 14, color: Colors.text, backgroundColor: Colors.gray[50], minHeight: 80, textAlignVertical: 'top' }}
                placeholder="Cualquier detalle sobre el acuerdo con la lechera..."
                placeholderTextColor={Colors.textMuted}
                multiline onBlur={onBlur} onChangeText={onChange} value={value}
              />
            )} />
          </Animated.View>

          {/* Botón guardar */}
          <Animated.View entering={FadeInDown.delay(300).springify()} style={{ marginTop: 32 }}>
            <Pressable
              onPress={handleSubmit((d) => mutation.mutate(d))}
              disabled={mutation.isPending}
              style={({ pressed }) => ({
                backgroundColor: B, borderRadius: 16, padding: 18,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                shadowColor: B, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
                opacity: pressed || mutation.isPending ? 0.8 : 1,
              })}>
              {mutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="save-outline" size={22} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Guardar configuración</Text>
                  </>
              }
            </Pressable>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
