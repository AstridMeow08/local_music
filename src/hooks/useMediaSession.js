import { useEffect } from 'react';

/**
 * ============================================================================
 * MEDIA SESSION API & BACKGROUND / LOCK-SCREEN AUDIO HANDLING
 * ============================================================================
 * 
 * 1. Background Playback Mechanics:
 *    On modern mobile platforms (iOS Safari, Android Chrome/Firefox, Samsung Internet),
 *    audio elements playing in the background are kept alive by the browser engine
 *    ONLY IF:
 *    - Playback was initiated by a direct user gesture (tap/click).
 *    - An active audio stream is actively decoding/rendering.
 *    - The Media Session API (navigator.mediaSession) is properly registered with
 *      metadata and action handlers.
 * 
 * 2. Why Wake Lock API is NOT Used (Important Architectural Decision):
 *    The Screen Wake Lock API (`navigator.wakeLock.request('screen')`) is designed
 *    strictly to prevent the physical display from dimming or turning off (e.g.
 *    during video presentation or recipes). It DOES NOT prevent CPU suspension or
 *    background audio throttling. In fact, keeping the display awake unnecessarily
 *    drastically drains the device battery and destroys the primary mobile music
 *    listening use-case: listening with the phone screen locked inside a pocket.
 *    Therefore, we explicitly rely on standard Media Session registration and the
 *    native browser audio context.
 * 
 * 3. Handling visibilitychange:
 *    When the browser tab transitions between 'visible' and 'hidden' (e.g. user
 *    locks the phone or switches apps), mobile browsers fire visibilitychange.
 *    Some browsers aggressively throttle timers (setInterval/requestAnimationFrame)
 *    to 1Hz or pause them completely. We ensure our audio element state remains
 *    unbroken and does NOT pause or trigger artificial pause events on visibility
 *    changes.
 * ============================================================================
 */

/**
 * Parses artist and title from common filename conventions.
 * E.g.:
 * - "Artist - Song Name.mp3" -> { artist: "Artist", title: "Song Name" }
 * - "01 - Artist - Song.mp3" -> { artist: "Artist", title: "Song" }
 * - "Song.mp3" -> { artist: "MyGroove Audio", title: "Song" }
 */
export function parseAudioFilename(filename) {
  if (!filename) return { title: 'Unknown Track', artist: 'Google Drive Stream' };

  // Strip file extension
  let cleanName = filename.replace(/\.(mp3|m4a|wav|flac|aac|ogg|opus|webm)$/i, '').trim();

  // Strip track number prefix like "01. " or "01 - " or "1. "
  cleanName = cleanName.replace(/^\d+[\.\-\s_]+\s*/, '');

  // Look for "Artist - Title" separator
  if (cleanName.includes(' - ')) {
    const parts = cleanName.split(' - ');
    if (parts.length >= 2) {
      const artist = parts[0].trim();
      const title = parts.slice(1).join(' - ').trim();
      return { artist, title };
    }
  }

  // Look for "Artist _ Title"
  if (cleanName.includes(' _ ')) {
    const parts = cleanName.split(' _ ');
    if (parts.length >= 2) {
      const artist = parts[0].trim();
      const title = parts.slice(1).join(' - ').trim();
      return { artist, title };
    }
  }

  return {
    artist: 'Google Drive Audio',
    title: cleanName,
  };
}

/**
 * Upgrades Drive thumbnail URLs to higher resolution for crisp lock-screen artwork.
 */
function getEnhancedThumbnail(thumbnailLink) {
  if (!thumbnailLink) return null;
  // Google Drive thumbnails often end in '=s220'
  if (thumbnailLink.includes('=s')) {
    return thumbnailLink.replace(/=s\d+/, '=s600');
  }
  return thumbnailLink;
}

