import { openDB } from 'idb';

const DB_NAME = 'DriveBeatsDB';
const DB_VERSION = 1;

/**
 * Initializes and upgrades the IndexedDB database for MyGroove.
 * Stores:
 * - settings: key-value store for app configuration and player state
 * - queue: active playlist queue with ordering
 * - offlineTracks: explicitly pinned audio files stored as Blobs
 * - trackMetadata: cached audio durations and extracted tags
 * - folderHistory: recently opened Google Drive folders
 */
export async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('offlineTracks')) {
        db.createObjectStore('offlineTracks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('trackMetadata')) {
        db.createObjectStore('trackMetadata', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('folderHistory')) {
        const folderStore = db.createObjectStore('folderHistory', { keyPath: 'id' });
        folderStore.createIndex('by_lastAccessed', 'lastAccessed');
      }
    },
  });
}

/**
 * Requests the browser to mark storage as "persistent" rather than "best-effort".
 * This prevents modern browsers (Chrome, Edge, Firefox, Safari) from evicting
 * client storage (IndexedDB & localStorage) after periods of inactivity or under storage pressure.
 */
export async function requestPersistentStorage() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.info(`Storage persistence granted: ${granted}`);
        return granted;
      }
      return true;
    } catch (e) {
      console.debug('Unable to request persistent storage:', e);
      return false;
    }
  }
  return false;
}

// -------------------------------------------------------------
// Settings & State Persistence
// -------------------------------------------------------------

export async function getSetting(key, defaultValue = null) {
  try {
    const db = await getDb();
    const val = await db.get('settings', key);
    return val !== undefined ? val : defaultValue;
  } catch (error) {
    console.error(`Failed to get setting "${key}":`, error);
    return defaultValue;
  }
}

export async function setSetting(key, value) {
  try {
    const db = await getDb();
    await db.put('settings', value, key);
  } catch (error) {
    console.error(`Failed to save setting "${key}":`, error);
  }
}

export async function getAllSettings() {
  try {
    const db = await getDb();
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const keys = await store.getAllKeys();
    const values = await store.getAll();
    const settings = {};
    keys.forEach((key, index) => {
      settings[key] = values[index];
    });
    return settings;
  } catch (error) {
    console.error('Failed to load all settings:', error);
    return {};
  }
}

// -------------------------------------------------------------
// Queue Persistence
// -------------------------------------------------------------

/**
 * Saves the current playlist queue and preserves the exact order.
 * @param {Array<Object>} queueList
 */
export async function saveQueue(queueList) {
  try {
    const db = await getDb();
    const tx = db.transaction('queue', 'readwrite');
    await tx.objectStore('queue').clear();
    for (let i = 0; i < queueList.length; i++) {
      const item = { ...queueList[i], queueIndex: i };
      await tx.objectStore('queue').put(item);
    }
    await tx.done;
  } catch (error) {
    console.error('Failed to save queue to IndexedDB:', error);
  }
}

/**
 * Retrieves the saved queue sorted by user's playlist order.
 */
export async function getSavedQueue() {
  try {
    const db = await getDb();
    const items = await db.getAll('queue');
    return items.sort((a, b) => (a.queueIndex ?? 0) - (b.queueIndex ?? 0));
  } catch (error) {
    console.error('Failed to get queue from IndexedDB:', error);
    return [];
  }
}

// -------------------------------------------------------------
// Track Metadata (e.g. extracted duration)
// -------------------------------------------------------------

export async function saveTrackMetadata(id, metadata) {
  try {
    const db = await getDb();
    const existing = (await db.get('trackMetadata', id)) || {};
    await db.put('trackMetadata', {
      id,
      ...existing,
      ...metadata,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error(`Failed to save metadata for track ${id}:`, error);
  }
}

export async function getTrackMetadata(id) {
  try {
    const db = await getDb();
    return (await db.get('trackMetadata', id)) || null;
  } catch (error) {
    console.error(`Failed to get metadata for track ${id}:`, error);
    return null;
  }
}

export async function getAllTrackMetadataMap() {
  try {
    const db = await getDb();
    const all = await db.getAll('trackMetadata');
    const map = {};
    for (const item of all) {
      map[item.id] = item;
    }
    return map;
  } catch (error) {
    console.error('Failed to load track metadata map:', error);
    return {};
  }
}

// -------------------------------------------------------------
// Offline Audio Pinning (Blob Storage)
// Explicit user opt-in: audio is NOT cached automatically.
// -------------------------------------------------------------

/**
 * Saves a track's audio Blob in IndexedDB for 100% offline playback.
 */
export async function saveOfflineTrack(track, blob) {
  try {
    const db = await getDb();
    await db.put('offlineTracks', {
      id: track.id,
      name: track.name,
      mimeType: track.mimeType,
      size: blob.size || track.size,
      duration: track.duration || 0,
      thumbnailLink: track.thumbnailLink || null,
      blob,
      pinnedAt: Date.now(),
    });
    return true;
  } catch (error) {
    console.error(`Failed to pin track ${track.id} for offline:`, error);
    return false;
  }
}

/**
 * Removes a pinned audio track Blob from IndexedDB.
 */
export async function removeOfflineTrack(id) {
  try {
    const db = await getDb();
    await db.delete('offlineTracks', id);
    return true;
  } catch (error) {
    console.error(`Failed to delete offline track ${id}:`, error);
    return false;
  }
}

/**
 * Retrieves the offline track item including its audio Blob.
 */
export async function getOfflineTrack(id) {
  try {
    const db = await getDb();
    return (await db.get('offlineTracks', id)) || null;
  } catch (error) {
    console.error(`Failed to load offline track ${id}:`, error);
    return null;
  }
}

/**
 * Returns a Set of track IDs currently available offline.
 */
export async function getOfflineTrackIds() {
  try {
    const db = await getDb();
    const keys = await db.getAllKeys('offlineTracks');
    return new Set(keys);
  } catch (error) {
    console.error('Failed to retrieve offline track IDs:', error);
    return new Set();
  }
}

// -------------------------------------------------------------
// Folder History
// -------------------------------------------------------------

export async function addFolderToHistory(id, name = '🎵 My Playlist', emoji = '🎵') {
  try {
    const db = await getDb();
    const existing = await db.get('folderHistory', id);
    const finalName = name && name !== 'Shared Folder' ? name : (existing?.name || '🎵 My Playlist');
    const finalEmoji = emoji || existing?.emoji || '🎵';
    await db.put('folderHistory', {
      id,
      name: finalName,
      emoji: finalEmoji,
      lastAccessed: Date.now(),
    });
  } catch (error) {
    console.error('Failed to add folder to history:', error);
  }
}

export async function updateFolderInHistory(id, { name, emoji }) {
  try {
    const db = await getDb();
    const existing = await db.get('folderHistory', id);
    if (existing) {
      await db.put('folderHistory', {
        ...existing,
        name: name !== undefined ? name : existing.name,
        emoji: emoji !== undefined ? emoji : (existing.emoji || '🎵'),
        lastAccessed: Date.now(),
      });
    }
  } catch (error) {
    console.error('Failed to update folder in history:', error);
  }
}

export async function deleteFolderFromHistory(id) {
  try {
    const db = await getDb();
    await db.delete('folderHistory', id);
  } catch (error) {
    console.error('Failed to delete folder from history:', error);
  }
}

export async function getFolderHistory() {
  try {
    const db = await getDb();
    const all = await db.getAll('folderHistory');
    return all.sort((a, b) => b.lastAccessed - a.lastAccessed).slice(0, 15);
  } catch (error) {
    console.error('Failed to load folder history:', error);
    return [];
  }
}
