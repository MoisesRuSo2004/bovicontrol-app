import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Modal,
  Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors } from '../../../constants/colors';
import { api, getErrorMessage } from '../../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnimalNode {
  id: string;
  tagNumber: string;
  name: string | null;
  sex: string;
  birthDate?: string | null;
  photoUrl?: string | null;
  breed?: { name: string } | null;
  father?: AnimalNode | null;
  mother?: AnimalNode | null;
}

interface Descendant {
  id: string; tagNumber: string; name: string | null;
  sex: string; photoUrl?: string | null; generation: number; parentRole: string;
}

interface InbreedingResult {
  inbreedingCoefficient: number;
  inbreedingPercentage: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  commonAncestors: number;
  generationsAnalyzed: number;
}

interface AnimalPicker {
  id: string; tagNumber: string; name: string | null; sex: string;
  photoUrl?: string | null;
  breed?: { name: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sexColor(sex: string) {
  return sex === 'MALE' ? '#3b82f6' : sex === 'FEMALE' ? '#ec4899' : '#6b7280';
}
function sexBg(sex: string) {
  return sex === 'MALE' ? '#dbeafe' : sex === 'FEMALE' ? '#fce7f3' : '#f3f4f6';
}
function sexIcon(sex: string) {
  return sex === 'MALE' ? 'male' : sex === 'FEMALE' ? 'female' : 'help-circle-outline';
}
function fmtDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

const RISK_CFG = {
  LOW:    { label: 'Riesgo bajo',   color: '#15803d', bg: '#dcfce7', icon: 'checkmark-circle-outline' },
  MEDIUM: { label: 'Riesgo medio',  color: '#b45309', bg: '#fef3c7', icon: 'warning-outline' },
  HIGH:   { label: 'Riesgo alto',   color: '#b91c1c', bg: '#fee2e2', icon: 'alert-circle-outline' },
};

// ─── Nodo del árbol ───────────────────────────────────────────────────────────

function TreeNode({
  node, onPress, isRoot = false, label,
}: {
  node: AnimalNode | null | undefined;
  onPress?: () => void;
  isRoot?: boolean;
  label?: string;
}) {
  const router = useRouter();

  if (!node) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          width: isRoot ? 160 : 130,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: Colors.border,
          borderStyle: 'dashed',
          padding: 12,
          alignItems: 'center',
          backgroundColor: Colors.gray[50],
          gap: 6,
        }}
      >
        {label && <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>}
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={20} color={Colors.textMuted} />
        </View>
        <Text style={{ fontSize: 11, color: Colors.textMuted, textAlign: 'center' }}>
          {onPress ? 'Asignar' : 'Sin registro'}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => router.push(`/(app)/animals/${node.id}` as any)}
      style={({ pressed }) => ({
        width: isRoot ? 160 : 130,
        borderRadius: 14,
        borderWidth: isRoot ? 2.5 : 1.5,
        borderColor: sexColor(node.sex),
        padding: isRoot ? 14 : 10,
        alignItems: 'center',
        backgroundColor: isRoot ? sexBg(node.sex) : Colors.card,
        gap: 4,
        opacity: pressed ? 0.85 : 1,
        shadowColor: sexColor(node.sex),
        shadowOffset: { width: 0, height: isRoot ? 4 : 2 },
        shadowOpacity: isRoot ? 0.2 : 0.1,
        shadowRadius: isRoot ? 8 : 4,
        elevation: isRoot ? 4 : 2,
      })}
    >
      {label && <Text style={{ fontSize: 9, fontWeight: '700', color: sexColor(node.sex), textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>}
      <View style={{ width: isRoot ? 48 : 38, height: isRoot ? 48 : 38, borderRadius: isRoot ? 24 : 19, backgroundColor: sexBg(node.sex), alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: sexColor(node.sex) + '50' }}>
        {node.photoUrl ? (
          <Image source={{ uri: node.photoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Ionicons name={sexIcon(node.sex) as any} size={isRoot ? 24 : 19} color={sexColor(node.sex)} />
        )}
      </View>
      <Text style={{ fontSize: isRoot ? 14 : 12, fontWeight: '800', color: Colors.text, textAlign: 'center' }} numberOfLines={1}>
        {node.tagNumber}
      </Text>
      {node.name && (
        <Text style={{ fontSize: 10, color: Colors.textMuted, textAlign: 'center' }} numberOfLines={1}>{node.name}</Text>
      )}
      {node.breed && (
        <Text style={{ fontSize: 9, color: sexColor(node.sex), fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>{node.breed.name}</Text>
      )}
    </Pressable>
  );
}

// ─── Conector vertical ────────────────────────────────────────────────────────

function Connector({ width = 2, height = 20, color = Colors.border }: { width?: number; height?: number; color?: string }) {
  return <View style={{ width, height, backgroundColor: color, alignSelf: 'center' }} />;
}

// ─── Modal selector de padre/madre ────────────────────────────────────────────

function ParentPicker({
  visible, onClose, onSelect, title, sexFilter,
}: {
  visible: boolean; onClose: () => void;
  onSelect: (animal: AnimalPicker) => void;
  title: string; sexFilter: 'MALE' | 'FEMALE';
}) {
  const [search, setSearch] = useState('');

  const { data: animals = [], isLoading } = useQuery<AnimalPicker[]>({
    queryKey: ['animals-picker', sexFilter],
    queryFn: () => api.get('/animals', { params: { limit: 100, sex: sexFilter, status: 'ACTIVE' } })
      .then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.data ?? []); }),
    enabled: visible,
  });

  const filtered = animals.filter(a =>
    !search || a.tagNumber.toLowerCase().includes(search.toLowerCase()) ||
    a.name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        {/* Header */}
        <View style={{ backgroundColor: sexFilter === 'MALE' ? '#1e40af' : '#9d174d', padding: 20, paddingTop: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff20', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: '#fff' }}>{title}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ffffff20', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Ionicons name="search-outline" size={18} color="#ffffffaa" />
            <TextInput
              value={search} onChangeText={setSearch}
              placeholder="Buscar por arete o nombre..."
              placeholderTextColor="#ffffff70"
              style={{ flex: 1, fontSize: 14, color: '#fff' }}
              autoCapitalize="none"
            />
          </View>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={a => a.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                <Ionicons name="search-outline" size={40} color={Colors.gray[300]} />
                <Text style={{ color: Colors.textMuted, fontSize: 15 }}>
                  {search ? 'Sin resultados' : `No hay ${sexFilter === 'MALE' ? 'machos' : 'hembras'} activos`}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onSelect(item); onClose(); }}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? Colors.gray[50] : Colors.card,
                  borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
                  padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                })}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: sexBg(item.sex), alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: sexColor(item.sex) + '50' }}>
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Ionicons name={sexIcon(item.sex) as any} size={20} color={sexColor(item.sex)} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.text }}>{item.tagNumber}</Text>
                  {item.name && <Text style={{ fontSize: 12, color: Colors.textMuted }}>{item.name}</Text>}
                  {item.breed && <Text style={{ fontSize: 11, color: sexColor(item.sex), fontWeight: '600' }}>{item.breed.name}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.gray[300]} />
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

