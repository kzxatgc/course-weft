import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, Wrench } from 'lucide-react';

/**
 * Accessible notification banner, screen-reader live announcer, and centered desktop modal popups.
 *
 * Modal popups:
 *  - Timetable updated success confirmation with OK button
 *  - Timetable conflict alert with Cancel and Find valid repair buttons
 *
 * Uses createPortal to document.body with z-[9999] so the dialogs always render
 * directly above all desktop windows, including the Schedule Repair window.
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
    },
    success: {
      container: 'border-emerald-300 bg-emerald-50/90 text-emerald-950 shadow-xs',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />,
      titleColor: 'text-emerald-900',
    },
    info: {
      container: 'border-sky-300 bg-sky-50/90 text-sky-950 shadow-xs',
      icon: <Info className="w-5 h-5 text-sky-600 shrink-0" aria-hidden="true" />,
      titleColor: 'text-sky-900',
    },
  };

  const currentStyle = notice ? kindStyles[notice.kind] || kindStyles.info : kindStyles.info;

  // Render centered modal popup content if applicable
  function renderModalContent() {
    if (!notice) return null;

    // 1. Success confirmation dialog after Apply repair
    if (notice.title === 'Timetable updated') {
      return (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px] p-4 select-none"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            role="dialog"
            aria-labelledby="success-dialog-title"
            aria-describedby="success-dialog-desc"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="nb-success-dialog w-full max-w-md rounded-none border-[3px] border-[var(--color-navy)] bg-[#fffdf8] shadow-[6px_6px_0px_0px_var(--color-navy)] overflow-hidden font-mono"
          >
            {/* Window title bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-600 text-white border-b-[3px] border-[var(--color-navy)] select-none">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-white" aria-hidden="true" />
                <span className="font-['Archivo_Black',sans-serif] text-[11px] uppercase tracking-wider font-black">
                  Timetable Updated
                </span>
              </div>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label="Close dialog"
                  className="text-white/80 hover:text-white p-1 hover:bg-black/10 rounded-none cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Dialog Body */}
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-3.5">
                {/* Green checkmark box */}
                <div className="shrink-0 flex items-center justify-center w-11 h-11 rounded-none bg-emerald-100 border-2 border-emerald-600 text-emerald-700 shadow-xs mt-0.5">
                  <CheckCircle2 className="w-7 h-7 stroke-emerald-950 stroke-[2] fill-emerald-300" aria-hidden="true" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3
                    id="success-dialog-title"
                    className="font-['Archivo_Black',sans-serif] text-xs sm:text-sm text-[var(--color-navy)] uppercase tracking-tight m-0"
                  >
                    {notice.title}
                  </h3>
                  <p
                    id="success-dialog-desc"
                    className="mt-1.5 text-xs text-slate-800 leading-relaxed font-sans"
                  >
                    {notice.message}
                  </p>
                </div>
              </div>

              {/* Single OK button */}
              <div className="mt-5 pt-3.5 border-t border-[var(--color-navy)]/15 flex items-center justify-end">
                {onDismiss && (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="px-6 py-1.5 text-xs font-black font-mono uppercase rounded-none border-2 border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-cream)] hover:opacity-90 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shadow-xs"
                  >
                    OK
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 2. Conflict alert dialog
    if (notice.action === 'suggest') {
      return (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px] p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            if (e.target === e.currentTarget && onDismiss) onDismiss();
          }}
        >
          <div
            role="alertdialog"
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-desc"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="nb-conflict-dialog w-full max-w-md rounded-none border-[3px] border-[var(--color-navy)] bg-[#fffdf8] shadow-[6px_6px_0px_0px_var(--color-navy)] overflow-hidden font-mono"
          >
            {/* Window title bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-yellow)] text-[var(--color-navy)] border-b-[3px] border-[var(--color-navy)] select-none">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[var(--color-navy)] fill-amber-300" aria-hidden="true" />
                <span className="font-['Archivo_Black',sans-serif] text-[11px] uppercase tracking-wider font-black">
                  Timetable Conflict Alert
                </span>
              </div>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label="Dismiss alert"
                  className="text-[var(--color-navy)]/80 hover:text-[var(--color-navy)] p-1 hover:bg-black/10 rounded-none cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Dialog Body with yellow warning triangle icon */}
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-3.5">
                {/* Yellow triangle warning sign */}
                <div className="shrink-0 flex items-center justify-center w-11 h-11 rounded-none bg-amber-100 border-2 border-amber-600 text-amber-600 shadow-xs mt-0.5">
                  <AlertTriangle className="w-7 h-7 fill-amber-400 stroke-amber-950 stroke-[2]" aria-hidden="true" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3
                    id="alert-dialog-title"
                    className="font-['Archivo_Black',sans-serif] text-xs sm:text-sm text-[var(--color-navy)] uppercase tracking-tight m-0"
                  >
                    {notice.title}
                  </h3>
                  <p
                    id="alert-dialog-desc"
                    className="mt-1.5 text-xs text-slate-800 leading-relaxed font-sans"
                  >
                    {notice.message}
                  </p>
                </div>
              </div>

              {/* Action buttons: Cancel and Find valid repair */}
              <div className="mt-5 pt-3.5 border-t border-[var(--color-navy)]/15 flex items-center justify-end gap-2.5">
                {onDismiss && (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="px-4 py-1.5 text-xs font-bold font-mono uppercase rounded-none border-2 border-[var(--color-navy)] bg-white text-[var(--color-navy)] hover:bg-slate-100 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shadow-xs"
                  >
                    Cancel
                  </button>
                )}

                {onAction && (
                  <button
                    type="button"
                    onClick={onAction}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-black font-mono uppercase rounded-none border-2 border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-cream)] hover:opacity-90 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Wrench className="w-3.5 h-3.5 text-[var(--color-yellow)]" aria-hidden="true" />
                    Find valid repair
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  const modalContent = renderModalContent();

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

      {/* Render modal popups portaled to document.body with z-[9999] so they appear above all windows */}
      {modalContent && typeof document !== 'undefined'
        ? createPortal(modalContent, document.body)
        : modalContent}

      {/* Standard non-modal notification banner */}
      <div id="notice-region" role="region" aria-label="Notifications" className="empty:hidden">
        {notice && !modalContent ? (
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
              </div>
            </div>

            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss notification"
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </aside>
        ) : null}
      </div>
    </>
  );
}
