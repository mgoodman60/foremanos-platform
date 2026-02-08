/**
 * Offline Store for Daily Reports
 * Uses IndexedDB via the 'idb' library for draft storage and sync queue.
 * This file is client-only — guard imports with typeof window check.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'foremanos-offline';
const DB_VERSION = 1;
const DRAFTS_STORE = 'drafts';
const SYNC_QUEUE_STORE = 'sync-queue';

interface DraftReport {
  id: string; // `${projectId}-${date}` composite key
  projectId: string;
  projectSlug: string;
  date: string;
  data: Record<string, unknown>;
  savedAt: number; // timestamp
}

interface SyncQueueItem {
  id: string; // auto-generated
  url: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body: string;
  headers: Record<string, string>;
  createdAt: number;
  retryCount: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser');
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
          const drafts = db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
          drafts.createIndex('by-project', 'projectId');
          drafts.createIndex('by-date', 'date');
        }
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

// Draft operations
export async function saveDraft(draft: Omit<DraftReport, 'savedAt'>): Promise<void> {
  const db = await getDB();
  await db.put(DRAFTS_STORE, { ...draft, savedAt: Date.now() });
}

export async function getDraft(projectId: string, date: string): Promise<DraftReport | undefined> {
  const db = await getDB();
  return db.get(DRAFTS_STORE, `${projectId}-${date}`);
}

export async function getAllDrafts(projectId?: string): Promise<DraftReport[]> {
  const db = await getDB();
  if (projectId) {
    return db.getAllFromIndex(DRAFTS_STORE, 'by-project', projectId);
  }
  return db.getAll(DRAFTS_STORE);
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(DRAFTS_STORE, id);
}

// Sync queue operations
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
  const db = await getDB();
  await db.add(SYNC_QUEUE_STORE, { ...item, createdAt: Date.now(), retryCount: 0 });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAll(SYNC_QUEUE_STORE);
}

export async function clearSynced(ids: number[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
  for (const id of ids) {
    await tx.store.delete(id);
  }
  await tx.done;
}

export async function incrementRetry(id: number): Promise<void> {
  const db = await getDB();
  const item = await db.get(SYNC_QUEUE_STORE, id);
  if (item) {
    await db.put(SYNC_QUEUE_STORE, { ...item, retryCount: item.retryCount + 1 });
  }
}

// Utility
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
