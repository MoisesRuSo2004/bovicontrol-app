/**
 * useOTAUpdate
 * Checks for OTA updates (EAS Update) silently on app launch.
 * Returns { updateReady, applying, applyUpdate }.
 * Does nothing in development (__DEV__).
 */
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';

export function useOTAUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const [applying, setApplying]       = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (__DEV__ || checked.current) return;
    checked.current = true;
    checkSilently();
  }, []);

  async function checkSilently() {
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return;

      // Download in background without blocking UI
      await Updates.fetchUpdateAsync();
      setUpdateReady(true);
    } catch {
      // Offline or EAS not configured — ignore silently
    }
  }

  async function applyUpdate() {
    setApplying(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setApplying(false);
    }
  }

  return { updateReady, applying, applyUpdate };
}
