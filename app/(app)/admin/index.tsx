import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/colors';
import { api } from '../../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'BLOCKED' | 'UNLIMITED';

interface FarmRow {
  id: string; name: string; location?: string; department?: string;
  phone?: string; email?: string; isActive: boolean;
  subscriptionEndsAt?: string; subscriptionStatus: SubscriptionStatus;
  daysLeft: number | null; notes?: string; createdAt: string;
  _count: { animals: number; users: number };
  users: {
    id: string; firstName: string; lastName: string;
    email: string; username?: string; role: string; isActive: boolean; lastLoginAt?: string;
  }[];
}

interface Stats {
  totalFarms: number; activeFarms: number; expiredFarms: number; totalAnimals: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<SubscriptionStatus, { label: string; color: string; bg: string; dot: string }> = {
  ACTIVE:        { label: 'Activa',      color: '#15803d', bg: '#dcfce7', dot: '#22c55e' },
  EXPIRING_SOON: { label: 'Por vencer',  color: '#b45309', bg: '#fef3c7', dot: '#f59e0b' },
  EXPIRED:       { label: 'Vencida',     color: '#b91c1c', bg: '#fee2e2', dot: '#ef4444' },
  BLOCKED:       { label: 'Bloqueada',   color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
  UNLIMITED:     { label: 'Sin límite',  color: '#1d4ed8', bg: '#dbeafe', dot: '#6366f1' },
};

const SORT_ORDER: Record<SubscriptionStatus, number> = {
  EXPIRED: 0, EXPIRING_SOON: 1, ACTIVE: 2, UNLIMITED: 3, BLOCKED: 4,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLabel(days: number | null, status: SubscriptionStatus): string {
  if (status === 'UNLIMITED') return 'Sin vencimiento';
  if (days === null) return '—';
  if (days < 0) return `Venció hace ${Math.abs(days)}d`;
  if (days === 0) return 'Vence hoy';
  return `${days} días`;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, bg }: {
  label: string; value: number; icon: string; color: string; bg: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color + '25', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={{ fontSize: 24, fontWeight: '900', color, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: '700', color, opacity: 0.75, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

// ─── Farm card ────────────────────────────────────────────────────────────────

function FarmCard({ farm, index }: { farm: FarmRow; index: number }) {
  const router = useRouter();
  const st = STATUS_CFG[farm.subscriptionStatus];
  const admin = farm.users[0];

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <Pressable
        onPress={() => router.push({ pathname: '/(app)/admin/farm-detail', params: { farmId: farm.id } } as any)}
        style={({ pressed }) => ({
          backgroundColor: Colors.card,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: Colors.border,
          marginBottom: 10,
          overflow: 'hidden',
          opacity: pressed ? 0.92 : 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        })}
      >
        {/* Barra de color lateral */}
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: st.dot }} />

        <View style={{ padding: 14, paddingLeft: 18 }}>
          {/* Fila 1: nombre + badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.text }} numberOfLines={1}>
                {farm.name}
              </Text>
              {(farm.department || farm.location) && (
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 1 }} numberOfLines={1}>
                  {[farm.department, farm.location].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
            <View style={{ backgroundColor: st.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: st.color }}>{st.label.toUpperCase()}</Text>
            </View>
          </View>

          {/* Fila 2: suscripción + conteos */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: st.dot }} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: st.color }}>
                {daysLabel(farm.daysLeft, farm.subscriptionStatus)}
              </Text>
              {farm.subscriptionEndsAt && farm.subscriptionStatus !== 'UNLIMITED' && (
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                  · {fmtDate(farm.subscriptionEndsAt)}
                </Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="paw-outline" size={12} color={Colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.primary }}>{farm._count.animals}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="people-outline" size={12} color="#6366f1" />
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#6366f1' }}>{farm._count.users}</Text>
              </View>
            </View>
          </View>

          {/* Fila 3: usuario admin */}
          {admin && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: admin.isActive ? '#e0e7ff' : Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person" size={13} color={admin.isActive ? '#4f46e5' : Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.text }}>
                  {admin.firstName} {admin.lastName}
                  {admin.username ? <Text style={{ color: Colors.primary, fontWeight: '600' }}> @{admin.username}</Text> : ''}
                </Text>
                <Text style={{ fontSize: 10, color: Colors.textMuted }} numberOfLines={1}>{admin.email}</Text>
              </View>
              {admin.lastLoginAt && (
                <Text style={{ fontSize: 10, color: Colors.textMuted }}>
                  {fmtDate(admin.lastLoginAt)}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={14} color={Colors.gray[300]} />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SubscriptionStatus | 'ALL'>('ALL');

  const { data: farms, isLoading, refetch, isRefetching } = useQuery<FarmRow[]>({
    queryKey: ['admin-farms'],
    queryFn: () => api.get('/admin/farms').then((r) => {
      const d = r.data; return Array.isArray(d) ? d : (d?.data ?? []);
    }),
    staleTime: 1000 * 30,
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => {
      const d = r.data; return d?.data ?? d;
    }),
    staleTime: 1000 * 30,
  });

  const filtered = useMemo(() => {
    let list = (farms ?? []).slice().sort((a, b) => SORT_ORDER[a.subscriptionStatus] - SORT_ORDER[b.subscriptionStatus]);
    if (filter !== 'ALL') list = list.filter((f) => f.subscriptionStatus === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((f) =>
        f.name.toLowerCase().includes(q) ||
        f.users.some((u) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [farms, filter, search]);

  const FILTER_TABS: { key: SubscriptionStatus | 'ALL'; label: string }[] = [
    { key: 'ALL',          label: 'Todas' },
    { key: 'EXPIRED',      label: 'Vencidas' },
    { key: 'EXPIRING_SOON',label: 'Por vencer' },
    { key: 'ACTIVE',       label: 'Activas' },
    { key: 'UNLIMITED',    label: 'Sin límite' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>

      {/* ── Header ── */}
      <Animated.View entering={FadeInUp.duration(400)} style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 20 }}>

        {/* Título + botón nuevo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <View>
            <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Panel
            </Text>
            <Text style={{ color: '#f1f5f9', fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginTop: 1 }}>
              Administración
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(app)/admin/client-new' as any)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: pressed ? '#16a34a' : Colors.primary,
              paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
              shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
            })}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Nuevo</Text>
          </Pressable>
        </View>

        {/* Stats */}
        {stats && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatCard label="Total"    value={stats.totalFarms}   icon="business-outline"   color="#6366f1" bg="#1e1b4b" />
            <StatCard label="Activas"  value={stats.activeFarms}  icon="checkmark-circle-outline" color="#22c55e" bg="#052e16" />
            <StatCard label="Vencidas" value={stats.expiredFarms} icon="alert-circle-outline" color="#ef4444" bg="#1f0a0a" />
            <StatCard label="Animales" value={stats.totalAnimals} icon="paw-outline"          color="#38bdf8" bg="#082f49" />
          </View>
        )}
      </Animated.View>

      {/* ── Lista ── */}
      <View style={{ flex: 1, backgroundColor: Colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>

        {/* Búsqueda + filtros */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
          {/* Search bar */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1,
            borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10,
            marginBottom: 12,
          }}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar finca o usuario..."
              placeholderTextColor={Colors.textMuted}
              style={{ flex: 1, fontSize: 14, color: Colors.text }}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {FILTER_TABS.map((tab) => {
              const active = filter === tab.key;
              const st = tab.key !== 'ALL' ? STATUS_CFG[tab.key] : null;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setFilter(tab.key)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                    backgroundColor: active ? (st?.dot ?? Colors.primary) : Colors.card,
                    borderWidth: 1,
                    borderColor: active ? (st?.dot ?? Colors.primary) : Colors.border,
                  }}
                >
                  {tab.key !== 'ALL' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? '#fff' : st!.dot }} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : Colors.textMuted }}>
                        {tab.label}
                      </Text>
                    </View>
                  )}
                  {tab.key === 'ALL' && (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : Colors.textMuted }}>
                      {tab.label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Cargando fincas...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: insets.bottom + 32 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          >
            {/* Contador */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {filtered.length} finca{filtered.length !== 1 ? 's' : ''}
              {filter !== 'ALL' ? ` · ${FILTER_TABS.find(t => t.key === filter)?.label}` : ''}
              {search ? ` · "${search}"` : ''}
            </Text>

            {filtered.length === 0 ? (
              <Animated.View entering={FadeInDown.springify()} style={{ alignItems: 'center', paddingTop: 60, gap: 14 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="business-outline" size={36} color={Colors.gray[300]} />
                </View>
                <Text style={{ color: Colors.textMuted, fontSize: 15, fontWeight: '600' }}>
                  {search || filter !== 'ALL' ? 'Sin resultados' : 'Sin fincas registradas'}
                </Text>
                {!search && filter === 'ALL' && (
                  <Pressable
                    onPress={() => router.push('/(app)/admin/client-new' as any)}
                    style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Crear primer cliente</Text>
                  </Pressable>
                )}
              </Animated.View>
            ) : (
              filtered.map((farm, i) => <FarmCard key={farm.id} farm={farm} index={i} />)
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
