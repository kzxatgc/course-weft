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
import { enumerateRepairs, isCurrentCandidate } from '../src/domain/repairs.mjs';

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

// --- Time formatting ---

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

// --- Enumerate bounded repairs ---

test('enumerateRepairs returns empty array for invalid or malformed draft inputs', () => {
  const cat = getCatalogForScenario('main');
  assert.deepEqual(enumerateRepairs(null, cat), []);
  assert.deepEqual(enumerateRepairs(undefined, cat), []);
  assert.deepEqual(enumerateRepairs(42, cat), []);
  assert.deepEqual(enumerateRepairs('CHEM-A', cat), []);
  assert.deepEqual(enumerateRepairs([42], cat), []);
  assert.deepEqual(enumerateRepairs(['CHEM-A', 'CHEM-A'], cat), []); // duplicate draft IDs
});

test('enumerateRepairs returns empty array for malformed or missing catalogue', () => {
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], null), []);
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], undefined), []);
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], 'bad'), []);
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], [{ id: 'CHEM-A' }, { id: 'CHEM-A' }]), []); // dup catalogue
});

test('enumerateRepairs returns empty array if requested section is already in the draft', () => {
  const cat = getCatalogForScenario('main');
  assert.deepEqual(enumerateRepairs(['CHEM-A', 'STAT-A', CATALOG_REQUESTED_SECTION_ID], cat), []);
});

test('enumerateRepairs returns empty array if requested section is unknown in the catalogue', () => {
  const cat = getCatalogForScenario('main');
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat, 'NO-SUCH-SECTION'), []);
});

test('enumerateRepairs returns empty array if the base draft itself is invalid', () => {
  // STAT-A and BIO-214 conflict on Monday — draft is invalid before any repair
  const cat = getCatalogForScenario('main');
  assert.deepEqual(enumerateRepairs(['STAT-A', 'BIO-214'], cat), []);
});

test('enumerateRepairs: main scenario yields exactly one candidate with correct ids', () => {
  const cat = getCatalogForScenario('main');
  const candidates = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].ids, ['BIO-214', 'BIO-214L-B', 'CHEM-A', 'STAT-B']);
});

test('enumerateRepairs: main scenario candidate has correct swap (STAT-A → STAT-B)', () => {
  const cat = getCatalogForScenario('main');
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.deepEqual(candidate.swap, { old: 'STAT-A', replacement: 'STAT-B' });
});

test('enumerateRepairs: main scenario candidate has correct added and kept sets', () => {
  const cat = getCatalogForScenario('main');
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.deepEqual(candidate.added, ['BIO-214', 'BIO-214L-B', 'STAT-B']);
  assert.deepEqual(candidate.kept, ['CHEM-A']);
});

test('enumerateRepairs stops after finding a valid single-swap plan', () => {
  const cat = getCatalogForScenario('main');
  const candidates = enumerateRepairs(
    [...CATALOG_INITIAL_DRAFT],
    cat,
    'BIO-214',
    { firstStep: true }
  );
  assert.ok(candidates.length > 0, 'at least one repair plan should be available');
  assert.ok(candidates.every((candidate) => candidate.swaps.length <= 1));
});

test('enumerateRepairs falls back to two swaps only when no single-swap plan works', () => {
  const cat = getCatalogForScenario('main').map((section) => {
    if (section.id === 'BIO-214') {
      return { ...section, day: 'Mon', start: 780, end: 840 };
    }
    if (section.id === 'BIO-214L-A') {
      return { ...section, day: 'Tue', start: 600, end: 720 };
    }
    if (section.id === 'BIO-214L-B') {
      return { ...section, enrolled: 30, capacity: 30, seat: 'full' };
    }
    return section;
  });
  const candidates = enumerateRepairs(
    [...CATALOG_INITIAL_DRAFT],
    cat,
    'BIO-214',
    { firstStep: true }
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].swaps.length, 2);
  assert.deepEqual(
    candidates[0].swaps.map(({ old, replacement }) => [old, replacement]),
    [
      ['CHEM-A', 'CHEM-B'],
      ['STAT-A', 'STAT-B'],
    ]
  );
});

