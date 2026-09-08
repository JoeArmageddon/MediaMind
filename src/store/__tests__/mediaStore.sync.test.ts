import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, MAX_SYNC_ATTEMPTS } from '@/lib/db/dexie';
import { makeChain, resetDb, setOnline, type ChainCall } from './testUtils';

vi.mock('@/lib/db/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '@/lib/db/supabase';
import { useMediaStore } from '@/store/mediaStore';

const mockFrom = vi.mocked(supabase.from);

// Finds the id the mock chain was ultimately asked to act on, regardless of
// whether it came through .insert({id, ...}) or .eq('id', id).
function targetId(calls: ChainCall[]): unknown {
  const eqId = calls.find((c) => c.method === 'eq' && c.args[0] === 'id')?.args[1];
  if (eqId !== undefined) return eqId;
  const insertArg = calls.find((c) => c.method === 'insert')?.args[0] as { id?: unknown } | undefined;
  return insertArg?.id;
}

describe('mediaStore.syncWithSupabase', () => {
  beforeEach(async () => {
    await resetDb();
    mockFrom.mockReset();
    setOnline(true);
  });

  it('removes only successfully-synced items and leaves failures queued with an incremented attempt count', async () => {
    await db.syncQueue.bulkAdd([
      {
        id: 'q-ok',
        table: 'media',
        operation: 'insert',
        data: { id: 'm-ok', title: 'Will Succeed' },
        created_at: new Date().toISOString(),
      },
      {
        id: 'q-fail',
        table: 'media',
        operation: 'insert',
        data: { id: 'm-fail', title: 'Will Fail' },
        created_at: new Date().toISOString(),
      },
    ]);

    mockFrom.mockImplementation(() =>
      makeChain((calls) => {
        const id = targetId(calls);
        if (id === 'm-fail') return { data: null, error: { message: 'simulated failure' } };
        return { data: { id }, error: null };
      })
    );

    await useMediaStore.getState().syncWithSupabase();

    const remaining = await db.syncQueue.toArray();
    expect(remaining.map((i) => i.id)).toEqual(['q-fail']);
    expect(remaining[0].attempts).toBe(1);
    expect(remaining[0].last_error).toContain('simulated failure');
  });

  it('does not drop a failed item outright - it stays queued across repeated failed sync attempts', async () => {
    await db.syncQueue.add({
      id: 'q-fail',
      table: 'media',
      operation: 'update',
      data: { id: 'm-fail', title: 'Still Fails' },
      created_at: new Date().toISOString(),
    });

    mockFrom.mockImplementation(() =>
      makeChain(() => ({ data: null, error: { message: 'boom' } }))
    );

    await useMediaStore.getState().syncWithSupabase();
    await useMediaStore.getState().syncWithSupabase();
    await useMediaStore.getState().syncWithSupabase();

    const remaining = await db.syncQueue.toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].attempts).toBe(3);
  });

  it('stops retrying (but keeps queued) once an item hits MAX_SYNC_ATTEMPTS', async () => {
    await db.syncQueue.add({
      id: 'q-maxed',
      table: 'media',
      operation: 'update',
      data: { id: 'm-maxed' },
      created_at: new Date().toISOString(),
      attempts: MAX_SYNC_ATTEMPTS,
    });

    mockFrom.mockImplementation(() =>
      makeChain(() => ({ data: null, error: { message: 'should not be called' } }))
    );

    await useMediaStore.getState().syncWithSupabase();

    expect(mockFrom).not.toHaveBeenCalled();
    const remaining = await db.syncQueue.toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].attempts).toBe(MAX_SYNC_ATTEMPTS);
  });
});
