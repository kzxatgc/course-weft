import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_DRAFT,
  REQUESTED_SECTION_ID,
  MAIN_CATALOG,
  catalogForScenario,
} from './helpers/fixture.mjs';
import {
  INITIAL_DRAFT as CATALOG_INITIAL_DRAFT,
  REQUESTED_SECTION_ID as CATALOG_REQUESTED_SECTION_ID,
  MAIN_CATALOG as PRODUCTION_CATALOG,
  catalogForScenario as getCatalogForScenario,
} from '../src/domain/catalog.mjs';
import {
  validateDraft,
  validateCatalogue,
  overlaps,
  REQUIRED_LINK_RULES,
  validateLinks,
} from '../src/domain/validate.mjs';
import { formatTime, formatTimeRange } from '../src/domain/time.mjs';

test('smoke: test harness is discovered and assertions execute cleanly', () => {
  assert.equal(1 + 1, 2);
});

test('smoke: synthetic target fixtures are properly isolated and configured', () => {
  assert.deepEqual(INITIAL_DRAFT, ['CHEM-A', 'STAT-A']);
  assert.equal(REQUESTED_SECTION_ID, 'BIO-214');
  assert.equal(MAIN_CATALOG.length, 7);

  const mainCat = catalogForScenario('main');
  assert.equal(mainCat.length, 7);
  const bioLabB = mainCat.find((s) => s.id === 'BIO-214L-B');
  assert.ok(bioLabB);
  assert.equal(bioLabB.seat, 'open');

  const noRepairCat = catalogForScenario('noRepair');
  const noRepairLabB = noRepairCat.find((s) => s.id === 'BIO-214L-B');
  assert.ok(noRepairLabB);
  assert.equal(noRepairLabB.seat, 'full');
  assert.equal(noRepairLabB.enrolled, 30);
  assert.equal(noRepairLabB.capacity, 30);
});

test('catalogue exports correct section records, relations, and initial states', () => {
  assert.deepEqual(CATALOG_INITIAL_DRAFT, ['CHEM-A', 'STAT-A']);
  assert.equal(CATALOG_REQUESTED_SECTION_ID, 'BIO-214');
  assert.equal(PRODUCTION_CATALOG.length, 7);

  const ids = PRODUCTION_CATALOG.map((s) => s.id);
  assert.deepEqual(ids, ['CHEM-A', 'CHEM-B', 'STAT-A', 'STAT-B', 'BIO-214', 'BIO-214L-A', 'BIO-214L-B']);

  // Alternates
  const chemA = PRODUCTION_CATALOG.find((s) => s.id === 'CHEM-A');
  assert.deepEqual(chemA.alternates, ['CHEM-B']);
  const statA = PRODUCTION_CATALOG.find((s) => s.id === 'STAT-A');
  assert.deepEqual(statA.alternates, ['STAT-B']);

  // Linked lab requirements
  const bio214 = PRODUCTION_CATALOG.find((s) => s.id === 'BIO-214');
  assert.deepEqual(bio214.requires, [{ component: 'lab', linkedGroup: 'BIO-214-labs', min: 1, max: 1 }]);

  const labA = PRODUCTION_CATALOG.find((s) => s.id === 'BIO-214L-A');
  assert.equal(labA.linkedGroup, 'BIO-214-labs');
  assert.equal(labA.requiredBy, 'BIO-214');

  const labB = PRODUCTION_CATALOG.find((s) => s.id === 'BIO-214L-B');
  assert.equal(labB.linkedGroup, 'BIO-214-labs');
  assert.equal(labB.requiredBy, 'BIO-214');
});

