import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, DownloadCloud, X } from 'lucide-react';

/**
 * ============================================================================
 * PWA SERVICE WORKER AUTO-UPDATE TOAST (GitHub Theme)
 * ============================================================================
 */
export function PwaUpdateToast() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegistered(r) {
      console.log('Service Worker registered successfully:', r);
    },
    onRegisterError(error) {
      console.error('Service Worker registration failed:', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 max-w-sm w-full p-4 rounded-2xl bg-white dark:bg-[#161b22] border border-brand-300 dark:border-[#30363d] shadow-2xl animate-in slide-in-from-bottom duration-300">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800/60 flex items-center justify-center shrink-0 mt-0.5">
          {needRefresh ? <RefreshCw className="w-4 h-4 animate-spin-slow" /> : <DownloadCloud className="w-4 h-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-slate-900 dark:text-[#f0f6fc]">
            {needRefresh ? 'Update Available' : 'Ready for Offline Play'}
          </h4>
          <p className="text-xs text-slate-600 dark:text-[#8b949e] mt-1">
            {needRefresh
              ? 'A newer version of MyGroove is installed. Refresh to apply.'
              : 'MyGroove app shell is cached and ready to launch without internet!'}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {needRefresh && (
              <button
                onClick={() => updateServiceWorker(true)}
                className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-glow-brand"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Now</span>
              </button>
            )}
            <button
              onClick={close}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-slate-700 dark:text-[#f0f6fc] text-xs font-medium transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button
          onClick={close}
          className="text-slate-400 hover:text-slate-700 dark:hover:text-[#f0f6fc] transition-colors p-1 -mr-1 -mt-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default PwaUpdateToast;
