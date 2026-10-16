import React, { useState, useEffect, useId } from 'react';
import { Search, X, Users } from 'lucide-react';
import { ACTION } from '../state/draft-controller.mjs';

import { format24hTime, formatCourseSlot } from '../domain/time.mjs';

export { formatCourseSlot };

/**
 * AvailableCourses — Task 26
 *
 * Renders the searchable list of available course sections.
 * Features:
 *  - Search input with placeholder "Search..." and Search button on top right of header
 *  - Instant live filtering by course code and course title (case-insensitive)
 *  - Whole card acts as the accessible Add or Switch control
 *  - Displays enrolled/capacity counts and derived seats remaining
 *  - Clear disclosure that all figures are synthetic sample data
 *  - Handles controller dispatch for ADD_SECTION and SWITCH_SECTION
 *  - Empty state when no courses match query
 *  - Neo-brutalist styling built with Tailwind utility classes
 *
 * @param {{
 *   availableCourses: object[],
 *   draft: string[],
 *   dispatch: function,
 *   search?: string
 * }} props
 */
export default function AvailableCourses({
  availableCourses = [],
  draft = [],
  dispatch,
  search: controlledSearch = '',
}) {
  const [localSearch, setLocalSearch] = useState(controlledSearch);
  const searchInputId = useId();

  // Keep local search in sync when controlled search changes
  useEffect(() => {
    setLocalSearch(controlledSearch);
  }, [controlledSearch]);

  const query = localSearch.trim().toLowerCase();

  // Filter sections that are not already in draft
  const availableItems = availableCourses.filter((item) => !draft.includes(item.id));

  // Search by course code (e.g. "CHEM", "CHEM-B", "BIO") and course name (e.g. "Chemistry", "Statistics")
  const filteredCourses = availableItems.filter((item) => {
    if (!query) return true;
    const codeMatch =
      item.id?.toLowerCase().includes(query) ||
      item.course?.toLowerCase().includes(query);
    const nameMatch = item.title?.toLowerCase().includes(query);
    return Boolean(codeMatch || nameMatch);
  });

  function handleSearchSubmit(e) {
    e?.preventDefault();
    if (dispatch) {
      dispatch({ type: ACTION.SET_SEARCH, payload: localSearch });
    }
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setLocalSearch(val);
    if (dispatch) {
      dispatch({ type: ACTION.SET_SEARCH, payload: val });
    }
  }

  function handleClearSearch() {
    setLocalSearch('');
    if (dispatch) {
      dispatch({ type: ACTION.SET_SEARCH, payload: '' });
    }
  }

  function handleCardClick(item) {
    if (!dispatch) return;

    // Check if another section of this course (or an alternate) is already in the draft
    const draftedAlternate = draft.find((draftId) => {
      const drafted = availableCourses.find((c) => c.id === draftId);
      if (!drafted) return false;
      return (
        drafted.course === item.course ||
        (Array.isArray(item.alternates) && item.alternates.includes(draftId)) ||
        (Array.isArray(drafted.alternates) && drafted.alternates.includes(item.id))
      );
    });

    if (draftedAlternate) {
      // Dispatches switch to replace currently drafted alternate with this section
      dispatch({
        type: ACTION.SWITCH_SECTION,
        payload: { toId: item.id, fromId: draftedAlternate },
      });
    } else {
      // Dispatches add section
      dispatch({
        type: ACTION.ADD_SECTION,
        payload: item.id,
      });
    }
  }

  return (
    <section
      aria-labelledby="catalogue-heading"
      className="nb-courses-panel w-full border-[2.5px] border-[var(--color-navy)] bg-[var(--color-cream)] overflow-hidden font-mono shadow-none"
    >
      {/* ── Header Bar: Heading on Left, Search on Right ─────────── */}
      <div className="nb-courses-header flex items-center justify-between min-h-[32px] px-2.5 py-1 bg-[var(--color-yellow)] border-b-2 border-[var(--color-navy)] gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <h2
            id="catalogue-heading"
            className="nb-courses-title font-['Archivo_Black',sans-serif] text-[11px] font-black uppercase text-[var(--color-navy)] tracking-wider m-0"
          >
            Available Courses
          </h2>
          <span className="text-[9px] font-bold font-mono tracking-wider uppercase text-[var(--color-navy)]/80 hidden sm:inline">
            ({filteredCourses.length} {filteredCourses.length === 1 ? 'course' : 'courses'})
          </span>
        </div>

        {/* Search bar on top right replacing static text */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-1.5 ml-auto"
          role="search"
          aria-label="Filter available courses"
        >
          <div className="relative flex items-center">
            <input
              id={searchInputId}
              type="text"
              value={localSearch}
              onChange={handleSearchChange}
              placeholder="Search..."
              maxLength={50}
              className="h-6 w-32 sm:w-44 pl-2 pr-6 text-[10px] font-mono font-bold bg-[#fffdf8] border-2 border-[var(--color-navy)] rounded text-[var(--color-navy)] placeholder:text-[var(--color-navy)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]"
              aria-label="Search courses by code or title"
            />
            {localSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear course search"
                className="absolute right-1 text-[var(--color-navy)]/60 hover:text-[var(--color-navy)] p-0.5 cursor-pointer"
              >
                <X size={11} strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="submit"
            aria-label="Execute course search"
            className="h-6 px-2 text-[9px] font-black font-mono uppercase bg-[var(--color-navy)] text-[var(--color-cream)] rounded hover:opacity-90 active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Search size={10} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </form>
      </div>

      {/* ── Horizontally scrolling row of Neo-Brutalist cards ─────── */}
      <div
        className="nb-courses-track nb-courses-scroll flex items-stretch gap-2 p-2 overflow-x-auto min-h-[90px]"
        role="list"
        aria-label="Available course sections list"
      >
        {filteredCourses.length > 0 ? (
          filteredCourses.map((item) => {
            const seatsRemaining = Math.max(0, item.capacity - item.enrolled);
            const isSwitch = draft.some((draftId) => {
              const drafted = availableCourses.find((c) => c.id === draftId);
              return drafted && (drafted.course === item.course || item.alternates?.includes(draftId));
            });

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleCardClick(item)}
                className="nb-course-card w-[195px] min-w-[195px] shrink-0 bg-[var(--color-cream)] border-2 border-[var(--color-navy)] rounded p-2 flex flex-col justify-between gap-1.5 cursor-pointer text-left transition-all duration-75 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_var(--color-navy)] hover:bg-[var(--color-yellow)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-blue)]"
                role="listitem"
                aria-label={`${isSwitch ? 'Switch to' : 'Add'} ${item.title} (${item.id}), ${formatCourseSlot(item)}, ${seatsRemaining} seats available`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="nb-course-id font-['Archivo_Black',sans-serif] text-[11px] font-black text-[var(--color-navy)] tracking-wide">
                      {item.id}
                    </span>
                    <span className="nb-course-badge text-[8px] font-black uppercase tracking-wider bg-[var(--color-navy)] text-[var(--color-cream)] px-1.5 py-0.5 rounded leading-none">
                      {item.component}
                    </span>
                  </div>

                  <h3
                    className="nb-course-name font-mono text-[10.5px] font-bold text-[var(--color-charcoal)] truncate mt-1 text-left"
                    title={item.title}
                  >
                    {item.title}
                  </h3>
                </div>

                <div className="nb-course-footer flex items-center justify-between border-t border-[var(--color-navy)]/15 pt-1 mt-1 text-left w-full">
                  <span className="nb-course-time font-mono text-[9px] font-bold text-[var(--color-navy)] whitespace-nowrap">
                    {formatCourseSlot(item)}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="nb-course-seats font-mono text-[9px] font-extrabold text-[var(--color-charcoal)] whitespace-nowrap">
                      {item.enrolled}/{item.capacity}
                    </span>
                    <Users size={9} strokeWidth={2.5} className="text-[var(--color-charcoal)]/60 shrink-0" aria-hidden="true" />
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="flex items-center w-full gap-3 px-1 py-0 text-[var(--color-navy)] font-mono text-[10px] font-bold">
            <span className="opacity-70">No courses found matching &ldquo;{localSearch}&rdquo;.</span>
            <button
              type="button"
              onClick={handleClearSearch}
              className="ml-auto shrink-0 text-[9px] font-black font-mono uppercase underline underline-offset-2 cursor-pointer hover:opacity-75"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
