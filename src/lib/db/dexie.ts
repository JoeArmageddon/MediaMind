import Dexie, { type Table } from 'dexie';
import type { Media, History, SmartCollection, AppSettings, AISmartCollection } from '@/types';

export interface SyncQueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  created_at: string;
  // Number of failed sync attempts so far. Absent/0 = never tried or brand new.
  attempts?: number;
  last_error?: string;
}

// Once a queued item has failed this many times, syncWithSupabase stops
// retrying it automatically (to avoid hammering a permanently-broken write)
// but leaves it in the queue rather than dropping it, so it still counts
// toward SyncStatus.conflict_count and no data is silently lost.
export const MAX_SYNC_ATTEMPTS = 5;

export interface ApiKeyStorage {
  id: string;
  value: string;
  updated_at: string;
}

export interface AICollectionDraft {
  id: string;
  data: AISmartCollection;
  created_at: string;
}

export class MediaDatabase extends Dexie {
  media!: Table<Media, string>;
  history!: Table<History, string>;
  smartCollections!: Table<SmartCollection, string>;
  appSettings!: Table<AppSettings, number>;
  syncQueue!: Table<SyncQueueItem, string>;
  apiKeys!: Table<ApiKeyStorage, string>;
  aiCollectionDrafts!: Table<AICollectionDraft, string>;

  constructor() {
    super('MediaIntelligenceDB');

    // Version 1 - Original schema
    this.version(1).stores({
      media: 'id, title, normalized_title, type, status, is_favorite, is_archived, release_year, updated_at, *genres, *tags',
      history: 'id, media_id, created_at, action_type',
      smartCollections: 'id, title, updated_at',
      appSettings: 'id',
      syncQueue: 'id, table, operation, created_at',
    });

    // Version 2 - Add apiKeys table
    this.version(2).stores({
      media: 'id, title, normalized_title, type, status, is_favorite, is_archived, release_year, updated_at, *genres, *tags',
      history: 'id, media_id, created_at, action_type',
      smartCollections: 'id, title, updated_at',
      appSettings: 'id',
      syncQueue: 'id, table, operation, created_at',
      apiKeys: 'id',
    });

    // Version 3 - Add aiCollectionDrafts, so generated-but-unsaved AI
    // collection suggestions survive a reload instead of living only in
    // component state.
    this.version(3).stores({
      media: 'id, title, normalized_title, type, status, is_favorite, is_archived, release_year, updated_at, *genres, *tags',
      history: 'id, media_id, created_at, action_type',
      smartCollections: 'id, title, updated_at',
      appSettings: 'id',
      syncQueue: 'id, table, operation, created_at',
      apiKeys: 'id',
      aiCollectionDrafts: 'id, created_at',
    });
  }
}

// Helper functions for API keys with timeout
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  ]);
};

export const getApiKey = async (keyName: string): Promise<string> => {
  // Fast path: check localStorage first (instant)
  if (typeof window !== 'undefined') {
    const localValue = localStorage.getItem(keyName);
    if (localValue) {
      // Also try to save to IndexedDB in background
      try {
        db.apiKeys.put({
          id: keyName,
          value: localValue,
          updated_at: new Date().toISOString(),
        }).catch(() => {});
      } catch {}
      return localValue.trim();
    }
  }

  // Slow path: check IndexedDB with timeout
  try {
    const stored = await withTimeout(db.apiKeys.get(keyName), 500);
    if (stored?.value) {
      // Sync to localStorage as backup
      if (typeof window !== 'undefined') {
        localStorage.setItem(keyName, stored.value);
      }
      return stored.value.trim();
    }
  } catch (e) {
    console.warn('Error reading API key from IndexedDB:', e);
  }

  return '';
};

export const saveApiKey = async (keyName: string, value: string): Promise<void> => {
  // Trim on save too, not just on read - a key pasted with trailing
  // whitespace/newline (easy to pick up from a copy-paste) should never be
  // persisted dirty in the first place.
  const trimmed = value.trim();
  try {
    await db.apiKeys.put({
      id: keyName,
      value: trimmed,
      updated_at: new Date().toISOString(),
    });
    // Also save to localStorage as backup
    if (typeof window !== 'undefined') {
      localStorage.setItem(keyName, trimmed);
    }
  } catch (e) {
    console.warn('Error saving API key to IndexedDB:', e);
    // Fallback to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(keyName, trimmed);
    }
  }
};

export const db = new MediaDatabase();

// Initialize default settings
db.appSettings.get(1).then((settings) => {
  if (!settings) {
    db.appSettings.add({
      id: 1,
      user_id: null,
      theme: 'dark',
      grid_size: 3,
      default_view: 'grid',
      last_sync_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
});

// Export/import helper functions
export interface ExportOptions {
  // API keys are local secrets - excluded by default so a shared/backed-up
  // export file doesn't leak them. Opt in explicitly when portability
  // across devices matters more than that.
  includeApiKeys?: boolean;
}

export const exportDatabase = async (options: ExportOptions = {}): Promise<string> => {
  const [media, smartCollections, history, appSettings] = await Promise.all([
    db.media.toArray(),
    db.smartCollections.toArray(),
    db.history.toArray(),
    db.appSettings.toArray(),
  ]);

  const exportData: Record<string, unknown> = {
    version: 2,
    exported_at: new Date().toISOString(),
    media,
    smartCollections,
    history,
    appSettings,
  };

  if (options.includeApiKeys) {
    exportData.apiKeys = await db.apiKeys.toArray();
  }

  return JSON.stringify(exportData, null, 2);
};

export const importDatabase = async (jsonData: string): Promise<void> => {
  const data = JSON.parse(jsonData);

  if (data.media && Array.isArray(data.media)) {
    await db.media.clear();
    await db.media.bulkAdd(data.media);
  }

  if (data.smartCollections && Array.isArray(data.smartCollections)) {
    await db.smartCollections.clear();
    await db.smartCollections.bulkAdd(data.smartCollections);
  }

  // Both added in export v2 - older backup files simply won't have these
  // keys, and are left untouched rather than wiped.
  if (data.history && Array.isArray(data.history)) {
    await db.history.clear();
    await db.history.bulkAdd(data.history);
  }

  if (data.appSettings && Array.isArray(data.appSettings)) {
    await db.appSettings.clear();
    await db.appSettings.bulkAdd(data.appSettings);
  }

  if (data.apiKeys && Array.isArray(data.apiKeys)) {
    await db.apiKeys.clear();
    await db.apiKeys.bulkAdd(data.apiKeys);
  }
};
