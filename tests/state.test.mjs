/**
 * tests/state.test.mjs
 *
 * Unit tests for src/state/draft-controller.mjs.
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
import { buildFixedPreview } from '../src/domain/drop-preview.mjs';
import { enumerateRepairs } from '../src/domain/repairs.mjs';

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

  it('clears the timetable and preserves its selected sections for the return animation', () => {
    const s = dispatch([{ type: ACTION.SELECT_SCENARIO, payload: 'noRepair' }]);
    assert.deepEqual(s.draft, []);
    assert.equal(s.scenarioTransition?.phase, 'outgoing');
    assert.deepEqual(s.scenarioTransition?.draft, [...INITIAL_DRAFT]);
    assert.equal(s.scenarioTransition?.availableCourses.length, s.availableCourses.length);
  });

  it('restores the new scenario default timetable after old sections return to the tray', () => {
    const switching = reduce(initialState(), { type: ACTION.SELECT_SCENARIO, payload: 'noRepair' });
    const incoming = reduce(switching, { type: ACTION.COMPLETE_SCENARIO_TRANSITION });

    assert.deepEqual(incoming.draft, [...INITIAL_DRAFT]);
    assert.equal(incoming.scenarioTransition?.phase, 'incoming');

    const completed = reduce(incoming, { type: ACTION.COMPLETE_SCENARIO_TRANSITION });
    assert.equal(completed.scenarioTransition, null);
    assert.deepEqual(completed.draft, [...INITIAL_DRAFT]);
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
    assert.equal(s.availableCourses.find((c) => c.id === 'MATH-B').seat, 'full');
    assert.equal(s.availableCourses.find((c) => c.id === 'STAT-B').seat, 'open');
    const bio = s.availableCourses.find((c) => c.id === 'BIO-214');
    assert.equal(bio.enrolled, 42);
    assert.equal(bio.capacity, 60);
    assert.equal(bio.seat, 'open');
  });

  it('noRepair offers and applies the STAT-A to STAT-B first step for BIO-214', () => {
    const selected = dispatch([{ type: ACTION.SELECT_SCENARIO, payload: 'noRepair' }]);
    const ready = reduce(selected, { type: ACTION.COMPLETE_SCENARIO_TRANSITION });
    const withStartingCourses = reduce(
      reduce(ready, { type: ACTION.ADD_SECTION, payload: 'MATH-A' }),
      { type: ACTION.ADD_SECTION, payload: 'STAT-A' }
    );
    const suggested = reduce(withStartingCourses, { type: ACTION.SUGGEST_REPAIR, payload: 'BIO-214' });
    assert.deepEqual(suggested.candidate?.swap, { old: 'STAT-A', replacement: 'STAT-B' });
    assert.equal(suggested.candidate?.validation.stagedLinkedRequirement, true);

    const applied = reduce(suggested, { type: ACTION.APPLY_REPAIR });
    assert.deepEqual(applied.draft, ['BIO-214', 'MATH-A', 'STAT-B']);
    assert.equal(applied.notice, null, 'success notice waits until the timetable transition finishes');
  });

  it('main suggests and applies moving MATH-A to MATH-B to place Lab A', () => {
    const base = initialState();
    const suggested = reduce(base, { type: ACTION.SUGGEST_REPAIR, payload: 'BIO-214L-A' });

    assert.deepEqual(suggested.candidate?.swap, { old: 'MATH-A', replacement: 'MATH-B' });
    assert.ok(suggested.candidate?.ids.includes('BIO-214L-A'));

    const applied = reduce(suggested, { type: ACTION.APPLY_REPAIR });
    assert.deepEqual(applied.draft, suggested.candidate.ids);
    assert.equal(applied.notice, null, 'success notice waits until the timetable transition finishes');
  });

  it('noRepair linked lab preview has a conflict alert and no repair candidates', () => {
    const selected = dispatch([{ type: ACTION.SELECT_SCENARIO, payload: 'noRepair' }]);
    const ready = reduce(selected, { type: ACTION.COMPLETE_SCENARIO_TRANSITION });
    const withStartingCourses = reduce(
      reduce(ready, { type: ACTION.ADD_SECTION, payload: 'MATH-A' }),
      { type: ACTION.ADD_SECTION, payload: 'STAT-A' }
    );
    const suggested = reduce(withStartingCourses, { type: ACTION.SUGGEST_REPAIR, payload: 'BIO-214' });
    const applied = reduce(suggested, { type: ACTION.APPLY_REPAIR });
    const labA = applied.availableCourses.find((item) => item.id === 'BIO-214L-A');
    const selectedSections = applied.availableCourses.filter((item) => applied.draft.includes(item.id));

    assert.ok(applied.draft.includes(labA.requiredBy));
    assert.equal(buildFixedPreview(labA, selectedSections).hasConflict, true);
    assert.deepEqual(enumerateRepairs(applied.draft, applied.availableCourses, labA.id, { firstStep: true }), []);
    assert.equal(applied.availableCourses.find((item) => item.id === 'BIO-214L-B').seat, 'full');
  });

  it('main scenario offers and applies the Lab B then MATH-A two-swap repair', () => {
    const base = initialState();
    const prepared = {
      ...base,
      draft: Object.freeze(['BIO-214', 'BIO-214L-A', 'MATH-B', 'STAT-B']),
    };
    const suggested = reduce(prepared, { type: ACTION.SUGGEST_REPAIR, payload: 'MATH-A' });
    assert.deepEqual(
      suggested.candidate?.swaps.map(({ old, replacement }) => [old, replacement]),
      [
        ['BIO-214L-A', 'BIO-214L-B'],
        ['MATH-B', 'MATH-A'],
      ]
    );

    const applied = reduce(suggested, { type: ACTION.APPLY_REPAIR });
    assert.deepEqual(applied.draft, ['BIO-214', 'BIO-214L-B', 'MATH-A', 'STAT-B']);
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
      { type: ACTION.SET_CANDIDATE, payload: { ids: ['MATH-A'] } },
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
    const s = dispatch([{ type: ACTION.SET_CANDIDATE, payload: { ids: ['MATH-A', 'BIO-214'] } }]);
    assert.deepEqual(s.candidate, { ids: ['MATH-A', 'BIO-214'] });
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

// ---------------------------------------------------------------------------
// 9. ADD_SECTION
// ---------------------------------------------------------------------------

describe('ADD_SECTION', () => {
  it('adds a valid section to draft after removal of other', () => {
    // Start with MATH-A and STAT-A. Remove STAT-A, then add STAT-B.
    const s1 = reduce(initialState(), { type: ACTION.REMOVE_SECTION, payload: 'STAT-A' });
    const s2 = reduce(s1, { type: ACTION.ADD_SECTION, payload: 'STAT-B' });
    assert.deepEqual(s2.draft, ['MATH-A', 'STAT-B']);
    assert.equal(s2.notice.kind, 'success');
  });

  it('rejects adding an already-selected section without mutating draft', () => {
    const s = initialState();
    const next = reduce(s, { type: ACTION.ADD_SECTION, payload: 'MATH-A' });
    assert.deepEqual(next.draft, s.draft);
    assert.equal(next.notice.kind, 'info');
    assert.match(next.notice.message, /already selected/i);
  });

  it('rejects adding an unknown section ID without mutating draft', () => {
    const s = initialState();
    const next = reduce(s, { type: ACTION.ADD_SECTION, payload: 'NONEXISTENT-999' });
    assert.deepEqual(next.draft, s.draft);
    assert.equal(next.notice.kind, 'error');
  });

  it('rejects adding to wrong day without mutating draft', () => {
    const s = initialState();
    // MATH-B meets on Thu; try dropping it on Mon
    const next = reduce(s, {
      type: ACTION.ADD_SECTION,
      payload: { sectionId: 'MATH-B', dropDay: 'Mon' },
    });
    assert.deepEqual(next.draft, s.draft);
    assert.equal(next.notice.kind, 'error');
    assert.match(next.notice.message, /meets on Thu/i);
  });

  it('adds standalone lab to draft with a simple class-added notice', () => {
    const s = initialState();
    // Use BIO-214L-B (Wed 840-960) which does not conflict with MATH-A (Tue) or STAT-A (Mon)
    const next = reduce(s, { type: ACTION.ADD_SECTION, payload: 'BIO-214L-B' });
    assert.deepEqual(next.draft, [...s.draft, 'BIO-214L-B']);
    assert.equal(next.notice.kind, 'info');
    assert.equal(next.notice.title, 'Class added');
  });

  it('rejects duplicate course and suggests switch without mutating draft', () => {
    const s = initialState();
    // STAT-A is already in draft; try adding STAT-B via ADD_SECTION
    const next = reduce(s, { type: ACTION.ADD_SECTION, payload: 'STAT-B' });
    assert.deepEqual(next.draft, s.draft);
    assert.equal(next.notice.kind, 'error');
    assert.match(next.notice.message, /switch to its alternate/i);
  });

  it('rejects time conflict without mutating draft and records request', () => {
    const s = initialState();
    // BIO-214 meets Mon 780-840, clashing with STAT-A (Mon 780-840)
    const next = reduce(s, { type: ACTION.ADD_SECTION, payload: 'BIO-214' });
    assert.deepEqual(next.draft, s.draft);
    assert.equal(next.request, 'BIO-214');
    assert.equal(next.notice.kind, 'error');
    assert.equal(next.notice.title, 'Class clash');
    assert.equal(next.notice.action, undefined, 'a dropped class clash is a temporary notice, not a repair dialog');
  });

  it('adds BIO-214 to draft when no clash and prompts for linked lab', () => {
    // Draft without clash: remove STAT-A so BIO-214 has no time overlap
    const s1 = reduce(initialState(), { type: ACTION.REMOVE_SECTION, payload: 'STAT-A' });
    // Adding BIO-214 places it on the draft so the linked lab outline can guide the user
    const s2 = reduce(s1, { type: ACTION.ADD_SECTION, payload: 'BIO-214' });
    assert.deepEqual(s2.draft, ['MATH-A', 'BIO-214']);
    assert.equal(s2.request, null);
    assert.equal(s2.notice.kind, 'info');
    assert.match(nextNoticeTitleOrMessage(s2), /lab/i);
  });
});

function nextNoticeTitleOrMessage(state) {
  return `${state.notice?.title || ''} ${state.notice?.message || ''}`;
}

// ---------------------------------------------------------------------------
// 10. SWITCH_SECTION
// ---------------------------------------------------------------------------

describe('SWITCH_SECTION', () => {
  it('switches to declared alternate after whole-draft validation', () => {
    const s = initialState();
    // STAT-A has declared alternate STAT-B; switching produces valid draft ['MATH-A', 'STAT-B']
    const next = reduce(s, {
      type: ACTION.SWITCH_SECTION,
      payload: { fromId: 'STAT-A', toId: 'STAT-B' },
    });
    assert.deepEqual(next.draft, ['MATH-A', 'STAT-B']);
    assert.equal(next.notice.kind, 'success');
  });

  it('infers fromId when only toId is provided if alternate is declared', () => {
    const s = initialState();
    const next = reduce(s, {
      type: ACTION.SWITCH_SECTION,
      payload: 'STAT-B',
    });
    assert.deepEqual(next.draft, ['MATH-A', 'STAT-B']);
    assert.equal(next.notice.kind, 'success');
  });

  it('refuses switch to a non-declared alternate without mutating draft', () => {
    const s = initialState();
    // STAT-A declared alternate is STAT-B, NOT MATH-B
    const next = reduce(s, {
      type: ACTION.SWITCH_SECTION,
      payload: { fromId: 'STAT-A', toId: 'MATH-B' },
    });
    assert.deepEqual(next.draft, s.draft);
    assert.equal(next.notice.kind, 'error');
    assert.match(next.notice.title, /not a declared alternate/i);
  });

  it('refuses switch if course is not currently in draft', () => {
    const s = initialState();
    const next = reduce(s, {
      type: ACTION.SWITCH_SECTION,
      payload: { fromId: 'BIO-214', toId: 'BIO-214' },
    });
    assert.deepEqual(next.draft, s.draft);
    assert.equal(next.notice.kind, 'error');
  });

  it('refuses switch if toId section is not in available courses', () => {
    const s = initialState();
    const next = reduce(s, {
      type: ACTION.SWITCH_SECTION,
      payload: { fromId: 'STAT-A', toId: 'NONEXISTENT' },
    });
    assert.deepEqual(next.draft, s.draft);
    assert.equal(next.notice.kind, 'error');
  });
});

// ---------------------------------------------------------------------------
// 11. REMOVE_SECTION
// ---------------------------------------------------------------------------

describe('REMOVE_SECTION', () => {
  it('removes section from draft', () => {
    const s = initialState();
    const next = reduce(s, { type: ACTION.REMOVE_SECTION, payload: 'STAT-A' });
    assert.deepEqual(next.draft, ['MATH-A']);
    assert.equal(next.notice.kind, 'success');
  });

  it('removing non-draft section returns state unchanged', () => {
    const s = initialState();
    const next = reduce(s, { type: ACTION.REMOVE_SECTION, payload: 'BIO-214' });
    assert.strictEqual(next, s);
  });

  it('keeps linked lab on timetable when lecture is removed and added back', () => {
    const s = {
      ...initialState(),
      draft: Object.freeze(['STAT-B', 'BIO-214', 'BIO-214L-A']),
    };
    const withoutLecture = reduce(s, { type: ACTION.REMOVE_SECTION, payload: 'BIO-214' });
    assert.deepEqual(withoutLecture.draft, ['STAT-B', 'BIO-214L-A']);

    const lectureAddedBack = reduce(withoutLecture, { type: ACTION.ADD_SECTION, payload: 'BIO-214' });
    assert.deepEqual(lectureAddedBack.draft, ['STAT-B', 'BIO-214L-A', 'BIO-214']);
    assert.equal(lectureAddedBack.notice.kind, 'success');
  });

  it('removing child lab keeps parent lecture in draft to restore link outlines', () => {
    const s = {
      ...initialState(),
      draft: Object.freeze(['MATH-A', 'BIO-214', 'BIO-214L-A']),
    };
    const next = reduce(s, { type: ACTION.REMOVE_SECTION, payload: 'BIO-214L-A' });
    assert.deepEqual(next.draft, ['MATH-A', 'BIO-214']);
  });
});

// ---------------------------------------------------------------------------
// 12. RESET_DRAFT
// ---------------------------------------------------------------------------

describe('RESET_DRAFT', () => {
  it('restores draft to INITIAL_DRAFT and clears transient state', () => {
    // Perform mutations: switch to STAT-B, set search, set candidate
    const mutated = dispatch([
      { type: ACTION.SWITCH_SECTION, payload: 'STAT-B' },
      { type: ACTION.SET_SEARCH, payload: 'bio' },
      { type: ACTION.SET_CANDIDATE, payload: { ids: ['test'] } },
    ]);
    assert.deepEqual(mutated.draft, ['MATH-A', 'STAT-B']);
    assert.equal(mutated.search, 'bio');

    const reset = reduce(mutated, { type: ACTION.RESET_DRAFT });
    assert.deepEqual(reset.draft, []);
    assert.equal(reset.scenarioTransition.phase, 'outgoing');
    assert.deepEqual(reset.scenarioTransition.draft, ['MATH-A', 'STAT-B']);
    assert.equal(reset.candidate, null);
    assert.equal(reset.request, null);
    assert.equal(reset.snapshot, null);
    assert.equal(reset.search, '');
    assert.equal(reset.notice, null);

    const incoming = reduce(reset, { type: ACTION.COMPLETE_SCENARIO_TRANSITION });
    assert.deepEqual(incoming.draft, [...INITIAL_DRAFT]);
    assert.equal(incoming.scenarioTransition.phase, 'incoming');
    const completed = reduce(incoming, { type: ACTION.COMPLETE_SCENARIO_TRANSITION });
    assert.deepEqual(completed.draft, [...INITIAL_DRAFT]);
    assert.equal(completed.scenarioTransition, null);
  });
});

// ---------------------------------------------------------------------------
// 13. Case-insensitive search and card preservation on failure
// ---------------------------------------------------------------------------

describe('case-insensitive search and card preservation on refusal', () => {
  it('case-insensitive search matches uppercase, lowercase, and mixed case', () => {
    const sLower = reduce(initialState(), { type: ACTION.SET_SEARCH, payload: 'math' });
    const sUpper = reduce(initialState(), { type: ACTION.SET_SEARCH, payload: 'MATH' });
    const sMixed = reduce(initialState(), { type: ACTION.SET_SEARCH, payload: 'MaTh' });

    const lowerIds = filteredAvailableCourses(sLower).map((c) => c.id);
    const upperIds = filteredAvailableCourses(sUpper).map((c) => c.id);
    const mixedIds = filteredAvailableCourses(sMixed).map((c) => c.id);

    assert.deepEqual(lowerIds, ['MATH-A', 'MATH-B']);
    assert.deepEqual(upperIds, ['MATH-A', 'MATH-B']);
    assert.deepEqual(mixedIds, ['MATH-A', 'MATH-B']);
  });

  it('matches sectionName in search filter', () => {
    const s = reduce(initialState(), { type: ACTION.SET_SEARCH, payload: 'Section B' });
    const ids = filteredAvailableCourses(s).map((c) => c.id);
    assert.ok(ids.includes('MATH-B'));
    assert.ok(ids.includes('STAT-B'));
  });

  it('conflict/wrong-day/missing-lab rejection never hides cards from available courses', () => {
    const initialAvailableCount = filteredAvailableCourses(initialState()).length;

    // 1. Conflict rejection
    const afterConflict = reduce(initialState(), { type: ACTION.ADD_SECTION, payload: 'BIO-214' });
    assert.equal(filteredAvailableCourses(afterConflict).length, initialAvailableCount);
    assert.ok(filteredAvailableCourses(afterConflict).some((c) => c.id === 'BIO-214'));

    // 2. Wrong-day rejection
    const afterWrongDay = reduce(initialState(), {
      type: ACTION.ADD_SECTION,
      payload: { sectionId: 'MATH-B', dropDay: 'Mon' },
    });
    assert.equal(filteredAvailableCourses(afterWrongDay).length, initialAvailableCount);
    assert.ok(filteredAvailableCourses(afterWrongDay).some((c) => c.id === 'MATH-B'));

    // 3. Standalone lab rejection
    const afterStandaloneLab = reduce(initialState(), {
      type: ACTION.ADD_SECTION,
      payload: 'BIO-214L-A',
    });
    assert.equal(filteredAvailableCourses(afterStandaloneLab).length, initialAvailableCount);
    assert.ok(filteredAvailableCourses(afterStandaloneLab).some((c) => c.id === 'BIO-214L-A'));
  });
});

// ---------------------------------------------------------------------------
// 14. Suggestion, Apply, Exact Undo, Dismiss
// ---------------------------------------------------------------------------

describe('suggestion, apply, exact undo, dismiss', () => {
  it('main flow: suggest finds first repair step, apply updates draft and snapshots, undo restores exact pre-apply state', () => {
    const s0 = initialState();
    assert.deepEqual(s0.draft, ['MATH-A', 'STAT-A']);

    // 1. Suggest repair for BIO-214
    const s1 = reduce(s0, { type: ACTION.SUGGEST_REPAIR, payload: 'BIO-214' });
    assert.ok(s1.candidate !== null, 'candidate was generated');
    assert.deepEqual(s1.candidate.ids, ['BIO-214', 'MATH-A', 'STAT-B']);
    assert.deepEqual(s1.candidate.swap, { old: 'STAT-A', replacement: 'STAT-B' });
    assert.equal(s1.notice.kind, 'info');
    assert.equal(s1.isApplied, false);
    // Suggestion does NOT mutate draft
    assert.deepEqual(s1.draft, ['MATH-A', 'STAT-A']);

    // 2. Apply repair
    const s2 = reduce(s1, { type: ACTION.APPLY_REPAIR });
    assert.deepEqual(s2.draft, ['BIO-214', 'MATH-A', 'STAT-B']);
    assert.equal(s2.isApplied, true);
    assert.ok(s2.snapshot !== null, 'snapshot created');
    assert.deepEqual(s2.snapshot.draft, ['MATH-A', 'STAT-A']);
    assert.equal(s2.notice, null, 'success notice waits until the timetable transition finishes');

    // 3. Exact Undo
    const s3 = reduce(s2, { type: ACTION.UNDO_REPAIR });
    assert.deepEqual(s3.draft, ['MATH-A', 'STAT-A']);
    assert.equal(s3.candidate, null, 'applied preview cleared');
    assert.equal(s3.snapshot, null);
    assert.equal(s3.isApplied, false);
    assert.equal(s3.notice, null);
  });

  it('stale Apply is rejected and does not mutate draft', () => {
    const s0 = initialState();
    // Suggest repair based on initial draft ['MATH-A', 'STAT-A']
    const s1 = reduce(s0, { type: ACTION.SUGGEST_REPAIR, payload: 'BIO-214' });
    assert.ok(s1.candidate !== null);

    // Before Apply, mutate draft by removing MATH-A
    const s2 = reduce(s1, { type: ACTION.REMOVE_SECTION, payload: 'MATH-A' });
    assert.deepEqual(s2.draft, ['STAT-A']);

    // Now attempt Apply with the stale candidate (which assumed MATH-A was present)
    const s3 = reduce(s2, { type: ACTION.APPLY_REPAIR });
    // Must refuse to mutate draft!
    assert.deepEqual(s3.draft, ['STAT-A']);
    assert.equal(s3.candidate, null);
    assert.equal(s3.notice.kind, 'error');
    assert.match(s3.notice.title, /out of date/i);
  });

  it('rejected Apply on invalid data leaves draft untouched', () => {
    const s0 = initialState();
    // Attempt Apply without candidate
    const noCand = reduce(s0, { type: ACTION.APPLY_REPAIR });
    assert.deepEqual(noCand.draft, s0.draft);
    assert.equal(noCand.notice.kind, 'error');

    // Attempt Apply with an invalid candidate (e.g. unknown section or clashing IDs)
    const sWithInvalid = {
      ...s0,
      candidate: Object.freeze({ ids: ['MATH-A', 'NONEXISTENT-999'] }),
    };
    const afterInvalid = reduce(sWithInvalid, { type: ACTION.APPLY_REPAIR });
    assert.deepEqual(afterInvalid.draft, s0.draft);
    assert.equal(afterInvalid.candidate, null);
    assert.equal(afterInvalid.notice.kind, 'error');
  });

  it('repeat Apply and Undo sequence operates cleanly', () => {
    let s = initialState();

    for (let i = 0; i < 3; i += 1) {
      s = reduce(s, { type: ACTION.SUGGEST_REPAIR, payload: 'BIO-214' });
      assert.ok(s.candidate !== null);

      s = reduce(s, { type: ACTION.APPLY_REPAIR });
      assert.deepEqual(s.draft, ['BIO-214', 'MATH-A', 'STAT-B']);

      s = reduce(s, { type: ACTION.UNDO_REPAIR });
      assert.deepEqual(s.draft, ['MATH-A', 'STAT-A']);
      assert.equal(s.candidate, null);
      assert.equal(s.snapshot, null);
    }
  });

  it('Undo restores exact pre-Apply selected sections and preserves a prior STAT-B switch', () => {
    // 1. Prior switch: student switched STAT-A to STAT-B
    const s0 = initialState();
    const sSwitched = reduce(s0, {
      type: ACTION.SWITCH_SECTION,
      payload: { fromId: 'STAT-A', toId: 'STAT-B' },
    });
    assert.deepEqual(sSwitched.draft, ['MATH-A', 'STAT-B']);

    // 2. Student requests repair for BIO-214
    const sSuggested = reduce(sSwitched, { type: ACTION.SUGGEST_REPAIR, payload: 'BIO-214' });
    assert.ok(sSuggested.candidate !== null);

    // 3. Apply repair
    const sApplied = reduce(sSuggested, { type: ACTION.APPLY_REPAIR });
    assert.ok(sApplied.draft.includes('BIO-214'));
    assert.ok(sApplied.draft.includes('STAT-B'));

    // 4. Undo repair
    const sUndone = reduce(sApplied, { type: ACTION.UNDO_REPAIR });
    // Prior STAT-B switch MUST be completely preserved!
    assert.deepEqual(sUndone.draft, ['MATH-A', 'STAT-B']);
    assert.equal(sUndone.candidate, null);
    assert.equal(sUndone.snapshot, null);
  });

  it('dismiss repair has no draft mutation and clears candidate', () => {
    const s0 = initialState();
    const s1 = reduce(s0, { type: ACTION.SUGGEST_REPAIR, payload: 'BIO-214' });
    assert.ok(s1.candidate !== null);

    const sDismissed = reduce(s1, { type: ACTION.DISMISS_REPAIR });
    assert.deepEqual(sDismissed.draft, ['MATH-A', 'STAT-A']);
    assert.equal(sDismissed.candidate, null);
    assert.equal(sDismissed.notice.kind, 'info');
    assert.match(sDismissed.notice.title, /no changes made/i);
  });

  it('suggest in noRepair scenario offers the valid next step despite the unavailable lab', () => {
    const switched = reduce(initialState(), { type: ACTION.SELECT_SCENARIO, payload: 'noRepair' });
    const noRepair = reduce(switched, { type: ACTION.COMPLETE_SCENARIO_TRANSITION });
    const withStartingCourses = reduce(
      reduce(noRepair, { type: ACTION.ADD_SECTION, payload: 'MATH-A' }),
      { type: ACTION.ADD_SECTION, payload: 'STAT-A' }
    );
    const sSuggested = reduce(withStartingCourses, {
      type: ACTION.SUGGEST_REPAIR,
      payload: 'BIO-214',
    });
    assert.deepEqual(sSuggested.candidate?.swap, { old: 'STAT-A', replacement: 'STAT-B' });
    assert.equal(sSuggested.candidate?.validation.stagedLinkedRequirement, true);
    assert.equal(sSuggested.notice.kind, 'info');
    assert.match(sSuggested.notice.title, /suggested timetable ready/i);
    assert.deepEqual(sSuggested.draft, ['MATH-A', 'STAT-A']);
  });
});
