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

  const refusalCat = catalogForScenario('refusal');
  const refusalLabB = refusalCat.find((s) => s.id === 'BIO-214L-B');
  assert.ok(refusalLabB);
  assert.equal(refusalLabB.seat, 'unknown');
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

test('refusal scenario makes copy without shared mutation', () => {
  const main = getCatalogForScenario('main');
  const refusal = getCatalogForScenario('refusal');

  const mainLabB = main.find((s) => s.id === 'BIO-214L-B');
  const refusalLabB = refusal.find((s) => s.id === 'BIO-214L-B');

  assert.equal(mainLabB.seat, 'open');
  assert.equal(refusalLabB.seat, 'unknown');

  // Verify mutating copy does not mutate original or subsequent calls
  refusalLabB.seat = 'mutated';
  assert.equal(getCatalogForScenario('main').find((s) => s.id === 'BIO-214L-B').seat, 'open');
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
