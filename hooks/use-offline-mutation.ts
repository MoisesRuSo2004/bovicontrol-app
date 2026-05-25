/**
 * useOfflineMutation
 * Drop-in replacement for useMutation that automatically queues the operation
 * when there's no internet connection.
 *
 * Usage:
 *   const save = useOfflineMutation({
 *     mutationFn: (data) => api.post('/production/milk-sales', data),
 *     offline: {
 *       url: () => '/production/milk-sales',
 *       method: 'POST',
 *       getData: (data) => data,
 *       getLabel: (data) => `Leche ${data.date}`,
 *       invalidateKeys: [['milk-sales']],
 *     },
 *     onSuccess: () => { ... },
 *     onError: (e) => { ... },
 *   });
 */
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { offlineQueue } from '../lib/offline-queue';
import { useNetwork } from './use-network';

export interface OfflineQueueConfig<TVariables> {
  /** Full API path, e.g. '/production/milk-sales' */
  url:            (vars: TVariables) => string;
  method:         'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Data to persist in the queue (what will be sent when synced) */
  getData:        (vars: TVariables) => Record<string, any>;
  /** Human-readable description shown in the sync toast */
  getLabel:       (vars: TVariables) => string;
  /** React Query keys to invalidate after successful sync */
  invalidateKeys?: string[][];
}

type UseOfflineMutationOptions<TData, TError, TVariables, TContext> =
  Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'> & {
    mutationFn: (vars: TVariables) => Promise<TData>;
    offline:    OfflineQueueConfig<TVariables>;
  };

export function useOfflineMutation<
  TData    = unknown,
  TError   = unknown,
  TVariables = void,
  TContext  = unknown,
>({
  mutationFn,
  offline,
  onSuccess,
  onError,
  ...rest
}: UseOfflineMutationOptions<TData, TError, TVariables, TContext>) {
  const { isOnline } = useNetwork();

  return useMutation<TData, TError, TVariables, TContext>({
    ...rest,
    mutationFn: async (vars) => {
      if (!isOnline) {
        // Queue for later sync
        await offlineQueue.add({
          url:            offline.url(vars),
          method:         offline.method,
          data:           offline.getData(vars),
          label:          offline.getLabel(vars),
          invalidateKeys: offline.invalidateKeys ?? [],
        });
        // Return null cast as TData — onSuccess callbacks in our screens
        // don't consume the data argument, so this is safe.
        return null as TData;
      }
      return mutationFn(vars);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (...args: any[]) => {
      if (!isOnline) {
        Toast.show({
          type:  'info',
          text1: 'Guardado sin señal',
          text2: 'Se sincronizará cuando recuperes conexión',
        });
      }
      // Forward all args to the original onSuccess (4-arg signature in this TQ version)
      (onSuccess as any)?.(...args);
    },
    onError,
  });
}
