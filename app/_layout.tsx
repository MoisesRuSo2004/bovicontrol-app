import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  /* 1. Check onboarding flag on mount */
  useEffect(() => {
    AsyncStorage.getItem('onboarding_done').then((val) => {
      setShowOnboarding(!val);
      setOnboardingChecked(true);
    });
  }, []);

  /* 2. Route once both checks are ready */
  useEffect(() => {
    if (isLoading || !onboardingChecked) return;

    SplashScreen.hideAsync();

    const seg0 = segments[0] as string;
    const inOnboarding = seg0 === 'onboarding';
    const inAuthGroup  = seg0 === '(auth)';

    if (showOnboarding && !inOnboarding) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace('/onboarding' as any);
      return;
    }

    if (!showOnboarding) {
      if (!isAuthenticated && !inAuthGroup) {
        router.replace('/(auth)/login');
      } else if (isAuthenticated && (inAuthGroup || (seg0 === 'onboarding'))) {
        router.replace('/(app)');
      }
    }
  }, [isAuthenticated, isLoading, segments, onboardingChecked, showOnboarding]);

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
            query.state.status === 'success' &&
            !String(query.queryKey[0]).startsWith('auth'),
        },
      }}
    >
      <View style={{ flex: 1 }}>
        <AuthGate />
        <OfflineSyncGate />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
        <StatusBar style="light" />
        <Toast config={toastConfig} visibilityTime={3500} topOffset={54} />
        <OfflineBanner />
        <UpdateBanner />
      </View>
    </PersistQueryClientProvider>
  );
}
