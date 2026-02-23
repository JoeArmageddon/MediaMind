'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { useMediaStore } from '@/store/mediaStore';
import { useSyncStore } from '@/store/syncStore';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { fetchMedia } = useMediaStore();
  const { updateSyncStatus } = useSyncStore();

  useEffect(() => {
    fetchMedia();
    updateSyncStatus();

    const interval = setInterval(updateSyncStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchMedia, updateSyncStatus]);

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Noise texture overlay */}
      <div className="fixed inset-0 noise pointer-events-none z-0" />
      
      <Sidebar />
      
      <main className="lg:pl-20 pt-14 lg:pt-0 pb-20 lg:pb-0">
        <div className="p-4 lg:p-8 max-w-5xl mx-auto relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
