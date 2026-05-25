import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator, Alert, Pressable, ScrollView,
  Text, TextInput, View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { z } from 'zod';
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  firstName: z.string().min(2, 'Nombre requerido'),
  lastName:  z.string().min(2, 'Apellido requerido'),
  phone:     z.string().optional(),
  username:  z.string().min(3, 'Mínimo 3 caracteres')
               .regex(/^[a-z0-9._-]+$/, 'Solo letras, números, puntos y guiones')
               .optional()
               .or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:  'Super Admin',
  ADMIN:        'Administrador',
  VETERINARIAN: 'Veterinario',
  OPERATOR:     'Operador',
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
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

function FInput({ error, ...props }: any) {
  return (
    <TextInput
      style={{
        borderWidth: 1, borderColor: error ? Colors.danger : Colors.border,
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, color: Colors.text, backgroundColor: Colors.gray[50],
      }}
      placeholderTextColor={Colors.textMuted}
      {...props}
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, logout, setUser } = useAuthStore();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const qc      = useQueryClient();
  const [editing, setEditing] = useState(false);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const { control, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      firstName: user?.firstName ?? '',
      lastName:  user?.lastName  ?? '',
      phone:     (user as any)?.phone ?? '',
      username:  (user as any)?.username ?? '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.patch(`/users/${user?.id}`, {
        firstName: data.firstName,
        lastName:  data.lastName,
        phone:     data.phone   || undefined,
        username:  data.username || undefined,
      }).then(r => r.data?.data ?? r.data),
    onSuccess: (updated) => {
      if (setUser && updated) setUser({ ...user!, ...updated });
      qc.invalidateQueries({ queryKey: ['me'] });
      setEditing(false);
      Toast.show({ type: 'success', text1: 'Perfil actualizado' });
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Deseas salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión', style: 'destructive',
        onPress: async () => {
          try { await logout(); router.replace('/(auth)/login'); }
          catch (e) { Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }); }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={{
          backgroundColor: Colors.primary,
          paddingTop: insets.top + 20,
          paddingBottom: 60,
          paddingHorizontal: 20,
          alignItems: 'center',
        }}>
          <View style={{ width: 160, height: 160, borderRadius: 80, backgroundColor: '#ffffff10', position: 'absolute', top: -50, right: -40 }} />
          <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#ffffff08', position: 'absolute', top: 10, left: -20 }} />

          <View style={{
            width: 88, height: 88, borderRadius: 44, backgroundColor: '#fff',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 3, borderColor: '#ffffff40',
            shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 8,
          }}>
            {initials
              ? <Text style={{ fontSize: 32, fontWeight: '800', color: Colors.primary }}>{initials}</Text>
              : <Ionicons name="person" size={42} color={Colors.primary} />}
          </View>

          <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 14 }}>
            {user?.firstName} {user?.lastName}
          </Text>
          {(user as any)?.username && (
            <Text style={{ fontSize: 13, color: '#bbf7d0', marginTop: 2 }}>@{(user as any).username}</Text>
          )}
          <Text style={{ fontSize: 13, color: '#86efac', marginTop: 2 }}>{user?.email}</Text>

          <View style={{ backgroundColor: '#ffffff20', paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20, marginTop: 10 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
              {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
            </Text>
          </View>
        </View>

        {/* ── Contenido ── */}
        <View style={{
          backgroundColor: Colors.card,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          marginTop: -32, paddingTop: 24, paddingHorizontal: 16, flex: 1,
        }}>

          {/* ── Editar / ver perfil ── */}
          {!editing ? (
            <Animated.View entering={FadeInDown.delay(0)}>
              {/* Info cards */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
                {[
                  { icon: 'person-outline', label: 'Rol', value: ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '—' },
                  { icon: 'call-outline',   label: 'Teléfono', value: (user as any)?.phone ?? '—' },
                ].map((item) => (
                  <View key={item.label} style={{ flex: 1, backgroundColor: Colors.gray[50], borderRadius: 14, padding: 14, alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                      <Ionicons name={item.icon as any} size={16} color={Colors.primary} />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.text, textAlign: 'center' }}>{item.value}</Text>
                    <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 4 }}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {/* Botón editar perfil */}
              <Pressable
                onPress={() => setEditing(true)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: pressed ? Colors.primaryDark : Colors.primary,
                  borderRadius: 14, paddingVertical: 14, marginTop: 16,
                })}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Editar perfil</Text>
              </Pressable>
            </Animated.View>
          ) : (
            /* ── Formulario de edición ── */
            <Animated.View entering={FadeInDown.delay(0)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text }}>Editar perfil</Text>
                <Pressable onPress={() => { setEditing(false); reset(); }}>
                  <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Nombre" error={errors.firstName?.message}>
                    <Controller name="firstName" control={control} render={({ field: { value, onChange, onBlur } }) => (
                      <FInput value={value} onChangeText={onChange} onBlur={onBlur} placeholder="Juan" error={errors.firstName} />
                    )} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Apellido" error={errors.lastName?.message}>
                    <Controller name="lastName" control={control} render={({ field: { value, onChange, onBlur } }) => (
                      <FInput value={value} onChangeText={onChange} onBlur={onBlur} placeholder="Pérez" error={errors.lastName} />
                    )} />
                  </Field>
                </View>
              </View>

              <Field label="Usuario (para iniciar sesión)" error={errors.username?.message}>
                <Controller name="username" control={control} render={({ field: { value, onChange, onBlur } }) => (
                  <FInput
                    value={value} onBlur={onBlur} error={errors.username}
                    onChangeText={(v: string) => onChange(v.toLowerCase().replace(/\s/g, ''))}
                    placeholder="juan.perez" autoCapitalize="none" autoCorrect={false}
                  />
                )} />
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4 }}>Solo letras, números, puntos y guiones</Text>
              </Field>

              <Field label="Teléfono">
                <Controller name="phone" control={control} render={({ field: { value, onChange, onBlur } }) => (
                  <FInput value={value} onChangeText={onChange} onBlur={onBlur} placeholder="3001234567" keyboardType="phone-pad" />
                )} />
              </Field>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <Pressable
                  onPress={() => { setEditing(false); reset(); }}
                  style={({ pressed }) => ({
                    flex: 1, backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 14,
                    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ color: Colors.text, fontWeight: '600', fontSize: 14 }}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmit((d) => updateMutation.mutate(d))}
                  disabled={updateMutation.isPending}
                  style={({ pressed }) => ({
                    flex: 2, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14,
                    alignItems: 'center', opacity: pressed || updateMutation.isPending ? 0.7 : 1,
                  })}
                >
                  {updateMutation.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Guardar cambios</Text>}
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* ── Admin panel — solo SUPER_ADMIN ── */}
          {user?.role === 'SUPER_ADMIN' && (
            <Animated.View entering={FadeInDown.delay(60)}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 24, marginBottom: 10 }}>
                Administración
              </Text>
              <Pressable
                onPress={() => router.push('/(app)/admin' as any)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#0f172a' : '#1e293b',
                  borderRadius: 16, padding: 16,
                  flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8,
                })}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff18', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="shield-checkmark" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' }}>Panel de administración</Text>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Gestionar fincas y suscripciones</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#64748b" />
              </Pressable>
            </Animated.View>
          )}

          {/* ── Configuración ── */}
          <Animated.View entering={FadeInDown.delay(80)}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 24, marginBottom: 10 }}>
              Configuración
            </Text>

            {[
              { label: 'Información de la finca', icon: 'home-outline',        route: '/(app)/profile/farm-info' },
              { label: 'Cambiar contraseña',      icon: 'lock-closed-outline', route: '/(app)/profile/change-password' },
            ].map((item) => (
              <Pressable
                key={item.label}
                onPress={() => router.push(item.route as any)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? Colors.gray[50] : Colors.card,
                  borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
                  padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
                </View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text }}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.gray[400]} />
              </Pressable>
            ))}
          </Animated.View>

          {/* ── Versión + Logout ── */}
          <Animated.View entering={FadeInDown.delay(120)} style={{ alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
            <Text style={{ fontSize: 12, color: Colors.gray[400] }}>BoviControl · v1.0.0</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(140)}>
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#fee2e2' : '#fef2f2',
                borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#fecaca',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
              })}
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
              <Text style={{ color: Colors.danger, fontSize: 15, fontWeight: '700' }}>Cerrar sesión</Text>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}
