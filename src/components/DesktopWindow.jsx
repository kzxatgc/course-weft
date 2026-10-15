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
    [id, onFocus, onMove]
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
      aria-modal="false"
      className="nb-window"
      style={posStyle}
      onPointerDown={() => onFocus(id)}
    >
      {/* ── Title Bar ─────────────────────────────────────────── */}
      <div
        className="nb-titlebar"
        onPointerDown={handleTitlePointerDown}
        style={{ cursor: 'grab' }}
      >
        <span className="nb-title" aria-hidden="true">{title}</span>

        <div className="nb-win-buttons" role="group" aria-label="Window controls">
          <button
            type="button"
            className="nb-win-btn"
            aria-label={`Minimize ${title}`}
            onClick={(e) => { e.stopPropagation(); onMinimize(id); }}
            title="Minimize"
          >
            <Minus size={10} strokeWidth={3} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="nb-win-btn nb-win-btn--close"
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
          className="nb-win-body"
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
