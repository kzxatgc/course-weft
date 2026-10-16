import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { formatTime } from '../domain/time.mjs';
import { ACTION } from '../state/draft-controller.mjs';
import { playSound } from '../audio/optional-sounds.js';
import {
  DT_SECTION_ID,
  pointerXToMinute,
  computeEndMinute,
  clampToDayBounds,
  buildFixedPreview,
  POINTER_DRAG_THRESHOLD,
  hasExceededDragThreshold,
  isCardTouchingAvailableCourses,
} from '../domain/drop-preview.mjs';

/**
 * Timetable — Clean Neo-Brutalist Layout
 *
 * X-axis: Column-based time slots (10 equal 1-hour columns: 8 AM to 6 PM)
 * Y-axis: Days of the week (Monday through Friday, 52px tall rows)
 *
 * Features:
 *  - Crisp centered hour headers above each column
 *  - Vertical grid lines that align between header and day rows
 *  - 52px rows with comfortable breathing room for course blocks
 *  - Signature blue course blocks with 2-line detail and remove (×) control
 *  - Dragging selected timetable courses onto Available Courses to remove or swap
 *  - Animated section swap: outgoing slides toward tray, incoming moves into slot
 *  - Fits the entire width cleanly without scrolling
 *  - Drag/drop ghost preview: dashed ghost card follows pointer at 15-min snap
 *  - Fixed-slot preview: official scheduled slot colored green (ok) or red (conflict)
 *
 * @param {{
 *   selectedSections: object[],
 *   availableCourses: object[],
 *   draft?: string[],
 *   dispatch: function,
 *   fixedPreviewSectionId?: string | null,
 *   previewSectionId?: string | null,
 *   animatingSwap?: { outgoingId: string, incomingId: string } | null,
 *   onRequestSwap?: function
 * }} props
 */
