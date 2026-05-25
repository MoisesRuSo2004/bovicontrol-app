import Ionicons from '@expo/vector-icons/Ionicons';
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
const SLATE  = '#1e293b';
const GOLD   = '#b45309';
const GOLD_L = '#fef3c7';
const GREEN  = '#059669';
const RED    = '#dc2626';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtCOP(n: number): string {
  return '$ ' + Math.round(n).toLocaleString('es-CO');
}

function fmtDateFull() {
  return new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${+d} ${months[+m - 1]} ${y}`;
}

// ─── Period helpers ───────────────────────────────────────────────────────────
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

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

// ─── Category labels ──────────────────────────────────────────────────────────
const COST_CAT: Record<string, string> = {
  FEED: 'Alimentación', VETERINARY: 'Veterinario', LABOR: 'Mano de obra',
  INFRASTRUCTURE: 'Infraestructura', EQUIPMENT: 'Equipos', TRANSPORT: 'Transporte',
  MEDICINE: 'Medicamentos', SEED_FERTILIZER: 'Semillas / Fertilizantes', OTHER: 'Otros',
};
const INCOME_CAT: Record<string, string> = {
  ANIMAL_SALE: 'Venta de animales', MILK_SALE: 'Venta de leche', MEAT_SALE: 'Venta de carne',
  SUBPRODUCT_SALE: 'Subproductos', SUBSIDY: 'Subsidio', OTHER: 'Otros ingresos',
};
const SALE_TYPE: Record<string, string> = {
  ANIMAL: 'Animal', MILK: 'Leche', MEAT: 'Carne', SUBPRODUCT: 'Subproducto',
};

// ─── PDF Builder ─────────────────────────────────────────────────────────────
function buildPdfHtml(
  summary: any,
  sales: any[],
  costs: any[],
  incomes: any[],
  farmName: string,
  periodLabel: string,
) {
  const today = fmtDateFull();
  const reportId = `BC-FIN-${Date.now().toString(36).toUpperCase()}`;
  const isProfit = summary.netProfit >= 0;

  const costsRows = costs.map((c, i) => `
    <tr>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px">${fmtDate(c.costDate)}</td>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px;font-weight:600">${COST_CAT[c.category] ?? c.category}</td>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px">${c.description}</td>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px;color:#6B7280">${c.supplier ?? '—'}</td>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px;text-align:right;font-weight:700;color:#dc2626">$ ${Math.round(c.amount).toLocaleString('es-CO')}</td>
    </tr>`).join('');

  const salesRows = sales.map((s, i) => `
    <tr>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px">${fmtDate(s.saleDate)}</td>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px;font-weight:600">${SALE_TYPE[s.type] ?? s.type}</td>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px">${s.description}</td>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px;color:#6B7280">${s.animal ? s.animal.tagNumber : '—'}</td>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px;text-align:right;font-weight:700;color:#059669">$ ${Math.round(s.totalAmount).toLocaleString('es-CO')}</td>
    </tr>`).join('');

  const incomesRows = incomes.map((inc, i) => `
    <tr>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px">${fmtDate(inc.incomeDate)}</td>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px;font-weight:600">${INCOME_CAT[inc.category] ?? inc.category}</td>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px">${inc.description}</td>
      <td style="background:${i%2===0?'#F8FAFC':'#fff'};padding:8px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px;text-align:right;font-weight:700;color:#059669">$ ${Math.round(inc.amount).toLocaleString('es-CO')}</td>
    </tr>`).join('');

  const costCatRows = (summary.costsByCategory ?? []).map((c: any) => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px;font-weight:600">${COST_CAT[c.category] ?? c.category}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px;text-align:center;color:#6B7280">${c.count}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #E2E8F0;font-size:10.5px;text-align:right;font-weight:700;color:#dc2626">$ ${Math.round(c.total).toLocaleString('es-CO')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #E2E8F0;font-size:10px;text-align:right;color:#6B7280">${summary.totalCosts > 0 ? ((c.total / summary.totalCosts) * 100).toFixed(1) + '%' : '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 18mm 16mm 20mm 16mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1A1A1A; background:#fff; font-size:11px; line-height:1.45; }
  .letterhead { background:${SLATE}; padding:26px 32px 22px; }
  .lh-top { display:flex; justify-content:space-between; align-items:flex-start; }
  .lh-title { color:#fff; font-size:22px; font-weight:900; line-height:1.1; }
  .lh-subtitle { color:#94a3b8; font-size:10px; font-weight:600; margin-top:5px; text-transform:uppercase; letter-spacing:1px; }
  .lh-right { text-align:right; }
  .lh-report-id { color:#94a3b8; font-size:9px; font-weight:600; letter-spacing:1.2px; text-transform:uppercase; }
  .lh-farm { color:#fff; font-size:15px; font-weight:800; margin-top:4px; }
  .lh-date { color:#94a3b8; font-size:10px; margin-top:3px; }
  .accent-bar { height:4px; background:linear-gradient(90deg,#b45309 0%,#d97706 50%,#b45309 100%); }
  .stats-strip { background:#334155; padding:14px 32px; display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #b45309; }
  .ss-item { text-align:center; }
  .ss-label { font-size:9px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.8px; margin-bottom:3px; }
  .ss-value { font-size:17px; font-weight:900; }
  .ss-sub { font-size:9px; color:#94a3b8; margin-top:1px; }
  .is-divider { width:1px; height:44px; background:#ffffff20; }
  .section-title { font-size:9px; font-weight:800; color:#374151; text-transform:uppercase; letter-spacing:1.2px; }
  .section-header { display:flex; align-items:center; gap:10px; padding:16px 32px 10px; }
  .sh-line { flex:1; height:1px; background:#E2E8F0; }
  .table-wrap { padding:0 32px; }
  table { width:100%; border-collapse:collapse; }
  thead tr { background:${SLATE}; }
  th { color:#fff; font-size:9px; font-weight:700; padding:9px 10px; text-align:left; text-transform:uppercase; letter-spacing:.5px; }
  th.right { text-align:right; }
  th.center { text-align:center; }
  td { vertical-align:middle; }
  .totals-row td { background:${SLATE}!important; color:#fff; font-weight:800; font-size:10.5px; padding:9px 10px; }
  .footer-bar { margin:28px 0 0; border-top:3px solid ${SLATE}; padding:10px 32px; display:flex; justify-content:space-between; align-items:center; }
  .f-left { font-size:9px; color:#374151; line-height:1.6; }
  .f-center { font-size:9px; color:#4B5563; text-align:center; line-height:1.6; }
  .f-right { font-size:9px; color:${SLATE}; font-weight:800; text-align:right; line-height:1.6; }
  .profit-box { display:inline-block; padding:2px 10px; border-radius:4px; font-size:10px; font-weight:800; background:${isProfit ? '#d1fae5' : '#fee2e2'}; color:${isProfit ? '#065f46' : '#991b1b'}; }
  .mt16 { margin-top:16px; }
  .no-records { text-align:center; padding:20px; color:#9CA3AF; font-style:italic; font-size:11px; }
</style>
</head>
<body>

<div class="letterhead">
  <div class="lh-top">
    <div>
      <div class="lh-title">Reporte Financiero</div>
      <div class="lh-subtitle">Resumen Mensual de Ingresos y Egresos</div>
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
    <div class="ss-label">Ingresos totales</div>
    <div class="ss-value" style="color:#4ade80;font-size:14px">$ ${Math.round(summary.totalIncome).toLocaleString('es-CO')}</div>
    <div class="ss-sub">ventas + otros</div>
  </div>
  <div class="is-divider"></div>
  <div class="ss-item">
    <div class="ss-label">Egresos totales</div>
    <div class="ss-value" style="color:#f87171;font-size:14px">$ ${Math.round(summary.totalCosts).toLocaleString('es-CO')}</div>
    <div class="ss-sub">${summary.costsCount} registros</div>
  </div>
  <div class="is-divider"></div>
  <div class="ss-item">
    <div class="ss-label">Utilidad neta</div>
    <div class="ss-value" style="color:${isProfit ? '#4ade80' : '#f87171'};font-size:14px">$ ${Math.round(Math.abs(summary.netProfit)).toLocaleString('es-CO')}</div>
    <div class="ss-sub">${isProfit ? 'ganancia' : 'pérdida'}</div>
  </div>
  <div class="is-divider"></div>
  <div class="ss-item">
    <div class="ss-label">Margen</div>
    <div class="ss-value" style="color:${isProfit ? '#4ade80' : '#f87171'};font-size:18px">${summary.profitMargin}</div>
    <div class="ss-sub">sobre ingresos</div>
  </div>
  <div class="is-divider"></div>
  <div class="ss-item">
    <div class="ss-label">Venta de animales</div>
    <div class="ss-value" style="color:#fff;font-size:14px">$ ${Math.round(summary.totalSalesRevenue).toLocaleString('es-CO')}</div>
    <div class="ss-sub">${summary.salesCount} venta(s)</div>
  </div>
</div>

${(summary.costsByCategory ?? []).length > 0 ? `
<div class="section-header">
  <div class="sh-line"></div>
  <div class="section-title">Egresos por categoría</div>
  <div class="sh-line"></div>
</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th>Categoría</th>
      <th class="center" style="width:60px">Registros</th>
      <th class="right" style="width:140px">Total egresado</th>
      <th class="right" style="width:70px">% del total</th>
    </tr></thead>
    <tbody>${costCatRows}</tbody>
    <tfoot>
      <tr class="totals-row">
        <td>TOTAL EGRESOS</td>
        <td style="text-align:center">${summary.costsCount}</td>
        <td style="text-align:right">$ ${Math.round(summary.totalCosts).toLocaleString('es-CO')}</td>
        <td style="text-align:right">100%</td>
      </tr>
    </tfoot>
  </table>
</div>` : ''}

${costs.length > 0 ? `
<div class="section-header mt16">
  <div class="sh-line"></div>
  <div class="section-title">Detalle de egresos (${costs.length} registros)</div>
  <div class="sh-line"></div>
</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th style="width:80px">Fecha</th>
      <th style="width:110px">Categoría</th>
      <th>Descripción</th>
      <th style="width:110px">Proveedor</th>
      <th class="right" style="width:120px">Monto</th>
    </tr></thead>
    <tbody>${costsRows}</tbody>
    <tfoot>
      <tr class="totals-row">
        <td colspan="4">TOTAL EGRESOS</td>
        <td style="text-align:right">$ ${Math.round(summary.totalCosts).toLocaleString('es-CO')}</td>
      </tr>
    </tfoot>
  </table>
</div>` : `<div class="section-header mt16"><div class="sh-line"></div><div class="section-title">Sin egresos en el período</div><div class="sh-line"></div></div>`}

${sales.length > 0 ? `
<div class="section-header mt16">
  <div class="sh-line"></div>
  <div class="section-title">Ventas registradas (${sales.length})</div>
  <div class="sh-line"></div>
</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th style="width:80px">Fecha</th>
      <th style="width:90px">Tipo</th>
      <th>Descripción</th>
      <th style="width:70px">Animal</th>
      <th class="right" style="width:120px">Total</th>
    </tr></thead>
    <tbody>${salesRows}</tbody>
    <tfoot>
      <tr class="totals-row">
        <td colspan="4">TOTAL VENTAS</td>
        <td style="text-align:right">$ ${Math.round(summary.totalSalesRevenue).toLocaleString('es-CO')}</td>
      </tr>
    </tfoot>
  </table>
</div>` : ''}

${incomes.length > 0 ? `
<div class="section-header mt16">
  <div class="sh-line"></div>
  <div class="section-title">Otros ingresos (${incomes.length})</div>
  <div class="sh-line"></div>
</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th style="width:80px">Fecha</th>
      <th style="width:130px">Categoría</th>
      <th>Descripción</th>
      <th class="right" style="width:120px">Monto</th>
    </tr></thead>
    <tbody>${incomesRows}</tbody>
    <tfoot>
      <tr class="totals-row">
        <td colspan="3">TOTAL OTROS INGRESOS</td>
        <td style="text-align:right">$ ${Math.round(summary.totalOtherIncome).toLocaleString('es-CO')}</td>
      </tr>
    </tfoot>
  </table>
</div>` : ''}

<div class="footer-bar">
  <div class="f-left"><strong>${farmName}</strong><br>Ref. ${reportId} &bull; ${periodLabel}</div>
  <div class="f-center">Documento de uso interno. Verifique cifras antes de presentación oficial.</div>
  <div class="f-right">BoviControl<br><span style="font-weight:400;color:#4B5563">Sistema de Gestión Ganadera</span></div>
</div>
</body>
</html>`;
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, bg, color, icon }: {
  label: string; value: string; sub?: string; bg: string; color: string; icon: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 14, padding: 12, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: color + '30' }}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={{ fontSize: 13, fontWeight: '900', color, marginTop: 2, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: '700', color, opacity: 0.7, textAlign: 'center' }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 9, color, opacity: 0.5, textAlign: 'center' }}>{sub}</Text> : null}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FinanceReportScreen() {
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

  const { data: summary, isLoading: loadSum } = useQuery({
    queryKey: ['finance-summary', period.from, period.to],
    queryFn: () => api.get('/finance/summary', { params: { from: period.from, to: period.to } }).then((r) => r.data.data ?? r.data),
  });

  const { data: salesData, isLoading: loadSales } = useQuery({
    queryKey: ['finance-sales-report', period.from, period.to],
    queryFn: async () => {
      const first = await api.get('/finance/sales', { params: { from: period.from, to: period.to, limit: 200, page: 1 } }).then((r) => r.data as { data: any[]; meta: { totalPages: number } });
      const all = [...first.data];
      if (first.meta.totalPages > 1) {
        const rest = await Promise.all(Array.from({ length: first.meta.totalPages - 1 }, (_, i) =>
          api.get('/finance/sales', { params: { from: period.from, to: period.to, limit: 200, page: i + 2 } }).then((r) => (r.data as any).data)));
        all.push(...rest.flat());
      }
      return all;
    },
  });

  const { data: costsData, isLoading: loadCosts } = useQuery({
    queryKey: ['finance-costs-report', period.from, period.to],
    queryFn: async () => {
      const first = await api.get('/finance/costs', { params: { from: period.from, to: period.to, limit: 200, page: 1 } }).then((r) => r.data as { data: any[]; meta: { totalPages: number } });
      const all = [...first.data];
      if (first.meta.totalPages > 1) {
        const rest = await Promise.all(Array.from({ length: first.meta.totalPages - 1 }, (_, i) =>
          api.get('/finance/costs', { params: { from: period.from, to: period.to, limit: 200, page: i + 2 } }).then((r) => (r.data as any).data)));
        all.push(...rest.flat());
      }
      return all;
    },
  });

  const { data: incomesData, isLoading: loadIncomes } = useQuery({
    queryKey: ['finance-incomes-report', period.from, period.to],
    queryFn: async () => {
      const first = await api.get('/finance/incomes', { params: { from: period.from, to: period.to, limit: 200, page: 1 } }).then((r) => r.data as { data: any[]; meta: { totalPages: number } });
      const all = [...first.data];
      if (first.meta.totalPages > 1) {
        const rest = await Promise.all(Array.from({ length: first.meta.totalPages - 1 }, (_, i) =>
          api.get('/finance/incomes', { params: { from: period.from, to: period.to, limit: 200, page: i + 2 } }).then((r) => (r.data as any).data)));
        all.push(...rest.flat());
      }
      return all;
    },
  });

  const isLoading = loadSum || loadSales || loadCosts || loadIncomes;
  const sales   = salesData   ?? [];
  const costs   = costsData   ?? [];
  const incomes = incomesData ?? [];
  const isProfit = (summary?.netProfit ?? 0) >= 0;

  const generatePdf = async () => {
    if (!summary) return;
    try {
      setGenerating(true);
      const html = buildPdfHtml(summary, sales, costs, incomes, farmName, period.label);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Reporte Financiero — ${period.label}`, UTI: 'com.adobe.pdf' });
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
      <View style={{ backgroundColor: SLATE, paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#ffffff30', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: GOLD + '30', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="cash-outline" size={28} color={GOLD} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#f1f5f9' }}>Reporte Financiero</Text>
            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{farmName} · {fmtDateFull()}</Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff15', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color="#94a3b8" />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>

        {/* Period selector */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Período del reporte</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {PERIODS.map((p, i) => {
              const isActive = i === periodIdx;
              return (
                <Pressable key={p.from} onPress={() => setPeriodIdx(i)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: isActive ? SLATE : Colors.card, borderWidth: 1.5, borderColor: isActive ? SLATE : Colors.border }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#fff' : Colors.textMuted }}>{p.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {isLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <ActivityIndicator size="large" color={SLATE} />
            <Text style={{ color: Colors.textMuted }}>Cargando datos financieros...</Text>
          </View>
        ) : summary ? (
          <>
            {/* Stats */}
            <Animated.View entering={FadeInDown.delay(60).springify()} style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard label="Ingresos" value={fmtCOP(summary.totalIncome)} bg="#d1fae5" color="#065f46" icon="trending-up-outline" />
                <StatCard label="Egresos" value={fmtCOP(summary.totalCosts)} bg="#fee2e2" color="#991b1b" icon="trending-down-outline" />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard
                  label="Utilidad neta"
                  value={fmtCOP(Math.abs(summary.netProfit))}
                  sub={isProfit ? 'ganancia' : 'pérdida'}
                  bg={isProfit ? '#d1fae5' : '#fee2e2'}
                  color={isProfit ? GREEN : RED}
                  icon={isProfit ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                />
                <StatCard label="Margen" value={summary.profitMargin} sub="sobre ingresos" bg={GOLD_L} color={GOLD} icon="pie-chart-outline" />
              </View>
            </Animated.View>

            {/* Cost breakdown */}
            {(summary.costsByCategory ?? []).length > 0 && (
              <Animated.View entering={FadeInDown.delay(100).springify()} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: RED + '15', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                    <Ionicons name="trending-down-outline" size={16} color={RED} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: RED }}>Egresos por categoría</Text>
                  </View>
                  {(summary.costsByCategory as any[]).map((c: any, i: number) => (
                    <View key={c.category} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: i < summary.costsByCategory.length - 1 ? 1 : 0, borderBottomColor: Colors.border, backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <Text style={{ flex: 1, fontSize: 13, color: Colors.text, fontWeight: '600' }}>{COST_CAT[c.category] ?? c.category}</Text>
                      <Text style={{ fontSize: 11, color: Colors.textMuted, marginRight: 10 }}>{c.count} reg.</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: RED }}>{fmtCOP(c.total)}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Summary rows */}
            <Animated.View entering={FadeInDown.delay(130).springify()} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' }}>
                <View style={{ backgroundColor: GOLD_L, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                  <Ionicons name="receipt-outline" size={16} color={GOLD} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: GOLD }}>Resumen del período</Text>
                </View>
                {[
                  { label: 'Ventas de animales', value: fmtCOP(summary.totalSalesRevenue), count: `${summary.salesCount} venta(s)` },
                  { label: 'Otros ingresos', value: fmtCOP(summary.totalOtherIncome), count: '' },
                  { label: 'Total ingresos', value: fmtCOP(summary.totalIncome), count: '', bold: true, color: GREEN },
                  { label: 'Total egresos', value: fmtCOP(summary.totalCosts), count: `${summary.costsCount} reg.`, bold: true, color: RED },
                  { label: 'Utilidad neta', value: (isProfit ? '' : '- ') + fmtCOP(Math.abs(summary.netProfit)), count: summary.profitMargin, bold: true, color: isProfit ? GREEN : RED },
                ].map((row, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor: Colors.border, backgroundColor: row.bold ? SLATE + '06' : 'transparent' }}>
                    <Text style={{ flex: 1, fontSize: 13, color: row.bold ? Colors.text : Colors.textMuted, fontWeight: row.bold ? '800' : '500' }}>{row.label}</Text>
                    {row.count ? <Text style={{ fontSize: 11, color: Colors.textMuted, marginRight: 10 }}>{row.count}</Text> : null}
                    <Text style={{ fontSize: 13, fontWeight: '800', color: row.color ?? Colors.text }}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* Info tip */}
            <Animated.View entering={FadeInDown.delay(160).springify()} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ backgroundColor: GOLD_L, borderRadius: 10, borderWidth: 1, borderColor: GOLD + '40', padding: 12, flexDirection: 'row', gap: 10 }}>
                <Ionicons name="bulb-outline" size={16} color={GOLD} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 11, color: '#92400e', lineHeight: 16 }}>
                  El PDF incluye resumen ejecutivo, desglose de egresos por categoría, tabla de ventas y tabla de costos operacionales del período seleccionado.
                </Text>
              </View>
            </Animated.View>
          </>
        ) : null}
      </ScrollView>

      {/* FAB */}
      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 16, right: 16 }}>
        <Pressable
          onPress={generatePdf}
          disabled={generating || isLoading || !summary}
          style={({ pressed }) => ({
            backgroundColor: isLoading || !summary ? Colors.gray[200] : pressed ? SLATE + 'dd' : SLATE,
            borderRadius: 16, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            shadowColor: SLATE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
            opacity: generating ? 0.8 : 1,
          })}
        >
          {generating ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="document-text" size={22} color={isLoading || !summary ? Colors.textMuted : '#fff'} />}
          <Text style={{ fontSize: 16, fontWeight: '800', color: isLoading || !summary ? Colors.textMuted : '#fff' }}>
            {generating ? 'Generando PDF...' : `Generar PDF — ${period.label}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
