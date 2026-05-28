import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import type { MilkSalesSummary } from '../../types/milk.types';
import type { FinanceSummary } from '../../types/finance.types';

/* ─── tipos ─────────────────────────────────────────────────── */

type IconDef =
  | { lib: 'ion'; name: React.ComponentProps<typeof Ionicons>['name'] }
  | { lib: 'mci'; name: React.ComponentProps<typeof MaterialCommunityIcons>['name'] };

interface ModuleItem {
  label: string;
  icon: IconDef;
  route: string;
  color: string;
  bg: string;
}

/* ─── helpers ──────────────────────────────────────────────── */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function dateISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().split('T')[0];
}

/** Rellena los últimos N días con 0 si el backend no devuelve ese día */
function buildWeekSeries(
  chartData: { date: string; liters: number }[] = [],
  days = 7,
): number[] {
  return Array.from({ length: days }, (_, i) => {
    const target = dateISO(days - 1 - i);
    const found = chartData.find((d) => d.date?.startsWith(target));
    return found?.liters ?? 0;
  });
}

/** Rango del mes actual: primer día → hoy */
function currentMonthRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const to = now.toISOString().split('T')[0];
  return { from, to };
}

/** Mini card de Finanzas para el scroll horizontal */
function FinanceMiniCard({ summary, route }: { summary?: FinanceSummary; route: string }) {
  const router = useRouter();
  const profit = summary?.netProfit ?? 0;
  const isProfit = profit >= 0;
  const C = isProfit ? '#059669' : '#dc2626';

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

  return (
    <Pressable
      onPress={() => router.push(route as any)}
      style={({ pressed }) => ({
        width: 148,
        borderRadius: 20,
        padding: 16,
        backgroundColor: C,
        opacity: pressed ? 0.88 : 1,
        shadowColor: C,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="wallet" size={20} color="#fff" />
        </View>
        <Ionicons name="arrow-forward" size={13} color="#ffffff55" />
      </View>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 14, letterSpacing: -0.5 }}>
        {summary ? (isProfit ? '' : '-') + fmt(Math.abs(profit)) : '—'}
      </Text>
      <Text style={{ color: '#ffffffbb', fontSize: 11, fontWeight: '600', marginTop: 3 }}>
        {isProfit ? 'Utilidad este mes' : 'Pérdida este mes'}
      </Text>
    </Pressable>
  );
}

/* ─── datos estáticos ───────────────────────────────────────── */

const MODULES: ModuleItem[] = [
  { label: 'Animales',     icon: { lib: 'mci', name: 'cow' },          route: '/(app)/animals',      color: Colors.primary, bg: '#dcfce7' },
  { label: 'Sanidad',      icon: { lib: 'ion', name: 'medkit' },        route: '/(app)/health',       color: '#d97706',      bg: '#fef3c7' },
  { label: 'Reproducción', icon: { lib: 'mci', name: 'repeat' },        route: '/(app)/reproduction', color: Colors.info,    bg: '#dbeafe' },
  { label: 'Leche',        icon: { lib: 'mci', name: 'water' },         route: '/(app)/production',   color: '#0ea5e9',      bg: '#e0f2fe' },
  { label: 'Finanzas',     icon: { lib: 'ion', name: 'wallet' },        route: '/(app)/finance',      color: '#059669',      bg: '#d1fae5' },
  { label: 'Mi perfil',    icon: { lib: 'ion', name: 'person-circle' }, route: '/(app)/profile',      color: Colors.gray[500], bg: Colors.gray[100] },
];

const QUICK: ModuleItem[] = [
  { label: 'Animal', icon: { lib: 'mci', name: 'cow' },            route: '/(app)/animals/new',              color: Colors.primary, bg: '#dcfce7' },
  { label: 'Vacuna', icon: { lib: 'ion', name: 'medkit-outline' }, route: '/(app)/health/vaccination-new',   color: '#d97706',      bg: '#fef3c7' },
  { label: 'Leche',  icon: { lib: 'mci', name: 'water' },          route: '/(app)/production/milk-sale-new', color: '#0ea5e9',    bg: '#e0f2fe' },
  { label: 'Gasto',  icon: { lib: 'ion', name: 'trending-down' },  route: '/(app)/finance/cost-new',         color: '#ef4444',      bg: '#fee2e2' },
];

/* ─── sub-componentes ───────────────────────────────────────── */

function TablerIcon({ icon, size, color }: { icon: IconDef; size: number; color: string }) {
  if (icon.lib === 'ion')
    return <Ionicons name={icon.name as any} size={size} color={color} />;
  return <MaterialCommunityIcons name={icon.name as any} size={size} color={color} />;
}

/** Punto rojo con número sobre una card de módulo */
function Badge({ count, color = Colors.danger }: { count: number; color?: string }) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
        borderWidth: 2,
        borderColor: Colors.card,
        zIndex: 10,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', lineHeight: 12 }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

/** Mini gráfica de barras — últimos 7 días de leche */
function MilkMiniChart({
  series,
  route,
  earnings,
  periodLabel,
}: {
  series: number[];
  route: string;
  earnings?: number;
  periodLabel?: string;
}) {
  const router  = useRouter();
  const max     = Math.max(...series, 1);
  const CHART_H = 38;
  const C       = '#0ea5e9';
  const todayL  = series[series.length - 1] ?? 0;

  return (
    <Pressable
      onPress={() => router.push(route as any)}
      style={({ pressed }) => ({
        width: 148,
        borderRadius: 20,
        padding: 16,
        backgroundColor: C,
        opacity: pressed ? 0.88 : 1,
        shadowColor: C,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
      })}
    >
      {/* header row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="water" size={20} color="#fff" />
        </View>
        <Ionicons name="arrow-forward" size={13} color="#ffffff55" />
      </View>

      {/* barras */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 12, height: CHART_H }}>
        {series.map((val, i) => {
          const isToday = i === series.length - 1;
          const barH    = Math.max(4, (val / max) * CHART_H);
          return (
            <View key={i} style={{ flex: 1, height: barH, borderRadius: 3, backgroundColor: isToday ? '#ffffff' : '#ffffff44' }} />
          );
        })}
      </View>

      {/* valor principal: ganancias del período si hay config, si no litros hoy */}
      {earnings != null && earnings > 0 ? (
        <>
          <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 }}>
            ${earnings.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
          </Text>
          <Text style={{ color: '#ffffffbb', fontSize: 11, fontWeight: '600', marginTop: 2 }}>
            {periodLabel ?? 'Ganancias'}
          </Text>
        </>
      ) : (
        <>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 }}>
            {todayL > 0 ? todayL.toFixed(1) : '—'}
          </Text>
          <Text style={{ color: '#ffffffbb', fontSize: 11, fontWeight: '600', marginTop: 2 }}>
            Litros hoy
          </Text>
        </>
      )}
    </Pressable>
  );
}

