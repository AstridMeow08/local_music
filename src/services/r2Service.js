/**
 * ============================================================================
 * CLOUDFLARE R2 & DIRECT CDN AUDIO SERVICE
 * ============================================================================
 * 
 * Provides ultra-fast, zero-buffering audio streaming from Cloudflare R2 buckets,
 * S3-compatible endpoints, or any public static web host.
 * ============================================================================
 */

/**
 * Checks if the given input is an HTTP/HTTPS URL (and not a Google Drive link).
 * @param {string} input 
 * @returns {boolean}
 */
export function isDirectOrR2Url(input) {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false;
  }
  // If it's a google drive URL, it should be handled by driveApi
  if (trimmed.includes('drive.google.com') || trimmed.includes('googleapis.com')) {
    return false;
  }
  return true;
}

/**
 * Normalizes an audio MIME type from file extension.
 * @param {string} filename 
 * @returns {string}
 */
function getAudioMimeType(filename = '') {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a') || lower.endsWith('.aac')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.opus')) return 'audio/opus';
  return 'audio/mpeg';
}

/**
 * Fetches tracks from a Cloudflare R2 bucket or direct URL.
 * Automatically handles:
 * 1. Direct tracks.json URL: https://pub-xxx.r2.dev/tracks.json
 * 2. Bucket root URL: https://pub-xxx.r2.dev or https://pub-xxx.r2.dev/
 * 3. Array of filenames (["song1.mp3", "song2.mp3"])
 * 4. Array of track objects ([{ name: "...", url: "..." }])
 *
 * @param {string} inputUrl - The R2 bucket public URL or playlist URL
 * @returns {Promise<Array<Object>>} - Array of normalized track objects
 */
export async function fetchR2Tracks(inputUrl) {
  if (!inputUrl) {
    throw new Error('A valid Cloudflare R2 bucket URL or tracks.json URL is required.');
  }

  let cleanUrl = inputUrl.trim();
  let jsonUrl = cleanUrl;
  let baseFolderUrl = cleanUrl.replace(/\/+$/, '');

  if (cleanUrl.endsWith('.json')) {
    jsonUrl = cleanUrl;
    baseFolderUrl = cleanUrl.substring(0, cleanUrl.lastIndexOf('/'));
  } else {
    // Append tracks.json by default
    jsonUrl = `${baseFolderUrl}/tracks.json`;
  }

  let response;
  try {
    response = await fetch(jsonUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (netErr) {
    console.error('R2 fetch error:', netErr);
    throw new Error(
      `Could not connect to ${jsonUrl}. Please make sure you configured CORS in Cloudflare R2 bucket settings (AllowedOrigins: ["*"]).`
    );
  }

  if (!response.ok) {
    // If tracks.json was not found, check if playlist.json exists as a fallback
    if (response.status === 404 && !cleanUrl.endsWith('.json')) {
      const fallbackUrl = `${baseFolderUrl}/playlist.json`;
      try {
        const fallbackRes = await fetch(fallbackUrl);
        if (fallbackRes.ok) {
          response = fallbackRes;
        } else {
          throw new Error(
            `Could not find "tracks.json" in your bucket (${jsonUrl}). Please verify you uploaded tracks.json to your R2 bucket.`
          );
        }
      } catch (e) {
        throw new Error(
          `Could not find "tracks.json" in your bucket (${jsonUrl}). Please make sure you uploaded tracks.json to your R2 bucket.`
        );
      }
    } else {
      throw new Error(`Failed to load tracks.json (HTTP ${response.status}: ${response.statusText}).`);
    }
  }

  let data;
  try {
    data = await response.json();
  } catch (jsonErr) {
    throw new Error(`"tracks.json" is not valid JSON. Please check the file formatting.`);
  }

  // Support both raw array [...] and { tracks: [...] } or { songs: [...] }
  let rawList = [];
  if (Array.isArray(data)) {
    rawList = data;
  } else if (data && Array.isArray(data.tracks)) {
    rawList = data.tracks;
  } else if (data && Array.isArray(data.songs)) {
    rawList = data.songs;
  } else if (data && Array.isArray(data.files)) {
    rawList = data.files;
  } else {
    throw new Error(`"tracks.json" must contain an array of song filenames or song objects.`);
  }

  if (rawList.length === 0) {
    return [];
  }

  // Normalize all items into standardized track structure
  const normalizedTracks = rawList.map((item, index) => {
    if (typeof item === 'string') {
      const filename = item.trim();
      const directUrl = `${baseFolderUrl}/${encodeURIComponent(filename).replace(/%2F/g, '/')}`;
      return {
        id: `r2_${index}_${filename}`,
        name: filename,
        mimeType: getAudioMimeType(filename),
        size: null,
        url: directUrl,
        source: 'r2',
        createdTime: new Date().toISOString(),
      };
    }

    // Item is an object
    const name = item.name || item.title || item.file || `Track ${index + 1}`;
    let trackUrl = item.url || item.src || '';

    // If url is relative, resolve against baseFolderUrl
    if (trackUrl && !trackUrl.startsWith('http://') && !trackUrl.startsWith('https://')) {
      trackUrl = `${baseFolderUrl}/${trackUrl.replace(/^\/+/, '')}`;
    } else if (!trackUrl && item.file) {
      trackUrl = `${baseFolderUrl}/${encodeURIComponent(item.file).replace(/%2F/g, '/')}`;
    }

    return {
      id: item.id || `r2_${index}_${name}`,
      name: name,
      mimeType: item.mimeType || getAudioMimeType(name),
      size: item.size || null,
      thumbnailLink: item.thumbnailLink || item.cover || item.artwork || null,
      url: trackUrl,
      source: 'r2',
      createdTime: item.createdTime || new Date().toISOString(),
    };
  });

  return normalizedTracks;
}
