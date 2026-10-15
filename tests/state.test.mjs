/**
 * tests/state.test.mjs
 *
 * Unit tests for src/state/draft-controller.mjs — Task 18.
 * Tests cover: initial state, immutable transitions, unknown action unchanged,
 * scenario switching, search filtering, notice management, request/candidate,
 * snapshot/restore (Undo), and selector helpers.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  initialState,
  reduce,
  ACTION,
  filteredAvailableCourses,
  canUndo,
} from '../src/state/draft-controller.mjs';

import { INITIAL_DRAFT, MAIN_CATALOG } from '../src/domain/catalog.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dispatch a sequence of actions from an initial state */
function dispatch(actions, state = initialState()) {
  return actions.reduce((s, a) => reduce(s, a), state);
}

// ---------------------------------------------------------------------------
// 1. Initial state
// ---------------------------------------------------------------------------

describe('initialState', () => {
  it('has scenario main', () => {
    assert.equal(initialState().scenario, 'main');
  });

  it('draft equals INITIAL_DRAFT', () => {
    assert.deepEqual(initialState().draft, [...INITIAL_DRAFT]);
  });

  it('availableCourses is non-empty array', () => {
    const s = initialState();
    assert.ok(Array.isArray(s.availableCourses));
    assert.ok(s.availableCourses.length > 0);
  });

  it('transient slices start null/empty', () => {
    const s = initialState();
    assert.equal(s.notice, null);
    assert.equal(s.request, null);
    assert.equal(s.candidate, null);
    assert.equal(s.snapshot, null);
    assert.equal(s.search, '');
  });
});

// ---------------------------------------------------------------------------
// 2. Immutability — previous state must not be mutated
// ---------------------------------------------------------------------------

describe('immutable transitions', () => {
  it('SELECT_SCENARIO does not mutate previous state', () => {
    const before = initialState();
    const frozen = JSON.stringify(before);
    reduce(before, { type: ACTION.SELECT_SCENARIO, payload: 'noRepair' });
    assert.equal(JSON.stringify(before), frozen);
  });

  it('SET_SEARCH does not mutate previous state', () => {
    const before = initialState();
    const frozen = JSON.stringify(before);
    reduce(before, { type: ACTION.SET_SEARCH, payload: 'bio' });
    assert.equal(JSON.stringify(before), frozen);
  });

  it('SET_NOTICE does not mutate previous state', () => {
    const before = initialState();
    const frozen = JSON.stringify(before);
    reduce(before, { type: ACTION.SET_NOTICE, payload: { kind: 'info', message: 'hello' } });
    assert.equal(JSON.stringify(before), frozen);
  });

  it('TAKE_SNAPSHOT does not mutate previous state', () => {
    const before = initialState();
    const frozen = JSON.stringify(before);
    reduce(before, { type: ACTION.TAKE_SNAPSHOT });
    assert.equal(JSON.stringify(before), frozen);
  });

  it('draft array in snapshot is a separate copy from live draft', () => {
    const s1 = initialState();
    const s2 = reduce(s1, { type: ACTION.TAKE_SNAPSHOT });
    // snapshot.draft must be a separate array reference from s2.draft
    assert.notStrictEqual(s2.snapshot.draft, s2.draft);
    // but must contain the same values
    assert.deepEqual(s2.snapshot.draft, s2.draft);
  });
});

// ---------------------------------------------------------------------------
// 3. Unknown action unchanged
// ---------------------------------------------------------------------------

describe('unknown action', () => {
  it('returns exact same state reference on unknown type', () => {
    const s = initialState();
    const next = reduce(s, { type: '__UNKNOWN__' });
    assert.strictEqual(next, s);
  });

  it('returns same state for undefined type', () => {
    const s = initialState();
    const next = reduce(s, {});
    assert.strictEqual(next, s);
  });
});

// ---------------------------------------------------------------------------
// 4. SELECT_SCENARIO
// ---------------------------------------------------------------------------