/* ─── pantalla principal ────────────────────────────────────── */

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();


  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const farmId       = user?.farmId;

  /* queries — todas scopeadas por farmId para evitar cache cruzado entre usuarios */
  const { data: stats } = useQuery({
    queryKey: ['animals', 'stats', farmId],
    queryFn: () => api.get('/animals/stats').then((r) => r.data.data),
    enabled: !isSuperAdmin && !!farmId,
  });

  const { data: alerts } = useQuery({
    queryKey: ['health', 'alerts', 'upcoming', farmId],
    queryFn: () => api.get('/health/alerts/upcoming?daysAhead=7').then((r) => r.data.data ?? []),
    enabled: !isSuperAdmin && !!farmId,
  });

  const { data: farm } = useQuery({
    queryKey: ['farm', farmId],
    queryFn: () => api.get(`/farms/${farmId}`).then((r) => r.data.data),
    enabled: !isSuperAdmin && !!farmId,
  });

  const { data: milkSummary } = useQuery<MilkSalesSummary>({
    queryKey: ['milk-summary', farmId],
    queryFn: () => api.get('/production/milk-sales/summary').then((r) => r.data.data ?? r.data),
    enabled: !isSuperAdmin && !!farmId,
  });

  const { data: upcomingBirths } = useQuery({
    queryKey: ['reproduction', 'upcoming', 30, farmId],
    queryFn: () =>
      api.get('/reproduction/pregnancies/upcoming-births?daysAhead=30').then((r) => r.data.data ?? []),
    enabled: !isSuperAdmin && !!farmId,
  });

  const { from: finFrom, to: finTo } = currentMonthRange();
  const { data: financeSummary } = useQuery<FinanceSummary>({
    queryKey: ['finance', 'summary', finFrom, finTo, farmId],
    queryFn: () =>
      api.get(`/finance/summary?from=${finFrom}&to=${finTo}`).then((r) => r.data.data),
    enabled: !isSuperAdmin && !!farmId,
  });

  /* badge de alertas inteligentes (HIGH + MEDIUM del engine) */
  const { data: urgentBadge = 0 } = useQuery<number>({
    queryKey: ['alerts-badge'],
    queryFn: () =>
      api.get('/notifications/alerts').then((r) => {
        const list: Array<{ priority: string }> = r.data ?? [];
        return list.filter((a) => a.priority === 'HIGH' || a.priority === 'MEDIUM').length;
      }).catch(() => 0),
    staleTime: 1000 * 60 * 5,
  });

  /* valores derivados */
  const alertCount  = Array.isArray(alerts)         ? alerts.length         : 0;
  const birthCount  = Array.isArray(upcomingBirths) ? upcomingBirths.length : 0;
  const milkSeries  = buildWeekSeries(milkSummary?.chartData);

  /* banner de suscripción por vencer */
  const subscriptionDaysLeft: number | null = (() => {
    if (!farm?.subscriptionEndsAt) return null;
    const diff = new Date(farm.subscriptionEndsAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();
  const showSubscriptionBanner =
    !isSuperAdmin &&
    subscriptionDaysLeft !== null &&
    subscriptionDaysLeft >= 0 &&
    subscriptionDaysLeft <= 7;

  /* badges por módulo */
  const MODULE_BADGES: Record<string, { count: number; color: string }> = {
    'Sanidad':      { count: alertCount, color: Colors.danger },
    'Reproducción': { count: birthCount, color: Colors.info   },
  };

  /* stat cards (sin leche — tiene su propio componente) */
  interface StatCard { label: string; value: string | number; icon: IconDef; gradient: string; route: string; }
  const STAT_CARDS: StatCard[] = [
    { label: 'Animales activos', value: stats?.active     ?? '—', icon: { lib: 'mci', name: 'cow' },    gradient: Colors.primary, route: '/(app)/animals'      },
    { label: 'Gestaciones',      value: stats?.pregnancies ?? '—', icon: { lib: 'mci', name: 'repeat' }, gradient: Colors.info,    route: '/(app)/reproduction' },
    { label: 'Alertas',          value: alertCount,                icon: { lib: 'ion', name: 'warning' }, gradient: '#f59e0b',      route: '/(app)/health'       },
  ];

  const tabBarHeight = Platform.OS === 'ios' ? 88 : 68;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header verde ─────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: Colors.primary,
            paddingTop: insets.top + 14,
            paddingHorizontal: 22,
            paddingBottom: 52,
            overflow: 'hidden',
          }}
        >
          {/* círculos decorativos */}
          <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#ffffff0d', top: -60, right: -40 }} />
          <View style={{ position: 'absolute', width: 130, height: 130, borderRadius: 65,  backgroundColor: '#ffffff0a', bottom: 10, right: 80 }} />
          <View style={{ position: 'absolute', width: 80,  height: 80,  borderRadius: 40,  backgroundColor: '#ffffff0d', top: 20,   left: -20 }} />

          {/* Saludo + campana */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#86efac', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 }}>
                {greeting()}, {user?.firstName}
              </Text>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 }}>
                {farm?.name ?? 'Mi Finca'}
              </Text>
            </View>
            {/* Campana de alertas */}
            <Pressable
              onPress={() => router.push('/(app)/alerts' as any)}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: pressed ? '#ffffff30' : '#ffffff20',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: '#ffffff30',
              })}
            >
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {urgentBadge > 0 && (
                <View style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 10, height: 10, borderRadius: 5,
                  backgroundColor: '#EF4444',
                  borderWidth: 1.5, borderColor: Colors.primary,
                }} />
              )}
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Ionicons name="calendar-outline" size={13} color="#86efac" />
            <Text style={{ color: '#bbf7d0', fontSize: 12, fontWeight: '500' }}>
              {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>

          {farm?._count && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {[
                { icon: 'cow',            lib: 'mci', val: farm._count.animals, label: 'animales' },
                { icon: 'people-outline', lib: 'ion', val: farm._count.users,   label: 'usuarios' },
              ].map((item) => (
                <View
                  key={item.label}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: '#ffffff18', paddingHorizontal: 12,
                    paddingVertical: 6, borderRadius: 20,
                  }}
                >
                  {item.lib === 'mci'
                    ? <MaterialCommunityIcons name={item.icon as any} size={13} color="#bbf7d0" />
                    : <Ionicons name={item.icon as any} size={13} color="#bbf7d0" />}
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{item.val}</Text>
                  <Text style={{ color: '#86efac', fontSize: 11 }}>{item.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Sección blanca ───────────────────────────────────── */}
        <View
          style={{
            backgroundColor: Colors.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            marginTop: -24,
            paddingTop: 24,
            flexGrow: 1,
          }}
        >

          {/* ── Stat cards + MilkChart ──────────────────────── */}
          <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 14, paddingHorizontal: 22 }}>
            Resumen del hato
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 22, gap: 12, paddingBottom: 6 }}
          >
            {STAT_CARDS.map((card, i) => (
              <Animated.View key={card.label} entering={FadeInRight.delay(i * 80).duration(400)}>
                <Pressable
                  onPress={() => router.push(card.route as any)}
                  style={({ pressed }) => ({
                    width: 148,
                    borderRadius: 20,
                    padding: 16,
                    backgroundColor: card.gradient,
                    opacity: pressed ? 0.88 : 1,
                    shadowColor: card.gradient,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.35,
                    shadowRadius: 10,
                    elevation: 6,
                  })}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' }}>
                      <TablerIcon icon={card.icon} size={20} color="#fff" />
                    </View>
                    <Ionicons name="arrow-forward" size={13} color="#ffffff55" />
                  </View>
                  <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 14, letterSpacing: -1 }}>
                    {card.value}
                  </Text>
                  <Text style={{ color: '#ffffffbb', fontSize: 11, fontWeight: '600', marginTop: 3, lineHeight: 15 }}>
                    {card.label}
                  </Text>
                </Pressable>
              </Animated.View>
            ))}

            {/* Card de leche con mini gráfica */}
            <Animated.View entering={FadeInRight.delay(3 * 80).duration(400)}>
              <MilkMiniChart
                series={milkSeries}
                route="/(app)/production"
                earnings={milkSummary?.current.earnings}
                periodLabel={
                  milkSummary?.config.paymentFrequency === 'WEEKLY'   ? 'Esta semana' :
                  milkSummary?.config.paymentFrequency === 'BIWEEKLY' ? 'Esta quincena' :
                  'Este mes'
                }
              />
            </Animated.View>

            {/* Card de finanzas con utilidad del mes */}
            <Animated.View entering={FadeInRight.delay(4 * 80).duration(400)}>
              <FinanceMiniCard summary={financeSummary} route="/(app)/finance" />
            </Animated.View>
          </ScrollView>

          {/* ── Banner suscripción por vencer ───────────────── */}
          {showSubscriptionBanner && (
            <Animated.View entering={FadeInDown.delay(140).duration(400)}>
              <View style={{
                marginHorizontal: 22, marginTop: 20,
                backgroundColor: subscriptionDaysLeft === 0 ? '#fef2f2' : '#fff7ed',
                borderRadius: 16, padding: 14,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                borderWidth: 1.5,
                borderColor: subscriptionDaysLeft === 0 ? '#fecaca' : '#fed7aa',
              }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: subscriptionDaysLeft === 0 ? '#fee2e2' : '#ffedd5',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="calendar-outline" size={20} color={subscriptionDaysLeft === 0 ? '#dc2626' : '#ea580c'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: subscriptionDaysLeft === 0 ? '#991b1b' : '#9a3412', fontSize: 13 }}>
                    {subscriptionDaysLeft === 0
                      ? 'Tu suscripción vence hoy'
                      : `Suscripción vence en ${subscriptionDaysLeft} día${subscriptionDaysLeft !== 1 ? 's' : ''}`}
                  </Text>
                  <Text style={{ color: subscriptionDaysLeft === 0 ? '#b91c1c' : '#c2410c', fontSize: 12, marginTop: 1 }}>
                    Contacta a BoviControl para renovar
                  </Text>
                </View>
                <Ionicons name="alert-circle-outline" size={18} color={subscriptionDaysLeft === 0 ? '#dc2626' : '#ea580c'} />
              </View>
            </Animated.View>
          )}

          {/* ── Banner alertas ───────────────────────────────── */}
          {alertCount > 0 && (
            <Animated.View entering={FadeInDown.delay(160).duration(400)}>
              <Pressable
                onPress={() => router.push('/(app)/health' as any)}
                style={({ pressed }) => ({
                  marginHorizontal: 22, marginTop: 20,
                  backgroundColor: '#fffbeb', borderRadius: 16, padding: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  borderWidth: 1.5, borderColor: '#fde68a',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fde68a', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="warning" size={20} color="#d97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: '#92400e', fontSize: 13 }}>
                    {alertCount} alerta{alertCount > 1 ? 's' : ''} pendiente{alertCount > 1 ? 's' : ''}
                  </Text>
                  <Text style={{ color: '#b45309', fontSize: 12, marginTop: 1 }}>Toca para revisar sanidad</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#b45309" />
              </Pressable>
            </Animated.View>
          )}

          {/* ── Módulos con badges ───────────────────────────── */}
          <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 14 }}>
              Módulos
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {MODULES.map((mod, i) => {
                const badge = MODULE_BADGES[mod.label];
                return (
                  <Animated.View
                    key={mod.label}
                    entering={FadeInDown.delay(200 + i * 65).duration(400)}
                    style={{ width: '30%', flex: 1, minWidth: '28%' }}
                  >
                    <Pressable
                      onPress={() => router.push(mod.route as any)}
                      style={({ pressed }) => ({
                        backgroundColor: Colors.card,
                        borderRadius: 18,
                        paddingVertical: 18,
                        paddingHorizontal: 10,
                        alignItems: 'center',
                        opacity: pressed ? 0.8 : 1,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 3,
                      })}
                    >
                      <View
                        style={{
                          width: 50, height: 50, borderRadius: 25,
                          backgroundColor: mod.bg,
                          alignItems: 'center', justifyContent: 'center',
                          marginBottom: 10,
                        }}
                      >
                        <TablerIcon icon={mod.icon} size={25} color={mod.color} />
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.text, textAlign: 'center', lineHeight: 14 }}>
                        {mod.label}
                      </Text>

                      {/* Badge de alertas/partos */}
                      {badge && <Badge count={badge.count} color={badge.color} />}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          {/* ── Banner Super Admin ───────────────────────────── */}
          {isSuperAdmin && (
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <Pressable
                onPress={() => router.push('/(app)/admin' as any)}
                style={({ pressed }) => ({
                  marginHorizontal: 22, marginTop: 20,
                  backgroundColor: '#eef2ff',
                  borderRadius: 16, padding: 16,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  borderWidth: 1.5, borderColor: '#c7d2fe',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="shield-check" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: '#3730a3', fontSize: 14 }}>Panel de Administración</Text>
                  <Text style={{ color: '#6366f1', fontSize: 12, marginTop: 2 }}>Gestionar fincas y clientes</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#6366f1" />
              </Pressable>
            </Animated.View>
          )}

          {/* ── Registrar rápido ────────────────────────────── */}
          {!isSuperAdmin && (
          <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 14 }}>
              Registrar rápido
            </Text>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {QUICK.map((action, i) => (
                <Animated.View
                  key={action.label}
                  entering={FadeInDown.delay(400 + i * 60).duration(400)}
                  style={{ flex: 1 }}
                >
                  <Pressable
                    onPress={() => router.push(action.route as any)}
                    style={({ pressed }) => ({
                      backgroundColor: Colors.card,
                      borderRadius: 16,
                      paddingVertical: 16,
                      alignItems: 'center',
                      gap: 8,
                      borderWidth: 1.5,
                      borderColor: pressed ? action.color + '66' : Colors.border,
                      opacity: pressed ? 0.85 : 1,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.04,
                      shadowRadius: 4,
                      elevation: 2,
                    })}
                  >
                    <View
                      style={{
                        width: 42, height: 42, borderRadius: 21,
                        backgroundColor: action.bg,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <TablerIcon icon={action.icon} size={22} color={action.color} />
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.text, letterSpacing: 0.2 }}>
                      {action.label}
                    </Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}
