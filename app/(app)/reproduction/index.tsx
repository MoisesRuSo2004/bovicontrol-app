import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FadeInDown } from 'react-native-reanimated';
import AnimatedRN from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';
import { Pregnancy, PregnancyStatus, ReproductiveEvent, ReproductiveEventType } from '../../../types/reproduction.types';

// ─── Colors ──────────────────────────────────────────────────────────────────
const P = '#8b5cf6';
const P_LIGHT = '#ede9fe';
const P_DARK = '#4c1d95';

// ─── Labels ───────────────────────────────────────────────────────────────────
const EVENT_TYPE_LABELS: Record<ReproductiveEventType, string> = {
  HEAT_DETECTED:           'Celo detectado',
  NATURAL_MATING:          'Monta natural',
  ARTIFICIAL_INSEMINATION: 'Inseminación artificial',
  PREGNANCY_CONFIRMED:     'Preñez confirmada',
  PREGNANCY_LOST:          'Pérdida de preñez',
  CALVING:                 'Parto',
  DRY_OFF:                 'Secado',
};

const EVENT_TYPE_COLORS: Record<ReproductiveEventType, string> = {
  HEAT_DETECTED:           '#f59e0b',
  NATURAL_MATING:          Colors.info,
  ARTIFICIAL_INSEMINATION: P,
  PREGNANCY_CONFIRMED:     Colors.primary,
  PREGNANCY_LOST:          Colors.danger,
  CALVING:                 P,
  DRY_OFF:                 Colors.gray[500],
};

const PREGNANCY_STATUS_LABELS: Record<PregnancyStatus, string> = {
  IN_PROGRESS: 'En curso',
  COMPLETED:   'Completada',
  ABORTED:     'Abortada',
  LOST:        'Perdida',
};

const PREGNANCY_STATUS_COLORS: Record<PregnancyStatus, string> = {
  IN_PROGRESS: Colors.primary,
  COMPLETED:   Colors.info,
  ABORTED:     Colors.danger,
  LOST:        Colors.gray[500],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function gestationProgress(conceptionDate: string, expectedDate: string): number {
  const total = new Date(expectedDate).getTime() - new Date(conceptionDate).getTime();
  const elapsed = Date.now() - new Date(conceptionDate).getTime();
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

function eventIcon(type: ReproductiveEventType) {
  switch (type) {
    case 'HEAT_DETECTED':
      return <Ionicons name="thermometer-outline" size={20} color={EVENT_TYPE_COLORS[type]} />;
    case 'NATURAL_MATING':
      return <MaterialCommunityIcons name="cow" size={20} color={EVENT_TYPE_COLORS[type]} />;
    case 'ARTIFICIAL_INSEMINATION':
      return <MaterialCommunityIcons name="needle" size={20} color={EVENT_TYPE_COLORS[type]} />;
    case 'PREGNANCY_CONFIRMED':
      return <Ionicons name="checkmark-circle-outline" size={20} color={EVENT_TYPE_COLORS[type]} />;
    case 'PREGNANCY_LOST':
      return <Ionicons name="close-circle-outline" size={20} color={EVENT_TYPE_COLORS[type]} />;
    case 'CALVING':
      return <MaterialCommunityIcons name="baby-carriage" size={20} color={EVENT_TYPE_COLORS[type]} />;
    case 'DRY_OFF':
      return <MaterialCommunityIcons name="water-off" size={20} color={EVENT_TYPE_COLORS[type]} />;
  }
}

// ─── PregnancyCard ────────────────────────────────────────────────────────────
function PregnancyCard({ item, index, onPress }: { item: Pregnancy; index: number; onPress: () => void }) {
  const daysLeft = item.status === 'IN_PROGRESS' ? daysUntil(item.expectedBirthDate) : null;
  const progress = item.status === 'IN_PROGRESS'
    ? gestationProgress(item.conceptionDate, item.expectedBirthDate) : null;
  const statusColor = PREGNANCY_STATUS_COLORS[item.status];

  return (
    <AnimatedRN.View
      entering={FadeInDown.delay(index * 60)}
      style={{
        backgroundColor: Colors.card,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
        overflow: 'hidden',
      }}
    >
      <Pressable onPress={onPress} style={({ pressed }) => ({ padding: 16, opacity: pressed ? 0.9 : 1 })}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: statusColor + '15',
            alignItems: 'center', justifyContent: 'center',
            marginRight: 12,
          }}>
            <MaterialCommunityIcons name="baby-carriage" size={24} color={statusColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>
              {item.female?.name ?? item.female?.tagNumber ?? '—'}
            </Text>
            {item.female?.name && (
              <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>
                Arete: {item.female.tagNumber}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: statusColor }}>
                {PREGNANCY_STATUS_LABELS[item.status]}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </View>
        </View>

        {/* Progress bar */}
        {progress !== null && (
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>Progreso gestación</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.info }}>{progress}% completado</Text>
            </View>
            <View style={{ height: 6, backgroundColor: Colors.gray[100], borderRadius: 3 }}>
              <View style={{ height: 6, backgroundColor: Colors.info, borderRadius: 3, width: `${progress}%` }} />
            </View>
          </View>
        )}

        {/* Dates */}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
            <View>
              <Text style={{ fontSize: 10, color: Colors.textMuted }}>Concepción</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.text }}>
                {new Date(item.conceptionDate).toLocaleDateString('es')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
            <View>
              <Text style={{ fontSize: 10, color: Colors.textMuted }}>Parto esperado</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: daysLeft !== null && daysLeft <= 14 ? Colors.danger : Colors.text }}>
                {new Date(item.expectedBirthDate).toLocaleDateString('es')}
              </Text>
            </View>
          </View>
          {daysLeft !== null && (
            <View style={{
              backgroundColor: daysLeft <= 14 ? Colors.danger + '15' : P + '15',
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-end',
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: daysLeft <= 14 ? Colors.danger : P }}>
                {daysLeft <= 0 ? 'Hoy/vencido' : `${daysLeft} días`}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </AnimatedRN.View>
  );
}

