import React, { useState, useEffect, useId, useRef } from 'react';
import { Search, X, Users, Undo2, Redo2, RotateCcw } from 'lucide-react';
import { ACTION, canUndo, canRedo } from '../state/draft-controller.mjs';
import { INITIAL_DRAFT } from '../domain/available-courses.mjs';

import { format24hTime, formatCourseSlot } from '../domain/time.mjs';
import { playSound } from '../audio/optional-sounds.js';
import { DT_SECTION_ID } from '../domain/drop-preview.mjs';

export { formatCourseSlot };

/**
 * AvailableCourses
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
 *  - Emits onPreviewSectionChange on keyboard focus/blur and when dragging leaves tray
 *
 * @param {{
 *   availableCourses: object[],
 *   draft: string[],
 *   dispatch: function,
 *   search?: string,
 *   state?: object,
 *   onPreviewSectionChange?: function
 * }} props
 */
export default function AvailableCourses({
  availableCourses = [],
  draft = [],
  dispatch,
  search: controlledSearch = '',
  state = null,
  onPreviewSectionChange,
}) {
  const [localSearch, setLocalSearch] = useState(controlledSearch);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const searchInputId = useId();
  const draggedCardIdRef = useRef(null);

  // Keep local search in sync when controlled search changes
  useEffect(() => {
    setLocalSearch(controlledSearch);
  }, [controlledSearch]);

  // Undo / Redo / Reset derivations (only when state is wired in)
  const canUndoRepair = state ? canUndo(state) : false;
  const canRedoRepair = state ? canRedo(state) : false;
  const isDraftChanged = state
    ? !arraysEqual(draft, INITIAL_DRAFT)
    : false;

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
    <div className="flex items-stretch gap-2 w-full font-mono">
      {/* ── Available Courses section box ── */}
      <section
        aria-labelledby="catalogue-heading"
        className="nb-courses-panel flex-1 min-w-0 border-[2.5px] border-[var(--color-navy)] bg-[var(--color-cream)] overflow-hidden shadow-none"
        onDragLeave={(e) => {
          if (draggedCardIdRef.current && !e.currentTarget.contains(e.relatedTarget)) {
            onPreviewSectionChange?.(draggedCardIdRef.current);
          }
        }}
        onDragEnter={(e) => {
          if (draggedCardIdRef.current && e.currentTarget.contains(e.target)) {
            onPreviewSectionChange?.(null);
          }
        }}
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
                draggable={true}
                onDragStart={(e) => {
                  draggedCardIdRef.current = item.id;
                  e.dataTransfer.effectAllowed = 'copy';
                  e.dataTransfer.setData(DT_SECTION_ID, item.id);
                  // Also store as plain text for fallback
                  e.dataTransfer.setData('text/plain', item.id);
                }}
                onDragEnd={() => {
                  draggedCardIdRef.current = null;
                  onPreviewSectionChange?.(null);
                }}
                onFocus={() => {
                  onPreviewSectionChange?.(item.id);
                }}
                onBlur={() => {
                  onPreviewSectionChange?.(null);
                }}
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

      {/* ── Outside vertical toolbar on right: Undo, Redo, Reset ── */}
      <div
        className="flex flex-col items-center justify-center gap-2 px-1.5 py-2 bg-[var(--color-cream)] border-[2.5px] border-[var(--color-navy)] shrink-0 shadow-none"
        aria-label="Timetable history controls"
      >
        <button
          id="undo-repair-button"
          type="button"
          disabled={!canUndoRepair}
          onClick={() => {
            playSound('undo');
            if (dispatch) dispatch({ type: ACTION.UNDO_REPAIR });
          }}
          aria-label="Undo last repair — restore previous timetable"
          title={canUndoRepair ? 'Undo repair' : 'Nothing to undo'}
          className={`flex items-center justify-center w-6 h-6 rounded-none border-2 transition-colors ${
            canUndoRepair
              ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-yellow)] hover:bg-[var(--color-yellow)] hover:text-[var(--color-navy)] cursor-pointer'
              : 'border-[var(--color-navy)]/30 bg-transparent text-[var(--color-navy)]/35 cursor-not-allowed'
          }`}
        >
          <Undo2 size={12} strokeWidth={2.5} aria-hidden="true" />
        </button>

        <button
          id="redo-repair-button"
          type="button"
          disabled={!canRedoRepair}
          onClick={() => {
            playSound('redo');
            if (dispatch) dispatch({ type: ACTION.REDO_REPAIR });
          }}
          aria-label="Redo repair — reapply timetable repair"
          title={canRedoRepair ? 'Redo repair' : 'Nothing to redo'}
          className={`flex items-center justify-center w-6 h-6 rounded-none border-2 transition-colors ${
            canRedoRepair
              ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-yellow)] hover:bg-[var(--color-yellow)] hover:text-[var(--color-navy)] cursor-pointer'
              : 'border-[var(--color-navy)]/30 bg-transparent text-[var(--color-navy)]/35 cursor-not-allowed'
          }`}
        >
          <Redo2 size={12} strokeWidth={2.5} aria-hidden="true" />
        </button>

        <button
          id="reset-timetable-button"
          type="button"
          disabled={!isDraftChanged}
          onClick={() => {
            playSound('popup');
            setShowResetConfirm(true);
          }}
          aria-label="Reset timetable to starting selections"
          title={isDraftChanged ? 'Reset timetable' : 'Timetable is already at starting selections'}
          className={`flex items-center justify-center w-6 h-6 rounded-none border-2 transition-colors ${
            isDraftChanged
              ? 'border-[var(--color-navy)] bg-white text-[var(--color-navy)] hover:bg-slate-100 cursor-pointer'
              : 'border-[var(--color-navy)]/30 bg-transparent text-[var(--color-navy)]/35 cursor-not-allowed'
          }`}
        >
          <RotateCcw size={12} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      {/* ── Reset Confirmation Dialog ── */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px] p-4 select-none font-mono"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            role="alertdialog"
            aria-labelledby="reset-dialog-title"
            aria-describedby="reset-dialog-desc"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-none border-[3px] border-[var(--color-navy)] bg-[#fffdf8] shadow-[6px_6px_0px_0px_var(--color-navy)] overflow-hidden"
          >
            {/* Title Bar */}
            <div className="flex items-center justify-between px-3.5 py-2 bg-[var(--color-yellow)] text-[var(--color-navy)] border-b-[3px] border-[var(--color-navy)]">
              <div className="flex items-center gap-1.5">
                <RotateCcw size={13} strokeWidth={2.5} aria-hidden="true" />
                <span id="reset-dialog-title" className="font-['Archivo_Black',sans-serif] text-[11px] uppercase tracking-wider font-black">
                  Confirm Reset
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                aria-label="Close dialog"
                className="text-[var(--color-navy)] hover:bg-black/10 p-0.5 cursor-pointer transition-colors"
              >
                <X size={14} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-4">
              <p id="reset-dialog-desc" className="text-xs text-[var(--color-navy)] leading-relaxed font-sans font-medium">
                Are you sure you want to reset your timetable? All added or repaired courses will return to the starting selections.
              </p>

              {/* Actions: Cancel vs Confirm Reset */}
              <div className="mt-4 pt-3 border-t border-[var(--color-navy)]/15 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-2 border-[var(--color-navy)] bg-white text-[var(--color-navy)] hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="confirm-reset-button"
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false);
                    if (dispatch) {
                      dispatch({ type: ACTION.RESET_DRAFT });
                    }
                  }}
                  className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider border-2 border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-yellow)] hover:bg-[var(--color-yellow)] hover:text-[var(--color-navy)] transition-colors cursor-pointer"
                >
                  Reset Timetable
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shallow array equality (order-sensitive). */
function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
