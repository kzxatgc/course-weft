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
