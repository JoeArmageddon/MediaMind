'use client';

import { useEffect } from 'react';
import { useMediaStore } from '@/store/mediaStore';
// Imported for its module-level side effect: registers the online/offline
// listeners and the periodic sync-queue drain (see src/store/syncStore.ts).
// Importing it here, at the app root, guarantees it's set up exactly once
// regardless of which page/component happens to render first.
import '@/store/syncStore';

export function MediaProvider({ children }: { children: React.ReactNode }) {
  const { fetchMedia } = useMediaStore();

  useEffect(() => {
    // Load media from IndexedDB on app initialization
    fetchMedia();
  }, [fetchMedia]);

  return <>{children}</>;
}
