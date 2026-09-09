import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

// RN has no navigator.onLine - this is the standard equivalent
// (@react-native-community/netinfo, Expo-Go-compatible). isConnected can
// be null briefly while the first check is in flight; treated as "assume
// online" so the app doesn't flash an offline banner on every cold start
// before the real state is known.
export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false);
    });
    return unsubscribe;
  }, []);

  return isOnline;
}

export async function isCurrentlyOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected !== false;
  } catch {
    // NetInfo itself failing is not the same as being offline - fail open
    // rather than blocking every write behind a broken connectivity check.
    return true;
  }
}
