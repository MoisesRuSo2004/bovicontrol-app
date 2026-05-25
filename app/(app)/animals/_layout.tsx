import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function AnimalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ headerShown: false, presentation: 'modal' }} />
      {/* headerShown: false porque [id] y edit tienen su propio header personalizado */}
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="edit" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="herd-report"  options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="genealogy"   options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="categories"  options={{ headerShown: false, animation: 'slide_from_right' }} />
    </Stack>
  );
}
