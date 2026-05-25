import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function ProductionLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.card },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index"       options={{ headerShown: false }} />
      <Stack.Screen name="milk-sale-new" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="milk-config"   options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="milk-history"  options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="milk-new"    options={{ headerShown: false }} />
      <Stack.Screen name="weight-new"   options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="milk-report"   options={{ headerShown: false, animation: 'slide_from_right' }} />
    </Stack>
  );
}
