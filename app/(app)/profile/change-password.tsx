import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
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
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  newPassword:     z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu nueva contraseña'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

function PasswordField({ label, placeholder, error, value, onChange, onBlur }: {
  label: string; placeholder?: string; error?: string;
  value: string; onChange: (v: string) => void; onBlur: () => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: error ? Colors.danger : Colors.border,
        borderRadius: 12, backgroundColor: Colors.gray[50],
      }}>
        <TextInput
          style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Colors.text }}
          placeholder={placeholder ?? '••••••••'}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={!visible}
          onBlur={onBlur}
          onChangeText={onChange}
          value={value}
        />
        <Pressable onPress={() => setVisible(v => !v)} style={{ padding: 14 }} hitSlop={8}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
        </Pressable>
      </View>
      {error && <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

export default function ChangePasswordScreen() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.patch(`/users/${user?.id}/change-password`, {
        currentPassword: data.currentPassword,
        newPassword:     data.newPassword,
      }),
    onSuccess: () => {
      reset();
      Toast.show({ type: 'success', text1: 'Contraseña actualizada', text2: 'Tu contraseña fue cambiada exitosamente' });
      router.back();
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
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#f1f5f9' }}>Cambiar contraseña</Text>
            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>Seguridad de tu cuenta</Text>
          </View>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff18', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Banner info */}
        <Animated.View entering={FadeInDown.delay(0)} style={{
          backgroundColor: Colors.primaryLight, borderRadius: 14,
          padding: 14, borderWidth: 1, borderColor: '#bbf7d0',
          flexDirection: 'row', gap: 12, marginBottom: 24, alignItems: 'center',
        }}>
          <Ionicons name="information-circle-outline" size={22} color={Colors.primary} />
          <Text style={{ flex: 1, fontSize: 13, color: Colors.primaryDark, lineHeight: 18 }}>
            Tu nueva contraseña debe tener al menos 8 caracteres. Después de cambiarla se cerrará sesión en todos los dispositivos.
          </Text>
        </Animated.View>

        {/* Contraseña actual */}
        <Animated.View entering={FadeInDown.delay(60)}>
          <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.text, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Contraseña actual
            </Text>
            <Controller control={control} name="currentPassword" render={({ field: { onChange, onBlur, value } }) => (
              <PasswordField
                label="Contraseña actual" placeholder="Tu contraseña actual"
                error={errors.currentPassword?.message}
                value={value ?? ''} onChange={onChange} onBlur={onBlur}
              />
            )} />
          </View>
        </Animated.View>

        {/* Nueva contraseña */}
        <Animated.View entering={FadeInDown.delay(120)}>
          <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.text, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Nueva contraseña
            </Text>
            <Controller control={control} name="newPassword" render={({ field: { onChange, onBlur, value } }) => (
              <PasswordField
                label="Nueva contraseña" placeholder="Mínimo 8 caracteres"
                error={errors.newPassword?.message}
                value={value ?? ''} onChange={onChange} onBlur={onBlur}
              />
            )} />
            <Controller control={control} name="confirmPassword" render={({ field: { onChange, onBlur, value } }) => (
              <PasswordField
                label="Confirmar nueva contraseña"
                error={errors.confirmPassword?.message}
                value={value ?? ''} onChange={onChange} onBlur={onBlur}
              />
            )} />
          </View>
        </Animated.View>

        {/* Botón */}
        <Animated.View entering={FadeInDown.delay(160)}>
          <Pressable
            onPress={handleSubmit((d) => mutation.mutate(d))}
            disabled={mutation.isPending}
            style={({ pressed }) => ({
              backgroundColor: pressed ? Colors.primaryDark : Colors.primary,
              borderRadius: 14, padding: 16, alignItems: 'center',
              opacity: pressed || mutation.isPending ? 0.7 : 1,
              shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
            })}
          >
            {mutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Actualizar contraseña</Text>}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
