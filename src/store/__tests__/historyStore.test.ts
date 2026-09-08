import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db/dexie';
import { makeChain, resetDb, setOnline } from './testUtils';
import type { History } from '@/types';

vi.mock('@/lib/db/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '@/lib/db/supabase';
import { useHistoryStore } from '@/store/historyStore';

const mockFrom = vi.mocked(supabase.from);

function historyEntry(overrides: Partial<History>): History {
  return {
    id: crypto.randomUUID(),
    media_id: 'media-1',
    action_type: 'added',
    value: null,
    previous_value: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('historyStore.fetchHistory', () => {
  beforeEach(async () => {
    await resetDb();
    mockFrom.mockReset();
    useHistoryStore.setState({ history: [], isLoading: false });
    setOnline(true);
  });

  it('keeps a locally-logged entry that the server does not know about yet', async () => {
    // Different media_id from the server row - this is a placeholder for a
    // mutation the trigger hasn't produced an authoritative row for yet, not
    // a duplicate of it (see the separate pruning test below for that case).
    const localOnly = historyEntry({
      id: 'local-only',
      media_id: 'media-2',
      created_at: new Date(Date.now() - 1000).toISOString(),
    });
    const fromServer = historyEntry({ id: 'from-server', media_id: 'media-1' });

    await db.history.add(localOnly);

    mockFrom.mockImplementation(() => makeChain(() => ({ data: [fromServer], error: null })));

    await useHistoryStore.getState().fetchHistory();

    const ids = useHistoryStore.getState().history.map((h) => h.id).sort();
    expect(ids).toEqual(['from-server', 'local-only']);

    // and it must still be in IndexedDB too, not just transiently in memory
    const persisted = await db.history.toArray();
    expect(persisted.map((h) => h.id).sort()).toEqual(['from-server', 'local-only']);
  });

  it('prunes a local placeholder entry once the authoritative server row for that media item has synced down', async () => {
    const placeholder = historyEntry({
      id: 'local-placeholder',
      media_id: 'media-1',
      created_at: new Date(Date.now() - 1000).toISOString(),
    });
    await db.history.add(placeholder);

    const authoritative = historyEntry({
      id: 'server-authoritative',
      media_id: 'media-1',
      created_at: new Date().toISOString(),
    });

    mockFrom.mockImplementation(() => makeChain(() => ({ data: [authoritative], error: null })));

    await useHistoryStore.getState().fetchHistory();

    const ids = useHistoryStore.getState().history.map((h) => h.id);
    expect(ids).toEqual(['server-authoritative']);
    expect(await db.history.get('local-placeholder')).toBeUndefined();
  });

  it('never writes to Supabase - history sync is read-only from the client (the DB trigger is authoritative)', async () => {
    await useHistoryStore.getState().addHistoryEntry({
      media_id: 'media-1',
      action_type: 'added',
      value: { title: 'Test' },
      previous_value: null,
    });

    expect(mockFrom).not.toHaveBeenCalled();
    const persisted = await db.history.toArray();
    expect(persisted).toHaveLength(1);
  });
});
