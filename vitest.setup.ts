import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// jsdom's crypto support (esp. randomUUID) varies by version - the app relies
// on crypto.randomUUID() throughout the store layer, so make sure it exists.
if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.randomUUID !== 'function') {
  // @ts-expect-error - Node's webcrypto is a compatible implementation for our purposes
  globalThis.crypto = webcrypto;
}

// src/lib/db/supabase.ts throws at import time if these are missing. Tests
// mock the `supabase` export directly (see src/store/__tests__/testUtils.ts)
// so the actual values never matter, they just need to exist and be a
// syntactically valid URL so createClient() doesn't throw on import.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
