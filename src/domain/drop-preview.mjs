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
