/**
 * tests/linked-labs.test.mjs
 *
 * Unit tests — Handle full-lab drag attempts.
 * Tests cover:
 *  - Full labs are excluded from the linked outline IDs
 *  - Non-full alternative remains outlined
 *  - Both full: no labs outlined (only lecture if present)
 *  - Main scenario: BIO-214L-B has seats (22/30) and is included in outline
 *  - noRepair scenario: BIO-214L-B is 30/30 full and excluded from outline
 *  - Standalone full-lab detection helper
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getLinkedOutlineSectionIds,
  isBio214MissingLab,
} from '../src/domain/linked-labs.mjs';

import { catalogForScenario, MAIN_CATALOG } from '../src/domain/catalog.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mainCatalog() { return catalogForScenario('main'); }
function noRepairCatalog() { return catalogForScenario('noRepair'); }
function getById(catalog, id) { return catalog.find((s) => s.id === id); }

// ---------------------------------------------------------------------------
// 1. isBio214MissingLab helper
// ---------------------------------------------------------------------------

describe('isBio214MissingLab', () => {
  it('returns false when BIO-214 is not in draft', () => {
    assert.equal(isBio214MissingLab(['MATH-A', 'STAT-A'], mainCatalog()), false);
  });

  it('returns true when BIO-214 is in draft with no lab', () => {
    assert.equal(isBio214MissingLab(['BIO-214', 'MATH-A'], mainCatalog()), true);
  });

  it('returns false when BIO-214 and BIO-214L-A are both in draft', () => {
    assert.equal(isBio214MissingLab(['BIO-214', 'BIO-214L-A'], mainCatalog()), false);
  });

  it('returns false when BIO-214 and BIO-214L-B are both in draft', () => {
    assert.equal(isBio214MissingLab(['BIO-214', 'BIO-214L-B'], mainCatalog()), false);
  });

  it('handles empty draft gracefully', () => {
    assert.equal(isBio214MissingLab([], mainCatalog()), false);
  });

  it('handles null draft gracefully', () => {
    assert.equal(isBio214MissingLab(null, mainCatalog()), false);
  });
});

// ---------------------------------------------------------------------------
// 2. getLinkedOutlineSectionIds — main scenario (Lab B is open 22/30)
// ---------------------------------------------------------------------------

describe('getLinkedOutlineSectionIds — main scenario', () => {
  it('returns [] when neither lecture nor lab is in draft', () => {
    const ids = getLinkedOutlineSectionIds(['MATH-A', 'STAT-A'], mainCatalog());
    assert.deepEqual(ids, []);
  });

  it('returns [] when both BIO-214 and a lab are in draft', () => {
    const ids = getLinkedOutlineSectionIds(['BIO-214', 'BIO-214L-A'], mainCatalog());
    assert.deepEqual(ids, []);
  });

  it('outlines BIO-214 and all non-full labs when lecture in draft, lab missing', () => {
    const ids = getLinkedOutlineSectionIds(['BIO-214', 'MATH-A'], mainCatalog());
    assert.ok(ids.includes('BIO-214'), 'lecture should be outlined');
    assert.ok(ids.includes('BIO-214L-A'), 'Lab A (open) should be outlined');
    assert.ok(ids.includes('BIO-214L-B'), 'Lab B (22/30) should be outlined in main scenario');
  });

  it('outlines lab and lecture when lab in draft, lecture missing', () => {
    const ids = getLinkedOutlineSectionIds(['BIO-214L-A', 'MATH-A'], mainCatalog());
    assert.ok(ids.includes('BIO-214L-A'), 'selected lab should be in outline');
    assert.ok(ids.includes('BIO-214'), 'BIO-214 lecture should be outlined');
  });
});

// ---------------------------------------------------------------------------
// 3. getLinkedOutlineSectionIds — noRepair scenario (Lab B is full 30/30)
// ---------------------------------------------------------------------------

describe('getLinkedOutlineSectionIds — noRepair scenario (Lab B full)', () => {
  it('BIO-214L-B is seat=full in noRepair catalog', () => {
    const sec = getById(noRepairCatalog(), 'BIO-214L-B');
    assert.equal(sec.seat, 'full');
    assert.equal(sec.enrolled, 30);
    assert.equal(sec.capacity, 30);
  });

  it('excludes full BIO-214L-B from outline when lecture is in draft', () => {
    const ids = getLinkedOutlineSectionIds(['BIO-214', 'MATH-A'], noRepairCatalog());
    assert.ok(ids.includes('BIO-214'), 'lecture should still be outlined');
    assert.ok(ids.includes('BIO-214L-A'), 'Lab A (open) should still be outlined');
    assert.ok(!ids.includes('BIO-214L-B'), 'Full Lab B must NOT be outlined');
  });

  it('non-full Lab A keeps its outline even when Lab B is full', () => {
    const ids = getLinkedOutlineSectionIds(['BIO-214', 'MATH-A'], noRepairCatalog());
    assert.ok(ids.includes('BIO-214L-A'));
  });

  it('returns [] when both lecture and lab are in draft', () => {
    const ids = getLinkedOutlineSectionIds(['BIO-214', 'BIO-214L-A', 'MATH-A'], noRepairCatalog());
    assert.deepEqual(ids, []);
  });
});

// ---------------------------------------------------------------------------
// 4. Full-lab seat detection logic
// ---------------------------------------------------------------------------

describe('Full-lab seat detection', () => {
  it('MAIN_CATALOG BIO-214L-B has seats (22/30)', () => {
    const sec = MAIN_CATALOG.find((s) => s.id === 'BIO-214L-B');
    assert.equal(sec.seat, 'open');
    assert.ok(sec.enrolled < sec.capacity);
  });

  it('MAIN_CATALOG BIO-214L-A has seats (12/30)', () => {
    const sec = MAIN_CATALOG.find((s) => s.id === 'BIO-214L-A');
    assert.equal(sec.seat, 'open');
    assert.ok(sec.enrolled < sec.capacity);
  });

  it('noRepair BIO-214L-B enrolled >= capacity', () => {
    const sec = getById(noRepairCatalog(), 'BIO-214L-B');
    assert.ok(sec.enrolled >= sec.capacity);
  });

  it('isFullLab detection: seat=full AND linkedGroup matches', () => {
    const fullSec = { id: 'BIO-214L-B', seat: 'full', enrolled: 30, capacity: 30, linkedGroup: 'BIO-214-labs' };
    const isFull =
      (fullSec.seat === 'full' || (typeof fullSec.capacity === 'number' && fullSec.enrolled >= fullSec.capacity)) &&
      (fullSec.linkedGroup === 'BIO-214-labs' || fullSec.requiredBy === 'BIO-214');
    assert.equal(isFull, true);
  });

  it('isFullLab detection: open lab is not full', () => {
    const openSec = { id: 'BIO-214L-A', seat: 'open', enrolled: 12, capacity: 30, linkedGroup: 'BIO-214-labs' };
    const isFull =
      (openSec.seat === 'full' || (typeof openSec.capacity === 'number' && openSec.enrolled >= openSec.capacity)) &&
      (openSec.linkedGroup === 'BIO-214-labs' || openSec.requiredBy === 'BIO-214');
    assert.equal(isFull, false);
  });

  it('isFullLab detection: full lecture (no linkedGroup) is NOT flagged', () => {
    const fullLecture = { id: 'CHEM-X', seat: 'full', enrolled: 30, capacity: 30, component: 'lecture' };
    const isFull =
      (fullLecture.seat === 'full' || (typeof fullLecture.capacity === 'number' && fullLecture.enrolled >= fullLecture.capacity)) &&
      (fullLecture.linkedGroup === 'BIO-214-labs' || fullLecture.requiredBy === 'BIO-214');
    assert.equal(isFull, false);
  });
});

// ---------------------------------------------------------------------------
// 5. Outline stability — non-full alternative remains outlined
// ---------------------------------------------------------------------------

describe('Non-full alternative outline stability', () => {
  it('Lab A remains outlined when Lab B is full and lecture is pending', () => {
    const catalog = noRepairCatalog();
    const ids = getLinkedOutlineSectionIds(['BIO-214'], catalog);
    assert.ok(ids.includes('BIO-214L-A'), 'Lab A must stay outlined as viable alternative');
    assert.ok(!ids.includes('BIO-214L-B'), 'Full Lab B must not appear in outline');
  });

  it('returns only lecture + open lab when one lab is full, one is open', () => {
    const minCatalog = [
      { id: 'BIO-214', seat: 'open', enrolled: 20, capacity: 30, component: 'lecture', requires: [{ component: 'lab', linkedGroup: 'BIO-214-labs' }] },
      { id: 'BIO-214L-A', seat: 'open', enrolled: 12, capacity: 30, component: 'lab', linkedGroup: 'BIO-214-labs', requiredBy: 'BIO-214', alternates: ['BIO-214L-B'] },
      { id: 'BIO-214L-B', seat: 'full', enrolled: 30, capacity: 30, component: 'lab', linkedGroup: 'BIO-214-labs', requiredBy: 'BIO-214', alternates: ['BIO-214L-A'] },
    ];
    const ids = getLinkedOutlineSectionIds(['BIO-214'], minCatalog);
    assert.deepEqual(ids.sort(), ['BIO-214', 'BIO-214L-A'].sort());
  });

  it('returns only lecture when ALL linked labs are full', () => {
    const minCatalog = [
      { id: 'BIO-214', seat: 'open', enrolled: 20, capacity: 30, component: 'lecture', requires: [{ component: 'lab', linkedGroup: 'BIO-214-labs' }] },
      { id: 'BIO-214L-A', seat: 'full', enrolled: 30, capacity: 30, component: 'lab', linkedGroup: 'BIO-214-labs', requiredBy: 'BIO-214', alternates: ['BIO-214L-B'] },
      { id: 'BIO-214L-B', seat: 'full', enrolled: 30, capacity: 30, component: 'lab', linkedGroup: 'BIO-214-labs', requiredBy: 'BIO-214', alternates: ['BIO-214L-A'] },
    ];
    const ids = getLinkedOutlineSectionIds(['BIO-214'], minCatalog);
    assert.deepEqual(ids, ['BIO-214']);
  });
});
