import React from 'react';
import { MAIN_CATALOG, INITIAL_DRAFT } from './domain/available-courses.mjs';
import { formatTimeRange } from './domain/time.mjs';

const WEEKDAYS = [
  { id: 'Mon', short: 'Mon', full: 'Monday' },
  { id: 'Tue', short: 'Tue', full: 'Tuesday' },
  { id: 'Wed', short: 'Wed', full: 'Wednesday' },
  { id: 'Thu', short: 'Thu', full: 'Thursday' },
  { id: 'Fri', short: 'Fri', full: 'Friday' },
];

const START_MINUTE = 8 * 60; // 8:00 AM (480)
const END_MINUTE = 18 * 60; // 6:00 PM (1080)
const TOTAL_MINUTES = END_MINUTE - START_MINUTE; // 600 minutes (10 hours)

const TIME_MARKS = [
  { hour: 8, label: '8:00 AM', minute: 480 },
  { hour: 9, label: '9:00 AM', minute: 540 },
  { hour: 10, label: '10:00 AM', minute: 600 },
  { hour: 11, label: '11:00 AM', minute: 660 },
  { hour: 12, label: '12:00 PM', minute: 720 },
  { hour: 13, label: '1:00 PM', minute: 780 },
  { hour: 14, label: '2:00 PM', minute: 840 },
  { hour: 15, label: '3:00 PM', minute: 900 },
  { hour: 16, label: '4:00 PM', minute: 960 },
  { hour: 17, label: '5:00 PM', minute: 1020 },
  { hour: 18, label: '6:00 PM', minute: 1080 },
];

export default function EarlySchedulePreview({ state, dispatch }) {
  const availableCourses = state?.availableCourses || MAIN_CATALOG;
  const draft = state?.draft || INITIAL_DRAFT;
  const selectedSections = availableCourses.filter((item) =>
    draft.includes(item.id)
  );

  return (
    <div className="space-y-6">
      {/* Fallback disclosure only when rendered without AppShell */}
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
            All courses, meeting times, and availability counts are fictional sample data for local demonstration only. This portal does not connect to university registration systems.
          </p>
        </div>
      )}

      {/* Main Planning Workspace: Weekly Calendar Timetable beside Course Catalogue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Weekly Timetable Calendar Grid (8 cols) */}
        <section
          aria-labelledby="timetable-heading"
          className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs"
        >
          <div className="border-b border-slate-100 pb-3 mb-3">
            <h2 id="timetable-heading" className="text-base sm:text-lg font-bold text-slate-900">
              Weekly Timetable
            </h2>
          </div>

          {/* Calendar Table Container with Shared Vertical Time Scale */}
          <div className="w-full">
            {/* Weekday Header Row */}
            <div className="flex border-b border-slate-200 pb-2">
              <div className="w-12 sm:w-16 shrink-0" aria-hidden="true" />
              <div className="flex-1 grid grid-cols-5 gap-1 text-center">
                {WEEKDAYS.map((day) => (
                  <div key={day.id} className="min-w-0 px-0.5">
                    <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-700 block truncate">
                      <span className="sm:hidden">{day.short}</span>
                      <span className="hidden sm:inline">{day.full}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Time Grid: Shared Vertical Scale + 5 Day Columns */}
            <div className="relative flex mt-2 h-[520px]">
              {/* Left Vertical Time Scale with Hourly Labels from 8:00 AM to 6:00 PM */}
              <div
                className="w-12 sm:w-16 shrink-0 relative select-none pointer-events-none"
                aria-hidden="true"
              >
                {TIME_MARKS.map((mark, index) => {
                  const topPercent = ((mark.minute - START_MINUTE) / TOTAL_MINUTES) * 100;
                  return (
                    <div
                      key={mark.hour}
                      className="absolute right-2 text-[10px] sm:text-[11px] font-medium text-slate-400 whitespace-nowrap transform -translate-y-1/2"
                      style={{ top: `${topPercent}%` }}
                    >
                      {mark.label}
                    </div>
                  );
                })}
              </div>

              {/* 5-Column Day Grid (Shrinks to fit on narrow screens) */}
              <div className="flex-1 grid grid-cols-5 gap-1 relative border-l border-slate-200">
                {/* Hourly Background Grid Lines */}
                {TIME_MARKS.map((mark) => {
                  const topPercent = ((mark.minute - START_MINUTE) / TOTAL_MINUTES) * 100;
                  return (
                    <div
                      key={`line-${mark.hour}`}
                      className="absolute left-0 right-0 border-t border-slate-100 pointer-events-none"
                      style={{ top: `${topPercent}%` }}
                      aria-hidden="true"
                    />
                  );
                })}

                {/* Day Columns */}
                {WEEKDAYS.map((day) => {
                  // Find all sections that meet on this specific day
                  const daySections = selectedSections.filter((item) => {
                    if (item.day === day.id) return true;
                    if (Array.isArray(item.days) && item.days.includes(day.id)) return true;
                    return false;
                  });

                  return (
                    <div
                      key={day.id}
                      className="relative h-full border-r border-slate-100 last:border-r-0 min-w-0"
                    >
                      {/* Class Blocks positioned at actual start and end times */}
                      {daySections.map((sec) => {
                        const topPercent =
                          ((sec.start - START_MINUTE) / TOTAL_MINUTES) * 100;
                        const heightPercent =
                          ((sec.end - sec.start) / TOTAL_MINUTES) * 100;

                        return (
                          <div
                            key={`${sec.id}-${day.id}`}
                            className="absolute left-0.5 right-0.5 rounded-lg bg-[#1e46a7] text-white border border-[#163889] p-1.5 shadow-sm overflow-hidden flex flex-col justify-center transition-all z-10"
                            style={{
                              top: `${topPercent}%`,
                              height: `${heightPercent}%`,
                            }}
                            title={`${sec.course} ${sec.component.toUpperCase()} (${sec.id})`}
                          >
                            <div className="font-extrabold text-[11px] sm:text-xs leading-tight tracking-tight text-white truncate text-center sm:text-left">
                              {sec.course}
                            </div>
                            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-100/90 leading-tight truncate text-center sm:text-left mt-0.5">
                              {sec.component}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Available Courses Side Panel (4 cols) */}
        <section
          aria-labelledby="catalogue-heading"
          className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs"
        >
          <div className="border-b border-slate-100 pb-3 mb-3">
            <h2 id="catalogue-heading" className="text-base sm:text-lg font-bold text-slate-900">
              Available Courses
            </h2>
          </div>

          <div className="space-y-3 max-h-[555px] overflow-y-auto pr-1">
            {MAIN_CATALOG.filter((item) => !INITIAL_DRAFT.includes(item.id)).map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5 hover:border-slate-300 transition-colors text-left"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-900">{item.id}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                    {item.component}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-slate-800 mt-1">
                  {item.title}
                </h3>

                <div className="mt-2.5 flex items-center justify-between text-xs border-t border-slate-100 pt-2 text-slate-700">
                  <span className="font-medium text-slate-700">
                    {formatTimeRange(item)}
                  </span>
                  <span className="font-semibold text-slate-700">
                    {item.enrolled}/{item.capacity}
                  </span>
                </div>


              </article>
            ))}
          </div>


        </section>
      </div>
    </div>
  );
}
