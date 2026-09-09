import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Media, MediaStatus, MediaType, FilterState, ViewMode, History } from '@/types';
import { db, MAX_SYNC_ATTEMPTS } from '@/lib/db/dexie';
import { supabase } from '@/lib/db/supabase';
import { logHistory } from '@/lib/history';

interface MediaStore {
  // Data
  media: Media[];
  filteredMedia: Media[];
  selectedMedia: Media | null;
  
  // UI State
  viewMode: ViewMode;
  gridSize: number;
  isLoading: boolean;
  error: string | null;
  
  // Filters
  filters: FilterState;
  isFilterDrawerOpen: boolean;
  
  // Actions
  setMedia: (media: Media[]) => void;
  addMedia: (media: Omit<Media, 'id' | 'created_at' | 'updated_at'>) => Promise<Media>;
  updateMedia: (id: string, updates: Partial<Media>) => Promise<void>;
  deleteMedia: (id: string) => Promise<void>;
  setSelectedMedia: (media: Media | null) => void;
  
  // Filter Actions
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  applyFilters: () => void;
  toggleFilterDrawer: () => void;
  
  // View Actions
  setViewMode: (mode: ViewMode) => void;
  setGridSize: (size: number) => void;
  
  // Data Operations
  fetchMedia: () => Promise<void>;
  syncWithSupabase: () => Promise<void>;
}

// Chunk D's "select friends media"/"select friends history" RLS policies
// mean an unfiltered select('*') on these tables now also returns accepted
// friends' rows, not just the caller's own - every "my library" query in
// this store must filter to this explicitly rather than relying on RLS
// alone to mean "mine".
const getCurrentUserId = (): string | undefined =>
  typeof window !== 'undefined' ? window.Clerk?.user?.id : undefined;

// normalized_title is a Postgres GENERATED ALWAYS ... STORED column - any
// insert/upsert that includes it is rejected outright. created_at/updated_at
// are safe to include (plain DEFAULT NOW(), not generated) and should be
// preserved as-is when re-uploading an existing/imported record so its real
// history isn't overwritten with "now". `synced` is local-only bookkeeping
// (see Media type) and has no column in Supabase at all.
const stripForSupabase = (item: Media): Record<string, unknown> => {
  const { normalized_title, synced, ...rest } = item as unknown as Record<string, unknown>;
  return rest;
};

const defaultFilters: FilterState = {
  status: [],
  type: [],
  genres: [],
  tags: [],
  release_year: {},
  rating: {},
  is_favorite: null,
  is_archived: false,
  search_query: '',
  sort_by: 'updated_at',
  sort_order: 'desc',
};

