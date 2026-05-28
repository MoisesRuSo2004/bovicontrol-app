import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator, FlatList, Modal, Pressable, ScrollView,
  Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { z } from 'zod';
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';

// ─── Departamentos de Colombia ────────────────────────────────────────────────

const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá',
  'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba',
  'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena',
  'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés', 'Vichada',
  'Bogotá D.C.',
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  farmName:           z.string().min(2, 'Nombre de finca requerido'),
  farmLocation:       z.string().optional(),
  farmDepartment:     z.string().optional(),
  farmPhone:          z.string().optional(),
  farmEmail:          z.string().email('Email inválido').or(z.literal('')).optional(),
  farmNotes:          z.string().optional(),
  firstName:          z.string().min(2, 'Nombre requerido'),
  lastName:           z.string().min(2, 'Apellido requerido'),
  username:           z.string().min(3, 'Mínimo 3 caracteres').regex(/^[a-z0-9._-]+$/, 'Solo letras min., números, puntos y guiones').or(z.literal('')).optional(),
  email:              z.string().email('Email inválido'),
  password:           z.string().min(6, 'Mínimo 6 caracteres'),
  phone:              z.string().optional(),
  subscriptionMonths: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const MONTHS_OPTIONS = [
  { label: '1 mes',      value: '1'  },
  { label: '3 meses',    value: '3'  },
  { label: '6 meses',    value: '6'  },
  { label: '1 año',      value: '12' },
  { label: 'Sin límite', value: '0'  },
];

// ─── Selector de departamento ─────────────────────────────────────────────────

