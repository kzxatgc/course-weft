/**
 * Synthetic target fixtures for domain and scheduling tests.
 * Self-contained in course-weft; does not import any external or parent code.
 *
 * Enrollment and capacity values are fictional sample data only.
 * Seat availability is derived from counts: enrolled < capacity = open, enrolled === capacity = full.
 */

export const REQUESTED_SECTION_ID = 'BIO-214';
export const INITIAL_DRAFT = Object.freeze(['MATH-A', 'STAT-A']);

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
  section('MATH-A', 'MATH', 'Mathematics', 'lecture', 'Tue', 600, 660, 14, 30, {
    sectionName: 'Section A',
    alternates: ['MATH-B'],
  }),
  section('MATH-B', 'MATH', 'Mathematics', 'lecture', 'Thu', 600, 660, 22, 30, {
    sectionName: 'Section B',
    alternates: ['MATH-A'],
  }),
  section('STAT-A', 'STAT', 'Introductory Statistics', 'lecture', 'Mon', 780, 840, 18, 30, {
    sectionName: 'Section A',
    alternates: ['STAT-B'],
  }),
  section('STAT-B', 'STAT', 'Introductory Statistics', 'lecture', 'Thu', 780, 840, 10, 30, {
    sectionName: 'Section B',
    alternates: ['STAT-A'],
  }),
  section('BIO-214', 'BIO', 'Cell Biology', 'lecture', 'Mon', 780, 840, 34, 60, {
    sectionName: 'Lecture',
    requires: [{ component: 'lab', linkedGroup: 'BIO-214-labs', min: 1, max: 1 }],
  }),
  section('BIO-214L-A', 'BIO', 'Cell Biology Laboratory', 'lab', 'Tue', 600, 720, 12, 30, {
    sectionName: 'Lab A',
    linkedGroup: 'BIO-214-labs',
    requiredBy: 'BIO-214',
    alternates: ['BIO-214L-B'],
  }),
  section('BIO-214L-B', 'BIO', 'Cell Biology Laboratory', 'lab', 'Wed', 840, 960, 22, 30, {
    sectionName: 'Lab B',
    linkedGroup: 'BIO-214-labs',
    requiredBy: 'BIO-214',
    alternates: ['BIO-214L-A'],
  }),
]);

/**
 * Returns a deep copy of the catalogue for a given scenario.
 *
 * Scenarios:
 * - 'main'     : STAT-B is open and BIO-214 enrollment matches its lab sections.
 * - 'noRepair' : MATH-B and BIO-214L-B are full; STAT-B has vacancies.
 *
 * @param {'main' | 'noRepair'} scenario
 * @returns {Array<object>}
 */
export function catalogForScenario(scenario = 'main') {
  const catalog = MAIN_CATALOG.map((item) => {
    const base = {
      ...item,
      requires: item.requires?.map((r) => ({ ...r })),
      alternates: item.alternates ? [...item.alternates] : [],
    };

    if (scenario === 'noRepair' && item.id === 'BIO-214L-B') {
      return { ...base, enrolled: 30, capacity: 30, seat: 'full' };
    }
    if (scenario === 'noRepair' && item.id === 'MATH-B') {
      return { ...base, enrolled: 30, capacity: 30, seat: 'full' };
    }

    return base;
  });

  const labEnrollment = catalog
    .filter((item) => item.linkedGroup === 'BIO-214-labs')
    .reduce((total, lab) => total + lab.enrolled, 0);

  return catalog.map((item) => (
    item.id === REQUESTED_SECTION_ID
      ? { ...item, enrolled: labEnrollment, capacity: 60, seat: deriveSeat(labEnrollment, 60) }
      : item
  ));
}
