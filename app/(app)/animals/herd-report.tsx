import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors } from '../../../constants/colors';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { Animal, AnimalSex, AnimalStatus } from '../../../types/animal.types';

// ─── Theme ────────────────────────────────────────────────────────────────────
const G       = Colors.primary;        // #059669
const G_LIGHT = '#d1fae5';
const G_DARK  = '#064e3b';

// ─── Filter types ─────────────────────────────────────────────────────────────
type FilterKey = 'ALL' | 'ACTIVE' | 'FEMALE' | 'MALE';

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'ALL',    label: 'Todos',   icon: 'apps-outline' },
  { key: 'ACTIVE', label: 'Activos', icon: 'pulse-outline' },
  { key: 'FEMALE', label: 'Hembras', icon: 'female-outline' },
  { key: 'MALE',   label: 'Machos',  icon: 'male-outline' },
];

function filterToParams(f: FilterKey): Record<string, string> {
  if (f === 'ACTIVE') return { status: 'ACTIVE' };
  if (f === 'FEMALE') return { sex: 'FEMALE', status: 'ACTIVE' };
  if (f === 'MALE')   return { sex: 'MALE',   status: 'ACTIVE' };
  return {};
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<AnimalStatus, string> = {
  ACTIVE: 'Activo', SOLD: 'Vendido', DECEASED: 'Fallecido', TRANSFERRED: 'Transferido',
};
const STATUS_COLORS: Record<AnimalStatus, string> = {
  ACTIVE: '#059669', SOLD: '#0ea5e9', DECEASED: '#94a3b8', TRANSFERRED: '#f59e0b',
};
const SEX_LABELS: Record<AnimalSex, string> = { FEMALE: 'Hembra', MALE: 'Macho' };

function calcAge(birthDate?: string): string {
  if (!birthDate) return '-';
  const birth = new Date(birthDate);
  const now   = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 1)  return '< 1 m';
  if (months < 24) return `${months} m`;
  return `${Math.floor(months / 12)} a ${months % 12} m`;
}

