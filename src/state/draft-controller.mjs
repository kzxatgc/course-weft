/**
 * draft-controller.mjs
 *
 * Pure, framework-independent state/reducer for the EnrollFix planning workspace.
 * All state transitions return a new state object; the previous state is never mutated.
 *
 * Gate A decision: Plan A — dynamic candidate generation passed the fixed adversarial
 * suite. Dynamic repair is used when the domain engine is available; labelled
 * precomputed fallback is available via Plan B state when needed.
 *
 * Managed slices:
 *   scenario   — 'main' | 'noRepair'
 *   catalogue  — section records for the current scenario (copy, not shared)
 *   draft      — ordered array of selected section IDs
 *   notice     — { kind: 'info'|'error'|'success', message: string } | null
 *   request    — requested section ID awaiting repair (string | null)
 *   candidate  — validated repair candidate object | null
 *   snapshot   — pre-Apply draft/state for exact Undo | null
 *   search     — current catalogue search string
 */

import { INITIAL_DRAFT, REQUESTED_SECTION_ID, catalogForScenario } from '../domain/catalog.mjs';

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

/**
 * Build the canonical initial state.
 * Called once at startup; callers must treat the returned object as immutable.
 *
 * @returns {object} Initial controller state
 */
export function initialState() {
  return Object.freeze({
    scenario: 'main',
    catalogue: Object.freeze(catalogForScenario('main')),
    draft: Object.freeze([...INITIAL_DRAFT]),
    notice: null,
    request: null,
    candidate: null,
    snapshot: null,
    search: '',
  });
}

// ---------------------------------------------------------------------------
// Action type constants
// ---------------------------------------------------------------------------

export const ACTION = Object.freeze({
  SELECT_SCENARIO: 'SELECT_SCENARIO',
  SET_SEARCH: 'SET_SEARCH',
  SET_NOTICE: 'SET_NOTICE',
  CLEAR_NOTICE: 'CLEAR_NOTICE',
  SET_REQUEST: 'SET_REQUEST',
  SET_CANDIDATE: 'SET_CANDIDATE',
  CLEAR_CANDIDATE: 'CLEAR_CANDIDATE',
  TAKE_SNAPSHOT: 'TAKE_SNAPSHOT',
  RESTORE_SNAPSHOT: 'RESTORE_SNAPSHOT',
  CLEAR_SNAPSHOT: 'CLEAR_SNAPSHOT',
});

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Pure reducer.  Returns a new state object; never mutates the previous state.
 *
 * Unknown action types are returned unchanged (safe default).
 *
 * @param {object} state  Previous state (treat as immutable)
 * @param {{ type: string, payload?: * }} action
 * @returns {object} Next state
 */
export function reduce(state, action) {
  switch (action.type) {
    // Switch scenario and rebuild catalogue; clear transient slices
    case ACTION.SELECT_SCENARIO: {
      const scenario = action.payload === 'noRepair' ? 'noRepair' : 'main';
      if (scenario === state.scenario) return state;
      return Object.freeze({
        ...state,
        scenario,
        catalogue: Object.freeze(catalogForScenario(scenario)),
        draft: Object.freeze([...INITIAL_DRAFT]),
        notice: null,
        request: null,
        candidate: null,
        snapshot: null,
        search: '',
      });
    }

    // Update the catalogue search filter string
    case ACTION.SET_SEARCH: {
      const search = typeof action.payload === 'string' ? action.payload : '';
      if (search === state.search) return state;
      return Object.freeze({ ...state, search });
    }

    // Set an info/error/success notice
    case ACTION.SET_NOTICE: {
      const notice = action.payload
        ? Object.freeze({ ...action.payload })
        : null;
      return Object.freeze({ ...state, notice });
    }

    // Clear the current notice
    case ACTION.CLEAR_NOTICE:
      if (state.notice === null) return state;
      return Object.freeze({ ...state, notice: null });

    // Record which section the user has requested to add/repair
    case ACTION.SET_REQUEST: {
      const request = typeof action.payload === 'string' ? action.payload : null;
      if (request === state.request) return state;
      return Object.freeze({ ...state, request, candidate: null });
    }

    // Store a validated repair candidate
    case ACTION.SET_CANDIDATE: {
      const candidate = action.payload ? Object.freeze({ ...action.payload }) : null;
      return Object.freeze({ ...state, candidate });
    }

    // Clear candidate without touching anything else
    case ACTION.CLEAR_CANDIDATE:
      if (state.candidate === null) return state;
      return Object.freeze({ ...state, candidate: null });

    // Save a snapshot of the current draft + scenario for Undo
    case ACTION.TAKE_SNAPSHOT: {
      const snapshot = Object.freeze({
        draft: Object.freeze([...state.draft]),
        scenario: state.scenario,
        candidate: state.candidate ? Object.freeze({ ...state.candidate }) : null,
      });
      return Object.freeze({ ...state, snapshot });
    }

    // Restore the saved snapshot (Undo); clear candidate and notice
    case ACTION.RESTORE_SNAPSHOT: {
      if (!state.snapshot) return state;
      const { draft, scenario, candidate } = state.snapshot;
      return Object.freeze({
        ...state,
        draft: Object.freeze([...draft]),
        scenario,
        catalogue: Object.freeze(catalogForScenario(scenario)),
        candidate: candidate ? Object.freeze({ ...candidate }) : null,
        snapshot: null,
        notice: null,
      });
    }

    // Clear snapshot without restoring it
    case ACTION.CLEAR_SNAPSHOT:
      if (state.snapshot === null) return state;
      return Object.freeze({ ...state, snapshot: null });

    // Unknown action — return state unchanged (safe default)
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Selectors (pure functions over state)
// ---------------------------------------------------------------------------

/**
 * Returns catalogue items that match the current search string (case-insensitive).
 * Empty search returns the full catalogue.
 *
 * @param {object} state
 * @returns {Array<object>}
 */
export function filteredCatalogue(state) {
  const q = (state.search || '').trim().toLowerCase();
  if (!q) return state.catalogue;
  return state.catalogue.filter(
    (item) =>
      item.id.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.course.toLowerCase().includes(q) ||
      item.component.toLowerCase().includes(q),
  );
}

/**
 * Returns true when the state has a valid snapshot available for Undo.
 *
 * @param {object} state
 * @returns {boolean}
 */
export function canUndo(state) {
  return state.snapshot !== null;
}
