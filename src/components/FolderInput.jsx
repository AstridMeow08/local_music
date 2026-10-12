import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  ArrowRight,
  History,
  AlertCircle,
  Zap,
  Edit2,
  Trash2,
  Sparkles,
  Music2,
  ChevronDown,
} from 'lucide-react';
import { extractFolderId } from '../services/driveApi';
import { isDirectOrR2Url } from '../services/r2Service';
import { IosEmojiPicker } from './IosEmojiPicker';
import { IosEmoji } from './IosEmoji';
import { EditPlaylistModal } from './EditPlaylistModal';
import {
  IOS_QUICK_EMOJIS,
  extractLeadingEmoji,
  cleanPlaylistTitle,
  generateDefaultPlaylistName,
} from '../utils/iosEmojis';

/**
 * ============================================================================
 * FOLDER & PLAYLIST INPUT COMPONENT (WITH IOS EMOJI & PLAYLIST NAMING)
 * ============================================================================
 * Allows users to add Cloudflare R2 / S2 buckets or Google Drive folders,
 * give them custom playlist names with authentic iOS emojis, and edit them
 * freely both while adding and afterwards from their saved playlist library.
 * ============================================================================
 */
export function FolderInput({
  currentFolderId,
  currentPlaylistName = '',
  currentPlaylistEmoji = '🎵',
  onLoadFolder,
  isLoading,
  folderHistory = [],
  onSelectHistory,
  onUpdatePlaylist,
  onDeletePlaylist,
  onOpenSettings,
}) {
  const isInitialR2 = currentFolderId ? isDirectOrR2Url(currentFolderId) : true;
  const [activeTab, setActiveTab] = useState(isInitialR2 ? 'r2' : 'gdrive');
  const [inputVal, setInputVal] = useState(currentFolderId || '');
  const [playlistName, setPlaylistName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎧');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [parseError, setParseError] = useState('');

  const emojiTriggerRef = useRef(null);

  // Sync state when currentFolderId changes
  useEffect(() => {
    if (currentFolderId) {
      setInputVal(currentFolderId);
      const isR2 = isDirectOrR2Url(currentFolderId);
      setActiveTab(isR2 ? 'r2' : 'gdrive');

      // Check if we already have this in history
      const existing = folderHistory.find((f) => f.id === currentFolderId);
      if (existing) {
        const em = existing.emoji || extractLeadingEmoji(existing.name) || (isR2 ? '⚡' : '🎧');
        setSelectedEmoji(em);
        setPlaylistName(cleanPlaylistTitle(existing.name, em));
      } else if (currentPlaylistName) {
        setSelectedEmoji(currentPlaylistEmoji || (isR2 ? '⚡' : '🎧'));
        setPlaylistName(cleanPlaylistTitle(currentPlaylistName, currentPlaylistEmoji));
      } else {
        const defaults = generateDefaultPlaylistName(currentFolderId);
        setSelectedEmoji(defaults.emoji);
        setPlaylistName(defaults.name);
      }
    }
  }, [currentFolderId, folderHistory, currentPlaylistName, currentPlaylistEmoji]);

  // When user pastes/changes the URL, auto-suggest a smart playlist name if blank
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);
    if (parseError) setParseError('');

    if (val.trim()) {
      const isR2 = isDirectOrR2Url(val.trim());
      if (isR2 && activeTab !== 'r2') setActiveTab('r2');
      if (!isR2 && (val.includes('drive.google.com') || val.length > 20) && activeTab !== 'gdrive') {
        setActiveTab('gdrive');
      }

      if (!playlistName || playlistName === 'My Playlist') {
        const smart = generateDefaultPlaylistName(val.trim());
        setSelectedEmoji(smart.emoji);
        setPlaylistName(smart.name);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setParseError('');

    const trimmed = inputVal.trim();
    if (!trimmed) {
      setParseError(
        activeTab === 'r2'
          ? 'Please enter your Cloudflare R2 public bucket URL (e.g. https://pub-xxx.r2.dev).'
          : 'Please enter a Google Drive folder URL or ID.'
      );
      return;
    }

    const finalName = playlistName.trim() || 'My Playlist';
    const finalEmoji = selectedEmoji || '🎵';

    // Auto-detect R2 or direct web URL
    if (isDirectOrR2Url(trimmed)) {
      onLoadFolder(trimmed, finalName, finalEmoji);
      return;
    }

    // If it's a Google Drive link or ID
    const folderId = extractFolderId(trimmed);
    if (folderId) {
      onLoadFolder(trimmed, finalName, finalEmoji);
      return;
    }

    // Unrecognized format
    if (activeTab === 'r2') {
      setParseError(
        'Invalid R2 URL. Please enter a valid URL starting with https:// (e.g. https://pub-xxxxxx.r2.dev).'
      );
    } else {
      setParseError(
        'Could not find a valid Google Drive folder ID. Make sure the URL looks like "drive.google.com/drive/folders/..." or enter the raw ID.'
      );
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-8">
      {/* Source Selector Tabs */}
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('r2');
            setParseError('');
            if (!playlistName || playlistName === 'Drive Sound Vault') {
              setSelectedEmoji('⚡');
              setPlaylistName('Cloudflare R2 Bucket');
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'r2'
              ? 'bg-brand-500 text-white shadow-glow-brand font-bold'
              : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#21262d] border border-slate-200 dark:border-[#30363d]'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${activeTab === 'r2' ? 'text-white' : 'text-amber-500'}`} />
          <span>Cloudflare R2 / S2 Bucket</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('gdrive');
            setParseError('');
            if (!playlistName || playlistName === 'Cloudflare R2 Bucket') {
              setSelectedEmoji('🎧');
              setPlaylistName('Drive Sound Vault');
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'gdrive'
              ? 'bg-brand-500 text-white shadow-glow-brand font-bold'
              : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#21262d] border border-slate-200 dark:border-[#30363d]'
          }`}
        >
          <Folder className={`w-3.5 h-3.5 ${activeTab === 'gdrive' ? 'text-white' : 'text-ghblue-500'}`} />
          <span>Google Drive</span>
        </button>
      </div>

      {/* Main Glass Input Panel */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] relative overflow-visible transition-colors">
        {/* Glow ambient background accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none transition-colors duration-500 bg-brand-500/10 dark:bg-brand-500/5" />

        <form onSubmit={handleSubmit} className="space-y-3.5 relative z-10">
          {/* 1. Storage Link / Bucket URL Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {activeTab === 'r2' ? 'R2 / S2 Public Bucket Link' : 'Google Drive Folder Link or ID'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputVal}
                onChange={handleInputChange}
                placeholder={
                  activeTab === 'r2'
                    ? 'https://pub-xxxxxxxxxxxxxxxxxxxxxxxx.r2.dev/music'
                    : 'https://drive.google.com/drive/folders/1bckVOCDga_6v9NXSyBslNSgs6ZIWOp7n'
                }
                className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-mono glass-input text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-[#0d1117] border-slate-300 dark:border-[#30363d]"
              />
            </div>
          </div>

          {/* 2. Playlist Name (Editable While Adding) with iOS Emoji Picker */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5 text-brand-500" />
                <span>Playlist Name & iOS Emoji</span>
                <span className="text-[10px] text-brand-600 dark:text-brand-400 font-normal">
                  (Editable while adding)
                </span>
              </label>

              {/* Active preview pill */}
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#21262d] px-2 py-0.5 rounded-full border border-slate-200 dark:border-[#30363d]">
                <IosEmoji emoji={selectedEmoji} size={14} />
                <span className="truncate max-w-[120px]">{playlistName || 'My Playlist'}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2 relative">
              {/* iOS Emoji Trigger Button */}
              <div className="relative">
                <button
                  ref={emojiTriggerRef}
                  type="button"
                  onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#0d1117] dark:hover:bg-[#21262d] border border-slate-300 dark:border-[#30363d] flex items-center justify-between sm:justify-center gap-2 transition-transform active:scale-95 shadow-xs"
                  title="Choose authentic iOS Emoji"
                >
                  <IosEmoji emoji={selectedEmoji} size={22} />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:hidden">
                    Change Emoji
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Popover */}
                <IosEmojiPicker
                  isOpen={isEmojiPickerOpen}
                  selectedEmoji={selectedEmoji}
                  onSelectEmoji={(newEmoji) => {
                    setSelectedEmoji(newEmoji);
                    setIsEmojiPickerOpen(false);
                  }}
                  onClose={() => setIsEmojiPickerOpen(false)}
                  triggerRef={emojiTriggerRef}
                />
              </div>

              {/* Editable Name Input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="e.g. Midnight Beats, Workout EDM, Chill Lofi..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold glass-input text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-[#0d1117] border-slate-300 dark:border-[#30363d]"
                />
              </div>

              {/* Load Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 shrink-0 bg-brand-500 hover:bg-brand-600 text-white shadow-glow-brand"
              >
                <span>{isLoading ? 'Connecting...' : 'Load Playlist'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick iOS Emoji Selector Bar */}
          <div className="pt-1 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#8b949e] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>iOS Emojis:</span>
            </span>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
              {IOS_QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setSelectedEmoji(em)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-transform hover:scale-125 active:scale-95 ${
                    selectedEmoji === em
                      ? 'bg-brand-100 dark:bg-brand-950/60 ring-2 ring-brand-500 shadow-xs'
                      : 'hover:bg-slate-100 dark:hover:bg-[#21262d]'
                  }`}
                  title={`Use ${em}`}
                >
                  <IosEmoji emoji={em} size={18} />
                </button>
              ))}
            </div>
          </div>

          {/* Error Notice */}
          {parseError && (
            <div className="flex items-start gap-2 text-red-700 dark:text-red-300 text-xs mt-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500 dark:text-red-400" />
              <span>{parseError}</span>
            </div>
          )}
        </form>

        {/* Saved Playlists History (Shows Playlist Names & iOS Emojis instead of raw URLs) */}
        {folderHistory && folderHistory.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#21262d] relative z-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <History className="w-3.5 h-3.5" />
                <span>Your Playlists:</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Click to load • Tap ✏️ to rename
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {folderHistory.map((f) => {
                const isR2Item = isDirectOrR2Url(f.id);
                const itemEmoji = f.emoji || extractLeadingEmoji(f.name) || (isR2Item ? '⚡' : '🎧');
                const displayName = cleanPlaylistTitle(f.name, itemEmoji);
                const isCurrent = currentFolderId === f.id;

                return (
                  <div
                    key={f.id}
                    className={`group pl-2.5 pr-1.5 py-1 rounded-xl text-xs transition-all border flex items-center gap-2 ${
                      isCurrent
                        ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-700 font-semibold shadow-xs'
                        : 'bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#30363d]'
                    }`}
                  >
                    {/* Clickable Area to Load Playlist */}
                    <button
                      type="button"
                      onClick={() => {
                        setInputVal(f.id);
                        setActiveTab(isR2Item ? 'r2' : 'gdrive');
                        setPlaylistName(displayName);
                        setSelectedEmoji(itemEmoji);
                        onSelectHistory(f.id, displayName, itemEmoji);
                      }}
                      className="flex items-center gap-2 text-left truncate"
                      title={`Load Playlist: ${displayName} (${f.id})`}
                    >
                      <IosEmoji emoji={itemEmoji} size={16} />
                      <span className="font-semibold truncate max-w-[150px] sm:max-w-[190px]">
                        {displayName}
                      </span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-sans font-bold uppercase tracking-wider shrink-0 ${
                          isR2Item
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                            : 'bg-ghblue-100 dark:bg-ghblue-950/80 text-ghblue-800 dark:text-ghblue-300'
                        }`}
                      >
                        {isR2Item ? 'R2' : 'Drive'}
                      </span>
                    </button>

                    {/* Edit / Rename Button (✏️) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPlaylist(f);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#161b22] transition-colors"
                      title="Rename Playlist & Change iOS Emoji"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    {/* Delete Playlist Button (✕) */}
                    {onDeletePlaylist && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePlaylist(f.id);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Remove from history"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Edit Playlist Modal */}
      <EditPlaylistModal
        isOpen={!!editingPlaylist}
        playlist={editingPlaylist}
        onClose={() => setEditingPlaylist(null)}
        onSave={(id, updates) => {
          onUpdatePlaylist?.(id, updates);
          if (currentFolderId === id) {
            setPlaylistName(updates.name);
            setSelectedEmoji(updates.emoji);
          }
        }}
        onDelete={(id) => {
          onDeletePlaylist?.(id);
        }}
      />
    </div>
  );
}

export default FolderInput;
