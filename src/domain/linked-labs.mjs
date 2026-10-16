/**
 * linked-labs.mjs
 *
 * Logic and helpers for Task 34 — BIO-214 and linked lab relationship outlines.
 * While BIO-214 is selected in the timetable and lacks its required lab,
 * BIO-214 and each available non-full linked lab choice are highlighted with
 * an animated chasing border of two adjacent rainbow colors.
 */

/**
 * Adjacent rainbow color pairs (vibrant, high contrast across light/cream/white themes).
 * Each pair contains two adjacent hues from the spectrum.
 */
export const RAINBOW_ADJACENT_PAIRS = [
  ['#ec4899', '#8b5cf6'], // Hot Pink & Bright Purple
  ['#f472b6', '#a855f7'], // Light Pink & Bright Violet
];

/**
 * Returns a randomized starting adjacent rainbow color pair.
 *
 * @param {() => number} [rng=Math.random] - Optional RNG for deterministic testing
 * @returns {[string, string]}
 */
export function getRandomAdjacentRainbowPair(rng = Math.random) {
  const index = Math.floor(rng() * RAINBOW_ADJACENT_PAIRS.length);
  return RAINBOW_ADJACENT_PAIRS[index] || RAINBOW_ADJACENT_PAIRS[0];
}

/**
 * Checks whether BIO-214 is in the draft schedule and missing its required lab.
 *
 * @param {string[]} draft - Array of currently selected section IDs
 * @param {object[]} availableCourses - Catalog of available course sections
 * @returns {boolean} True if BIO-214 is enrolled but has no linked lab in draft
 */
export function isBio214MissingLab(draft = [], availableCourses = []) {
  if (!Array.isArray(draft) || !draft.includes('BIO-214')) {
    return false;
  }

  // Check if any lab linked to BIO-214 is already selected in the draft
  const hasLab = draft.some((id) => {
    if (id === 'BIO-214') return false;
    const sec = availableCourses.find((c) => c.id === id);
    if (!sec) return false;
    return sec.requiredBy === 'BIO-214' || sec.linkedGroup === 'BIO-214-labs';
  });

  return !hasLab;
}

/**
 * Computes which section IDs should show the chasing rainbow outline.
 * Returns empty array if BIO-214 is not in draft or if a lab is already selected.
 * When active:
 *  - Includes 'BIO-214'
 *  - Includes each linked lab that is NOT full (seats available)
 *  - Omit full labs (enrolled >= capacity or seat === 'full')
 *
 * @param {string[]} draft - Array of selected section IDs
 * @param {object[]} availableCourses - Catalog of course sections
 * @returns {string[]} Array of section IDs that should have the linked outline
 */
export function getLinkedOutlineSectionIds(draft = [], availableCourses = []) {
  if (!Array.isArray(draft)) return [];

  const hasLecture = draft.includes('BIO-214');
  const selectedLab = draft.find((id) => {
    const sec = availableCourses.find((c) => c.id === id);
    return sec && (sec.requiredBy === 'BIO-214' || sec.linkedGroup === 'BIO-214-labs');
  });

  // If both present or neither present: no outline
  if ((hasLecture && selectedLab) || (!hasLecture && !selectedLab)) {
    return [];
  }

  // Case 1: Lecture is in timetable, lab is missing in available courses
  if (hasLecture && !selectedLab) {
    const result = ['BIO-214'];
    availableCourses.forEach((sec) => {
      if (
        (sec.requiredBy === 'BIO-214' || sec.linkedGroup === 'BIO-214-labs') &&
        !draft.includes(sec.id)
      ) {
        const isFull = sec.seat === 'full' || (typeof sec.capacity === 'number' && sec.enrolled >= sec.capacity);
        if (!isFull) {
          result.push(sec.id);
        }
      }
    });
    return result;
  }

  // Case 2: Lab is in timetable, lecture BIO-214 is missing in available courses
  if (selectedLab && !hasLecture) {
    const result = [selectedLab];
    const lecture = availableCourses.find((c) => c.id === 'BIO-214');
    if (lecture && !draft.includes('BIO-214')) {
      const isFull = lecture.seat === 'full' || (typeof lecture.capacity === 'number' && lecture.enrolled >= lecture.capacity);
      if (!isFull) {
        result.push('BIO-214');
      }
    }
    return result;
  }

  return [];
}
