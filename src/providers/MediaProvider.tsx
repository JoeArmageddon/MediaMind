'use client';

import { useEffect } from 'react';
import { useMediaStore } from '@/store/mediaStore';

export function MediaProvider({ children }: { children: React.ReactNode }) {
  const { fetchMedia } = useMediaStore();

  useEffect(() => {
    // Load media from IndexedDB on app initialization
    fetchMedia();
  }, [fetchMedia]);

  return <>{children}</>;
}
