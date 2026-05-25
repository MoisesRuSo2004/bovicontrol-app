import { zodResolver } from '@hookform/resolvers/zod';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { z } from 'zod';
import { getErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

const schema = z.object({
  login:    z.string().min(2, 'Ingresa tu usuario o email'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});
type FormData = z.infer<typeof schema>;

// ── Input field ───────────────────────────────────────────────────────────────
function Field({
  label,
  icon,
  error,
  rightElement,
  onBlur: onBlurProp,
  ...inputProps
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
  rightElement?: React.ReactNode;
  onBlur?: () => void;
  [key: string]: any;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: error ? '#ef4444' : focused ? '#16a34a' : '#e5e7eb',
          paddingHorizontal: 14,
        }}
      >
        <Ionicons
          name={icon}
          size={17}
          color={focused ? '#16a34a' : '#9ca3af'}
          style={{ marginRight: 10 }}
        />
        <TextInput
          style={{ flex: 1, paddingVertical: 14, fontSize: 15, color: '#111827' }}
          placeholderTextColor="#9ca3af"
          selectionColor="#16a34a"
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlurProp?.(); }}
          {...inputProps}
        />
        {rightElement}
      </View>
      {error && (
        <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{error}</Text>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const { login } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await login({ login: data.login.trim(), password: data.password });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error al ingresar', text2: getErrorMessage(error) });
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f3f4f6' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo ── */}
        <Animated.View
          entering={FadeInUp.delay(0).duration(500)}
          style={{
            alignItems: 'center',
            paddingTop: insets.top + 48,
            paddingBottom: 8,
            paddingHorizontal: 40,
          }}
        >
          <Image
            source={require('../../assets/images/logo.png')}
            style={{ width: 220, height: 220 }}
            resizeMode="contain"
          />
        </Animated.View>

        {/* ── Card ── */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(450)}
          style={{
            backgroundColor: '#fff',
            marginHorizontal: 20,
            marginTop: 4,
            borderRadius: 20,
            padding: 26,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 5,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 }}>
            Iniciar sesión
          </Text>
          <Text style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>
            Accede con tu usuario o correo electrónico
          </Text>

          <Controller
            control={control}
            name="login"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Usuario o email"
                icon="person-outline"
                error={errors.login?.message}
                placeholder="usuario o correo@ejemplo.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Contraseña"
                icon="lock-closed-outline"
                error={errors.password?.message}
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!showPassword}
                rightElement={
                  <Pressable onPress={() => setShowPassword((p) => !p)} hitSlop={12}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#9ca3af"
                    />
                  </Pressable>
                }
              />
            )}
          />

          {/* Botón */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#15803d' : '#16a34a',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              marginTop: 8,
              opacity: isSubmitting ? 0.75 : 1,
              shadowColor: '#16a34a',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 5,
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 }}>
                Ingresar
              </Text>
            )}
          </Pressable>
        </Animated.View>

        {/* ── Footer ── */}
        <Animated.View
          entering={FadeInDown.delay(240).duration(400)}
          style={{
            alignItems: 'center',
            marginTop: 24,
            paddingHorizontal: 32,
            paddingBottom: insets.bottom + 32,
            gap: 12,
          }}
        >
          <Text style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            ¿No tienes acceso? Contacta a tu administrador para crear tu cuenta.
          </Text>
          <Text style={{ color: '#d1d5db', fontSize: 11 }}>
            BoviControl · Sistema de Gestión Ganadera
          </Text>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
