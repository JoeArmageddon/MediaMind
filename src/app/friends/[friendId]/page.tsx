'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Library, Search, RefreshCw } from 'lucide-react';
import { MediaGrid } from '@/components/media/MediaGrid';
import { Input } from '@/components/ui/input';
import { useFriendStore } from '@/store/friendStore';
import { supabase } from '@/lib/db/supabase';
import { cn } from '@/lib/utils';
import type { Media } from '@/types';

export default function FriendLibraryPage() {
  const router = useRouter();
  const params = useParams<{ friendId: string }>();
  const friendId = params.friendId;

  const { friends, fetchFriends } = useFriendStore();
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const cancelledRef = useRef(false);

  // The friends list is usually already loaded from /friends, but a direct
  // link/refresh lands here with an empty store - load it either way rather
  // than assuming.
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const friendship = useMemo(
    () => friends.find((f) => f.otherUser?.id === friendId),
    [friends, friendId]
  );

  const loadLibrary = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!friendId) return;
      if (opts.silent) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        // RLS handles the actual access control here - "select friends
        // media" only returns rows if an accepted friendship exists between
        // the caller and this user_id. If you're not actually friends (or
        // it's revoked), this just comes back empty rather than erroring.
        const { data, error: fetchError } = await (supabase as any)
          .from('media')
          .select('*')
          .eq('user_id', friendId)
          .order('updated_at', { ascending: false });

        if (cancelledRef.current) return;
        if (fetchError) throw fetchError;
        setMedia((data ?? []) as Media[]);
      } catch (e) {
        if (cancelledRef.current) return;
        console.error('Failed to load friend library:', e);
        setError(e instanceof Error ? e.message : 'Failed to load library.');
      } finally {
        if (!cancelledRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [friendId]
  );

  useEffect(() => {
    cancelledRef.current = false;
    loadLibrary();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadLibrary]);

  // A friend's library is live data someone else controls - if they delete
  // or add something while you already have this page open (including one
  // Next kept alive in its client-side router cache instead of a fresh
  // mount), a stale fetch from minutes ago would otherwise keep showing a
  // title that no longer exists on their side. Re-pull whenever this tab
  // becomes visible/focused again rather than only on first mount.
  useEffect(() => {
    const handleFocus = () => loadLibrary({ silent: true });
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadLibrary({ silent: true });
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadLibrary]);

  const filteredMedia = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return media;
    return media.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.genres.some((g) => g.toLowerCase().includes(q)) ||
        m.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [media, search]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg-strong)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {friendship?.otherUser?.imageUrl ? (
            <img
              src={friendship.otherUser.imageUrl}
              alt={friendship.otherUser.name}
              className="w-10 h-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center text-white font-bold shrink-0">
              {friendship?.otherUser?.name?.[0]?.toUpperCase() ?? <Library className="h-4 w-4" />}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-[var(--mm-text)] tracking-tighter truncate">
              {friendship?.otherUser?.name ?? "Friend's Library"}
            </h1>
            <p className="text-sm text-[var(--mm-text-50)]">
              {media.length} {media.length === 1 ? 'title' : 'titles'}
            </p>
          </div>
        </div>
        <button
          onClick={() => loadLibrary({ silent: true })}
          title="Refresh"
          className="p-2 rounded-xl text-[var(--mm-text-50)] hover:text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg-strong)] transition-colors shrink-0"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
        </button>
      </div>

      {media.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--mm-text-30)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${friendship?.otherUser?.name ?? "their"} library...`}
            className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] rounded-xl h-11 pl-10"
          />
        </div>
      )}

      {isLoading ? (
        <div className="glass-card rounded-[28px] p-12 text-center">
          <Loader2 className="h-6 w-6 text-[var(--mm-text-30)] mx-auto animate-spin" />
        </div>
      ) : error ? (
        <div className="glass-card rounded-[28px] p-12 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      ) : media.length === 0 ? (
        <div className="glass-card rounded-[28px] p-12 text-center">
          <Library className="h-12 w-12 text-[var(--mm-text-20)] mx-auto mb-4" />
          <p className="text-[var(--mm-text-50)]">
            Nothing to show - either their library is empty, or you're not friends (yet).
          </p>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="glass-card rounded-[28px] p-12 text-center">
          <Search className="h-12 w-12 text-[var(--mm-text-20)] mx-auto mb-4" />
          <p className="text-[var(--mm-text-50)]">No matches for &quot;{search}&quot;.</p>
        </div>
      ) : (
        <MediaGrid media={filteredMedia} readOnly />
      )}
    </div>
  );
}
