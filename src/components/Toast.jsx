import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { extractLeadingEmoji, cleanPlaylistTitle } from '../utils/iosEmojis';
import { IosEmoji } from './IosEmoji';

/**
 * ============================================================================
 * TOAST NOTIFICATION ITEM
 * ============================================================================
 * - Automatically removed after 5 seconds of display.
 * - Supports authentic iOS emoji rendering in toast titles.
 * - Smooth entrance and exit animations with manual dismiss button.
 * ============================================================================
 */
function ToastItem({ toast, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const displayDuration = toast.duration || 5000; // 5 seconds default

    // Start exit fade-out 300ms before removal
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, Math.max(0, displayDuration - 300));

    // Remove toast after full duration
    const dismissTimer = setTimeout(() => {
      onDismiss(toast.id);
    }, displayDuration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [toast.id, toast.duration, onDismiss]);

  const titleEmoji = extractLeadingEmoji(toast.title);
  const displayTitle = titleEmoji ? cleanPlaylistTitle(toast.title, titleEmoji) : toast.title;

  let borderClass = 'border-slate-200 dark:border-[#30363d]';
  let bgClass = 'bg-white dark:bg-[#161b22]';
  let icon = <Info className="w-4 h-4 text-ghblue-500 shrink-0" />;

  if (toast.type === 'success') {
    borderClass = 'border-brand-300 dark:border-brand-800';
    icon = <CheckCircle className="w-4 h-4 text-brand-500 shrink-0" />;
  } else if (toast.type === 'warning') {
    borderClass = 'border-amber-300 dark:border-amber-800';
    icon = <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  } else if (toast.type === 'error') {
    borderClass = 'border-red-300 dark:border-red-800';
    icon = <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
  }

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border ${borderClass} ${bgClass} shadow-glass text-xs transition-all duration-300 ${
        isExiting
          ? 'opacity-0 scale-95 -translate-y-2'
          : 'animate-in slide-in-from-top-2 fade-in duration-200'
      }`}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <h5 className="font-bold text-slate-900 dark:text-[#f0f6fc] flex items-center gap-1.5 flex-wrap">
          {titleEmoji && <IosEmoji emoji={titleEmoji} size={16} />}
          <span>{displayTitle}</span>
        </h5>
        {toast.message && (
          <p className="text-slate-600 dark:text-[#8b949e] mt-0.5 break-words">
            {toast.message}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-slate-700 dark:hover:text-[#f0f6fc] transition-colors -mr-1 -mt-1 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#21262d]"
        title="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * ============================================================================
 * TOAST NOTIFICATION CONTAINER
 * ============================================================================
 */
export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default ToastContainer;
