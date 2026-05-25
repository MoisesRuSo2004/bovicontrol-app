/**
 * useNetwork — detects real-time connectivity with NetInfo.
 * Returns { isOnline, isInternetReachable }.
 * Falls back to `true` until the first status is received
 * so the app doesn't incorrectly show offline on mount.
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

interface NetworkState {
  isOnline: boolean;
  isInternetReachable: boolean | null;
}

export function useNetwork(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isOnline: true,
    isInternetReachable: null,
  });

  useEffect(() => {
    // Fetch current state immediately
    NetInfo.fetch().then((s: NetInfoState) => {
      setState({
        isOnline: s.isConnected ?? true,
        isInternetReachable: s.isInternetReachable,
      });
    });

    const unsubscribe = NetInfo.addEventListener((s: NetInfoState) => {
      setState({
        isOnline: s.isConnected ?? true,
        isInternetReachable: s.isInternetReachable,
      });
    });

    return unsubscribe;
  }, []);

  return state;
}