describe('SELECT_SCENARIO', () => {
  it('switches to noRepair scenario', () => {
    const s = dispatch([{ type: ACTION.SELECT_SCENARIO, payload: 'noRepair' }]);
    assert.equal(s.scenario, 'noRepair');
  });

  it('resets draft to INITIAL_DRAFT on switch', () => {
    const s = dispatch([{ type: ACTION.SELECT_SCENARIO, payload: 'noRepair' }]);
    assert.deepEqual(s.draft, [...INITIAL_DRAFT]);
  });

  it('clears transient slices on switch', () => {
    const base = dispatch([
      { type: ACTION.SET_NOTICE, payload: { kind: 'info', message: 'hi' } },
      { type: ACTION.SET_REQUEST, payload: 'BIO-214' },
    ]);
    const s = reduce(base, { type: ACTION.SELECT_SCENARIO, payload: 'noRepair' });
    assert.equal(s.notice, null);
    assert.equal(s.request, null);
    assert.equal(s.candidate, null);
    assert.equal(s.snapshot, null);
    assert.equal(s.search, '');
  });

  it('noRepair availableCourses has BIO-214L-B as full', () => {
    const s = dispatch([{ type: ACTION.SELECT_SCENARIO, payload: 'noRepair' }]);
    const labB = s.availableCourses.find((c) => c.id === 'BIO-214L-B');
    assert.ok(labB, 'BIO-214L-B must be in availableCourses');
    assert.equal(labB.seat, 'full');
    assert.equal(labB.enrolled, 30);
    assert.equal(labB.capacity, 30);
  });

  it('main availableCourses has BIO-214L-B as open', () => {
    const s = dispatch([
      { type: ACTION.SELECT_SCENARIO, payload: 'noRepair' },
      { type: ACTION.SELECT_SCENARIO, payload: 'main' },
    ]);
    const labB = s.availableCourses.find((c) => c.id === 'BIO-214L-B');
    assert.ok(labB);
    assert.equal(labB.seat, 'open');
  });

  it('same scenario returns same state reference', () => {
    const s = initialState();
    const next = reduce(s, { type: ACTION.SELECT_SCENARIO, payload: 'main' });
    assert.strictEqual(next, s);
  });

  it('unknown payload defaults to main', () => {
    const s = dispatch([{ type: ACTION.SELECT_SCENARIO, payload: 'badValue' }]);
    assert.equal(s.scenario, 'main');
  });
});

// ---------------------------------------------------------------------------
// 5. SET_SEARCH / filteredCatalogue selector
// ---------------------------------------------------------------------------

describe('SET_SEARCH', () => {
  it('stores search string', () => {
    const s = dispatch([{ type: ACTION.SET_SEARCH, payload: 'bio' }]);
    assert.equal(s.search, 'bio');
  });

  it('non-string payload defaults to empty string', () => {
    const s = dispatch([{ type: ACTION.SET_SEARCH, payload: 42 }]);
    assert.equal(s.search, '');
  });

  it('same search returns same reference', () => {
    const s = dispatch([{ type: ACTION.SET_SEARCH, payload: 'stat' }]);
    const next = reduce(s, { type: ACTION.SET_SEARCH, payload: 'stat' });
    assert.strictEqual(next, s);
  });
});

