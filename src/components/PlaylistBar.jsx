import React, { useRef } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Music2,
  Sparkles,
} from 'lucide-react';
import { isDirectOrR2Url } from '../services/r2Service';
import { cleanPlaylistTitle, extractLeadingEmoji } from '../utils/iosEmojis';
import { IosEmoji } from './IosEmoji';

/**
 * ============================================================================
 * PLAYLIST BAR COMPONENT (SIMPLIFIED HORIZONTAL PLAYLIST SELECTOR)
 * ============================================================================
 * Displays only playlist names and iOS emojis horizontally.
 * Includes "+ Add Playlist" button that opens the cloud link modal.
 * Scrollable horizontally with hidden scrollbars for clean minimal aesthetics.
 * ============================================================================
 */
export function PlaylistBar({
  playlists = [],
  currentPlaylistId = '',
  onSelectPlaylist,
  onOpenAddModal,
  onEditPlaylist,
  onDeletePlaylist,
  isLoading = false,
}) {
  const scrollContainerRef = useRef(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -220, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 220, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Your Playlists
          </h2>
          {playlists.length > 0 && (
            <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-[#21262d] text-slate-600 dark:text-slate-400">
              {playlists.length}
            </span>
          )}
        </div>

        {/* Scroll Helper Arrows (visible on desktop if list is wide) */}
        {playlists.length > 3 && (
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={scrollLeft}
              className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-[#21262d] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="Scroll left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={scrollRight}
              className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-[#21262d] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="Scroll right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Horizontal Scrollable Container (Scrollbar completely hidden via no-scrollbar) */}
      <div className="relative flex items-center gap-2.5">
        {/* Primary "+ Add Playlist" Button */}
        <button
          type="button"
          onClick={onOpenAddModal}
          className="group flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-500 hover:to-amber-500 text-white font-semibold text-xs shadow-sm hover:shadow-md transition-all active:scale-95 shrink-0"
          title="Add New Playlist (Connect Google Drive or Cloudflare R2 / S2 Bucket)"
        >
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:rotate-90">
            <Plus className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="whitespace-nowrap">Add Playlist</span>
        </button>

        {/* Scrollable Playlist Chips */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-0.5"
        >
          {playlists.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 italic">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>No playlists yet. Click "Add Playlist" to connect Google Drive or R2/S2 bucket.</span>
            </div>
          ) : (
            playlists.map((f) => {
              const isR2Item = isDirectOrR2Url(f.id);
              const itemEmoji = f.emoji || extractLeadingEmoji(f.name) || (isR2Item ? '⚡' : '🎧');
              const displayName = cleanPlaylistTitle(f.name, itemEmoji);
              const isCurrent = currentPlaylistId === f.id;

              return (
                <div
                  key={f.id}
                  className={`group relative flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-2xl text-xs transition-all border shrink-0 select-none ${
                    isCurrent
                      ? 'bg-slate-900 text-white dark:bg-brand-600 dark:text-white border-slate-900 dark:border-brand-500 font-semibold shadow-md ring-2 ring-brand-500/30'
                      : 'bg-white dark:bg-[#161b22] hover:bg-slate-50 dark:hover:bg-[#21262d] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#30363d] shadow-2xs'
                  }`}
                >
                  {/* Playlist Click Target to load songs */}
                  <button
                    type="button"
                    onClick={() => onSelectPlaylist(f.id, displayName, itemEmoji)}
                    className="flex items-center gap-2 text-left cursor-pointer"
                    title={`Select Playlist: ${displayName}`}
                  >
                    <IosEmoji emoji={itemEmoji} size={18} />
                    <span className="whitespace-nowrap font-semibold max-w-[160px] sm:max-w-[220px] truncate">
                      {displayName}
                    </span>
                  </button>

                  {/* Actions: Edit & Delete buttons */}
                  <div className="flex items-center ml-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    {/* Rename / Emoji Edit */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditPlaylist?.(f);
                      }}
                      className={`p-1 rounded-lg transition-colors ${
                        isCurrent
                          ? 'hover:bg-white/20 text-white/80 hover:text-white'
                          : 'hover:bg-slate-200/60 dark:hover:bg-[#30363d] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                      title="Rename Playlist & Change iOS Emoji"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    {/* Delete Playlist */}
                    {onDeletePlaylist && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePlaylist(f.id);
                        }}
                        className={`p-1 rounded-lg transition-colors ${
                          isCurrent
                            ? 'hover:bg-red-500/30 text-white/70 hover:text-red-200'
                            : 'hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500'
                        }`}
                        title="Remove playlist"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default PlaylistBar;
