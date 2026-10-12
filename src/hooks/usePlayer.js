import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getSetting,
  setSetting,
  getAllSettings,
  saveQueue,
  getSavedQueue,
  saveTrackMetadata,
  getTrackMetadata,
  getAllTrackMetadataMap,
  saveOfflineTrack,
  removeOfflineTrack,
  getOfflineTrack,
  getOfflineTrackIds,
} from '../db/indexedDb';
import { getAudioStreamUrl, downloadAudioBlob } from '../services/driveApi';
import { useMediaSession, parseAudioFilename } from './useMediaSession';
import JSZip from 'jszip';

/**
 * ============================================================================
 * AUDIO PLAYER CORE HOOK (usePlayer)
 * ============================================================================
 * Manages audio lifecycle, IndexedDB state restoration, scrubbing with Range
 * requests, offline blob routing, and playlist queue operations.
 * ============================================================================
 */
export function usePlayer({ apiKey, onToast }) {
  const audioRef = useRef(new Audio());
  const activeBlobUrlRef = useRef(null);
  const positionSaveTimeoutRef = useRef(null);
  const fetchAbortRef = useRef(null);

  // Core Player States
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'track' | 'queue'
  const [queue, setQueue] = useState([]);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState(null);

  // Metadata & Offline Cache states
  const [trackMetadataMap, setTrackMetadataMap] = useState({});
  const [offlineIds, setOfflineIds] = useState(new Set());
  const [downloadingIds, setDownloadingIds] = useState(new Set());
  const [downloadProgress, setDownloadProgress] = useState({});
  const [bulkDownloadState, setBulkDownloadState] = useState(null);
  const bulkCancelRef = useRef(false);

  // -------------------------------------------------------------
  // Clean up object URLs
  // -------------------------------------------------------------
  const revokeActiveBlobUrl = useCallback(() => {
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
  }, []);

  // -------------------------------------------------------------
  // Initial Hydration from IndexedDB
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      try {
        const [settings, savedQueue, offlineSet, metaMap] = await Promise.all([
          getAllSettings(),
          getSavedQueue(),
          getOfflineTrackIds(),
          getAllTrackMetadataMap(),
        ]);

        if (!isMounted) return;

        if (offlineSet) setOfflineIds(offlineSet);
        if (metaMap) setTrackMetadataMap(metaMap);

        // Restore player preferences
        if (settings.volume !== undefined) {
          const v = Math.max(0, Math.min(1, settings.volume));
          setVolumeState(v);
          audioRef.current.volume = v;
        } else {
          audioRef.current.volume = 0.8;
        }

        if (settings.isMuted !== undefined) {
          setIsMuted(settings.isMuted);
          audioRef.current.muted = settings.isMuted;
        }

        if (settings.isShuffle !== undefined) {
          setIsShuffle(settings.isShuffle);
        }

        if (settings.repeatMode !== undefined) {
          setRepeatMode(settings.repeatMode);
        }

        // Restore Queue
        if (savedQueue && savedQueue.length > 0) {
          setQueue(savedQueue);

          // Restore previously playing track if present
          const lastTrackId = settings.currentTrackId;
          const trackToResume = savedQueue.find((t) => t.id === lastTrackId) || savedQueue[0];

          if (trackToResume) {
            setCurrentTrack(trackToResume);
            const savedPos = typeof settings.playbackPosition === 'number' ? settings.playbackPosition : 0;
            // Pre-seed duration from cache if available
            const cachedMeta = metaMap[trackToResume.id];
            if (cachedMeta?.duration) {
              setDuration(cachedMeta.duration);
            }
            if (savedPos > 0) {
              setCurrentTime(savedPos);
            }
          }
        }
      } catch (err) {
        console.error('Error hydrating player from IndexedDB:', err);
      }
    }

    hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  // -------------------------------------------------------------
  // Audio Element Event Listeners
  // -------------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.preload = 'auto';

    const handleLoadedMetadata = () => {
      setIsLoadingAudio(false);
      const audioDuration = audio.duration;
      if (!isNaN(audioDuration) && audioDuration > 0) {
        setDuration(audioDuration);
        if (currentTrack) {
          // Persist duration to IndexedDB
          saveTrackMetadata(currentTrack.id, { duration: audioDuration });
          setTrackMetadataMap((prev) => ({
            ...prev,
            [currentTrack.id]: { ...(prev[currentTrack.id] || {}), duration: audioDuration },
          }));
        }
      }
    };

    const handleTimeUpdate = () => {
      const pos = audio.currentTime;
      setCurrentTime(pos);

      // Debounce saving playback position to IndexedDB
      if (!positionSaveTimeoutRef.current) {
        positionSaveTimeoutRef.current = setTimeout(() => {
          setSetting('playbackPosition', pos);
          positionSaveTimeoutRef.current = null;
        }, 1500);
      }
    };

    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        setBufferedTime(bufferedEnd);
      }
    };

    const handleWaiting = () => {
      setIsLoadingAudio(true);
    };

    const handlePlaying = () => {
      setIsLoadingAudio(false);
      setIsPlaying(true);
      setAudioError(null);
    };

    const handlePause = () => {
      setIsPlaying(false);
      setSetting('playbackPosition', audio.currentTime);
    };

    const handleEnded = () => {
      handleTrackEnded();
    };

    const handleError = (e) => {
      setIsLoadingAudio(false);
      setIsPlaying(false);
      console.error('Audio playback error:', audio.error, e);

      const errCode = audio.error ? audio.error.code : 0;
      let message = 'Audio playback error occurred.';

      if (errCode === 1) message = 'Playback aborted by user.';
      else if (errCode === 2) message = 'Network connection lost during audio streaming.';
      else if (errCode === 3) message = 'Audio decoding failed. Format might not be supported.';
      else if (errCode === 4) {
        message = 'Drive file inaccessible or rate-limited. Skipping to next track...';
        if (onToast) onToast({ title: 'Stream Error', message, type: 'warning' });
        // Automatically skip to next track on stream failure
        setTimeout(() => {
          nextTrack(true);
        }, 1200);
        return;
      }

      setAudioError(message);
      if (onToast) onToast({ title: 'Playback Notice', message, type: 'error' });
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      if (positionSaveTimeoutRef.current) {
        clearTimeout(positionSaveTimeoutRef.current);
      }
    };
  }, [currentTrack, onToast]);

  // -------------------------------------------------------------
  // Queue & Track Navigation
  // -------------------------------------------------------------

  /**
   * Loads a track and begins playback.
   * If the track is stored offline in IndexedDB, plays from Blob.
   * Otherwise streams from Google Drive API with Range requests.
   */
  const playTrack = useCallback(
    async (track, newQueue = null, resumePosition = 0) => {
      if (!track) return;
      const audio = audioRef.current;
      if (!audio) return;

      setAudioError(null);
      setIsLoadingAudio(true);
      revokeActiveBlobUrl();

      // Update queue if provided
      let currentQ = queue;
      if (newQueue) {
        currentQ = newQueue;
        setQueue(newQueue);
        saveQueue(newQueue);
      } else if (!queue.some((t) => t.id === track.id)) {
        // If track is not in queue, prepend or append it
        const updated = [track, ...queue];
        currentQ = updated;
        setQueue(updated);
        saveQueue(updated);
      }

      setCurrentTrack(track);
      setSetting('currentTrackId', track.id);

      // Check if track is pinned offline
      const offlineItem = await getOfflineTrack(track.id);
      let streamSource = '';

      if (offlineItem && offlineItem.blob) {
        // 100% Offline playback from Blob (crystal clear, zero network)
        const blobUrl = URL.createObjectURL(offlineItem.blob);
        activeBlobUrlRef.current = blobUrl;
        streamSource = blobUrl;
      } else {
        // Determine remote URL
        let remoteUrl = track.url;
        if (!remoteUrl) {
          if (!apiKey) {
            setIsLoadingAudio(false);
            setAudioError('Google Cloud API key is missing. Please configure it in settings.');
            if (onToast) {
              onToast({
                title: 'API Key Required',
                message: 'Please set your Google Cloud API key in settings to stream audio.',
                type: 'warning',
              });
            }
            return;
          }
          remoteUrl = getAudioStreamUrl(track.id, apiKey);
        }

        // Direct stream: only tracks manually selected by user are saved to local storage
        streamSource = remoteUrl;
      }

      audio.src = streamSource;
      audio.load();

      if (resumePosition > 0) {
        audio.currentTime = resumePosition;
      }

      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Audio play request interrupted or requires user gesture:', err);
        setIsPlaying(false);
      } finally {
        setIsLoadingAudio(false);
      }
    },
    [queue, apiKey, revokeActiveBlobUrl, onToast]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.src && currentTrack) {
      playTrack(currentTrack, null, currentTime);
      return;
    }

    if (audio.paused) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn('Play error:', err));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [currentTrack, currentTime, playTrack]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn('Play error:', err));
    }
  }, []);

  /**
   * Advances to next track in queue with shuffle and repeat support.
   */
  const nextTrack = useCallback(
    (isAutomatic = false) => {
      if (queue.length === 0) return;

      const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);

      if (isShuffle) {
        // Random pick excluding current track if queue > 1
        const available = queue.filter((t) => t.id !== currentTrack?.id);
        const randomTrack = available[Math.floor(Math.random() * available.length)] || queue[0];
        playTrack(randomTrack);
        return;
      }

      if (currentIndex !== -1 && currentIndex + 1 < queue.length) {
        playTrack(queue[currentIndex + 1]);
      } else {
        // End of queue reached
        if (repeatMode === 'queue' || !isAutomatic) {
          playTrack(queue[0]);
        } else {
          setIsPlaying(false);
          setCurrentTime(0);
        }
      }
    },
    [queue, currentTrack, isShuffle, repeatMode, playTrack]
  );

  /**
   * Jumps to previous track or restarts current track if > 3 seconds in.
   */
  const previousTrack = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (queue.length === 0) return;

    const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
    if (currentIndex > 0) {
      playTrack(queue[currentIndex - 1]);
    } else {
      playTrack(queue[queue.length - 1]);
    }
  }, [queue, currentTrack, playTrack]);

  /**
   * Called when current track completes playback.
   */
  const handleTrackEnded = useCallback(() => {
    if (repeatMode === 'track') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.warn);
      }
    } else {
      nextTrack(true);
    }
  }, [repeatMode, nextTrack]);

  /**
   * Seeks to a specific timestamp in seconds.
   */
  const seekTo = useCallback((seconds) => {
    const audio = audioRef.current;
    if (audio && !isNaN(seconds)) {
      const clamped = Math.max(0, Math.min(seconds, audio.duration || 0));
      audio.currentTime = clamped;
      setCurrentTime(clamped);
      setSetting('playbackPosition', clamped);
    }
  }, []);

  /**
   * Updates audio volume with persistence.
   */
  const setVolume = useCallback((val) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
      if (clamped > 0 && audioRef.current.muted) {
        audioRef.current.muted = false;
        setIsMuted(false);
        setSetting('isMuted', false);
      }
    }
    setSetting('volume', clamped);
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      const nextMuted = !audioRef.current.muted;
      audioRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      setSetting('isMuted', nextMuted);
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const next = !prev;
      setSetting('isShuffle', next);
      if (onToast) {
        onToast({
          title: next ? 'Shuffle ON' : 'Shuffle OFF',
          message: next ? 'Playback will jump randomly between tracks' : 'Playback will follow normal playlist order',
          type: 'info',
        });
      }
      return next;
    });
  }, [onToast]);

  /**
   * Shuffles an array of tracks using Fisher-Yates algorithm.
   */
  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  /**
   * Starts playing a track list in shuffle mode immediately.
   * Shuffles the playlist, sets isShuffle = true, and begins playing the first track.
   */
  const shufflePlay = useCallback(
    (trackList) => {
      const list = trackList && trackList.length > 0 ? trackList : queue;
      if (!list || list.length === 0) {
        if (onToast) onToast({ title: 'No Tracks', message: 'No tracks available to shuffle.', type: 'warning' });
        return;
      }

      // Ensure shuffle is enabled
      setIsShuffle(true);
      setSetting('isShuffle', true);

      // Randomize tracks
      const randomized = shuffleArray(list);

      // Update queue and play first random track
      setQueue(randomized);
      saveQueue(randomized);
      playTrack(randomized[0], randomized);

      if (onToast) {
        onToast({
          title: 'Shuffle Play Started',
          message: `Randomized ${randomized.length} tracks. Starting with "${randomized[0].name}"`,
          type: 'success',
        });
      }
    },
    [queue, playTrack, onToast]
  );

  /**
   * Randomizes the current queue while keeping the currently playing track intact.
   */
  const shuffleQueue = useCallback(() => {
    if (queue.length < 2) return;

    let updated;
    const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);

    if (currentIndex !== -1) {
      const current = queue[currentIndex];
      const others = queue.filter((_, idx) => idx !== currentIndex);
      updated = [current, ...shuffleArray(others)];
    } else {
      updated = shuffleArray(queue);
    }

    setQueue(updated);
    saveQueue(updated);

    if (onToast) {
      onToast({
        title: 'Queue Randomized',
        message: 'Upcoming tracks have been shuffled.',
        type: 'info',
      });
    }
  }, [queue, currentTrack, onToast]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      const modes = ['off', 'queue', 'track'];
      const nextIndex = (modes.indexOf(prev) + 1) % modes.length;
      const next = modes[nextIndex];
      setSetting('repeatMode', next);
      return next;
    });
  }, []);

  // -------------------------------------------------------------
  // Queue Management Functions
  // -------------------------------------------------------------

  const addToQueue = useCallback(
    (track) => {
      if (!currentTrack && queue.length === 0) {
        playTrack(track, [track]);
        if (onToast) {
          const { title } = parseAudioFilename(track.name);
          onToast({ title: 'Playing Now', message: `"${title}"`, type: 'success' });
        }
        return;
      }

      setQueue((prev) => {
        let baseList = [...prev];
        // Ensure currentTrack is represented in queue order
        if (currentTrack && !baseList.some((t) => t.id === currentTrack.id)) {
          baseList = [currentTrack, ...baseList];
        }

        const existingIndex = baseList.findIndex((t) => t.id === track.id);
        const { title } = parseAudioFilename(track.name);

        if (existingIndex !== -1) {
          // If already in queue, bump to end
          const without = baseList.filter((t) => t.id !== track.id);
          const next = [...without, track];
          saveQueue(next);
          if (onToast) {
            onToast({
              title: 'Moved to End of Queue',
              message: `"${title}" moved to position #${next.length}`,
              type: 'info',
            });
          }
          return next;
        }

        const next = [...baseList, track];
        saveQueue(next);
        if (onToast) {
          onToast({
            title: 'Added to Queue',
            message: `"${title}" added as #${next.length} in queue`,
            type: 'success',
          });
        }
        return next;
      });
    },
    [currentTrack, queue.length, playTrack, onToast]
  );

  const playNextInQueue = useCallback(
    (track) => {
      if (!currentTrack) {
        playTrack(track, [track]);
        if (onToast) {
          const { title } = parseAudioFilename(track.name);
          onToast({ title: 'Playing Now', message: `"${title}"`, type: 'success' });
        }
        return;
      }

      setQueue((prev) => {
        let baseList = [...prev];
        // Ensure currentTrack is in queue
        if (!baseList.some((t) => t.id === currentTrack.id)) {
          baseList = [currentTrack, ...baseList];
        }

        // Remove track if already in queue so we can place it as next
        const without = baseList.filter((t) => t.id !== track.id);
        const currentIndex = without.findIndex((t) => t.id === currentTrack.id);
        const insertAt = currentIndex !== -1 ? currentIndex + 1 : 1;

        without.splice(insertAt, 0, track);
        saveQueue(without);

        if (onToast) {
          const { title } = parseAudioFilename(track.name);
          onToast({
            title: 'Playing Next',
            message: `"${title}" will play immediately after the current song.`,
            type: 'success',
          });
        }
        return without;
      });
    },
    [currentTrack, playTrack, onToast]
  );

  const addMultipleToQueue = useCallback(
    (tracksList) => {
      if (!tracksList || tracksList.length === 0) return;

      if (!currentTrack && queue.length === 0) {
        playTrack(tracksList[0], tracksList);
        if (onToast) {
          onToast({
            title: 'Playing First Song',
            message: `Started playback and queued ${tracksList.length} tracks.`,
            type: 'success',
          });
        }
        return;
      }

      setQueue((prev) => {
        let baseList = [...prev];
        if (currentTrack && !baseList.some((t) => t.id === currentTrack.id)) {
          baseList = [currentTrack, ...baseList];
        }

        const existingIds = new Set(baseList.map((t) => t.id));
        const newTracks = tracksList.filter((t) => !existingIds.has(t.id));
        const next = [...baseList, ...newTracks];
        saveQueue(next);

        if (onToast) {
          onToast({
            title: 'Queue Updated',
            message: `Queued ${newTracks.length} new tracks (${next.length} total).`,
            type: 'success',
          });
        }
        return next;
      });
    },
    [currentTrack, queue.length, playTrack, onToast]
  );

  const playNextMultiple = useCallback(
    (tracksList) => {
      if (!tracksList || tracksList.length === 0) return;

      if (!currentTrack && queue.length === 0) {
        playTrack(tracksList[0], tracksList);
        return;
      }

      setQueue((prev) => {
        let baseList = [...prev];
        if (currentTrack && !baseList.some((t) => t.id === currentTrack.id)) {
          baseList = [currentTrack, ...baseList];
        }

        const insertIds = new Set(tracksList.map((t) => t.id));
        const without = baseList.filter((t) => !insertIds.has(t.id));
        const currentIndex = without.findIndex((t) => t.id === currentTrack?.id);
        const insertAt = currentIndex !== -1 ? currentIndex + 1 : 1;

        without.splice(insertAt, 0, ...tracksList);
        saveQueue(without);

        if (onToast) {
          onToast({
            title: 'Playing Next',
            message: `Added ${tracksList.length} tracks to play next in queue.`,
            type: 'success',
          });
        }
        return without;
      });
    },
    [currentTrack, queue.length, playTrack, onToast]
  );

  const moveQueueItem = useCallback((fromIndex, toIndex) => {
    setQueue((prev) => {
      if (toIndex < 0 || toIndex >= prev.length || fromIndex < 0 || fromIndex >= prev.length) {
        return prev;
      }
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      saveQueue(updated);
      return updated;
    });
  }, []);

  const clearUpcomingQueue = useCallback(() => {
    setQueue((prev) => {
      if (!currentTrack) {
        saveQueue([]);
        return [];
      }
      const next = [currentTrack];
      saveQueue(next);
      if (onToast) {
        onToast({
          title: 'Upcoming Cleared',
          message: 'Cleared all upcoming songs. Current track will keep playing.',
          type: 'info',
        });
      }
      return next;
    });
  }, [currentTrack, onToast]);

  const removeFromQueue = useCallback(
    (trackId) => {
      setQueue((prev) => {
        const next = prev.filter((t) => t.id !== trackId);
        saveQueue(next);
        return next;
      });
    },
    []
  );

  const clearQueue = useCallback(() => {
    setQueue([]);
    saveQueue([]);
    if (onToast) onToast({ title: 'Queue Cleared', message: 'All tracks removed from queue.', type: 'info' });
  }, [onToast]);

  const reorderQueue = useCallback((newQueue) => {
    setQueue(newQueue);
    saveQueue(newQueue);
  }, []);

  // -------------------------------------------------------------
  // Offline Pinning Actions (explicit user opt-in)
  // -------------------------------------------------------------

  const pinTrackForOffline = useCallback(
    async (track) => {
      if (!track.url && !apiKey) {
        if (onToast) {
          onToast({
            title: 'API Key Required',
            message: 'An API key is required to download Google Drive tracks for offline use.',
            type: 'warning',
          });
        }
        return;
      }

      setDownloadingIds((prev) => new Set([...prev, track.id]));
      setDownloadProgress((prev) => ({ ...prev, [track.id]: 0 }));

      try {
        let blob;
        if (track.url) {
          // Direct fetch for Cloudflare R2 / CDN tracks
          const res = await fetch(track.url);
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          blob = await res.blob();
        } else {
          blob = await downloadAudioBlob(track.id, apiKey, (pct) => {
            setDownloadProgress((prev) => ({ ...prev, [track.id]: pct }));
          });
        }

        await saveOfflineTrack(track, blob);
        setOfflineIds((prev) => new Set([...prev, track.id]));
        if (onToast) {
          onToast({
            title: 'Pinned for Offline',
            message: `"${track.name}" is now stored locally and playable without internet!`,
            type: 'success',
          });
        }
      } catch (err) {
        console.error('Download offline track error:', err);
        if (onToast) {
          onToast({
            title: 'Offline Save Failed',
            message: err.message || 'Unable to download track.',
            type: 'error',
          });
        }
      } finally {
        setDownloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(track.id);
          return next;
        });
      }
    },
    [apiKey, onToast]
  );

  const unpinTrackOffline = useCallback(
    async (trackId, trackName) => {
      await removeOfflineTrack(trackId);
      setOfflineIds((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
      if (onToast) {
        onToast({
          title: 'Removed Offline Pin',
          message: `"${trackName || 'Track'}" was removed from offline storage.`,
          type: 'info',
        });
      }
    },
    [onToast]
  );

  // -------------------------------------------------------------
  // Bulk Download & Export Operations
  // -------------------------------------------------------------
  const bulkPinOffline = useCallback(
    async (trackList) => {
      if (!trackList || trackList.length === 0) return;

      const unpinned = trackList.filter((t) => !offlineIds.has(t.id));
      if (unpinned.length === 0) {
        if (onToast) {
          onToast({
            title: 'Already Offline',
            message: 'All songs in this list are already saved to offline storage.',
            type: 'info',
          });
        }
        return;
      }

      bulkCancelRef.current = false;
      const total = unpinned.length;
      let completed = 0;

      setBulkDownloadState({
        type: 'offline',
        current: 0,
        total,
        percent: 0,
        activeName: unpinned[0].name,
      });

      for (let i = 0; i < unpinned.length; i++) {
        if (bulkCancelRef.current) break;

        const track = unpinned[i];
        setBulkDownloadState({
          type: 'offline',
          current: i + 1,
          total,
          percent: Math.round(((i + 1) / total) * 100),
          activeName: track.name,
        });

        try {
          let blob;
          if (track.url) {
            const res = await fetch(track.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            blob = await res.blob();
          } else if (apiKey) {
            blob = await downloadAudioBlob(track.id, apiKey);
          } else {
            continue;
          }

          await saveOfflineTrack(track, blob);
          setOfflineIds((prev) => new Set([...prev, track.id]));
          completed++;
        } catch (err) {
          console.warn(`Failed to bulk download ${track.name}:`, err);
        }
      }

      setBulkDownloadState(null);

      if (onToast) {
        if (bulkCancelRef.current) {
          onToast({
            title: 'Download Stopped',
            message: `Stopped. Downloaded ${completed} of ${total} songs.`,
            type: 'info',
          });
        } else {
          onToast({
            title: 'Bulk Download Complete',
            message: `Successfully saved ${completed} songs to local offline storage!`,
            type: 'success',
          });
        }
      }
    },
    [apiKey, offlineIds, onToast]
  );

  const bulkExportZip = useCallback(
    async (trackList, zipFilename = 'MyGroove_Music.zip') => {
      if (!trackList || trackList.length === 0) return;

      bulkCancelRef.current = false;
      const zip = new JSZip();
      const total = trackList.length;
      let added = 0;

      setBulkDownloadState({
        type: 'zip',
        current: 0,
        total,
        percent: 0,
        activeName: trackList[0].name,
      });

      for (let i = 0; i < trackList.length; i++) {
        if (bulkCancelRef.current) break;

        const track = trackList[i];
        setBulkDownloadState({
          type: 'zip',
          current: i + 1,
          total,
          percent: Math.round(((i + 1) / total) * 90),
          activeName: track.name,
        });

        try {
          let blob;
          // Reuse existing blob from IndexedDB if already downloaded
          const offlineItem = await getOfflineTrack(track.id);
          if (offlineItem && offlineItem.blob) {
            blob = offlineItem.blob;
          } else if (track.url) {
            const res = await fetch(track.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            blob = await res.blob();
          } else if (apiKey) {
            blob = await downloadAudioBlob(track.id, apiKey);
          }

          if (blob) {
            const safeName = track.name.replace(/[\\/:*?"<>|]/g, '_');
            zip.file(safeName, blob);
            added++;
          }
        } catch (err) {
          console.warn(`Failed to add ${track.name} to zip:`, err);
        }
      }

      if (bulkCancelRef.current) {
        setBulkDownloadState(null);
        if (onToast) {
          onToast({
            title: 'Export Cancelled',
            message: 'Cancelled ZIP creation.',
            type: 'info',
          });
        }
        return;
      }

      setBulkDownloadState({
        type: 'zip',
        current: total,
        total,
        percent: 95,
        activeName: 'Compressing into ZIP file...',
      });

      try {
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        });

        // Trigger browser file download
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        if (onToast) {
          onToast({
            title: 'ZIP Export Complete',
            message: `Downloaded ${added} songs inside "${zipFilename}".`,
            type: 'success',
          });
        }
      } catch (zipErr) {
        console.error('Failed to generate ZIP:', zipErr);
        if (onToast) {
          onToast({
            title: 'ZIP Error',
            message: 'Failed to create zip file.',
            type: 'error',
          });
        }
      } finally {
        setBulkDownloadState(null);
      }
    },
    [apiKey, onToast]
  );

  const cancelBulkDownload = useCallback(() => {
    bulkCancelRef.current = true;
  }, []);

  // -------------------------------------------------------------
  // Register Media Session API Hook
  // -------------------------------------------------------------
  const handleMediaNext = useCallback(() => {
    nextTrack(false);
  }, [nextTrack]);

  useMediaSession({
    audioRef: audioRef.current,
    currentTrack,
    isPlaying,
    onPlay: play,
    onPause: pause,
    onNext: handleMediaNext,
    onPrevious: previousTrack,
    onSeekTo: seekTo,
  });

  return {
    audioRef: audioRef.current,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    bufferedTime,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    queue,
    isLoadingAudio,
    audioError,
    trackMetadataMap,
    offlineIds,
    downloadingIds,
    downloadProgress,
    bulkDownloadState,
    playTrack,
    togglePlay,
    play,
    pause,
    nextTrack: () => nextTrack(false),
    previousTrack,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    shufflePlay,
    shuffleQueue,
    cycleRepeat,
    addToQueue,
    playNextInQueue,
    addMultipleToQueue,
    playNextMultiple,
    moveQueueItem,
    clearUpcomingQueue,
    removeFromQueue,
    clearQueue,
    reorderQueue,
    pinTrackForOffline,
    unpinTrackOffline,
    bulkPinOffline,
    bulkExportZip,
    cancelBulkDownload,
  };
}