export const useMediaStore = create<MediaStore>()(
  persist(
    (set, get) => ({
      // Initial State
      media: [],
      filteredMedia: [],
      selectedMedia: null,
      viewMode: 'grid',
      gridSize: 3,
      isLoading: false,
      error: null,
      filters: defaultFilters,
      isFilterDrawerOpen: false,

      // Setters
      setMedia: (media) => {
        set({ media });
        get().applyFilters();
      },

      addMedia: async (mediaData) => {
        set({ isLoading: true, error: null });
        try {
          // Create local media object with ID
          const tempId = crypto.randomUUID();
          const now = new Date().toISOString();
          
          // Ensure all fields have proper defaults for Supabase
          const sanitizedData = {
            title: mediaData.title,
            normalized_title: mediaData.normalized_title || mediaData.title.toLowerCase().replace(/[^a-z0-9]/g, ''),
            type: mediaData.type,
            poster_url: mediaData.poster_url ?? null,
            backdrop_url: mediaData.backdrop_url ?? null,
            description: mediaData.description ?? null,
            release_year: mediaData.release_year ?? null,
            api_rating: mediaData.api_rating ?? null,
            genres: mediaData.genres || [],
            tags: mediaData.tags || [],
            studios: mediaData.studios || [],
            total_units: mediaData.total_units ?? 0,
            progress: mediaData.progress ?? 0,
            completion_percent: mediaData.completion_percent ?? 0,
            status: mediaData.status || 'planned',
            is_favorite: mediaData.is_favorite ?? false,
            is_archived: mediaData.is_archived ?? false,
            notes: mediaData.notes ?? null,
            user_rating: mediaData.user_rating ?? null,
            streaming_platforms: mediaData.streaming_platforms || [],
            ai_primary_tone: mediaData.ai_primary_tone ?? null,
            ai_secondary_tone: mediaData.ai_secondary_tone ?? null,
            ai_core_themes: mediaData.ai_core_themes || [],
            ai_emotional_intensity: mediaData.ai_emotional_intensity ?? null,
            ai_pacing: mediaData.ai_pacing ?? null,
            ai_darkness_level: mediaData.ai_darkness_level ?? null,
            ai_intellectual_depth: mediaData.ai_intellectual_depth ?? null,
            tmdb_id: mediaData.tmdb_id ?? null,
            mal_id: mediaData.mal_id ?? null,
            rawg_id: mediaData.rawg_id ?? null,
            google_books_id: mediaData.google_books_id ?? null,
            completed_at: mediaData.completed_at ?? null,
          };
          
          const newMedia = {
            ...sanitizedData,
            id: tempId,
            created_at: now,
            updated_at: now,
            // Not confirmed to exist in Supabase yet - see the Media type's
            // `synced` doc comment for why this distinction matters.
            synced: false,
          } as Media;

          console.log('Adding media:', newMedia.title);

          // Add to IndexedDB FIRST (always succeed locally)
          await db.media.add(newMedia);
          console.log('Saved to IndexedDB:', tempId);

          // Log history entry
          await logHistory({
            media_id: tempId,
            action_type: 'added',
            value: { title: newMedia.title, type: newMedia.type },
            previous_value: null,
          });

          // Update local state immediately (optimistic)
          set((state) => ({
            media: [newMedia, ...state.media],
            isLoading: false,
          }));
          get().applyFilters();

          // Try to sync with Supabase in background (don't block, don't fail)
          if (navigator.onLine) {
            (async () => {
              try {
                // Prepare data for Supabase - exclude auto-generated fields (normalized_title, created_at, updated_at)
                const dataForSupabase = {
                  id: tempId,
                  title: sanitizedData.title,
                  type: sanitizedData.type,
                  poster_url: sanitizedData.poster_url,
                  backdrop_url: sanitizedData.backdrop_url,
                  description: sanitizedData.description,
                  release_year: sanitizedData.release_year,
                  api_rating: sanitizedData.api_rating,
                  genres: sanitizedData.genres,
                  tags: sanitizedData.tags,
                  studios: sanitizedData.studios,
                  total_units: sanitizedData.total_units,
                  progress: sanitizedData.progress,
                  completion_percent: sanitizedData.completion_percent,
                  status: sanitizedData.status,
                  is_favorite: sanitizedData.is_favorite,
                  is_archived: sanitizedData.is_archived,
                  notes: sanitizedData.notes,
                  user_rating: sanitizedData.user_rating,
                  streaming_platforms: sanitizedData.streaming_platforms,
                  ai_primary_tone: sanitizedData.ai_primary_tone,
                  ai_secondary_tone: sanitizedData.ai_secondary_tone,
                  ai_core_themes: sanitizedData.ai_core_themes,
                  ai_emotional_intensity: sanitizedData.ai_emotional_intensity,
                  ai_pacing: sanitizedData.ai_pacing,
                  ai_darkness_level: sanitizedData.ai_darkness_level,
                  ai_intellectual_depth: sanitizedData.ai_intellectual_depth,
                  tmdb_id: sanitizedData.tmdb_id,
                  mal_id: sanitizedData.mal_id,
                  rawg_id: sanitizedData.rawg_id,
                  google_books_id: sanitizedData.google_books_id,
                  completed_at: sanitizedData.completed_at,
                };
                
                const { data, error } = await (supabase as any)
                  .from('media')
                  .insert(dataForSupabase)
                  .select()
                  .single();

                if (error) {
                  console.warn('Supabase insert error:', error.message);
                  // Queue for later sync
                  await db.syncQueue.add({
                    id: crypto.randomUUID(),
                    table: 'media',
                    operation: 'insert',
                    data: dataForSupabase,
                    created_at: now,
                  });
                } else if (data) {
                  console.log('Synced to Supabase:', data.id);
                  const syncedMedia = { ...(data as Media), synced: true };
                  // Update IndexedDB with server data (use put to update existing)
                  await db.media.put(syncedMedia);
                  // Update state with server data
                  set((state) => ({
                    media: state.media.map(m => m.id === tempId ? syncedMedia : m),
                  }));
                  get().applyFilters();
                }
              } catch (syncError) {
                console.warn('Supabase sync error:', syncError);
                // Queue for later sync (without auto-generated fields)
                const queueData = {
                  id: tempId,
                  title: sanitizedData.title,
                  type: sanitizedData.type,
                  poster_url: sanitizedData.poster_url,
                  backdrop_url: sanitizedData.backdrop_url,
                  description: sanitizedData.description,
                  release_year: sanitizedData.release_year,
                  api_rating: sanitizedData.api_rating,
                  genres: sanitizedData.genres,
                  tags: sanitizedData.tags,
                  studios: sanitizedData.studios,
                  total_units: sanitizedData.total_units,
                  progress: sanitizedData.progress,
                  completion_percent: sanitizedData.completion_percent,
                  status: sanitizedData.status,
                  is_favorite: sanitizedData.is_favorite,
                  is_archived: sanitizedData.is_archived,
                  notes: sanitizedData.notes,
                  user_rating: sanitizedData.user_rating,
                  streaming_platforms: sanitizedData.streaming_platforms,
                  ai_primary_tone: sanitizedData.ai_primary_tone,
                  ai_secondary_tone: sanitizedData.ai_secondary_tone,
                  ai_core_themes: sanitizedData.ai_core_themes,
                  ai_emotional_intensity: sanitizedData.ai_emotional_intensity,
                  ai_pacing: sanitizedData.ai_pacing,
                  ai_darkness_level: sanitizedData.ai_darkness_level,
                  ai_intellectual_depth: sanitizedData.ai_intellectual_depth,
                  tmdb_id: sanitizedData.tmdb_id,
                  mal_id: sanitizedData.mal_id,
                  rawg_id: sanitizedData.rawg_id,
                  google_books_id: sanitizedData.google_books_id,
                  completed_at: sanitizedData.completed_at,
                };
                await db.syncQueue.add({
                  id: crypto.randomUUID(),
                  table: 'media',
                  operation: 'insert',
                  data: queueData,
                  created_at: new Date().toISOString(),
                });
              }
            })();
          }

          return newMedia;
        } catch (error) {
          console.error('addMedia error:', error);
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      updateMedia: async (id, updates) => {
        set({ isLoading: true, error: null });
        try {
          const updated_at = new Date().toISOString();
          
          // Get current media for history logging
          const currentMedia = get().media.find((m) => m.id === id);
          
          // Update IndexedDB
          await db.media.update(id, { ...updates, updated_at });

          // Log history entry based on what changed
          if (currentMedia) {
            let actionType: History['action_type'] = 'updated';
            let value: Record<string, unknown> = updates;
            let previousValue: Record<string, unknown> | null = null;

            if ('status' in updates && updates.status !== currentMedia.status) {
              actionType = 'status_change';
              value = { status: updates.status };
              previousValue = { status: currentMedia.status };
            } else if ('progress' in updates && updates.progress !== currentMedia.progress) {
              actionType = 'progress_update';
              value = { progress: updates.progress, completion_percent: updates.completion_percent };
              previousValue = { progress: currentMedia.progress, completion_percent: currentMedia.completion_percent };
            } else if ('is_favorite' in updates && updates.is_favorite !== currentMedia.is_favorite) {
              actionType = updates.is_favorite ? 'favorited' : 'unfavorited';
              value = { is_favorite: updates.is_favorite };
              previousValue = { is_favorite: currentMedia.is_favorite };
            } else if ('is_archived' in updates && updates.is_archived !== currentMedia.is_archived) {
              actionType = updates.is_archived ? 'archived' : 'unarchived';
              value = { is_archived: updates.is_archived };
              previousValue = { is_archived: currentMedia.is_archived };
            }

            await logHistory({
              media_id: id,
              action_type: actionType,
              value,
              previous_value: previousValue,
            });
          }

          // Update local state immediately (optimistic). selectedMedia is a
          // separate snapshot taken when the detail dialog opened, not a
          // live reference into `media` - without patching it too, an
          // update made from inside that open dialog (Analyze Tone &
          // Themes, Find streaming, rating, notes...) would land in the
          // store/Supabase/IndexedDB correctly but the dialog itself would
          // keep rendering the old snapshot forever, so a real update just
          // looked like the button did nothing.
          set((state) => ({
            media: state.media.map((m) =>
              m.id === id ? { ...m, ...updates, updated_at } : m
            ),
            selectedMedia:
              state.selectedMedia?.id === id
                ? { ...state.selectedMedia, ...updates, updated_at }
                : state.selectedMedia,
          }));
          get().applyFilters();

          // Sync with Supabase if online
          if (navigator.onLine) {
            // .select() to detect a silent 0-row RLS no-op (see deleteMedia
            // for the full explanation) - without it this update could
            // appear to succeed while never actually reaching the row, and
            // - unlike an explicit error - previously wasn't even queued
            // for retry, just silently lost.
            const { data: updatedRows, error } = await (supabase as any)
              .from('media')
              .update({ ...updates, updated_at })
              .eq('id', id)
              .select('id');

            if (error || !updatedRows || updatedRows.length === 0) {
              console.warn(
                'Supabase update did not confirm, queuing:',
                error ?? '0 rows affected (likely blocked by RLS on a stale token)'
              );
              await db.syncQueue.add({
                id: crypto.randomUUID(),
                table: 'media',
                operation: 'update',
                data: { id, ...updates },
                created_at: updated_at,
              });
            }
          } else {
            // Queue for later sync
            await db.syncQueue.add({
              id: crypto.randomUUID(),
              table: 'media',
              operation: 'update',
              data: { id, ...updates },
              created_at: updated_at,
            });
          }

          set({ isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      deleteMedia: async (id) => {
        set({ isLoading: true, error: null });
        try {
          // Get media info before deleting for history
          const mediaToDelete = get().media.find((m) => m.id === id);

          // Log history entry before deletion
          if (mediaToDelete) {
            await logHistory({
              media_id: id,
              action_type: 'deleted',
              value: null,
              previous_value: { title: mediaToDelete.title, type: mediaToDelete.type },
            });
          }

          // Delete from IndexedDB
          await db.media.delete(id);

          // Update local state
          set((state) => ({
            media: state.media.filter((m) => m.id !== id),
          }));
          get().applyFilters();

          // Sync with Supabase if online
          if (navigator.onLine) {
            try {
              // Delete is idempotent - 0 rows matched (nothing left to
              // delete) is just as much "this row is gone" as 1 row
              // matched, so only a real `error` counts as failure here
              // (unlike update, where 0 rows means a specific change
              // didn't land and can't be treated as a no-op success).
              const { error } = await (supabase as any).from('media').delete().eq('id', id);
              if (error) {
                console.warn('Supabase delete failed, queuing:', error);
                // Queue for later retry
                await db.syncQueue.add({
                  id: crypto.randomUUID(),
                  table: 'media',
                  operation: 'delete',
                  data: { id },
                  created_at: new Date().toISOString(),
                });
              }
            } catch (e) {
              console.warn('Supabase delete error, queuing:', e);
              // Queue for later retry
              await db.syncQueue.add({
                id: crypto.randomUUID(),
                table: 'media',
                operation: 'delete',
                data: { id },
                created_at: new Date().toISOString(),
              });
            }
          } else {
            // Queue for later sync
            await db.syncQueue.add({
              id: crypto.randomUUID(),
              table: 'media',
              operation: 'delete',
              data: { id },
              created_at: new Date().toISOString(),
            });
          }

          set({ isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },

      setSelectedMedia: (media) => set({ selectedMedia: media }),

      // Filter Actions
      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
        get().applyFilters();
      },

      resetFilters: () => {
        set({ filters: defaultFilters });
        get().applyFilters();
      },

      applyFilters: () => {
        const { media, filters } = get();
        let filtered = [...media];

        // Search query
        if (filters.search_query) {
          const query = filters.search_query.toLowerCase();
          filtered = filtered.filter(
            (m) =>
              m.title.toLowerCase().includes(query) ||
              m.description?.toLowerCase().includes(query) ||
              m.genres.some((g) => g.toLowerCase().includes(query)) ||
              m.tags.some((t) => t.toLowerCase().includes(query))
          );
        }

        // Status filter
        if (filters.status.length > 0) {
          filtered = filtered.filter((m) => filters.status.includes(m.status));
        }

        // Type filter
        if (filters.type.length > 0) {
          filtered = filtered.filter((m) => filters.type.includes(m.type));
        }

        // Genre filter
        if (filters.genres.length > 0) {
          filtered = filtered.filter((m) =>
            filters.genres.some((g) => m.genres.includes(g))
          );
        }

        // Tags filter
        if (filters.tags.length > 0) {
          filtered = filtered.filter((m) =>
            filters.tags.some((t) => m.tags.includes(t))
          );
        }

        // Year filter
        if (filters.release_year.min !== undefined) {
          filtered = filtered.filter(
            (m) => (m.release_year || 0) >= (filters.release_year.min || 0)
          );
        }
        if (filters.release_year.max !== undefined) {
          filtered = filtered.filter(
            (m) => (m.release_year || 9999) <= (filters.release_year.max || 9999)
          );
        }

        // Rating filter
        if (filters.rating.min !== undefined) {
          filtered = filtered.filter(
            (m) => (m.api_rating || 0) >= (filters.rating.min || 0)
          );
        }
        if (filters.rating.max !== undefined) {
          filtered = filtered.filter(
            (m) => (m.api_rating || 10) <= (filters.rating.max || 10)
          );
        }

        // Favorites
        if (filters.is_favorite !== null) {
          filtered = filtered.filter((m) => m.is_favorite === filters.is_favorite);
        }

        // Archived
        filtered = filtered.filter((m) => m.is_archived === filters.is_archived);

        // Sorting
        filtered.sort((a, b) => {
          const sortField = filters.sort_by;
          const order = filters.sort_order === 'asc' ? 1 : -1;

          // Handle 'rating' mapping to api_rating
          let aVal: any, bVal: any;
          if (sortField === 'rating') {
            aVal = a.api_rating;
            bVal = b.api_rating;
          } else {
            aVal = (a as any)[sortField];
            bVal = (b as any)[sortField];
          }

          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal) * order;
          }

          if (aVal === null && bVal === null) return 0;
          if (aVal === null) return 1 * order;
          if (bVal === null) return -1 * order;

          return (aVal < bVal ? -1 : 1) * order;
        });

        set({ filteredMedia: filtered });
      },

      toggleFilterDrawer: () => {
        set((state) => ({ isFilterDrawerOpen: !state.isFilterDrawerOpen }));
      },

      // View Actions
      setViewMode: (mode) => set({ viewMode: mode }),
      setGridSize: (size) => set({ gridSize: Math.max(1, Math.min(6, size)) }),

      // Data Operations
      fetchMedia: async () => {
        set({ isLoading: true, error: null });
        try {
          // Always load from IndexedDB FIRST - this is the source of truth
          const localMedia = await db.media.toArray();
          console.log('Loaded from IndexedDB:', localMedia.length, 'items');
          
          // Update UI immediately with local data
          set({ media: localMedia });
          get().applyFilters();

          // If online, try to sync with Supabase
          if (navigator.onLine) {
            try {
              // First: Push any pending local changes TO Supabase
              await get().syncWithSupabase();

              // Then: Fetch from Supabase to get any new data from other devices.
              // Explicitly scoped to the signed-in user - since Chunk D, RLS
              // also permits reading an accepted friend's rows, so an
              // unfiltered select('*') here would merge their library into
              // "my" media state instead of just enabling the dedicated
              // /friends/[friendId] view to read it on request.
              const currentUserId = getCurrentUserId();
              let mediaQuery = (supabase as any)
                .from('media')
                .select('*')
                .order('updated_at', { ascending: false });
              if (currentUserId) {
                mediaQuery = mediaQuery.or(`user_id.eq.${currentUserId},user_id.is.null`);
              }
              const { data, error } = await mediaQuery;

              if (error) {
                console.warn('Supabase fetch error:', error);
                // Keep local data, don't modify it
              } else if (data) {
                console.log('Fetched from Supabase:', data.length, 'items');
                
                // SAFETY CHECK: If Supabase returns empty but we have local data,
                // DON'T clear local data - instead try to sync local TO Supabase.
                // Only items never confirmed synced get pushed - an
                // all-empty response is exactly the ambiguous case `synced`
                // exists for (a transient glitch vs. everything genuinely
                // being gone), so previously-synced items are left alone
                // here rather than either resurrected-by-reupload or
                // deleted on what might just be a flaky response.
                if (data.length === 0 && localMedia.length > 0) {
                  const neverSynced = localMedia.filter((m) => m.synced !== true);
                  console.log(
                    `Supabase empty but local has data - pushing ${neverSynced.length} never-synced item(s)`
                  );
                  for (const item of neverSynced) {
                    try {
                      const { error: upsertError } = await (supabase as any)
                        .from('media')
                        .upsert(stripForSupabase(item));
                      if (upsertError) console.warn('Failed to upsert item:', item.title, upsertError.message);
                    } catch (e) {
                      console.warn('Failed to upsert item:', item.title, e);
                    }
                  }
                  set({ isLoading: false });
                  return;
                }
                
                // Get IDs of items pending deletion from sync queue
                const pendingDeletes = await db.syncQueue
                  .where('operation')
                  .equals('delete')
                  .toArray();
                const pendingDeleteIds = new Set(pendingDeletes.map(q => q.data.id));
                console.log('Pending deletions:', pendingDeleteIds.size);

                // Merge strategy:
                // - Supabase data wins for same IDs (newer)
                // - Local-only items are preserved
                // - Items pending deletion are removed
                const supabaseIds = new Set(data.map((m: Media) => m.id));
                const localOnlyItems = localMedia.filter(
                  m => !supabaseIds.has(m.id) && !pendingDeleteIds.has(m.id)
                );

                // A local-only item is one of two very different things,
                // and conflating them was a real data-loss bug: deleting a
                // title on one device/tab, then loading another tab whose
                // Dexie cache hadn't heard about it yet, would see it as
                // "local-only" and re-upload it - resurrecting a title you
                // just deleted. `synced` (see the Media type) disambiguates:
                // genuinely new/imported items are pushed up, but anything
                // previously confirmed synced that's now absent from a
                // fresh Supabase fetch was deleted elsewhere and gets
                // pruned locally instead.
                const unsyncedLocalOnly = localOnlyItems.filter((m) => m.synced !== true);
                const deletedElsewhere = localOnlyItems.filter((m) => m.synced === true);

                if (unsyncedLocalOnly.length > 0) {
                  console.log(`Pushing ${unsyncedLocalOnly.length} local-only item(s) to Supabase`);
                  for (const item of unsyncedLocalOnly) {
                    try {
                      const { error: pushError } = await (supabase as any)
                        .from('media')
                        .upsert(stripForSupabase(item));
                      if (pushError) console.warn('Failed to push local-only item:', item.title, pushError.message);
                    } catch (e) {
                      console.warn('Failed to push local-only item:', item.title, e);
                    }
                  }
                }

                if (deletedElsewhere.length > 0) {
                  console.log(`Pruning ${deletedElsewhere.length} item(s) deleted elsewhere`);
                  await db.media.bulkDelete(deletedElsewhere.map((m) => m.id));
                }

                // Filter Supabase data to exclude items pending deletion.
                // Everything freshly fetched from Supabase is, by
                // definition, confirmed synced - stamped here so a later
                // fetch can tell it apart from a genuinely-local item if it
                // ever disappears.
                const filteredSupabaseData = (data as Media[])
                  .filter(m => !pendingDeleteIds.has(m.id))
                  .map((m) => ({ ...m, synced: true }));

                const mergedData = [...filteredSupabaseData, ...unsyncedLocalOnly];

                console.log('Merged data:', mergedData.length, 'items');
                
                // SAFER UPDATE: Use bulkPut (upsert) instead of clear + bulkAdd
                // This way if something fails, we don't lose data
                try {
                  await db.media.bulkPut(mergedData);
                  set({ media: mergedData });
                  get().applyFilters();
                  console.log('Successfully saved merged data to IndexedDB');
                } catch (bulkError) {
                  console.error('Failed to save merged data:', bulkError);
                  // Keep original local data on error
                }
              }
            } catch (supabaseError) {
              console.warn('Supabase sync failed, using local data:', supabaseError);
              // Keep local data unchanged
            }
          }

          set({ isLoading: false });
        } catch (error) {
          console.error('fetchMedia error:', error);
          set({ error: (error as Error).message, isLoading: false });
        }
      },

      syncWithSupabase: async () => {
        if (!navigator.onLine) return;

        set({ isLoading: true });
        try {
          // Get pending changes
          const pendingChanges = await db.syncQueue.toArray();
          console.log('Processing pending changes:', pendingChanges.length);

          const succeededIds: string[] = [];

          for (const change of pendingChanges) {
            // Items that have failed MAX_SYNC_ATTEMPTS times are left in the
            // queue (so nothing is lost / conflict_count reflects them) but
            // are no longer retried automatically every sync cycle.
            if ((change.attempts ?? 0) >= MAX_SYNC_ATTEMPTS) continue;

            try {
              let error: { message?: string } | null = null;
              let affectedRows: unknown[] | null = null;

              if (change.operation === 'update') {
                ({ error, data: affectedRows } = await (supabase as any)
                  .from(change.table)
                  .update(change.data)
                  .eq('id', change.data.id)
                  .select('id'));
              } else if (change.operation === 'delete') {
                // Delete is idempotent - 0 rows matched is as much "this
                // row is gone" as 1 row matched (it may have already been
                // deleted by an earlier attempt), so no row-count check
                // here, only `error` counts as failure.
                ({ error } = await (supabase as any)
                  .from(change.table)
                  .delete()
                  .eq('id', change.data.id));
              } else if (change.operation === 'insert') {
                ({ error } = await (supabase as any).from(change.table).insert(change.data));
              }

              // Supabase's client returns { error } rather than throwing for
              // most failures (RLS denial, constraint violation, etc.) - the
              // old code never checked this, so failed writes were treated
              // as successful and their queue entries were discarded anyway.
              if (error) throw error;

              // update's RLS USING clause filters which rows the operation
              // can even see - a row it's not allowed to touch (e.g. a
              // momentarily stale/unresolved auth token on this one
              // request) just matches zero rows rather than erroring, so
              // `error` alone can't tell a real success apart from a
              // silent no-op. Insert doesn't have this blind spot - a
              // blocked insert's WITH CHECK genuinely fails with an error.
              if (change.operation === 'update' && (!affectedRows || affectedRows.length === 0)) {
                throw new Error('0 rows affected - likely blocked by RLS on a stale token');
              }

              // A queued media insert that just landed is now confirmed to
              // exist in Supabase - without this, fetchMedia's merge would
              // keep treating it as "local-only, needs pushing" forever
              // (harmless there since it already exists, but it also means
              // it could never be told apart from a genuinely-new item if
              // it were ever deleted elsewhere while this device was
              // offline for the whole round trip).
              if (change.table === 'media' && change.operation === 'insert' && change.data.id) {
                try {
                  await db.media.update(change.data.id as string, { synced: true });
                } catch (e) {
                  console.warn('Failed to mark media as synced after queued insert:', e);
                }
              }

              succeededIds.push(change.id);
              console.log('Synced:', change.operation, change.data.id || change.data.title);
            } catch (changeError) {
              console.error('Failed to sync change:', change, changeError);
              // Leave it queued and record the attempt - do NOT drop it.
              await db.syncQueue.update(change.id, {
                attempts: (change.attempts ?? 0) + 1,
                last_error: (changeError as Error)?.message ?? String(changeError),
              });
            }
          }

          // Only remove items that actually made it to Supabase. Anything
          // that failed (or was skipped for having maxed out attempts) stays
          // queued for the next sync pass instead of being silently dropped.
          if (succeededIds.length > 0) {
            await db.syncQueue.bulkDelete(succeededIds);
          }
          console.log(
            `Sync: ${succeededIds.length}/${pendingChanges.length} synced, ${
              pendingChanges.length - succeededIds.length
            } remain queued`
          );

          set({ isLoading: false });
        } catch (error) {
          console.error('syncWithSupabase error:', error);
          set({ error: (error as Error).message, isLoading: false });
        }
      },
    }),
    {
      name: 'media-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        viewMode: state.viewMode,
        gridSize: state.gridSize,
        filters: state.filters,
      }),
    }
  )
);
