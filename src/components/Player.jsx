import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  ListMusic,
  HardDriveDownload,
  CheckCircle,
  Disc3,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { formatTime } from '../utils/formatters';
import { parseAudioFilename } from '../hooks/useMediaSession';

/**
 * ============================================================================
 * PLAYER COMPONENT (White & Orange Theme)
 * ============================================================================
 * Bottom dock player with range-scrubbing, volume control, shuffle/repeat,
 * high-res thumbnail with spinning vinyl fallback, and offline status indicator.
 * ============================================================================
 */
export function Player({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  bufferedTime,
  volume,
  isMuted,
  isShuffle,
  repeatMode,
  isLoadingAudio,
  audioError,
  offlineIds,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onToggleQueue,
  isQueueOpen,
  queueCount,
}) {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-xl border-t border-slate-200 dark:border-[#30363d] p-4 text-center safe-pb shadow-glass">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black dark:bg-[#0d1117] border border-slate-700/60 flex items-center justify-center p-1.5 shadow-xs">
              <img src="/mygroove-symbol.png" alt="MyGroove" className="w-full h-full object-contain" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-slate-800 dark:text-slate-200">No track selected</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Shuffle toggle in standby */}
            <button
              onClick={onToggleShuffle}
              className={`p-2 rounded-xl transition-all relative flex items-center justify-center ${
                isShuffle
                  ? 'bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-600 shadow-glow-brand'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#21262d] border border-slate-200 dark:border-[#30363d]'
              }`}
              title={isShuffle ? 'Shuffle is ON (Click to turn off)' : 'Shuffle is OFF (Click to turn on)'}
              aria-label="Toggle shuffle mode"
              aria-pressed={isShuffle}
            >
              <Shuffle className="w-4 h-4" />
              {isShuffle && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-500 shadow-xs" />
              )}
            </button>

            <button
              onClick={onToggleQueue}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#21262d] hover:bg-slate-200 dark:hover:bg-[#30363d] text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-[#30363d] font-medium"
              title="Open Queue"
            >
              <ListMusic className="w-4 h-4 text-brand-500" />
              <span>Queue ({queueCount})</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { artist, title } = parseAudioFilename(currentTrack.name);
  const isPinned = offlineIds.has(currentTrack.id);

  const displayTime = isScrubbing ? scrubValue : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  const handleSeekStart = () => {
    setIsScrubbing(true);
    setScrubValue(currentTime);
  };

  const handleSeekChange = (e) => {
    setScrubValue(parseFloat(e.target.value));
  };

  const handleSeekEnd = (e) => {
    const newPos = parseFloat(e.target.value);
    setIsScrubbing(false);
    onSeek(newPos);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-2xl border-t border-slate-200 dark:border-[#30363d] safe-pb shadow-[0_-4px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_30px_rgba(1,4,9,0.6)]">
      {/* Top micro progress bar for mobile or compact view */}
      <div className="w-full h-1 bg-slate-100 dark:bg-[#21262d] relative cursor-pointer group">
        <div
          className="absolute top-0 bottom-0 left-0 bg-slate-200 dark:bg-[#30363d] transition-all duration-300"
          style={{ width: `${Math.min(100, bufferedPercent)}%` }}
        />
        <div
          className="absolute top-0 bottom-0 left-0 bg-brand-500 shadow-glow-brand"
          style={{ width: `${Math.min(100, progressPercent)}%` }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Track Info */}
        <div className="flex items-center gap-3 w-full md:w-1/4 min-w-0">
          <div className="relative group shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-[#21262d] border border-slate-200 dark:border-[#30363d] shadow-sm">
            {currentTrack.thumbnailLink ? (
              <img
                src={currentTrack.thumbnailLink.replace(/=s\d+/, '=s240')}
                alt={title}
                className={`w-full h-full object-cover transition-transform duration-700 ${
                  isPlaying ? 'scale-105' : 'scale-100'
                }`}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={`w-full h-full bg-gradient-to-br from-brand-50 to-ghblue-50 dark:from-[#21262d] dark:to-[#0d1117] flex items-center justify-center text-brand-500 ${
                currentTrack.thumbnailLink ? 'hidden' : 'flex'
              }`}
            >
              <Disc3 className={`w-6 h-6 ${isPlaying ? 'animate-spin-slow text-brand-500' : 'text-slate-400'}`} />
            </div>

            {/* Offline indicator badge overlay */}
            {isPinned && (
              <div
                className="absolute top-1 left-1 bg-emerald-500 text-white p-0.5 rounded-full shadow"
                title="Playing from local IndexedDB storage (Offline)"
              >
                <CheckCircle className="w-2.5 h-2.5" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                {title}
              </h4>
              {isPinned && (
                <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  Offline
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{artist}</p>
          </div>
        </div>

        {/* Center: Transport Controls & Range-Seek Scrubber */}
        <div className="flex flex-col items-center w-full md:w-2/4 max-w-2xl">
          {/* Main Action Buttons */}
          <div className="flex items-center gap-4 sm:gap-6 mb-1">
            {/* Shuffle Mode Toggle */}
            <button
              onClick={onToggleShuffle}
              className={`p-2 rounded-xl transition-all relative flex items-center justify-center ${
                isShuffle
                  ? 'bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-600 shadow-glow-brand'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#21262d] border border-transparent'
              }`}
              title={isShuffle ? 'Shuffle is ON (Click to turn off)' : 'Shuffle is OFF (Click to turn on)'}
              aria-label="Toggle shuffle mode"
              aria-pressed={isShuffle}
            >
              <Shuffle className="w-4 h-4" />
              {isShuffle && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-500 shadow-xs" />
              )}
            </button>

            {/* Previous */}
            <button
              onClick={onPrevious}
              className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-[#21262d] active:scale-95 transition-all"
              title="Previous Track"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={onTogglePlay}
              disabled={isLoadingAudio}
              className="w-11 h-11 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center shadow-glow-brand hover:scale-105 active:scale-95 transition-all disabled:opacity-75"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoadingAudio ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={onNext}
              className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-[#21262d] active:scale-95 transition-all"
              title="Next Track"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            {/* Repeat Mode */}
            <button
              onClick={onCycleRepeat}
              className={`p-2 rounded-full transition-colors relative ${
                repeatMode !== 'off'
                  ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#21262d]'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'track' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
              {repeatMode !== 'off' && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-500" />
              )}
            </button>
          </div>

          {/* Range Request Seek Bar */}
          <div className="w-full flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span className="w-10 text-right">{formatTime(displayTime)}</span>
            <div className="relative flex-1 flex items-center group py-2">
              {/* Background Track */}
              <div className="absolute left-0 right-0 h-1.5 bg-slate-200 dark:bg-[#30363d] rounded-full overflow-hidden pointer-events-none">
                {/* Buffered Segment */}
                <div
                  className="h-full bg-slate-300/80 dark:bg-slate-600/80 transition-all duration-200"
                  style={{ width: `${Math.min(100, bufferedPercent)}%` }}
                />
                {/* Active Playhead Segment */}
                <div
                  className="h-full bg-brand-500 shadow-glow-brand transition-all duration-75 -mt-1.5"
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
              </div>

              {/* Native range input for universal cross-browser scrubbing */}
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                value={displayTime}
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                onChange={handleSeekChange}
                onMouseUp={handleSeekEnd}
                onTouchEnd={handleSeekEnd}
                className="w-full h-1.5 opacity-0 cursor-pointer z-10"
                aria-label="Seek track position"
              />
            </div>
            <span className="w-10 text-left">{formatTime(duration)}</span>
          </div>

          {audioError && (
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 text-xs mt-1 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{audioError}</span>
            </div>
          )}
        </div>

        {/* Right: Volume & Queue Toggle */}
        <div className="hidden md:flex items-center justify-end gap-3 w-1/4">
          {/* Volume Control */}
          <div className="flex items-center gap-2 group">
            <button
              onClick={onToggleMute}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-500" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <div className="w-20 relative flex items-center">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-200 dark:bg-[#30363d] rounded-lg appearance-none cursor-pointer accent-brand-500"
                aria-label="Volume slider"
              />
            </div>
          </div>

          {/* Queue Drawer Button */}
          <button
            onClick={onToggleQueue}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-xs font-semibold ${
              isQueueOpen
                ? 'bg-brand-500 text-white border-brand-500 shadow-glow-brand'
                : 'bg-slate-100 dark:bg-[#21262d] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#30363d] border-slate-200 dark:border-[#30363d]'
            }`}
            title="Playlist Queue"
          >
            <ListMusic className="w-4 h-4" />
            <span>Queue</span>
            {queueCount > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isQueueOpen ? 'bg-white/20 text-white' : 'bg-ghblue-100 dark:bg-ghblue-950/60 text-ghblue-700 dark:text-ghblue-300'
              }`}>
                {queueCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Player;