describe('filteredAvailableCourses', () => {
  it('empty search returns full availableCourses list', () => {
    const s = initialState();
    assert.equal(filteredAvailableCourses(s).length, s.availableCourses.length);
  });

  it('filters by course code (case-insensitive)', () => {
    const s = dispatch([{ type: ACTION.SET_SEARCH, payload: 'BIO' }]);
    const results = filteredAvailableCourses(s);
    assert.ok(results.length > 0);
    assert.ok(results.every((r) => r.course === 'BIO' || r.id.includes('BIO')));
  });

  it('filters by title substring', () => {
    const s = dispatch([{ type: ACTION.SET_SEARCH, payload: 'statistics' }]);
    const results = filteredAvailableCourses(s);
    assert.ok(results.length > 0);
    assert.ok(results.every((r) => r.title.toLowerCase().includes('statistics')));
  });

  it('returns empty array when no match', () => {
    const s = dispatch([{ type: ACTION.SET_SEARCH, payload: 'ZZZNOMATCH' }]);
    assert.equal(filteredAvailableCourses(s).length, 0);
  });

  it('filters by component', () => {
    const s = dispatch([{ type: ACTION.SET_SEARCH, payload: 'lab' }]);
    const results = filteredAvailableCourses(s);
    assert.ok(results.length > 0);
    assert.ok(results.every((r) => r.component === 'lab'));
  });
});

// ---------------------------------------------------------------------------
// 6. SET_NOTICE / CLEAR_NOTICE
// ---------------------------------------------------------------------------

describe('SET_NOTICE / CLEAR_NOTICE', () => {
  it('stores a notice object', () => {
    const s = dispatch([{ type: ACTION.SET_NOTICE, payload: { kind: 'error', message: 'conflict' } }]);
    assert.deepEqual(s.notice, { kind: 'error', message: 'conflict' });
  });

  it('null payload clears notice', () => {
    const s = dispatch([
      { type: ACTION.SET_NOTICE, payload: { kind: 'info', message: 'hi' } },
      { type: ACTION.SET_NOTICE, payload: null },
    ]);
    assert.equal(s.notice, null);
  });

  it('CLEAR_NOTICE removes notice', () => {
    const s = dispatch([
      { type: ACTION.SET_NOTICE, payload: { kind: 'success', message: 'done' } },
      { type: ACTION.CLEAR_NOTICE },
    ]);
    assert.equal(s.notice, null);
  });

  it('CLEAR_NOTICE with no notice returns same reference', () => {
    const s = initialState();
    const next = reduce(s, { type: ACTION.CLEAR_NOTICE });
    assert.strictEqual(next, s);
  });
});

// ---------------------------------------------------------------------------
// 7. SET_REQUEST / SET_CANDIDATE / CLEAR_CANDIDATE
// ---------------------------------------------------------------------------

describe('request and candidate', () => {
  it('SET_REQUEST stores request ID', () => {
    const s = dispatch([{ type: ACTION.SET_REQUEST, payload: 'BIO-214' }]);
    assert.equal(s.request, 'BIO-214');
  });

  it('SET_REQUEST clears any existing candidate', () => {
    const s = dispatch([
      { type: ACTION.SET_CANDIDATE, payload: { ids: ['CHEM-A'] } },
      { type: ACTION.SET_REQUEST, payload: 'BIO-214' },
    ]);
    assert.equal(s.candidate, null);
  });

  it('non-string payload sets request to null', () => {
    const s = dispatch([{ type: ACTION.SET_REQUEST, payload: 99 }]);
    assert.equal(s.request, null);
  });

  it('same request returns same reference', () => {
    const s = dispatch([{ type: ACTION.SET_REQUEST, payload: 'BIO-214' }]);
    const next = reduce(s, { type: ACTION.SET_REQUEST, payload: 'BIO-214' });
    assert.strictEqual(next, s);
  });

  it('SET_CANDIDATE stores candidate', () => {
    const s = dispatch([{ type: ACTION.SET_CANDIDATE, payload: { ids: ['CHEM-A', 'BIO-214'] } }]);
    assert.deepEqual(s.candidate, { ids: ['CHEM-A', 'BIO-214'] });
  });

  it('SET_CANDIDATE with null clears candidate', () => {
    const s = dispatch([
      { type: ACTION.SET_CANDIDATE, payload: { ids: ['X'] } },
      { type: ACTION.SET_CANDIDATE, payload: null },
    ]);
    assert.equal(s.candidate, null);
  });

  it('CLEAR_CANDIDATE removes candidate', () => {
    const s = dispatch([
      { type: ACTION.SET_CANDIDATE, payload: { ids: ['X'] } },
      { type: ACTION.CLEAR_CANDIDATE },
    ]);
    assert.equal(s.candidate, null);
  });

  it('CLEAR_CANDIDATE with no candidate returns same reference', () => {
    const s = initialState();
    const next = reduce(s, { type: ACTION.CLEAR_CANDIDATE });
    assert.strictEqual(next, s);
  });
});

