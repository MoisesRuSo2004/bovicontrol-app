import { useInfiniteQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/colors';
import { api } from '../../../lib/api';
import { Animal, AnimalSex, AnimalStatus } from '../../../types/animal.types';

// ─── constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AnimalStatus, string> = {
  ACTIVE: 'Activo',
  SOLD: 'Vendido',
  DECEASED: 'Fallecido',
  TRANSFERRED: 'Transferido',
};

const STATUS_COLORS: Record<AnimalStatus, string> = {
  ACTIVE: Colors.primary,
  SOLD: Colors.info,
  DECEASED: Colors.gray[400],
  TRANSFERRED: Colors.warning,
};

type FilterKey = 'ALL' | 'ACTIVE' | 'FEMALE' | 'MALE';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'Todos' },
  { key: 'ACTIVE', label: 'Activos' },
  { key: 'FEMALE', label: 'Hembras' },
  { key: 'MALE', label: 'Machos' },
];

function filterToParams(filter: FilterKey): Record<string, string> {
  if (filter === 'ACTIVE') return { status: 'ACTIVE' };
  if (filter === 'FEMALE') return { sex: 'FEMALE' };
  if (filter === 'MALE') return { sex: 'MALE' };
  return {};
}

// ─── avatar helpers ───────────────────────────────────────────────────────────

function avatarStyle(sex: AnimalSex): { bg: string; iconColor: string } {
  return sex === 'FEMALE'
    ? { bg: '#fce7f3', iconColor: '#be185d' }
    : { bg: '#dbeafe', iconColor: '#1d4ed8' };
}

// ─── AnimalCard ───────────────────────────────────────────────────────────────

function AnimalCard({ animal, index }: { animal: Animal; index: number }) {
  const router = useRouter();
  const av = avatarStyle(animal.sex);

  const meta: string[] = [];
  if (animal.breed?.name) meta.push(animal.breed.name);
  if (animal.currentWeight) meta.push(`${animal.currentWeight} kg`);

  return (
    <Animated.View entering={FadeInRight.delay(index * 60).duration(380)}>
      <Pressable
        onPress={() => router.push(`/(app)/animals/${animal.id}` as any)}
        style={({ pressed }) => ({
          backgroundColor: Colors.card,
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          opacity: pressed ? 0.82 : 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        })}
      >
        {/* Avatar */}
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: av.bg,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
            overflow: 'hidden',
            borderWidth: 1.5,
            borderColor: av.iconColor + '40',
          }}
        >
          {animal.photoUrl ? (
            <Image
              source={{ uri: animal.photoUrl }}
              style={{ width: 50, height: 50 }}
              resizeMode="cover"
            />
          ) : (
            <MaterialCommunityIcons name="cow" size={26} color={av.iconColor} />
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          {/* Name + status chip */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text
              style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}
              numberOfLines={1}
            >
              {animal.name ?? animal.tagNumber}
            </Text>
            <View
              style={{
                backgroundColor: STATUS_COLORS[animal.status] + '22',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: STATUS_COLORS[animal.status],
                }}
              >
                {STATUS_LABELS[animal.status]}
              </Text>
            </View>
          </View>

          {/* Tag */}
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
            Arete: {animal.tagNumber}
          </Text>

          {/* Breed · Weight */}
          {meta.length > 0 && (
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {meta.join(' · ')}
            </Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function AnimalsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['animals', { search, filter: activeFilter }] as const,
    queryFn: ({ pageParam }) =>
      api
        .get('/animals', {
          params: { search, page: pageParam, limit: 20, ...filterToParams(activeFilter) },
        })
        .then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasNextPage ? (lastPage.meta.page ?? 1) + 1 : undefined,
  });

  // Aplanar todas las páginas en un único array (scroll infinito real)
  const animals: Animal[] = data?.pages.flatMap((p) => p.data ?? []) ?? [];
  const totalCount = data?.pages[0]?.meta?.total;

  function handleFilterChange(key: FilterKey) {
    setActiveFilter(key);
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* ── Header verde ── */}
      <View
        style={{
          backgroundColor: Colors.primary,
          paddingTop: insets.top + 14,
          paddingBottom: 50,
          paddingHorizontal: 20,
          overflow: 'hidden',
        }}
      >
        {/* Círculos decorativos */}
        <View
          style={{
            position: 'absolute',
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: '#ffffff12',
            top: -40,
            right: -40,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: '#ffffff10',
            bottom: -20,
            left: 20,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#ffffff0e',
            top: 20,
            right: 100,
          }}
        />

        {/* Título + botones */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>
            Mis animales
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => router.push('/(app)/animals/categories' as any)}
              hitSlop={10}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: pressed ? '#ffffff30' : '#ffffff22',
                paddingHorizontal: 12, paddingVertical: 7,
                borderRadius: 20, borderWidth: 1, borderColor: '#ffffff40',
              })}
            >
              <Ionicons name="grid-outline" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Categorías</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/animals/herd-report' as any)}
              hitSlop={10}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: pressed ? '#ffffff30' : '#ffffff22',
                paddingHorizontal: 12, paddingVertical: 7,
                borderRadius: 20, borderWidth: 1, borderColor: '#ffffff40',
              })}
            >
              <Ionicons name="document-text-outline" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Reporte</Text>
            </Pressable>
          </View>
        </View>

        {/* Chip total */}
        {totalCount !== undefined && (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#ffffff20',
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 20,
              marginTop: 6,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
              {totalCount} en total
            </Text>
          </View>
        )}
      </View>

      {/* ── Sección blanca ── */}
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          marginTop: -24,
          paddingTop: 16,
        }}
      >
        {/* Barra de búsqueda */}
        <Animated.View
          entering={FadeInDown.delay(0).duration(380)}
          style={{ paddingHorizontal: 16, marginBottom: 10 }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: Colors.gray[50],
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
            <TextInput
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 14,
                color: Colors.text,
              }}
              placeholder="Buscar por arete o nombre..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={(t) => {
                setSearch(t);
              }}
            />
            {search.length > 0 && (
              <Pressable onPress={() => { setSearch(''); }}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Chips de filtro */}
        <Animated.View entering={FadeInDown.delay(60).duration(380)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}
          >
            {FILTERS.map((f) => {
              const isActive = f.key === activeFilter;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => handleFilterChange(f.key)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    backgroundColor: isActive ? Colors.primaryLight : Colors.gray[100],
                    borderWidth: 1,
                    borderColor: isActive ? Colors.primary : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: isActive ? Colors.primary : Colors.gray[500],
                    }}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Lista */}
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={animals}
            keyExtractor={(a) => a.id}
            renderItem={({ item, index }) => <AnimalCard animal={item} index={index} />}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Animated.View
                entering={FadeInDown.delay(120).duration(400)}
                style={{ alignItems: 'center', marginTop: 60 }}
              >
                <MaterialCommunityIcons name="cow-off" size={56} color={Colors.gray[300]} />
                <Text
                  style={{
                    color: Colors.textMuted,
                    marginTop: 14,
                    fontSize: 15,
                    fontWeight: '500',
                  }}
                >
                  {search ? 'Sin resultados para esa búsqueda' : 'Aún no hay animales registrados'}
                </Text>
              </Animated.View>
            }
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              isFetchingNextPage
                ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
                : null
            }
          />
        )}
      </View>

      {/* ── FAB ── */}
      <Pressable
        onPress={() => router.push('/(app)/animals/new' as any)}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: 24,
          right: 20,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: Colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          shadowColor: Colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        })}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}
