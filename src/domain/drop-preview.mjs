/**
 * drop-preview.mjs
 *
 * Pure domain helpers for the drag/drop pointer preview on the timetable.
 *
 * Responsibilities:
 *   - Resolve which day row the pointer is over
 *   - Convert pointer X offset → snapped minute-of-day (15-min snap)
 *   - Clamp start/end within the visible day bounds (08:00 – 18:00)
 *   - No React, no DOM — safe in Node.js test environments
 *
 * The DataTransfer payload written by AvailableCourses on dragStart is just
 * the section ID string. Timetable reads it via event.dataTransfer.getData().
 */
import { validateDraft, overlaps } from './validate.mjs';

export const SNAP_MINUTES   = 15;
export const DAY_START_MIN  = 8  * 60;  // 480
export const DAY_END_MIN    = 18 * 60;  // 1080
export const TOTAL_SPAN_MIN = DAY_END_MIN - DAY_START_MIN; // 600

/** DataTransfer MIME type used to carry the dragged section ID. */
export const DT_SECTION_ID = 'text/x-enrollfix-section-id';

/**
 * Snap a minute value to the nearest 15-minute boundary.
 *
 * @param {number} minute - Raw minute-of-day
 * @returns {number} Snapped minute
 */
export function snapToGrid(minute) {
  return Math.round(minute / SNAP_MINUTES) * SNAP_MINUTES;
}

/**
 * Clamp a minute value so it stays inside [DAY_START_MIN, DAY_END_MIN].
 *
 * @param {number} minute
 * @returns {number}
 */
export function clampToDayBounds(minute) {
  return Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, minute));
}

/**
 * Convert a pointer X position inside the track element to a minute-of-day,
 * then snap and clamp it.
 *
 * @param {number} pointerX  - clientX of the pointer event
 * @param {DOMRect} trackRect - getBoundingClientRect() of the day track element
 * @returns {number} Snapped, clamped start minute
 */
export function pointerXToMinute(pointerX, trackRect) {
  const relX      = pointerX - trackRect.left;
  const fraction  = Math.max(0, Math.min(1, relX / trackRect.width));
  const rawMinute = DAY_START_MIN + fraction * TOTAL_SPAN_MIN;
  return clampToDayBounds(snapToGrid(rawMinute));
}

/**
 * Given a snapped start minute and a section's original duration, compute the
 * end minute — clamped so the block never overflows past 18:00.
 *
 * @param {number} startMinute  - Snapped start minute
 * @param {number} durationMin  - Duration of the section in minutes
 * @returns {number} Clamped end minute
 */
export function computeEndMinute(startMinute, durationMin) {
  return clampToDayBounds(startMinute + durationMin);
}

/**
 * Build the complete ghost-preview state from a pointer dragover event.
 * Returns null when the pointer is not inside a valid timetable day track.
 *
 * @param {number} pointerX   - event.clientX
 * @param {number} pointerY   - event.clientY
 * @param {string} dayId      - The WEEKDAYS day ID of the row being hovered
 * @param {DOMRect} trackRect - getBoundingClientRect() of that day's track div
 * @param {number} durationMin - Duration in minutes of the dragged section
 * @returns {{ dayId: string, startMin: number, endMin: number } | null}
 */
export function buildGhostPreview(pointerX, pointerY, dayId, trackRect, durationMin) {
  if (!dayId || !trackRect || durationMin <= 0) return null;

  const startMin = pointerXToMinute(pointerX, trackRect);
  const endMin   = computeEndMinute(startMin, durationMin);

  return { dayId, startMin, endMin };
}

/**
 * Determine whether two time intervals overlap using standard half-open intervals [start, end).
 * If endA === startB or startA === endB, they touch only at a boundary point and do NOT overlap.
 *
 * @param {number} startA
 * @param {number} endA
 * @param {number} startB
 * @param {number} endB
 * @returns {boolean}
 */
export function isHalfOpenOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

/**
 * Helper to normalize section day(s) into an array of day IDs.
 *
 * @param {object} sec
 * @returns {string[]}
 */
export function getSectionDays(sec) {
  if (!sec) return [];
  if (Array.isArray(sec.days)) return sec.days;
  if (sec.day) return [sec.day];
  return [];
}

