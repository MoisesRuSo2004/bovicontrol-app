import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1e293b' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index"       options={{ headerShown: false }} />
      <Stack.Screen name="farm-detail" options={{ headerShown: false }} />
      <Stack.Screen name="client-new"  options={{ headerShown: false, presentation: 'modal' }} />
    </Stack>
  );
}
