'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { db } from '@/lib/db/dexie';

/**
 * Dexie is a per-device cache of "my own" data (see mediaStore.fetchMedia
 * etc.). If the signed-in Clerk user actually changes - most commonly
 * signing out, but also a different account signing in on the same
 * browser/device - the previous account's cached library must not leak
 * into the new session. Watches useAuth()'s userId rather than hooking
 * Clerk's sign-out button directly, so this also covers session expiry.
 */
export function AuthSync() {
  const { isLoaded, userId } = useAuth();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;

    // Only clear on an actual change after the first load - not on initial
    // mount while already signed in (previousUserId still undefined there).
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      Promise.all([
        db.media.clear(),
        db.history.clear(),
        db.smartCollections.clear(),
        db.syncQueue.clear(),
        db.aiCollectionDrafts.clear(),
      ]).catch((e) => console.warn('Failed to clear local cache on account change:', e));
    }

    previousUserId.current = userId;
  }, [isLoaded, userId]);

  return null;
}
