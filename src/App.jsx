import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { PlaylistBar } from './components/PlaylistBar';
import { AddPlaylistModal } from './components/AddPlaylistModal';
import { Library } from './components/Library';
import { Player } from './components/Player';
import { Queue } from './components/Queue';
import { SettingsModal } from './components/SettingsModal';
import { EditPlaylistModal } from './components/EditPlaylistModal';
import { ToastContainer } from './components/Toast';
import { PwaUpdateToast } from './components/PwaUpdateToast';
import { usePlayer } from './hooks/usePlayer';
import {
  fetchAudioFilesFromFolder,
  getAudioStreamUrl,
  extractFolderId,
} from './services/driveApi';
import {
  isDirectOrR2Url,
  fetchR2Tracks,
} from './services/r2Service';
import {
  getSetting,
  setSetting,
  addFolderToHistory,
  getFolderHistory,
  updateFolderInHistory,
  deleteFolderFromHistory,
  getOfflineTrackIds,
  removeOfflineTrack,
  getDb,
  requestPersistentStorage,
} from './db/indexedDb';
import {
  extractLeadingEmoji,
  cleanPlaylistTitle,
  generateDefaultPlaylistName,
} from './utils/iosEmojis';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function App() {
  // Application State — Stored locally in IndexedDB / Browser storage
  const [apiKey, setApiKey] = useState(() => {
    try {
      const local =
        localStorage.getItem('mygroove_api_key') ||
        localStorage.getItem('drivebeats_api_key');
      if (local) return local;
    } catch {}
    return '';
  });

  const [currentFolderId, setCurrentFolderId] = useState(() => {
    try {
      const local =
        localStorage.getItem('mygroove_last_folder') ||
        localStorage.getItem('drivebeats_last_folder');
      if (local) return local;
    } catch {}
    return '';
  });

  const [currentPlaylistName, setCurrentPlaylistName] = useState(() => {
    try {
      return localStorage.getItem('mygroove_last_playlist_name') || '';
    } catch {
      return '';
    }
  });

  const [currentPlaylistEmoji, setCurrentPlaylistEmoji] = useState(() => {
    try {
      return localStorage.getItem('mygroove_last_playlist_emoji') || '🎧';
    } catch {
      return '🎧';
    }
  });

  const [activeEditPlaylist, setActiveEditPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [folderHistory, setFolderHistory] = useState([]);
  const [folderError, setFolderError] = useState(null);
  const [retryState, setRetryState] = useState(null);

  // Modals & Panels
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddPlaylistOpen, setIsAddPlaylistOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Theme Management ('light' | 'dark')
  const [theme, setTheme] = useState(() => {
    try {
      const saved =
        localStorage.getItem('mygroove_theme') ||
        localStorage.getItem('drivebeats_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', '#0d1117');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', '#ffffff');
    }
    try {
      localStorage.setItem('mygroove_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Toast Notification Helpers (Automatically removed after 5 seconds of display)
  const showToast = useCallback(({ title, message, type = 'info', duration = 5000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    const toastDuration = duration || 5000;
    setToasts((prev) => [...prev, { id, title, message, type, duration: toastDuration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toastDuration);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Initialize Audio Player Hook
  const player = usePlayer({
    apiKey,
    onToast: showToast,
  });

  // Dynamically enforce browser tab title to MyGroove
  useEffect(() => {
    if (player.isPlaying && player.currentTrack?.name) {
      document.title = `▶ ${cleanPlaylistTitle(player.currentTrack.name)} • MyGroove`;
    } else {
      document.title = 'MyGroove — Cloud Music Player';
    }
  }, [player.isPlaying, player.currentTrack]);

  // Load Initial Settings & History from IndexedDB
  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        await requestPersistentStorage();

        const [savedKey, lastFolder, history] = await Promise.all([
          getSetting('apiKey'),
          getSetting('lastFolderId'),
          getFolderHistory(),
        ]);

        if (!isMounted) return;

        // Resolve API key from IndexedDB or localStorage
        let effectiveKey = savedKey;
        if (!effectiveKey) {
          try {
            effectiveKey =
              localStorage.getItem('mygroove_api_key') ||
              localStorage.getItem('drivebeats_api_key') ||
              '';
          } catch {}
          if (effectiveKey) {
            setSetting('apiKey', effectiveKey).catch(console.warn);
          }
        }

        if (effectiveKey) {
          setApiKey(effectiveKey);
        }

        if (history && history.length > 0) {
          setFolderHistory(history);
        }

        // Resolve last accessed playlist folder or fallback to first history playlist
        let effectiveFolder = lastFolder;
        if (!effectiveFolder) {
          try {
            effectiveFolder =
              localStorage.getItem('mygroove_last_folder') ||
              localStorage.getItem('drivebeats_last_folder') ||
              '';
          } catch {}
        }

        if (!effectiveFolder && history && history.length > 0) {
          effectiveFolder = history[0].id;
        }

        if (effectiveFolder) {
          setCurrentFolderId(effectiveFolder);
          try {
            localStorage.setItem('mygroove_last_folder', effectiveFolder);
          } catch {}
          setSetting('lastFolderId', effectiveFolder).catch(console.warn);

          // Resolve saved playlist name & emoji
          let savedName = '';
          let savedEmoji = '🎧';
          if (history) {
            const match = history.find((f) => f.id === effectiveFolder);
            if (match) {
              savedEmoji = match.emoji || extractLeadingEmoji(match.name) || '🎧';
              savedName = cleanPlaylistTitle(match.name, savedEmoji);
            }
          }
          if (!savedName) {
            const smart = generateDefaultPlaylistName(effectiveFolder);
            savedName = smart.name;
            savedEmoji = smart.emoji;
          }
          setCurrentPlaylistName(savedName);
          setCurrentPlaylistEmoji(savedEmoji);

          // Automatically load songs from the folder or bucket into the UI
          // Audio files are streamed on-demand and are NOT downloaded automatically
          if (isDirectOrR2Url(effectiveFolder) || effectiveKey) {
            loadFolderFiles(effectiveFolder, effectiveKey, savedName, savedEmoji);
          }
        }
      } catch (err) {
        console.error('Failed to load initial settings from IndexedDB:', err);
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // -------------------------------------------------------------
  // Load Audio Files from Google Drive Folder OR Cloudflare R2 Bucket
  // -------------------------------------------------------------
  const loadFolderFiles = useCallback(
    async (sourceInput, keyToUse = null, customName = null, emoji = null) => {
      if (!sourceInput) return;

      setIsLoadingTracks(true);
      setFolderError(null);
      setRetryState(null);

      // Determine resolved custom playlist name & iOS emoji
      let resolvedName = customName;
      let resolvedEmoji = emoji;

      if (!resolvedName) {
        const existing = folderHistory.find((f) => f.id === sourceInput);
        if (existing) {
          resolvedEmoji = existing.emoji || extractLeadingEmoji(existing.name) || '🎵';
          resolvedName = cleanPlaylistTitle(existing.name, resolvedEmoji);
        } else {
          const smart = generateDefaultPlaylistName(sourceInput);
          resolvedName = smart.name;
          resolvedEmoji = smart.emoji;
        }
      } else {
        const extracted = extractLeadingEmoji(resolvedName);
        if (extracted && !resolvedEmoji) {
          resolvedEmoji = extracted;
        }
        resolvedName = cleanPlaylistTitle(resolvedName, resolvedEmoji);
      }

      resolvedEmoji = resolvedEmoji || '🎵';

      setCurrentPlaylistName(resolvedName);
      setCurrentPlaylistEmoji(resolvedEmoji);
      try {
        localStorage.setItem('mygroove_last_playlist_name', resolvedName);
        localStorage.setItem('mygroove_last_playlist_emoji', resolvedEmoji);
      } catch {}

      const playlistDisplayName = `${resolvedEmoji} ${resolvedName}`;

      // Check if user is loading a Cloudflare R2 bucket or direct web URL
      if (isDirectOrR2Url(sourceInput)) {
        try {
          const rawFiles = await fetchR2Tracks(sourceInput);
          const files = rawFiles.map((f) => ({
            ...f,
            folderName: playlistDisplayName,
          }));
          setTracks(files);
          setCurrentFolderId(sourceInput);
          try {
            localStorage.setItem('mygroove_last_folder', sourceInput);
          } catch {}
          setSetting('lastFolderId', sourceInput);
          await addFolderToHistory(sourceInput, resolvedName, resolvedEmoji);
          const updatedHistory = await getFolderHistory();
          setFolderHistory(updatedHistory);

          if (files.length === 0) {
            showToast({
              title: 'No Songs in R2 Bucket',
              message: 'Your tracks.json file was loaded, but contains no song entries.',
              type: 'info',
            });
          } else {
            showToast({
              title: `${resolvedEmoji} ${resolvedName} Connected`,
              message: `Loaded ${files.length} songs from Cloudflare R2`,
              type: 'success',
            });
          }
        } catch (err) {
          console.error('Failed to fetch from R2:', err);
          setFolderError(err.message || 'Failed to connect to Cloudflare R2 bucket.');
          showToast({
            title: 'R2 Bucket Error',
            message: err.message || 'Unable to connect to R2 bucket.',
            type: 'error',
          });
        } finally {
          setIsLoadingTracks(false);
        }
        return;
      }

      // Otherwise, load from Google Drive API
      const activeKey = keyToUse || apiKey;

      if (!activeKey) {
        setIsLoadingTracks(false);
        showToast({
          title: 'Google API Key Needed',
          message: 'Please set your Google Cloud API key in settings to list and play songs.',
          type: 'warning',
        });
        setIsSettingsOpen(true);
        return;
      }

      const folderIdToFetch = extractFolderId(sourceInput) || sourceInput.trim();

      try {
        const rawFiles = await fetchAudioFilesFromFolder(folderIdToFetch, activeKey, {
          maxRetries: 3,
          onRetry: ({ attempt, maxRetries, waitTime }) => {
            setRetryState({ attempt, maxRetries, waitSeconds: Math.round(waitTime / 1000) });
          },
        });

        const files = rawFiles.map((f) => ({
          ...f,
          folderName: playlistDisplayName,
        }));

        setTracks(files);
        setCurrentFolderId(sourceInput);
        try {
          localStorage.setItem('mygroove_last_folder', sourceInput);
        } catch {}
        setSetting('lastFolderId', sourceInput);
        await addFolderToHistory(sourceInput, resolvedName, resolvedEmoji);
        const updatedHistory = await getFolderHistory();
        setFolderHistory(updatedHistory);

        if (files.length === 0) {
          showToast({
            title: 'No Audio Files Found',
            message: 'No files with audio MIME types were found in this shared folder.',
            type: 'info',
          });
        } else {
          showToast({
            title: `${resolvedEmoji} ${resolvedName} Loaded`,
            message: `Found ${files.length} audio files ready for streaming.`,
            type: 'success',
          });
        }
      } catch (err) {
        console.error('Failed to fetch audio files from Drive:', err);
        setFolderError(err.message || 'Failed to access Google Drive folder.');
        showToast({
          title: 'Drive Error',
          message: err.message || 'Unable to access folder.',
          type: 'error',
        });
      } finally {
        setIsLoadingTracks(false);
        setRetryState(null);
      }
    },
    [apiKey, folderHistory, showToast]
  );

  // Playlist History Management (Rename & Delete)
  const handleUpdatePlaylist = useCallback(
    async (id, updates) => {
      await updateFolderInHistory(id, updates);
      const updated = await getFolderHistory();
      setFolderHistory(updated);
      if (id === currentFolderId) {
        setCurrentPlaylistName(updates.name);
        setCurrentPlaylistEmoji(updates.emoji);
        try {
          localStorage.setItem('mygroove_last_playlist_name', updates.name);
          localStorage.setItem('mygroove_last_playlist_emoji', updates.emoji);
        } catch {}
        setTracks((prev) =>
          prev.map((t) => ({
            ...t,
            folderName: `${updates.emoji} ${cleanPlaylistTitle(updates.name, updates.emoji)}`,
          }))
        );
      }
      showToast({
        title: 'Playlist Renamed',
        message: `Updated to ${updates.emoji} ${updates.name}`,
        type: 'success',
      });
    },
    [currentFolderId, showToast]
  );

  const handleDeletePlaylist = useCallback(
    async (id) => {
      await deleteFolderFromHistory(id);
      const updated = await getFolderHistory();
      setFolderHistory(updated);
      showToast({
        title: 'Playlist Removed',
        message: 'Removed from saved playlists list.',
        type: 'info',
      });
    },
    [showToast]
  );

  // -------------------------------------------------------------
  // Settings Actions
  // -------------------------------------------------------------
  const handleSaveApiKey = async (newKey) => {
    const trimmed = (newKey || '').trim();
    setApiKey(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem('mygroove_api_key', trimmed);
      } else {
        localStorage.removeItem('mygroove_api_key');
      }
    } catch {}
    await setSetting('apiKey', trimmed);

    if (currentFolderId && trimmed) {
      loadFolderFiles(currentFolderId, trimmed);
    }
  };

  const handleClearOfflineData = async () => {
    try {
      const db = await getDb();
      await db.clear('offlineTracks');
      showToast({
        title: 'Offline Storage Cleared',
        message: 'All downloaded audio blobs have been removed from local cache.',
        type: 'info',
      });
      // Force refresh of offline Set
      const remaining = await getOfflineTrackIds();
      // Update in player
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 text-slate-800 dark:text-[#f0f6fc] flex flex-col font-sans selection:bg-brand-500 selection:text-white transition-colors duration-200">
      {/* Top Navigation */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentFolderId={currentFolderId}
        trackCount={tracks.length}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6 pb-28 flex flex-col">
        {/* Simplified Horizontal Playlists Bar (Only playlist names displayed, scrollable with hidden scrollbar) */}
        <PlaylistBar
          playlists={folderHistory}
          currentPlaylistId={currentFolderId}
          onSelectPlaylist={(id, name, emoji) => loadFolderFiles(id, null, name, emoji)}
          onOpenAddModal={() => setIsAddPlaylistOpen(true)}
          onEditPlaylist={(playlist) => setActiveEditPlaylist(playlist)}
          onDeletePlaylist={handleDeletePlaylist}
          isLoading={isLoadingTracks}
        />

        {/* Retry / Rate-limit alert banner */}
        {retryState && (
          <div className="mb-4 p-3 rounded-xl bg-ghblue-50 dark:bg-ghblue-950/40 border border-ghblue-200 dark:border-ghblue-900/60 flex items-center gap-2.5 text-xs text-ghblue-900 dark:text-ghblue-200 shadow-sm">
            <RefreshCw className="w-4 h-4 animate-spin text-ghblue-600 dark:text-ghblue-400 shrink-0" />
            <span>
              Google Drive rate-limit encountered. Auto-retrying (Attempt {retryState.attempt}/{retryState.maxRetries}) in {retryState.waitSeconds}s...
            </span>
          </div>
        )}

        {/* Folder Error Banner */}
        {folderError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-900 dark:text-red-200 space-y-2 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="text-red-950 dark:text-red-100 font-semibold">Folder Access Error:</strong>
                <p>{folderError}</p>
              </div>
            </div>
            <div className="pl-6 text-red-700 dark:text-red-300 text-[11px]">
              Tip: Verify that the folder in Google Drive is shared as <strong>"Anyone with the link"</strong> (Viewer). Private folders return HTTP 403 Forbidden because there is no OAuth login.
            </div>
          </div>
        )}

        {/* Audio Library */}
        <Library
          tracks={tracks}
          currentTrack={player.currentTrack}
          isPlaying={player.isPlaying}
          isLoadingAudio={player.isLoadingAudio}
          trackMetadataMap={player.trackMetadataMap}
          offlineIds={player.offlineIds}
          downloadingIds={player.downloadingIds}
          downloadProgress={player.downloadProgress}
          queue={player.queue}
          onPlayTrack={(track, currentList, idx) => player.playTrack(track, currentList)}
          onTogglePlay={player.togglePlay}
          onAddToQueue={player.addToQueue}
          onPlayNext={player.playNextInQueue}
          onAddMultipleToQueue={player.addMultipleToQueue}
          onPlayNextMultiple={player.playNextMultiple}
          onShufflePlay={player.shufflePlay}
          isShuffle={player.isShuffle}
          onPinOffline={player.pinTrackForOffline}
          onUnpinOffline={player.unpinTrackOffline}
          bulkDownloadState={player.bulkDownloadState}
          onBulkPinOffline={player.bulkPinOffline}
          onBulkExportZip={player.bulkExportZip}
          onCancelBulkDownload={player.cancelBulkDownload}
          isLoadingTracks={isLoadingTracks}
          folderId={currentFolderId}
          playlistName={currentPlaylistName}
          playlistEmoji={currentPlaylistEmoji}
          onRenamePlaylist={() =>
            setActiveEditPlaylist({
              id: currentFolderId,
              name: currentPlaylistName,
              emoji: currentPlaylistEmoji,
            })
          }
          onOpenAddPlaylist={() => setIsAddPlaylistOpen(true)}
        />
      </main>

      {/* Slide-out Queue Drawer */}
      <Queue
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        queue={player.queue}
        currentTrack={player.currentTrack}
        isPlaying={player.isPlaying}
        offlineIds={player.offlineIds}
        trackMetadataMap={player.trackMetadataMap}
        onPlayTrack={(track) => player.playTrack(track)}
        onTogglePlay={player.togglePlay}
        onPlayNext={player.playNextInQueue}
        onRemoveFromQueue={player.removeFromQueue}
        onClearQueue={player.clearQueue}
        onClearUpcoming={player.clearUpcomingQueue}
        onReorderQueue={player.reorderQueue}
        onShuffleQueue={player.shuffleQueue}
      />

      {/* Docked Audio Player */}
      <Player
        currentTrack={player.currentTrack}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        bufferedTime={player.bufferedTime}
        volume={player.volume}
        isMuted={player.isMuted}
        isShuffle={player.isShuffle}
        repeatMode={player.repeatMode}
        isLoadingAudio={player.isLoadingAudio}
        audioError={player.audioError}
        offlineIds={player.offlineIds}
        onTogglePlay={player.togglePlay}
        onNext={player.nextTrack}
        onPrevious={player.previousTrack}
        onSeek={player.seekTo}
        onVolumeChange={player.setVolume}
        onToggleMute={player.toggleMute}
        onToggleShuffle={player.toggleShuffle}
        onCycleRepeat={player.cycleRepeat}
        onToggleQueue={() => setIsQueueOpen((prev) => !prev)}
        isQueueOpen={isQueueOpen}
        queueCount={player.queue.length}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        offlineCount={player.offlineIds.size}
        onClearOfflineData={handleClearOfflineData}
        onToast={showToast}
      />

      {/* Edit Playlist Modal (Rename & iOS Emoji Customizer) */}
      <EditPlaylistModal
        isOpen={!!activeEditPlaylist}
        playlist={activeEditPlaylist}
        onClose={() => setActiveEditPlaylist(null)}
        onSave={handleUpdatePlaylist}
        onDelete={handleDeletePlaylist}
      />

      {/* Add Playlist Modal (Direct R2 / S2 Bucket & Google Drive) */}
      <AddPlaylistModal
        isOpen={isAddPlaylistOpen}
        onClose={() => setIsAddPlaylistOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        onAddPlaylist={(id, name, emoji, keyToUse) => {
          loadFolderFiles(id, keyToUse || null, name, emoji);
          showToast({
            title: 'Playlist Added',
            message: `Loaded ${emoji} ${name}`,
            type: 'success',
          });
        }}
        isLoading={isLoadingTracks}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Floating Toast Notification Dispatcher */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* PWA Service Worker Update Prompt */}
      <PwaUpdateToast />
    </div>
  );
}

export default App;
