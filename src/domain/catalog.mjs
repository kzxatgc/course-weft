/**
 * Synthetic course and section catalogue for EnrollFix course registration.
 * Ported cleanly to course-weft with isolated deep cloning for scenarios.
 */

export const REQUESTED_SECTION_ID = 'BIO-214';
export const INITIAL_DRAFT = Object.freeze(['CHEM-A', 'STAT-A']);

const section = (id, course, title, component, day, start, end, options = {}) =>
  Object.freeze({
    id,
    course,
    title,
    component,
    day,
    start,
    end,
    seat: 'open',
    ...options,
    ...(options.requires ? { requires: Object.freeze(options.requires.map((r) => Object.freeze({ ...r }))) } : {}),
    ...(options.alternates ? { alternates: Object.freeze([...options.alternates]) } : {}),
  });

export const MAIN_CATALOG = Object.freeze([
  section('CHEM-A', 'CHEM', 'General Chemistry', 'lecture', 'Tue', 600, 660, {
    sectionName: 'Section A',
    alternates: ['CHEM-B'],
  }),
  section('CHEM-B', 'CHEM', 'General Chemistry', 'lecture', 'Thu', 600, 660, {
    sectionName: 'Section B',
    alternates: ['CHEM-A'],
  }),
  section('STAT-A', 'STAT', 'Introductory Statistics', 'lecture', 'Mon', 780, 840, {
    sectionName: 'Section A',
    alternates: ['STAT-B'],
  }),
  section('STAT-B', 'STAT', 'Introductory Statistics', 'lecture', 'Thu', 780, 840, {
    sectionName: 'Section B',
    alternates: ['STAT-A'],
  }),
  section('BIO-214', 'BIO', 'Cell Biology', 'lecture', 'Mon', 780, 840, {
    sectionName: 'Lecture',
    requires: [{ component: 'lab', linkedGroup: 'BIO-214-labs', min: 1, max: 1 }],
  }),
  section('BIO-214L-A', 'BIO', 'Cell Biology Laboratory', 'lab', 'Tue', 600, 720, {
    sectionName: 'Lab A',
    linkedGroup: 'BIO-214-labs',
    requiredBy: 'BIO-214',
  }),
  section('BIO-214L-B', 'BIO', 'Cell Biology Laboratory', 'lab', 'Wed', 840, 960, {
    sectionName: 'Lab B',
    linkedGroup: 'BIO-214-labs',
    requiredBy: 'BIO-214',
  }),
]);

/**
 * Returns a deep copy of the catalogue for a given scenario.
 * Prevents shared mutations across callers.
 * In 'refusal' scenario, sets seat state of BIO-214L-B to 'unknown'.
 *
 * @param {'main' | 'refusal'} scenario
 * @returns {Array<object>}
 */
export function catalogForScenario(scenario = 'main') {
  return MAIN_CATALOG.map((item) => ({
    ...item,
    requires: item.requires ? item.requires.map((r) => ({ ...r })) : undefined,
    alternates: item.alternates ? [...item.alternates] : [],
    ...(scenario === 'refusal' && item.id === 'BIO-214L-B' ? { seat: 'unknown' } : {}),
  }));
}
