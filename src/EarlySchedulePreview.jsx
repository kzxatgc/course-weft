import React from 'react';
import Timetable from './components/Timetable.jsx';
import AvailableCourses from './components/AvailableCourses.jsx';
import { MAIN_CATALOG, INITIAL_DRAFT } from './domain/available-courses.mjs';

/**
 * EarlySchedulePreview — main schedule workspace.
 *
 * Renders the weekly Timetable (Task 25) and the Available Courses strip (Task 26).
 * Undo / Reset icon controls live inline in the AvailableCourses header (Task 28).
 * All data is synthetic sample data only (no live registration system).
 */
export default function EarlySchedulePreview({ state, dispatch }) {
  const availableCourses = state?.availableCourses || MAIN_CATALOG;
  const draft = state?.draft || INITIAL_DRAFT;

  // Fully hydrated section records for sections currently in the draft
  const selectedSections = availableCourses.filter((item) => draft.includes(item.id));

  return (
    <div className="space-y-3 px-1.5 py-1">
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
        {/* ── Available Courses horizontal strip (Task 26) ─────────── */}
        {/* state is passed so AvailableCourses can show inline Undo / Reset icons (Task 28) */}
        <AvailableCourses
          availableCourses={availableCourses}
          draft={draft}
          dispatch={dispatch}
          search={state?.search || ''}
          state={state}
        />

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