test('noRepair scenario makes copy without shared mutation', () => {
  const main = getCatalogForScenario('main');
  const noRepair = getCatalogForScenario('noRepair');

  const mainLabB = main.find((s) => s.id === 'BIO-214L-B');
  const noRepairLabB = noRepair.find((s) => s.id === 'BIO-214L-B');

  assert.equal(mainLabB.seat, 'open');
  assert.equal(noRepairLabB.seat, 'full');

  // Verify mutating copy does not mutate original or other scenario
  noRepairLabB.seat = 'mutated';
  assert.equal(getCatalogForScenario('main').find((s) => s.id === 'BIO-214L-B').seat, 'open');
  assert.equal(getCatalogForScenario('noRepair').find((s) => s.id === 'BIO-214L-B').seat, 'full');
  assert.equal(PRODUCTION_CATALOG.find((s) => s.id === 'BIO-214L-B').seat, 'open');
});

// --- Validate IDs and catalogue records ---

test('validateDraft accepts a valid empty draft', () => {
  const result = validateDraft([], PRODUCTION_CATALOG);
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
});

test('validateDraft accepts the initial draft against production catalogue', () => {
  const result = validateDraft([...CATALOG_INITIAL_DRAFT], PRODUCTION_CATALOG);
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
});

test('validateDraft rejects non-array draft', () => {
  assert.equal(validateDraft(null, PRODUCTION_CATALOG).ok, false);
  assert.equal(validateDraft('CHEM-A', PRODUCTION_CATALOG).ok, false);
  assert.equal(validateDraft(undefined, PRODUCTION_CATALOG).ok, false);
  assert.equal(validateDraft(42, PRODUCTION_CATALOG).ok, false);
});

test('validateDraft rejects nonstring IDs', () => {
  const result = validateDraft([42], PRODUCTION_CATALOG);
  assert.equal(result.ok, false);
  assert.ok(result.reason);
});

test('validateDraft rejects empty-string IDs', () => {
  const result = validateDraft([''], PRODUCTION_CATALOG);
  assert.equal(result.ok, false);
  assert.ok(result.reason);
});

test('validateDraft rejects whitespace-only IDs', () => {
  const result = validateDraft(['   '], PRODUCTION_CATALOG);
  assert.equal(result.ok, false);
  assert.ok(result.reason);
});

test('validateDraft rejects duplicate IDs in draft', () => {
  const result = validateDraft(['CHEM-A', 'CHEM-A'], PRODUCTION_CATALOG);
  assert.equal(result.ok, false);
  assert.match(result.reason, /duplicate/i);
});

test('validateDraft rejects ID not in catalogue', () => {
  const result = validateDraft(['CHEM-A', 'UNKNOWN-999'], PRODUCTION_CATALOG);
  assert.equal(result.ok, false);
  assert.match(result.reason, /unknown/i);
});

test('validateCatalogue accepts a well-formed catalogue', () => {
  const result = validateCatalogue(PRODUCTION_CATALOG);
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
});

test('validateCatalogue rejects non-array input', () => {
  assert.equal(validateCatalogue(null).ok, false);
  assert.equal(validateCatalogue({}).ok, false);
  assert.equal(validateCatalogue('string').ok, false);
});

test('validateCatalogue rejects catalogue with duplicate IDs', () => {
  const dupCat = [
    { id: 'CHEM-A', course: 'CHEM', component: 'lecture' },
    { id: 'CHEM-A', course: 'CHEM', component: 'lecture' },
  ];
  const result = validateCatalogue(dupCat);
  assert.equal(result.ok, false);
  assert.match(result.reason, /duplicate/i);
});

test('validateCatalogue rejects record with nonstring/empty id', () => {
  const bad1 = [{ id: 42, course: 'CHEM', component: 'lecture' }];
  assert.equal(validateCatalogue(bad1).ok, false);

  const bad2 = [{ id: '', course: 'CHEM', component: 'lecture' }];
  assert.equal(validateCatalogue(bad2).ok, false);
});

test('validateCatalogue rejects record missing required course field', () => {
  const bad = [{ id: 'CHEM-A', component: 'lecture' }];
  const result = validateCatalogue(bad);
  assert.equal(result.ok, false);
  assert.match(result.reason, /course/i);
});

