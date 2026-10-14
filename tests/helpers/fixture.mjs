/**
 * Synthetic target fixtures for domain and scheduling tests.
 * Self-contained in course-weft; does not import any external or parent code.
 *
 * Enrollment and capacity values are fictional sample data only.
 * Seat availability is derived from counts: enrolled < capacity = open, enrolled === capacity = full.
 */

export const REQUESTED_SECTION_ID = 'BIO-214';
export const INITIAL_DRAFT = Object.freeze(['CHEM-A', 'STAT-A']);

function deriveSeat(enrolled, capacity) {
  return enrolled < capacity ? 'open' : 'full';
}

export const section = (id, course, title, component, day, start, end, enrolled, capacity, options = {}) => ({
  id,
  course,
  title,
  component,
  day,
  start,
  end,
  enrolled,
  capacity,
  seat: deriveSeat(enrolled, capacity),
  ...options,
});

export const MAIN_CATALOG = Object.freeze([
  section('CHEM-A', 'CHEM', 'General Chemistry', 'lecture', 'Tue', 600, 660, 14, 30, {
    sectionName: 'Section A',
    alternates: ['CHEM-B'],
  }),
  section('CHEM-B', 'CHEM', 'General Chemistry', 'lecture', 'Thu', 600, 660, 22, 30, {
    sectionName: 'Section B',
    alternates: ['CHEM-A'],
  }),
  section('STAT-A', 'STAT', 'Introductory Statistics', 'lecture', 'Mon', 780, 840, 18, 30, {
    sectionName: 'Section A',
    alternates: ['STAT-B'],
  }),
  section('STAT-B', 'STAT', 'Introductory Statistics', 'lecture', 'Thu', 780, 840, 10, 30, {
    sectionName: 'Section B',
    alternates: ['STAT-A'],
  }),
  section('BIO-214', 'BIO', 'Cell Biology', 'lecture', 'Mon', 780, 840, 20, 30, {
    sectionName: 'Lecture',
    requires: [{ component: 'lab', linkedGroup: 'BIO-214-labs', min: 1, max: 1 }],
  }),
  section('BIO-214L-A', 'BIO', 'Cell Biology Laboratory', 'lab', 'Tue', 600, 720, 12, 30, {
    sectionName: 'Lab A',
    linkedGroup: 'BIO-214-labs',
    requiredBy: 'BIO-214',
  }),
  section('BIO-214L-B', 'BIO', 'Cell Biology Laboratory', 'lab', 'Wed', 840, 960, 22, 30, {
    sectionName: 'Lab B',
    linkedGroup: 'BIO-214-labs',
    requiredBy: 'BIO-214',
  }),
]);

/**
 * Returns a deep copy of the catalogue for a given scenario.
 *
 * Scenarios:
 * - 'main'     : successful-repair scenario; BIO-214L-B has seats (22/30).
 * - 'noRepair' : known-data no-repair scenario; BIO-214L-B is 30/30 (full).
 * - 'refusal'  : technical unknown-seat fixture; BIO-214L-B omits counts, seat = 'unknown'.
 *
 * @param {'main' | 'noRepair' | 'refusal'} scenario
 * @returns {Array<object>}
 */
export function catalogForScenario(scenario = 'main') {
  return MAIN_CATALOG.map((item) => {
    const base = {
      ...item,
      requires: item.requires?.map((r) => ({ ...r })),
      alternates: item.alternates ? [...item.alternates] : [],
    };

    if (scenario === 'noRepair' && item.id === 'BIO-214L-B') {
      return { ...base, enrolled: 30, capacity: 30, seat: 'full' };
    }

    if (scenario === 'refusal' && item.id === 'BIO-214L-B') {
      const { enrolled: _e, capacity: _c, seat: _s, ...rest } = base;
      return { ...rest, seat: 'unknown' };
    }

    return base;
  });
}
