import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
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
import { useAuthStore } from '../../../stores/auth.store';

const schema = z.object({
  name:         z.string().min(1, 'El nombre es requerido'),
  location:     z.string().optional(),
  department:   z.string().optional(),
  municipality: z.string().optional(),
  areaHectares: z.number().positive().optional(),
  phone:        z.string().optional(),
  email:        z.string().email('Email inválido').optional().or(z.literal('')),
  rut:          z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      {children}
      {error && <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

function FInput({ hasError, ...props }: any) {
  return (
    <TextInput
      style={{
        borderWidth: 1, borderColor: hasError ? Colors.danger : Colors.border,
        borderRadius: 12, padding: 14, fontSize: 15,
        backgroundColor: Colors.gray[50], color: Colors.text,
      }}
      placeholderTextColor={Colors.textMuted}
      {...props}
    />
  );
}

function InfoRow({ icon, label, value }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value?: string | number | null;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 14, paddingHorizontal: 4 }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 1 }}>{label}</Text>
        <Text style={{ fontSize: 14, color: Colors.text, fontWeight: '600' }}>{value ?? '—'}</Text>
      </View>
    </View>
  );
}

export default function FarmInfoScreen() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const qc       = useQueryClient();
  const [editing, setEditing] = useState(false);
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const { data: farm, isLoading } = useQuery({
    queryKey: ['farm', user?.farmId],
    queryFn: () => api.get(`/farms/${user?.farmId}`).then((r) => r.data.data),
    enabled: !!user?.farmId,
  });

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    values: farm ? {
      name:         farm.name,
      location:     farm.location     ?? '',
      department:   farm.department   ?? '',
      municipality: farm.municipality ?? '',
      areaHectares: farm.areaHectares,
      phone:        farm.phone        ?? '',
      email:        farm.email        ?? '',
      rut:          farm.rut          ?? '',
    } : undefined,
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined));
      return api.patch(`/farms/${user?.farmId}`, clean);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farm', user?.farmId] });
      setEditing(false);
      Toast.show({ type: 'success', text1: 'Finca actualizada' });
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* ── Header ── */}
      <View style={{
        backgroundColor: Colors.primary,
        paddingTop: insets.top + 12,
        paddingBottom: 20,
        paddingHorizontal: 20,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff18', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#f1f5f9' }}>
              {farm?.name ?? 'Mi finca'}
            </Text>
            {(farm?.municipality || farm?.department) && (
              <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                {[farm.municipality, farm.department].filter(Boolean).join(', ')}
              </Text>
            )}
          </View>
          {canEdit && !editing && (
            <Pressable
              onPress={() => setEditing(true)}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff18', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Stats */}
          {farm?._count && (
            <Animated.View entering={FadeInDown.delay(0)} style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {[
                { icon: 'paw-outline',    label: 'Animales',   value: farm._count.animals, color: Colors.primary, bg: Colors.primaryLight },
                { icon: 'people-outline', label: 'Usuarios',   value: farm._count.users,   color: '#6366f1',      bg: '#e0e7ff' },
                ...(farm.areaHectares ? [{ icon: 'map-outline', label: 'Hectáreas', value: farm.areaHectares, color: '#0369a1', bg: '#e0f2fe' }] : []),
              ].map((s: any) => (
                <View key={s.label} style={{ flex: 1, backgroundColor: s.bg, borderRadius: 14, padding: 14, alignItems: 'center', gap: 2 }}>
                  <Ionicons name={s.icon} size={18} color={s.color} />
                  <Text style={{ fontSize: 18, fontWeight: '900', color: s.color }}>{s.value}</Text>
                  <Text style={{ fontSize: 10, color: s.color, opacity: 0.8, fontWeight: '600' }}>{s.label}</Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* ── Modo vista ── */}
          {!editing && (
            <Animated.View entering={FadeInDown.delay(60)}>
              <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 16 }}>
                <InfoRow icon="location-outline" label="Dirección / Vereda"  value={farm?.location} />
                <InfoRow icon="business-outline" label="Municipio"           value={farm?.municipality} />
                <InfoRow icon="flag-outline"     label="Departamento"        value={farm?.department} />
                <InfoRow icon="resize-outline"   label="Área (ha)"           value={farm?.areaHectares} />
                <InfoRow icon="call-outline"     label="Teléfono"            value={farm?.phone} />
                <InfoRow icon="mail-outline"     label="Email"               value={farm?.email} />
                <InfoRow icon="card-outline"     label="RUT / NIT"           value={farm?.rut} />
              </View>

              {canEdit && (
                <Pressable
                  onPress={() => setEditing(true)}
                  style={({ pressed }) => ({
                    backgroundColor: Colors.primary, borderRadius: 14, padding: 16,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Ionicons name="create-outline" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Editar información</Text>
                </Pressable>
              )}
            </Animated.View>
          )}

          {/* ── Modo edición ── */}
          {editing && (
            <Animated.View entering={FadeInDown.delay(0)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text }}>Editar información</Text>
                <Pressable onPress={() => setEditing(false)}>
                  <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
                </Pressable>
              </View>

              <Field label="Nombre de la finca *" error={errors.name?.message}>
                <Controller control={control} name="name" render={({ field: { onChange, onBlur, value } }) => (
                  <FInput hasError={!!errors.name} placeholder="Finca El Paraíso" onBlur={onBlur} onChangeText={onChange} value={value} />
                )} />
              </Field>

              <Field label="Dirección / Vereda">
                <Controller control={control} name="location" render={({ field: { onChange, onBlur, value } }) => (
                  <FInput placeholder="Vereda La Esperanza km 5" onBlur={onBlur} onChangeText={onChange} value={value} />
                )} />
              </Field>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Municipio">
                    <Controller control={control} name="municipality" render={({ field: { onChange, onBlur, value } }) => (
                      <FInput placeholder="Montería" onBlur={onBlur} onChangeText={onChange} value={value} />
                    )} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Departamento">
                    <Controller control={control} name="department" render={({ field: { onChange, onBlur, value } }) => (
                      <FInput placeholder="Córdoba" onBlur={onBlur} onChangeText={onChange} value={value} />
                    )} />
                  </Field>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Área (hectáreas)">
                    <Controller control={control} name="areaHectares" render={({ field: { onChange, onBlur, value } }) => (
                      <FInput placeholder="0.0" keyboardType="numeric" onBlur={onBlur}
                        onChangeText={(t: string) => onChange(t ? parseFloat(t) : undefined)}
                        value={value?.toString() ?? ''} />
                    )} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="RUT / NIT">
                    <Controller control={control} name="rut" render={({ field: { onChange, onBlur, value } }) => (
                      <FInput placeholder="900.123.456-1" onBlur={onBlur} onChangeText={onChange} value={value} />
                    )} />
                  </Field>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Teléfono">
                    <Controller control={control} name="phone" render={({ field: { onChange, onBlur, value } }) => (
                      <FInput placeholder="+57 300 000 0000" keyboardType="phone-pad" onBlur={onBlur} onChangeText={onChange} value={value} />
                    )} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Email" error={errors.email?.message}>
                    <Controller control={control} name="email" render={({ field: { onChange, onBlur, value } }) => (
                      <FInput hasError={!!errors.email} placeholder="finca@email.com" keyboardType="email-address" autoCapitalize="none" onBlur={onBlur} onChangeText={onChange} value={value} />
                    )} />
                  </Field>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Pressable
                  onPress={() => setEditing(false)}
                  style={({ pressed }) => ({
                    flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 15,
                    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: Colors.text, fontWeight: '600', fontSize: 15 }}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmit((d) => mutation.mutate(d as unknown as FormData))}
                  disabled={mutation.isPending}
                  style={({ pressed }) => ({
                    flex: 2, backgroundColor: Colors.primary, borderRadius: 14, padding: 15,
                    alignItems: 'center', opacity: pressed || mutation.isPending ? 0.7 : 1,
                  })}
                >
                  {mutation.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Guardar cambios</Text>}
                </Pressable>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
