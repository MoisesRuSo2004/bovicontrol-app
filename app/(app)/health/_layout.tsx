import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function HealthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.card },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="vaccination-new" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="treatment-new" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="health-report"  options={{ headerShown: false, animation: 'slide_from_right' }} />
    </Stack>
  );
}
