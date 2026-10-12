import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Zap,
  Folder,
  Sparkles,
  AlertCircle,
  Clipboard,
  Music2,
  ChevronDown,
  Key,
} from 'lucide-react';
import { extractFolderId } from '../services/driveApi';
import { isDirectOrR2Url } from '../services/r2Service';
import { IosEmojiPicker } from './IosEmojiPicker';
import { IosEmoji } from './IosEmoji';
import {
  IOS_QUICK_EMOJIS,
  cleanPlaylistTitle,
  generateDefaultPlaylistName,
} from '../utils/iosEmojis';

/**
 * ============================================================================
 * ADD PLAYLIST MODAL
 * ============================================================================
 * Clean dialog opened when the user clicks "+ Add Playlist".
 * Supports both Cloudflare R2 / S2 buckets and Google Drive folders.
 * Features customizable playlist name and authentic iOS emoji picker.
 * Allows entering or modifying Google API Key directly with IndexedDB storage.
 * ============================================================================
 */
export function AddPlaylistModal({
  isOpen,
  onClose,
  onAddPlaylist,
  isLoading = false,
  apiKey = '',
  onSaveApiKey,
  onOpenSettings,
}) {
  const [activeTab, setActiveTab] = useState('r2'); // 'r2' | 'gdrive'
  const [urlInput, setUrlInput] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎧');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [driveApiKey, setDriveApiKey] = useState(apiKey || '');
  const [showKeyField, setShowKeyField] = useState(!apiKey);

  const emojiTriggerRef = useRef(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setUrlInput('');
      setPlaylistName('');
      setSelectedEmoji('🎧');
      setError('');
      setIsEmojiPickerOpen(false);
      setDriveApiKey(apiKey || '');
      setShowKeyField(!apiKey);
    }
  }, [isOpen, apiKey]);

  // Auto-detect tab based on pasted URL
  const handleUrlChange = (value) => {
    setUrlInput(value);
    setError('');

    const trimmed = value.trim();
    if (trimmed) {
      if (isDirectOrR2Url(trimmed)) {
        setActiveTab('r2');
        if (!playlistName) {
          setPlaylistName(generateDefaultPlaylistName(trimmed, 'r2'));
          setSelectedEmoji('⚡');
        }
      } else if (trimmed.includes('drive.google.com') || trimmed.includes('folders/')) {
        setActiveTab('gdrive');
        if (!playlistName) {
          setPlaylistName(generateDefaultPlaylistName(trimmed, 'gdrive'));
          setSelectedEmoji('📁');
        }
      }
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          handleUrlChange(text);
        }
      }
    } catch {
      // Clipboard access denied
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const trimmed = urlInput.trim();
    if (!trimmed) {
      setError(
        activeTab === 'r2'
          ? 'Please enter your Cloudflare R2 / S2 bucket URL.'
          : 'Please enter a Google Drive folder link or folder ID.'
      );
      return;
    }

    if (activeTab === 'gdrive') {
      const extracted = extractFolderId(trimmed);
      if (!extracted) {
        setError(
          'Could not find a valid Google Drive folder ID in the provided link. Please copy the folder link directly from Drive.'
        );
        return;
      }

      const effectiveKey = (driveApiKey || apiKey || '').trim();
      if (!effectiveKey) {
        setError(
          'A Google Cloud API Key is required to list and stream files from Google Drive. Please enter your API key below.'
        );
        setShowKeyField(true);
        return;
      }

      // Persist new API key to IndexedDB if entered here
      if (driveApiKey.trim() && driveApiKey.trim() !== apiKey && onSaveApiKey) {
        onSaveApiKey(driveApiKey.trim());
      }

      const finalName = playlistName.trim() || generateDefaultPlaylistName(extracted, 'gdrive');
      onAddPlaylist(extracted, finalName, selectedEmoji, effectiveKey);
    } else {
      // R2 / S2 / Direct URL
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        setError('Please enter a valid HTTP or HTTPS bucket link (e.g., https://pub-xxx.r2.dev/music).');
        return;
      }
      const finalName = playlistName.trim() || generateDefaultPlaylistName(trimmed, 'r2');
      onAddPlaylist(trimmed, finalName, selectedEmoji);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] shadow-2xl p-6 relative overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#21262d]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-black dark:bg-[#0d1117] border border-slate-700/60 flex items-center justify-center p-1.5 shadow-xs">
              <img src="/mygroove-symbol.png" alt="MyGroove" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Add New Playlist
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect your cloud storage to stream music anywhere
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#21262d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Tabs: Cloudflare R2 / S2 vs Google Drive */}
        <div className="flex p-1 bg-slate-100 dark:bg-[#21262d] rounded-2xl gap-1 mt-5 mb-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('r2');
              setError('');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'r2'
                ? 'bg-white dark:bg-[#161b22] text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Cloudflare R2 / S2 Bucket</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('gdrive');
              setError('');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'gdrive'
                ? 'bg-white dark:bg-[#161b22] text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Google Drive Folder</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cloud Storage URL / Folder Link */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {activeTab === 'r2' ? 'R2 / S2 Bucket URL' : 'Google Drive Folder Link or ID'}
              </label>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Clipboard className="w-3 h-3" />
                <span>Paste Link</span>
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={
                  activeTab === 'r2'
                    ? 'https://pub-xxxxxx.r2.dev/music or https://...'
                    : 'https://drive.google.com/drive/folders/1aBcDeFg... or Folder ID'
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0d1117] border border-slate-300 dark:border-[#30363d] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-xs font-mono text-slate-900 dark:text-white outline-none transition-all"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {activeTab === 'r2'
                ? 'Public R2 / S2 or S3 compatible audio bucket with CORS enabled.'
                : 'Make sure the folder is shared with "Anyone with the link" (Viewer).'}
            </p>
          </div>

          {/* Google Drive API Key Section */}
          {activeTab === 'gdrive' && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-brand-500" />
                  <span>Google Cloud API Key</span>
                </label>
                {apiKey && !showKeyField ? (
                  <button
                    type="button"
                    onClick={() => setShowKeyField(true)}
                    className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-semibold"
                  >
                    Change Key
                  </button>
                ) : null}
              </div>

              {!apiKey || showKeyField ? (
                <div>
                  <input
                    type="password"
                    value={driveApiKey}
                    onChange={(e) => {
                      setDriveApiKey(e.target.value);
                      setError('');
                    }}
                    placeholder="AIzaSy... (Saved locally to IndexedDB)"
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#161b22] border border-slate-300 dark:border-[#30363d] focus:border-brand-500 text-xs font-mono text-slate-900 dark:text-white outline-none"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Stored 100% locally in your browser's IndexedDB. Never transmitted to external servers.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>API Key active in local IndexedDB storage</span>
                </div>
              )}
            </div>
          )}

          {/* Playlist Name & iOS Emoji */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Playlist Name & iOS Emoji
            </label>
            <div className="flex items-center gap-2">
              {/* Emoji Picker Button */}
              <div className="relative">
                <button
                  ref={emojiTriggerRef}
                  type="button"
                  onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                  className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-[#0d1117] border border-slate-300 dark:border-[#30363d] hover:border-brand-500 flex items-center gap-1.5 transition-all shadow-2xs"
                  title="Choose authentic iOS Emoji"
                >
                  <IosEmoji emoji={selectedEmoji} size={22} />
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {/* Popover Emoji Picker */}
                <IosEmojiPicker
                  isOpen={isEmojiPickerOpen}
                  onClose={() => setIsEmojiPickerOpen(false)}
                  onSelectEmoji={(emoji) => {
                    setSelectedEmoji(emoji);
                    setIsEmojiPickerOpen(false);
                  }}
                  triggerRef={emojiTriggerRef}
                />
              </div>

              {/* Custom Playlist Name Input */}
              <input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder={
                  activeTab === 'r2'
                    ? 'e.g. Cloud Beats, Synthwave, Gym Mix'
                    : 'e.g. My Drive Playlist, Lofi Chill'
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0d1117] border border-slate-300 dark:border-[#30363d] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-xs text-slate-900 dark:text-white outline-none transition-all font-medium"
              />
            </div>
          </div>

          {/* Quick iOS Emojis */}
          <div>
            <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
              Popular Emojis:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {IOS_QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setSelectedEmoji(em)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                    selectedEmoji === em
                      ? 'bg-brand-100 dark:bg-brand-950/60 ring-2 ring-brand-500 shadow-xs scale-105'
                      : 'hover:bg-slate-100 dark:hover:bg-[#21262d]'
                  }`}
                  title={`Use ${em}`}
                >
                  <IosEmoji emoji={em} size={20} />
                </button>
              ))}
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-[#21262d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#21262d] transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isLoading || !urlInput.trim()}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-500 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{isLoading ? 'Loading...' : 'Add & Load Playlist'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddPlaylistModal;
