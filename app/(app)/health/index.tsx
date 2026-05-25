import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';
import { HealthAlert, Vaccination } from '../../../types/health.types';

const AMBER = '#d97706';
const AMBER_LIGHT = '#fef3c7';
const AMBER_TEXT = '#fde68a';

const ALERT_TYPE_LABELS: Record<string, string> = {
  VACCINATION: 'Vacunación',
  TREATMENT: 'Tratamiento',
  CHECKUP: 'Revisión',
  OTHER: 'Otro',
};

const ALERT_TYPE_COLORS: Record<string, string> = {
  VACCINATION: Colors.primary,
  TREATMENT: AMBER,
  CHECKUP: Colors.info,
  OTHER: Colors.gray[500],
};

const ALERT_TYPE_ICON_BG: Record<string, string> = {
  VACCINATION: Colors.primaryLight,
  TREATMENT: AMBER_LIGHT,
  CHECKUP: '#dbeafe',
  OTHER: Colors.gray[100],
};

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function AlertCard({ alert, onResolve, index }: { alert: HealthAlert; onResolve: (id: string) => void; index: number }) {
  const days = daysUntil(alert.scheduledDate);
  const isOverdue = days < 0;
  const isToday = days === 0;

  const iconBg = isOverdue ? '#fee2e2' : ALERT_TYPE_ICON_BG[alert.type] ?? Colors.gray[100];
  const iconColor = isOverdue ? Colors.danger : ALERT_TYPE_COLORS[alert.type] ?? Colors.gray[500];
  const typeColor = ALERT_TYPE_COLORS[alert.type] ?? Colors.gray[500];

  const countdownBg = isOverdue ? '#fee2e2' : isToday ? AMBER_LIGHT : Colors.primaryLight;
  const countdownColor = isOverdue ? Colors.danger : isToday ? AMBER : Colors.primary;
  const countdownText = isOverdue
    ? `Vencida hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`
    : isToday
    ? 'Vence hoy'
    : `En ${days} día${days !== 1 ? 's' : ''}`;

  const AlertIcon = () => {
    if (isOverdue) {
      return <Ionicons name="warning-outline" size={20} color={Colors.danger} />;
    }
    if (alert.type === 'VACCINATION') {
      return <Ionicons name="medkit" size={20} color={iconColor} />;
    }
    if (alert.type === 'TREATMENT') {
      return <MaterialCommunityIcons name="needle" size={20} color={iconColor} />;
    }
    if (alert.type === 'CHECKUP') {
      return <MaterialCommunityIcons name="stethoscope" size={20} color={iconColor} />;
    }
    return <Ionicons name="alert-circle-outline" size={20} color={iconColor} />;
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <View
        style={{
          backgroundColor: Colors.card,
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlertIcon />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: typeColor + '20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: typeColor }}>
                {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
              </Text>
            </View>
            {isOverdue && (
              <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.danger }}>VENCIDA</Text>
              </View>
            )}
          </View>

          <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>{alert.title}</Text>

          {alert.animal && (
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>
              {alert.animal.name ?? alert.animal.tagNumber}
            </Text>
          )}

          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: 6,
              backgroundColor: countdownBg,
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: countdownColor }}>{countdownText}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => onResolve(alert.id)}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: Colors.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function VaccinationRow({ item, index }: { item: Vaccination; index: number }) {
  const dateStr = new Date(item.appliedDate).toLocaleDateString('es', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  const nextStr = item.nextDueDate
    ? new Date(item.nextDueDate).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <View
        style={{
          backgroundColor: Colors.card,
          borderRadius: 14,
          padding: 14,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: Colors.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="medkit" size={20} color={Colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>
            {item.vaccine?.name ?? '—'}
          </Text>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>
            {item.animal?.name ?? item.animal?.tagNumber ?? '—'}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>{dateStr}</Text>
          {nextStr && (
            <View
              style={{
                backgroundColor: Colors.primaryLight,
                borderRadius: 8,
                paddingHorizontal: 7,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary }}>
                Prox: {nextStr}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

type Tab = 'alerts' | 'vaccinations';

export default function HealthScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('alerts');
  const [refreshing, setRefreshing] = useState(false);

  const { data: alertsData, isLoading: loadingAlerts, refetch: refetchAlerts } = useQuery({
    queryKey: ['health', 'alerts', 'all'],
    queryFn: () => api.get('/health/alerts?isResolved=false&limit=50').then((r) => r.data.data ?? []),
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['health', 'alerts', 'upcoming'],
    queryFn: () => api.get('/health/alerts/upcoming?daysAhead=7').then((r) => r.data.data ?? []),
  });

  const { data: vaccinationsData, isLoading: loadingVac, refetch: refetchVac } = useQuery({
    queryKey: ['health', 'vaccinations'],
    queryFn: () => api.get('/health/vaccinations?limit=30').then((r) => r.data.data ?? []),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/health/alerts/${id}/resolve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health', 'alerts'] });
      Toast.show({ type: 'success', text1: 'Alerta resuelta' });
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAlerts(), refetchVac()]);
    setRefreshing(false);
  };

  const alerts: HealthAlert[] = alertsData ?? [];
  const vaccinations: Vaccination[] = vaccinationsData ?? [];
  const upcomingCount: number = (upcomingData ?? []).length;
  const pendingAlerts = alerts.length;

  const now = new Date();
  const dateLabel = now.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

  const pills = [
    { label: 'pendientes', value: pendingAlerts, icon: 'notifications-outline' as const },
    { label: 'proximas 7d', value: upcomingCount, icon: 'calendar-outline' as const },
    { label: 'vacunaciones', value: vaccinations.length, icon: 'medkit-outline' as const },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── HEADER AMBER ── */}
        <View
          style={{
            backgroundColor: AMBER,
            paddingTop: insets.top + 14,
            paddingBottom: 52,
            paddingHorizontal: 20,
            overflow: 'hidden',
          }}
        >
          {/* Decorative circles */}
          <View
            style={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: '#ffffff0d',
              top: -60,
              right: -40,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 130,
              height: 130,
              borderRadius: 65,
              backgroundColor: '#ffffff0a',
              bottom: -20,
              left: -30,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#ffffff0d',
              top: 30,
              left: 120,
            }}
          />

          {/* Title row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Ionicons name="medkit-outline" size={28} color="#fff" />
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>Sanidad</Text>
          </View>

          {/* Subtitle */}
          <Text style={{ fontSize: 12, color: AMBER_TEXT, marginBottom: 20, textTransform: 'capitalize' }}>
            {dateLabel}
          </Text>

          {/* Stat pills */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {pills.map((p) => (
              <View
                key={p.label}
                style={{
                  flex: 1,
                  backgroundColor: '#ffffff20',
                  borderRadius: 20,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Ionicons name={p.icon} size={14} color="#fff" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{p.value}</Text>
                <Text style={{ fontSize: 10, color: AMBER_TEXT, textAlign: 'center' }}>{p.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── WHITE SECTION ── */}
        <View
          style={{
            backgroundColor: Colors.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            marginTop: -24,
            paddingTop: 20,
            flexGrow: 1,
          }}
        >
          {/* Report button */}
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <Pressable
              onPress={() => router.push('/(app)/health/health-report' as any)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0c4a6e', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, opacity: pressed ? 0.85 : 1 })}
            >
              <Ionicons name="document-text-outline" size={20} color="#67e8f9" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#f0f9ff', fontSize: 13, fontWeight: '800' }}>Reporte de Sanidad PDF</Text>
                <Text style={{ color: '#7dd3fc', fontSize: 11, marginTop: 1 }}>Vacunaciones y tratamientos del período</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#0369a1" />
            </Pressable>
          </View>

          {/* Quick action buttons */}
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 4 }}>
            <Pressable
              onPress={() => router.push('/(app)/health/vaccination-new' as any)}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: Colors.primary,
                borderRadius: 16,
                padding: 16,
                gap: 8,
                opacity: pressed ? 0.85 : 1,
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 4,
              })}
            >
              <Ionicons name="medkit" size={24} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Nueva vacunacion</Text>
              <Text style={{ color: '#bbf7d0', fontSize: 11 }}>Registrar aplicacion</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(app)/health/treatment-new' as any)}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: AMBER,
                borderRadius: 16,
                padding: 16,
                gap: 8,
                opacity: pressed ? 0.85 : 1,
                shadowColor: AMBER,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 4,
              })}
            >
              <MaterialCommunityIcons name="needle" size={24} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Nuevo tratamiento</Text>
              <Text style={{ color: AMBER_TEXT, fontSize: 11 }}>Registrar diagnostico</Text>
            </Pressable>
          </View>

          {/* Tabs */}
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 20,
              gap: 8,
              marginTop: 20,
              marginBottom: 4,
            }}
          >
            {([
              { key: 'alerts' as Tab, label: 'Alertas', hasBadge: pendingAlerts > 0 },
              { key: 'vaccinations' as Tab, label: 'Vacunaciones', hasBadge: false },
            ] as const).map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                style={{ position: 'relative' }}
              >
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: activeTab === t.key ? Colors.primary : Colors.gray[100],
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: activeTab === t.key ? '#fff' : Colors.gray[500],
                    }}
                  >
                    {t.label}
                  </Text>
                </View>
                {t.hasBadge && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: Colors.danger,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>
                      {pendingAlerts > 9 ? '9+' : pendingAlerts}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {/* Tab content */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: Platform.OS === 'ios' ? 100 : 80,
            }}
          >
            {activeTab === 'alerts' ? (
              loadingAlerts ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
              ) : alerts.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 60, gap: 8 }}>
                  <Ionicons name="shield-checkmark-outline" size={64} color={Colors.gray[300]} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>
                    Sin alertas pendientes
                  </Text>
                  <Text style={{ fontSize: 13, color: Colors.textMuted }}>Todo el hato esta al dia</Text>
                </View>
              ) : (
                alerts.map((a, i) => (
                  <AlertCard
                    key={a.id}
                    alert={a}
                    index={i}
                    onResolve={(id) => resolveMutation.mutate(id)}
                  />
                ))
              )
            ) : loadingVac ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            ) : vaccinations.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 60, gap: 8 }}>
                <Ionicons name="medkit-outline" size={64} color={Colors.gray[300]} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>
                  Sin vacunaciones
                </Text>
                <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                  No hay vacunaciones registradas
                </Text>
              </View>
            ) : (
              vaccinations.map((v, i) => <VaccinationRow key={v.id} item={v} index={i} />)
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
