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
import { validateDraft, validateCatalogue } from '../src/domain/validate.mjs';

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
