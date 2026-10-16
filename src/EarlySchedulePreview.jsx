import React from 'react';
import Timetable from './components/Timetable.jsx';
import { MAIN_CATALOG, INITIAL_DRAFT } from './domain/available-courses.mjs';
import { formatTimeRange } from './domain/time.mjs';

/**
 * EarlySchedulePreview — main schedule workspace.
 *
 * Renders the weekly Timetable (Task 25) and the Available Courses side panel.
 * Both panels are visible side-by-side on large screens; stacked on narrow widths.
 *
 * All data is synthetic sample data only (no live registration system).
 */
function format24hTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h < 10 ? '0' : ''}${h}${m < 10 ? '0' : ''}${m}`;
}

function formatCourseSlot(item) {
  const dayStr = item.day ? item.day.toUpperCase() : '';
  return `${dayStr} ${format24hTime(item.start)} - ${format24hTime(item.end)}`;
}

export default function EarlySchedulePreview({ state, dispatch }) {
  const availableCourses = state?.availableCourses || MAIN_CATALOG;
  const draft = state?.draft || INITIAL_DRAFT;

  // Fully hydrated section records for sections currently in the draft
  const selectedSections = availableCourses.filter((item) => draft.includes(item.id));

  return (
    <div className="space-y-3">
      {/* Fallback disclosure — shown only when rendered without AppShell (standalone/tests) */}
      {!state && (
        <div
          role="region"
          aria-label="Demo disclosure notice"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
            <strong className="text-xs sm:text-sm font-bold tracking-wide uppercase">
              SYNTHETIC SAMPLE DATA — NO REAL REGISTRATION IS SUBMITTED
            </strong>
          </div>
          <p className="mt-1 text-xs text-amber-900/90 leading-relaxed">
            All courses, meeting times, and availability counts are fictional sample data for local
            demonstration only. This portal does not connect to university registration systems.
          </p>
        </div>
      )}

      {/* ── Main planning workspace: Available Courses (top) + Timetable (below) ── */}
      <div className="flex flex-col gap-3 w-full">

        {/* ── Available Courses horizontal strip (Top) ──────────────── */}
        <section
          aria-labelledby="catalogue-heading"
          className="nb-courses-panel"
        >
          {/* Neo-brutalist yellow header bar matching timetable */}
          <div className="nb-courses-header">
            <h2 id="catalogue-heading" className="nb-courses-title">
              Available Courses
            </h2>
            <span className="nb-courses-hint">
              {MAIN_CATALOG.filter((item) => !draft.includes(item.id)).length} COURSES AVAILABLE · SWIPE OR SCROLL SIDEWAYS
            </span>
          </div>

          {/* Horizontally scrolling row of neo-brutalist course cards */}
          <div className="nb-courses-track nb-courses-scroll">
            {MAIN_CATALOG.filter((item) => !draft.includes(item.id)).map((item) => (
              <article
                key={item.id}
                className="nb-course-card"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="nb-course-id">{item.id}</span>
                    <span className="nb-course-badge">
                      {item.component}
                    </span>
                  </div>

                  <h3 className="nb-course-name" title={item.title}>
                    {item.title}
                  </h3>
                </div>

                <div className="nb-course-footer">
                  <span className="nb-course-time">
                    {formatCourseSlot(item)}
                  </span>
                  <span className="nb-course-seats">
                    {item.enrolled}/{item.capacity}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── Weekly Timetable (Task 25) — spans entire window width ── */}
        <div className="w-full min-w-0">
          <Timetable
            selectedSections={selectedSections}
            dispatch={dispatch}
          />
        </div>
      </div>
    </div>
  );
}
