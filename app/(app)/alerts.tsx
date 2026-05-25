import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/colors';
import { api } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertKind = 'VACCINE' | 'BIRTH' | 'HEALTH' | 'MILK' | 'PRODUCTION' | 'REPRODUCTION';
type Urgency   = 'OVERDUE' | 'TODAY' | 'WEEK' | 'LATER';

type SmartAlertType = 'VACCINATION_DUE' | 'BIRTH_UPCOMING' | 'MISSING_MILK' | 'LOW_PRODUCTION' | 'REPRODUCTIVE_DELAY';
type SmartPriority  = 'HIGH' | 'MEDIUM' | 'LOW';

interface SmartAlert {
  id: string;
  type: SmartAlertType;
  priority: SmartPriority;
  title: string;
  message: string;
  animalId?: string;
  animalTag?: string;
  animalName?: string | null;
  daysUntil?: number;
}

interface UnifiedAlert {
  id: string;
  kind: AlertKind;
  urgency: Urgency;
  daysFromNow: number;        // negative = overdue
  title: string;
  subtitle: string;
  animalId?: string;
  animalTag?: string;
  animalName?: string;
  rawDate: string;            // ISO
  resolvable?: boolean;       // health alerts only
}

// ─── Urgency helpers ──────────────────────────────────────────────────────────