/**
 * Find all sections in `selectedSections` that have an overlapping meeting time with `section`.
 * Only sections sharing at least one meeting day are considered.
 * Matches against the candidate section itself (by id) are ignored.
 *
 * @param {object} section - The section to test
 * @param {object[]} selectedSections - Array of sections currently in the timetable draft
 * @returns {object[]} List of overlapping sections
 */
export function getConflictingSections(section, selectedSections = []) {
  if (!section || section.start == null || section.end == null) return [];
  if (!Array.isArray(selectedSections) || selectedSections.length === 0) return [];

  const secDays = getSectionDays(section);
  if (secDays.length === 0) return [];

  return selectedSections.filter((s) => {
    if (!s || s.id === section.id) return false;
    if (s.start == null || s.end == null) return false;

    const sDays = getSectionDays(s);
    const sharesDay = secDays.some((d) => sDays.includes(d));
    if (!sharesDay) return false;

    return isHalfOpenOverlap(section.start, section.end, s.start, s.end);
  });
}

/**
 * Detect whether `section` conflicts in scheduled meeting time with any section in `selectedSections`.
 *
 * @param {object} section - The section to test
 * @param {object[]} selectedSections - Array of sections currently in the timetable draft
 * @returns {boolean} True if there is at least one time overlap
 */
export function detectTimeConflict(section, selectedSections = []) {
  return getConflictingSections(section, selectedSections).length > 0;
}

/**
 * Build a fixed-slot preview descriptor for a section.
 * The slot position is derived strictly from the section's official scheduled day, start, and end,
 * completely independent of any pointer or drag coordinates.
 *
 * @param {object} section - Candidate section { id, day, days, start, end, ... }
 * @param {object[]} selectedSections - Array of currently selected timetable sections
 * @returns {object | null} Preview descriptor with status 'ok' (green) or 'conflict' (red)
 */
export function buildFixedPreview(section, selectedSections = []) {
  if (!section || section.start == null || section.end == null) return null;

  const days = getSectionDays(section);
  const day = days[0] || null;
  const conflicting = getConflictingSections(section, selectedSections);
  const hasConflict = conflicting.length > 0;

  return {
    sectionId: section.id,
    day,
    days,
    startMin: section.start,
    endMin: section.end,
    hasConflict,
    conflictCount: conflicting.length,
    status: hasConflict ? 'conflict' : 'ok',
  };
}

/**
 * Minimum pointer movement in pixels before pointerdown is considered a drag gesture
 * instead of a regular click.
 */
export const POINTER_DRAG_THRESHOLD = 5;

/**
 * Determine whether pointer movement delta exceeds the drag start threshold.
 *
 * @param {number} dx - delta X in pixels
 * @param {number} dy - delta Y in pixels
 * @param {number} [threshold=POINTER_DRAG_THRESHOLD]
 * @returns {boolean}
 */
export function hasExceededDragThreshold(dx, dy, threshold = POINTER_DRAG_THRESHOLD) {
  return Math.hypot(dx, dy) >= threshold;
}

/**
 * Axis-aligned bounding box boundary-touch hit test.
 * Returns true when any part of the held card touches or overlaps the timetable boundary.
 *
 * @param {{ left: number, top: number, right: number, bottom: number } | DOMRect} cardRect
 * @param {{ left: number, top: number, right: number, bottom: number } | DOMRect} timetableRect
 * @returns {boolean}
 */
export function isCardTouchingTimetable(cardRect, timetableRect) {
  if (!cardRect || !timetableRect) return false;
  return !(
    cardRect.right < timetableRect.left ||
    cardRect.left > timetableRect.right ||
    cardRect.bottom < timetableRect.top ||
    cardRect.top > timetableRect.bottom
  );
}

/**
 * Determine whether a held card has moved outside the Available Courses panel.
 * Fixed-slot preview is shown only once the card leaves the panel boundary.
 *
 * @param {{ left: number, top: number, right: number, bottom: number } | DOMRect} cardRect
 * @param {{ left: number, top: number, right: number, bottom: number } | DOMRect} panelRect
 * @returns {boolean}
 */
export function isCardOutsidePanel(cardRect, panelRect) {
  if (!cardRect || !panelRect) return false;
  return (
    cardRect.bottom > panelRect.bottom ||
    cardRect.top < panelRect.top ||
    cardRect.right < panelRect.left ||
    cardRect.left > panelRect.right
  );
}

