import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X, Sparkles } from 'lucide-react';

/**
 * Accessible notification banner and screen-reader polite live announcer.
 *
 * @param {{
 *   notice: { kind: 'error' | 'success' | 'info', title: string, message: string, action?: string } | null,
 *   onDismiss?: () => void,
 *   onAction?: () => void,
 * }} props
 */
export default function Notice({ notice, onDismiss, onAction }) {
  const [announcement, setAnnouncement] = useState('');

  // Update polite live region text whenever notice changes
  useEffect(() => {
    if (notice) {
      setAnnouncement(`${notice.title}. ${notice.message}`);
    }
  }, [notice]);

  const kindStyles = {
    error: {
      container: 'border-rose-300 bg-rose-50/90 text-rose-950 shadow-xs',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />,
      titleColor: 'text-rose-900',
      actionBtn: 'bg-rose-700 hover:bg-rose-800 text-white focus:ring-rose-500',
    },
    success: {
      container: 'border-emerald-300 bg-emerald-50/90 text-emerald-950 shadow-xs',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />,
      titleColor: 'text-emerald-900',
      actionBtn: 'bg-emerald-700 hover:bg-emerald-800 text-white focus:ring-emerald-500',
    },
    info: {
      container: 'border-sky-300 bg-sky-50/90 text-sky-950 shadow-xs',
      icon: <Info className="w-5 h-5 text-sky-600 shrink-0" aria-hidden="true" />,
      titleColor: 'text-sky-900',
      actionBtn: 'bg-sky-700 hover:bg-sky-800 text-white focus:ring-sky-500',
    },
  };

  const currentStyle = notice ? kindStyles[notice.kind] || kindStyles.info : kindStyles.info;

  return (
    <>
      {/* Dedicated polite screen-reader announcer */}
      <div
        id="announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Visual notification container */}
      <div id="notice-region" role="region" aria-label="Notifications" className="empty:hidden">
        {notice && (
          <aside
            className={`rounded-xl border p-4 sm:p-5 flex items-start justify-between gap-3 transition-all ${currentStyle.container}`}
            aria-live="polite"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="mt-0.5">{currentStyle.icon}</span>
              <div className="flex-1 min-w-0">
                <strong className={`block text-sm font-semibold tracking-tight ${currentStyle.titleColor}`}>
                  {notice.title}
                </strong>
                <p className="mt-1 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {notice.message}
                </p>

                {notice.action === 'suggest' && onAction && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={onAction}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${currentStyle.actionBtn}`}
                    >
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      Find valid repair
                    </button>
                  </div>
                )}
              </div>
            </div>

            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss notification"
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
