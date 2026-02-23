import Dexie, { type Table } from 'dexie';
import type { Media, History, SmartCollection, AppSettings } from '@/types';

export interface SyncQueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  created_at: string;
}

export class MediaDatabase extends Dexie {
  media!: Table<Media, string>;
  history!: Table<History, string>;
  smartCollections!: Table<SmartCollection, string>;
  appSettings!: Table<AppSettings, number>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('MediaIntelligenceDB');
    
    this.version(1).stores({
      media: 'id, title, normalized_title, type, status, is_favorite, is_archived, release_year, updated_at, *genres, *tags',
      history: 'id, media_id, created_at, action_type',
      smartCollections: 'id, title, updated_at',
      appSettings: 'id',
      syncQueue: 'id, table, operation, created_at',
    });
  }
}

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
