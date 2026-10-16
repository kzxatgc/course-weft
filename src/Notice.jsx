import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, Wrench } from 'lucide-react';
import { playSound } from './audio/optional-sounds.js';

/**
 * Accessible notification banner, screen-reader live announcer, and conflict modal.
 *
 * Conflict alerts use a modal; successful updates remain non-modal banners.
 *
 * Uses createPortal to document.body with z-[9999] so the dialogs always render
 * directly above all desktop windows, including the Schedule Repair window.
 *
 * @param {{
 *   notice: { kind: 'error' | 'success' | 'info', title: string, message: string, action?: string, emphasizedCourseId?: string } | null,
 *   onDismiss?: () => void,
 *   onAction?: () => void,
 * }} props
 */
export default function Notice({ notice, onDismiss, onAction }) {
  const [announcement, setAnnouncement] = useState('');

  // Update polite live region text whenever notice changes and cue conflict alerts.
  useEffect(() => {
    if (notice) {
      setAnnouncement(`${notice.title}. ${notice.message}`);
      if (notice.action === 'suggest') playSound('popup');
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

  function renderNoticeMessage() {
    const message = notice?.message ?? '';
    const courseId = notice?.emphasizedCourseId;
    if (!courseId) return message;

    const courseIdIndex = message.indexOf(courseId);
    if (courseIdIndex === -1) return message;

    return (
      <>
        {message.slice(0, courseIdIndex)}
        <strong className="font-bold text-[var(--color-navy)]">{courseId}</strong>
        {message.slice(courseIdIndex + courseId.length)}
      </>
    );
  }

  // Render centered conflict alert when repair is available.
  function renderModalContent() {
    if (!notice) return null;

    // Conflict alert dialog
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
                    {renderNoticeMessage()}
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

      {/* Render conflict alerts above all desktop windows */}
      {modalContent && typeof document !== 'undefined'
        ? createPortal(modalContent, document.body)
        : modalContent}

      {/* Standard non-modal notification banner */}
      <div id="notice-region" role="region" aria-label="Notifications" className="empty:hidden">
        {notice && !modalContent && notice.title !== 'Section changed' ? (
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
                  {renderNoticeMessage()}
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
