import { db } from '@/lib/db/dexie';
import type { History } from '@/types';

/**
 * Logs a history entry to the local IndexedDB mirror only, for instant
 * offline-first UI (Timeline/Calendar read from `db.history`/`historyStore`).
 *
 * This intentionally does NOT insert into Supabase. The `media_history_log`
 * trigger in supabase/schema.sql is the single source of truth for history
 * rows that reach the server — it fires automatically on every insert/update/
 * delete of a `media` row. Writing here too would double up every entry
 * (one client-authored row, one trigger-authored row). The authoritative
 * trigger-generated rows are pulled down and merged into IndexedDB the next
 * time history is fetched (see historyStore.fetchHistory), so this local
 * entry is a short-lived optimistic placeholder for entries not yet synced.
 */
export async function logHistory(entry: Omit<History, 'id' | 'created_at'>): Promise<History> {
  const historyEntry: History = {
    ...entry,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };

  try {
    await db.history.add(historyEntry);
  } catch (e) {
    console.warn('Failed to log history locally:', e);
  }

  return historyEntry;
}
