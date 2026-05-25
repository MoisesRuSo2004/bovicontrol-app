import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/colors';
import { api } from '../../../lib/api';

// ─── Category config ──────────────────────────────────────────────────────────
type CategoryKey =
  | 'TERNERO' | 'TERNERA'
  | 'MACHO_LEVANTE' | 'TORO'
  | 'NOVILLA'
  | 'VACA_PRENADA' | 'VACA_PARIDA' | 'VACA_ESCOTERAS';

interface CatConfig {
  label: string;
  labelSing: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
  iconLib: 'ion' | 'mci';
  icon: string;
  sex: 'M' | 'F' | 'any';
}

const CAT: Record<CategoryKey, CatConfig> = {
  TERNERO: {
    label: 'Terneros', labelSing: 'Ternero',
    desc: 'Machos de 0 a 8 meses',
    color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd',
    iconLib: 'mci', icon: 'cow', sex: 'M',
  },
  TERNERA: {
    label: 'Terneras', labelSing: 'Ternera',
    desc: 'Hembras de 0 a 8 meses',
    color: '#be185d', bg: '#fce7f3', border: '#f9a8d4',
    iconLib: 'mci', icon: 'cow', sex: 'F',
  },
  MACHO_LEVANTE: {
    label: 'Machos Levante', labelSing: 'Macho Levante',
    desc: 'Machos de 8 a 24 meses',
    color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc',
    iconLib: 'ion', icon: 'trending-up-outline', sex: 'M',
  },
  TORO: {
    label: 'Toros', labelSing: 'Toro',
    desc: 'Machos mayores de 24 meses',
    color: '#1e3a8a', bg: '#eff6ff', border: '#93c5fd',
    iconLib: 'ion', icon: 'shield-outline', sex: 'M',
  },
  NOVILLA: {
    label: 'Novillas', labelSing: 'Novilla',
    desc: 'Hembras sin partos previos',
    color: '#db2777', bg: '#fdf2f8', border: '#f9a8d4',
    iconLib: 'ion', icon: 'female-outline', sex: 'F',
  },
  VACA_PRENADA: {
    label: 'Preñadas', labelSing: 'Vaca Preñada',
    desc: 'Gestación activa en curso',
    color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd',
    iconLib: 'ion', icon: 'heart-outline', sex: 'F',
  },
  VACA_PARIDA: {
    label: 'Vacas Paridas', labelSing: 'Vaca Parida',
    desc: 'Parto hace ≤ 10 meses',
    color: '#059669', bg: '#d1fae5', border: '#6ee7b7',
    iconLib: 'ion', icon: 'ribbon-outline', sex: 'F',
  },
  VACA_ESCOTERAS: {
    label: 'Escoteras', labelSing: 'Vaca Escoteras',
    desc: 'Con cría previa, actualmente seca',
    color: '#d97706', bg: '#fef3c7', border: '#fcd34d',
    iconLib: 'ion', icon: 'time-outline', sex: 'F',
  },
};

