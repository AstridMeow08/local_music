import React, { useState, useMemo } from 'react';
import {
  X,
  Trash2,
  GripVertical,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Disc3,
  Music,
  CheckCircle,
  Shuffle,
  Search,
  ArrowRightCircle,
  Clock,
  Sparkles,
  Eraser
} from 'lucide-react';
import { parseAudioFilename } from '../hooks/useMediaSession';
import { formatTime, formatQueueDuration } from '../utils/formatters';

/**
 * ============================================================================
 * QUEUE COMPONENT (GitHub Theme)
 * ============================================================================
 * Slide-out drawer or overlay managing the active playlist queue.
 * Supports:
 * - Search within the queue to find tracks instantly
 * - Distinct "Now Playing" card with live playback indicators
 * - "Up Next" section with track count and total duration
 * - Single-click "Play Next" to bump any upcoming song to #1 in queue
 * - Native HTML5 drag-and-drop reordering with persistent order
 * - Touch-friendly Move Up / Move Down buttons for mobile devices
 * - Clear Upcoming (keeps current song playing) or Clear All
 * - Direct track selection & removal
 * ============================================================================
 */
export function Queue({
  isOpen,
  onClose,
  queue = [],
  currentTrack,
  isPlaying,
  offlineIds = new Set(),
  trackMetadataMap = {},
  onPlayTrack,
  onTogglePlay,
  onPlayNext,
  onRemoveFromQueue,
  onClearQueue,
  onClearUpcoming,
  onReorderQueue,
  onShuffleQueue,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  if (!isOpen) return null;

  // Find index of currently playing track
  const currentIndex = currentTrack
    ? queue.findIndex((t) => t.id === currentTrack.id)
    : -1;

  // Upcoming tracks are those positioned after currentTrack, or all if current is not in queue
  const upcomingTracks = useMemo(() => {
    if (currentIndex !== -1) {
      return queue.slice(currentIndex + 1);
    }
    return queue.filter((t) => t.id !== currentTrack?.id);
  }, [queue, currentIndex, currentTrack]);

  // Total duration of upcoming tracks
  const upcomingDuration = useMemo(() => {
    return upcomingTracks.reduce((acc, t) => {
      const dur = trackMetadataMap[t.id]?.duration || 0;
      return acc + dur;
    }, 0);
  }, [upcomingTracks, trackMetadataMap]);

  // Filtered upcoming tracks based on search query
  const filteredUpcoming = useMemo(() => {
    if (!searchQuery.trim()) return upcomingTracks;
    const tokens = searchQuery.toLowerCase().trim().split(/\s+/);
    return upcomingTracks.filter((track) => {
      const { title, artist } = parseAudioFilename(track.name);
      const combined = `${track.name} ${title} ${artist}`.toLowerCase();
      return tokens.every((token) => combined.includes(token));
    });
  }, [upcomingTracks, searchQuery]);

  // Drag & drop handlers
  const handleDragStart = (e, indexInUpcoming) => {
    const absIndex = currentIndex !== -1 ? currentIndex + 1 + indexInUpcoming : indexInUpcoming;
    setDraggedIndex(absIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', absIndex.toString());
  };

  const handleDragOver = (e, indexInUpcoming) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const absIndex = currentIndex !== -1 ? currentIndex + 1 + indexInUpcoming : indexInUpcoming;
    if (dragOverIndex !== absIndex) {
      setDragOverIndex(absIndex);
    }
  };

  const handleDrop = (e, targetIndexInUpcoming) => {
    e.preventDefault();
    const targetAbsIndex = currentIndex !== -1 ? currentIndex + 1 + targetIndexInUpcoming : targetIndexInUpcoming;
    if (draggedIndex === null || draggedIndex === targetAbsIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...queue];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetAbsIndex, 0, moved);

    onReorderQueue(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Up/down buttons for touch devices
  const moveItemInUpcoming = (indexInUpcoming, delta) => {
    const fromAbs = currentIndex !== -1 ? currentIndex + 1 + indexInUpcoming : indexInUpcoming;
    const toAbs = fromAbs + delta;
    const minAbs = currentIndex !== -1 ? currentIndex + 1 : 0;
    if (toAbs < minAbs || toAbs >= queue.length) return;

    const updated = [...queue];
    const [moved] = updated.splice(fromAbs, 1);
    updated.splice(toAbs, 0, moved);
    onReorderQueue(updated);
  };

  // Bump track to #1 Up Next
  const handlePromoteToNext = (track) => {
    if (onPlayNext) {
      onPlayNext(track);
    }
  };

  // Parse current track metadata
  const currentParsed = currentTrack ? parseAudioFilename(currentTrack.name) : null;
  const currentIsPinned = currentTrack ? offlineIds.has(currentTrack.id) : false;
  const currentDuration = currentTrack ? trackMetadataMap[currentTrack.id]?.duration : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity">
      <div
        className="w-full max-w-md bg-white dark:bg-[#161b22] border-l border-slate-200 dark:border-[#30363d] h-full flex flex-col shadow-2xl safe-pt safe-pb animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 dark:border-[#30363d] flex items-center justify-between shrink-0 bg-white dark:bg-[#161b22]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/60 flex items-center justify-center text-brand-600 dark:text-brand-400 shadow-xs">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#f0f6fc]">Play Queue</h3>
              <p className="text-xs text-slate-500 dark:text-[#8b949e]">
                {queue.length} {queue.length === 1 ? 'track' : 'tracks'} total
                {upcomingDuration > 0 && ` • ~${formatQueueDuration(upcomingDuration)} left`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {upcomingTracks.length > 1 && onShuffleQueue && (
              <button
                onClick={onShuffleQueue}
                className="px-2.5 py-1 text-xs text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 dark:hover:bg-brand-900/60 hover:text-brand-800 rounded-xl transition-colors flex items-center gap-1 border border-brand-200 dark:border-brand-800 font-semibold"
                title="Shuffle upcoming tracks in queue"
              >
                <Shuffle className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span className="hidden sm:inline">Shuffle</span>
              </button>
            )}

            {upcomingTracks.length > 0 && onClearUpcoming && (
              <button
                onClick={onClearUpcoming}
                className="px-2 py-1 text-xs text-slate-600 dark:text-[#8b949e] hover:text-slate-900 dark:hover:text-[#f0f6fc] bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] rounded-xl transition-colors flex items-center gap-1 border border-slate-200 dark:border-[#30363d] font-medium"
                title="Clear upcoming songs without stopping currently playing music"
              >
                <Eraser className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Clear Upcoming</span>
              </button>
            )}

            {queue.length > 0 && (
              <button
                onClick={onClearQueue}
                className="px-2 py-1 text-xs text-red-700 dark:text-red-400 hover:text-red-800 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 rounded-xl transition-colors flex items-center gap-1 border border-red-200 dark:border-red-800 font-semibold"
                title="Remove all tracks from queue"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-[#f0f6fc] rounded-xl hover:bg-slate-100 dark:hover:bg-[#21262d] transition-colors ml-1"
              title="Close Queue Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search within Queue Bar */}
        {queue.length > 2 && (
          <div className="px-3 pt-3 pb-1 shrink-0 bg-white dark:bg-[#161b22]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search within queue..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs glass-input text-slate-900 dark:text-[#f0f6fc] placeholder:text-slate-400 dark:placeholder:text-[#8b949e] bg-white dark:bg-[#0d1117] border-slate-300 dark:border-[#30363d]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-[#f0f6fc]"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#8b949e] px-1 mt-1.5 font-medium">
                <span>
                  Found <strong className="text-brand-600 dark:text-brand-400">{filteredUpcoming.length}</strong> matching{' '}
                  {filteredUpcoming.length === 1 ? 'song' : 'songs'}
                </span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-ghblue-600 dark:text-ghblue-400 hover:underline font-semibold"
                >
                  Show all
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/60 dark:bg-[#0d1117]">
          {/* NOW PLAYING CARD */}
          {currentTrack && !searchQuery && (
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-1.5 px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                  Now Playing
                </span>
                {isPlaying && (
                  <div className="flex items-end gap-0.5 h-3">
                    <span className="w-0.5 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.3s] h-3" />
                    <span className="w-0.5 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.15s] h-2" />
                    <span className="w-0.5 bg-brand-500 rounded-full animate-bounce h-3" />
                  </div>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-gradient-to-r from-brand-50/60 via-white to-ghblue-50/30 dark:from-[#161b22] dark:via-[#161b22] dark:to-[#21262d] border border-brand-200/80 dark:border-[#30363d] flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Thumbnail / Rotating Disc */}
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-brand-100 dark:bg-[#21262d] shrink-0 border border-brand-200 dark:border-[#30363d]">
                    {currentTrack.thumbnailLink ? (
                      <img
                        src={currentTrack.thumbnailLink.replace(/=s\d+/, '=s120')}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-600 dark:text-brand-400">
                        <Disc3 className={`w-5 h-5 ${isPlaying ? 'animate-spin-slow' : ''}`} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-[#f0f6fc] truncate">
                        {currentParsed?.title}
                      </span>
                      {currentIsPinned && (
                        <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#8b949e] mt-0.5">
                      <span className="truncate">{currentParsed?.artist}</span>
                      {currentDuration > 0 && (
                        <>
                          <span>•</span>
                          <span className="font-mono font-medium">{formatTime(currentDuration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={onTogglePlay}
                  className="w-8 h-8 rounded-xl bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-glow-brand transition-transform active:scale-95"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* UP NEXT SECTION */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-[#f0f6fc] mb-2 px-1">
              <span className="flex items-center gap-1.5">
                <span>Up Next</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-[#21262d] text-[10px] text-slate-700 dark:text-[#8b949e] font-mono font-bold">
                  {upcomingTracks.length}
                </span>
              </span>
              {upcomingDuration > 0 && (
                <span className="text-[11px] text-slate-500 dark:text-[#8b949e] flex items-center gap-1 font-medium">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{formatQueueDuration(upcomingDuration)}</span>
                </span>
              )}
            </div>

            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center p-6 text-slate-500 dark:text-[#8b949e] rounded-2xl border border-dashed border-slate-300 dark:border-[#30363d] bg-white dark:bg-[#161b22]">
                <div className="w-12 h-12 mb-2.5 p-2 bg-black dark:bg-[#0d1117] rounded-xl border border-slate-700/60 shadow-xs inline-flex items-center justify-center">
                  <img src="/mygroove-symbol.png" alt="MyGroove" className="w-full h-full object-contain" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-[#f0f6fc]">Queue is empty</p>
                <p className="text-xs text-slate-500 dark:text-[#8b949e] mt-1 max-w-xs">
                  Add tracks from your music library by clicking "Play Next" or "Queue".
                </p>
              </div>
            ) : filteredUpcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center p-4 text-slate-500 dark:text-[#8b949e] rounded-2xl border border-dashed border-slate-300 dark:border-[#30363d] bg-white dark:bg-[#161b22]">
                <p className="text-xs font-medium text-slate-600 dark:text-[#8b949e]">
                  {searchQuery ? `No queued songs matching "${searchQuery}"` : 'No upcoming songs in queue'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-xs text-ghblue-600 dark:text-ghblue-400 hover:underline font-semibold"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredUpcoming.map((track, idx) => {
                  const isPinned = offlineIds.has(track.id);
                  const { artist, title } = parseAudioFilename(track.name);
                  const dur = trackMetadataMap[track.id]?.duration;
                  const isFirstUpcoming = idx === 0;

                  // Absolute index in the full queue array
                  const absIndex = currentIndex !== -1 ? currentIndex + 1 + idx : idx;
                  const isDragging = draggedIndex === absIndex;
                  const isOver = dragOverIndex === absIndex;

                  return (
                    <div
                      key={`${track.id}-${absIndex}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`group relative flex items-center justify-between p-2 sm:p-2.5 rounded-xl border transition-all select-none shadow-xs ${
                        isDragging ? 'opacity-30 scale-95 border-dashed border-brand-500 bg-brand-50 dark:bg-[#21262d]' : ''
                      } ${
                        isOver ? 'border-brand-500 bg-brand-50/70 dark:bg-[#21262d]' : ''
                      } ${
                        isFirstUpcoming && !searchQuery
                          ? 'bg-brand-50/70 dark:bg-brand-950/30 border-brand-300 dark:border-brand-800/70'
                          : 'bg-white dark:bg-[#161b22] hover:bg-slate-50 dark:hover:bg-[#21262d] border-slate-200/90 dark:border-[#30363d] text-slate-800 dark:text-[#f0f6fc]'
                      }`}
                    >
                      {/* Left: Drag Handle + Number + Play Trigger */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {/* Drag Handle */}
                        <div
                          className="p-1 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>

                        {/* Position Badge */}
                        <span
                          className={`w-5 text-[11px] font-mono shrink-0 text-center ${
                            isFirstUpcoming && !searchQuery ? 'text-brand-600 dark:text-brand-400 font-bold' : 'text-slate-400 font-medium'
                          }`}
                        >
                          #{idx + 1}
                        </span>

                        {/* Play Button */}
                        <button
                          onClick={() => onPlayTrack(track)}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#21262d] group-hover:bg-brand-500 group-hover:text-white text-slate-600 dark:text-[#8b949e] flex items-center justify-center shrink-0 transition-colors"
                          title="Play this track now"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>

                        {/* Title & Artist */}
                        <div
                          className="min-w-0 flex-1 cursor-pointer pl-1"
                          onClick={() => onPlayTrack(track)}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold truncate text-slate-800 dark:text-[#f0f6fc] group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                              {title}
                            </span>
                            {isFirstUpcoming && !searchQuery && (
                              <span className="px-1 py-0.2 rounded bg-brand-100 dark:bg-brand-950/80 text-brand-800 dark:text-brand-300 text-[9px] font-bold uppercase tracking-wider shrink-0 border border-brand-200 dark:border-brand-800/60">
                                Next
                              </span>
                            )}
                            {isPinned && (
                              <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-[#8b949e] truncate">
                            <span className="truncate max-w-[140px] sm:max-w-[180px]">{artist}</span>
                            {dur > 0 && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] font-medium">{formatTime(dur)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0 ml-1.5">
                        {/* Play Next Button: Promotes this item to #1 in Up Next */}
                        {!isFirstUpcoming && (
                          <button
                            onClick={() => handlePromoteToNext(track)}
                            className="p-1 sm:px-1.5 sm:py-1 rounded text-slate-500 dark:text-[#8b949e] hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-[#21262d] transition-colors text-[10px] flex items-center gap-1 font-semibold"
                            title="Move to top of Up Next"
                          >
                            <ArrowRightCircle className="w-3.5 h-3.5 text-brand-500" />
                            <span className="hidden xl:inline text-[10px]">Play Next</span>
                          </button>
                        )}

                        {/* Touch-friendly Move Up / Down */}
                        <div className="flex flex-col opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => moveItemInUpcoming(idx, -1)}
                            disabled={idx === 0}
                            className="p-0.5 text-slate-400 dark:text-[#8b949e] hover:text-slate-800 dark:hover:text-[#f0f6fc] disabled:opacity-20 transition-colors"
                            title="Move Up in Queue"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveItemInUpcoming(idx, 1)}
                            disabled={idx === upcomingTracks.length - 1}
                            className="p-0.5 text-slate-400 dark:text-[#8b949e] hover:text-slate-800 dark:hover:text-[#f0f6fc] disabled:opacity-20 transition-colors"
                            title="Move Down in Queue"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Remove Track from Queue */}
                        <button
                          onClick={() => onRemoveFromQueue(track.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-200 dark:border-[#30363d] text-center text-[11px] text-slate-500 dark:text-[#8b949e] shrink-0 bg-white dark:bg-[#161b22]">
          Queue automatically persists offline across app restarts.
        </div>
      </div>
    </div>
  );
}

export default Queue;
