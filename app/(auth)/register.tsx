import { zodResolver } from '@hookform/resolvers/zod';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { z } from 'zod';
import { Colors } from '../../constants/colors';
import { getErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

// ─── Schema ───────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido').max(50),
  lastName:  z.string().min(1, 'El apellido es requerido').max(50),
  email:     z.string().email('Email no válido'),
  password:  z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Debe tener mayúsculas, minúsculas y números'),
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  phone: z.string().max(20).optional().or(z.literal('')),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

const step2Schema = z.object({
  farmName:         z.string().min(1, 'El nombre de la finca es requerido').max(150),
  farmDepartment:   z.string().max(100).optional().or(z.literal('')),
  farmMunicipality: z.string().max(100).optional().or(z.literal('')),
  farmLocation:     z.string().max(255).optional().or(z.literal('')),
  farmAreaHectares: z.string().optional().or(z.literal('')),
  farmRut:          z.string().max(20).optional().or(z.literal('')),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

// ─── Shared UI ────────────────────────────────────────────────────────────────

const INPUT = {
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: 12,
  padding: 14,
  fontSize: 15,
  backgroundColor: Colors.card,
  color: Colors.text,
} as const;

const INPUT_ERR = { ...INPUT, borderColor: Colors.danger } as const;

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 16 }}>
      {text}{required && <Text style={{ color: Colors.danger }}> *</Text>}
    </Text>
  );
}

function FieldErr({ msg }: { msg?: string }) {
  return msg ? <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>{msg}</Text> : null;
}

