import React from 'react';
import { formatTime } from '../domain/time.mjs';
import { ACTION } from '../state/draft-controller.mjs';

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
 *
 * @param {{ selectedSections: object[], dispatch: function }} props
 */
export default function Timetable({ selectedSections = [], dispatch }) {
  function handleRemove(id) {
    dispatch({ type: ACTION.REMOVE_SECTION, payload: id });
  }

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

            return (
              <div key={day.id} className="nb-tt-row" aria-label={day.full}>
                {/* Day label on Y-axis */}
                <div className="nb-tt-day-label">
                  <span className="nb-tt-day-badge">{day.short}</span>
                </div>

                {/* Day track with 10 column background lines & section blocks */}
                <div className="nb-tt-row-track">
                  {/* Background grid columns matching header */}
                  <div className="nb-tt-track-grid" aria-hidden="true">
                    {HOURS.map((h) => (
                      <div key={h.startMin} className="nb-tt-grid-col" />
                    ))}
                  </div>

                  {/* Section blocks on this day */}
                  {daySections.map((sec) => (
                    <SectionBlock
                      key={`${sec.id}-${day.id}`}
                      sec={sec}
                    />
                  ))}
                </div>
              </div>
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

export const START_MINUTE  = 8 * 60;   // 8:00 AM  (480)
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