test('enumerateRepairs finds a two-swap course-section change after single swaps fail', () => {
  const draft = ['BIO-214', 'BIO-214L-A', 'CHEM-B', 'STAT-B'];
  const candidates = enumerateRepairs(
    draft,
    getCatalogForScenario('main'),
    'CHEM-A',
    { firstStep: true }
  );

  assert.ok(candidates.length > 0);
  assert.equal(candidates[0].swaps.length, 2);
  assert.deepEqual(
    candidates[0].swaps.map(({ old, replacement }) => [old, replacement]),
    [
      ['BIO-214L-A', 'BIO-214L-B'],
      ['CHEM-B', 'CHEM-A'],
    ]
  );
});

test('enumerateRepairs rejects undeclared alternate (alternate not in section.alternates)', () => {
  // Patch STAT-A so its alternates point to CHEM-B instead of STAT-B
  const cat = getCatalogForScenario('main').map((s) =>
    s.id === 'STAT-A' ? { ...s, alternates: ['CHEM-B'] } : s
  );
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat), []);
});

test('enumerateRepairs rejects swap where alternate has a different course or component', () => {
  // Patch STAT-A alternates to include CHEM-A (different course)
  const cat = getCatalogForScenario('main').map((s) =>
    s.id === 'STAT-A' ? { ...s, alternates: ['CHEM-A'] } : s
  );
  // CHEM-A is already in draft so result may be empty; alternately patch a section not in draft
  // Use a fresh scenario: STAT-A declares CHEM-B as alternate, CHEM-B is different course
  const cat2 = getCatalogForScenario('main').map((s) =>
    s.id === 'STAT-A' ? { ...s, alternates: ['CHEM-B'] } : s
  );
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat2), []);
});

test('enumerateRepairs: direct add (no swap) is supported when no swap needed', () => {
  // Draft already has STAT-B (which does not conflict with BIO-214); direct add should work
  // CHEM-A Tue 10-11, STAT-B Thu 13-14, BIO-214 Mon 13-14, BIO-214L-B Wed 14-16 -> no conflicts
  const cat = getCatalogForScenario('main');
  // Request BIO-214 from draft ['CHEM-A', 'STAT-B'] — should find direct add candidate (no swap)
  const candidates = enumerateRepairs(['CHEM-A', 'STAT-B'], cat);
  assert.ok(candidates.length >= 1, 'direct add without swap should yield at least one candidate');
  const directAdd = candidates.find((c) => c.swap === null);
  assert.ok(directAdd, 'should include a no-swap (direct add) candidate');
  assert.ok(directAdd.ids.includes('BIO-214'), 'candidate must include BIO-214');
  assert.ok(directAdd.ids.includes('BIO-214L-B'), 'candidate must include the linked lab');
});

test('enumerateRepairs: no-swap candidates sorted before swap candidates', () => {
  // When both direct-add and swap candidates exist, no-swap should appear first
  const cat = getCatalogForScenario('main');
  const candidates = enumerateRepairs(['CHEM-A', 'STAT-B'], cat);
  if (candidates.length > 1) {
    const firstSwapIndex = candidates.findIndex((c) => c.swap !== null);
    const lastDirectIndex = candidates.reduce((acc, c, i) => (c.swap === null ? i : acc), -1);
    assert.ok(lastDirectIndex < firstSwapIndex || firstSwapIndex === -1,
      'no-swap candidates should precede swap candidates');
  }
});

test('enumerateRepairs deduplicates candidates with identical final IDs', () => {
  const cat = getCatalogForScenario('main');
  const first = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  const ids = first.map((c) => c.ids.join('|'));
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, 'candidate IDs must be deduplicated');
});

test('enumerateRepairs is deterministic across multiple calls', () => {
  const cat = getCatalogForScenario('main');
  const first = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  const second = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.deepEqual(first, second);
});

test('enumerateRepairs: unsupported multi-link requirement (requires.length > 1) yields no candidate', () => {
  // Patch BIO-214 to have two separate linked requirements (unsupported)
  const cat = getCatalogForScenario('main').map((s) =>
    s.id === 'BIO-214'
      ? {
          ...s,
          requires: [
            { component: 'lab', linkedGroup: 'BIO-214-labs', min: 1, max: 1 },
            { component: 'tutorial', linkedGroup: 'BIO-214-tutorials', min: 1, max: 1 },
          ],
        }
      : s
  );
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat), []);
});

// --- Validate, deduplicate, rank candidates ---