function fmtDate(iso: string) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('T')[0].split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${+d} ${months[+m - 1]} ${y}`;
}

function fmtDateFull() {
  return new Date().toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtWeight(w?: number | null): string {
  if (!w) return '-';
  return `${w.toLocaleString('es-CO')} kg`;
}

// ─── Stats helper ─────────────────────────────────────────────────────────────
function computeStats(animals: Animal[]) {
  const total    = animals.length;
  const active   = animals.filter((a) => a.status === 'ACTIVE').length;
  const females  = animals.filter((a) => a.sex === 'FEMALE').length;
  const males    = animals.filter((a) => a.sex === 'MALE').length;
  const breedsSet = new Set(animals.map((a) => a.breed?.name).filter(Boolean));
  const breeds   = breedsSet.size;
  const avgWeight = (() => {
    const withWeight = animals.filter((a) => a.currentWeight);
    if (!withWeight.length) return null;
    return Math.round(withWeight.reduce((s, a) => s + (a.currentWeight ?? 0), 0) / withWeight.length);
  })();
  return { total, active, females, males, breeds, avgWeight };
}

// ─── PDF HTML builder ─────────────────────────────────────────────────────────
function buildPdfHtml(animals: Animal[], farmName: string, filter: FilterKey): string {
  const stats = computeStats(animals);
  const today = fmtDateFull();
  const reportId = `BC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(animals.length).padStart(4, '0')}`;

  const filterLabel: Record<FilterKey, string> = {
    ALL: 'Inventario General del Hato',
    ACTIVE: 'Inventario — Animales Activos',
    FEMALE: 'Inventario — Hembras Activas',
    MALE: 'Inventario — Machos Activos',
  };

  // Status labels in uppercase for formal document
  const STATUS_PDF: Record<AnimalStatus, { label: string; color: string; bg: string }> = {
    ACTIVE:      { label: 'ACTIVO',      color: '#FFFFFF', bg: '#2D6A4F' },
    SOLD:        { label: 'VENDIDO',     color: '#1e3a5f', bg: '#DBEAFE' },
    DECEASED:    { label: 'FALLECIDO',   color: '#4B4B4B', bg: '#E5E7EB' },
    TRANSFERRED: { label: 'TRANSFERIDO', color: '#78350F', bg: '#FEF3C7' },
  };

  const rows = animals.map((a, i) => {
    const st = STATUS_PDF[a.status];
    const isEven = i % 2 === 0;
    return `
      <tr>
        <td style="background:${isEven ? '#E8F0EA' : '#FFFFFF'};color:#6B7280;font-size:10px;text-align:center;font-weight:600;border-bottom:1px solid #E5E7EB;padding:9px 6px">${i + 1}</td>
        <td style="background:${isEven ? '#E8F0EA' : '#FFFFFF'};font-weight:800;color:#1B4332;letter-spacing:.5px;border-bottom:1px solid #E5E7EB;padding:9px 8px">${a.tagNumber}</td>
        <td style="background:${isEven ? '#E8F0EA' : '#FFFFFF'};font-weight:600;color:#111827;border-bottom:1px solid #E5E7EB;padding:9px 8px">${a.name ?? '—'}</td>
        <td style="background:${isEven ? '#E8F0EA' : '#FFFFFF'};color:#374151;border-bottom:1px solid #E5E7EB;padding:9px 8px">${SEX_LABELS[a.sex]}</td>
        <td style="background:${isEven ? '#E8F0EA' : '#FFFFFF'};color:#374151;border-bottom:1px solid #E5E7EB;padding:9px 8px">${a.breed?.name ?? '—'}</td>
        <td style="background:${isEven ? '#E8F0EA' : '#FFFFFF'};text-align:right;font-weight:700;color:#1B4332;border-bottom:1px solid #E5E7EB;padding:9px 8px">${a.currentWeight ? a.currentWeight.toLocaleString('es-CO') + ' kg' : '—'}</td>
        <td style="background:${isEven ? '#E8F0EA' : '#FFFFFF'};color:#6B7280;font-size:10.5px;border-bottom:1px solid #E5E7EB;padding:9px 8px">${a.birthDate ? fmtDate(a.birthDate) : '—'}</td>
        <td style="background:${isEven ? '#E8F0EA' : '#FFFFFF'};color:#6B7280;font-size:10.5px;border-bottom:1px solid #E5E7EB;padding:9px 8px">${calcAge(a.birthDate)}</td>
        <td style="background:${isEven ? '#E8F0EA' : '#FFFFFF'};border-bottom:1px solid #E5E7EB;padding:9px 8px;text-align:center">
          <span style="display:inline-block;background:${st.bg};color:${st.color};font-size:9px;font-weight:800;padding:3px 9px;border-radius:3px;letter-spacing:.4px;border:1px solid ${st.color}33">
            ${st.label}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 18mm 16mm 22mm 16mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #1A1A1A;
    background: #FFFFFF;
    font-size: 11.5px;
    line-height: 1.45;
  }

  /* ── LETTERHEAD ─────────────────────────────────────── */
  .letterhead {
    background: #1B4332;
    padding: 26px 32px 22px 32px;
    margin-bottom: 0;
  }
  .lh-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .lh-title {
    color: #FFFFFF;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: -.3px;
    line-height: 1.1;
  }
  .lh-subtitle {
    color: #FFFFFF;
    font-size: 11px;
    font-weight: 600;
    margin-top: 5px;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.85;
  }
  .lh-right {
    text-align: right;
  }
  .lh-report-id {
    color: #FFFFFF;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .lh-farm {
    color: #FFFFFF;
    font-size: 15px;
    font-weight: 800;
    margin-top: 4px;
  }
  .lh-date {
    color: #FFFFFF;
    font-size: 10px;
    margin-top: 3px;
    opacity: 0.8;
  }
  /* Gold accent bar */
  .accent-bar {
    height: 4px;
    background: linear-gradient(90deg, #B8860B 0%, #DAA520 50%, #B8860B 100%);
  }

  /* ── INFO STRIP ─────────────────────────────────────── */
  .info-strip {
    background: #2D6A4F;
    border-bottom: 3px solid #B8860B;
    padding: 14px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .info-strip-item { text-align: center; }
  .info-strip-item .is-label {
    font-size: 9px;
    font-weight: 700;
    color: #FFFFFF;
    text-transform: uppercase;
    letter-spacing: .8px;
    margin-bottom: 3px;
    opacity: 0.75;
  }
  .info-strip-item .is-value {
    font-size: 20px;
    font-weight: 900;
    color: #FFFFFF;
  }
  .info-strip-item .is-sub {
    font-size: 9px;
    color: #FFFFFF;
    margin-top: 1px;
    opacity: 0.7;
  }
  .is-divider {
    width: 1px;
    height: 40px;
    background: #FFFFFF30;
  }

  /* ── SECTION HEADER ─────────────────────────────────── */
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 18px 32px 10px 32px;
  }
  .section-header .sh-line {
    flex: 1;
    height: 1px;
    background: #D1D5DB;
  }
  .section-header .sh-title {
    font-size: 9.5px;
    font-weight: 800;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    white-space: nowrap;
  }

  /* ── TABLE ──────────────────────────────────────────── */
  .table-wrap { padding: 0 32px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr {
    background: #1B4332;
  }
  th {
    color: #FFFFFF;
    font-size: 9.5px;
    font-weight: 700;
    padding: 10px 8px;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: .6px;
  }
  th.center { text-align: center; }
  th.right  { text-align: right; }
  td { vertical-align: middle; }
  .no-records {
    text-align: center;
    padding: 32px;
    color: #9CA3AF;
    font-style: italic;
    font-size: 12px;
  }
  /* Totals row */
  .totals-row td {
    background: #1B4332 !important;
    color: #FFFFFF;
    font-weight: 800;
    font-size: 11px;
    padding: 10px 8px;
    border-bottom: none;
  }

  /* ── SIGNATURES ─────────────────────────────────────── */
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 40px;
    padding: 32px 32px 0 32px;
  }
  .sig-block { }
  .sig-line {
    border-bottom: 1.5px solid #374151;
    height: 40px;
    margin-bottom: 8px;
  }
  .sig-label {
    font-size: 10px;
    color: #374151;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .5px;
  }
  .sig-sub {
    font-size: 9px;
    color: #4B5563;
    margin-top: 2px;
  }

  /* ── FOOTER ─────────────────────────────────────────── */
  .footer-bar {
    margin: 32px 0 0 0;
    border-top: 3px solid #1B4332;
    padding: 12px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-bar .f-left {
    font-size: 9px;
    color: #374151;
    line-height: 1.6;
  }
  .footer-bar .f-center {
    font-size: 9px;
    color: #4B5563;
    text-align: center;
    line-height: 1.6;
  }
  .footer-bar .f-right {
    font-size: 9px;
    color: #1B4332;
    font-weight: 800;
    text-align: right;
    line-height: 1.6;
  }
</style>
</head>
<body>

  <!-- ═══ LETTERHEAD ═══ -->
  <div class="letterhead">
    <div class="lh-top">
      <div>
        <div class="lh-title">Inventario del Hato Ganadero</div>
        <div class="lh-subtitle">${filterLabel[filter]}</div>
      </div>
      <div class="lh-right">
        <div class="lh-report-id">Ref. ${reportId}</div>
        <div class="lh-farm">${farmName}</div>
        <div class="lh-date">Generado el ${today}</div>
      </div>
    </div>
  </div>
  <div class="accent-bar"></div>

  <!-- ═══ INFO STRIP ═══ -->
  <div class="info-strip">
    <div class="info-strip-item">
      <div class="is-label">Total animales</div>
      <div class="is-value">${stats.total}</div>
      <div class="is-sub">en inventario</div>
    </div>
    <div class="is-divider"></div>
    <div class="info-strip-item">
      <div class="is-label">Activos</div>
      <div class="is-value">${stats.active}</div>
      <div class="is-sub">en finca</div>
    </div>
    <div class="is-divider"></div>
    <div class="info-strip-item">
      <div class="is-label">Hembras</div>
      <div class="is-value">${stats.females}</div>
      <div class="is-sub">en inventario</div>
    </div>
    <div class="is-divider"></div>
    <div class="info-strip-item">
      <div class="is-label">Machos</div>
      <div class="is-value">${stats.males}</div>
      <div class="is-sub">en inventario</div>
    </div>
    <div class="is-divider"></div>
    <div class="info-strip-item">
      <div class="is-label">Razas</div>
      <div class="is-value">${stats.breeds}</div>
      <div class="is-sub">registradas</div>
    </div>
    <div class="is-divider"></div>
    <div class="info-strip-item">
      <div class="is-label">Peso promedio</div>
      <div class="is-value" style="font-size:${stats.avgWeight ? '17' : '18'}px;padding-top:2px">${stats.avgWeight ? stats.avgWeight + ' kg' : '—'}</div>
      <div class="is-sub">${stats.avgWeight ? 'del hato' : 'sin datos'}</div>
    </div>
  </div>

  <!-- ═══ TABLE SECTION ═══ -->
  <div class="section-header">
    <div class="sh-line"></div>
    <div class="sh-title">Detalle del inventario &mdash; ${animals.length} ${animals.length === 1 ? 'animal' : 'animales'}</div>
    <div class="sh-line"></div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="center" style="width:32px">#</th>
          <th style="width:80px">No. Arete</th>
          <th>Nombre / Alias</th>
          <th style="width:64px">Sexo</th>
          <th style="width:90px">Raza</th>
          <th class="right" style="width:70px">Peso vivo</th>
          <th style="width:88px">F. Nacimiento</th>
          <th style="width:56px">Edad</th>
          <th class="center" style="width:82px">Estado</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="9" class="no-records">Sin animales registrados para los filtros seleccionados</td></tr>`}
      </tbody>
      ${animals.length > 0 ? `
      <tfoot>
        <tr class="totals-row">
          <td colspan="5" style="text-align:left;padding-left:8px">TOTALES DEL INVENTARIO</td>
          <td style="text-align:right">${stats.avgWeight ? stats.avgWeight + ' kg prom.' : '—'}</td>
          <td colspan="3" style="text-align:right;padding-right:8px">${stats.total} animales &nbsp;|&nbsp; ${stats.females} H &nbsp;/&nbsp; ${stats.males} M</td>
        </tr>
      </tfoot>` : ''}
    </table>
  </div>

  <!-- ═══ SIGNATURES ═══ -->
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Responsable de la finca</div>
      <div class="sig-sub">Nombre y firma</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Médico veterinario</div>
      <div class="sig-sub">Nombre, firma y Tarj. Profesional</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Entidad / Revisor</div>
      <div class="sig-sub">Sello y firma</div>
    </div>
  </div>

  <!-- ═══ FOOTER ═══ -->
  <div class="footer-bar">
    <div class="f-left">
      <strong>${farmName}</strong><br>
      Ref. ${reportId} &nbsp;&bull;&nbsp; ${today}
    </div>
    <div class="f-center">
      Este documento es de uso interno y administrativo.<br>
      Verifique la información antes de su presentación oficial.
    </div>
    <div class="f-right">
      BoviControl<br>
      <span style="font-weight:400;color:#4B5563">Sistema de Gestión Ganadera</span>
    </div>
  </div>

</body>
</html>`;
}

// ─── Animal row preview ───────────────────────────────────────────────────────
function AnimalRow({ animal, index }: { animal: Animal; index: number }) {
  const isF = animal.sex === 'FEMALE';
  return (
    <Animated.View entering={FadeInRight.delay(index * 30).duration(300)}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          backgroundColor: index % 2 === 0 ? '#f0fdf4' : Colors.card,
        }}
      >
        {/* Sex dot */}
        <View
          style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: isF ? '#be185d' : '#1d4ed8',
            marginRight: 10,
          }}
        />

        {/* Arete */}
        <Text style={{ width: 80, fontSize: 13, fontWeight: '800', color: G }}>
          {animal.tagNumber}
        </Text>

        {/* Name */}
        <Text style={{ flex: 1, fontSize: 13, color: Colors.text }} numberOfLines={1}>
          {animal.name ?? '—'}
        </Text>

        {/* Breed */}
        <Text style={{ width: 70, fontSize: 11, color: Colors.textMuted, textAlign: 'center' }} numberOfLines={1}>
          {animal.breed?.name ?? '—'}
        </Text>

        {/* Weight */}
        <Text style={{ width: 64, fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'right' }}>
          {animal.currentWeight ? `${animal.currentWeight} kg` : '—'}
        </Text>

        {/* Status chip */}
        <View
          style={{
            marginLeft: 8,
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 20,
            backgroundColor: STATUS_COLORS[animal.status] + '22',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: STATUS_COLORS[animal.status] }}>
            {STATUS_LABELS[animal.status]}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, bg, color, icon,
}: {
  label: string; value: string | number; sub?: string;
  bg: string; color: string; icon: string;
}) {
  return (
    <View
      style={{
        flex: 1, backgroundColor: bg, borderRadius: 14,
        padding: 12, alignItems: 'center', gap: 2,
        borderWidth: 1, borderColor: color + '30',
      }}
    >
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={{ fontSize: 20, fontWeight: '900', color, marginTop: 2 }}>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: '700', color, opacity: 0.7 }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 10, color, opacity: 0.5 }}>{sub}</Text> : null}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HerdReportScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [generating, setGenerating] = useState(false);

  // Fetch farm name
  const { data: farm } = useQuery({
    queryKey: ['farm', user?.farmId],
    queryFn: () => api.get(`/farms/${user?.farmId}`).then((r) => r.data.data ?? r.data),
    enabled: !!user?.farmId,
  });
  const farmName: string = farm?.name ?? 'Mi Finca';

  // Fetch ALL animals for the report (backend max limit=100, so we page through all)
  const { data, isLoading } = useQuery<Animal[]>({
    queryKey: ['animals-report', filter],
    queryFn: async () => {
      const params = { limit: 100, page: 1, ...filterToParams(filter) };
      const first = await api.get('/animals', { params }).then((r) => r.data as { data: Animal[]; meta: { totalPages: number } });
      const allAnimals: Animal[] = [...first.data];

      if (first.meta.totalPages > 1) {
        const pages = await Promise.all(
          Array.from({ length: first.meta.totalPages - 1 }, (_, i) =>
            api
              .get('/animals', { params: { ...params, page: i + 2 } })
              .then((r) => (r.data as { data: Animal[] }).data),
          ),
        );
        allAnimals.push(...pages.flat());
      }

      return allAnimals;
    },
    staleTime: 1000 * 60 * 2,
  });

  const animals: Animal[] = data ?? [];
  const stats = computeStats(animals);

  // ── Generate PDF ──────────────────────────────────────────────────────────
  const generatePdf = async () => {
    if (!animals.length) {
      Toast.show({ type: 'info', text1: 'Sin animales', text2: 'No hay animales con los filtros actuales' });
      return;
    }
    try {
      setGenerating(true);
      const html = buildPdfHtml(animals, farmName, filter);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Reporte del Hato — ${farmName}`,
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
      {/* ── Header ── */}
      <View
        style={{
          backgroundColor: G_LIGHT,
          borderBottomWidth: 1,
          borderBottomColor: G + '40',
          paddingTop: insets.top + 10,
          paddingBottom: 20,
          paddingHorizontal: 20,
        }}
      >
        {/* Drag handle */}
        <View
          style={{
            alignSelf: 'center', width: 40, height: 4,
            borderRadius: 2, backgroundColor: G + '50', marginBottom: 16,
          }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {/* Icon */}
          <View
            style={{
              width: 52, height: 52, borderRadius: 26,
              backgroundColor: G + '25',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MaterialCommunityIcons name="cow" size={28} color={G} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: G_DARK }}>
              Reporte del Hato
            </Text>
            <Text style={{ fontSize: 12, color: G, fontWeight: '500', marginTop: 2 }}>
              {farmName} · {fmtDateFull()}
            </Text>
          </View>

          {/* Close */}
          <Pressable
            onPress={() => (router.canDismiss() ? router.dismiss() : router.back())}
            hitSlop={12}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: G + '18',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color={G} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* ── Info tip ── */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={{ padding: 16, paddingBottom: 0 }}>
          <View
            style={{
              backgroundColor: G_LIGHT, borderRadius: 12,
              borderWidth: 1, borderColor: G + '30',
              padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start',
            }}
          >
            <Ionicons name="information-circle-outline" size={18} color={G} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12, color: G_DARK, lineHeight: 18 }}>
              Aplica los filtros, previsualiza el inventario y toca{' '}
              <Text style={{ fontWeight: '800' }}>Generar PDF</Text> para exportar y compartir el reporte
              por WhatsApp, email u otras apps.
            </Text>
          </View>
        </Animated.View>

        {/* ── Filter chips ── */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 14 }}
          >
            {FILTERS.map((f) => {
              const isActive = f.key === filter;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: isActive ? G : Colors.card,
                    borderWidth: 1, borderColor: isActive ? G : Colors.border,
                  }}
                >
                  <Ionicons
                    name={f.icon as any}
                    size={14}
                    color={isActive ? '#fff' : Colors.textMuted}
                  />
                  <Text
                    style={{
                      fontSize: 13, fontWeight: '600',
                      color: isActive ? '#fff' : Colors.textMuted,
                    }}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {isLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 40, gap: 12 }}>
            <ActivityIndicator size="large" color={G} />
            <Text style={{ color: Colors.textMuted }}>Cargando animales...</Text>
          </View>
        ) : (
          <>
            {/* ── Stats cards ── */}
            <Animated.View entering={FadeInDown.delay(100).springify()} style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              {/* Row 1 */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <StatCard
                  label="Total"   value={stats.total}
                  bg="#d1fae5"    color="#059669"   icon="list-outline"
                />
                <StatCard
                  label="Activos" value={stats.active}
                  bg="#f0fdf4"    color="#16a34a"   icon="pulse-outline"
                />
                <StatCard
                  label="Razas"   value={stats.breeds}
                  bg="#fef3c7"    color="#d97706"   icon="ribbon-outline"
                />
              </View>
              {/* Row 2 */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard
                  label="Hembras" value={stats.females}
                  bg="#fdf2f8"    color="#be185d"   icon="female-outline"
                />
                <StatCard
                  label="Machos"  value={stats.males}
                  bg="#eff6ff"    color="#1d4ed8"   icon="male-outline"
                />
                <StatCard
                  label="Peso prom."
                  value={stats.avgWeight ? `${stats.avgWeight}` : '—'}
                  sub={stats.avgWeight ? 'kg' : undefined}
                  bg="#fefce8"   color="#d97706"   icon="barbell-outline"
                />
              </View>
            </Animated.View>

            {/* ── Preview table ── */}
            <Animated.View entering={FadeInDown.delay(140).springify()} style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <View
                style={{
                  backgroundColor: Colors.card, borderRadius: 16,
                  borderWidth: 1, borderColor: Colors.border,
                  overflow: 'hidden',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
                }}
              >
                {/* Table header */}
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: G, paddingVertical: 10, paddingHorizontal: 14,
                  }}
                >
                  <View style={{ width: 18 }} />
                  <Text style={{ width: 80,  fontSize: 11, fontWeight: '700', color: '#fff' }}>Arete</Text>
                  <Text style={{ flex: 1,    fontSize: 11, fontWeight: '700', color: '#fff' }}>Nombre</Text>
                  <Text style={{ width: 70,  fontSize: 11, fontWeight: '700', color: '#fff', textAlign: 'center' }}>Raza</Text>
                  <Text style={{ width: 64,  fontSize: 11, fontWeight: '700', color: '#fff', textAlign: 'right' }}>Peso</Text>
                  <Text style={{ width: 60,  fontSize: 11, fontWeight: '700', color: '#fff', textAlign: 'right' }}>Estado</Text>
                </View>

                {/* Animal rows */}
                {animals.length === 0 ? (
                  <View style={{ padding: 32, alignItems: 'center', gap: 10 }}>
                    <MaterialCommunityIcons name="cow-off" size={44} color={Colors.gray[300]} />
                    <Text style={{ color: Colors.textMuted, fontSize: 14 }}>
                      Sin animales con estos filtros
                    </Text>
                  </View>
                ) : (
                  animals.map((a, i) => (
                    <AnimalRow key={a.id} animal={a} index={i} />
                  ))
                )}

                {/* Footer row count */}
                {animals.length > 0 && (
                  <View
                    style={{
                      padding: 12, backgroundColor: G_LIGHT,
                      borderTopWidth: 1, borderTopColor: G + '30',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12, color: G_DARK, fontWeight: '600' }}>
                      {animals.length} {animals.length === 1 ? 'animal' : 'animales'} en el reporte
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* ── Note ── */}
            {animals.length > 0 && (
              <Animated.View entering={FadeInDown.delay(180).springify()} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                <View
                  style={{
                    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
                    backgroundColor: '#fffbeb', borderRadius: 10,
                    borderWidth: 1, borderColor: '#fde68a',
                    padding: 10,
                  }}
                >
                  <Ionicons name="bulb-outline" size={15} color="#d97706" style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 11, color: '#92400e', lineHeight: 16 }}>
                    El PDF incluye: resumen estadístico del hato, tabla completa con arete, nombre,
                    sexo, raza, peso, estado y edad de cada animal.
                  </Text>
                </View>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── FAB — Generar PDF ── */}
      <View
        style={{
          position: 'absolute', bottom: insets.bottom + 16,
          left: 16, right: 16,
        }}
      >
        <Pressable
          onPress={generatePdf}
          disabled={generating || isLoading || animals.length === 0}
          style={({ pressed }) => ({
            backgroundColor:
              animals.length === 0 ? Colors.gray[200]
              : pressed ? G + 'dd' : G,
            borderRadius: 16,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            shadowColor: G,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: animals.length ? 0.4 : 0,
            shadowRadius: 10,
            elevation: animals.length ? 6 : 0,
            opacity: generating ? 0.8 : 1,
          })}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name="document-text"
              size={22}
              color={animals.length === 0 ? Colors.textMuted : '#fff'}
            />
          )}
          <Text
            style={{
              fontSize: 16,
              fontWeight: '800',
              color: animals.length === 0 ? Colors.textMuted : '#fff',
            }}
          >
            {generating
              ? 'Generando PDF...'
              : animals.length === 0
              ? 'Sin animales para exportar'
              : `Generar PDF (${animals.length} animales)`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
