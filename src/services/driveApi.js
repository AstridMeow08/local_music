/**
 * ============================================================================
 * GOOGLE DRIVE CLIENT-SIDE API SERVICE
 * ============================================================================
 * 
 * ARCHITECTURE & ACCESS MODEL:
 * 1. No OAuth / No Backend:
 *    This service connects directly from the browser to Google Drive API v3.
 *    It uses a Google Cloud API Key rather than OAuth2 user authentication.
 * 
 * 2. Why API Keys are Safe Here:
 *    The API key in Google Cloud Console is strictly constrained:
 *    - API restriction: Google Drive API only
 *    - Application restriction: HTTP Referrers (only your deployed domain and localhost)
 *    Because the key can only be used by requests originating from your domain,
 *    and cannot perform writes without user credentials, it is safe in frontend code.
 * 
 * 3. Public Folders Requirement:
 *    The API key access model ONLY allows reading files and folders explicitly shared
 *    as "Anyone with the link can view". Private files will return HTTP 403 Forbidden.
 * 
 * 4. Token Expiration:
 *    Unlike OAuth tokens which expire every 60 minutes and require refresh flows,
 *    public share links and API keys do NOT expire. Once a folder is loaded, playback
 *    streams can continue uninterrupted indefinitely unless the file owner modifies
 *    permissions or deletes the file.
 * ============================================================================
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

/**
 * Extracts a Google Drive folder ID from various URL formats or returns the raw ID.
 * Examples:
 * - https://drive.google.com/drive/folders/12345AbcDEfG?usp=sharing
 * - https://drive.google.com/drive/u/1/folders/12345AbcDEfG
 * - https://drive.google.com/open?id=12345AbcDEfG
 * - 12345AbcDEfG (raw ID)
 *
 * @param {string} input - URL or raw folder ID
 * @returns {string|null} - Parsed folder ID or null if invalid
 */
export function extractFolderId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Pattern 1: /folders/ID
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }

  // Pattern 2: id=ID
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }

  // Pattern 3: Raw ID (typically 25 to 45 alphanumeric characters, dashes, and underscores)
  if (/^[a-zA-Z0-9_-]{15,50}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Builds the direct audio streaming URL for a given file ID.
 * Supports HTTP Range requests directly from Google Drive API servers.
 *
 * @param {string} fileId - The Google Drive file ID
 * @param {string} apiKey - The Google Cloud API key
 * @returns {string} - Stream URL
 */
export function getAudioStreamUrl(fileId, apiKey) {
  return `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`;
}

/**
 * Fetches audio files inside a Google Drive folder with automatic pagination
 * and exponential backoff retry on rate-limiting (403/429).
 *
 * @param {string} folderId - Target folder ID
 * @param {string} apiKey - Google Cloud API key
 * @param {Object} options - Optional callbacks & settings
 * @returns {Promise<Array<Object>>} - Array of file objects
 */
export async function fetchAudioFilesFromFolder(folderId, apiKey, options = {}) {
  if (!folderId) throw new Error('A valid Google Drive folder ID is required.');
  if (!apiKey) throw new Error('A Google Cloud API key is required. Please configure your API key in Settings or in the Add Playlist dialog.');

  // Automatically extract raw folder ID if a full Google Drive URL was provided
  const cleanFolderId = extractFolderId(folderId) || folderId.trim();

  const allFiles = [];
  let pageToken = null;
  const pageSize = 100;

  // We query for files whose parent is the folder, not in trash,
  // and either mimeType contains 'audio/' or common audio file extensions
  const query = `'${cleanFolderId}' in parents and trashed = false and (mimeType contains 'audio/' or name contains '.mp3' or name contains '.m4a' or name contains '.wav' or name contains '.flac' or name contains '.aac' or name contains '.ogg' or name contains '.opus')`;

  do {
    let url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}&pageSize=${pageSize}&fields=nextPageToken,files(id,name,mimeType,thumbnailLink,size,createdTime)&orderBy=name`;
    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const data = await fetchWithRetry(url, {
      maxRetries: options.maxRetries || 3,
      onRetry: options.onRetry,
    });

    if (data.files && Array.isArray(data.files)) {
      allFiles.push(...data.files);
    }

    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return allFiles;
}

/**
 * Fetches metadata for a single Drive file (or folder) to verify access.
 *
 * @param {string} fileId - File or folder ID
 * @param {string} apiKey - Google Cloud API key
 * @returns {Promise<Object>}
 */
export async function fetchFileMetadata(fileId, apiKey) {
  const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?key=${encodeURIComponent(apiKey)}&fields=id,name,mimeType,description`;
  return await fetchWithRetry(url);
}

/**
 * Downloads full audio content as a Blob for offline caching.
 * Explicit user action ("pin for offline").
 *
 * @param {string} fileId - Drive file ID
 * @param {string} apiKey - API key
 * @param {Function} [onProgress] - Optional progress callback
 * @returns {Promise<Blob>}
 */
export async function downloadAudioBlob(fileId, apiKey, onProgress) {
  const url = getAudioStreamUrl(fileId, apiKey);
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Access denied (403). Ensure the file is shared as "Anyone with the link".');
    }
    if (response.status === 404) {
      throw new Error('File not found (404). It may have been deleted or moved.');
    }
    throw new Error(`Failed to download audio (${response.status} ${response.statusText})`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body || !total) {
    // Fallback if ReadableStream is not available
    return await response.blob();
  }

  const reader = response.body.getReader();
  const chunks = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedBytes += value.length;
    if (onProgress && total > 0) {
      onProgress(Math.min(100, Math.round((receivedBytes / total) * 100)));
    }
  }

  const contentType = response.headers.get('content-type') || 'audio/mpeg';
  return new Blob(chunks, { type: contentType });
}

/**
 * Fetch helper with automatic exponential backoff retry on HTTP 403/429/5xx.
 *
 * @param {string} url
 * @param {Object} options
 * @returns {Promise<any>}
 */
async function fetchWithRetry(url, { maxRetries = 3, onRetry } = {}) {
  let attempt = 0;
  let delay = 1000; // start with 1 second

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url);

      if (res.ok) {
        return await res.json();
      }

      // Check for rate-limiting or temporary errors
      const isRateLimited = res.status === 429 || (res.status === 403 && attempt < maxRetries);
      const isServerError = res.status >= 500 && res.status < 600;

      if ((isRateLimited || isServerError) && attempt < maxRetries) {
        attempt++;
        const jitter = Math.random() * 300;
        const waitTime = delay + jitter;
        if (onRetry) {
          onRetry({ attempt, maxRetries, waitTime, status: res.status });
        }
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        delay *= 2; // exponential backoff
        continue;
      }

      let errorMsg = `Google Drive API error (${res.status} ${res.statusText})`;
      try {
        const errorJson = await res.json();
        if (errorJson?.error?.message) {
          errorMsg = errorJson.error.message;
        }
      } catch {
        // Response wasn't JSON
      }

      if (res.status === 404) {
        throw new Error('Folder or file not found (404). Check the ID or share link.');
      } else if (res.status === 403) {
        throw new Error(`Google Drive API 403: ${errorMsg}. Verify the folder is shared as "Anyone with the link" and your API key has Drive API enabled.`);
      } else {
        throw new Error(errorMsg);
      }
    } catch (err) {
      if (attempt >= maxRetries || !err.message.includes('Google Drive API error')) {
        throw err;
      }
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  throw new Error('Maximum retry attempts exceeded.');
}
