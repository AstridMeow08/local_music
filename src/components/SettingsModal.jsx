import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  FolderLock,
  ExternalLink,
  HardDrive,
  Trash2,
  Check,
  AlertTriangle,
  Info,
  Radio
} from 'lucide-react';
import { formatBytes } from '../utils/formatters';

/**
 * ============================================================================
 * SETTINGS & GOOGLE CLOUD ACCESS MODAL (GitHub Theme)
 * ============================================================================
 * Allows users to configure their Google Cloud API key in client memory/IndexedDB,
 * view local storage quota, and provides full step-by-step setup instructions.
 * ============================================================================
 */
export function SettingsModal({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  offlineCount,
  onClearOfflineData,
  onToast,
}) {
  const [keyValue, setKeyValue] = useState(apiKey || '');
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageQuota, setStorageQuota] = useState(0);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setKeyValue(apiKey || '');
  }, [apiKey]);

  useEffect(() => {
    if (isOpen && 'storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((est) => {
        setStorageUsed(est.usage || 0);
        setStorageQuota(est.quota || 0);
      });
    }
  }, [isOpen, offlineCount]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSaveApiKey(keyValue.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    if (onToast) {
      onToast({
        title: 'Settings Saved',
        message: 'Google Cloud API key updated in local IndexedDB storage.',
        type: 'success',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
      <div
        className="w-full max-w-xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-[#30363d] flex items-center justify-between bg-white dark:bg-[#161b22]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black dark:bg-[#0d1117] border border-slate-700/70 flex items-center justify-center p-1.5 shadow-xs">
              <img src="/mygroove-symbol.png" alt="MyGroove" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#f0f6fc]">Settings & Access Model</h3>
              <p className="text-xs text-slate-500 dark:text-[#8b949e]">Configure API keys, offline storage & permissions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-[#f0f6fc] rounded-xl hover:bg-slate-100 dark:hover:bg-[#21262d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-slate-700 dark:text-slate-300 text-sm bg-white dark:bg-[#161b22]">
          {/* API Key Form */}
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#8b949e] mb-1.5">
                Google Cloud API Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm glass-input text-slate-900 dark:text-[#f0f6fc] font-mono bg-white dark:bg-[#0d1117] border-slate-300 dark:border-[#30363d]"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#8b949e] mt-1.5">
                Stored purely in your browser's IndexedDB. Never transmitted to any third-party server.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500 dark:text-[#8b949e]">
                {apiKey ? 'API Key is saved locally in IndexedDB' : 'No API key configured yet'}
              </span>
              <div className="flex items-center gap-2">
                {keyValue && (
                  <button
                    type="button"
                    onClick={() => {
                      setKeyValue('');
                      onSaveApiKey('');
                      if (onToast) {
                        onToast({
                          title: 'API Key Cleared',
                          message: 'Removed from local IndexedDB storage.',
                          type: 'info',
                        });
                      }
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/40 transition-colors"
                  >
                    Clear Key
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-glow-brand transition-all"
                >
                  {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{isSaved ? 'Saved!' : 'Save API Key'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Offline Storage Section */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-[#f0f6fc]">
                  Local Storage (IndexedDB)
                </span>
              </div>
              <span className="text-xs text-brand-600 dark:text-brand-400 font-bold">
                {offlineCount} {offlineCount === 1 ? 'track' : 'tracks'} pinned
              </span>
            </div>

            {storageUsed > 0 && (
              <div className="text-xs text-slate-600 dark:text-[#8b949e]">
                <div className="flex justify-between mb-1">
                  <span>Used by MyGroove:</span>
                  <span className="font-mono text-slate-800 dark:text-[#f0f6fc] font-semibold">{formatBytes(storageUsed)}</span>
                </div>
                {storageQuota > 0 && (
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-[#21262d] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, (storageUsed / storageQuota) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {offlineCount > 0 && (
              <button
                type="button"
                onClick={onClearOfflineData}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline flex items-center gap-1 pt-1 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear all pinned offline audio blobs</span>
              </button>
            )}
          </div>

          {/* Step-by-Step Google Cloud Guide */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-[#30363d]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-[#f0f6fc]">
                Setup & Access Security Model
              </h4>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-[#8b949e] leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d]">
                <strong className="text-slate-900 dark:text-[#f0f6fc] block mb-1">1. Why an API Key is Safe Here:</strong>
                Because this app is 100% client-side with no backend, we use a Google Cloud API Key restricted by:
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-700 dark:text-slate-300">
                  <li><strong>API scope:</strong> Google Drive API only.</li>
                  <li><strong>HTTP Referrers:</strong> Your exact domain (e.g. <code>https://your-app.com/*</code>) or <code>http://localhost:*</code>.</li>
                </ul>
                This prevents unauthorized third-party usage and requires no secrets or OAuth token refreshes.
              </div>

              <div className="p-3 rounded-xl bg-ghblue-50/70 dark:bg-ghblue-950/30 border border-ghblue-200 dark:border-ghblue-900/60 text-slate-700 dark:text-slate-300">
                <strong className="text-ghblue-900 dark:text-ghblue-300 block mb-1 flex items-center gap-1.5 font-bold">
                  <FolderLock className="w-3.5 h-3.5 text-ghblue-600 dark:text-ghblue-400" />
                  2. "Anyone with the link" Requirement:
                </strong>
                The API key can ONLY access files that the owner explicitly shared. In Google Drive, right-click your folder → <em>Share</em> → Change General Access to <strong>"Anyone with the link"</strong> (Viewer). Private files will return HTTP 403 Forbidden.
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d]">
                <strong className="text-slate-900 dark:text-[#f0f6fc] block mb-1 font-bold">3. Creating your Key in Google Cloud:</strong>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Go to Google Cloud Console → <em>APIs & Services</em> → <em>Library</em>.</li>
                  <li>Search for and enable <strong>Google Drive API</strong>.</li>
                  <li>Go to <em>Credentials</em> → <em>Create Credentials</em> → <em>API Key</em>.</li>
                  <li>Under <em>API Restrictions</em>, select <em>Google Drive API</em>.</li>
                  <li>Under <em>Application Restrictions</em>, choose <em>Websites</em> and add your domain.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#161b22] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-[#21262d] hover:bg-slate-300 dark:hover:bg-[#30363d] text-slate-800 dark:text-[#f0f6fc] text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
