import React from 'react';
import { MAIN_CATALOG } from '../domain/available-courses.mjs';

/**
 * Course Details window — provides a read-only overview of all sections
 * in the synthetic catalogue. Will add interactive features later here.
 */
export default function CourseDetailsWindow() {
  return (
    <div className="nb-win-section">
      <div className="nb-win-header">
        <h2 className="nb-win-heading">Course Details</h2>
        <span className="nb-badge">Synthetic sample data</span>
      </div>

      <p className="nb-win-desc">
        All sections shown are fictional sample data for local demonstration only.
        Enrolled/capacity counts do not reflect live availability.
      </p>

      <div className="nb-divider" />

      <div className="nb-course-list" role="list">
        {MAIN_CATALOG.map((section) => (
          <div key={section.id} className="nb-course-row" role="listitem">
            <div className="nb-course-row-top">
              <span className="nb-course-id">{section.id}</span>
              <span className="nb-course-component">{section.component.toUpperCase()}</span>
              <span className="nb-course-enroll">{section.enrolled}/{section.capacity}</span>
            </div>
            <div className="nb-course-title">{section.title}</div>
            <div className="nb-course-meta">
              {section.days
                ? section.days.join(', ')
                : section.day ?? '—'}
              {' · '}
              {section.start != null
                ? `${fmtMin(section.start)} – ${fmtMin(section.end)}`
                : 'TBD'}
            </div>
          </div>
        ))}
      </div>

      <div className="nb-win-footer-note">
        Interactive add/switch controls arrive in a later update. These counts are
        sample figures only and do not reflect live seat availability.
      </div>
    </div>
  );
}

/** Convert minute-of-day to HH:MM AM/PM. */
function fmtMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
