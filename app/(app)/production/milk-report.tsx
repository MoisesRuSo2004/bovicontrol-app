import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors } from '../../../constants/colors';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';

// ─── Theme ────────────────────────────────────────────────────────────────────
const CYAN   = '#0891b2';
const CYAN_L = '#cffafe';
const CYAN_D = '#164e63';

// ─── Types ────────────────────────────────────────────────────────────────────
// MilkSale model fields: id, saleDate, liters, notes, farmId
// Price comes from DairyConfig.pricePerLiter
interface MilkSale {
  id: string;
  saleDate: string;
  liters: number;
  notes?: string | null;
}

interface DairyConfig {
  pricePerLiter: number;
  buyerName?: string | null;
  paymentFrequency: string;
}

interface MilkSummary {
  totalLiters: number;
  recordCount: number;
  avgLitersPerRecord: number;
  animalsWithRecords: number;
  avgLitersPerAnimal: number;
  dailyTotals: { date: string; liters: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDateFull() {
  return new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${+d} ${months[+m - 1]} ${y}`;
}
function fmtCOP(n: number) {
  return '$ ' + Math.round(n).toLocaleString('es-CO');
}
function fmtL(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' L';
}

// ─── Period helpers ───────────────────────────────────────────────────────────
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function buildPeriods() {
  const now = new Date();
  const periods: { label: string; from: string; to: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    periods.push({ label: `${MONTH_NAMES[m]} ${y}`, from, to });
  }
  return periods;
}

// ─── PDF Builder ─────────────────────────────────────────────────────────────
function buildPdfHtml(
  summary: MilkSummary | null,
  milkSales: MilkSale[],
  config: DairyConfig | null,
  farmName: string,
  periodLabel: string,
) {
  const today       = fmtDateFull();
  const reportId    = `BC-LECHE-${Date.now().toString(36).toUpperCase()}`;
  const dailyTotals = summary?.dailyTotals ?? [];
  const daysCount   = dailyTotals.length;
  const avgPerDay   = daysCount > 0 && summary ? (summary.totalLiters / daysCount).toFixed(1) : '0';
  const pricePerL   = config?.pricePerLiter ?? 0;
  const buyerName   = config?.buyerName ?? '—';

  // Compute revenue for each sale using DairyConfig price
  const totalRevenue = milkSales.reduce((s, ms) => s + ms.liters * pricePerL, 0);

  const dailyRows = dailyTotals.map((day, i) => `
    <tr>
      <td style="background:${i%2===0?'#ECFEFF':'#fff'};padding:8px 12px;border-bottom:1px solid #A5F3FC;font-size:10.5px;color:#6B7280">${fmtDate(day.date + 'T00:00:00')}</td>
      <td style="background:${i%2===0?'#ECFEFF':'#fff'};padding:8px 12px;border-bottom:1px solid #A5F3FC;font-size:11px;font-weight:700;color:#0e7490;text-align:right">${fmtL(day.liters)}</td>
      <td style="background:${i%2===0?'#ECFEFF':'#fff'};padding:8px 12px;border-bottom:1px solid #A5F3FC;font-size:10.5px;font-weight:600;color:#059669;text-align:right">${pricePerL > 0 ? fmtCOP(day.liters * pricePerL) : '—'}</td>
      <td style="background:${i%2===0?'#ECFEFF':'#fff'};padding:8px 12px;border-bottom:1px solid #A5F3FC;font-size:10px;color:#9CA3AF;text-align:right">${(summary?.totalLiters ?? 0) > 0 ? ((day.liters / summary!.totalLiters) * 100).toFixed(1) + '%' : '—'}</td>
    </tr>`).join('');

  const salesRows = milkSales.map((ms, i) => {
    const revenue = ms.liters * pricePerL;
    return `
    <tr>
      <td style="background:${i%2===0?'#ECFEFF':'#fff'};padding:8px 12px;border-bottom:1px solid #A5F3FC;font-size:10.5px;color:#6B7280">${fmtDate(ms.saleDate)}</td>
      <td style="background:${i%2===0?'#ECFEFF':'#fff'};padding:8px 12px;border-bottom:1px solid #A5F3FC;font-size:11px;font-weight:700;color:#0e7490;text-align:right">${fmtL(ms.liters)}</td>
      <td style="background:${i%2===0?'#ECFEFF':'#fff'};padding:8px 12px;border-bottom:1px solid #A5F3FC;font-size:10.5px;color:#6B7280;text-align:right">${pricePerL > 0 ? fmtCOP(pricePerL) + '/L' : 'Sin precio'}</td>
      <td style="background:${i%2===0?'#ECFEFF':'#fff'};padding:8px 12px;border-bottom:1px solid #A5F3FC;font-size:10.5px;font-weight:700;color:#059669;text-align:right">${pricePerL > 0 ? fmtCOP(revenue) : '—'}</td>
      <td style="background:${i%2===0?'#ECFEFF':'#fff'};padding:8px 12px;border-bottom:1px solid #A5F3FC;font-size:10px;color:#6B7280">${ms.notes ?? buyerName}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<style>
  @page { margin:18mm 16mm 20mm 16mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1A1A1A; background:#fff; font-size:11px; line-height:1.45; }
  .letterhead { background:${CYAN_D}; padding:26px 32px 22px; }
  .lh-top { display:flex; justify-content:space-between; align-items:flex-start; }
  .lh-title { color:#fff; font-size:22px; font-weight:900; line-height:1.1; }
  .lh-subtitle { color:#67e8f9; font-size:10px; font-weight:600; margin-top:5px; text-transform:uppercase; letter-spacing:1px; }
  .lh-right { text-align:right; }
  .lh-report-id { color:#67e8f9; font-size:9px; font-weight:600; letter-spacing:1.2px; text-transform:uppercase; }
  .lh-farm { color:#fff; font-size:15px; font-weight:800; margin-top:4px; }
  .lh-date { color:#67e8f9; font-size:10px; margin-top:3px; }
  .accent-bar { height:4px; background:linear-gradient(90deg,#0891b2,#22d3ee,#0891b2); }
  .stats-strip { background:#155e75; padding:14px 32px; display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #22d3ee; }
  .ss-item { text-align:center; }
  .ss-label { font-size:9px; font-weight:700; color:#67e8f9; text-transform:uppercase; letter-spacing:.8px; margin-bottom:3px; }
  .ss-value { font-size:22px; font-weight:900; color:#fff; }
  .ss-sub { font-size:9px; color:#67e8f9; margin-top:1px; }
  .is-divider { width:1px; height:40px; background:#ffffff20; }
  .section-header { display:flex; align-items:center; gap:10px; padding:16px 32px 10px; }
  .sh-line { flex:1; height:1px; background:#A5F3FC; }
  .section-title { font-size:9px; font-weight:800; color:#374151; text-transform:uppercase; letter-spacing:1.2px; white-space:nowrap; }
  .table-wrap { padding:0 32px; }
  table { width:100%; border-collapse:collapse; }
  thead tr { background:${CYAN_D}; }
  th { color:#fff; font-size:9px; font-weight:700; padding:9px 12px; text-align:left; text-transform:uppercase; letter-spacing:.5px; }
  th.right { text-align:right; }
  td { vertical-align:middle; }
  .totals-row td { background:${CYAN_D}!important; color:#fff; font-weight:800; font-size:10.5px; padding:9px 12px; }
  .config-bar { background:#ecfeff; border:1px solid #a5f3fc; border-radius:6px; margin:0 32px 0; padding:10px 16px; display:flex; gap:32px; }
  .config-item { font-size:10px; color:#164e63; }
  .config-label { font-weight:600; color:#0891b2; text-transform:uppercase; font-size:9px; letter-spacing:.5px; }
  .footer-bar { margin:28px 0 0; border-top:3px solid ${CYAN_D}; padding:10px 32px; display:flex; justify-content:space-between; align-items:center; }
  .f-left { font-size:9px; color:#374151; line-height:1.6; }
  .f-center { font-size:9px; color:#4B5563; text-align:center; line-height:1.6; }
  .f-right { font-size:9px; color:${CYAN_D}; font-weight:800; text-align:right; line-height:1.6; }
  .mt16 { margin-top:16px; }
  .no-records { text-align:center; padding:20px; color:#9CA3AF; font-style:italic; font-size:11px; }
</style>
</head>
<body>

<div class="letterhead">
  <div class="lh-top">
    <div>
      <div class="lh-title">Reporte de Producción de Leche</div>
      <div class="lh-subtitle">Ordeño, Litros y Ventas del Período</div>
    </div>
    <div class="lh-right">
      <div class="lh-report-id">Ref. ${reportId}</div>
      <div class="lh-farm">${farmName}</div>
      <div class="lh-date">${periodLabel} &bull; Generado el ${today}</div>
    </div>
  </div>
</div>
<div class="accent-bar"></div>

<div class="stats-strip">
  <div class="ss-item">
    <div class="ss-label">Total producido</div>
    <div class="ss-value">${fmtL(summary?.totalLiters ?? 0)}</div>
    <div class="ss-sub">litros en el período</div>
  </div>
  <div class="is-divider"></div>
  <div class="ss-item">
    <div class="ss-label">Promedio diario</div>
    <div class="ss-value" style="font-size:18px">${avgPerDay} L</div>
    <div class="ss-sub">litros por día</div>
  </div>
  <div class="is-divider"></div>
  <div class="ss-item">
    <div class="ss-label">Días con ordeño</div>
    <div class="ss-value">${daysCount}</div>
    <div class="ss-sub">días registrados</div>
  </div>
  <div class="is-divider"></div>
  <div class="ss-item">
    <div class="ss-label">Entregas</div>
    <div class="ss-value">${milkSales.length}</div>
    <div class="ss-sub">registros de entrega</div>
  </div>
  <div class="is-divider"></div>
  <div class="ss-item">
    <div class="ss-label">Ingresos estimados</div>
    <div class="ss-value" style="font-size:${totalRevenue > 0 ? '14' : '20'}px;padding-top:${totalRevenue > 0 ? '4' : '0'}px">${totalRevenue > 0 ? fmtCOP(totalRevenue) : '—'}</div>
    <div class="ss-sub">${pricePerL > 0 ? 'a ' + fmtCOP(pricePerL) + '/L' : 'precio no configurado'}</div>
  </div>
</div>

<!-- Config info bar -->
<div style="padding:12px 32px 0">
  <div class="config-bar">
    <div class="config-item"><div class="config-label">Lechera / Comprador</div>${buyerName}</div>
    <div class="config-item"><div class="config-label">Precio por litro</div>${pricePerL > 0 ? fmtCOP(pricePerL) + ' / L' : 'No configurado'}</div>
    <div class="config-item"><div class="config-label">Frecuencia de pago</div>${config?.paymentFrequency === 'WEEKLY' ? 'Semanal' : config?.paymentFrequency === 'BIWEEKLY' ? 'Quincenal' : 'Mensual'}</div>
  </div>
</div>

${dailyTotals.length > 0 ? `
<div class="section-header">
  <div class="sh-line"></div>
  <div class="section-title">Producción diaria — ${dailyTotals.length} días registrados</div>
  <div class="sh-line"></div>
</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th style="width:110px">Fecha</th>
      <th class="right" style="width:110px">Litros</th>
      <th class="right" style="width:130px">Valor estimado</th>
      <th class="right" style="width:80px">% del mes</th>
    </tr></thead>
    <tbody>${dailyRows}</tbody>
    <tfoot>
      <tr class="totals-row">
        <td>TOTAL DEL PERÍODO</td>
        <td style="text-align:right">${fmtL(summary?.totalLiters ?? 0)}</td>
        <td style="text-align:right">${totalRevenue > 0 ? fmtCOP(totalRevenue) : '—'}</td>
        <td style="text-align:right">Prom: ${avgPerDay} L/día</td>
      </tr>
    </tfoot>
  </table>
</div>` : `
<div class="section-header">
  <div class="sh-line"></div>
  <div class="section-title">Sin registros de producción en el período</div>
  <div class="sh-line"></div>
</div>`}

${milkSales.length > 0 ? `
<div class="section-header mt16">
  <div class="sh-line"></div>
  <div class="section-title">Detalle de entregas — ${milkSales.length} registros</div>
  <div class="sh-line"></div>
</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th style="width:100px">Fecha</th>
      <th class="right" style="width:110px">Litros entregados</th>
      <th class="right" style="width:120px">Precio / L</th>
      <th class="right" style="width:130px">Total</th>
      <th>Notas / Comprador</th>
    </tr></thead>
    <tbody>${salesRows}</tbody>
    <tfoot>
      <tr class="totals-row">
        <td>TOTAL</td>
        <td style="text-align:right">${fmtL(milkSales.reduce((s, ms) => s + ms.liters, 0))}</td>
        <td style="text-align:right">${pricePerL > 0 ? fmtCOP(pricePerL) + '/L' : '—'}</td>
        <td style="text-align:right">${totalRevenue > 0 ? fmtCOP(totalRevenue) : '—'}</td>
        <td>${buyerName}</td>
      </tr>
    </tfoot>
  </table>
</div>` : ''}

<div class="footer-bar">
  <div class="f-left"><strong>${farmName}</strong><br>Ref. ${reportId} &bull; ${periodLabel}</div>
  <div class="f-center">Los valores son estimados basados en el precio configurado en la lechera.</div>
  <div class="f-right">BoviControl<br><span style="font-weight:400;color:#4B5563">Sistema de Gestión Ganadera</span></div>
</div>
</body>
</html>`;
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, bg, color, icon }: {
  label: string; value: string | number; sub?: string; bg: string; color: string; icon: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 14, padding: 12, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: color + '30' }}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={{ fontSize: 17, fontWeight: '900', color, marginTop: 2, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: '700', color, opacity: 0.7, textAlign: 'center' }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 9, color, opacity: 0.5, textAlign: 'center' }}>{sub}</Text> : null}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MilkReportScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { user } = useAuthStore();
  const PERIODS  = useMemo(() => buildPeriods(), []);
  const [periodIdx, setPeriodIdx] = useState(0);
  const [generating, setGenerating] = useState(false);

  const period = PERIODS[periodIdx];

  const { data: farm } = useQuery({
    queryKey: ['farm', user?.farmId],
    queryFn: () => api.get(`/farms/${user?.farmId}`).then((r) => r.data.data ?? r.data),
    enabled: !!user?.farmId,
  });
  const farmName: string = farm?.name ?? 'Mi Finca';

  // Fetch dairy config to get pricePerLiter and buyerName
  const { data: config } = useQuery<DairyConfig>({
    queryKey: ['dairy-config'],
    queryFn: () => api.get('/production/dairy-config').then((r) => r.data.data ?? r.data),
  });

  // Milk production summary (per-animal records aggregated by day)
  const { data: summary, isLoading: loadSum } = useQuery<MilkSummary>({
    queryKey: ['milk-summary-report', period.from, period.to],
    queryFn: () =>
      api.get('/production/milk/summary', { params: { from: period.from, to: period.to } })
        .then((r) => r.data.data ?? r.data),
  });

  // Milk sales (delivery records)
  const { data: milkSalesData, isLoading: loadSales } = useQuery<MilkSale[]>({
    queryKey: ['milk-sales-report', period.from, period.to],
    queryFn: async () => {
      const first = await api.get('/production/milk-sales', {
        params: { from: period.from, to: period.to, limit: 200, page: 1 },
      }).then((r) => r.data as { data: MilkSale[]; meta: { totalPages: number } });
      const all = [...first.data];
      if (first.meta?.totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: first.meta.totalPages - 1 }, (_, i) =>
            api.get('/production/milk-sales', {
              params: { from: period.from, to: period.to, limit: 200, page: i + 2 },
            }).then((r) => (r.data as { data: MilkSale[] }).data),
          ),
        );
        all.push(...rest.flat());
      }
      return all;
    },
  });

  const isLoading    = loadSum || loadSales;
  const milkSales    = milkSalesData ?? [];
  const dailyTotals  = summary?.dailyTotals ?? [];
  const pricePerL    = config?.pricePerLiter ?? 0;
  const buyerName    = config?.buyerName ?? '';
  const daysWithProd = dailyTotals.length;
  const avgPerDay    = daysWithProd > 0 && summary
    ? (summary.totalLiters / daysWithProd).toFixed(1)
    : '0';
  const totalLitersFromSales = milkSales.reduce((s, ms) => s + ms.liters, 0);
  const totalRevenue = totalLitersFromSales * pricePerL;
  const hasData      = (summary?.totalLiters ?? 0) > 0 || milkSales.length > 0;

  const generatePdf = async () => {
    if (!hasData) {
      Toast.show({ type: 'info', text1: 'Sin datos', text2: 'No hay producción de leche para el período seleccionado' });
      return;
    }
    try {
      setGenerating(true);
      const html = buildPdfHtml(summary ?? null, milkSales, config ?? null, farmName, period.label);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Reporte de Leche — ${period.label}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF generado', `Guardado en:\n${uri}`);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error al generar el PDF' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: CYAN_D, paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#ffffff30', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: CYAN + '40', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="water" size={28} color="#67e8f9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#ecfeff' }}>Reporte de Leche</Text>
            <Text style={{ fontSize: 12, color: '#67e8f9', marginTop: 2 }}>{farmName} · {fmtDateFull()}</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff15', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={20} color="#67e8f9" />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>

        {/* Period selector */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Período del reporte
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {PERIODS.map((p, i) => {
              const isActive = i === periodIdx;
              return (
                <Pressable
                  key={p.from}
                  onPress={() => setPeriodIdx(i)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: isActive ? CYAN : Colors.card,
                    borderWidth: 1.5, borderColor: isActive ? CYAN : Colors.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#fff' : Colors.textMuted }}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {isLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <ActivityIndicator size="large" color={CYAN} />
            <Text style={{ color: Colors.textMuted }}>Cargando datos de producción...</Text>
          </View>
        ) : (
          <>
            {/* Config info */}
            {config && (pricePerL > 0 || buyerName) && (
              <Animated.View entering={FadeInDown.delay(40).springify()} style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                <View style={{ backgroundColor: CYAN_L, borderRadius: 12, borderWidth: 1, borderColor: CYAN + '40', padding: 12, flexDirection: 'row', gap: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: CYAN, textTransform: 'uppercase', letterSpacing: 0.5 }}>Lechera</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: CYAN_D, marginTop: 2 }}>{buyerName || '—'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: CYAN, textTransform: 'uppercase', letterSpacing: 0.5 }}>Precio / Litro</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: CYAN_D, marginTop: 2 }}>{pricePerL > 0 ? fmtCOP(pricePerL) : 'No configurado'}</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Stats */}
            <Animated.View entering={FadeInDown.delay(60).springify()} style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard
                  label="Total producido"
                  value={`${(summary?.totalLiters ?? 0).toFixed(1)} L`}
                  bg={CYAN_L} color={CYAN_D} icon="water-outline"
                />
                <StatCard
                  label="Promedio diario"
                  value={`${avgPerDay} L`}
                  sub="por día"
                  bg="#ecfeff" color={CYAN} icon="trending-up-outline"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard
                  label="Días con ordeño"
                  value={daysWithProd}
                  bg="#f0f9ff" color="#0369a1" icon="calendar-outline"
                />
                <StatCard
                  label="Entregas registradas"
                  value={milkSales.length}
                  bg="#fef3c7" color="#b45309" icon="document-text-outline"
                />
              </View>
              {pricePerL > 0 && totalRevenue > 0 && (
                <StatCard
                  label="Ingresos estimados"
                  value={fmtCOP(totalRevenue)}
                  sub={`${milkSales.length} entrega(s) × ${fmtL(totalLitersFromSales)}`}
                  bg="#d1fae5" color="#065f46" icon="cash-outline"
                />
              )}
              {pricePerL === 0 && (
                <View style={{ backgroundColor: '#fef3c7', borderRadius: 10, borderWidth: 1, borderColor: '#fde68a', padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Ionicons name="alert-circle-outline" size={16} color="#b45309" />
                  <Text style={{ flex: 1, fontSize: 11, color: '#92400e' }}>
                    El precio por litro no está configurado. Ve a Leche → Configuración para establecerlo y ver los ingresos.
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* Daily production preview */}
            {dailyTotals.length > 0 && (
              <Animated.View entering={FadeInDown.delay(100).springify()} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: CYAN_L, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: CYAN + '30' }}>
                    <MaterialCommunityIcons name="water" size={16} color={CYAN} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: CYAN_D }}>Producción diaria ({dailyTotals.length} días)</Text>
                  </View>
                  {(() => {
                    const maxL = Math.max(...dailyTotals.map((d) => d.liters));
                    return dailyTotals.slice(0, 10).map((day, i) => (
                      <View key={day.date} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: i < Math.min(dailyTotals.length, 10) - 1 ? 1 : 0, borderBottomColor: Colors.border }}>
                        <Text style={{ width: 76, fontSize: 11, color: Colors.textMuted }}>{fmtDate(day.date + 'T00:00:00')}</Text>
                        <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.gray[100], marginHorizontal: 8 }}>
                          <View style={{ height: 8, borderRadius: 4, backgroundColor: CYAN, width: `${(day.liters / maxL) * 100}%` as any }} />
                        </View>
                        <Text style={{ width: 52, fontSize: 12, fontWeight: '700', color: CYAN_D, textAlign: 'right' }}>{day.liters.toFixed(1)} L</Text>
                        {pricePerL > 0 && (
                          <Text style={{ width: 80, fontSize: 11, fontWeight: '600', color: '#059669', textAlign: 'right' }}>{fmtCOP(day.liters * pricePerL)}</Text>
                        )}
                      </View>
                    ));
                  })()}
                  {dailyTotals.length > 10 && (
                    <View style={{ padding: 10, backgroundColor: CYAN_L + '60', borderTopWidth: 1, borderTopColor: CYAN + '20', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: CYAN, fontWeight: '600' }}>+{dailyTotals.length - 10} días más — incluidos en el PDF</Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            )}

            {/* Milk sales (delivery) list */}
            {milkSales.length > 0 && (
              <Animated.View entering={FadeInDown.delay(130).springify()} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: '#d1fae5', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#05966930' }}>
                    <Ionicons name="cash-outline" size={16} color="#059669" />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#065f46' }}>
                      Entregas de leche ({milkSales.length})
                    </Text>
                    {totalRevenue > 0 && (
                      <Text style={{ marginLeft: 'auto' as any, fontSize: 13, fontWeight: '900', color: '#059669' }}>
                        {fmtCOP(totalRevenue)}
                      </Text>
                    )}
                  </View>
                  {milkSales.slice(0, 6).map((ms, i) => (
                    <View key={ms.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: i < Math.min(milkSales.length, 6) - 1 ? 1 : 0, borderBottomColor: Colors.border, backgroundColor: i % 2 === 0 ? '#f0fdf4' : '#fff' }}>
                      <Text style={{ width: 80, fontSize: 11, color: Colors.textMuted }}>{fmtDate(ms.saleDate)}</Text>
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: CYAN_D }}>{fmtL(ms.liters)}</Text>
                      {pricePerL > 0
                        ? <Text style={{ fontSize: 13, fontWeight: '800', color: '#059669' }}>{fmtCOP(ms.liters * pricePerL)}</Text>
                        : <Text style={{ fontSize: 11, color: Colors.textMuted }}>sin precio</Text>
                      }
                    </View>
                  ))}
                  {milkSales.length > 6 && (
                    <View style={{ padding: 10, backgroundColor: '#d1fae540', borderTopWidth: 1, borderTopColor: '#05966920', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#059669', fontWeight: '600' }}>+{milkSales.length - 6} más — incluidos en el PDF</Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            )}

            {!hasData && (
              <Animated.View entering={FadeInDown.delay(80).springify()} style={{ paddingHorizontal: 16, alignItems: 'center', paddingTop: 40, gap: 12 }}>
                <MaterialCommunityIcons name="water-off" size={56} color={Colors.gray[300]} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textMuted }}>Sin producción en este período</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted, textAlign: 'center' }}>
                  No se encontraron registros de leche para {period.label}
                </Text>
              </Animated.View>
            )}

            {/* Tip */}
            <Animated.View entering={FadeInDown.delay(160).springify()} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <View style={{ backgroundColor: CYAN_L, borderRadius: 10, borderWidth: 1, borderColor: CYAN + '40', padding: 12, flexDirection: 'row', gap: 10 }}>
                <Ionicons name="bulb-outline" size={16} color={CYAN} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 11, color: CYAN_D, lineHeight: 16 }}>
                  El PDF incluye producción diaria con valor estimado por día, tabla de entregas con litros y precio por litro configurado en la lechera.
                </Text>
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 16, right: 16 }}>
        <Pressable
          onPress={generatePdf}
          disabled={generating || isLoading}
          style={({ pressed }) => ({
            backgroundColor: isLoading ? Colors.gray[200] : pressed ? CYAN_D + 'ee' : CYAN_D,
            borderRadius: 16, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            shadowColor: CYAN_D, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
            opacity: generating ? 0.8 : 1,
          })}
        >
          {generating
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="document-text" size={22} color={isLoading ? Colors.textMuted : '#fff'} />
          }
          <Text style={{ fontSize: 16, fontWeight: '800', color: isLoading ? Colors.textMuted : '#fff' }}>
            {generating ? 'Generando PDF...' : `Generar PDF — ${period.label}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