/**
 * Evaluate whether dropping a held card onto the timetable is valid.
 * Add only when the card touched the timetable and the preview is green (no conflict).
 * If red, or released without touching the timetable, returns false and the reason.
 *
 * @param {{ touchesTimetable: boolean, hasConflict: boolean }} params
 * @returns {{ success: boolean, reason: 'ok' | 'conflict' | 'outside' }}
 */
export function evaluateDrop({ touchesTimetable, hasConflict }) {
  if (!touchesTimetable) {
    return { success: false, reason: 'outside' };
  }
  if (hasConflict) {
    return { success: false, reason: 'conflict' };
  }
  return { success: true, reason: 'ok' };
}

/**
 * Axis-aligned bounding box test to check if a held card touches the Available Courses panel.
 *
 * @param {{ left: number, top: number, right: number, bottom: number } | DOMRect} cardRect
 * @param {{ left: number, top: number, right: number, bottom: number } | DOMRect} panelRect
 * @returns {boolean}
 */
export function isCardTouchingAvailableCourses(cardRect, panelRect) {
  if (!cardRect || !panelRect) return false;
  return !(
    cardRect.right < panelRect.left ||
    cardRect.left > panelRect.right ||
    cardRect.bottom < panelRect.top ||
    cardRect.top > panelRect.bottom
  );
}

/**
 * Standard duration in milliseconds for the section swap transition animation.
 */
export const SWAP_ANIMATION_DURATION_MS = 240;

/**
 * Return effective swap duration respecting prefers-reduced-motion.
 *
 * @param {{ prefersReducedMotion?: boolean }} [options={}]
 * @returns {number} 0 if reduced motion is requested, else SWAP_ANIMATION_DURATION_MS
 */
export function getEffectiveSwapDuration({ prefersReducedMotion = false } = {}) {
  return prefersReducedMotion ? 0 : SWAP_ANIMATION_DURATION_MS;
}

/**
 * Validates a proposed section swap before animating or mutating state.
 *
 * @param {{
 *   draft: string[],
 *   availableCourses: object[],
 *   fromId: string,
 *   toId: string,
 * }} params
 * @returns {{
 *   valid: boolean,
 *   reason?: string,
 *   nextDraft: string[]
 * }}
 */
export function evaluateSwap({ draft, availableCourses, fromId, toId }) {
  const byId = new Map(availableCourses.map((c) => [c.id, c]));
  const fromItem = byId.get(fromId);
  const toItem = byId.get(toId);

  if (!fromItem || !toItem) {
    return { valid: false, reason: 'section-not-found', nextDraft: draft };
  }

  // Ensure toId is a declared alternate for fromItem
  const isDeclaredAlternate =
    Array.isArray(fromItem.alternates) && fromItem.alternates.includes(toId);
  if (!isDeclaredAlternate) {
    return { valid: false, reason: 'not-declared-alternate', nextDraft: draft };
  }

  const nextDraft = draft.map((id) => (id === fromId ? toId : id));
  const validation = validateDraft(nextDraft, availableCourses);

  if (!validation.ok) {
    const isLabSwapWithoutLecture =
      validation.reason === 'orphan-linked-section' &&
      fromItem.requiredBy &&
      toItem.requiredBy &&
      fromItem.requiredBy === toItem.requiredBy;
    const isUnrelatedSwapWithMissingLinkedCourse =
      (validation.reason === 'linked-group-invalid' || validation.reason === 'orphan-linked-section') &&
      !fromItem.requires &&
      !toItem.requires &&
      !fromItem.requiredBy &&
      !toItem.requiredBy;

    if (isLabSwapWithoutLecture || isUnrelatedSwapWithMissingLinkedCourse) {
      const clash = nextDraft
        .filter((id) => id !== toId)
        .map((id) => byId.get(id))
        .find((c) => c && overlaps(toItem, c));
      const hasSeat = toItem.capacity > toItem.enrolled;
      if (!clash && hasSeat) {
        return {
          valid: true,
          reason: 'ok',
          nextDraft,
        };
      }
    }

    return {
      valid: false,
      reason: validation.reason,
      nextDraft: draft,
    };
  }

  return {
    valid: true,
    reason: 'ok',
    nextDraft,
  };
}

