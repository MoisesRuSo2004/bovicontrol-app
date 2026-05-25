import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Dimensions, Pressable,
  RefreshControl, ScrollView, Text, View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop, Rect, Line, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../../constants/colors';
import { api } from '../../../lib/api';
import type { MilkSale, MilkSalesSummary, PaymentFrequency } from '../../../types/milk.types';

// ─── Theme ────────────────────────────────────────────────────────────────────
const C       = '#0ea5e9';
const C_LIGHT = '#e0f2fe';
const C_DARK  = '#0c4a6e';

const { width: SCREEN_W } = Dimensions.get('window');

const FREQ_LABEL: Record<PaymentFrequency, string> = {
  WEEKLY:   'Esta semana',
  BIWEEKLY: 'Esta quincena',
  MONTHLY:  'Este mes',
};

const FREQ_PREV: Record<PaymentFrequency, string> = {
  WEEKLY:   'Semana anterior',
  BIWEEKLY: 'Quincena anterior',
  MONTHLY:  'Mes anterior',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCOP(n: number) {
  return n.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${+d} ${months[+m - 1]}`;
}

// ─── Chart ────────────────────────────────────────────────────────────────────
function MilkChart({ data }: { data: { date: string; liters: number }[] }) {
  if (!data.length) return null;

  const padH = 40; const padV = 20; const padB = 30;
  const chartW = SCREEN_W - 48;
  const chartH = 160;
  const innerW = chartW - padH;
  const innerH = chartH - padV - padB;

  const max = Math.max(...data.map((d) => d.liters), 1);
  const last = data.slice(-14); // hasta 14 barras

  const barW  = Math.min(28, (innerW / last.length) - 4);
  const gap   = (innerW - barW * last.length) / (last.length + 1);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Svg width={chartW} height={chartH}>
      <Defs>
        <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C} stopOpacity="1" />
          <Stop offset="1" stopColor={C} stopOpacity="0.4" />
        </LinearGradient>
        <LinearGradient id="todayGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#f59e0b" stopOpacity="1" />
          <Stop offset="1" stopColor="#f59e0b" stopOpacity="0.5" />
        </LinearGradient>
      </Defs>

      {/* Y-axis lines */}
      {[0, 0.5, 1].map((frac) => {
        const y = padV + innerH * (1 - frac);
        return (
          <Line key={frac} x1={padH} y1={y} x2={chartW} y2={y}
            stroke={Colors.border} strokeWidth={1} strokeDasharray="4 4" />
        );
      })}

      {/* Y labels */}
      {[0, Math.round(max / 2), max].map((val, i) => {
        const y = padV + innerH * (1 - val / max);
        return (
          <SvgText key={i} x={padH - 6} y={y + 4} fontSize={10} fill={Colors.textMuted} textAnchor="end">
            {val}L
          </SvgText>
        );
      })}

      {/* Bars */}
      {last.map((pt, i) => {
        const barH = Math.max(4, (pt.liters / max) * innerH);
        const x    = padH + gap + i * (barW + gap);
        const y    = padV + innerH - barH;
        const isToday = pt.date === today;
        const showLabel = last.length <= 7 || i === 0 || i === last.length - 1 || isToday;
        return (
          <Rect key={pt.date} x={x} y={y} width={barW} height={barH} rx={5}
            fill={isToday ? 'url(#todayGrad)' : 'url(#barGrad)'} />
        );
      })}

      {/* X labels — fecha */}
      {last.map((pt, i) => {
        const x = padH + gap + i * (barW + gap) + barW / 2;
        const isToday = pt.date === today;
        if (!isToday && last.length > 7 && i !== 0 && i !== last.length - 1) return null;
        return (
          <SvgText key={pt.date} x={x} y={chartH - 4} fontSize={9} fill={isToday ? '#f59e0b' : Colors.textMuted} textAnchor="middle" fontWeight={isToday ? '700' : '400'}>
            {isToday ? 'Hoy' : fmtDate(pt.date)}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, liters, earnings, secondary, color }: {
  label: string; liters: number; earnings: number;
  secondary?: string; color?: string;
}) {
  const col = color ?? C;
  return (
    <View style={{ flex: 1, backgroundColor: col + '12', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: col + '30' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: col, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{label}</Text>
      <Text style={{ fontSize: 26, fontWeight: '900', color: C_DARK }}>{liters.toLocaleString('es-CO', { maximumFractionDigits: 1 })}<Text style={{ fontSize: 14, fontWeight: '600' }}> L</Text></Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.primary, marginTop: 2 }}>${fmtCOP(earnings)}</Text>
      {secondary && <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4 }}>{secondary}</Text>}
    </View>
  );
}

// ─── Setup prompt ─────────────────────────────────────────────────────────────
function SetupPrompt({ onSetup }: { onSetup: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(60).springify()}>
      <View style={{ backgroundColor: C_LIGHT, borderRadius: 20, borderWidth: 1.5, borderColor: C + '50', borderStyle: 'dashed', padding: 28, alignItems: 'center', gap: 12 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C + '20', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="truck-delivery-outline" size={32} color={C} />
        </View>
        <Text style={{ fontSize: 17, fontWeight: '800', color: C_DARK, textAlign: 'center' }}>Configura tu lechera</Text>
        <Text style={{ fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
          Establece el precio por litro y la frecuencia de pago para ver tus ganancias automáticamente.
        </Text>
        <Pressable onPress={onSetup}
          style={({ pressed }) => ({ backgroundColor: C, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, opacity: pressed ? 0.85 : 1, marginTop: 4 })}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Configurar ahora</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LecheScreen() {
  const router  = useRouter();
  const qc      = useQueryClient();
  const insets  = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: summary, isLoading: loadingSummary } = useQuery<MilkSalesSummary>({
    queryKey: ['milk-summary'],
    queryFn: () => api.get('/production/milk-sales/summary').then((r) => r.data.data ?? r.data),
  });

  const { data: salesPage } = useQuery<{ data: MilkSale[] }>({
    queryKey: ['milk-sales'],
    queryFn: () => api.get('/production/milk-sales', { params: { limit: 10 } }).then((r) => r.data),
  });
  const sales: MilkSale[] = salesPage?.data ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['milk-summary'] });
    await qc.invalidateQueries({ queryKey: ['milk-sales'] });
    setRefreshing(false);
  };

  const config   = summary?.config;
  const hasSetup = config && config.pricePerLiter > 0;
  const freq     = (config?.paymentFrequency ?? 'MONTHLY') as PaymentFrequency;

  const changeIcon = () => {
    if (summary?.litersChange == null) return null;
    if (summary.litersChange > 0) return <Ionicons name="trending-up" size={14} color="#16a34a" />;
    if (summary.litersChange < 0) return <Ionicons name="trending-down" size={14} color={Colors.danger} />;
    return <Ionicons name="remove" size={14} color={Colors.textMuted} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* ── Header ── */}
      <View style={{
        backgroundColor: C_LIGHT, borderBottomWidth: 1, borderBottomColor: '#bae6fd',
        paddingTop: insets.top + 10, paddingBottom: 18, paddingHorizontal: 20,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C + '20', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="water" size={24} color={C} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: C_DARK }}>Control de Leche</Text>
            <Text style={{ fontSize: 12, color: C, fontWeight: '500' }}>
              {config?.buyerName ? `Lechera: ${config.buyerName}` : 'Registra tu producción diaria'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => router.push('/(app)/production/milk-report' as any)} hitSlop={10}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C + '15', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="document-text-outline" size={20} color={C} />
            </Pressable>
            <Pressable onPress={() => router.push('/(app)/production/milk-history' as any)} hitSlop={10}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C + '15', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="time-outline" size={20} color={C} />
            </Pressable>
            <Pressable onPress={() => router.push('/(app)/production/milk-config' as any)} hitSlop={10}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C + '15', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="settings-outline" size={20} color={C} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C} />}
      >
        {loadingSummary ? (
          <View style={{ paddingTop: 60, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={C} />
            <Text style={{ color: Colors.textMuted }}>Cargando datos...</Text>
          </View>
        ) : !hasSetup ? (
          <View style={{ marginTop: 16 }}>
            <SetupPrompt onSetup={() => router.push('/(app)/production/milk-config' as any)} />
          </View>
        ) : (
          <>
            {/* ── Período actual ── */}
            <Animated.View entering={FadeInDown.delay(60).springify()} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {FREQ_LABEL[freq]}
                </Text>
                {summary?.litersChange != null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: summary.litersChange >= 0 ? '#dcfce7' : '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                    {changeIcon()}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: summary.litersChange >= 0 ? '#16a34a' : Colors.danger }}>
                      {summary.litersChange > 0 ? '+' : ''}{summary.litersChange}%
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard
                  label={FREQ_LABEL[freq]}
                  liters={summary?.current.liters ?? 0}
                  earnings={summary?.current.earnings ?? 0}
                  secondary={`${summary?.current.recordCount ?? 0} registros · $${fmtCOP(config?.pricePerLiter ?? 0)}/L`}
                />
                <StatCard
                  label={FREQ_PREV[freq]}
                  liters={summary?.previous.liters ?? 0}
                  earnings={summary?.previous.earnings ?? 0}
                  color={Colors.textMuted}
                />
              </View>

              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 8, textAlign: 'center' }}>
                {summary?.current.from} — {summary?.current.to}
              </Text>
            </Animated.View>

            {/* ── Gráfica ── */}
            {(summary?.chartData?.length ?? 0) > 0 && (
              <Animated.View entering={FadeInDown.delay(120).springify()} style={{ marginBottom: 14 }}>
                <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                    <Ionicons name="bar-chart-outline" size={16} color={C} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>Últimos 14 días</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' }} />
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>Hoy</Text>
                    </View>
                  </View>
                  <MilkChart data={summary!.chartData} />
                </View>
              </Animated.View>
            )}

            {/* ── Registros recientes ── */}
            <Animated.View entering={FadeInDown.delay(180).springify()} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Registros recientes
                </Text>
              </View>

              {sales.length === 0 ? (
                <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 28, alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="water-off" size={32} color={Colors.textMuted} />
                  <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                    Aún no hay registros.{'\n'}Presiona + para agregar el primero.
                  </Text>
                </View>
              ) : (
                <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' }}>
                  {sales.map((sale, idx) => (
                    <Pressable key={sale.id}
                      onPress={() => router.push({ pathname: '/(app)/production/milk-sale-new', params: { saleId: sale.id } } as any)}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                        borderBottomWidth: idx < sales.length - 1 ? 1 : 0, borderBottomColor: Colors.border,
                        backgroundColor: pressed ? C_LIGHT : Colors.card,
                      })}>
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialCommunityIcons name="water" size={20} color={C} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: C_DARK }}>
                          {sale.liters.toLocaleString('es-CO', { maximumFractionDigits: 1 })} L
                        </Text>
                        {sale.notes ? (
                          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }} numberOfLines={1}>{sale.notes}</Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>
                          ${fmtCOP(sale.liters * (config?.pricePerLiter ?? 0))}
                        </Text>
                        <Text style={{ fontSize: 11, color: Colors.textMuted }}>{fmtDate(sale.saleDate)}</Text>
                      </View>
                      <Ionicons name="create-outline" size={14} color={Colors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <View style={{ position: 'absolute', bottom: insets.bottom + 20, right: 20 }}>
        <Pressable
          onPress={() => router.push('/(app)/production/milk-sale-new' as any)}
          style={({ pressed }) => ({
            width: 60, height: 60, borderRadius: 30, backgroundColor: C,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: C, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
            opacity: pressed ? 0.85 : 1,
          })}>
          <Ionicons name="add" size={30} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