// ---------------------------------------------------------------------------
// 8. Snapshot / Undo (TAKE_SNAPSHOT / RESTORE_SNAPSHOT / CLEAR_SNAPSHOT)
// ---------------------------------------------------------------------------

describe('snapshot and undo', () => {
  it('TAKE_SNAPSHOT saves draft', () => {
    const s = dispatch([{ type: ACTION.TAKE_SNAPSHOT }]);
    assert.ok(s.snapshot !== null);
    assert.deepEqual(s.snapshot.draft, [...INITIAL_DRAFT]);
  });

  it('TAKE_SNAPSHOT saves scenario', () => {
    const s = dispatch([{ type: ACTION.TAKE_SNAPSHOT }]);
    assert.equal(s.snapshot.scenario, 'main');
  });

  it('RESTORE_SNAPSHOT restores draft and clears snapshot', () => {
    const base = dispatch([{ type: ACTION.TAKE_SNAPSHOT }]);
    const restored = reduce(base, { type: ACTION.RESTORE_SNAPSHOT });
    assert.deepEqual(restored.draft, [...INITIAL_DRAFT]);
    assert.equal(restored.snapshot, null);
  });

  it('RESTORE_SNAPSHOT without snapshot returns same state', () => {
    const s = initialState();
    const next = reduce(s, { type: ACTION.RESTORE_SNAPSHOT });
    assert.strictEqual(next, s);
  });

  it('RESTORE_SNAPSHOT clears notice', () => {
    const s = dispatch([
      { type: ACTION.TAKE_SNAPSHOT },
      { type: ACTION.SET_NOTICE, payload: { kind: 'info', message: 'test' } },
    ]);
    const restored = reduce(s, { type: ACTION.RESTORE_SNAPSHOT });
    assert.equal(restored.notice, null);
  });

  it('snapshot draft is isolated from later draft changes', () => {
    const afterSnapshot = dispatch([{ type: ACTION.TAKE_SNAPSHOT }]);
    // Simulate another action that changes search (no draft mutation path tested here)
    const afterSearch = reduce(afterSnapshot, { type: ACTION.SET_SEARCH, payload: 'bio' });
    // Snapshot draft must still equal INITIAL_DRAFT
    assert.deepEqual(afterSearch.snapshot.draft, [...INITIAL_DRAFT]);
  });

  it('CLEAR_SNAPSHOT removes snapshot without restoring', () => {
    const s = dispatch([{ type: ACTION.TAKE_SNAPSHOT }]);
    const cleared = reduce(s, { type: ACTION.CLEAR_SNAPSHOT });
    assert.equal(cleared.snapshot, null);
    // draft must remain unchanged
    assert.deepEqual(cleared.draft, [...INITIAL_DRAFT]);
  });

  it('CLEAR_SNAPSHOT with no snapshot returns same reference', () => {
    const s = initialState();
    const next = reduce(s, { type: ACTION.CLEAR_SNAPSHOT });
    assert.strictEqual(next, s);
  });

  it('canUndo returns false initially', () => {
    assert.equal(canUndo(initialState()), false);
  });

  it('canUndo returns true after snapshot', () => {
    const s = dispatch([{ type: ACTION.TAKE_SNAPSHOT }]);
    assert.equal(canUndo(s), true);
  });

  it('canUndo returns false after restore', () => {
    const s = dispatch([{ type: ACTION.TAKE_SNAPSHOT }]);
    const restored = reduce(s, { type: ACTION.RESTORE_SNAPSHOT });
    assert.equal(canUndo(restored), false);
  });
});
