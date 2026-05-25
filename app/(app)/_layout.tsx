import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/auth.store';

export default function AppLayout() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray[400],
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 26 : 10,
          paddingTop: 6,
          elevation: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="animals"
        options={{
          title: 'Animales',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="cow" size={23} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="health"
        options={{
          title: 'Sanidad',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'medkit' : 'medkit-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="reproduction"
        options={{
          title: 'Reproducción',
          tabBarActiveTintColor: '#8b5cf6',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="dna" size={23} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="production"
        options={{
          title: 'Leche',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="water" size={23} color={color} />
          ),
        }}
      />

      {/* Admin — solo visible para SUPER_ADMIN */}
      <Tabs.Screen
        name="admin"
        options={isSuperAdmin ? {
          title: 'Admin',
          tabBarActiveTintColor: '#1e293b',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} size={22} color={color} />
          ),
        } : {
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none', width: 0, overflow: 'hidden' },
        }}
      />

      {/* Perfil — siempre al final */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'person-circle' : 'person-circle-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* Ocultos del tab bar */}
      <Tabs.Screen
        name="finance"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none', width: 0, overflow: 'hidden' },
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none', width: 0, overflow: 'hidden' },
        }}
      />
    </Tabs>
  );
}