test('validateCatalogue rejects record missing required component field', () => {
  const bad = [{ id: 'CHEM-A', course: 'CHEM' }];
  const result = validateCatalogue(bad);
  assert.equal(result.ok, false);
  assert.match(result.reason, /component/i);
});

test('validateCatalogue rejects non-object record', () => {
  const bad = ['not-an-object'];
  const result = validateCatalogue(bad);
  assert.equal(result.ok, false);
});

// --- Synthetic enrollment and capacity counts ---

test('every section in the main catalogue has integer enrolled and capacity', () => {
  const cat = getCatalogForScenario('main');
  for (const s of cat) {
    assert.equal(typeof s.enrolled, 'number', `${s.id} enrolled must be a number`);
    assert.equal(typeof s.capacity, 'number', `${s.id} capacity must be a number`);
    assert.ok(Number.isInteger(s.enrolled), `${s.id} enrolled must be integer`);
    assert.ok(Number.isInteger(s.capacity), `${s.id} capacity must be integer`);
    assert.ok(s.capacity > 0, `${s.id} capacity must be > 0`);
    assert.ok(s.enrolled >= 0, `${s.id} enrolled must be >= 0`);
    assert.ok(s.enrolled <= s.capacity, `${s.id} enrolled must be <= capacity`);
  }
});

test('availability is derived from counts: enrolled < capacity means open, enrolled === capacity means full', () => {
  const cat = getCatalogForScenario('main');
  for (const s of cat) {
    const expected = s.enrolled < s.capacity ? 'open' : 'full';
    assert.equal(s.seat, expected, `${s.id} seat derived incorrectly`);
  }
});

test('successful scenario has BIO-214L-B with seats available (enrolled < capacity)', () => {
  const cat = getCatalogForScenario('main');
  const labB = cat.find((s) => s.id === 'BIO-214L-B');
  assert.ok(labB);
  assert.ok(labB.enrolled < labB.capacity, 'BIO-214L-B should have seats in main scenario');
  assert.equal(labB.seat, 'open');
});

test('no-repair scenario has BIO-214L-B at 30/30 (full)', () => {
  const cat = getCatalogForScenario('noRepair');
  const labB = cat.find((s) => s.id === 'BIO-214L-B');
  assert.ok(labB);
  assert.equal(labB.enrolled, 30);
  assert.equal(labB.capacity, 30);
  assert.equal(labB.seat, 'full');
});

test('catalog exposes only main and noRepair scenarios without named refusal fixture', () => {
  const mainCat = getCatalogForScenario('main');
  const noRepairCat = getCatalogForScenario('noRepair');
  assert.equal(mainCat.find((s) => s.id === 'BIO-214L-B').seat, 'open');
  assert.equal(noRepairCat.find((s) => s.id === 'BIO-214L-B').seat, 'full');

  // Passing any unhandled scenario name defaults to main copy with standard open seats
  const unhandled = getCatalogForScenario('refusal');
  assert.equal(unhandled.find((s) => s.id === 'BIO-214L-B').seat, 'open');
  assert.equal(unhandled.find((s) => s.id === 'BIO-214L-B').enrolled, 22);
});

test('fixture-copy isolation: mutating one scenario does not affect another', () => {
  const main1 = getCatalogForScenario('main');
  const main2 = getCatalogForScenario('main');
  const labB1 = main1.find((s) => s.id === 'BIO-214L-B');
  labB1.enrolled = 999;
  const labB2 = main2.find((s) => s.id === 'BIO-214L-B');
  assert.ok(labB2.enrolled !== 999, 'mutating one copy must not affect a separate call');
});

test('count formatting label: enrolled/capacity renders as "enrolled / capacity"', () => {
  const cat = getCatalogForScenario('main');
  for (const s of cat) {
    const label = `${s.enrolled} / ${s.capacity}`;
    assert.match(label, /^\d+ \/ \d+$/, `${s.id} label format wrong: ${label}`);
  }
});

