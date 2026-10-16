import React, { useState, useEffect, useId, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Users, Undo2, Redo2, RotateCcw, Wrench } from 'lucide-react';
import { ACTION, canUndo, canRedo } from '../state/draft-controller.mjs';
import { INITIAL_DRAFT } from '../domain/available-courses.mjs';

import { format24hTime, formatCourseSlot } from '../domain/time.mjs';
import { playSound } from '../audio/optional-sounds.js';
import {
  DT_SECTION_ID,
  POINTER_DRAG_THRESHOLD,
  hasExceededDragThreshold,
  isCardTouchingTimetable,
  isCardOutsidePanel,
  evaluateDrop,
  detectTimeConflict,
} from '../domain/drop-preview.mjs';

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
  repairPreviewId = null,
  onRequestSwap,
  animatingReturnId = null,
  returningCardId = null,
  linkedOutlineIds = [],
  rainbowPair = null,
}) {
  const [localSearch, setLocalSearch] = useState(controlledSearch);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const searchInputId = useId();
  const draggedCardIdRef = useRef(null);

  // Shaking card id (briefly set on full-lab drag attempt)
  const [shakingId, setShakingId] = useState(null);
  const shakeTimerRef = useRef(null);

  // Pointer drag-and-drop state
  const [heldCard, setHeldCard] = useState(null);
  const pointerStateRef = useRef(null);
  const isRestoringTimeoutRef = useRef(null);
  const preservePreviewOnBlurRef = useRef(false);
  const panelRef = useRef(null);

  // Keep local search in sync when controlled search changes
  useEffect(() => {
    setLocalSearch(controlledSearch);
  }, [controlledSearch]);

  // Clean up any pending restoration timer on unmount
  useEffect(() => {
    return () => {
      if (isRestoringTimeoutRef.current) {
        clearTimeout(isRestoringTimeoutRef.current);
      }
      if (shakeTimerRef.current) {
        clearTimeout(shakeTimerRef.current);
      }
    };
  }, []);

  /**
   * Trigger shake on a full-lab card (e.g. when drag is attempted).
   * Removes the class after the animation completes (420 ms).
   * No-op when prefers-reduced-motion is active (CSS handles it already,
   * but we still want the class added so screen readers get the aria-live ping).
   */
  const triggerShake = useCallback((itemId) => {
    if (shakingId === itemId) return; // already shaking
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    setShakingId(itemId);
    shakeTimerRef.current = setTimeout(() => {
      setShakingId(null);
      shakeTimerRef.current = null;
    }, 450); // slightly longer than 420 ms animation
  }, [shakingId]);

  // Undo / Redo / Reset derivations (only when state is wired in)
  const canUndoRepair = state ? canUndo(state) : false;
  const canRedoRepair = state ? canRedo(state) : false;
  const isDraftChanged = state
    ? !arraysEqual(draft, INITIAL_DRAFT)
    : false;

  const query = localSearch.trim().toLowerCase();

  // Selected sections for checking time conflicts
  const selectedSections = availableCourses.filter((item) => draft.includes(item.id));

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

  function handleCardClick(item, dropInfo = null) {
    if (!dispatch) return;

    // Check if another section of this course component (or declared alternate) is already in the draft
    const draftedAlternate = draft.find((draftId) => {
      const drafted = availableCourses.find((c) => c.id === draftId);
      if (!drafted) return false;
      return (
        (drafted.course === item.course && drafted.component === item.component) ||
        (Array.isArray(item.alternates) && item.alternates.includes(draftId)) ||
        (Array.isArray(drafted.alternates) && drafted.alternates.includes(item.id))
      );
    });

    if (draftedAlternate) {
      if (onRequestSwap) {
        onRequestSwap({ toId: item.id, fromId: draftedAlternate, dropInfo });
      } else {
        // Dispatches switch to replace currently drafted alternate with this section
        dispatch({
          type: ACTION.SWITCH_SECTION,
          payload: { toId: item.id, fromId: draftedAlternate },
        });
      }
    } else {
      // Dispatches add section
      dispatch({
        type: ACTION.ADD_SECTION,
        payload: item.id,
      });
    }
  }


  function handlePointerDown(e, item) {
    if (e.button !== 0) return; // Only primary button

    // Block drag entirely for full lab sections
    const isFullLab =
      (item.seat === 'full' ||
        (typeof item.capacity === 'number' && item.enrolled >= item.capacity)) &&
      (item.linkedGroup === 'BIO-214-labs' || item.requiredBy === 'BIO-214');
    if (isFullLab) {
      e.preventDefault();
      triggerShake(item.id);
      return;
    }

    if (heldCard && heldCard.isSticky) return; // Sticky drop is handled by window listener

    if (isRestoringTimeoutRef.current) {
      clearTimeout(isRestoringTimeoutRef.current);
      isRestoringTimeoutRef.current = null;
    }

    const targetEl = e.currentTarget;
    const rect = targetEl.getBoundingClientRect();

    pointerStateRef.current = {
      item,
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

      if (!cur.isDragging) {
        if (hasExceededDragThreshold(dx, dy, POINTER_DRAG_THRESHOLD)) {
          cur.isDragging = true;

          setHeldCard({
            item: cur.item,
            currentX: moveEvent.clientX,
            currentY: moveEvent.clientY,
            offsetX: cur.offsetX,
            offsetY: cur.offsetY,
            origRect: cur.origRect,
            isRestoring: false,
            isSticky: false,
          });
        }
      }

      if (cur.isDragging) {
        setHeldCard({
          item: cur.item,
          currentX: moveEvent.clientX,
          currentY: moveEvent.clientY,
          offsetX: cur.offsetX,
          offsetY: cur.offsetY,
          origRect: cur.origRect,
          isRestoring: false,
          isSticky: false,
        });

        // Show fixed-slot preview as soon as dragging starts
        onPreviewSectionChange?.(cur.item.id);
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
      onPreviewSectionChange?.(null);

      if (cur.isDragging) {
        setHeldCard({
          item: cur.item,
          currentX: cur.origRect.left + cur.offsetX,
          currentY: cur.origRect.top + cur.offsetY,
          offsetX: cur.offsetX,
          offsetY: cur.offsetY,
          origRect: cur.origRect,
          isRestoring: true,
          isSticky: false,
        });

        isRestoringTimeoutRef.current = setTimeout(() => {
          setHeldCard(null);
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
        // Simple click (no drag): do nothing, just clean up pointer state
        pointerStateRef.current = null;
        return;
      }

      // Card was dragged via hold-and-drag: evaluate boundary touch with timetable
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

      const touchesTimetable = isCardTouchingTimetable(cardRect, timetableRect);
      const hasConflict = detectTimeConflict(cur.item, selectedSections);
      const dropResult = evaluateDrop({ touchesTimetable, hasConflict });

      if (dropResult.success) {
        // Drop successful: add or switch section and close gap
        // Capture drop coordinates BEFORE clearing held card (origRect will be gone after)
        const dropInfo = {
          dropPoint: { x: upEvent.clientX, y: upEvent.clientY },
          origRect: { ...cur.origRect },  // Section B's original card position in the tray
        };
        onPreviewSectionChange?.(null);
        setHeldCard(null);
        pointerStateRef.current = null;
        handleCardClick(cur.item, dropInfo);
      } else {
        // Red drop or outside timetable: animate back to original position
        const keepConflictPreview = touchesTimetable && hasConflict;
        preservePreviewOnBlurRef.current = keepConflictPreview;
        onPreviewSectionChange?.(keepConflictPreview ? cur.item.id : null);
        setHeldCard({
          item: cur.item,
          currentX: cur.origRect.left + cur.offsetX,
          currentY: cur.origRect.top + cur.offsetY,
          offsetX: cur.offsetX,
          offsetY: cur.offsetY,
          origRect: cur.origRect,
          isRestoring: true,
          isSticky: false,
        });

        isRestoringTimeoutRef.current = setTimeout(() => {
          setHeldCard(null);
          pointerStateRef.current = null;
          isRestoringTimeoutRef.current = null;
        }, 220);
      }
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('keydown', onKeyDown);
  }



  return (
    <div className="flex items-stretch gap-2 w-full font-mono relative">
      {/* ── Available Courses section box ── */}
      <section
        ref={panelRef}
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
            <span
              className="nb-courses-count"
              aria-label={`${availableItems.length} ${availableItems.length === 1 ? 'course' : 'courses'} available`}
            >
              {availableItems.length}
            </span>
            {repairPreviewId && dispatch && (
              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onBlur={() => {
                  preservePreviewOnBlurRef.current = false;
                  onPreviewSectionChange?.(null);
                }}
                onClick={() => {
                  dispatch({ type: ACTION.SET_REQUEST, payload: repairPreviewId });
                  dispatch({
                    type: ACTION.SET_NOTICE,
                    payload: {
                      kind: 'error',
                      title: 'Review the timetable conflict',
                      message: `A valid repair is available for ${repairPreviewId}. Find a valid repair to review possible changes. Your timetable will not change until you apply the repair.`,
                      action: 'suggest',
                    },
                  });
                }}
                aria-label={`Find a valid repair for ${repairPreviewId}`}
                title={`Find a valid repair for ${repairPreviewId}`}
                data-repair-action
                className="nb-repair-action inline-flex h-6 w-4 items-center justify-center border-0 bg-transparent p-0 text-[var(--color-navy)] hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-navy)] transition-opacity cursor-pointer shrink-0"
              >
                <Wrench size={12} strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
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
              const isHeld = Boolean(heldCard && heldCard.item.id === item.id);
              const isReturning = Boolean((animatingReturnId || returningCardId) === item.id);

              if (isHeld || isReturning) {
                return (
                  <div
                    key={item.id}
                    className="nb-course-placeholder w-[195px] min-w-[195px] shrink-0 border-2 border-dashed border-[var(--color-navy)]/35 rounded bg-[var(--color-navy)]/5 transition-opacity duration-150"
                    style={{
                      height: heldCard?.origRect?.height ? `${heldCard.origRect.height}px` : undefined,
                    }}
                    data-testid={isReturning ? `course-return-placeholder-${item.id}` : `course-placeholder-${item.id}`}
                    aria-hidden="true"
                  />
                );
              }

              const seatsRemaining = Math.max(0, item.capacity - item.enrolled);
              const isSwitch = draft.some((draftId) => {
                const drafted = availableCourses.find((c) => c.id === draftId);
                return (
                  drafted &&
                  ((drafted.course === item.course && drafted.component === item.component) ||
                    item.alternates?.includes(draftId))
                );
              });

              // Setect full linked-lab sections
              const isFullLab =
                (item.seat === 'full' ||
                  (typeof item.capacity === 'number' && item.enrolled >= item.capacity)) &&
                (item.linkedGroup === 'BIO-214-labs' || item.requiredBy === 'BIO-214');

              const hasLinkedOutline = Boolean(linkedOutlineIds?.includes(item.id));
              const isShaking = shakingId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  draggable={!isFullLab}
                  onDragStart={(e) => {
                    if (isFullLab) {
                      e.preventDefault();
                      triggerShake(item.id);
                      return;
                    }
                    e.preventDefault();
                    draggedCardIdRef.current = item.id;
                    e.dataTransfer?.setData(DT_SECTION_ID, item.id);
                    // Also store as plain text for fallback
                    e.dataTransfer?.setData('text/plain', item.id);
                  }}
                  onDragEnd={() => {
                    draggedCardIdRef.current = null;
                    onPreviewSectionChange?.(null);
                  }}
                  onFocus={() => {
                    preservePreviewOnBlurRef.current = false;
                    if (!isFullLab) onPreviewSectionChange?.(item.id);
                  }}
                  onBlur={(event) => {
                    if (
                      !preservePreviewOnBlurRef.current &&
                      !event.relatedTarget?.closest?.('[data-repair-action]')
                    ) {
                      onPreviewSectionChange?.(null);
                    }
                  }}
                  onPointerDown={(e) => handlePointerDown(e, item)}
                  className={`nb-course-card w-[195px] min-w-[195px] shrink-0 bg-[var(--color-cream)] border-2 border-[var(--color-navy)] rounded p-2 flex flex-col justify-between gap-1.5 text-left transition-colors duration-75 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-blue)] touch-none ${
                    isFullLab
                      ? 'nb-full-lab'
                      : 'cursor-grab hover:bg-[var(--color-yellow)]'
                  } ${
                    hasLinkedOutline ? 'nb-linked-outline' : ''
                  } ${
                    isShaking ? 'nb-shake' : ''
                  }`}
                  style={
                    hasLinkedOutline && rainbowPair
                      ? {
                          '--rainbow-c1': rainbowPair[0],
                          '--rainbow-c2': rainbowPair[1],
                        }
                      : undefined
                  }
                  data-linked-outline={hasLinkedOutline ? 'true' : 'false'}
                  data-full-lab={isFullLab ? 'true' : 'false'}
                  role="listitem"
                  aria-label={
                    isFullLab
                      ? `${item.title} (${item.id}), ${formatCourseSlot(item)}, FULL — no seats available`
                      : `${item.title} (${item.id}), ${formatCourseSlot(item)}, ${seatsRemaining} seats remaining — drag onto timetable to add`
                  }
                  aria-disabled={isFullLab ? 'true' : undefined}
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
                      {isFullLab ? (
                        <span className="nb-full-badge" aria-hidden="true">FULL</span>
                      ) : (
                        <>
                          <span className="nb-course-seats font-mono text-[9px] font-extrabold text-[var(--color-charcoal)] whitespace-nowrap">
                            {item.enrolled}/{item.capacity}
                          </span>
                          <Users size={9} strokeWidth={2.5} className="text-[var(--color-charcoal)]/60 shrink-0" aria-hidden="true" />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Live region for shake announcement */}
                  {isShaking && (
                    <span
                      role="alert"
                      aria-live="assertive"
                      className="sr-only"
                    >
                      {item.id} lab section is full. No seats available.
                    </span>
                  )}
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
          className={`flex items-center justify-center w-6 h-6 rounded-none border-2 transition-colors ${canUndoRepair
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
          className={`flex items-center justify-center w-6 h-6 rounded-none border-2 transition-colors ${canRedoRepair
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
          className={`flex items-center justify-center w-6 h-6 rounded-none border-2 transition-colors ${isDraftChanged
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

      {/* ── Lifted/Held course card following pointer ── */}
      {heldCard && (
        typeof document !== 'undefined' && document.body
          ? createPortal(
            <div
              className={`nb-course-card-held fixed pointer-events-none z-[9999] select-none ${heldCard.isRestoring ? 'nb-course-card-held--restoring' : ''
                }`}
              style={{
                left: `${heldCard.currentX - heldCard.offsetX}px`,
                top: `${heldCard.currentY - heldCard.offsetY}px`,
                width: `${heldCard.origRect.width}px`,
                height: `${heldCard.origRect.height}px`,
              }}
              data-testid={`course-held-${heldCard.item.id}`}
              data-is-restoring={heldCard.isRestoring ? 'true' : 'false'}
              aria-hidden="true"
            >
              <HeldCardContent
                item={heldCard.item}
                isSwitch={draft.some((draftId) => {
                  const drafted = availableCourses.find((c) => c.id === draftId);
                  return (
                    drafted &&
                    ((drafted.course === heldCard.item.course && drafted.component === heldCard.item.component) ||
                      heldCard.item.alternates?.includes(draftId))
                  );
                })}
                formatCourseSlot={formatCourseSlot}
                hasLinkedOutline={Boolean(linkedOutlineIds?.includes(heldCard.item.id))}
                rainbowPair={rainbowPair}
              />
            </div>,
            document.body
          )
          : null
      )}
    </div>
  );
}

// ── Held card floating content───────────────────────────────────

function HeldCardContent({ item, isSwitch, formatCourseSlot, hasLinkedOutline = false, rainbowPair = null }) {
  const seatsRemaining = Math.max(0, item.capacity - item.enrolled);

  return (
    <div
      className={`nb-course-card nb-course-card--lifted w-full h-full bg-[var(--color-cream)] border-2 border-[var(--color-navy)] rounded p-2 flex flex-col justify-between gap-1.5 text-left shadow-[6px_6px_0px_var(--color-navy)] bg-[var(--color-yellow)] cursor-grabbing ${
        hasLinkedOutline ? 'nb-linked-outline' : ''
      }`}
      style={
        hasLinkedOutline && rainbowPair
          ? {
              '--rainbow-c1': rainbowPair[0],
              '--rainbow-c2': rainbowPair[1],
            }
          : undefined
      }
      data-linked-outline={hasLinkedOutline ? 'true' : 'false'}
      aria-hidden="true"
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
