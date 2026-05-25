import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:   1,
      staleTime: 1000 * 60 * 5,          // revalidate after 5 min when online
      gcTime:    1000 * 60 * 60 * 24 * 7, // keep in cache for 7 days (offline support)
      networkMode: 'offlineFirst',         // return cached data while offline without erroring
    },
    mutations: {
      retry: 0,
      networkMode: 'offlineFirst',
    },
  },
});
