import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { OfflineBanner } from '../components/ui/offline-banner';
import { UpdateBanner } from '../components/ui/update-banner';
import { toastConfig } from '../components/ui/toast-config';
import { useOfflineSync } from '../hooks/use-offline-sync';
import { asyncStoragePersister } from '../lib/offline-store';
import { queryClient } from '../lib/query-client';
import { useAuthStore } from '../stores/auth.store';

SplashScreen.preventAutoHideAsync();

/** Mounts the offline sync watcher — replays queued ops when back online */
function OfflineSyncGate() {
  useOfflineSync();
  return null;
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    SplashScreen.hideAsync();
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [isAuthenticated, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  const { loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            // Persist all successful queries except auth-sensitive ones
            query.state.status === 'success' &&
            !String(query.queryKey[0]).startsWith('auth'),
        },
      }}
    >
      <View style={{ flex: 1 }}>
        <AuthGate />
        <OfflineSyncGate />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
        <StatusBar style="auto" />
        <Toast config={toastConfig} visibilityTime={3500} topOffset={54} />
        {/* Offline indicator — floats at the top */}
        <OfflineBanner />
        {/* OTA update banner — floats at the bottom */}
        <UpdateBanner />
      </View>
    </PersistQueryClientProvider>
  );
}
