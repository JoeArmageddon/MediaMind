import Dexie, { type Table } from 'dexie';
import type { Media, History, SmartCollection, AppSettings } from '@/types';

export interface SyncQueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  created_at: string;
}

export interface ApiKeyStorage {
  id: string;
  value: string;
  updated_at: string;
}

export class MediaDatabase extends Dexie {
  media!: Table<Media, string>;
  history!: Table<History, string>;
  smartCollections!: Table<SmartCollection, string>;
  appSettings!: Table<AppSettings, number>;
  syncQueue!: Table<SyncQueueItem, string>;
  apiKeys!: Table<ApiKeyStorage, string>;

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
      return localValue;
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
      return stored.value;
    }
  } catch (e) {
    console.warn('Error reading API key from IndexedDB:', e);
  }
  
  return '';
};

export const saveApiKey = async (keyName: string, value: string): Promise<void> => {
  try {
    await db.apiKeys.put({
      id: keyName,
      value,
      updated_at: new Date().toISOString(),
    });
    // Also save to localStorage as backup
    if (typeof window !== 'undefined') {
      localStorage.setItem(keyName, value);
    }
  } catch (e) {
    console.warn('Error saving API key to IndexedDB:', e);
    // Fallback to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(keyName, value);
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

// Export helper functions
export const exportDatabase = async (): Promise<string> => {
  const media = await db.media.toArray();
  const smartCollections = await db.smartCollections.toArray();
  
  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    media,
    smartCollections,
  };
  
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
};
