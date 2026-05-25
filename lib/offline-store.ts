/**
 * offline-store.ts
 * React Query cache persister using AsyncStorage.
 * The entire query cache is serialized and stored locally.
 * On app restart (even without internet) queries return the last cached data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

export const asyncStoragePersister = createAsyncStoragePersister({
  storage:    AsyncStorage,
  key:        'bovi_rq_cache_v1',
  throttleTime: 1000,           // debounce writes — don't hit storage on every keystroke
});