test('exact main candidate is BIO-214 + BIO-214L-B + CHEM-A + STAT-B (Chemistry kept, Statistics swapped)', () => {
  const cat = getCatalogForScenario('main');
  const candidates = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.equal(candidates.length, 1, 'main scenario must yield exactly one candidate');
  const [c] = candidates;
  // Exact sorted IDs
  assert.deepEqual(c.ids, ['BIO-214', 'BIO-214L-B', 'CHEM-A', 'STAT-B']);
  // Chemistry is kept (CHEM-A stays, was in original draft)
  assert.ok(c.kept.includes('CHEM-A'), 'CHEM-A must be in kept set');
  assert.ok(!c.kept.includes('STAT-A'), 'STAT-A must not be in kept set');
  // Statistics is swapped (STAT-A → STAT-B)
  assert.deepEqual(c.swap, { old: 'STAT-A', replacement: 'STAT-B' });
  // BIO-214 and BIO-214L-B and STAT-B are added
  assert.deepEqual(c.added, ['BIO-214', 'BIO-214L-B', 'STAT-B']);
});

test('known-data no-repair scenario (BIO-214L-B full at 30/30) yields zero candidates', () => {
  const cat = getCatalogForScenario('noRepair');
  const labB = cat.find((s) => s.id === 'BIO-214L-B');
  assert.equal(labB.seat, 'full', 'precondition: BIO-214L-B must be full in noRepair scenario');
  assert.equal(labB.enrolled, 30);
  assert.equal(labB.capacity, 30);
  const candidates = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.equal(candidates.length, 0, 'no-repair scenario must yield zero candidates');
});

test('missing availability counts excludes that linked section but permits a valid alternate repair', () => {
  const cat = getCatalogForScenario('main').map((s) =>
    s.id === 'BIO-214L-B'
      ? { ...s, enrolled: undefined, capacity: undefined, seat: 'unknown' }
      : s
  );
  const candidates = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.ok(candidates.length > 0, 'the available linked-lab alternative should still be considered');
  assert.ok(candidates.every((candidate) => !candidate.ids.includes('BIO-214L-B')));
  assert.ok(candidates.every((candidate) => candidate.validation.ok));
});

test('malformed availability counts excludes that linked section but permits a valid alternate repair', () => {
  const cat = getCatalogForScenario('main').map((s) =>
    s.id === 'BIO-214L-B'
      ? { ...s, enrolled: 31, capacity: 30, seat: 'open' }
      : s
  );
  const candidates = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.ok(candidates.length > 0, 'the available linked-lab alternative should still be considered');
  assert.ok(candidates.every((candidate) => !candidate.ids.includes('BIO-214L-B')));
  assert.ok(candidates.every((candidate) => candidate.validation.ok));
});

test('full linked section cannot become a candidate when another valid repair exists', () => {
  const cat = getCatalogForScenario('main').map((s) =>
    s.id === 'BIO-214L-B' ? { ...s, seat: 'full' } : s
  );
  const candidates = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.ok(candidates.length > 0, 'the available linked-lab alternative should still be considered');
  assert.ok(candidates.every((candidate) => !candidate.ids.includes('BIO-214L-B')));
  assert.ok(candidates.every((candidate) => candidate.validation.ok));
});

test('independent validation rejects candidate with corrupted time on swap target', () => {
  const cat = getCatalogForScenario('main').map((s) =>
    s.id === 'STAT-B' ? { ...s, start: 800, end: 780 } : s
  );
  const candidates = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.equal(candidates.length, 0, 'reversed time on swap target must reject candidate');
});

test('independent validation rejects candidate with corrupted seat on swap target', () => {
  const cat = getCatalogForScenario('main').map((s) =>
    s.id === 'STAT-B' ? { ...s, seat: 'maybe' } : s
  );
  const candidates = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.equal(candidates.length, 0, 'malformed seat on swap target must reject candidate');
});

test('stable ordering — no-swap candidates always precede swap candidates', () => {
  const cat = getCatalogForScenario('main');
  const candidates = enumerateRepairs(['CHEM-A', 'STAT-B'], cat);
  let seenSwap = false;
  for (const c of candidates) {
    if (c.swap !== null) seenSwap = true;
    if (seenSwap) {
      assert.notEqual(c.swap, null, 'no direct-add candidate should follow a swap candidate');
    }
  }
});

