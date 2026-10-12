import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Trash2, Smile, Zap, Folder, Edit3 } from 'lucide-react';
import { IosEmojiPicker } from './IosEmojiPicker';
import { IosEmoji } from './IosEmoji';
import { IOS_QUICK_EMOJIS, cleanPlaylistTitle, extractLeadingEmoji } from '../utils/iosEmojis';
import { isDirectOrR2Url } from '../services/r2Service';

/**
 * ============================================================================
 * EDIT PLAYLIST MODAL
 * ============================================================================
 * Allows the user to rename their playlist, pick an authentic iOS emoji,
 * or remove the playlist from their saved list.
 * ============================================================================
 */
export function EditPlaylistModal({
  isOpen,
  playlist,
  onClose,
  onSave,
  onDelete,
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎵');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const emojiButtonRef = useRef(null);

  useEffect(() => {
    if (playlist) {
      const extracted = extractLeadingEmoji(playlist.name);
      const initialEmoji = playlist.emoji || extracted || '🎵';
      const initialName = cleanPlaylistTitle(playlist.name, initialEmoji);
      setEmoji(initialEmoji);
      setName(initialName);
    }
  }, [playlist]);

  if (!isOpen || !playlist) return null;

  const isR2 = isDirectOrR2Url(playlist.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalName = name.trim() || 'My Playlist';
    onSave?.(playlist.id, {
      name: finalName,
      emoji,
    });
    onClose?.();
  };

  const handleSelectQuickEmoji = (em) => {
    setEmoji(em);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] shadow-2xl p-5 relative overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#21262d] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-[#f0f6fc]">
                Rename Playlist
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#8b949e]">
                Customize your playlist title and iOS emoji
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#21262d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* iOS Emoji & Playlist Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Playlist Name & iOS Emoji
            </label>
            <div className="flex items-center gap-2 relative">
              {/* Emoji Avatar Button */}
              <button
                ref={emojiButtonRef}
                type="button"
                onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] border border-slate-200 dark:border-[#30363d] flex items-center justify-center transition-transform active:scale-95 shrink-0 shadow-xs"
                title="Change iOS Emoji"
              >
                <IosEmoji emoji={emoji} size={24} />
              </button>

              {/* Title Input */}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Midnight Beats, Gym Hype..."
                className="flex-1 px-3.5 py-2.5 rounded-xl text-sm glass-input text-slate-900 dark:text-white bg-slate-50 dark:bg-[#0d1117] border-slate-300 dark:border-[#30363d]"
                autoFocus
              />

              {/* Popover */}
              <IosEmojiPicker
                isOpen={isEmojiPickerOpen}
                selectedEmoji={emoji}
                onSelectEmoji={(newEm) => {
                  setEmoji(newEm);
                  setIsEmojiPickerOpen(false);
                }}
                onClose={() => setIsEmojiPickerOpen(false)}
                triggerRef={emojiButtonRef}
              />
            </div>
          </div>

          {/* Quick iOS Emoji bar */}
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#8b949e] mb-1.5 block">
              Quick iOS Emojis:
            </span>
            <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl bg-slate-50 dark:bg-[#0d1117] border border-slate-200/80 dark:border-[#30363d]">
              {IOS_QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => handleSelectQuickEmoji(em)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform hover:scale-125 active:scale-95 ${
                    emoji === em
                      ? 'bg-white dark:bg-[#21262d] shadow-xs ring-2 ring-brand-500'
                      : 'hover:bg-white/80 dark:hover:bg-[#161b22]'
                  }`}
                  title={em}
                >
                  <IosEmoji emoji={em} size={20} />
                </button>
              ))}
            </div>
          </div>

          {/* Source Link Reference */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            {isR2 ? (
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-ghblue-500 shrink-0" />
            )}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {isR2 ? 'Cloudflare R2 Bucket:' : 'Google Drive:'}
            </span>
            <span className="font-mono truncate">{playlist.id}</span>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#21262d]">
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(playlist.id);
                  onClose?.();
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900/60 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#21262d] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 shadow-glow-brand flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditPlaylistModal;
