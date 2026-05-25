import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function FinanceLayout() {
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
      <Stack.Screen name="sale-new"   options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="cost-new"   options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="income-new"      options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="finance-report"  options={{ headerShown: false, animation: 'slide_from_right' }} />
    </Stack>
  );
}
