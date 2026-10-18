import React, { useState } from 'react';

/**
 * Course Details window - provides a read-only overview of all sections
 * in the active scenario catalogue.
 */
export default function CourseDetailsWindow({ availableCourses }) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const filteredCourses = query
    ? availableCourses.filter((section) =>
        [section.id, section.course, section.title, section.component, section.sectionName]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))
      )
    : availableCourses;

  return (
    <div className="nb-win-section">
      <label className="nb-course-search-label" htmlFor="course-details-search">
        Search Courses
      </label>
      <form
        className="nb-course-search-form"
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <input
          id="course-details-search"
          className="nb-course-search"
          type="search"
          aria-label="Search courses by code or title"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by course code or title..."
        />
        <button className="nb-course-search-button" type="submit">
          Search
        </button>
      </form>
      <div className="nb-divider" />
      <div className="nb-course-list" role="list">
        {filteredCourses.map((section) => {
          const isFull = section.seat === 'full' || section.enrolled >= section.capacity;
          return (
            <div key={section.id} className="nb-course-row" role="listitem">
              <div className="nb-course-row-top">
                <span className="nb-course-id">{section.id}</span>
                <span className="nb-course-component">{section.component.toUpperCase()}</span>
                <span className={`nb-course-enroll${isFull ? ' nb-course-enroll--full' : ''}`}>
                  {section.enrolled}/{section.capacity}
                </span>
              </div>
              <div className="nb-course-title">{section.title}</div>
              <div className="nb-course-meta-row">
                <div className="nb-course-meta">
                  {section.days
                    ? section.days.join(', ')
                    : section.day ?? '-'}
                  {' · '}
                  {section.start != null
                    ? `${fmtMin(section.start)} - ${fmtMin(section.end)}`
                    : 'TBD'}
                </div>
                {isFull && <span className="nb-full-label">FULL</span>}
              </div>
            </div>
          );
        })}
        {filteredCourses.length === 0 && (
          <p className="nb-course-empty" role="status">No courses match your search.</p>
        )}
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
