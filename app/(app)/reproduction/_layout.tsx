import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function ReproductionLayout() {
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
      <Stack.Screen name="event-new" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="pregnancy-new" options={{ headerShown: false, presentation: 'modal' }} />
    </Stack>
  );
}