const DISPLAY_ORDER: CategoryKey[] = [
  'VACA_PARIDA', 'VACA_PRENADA', 'VACA_ESCOTERAS',
  'NOVILLA', 'TERNERA', 'TERNERO',
  'MACHO_LEVANTE', 'TORO',
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface CategorizedAnimal {
  id: string;
  tagNumber: string;
  name: string | null;
  sex: 'MALE' | 'FEMALE';
  ageMonths: number | null;
  currentWeight: number | null;
  photoUrl: string | null;
  breedName: string | null;
  category: CategoryKey;
}

interface CategorySummary {
  total: number;
  categories: { key: CategoryKey; count: number }[];
  animals: CategorizedAnimal[];
  counts?: Record<string, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtAge(months: number | null): string {
  if (months === null) return 'Sin fecha';
  if (months < 1) return '< 1 mes';
  if (months < 24) return `${months} m`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y} a ${m} m` : `${y} año${y > 1 ? 's' : ''}`;
}

// ─── Category card ────────────────────────────────────────────────────────────
function CategoryCard({
  catKey, count, isSelected, onPress, delay,
}: {
  catKey: CategoryKey; count: number; isSelected: boolean; onPress: () => void; delay: number;
}) {
  const cfg = CAT[catKey];
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={{ flex: 1, minWidth: '46%' }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: isSelected ? cfg.color : cfg.bg,
          borderRadius: 18,
          borderWidth: 2,
          borderColor: isSelected ? cfg.color : cfg.border,
          padding: 14,
          opacity: pressed ? 0.88 : 1,
          shadowColor: cfg.color,
          shadowOffset: { width: 0, height: isSelected ? 6 : 2 },
          shadowOpacity: isSelected ? 0.35 : 0.12,
          shadowRadius: isSelected ? 12 : 4,
          elevation: isSelected ? 8 : 2,
        })}
      >
        {/* Icon + count row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: isSelected ? '#ffffff30' : cfg.color + '20',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {cfg.iconLib === 'mci'
              ? <MaterialCommunityIcons name={cfg.icon as any} size={22} color={isSelected ? '#fff' : cfg.color} />
              : <Ionicons name={cfg.icon as any} size={22} color={isSelected ? '#fff' : cfg.color} />
            }
          </View>
          <Text style={{
            fontSize: 34, fontWeight: '900', lineHeight: 38,
            color: isSelected ? '#fff' : cfg.color,
          }}>
            {count}
          </Text>
        </View>

        {/* Label */}
        <Text style={{ fontSize: 13, fontWeight: '800', color: isSelected ? '#fff' : cfg.color, marginBottom: 2 }}>
          {cfg.label}
        </Text>
        <Text style={{ fontSize: 10, color: isSelected ? '#ffffffbb' : cfg.color + 'aa', lineHeight: 13 }}>
          {cfg.desc}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Animal row ───────────────────────────────────────────────────────────────
function AnimalRow({ animal, index }: { animal: CategorizedAnimal; index: number }) {
  const router = useRouter();
  const cfg = CAT[animal.category];

  return (
    <Animated.View entering={FadeInRight.delay(index * 40).duration(300)}>
      <Pressable
        onPress={() => router.push(`/(app)/animals/${animal.id}` as any)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: pressed ? Colors.gray[50] : Colors.card,
          paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: 1, borderBottomColor: Colors.border,
        })}
      >
        {/* Category color bar */}
        <View style={{ width: 4, height: 44, borderRadius: 2, backgroundColor: cfg.color, marginRight: 12 }} />

        {/* Avatar */}
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: cfg.bg, borderWidth: 1.5, borderColor: cfg.border,
          alignItems: 'center', justifyContent: 'center', marginRight: 12,
          overflow: 'hidden',
        }}>
          {animal.photoUrl ? (
            <Image source={{ uri: animal.photoUrl }} style={{ width: 40, height: 40 }} resizeMode="cover" />
          ) : cfg.iconLib === 'mci'
            ? <MaterialCommunityIcons name={cfg.icon as any} size={20} color={cfg.color} />
            : <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
          }
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.primary }}>
              {animal.tagNumber}
            </Text>
            {animal.name && (
              <Text style={{ fontSize: 13, color: Colors.text }} numberOfLines={1}>
                · {animal.name}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
            <Text style={{ fontSize: 11, color: Colors.textMuted }}>
              {fmtAge(animal.ageMonths)}
            </Text>
            {animal.breedName && (
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>· {animal.breedName}</Text>
            )}
            {animal.currentWeight && (
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>· {animal.currentWeight} kg</Text>
            )}
          </View>
        </View>

        {/* Category badge */}
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: cfg.bg, borderWidth: 1, borderColor: cfg.border, marginLeft: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: cfg.color }}>
            {cfg.labelSing}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color={Colors.gray[300]} style={{ marginLeft: 6 }} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CategoriesScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [selected, setSelected] = useState<CategoryKey | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery<CategorySummary>({
    queryKey: ['animal-categories'],
    queryFn: () => api.get('/animals/categories').then((r) => r.data.data ?? r.data),
    staleTime: 1000 * 60 * 3,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Build ordered category list (only categories with animals)
  const orderedCategories = useMemo(() => {
    if (!data) return [];
    return DISPLAY_ORDER.filter((k) => (data.counts?.[k] ?? data.categories?.find((c) => c.key === k)?.count ?? 0) > 0)
      .map((k) => ({
        key: k,
        count: data.categories?.find((c) => c.key === k)?.count ?? 0,
      }));
  }, [data]);

  // Filtered animals list
  const filteredAnimals = useMemo(() => {
    if (!data?.animals) return [];
    if (!selected) return data.animals;
    return data.animals.filter((a) => a.category === selected);
  }, [data, selected]);

  // Summary by sex
  const femaleTotal = useMemo(() =>
    (data?.animals ?? []).filter((a) => a.sex === 'FEMALE').length, [data]);
  const maleTotal = useMemo(() =>
    (data?.animals ?? []).filter((a) => a.sex === 'MALE').length, [data]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* ── Header ── */}
      <View style={{
        backgroundColor: Colors.primary,
        paddingTop: insets.top + 8,
        paddingBottom: 20,
        paddingHorizontal: 20,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>Categorías del Hato</Text>
            <Text style={{ fontSize: 12, color: '#bbf7d0', marginTop: 1 }}>
              Clasificación productiva automática
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff' }}>{data?.total ?? '—'}</Text>
            <Text style={{ fontSize: 10, color: '#bbf7d0', fontWeight: '600' }}>activos</Text>
          </View>
        </View>

        {/* Sex summary */}
        {data && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <View style={{ flex: 1, backgroundColor: '#be185d22', borderRadius: 10, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#f9a8d4' }}>
              <Ionicons name="female-outline" size={16} color="#f9a8d4" />
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{femaleTotal}</Text>
              <Text style={{ fontSize: 11, color: '#bbf7d0' }}>Hembras</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#1d4ed822', borderRadius: 10, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#93c5fd' }}>
              <Ionicons name="male-outline" size={16} color="#93c5fd" />
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{maleTotal}</Text>
              <Text style={{ fontSize: 11, color: '#bbf7d0' }}>Machos</Text>
            </View>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.textMuted }}>Calculando categorías...</Text>
        </View>
      ) : !data ? null : (
        <FlatList
          data={filteredAnimals}
          keyExtractor={(a) => a.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={() => (
            <>
              {/* ── Category cards grid ── */}
              <View style={{ padding: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
                  Toca una categoría para filtrar
                </Text>

                {/* Cards in rows of 2 */}
                {Array.from({ length: Math.ceil(orderedCategories.length / 2) }, (_, row) => (
                  <View key={row} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                    {orderedCategories.slice(row * 2, row * 2 + 2).map((c, col) => (
                      <CategoryCard
                        key={c.key}
                        catKey={c.key}
                        count={c.count}
                        isSelected={selected === c.key}
                        onPress={() => setSelected(selected === c.key ? null : c.key)}
                        delay={(row * 2 + col) * 60}
                      />
                    ))}
                    {/* Placeholder if odd number */}
                    {orderedCategories.slice(row * 2, row * 2 + 2).length === 1 && (
                      <View style={{ flex: 1 }} />
                    )}
                  </View>
                ))}
              </View>

              {/* ── Active filter chip + count ── */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {selected ? (
                    <Pressable
                      onPress={() => setSelected(null)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CAT[selected].color, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{CAT[selected].label}</Text>
                      <Ionicons name="close-circle" size={16} color="#fff" />
                    </Pressable>
                  ) : (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted }}>Todos los animales</Text>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                  {filteredAnimals.length} {filteredAnimals.length === 1 ? 'animal' : 'animales'}
                </Text>
              </View>

              {/* Table header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.gray[50], borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border }}>
                <View style={{ width: 4, marginRight: 12 }} />
                <View style={{ width: 40, marginRight: 12 }} />
                <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' }}>Animal</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' }}>Categoría</Text>
                <View style={{ width: 22 }} />
              </View>
            </>
          )}
          renderItem={({ item, index }) => <AnimalRow animal={item} index={index} />}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
              <MaterialCommunityIcons name="cow-off" size={52} color={Colors.gray[300]} />
              <Text style={{ fontSize: 14, color: Colors.textMuted, fontWeight: '700' }}>
                Sin animales en esta categoría
              </Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  );
}