// --- Time, meeting, and seat validation ---

test('validateDraft rejects draft containing a full section (seat-not-certified-open)', () => {
  const fullCat = getCatalogForScenario('noRepair');
  // In noRepair scenario, BIO-214L-B is 30/30 (full)
  const result = validateDraft(['CHEM-A', 'BIO-214L-B'], fullCat);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'seat-not-certified-open');
});

test('full section remains valid catalogue data in validateCatalogue', () => {
  const fullCat = getCatalogForScenario('noRepair');
  const result = validateCatalogue(fullCat);
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
});

test('validateDraft rejects draft containing generic section with missing counts (seat-not-certified-open)', () => {
  const missingCountCat = PRODUCTION_CATALOG.map((s) => (s.id === 'BIO-214L-B' ? { ...s, enrolled: undefined, capacity: undefined, seat: 'unknown' } : s));
  const result = validateDraft(['CHEM-A', 'BIO-214L-B'], missingCountCat);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'seat-not-certified-open');
});

test('generic missing-count section with seat unknown remains valid catalogue data in validateCatalogue', () => {
  const missingCountCat = PRODUCTION_CATALOG.map((s) => (s.id === 'BIO-214L-B' ? { ...s, enrolled: undefined, capacity: undefined, seat: 'unknown' } : s));
  const result = validateCatalogue(missingCountCat);
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
});

test('validateDraft rejects unrecognized seat state (malformed-seat-state)', () => {
  const badSeatCat = PRODUCTION_CATALOG.map((s) => (s.id === 'CHEM-A' ? { ...s, seat: 'maybe' } : s));
  const result = validateDraft(['CHEM-A'], badSeatCat);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'malformed-seat-state');
});

test('validateDraft rejects missing, string, negative, reversed, zero-length, and out-of-range times', () => {
  const badTimeVariations = [
    { desc: 'missing start', patch: { start: undefined, end: 660 } },
    { desc: 'missing end', patch: { start: 600, end: undefined } },
    { desc: 'string start', patch: { start: '600', end: 660 } },
    { desc: 'string end', patch: { start: 600, end: '660' } },
    { desc: 'negative start', patch: { start: -1, end: 660 } },
    { desc: 'zero-length meeting', patch: { start: 600, end: 600 } },
    { desc: 'reversed meeting time', patch: { start: 660, end: 600 } },
    { desc: 'start out of range (>1440)', patch: { start: 1441, end: 1500 } },
    { desc: 'end out of range (>1440)', patch: { start: 600, end: 1441 } },
  ];

  for (const { desc, patch } of badTimeVariations) {
    const patchedCat = PRODUCTION_CATALOG.map((s) => (s.id === 'CHEM-A' ? { ...s, ...patch } : s));
    const result = validateDraft(['CHEM-A'], patchedCat);
    assert.equal(result.ok, false, `Expected failure for ${desc}`);
    assert.equal(result.reason, 'bad-time-or-day', `Expected bad-time-or-day for ${desc}`);
  }
});

test('validateDraft rejects invalid weekday (bad-time-or-day)', () => {
  const invalidDays = ['Funday', '', 'Tomorrow', 123, null, undefined];
  for (const day of invalidDays) {
    const patchedCat = PRODUCTION_CATALOG.map((s) => (s.id === 'CHEM-A' ? { ...s, day } : s));
    const result = validateDraft(['CHEM-A'], patchedCat);
    assert.equal(result.ok, false, `Expected failure for day: ${day}`);
    assert.equal(result.reason, 'bad-time-or-day');
  }
});

test('validateDraft rejects malformed catalogue with stable malformed-catalog reason', () => {
  const dupCat = [...PRODUCTION_CATALOG, PRODUCTION_CATALOG[0]];
  const result = validateDraft(['CHEM-A'], dupCat);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'malformed-catalog');
});