function daysUntil(dateIso: string): number {
  const now   = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateIso); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function toUrgency(days: number): Urgency {
  if (days < 0)  return 'OVERDUE';
  if (days === 0) return 'TODAY';
  if (days <= 7)  return 'WEEK';
  return 'LATER';
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLabel(days: number): string {
  if (days < -1)  return `Vencido hace ${Math.abs(days)} días`;
  if (days === -1) return 'Venció ayer';
  if (days === 0)  return 'Hoy';
  if (days === 1)  return 'Mañana';
  return `En ${days} días`;
}

// ─── Config per urgency ───────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<Urgency, { label: string; bg: string; border: string; text: string; dot: string }> = {
  OVERDUE: { label: 'Vencido',       bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', dot: '#EF4444' },
  TODAY:   { label: 'Hoy',           bg: '#FFF7ED', border: '#FED7AA', text: '#92400E', dot: '#F97316' },
  WEEK:    { label: 'Esta semana',   bg: '#FFFBEB', border: '#FDE68A', text: '#78350F', dot: '#F59E0B' },
  LATER:   { label: 'Próximamente',  bg: '#F0FDF4', border: '#BBF7D0', text: '#14532D', dot: '#22C55E' },
};

const KIND_CONFIG: Record<AlertKind, { icon: string; color: string; label: string }> = {
  VACCINE:      { icon: 'medkit-outline',        color: '#D97706', label: 'Vacuna'       },
  BIRTH:        { icon: 'heart-outline',          color: '#8B5CF6', label: 'Parto'        },
  HEALTH:       { icon: 'warning-outline',        color: '#EF4444', label: 'Salud'        },
  MILK:         { icon: 'water-outline',          color: '#0EA5E9', label: 'Leche'        },
  PRODUCTION:   { icon: 'trending-down-outline',  color: '#F97316', label: 'Producción'   },
  REPRODUCTION: { icon: 'refresh-circle-outline', color: '#EC4899', label: 'Reproducción' },
};

/** Map a SmartAlert to our UnifiedAlert for the existing card UI */
function smartToUnified(s: SmartAlert): UnifiedAlert {
  let kind: AlertKind;
  switch (s.type) {
    case 'VACCINATION_DUE':   kind = 'VACCINE';      break;
    case 'BIRTH_UPCOMING':    kind = 'BIRTH';         break;
    case 'MISSING_MILK':      kind = 'MILK';          break;
    case 'LOW_PRODUCTION':    kind = 'PRODUCTION';    break;
    case 'REPRODUCTIVE_DELAY': kind = 'REPRODUCTION'; break;
    default:                  kind = 'HEALTH';
  }

  // Derive urgency: use daysUntil when available, else fall back on priority
  let urgency: Urgency;
  if (s.daysUntil !== undefined) {
    urgency = toUrgency(s.daysUntil);
  } else {
    urgency = s.priority === 'HIGH' ? 'TODAY' : s.priority === 'MEDIUM' ? 'WEEK' : 'LATER';
  }

  return {
    id:          s.id,
    kind,
    urgency,
    daysFromNow: s.daysUntil ?? (s.priority === 'HIGH' ? 0 : s.priority === 'MEDIUM' ? 5 : 14),
    title:       s.title,
    subtitle:    s.message,
    animalId:    s.animalId,
    animalTag:   s.animalTag,
    animalName:  s.animalName ?? undefined,
    rawDate:     new Date().toISOString(),
    resolvable:  false,
  };
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  index,
  onResolve,
  resolving,
}: {
  alert: UnifiedAlert;
  index: number;
  onResolve?: (id: string) => void;
  resolving?: boolean;
}) {
  const router  = useRouter();
  const urg     = URGENCY_CONFIG[alert.urgency];
  const kind    = KIND_CONFIG[alert.kind];

  function handlePress() {
    if (alert.animalId) {
      router.push(`/(app)/animals/${alert.animalId}` as any);
    }
  }

  return (
    <Animated.View entering={FadeInRight.delay(index * 50).duration(320)}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => ({
          backgroundColor: Colors.card,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: pressed ? urg.border : Colors.border,
          marginBottom: 10,
          overflow: 'hidden',
          opacity: pressed ? 0.92 : 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        })}
      >
        {/* Urgency accent bar */}
        <View style={{ height: 3, backgroundColor: urg.dot }} />

        <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Kind icon */}
          <View
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: kind.color + '18',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name={kind.icon as any} size={22} color={kind.color} />
          </View>

          {/* Content */}
          <View style={{ flex: 1, gap: 2 }}>
            {/* Kind chip + urgency */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={{ backgroundColor: kind.color + '18', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: kind.color }}>
                  {kind.label.toUpperCase()}
                </Text>
              </View>
              <View style={{ backgroundColor: urg.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1, borderColor: urg.border }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: urg.text }}>
                  {daysLabel(alert.daysFromNow)}
                </Text>
              </View>
            </View>

            {/* Title */}
            <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 2 }}>
              {alert.title}
            </Text>

            {/* Subtitle + animal */}
            <Text style={{ fontSize: 12, color: Colors.textMuted }}>
              {alert.subtitle}
            </Text>

            {alert.animalTag && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <MaterialCommunityIcons name="cow" size={13} color={Colors.primary} />
                <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600' }}>
                  {alert.animalName ?? alert.animalTag} · {alert.animalTag}
                </Text>
              </View>
            )}

            {/* Date */}
            <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
              {fmtDate(alert.rawDate)}
            </Text>
          </View>

          {/* Right side: resolve button or chevron */}
          {alert.resolvable ? (
            <Pressable
              onPress={() => onResolve?.(alert.id)}
              disabled={resolving}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#DCFCE7' : '#F0FDF4',
                borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0',
                paddingHorizontal: 10, paddingVertical: 7,
                alignItems: 'center', gap: 3,
              })}
            >
              {resolving
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Ionicons name="checkmark-circle-outline" size={20} color={Colors.primary} />
              }
              <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.primary }}>
                Listo
              </Text>
            </Pressable>
          ) : (
            alert.animalId && (
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            )
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ urgency, count }: { urgency: Urgency; count: number }) {
  const cfg = URGENCY_CONFIG[urgency];
  return (
    <Animated.View entering={FadeInDown.springify()} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cfg.dot }} />
      <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {cfg.label}
      </Text>
      <View style={{ backgroundColor: cfg.bg, borderRadius: 20, borderWidth: 1, borderColor: cfg.border, paddingHorizontal: 8, paddingVertical: 2 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.text }}>{count}</Text>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // ── Fetch all sources ────────────────────────────────────────────────────
  /** Smart alerts engine: vaccinations, births, missing milk, low production, reproductive delay */
  const { data: smartData, isLoading: smartLoading, refetch: refetchSmart } = useQuery<SmartAlert[]>({
    queryKey: ['alerts-smart'],
    queryFn: () => api.get('/notifications/alerts').then((r) => r.data ?? []),
    staleTime: 1000 * 60 * 5,
  });

  /** Legacy health alerts — HealthAlert records (user can mark as resolved) */
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['alerts-health'],
    queryFn: () =>
      api.get('/health/alerts/upcoming?daysAhead=30').then((r) => {
        const d = r.data;
        return Array.isArray(d) ? d : (d?.data ?? []);
      }),
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = smartLoading || healthLoading;

  function refetchAll() {
    refetchSmart(); refetchHealth();
  }

  // ── Resolve health alert ──────────────────────────────────────────────────
  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/health/alerts/${id}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-health'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-badge'] });
      Toast.show({ type: 'success', text1: 'Alerta resuelta' });
    },
    onError: () => Toast.show({ type: 'error', text1: 'No se pudo resolver la alerta' }),
  });

  // ── Helpers para normalizar respuestas ──────────────────────────────────
  function toArr(d: any): any[] {
    if (Array.isArray(d)) return d;
    if (d && Array.isArray(d.data)) return d.data;
    return [];
  }

  // ── Merge & categorize ───────────────────────────────────────────────────
  const alerts = useMemo<UnifiedAlert[]>(() => {
    // 1. Smart alerts (vaccination, birth, milk, production, reproductive)
    const smartAlerts: UnifiedAlert[] = (smartData ?? []).map(smartToUnified);

    // 2. Legacy HealthAlert records (manually created, user can resolve them)
    const healthArr = toArr(healthData);
    const healthAlerts: UnifiedAlert[] = healthArr.map((h: any) => {
      const days = daysUntil(h.scheduledDate);
      return {
        id:          String(h.id),
        kind:        'HEALTH' as AlertKind,
        urgency:     toUrgency(days),
        daysFromNow: days,
        title:       h.title ?? 'Alerta de salud',
        subtitle:    h.description ?? '',
        animalId:    h.animal?.id,
        animalTag:   h.animal?.tagNumber,
        animalName:  h.animal?.name,
        rawDate:     h.scheduledDate,
        resolvable:  true,
      };
    });

    return [...smartAlerts, ...healthAlerts]
      .sort((a, b) => a.daysFromNow - b.daysFromNow);
  }, [smartData, healthData]);

  const byUrgency = useMemo(() => {
    const map: Partial<Record<Urgency, UnifiedAlert[]>> = {};
    alerts.forEach((a) => {
      if (!map[a.urgency]) map[a.urgency] = [];
      map[a.urgency]!.push(a);
    });
    return map;
  }, [alerts]);

  const ORDER: Urgency[] = ['OVERDUE', 'TODAY', 'WEEK', 'LATER'];
  const totalUrgent = (byUrgency.OVERDUE?.length ?? 0) + (byUrgency.TODAY?.length ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* ── Header ── */}
      <View
        style={{
          backgroundColor: Colors.card,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          paddingTop: insets.top + 10,
          paddingBottom: 18,
          paddingHorizontal: 20,
        }}
      >
        {/* Drag handle */}
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 16 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="notifications" size={26} color="#EF4444" />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: Colors.text }}>
                Alertas
              </Text>
              {totalUrgent > 0 && (
                <View style={{ backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{totalUrgent}</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>
              Vacunas · Partos · Leche · Reproducción · Salud
            </Text>
          </View>

          <Pressable
            onPress={() => (router.canDismiss() ? router.dismiss() : router.back())}
            hitSlop={12}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.textMuted }}>Cargando alertas...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetchAll} tintColor={Colors.primary} />
          }
        >
          {/* ── Empty state ── */}
          {alerts.length === 0 && (
            <Animated.View entering={FadeInDown.springify()} style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="checkmark-circle" size={40} color={Colors.primary} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '800', color: Colors.text }}>Todo al día</Text>
              <Text style={{ fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 260 }}>
                No hay vacunas vencidas, partos próximos ni alertas de salud pendientes.
              </Text>
            </Animated.View>
          )}

          {/* ── Sections ── */}
          {ORDER.map((urgency) => {
            const items = byUrgency[urgency];
            if (!items?.length) return null;
            return (
              <View key={urgency} style={{ marginBottom: 8 }}>
                <SectionHeader urgency={urgency} count={items.length} />
                {items.map((alert, i) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    index={i}
                    onResolve={(id) => resolveMutation.mutate(id)}
                    resolving={resolveMutation.isPending && resolveMutation.variables === alert.id}
                  />
                ))}
              </View>
            );
          })}

          {/* ── Legend ── */}
          {alerts.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                {Object.entries(KIND_CONFIG).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name={v.icon as any} size={13} color={v.color} />
                    <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '600' }}>{v.label}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