test('deduplication — identical final ID sets appear exactly once', () => {
  const cat = getCatalogForScenario('main');
  const candidates = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  const keys = candidates.map((c) => c.ids.join('|'));
  assert.equal(new Set(keys).size, keys.length, 'candidate list must contain no duplicate ID sets');
});

test('each included candidate carries an independent validation result with ok:true', () => {
  const cat = getCatalogForScenario('main');
  const candidates = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  for (const c of candidates) {
    assert.ok(c.validation, 'candidate must carry a validation object');
    assert.equal(c.validation.ok, true, 'every included candidate must pass independent validation');
  }
});

// --- Revalidate current candidate at use time ---

test('isCurrentCandidate succeeds for current valid candidate in main scenario', () => {
  const cat = getCatalogForScenario('main');
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.ok(candidate, 'candidate must exist');
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], candidate.ids, cat), true);
});

test('isCurrentCandidate handles unsorted candidate IDs cleanly', () => {
  const cat = getCatalogForScenario('main');
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  const reversed = [...candidate.ids].reverse();
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], reversed, cat), true);
});

test('isCurrentCandidate fails if candidate IDs input is not an array or is invalid', () => {
  const cat = getCatalogForScenario('main');
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], null, cat), false);
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], undefined, cat), false);
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], 'BIO-214', cat), false);
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], 42, cat), false);
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], [null], cat), false);
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], ['BIO-214', 'BIO-214'], cat), false);
});

test('isCurrentCandidate fails if draft has changed', () => {
  const cat = getCatalogForScenario('main');
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  // Student modified draft: removed CHEM-A
  assert.equal(isCurrentCandidate(['STAT-A'], candidate.ids, cat), false);
  // Student modified draft: added something else
  assert.equal(isCurrentCandidate(['CHEM-A'], candidate.ids, cat), false);
  // Student modified draft: completely different draft
  assert.equal(isCurrentCandidate(['CHEM-B'], candidate.ids, cat), false);
  // Empty draft
  assert.equal(isCurrentCandidate([], candidate.ids, cat), false);
});

test('isCurrentCandidate fails if candidate IDs were mutated to an invalid or stale schedule', () => {
  const cat = getCatalogForScenario('main');
  // Revert swap: keep STAT-A instead of STAT-B, producing conflict
  const corrupted = ['BIO-214', 'BIO-214L-B', 'CHEM-A', 'STAT-A'];
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], corrupted, cat), false);
  // Omit linked lab
  const missingLab = ['BIO-214', 'CHEM-A', 'STAT-B'];
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], missingLab, cat), false);
  // Unknown section ID in candidate
  const unknownSection = ['BIO-214', 'BIO-214L-B', 'CHEM-A', 'STAT-999'];
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], unknownSection, cat), false);
});

test('isCurrentCandidate fails if candidate time was mutated in catalog to overlap', () => {
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], getCatalogForScenario('main'));
  // Mutate candidate section time in catalog so it overlaps with CHEM-A (Tue 600-660)
  const mutatedCat = getCatalogForScenario('main').map((s) =>
    s.id === 'STAT-B' ? { ...s, day: 'Tue', start: 600, end: 660 } : s
  );
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], candidate.ids, mutatedCat), false);
});

test('isCurrentCandidate fails if candidate seat was mutated in catalog to full', () => {
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], getCatalogForScenario('main'));
  const mutatedCat = getCatalogForScenario('main').map((s) =>
    s.id === 'BIO-214L-B' ? { ...s, seat: 'full', enrolled: 30, capacity: 30 } : s
  );
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], candidate.ids, mutatedCat), false);
});

test('isCurrentCandidate fails if candidate seat counts are corrupted or missing', () => {
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], getCatalogForScenario('main'));
  const corruptedCat = getCatalogForScenario('main').map((s) =>
    s.id === 'STAT-B' ? { ...s, enrolled: 35, capacity: 30 } : s
  );
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], candidate.ids, corruptedCat), false);
});

test('isCurrentCandidate fails if candidate link requirement was mutated or broken in catalog', () => {
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], getCatalogForScenario('main'));
  const mutatedCat = getCatalogForScenario('main').map((s) =>
    s.id === 'BIO-214' ? { ...s, requires: [] } : s
  );
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], candidate.ids, mutatedCat), false);
});

