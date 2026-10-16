/**
 * Time formatting utilities for EnrollFix course meeting times.
 *
 * Times are represented as integer minutes from midnight (0–1440).
 * Formatting is explicit and locale/time-zone independent.
 * 1440 (24:00) is the valid midnight endpoint for end times.
 * Any value outside 0–1440 or non-integer returns "Unknown time".
 */

/**
 * Format an integer minute value as a 12-hour AM/PM time string.
 *
 * @param {number} minutes - Minutes from midnight (0–1440 inclusive)
 * @returns {string} Formatted time string, e.g. "10:00 AM", or "Unknown time"
 */
export function formatTime(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) return 'Unknown time';
  // 1440 (24:00) is the midnight endpoint of a day, equivalent to 12:00 AM.
  if (minutes === 1440) return '12:00 AM';
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/**
 * Format a section's meeting time as "Day H:MM AM–H:MM PM" range string.
 * Uses the section's day, start, and end fields.
 *
 * @param {{ day: string, start: number, end: number }} item - Section record
 * @returns {string} Formatted range, e.g. "Wed 2:00 PM–4:00 PM"
 */
export function formatTimeRange(item) {
  return `${item.day} ${formatTime(item.start)}–${formatTime(item.end)}`;
}

/**
 * Convert minute-of-day integer to 4-digit 24h time string (e.g. 600 -> "1000").
 *
 * @param {number} minutes - Minutes from midnight (0–1440)
 * @returns {string} 4-digit 24h time string
 */
export function format24hTime(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) return '0000';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h < 10 ? '0' : ''}${h}${m < 10 ? '0' : ''}${m}`;
}

/**
 * Format a section's meeting time into 24h format (e.g. "THU 1000 - 1100").
 *
 * @param {{ day?: string, start: number, end: number }} item - Section record
 * @returns {string} Formatted 24h slot string
 */
export function formatCourseSlot(item) {
  if (!item) return '';
  const dayStr = item.day ? item.day.toUpperCase() : '';
  return `${dayStr} ${format24hTime(item.start)} - ${format24hTime(item.end)}`;
}

