import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Wrench } from 'lucide-react';
import { playSound } from './audio/optional-sounds.js';

const NOTICE_DURATION_MS = 1300;
const HIDDEN_TOAST_TITLES = new Set([
  'Already on your timetable',
  'Drop this class on the correct day',
  'Course already selected',
  'No section to switch from',
  'Not a declared alternate',
  'No suggestion to apply',
  'This suggestion is out of date',
  'This timetable needs another look',
]);

function NoticeToast({ id, notice, onExpireRef }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onExpireRef.current(id, notice), NOTICE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [id, notice, onExpireRef]);

  const style = {
    error: 'text-rose-900',
    success: 'text-emerald-900',
    info: 'text-sky-900',
  }[notice.kind] || 'text-sky-900';

  return (
    <aside
      className={`nb-notice-toast nb-notice-toast--${notice.kind} rounded border px-3 py-1.5 text-center`}
      aria-live="polite"
      style={{ order: -id, position: 'relative', zIndex: id + 1 }}
    >
      <strong className={`text-xs font-semibold tracking-tight capitalize ${style}`}>
        {notice.title}
      </strong>
    </aside>
  );
}

/**
 * Accessible temporary notices, screen-reader live announcer, and conflict modal.
 *
 * Conflict alerts and acknowledgements use modals; other notices dismiss automatically.
 *
 * Uses createPortal to document.body with z-[9999] so the dialogs always render
 * directly above all desktop windows, including the Schedule Repair window.
 *
 * @param {{
 *   notice: { kind: 'error' | 'success' | 'info', title: string, message: string, action?: string, emphasizedCourseId?: string, emphasizedCourseIds?: string[] } | null,
 *   onDismiss?: () => void,
 *   onAction?: () => void,
 * }} props
 */
export default function Notice({ notice, onDismiss, onAction }) {
  const [announcement, setAnnouncement] = useState('');
  const [toastMessages, setToastMessages] = useState([]);
  const [toastPosition, setToastPosition] = useState({ top: 0, left: 0 });
  const nextToastIdRef = useRef(0);
  const lastNoticeRef = useRef(null);
  const activeNoticeRef = useRef(notice);
  activeNoticeRef.current = notice;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const onToastExpireRef = useRef(null);
  onToastExpireRef.current = (toastId, expiredNotice) => {
    setToastMessages((messages) => messages.filter((message) => message.id !== toastId));
    if (activeNoticeRef.current === expiredNotice) dismissRef.current?.();
  };

  useLayoutEffect(() => {
    if (toastMessages.length === 0) return undefined;

    const updateToastPosition = () => {
      const workspace = document.getElementById('schedule-workspace');
      if (!workspace) return;
      const rect = workspace.getBoundingClientRect();
      setToastPosition({ top: rect.top - 26, left: rect.left + rect.width / 2 });
    };

    updateToastPosition();
    window.addEventListener('resize', updateToastPosition);
    return () => window.removeEventListener('resize', updateToastPosition);
  }, [toastMessages.length]);

  // Keep each ordinary toast alive independently when newer notices arrive.
  useEffect(() => {
    if (!notice) {
      lastNoticeRef.current = null;
      return;
    }
    if (lastNoticeRef.current === notice) return;
    lastNoticeRef.current = notice;

    setAnnouncement(`${notice.title}. ${notice.message}`);
    if (notice.action === 'suggest' || notice.action === 'acknowledge') {
      playSound('popup');
      return;
    }

    const toastId = nextToastIdRef.current++;
    if (!HIDDEN_TOAST_TITLES.has(notice.title)) {
      setToastMessages((messages) => [{ id: toastId, notice }, ...messages]);
    } else {
      const timer = window.setTimeout(() => {
        if (activeNoticeRef.current === notice) dismissRef.current?.();
      }, NOTICE_DURATION_MS);
      return () => {
        window.clearTimeout(timer);
        if (lastNoticeRef.current === notice) lastNoticeRef.current = null;
      };
    }
  }, [notice]);

  function renderNoticeMessage() {
    const message = notice?.message ?? '';
    const courseIds = [
      ...new Set([
        ...(notice?.emphasizedCourseIds ?? []),
        ...(notice?.emphasizedCourseId ? [notice.emphasizedCourseId] : []),
      ]),
    ].filter((courseId) => courseId.length > 0);
    if (courseIds.length === 0) return message;

    const parts = [];
    let remaining = message;
    while (remaining.length > 0) {
      const nextCourse = courseIds
        .map((courseId) => ({ courseId, index: remaining.indexOf(courseId) }))
        .filter(({ index }) => index >= 0)
        .sort((left, right) => left.index - right.index)[0];

      if (!nextCourse) {
        parts.push(remaining);
        break;
      }

      parts.push(remaining.slice(0, nextCourse.index));
      parts.push(
        <strong key={`${nextCourse.courseId}-${parts.length}`} className="font-bold text-[var(--color-navy)]">
          {nextCourse.courseId}
        </strong>
      );
      remaining = remaining.slice(nextCourse.index + nextCourse.courseId.length);
    }

    return parts;
  }

  // Render centered conflict alert when repair is available.
  function renderModalContent() {
    if (!notice) return null;

    if (notice.action === 'acknowledge') {
      return (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px] p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
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
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--color-yellow)] text-[var(--color-navy)] border-b-[3px] border-[var(--color-navy)] select-none">
              <AlertTriangle className="w-4 h-4 text-rose-700" aria-hidden="true" />
              <span className="font-['Archivo_Black',sans-serif] text-[11px] uppercase tracking-wider font-black">
                Schedule Alert
              </span>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-3.5">
                <div className="shrink-0 flex items-center justify-center w-11 h-11 rounded-none bg-rose-50 border-2 border-rose-600 text-rose-700 shadow-xs mt-0.5">
                  <AlertTriangle className="w-7 h-7" aria-hidden="true" />
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
              <div className="mt-5 pt-3.5 border-t border-[var(--color-navy)]/15 flex justify-end">
                {onDismiss && (
                  <button
                    type="button"
                    autoFocus
                    onClick={onDismiss}
                    className="min-w-20 px-4 py-1.5 text-xs font-black font-mono uppercase rounded-none border-2 border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-cream)] hover:opacity-90 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shadow-xs"
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
                <span
                  id="alert-dialog-title"
                  className="font-['Archivo_Black',sans-serif] text-[11px] uppercase tracking-wider font-black"
                >
                  {notice.title}
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

      {/* Temporary notices are portaled above desktop window stacking contexts. */}
      {!modalContent && toastMessages.length > 0 && typeof document !== 'undefined'
        ? createPortal(
          <div
            id="notice-region"
            role="region"
            aria-label="Notifications"
            style={toastPosition}
          >
            {toastMessages.map(({ id, notice: toastNotice }) => (
              <NoticeToast
                key={id}
                id={id}
                notice={toastNotice}
                onExpireRef={onToastExpireRef}
              />
            ))}
          </div>,
          document.body
        )
        : null}
    </>
  );
}
