/**
 * offline-queue.ts
 * Persistent queue of API mutations that couldn't be sent while offline.
 * Stored in AsyncStorage — survives app restarts.
 * Synced automatically when connectivity is restored.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'bovi_offline_queue_v1';

export interface QueuedOperation {
  id:             string;
  url:            string;
  method:         'POST' | 'PATCH' | 'PUT' | 'DELETE';
  data?:          Record<string, any>;
  label:          string;                 // human-readable, e.g. "Leche 25 may"
  invalidateKeys: string[][];             // RQ keys to invalidate after sync
  createdAt:      number;                 // timestamp ms
}

async function load(): Promise<QueuedOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOperation[]) : [];
  } catch {
    return [];
  }
}

async function save(queue: QueuedOperation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function add(op: Omit<QueuedOperation, 'id' | 'createdAt'>): Promise<QueuedOperation> {
  const queue = await load();
  const entry: QueuedOperation = {
    ...op,
    id:        Math.random().toString(36).slice(2),
    createdAt: Date.now(),
  };
  await save([...queue, entry]);
  return entry;
}

async function remove(id: string): Promise<void> {
  const queue = await load();
  await save(queue.filter((op) => op.id !== id));
}

async function clear(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

async function count(): Promise<number> {
  const queue = await load();
  return queue.length;
}

export const offlineQueue = { load, add, remove, clear, count };