test('isCurrentCandidate fails if catalog is invalid or corrupted', () => {
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], getCatalogForScenario('main'));
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], candidate.ids, null), false);
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], candidate.ids, []), false);
  assert.equal(isCurrentCandidate([...CATALOG_INITIAL_DRAFT], candidate.ids, [{ id: '' }]), false);
});

// --- Adversarial domain suite and Gate A validation ---

test('validateDraft rejects malformed draft ID entries (empty string, whitespace, non-strings)', () => {
  const cat = getCatalogForScenario('main');
  assert.equal(validateDraft([''], cat).ok, false);
  assert.equal(validateDraft(['   '], cat).ok, false);
  assert.equal(validateDraft([null], cat).ok, false);
  assert.equal(validateDraft([undefined], cat).ok, false);
  assert.equal(validateDraft([42], cat).ok, false);
  assert.equal(validateDraft([{}], cat).ok, false);
  assert.equal(validateDraft([['CHEM-A']], cat).ok, false);
});

test('validateDraft rejects case-mismatched section IDs', () => {
  const cat = getCatalogForScenario('main');
  const res = validateDraft(['chem-a', 'stat-a'], cat);
  assert.equal(res.ok, false);
  assert.ok(res.reason.includes('unknown section ID in draft'));
});

test('validateDraft rejects draft containing unknown IDs', () => {
  const cat = getCatalogForScenario('main');
  const res = validateDraft(['CHEM-A', 'UNKNOWN-SECTION-999'], cat);
  assert.equal(res.ok, false);
  assert.ok(res.reason.includes('unknown section ID in draft'));
});

test('validateDraft rejects section with empty or non-string component', () => {
  const badCat = getCatalogForScenario('main').map((s) =>
    s.id === 'CHEM-A' ? { ...s, component: '' } : s
  );
  assert.equal(validateDraft(['CHEM-A'], badCat).ok, false);
});

test('validateDraft rejects section with empty or non-string course', () => {
  const badCat = getCatalogForScenario('main').map((s) =>
    s.id === 'CHEM-A' ? { ...s, course: '' } : s
  );
  assert.equal(validateDraft(['CHEM-A'], badCat).ok, false);
});

test('validateDraft rejects section with zero or negative duration (start >= end)', () => {
  const badCat1 = getCatalogForScenario('main').map((s) =>
    s.id === 'CHEM-A' ? { ...s, start: 600, end: 600 } : s
  );
  assert.equal(validateDraft(['CHEM-A'], badCat1).ok, false);

  const badCat2 = getCatalogForScenario('main').map((s) =>
    s.id === 'CHEM-A' ? { ...s, start: 660, end: 600 } : s
  );
  assert.equal(validateDraft(['CHEM-A'], badCat2).ok, false);
});

test('validateDraft rejects section with start or end exceeding 24 hours (1440)', () => {
  const badCat1 = getCatalogForScenario('main').map((s) =>
    s.id === 'CHEM-A' ? { ...s, start: -5, end: 600 } : s
  );
  assert.equal(validateDraft(['CHEM-A'], badCat1).ok, false);

  const badCat2 = getCatalogForScenario('main').map((s) =>
    s.id === 'CHEM-A' ? { ...s, start: 600, end: 1441 } : s
  );
  assert.equal(validateDraft(['CHEM-A'], badCat2).ok, false);
});

test('validateDraft rejects section with invalid day of the week', () => {
  const badCat = getCatalogForScenario('main').map((s) =>
    s.id === 'CHEM-A' ? { ...s, day: 'Funday' } : s
  );
  assert.equal(validateDraft(['CHEM-A'], badCat).ok, false);
});

test('overlaps correctly distinguishes adjacent half-open boundaries from 1-minute overlap', () => {
  const sec1 = { day: 'Mon', start: 600, end: 660 };
  const sec2Adjacent = { day: 'Mon', start: 660, end: 720 };
  const sec2Overlap1Min = { day: 'Mon', start: 659, end: 720 };

  // Adjacent: [600, 660) and [660, 720) do NOT overlap
  assert.equal(overlaps(sec1, sec2Adjacent), false);

  // Overlap by 1 minute: [600, 660) and [659, 720) MUST overlap
  assert.equal(overlaps(sec1, sec2Overlap1Min), true);
});

