import React, { useRef, useCallback, useEffect } from 'react';
import { Minus, X } from 'lucide-react';

const MENUBAR_H = 34;   // px — 34px top menu bar
const DOCK_H    = 58;   // px — floating dock clearance (bottom 8px + dock 47px + margin)

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Neo-brutalist draggable desktop window.
 *
 * Design rules (from the neo-brutalist-desktop-os skill):
 * - 3px solid navy border, no border-radius anywhere
 * - 6px 6px 0 navy hard-offset shadow (zero blur)
 * - Yellow title bar with navy bottom border
 * - Square 20×20 control buttons: cream bg, navy border; close gets navy bg
 * - Cream window body
 * - Drag via title bar (pointer events, works on touch)
 * - Clicking anywhere on window brings it to front
 */
export default function DesktopWindow({
  id,
  title,
  isOpen,
  isMinimized,
  pos,
  zIndex,
  onClose,
  onMinimize,
  onFocus,
  onMove,
  children,
  width = 520,
  maxBodyHeight = 'calc(100vh - 180px)',
  locked = false,
  allowDragWhenLocked = false,
  inert = false,
}) {
  const windowRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const livePos = useRef(pos);

  // Keep livePos ref in sync with prop when not dragging
  useEffect(() => {
    livePos.current = pos;
  }, [pos]);

  const handleTitlePointerDown = useCallback(
    (e) => {
      if (locked && !allowDragWhenLocked) return;
      if (e.target.closest('button')) return;
      e.preventDefault();

      const rect = windowRef.current.getBoundingClientRect();
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      onFocus(id);

      function onMove_(ev) {
        const el = windowRef.current;
        if (!el) return;
        const x = clamp(
          ev.clientX - dragOffset.current.x,
          0,
          window.innerWidth - el.offsetWidth
        );
        const y = clamp(
          ev.clientY - dragOffset.current.y,
          MENUBAR_H,
          window.innerHeight - DOCK_H - el.offsetHeight + el.offsetHeight * 0.3
        );
        // Direct DOM update for smooth drag (no React re-render during drag)
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        livePos.current = { x, y };
      }

      function onUp_() {
        onMove(id, livePos.current);
        document.removeEventListener('pointermove', onMove_);
        document.removeEventListener('pointerup', onUp_);
      }

      document.addEventListener('pointermove', onMove_);
      document.addEventListener('pointerup', onUp_);
    },
    [id, locked, allowDragWhenLocked, onFocus, onMove]
  );

  if (!isOpen) return null;

  const posStyle = {
    position: 'fixed',
    top: pos.y,
    left: pos.x,
    width: typeof width === 'number' ? width : undefined,
    zIndex,
  };

  return (
    <div
      ref={windowRef}
      id={`window-${id}`}
      role="dialog"
      aria-label={title}
      aria-modal={locked ? 'true' : 'false'}
      inert={inert}
      className="flex min-w-[280px] max-w-[calc(100vw-16px)] flex-col border-[3px] border-[var(--color-navy)] bg-[var(--color-cream)] shadow-[6px_6px_0_var(--color-navy)] [animation:nb-win-open_0.12s_steps(2,end)_both]"
      style={posStyle}
      onPointerDown={() => onFocus(id)}
    >
      {/* ── Title Bar ─────────────────────────────────────────── */}
      <div
        className="flex shrink-0 select-none items-center justify-between border-b-[3px] border-[var(--color-navy)] bg-[var(--color-yellow)] px-2.5 py-[5px]"
        onPointerDown={handleTitlePointerDown}
        style={{ cursor: locked && !allowDragWhenLocked ? 'default' : 'grab' }}
      >
        <span className="max-w-[calc(100%-80px)] overflow-hidden text-ellipsis whitespace-nowrap font-['Archivo_Black',sans-serif] text-xs font-black tracking-[0.03em] text-[var(--color-navy)]" aria-hidden="true">{title}</span>

        <div className="flex shrink-0 gap-1" role="group" aria-label="Window controls">
          <button
            type="button"
            disabled={locked}
            className={`grid h-5 w-5 place-items-center border-2 border-[var(--color-navy)] bg-[var(--color-cream)] text-[var(--color-navy)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-blue)] ${locked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--color-blue)]'}`}
            aria-label={`Minimize ${title}`}
            onClick={(e) => { e.stopPropagation(); onMinimize(id); }}
            title="Minimize"
          >
            <Minus size={10} strokeWidth={3} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={locked}
            className={`grid h-5 w-5 place-items-center border-2 border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-blue)] ${locked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-red-700'}`}
            aria-label={`Close ${title}`}
            onClick={(e) => { e.stopPropagation(); onClose(id); }}
            title="Close"
          >
            <X size={10} strokeWidth={3} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Window Body ───────────────────────────────────────── */}
      {!isMinimized && (
        <div
          className={`nb-win-body min-h-0 flex-1 overflow-y-auto bg-[var(--color-cream)] ${id === 'repair' ? 'p-[24px]' : 'p-1.5'} text-[var(--color-charcoal)]`}
          onPointerDown={locked ? (event) => event.stopPropagation() : undefined}
          style={{
            maxHeight: maxBodyHeight,
            overflowY: 'auto',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