export default function Timetable({
  selectedSections = [],
  availableCourses = [],
  draft = [],
  dispatch,
  fixedPreviewSectionId = null,
  previewSectionId = null,
  animatingSwap = null,
  onRequestSwap = null,
  linkedOutlineIds = [],
  rainbowPair = null,
}) {
  function handleRemove(id) {
    dispatch({ type: ACTION.REMOVE_SECTION, payload: id });
  }

  // ── Ghost preview state (follows pointer on drag) ─────────────────────────
  // ghost = { dayId, startMin, endMin } | null
  const [ghost, setGhost] = useState(null);
  // draggedSectionId: the section being dragged over (from DataTransfer)
  const draggedIdRef = useRef(null);

  // ── Fixed-slot preview──────────────────────────────────────────
  // Show at official scheduled day & time for keyboard focus or active drag
  const targetSectionId = fixedPreviewSectionId || previewSectionId || (ghost ? ghost.sectionId : null);
  const targetSection = targetSectionId
    ? availableCourses.find((s) => s.id === targetSectionId)
    : null;
  // Identify candidate currently enrolled section(s) that would be replaced if targetSection is swapped in
  const candidateReplacedIds = new Set();
  if (targetSection) {
    selectedSections.forEach((sec) => {
      if (
        sec.id !== targetSection.id &&
        ((sec.course === targetSection.course && sec.component === targetSection.component) ||
          (Array.isArray(targetSection.alternates) && targetSection.alternates.includes(sec.id)) ||
          (Array.isArray(sec.alternates) && sec.alternates.includes(targetSection.id)))
      ) {
        candidateReplacedIds.add(sec.id);
      }
    });
  }

  // When previewing a section swap, the candidate section replaces the enrolled alternate,
  // so time conflict is evaluated against the remaining enrolled sections
  const conflictCheckSections = candidateReplacedIds.size > 0
    ? selectedSections.filter((sec) => !candidateReplacedIds.has(sec.id))
    : selectedSections;

  const fixedPreview = targetSection
    ? buildFixedPreview(targetSection, conflictCheckSections)
    : null;

  // Only fade the alternate section when the preview is green (no conflict).
  // If preview is red (conflict), the alternate section should NOT be transparent.
  const replacedSectionIds = new Set();
  if (targetSection && fixedPreview && !fixedPreview.hasConflict) {
    candidateReplacedIds.forEach((id) => replacedSectionIds.add(id));
  }

  // Incoming swap section metadata (for animating incoming alternate into slot)
  const incomingSwapSection = animatingSwap?.incomingId
    ? availableCourses.find((s) => s.id === animatingSwap.incomingId)
    : null;

  // ── Pointer drag for timetable course blocks ────────────────────
  const [heldSection, setHeldSection] = useState(null);
  const pointerStateRef = useRef(null);
  const isRestoringTimeoutRef = useRef(null);

  function handleSectionPointerDown(e, sec) {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return; // Ignore clicks on non-drag remove button

    if (isRestoringTimeoutRef.current) {
      clearTimeout(isRestoringTimeoutRef.current);
      isRestoringTimeoutRef.current = null;
    }

    const targetEl = e.currentTarget;
    const rect = targetEl.getBoundingClientRect();

    pointerStateRef.current = {
      sec,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      origRect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      pointerId: e.pointerId,
      isDragging: false,
    };

    function onPointerMove(moveEvent) {
      if (!pointerStateRef.current) return;
      const cur = pointerStateRef.current;
      const dx = moveEvent.clientX - cur.startX;
      const dy = moveEvent.clientY - cur.startY;
      const panelRect = document.querySelector('.nb-courses-panel')?.getBoundingClientRect();
      const cardLeft = moveEvent.clientX - cur.offsetX;
      const cardTop = moveEvent.clientY - cur.offsetY;
      const isOverAvailableCourses = isCardTouchingAvailableCourses({
        left: cardLeft,
        top: cardTop,
        right: cardLeft + cur.origRect.width,
        bottom: cardTop + cur.origRect.height,
      }, panelRect);

      if (!cur.isDragging) {
        if (hasExceededDragThreshold(dx, dy, POINTER_DRAG_THRESHOLD)) {
          cur.isDragging = true;
          setHeldSection({
            sec: cur.sec,
            currentX: moveEvent.clientX,
            currentY: moveEvent.clientY,
            offsetX: cur.offsetX,
            offsetY: cur.offsetY,
            origRect: cur.origRect,
            isRestoring: false,
            isOverAvailableCourses,
          });
        }
      }

      if (cur.isDragging) {
        setHeldSection({
          sec: cur.sec,
          currentX: moveEvent.clientX,
          currentY: moveEvent.clientY,
          offsetX: cur.offsetX,
          offsetY: cur.offsetY,
          origRect: cur.origRect,
          isRestoring: false,
          isOverAvailableCourses,
        });
      }
    }

    function cleanupListeners() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('keydown', onKeyDown);
    }

    function cancelAndRestore() {
      cleanupListeners();
      if (!pointerStateRef.current) return;
      const cur = pointerStateRef.current;

      if (cur.isDragging) {
        setHeldSection({
          sec: cur.sec,
          currentX: cur.origRect.left + cur.offsetX,
          currentY: cur.origRect.top + cur.offsetY,
          offsetX: cur.offsetX,
          offsetY: cur.offsetY,
          origRect: cur.origRect,
          isRestoring: true,
        });

        isRestoringTimeoutRef.current = setTimeout(() => {
          setHeldSection(null);
          pointerStateRef.current = null;
          isRestoringTimeoutRef.current = null;
        }, 220);
      } else {
        pointerStateRef.current = null;
      }
    }

    function onPointerCancel() {
      cancelAndRestore();
    }

    function onKeyDown(keyEvent) {
      if (keyEvent.key === 'Escape') {
        cancelAndRestore();
      }
    }

    function onPointerUp(upEvent) {
      cleanupListeners();
      if (!pointerStateRef.current) return;
      const cur = pointerStateRef.current;

      if (!cur.isDragging) {
        pointerStateRef.current = null;
        return;
      }

      // Check if dropped into the Available Courses area
      const panelEl = document.querySelector('.nb-courses-panel');
      const panelRect = panelEl?.getBoundingClientRect();
      const timetableEl = document.querySelector('.nb-tt');
      const timetableRect = timetableEl?.getBoundingClientRect();

      const cardRect = {
        left: upEvent.clientX - cur.offsetX,
        top: upEvent.clientY - cur.offsetY,
        right: upEvent.clientX - cur.offsetX + cur.origRect.width,
        bottom: upEvent.clientY - cur.offsetY + cur.origRect.height,
        width: cur.origRect.width,
        height: cur.origRect.height,
      };

      const touchesPanel = isCardTouchingAvailableCourses(cardRect, panelRect);
      const isAboveTimetable = timetableRect ? cardRect.top < timetableRect.top : false;
      const releasedInAvailableArea = Boolean(touchesPanel || isAboveTimetable);

      if (releasedInAvailableArea) {
        // Dropped into Available Courses tray: remove from timetable so it returns to Available Courses
        setHeldSection(null);
        pointerStateRef.current = null;
        playSound?.('trash');
        handleRemove(cur.sec.id);
      } else {
        cancelAndRestore();
      }
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('keydown', onKeyDown);
  }

  /**
   * Called by each day-row's onDragEnter / onDragOver.
   * Reads section ID from DataTransfer, looks up the section's duration,
   * then computes the snapped ghost preview position.
   */
  const handleDayDragOver = useCallback((e, dayId, trackEl) => {
    e.preventDefault(); // allow drop
    e.dataTransfer.dropEffect = 'copy';

    const sectionId = draggedIdRef.current || e.dataTransfer.getData(DT_SECTION_ID);
    if (!sectionId) return;

    // Keep ref in sync (getData only works on dragstart in some browsers on dragover)
    if (!draggedIdRef.current) draggedIdRef.current = sectionId;

    const section = availableCourses.find((s) => s.id === sectionId);
    if (!section) return;

    const durationMin = section.end - section.start;
    const trackRect   = trackEl.getBoundingClientRect();
    const startMin    = pointerXToMinute(e.clientX, trackRect);
    const endMin      = computeEndMinute(startMin, durationMin);

    setGhost({ dayId, startMin, endMin, sectionId, title: section.title, id: section.id });
  }, [availableCourses]);

  /** Clear ghost on leave / end / drop */
  const clearGhost = useCallback(() => {
    setGhost(null);
    draggedIdRef.current = null;
  }, []);

  return (
    <section className="nb-tt relative" aria-label="Weekly schedule timetable" data-testid="timetable">
      <div className="nb-tt-grid-wrap">
        {/* ── Top Header Row: X-axis (10 distinct hour columns) ───── */}
        <div className="nb-tt-header-row">
          <div className="nb-tt-corner-cell">
            <span className="nb-tt-corner-text">DAY</span>
          </div>

          <div className="nb-tt-hour-cols" role="row">
            {HOURS.map((h) => (
              <div key={h.startMin} className="nb-tt-hour-cell" role="columnheader">
                <span className="nb-tt-hour-text">{h.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Body: Y-axis (Monday to Friday rows) ───────────────── */}
        <div className="nb-tt-rows-body">
          {WEEKDAYS.map((day) => {
            const daySections = selectedSections.filter(
              (s) => s.day === day.id || (Array.isArray(s.days) && s.days.includes(day.id))
            );
            const isGhostDay = ghost?.dayId === day.id;
            const isFixedPreviewDay = Boolean(
              fixedPreview && (
                fixedPreview.day === day.id ||
                (Array.isArray(fixedPreview.days) && fixedPreview.days.includes(day.id))
              )
            );

            return (
              <DayRow
                key={day.id}
                day={day}
                daySections={daySections}
                ghost={isGhostDay ? ghost : null}
                fixedPreview={isFixedPreviewDay ? fixedPreview : null}
                animatingSwap={animatingSwap}
                heldSectionId={heldSection?.sec.id}
                incomingSwapSection={incomingSwapSection}
                replacedSectionIds={replacedSectionIds}
                linkedOutlineIds={linkedOutlineIds}
                rainbowPair={rainbowPair}
                onDragOver={handleDayDragOver}
                onDragLeave={clearGhost}
                onDrop={clearGhost}
                onRemove={handleRemove}
                onSectionPointerDown={handleSectionPointerDown}
              />
            );
          })}

        </div>
      </div>

      {/* ── Lifted/Held timetable block following pointer ── */}
      {heldSection && (
        typeof document !== 'undefined' && document.body
          ? createPortal(
              <div
                className={`nb-tt-block nb-tt-block-held ${
                  heldSection.isRestoring ? 'nb-tt-block-held--restoring' : ''
                } ${
                  heldSection.isOverAvailableCourses ? 'nb-tt-block-held--over-courses' : ''
                }`}
                style={{
                  left: `${heldSection.currentX - heldSection.offsetX}px`,
                  top: `${heldSection.currentY - heldSection.offsetY}px`,
                  width: `${heldSection.origRect.width}px`,
                  height: `${heldSection.origRect.height}px`,
                }}
                data-testid={`timetable-held-${heldSection.sec.id}`}
                aria-hidden="true"
              >
                <span className="nb-tt-block-id">{heldSection.sec.id}</span>
              </div>,
              document.body
            )
          : null
      )}
    </section>
  );
}

// ── Day Row with drag-over support ────────────────────────────────────────────

function DayRow({
  day,
  daySections,
  ghost,
  fixedPreview,
  animatingSwap,
  heldSectionId,
  incomingSwapSection,
  replacedSectionIds,
  linkedOutlineIds,
  rainbowPair,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
  onSectionPointerDown,
}) {
  const trackRef = useRef(null);

  function handleDragOver(e) {
    if (trackRef.current) {
      onDragOver(e, day.id, trackRef.current);
    }
  }

  const isIncomingDay = Boolean(
    incomingSwapSection && (
      incomingSwapSection.day === day.id ||
      (Array.isArray(incomingSwapSection.days) && incomingSwapSection.days.includes(day.id))
    )
  );

  return (
    <div className="nb-tt-row" aria-label={day.full}>
      {/* Day label on Y-axis */}
      <div className="nb-tt-day-label">
        <span className="nb-tt-day-badge">{day.short}</span>
      </div>

      {/* Day track */}
      <div
        ref={trackRef}
        className={`nb-tt-row-track${ghost ? ' nb-tt-row-track--drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Background grid columns matching header */}
        <div className="nb-tt-track-grid" aria-hidden="true">
          {HOURS.map((h) => (
            <div key={h.startMin} className="nb-tt-grid-col" />
          ))}
        </div>

        {/* Section blocks on this day */}
        {daySections.map((sec) => {
          const isHeld = heldSectionId === sec.id;
          if (isHeld) {
            const leftPct = toPercent(sec.start);
            const widthPct = ((sec.end - sec.start) / TOTAL_MINUTES) * 100;
            return (
              <div
                key={`placeholder-${sec.id}-${day.id}`}
                className="nb-tt-block-placeholder"
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                aria-hidden="true"
                data-testid={`timetable-placeholder-${sec.id}`}
              />
            );
          }

          // If this section is the incoming swap target, skip the real block —
          // the nb-tt-swap-incoming ghost overlay handles the slide-in animation
          const isIncomingSwap = animatingSwap?.incomingId === sec.id;
          if (isIncomingSwap) return null;

          const isOutgoing = animatingSwap?.outgoingId === sec.id;
          const isReplaced = Boolean(replacedSectionIds?.has(sec.id));
          return (
            <SectionBlock
              key={`${sec.id}-${day.id}`}
              sec={sec}
              isOutgoing={isOutgoing}
              isReplaced={isReplaced}
              linkedOutlineIds={linkedOutlineIds}
              rainbowPair={rainbowPair}
              onRemove={onRemove}
              onPointerDown={(e) => onSectionPointerDown?.(e, sec)}
            />
          );
        })}

        {/* Incoming swap preview on this day */}
        {isIncomingDay && (
          <div
            className="nb-tt-block nb-tt-swap-incoming"
            style={{
              left: `${toPercent(incomingSwapSection.start)}%`,
              width: `${((incomingSwapSection.end - incomingSwapSection.start) / TOTAL_MINUTES) * 100}%`,
            }}
            data-testid={`timetable-swap-incoming-${incomingSwapSection.id}`}
            aria-hidden="true"
          >
            <span className="nb-tt-block-id">{incomingSwapSection.id}</span>
          </div>
        )}

        {/* Fixed preview (official slot time-conflict preview) */}
        {fixedPreview && (
          <FixedPreviewBlock fixedPreview={fixedPreview} />
        )}

        {/* Ghost preview (pointer-following preview) */}
        {ghost && (
          <GhostBlock ghost={ghost} />
        )}
      </div>
    </div>
  );
}

// ── Fixed preview block (official slot conflict preview) ─────────────────────

function FixedPreviewBlock({ fixedPreview }) {
  const leftPct  = toPercent(fixedPreview.startMin);
  const widthPct = ((fixedPreview.endMin - fixedPreview.startMin) / TOTAL_MINUTES) * 100;
  const isConflict = fixedPreview.hasConflict;

  return (
    <div
      className={`nb-tt-fixed-preview ${
        isConflict ? 'nb-tt-fixed-preview--conflict' : 'nb-tt-fixed-preview--ok'
      }`}
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      data-testid="timetable-fixed-preview"
      data-section-id={fixedPreview.sectionId}
      data-status={fixedPreview.status}
      role="status"
      aria-label={`Preview for ${fixedPreview.sectionId}: ${isConflict ? 'Time conflict' : 'Available time slot'}`}
    >
      <span className="nb-tt-fixed-preview-label">{fixedPreview.sectionId}</span>
    </div>
  );
}

// ── Ghost block (dashed outline preview) ─────────────────────────────────────

function GhostBlock({ ghost }) {
  const leftPct  = toPercent(ghost.startMin);
  const widthPct = ((ghost.endMin - ghost.startMin) / TOTAL_MINUTES) * 100;

  return (
    <div
      className="nb-tt-ghost"
      style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 1)}%` }}
      aria-hidden="true"
    >
      <span className="nb-tt-ghost-label">{ghost.id}</span>
    </div>
  );
}

// ── Section block placed on day track ─────────────────────────────────────────

function format24h(minute) {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const hStr = h < 10 ? `0${h}` : `${h}`;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${hStr}${mStr}`;
}

function SectionBlock({
  sec,
  isOutgoing = false,
  isReplaced = false,
  linkedOutlineIds = [],
  rainbowPair = null,
  onRemove,
  onPointerDown,
}) {
  const leftPct = toPercent(sec.start);
  const widthPct = ((sec.end - sec.start) / TOTAL_MINUTES) * 100;
  const timeLabel = `${format24h(sec.start)} - ${format24h(sec.end)}`;
  const hasLinkedOutline = Boolean(linkedOutlineIds?.includes(sec.id));

  return (
    <article
      className={`nb-tt-block cursor-grab select-none touch-none ${
        isOutgoing ? 'nb-tt-swap-outgoing' : ''
      } ${isReplaced ? 'nb-tt-block--swapping-out' : ''} ${
        hasLinkedOutline ? 'nb-linked-outline' : ''
      }`}
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        ...(hasLinkedOutline && rainbowPair
          ? {
              '--rainbow-c1': rainbowPair[0],
              '--rainbow-c2': rainbowPair[1],
            }
          : {}),
      }}
      aria-label={`${sec.title} (${sec.id}), ${sec.day} ${timeLabel}`}
      title={`${sec.title} (${sec.id})\n${sec.day} ${timeLabel}`}
      onPointerDown={onPointerDown}
      data-testid={`timetable-block-${sec.id}`}
      data-is-replaced={isReplaced ? 'true' : 'false'}
      data-linked-outline={hasLinkedOutline ? 'true' : 'false'}
    >
      <span className="nb-tt-block-id">{sec.id}</span>
    </article>
  );
}

// ── Constants & Helpers ───────────────────────────────────────────────────────

export const WEEKDAYS = [
  { id: 'Mon', short: 'MON', full: 'Monday'    },
  { id: 'Tue', short: 'TUE', full: 'Tuesday'   },
  { id: 'Wed', short: 'WED', full: 'Wednesday' },
  { id: 'Thu', short: 'THU', full: 'Thursday'  },
  { id: 'Fri', short: 'FRI', full: 'Friday'    },
];

export const START_MINUTE  = 8  * 60;   // 8:00 AM  (480)
export const END_MINUTE    = 18 * 60;  // 6:00 PM  (1080)
export const TOTAL_MINUTES = END_MINUTE - START_MINUTE;  // 600

export const HOURS = [
  { startMin: 480,  label: '0800 - 0900' },
  { startMin: 540,  label: '0900 - 1000' },
  { startMin: 600,  label: '1000 - 1100' },
  { startMin: 660,  label: '1100 - 1200' },
  { startMin: 720,  label: '1200 - 1300' },
  { startMin: 780,  label: '1300 - 1400' },
  { startMin: 840,  label: '1400 - 1500' },
  { startMin: 900,  label: '1500 - 1600' },
  { startMin: 960,  label: '1600 - 1700' },
  { startMin: 1020, label: '1700 - 1800' },
];

export const TIME_MARKS = [
  ...HOURS.map((h) => ({ minute: h.startMin, label: h.label })),
  { minute: 1080, label: '1800' },
];

/** Convert a minute-of-day value to a horizontal percentage on the timeline. */
export function toPercent(minute) {
  return ((minute - START_MINUTE) / TOTAL_MINUTES) * 100;
}