test('validateCatalogue rejects sections with invalid weekday or invalid meeting time', () => {
  const badDayCat = PRODUCTION_CATALOG.map((s) => (s.id === 'CHEM-A' ? { ...s, day: 'InvalidDay' } : s));
  assert.equal(validateCatalogue(badDayCat).ok, false);

  const badTimeCat = PRODUCTION_CATALOG.map((s) => (s.id === 'CHEM-A' ? { ...s, start: 700, end: 600 } : s));
  assert.equal(validateCatalogue(badTimeCat).ok, false);
});

test('validateCatalogue rejects sections with unrecognized seat or corrupted counts', () => {
  const badSeatCat = PRODUCTION_CATALOG.map((s) => (s.id === 'CHEM-A' ? { ...s, seat: 'unknown-state' } : s));
  assert.equal(validateCatalogue(badSeatCat).ok, false);

  const badCapacityCat = PRODUCTION_CATALOG.map((s) => (s.id === 'CHEM-A' ? { ...s, capacity: 0 } : s));
  assert.equal(validateCatalogue(badCapacityCat).ok, false);

  const negativeEnrolledCat = PRODUCTION_CATALOG.map((s) => (s.id === 'CHEM-A' ? { ...s, enrolled: -5 } : s));
  assert.equal(validateCatalogue(negativeEnrolledCat).ok, false);

  const enrolledOverCapCat = PRODUCTION_CATALOG.map((s) => (s.id === 'CHEM-A' ? { ...s, enrolled: 35, capacity: 30 } : s));
  assert.equal(validateCatalogue(enrolledOverCapCat).ok, false);

  const mismatchedSeatCat = PRODUCTION_CATALOG.map((s) => (s.id === 'CHEM-A' ? { ...s, enrolled: 30, capacity: 30, seat: 'open' } : s));
  assert.equal(validateCatalogue(mismatchedSeatCat).ok, false);
});

test('validateDraft and validateCatalogue never throw exceptions on malformed input', () => {
  const pathologicalInputs = [null, undefined, 42, 'string', {}, [], [null], [{}]];
  for (const input of pathologicalInputs) {
    assert.doesNotThrow(() => validateDraft(input, PRODUCTION_CATALOG));
    assert.doesNotThrow(() => validateDraft(['CHEM-A'], input));
    assert.doesNotThrow(() => validateCatalogue(input));
  }
});

// --- Timetable conflicts and duplicate components ---

test('overlaps helper correctly identifies same-day interval conflicts and allows adjacent intervals', () => {
  // Same day adjacent: end of first equals start of second -> allowed (false)
  assert.equal(overlaps({ day: 'Mon', start: 600, end: 660 }, { day: 'Mon', start: 660, end: 720 }), false);
  assert.equal(overlaps({ day: 'Mon', start: 660, end: 720 }, { day: 'Mon', start: 600, end: 660 }), false);

  // Same day overlap: one extra minute causes clash -> rejected (true)
  assert.equal(overlaps({ day: 'Mon', start: 600, end: 661 }, { day: 'Mon', start: 660, end: 720 }), true);
  assert.equal(overlaps({ day: 'Mon', start: 660, end: 720 }, { day: 'Mon', start: 600, end: 661 }), true);

  // Different days: identical times do not conflict
  assert.equal(overlaps({ day: 'Mon', start: 600, end: 660 }, { day: 'Tue', start: 600, end: 660 }), false);

  // Contained interval
  assert.equal(overlaps({ day: 'Wed', start: 500, end: 800 }, { day: 'Wed', start: 600, end: 700 }), true);

  // Non-object or missing times return false safely
  assert.equal(overlaps(null, { day: 'Mon', start: 600, end: 660 }), false);
  assert.equal(overlaps({ day: 'Mon', start: 'bad', end: 660 }, { day: 'Mon', start: 600, end: 660 }), false);
});

