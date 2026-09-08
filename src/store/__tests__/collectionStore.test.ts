import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db/dexie';
import { makeChain, resetDb, setOnline } from './testUtils';
import type { SmartCollection } from '@/types';

vi.mock('@/lib/db/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '@/lib/db/supabase';
import { useCollectionStore } from '@/store/collectionStore';

const mockFrom = vi.mocked(supabase.from);

function collection(overrides: Partial<SmartCollection>): SmartCollection {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'Untitled',
    description: null,
    media_ids: [],
    filter_criteria: null,
    is_auto_generated: false,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('collectionStore', () => {
  beforeEach(async () => {
    await resetDb();
    mockFrom.mockReset();
    useCollectionStore.setState({ collections: [], isLoading: false });
    setOnline(true);
  });

  it('fetchCollections merges server data with local-only collections instead of clobbering them', async () => {
    const localOnly = collection({ id: 'local-only', title: 'Created Offline' });
    const serverSide = collection({ id: 'from-server', title: 'From Server' });

    await db.smartCollections.add(localOnly);

    mockFrom.mockImplementation(() => makeChain(() => ({ data: [serverSide], error: null })));

    await useCollectionStore.getState().fetchCollections();

    const state = useCollectionStore.getState().collections;
    expect(state.map((c) => c.id).sort()).toEqual(['from-server', 'local-only']);

    // and IndexedDB itself must still have both, not just the server's data
    const persisted = await db.smartCollections.toArray();
    expect(persisted.map((c) => c.id).sort()).toEqual(['from-server', 'local-only']);
  });

  it('fetchCollections excludes local items that are pending deletion, even though the server has not caught up', async () => {
    const pendingDelete = collection({ id: 'pending-delete', title: 'About To Be Deleted' });
    await db.smartCollections.add(pendingDelete);
    await db.syncQueue.add({
      id: 'q1',
      table: 'smart_collections',
      operation: 'delete',
      data: { id: 'pending-delete' },
      created_at: new Date().toISOString(),
    });

    // Server still returns it (hasn't processed the delete yet)
    mockFrom.mockImplementation(() => makeChain(() => ({ data: [pendingDelete], error: null })));

    await useCollectionStore.getState().fetchCollections();

    expect(useCollectionStore.getState().collections.map((c) => c.id)).not.toContain('pending-delete');
  });

  it('queues the write when creating a collection while offline', async () => {
    setOnline(false);

    const created = await useCollectionStore.getState().addCollection({
      title: 'Offline Collection',
      description: null,
      media_ids: [],
      filter_criteria: null,
      is_auto_generated: false,
    });

    expect(mockFrom).not.toHaveBeenCalled();
    const queued = await db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ table: 'smart_collections', operation: 'insert' });
    expect((queued[0].data as { id: string }).id).toBe(created.id);
  });

  it('queues the write when the Supabase insert fails while online', async () => {
    mockFrom.mockImplementation(() => makeChain(() => ({ data: null, error: { message: 'boom' } })));

    await useCollectionStore.getState().addCollection({
      title: 'Will Fail To Sync',
      description: null,
      media_ids: [],
      filter_criteria: null,
      is_auto_generated: false,
    });

    const queued = await db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ table: 'smart_collections', operation: 'insert' });
  });
});
