'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Globe, Folder } from 'lucide-react';
import { MediaGrid } from '@/components/media/MediaGrid';
import { useCollectionStore } from '@/store/collectionStore';
import { supabase } from '@/lib/db/supabase';
import type { Media, SmartCollection } from '@/types';

// A public collection's page - viewable by any signed-in MediaMind user via
// its link (see the "select public collections" / "select collection-shared
// media" RLS policies), not gated by friendship. Deliberately doesn't show
// who owns it - see collectionStore.fetchPublicCollection's comment.
export default function PublicCollectionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const collectionId = params.id;
  const { fetchPublicCollection } = useCollectionStore();

  const [collection, setCollection] = useState<SmartCollection | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (!collectionId) return;
    setIsLoading(true);
    setNotFound(false);
    try {
      const found = await fetchPublicCollection(collectionId);
      if (cancelledRef.current) return;
      if (!found) {
        setNotFound(true);
        setCollection(null);
        setMedia([]);
        return;
      }
      setCollection(found);

      if (found.media_ids.length === 0) {
        setMedia([]);
        return;
      }
      const { data, error } = await (supabase as any)
        .from('media')
        .select('*')
        .in('id', found.media_ids);
      if (cancelledRef.current) return;
      if (error) throw error;
      setMedia((data ?? []) as Media[]);
    } catch (e) {
      console.warn('Failed to load public collection:', e);
      if (!cancelledRef.current) {
        setNotFound(true);
        setMedia([]);
      }
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, [collectionId, fetchPublicCollection]);

  useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/collections')}
          className="p-2 rounded-xl text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg-strong)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0">
            <Folder className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-[var(--mm-text)] tracking-tighter truncate">
              {collection?.title ?? 'Public Collection'}
            </h1>
            <p className="text-sm text-[var(--mm-text-50)] flex items-center gap-1.5">
              <Globe className="h-3 w-3" />
              {media.length} {media.length === 1 ? 'title' : 'titles'}
            </p>
          </div>
        </div>
      </div>

      {collection?.description && (
        <p className="text-[var(--mm-text-60)] text-sm leading-relaxed -mt-2">{collection.description}</p>
      )}

      {isLoading ? (
        <div className="glass-card rounded-[28px] p-12 text-center">
          <Loader2 className="h-6 w-6 text-[var(--mm-text-30)] mx-auto animate-spin" />
        </div>
      ) : notFound ? (
        <div className="glass-card rounded-[28px] p-12 text-center">
          <Globe className="h-12 w-12 text-[var(--mm-text-20)] mx-auto mb-4" />
          <p className="text-[var(--mm-text-50)]">
            This collection doesn&apos;t exist, or its owner has made it private.
          </p>
        </div>
      ) : media.length === 0 ? (
        <div className="glass-card rounded-[28px] p-12 text-center">
          <Folder className="h-12 w-12 text-[var(--mm-text-20)] mx-auto mb-4" />
          <p className="text-[var(--mm-text-50)]">Nothing in this collection yet.</p>
        </div>
      ) : (
        <MediaGrid media={media} readOnly />
      )}
    </div>
  );
}
