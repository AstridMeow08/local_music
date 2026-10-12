import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Sparkles, Check } from 'lucide-react';
import { IOS_QUICK_EMOJIS, IOS_EMOJI_CATEGORIES } from '../utils/iosEmojis';
import { IosEmoji } from './IosEmoji';

/**
 * ============================================================================
 * AUTHENTIC APPLE / IOS EMOJI PICKER POPOVER
 * ============================================================================
 * - Auto-flips upward if space below is limited to avoid clipping off-screen.
 * - Fully scrollable emoji grid with dedicated custom scrollbar.
 * - Deep emoji library with 32+ emojis per category.
 * - Instant live search across all categories and keyboard emoji typing.
 * ============================================================================
 */
export function IosEmojiPicker({
  selectedEmoji = '🎵',
  onSelectEmoji,
  isOpen = false,
  onClose,
  triggerRef,
}) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [placement, setPlacement] = useState('bottom'); // 'bottom' | 'top'
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);

  // Auto-flip placement calculation
  useEffect(() => {
    if (!isOpen) return;

    const computePlacement = () => {
      if (!triggerRef?.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // If space below is less than 360px and there's more room above, flip upward
      if (spaceBelow < 360 && spaceAbove > spaceBelow) {
        setPlacement('top');
      } else {
        setPlacement('bottom');
      }
    };

    computePlacement();
    window.addEventListener('resize', computePlacement);
    return () => window.removeEventListener('resize', computePlacement);
  }, [isOpen, triggerRef]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        (!triggerRef?.current || !triggerRef.current.contains(e.target))
      ) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  // Flatten all emojis for search
  const allEmojis = useMemo(() => {
    const set = new Set();
    IOS_QUICK_EMOJIS.forEach((em) => set.add(em));
    IOS_EMOJI_CATEGORIES.forEach((cat) => {
      cat.emojis.forEach((em) => set.add(em));
    });
    return Array.from(set);
  }, []);

  // Filtered emojis if searching
  const filteredEmojis = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return null;
    // If user pasted/typed a raw emoji or query
    return allEmojis.filter((em) => em.includes(q));
  }, [searchQuery, allEmojis]);

  if (!isOpen) return null;

  const currentCategory = IOS_EMOJI_CATEGORIES[activeCategory] || IOS_EMOJI_CATEGORIES[0];
  const displayedEmojis = filteredEmojis !== null ? filteredEmojis : currentCategory.emojis;

  return (
    <div
      ref={popoverRef}
      className={`absolute z-50 left-0 ${
        placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
      } w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] shadow-2xl p-3 flex flex-col backdrop-blur-xl animate-in fade-in duration-150 max-h-[min(480px,80vh)]`}
      style={{
        boxShadow:
          '0 20px 40px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0,0,0,0.06)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-[#21262d] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center border border-brand-200/80 dark:border-brand-800">
            <IosEmoji emoji={selectedEmoji} size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-[#f0f6fc] leading-tight">
              Choose iOS Playlist Emoji
            </div>
            <div className="text-[10px] text-slate-400">
              Authentic Apple Color Emojis
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#21262d] transition-colors"
          title="Close Picker"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search / Paste Input */}
      <div className="relative mb-2 shrink-0">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search vibe or paste emoji..."
          className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] focus:border-brand-500 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Category Tabs (shown when not searching) */}
      {!searchQuery && (
        <div className="flex items-center gap-1 mb-2 overflow-x-auto no-scrollbar pb-1 shrink-0 text-xs">
          {IOS_EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(idx)}
              className={`px-2.5 py-1 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 text-[11px] font-semibold shrink-0 ${
                activeCategory === idx
                  ? 'bg-brand-500 text-white shadow-xs font-bold'
                  : 'bg-slate-100 dark:bg-[#21262d] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#30363d]'
              }`}
            >
              <IosEmoji emoji={cat.icon} size={14} />
              <span>{cat.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Scrollable Emoji Section */}
      <div className="flex-1 min-h-[170px] max-h-56 sm:max-h-64 emoji-picker-grid p-1.5 rounded-xl bg-slate-50/80 dark:bg-[#0d1117] border border-slate-200/80 dark:border-[#30363d]">
        {displayedEmojis.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-slate-400">
            <Sparkles className="w-5 h-5 text-amber-500 mb-1" />
            <span>No matching emoji found.</span>
            <button
              type="button"
              onClick={() => {
                if (searchQuery.trim()) {
                  onSelectEmoji(searchQuery.trim());
                  onClose?.();
                }
              }}
              className="mt-2 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
            >
              Use "{searchQuery.trim()}" as custom emoji
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1.5">
            {displayedEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelectEmoji(emoji);
                  onClose?.();
                }}
                className={`h-9 rounded-xl flex items-center justify-center transition-all hover:scale-125 active:scale-95 ${
                  selectedEmoji === emoji
                    ? 'bg-brand-500 text-white shadow-glow-brand ring-2 ring-brand-500'
                    : 'hover:bg-slate-200/80 dark:hover:bg-[#21262d]'
                }`}
                title={emoji}
              >
                <IosEmoji emoji={emoji} size={22} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer Hint */}
      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-[#21262d] flex items-center justify-between text-[10px] text-slate-400 shrink-0">
        <span>Scroll to see all {displayedEmojis.length} emojis</span>
        <span className="font-mono">{currentCategory.name}</span>
      </div>
    </div>
  );
}

export default IosEmojiPicker;
