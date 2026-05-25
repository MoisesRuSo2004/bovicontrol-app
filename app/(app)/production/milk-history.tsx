import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable,
  ScrollView, Text, View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors } from '../../../constants/colors';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';

// ─── Theme ────────────────────────────────────────────────────────────────────
const C       = '#0ea5e9';
const C_LIGHT = '#e0f2fe';
const C_DARK  = '#0c4a6e';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SaleDetail {
  saleDate: string; liters: number; earnings: number; notes: string | null;
}
interface Period {
  from: string; to: string;
  liters: number; earnings: number; recordCount: number; pricePerLiter: number;
  sales: SaleDetail[];
}
interface HistoryData {
  config: { buyerName?: string | null; pricePerLiter: number; paymentFrequency: string };
  periods: Period[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${+d} ${months[+m - 1]} ${y}`;
}
function fmtDateShort(iso: string) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${+d} ${months[+m - 1]}`;
}
function fmtCOP(n: number) {
  return n.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}
function periodLabel(from: string, to: string) {
  return `${fmtDate(from)} — ${fmtDate(to)}`;
}

// ─── PDF HTML ─────────────────────────────────────────────────────────────────
function buildPdfHtml(period: Period, farmName: string, buyerName?: string | null): string {
  const rows = period.sales.map((s, i) => `
    <tr style="background:${i % 2 === 0 ? '#f0f9ff' : '#ffffff'}">
      <td>${fmtDateShort(s.saleDate)}</td>
      <td style="text-align:center">${s.liters.toFixed(1)}</td>
      <td style="text-align:right">$${fmtCOP(s.liters * period.pricePerLiter)}</td>
      <td style="color:#64748b;font-size:11px">${s.notes ?? ''}</td>
    </tr>
  `).join('');

  const today = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color:#0c4a6e; background:#fff; padding:32px; font-size:13px; }

  /* Header */
  .header { display:flex; align-items:center; gap:16px; border-bottom:3px solid #0ea5e9; padding-bottom:20px; margin-bottom:24px; }
  .logo-circle { width:56px; height:56px; border-radius:50%; background:#e0f2fe; display:flex; align-items:center; justify-content:center; font-size:28px; flex-shrink:0; }
  .header-text h1 { font-size:22px; font-weight:800; color:#0c4a6e; }
  .header-text p  { font-size:12px; color:#0ea5e9; margin-top:2px; }

  /* Info boxes */
  .info-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:24px; }
  .info-box { background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:12px 16px; }
  .info-box .label { font-size:10px; font-weight:700; color:#0ea5e9; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; }
  .info-box .value { font-size:14px; font-weight:700; color:#0c4a6e; }

  /* Table */
  .section-title { font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; margin-bottom:24px; }
  th { background:#0ea5e9; color:#fff; font-size:11px; font-weight:700; padding:8px 12px; text-align:left; }
  td { padding:8px 12px; border-bottom:1px solid #e0f2fe; vertical-align:middle; }
  .no-records { text-align:center; padding:24px; color:#94a3b8; font-style:italic; }

  /* Summary box */
  .summary { background:#0c4a6e; border-radius:14px; padding:20px 24px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; }
  .summary .item { text-align:center; }
  .summary .item .s-label { font-size:10px; color:#7dd3fc; font-weight:600; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; }
  .summary .item .s-value { font-size:22px; font-weight:900; color:#fff; }
  .summary .item .s-sub   { font-size:11px; color:#7dd3fc; margin-top:2px; }
  .divider { width:1px; background:#ffffff20; height:56px; align-self:center; }

  /* Signature */
  .signature { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:32px; padding-top:20px; border-top:1px dashed #bae6fd; }
  .sig-block { text-align:center; }
  .sig-line { border-bottom:1.5px solid #0c4a6e; margin-bottom:6px; height:36px; }
  .sig-label { font-size:11px; color:#64748b; }

  /* Footer */
  .footer { text-align:center; font-size:10px; color:#94a3b8; margin-top:24px; }
</style>
</head>
<body>

  <div class="header">
    <div class="logo-circle">🥛</div>
    <div class="header-text">
      <h1>Liquidación de Leche</h1>
      <p>BoviControl · Generado el ${today}</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="label">Finca</div>
      <div class="value">${farmName}</div>
    </div>
    <div class="info-box">
      <div class="label">Comprador</div>
      <div class="value">${buyerName || 'Sin nombre'}</div>
    </div>
    <div class="info-box">
      <div class="label">Período</div>
      <div class="value" style="font-size:12px">${fmtDate(period.from)} — ${fmtDate(period.to)}</div>
    </div>
  </div>

  <p class="section-title">Detalle diario</p>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th style="text-align:center">Litros</th>
        <th style="text-align:right">Valor</th>
        <th>Notas</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="4" class="no-records">Sin registros en este período</td></tr>`}
    </tbody>
  </table>

  <div class="summary">
    <div class="item">
      <div class="s-label">Total litros</div>
      <div class="s-value">${period.liters.toFixed(1)}<span style="font-size:14px;font-weight:600"> L</span></div>
      <div class="s-sub">${period.recordCount} entregas</div>
    </div>
    <div class="divider"></div>
    <div class="item">
      <div class="s-label">Precio por litro</div>
      <div class="s-value" style="font-size:18px">$${fmtCOP(period.pricePerLiter)}</div>
      <div class="s-sub">precio acordado</div>
    </div>
    <div class="divider"></div>
    <div class="item">
      <div class="s-label">Total a pagar</div>
      <div class="s-value" style="color:#34d399">$${fmtCOP(period.earnings)}</div>
      <div class="s-sub">COP</div>
    </div>
  </div>

  <div class="signature">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Firma Ganadero / Vendedor</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Firma Comprador · ${buyerName || 'Lechera'}</div>
    </div>
  </div>

  <div class="footer">BoviControl · Control de Leche · ${today}</div>
</body>
</html>`;
}

// ─── Period Card ──────────────────────────────────────────────────────────────
function PeriodCard({
  period, index, farmName, buyerName,
}: {
  period: Period; index: number; farmName: string; buyerName?: string | null;
}) {
  const [generating, setGenerating] = useState(false);

  const generatePdf = async () => {
    try {
      setGenerating(true);
      const html  = buildPdfHtml(period, farmName, buyerName);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Liquidación ${fmtDateShort(period.from)} - ${fmtDateShort(period.to)}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF generado', `Guardado en:\n${uri}`);
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error al generar PDF' });
    } finally {
      setGenerating(false);
    }
  };

  const isEmpty = period.recordCount === 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <View style={{
        backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1,
        borderColor: isEmpty ? Colors.border : C + '40',
        overflow: 'hidden', marginBottom: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
      }}>
        {/* Encabezado del período */}
        <View style={{ backgroundColor: isEmpty ? Colors.gray[50] : C_LIGHT, padding: 14, borderBottomWidth: 1, borderBottomColor: isEmpty ? Colors.border : C + '30' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isEmpty ? Colors.gray[100] : C + '20', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="calendar-range" size={16} color={isEmpty ? Colors.textMuted : C} />
              </View>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: isEmpty ? Colors.textMuted : C_DARK }}>
                  {fmtDateShort(period.from)} — {fmtDateShort(period.to)}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 1 }}>
                  {period.recordCount} {period.recordCount === 1 ? 'registro' : 'registros'}
                </Text>
              </View>
            </View>

            {/* Botón PDF */}
            <Pressable
              onPress={generatePdf}
              disabled={generating || isEmpty}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: isEmpty ? Colors.gray[100] : pressed ? C + 'dd' : C,
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                opacity: generating ? 0.7 : 1,
              })}>
              {generating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="document-text-outline" size={15} color={isEmpty ? Colors.textMuted : '#fff'} />
              }
              <Text style={{ fontSize: 12, fontWeight: '700', color: isEmpty ? Colors.textMuted : '#fff' }}>
                {generating ? 'Generando...' : 'PDF'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Stats */}
        {!isEmpty ? (
          <>
            <View style={{ flexDirection: 'row', padding: 14, gap: 0 }}>
              {/* Litros */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: C_DARK }}>
                  {period.liters.toLocaleString('es-CO', { maximumFractionDigits: 1 })}
                  <Text style={{ fontSize: 13, fontWeight: '600' }}> L</Text>
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>Total litros</Text>
              </View>
              {/* Divisor */}
              <View style={{ width: 1, backgroundColor: Colors.border, marginVertical: 4 }} />
              {/* Precio */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text }}>
                  ${fmtCOP(period.pricePerLiter)}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>por litro</Text>
              </View>
              {/* Divisor */}
              <View style={{ width: 1, backgroundColor: Colors.border, marginVertical: 4 }} />
              {/* Ganancias */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary }}>
                  ${fmtCOP(period.earnings)}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>Total</Text>
              </View>
            </View>

            {/* Mini detalle (últimos 3 registros) */}
            {period.sales.slice(-3).reverse().map((s, i, arr) => (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
                paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border,
                backgroundColor: i % 2 === 0 ? Colors.gray[50] + '80' : Colors.card,
              }}>
                <Text style={{ flex: 1, fontSize: 12, color: Colors.textMuted }}>{fmtDateShort(s.saleDate)}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C_DARK }}>
                  {s.liters.toFixed(1)} L
                </Text>
                <Text style={{ width: 80, textAlign: 'right', fontSize: 12, fontWeight: '600', color: Colors.primary }}>
                  ${fmtCOP(s.earnings)}
                </Text>
              </View>
            ))}
            {period.recordCount > 3 && (
              <View style={{ padding: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border }}>
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                  + {period.recordCount - 3} registros más · ver en el PDF
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={{ padding: 20, alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name="water-off" size={28} color={Colors.gray[300]} />
            <Text style={{ fontSize: 13, color: Colors.textMuted, textAlign: 'center' }}>
              Sin registros en este período
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MilkHistoryScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [count, setCount] = useState(6);

  const { data, isLoading } = useQuery<HistoryData>({
    queryKey: ['milk-periods', count],
    queryFn: () => api.get(`/production/milk-sales/periods?count=${count}`).then((r) => r.data.data ?? r.data),
  });

  const { data: farm } = useQuery({
    queryKey: ['farm', user?.farmId],
    queryFn: () => api.get(`/farms/${user?.farmId}`).then((r) => r.data.data),
    enabled: !!user?.farmId,
  });

  const farmName  = farm?.name ?? 'Mi Finca';
  const buyerName = data?.config.buyerName;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{
        backgroundColor: C_LIGHT, borderBottomWidth: 1, borderBottomColor: '#bae6fd',
        paddingTop: insets.top + 10, paddingBottom: 18, paddingHorizontal: 20,
      }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C + '50', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C + '20', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="file-document-multiple-outline" size={26} color={C} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C_DARK }}>Historial de pagos</Text>
            <Text style={{ fontSize: 12, color: C, fontWeight: '500', marginTop: 2 }}>
              {buyerName ? `Lechera: ${buyerName}` : 'Períodos completados'}
            </Text>
          </View>
          <Pressable onPress={() => router.canDismiss() ? router.dismiss() : router.back()} hitSlop={12}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C + '15', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color={C} />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={C} />
          <Text style={{ color: Colors.textMuted }}>Cargando historial...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Info tip */}
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <View style={{ backgroundColor: C_LIGHT, borderRadius: 12, borderWidth: 1, borderColor: C + '30', padding: 12, flexDirection: 'row', gap: 10, marginBottom: 18, alignItems: 'flex-start' }}>
              <Ionicons name="information-circle-outline" size={18} color={C} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12, color: C_DARK, lineHeight: 18 }}>
                Toca <Text style={{ fontWeight: '800' }}>PDF</Text> para generar y compartir la liquidación por WhatsApp, email u otras apps.{'\n'}
                Incluye el detalle diario y líneas de firma.
              </Text>
            </View>
          </Animated.View>

          {/* Lista de períodos */}
          {(data?.periods ?? []).map((period, i) => (
            <PeriodCard
              key={period.from}
              period={period}
              index={i + 1}
              farmName={farmName}
              buyerName={buyerName}
            />
          ))}

          {/* Cargar más */}
          {(data?.periods?.length ?? 0) >= count && (
            <Pressable
              onPress={() => setCount((c) => c + 6)}
              style={({ pressed }) => ({
                alignItems: 'center', padding: 14, borderRadius: 14,
                backgroundColor: pressed ? C_LIGHT : Colors.card,
                borderWidth: 1, borderColor: C + '40',
              })}>
              <Text style={{ color: C, fontWeight: '700', fontSize: 14 }}>Ver más períodos</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}