// ─── Step indicators ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
      {[1, 2].map((step) => {
        const active = step === current;
        const done = step < current;
        return (
          <View key={step} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{
              width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
              backgroundColor: active || done ? Colors.primary : Colors.gray[100],
              borderWidth: 2,
              borderColor: active || done ? Colors.primary : Colors.border,
            }}>
              {done
                ? <Ionicons name="checkmark" size={16} color="#fff" />
                : <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : Colors.textMuted }}>{step}</Text>
              }
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: active ? Colors.primary : Colors.textMuted }}>
              {step === 1 ? 'Tu cuenta' : 'Tu finca'}
            </Text>
            {step < 2 && (
              <View style={{ width: 24, height: 2, borderRadius: 1, backgroundColor: done ? Colors.primary : Colors.border }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuthStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  const goToStep2 = form1.handleSubmit((data) => {
    setStep1Data(data);
    setStep(2);
  });

  const onSubmit = form2.handleSubmit(async (data) => {
    if (!step1Data) return;
    setSubmitting(true);
    try {
      await register({
        firstName: step1Data.firstName,
        lastName:  step1Data.lastName,
        email:     step1Data.email,
        password:  step1Data.password,
        phone:     step1Data.phone || undefined,
        farmName:  data.farmName,
        farmDepartment:   data.farmDepartment   || undefined,
        farmMunicipality: data.farmMunicipality || undefined,
        farmLocation:     data.farmLocation     || undefined,
        farmAreaHectares: data.farmAreaHectares ? parseFloat(data.farmAreaHectares) : undefined,
        farmRut:          data.farmRut          || undefined,
      });
      // El AuthGate en _layout.tsx redirige automáticamente a /(app)
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error al registrarse', text2: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header verde — mismo estilo que login */}
      <View style={{ backgroundColor: Colors.primary, paddingTop: 64, paddingBottom: 36, alignItems: 'center' }}>
        <MaterialCommunityIcons name="cow" size={40} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 8 }}>BoviControl</Text>
        <Text style={{ color: '#dcfce7', fontSize: 13, marginTop: 3 }}>Crea tu cuenta gratuita</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <StepIndicator current={step} />

        {/* ── PASO 1: Datos personales ── */}
        {step === 1 && (
          <Animated.View entering={FadeInRight.springify()}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.text }}>Datos personales</Text>
            <Text style={{ color: Colors.textMuted, marginTop: 4, marginBottom: 8 }}>
              Esta será tu cuenta de acceso a la app
            </Text>

            {/* Nombre + Apellido */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Label text="Nombre" required />
                <Controller control={form1.control} name="firstName" render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={form1.formState.errors.firstName ? INPUT_ERR : INPUT}
                    placeholder="Juan"
                    placeholderTextColor={Colors.textMuted}
                    onBlur={onBlur} onChangeText={onChange} value={value}
                  />
                )} />
                <FieldErr msg={form1.formState.errors.firstName?.message} />
              </View>
              <View style={{ flex: 1 }}>
                <Label text="Apellido" required />
                <Controller control={form1.control} name="lastName" render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={form1.formState.errors.lastName ? INPUT_ERR : INPUT}
                    placeholder="Pérez"
                    placeholderTextColor={Colors.textMuted}
                    onBlur={onBlur} onChangeText={onChange} value={value}
                  />
                )} />
                <FieldErr msg={form1.formState.errors.lastName?.message} />
              </View>
            </View>

            {/* Email */}
            <Label text="Email" required />
            <Controller control={form1.control} name="email" render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={form1.formState.errors.email ? INPUT_ERR : INPUT}
                placeholder="juan@finca.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                onBlur={onBlur} onChangeText={onChange} value={value}
              />
            )} />
            <FieldErr msg={form1.formState.errors.email?.message} />

            {/* Teléfono (opcional) */}
            <Label text="Teléfono" />
            <Controller control={form1.control} name="phone" render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={INPUT}
                placeholder="+57 300 123 4567"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                onBlur={onBlur} onChangeText={onChange} value={value}
              />
            )} />

            {/* Contraseña */}
            <Label text="Contraseña" required />
            <View style={{ position: 'relative' }}>
              <Controller control={form1.control} name="password" render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[form1.formState.errors.password ? INPUT_ERR : INPUT, { paddingRight: 48 }]}
                  placeholder="Mín 8 · mayúscula · número"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPass}
                  onBlur={onBlur} onChangeText={onChange} value={value}
                />
              )} />
              <Pressable onPress={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 14, top: 14 }}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </Pressable>
            </View>
            <FieldErr msg={form1.formState.errors.password?.message} />

            {/* Confirmar contraseña */}
            <Label text="Confirmar contraseña" required />
            <View style={{ position: 'relative' }}>
              <Controller control={form1.control} name="confirmPassword" render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[form1.formState.errors.confirmPassword ? INPUT_ERR : INPUT, { paddingRight: 48 }]}
                  placeholder="Repite tu contraseña"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showConfirm}
                  onBlur={onBlur} onChangeText={onChange} value={value}
                />
              )} />
              <Pressable onPress={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 14, top: 14 }}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </Pressable>
            </View>
            <FieldErr msg={form1.formState.errors.confirmPassword?.message} />

            {/* Siguiente */}
            <Pressable
              onPress={goToStep2}
              style={({ pressed }) => ({
                backgroundColor: pressed ? Colors.primaryDark : Colors.primary,
                borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28,
                shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Siguiente</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </View>
            </Pressable>

            {/* Link login */}
            <Pressable onPress={() => router.back()} style={{ alignItems: 'center', marginTop: 20 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 14 }}>
                ¿Ya tienes cuenta? <Text style={{ color: Colors.primary, fontWeight: '700' }}>Inicia sesión</Text>
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── PASO 2: Datos de la finca ── */}
        {step === 2 && (
          <Animated.View entering={FadeInRight.springify()}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.text }}>Tu finca</Text>
            <Text style={{ color: Colors.textMuted, marginTop: 4, marginBottom: 8 }}>
              Registra los datos básicos de tu explotación ganadera
            </Text>

            {/* Card info */}
            <View style={{
              backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4,
            }}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
              <Text style={{ flex: 1, fontSize: 12, color: Colors.primary, lineHeight: 18 }}>
                Solo el nombre es obligatorio. Puedes completar el resto más tarde desde tu perfil.
              </Text>
            </View>

            {/* Nombre finca */}
            <Label text="Nombre de la finca" required />
            <Controller control={form2.control} name="farmName" render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={form2.formState.errors.farmName ? INPUT_ERR : INPUT}
                placeholder="Ej: Finca El Progreso"
                placeholderTextColor={Colors.textMuted}
                onBlur={onBlur} onChangeText={onChange} value={value}
              />
            )} />
            <FieldErr msg={form2.formState.errors.farmName?.message} />

            {/* Departamento + Municipio */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Label text="Departamento" />
                <Controller control={form2.control} name="farmDepartment" render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={INPUT}
                    placeholder="Ej: Antioquia"
                    placeholderTextColor={Colors.textMuted}
                    onBlur={onBlur} onChangeText={onChange} value={value}
                  />
                )} />
              </View>
              <View style={{ flex: 1 }}>
                <Label text="Municipio" />
                <Controller control={form2.control} name="farmMunicipality" render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={INPUT}
                    placeholder="Ej: Rionegro"
                    placeholderTextColor={Colors.textMuted}
                    onBlur={onBlur} onChangeText={onChange} value={value}
                  />
                )} />
              </View>
            </View>

            {/* Dirección */}
            <Label text="Dirección / Vereda" />
            <Controller control={form2.control} name="farmLocation" render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={INPUT}
                placeholder="Ej: Vereda La Esperanza, km 12"
                placeholderTextColor={Colors.textMuted}
                onBlur={onBlur} onChangeText={onChange} value={value}
              />
            )} />

            {/* Área + NIT */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Label text="Área (ha)" />
                <Controller control={form2.control} name="farmAreaHectares" render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={INPUT}
                    placeholder="Ej: 150"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    onBlur={onBlur} onChangeText={onChange} value={value}
                  />
                )} />
              </View>
              <View style={{ flex: 1 }}>
                <Label text="NIT / RUT" />
                <Controller control={form2.control} name="farmRut" render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={INPUT}
                    placeholder="Ej: 900.123.456-7"
                    placeholderTextColor={Colors.textMuted}
                    onBlur={onBlur} onChangeText={onChange} value={value}
                  />
                )} />
              </View>
            </View>

            {/* Botones */}
            <Pressable
              onPress={onSubmit}
              disabled={submitting}
              style={({ pressed }) => ({
                backgroundColor: pressed ? Colors.primaryDark : Colors.primary,
                borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32,
                shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
                opacity: submitting ? 0.75 : 1,
              })}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Crear mi cuenta</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => setStep(1)}
              style={{ alignItems: 'center', marginTop: 16 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="arrow-back" size={16} color={Colors.textMuted} />
                <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Volver al paso anterior</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