/**
 * Custom React hook that interfaces with the Web MediaSession API.
 *
 * @param {Object} params
 * @param {HTMLAudioElement|null} params.audioRef - Native HTML audio element reference
 * @param {Object|null} params.currentTrack - Currently playing track object
 * @param {boolean} params.isPlaying - Current play/pause status
 * @param {Function} params.onPlay - Trigger play
 * @param {Function} params.onPause - Trigger pause
 * @param {Function} params.onNext - Trigger next track
 * @param {Function} params.onPrevious - Trigger previous track
 * @param {Function} params.onSeekTo - Trigger seek to specific second
 */
export function useMediaSession({
  audioRef,
  currentTrack,
  isPlaying,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onSeekTo,
}) {
  // Update Media Session Metadata whenever current track changes
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const { artist, title } = parseAudioFilename(currentTrack.name);
    const enhancedThumb = getEnhancedThumbnail(currentTrack.thumbnailLink);

    // Provide multiple icon resolutions for lock-screen notification displays
    const artwork = enhancedThumb
      ? [
          { src: enhancedThumb, sizes: '96x96', type: 'image/jpeg' },
          { src: enhancedThumb, sizes: '128x128', type: 'image/jpeg' },
          { src: enhancedThumb, sizes: '192x192', type: 'image/jpeg' },
          { src: enhancedThumb, sizes: '256x256', type: 'image/jpeg' },
          { src: enhancedThumb, sizes: '512x512', type: 'image/jpeg' },
        ]
      : [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ];

    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title,
        artist,
        album: currentTrack.folderName || 'MyGroove Playlist',
        artwork,
      });
    } catch (err) {
      console.warn('Failed to update MediaMetadata:', err);
    }
  }, [currentTrack]);

  // Sync playback state with Media Session
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (err) {
      console.warn('Failed to set mediaSession playbackState:', err);
    }
  }, [isPlaying]);

  // Set action handlers (play, pause, next, prev, seek, etc.)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handleToggle = () => {
      if (isPlaying) {
        if (onPause) onPause();
      } else {
        if (onPlay) onPlay();
      }
    };

    const actionHandlers = [
      ['play', onPlay],
      ['pause', onPause],
      ['stop', onPause],
      ['toggleplaypause', handleToggle],
      ['previoustrack', onPrevious],
      ['nexttrack', onNext],
      [
        'seekto',
        (details) => {
          if (details.seekTime !== undefined && onSeekTo) {
            onSeekTo(details.seekTime);
          }
        },
      ],
      [
        'seekbackward',
        (details) => {
          if (audioRef && audioRef.currentTime !== undefined) {
            const skipTime = details.seekOffset || 10;
            const target = Math.max(0, audioRef.currentTime - skipTime);
            if (onSeekTo) onSeekTo(target);
          }
        },
      ],
      [
        'seekforward',
        (details) => {
          if (audioRef && audioRef.currentTime !== undefined) {
            const skipTime = details.seekOffset || 10;
            const target = Math.min(audioRef.duration || 0, audioRef.currentTime + skipTime);
            if (onSeekTo) onSeekTo(target);
          }
        },
      ],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (err) {
        // Some browsers don't support seekto or backward/forward
        console.debug(`MediaSession action "${action}" not supported on this platform.`);
      }
    }

    return () => {
      // Clear handlers on unmount
      for (const [action] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore
        }
      }
    };
  }, [audioRef, onPlay, onPause, onPrevious, onNext, onSeekTo]);

  // Handle visibilitychange to ensure smooth background audio continuation
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden or phone screen locked.
        // We ensure position state is updated so lock screen scrub bar stays synced.
        if (
          'mediaSession' in navigator &&
          'setPositionState' in navigator.mediaSession &&
          audioRef &&
          !isNaN(audioRef.duration) &&
          audioRef.duration > 0
        ) {
          try {
            navigator.mediaSession.setPositionState({
              duration: audioRef.duration,
              playbackRate: audioRef.playbackRate || 1.0,
              position: Math.min(audioRef.currentTime, audioRef.duration),
            });
          } catch (e) {
            // Some browsers error if position > duration
          }
        }
      } else {
        // Tab brought to foreground: re-sync state
        if (audioRef && !audioRef.paused && !isPlaying && onPlay) {
          onPlay();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [audioRef, isPlaying, onPlay]);
}