export default function GenealogyScreen() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [pickerOpen, setPickerOpen] = useState<'father' | 'mother' | null>(null);
  const [tab, setTab] = useState<'tree' | 'descendants' | 'inbreeding'>('tree');

  // ── Árbol genealógico ──
  const { data: tree, isLoading: treeLoading, refetch: refetchTree } = useQuery<AnimalNode>({
    queryKey: ['genealogy-tree', animalId],
    queryFn: () => api.get(`/genealogy/${animalId}/tree`).then(r => r.data?.data ?? r.data),
    enabled: !!animalId,
  });

  // ── Descendientes ──
  const { data: descendants = [], isLoading: descLoading } = useQuery<Descendant[]>({
    queryKey: ['genealogy-descendants', animalId],
    queryFn: () => api.get(`/genealogy/${animalId}/descendants`).then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d?.data ?? []);
    }),
    enabled: !!animalId && tab === 'descendants',
  });

  // ── Consanguinidad ──
  const { data: inbreeding, isLoading: inbreedingLoading, refetch: refetchInbreeding } = useQuery<InbreedingResult>({
    queryKey: ['genealogy-inbreeding', animalId],
    queryFn: () => api.get(`/genealogy/${animalId}/inbreeding`).then(r => r.data?.data ?? r.data),
    enabled: !!animalId && tab === 'inbreeding',
  });

  // ── Asignar padre/madre ──
  const assignParentMutation = useMutation({
    mutationFn: ({ parentId, role }: { parentId: string; role: 'father' | 'mother' }) =>
      api.patch(`/animals/${animalId}`, { [role === 'father' ? 'fatherId' : 'motherId']: parentId }),
    onSuccess: (_, { role }) => {
      qc.invalidateQueries({ queryKey: ['genealogy-tree', animalId] });
      qc.invalidateQueries({ queryKey: ['animal', animalId] });
      Toast.show({ type: 'success', text1: `${role === 'father' ? 'Padre' : 'Madre'} asignado correctamente` });
      refetchTree();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  // ── Quitar padre/madre ──
  const removeParentMutation = useMutation({
    mutationFn: (role: 'father' | 'mother') =>
      api.patch(`/animals/${animalId}`, { [role === 'father' ? 'fatherId' : 'motherId']: null }),
    onSuccess: (_, role) => {
      qc.invalidateQueries({ queryKey: ['genealogy-tree', animalId] });
      Toast.show({ type: 'success', text1: `${role === 'father' ? 'Padre' : 'Madre'} removido` });
      refetchTree();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Error', text2: getErrorMessage(e) }),
  });

  const animal = tree;

  const confirmRemove = (role: 'father' | 'mother') => {
    Alert.alert(
      `Quitar ${role === 'father' ? 'padre' : 'madre'}`,
      `¿Deseas quitar la vinculación con el ${role === 'father' ? 'padre' : 'la madre'} de este animal?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Quitar', style: 'destructive', onPress: () => removeParentMutation.mutate(role) },
      ],
    );
  };

  const gen1Desc = descendants.filter(d => d.generation === 1);
  const gen2Desc = descendants.filter(d => d.generation === 2);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* ── Header ── */}
      <View style={{ backgroundColor: '#1e293b', paddingTop: insets.top + 12, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff18', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#f1f5f9' }}>
              {animal ? `${animal.tagNumber}${animal.name ? ` · ${animal.name}` : ''}` : 'Genealogía'}
            </Text>
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>Árbol genealógico</Text>
          </View>
          <MaterialCommunityIcons name="family-tree" size={24} color="#94a3b8" />
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 12, padding: 4, gap: 4 }}>
          {([
            { key: 'tree',        label: 'Árbol',         icon: 'git-branch-outline' },
            { key: 'descendants', label: 'Descendientes', icon: 'people-outline'    },
            { key: 'inbreeding',  label: 'Consanguinidad',icon: 'analytics-outline' },
          ] as const).map(t => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                paddingVertical: 8, borderRadius: 9,
                backgroundColor: tab === t.key ? '#1e293b' : 'transparent',
              }}
            >
              <Ionicons name={t.icon as any} size={13} color={tab === t.key ? '#f1f5f9' : '#64748b'} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: tab === t.key ? '#f1f5f9' : '#64748b' }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {treeLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.textMuted }}>Cargando árbol...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >

          {/* ══════════ TAB: ÁRBOL ══════════ */}
          {tab === 'tree' && animal && (
            <Animated.View entering={FadeInDown.duration(300)}>

              {/* ── Generación 2: abuelos ── */}
              {(animal.father?.father || animal.father?.mother || animal.mother?.father || animal.mother?.mother) && (
                <>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                    Abuelos
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                    <View style={{ gap: 8, alignItems: 'center' }}>
                      <TreeNode node={animal.father?.father} label="Abuelo P" />
                      <TreeNode node={animal.father?.mother} label="Abuela P" />
                    </View>
                    <View style={{ gap: 8, alignItems: 'center' }}>
                      <TreeNode node={animal.mother?.father} label="Abuelo M" />
                      <TreeNode node={animal.mother?.mother} label="Abuela M" />
                    </View>
                  </View>

                  {/* Líneas hacia padres */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 6 }}>
                    <Connector height={16} />
                    <Connector height={16} />
                  </View>
                </>
              )}

              {/* ── Generación 1: padres ── */}
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Padres
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' }}>
                {/* Padre */}
                <View style={{ alignItems: 'center', gap: 0 }}>
                  <TreeNode
                    node={animal.father}
                    label="Padre"
                    onPress={!animal.father ? () => setPickerOpen('father') : undefined}
                  />
                  {animal.father && (
                    <Pressable
                      onPress={() => confirmRemove('father')}
                      style={{ marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca' }}
                    >
                      <Text style={{ fontSize: 10, color: '#b91c1c', fontWeight: '700' }}>Quitar</Text>
                    </Pressable>
                  )}
                  {!animal.father && (
                    <Pressable
                      onPress={() => setPickerOpen('father')}
                      style={{ marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#93c5fd' }}
                    >
                      <Text style={{ fontSize: 10, color: '#1d4ed8', fontWeight: '700' }}>+ Asignar</Text>
                    </Pressable>
                  )}
                </View>

                {/* Madre */}
                <View style={{ alignItems: 'center', gap: 0 }}>
                  <TreeNode
                    node={animal.mother}
                    label="Madre"
                    onPress={!animal.mother ? () => setPickerOpen('mother') : undefined}
                  />
                  {animal.mother && (
                    <Pressable
                      onPress={() => confirmRemove('mother')}
                      style={{ marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca' }}
                    >
                      <Text style={{ fontSize: 10, color: '#b91c1c', fontWeight: '700' }}>Quitar</Text>
                    </Pressable>
                  )}
                  {!animal.mother && (
                    <Pressable
                      onPress={() => setPickerOpen('mother')}
                      style={{ marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fce7f3', borderWidth: 1, borderColor: '#f9a8d4' }}
                    >
                      <Text style={{ fontSize: 10, color: '#9d174d', fontWeight: '700' }}>+ Asignar</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Línea hacia el animal */}
              <Connector height={20} color={sexColor(animal.sex)} />

              {/* ── El animal ── */}
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <TreeNode node={animal} isRoot />
              </View>

              {fmtDate(animal.birthDate) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>Nacido: {fmtDate(animal.birthDate)}</Text>
                </View>
              )}

              {/* Info */}
              <View style={{ backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginTop: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Leyenda</Text>
                {[
                  { color: '#3b82f6', bg: '#dbeafe', label: 'Macho' },
                  { color: '#ec4899', bg: '#fce7f3', label: 'Hembra' },
                ].map(item => (
                  <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: item.bg, borderWidth: 1.5, borderColor: item.color }} />
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>{item.label}</Text>
                  </View>
                ))}
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4 }}>
                  Toca cualquier nodo para ver el detalle del animal.
                </Text>
              </View>
            </Animated.View>
          )}

          {/* ══════════ TAB: DESCENDIENTES ══════════ */}
          {tab === 'descendants' && (
            <Animated.View entering={FadeInDown.duration(300)}>
              {descLoading ? (
                <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={{ color: Colors.textMuted }}>Cargando descendientes...</Text>
                </View>
              ) : descendants.length === 0 ? (
                <View style={{ alignItems: 'center', paddingTop: 60, gap: 14 }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="family-tree" size={36} color={Colors.gray[300]} />
                  </View>
                  <Text style={{ color: Colors.textMuted, fontSize: 15, fontWeight: '600' }}>Sin descendientes registrados</Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 }}>
                    Los descendientes aparecen aquí cuando asignas este animal como padre o madre de otros.
                  </Text>
                </View>
              ) : (
                <>
                  {gen1Desc.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 11, fontWeight: '900', color: Colors.primary }}>1</Text>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.text }}>Hijos directos · {gen1Desc.length}</Text>
                      </View>
                      {gen1Desc.map((d, i) => (
                        <Animated.View key={d.id} entering={FadeInRight.delay(i * 50)}>
                          <DescendantCard desc={d} />
                        </Animated.View>
                      ))}
                    </View>
                  )}
                  {gen2Desc.length > 0 && (
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 11, fontWeight: '900', color: '#4f46e5' }}>2</Text>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.text }}>Nietos · {gen2Desc.length}</Text>
                      </View>
                      {gen2Desc.map((d, i) => (
                        <Animated.View key={d.id} entering={FadeInRight.delay(i * 50)}>
                          <DescendantCard desc={d} />
                        </Animated.View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </Animated.View>
          )}

          {/* ══════════ TAB: CONSANGUINIDAD ══════════ */}
          {tab === 'inbreeding' && (
            <Animated.View entering={FadeInDown.duration(300)}>
              {inbreedingLoading ? (
                <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={{ color: Colors.textMuted }}>Calculando coeficiente...</Text>
                </View>
              ) : inbreeding ? (
                <>
                  {/* Resultado principal */}
                  {(() => {
                    const cfg = RISK_CFG[inbreeding.risk];
                    return (
                      <View style={{ backgroundColor: cfg.bg, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1.5, borderColor: cfg.color + '50', marginBottom: 16 }}>
                        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: cfg.color + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                          <Ionicons name={cfg.icon as any} size={32} color={cfg.color} />
                        </View>
                        <Text style={{ fontSize: 36, fontWeight: '900', color: cfg.color, letterSpacing: -1 }}>
                          {inbreeding.inbreedingPercentage}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: cfg.color, marginTop: 4 }}>
                          Coeficiente de consanguinidad
                        </Text>
                        <View style={{ backgroundColor: cfg.color + '20', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 10 }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: cfg.color }}>{cfg.label.toUpperCase()}</Text>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Detalles */}
                  <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 16 }}>
                    {[
                      { label: 'Generaciones analizadas', value: `${inbreeding.generationsAnalyzed}`, icon: 'git-branch-outline' },
                      { label: 'Ancestros comunes', value: `${inbreeding.commonAncestors}`, icon: 'people-outline' },
                      { label: 'Coeficiente (Wright)', value: `${inbreeding.inbreedingCoefficient.toFixed(4)}`, icon: 'calculator-outline' },
                    ].map((row, i) => (
                      <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: Colors.border }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={row.icon as any} size={16} color={Colors.primary} />
                        </View>
                        <Text style={{ flex: 1, fontSize: 13, color: Colors.textMuted }}>{row.label}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.text }}>{row.value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Explicación */}
                  <View style={{ backgroundColor: '#f0fdf4', borderRadius: 14, borderWidth: 1, borderColor: '#bbf7d0', padding: 14, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>Cómo interpretar este resultado</Text>
                    </View>
                    {[
                      { range: '0% – 6.25%', risk: 'Bajo', desc: 'Sin parentesco significativo' },
                      { range: '6.25% – 12.5%', risk: 'Medio', desc: 'Equivale a primos hermanos' },
                      { range: '> 12.5%', risk: 'Alto', desc: 'Hermanos completos o padre/hija' },
                    ].map(item => (
                      <View key={item.range} style={{ flexDirection: 'row', gap: 8 }}>
                        <Text style={{ fontSize: 12, color: Colors.textMuted, width: 90 }}>{item.range}</Text>
                        <Text style={{ fontSize: 12, color: Colors.text, flex: 1 }}>
                          <Text style={{ fontWeight: '700' }}>{item.risk}: </Text>{item.desc}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Recalcular */}
                  <Pressable
                    onPress={() => refetchInbreeding()}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                      backgroundColor: pressed ? Colors.primaryDark : Colors.primary,
                      borderRadius: 14, paddingVertical: 14, marginTop: 16,
                    })}
                  >
                    <Ionicons name="refresh-outline" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Recalcular</Text>
                  </Pressable>
                </>
              ) : null}
            </Animated.View>
          )}
        </ScrollView>
      )}

      {/* ── Modal selector de padre/madre ── */}
      <ParentPicker
        visible={pickerOpen === 'father'}
        onClose={() => setPickerOpen(null)}
        title="Seleccionar padre (macho)"
        sexFilter="MALE"
        onSelect={(a) => assignParentMutation.mutate({ parentId: a.id, role: 'father' })}
      />
      <ParentPicker
        visible={pickerOpen === 'mother'}
        onClose={() => setPickerOpen(null)}
        title="Seleccionar madre (hembra)"
        sexFilter="FEMALE"
        onSelect={(a) => assignParentMutation.mutate({ parentId: a.id, role: 'mother' })}
      />
    </View>
  );
}

// ─── Card de descendiente ─────────────────────────────────────────────────────

function DescendantCard({ desc }: { desc: Descendant }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/(app)/animals/${desc.id}` as any)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? Colors.gray[50] : Colors.card,
        borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
        padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: sexBg(desc.sex), alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: sexColor(desc.sex) + '50' }}>
        {desc.photoUrl ? (
          <Image source={{ uri: desc.photoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Ionicons name={sexIcon(desc.sex) as any} size={20} color={sexColor(desc.sex)} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.text }}>{desc.tagNumber}</Text>
        {desc.name && <Text style={{ fontSize: 12, color: Colors.textMuted }}>{desc.name}</Text>}
      </View>
      <View style={{ backgroundColor: desc.parentRole === 'father' ? '#dbeafe' : '#fce7f3', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: desc.parentRole === 'father' ? '#1d4ed8' : '#9d174d' }}>
          {desc.parentRole === 'father' ? 'Padre' : 'Madre'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.gray[300]} />
    </Pressable>
  );
}
