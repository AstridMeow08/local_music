/**
 * Formats seconds into mm:ss or hh:mm:ss
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const paddedSecs = secs < 10 ? `0${secs}` : `${secs}`;

  if (hrs > 0) {
    const paddedMins = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }

  return `${mins}:${paddedSecs}`;
}

/**
 * Formats byte size into human readable string (KB, MB, GB)
 * @param {number|string} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (!num || isNaN(num) || num <= 0) return '';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = num;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Formats total seconds into a compact human-friendly duration for queues / playlists
 * e.g. "45 mins" or "1 hr 15 mins"
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatQueueDuration(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return '';
  const totalMins = Math.round(totalSeconds / 60);
  if (totalMins < 60) {
    return `${totalMins} min${totalMins === 1 ? '' : 's'}`;
  }
  const hrs = Math.floor(totalMins / 60);
  const remainingMins = totalMins % 60;
  if (remainingMins === 0) {
    return `${hrs} hr${hrs === 1 ? '' : 's'}`;
  }
  return `${hrs} hr ${remainingMins} min`;
}

