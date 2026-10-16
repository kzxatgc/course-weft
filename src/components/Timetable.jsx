import React, { useState, useRef, useCallback } from 'react';
import { formatTime } from '../domain/time.mjs';
import { ACTION } from '../state/draft-controller.mjs';
import {
  DT_SECTION_ID,
  pointerXToMinute,
  computeEndMinute,
  clampToDayBounds,
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
 *  - Fits the entire width cleanly without scrolling
 *  - Drag/drop ghost preview: dashed ghost card follows pointer at 15-min snap
 *
 * @param {{ selectedSections: object[], availableCourses: object[], dispatch: function }} props
 */
export default function Timetable({ selectedSections = [], availableCourses = [], dispatch }) {
  function handleRemove(id) {
    dispatch({ type: ACTION.REMOVE_SECTION, payload: id });
  }

  // ── Ghost preview state ───────────────────────────────────────────────────
  // ghost = { dayId, startMin, endMin } | null
  const [ghost, setGhost] = useState(null);
  // draggedSectionId: the section being dragged over (from DataTransfer)
  const draggedIdRef = useRef(null);

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

  const isEmpty = selectedSections.length === 0;

  return (
    <section className="nb-tt" aria-label="Weekly schedule timetable">
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

            return (
              <DayRow
                key={day.id}
                day={day}
                daySections={daySections}
                ghost={isGhostDay ? ghost : null}
                onDragOver={handleDayDragOver}
                onDragLeave={clearGhost}
                onDrop={clearGhost}
              />
            );
          })}

          {/* Empty state overlay */}
          {isEmpty && (
            <div className="nb-tt-empty" aria-live="polite">
              <span className="nb-tt-empty-icon" aria-hidden="true">📅</span>
              <p className="nb-tt-empty-msg">No classes on your timetable yet.</p>
              <p className="nb-tt-empty-hint">Add sections from Available Courses to build your draft schedule.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Day Row with drag-over support ────────────────────────────────────────────

function DayRow({ day, daySections, ghost, onDragOver, onDragLeave, onDrop }) {
  const trackRef = useRef(null);

  function handleDragOver(e) {
    if (trackRef.current) {
      onDragOver(e, day.id, trackRef.current);
    }
  }

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
        {daySections.map((sec) => (
          <SectionBlock key={`${sec.id}-${day.id}`} sec={sec} />
        ))}

        {/* Ghost preview */}
        {ghost && (
          <GhostBlock ghost={ghost} />
        )}
      </div>
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

function SectionBlock({ sec }) {
  const leftPct = toPercent(sec.start);
  const widthPct = ((sec.end - sec.start) / TOTAL_MINUTES) * 100;
  const timeLabel = `${format24h(sec.start)} - ${format24h(sec.end)}`;

  return (
    <article
      className="nb-tt-block"
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      aria-label={`${sec.title} (${sec.id}), ${sec.day} ${timeLabel}`}
      title={`${sec.title} (${sec.id})\n${sec.day} ${timeLabel}`}
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
