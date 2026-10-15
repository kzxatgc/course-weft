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
 *   scenario         — 'main' | 'noRepair'
 *   availableCourses — section records for the current scenario (copy, not shared)
 *   draft            — ordered array of selected section IDs
 *   notice           — { kind: 'info'|'error'|'success', message: string } | null
 *   request          — requested section ID awaiting repair (string | null)
 *   candidate        — validated repair candidate object | null
 *   snapshot         — pre-Apply draft/state for exact Undo | null
 *   search           — current Available Courses search string
 */

import { INITIAL_DRAFT, REQUESTED_SECTION_ID, catalogForScenario } from '../domain/available-courses.mjs';
import { validateDraft, overlaps } from '../domain/validate.mjs';

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
    availableCourses: Object.freeze(catalogForScenario('main')),
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
  ADD_SECTION: 'ADD_SECTION',
  SWITCH_SECTION: 'SWITCH_SECTION',
  REMOVE_SECTION: 'REMOVE_SECTION',
  RESET_DRAFT: 'RESET_DRAFT',
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
    // Switch scenario and rebuild Available Courses list; clear transient slices
    case ACTION.SELECT_SCENARIO: {
      const scenario = action.payload === 'noRepair' ? 'noRepair' : 'main';
      if (scenario === state.scenario) return state;
      return Object.freeze({
        ...state,
        scenario,
        availableCourses: Object.freeze(catalogForScenario(scenario)),
        draft: Object.freeze([...INITIAL_DRAFT]),
        notice: null,
        request: null,
        candidate: null,
        snapshot: null,
        search: '',
      });
    }

    // Update the Available Courses search filter string
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
        availableCourses: Object.freeze(catalogForScenario(scenario)),
        candidate: candidate ? Object.freeze({ ...candidate }) : null,
        snapshot: null,
        notice: null,
      });
    }

    // Clear snapshot without restoring it
    case ACTION.CLEAR_SNAPSHOT:
      if (state.snapshot === null) return state;
      return Object.freeze({ ...state, snapshot: null });

    // Add a section to draft after whole-draft validation and checks
    case ACTION.ADD_SECTION: {
      const sectionId =
        typeof action.payload === 'string'
          ? action.payload
          : action.payload?.sectionId || action.payload?.id;
      const dropDay =
        typeof action.payload === 'object' ? action.payload?.dropDay : undefined;

      if (!sectionId) return state;

      const item = state.availableCourses.find((c) => c.id === sectionId);
      if (!item) {
        return Object.freeze({
          ...state,
          notice: Object.freeze({
            kind: 'error',
            title: 'Section not found',
            message: `Section "${sectionId}" is not in available courses.`,
          }),
        });
      }

      if (state.draft.includes(item.id)) {
        return Object.freeze({
          ...state,
          notice: Object.freeze({
            kind: 'info',
            title: 'Already on your timetable',
            message: `${item.id} is already selected.`,
          }),
        });
      }

      // Wrong-day drop check: cannot mutate draft or hide card
      if (dropDay && dropDay !== item.day) {
        return Object.freeze({
          ...state,
          notice: Object.freeze({
            kind: 'error',
            title: 'Drop this class on the correct day',
            message: `${item.title} meets on ${item.day}. Your timetable has not changed.`,
          }),
        });
      }

      // Standalone lab refusal: cannot add lab if linked lecture is not in draft
      if (item.requiredBy && !state.draft.includes(item.requiredBy)) {
        const parent = state.availableCourses.find((c) => c.id === item.requiredBy);
        const parentLabel = parent ? `${parent.title} (${item.requiredBy})` : item.requiredBy;
        return Object.freeze({
          ...state,
          notice: Object.freeze({
            kind: 'error',
            title: 'Choose the lecture first',
            message: `This lab is linked to ${parentLabel}. Add the lecture and a lab together. Your timetable has not changed.`,
          }),
        });
      }

      // Duplicate course/component check: user already has another section of this course/component
      const byId = new Map(state.availableCourses.map((c) => [c.id, c]));
      const sameCourse = state.draft
        .map((id) => byId.get(id))
        .find((c) => c && c.course === item.course && c.component === item.component);
      if (sameCourse) {
        return Object.freeze({
          ...state,
          notice: Object.freeze({
            kind: 'error',
            title: 'Course already selected',
            message: `You have selected ${sameCourse.id} for ${item.title}. Switch to its alternate section to change meeting times.`,
          }),
        });
      }

      // Pairwise overlap check for clear clash feedback
      const overlapsWith = state.draft
        .map((id) => byId.get(id))
        .filter((existing) => existing && overlaps(item, existing));
      if (overlapsWith.length > 0) {
        const clash = overlapsWith[0];
        return Object.freeze({
          ...state,
          request: item.id,
          notice: Object.freeze({
            kind: 'error',
            title: 'This class clashes with your timetable',
            message: `${item.title} (${item.id}) conflicts with ${clash.title} (${clash.id}). The class has not been added.`,
          }),
        });
      }

      // Whole-draft validation
      const nextDraft = [...state.draft, item.id];
      const validation = validateDraft(nextDraft, state.availableCourses);
      if (!validation.ok) {
        const hasRequiredLab = Array.isArray(item.requires) && item.requires.length > 0;
        let title = 'This class cannot be added yet';
        let message = 'It needs a linked course or another section choice. Your current timetable has not changed.';
        if (hasRequiredLab || validation.reason === 'linked-group-invalid') {
          title = 'A lab section is also required';
          message = `${item.title} needs one linked lab. Choose both sections together so their times fit your timetable.`;
        } else if (validation.reason === 'seat-not-certified-open') {
          title = 'Section is full';
          message = `${item.title} (${item.id}) has no open seats.`;
        }
        return Object.freeze({
          ...state,
          request: item.id,
          notice: Object.freeze({
            kind: 'error',
            title,
            message,
          }),
        });
      }

      return Object.freeze({
        ...state,
        draft: Object.freeze(nextDraft),
        candidate: null,
        request: null,
        notice: Object.freeze({
          kind: 'success',
          title: 'Class added',
          message: `${item.title} (${item.id}) is now on your timetable.`,
        }),
      });
    }

    // Switch section: only to declared alternate after whole-draft validation
    case ACTION.SWITCH_SECTION: {
      const toId =
        typeof action.payload === 'string'
          ? action.payload
          : action.payload?.toId;
      let fromId =
        typeof action.payload === 'object' ? action.payload?.fromId : undefined;

      if (!toId) return state;

      const byId = new Map(state.availableCourses.map((c) => [c.id, c]));
      const toItem = byId.get(toId);
      if (!toItem) {
        return Object.freeze({
          ...state,
          notice: Object.freeze({
            kind: 'error',
            title: 'Section not found',
            message: `Section "${toId}" is not in available courses.`,
          }),
        });
      }

      // Infer fromId if not provided: find section in current draft with matching course/alternates
      if (!fromId) {
        const currentCourseSection = state.draft
          .map((id) => byId.get(id))
          .find(
            (c) =>
              c &&
              ((c.alternates && c.alternates.includes(toId)) ||
                (c.course === toItem.course && c.component === toItem.component))
          );
        if (currentCourseSection) {
          fromId = currentCourseSection.id;
        }
      }

      if (!fromId || !state.draft.includes(fromId)) {
        return Object.freeze({
          ...state,
          notice: Object.freeze({
            kind: 'error',
            title: 'No section to switch from',
            message: `Cannot switch to ${toId} because no matching course is currently in your schedule.`,
          }),
        });
      }

      const fromItem = byId.get(fromId);
      // Switch only to declared alternate
      if (!fromItem || !Array.isArray(fromItem.alternates) || !fromItem.alternates.includes(toId)) {
        return Object.freeze({
          ...state,
          notice: Object.freeze({
            kind: 'error',
            title: 'Not a declared alternate',
            message: `${toId} is not a declared alternate for ${fromId}. Your timetable has not changed.`,
          }),
        });
      }

      // Build prospective draft
      const nextDraft = state.draft.map((id) => (id === fromId ? toId : id));

      // Whole-draft validation
      const validation = validateDraft(nextDraft, state.availableCourses);
      if (!validation.ok) {
        let title = 'This section cannot be selected';
        let message = 'Choosing this section would make your timetable incomplete or create another conflict. Your current selection has been kept.';
        if (validation.reason === 'time-conflict') {
          title = 'This section has a timetable clash';
          const clash = nextDraft
            .filter((id) => id !== toId)
            .map((id) => byId.get(id))
            .find((c) => c && overlaps(toItem, c));
          message = clash
            ? `${toItem.title} (${toId}) overlaps with ${clash.title} (${clash.id}). Choose another section.`
            : 'It overlaps with another section on your timetable.';
        } else if (validation.reason === 'seat-not-certified-open') {
          title = 'Section is full';
          message = `${toItem.title} (${toId}) has no open seats.`;
        }
        return Object.freeze({
          ...state,
          notice: Object.freeze({
            kind: 'error',
            title,
            message,
          }),
        });
      }

      return Object.freeze({
        ...state,
        draft: Object.freeze(nextDraft),
        candidate: null,
        request: null,
        notice: Object.freeze({
          kind: 'success',
          title: 'Section changed',
          message: `${toItem.title} is now set to ${toItem.sectionName ?? toId}.`,
        }),
      });
    }

    // Remove section from draft; cleanly cleans up any linked lab or parent
    case ACTION.REMOVE_SECTION: {
      const sectionId =
        typeof action.payload === 'string'
          ? action.payload
          : action.payload?.sectionId || action.payload?.id;

      if (!sectionId || !state.draft.includes(sectionId)) return state;

      const byId = new Map(state.availableCourses.map((c) => [c.id, c]));
      const item = byId.get(sectionId);
      const idsToRemove = new Set([sectionId]);

      if (item?.requiredBy) {
        idsToRemove.add(item.requiredBy);
      }
      for (const draftId of state.draft) {
        const sec = byId.get(draftId);
        if (sec?.requiredBy === sectionId) {
          idsToRemove.add(draftId);
        }
      }

      const nextDraft = state.draft.filter((id) => !idsToRemove.has(id));

      return Object.freeze({
        ...state,
        draft: Object.freeze(nextDraft),
        candidate: null,
        request: null,
        notice: Object.freeze({
          kind: 'success',
          title: 'Class removed',
          message: item
            ? `${item.title} has been removed from your timetable.`
            : `Section ${sectionId} removed from your timetable.`,
        }),
      });
    }

    // Reset draft to INITIAL_DRAFT and clear transient state
    case ACTION.RESET_DRAFT: {
      return Object.freeze({
        ...state,
        draft: Object.freeze([...INITIAL_DRAFT]),
        candidate: null,
        request: null,
        snapshot: null,
        search: '',
        notice: Object.freeze({
          kind: 'info',
          title: 'Timetable reset',
          message: 'Timetable reset to the starting selections.',
        }),
      });
    }

    // Unknown action — return state unchanged (safe default)
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Selectors (pure functions over state)
// ---------------------------------------------------------------------------

/**
 * Returns Available Courses items that match the current search string (case-insensitive).
 * Empty search returns the full list.
 *
 * @param {object} state
 * @returns {Array<object>}
 */
export function filteredAvailableCourses(state) {
  const q = (state.search || '').trim().toLowerCase();
  if (!q) return state.availableCourses;
  return state.availableCourses.filter(
    (item) =>
      item.id.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.course.toLowerCase().includes(q) ||
      item.component.toLowerCase().includes(q) ||
      (item.sectionName && item.sectionName.toLowerCase().includes(q)),
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
