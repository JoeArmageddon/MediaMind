import { vi } from 'vitest';
import { db } from '@/lib/db/dexie';

export type SupaResult = { data: unknown; error: { message: string } | null };
export type ChainCall = { method: string; args: unknown[] };

/**
 * Builds a chainable object mimicking supabase-js's query builder
 * (.select().order()/.insert()/.update().eq()/.delete().eq()/.single(), etc).
 * Every chain method returns the same object and records its call; awaiting
 * the chain (or calling .then) resolves with whatever `getResult` computes
 * from the recorded calls, so one mock covers any call shape the stores use
 * (e.g. deciding pass/fail based on which row id was passed to .eq()/.insert())
 * without hand-modeling supabase-js's real types.
 */
export function makeChain(getResult: (calls: ChainCall[]) => SupaResult | Promise<SupaResult>) {
  const calls: ChainCall[] = [];
  const chain: Record<string, unknown> = { __calls: calls };
  const passthrough = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'single', 'upsert'];
  for (const method of passthrough) {
    chain[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    });
  }
  chain.then = (resolve: (v: SupaResult) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(getResult(calls)).then(resolve, reject);
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(getResult(calls)).catch(reject);
  return chain;
}

/** Clears every Dexie table used by the stores under test. */
export async function resetDb() {
  await Promise.all([
    db.media.clear(),
    db.history.clear(),
    db.smartCollections.clear(),
    db.syncQueue.clear(),
  ]);
}

export function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}
