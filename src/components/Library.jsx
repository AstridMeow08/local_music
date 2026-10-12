import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Plus,
  ArrowRightCircle,
  HardDriveDownload,
  CheckCircle,
  Search,
  Music,
  Clock,
  HardDrive,
  Loader2,
  FolderOpen,
  Filter,
  Check,
  Trash2,
  Download,
  Shuffle,
  Archive,
  XCircle,
  X,
  ListPlus,
  ArrowUpDown,
  ListMusic,
  Sparkles,
  MoreHorizontal,
  ChevronDown
} from 'lucide-react';
import { formatTime } from '../utils/formatters';
import { parseAudioFilename } from '../hooks/useMediaSession';

/**
 * Helper component that highlights matched search tokens in text
 */
function HighlightMatch({ text, query }) {
  if (!text) return null;
  if (!query || !query.trim()) return <span>{text}</span>;

  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return <span>{text}</span>;

  const escapedTokens = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-orange-200/80 text-orange-950 font-semibold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

/**
 * ============================================================================
 * LIBRARY COMPONENT (White & Orange Theme)
 * ============================================================================
 * Displays audio tracks loaded from Google Drive or Cloudflare R2 with:
 * - Smart multi-token live search (matches title, artist, filename)
 * - Keyboard shortcut '/' or 'Ctrl+K' / 'Cmd+K' to focus search
 * - Highlighted matched keywords in song title and artist
 * - Queue awareness: badges indicating "Up Next" or "In Queue (#N)"
 * - Enhanced "Play Next" and "Queue" quick action buttons
 * - Batch actions: "Queue All", "Play Next All", "Shuffle Play", "Pin All", "Export ZIP"
 * - Sorting by Title, Artist, Duration, File Size
 * ============================================================================
 */
export function Library({
  tracks = [],
  currentTrack,
  isPlaying,
  isLoadingAudio,
  trackMetadataMap = {},
  offlineIds = new Set(),
  downloadingIds = new Set(),
  downloadProgress = {},
  isShuffle,
  queue = [],
  onPlayTrack,
  onTogglePlay,
  onShufflePlay,
  onAddToQueue,
  onPlayNext,
  onAddMultipleToQueue,
  onPlayNextMultiple,
  onPinOffline,
  onUnpinOffline,
  bulkDownloadState,
  onBulkPinOffline,
  onBulkExportZip,
  onCancelBulkDownload,
  isLoadingTracks,
  folderId,
  playlistName,
  playlistEmoji,
  onRenamePlaylist,
  onOpenAddPlaylist,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'offline' | 'queue'
  const [sortBy, setSortBy] = useState('default');
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const searchInputRef = useRef(null);
  const actionsDropdownRef = useRef(null);

  // Close actions dropdown on click outside
  useEffect(() => {
    if (!isActionsOpen) return;
    const handleClickOutside = (e) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target)) {
        setIsActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isActionsOpen]);

  // Keyboard shortcut listener to focus search with '/' or 'Cmd+K' / 'Ctrl+K'
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Map track IDs to queue positions and flags for instant lookup
  const { queueMap, currentIndex, nextTrackId } = useMemo(() => {
    const map = new Map();
    queue.forEach((t, idx) => {
      map.set(t.id, idx + 1);
    });

    const cIdx = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : -1;
    const nId = cIdx !== -1 && cIdx + 1 < queue.length ? queue[cIdx + 1].id : null;

    return { queueMap: map, currentIndex: cIdx, nextTrackId: nId };
  }, [queue, currentTrack]);

  // Filter and sort tracks
  const filteredTracks = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    const tokens = trimmedQuery ? trimmedQuery.split(/\s+/).filter(Boolean) : [];

    let result = tracks.filter((track) => {
      // Search matching across title, artist, and full filename
      if (tokens.length > 0) {
        const { artist, title } = parseAudioFilename(track.name);
        const combined = `${track.name} ${title} ${artist}`.toLowerCase();
        const matchesAllTokens = tokens.every((token) => combined.includes(token));
        if (!matchesAllTokens) return false;
      }

      // Filter chips
      if (filterMode === 'offline') {
        return offlineIds.has(track.id);
      }
      if (filterMode === 'queue') {
        return queueMap.has(track.id);
      }
      return true;
    });

    // Apply sorting
    if (sortBy !== 'default') {
      result = [...result].sort((a, b) => {
        const metaA = parseAudioFilename(a.name);
        const metaB = parseAudioFilename(b.name);

        switch (sortBy) {
          case 'title-asc':
            return metaA.title.localeCompare(metaB.title, undefined, { numeric: true, sensitivity: 'base' });
          case 'title-desc':
            return metaB.title.localeCompare(metaA.title, undefined, { numeric: true, sensitivity: 'base' });
          case 'artist-asc':
            return metaA.artist.localeCompare(metaB.artist, undefined, { numeric: true, sensitivity: 'base' });
          case 'duration-desc': {
            const durA = trackMetadataMap[a.id]?.duration || 0;
            const durB = trackMetadataMap[b.id]?.duration || 0;
            return durB - durA;
          }
          case 'size-desc':
            return (b.size || 0) - (a.size || 0);
          default:
            return 0;
        }
      });
    }

    return result;
  }, [tracks, searchQuery, filterMode, sortBy, offlineIds, queueMap, trackMetadataMap]);

  const unpinnedCount = useMemo(() => {
    return tracks.filter((t) => !offlineIds.has(t.id)).length;
  }, [tracks, offlineIds]);

  const queuedCountInLibrary = useMemo(() => {
    return tracks.filter((t) => queueMap.has(t.id)).length;
  }, [tracks, queueMap]);

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      {/* Top Search & Controls Bar */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Enhanced Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs or artists... (Press / to focus)"
              className="w-full pl-9 pr-20 py-2.5 rounded-xl text-sm glass-input text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-[#161b22] border-slate-300 dark:border-[#30363d] focus:border-brand-500 transition-all shadow-xs"
            />

            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-[#21262d] transition-colors"
                  title="Clear search (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#21262d] border border-slate-200 dark:border-[#30363d] rounded pointer-events-none shadow-xs">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Quick Filters & Sorter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 shadow-xs shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-200 text-xs focus:outline-none cursor-pointer pr-1 font-medium"
                title="Sort track list"
              >
                <option value="default" className="dark:bg-[#161b22]">Default Order</option>
                <option value="title-asc" className="dark:bg-[#161b22]">Title (A → Z)</option>
                <option value="title-desc" className="dark:bg-[#161b22]">Title (Z → A)</option>
                <option value="artist-asc" className="dark:bg-[#161b22]">Artist (A → Z)</option>
                <option value="duration-desc" className="dark:bg-[#161b22]">Duration (Longest)</option>
                <option value="size-desc" className="dark:bg-[#161b22]">File Size (Largest)</option>
              </select>
            </div>

            {/* Filter mode chips */}
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                filterMode === 'all'
                  ? 'bg-brand-500 text-white shadow-glow-brand'
                  : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#30363d] hover:bg-slate-50 dark:hover:bg-[#21262d]'
              }`}
            >
              All ({tracks.length})
            </button>

            <button
              onClick={() => setFilterMode('offline')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                filterMode === 'offline'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#30363d] hover:bg-slate-50 dark:hover:bg-[#21262d]'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Offline ({offlineIds.size})</span>
            </button>

            {queue.length > 0 && (
              <button
                onClick={() => setFilterMode('queue')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                  filterMode === 'queue'
                    ? 'bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-700'
                    : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#30363d] hover:bg-slate-50 dark:hover:bg-[#21262d]'
                }`}
                title="Filter songs currently in the play queue"
              >
                <ListMusic className="w-3.5 h-3.5 text-brand-500" />
                <span>In Queue ({queuedCountInLibrary})</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Header: Bulk Queue, Shuffle Play, Pin, ZIP */}
        {tracks.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-[#30363d]">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              {searchQuery ? (
                <div className="flex items-center gap-1.5">
                  <span>
                    Showing <strong className="text-brand-600 dark:text-brand-400">{filteredTracks.length}</strong> of {tracks.length} songs
                  </span>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline ml-1 font-semibold"
                  >
                    (Clear)
                  </button>
                </div>
              ) : (
                <span>
                  <strong className="text-slate-800 dark:text-slate-200">{filteredTracks.length}</strong> {filteredTracks.length === 1 ? 'song' : 'songs'} in folder
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 relative shrink-0">
              {/* Primary Quick Play: Shuffle Play Button */}
              {onShufflePlay && (
                <button
                  onClick={() => onShufflePlay(filteredTracks.length > 0 ? filteredTracks : tracks)}
                  className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-glow-brand transition-all active:scale-95 shrink-0"
                  title="Randomize and start playing"
                >
                  <Shuffle className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Shuffle Play</span>
                </button>
              )}

              {/* Collapsed Actions Dropdown Trigger */}
              <div className="relative" ref={actionsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsActionsOpen((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 border shadow-xs ${
                    isActionsOpen
                      ? 'bg-slate-100 dark:bg-[#21262d] text-brand-600 dark:text-brand-400 border-brand-500/50'
                      : 'bg-white dark:bg-[#161b22] hover:bg-slate-50 dark:hover:bg-[#21262d] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#30363d]'
                  }`}
                  title="Batch actions for songs (Queue, Play Next, Pin Offline, Export ZIP)"
                >
                  <MoreHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Actions</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      isActionsOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Collapsed Actions Dropdown Menu */}
                {isActionsOpen && (
                  <div
                    className="absolute right-0 top-full mt-1.5 z-40 w-56 rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] shadow-2xl p-1.5 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-0.5"
                    style={{
                      boxShadow: '0 16px 36px -10px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Batch Queue */}
                    {filteredTracks.length > 0 && onAddMultipleToQueue && (
                      <button
                        type="button"
                        onClick={() => {
                          onAddMultipleToQueue(filteredTracks);
                          setIsActionsOpen(false);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-[#21262d] flex items-center gap-2.5 transition-colors"
                      >
                        <ListPlus className="w-4 h-4 text-brand-500 shrink-0" />
                        <span>Queue All ({filteredTracks.length})</span>
                      </button>
                    )}

                    {/* Batch Play Next */}
                    {filteredTracks.length > 0 && onPlayNextMultiple && currentTrack && (
                      <button
                        type="button"
                        onClick={() => {
                          onPlayNextMultiple(filteredTracks);
                          setIsActionsOpen(false);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-[#21262d] flex items-center gap-2.5 transition-colors"
                      >
                        <ArrowRightCircle className="w-4 h-4 text-brand-500 shrink-0" />
                        <span>Play Next All</span>
                      </button>
                    )}

                    {/* Bulk Pin Offline */}
                    {!bulkDownloadState && unpinnedCount > 0 && onBulkPinOffline && (
                      <button
                        type="button"
                        onClick={() => {
                          onBulkPinOffline(filteredTracks.length > 0 ? filteredTracks : tracks);
                          setIsActionsOpen(false);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center gap-2.5 transition-colors"
                      >
                        <HardDriveDownload className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Pin All Offline ({unpinnedCount})</span>
                      </button>
                    )}

                    {/* Bulk Export ZIP */}
                    {!bulkDownloadState && onBulkExportZip && (
                      <button
                        type="button"
                        onClick={() => {
                          onBulkExportZip(filteredTracks.length > 0 ? filteredTracks : tracks);
                          setIsActionsOpen(false);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-cyan-800 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 flex items-center gap-2.5 transition-colors"
                      >
                        <Archive className="w-4 h-4 text-cyan-600 shrink-0" />
                        <span>Export as ZIP</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Download Active Progress Banner */}
      {bulkDownloadState && (
        <div className="p-3.5 sm:p-4 rounded-2xl border border-brand-300 bg-white mb-4 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between gap-3 text-xs mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Loader2 className="w-4 h-4 text-brand-500 animate-spin shrink-0" />
              <div className="truncate">
                <span className="font-bold text-slate-900 mr-2">
                  {bulkDownloadState.type === 'zip' ? 'Packaging ZIP Archive...' : 'Downloading Songs for Offline...'}
                </span>
                <span className="text-brand-600 font-bold font-mono">
                  {bulkDownloadState.current} / {bulkDownloadState.total} ({bulkDownloadState.percent}%)
                </span>
              </div>
            </div>

            <button
              onClick={onCancelBulkDownload}
              className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5 text-red-600" />
              <span>Cancel</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 truncate mb-2.5 font-mono">
            {bulkDownloadState.activeName}
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-amber-500 rounded-full transition-all duration-300 shadow-glow-brand"
              style={{ width: `${Math.min(100, bulkDownloadState.percent)}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Track List Container */}
      <div className="flex-1 overflow-y-auto pr-1 pb-32">
        {isLoadingTracks ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Scanning music folder...</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Discovering audio tracks and preparing instant streaming
            </p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-slate-300 dark:border-[#30363d] p-8 bg-white dark:bg-[#161b22] shadow-xs">
            {tracks.length === 0 ? (
              !folderId ? (
                <>
                  <div className="w-16 h-16 mb-3 p-2.5 bg-black dark:bg-[#0d1117] rounded-2xl border border-slate-700/60 shadow-md inline-flex items-center justify-center">
                    <img
                      src="/mygroove-symbol.png"
                      alt="MyGroove"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Welcome to MyGroove</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                    Select a playlist above or click <strong>"+ Add Playlist"</strong> to connect your Google Drive or Cloudflare R2 / S2 bucket.
                  </p>
                  {onOpenAddPlaylist && (
                    <button
                      type="button"
                      onClick={onOpenAddPlaylist}
                      className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-500 hover:to-amber-500 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
                    >
                      + Add Your First Playlist
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Music className="w-12 h-12 text-slate-400 dark:text-slate-500 mb-3" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">No Audio Files Found</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                    Ensure the music folder or bucket contains audio files (.mp3, .m4a, .flac, .wav) and is publicly accessible.
                  </p>
                </>
              )
            ) : (
              <>
                <h3 className="text-base font-bold text-slate-800">No Matching Songs Found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  No tracks match "{searchQuery}". Try a different keyword or clear your filters.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterMode('all');
                  }}
                  className="mt-3 px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-brand-700 text-xs font-bold border border-brand-300 transition-all"
                >
                  Reset Filters & Search
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTracks.map((track, index) => {
              const isCurrent = currentTrack?.id === track.id;
              const isPinned = offlineIds.has(track.id);
              const isDownloading = downloadingIds.has(track.id);
              const progress = downloadProgress[track.id] || 0;
              const { artist, title } = parseAudioFilename(track.name);
              const cachedDuration = trackMetadataMap[track.id]?.duration;
              const queuePos = queueMap.get(track.id);
              const isUpNext = track.id === nextTrackId;

              return (
                <div
                  key={track.id}
                  onClick={() => {
                    if (isCurrent) {
                      onTogglePlay();
                    } else {
                      onPlayTrack(track, filteredTracks, index);
                    }
                  }}
                  className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 cursor-pointer select-none ${
                    isCurrent
                      ? 'bg-brand-50/90 dark:bg-[#112318] border-brand-500/80 dark:border-brand-500/80 shadow-sm ring-1 ring-brand-500/30 dark:ring-brand-500/40 hover:bg-brand-100/80 dark:hover:bg-[#172e20]'
                      : 'bg-white dark:bg-[#161b22] hover:bg-slate-50 dark:hover:bg-[#21262d] border-slate-200 dark:border-[#30363d] hover:border-brand-400/80 dark:hover:border-brand-500/60 shadow-xs hover:shadow-md'
                  }`}
                >
                  {/* Left: Play/Pause Button + Artwork + Title & Artist */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Play/Index Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCurrent) {
                          onTogglePlay();
                        } else {
                          onPlayTrack(track, filteredTracks, index);
                        }
                      }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95 ${
                        isCurrent
                          ? 'bg-brand-500 text-white shadow-glow-brand'
                          : 'bg-slate-100 dark:bg-[#282e37] group-hover:bg-brand-500 group-hover:text-white group-hover:shadow-glow-brand text-slate-600 dark:text-slate-300'
                      }`}
                      title={isCurrent && isPlaying ? 'Pause' : 'Play Track'}
                    >
                      {isCurrent && isLoadingAudio ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isCurrent && isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Thumbnail if available */}
                    {track.thumbnailLink && (
                      <div className="hidden sm:block w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-[#30363d]">
                        <img
                          src={track.thumbnailLink.replace(/=s\d+/, '=s120')}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Title & Artist with Match Highlighting & Status Badges */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-semibold truncate transition-colors ${
                            isCurrent
                              ? 'text-brand-600 dark:text-brand-400 font-bold'
                              : 'text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400'
                          }`}
                        >
                          <HighlightMatch text={title} query={searchQuery} />
                        </span>

                        {/* Status Badges */}
                        {isUpNext && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-brand-100 dark:bg-brand-950/80 text-brand-800 dark:text-brand-300 border border-brand-300 dark:border-brand-700 rounded-md shrink-0 shadow-xs"
                            title="This track will play next immediately after the current song"
                          >
                            <ArrowRightCircle className="w-2.5 h-2.5 text-brand-600 dark:text-brand-400" />
                            Up Next
                          </span>
                        )}

                        {queuePos && !isCurrent && !isUpNext && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#30363d] rounded-md shrink-0"
                            title={`Position #${queuePos} in play queue`}
                          >
                            <ListMusic className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
                            #{queuePos}
                          </span>
                        )}

                        {isPinned && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded shrink-0 shadow-xs"
                            title="Cached locally in IndexedDB for offline play"
                          >
                            <CheckCircle className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                            Offline
                          </span>
                        )}
                      </div>

                      {/* Artist and Duration (Song file size/storage space completely hidden) */}
                      <div className="flex items-center gap-2 text-xs mt-0.5 transition-colors">
                        <span className={`truncate max-w-[180px] sm:max-w-[240px] ${
                          isCurrent
                            ? 'text-brand-700/80 dark:text-brand-300/80 font-medium'
                            : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                        }`}>
                          <HighlightMatch text={artist} query={searchQuery} />
                        </span>
                        {cachedDuration && cachedDuration > 0 && (
                          <>
                            <span className={isCurrent ? 'text-brand-500/60' : 'text-slate-400 dark:text-slate-500'}>•</span>
                            <span className={`font-mono text-[11px] ${
                              isCurrent
                                ? 'text-brand-700/80 dark:text-brand-300/80 font-semibold'
                                : 'text-slate-600 dark:text-slate-400 font-medium'
                            }`}>
                              {formatTime(cachedDuration)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Play Next, Add to Queue, Pin Offline */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-2">
                    {/* Play Next Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayNext(track);
                      }}
                      className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95 border ${
                        isUpNext
                          ? 'bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-700 font-semibold shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/50 border-transparent hover:border-brand-200 dark:hover:border-brand-800/60'
                      }`}
                      title={isUpNext ? 'Currently scheduled to play next' : 'Play immediately after current song'}
                    >
                      <ArrowRightCircle className="w-4 h-4 text-brand-500" />
                      <span className="hidden md:inline text-[11px]">
                        {isUpNext ? 'Up Next' : 'Play Next'}
                      </span>
                    </button>

                    {/* Add to Queue Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToQueue(track);
                      }}
                      className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95 border ${
                        queuePos && !isCurrent
                          ? 'bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800 font-semibold shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#282e37] border-transparent hover:border-slate-200 dark:hover:border-[#30363d]'
                      }`}
                      title={queuePos ? `Already in queue (#${queuePos}). Click to move to end.` : 'Add to end of play queue'}
                    >
                      <ListPlus className="w-4 h-4 text-brand-500" />
                      <span className="hidden md:inline text-[11px]">
                        {queuePos && !isCurrent ? `In Queue` : 'Queue'}
                      </span>
                    </button>

                    {/* Offline Pin Button */}
                    {isDownloading ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#21262d] text-brand-600 dark:text-brand-400 text-xs font-mono font-semibold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-[11px]">{progress}%</span>
                      </div>
                    ) : isPinned ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnpinOffline(track.id, track.name);
                        }}
                        className="p-2 rounded-xl text-emerald-600 dark:text-emerald-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Stored offline in IndexedDB. Click to remove from cache."
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPinOffline(track);
                        }}
                        className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors"
                        title="Save to local device storage for 100% offline playback"
                      >
                        <HardDriveDownload className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Library;
