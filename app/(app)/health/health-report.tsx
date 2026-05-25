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
const BLUE   = '#0369a1';
const BLUE_L = '#e0f2fe';
const BLUE_D = '#0c4a6e';

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

const TREATMENT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:    { label: 'En curso',   color: '#FFFFFF', bg: '#0369a1' },
  COMPLETED: { label: 'Completado', color: '#065f46', bg: '#d1fae5' },
  SUSPENDED: { label: 'Suspendido', color: '#92400e', bg: '#fef3c7' },
};

// ─── PDF Builder ─────────────────────────────────────────────────────────────
function buildPdfHtml(
  vaccinations: any[],
  treatments: any[],
  farmName: string,
  periodLabel: string,
) {
  const today = fmtDateFull();
  const reportId = `BC-SAN-${Date.now().toString(36).toUpperCase()}`;

  const uniqueAnimals = new Set([
    ...vaccinations.map((v) => v.animalId),
    ...treatments.map((t) => t.animalId),
  ]).size;

  const vaccRows = vaccinations.map((v, i) => `
    <tr>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;font-weight:800;color:#1e3a8a;font-size:10.5px">${v.animal?.tagNumber ?? '—'}</td>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;font-size:10.5px">${v.animal?.name ?? '—'}</td>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;font-size:10.5px;font-weight:600">${v.vaccine?.name ?? '—'}</td>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;font-size:10px;color:#6B7280">${fmtDate(v.appliedDate)}</td>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;font-size:10px;color:#6B7280">${fmtDate(v.nextDueDate)}</td>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;font-size:10px;color:#6B7280">${v.doseMl ? v.doseMl + ' ml' : '—'}</td>
    </tr>`).join('');

  const treatRows = treatments.map((t, i) => {
    const st = TREATMENT_STATUS[t.status] ?? { label: t.status, color: '#374151', bg: '#F3F4F6' };
    return `
    <tr>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;font-weight:800;color:#1e3a8a;font-size:10.5px">${t.animal?.tagNumber ?? '—'}</td>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;font-size:10.5px">${t.animal?.name ?? '—'}</td>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;font-size:10.5px;font-weight:600">${t.diagnosis ?? '—'}</td>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;font-size:10px;color:#6B7280">${t.medication?.name ?? '—'}</td>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;font-size:10px;color:#6B7280">${fmtDate(t.startDate)}</td>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;font-size:10px;color:#6B7280">${fmtDate(t.endDate)}</td>
      <td style="background:${i%2===0?'#EFF6FF':'#fff'};padding:8px 10px;border-bottom:1px solid #DBEAFE;text-align:center">
        <span style="display:inline-block;background:${st.bg};color:${st.color};font-size:9px;font-weight:800;padding:3px 8px;border-radius:3px">${st.label}</span>
      </td>
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
  .letterhead { background:${BLUE_D}; padding:26px 32px 22px; }
  .lh-top { display:flex; justify-content:space-between; align-items:flex-start; }
  .lh-title { color:#fff; font-size:22px; font-weight:900; line-height:1.1; }
  .lh-subtitle { color:#7dd3fc; font-size:10px; font-weight:600; margin-top:5px; text-transform:uppercase; letter-spacing:1px; }
  .lh-right { text-align:right; }
  .lh-report-id { color:#7dd3fc; font-size:9px; font-weight:600; letter-spacing:1.2px; text-transform:uppercase; }
  .lh-farm { color:#fff; font-size:15px; font-weight:800; margin-top:4px; }
  .lh-date { color:#7dd3fc; font-size:10px; margin-top:3px; }
  .accent-bar { height:4px; background:linear-gradient(90deg,#0369a1,#0ea5e9,#0369a1); }
  .stats-strip { background:#0c4a6e; padding:14px 32px; display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #0ea5e9; }
  .ss-item { text-align:center; }
  .ss-label { font-size:9px; font-weight:700; color:#7dd3fc; text-transform:uppercase; letter-spacing:.8px; margin-bottom:3px; }
  .ss-value { font-size:24px; font-weight:900; color:#fff; }
  .ss-sub { font-size:9px; color:#7dd3fc; margin-top:1px; }
  .is-divider { width:1px; height:40px; background:#ffffff20; }
  .section-header { display:flex; align-items:center; gap:10px; padding:16px 32px 10px; }
  .sh-line { flex:1; height:1px; background:#DBEAFE; }
  .section-title { font-size:9px; font-weight:800; color:#374151; text-transform:uppercase; letter-spacing:1.2px; white-space:nowrap; }
  .table-wrap { padding:0 32px; }
  table { width:100%; border-collapse:collapse; }
  thead tr { background:${BLUE}; }
  th { color:#fff; font-size:9px; font-weight:700; padding:9px 10px; text-align:left; text-transform:uppercase; letter-spacing:.5px; }
  th.center { text-align:center; }
  td { vertical-align:middle; }
  .totals-row td { background:${BLUE}!important; color:#fff; font-weight:800; font-size:10.5px; padding:9px 10px; }
  .footer-bar { margin:28px 0 0; border-top:3px solid ${BLUE_D}; padding:10px 32px; display:flex; justify-content:space-between; align-items:center; }
  .f-left { font-size:9px; color:#374151; line-height:1.6; }
  .f-center { font-size:9px; color:#4B5563; text-align:center; line-height:1.6; }
  .f-right { font-size:9px; color:${BLUE_D}; font-weight:800; text-align:right; line-height:1.6; }
  .mt16 { margin-top:16px; }
  .no-records { text-align:center; padding:20px; color:#9CA3AF; font-style:italic; font-size:11px; }
</style>
</head>
<body>

<div class="letterhead">
  <div class="lh-top">
    <div>
      <div class="lh-title">Reporte de Sanidad</div>
      <div class="lh-subtitle">Vacunaciones y Tratamientos del Período</div>
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
    <div class="ss-label">Vacunaciones</div>
    <div class="ss-value">${vaccinations.length}</div>
    <div class="ss-sub">aplicadas</div>
  </div>
  <div class="is-divider"></div>
  <div class="ss-item">
    <div class="ss-label">Tratamientos</div>
    <div class="ss-value">${treatments.length}</div>
    <div class="ss-sub">registrados</div>
  </div>
  <div class="is-divider"></div>
  <div class="ss-item">
    <div class="ss-label">Animales atendidos</div>
    <div class="ss-value">${uniqueAnimals}</div>
    <div class="ss-sub">distintos</div>
  </div>
  <div class="is-divider"></div>
  <div class="ss-item">
    <div class="ss-label">En tratamiento activo</div>
    <div class="ss-value">${treatments.filter((t) => t.status === 'ACTIVE').length}</div>
    <div class="ss-sub">animales</div>
  </div>
</div>

<div class="section-header">
  <div class="sh-line"></div>
  <div class="section-title">Vacunaciones aplicadas — ${vaccinations.length} registros</div>
  <div class="sh-line"></div>
</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th style="width:80px">Arete</th>
      <th style="width:80px">Nombre</th>
      <th>Vacuna</th>
      <th style="width:80px">F. Aplicación</th>
      <th style="width:80px">Próx. Dosis</th>
      <th style="width:60px">Dosis</th>
    </tr></thead>
    <tbody>${vaccRows || `<tr><td colspan="6" class="no-records">Sin vacunaciones en el período seleccionado</td></tr>`}</tbody>
    ${vaccinations.length > 0 ? `<tfoot><tr class="totals-row"><td colspan="6">TOTAL: ${vaccinations.length} vacunación(es) aplicada(s) en el período</td></tr></tfoot>` : ''}
  </table>
</div>

<div class="section-header mt16">
  <div class="sh-line"></div>
  <div class="section-title">Tratamientos — ${treatments.length} registros</div>
  <div class="sh-line"></div>
</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th style="width:80px">Arete</th>
      <th style="width:80px">Nombre</th>
      <th>Diagnóstico</th>
      <th style="width:100px">Medicamento</th>
      <th style="width:75px">Inicio</th>
      <th style="width:75px">Fin</th>
      <th class="center" style="width:80px">Estado</th>
    </tr></thead>
    <tbody>${treatRows || `<tr><td colspan="7" class="no-records">Sin tratamientos en el período seleccionado</td></tr>`}</tbody>
    ${treatments.length > 0 ? `<tfoot><tr class="totals-row"><td colspan="7">TOTAL: ${treatments.length} tratamiento(s) | ${treatments.filter((t) => t.status === 'ACTIVE').length} activo(s) | ${treatments.filter((t) => t.status === 'COMPLETED').length} completado(s)</td></tr></tfoot>` : ''}
  </table>
</div>

<div class="footer-bar">
  <div class="f-left"><strong>${farmName}</strong><br>Ref. ${reportId} &bull; ${periodLabel}</div>
  <div class="f-center">Documento de uso interno. Verifique con el médico veterinario antes de presentación oficial.</div>
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
      <Text style={{ fontSize: 20, fontWeight: '900', color, marginTop: 2 }}>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: '700', color, opacity: 0.7, textAlign: 'center' }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 9, color, opacity: 0.5 }}>{sub}</Text> : null}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HealthReportScreen() {
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

  const { data: vaccData, isLoading: loadVacc } = useQuery({
    queryKey: ['health-vacc-report', period.from, period.to],
    queryFn: async () => {
      const first = await api.get('/health/vaccinations', { params: { from: period.from, to: period.to, limit: 200, page: 1 } }).then((r) => r.data as { data: any[]; meta: { totalPages: number } });
      const all = [...first.data];
      if (first.meta.totalPages > 1) {
        const rest = await Promise.all(Array.from({ length: first.meta.totalPages - 1 }, (_, i) =>
          api.get('/health/vaccinations', { params: { from: period.from, to: period.to, limit: 200, page: i + 2 } }).then((r) => (r.data as any).data)));
        all.push(...rest.flat());
      }
      return all;
    },
  });

  const { data: treatData, isLoading: loadTreat } = useQuery({
    queryKey: ['health-treat-report', period.from, period.to],
    queryFn: async () => {
      const first = await api.get('/health/treatments', { params: { from: period.from, to: period.to, limit: 200, page: 1 } }).then((r) => r.data as { data: any[]; meta: { totalPages: number } });
      const all = [...first.data];
      if (first.meta.totalPages > 1) {
        const rest = await Promise.all(Array.from({ length: first.meta.totalPages - 1 }, (_, i) =>
          api.get('/health/treatments', { params: { from: period.from, to: period.to, limit: 200, page: i + 2 } }).then((r) => (r.data as any).data)));
        all.push(...rest.flat());
      }
      return all;
    },
  });

  const isLoading   = loadVacc || loadTreat;
  const vaccinations = vaccData  ?? [];
  const treatments   = treatData ?? [];

  const uniqueAnimals = new Set([
    ...vaccinations.map((v: any) => v.animalId),
    ...treatments.map((t: any) => t.animalId),
  ]).size;

  const activeCount = treatments.filter((t: any) => t.status === 'ACTIVE').length;

  const generatePdf = async () => {
    if (!vaccinations.length && !treatments.length) {
      Toast.show({ type: 'info', text1: 'Sin registros', text2: 'No hay datos de sanidad para el período seleccionado' });
      return;
    }
    try {
      setGenerating(true);
      const html = buildPdfHtml(vaccinations, treatments, farmName, period.label);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Reporte de Sanidad — ${period.label}`, UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('PDF generado', `Guardado en:\n${uri}`);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error al generar el PDF' });
    } finally {
      setGenerating(false);
    }
  };

  const hasData = vaccinations.length > 0 || treatments.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: BLUE_D, paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#ffffff30', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: BLUE + '40', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="medkit-outline" size={28} color="#7dd3fc" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#f0f9ff' }}>Reporte de Sanidad</Text>
            <Text style={{ fontSize: 12, color: '#7dd3fc', marginTop: 2 }}>{farmName} · {fmtDateFull()}</Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff15', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color="#7dd3fc" />
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
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: isActive ? BLUE : Colors.card, borderWidth: 1.5, borderColor: isActive ? BLUE : Colors.border }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#fff' : Colors.textMuted }}>{p.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {isLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <ActivityIndicator size="large" color={BLUE} />
            <Text style={{ color: Colors.textMuted }}>Cargando datos de sanidad...</Text>
          </View>
        ) : (
          <>
            {/* Stats */}
            <Animated.View entering={FadeInDown.delay(60).springify()} style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard label="Vacunaciones" value={vaccinations.length} sub="aplicadas" bg={BLUE_L} color={BLUE} icon="shield-checkmark-outline" />
                <StatCard label="Tratamientos" value={treatments.length} sub="registrados" bg="#ede9fe" color="#7c3aed" icon="medical-outline" />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard label="Animales atendidos" value={uniqueAnimals} sub="distintos" bg="#fef3c7" color="#b45309" icon="paw-outline" />
                <StatCard label="En tratamiento activo" value={activeCount} bg="#fee2e2" color="#dc2626" icon="pulse-outline" />
              </View>
            </Animated.View>

            {/* Vaccinations list */}
            {vaccinations.length > 0 && (
              <Animated.View entering={FadeInDown.delay(100).springify()} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: BLUE_L, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: BLUE + '30' }}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={BLUE} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: BLUE }}>Vacunaciones ({vaccinations.length})</Text>
                  </View>
                  {vaccinations.slice(0, 8).map((v: any, i: number) => (
                    <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: i < Math.min(vaccinations.length, 8) - 1 ? 1 : 0, borderBottomColor: Colors.border, backgroundColor: i % 2 === 0 ? BLUE_L + '50' : '#fff' }}>
                      <Text style={{ width: 72, fontSize: 13, fontWeight: '800', color: BLUE_D }}>{v.animal?.tagNumber ?? '—'}</Text>
                      <Text style={{ flex: 1, fontSize: 12, color: Colors.text }} numberOfLines={1}>{v.vaccine?.name ?? '—'}</Text>
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>{fmtDate(v.appliedDate)}</Text>
                    </View>
                  ))}
                  {vaccinations.length > 8 && (
                    <View style={{ padding: 10, backgroundColor: BLUE_L + '40', borderTopWidth: 1, borderTopColor: BLUE + '20', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: BLUE, fontWeight: '600' }}>+{vaccinations.length - 8} más — ver en el PDF</Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            )}

            {/* Treatments list */}
            {treatments.length > 0 && (
              <Animated.View entering={FadeInDown.delay(130).springify()} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: '#ede9fe', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#7c3aed30' }}>
                    <Ionicons name="medical-outline" size={16} color="#7c3aed" />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#7c3aed' }}>Tratamientos ({treatments.length})</Text>
                  </View>
                  {treatments.slice(0, 8).map((t: any, i: number) => {
                    const st = TREATMENT_STATUS[t.status] ?? { label: t.status, color: '#374151', bg: '#f3f4f6' };
                    return (
                      <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: i < Math.min(treatments.length, 8) - 1 ? 1 : 0, borderBottomColor: Colors.border, backgroundColor: i % 2 === 0 ? '#f5f3ff' : '#fff' }}>
                        <Text style={{ width: 72, fontSize: 13, fontWeight: '800', color: BLUE_D }}>{t.animal?.tagNumber ?? '—'}</Text>
                        <Text style={{ flex: 1, fontSize: 12, color: Colors.text }} numberOfLines={1}>{t.diagnosis ?? t.medication?.name ?? '—'}</Text>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: st.bg + (t.status === 'ACTIVE' ? '' : '40') }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: t.status === 'ACTIVE' ? '#fff' : st.color }}>{st.label}</Text>
                        </View>
                      </View>
                    );
                  })}
                  {treatments.length > 8 && (
                    <View style={{ padding: 10, backgroundColor: '#ede9fe40', borderTopWidth: 1, borderTopColor: '#7c3aed20', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#7c3aed', fontWeight: '600' }}>+{treatments.length - 8} más — ver en el PDF</Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            )}

            {!hasData && (
              <Animated.View entering={FadeInDown.delay(80).springify()} style={{ paddingHorizontal: 16, alignItems: 'center', paddingTop: 40, gap: 12 }}>
                <MaterialCommunityIcons name="needle-off" size={56} color={Colors.gray[300]} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textMuted }}>Sin registros en este período</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted, textAlign: 'center' }}>No se encontraron vacunaciones ni tratamientos para {period.label}</Text>
              </Animated.View>
            )}

            {/* Tip */}
            <Animated.View entering={FadeInDown.delay(160).springify()} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <View style={{ backgroundColor: BLUE_L, borderRadius: 10, borderWidth: 1, borderColor: BLUE + '30', padding: 12, flexDirection: 'row', gap: 10 }}>
                <Ionicons name="information-circle-outline" size={16} color={BLUE} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 11, color: BLUE_D, lineHeight: 16 }}>
                  El PDF incluye tabla completa de vacunaciones (vacuna, fecha, próxima dosis) y tabla de tratamientos (diagnóstico, medicamento, estado) del período seleccionado.
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
            backgroundColor: isLoading ? Colors.gray[200] : pressed ? BLUE_D + 'ee' : BLUE_D,
            borderRadius: 16, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            shadowColor: BLUE_D, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
            opacity: generating ? 0.8 : 1,
          })}
        >
          {generating ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="document-text" size={22} color={isLoading ? Colors.textMuted : '#fff'} />}
          <Text style={{ fontSize: 16, fontWeight: '800', color: isLoading ? Colors.textMuted : '#fff' }}>
            {generating ? 'Generando PDF...' : `Generar PDF — ${period.label}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