test('validateDraft rejects draft with timetable clash (STAT-A and BIO-214 conflict on Monday)', () => {
  // STAT-A: Mon 780..840; BIO-214: Mon 780..840
  const result = validateDraft(['STAT-A', 'BIO-214'], PRODUCTION_CATALOG);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'time-conflict');
});

test('validateDraft rejects draft with overlapping lecture and lab (CHEM-A and BIO-214L-A on Tuesday)', () => {
  // CHEM-A: Tue 600..660; BIO-214L-A: Tue 600..720
  const result = validateDraft(['CHEM-A', 'BIO-214', 'BIO-214L-A'], PRODUCTION_CATALOG);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'time-conflict');
});

test('validateDraft rejects duplicate course/component even with distinct section IDs', () => {
  // CHEM-A (CHEM lecture) and CHEM-B (CHEM lecture)
  const chemResult = validateDraft(['CHEM-A', 'CHEM-B'], PRODUCTION_CATALOG);
  assert.equal(chemResult.ok, false);
  assert.equal(chemResult.reason, 'duplicate-course-component');

  // STAT-A (STAT lecture) and STAT-B (STAT lecture)
  const statResult = validateDraft(['STAT-A', 'STAT-B'], PRODUCTION_CATALOG);
  assert.equal(statResult.ok, false);
  assert.equal(statResult.reason, 'duplicate-course-component');
});

test('starting draft is valid, conflict-free, and contains no duplicate components', () => {
  const result = validateDraft([...CATALOG_INITIAL_DRAFT], PRODUCTION_CATALOG);
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
});

// --- Linked lab requirement enforcement ---

test('REQUIRED_LINK_RULES defines authoritative exact-one-lab rule for BIO-214', () => {
  assert.ok(REQUIRED_LINK_RULES['BIO-214']);
  assert.deepEqual(REQUIRED_LINK_RULES['BIO-214'], [
    { component: 'lab', linkedGroup: 'BIO-214-labs', min: 1, max: 1 },
  ]);
});

test('validateDraft accepts valid draft with BIO-214 and exactly one matching lab', () => {
  // Valid with Lab B (CHEM-A + STAT-B + BIO-214 + BIO-214L-B)
  const validWithLabB = validateDraft(
    ['CHEM-A', 'STAT-B', 'BIO-214', 'BIO-214L-B'],
    PRODUCTION_CATALOG
  );
  assert.equal(validWithLabB.ok, true);
  assert.equal(validWithLabB.reason, null);

  // Valid with Lab A (CHEM-B on Thu avoids Tue clash with Lab A; STAT-B on Thu 780 avoids Mon BIO)
  const validWithLabA = validateDraft(
    ['CHEM-B', 'BIO-214', 'BIO-214L-A'],
    PRODUCTION_CATALOG
  );
  assert.equal(validWithLabA.ok, true);
  assert.equal(validWithLabA.reason, null);
});

test('validateDraft rejects draft with BIO-214 missing its required linked lab', () => {
  const missingLab = validateDraft(
    ['CHEM-A', 'STAT-B', 'BIO-214'],
    PRODUCTION_CATALOG
  );
  assert.equal(missingLab.ok, false);
  assert.equal(missingLab.reason, 'linked-group-invalid');
});

test('validateDraft rejects draft with extra linked labs exceeding max', () => {
  const twoLabs = validateDraft(
    ['CHEM-B', 'BIO-214', 'BIO-214L-A', 'BIO-214L-B'],
    PRODUCTION_CATALOG
  );
  assert.equal(twoLabs.ok, false);
  // Rejection reason is either linked-group-invalid or duplicate-course-component
  assert.ok(twoLabs.reason === 'linked-group-invalid' || twoLabs.reason === 'duplicate-course-component');
});

