import { MaterialCommunityIcons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/auth.store';

export default function BlockedScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { blockReason, setBlockReason, logout } = useAuthStore();

  const isExpired     = blockReason?.includes('suscripción') || blockReason?.includes('venció');
  const isDeactivated = blockReason?.includes('desactivada');

  const handleGoLogin = async () => {
    setBlockReason(null);
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={{
      flex: 1,
      backgroundColor: '#0f172a',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingTop: insets.top,
      paddingBottom: insets.bottom + 24,
    }}>
      {/* Icono */}
      <View style={{
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: isExpired ? '#fef3c722' : '#fee2e222',
        borderWidth: 2,
        borderColor: isExpired ? '#d9770644' : '#dc262644',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 28,
      }}>
        {isExpired
          ? <MaterialCommunityIcons name="calendar-remove-outline" size={52} color="#f59e0b" />
          : <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        }
      </View>

      {/* Título */}
      <Text style={{ fontSize: 22, fontWeight: '900', color: '#f1f5f9', textAlign: 'center', marginBottom: 12 }}>
        {isExpired ? 'Suscripción vencida' : isDeactivated ? 'Finca desactivada' : 'Acceso bloqueado'}
      </Text>

      {/* Mensaje del backend */}
      <Text style={{ fontSize: 15, color: '#94a3b8', textAlign: 'center', lineHeight: 24, marginBottom: 36 }}>
        {blockReason ?? 'Tu acceso ha sido bloqueado. Contacta a BoviControl para más información.'}
      </Text>

      {/* Contacto */}
      <View style={{
        backgroundColor: '#1e293b', borderRadius: 16,
        borderWidth: 1, borderColor: '#334155',
        padding: 16, width: '100%', marginBottom: 28,
        flexDirection: 'row', alignItems: 'center', gap: 14,
      }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#22c55e20', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="headset-outline" size={22} color="#22c55e" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#f1f5f9' }}>Contactar a BoviControl</Text>
          <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Escríbenos para renovar tu suscripción
          </Text>
        </View>
      </View>

      {/* Volver al login */}
      <Pressable
        onPress={handleGoLogin}
        style={({ pressed }) => ({
          width: '100%', paddingVertical: 15, borderRadius: 14,
          backgroundColor: pressed ? '#1e293b' : '#0f172a',
          borderWidth: 1.5, borderColor: '#334155',
          alignItems: 'center',
        })}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#64748b' }}>Volver al inicio de sesión</Text>
      </Pressable>
    </View>
  );
}