function DepartmentPicker({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();

  const filtered = DEPARTAMENTOS.filter((d) =>
    d.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <Pressable
        onPress={() => { setSearch(''); setOpen(true); }}
        style={{
          backgroundColor: Colors.gray[50], borderRadius: 10,
          borderWidth: 1, borderColor: Colors.border,
          paddingHorizontal: 14, paddingVertical: 12,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 14, color: value ? Colors.text : Colors.textMuted }}>
          {value || 'Seleccionar departamento'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: Colors.card,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingBottom: insets.bottom + 16,
            maxHeight: '75%',
          }}>
            {/* Handle */}
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginTop: 12, marginBottom: 16 }} />

            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 12 }}>
                Seleccionar departamento
              </Text>
              {/* Buscador */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: Colors.gray[50], borderRadius: 12,
                borderWidth: 1, borderColor: Colors.border,
                paddingHorizontal: 12, paddingVertical: 10,
              }}>
                <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar..."
                  placeholderTextColor={Colors.textMuted}
                  style={{ flex: 1, fontSize: 14, color: Colors.text }}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <Pressable
                    onPress={() => { onChange(item); setOpen(false); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingHorizontal: 20, paddingVertical: 14,
                      backgroundColor: selected ? Colors.primary + '12' : (pressed ? Colors.gray[50] : 'transparent'),
                      borderBottomWidth: 0.5, borderBottomColor: Colors.border,
                    })}
                  >
                    <Text style={{ fontSize: 15, color: selected ? Colors.primary : Colors.text, fontWeight: selected ? '700' : '400' }}>
                      {item}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                  </Pressable>
                );
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />

            <Pressable
              onPress={() => setOpen(false)}
              style={{ marginHorizontal: 16, marginTop: 12, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.gray[100], alignItems: 'center' }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textMuted }}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({ label, error, children, required }: {
  label: string; error?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 6 }}>
        {label}{required && <Text style={{ color: '#ef4444' }}> *</Text>}
      </Text>
      {children}
      {error && <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

function Input({ value, onChange, placeholder, secureTextEntry, keyboardType, autoCapitalize, autoCorrect }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  secureTextEntry?: boolean; keyboardType?: any; autoCapitalize?: any; autoCorrect?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      autoCorrect={autoCorrect}
      style={{
        backgroundColor: Colors.gray[50], borderRadius: 10,
        borderWidth: 1, borderColor: Colors.border,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 14, color: Colors.text,
      }}
    />
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClientNewScreen() {
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { control, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { subscriptionMonths: '1' },
  });

  const selectedMonths = watch('subscriptionMonths');

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const months = data.subscriptionMonths ? +data.subscriptionMonths : undefined;
      const payload = {
        farmName:           data.farmName,
        farmLocation:       data.farmLocation?.trim()   || undefined,
        farmDepartment:     data.farmDepartment?.trim() || undefined,
        farmPhone:          data.farmPhone?.trim()      || undefined,
        farmEmail:          data.farmEmail?.trim()      || undefined,
        farmNotes:          data.farmNotes?.trim()      || undefined,
        firstName:          data.firstName,
        lastName:           data.lastName,
        email:              data.email,
        username:           data.username?.trim()       || undefined,
        password:           data.password,
        phone:              data.phone?.trim()          || undefined,
        subscriptionMonths: months && months > 0 ? months : undefined,
      };
      console.log('[client-new] payload →', JSON.stringify(payload, null, 2));
      return api.post('/admin/clients', payload);
    },
    onSuccess: (res) => {
      console.log('[client-new] success →', JSON.stringify(res.data));
      queryClient.invalidateQueries({ queryKey: ['admin-farms'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      Toast.show({ type: 'success', text1: 'Cliente creado', text2: 'Finca y usuario configurados correctamente' });
      router.back();
    },
    onError: (e: unknown) => {
      const axErr = e as any;
      console.error('[client-new] error status →', axErr?.response?.status);
      console.error('[client-new] error data  →', JSON.stringify(axErr?.response?.data));
      const msg = getErrorMessage(e);
      Toast.show({ type: 'error', text1: 'Error al crear cliente', text2: msg, visibilityTime: 6000 });
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#1e293b', paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#ffffff30', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#ffffff18', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person-add" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#f1f5f9' }}>Nuevo cliente</Text>
            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>Crear finca + usuario administrador</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#ffffff18', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Datos de la finca ── */}
        <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Ionicons name="business-outline" size={18} color={Colors.primary} />
            <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.text }}>Datos de la finca</Text>
          </View>

          <Controller name="farmName" control={control} render={({ field: { value, onChange } }) => (
            <Field label="Nombre de la finca" error={errors.farmName?.message} required>
              <Input value={value ?? ''} onChange={onChange} placeholder="Ej: Finca El Paraíso" />
            </Field>
          )} />

          {/* Departamento — selector */}
          <Controller name="farmDepartment" control={control} render={({ field: { value, onChange } }) => (
            <Field label="Departamento" error={errors.farmDepartment?.message}>
              <DepartmentPicker value={value} onChange={onChange} />
            </Field>
          )} />

          {/* Municipio — texto libre */}
          <Controller name="farmLocation" control={control} render={({ field: { value, onChange } }) => (
            <Field label="Municipio / Vereda" error={errors.farmLocation?.message}>
              <Input value={value ?? ''} onChange={onChange} placeholder="Ej: El Banco, vereda La Palma" />
            </Field>
          )} />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Controller name="farmPhone" control={control} render={({ field: { value, onChange } }) => (
                <Field label="Teléfono finca" error={errors.farmPhone?.message}>
                  <Input value={value ?? ''} onChange={onChange} placeholder="3001234567" keyboardType="phone-pad" autoCapitalize="none" />
                </Field>
              )} />
            </View>
            <View style={{ flex: 1 }}>
              <Controller name="farmEmail" control={control} render={({ field: { value, onChange } }) => (
                <Field label="Email finca" error={errors.farmEmail?.message}>
                  <Input value={value ?? ''} onChange={onChange} placeholder="finca@email.com" keyboardType="email-address" autoCapitalize="none" />
                </Field>
              )} />
            </View>
          </View>

          <Controller name="farmNotes" control={control} render={({ field: { value, onChange } }) => (
            <Field label="Notas internas" error={errors.farmNotes?.message}>
              <TextInput
                value={value ?? ''} onChangeText={onChange}
                placeholder="Ej: Pagó por transferencia, referido por..."
                placeholderTextColor={Colors.textMuted} multiline numberOfLines={2}
                style={{ backgroundColor: Colors.gray[50], borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: Colors.text, minHeight: 60, textAlignVertical: 'top' }}
              />
            </Field>
          )} />
        </View>

        {/* ── Usuario admin del cliente ── */}
        <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Ionicons name="person-outline" size={18} color="#6366f1" />
            <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.text }}>Usuario del cliente</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Controller name="firstName" control={control} render={({ field: { value, onChange } }) => (
                <Field label="Nombre" error={errors.firstName?.message} required>
                  <Input value={value ?? ''} onChange={onChange} placeholder="Juan" />
                </Field>
              )} />
            </View>
            <View style={{ flex: 1 }}>
              <Controller name="lastName" control={control} render={({ field: { value, onChange } }) => (
                <Field label="Apellido" error={errors.lastName?.message} required>
                  <Input value={value ?? ''} onChange={onChange} placeholder="Pérez" />
                </Field>
              )} />
            </View>
          </View>

          <Controller name="username" control={control} render={({ field: { value, onChange } }) => (
            <Field label="Usuario corto (para iniciar sesión)" error={errors.username?.message}>
              <Input value={value ?? ''} onChange={(v) => onChange(v.toLowerCase().replace(/\s/g, ''))} placeholder="ej: juan.perez" autoCapitalize="none" autoCorrect={false} />
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4 }}>
                Solo letras minúsculas, números, puntos y guiones.
              </Text>
            </Field>
          )} />

          <Controller name="email" control={control} render={({ field: { value, onChange } }) => (
            <Field label="Email" error={errors.email?.message} required>
              <Input value={value ?? ''} onChange={onChange} placeholder="cliente@email.com" keyboardType="email-address" autoCapitalize="none" />
            </Field>
          )} />

          <Controller name="password" control={control} render={({ field: { value, onChange } }) => (
            <Field label="Contraseña temporal" error={errors.password?.message} required>
              <Input value={value ?? ''} onChange={onChange} placeholder="Mínimo 6 caracteres" secureTextEntry />
            </Field>
          )} />

          <Controller name="phone" control={control} render={({ field: { value, onChange } }) => (
            <Field label="Teléfono del cliente" error={errors.phone?.message}>
              <Input value={value ?? ''} onChange={onChange} placeholder="3001234567" keyboardType="phone-pad" autoCapitalize="none" />
            </Field>
          )} />
        </View>

        {/* ── Suscripción ── */}
        <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Ionicons name="calendar-outline" size={18} color="#d97706" />
            <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.text }}>Suscripción</Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MONTHS_OPTIONS.map((opt) => {
              const isActive = selectedMonths === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setValue('subscriptionMonths', opt.value)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: isActive ? Colors.primary : Colors.gray[100],
                    borderWidth: 1.5, borderColor: isActive ? Colors.primary : Colors.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#fff' : Colors.textMuted }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 10, lineHeight: 16 }}>
            La suscripción empieza desde hoy. Puedes extenderla después desde el detalle de la finca.
          </Text>
        </View>

      </ScrollView>

      {/* ── Botón crear ── */}
      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 16, right: 16 }}>
        <Pressable
          onPress={handleSubmit(
            (d) => mutation.mutate(d),
            (validationErrors) => {
              console.error('[client-new] validation errors →', JSON.stringify(validationErrors, null, 2));
              Toast.show({ type: 'error', text1: 'Revisa el formulario', text2: 'Hay campos con error', visibilityTime: 4000 });
            },
          )}
          disabled={mutation.isPending}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#16a34a' : Colors.primary,
            borderRadius: 16, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: mutation.isPending ? 0.8 : 1,
            shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
          })}
        >
          {mutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="person-add-outline" size={20} color="#fff" />
          }
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>
            {mutation.isPending ? 'Creando...' : 'Crear cliente'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