test('validateDraft rejects orphan linked lab selected without its parent lecture', () => {
  const orphan = validateDraft(['CHEM-A', 'BIO-214L-B'], PRODUCTION_CATALOG);
  assert.equal(orphan.ok, false);
  assert.equal(orphan.reason, 'orphan-linked-section');
});

test('validateDraft rejects linked lab with wrong linkedGroup', () => {
  const wrongGroupCat = PRODUCTION_CATALOG.map((item) =>
    item.id === 'BIO-214L-B' ? { ...item, linkedGroup: 'WRONG-GROUP' } : item
  );
  const result = validateDraft(
    ['CHEM-A', 'STAT-B', 'BIO-214', 'BIO-214L-B'],
    wrongGroupCat
  );
  assert.equal(result.ok, false);
  assert.ok(result.reason === 'orphan-linked-section' || result.reason === 'linked-group-invalid');
});

test('validateDraft fails closed when required-link metadata is removed or corrupt', () => {
  // Missing requires array on parent
  const missingRequires = PRODUCTION_CATALOG.map((item) =>
    item.id === 'BIO-214' ? { ...item, requires: undefined } : item
  );
  const res1 = validateDraft(
    ['CHEM-A', 'STAT-B', 'BIO-214', 'BIO-214L-B'],
    missingRequires
  );
  assert.equal(res1.ok, false);
  assert.equal(res1.reason, 'malformed-link-requirement');

  // Corrupted min/max
  const invalidCount = PRODUCTION_CATALOG.map((item) =>
    item.id === 'BIO-214'
      ? { ...item, requires: [{ component: 'lab', linkedGroup: 'BIO-214-labs', min: 1, max: 0 }] }
      : item
  );
  const res2 = validateDraft(
    ['CHEM-A', 'STAT-B', 'BIO-214', 'BIO-214L-B'],
    invalidCount
  );
  assert.equal(res2.ok, false);
  assert.equal(res2.reason, 'malformed-link-requirement');
});

// --- Time formatting (Task 12) ---

test('formatTime formats midnight (0 minutes) as 12:00 AM', () => {
  assert.equal(formatTime(0), '12:00 AM');
});

test('formatTime formats noon (720 minutes) as 12:00 PM', () => {
  assert.equal(formatTime(720), '12:00 PM');
});

test('formatTime formats 721 minutes as 12:01 PM', () => {
  assert.equal(formatTime(721), '12:01 PM');
});

test('formatTime formats 600 minutes as 10:00 AM', () => {
  assert.equal(formatTime(600), '10:00 AM');
});

test('formatTime formats 780 minutes as 1:00 PM', () => {
  assert.equal(formatTime(780), '1:00 PM');
});

test('formatTime formats 840 minutes as 2:00 PM', () => {
  assert.equal(formatTime(840), '2:00 PM');
});

test('formatTime formats 1440 (24:00 midnight endpoint) as 12:00 AM', () => {
  assert.equal(formatTime(1440), '12:00 AM');
});

test('formatTime returns "Unknown time" for invalid inputs', () => {
  assert.equal(formatTime(-1), 'Unknown time');
  assert.equal(formatTime(1441), 'Unknown time');
  assert.equal(formatTime(1.5), 'Unknown time');
  assert.equal(formatTime('600'), 'Unknown time');
  assert.equal(formatTime(null), 'Unknown time');
  assert.equal(formatTime(undefined), 'Unknown time');
  assert.equal(formatTime(NaN), 'Unknown time');
});

test('formatTimeRange formats BIO-214L-B section as "Wed 2:00 PM–4:00 PM"', () => {
  const cat = getCatalogForScenario('main');
  const labB = cat.find((s) => s.id === 'BIO-214L-B');
  assert.ok(labB, 'BIO-214L-B must exist in main catalogue');
  // BIO-214L-B: Wed, start=840, end=960
  assert.equal(formatTimeRange(labB), 'Wed 2:00 PM–4:00 PM');
});

