import AsyncStorage from '@react-native-async-storage/async-storage';
import { queueLength } from './offlineQueue';

// Keys holding per-account data - cleared on sign-out so a second account
// signing in on the same physical device doesn't inherit the previous
// account's cached library (or, worse now that Chunk B's sync queue can
// hold real unsynced writes, doesn't have those writes attempt to land
// under the wrong account). Mirrors the intent already stated in the web
// app's plan for its own equivalent Dexie clear-on-sign-out.
//
// Deliberately NOT included: theme mode (mediamind:theme-mode) - that's a
// device preference, not account data, and should survive a sign-out.
const ACCOUNT_DATA_KEYS = ['mediamind:media-cache', 'mediamind:collections-cache', 'mediamind:sync-queue'];

export async function hasUnsyncedChanges(): Promise<boolean> {
  return (await queueLength()) > 0;
}

export async function clearLocalAccountData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(ACCOUNT_DATA_KEYS);
  } catch (e) {
    console.warn('Failed to clear local account data:', e);
  }
}