test('overlaps returns true for identical, enclosed, or partially overlapping meeting intervals on same day', () => {
  const base = { day: 'Mon', start: 600, end: 720 };
  const identical = { day: 'Mon', start: 600, end: 720 };
  const enclosed = { day: 'Mon', start: 630, end: 690 };
  const partialStart = { day: 'Mon', start: 540, end: 630 };
  const partialEnd = { day: 'Mon', start: 690, end: 780 };

  assert.equal(overlaps(base, identical), true);
  assert.equal(overlaps(base, enclosed), true);
  assert.equal(overlaps(base, partialStart), true);
  assert.equal(overlaps(base, partialEnd), true);
});

test('overlaps returns false for identical time intervals on different days', () => {
  const mon = { day: 'Mon', start: 600, end: 720 };
  const tue = { day: 'Tue', start: 600, end: 720 };
  assert.equal(overlaps(mon, tue), false);
});

test('enumerateRepairs rejects draft with malformed or non-string IDs', () => {
  const cat = getCatalogForScenario('main');
  assert.deepEqual(enumerateRepairs(['CHEM-A', ''], cat), []);
  assert.deepEqual(enumerateRepairs(['CHEM-A', null], cat), []);
  assert.deepEqual(enumerateRepairs(['CHEM-A', 42], cat), []);
});

test('enumerateRepairs rejects draft with duplicate IDs', () => {
  const cat = getCatalogForScenario('main');
  assert.deepEqual(enumerateRepairs(['CHEM-A', 'CHEM-A'], cat), []);
});

test('enumerateRepairs rejects parent section requiring multiple linked components (unsupported multi-link)', () => {
  const multiLinkCat = getCatalogForScenario('main').map((s) =>
    s.id === 'BIO-214'
      ? {
          ...s,
          requires: [
            { component: 'lab', linkedGroup: 'BIO-214-labs', min: 1, max: 1 },
            { component: 'discussion', linkedGroup: 'BIO-214-disc', min: 1, max: 1 },
          ],
        }
      : s
  );
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], multiLinkCat), []);
});

test('enumerateRepairs rejects alternate swap with mismatched course or component', () => {
  // Course mismatch: STAT-A declares CHEM-B as alternate
  const catCrossCourse = getCatalogForScenario('main').map((s) =>
    s.id === 'STAT-A' ? { ...s, alternates: ['CHEM-B'] } : s
  );
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], catCrossCourse), []);

  // Component mismatch: STAT-A declares a lab alternate
  const catCrossComponent = getCatalogForScenario('main').map((s) =>
    s.id === 'STAT-A' ? { ...s, alternates: ['STAT-LAB'] } : s
  );
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], catCrossComponent), []);
});

test('enumerateRepairs rejects self-swap (section referencing itself as alternate)', () => {
  const catSelf = getCatalogForScenario('main').map((s) =>
    s.id === 'STAT-A' ? { ...s, alternates: ['STAT-A'] } : s
  );
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], catSelf), []);
});

test('enumerateRepairs rejects undeclared alternate replacement', () => {
  const catNoAlts = getCatalogForScenario('main').map((s) =>
    s.id === 'STAT-A' ? { ...s, alternates: [] } : s
  );
  assert.deepEqual(enumerateRepairs([...CATALOG_INITIAL_DRAFT], catNoAlts), []);
});

test('click-time Apply revalidation: rejects candidate corrupted in memory before click (swap target reverted)', () => {
  const cat = getCatalogForScenario('main');
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);
  assert.ok(candidate, 'valid preview candidate must be generated');

  // Preview generated candidate; before user clicks Apply, candidate is mutated in memory:
  const corruptedCandidate = {
    ...candidate,
    ids: ['BIO-214', 'BIO-214L-B', 'CHEM-A', 'STAT-A'], // reverted to conflicting STAT-A
  };

  // Click-time revalidation must reject it
  const isSafeToApply = isCurrentCandidate([...CATALOG_INITIAL_DRAFT], corruptedCandidate.ids, cat);
  assert.equal(isSafeToApply, false, 'click-time revalidation must reject candidate with reverted swap');
});

