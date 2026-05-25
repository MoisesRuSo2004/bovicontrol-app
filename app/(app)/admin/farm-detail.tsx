import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors } from '../../../constants/colors';
import { api } from '../../../lib/api';

type SubscriptionStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'BLOCKED' | 'UNLIMITED';

const STATUS_CFG: Record<SubscriptionStatus, { label: string; color: string; bg: string }> = {
  ACTIVE:        { label: 'Activa',       color: '#15803d', bg: '#dcfce7' },
  EXPIRING_SOON: { label: 'Por vencer',   color: '#b45309', bg: '#fef3c7' },
  EXPIRED:       { label: 'Vencida',      color: '#b91c1c', bg: '#fee2e2' },
  BLOCKED:       { label: 'Bloqueada',    color: '#6b7280', bg: '#f3f4f6' },
  UNLIMITED:     { label: 'Sin límite',   color: '#1d4ed8', bg: '#dbeafe' },
};

const EXTEND_OPTIONS = [
  { label: '+1 mes',   months: 1  },
  { label: '+3 meses', months: 3  },
  { label: '+6 meses', months: 6  },
  { label: '+1 año',   months: 12 },
];

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
      <Text style={{ fontSize: 13, color: Colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text, maxWidth: '60%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export default function FarmDetailScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');

  const { data: farms, isLoading } = useQuery({
    queryKey: ['admin-farms'],
    queryFn: () => api.get('/admin/farms').then((r) => { const d = r.data; return Array.isArray(d) ? d : (d?.data ?? []); }),
    staleTime: 1000 * 30,
  });

  const farm = (farms ?? []).find((f: any) => f.id === farmId);

  // Extend subscription
  const extendMutation = useMutation({
    mutationFn: ({ months, notesTxt }: { months: number | null; notesTxt?: string }) =>
      api.patch(`/admin/farms/${farmId}/subscription`, { months, notes: notesTxt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-farms'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      Toast.show({ type: 'success', text1: 'Suscripción actualizada' });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Error al actualizar' }),
  });

  // Toggle farm
  const toggleFarmMutation = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/admin/farms/${farmId}/toggle`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-farms'] });
      Toast.show({ type: 'success', text1: 'Estado actualizado' });
    },
  });

  // Toggle user
  const toggleUserMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.patch(`/admin/users/${userId}/toggle`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-farms'] });
      Toast.show({ type: 'success', text1: 'Usuario actualizado' });
    },
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!farm) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <Text style={{ color: Colors.textMuted }}>Finca no encontrada</Text>
      </View>
    );
  }

  const st = STATUS_CFG[farm.subscriptionStatus as SubscriptionStatus];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#1e293b', paddingTop: insets.top + 12, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff18', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#f1f5f9' }} numberOfLines={1}>{farm.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <View style={{ backgroundColor: st.color + '30', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: st.bg === '#f3f4f6' ? '#374151' : st.color }}>{st.label.toUpperCase()}</Text>
              </View>
              {farm.daysLeft !== null && farm.subscriptionStatus !== 'UNLIMITED' && (
                <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                  {farm.daysLeft >= 0 ? `${farm.daysLeft} días restantes` : `Venció hace ${Math.abs(farm.daysLeft)} días`}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>

        {/* ── Info de la finca ── */}
        <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Información</Text>
          <InfoRow label="Departamento"   value={farm.department} />
          <InfoRow label="Ubicación"      value={farm.location} />
          <InfoRow label="Teléfono"       value={farm.phone} />
          <InfoRow label="Email"          value={farm.email} />
          <InfoRow label="Registrada"     value={fmtDate(farm.createdAt)} />
          <InfoRow label="Vence"          value={farm.subscriptionEndsAt ? fmtDate(farm.subscriptionEndsAt) : 'Sin límite'} />
          <View style={{ flexDirection: 'row', gap: 20, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: Colors.primary }}>{farm._count.animals}</Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>animales</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#6366f1' }}>{farm._count.users}</Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>usuarios</Text>
            </View>
          </View>
        </View>

        {/* ── Extender suscripción ── */}
        <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name="calendar" size={18} color="#d97706" />
            <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.text }}>Gestionar suscripción</Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {EXTEND_OPTIONS.map((opt) => (
              <Pressable
                key={opt.months}
                onPress={() => {
                  Alert.alert(
                    `Extender ${opt.label.replace('+', '')}`,
                    `¿Agregar ${opt.label.replace('+', '')} a la suscripción de ${farm.name}?`,
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Confirmar', onPress: () => extendMutation.mutate({ months: opt.months, notesTxt: notes || undefined }) },
                    ],
                  );
                }}
                disabled={extendMutation.isPending}
                style={({ pressed }) => ({
                  paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                  backgroundColor: pressed ? Colors.primary + 'dd' : Colors.primary,
                  opacity: extendMutation.isPending ? 0.6 : 1,
                })}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{opt.label}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                Alert.alert('Sin límite', `¿Activar sin límite de tiempo a ${farm.name}?`, [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Confirmar', onPress: () => extendMutation.mutate({ months: null }) },
                ]);
              }}
              style={({ pressed }) => ({
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                backgroundColor: pressed ? '#3730a3' : '#4f46e5', opacity: extendMutation.isPending ? 0.6 : 1,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Sin límite</Text>
            </Pressable>
          </View>

          <TextInput
            value={notes} onChangeText={setNotes}
            placeholder="Nota al extender (opcional)..."
            placeholderTextColor={Colors.textMuted} multiline
            style={{ backgroundColor: Colors.gray[50], borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.text, minHeight: 52, textAlignVertical: 'top' }}
          />
        </View>

        {/* ── Usuarios ── */}
        <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Usuarios</Text>
          {farm.users.map((u: any) => (
            <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: u.isActive ? '#e0e7ff' : Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person" size={18} color={u.isActive ? '#4f46e5' : Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>{u.firstName} {u.lastName}</Text>
                {u.username && (
                  <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.primary }}>@{u.username}</Text>
                )}
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>{u.email}</Text>
                {u.lastLoginAt && <Text style={{ fontSize: 10, color: Colors.textMuted }}>Último acceso: {fmtDate(u.lastLoginAt)}</Text>}
              </View>
              <Pressable
                onPress={() => {
                  const action = u.isActive ? 'desactivar' : 'activar';
                  Alert.alert(`${action.charAt(0).toUpperCase() + action.slice(1)} usuario`, `¿${action} a ${u.firstName}?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Confirmar', onPress: () => toggleUserMutation.mutate({ userId: u.id, isActive: !u.isActive }) },
                  ]);
                }}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: u.isActive ? '#fee2e2' : '#dcfce7', borderWidth: 1, borderColor: u.isActive ? '#fecaca' : '#bbf7d0' }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: u.isActive ? '#b91c1c' : '#15803d' }}>
                  {u.isActive ? 'Desactivar' : 'Activar'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* ── Acciones de la finca ── */}
        <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Acciones</Text>
          <Pressable
            onPress={() => {
              const action = farm.isActive ? 'bloquear' : 'activar';
              Alert.alert(`${action.charAt(0).toUpperCase() + action.slice(1)} finca`, `¿${action} a ${farm.name}? Esto afectará a todos sus usuarios.`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Confirmar', style: 'destructive', onPress: () => toggleFarmMutation.mutate(!farm.isActive) },
              ]);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: farm.isActive ? '#fee2e2' : '#dcfce7',
              borderRadius: 12, paddingVertical: 14, borderWidth: 1,
              borderColor: farm.isActive ? '#fecaca' : '#bbf7d0',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name={farm.isActive ? 'lock-closed-outline' : 'lock-open-outline'} size={18} color={farm.isActive ? '#b91c1c' : '#15803d'} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: farm.isActive ? '#b91c1c' : '#15803d' }}>
              {farm.isActive ? 'Bloquear finca' : 'Activar finca'}
            </Text>
          </Pressable>
        </View>

        {/* Notas internas */}
        {farm.notes && (
          <View style={{ backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', padding: 12, marginTop: 14, flexDirection: 'row', gap: 8 }}>
            <Ionicons name="document-text-outline" size={16} color="#d97706" />
            <Text style={{ flex: 1, fontSize: 12, color: '#92400e', lineHeight: 18 }}>{farm.notes}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
