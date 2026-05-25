import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/colors';
import { api } from '../../../lib/api';
import {
  CostCategory,
  FinanceSummary,
  IncomeCategory,
  OperationalCost,
  Sale,
  IncomeRecord,
  SaleType,
} from '../../../types/finance.types';

// ─── Constants ───────────────────────────────────────────────────────────────

const EMERALD = '#059669';
const EMERALD_LIGHT = '#d1fae5';
const EMERALD_DARK = '#064e3b';

const SALE_TYPE_LABELS: Record<SaleType, string> = {
  ANIMAL:     'Animal',
  MILK:       'Leche',
  MEAT:       'Carne',
  SUBPRODUCT: 'Subproducto',
};

const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  FEED:            'Alimentación',
  VETERINARY:      'Veterinaria',
  LABOR:           'Mano de obra',
  INFRASTRUCTURE:  'Infraestructura',
  EQUIPMENT:       'Equipos',
  TRANSPORT:       'Transporte',
  MEDICINE:        'Medicamentos',
  SEED_FERTILIZER: 'Semillas/Abonos',
  OTHER:           'Otros',
};

const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  ANIMAL_SALE:    'Venta animal',
  MILK_SALE:      'Venta leche',
  MEAT_SALE:      'Venta carne',
  SUBPRODUCT_SALE:'Subproducto',
  SUBSIDY:        'Subsidio',
  OTHER:          'Otros',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function isoDate(d: Date) { return d.toISOString().split('T')[0]; }

function monthRange(offset = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const from = new Date(y, m, 1);
  const to   = new Date(y, m + 1, 0);
  return { from: isoDate(from), to: isoDate(to) };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProfitBar({ income, costs }: { income: number; costs: number }) {
  const max = Math.max(income, costs, 1);
  return (
    <View style={{ gap: 8 }}>
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 12, color: Colors.text, fontWeight: '600' }}>Ingresos</Text>
          <Text style={{ fontSize: 12, color: EMERALD, fontWeight: '700' }}>{fmt(income)}</Text>
        </View>
        <View style={{ height: 8, backgroundColor: Colors.gray[100], borderRadius: 4 }}>
          <View style={{ height: 8, backgroundColor: EMERALD, borderRadius: 4, width: `${(income / max) * 100}%` }} />
        </View>
      </View>
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 12, color: Colors.text, fontWeight: '600' }}>Costos</Text>
          <Text style={{ fontSize: 12, color: Colors.danger, fontWeight: '700' }}>{fmt(costs)}</Text>
        </View>
        <View style={{ height: 8, backgroundColor: Colors.gray[100], borderRadius: 4 }}>
          <View style={{ height: 8, backgroundColor: Colors.danger, borderRadius: 4, width: `${(costs / max) * 100}%` }} />
        </View>
      </View>
    </View>
  );
}