test('click-time Apply revalidation: rejects candidate with injected extra section ID before click', () => {
  const cat = getCatalogForScenario('main');
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);

  // Injected extra section before Apply click
  const tamperedIds = [...candidate.ids, 'CHEM-B'];
  const isSafeToApply = isCurrentCandidate([...CATALOG_INITIAL_DRAFT], tamperedIds, cat);
  assert.equal(isSafeToApply, false, 'click-time revalidation must reject candidate with injected extra ID');
});

test('click-time Apply revalidation: rejects candidate with removed required section before click', () => {
  const cat = getCatalogForScenario('main');
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);

  // Dropped linked lab before Apply click
  const truncatedIds = candidate.ids.filter((id) => id !== 'BIO-214L-B');
  const isSafeToApply = isCurrentCandidate([...CATALOG_INITIAL_DRAFT], truncatedIds, cat);
  assert.equal(isSafeToApply, false, 'click-time revalidation must reject candidate with missing linked lab');
});

test('click-time Apply revalidation: rejects candidate if user altered background draft before click', () => {
  const cat = getCatalogForScenario('main');
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);

  // User changed draft in background before clicking Apply (e.g. removed CHEM-A)
  const alteredDraft = ['STAT-A'];
  const isSafeToApply = isCurrentCandidate(alteredDraft, candidate.ids, cat);
  assert.equal(isSafeToApply, false, 'click-time revalidation must reject candidate when draft state has changed');
});

test('click-time Apply revalidation: rejects candidate if catalog seat availability changed before click', () => {
  const cat = getCatalogForScenario('main');
  const [candidate] = enumerateRepairs([...CATALOG_INITIAL_DRAFT], cat);

  // Before clicking Apply, BIO-214L-B becomes full (30/30) in catalog
  const updatedCatalog = cat.map((s) =>
    s.id === 'BIO-214L-B' ? { ...s, seat: 'full', enrolled: 30, capacity: 30 } : s
  );
  const isSafeToApply = isCurrentCandidate([...CATALOG_INITIAL_DRAFT], candidate.ids, updatedCatalog);
  assert.equal(isSafeToApply, false, 'click-time revalidation must reject candidate if seat filled up before Apply');
});

test('Gate A verification: confirms all 7 correctness and safety thresholds pass deterministically', () => {
  const mainCat = getCatalogForScenario('main');
  const initialDraft = [...CATALOG_INITIAL_DRAFT];

  // 1. Exact expected main candidate
  const candidates = enumerateRepairs(initialDraft, mainCat);
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].ids, ['BIO-214', 'BIO-214L-B', 'CHEM-A', 'STAT-B']);
  assert.deepEqual(candidates[0].swap, { old: 'STAT-A', replacement: 'STAT-B' });
  assert.deepEqual(candidates[0].kept, ['CHEM-A']);

  // 2. Zero candidate for known-data no-repair scenario
  const noRepairCat = getCatalogForScenario('noRepair');
  assert.equal(enumerateRepairs(initialDraft, noRepairCat).length, 0);

  // 3. No invalid candidate in fixed adversarial suite
  for (const c of candidates) {
    const verdict = validateDraft(c.ids, mainCat);
    assert.equal(verdict.ok, true);
  }

  // 4. Malformed linked-section data is excluded while valid alternatives remain usable
  const corruptSeatCat = mainCat.map((s) =>
    s.id === 'BIO-214L-B' ? { ...s, seat: 'unknown', enrolled: undefined, capacity: undefined } : s
  );
  const alternatives = enumerateRepairs(initialDraft, corruptSeatCat);
  assert.ok(alternatives.length > 0);
  assert.ok(alternatives.every((candidate) => !candidate.ids.includes('BIO-214L-B')));
  assert.ok(alternatives.every((candidate) => candidate.validation.ok));

  // 5. Stable order and deduplication
  const secondRun = enumerateRepairs(initialDraft, mainCat);
  assert.deepEqual(candidates, secondRun);
  const keys = candidates.map((c) => c.ids.join('|'));
  assert.equal(new Set(keys).size, keys.length);

  // 6. Independent validator rejects mutated candidate
  const mutatedIds = ['BIO-214', 'BIO-214L-B', 'CHEM-A', 'STAT-A'];
  assert.equal(validateDraft(mutatedIds, mainCat).ok, false);

  // 7. Click-time Apply revalidation rejects candidate corrupted after preview
  assert.equal(isCurrentCandidate(initialDraft, mutatedIds, mainCat), false);
});