// ─── EventRow ─────────────────────────────────────────────────────────────────
function EventRow({ item, index, onPress }: { item: ReproductiveEvent; index: number; onPress: () => void }) {
  const color = EVENT_TYPE_COLORS[item.type] ?? Colors.gray[500];
  return (
    <AnimatedRN.View
      entering={FadeInDown.delay(index * 50)}
      style={{
        backgroundColor: Colors.card,
        borderRadius: 14,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
        overflow: 'hidden',
      }}
    >
      <Pressable onPress={onPress} style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
        opacity: pressed ? 0.85 : 1,
      })}>
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: color + '20',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {eventIcon(item.type)}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>
            {EVENT_TYPE_LABELS[item.type] ?? item.type}
          </Text>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>
            {item.female?.name ?? item.female?.tagNumber ?? '—'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{ backgroundColor: Colors.gray[100], paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textMuted }}>
              {new Date(item.eventDate).toLocaleDateString('es')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </View>
      </Pressable>
    </AnimatedRN.View>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'pregnancies' | 'events';
type PregFilter = 'active' | 'all' | 'history';

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ReproductionScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('pregnancies');
  const [pregFilter, setPregFilter] = useState<PregFilter>('active');
  const [refreshing, setRefreshing] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // FAB animation
  const fabAnim = useRef(new Animated.Value(0)).current;

  const toggleFab = () => {
    const toValue = fabOpen ? 0 : 1;
    Animated.spring(fabAnim, { toValue, useNativeDriver: true, tension: 80, friction: 10 }).start();
    setFabOpen(!fabOpen);
  };

  const closeFab = () => {
    Animated.spring(fabAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    setFabOpen(false);
  };

  const { data: pregnanciesData, isLoading: loadingPreg, refetch: refetchPreg } = useQuery({
    queryKey: ['reproduction', 'pregnancies'],
    queryFn: () => api.get('/reproduction/pregnancies?limit=100').then((r) => r.data.data ?? []),
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['reproduction', 'pregnancies', 'upcoming'],
    queryFn: () => api.get('/reproduction/pregnancies/upcoming-births?daysAhead=30').then((r) => r.data ?? []),
  });

  const { data: eventsData, isLoading: loadingEvents, refetch: refetchEvents } = useQuery({
    queryKey: ['reproduction', 'events'],
    queryFn: () => api.get('/reproduction/events?limit=60').then((r) => r.data.data ?? []),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchPreg(), refetchEvents()]);
    setRefreshing(false);
  };

  const pregnancies: Pregnancy[] = pregnanciesData ?? [];
  const events: ReproductiveEvent[] = eventsData ?? [];
  const upcomingBirths: Pregnancy[] = upcomingData ?? [];

  const activePregnancies = pregnancies.filter((p) => p.status === 'IN_PROGRESS').length;

  const filteredPregnancies = pregnancies.filter((p) => {
    if (pregFilter === 'active') return p.status === 'IN_PROGRESS';
    if (pregFilter === 'history') return ['COMPLETED', 'ABORTED', 'LOST'].includes(p.status);
    return true;
  });

  const todayLabel = new Date().toLocaleDateString('es', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // FAB animations
  const childOpacity   = fabAnim;
  const backdropOpacity = fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] });
  const fabRotate      = fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P} />}
        contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
      >
        {/* HEADER */}
        <View style={{
          backgroundColor: P,
          paddingTop: insets.top + 16,
          paddingBottom: 32,
          paddingHorizontal: 20,
          overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: '#ffffff15', position: 'absolute', top: -30, right: -20 }} />
          <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#ffffff10', position: 'absolute', top: 20, right: 70 }} />

          {/* Title row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <MaterialCommunityIcons name="dna" size={28} color="#fff" />
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>Reproducción</Text>
          </View>
          <Text style={{ fontSize: 12, color: '#ddd6fe', marginBottom: 20, textTransform: 'capitalize' }}>
            {todayLabel}
          </Text>

          {/* Stat pills */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: 'Gestaciones activas', value: activePregnancies },
              { label: 'Partos próx. 30d', value: upcomingBirths.length },
              { label: 'Total eventos', value: events.length },
            ].map((s) => (
              <View key={s.label} style={{ flex: 1, backgroundColor: '#ffffff20', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{s.value}</Text>
                <Text style={{ color: '#ddd6fe', fontSize: 10, marginTop: 3, textAlign: 'center' }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* WHITE CURVED SECTION */}
        <View style={{
          backgroundColor: Colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          marginTop: -24,
          flex: 1,
          paddingTop: 20,
          paddingHorizontal: 16,
        }}>
          {/* Upcoming births banner */}
          {upcomingBirths.length > 0 && (
            <AnimatedRN.View
              entering={FadeInDown.delay(0)}
              style={{ backgroundColor: '#fef3c7', borderRadius: 14, padding: 14, marginBottom: 14 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fbbf2420', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="alert-circle" size={20} color="#d97706" />
                </View>
                <Text style={{ fontWeight: '700', color: '#92400e', fontSize: 14, flex: 1 }}>
                  {upcomingBirths.length} parto{upcomingBirths.length !== 1 ? 's' : ''} esperado{upcomingBirths.length !== 1 ? 's' : ''} este mes
                </Text>
              </View>
              {upcomingBirths.slice(0, 3).map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingLeft: 50 }}>
                  <Text style={{ fontSize: 12, color: '#78350f' }}>{p.female?.name ?? p.female?.tagNumber}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#92400e' }}>
                    {new Date(p.expectedBirthDate).toLocaleDateString('es')}
                  </Text>
                </View>
              ))}
            </AnimatedRN.View>
          )}

          {/* Tab pills */}
          <AnimatedRN.View entering={FadeInDown.delay(60)} style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {([
              { key: 'pregnancies' as Tab, label: 'Gestaciones' },
              { key: 'events' as Tab, label: 'Eventos' },
            ] as const).map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                style={{
                  paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1,
                  backgroundColor: activeTab === t.key ? P : Colors.gray[50],
                  borderColor: activeTab === t.key ? P : Colors.border,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: activeTab === t.key ? '#fff' : Colors.textMuted }}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </AnimatedRN.View>

          {/* Content */}
          {activeTab === 'pregnancies' ? (
            <>
              {/* Filter chips */}
              <AnimatedRN.View entering={FadeInDown.delay(80)} style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {([
                  { key: 'active' as PregFilter, label: 'Activas' },
                  { key: 'all' as PregFilter, label: 'Todas' },
                  { key: 'history' as PregFilter, label: 'Historial' },
                ] as const).map((f) => (
                  <Pressable
                    key={f.key}
                    onPress={() => setPregFilter(f.key)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1,
                      backgroundColor: pregFilter === f.key ? P + '15' : Colors.gray[50],
                      borderColor: pregFilter === f.key ? P : Colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: pregFilter === f.key ? P : Colors.textMuted }}>
                      {f.label}
                    </Text>
                  </Pressable>
                ))}
              </AnimatedRN.View>

              {loadingPreg ? (
                <ActivityIndicator color={P} style={{ marginTop: 40 }} />
              ) : filteredPregnancies.length === 0 ? (
                <AnimatedRN.View entering={FadeInDown.delay(180)} style={{ alignItems: 'center', marginTop: 60 }}>
                  <MaterialCommunityIcons name="baby-carriage" size={56} color={Colors.gray[300]} />
                  <Text style={{ color: Colors.textMuted, marginTop: 12, fontSize: 15 }}>
                    Sin gestaciones {pregFilter === 'active' ? 'activas' : pregFilter === 'history' ? 'en el historial' : 'registradas'}
                  </Text>
                </AnimatedRN.View>
              ) : (
                filteredPregnancies.map((p, i) => (
                  <PregnancyCard
                    key={p.id}
                    item={p}
                    index={i}
                    onPress={() => router.push({ pathname: '/(app)/reproduction/pregnancy-new', params: { pregnancyId: p.id } } as any)}
                  />
                ))
              )}
            </>
          ) : (
            <>
              {loadingEvents ? (
                <ActivityIndicator color={P} style={{ marginTop: 40 }} />
              ) : events.length === 0 ? (
                <AnimatedRN.View entering={FadeInDown.delay(180)} style={{ alignItems: 'center', marginTop: 60 }}>
                  <MaterialCommunityIcons name="repeat" size={56} color={Colors.gray[300]} />
                  <Text style={{ color: Colors.textMuted, marginTop: 12, fontSize: 15 }}>Sin eventos registrados</Text>
                </AnimatedRN.View>
              ) : (
                events.map((e, i) => (
                  <EventRow
                    key={e.id}
                    item={e}
                    index={i}
                    onPress={() => router.push({ pathname: '/(app)/reproduction/event-new', params: { eventId: e.id } } as any)}
                  />
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Backdrop */}
      {fabOpen && (
        <Animated.View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#000', opacity: backdropOpacity,
        }}>
          <Pressable style={{ flex: 1 }} onPress={closeFab} />
        </Animated.View>
      )}

      {/* FAB stack — columna normal, hijos encima del botón principal */}
      <View style={{
        position: 'absolute',
        bottom: insets.bottom + 24,
        right: 20,
        alignItems: 'flex-end',
      }}>
        {/* Child: Gestación */}
        <Animated.View
          pointerEvents={fabOpen ? 'auto' : 'none'}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            marginBottom: 12,
            opacity: childOpacity,
            transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          <View style={{ backgroundColor: Colors.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>Gestación</Text>
          </View>
          <Pressable
            onPress={() => { closeFab(); router.push('/(app)/reproduction/pregnancy-new' as any); }}
            style={({ pressed }) => ({
              width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.primary,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <MaterialCommunityIcons name="baby-carriage" size={22} color="#fff" />
          </Pressable>
        </Animated.View>

        {/* Child: Evento */}
        <Animated.View
          pointerEvents={fabOpen ? 'auto' : 'none'}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            marginBottom: 12,
            opacity: childOpacity,
            transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          <View style={{ backgroundColor: Colors.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>Evento</Text>
          </View>
          <Pressable
            onPress={() => { closeFab(); router.push('/(app)/reproduction/event-new' as any); }}
            style={({ pressed }) => ({
              width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.info,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: Colors.info, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <MaterialCommunityIcons name="repeat" size={22} color="#fff" />
          </Pressable>
        </Animated.View>

        {/* Main FAB */}
        <Pressable
          onPress={toggleFab}
          style={({ pressed }) => ({
            width: 60, height: 60, borderRadius: 30,
            backgroundColor: P,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: P,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.45,
            shadowRadius: 10,
            elevation: 10,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
            <Ionicons name="add" size={30} color="#fff" />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}
