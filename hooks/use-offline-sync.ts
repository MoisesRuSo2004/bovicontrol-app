/**
 * useOfflineSync
 * Watches connectivity. When the device goes from offline → online,
 * it replays all queued operations and invalidates the relevant queries.
 *
 * Mount this ONCE at the root layout.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { api } from '../lib/api';
import { offlineQueue } from '../lib/offline-queue';
import { useNetwork } from './use-network';

export function useOfflineSync() {
  const { isOnline }  = useNetwork();
  const qc            = useQueryClient();
  const prevOnline    = useRef<boolean | null>(null);   // null = not yet initialized
  const isSyncing     = useRef(false);

  useEffect(() => {
    // Skip the very first render (just initializing)
    if (prevOnline.current === null) {
      prevOnline.current = isOnline;
      return;
    }

    // Just came back online
    if (isOnline && !prevOnline.current) {
      sync();
    }

    prevOnline.current = isOnline;
  }, [isOnline]);

  async function sync() {
    if (isSyncing.current) return;
    isSyncing.current = true;

    const queue = await offlineQueue.load();
    if (queue.length === 0) {
      isSyncing.current = false;
      return;
    }

    let successCount = 0;
    let failCount    = 0;
    const keysToInvalidate = new Set<string>();

    for (const op of queue) {
      try {
        switch (op.method) {
          case 'POST':   await api.post(op.url, op.data);              break;
          case 'PATCH':  await api.patch(op.url, op.data);             break;
          case 'PUT':    await api.put(op.url, op.data);               break;
          case 'DELETE': await api.delete(op.url);                      break;
        }
        await offlineQueue.remove(op.id);
        successCount++;

        // Collect all query keys to invalidate
        op.invalidateKeys.forEach((k) => keysToInvalidate.add(JSON.stringify(k)));
      } catch {
        // Leave failed ops in the queue — will retry next time
        failCount++;
      }
    }

    // Invalidate all affected queries so UI refreshes
    for (const keyStr of keysToInvalidate) {
      qc.invalidateQueries({ queryKey: JSON.parse(keyStr) });
    }

    if (successCount > 0) {
      Toast.show({
        type:  'success',
        text1: `${successCount} registro${successCount > 1 ? 's' : ''} sincronizado${successCount > 1 ? 's' : ''}`,
        text2: failCount > 0 ? `${failCount} no pudieron sincronizarse` : undefined,
      });
    }

    isSyncing.current = false;
  }
}
