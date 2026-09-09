import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { SyncQueueItem } from './types';

// AsyncStorage-backed equivalent of the web app's db.syncQueue (a Dexie/
// IndexedDB table) - table-agnostic by design (every entry carries its own
// `table` name), same as web's, so mediaStore is the first consumer but
// any other store (collections, ...) can enqueue into this same queue
// later without needing its own processor.
const QUEUE_KEY = 'mediamind:sync-queue';

// Once a queued item has failed this many times, processQueue stops
// retrying it automatically (to avoid hammering a permanently-broken
// write) but leaves it in the queue rather than dropping it, so nothing
// is silently lost and its presence still shows up in queueLength().
export const MAX_SYNC_ATTEMPTS = 5;

async function getQueue(): Promise<SyncQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to read sync queue:', e);
    return [];
  }
}

async function setQueue(items: SyncQueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Failed to persist sync queue:', e);
  }
}

export async function enqueue(item: Pick<SyncQueueItem, 'table' | 'operation' | 'data'>): Promise<void> {
  const queue = await getQueue();
  queue.push({
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    created_at: new Date().toISOString(),
  });
  await setQueue(queue);
}

export async function queueLength(): Promise<number> {
  return (await getQueue()).length;
}

// Read-only peek at the current queue - used by fetchMedia's merge logic
// to know which ids still have a pending delete (so they don't get
// resurrected by a fresh Supabase fetch that predates the delete landing).
export async function peekQueue(): Promise<SyncQueueItem[]> {
  return getQueue();
}

// Attempts every queued write against Supabase, in order. Ported from web's
// mediaStore.syncWithSupabase - same silent-failure guards (Supabase's
// client returns { error } rather than throwing for most rejections, and
// a blocked `update` matches zero rows rather than erroring, so both are
// checked explicitly rather than assuming "no thrown exception" means
// success). Anything that fails stays queued with attempts+1 recorded;
// nothing is ever dropped just because it needs a plain retry.
export async function processQueue(): Promise<{ succeeded: SyncQueueItem[]; total: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { succeeded: [], total: 0 };

  const succeeded: SyncQueueItem[] = [];
  const remaining: SyncQueueItem[] = [];

  for (const change of queue) {
    if ((change.attempts ?? 0) >= MAX_SYNC_ATTEMPTS) {
      remaining.push(change);
      continue;
    }

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
        // Delete is idempotent - 0 rows matched is as much "this row is
        // gone" as 1 row matched (it may have already been deleted by an
        // earlier attempt), so no row-count check here, only `error`
        // counts as failure.
        ({ error } = await (supabase as any).from(change.table).delete().eq('id', change.data.id));
      } else if (change.operation === 'insert') {
        ({ error } = await (supabase as any).from(change.table).insert(change.data));
      }

      if (error) throw error;

      // update's RLS USING clause filters which rows the operation can
      // even see - a row it's not allowed to touch (e.g. a momentarily
      // stale/unresolved auth token) just matches zero rows rather than
      // erroring, so `error` alone can't tell a real success apart from a
      // silent no-op.
      if (change.operation === 'update' && (!affectedRows || affectedRows.length === 0)) {
        throw new Error('0 rows affected - likely blocked by RLS on a stale token');
      }

      succeeded.push(change);
    } catch (e: any) {
      remaining.push({
        ...change,
        attempts: (change.attempts ?? 0) + 1,
        last_error: e?.message ?? String(e),
      });
    }
  }

  await setQueue(remaining);
  return { succeeded, total: queue.length };
}