function CostBreakdown({ items }: { items: FinanceSummary['costsByCategory'] }) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.total), 1);
  return (
    <View style={{ gap: 10 }}>
      {items.sort((a, b) => b.total - a.total).map((item) => (
        <View key={item.category}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
            <Text style={{ fontSize: 12, color: Colors.text }}>{COST_CATEGORY_LABELS[item.category]}</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.danger }}>{fmt(item.total)}</Text>
          </View>
          <View style={{ height: 5, backgroundColor: Colors.gray[100], borderRadius: 3 }}>
            <View style={{ height: 5, backgroundColor: Colors.danger + 'cc', borderRadius: 3, width: `${(item.total / max) * 100}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function SaleRow({ item, index, onPress }: { item: Sale; index: number; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 50)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 8,
          flexDirection: 'row', alignItems: 'center', gap: 12,
          borderWidth: 1, borderColor: Colors.border,
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: EMERALD_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="cart-outline" size={20} color={EMERALD} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 14, color: Colors.text }}>
            {SALE_TYPE_LABELS[item.type]}{item.animal ? ` · ${item.animal.tagNumber}` : ''}
          </Text>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>
            {item.buyerName ?? 'Sin comprador'} · {new Date(item.saleDate).toLocaleDateString('es')}
          </Text>
          <Text style={{ fontSize: 11, color: Colors.textMuted }}>{item.quantity} {item.unit ?? 'und'} x {fmt(item.unitPrice)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: EMERALD }}>{fmt(item.totalAmount)}</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function CostRow({ item, index, onPress }: { item: OperationalCost; index: number; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 50)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 8,
          flexDirection: 'row', alignItems: 'center', gap: 12,
          borderWidth: 1, borderColor: Colors.border,
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trending-down-outline" size={20} color={Colors.danger} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 14, color: Colors.text }} numberOfLines={1}>{item.description}</Text>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>
            {COST_CATEGORY_LABELS[item.category]} · {new Date(item.costDate).toLocaleDateString('es')}
          </Text>
          {item.supplier && <Text style={{ fontSize: 11, color: Colors.textMuted }}>{item.supplier}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.danger }}>-{fmt(item.amount)}</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function IncomeRow({ item, index, onPress }: { item: IncomeRecord; index: number; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 50)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 8,
          flexDirection: 'row', alignItems: 'center', gap: 12,
          borderWidth: 1, borderColor: Colors.border,
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trending-up-outline" size={20} color="#7c3aed" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 14, color: Colors.text }} numberOfLines={1}>{item.description}</Text>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>
            {INCOME_CATEGORY_LABELS[item.category]} · {new Date(item.incomeDate).toLocaleDateString('es')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#7c3aed' }}>{fmt(item.amount)}</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

type Tab = 'sales' | 'costs' | 'incomes';
type Period = 'month' | 'prev';

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function FinanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('costs');
  const [period, setPeriod] = useState<Period>('month');
  const [refreshing, setRefreshing] = useState(false);

  const { from, to } = monthRange(period === 'month' ? 0 : -1);
  const periodLabel = period === 'month' ? 'Este mes' : 'Mes anterior';

  const { data: summary, refetch: refetchSummary } = useQuery<FinanceSummary>({
    queryKey: ['finance', 'summary', from, to],
    queryFn: () => api.get(`/finance/summary?from=${from}&to=${to}`).then((r) => r.data.data),
  });

  const { data: salesData, isLoading: loadingSales, refetch: refetchSales } = useQuery({
    queryKey: ['finance', 'sales', from, to],
    queryFn: () => api.get(`/finance/sales?from=${from}&to=${to}&limit=40`).then((r) => r.data.data ?? []),
  });

  const { data: costsData, isLoading: loadingCosts, refetch: refetchCosts } = useQuery({
    queryKey: ['finance', 'costs', from, to],
    queryFn: () => api.get(`/finance/costs?from=${from}&to=${to}&limit=40`).then((r) => r.data.data ?? []),
  });

  const { data: incomesData, isLoading: loadingIncomes, refetch: refetchIncomes } = useQuery({
    queryKey: ['finance', 'incomes', from, to],
    queryFn: () => api.get(`/finance/incomes?from=${from}&to=${to}&limit=40`).then((r) => r.data.data ?? []),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchSales(), refetchCosts(), refetchIncomes()]);
    setRefreshing(false);
  };

  const sales: Sale[] = salesData ?? [];
  const costs: OperationalCost[] = costsData ?? [];
  const incomes: IncomeRecord[] = incomesData ?? [];
  const isProfit = (summary?.netProfit ?? 0) >= 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
      >

        {/* Header */}
        <View style={{ backgroundColor: EMERALD, paddingTop: insets.top + 16, paddingBottom: 36, paddingHorizontal: 20 }}>
          {/* Decorative circles */}
          <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: '#ffffff12', position: 'absolute', top: -40, right: -30 }} pointerEvents="none" />
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#ffffff10', position: 'absolute', top: 30, right: 80 }} pointerEvents="none" />

          {/* Title row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </Pressable>
            <Ionicons name="wallet" size={26} color="#fff" />
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>Finanzas</Text>
          </View>

          {/* Period toggle pills */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {(['month', 'prev'] as Period[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: period === p ? '#fff' : '#ffffff33' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: period === p ? EMERALD : '#fff' }}>
                  {p === 'month' ? 'Este mes' : 'Mes anterior'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Net profit hero card */}
          <View style={{ backgroundColor: '#ffffff20', borderRadius: 18, padding: 18, marginTop: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#a7f3d0', marginBottom: 4 }}>Utilidad neta · {periodLabel}</Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff' }}>
              {summary ? fmt(summary.netProfit) : '—'}
            </Text>
            {summary && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                <Ionicons
                  name={isProfit ? 'arrow-up-circle' : 'arrow-down-circle'}
                  size={14}
                  color={isProfit ? '#a7f3d0' : '#fca5a5'}
                />
                <Text style={{ color: isProfit ? '#a7f3d0' : '#fca5a5', fontSize: 12, fontWeight: '600' }}>
                  Margen {summary.profitMargin}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* White curved section */}
        <View style={{ backgroundColor: Colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24, flex: 1, paddingTop: 20, paddingHorizontal: 16 }}>

          {/* 3 stat mini cards */}
          <Animated.View entering={FadeInDown.delay(0)} style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ backgroundColor: Colors.gray[50], borderRadius: 14, padding: 14, flex: 1, alignItems: 'center' }}>
              <Ionicons name="trending-up-outline" size={16} color={EMERALD} style={{ marginBottom: 4 }} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: EMERALD }}>{summary ? fmt(summary.totalIncome) : '—'}</Text>
              <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 2 }}>Ingresos</Text>
            </View>
            <View style={{ backgroundColor: Colors.gray[50], borderRadius: 14, padding: 14, flex: 1, alignItems: 'center' }}>
              <Ionicons name="trending-down-outline" size={16} color={Colors.danger} style={{ marginBottom: 4 }} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.danger }}>{summary ? fmt(summary.totalCosts) : '—'}</Text>
              <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 2 }}>Costos</Text>
            </View>
            <View style={{ backgroundColor: Colors.gray[50], borderRadius: 14, padding: 14, flex: 1, alignItems: 'center' }}>
              <Ionicons name="cart-outline" size={16} color={Colors.text} style={{ marginBottom: 4 }} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>{summary?.salesCount ?? '—'}</Text>
              <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 2 }}>Ventas</Text>
            </View>
          </Animated.View>

          {/* Report button */}
          <Animated.View entering={FadeInDown.delay(40)} style={{ marginBottom: 10 }}>
            <Pressable
              onPress={() => router.push('/(app)/finance/finance-report' as any)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e293b', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, opacity: pressed ? 0.85 : 1 })}
            >
              <Ionicons name="document-text-outline" size={20} color="#b45309" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#f1f5f9', fontSize: 13, fontWeight: '800' }}>Reporte Financiero PDF</Text>
                <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 1 }}>Ingresos, egresos y utilidad mensual</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#64748b" />
            </Pressable>
          </Animated.View>

          {/* 3 action cards */}
          <Animated.View entering={FadeInDown.delay(60)} style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => router.push('/(app)/finance/sale-new' as any)}
              style={({ pressed }) => ({ flex: 1, backgroundColor: EMERALD, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, opacity: pressed ? 0.85 : 1, shadowColor: EMERALD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 })}
            >
              <Ionicons name="cart-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Nueva venta</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/finance/cost-new' as any)}
              style={({ pressed }) => ({ flex: 1, backgroundColor: Colors.danger, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, opacity: pressed ? 0.85 : 1, shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 })}
            >
              <Ionicons name="trending-down-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Nuevo gasto</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/finance/income-new' as any)}
              style={({ pressed }) => ({ flex: 1, backgroundColor: '#8b5cf6', borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, opacity: pressed ? 0.85 : 1, shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 })}
            >
              <Ionicons name="trending-up-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Ingreso</Text>
            </Pressable>
          </Animated.View>

          {/* ProfitBar section */}
          {summary && (
            <Animated.View entering={FadeInDown.delay(120)} style={{ backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16, marginBottom: 14 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: Colors.text, marginBottom: 12 }}>
                Ingresos vs Costos
              </Text>
              <ProfitBar income={summary.totalIncome} costs={summary.totalCosts} />
            </Animated.View>
          )}

          {/* CostBreakdown section */}
          {summary && summary.costsByCategory.length > 0 && (
            <Animated.View entering={FadeInDown.delay(180)} style={{ backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16, marginBottom: 14 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: Colors.text, marginBottom: 12 }}>
                Gastos por categoria
              </Text>
              <CostBreakdown items={summary.costsByCategory} />
            </Animated.View>
          )}

          {/* Tab pills */}
          <Animated.View entering={FadeInDown.delay(220)} style={{ flexDirection: 'row', gap: 8, marginBottom: 14, marginTop: 4 }}>
            {([
              { key: 'costs'   as Tab, label: `Gastos (${costs.length})` },
              { key: 'sales'   as Tab, label: `Ventas (${sales.length})` },
              { key: 'incomes' as Tab, label: `Ingresos (${incomes.length})` },
            ] as const).map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: activeTab === t.key ? EMERALD : Colors.gray[50],
                  borderWidth: 1, borderColor: activeTab === t.key ? EMERALD : Colors.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: activeTab === t.key ? '#fff' : Colors.textMuted }}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </Animated.View>

          {/* Content */}
          <View style={{ paddingBottom: 32 }}>
            {activeTab === 'costs' && (
              loadingCosts ? <ActivityIndicator color={EMERALD} style={{ marginTop: 40 }} /> :
              costs.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 50 }}>
                  <Ionicons name="receipt-outline" size={56} color={Colors.gray[400]} />
                  <Text style={{ color: Colors.textMuted, marginTop: 12 }}>Sin gastos registrados</Text>
                  <Pressable onPress={() => router.push('/(app)/finance/cost-new' as any)} style={{ marginTop: 16, backgroundColor: Colors.danger, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Registrar gasto</Text>
                  </Pressable>
                </View>
              ) : costs.map((c, i) => (
                <CostRow key={c.id} item={c} index={i}
                  onPress={() => router.push({ pathname: '/(app)/finance/cost-new', params: { costId: c.id } } as any)} />
              ))
            )}
            {activeTab === 'sales' && (
              loadingSales ? <ActivityIndicator color={EMERALD} style={{ marginTop: 40 }} /> :
              sales.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 50 }}>
                  <Ionicons name="cart-outline" size={56} color={Colors.gray[400]} />
                  <Text style={{ color: Colors.textMuted, marginTop: 12 }}>Sin ventas registradas</Text>
                  <Pressable onPress={() => router.push('/(app)/finance/sale-new' as any)} style={{ marginTop: 16, backgroundColor: EMERALD, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Registrar venta</Text>
                  </Pressable>
                </View>
              ) : sales.map((s, i) => (
                <SaleRow key={s.id} item={s} index={i}
                  onPress={() => router.push({ pathname: '/(app)/finance/sale-new', params: { saleId: s.id } } as any)} />
              ))
            )}
            {activeTab === 'incomes' && (
              loadingIncomes ? <ActivityIndicator color={EMERALD} style={{ marginTop: 40 }} /> :
              incomes.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 50 }}>
                  <Ionicons name="trending-up-outline" size={56} color={Colors.gray[400]} />
                  <Text style={{ color: Colors.textMuted, marginTop: 12 }}>Sin ingresos registrados</Text>
                  <Pressable onPress={() => router.push('/(app)/finance/income-new' as any)} style={{ marginTop: 16, backgroundColor: '#7c3aed', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Registrar ingreso</Text>
                  </Pressable>
                </View>
              ) : incomes.map((inc, idx) => (
                <IncomeRow key={inc.id} item={inc} index={idx}
                  onPress={() => router.push({ pathname: '/(app)/finance/income-new', params: { incomeId: inc.id } } as any)} />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
