/**
 * draft-controller.mjs
 *
 * Pure, framework-independent state/reducer for the Course Weft planning workspace.
 * All state transitions return a new state object; the previous state is never mutated.
 *
 * Gate A decision: Plan A - dynamic candidate generation passed the fixed adversarial
 * suite. Dynamic repair is used when the domain engine is available; labelled
 * precomputed fallback is available via Plan B state when needed.
 *
 * Managed slices:
 *   scenario         - 'main' | 'noRepair'
 *   availableCourses - section records for the current scenario (copy, not shared)
 *   draft            - ordered array of selected section IDs
 *   notice           - { kind: 'info'|'error'|'success', message: string } | null
 *   request          - requested section ID awaiting repair (string | null)
 *   candidate        - validated repair candidate object | null
 *   snapshot         - pre-Apply draft/state for exact Undo | null
 *   search           - current Available Courses search string
 */

import { INITIAL_DRAFT, REQUESTED_SECTION_ID, catalogForScenario } from '../domain/available-courses.mjs';
import { validateDraft, overlaps } from '../domain/validate.mjs';
import { enumerateRepairs, isCurrentCandidate } from '../domain/repairs.mjs';

const MAX_HISTORY_ENTRIES = 50;

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
    scenarioTransition: null,
    notice: null,
    request: null,
    candidate: null,
    snapshot: null,
    redoSnapshot: null,
    undoStack: Object.freeze([]),
    redoStack: Object.freeze([]),
    historyTransition: null,
    search: '',
    isApplied: false,
  });
}

function createHistoryEntry(state) {
  return Object.freeze({
    draft: Object.freeze([...state.draft]),
    scenario: state.scenario,
    snapshot: state.snapshot,
    candidate: state.candidate,
    request: state.request,
    isApplied: state.isApplied,
  });
}

function appendHistoryEntry(stack, state) {
  return Object.freeze([
    ...stack,
    createHistoryEntry(state),
  ].slice(-MAX_HISTORY_ENTRIES));
}

function recordDraftChange(state, draft, updates = {}) {
  return Object.freeze({
    ...state,
    draft: Object.freeze([...draft]),
    undoStack: appendHistoryEntry(state.undoStack || [], state),
    redoStack: Object.freeze([]),
    historyTransition: null,
    snapshot: null,
    redoSnapshot: null,
    candidate: null,
    request: null,
    isApplied: false,
    ...updates,
  });
}

// ---------------------------------------------------------------------------
// Action type constants
// ---------------------------------------------------------------------------

export const ACTION = Object.freeze({
  SELECT_SCENARIO: 'SELECT_SCENARIO',
  COMPLETE_SCENARIO_TRANSITION: 'COMPLETE_SCENARIO_TRANSITION',
  COMPLETE_HISTORY_TRANSITION: 'COMPLETE_HISTORY_TRANSITION',
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
  SUGGEST_REPAIR: 'SUGGEST_REPAIR',
  SHOW_SUGGESTION: 'SHOW_SUGGESTION',
  APPLY_REPAIR: 'APPLY_REPAIR',
  APPLY_SUGGESTION: 'APPLY_SUGGESTION',
  UNDO_REPAIR: 'UNDO_REPAIR',
  UNDO_SUGGESTION: 'UNDO_SUGGESTION',
  REDO_REPAIR: 'REDO_REPAIR',
  REDO_SUGGESTION: 'REDO_SUGGESTION',
  DISMISS_REPAIR: 'DISMISS_REPAIR',
  DISMISS_SUGGESTION: 'DISMISS_SUGGESTION',
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
        draft: Object.freeze([]),
        scenarioTransition: Object.freeze({
          phase: 'outgoing',
          draft: Object.freeze([...(state.scenarioTransition?.draft || state.draft)]),
          availableCourses: state.scenarioTransition?.availableCourses || state.availableCourses,
        }),
        notice: null,
        request: null,
        candidate: null,
        snapshot: null,
        redoSnapshot: null,
        undoStack: Object.freeze([]),
        redoStack: Object.freeze([]),
        historyTransition: null,
        search: '',
        isApplied: false,
      });
    }

    case ACTION.COMPLETE_SCENARIO_TRANSITION:
      if (!state.scenarioTransition) return state;
      if (state.scenarioTransition.phase === 'outgoing') {
        return Object.freeze({
          ...state,
          draft: Object.freeze([...INITIAL_DRAFT]),
          scenarioTransition: Object.freeze({
            phase: 'incoming',
            ...(state.scenarioTransition.showResetNotice ? { showResetNotice: true } : {}),
          }),
        });
      }
      return Object.freeze({ ...state, scenarioTransition: null });

    case ACTION.COMPLETE_HISTORY_TRANSITION:
      if (!state.historyTransition) return state;
      return Object.freeze({ ...state, historyTransition: null });

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
        isApplied: false,
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
            title: 'Class clash',
            message: `${item.title} (${item.id}) conflicts with ${clash.title} (${clash.id}). The class has not been added.`,
            action: 'suggest',
          }),
        });
      }

      // Whole-draft validation
      const nextDraft = [...state.draft, item.id];
      const validation = validateDraft(nextDraft, state.availableCourses);
      if (!validation.ok) {
        const hasRequiredLab = Array.isArray(item.requires) && item.requires.length > 0;
        const isLinkedLab = Boolean(item.requiredBy || item.linkedGroup);
        if (
          hasRequiredLab ||
          isLinkedLab ||
          validation.reason === 'linked-group-invalid' ||
          validation.reason === 'orphan-linked-section'
        ) {
          const parent = item.requiredBy ? state.availableCourses.find((c) => c.id === item.requiredBy) : null;
          const parentLabel = parent ? `${parent.title} (${item.requiredBy})` : 'its lecture';
          return recordDraftChange(state, nextDraft, {
            notice: Object.freeze({
              kind: 'info',
              title: 'Class added',
              message: item.requiredBy
                ? `${item.title} is now on your timetable. Please choose the linked lecture (${parentLabel}).`
                : `${item.title} is now on your timetable. Please choose a linked lab from Available Courses.`,
            }),
          });
        }

        let title = 'This class cannot be added yet';
        let message = 'It needs a linked course or another section choice. Your current timetable has not changed.';
        if (validation.reason === 'seat-not-certified-open') {
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
            action: 'suggest',
          }),
        });
      }

      return recordDraftChange(state, nextDraft, {
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
        const isLabSwapWithoutLecture =
          validation.reason === 'orphan-linked-section' &&
          fromItem.requiredBy &&
          toItem.requiredBy &&
          fromItem.requiredBy === toItem.requiredBy;
        const isUnrelatedSwapWithMissingLinkedCourse =
          (validation.reason === 'linked-group-invalid' || validation.reason === 'orphan-linked-section') &&
          !fromItem.requires &&
          !toItem.requires &&
          !fromItem.requiredBy &&
          !toItem.requiredBy;

        if (isLabSwapWithoutLecture || isUnrelatedSwapWithMissingLinkedCourse) {
          const clash = nextDraft
            .filter((id) => id !== toId)
            .map((id) => byId.get(id))
            .find((c) => c && overlaps(toItem, c));
          const hasSeat = toItem.capacity > toItem.enrolled;
          if (!clash && hasSeat) {
            return recordDraftChange(state, nextDraft, {
              notice: Object.freeze({
                kind: 'success',
                title: 'Section updated',
                message: `Switched from ${fromItem.title} (${fromId}) to ${toItem.title} (${toId}).`,
              }),
            });
          }
        }

        let title = 'This section cannot be selected';
        let message = 'Choosing this section would make your timetable incomplete or create another conflict. Your current selection has been kept.';
        if (validation.reason === 'time-conflict') {
          title = 'Class clash';
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

      return recordDraftChange(state, nextDraft, {
        notice: Object.freeze({
          kind: 'success',
          title: 'Section updated',
          message: `${toItem.title} is now set to ${toItem.sectionName ?? toId}.`,
        }),
      });
    }

    // Remove only the requested section so linked sections can remain during edits.
    case ACTION.REMOVE_SECTION: {
      const sectionId =
        typeof action.payload === 'string'
          ? action.payload
          : action.payload?.sectionId || action.payload?.id;

      if (!sectionId || !state.draft.includes(sectionId)) return state;

      const byId = new Map(state.availableCourses.map((c) => [c.id, c]));
      const item = byId.get(sectionId);
      const nextDraft = state.draft.filter((id) => id !== sectionId);

      return recordDraftChange(state, nextDraft, {
        candidate: state.candidate,
        request: state.request,
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
        draft: Object.freeze([]),
        scenarioTransition: Object.freeze({
          phase: 'outgoing',
          draft: Object.freeze([...(state.scenarioTransition?.draft || state.draft)]),
          availableCourses: state.scenarioTransition?.availableCourses || state.availableCourses,
          showResetNotice: true,
        }),
        candidate: null,
        request: null,
        snapshot: null,
        redoSnapshot: null,
        undoStack: Object.freeze([]),
        redoStack: Object.freeze([]),
        historyTransition: null,
        search: '',
        isApplied: false,
        notice: null,
      });
    }

    // Suggest repair: dynamically generate using domain engine; handle no-repair scenario
    case ACTION.SUGGEST_REPAIR:
    case ACTION.SHOW_SUGGESTION: {
      const requestedId =
        (typeof action.payload === 'string' ? action.payload : null) ||
        (action.payload && typeof action.payload === 'object' ? action.payload.requestedId : null) ||
        state.request ||
        REQUESTED_SECTION_ID;

      const candidates = enumerateRepairs(
        state.draft,
        state.availableCourses,
        requestedId,
        { firstStep: true }
      );

      if (!candidates || candidates.length === 0) {
        return Object.freeze({
          ...state,
          request: requestedId,
          candidate: null,
          isApplied: false,
          notice: Object.freeze({
            kind: 'error',
            title: 'No suitable timetable found',
            message: 'Try a different section or remove a class that conflicts with this one.',
          }),
        });
      }

      return Object.freeze({
        ...state,
        request: requestedId,
        candidate: Object.freeze({ ...candidates[0] }),
        isApplied: false,
        notice: null,
      });
    }

    // Apply repair: immediately revalidate candidate before applying; exact snapshot for undo
    case ACTION.APPLY_REPAIR:
    case ACTION.APPLY_SUGGESTION: {
      const candidate = state.candidate;
      const requestedId = state.request || REQUESTED_SECTION_ID;

      if (!candidate || !Array.isArray(candidate.ids)) {
        return Object.freeze({
          ...state,
          notice: Object.freeze({
            kind: 'error',
            title: 'No suggestion to apply',
            message: 'There is no active repair suggestion to apply.',
          }),
        });
      }

      // Revalidate immediately before Apply: ensure candidate matches current state
      if (!isCurrentCandidate(
        state.draft,
        candidate.ids,
        state.availableCourses,
        requestedId,
        { firstStep: true }
      )) {
        return Object.freeze({
          ...state,
          candidate: null,
          isApplied: false,
          notice: Object.freeze({
            kind: 'error',
            title: 'This suggestion is out of date',
            message: 'Your selected classes have changed. Try adding the course again to get an updated suggestion.',
          }),
        });
      }

      // Revalidate whole-draft against current catalog
      const finalCheck = validateDraft(candidate.ids, state.availableCourses);
      const isValidFirstStep = ['linked-group-invalid', 'orphan-linked-section'].includes(finalCheck.reason) &&
        candidate.ids.includes(requestedId) &&
        validateDraft(
          candidate.ids.filter((id) => id !== requestedId),
          state.availableCourses
        ).ok;
      if (!finalCheck.ok && !isValidFirstStep) {
        return Object.freeze({
          ...state,
          candidate: null,
          isApplied: false,
          notice: Object.freeze({
            kind: 'error',
            title: 'This timetable needs another look',
            message: 'The suggested changes are no longer valid, so nothing was applied.',
          }),
        });
      }

      // Snapshot exact current draft and scenario before applying
      const snapshot = Object.freeze({
        ...createHistoryEntry(state),
        candidate: Object.freeze({ ...candidate }),
      });
      const historyBase = Object.freeze({
        ...state,
        candidate: null,
        request: null,
        isApplied: false,
        snapshot: null,
      });
      return recordDraftChange(historyBase, candidate.ids, {
        snapshot,
        redoSnapshot: null,
        candidate: Object.freeze({ ...candidate }),
        isApplied: true,
        notice: null,
      });
    }

    // Undo repair: restore exact pre-apply draft and scenario; clear applied preview
    case ACTION.UNDO_REPAIR:
    case ACTION.UNDO_SUGGESTION: {
      const undoStack = state.undoStack || [];
      if (undoStack.length > 0) {
        const previous = undoStack[undoStack.length - 1];
        return Object.freeze({
          ...state,
          draft: Object.freeze([...previous.draft]),
          scenario: previous.scenario,
          availableCourses: Object.freeze(catalogForScenario(previous.scenario)),
          snapshot: previous.snapshot ?? null,
          candidate: previous.candidate ?? null,
          request: previous.request ?? null,
          isApplied: previous.isApplied ?? false,
          undoStack: Object.freeze(undoStack.slice(0, -1)),
          redoStack: appendHistoryEntry(state.redoStack || [], state),
          redoSnapshot: null,
          historyTransition: Object.freeze({
            direction: 'undo',
            fromDraft: Object.freeze([...state.draft]),
            toDraft: Object.freeze([...previous.draft]),
          }),
          notice: null,
        });
      }
      if (!state.snapshot) return state;
      const { draft, scenario } = state.snapshot;
      return Object.freeze({
        ...state,
        draft: Object.freeze([...draft]),
        scenario,
        availableCourses: Object.freeze(catalogForScenario(scenario)),
        candidate: null,
        snapshot: null,
        redoSnapshot: null,
        isApplied: false,
        redoStack: appendHistoryEntry(state.redoStack || [], state),
        historyTransition: Object.freeze({
          direction: 'undo',
          fromDraft: Object.freeze([...state.draft]),
          toDraft: Object.freeze([...draft]),
        }),
        notice: null,
      });
    }

    // Redo repair: reapply undone repair timetable
    case ACTION.REDO_REPAIR:
    case ACTION.REDO_SUGGESTION: {
      const redoStack = state.redoStack || [];
      if (redoStack.length > 0) {
        const next = redoStack[redoStack.length - 1];
        return Object.freeze({
          ...state,
          draft: Object.freeze([...next.draft]),
          scenario: next.scenario,
          availableCourses: Object.freeze(catalogForScenario(next.scenario)),
          snapshot: next.snapshot ?? null,
          candidate: next.candidate ?? null,
          request: next.request ?? null,
          isApplied: next.isApplied ?? false,
          undoStack: appendHistoryEntry(state.undoStack || [], state),
          redoStack: Object.freeze(redoStack.slice(0, -1)),
          redoSnapshot: null,
          historyTransition: Object.freeze({
            direction: 'redo',
            fromDraft: Object.freeze([...state.draft]),
            toDraft: Object.freeze([...next.draft]),
          }),
          notice: null,
        });
      }
      if (!state.redoSnapshot) return state;
      const { draft, scenario } = state.redoSnapshot;
      const snapshot = Object.freeze({
        draft: Object.freeze([...state.draft]),
        scenario: state.scenario,
      });
      return Object.freeze({
        ...state,
        draft: Object.freeze([...draft]),
        scenario,
        availableCourses: Object.freeze(catalogForScenario(scenario)),
        candidate: null,
        snapshot,
        redoSnapshot: null,
        isApplied: true,
        historyTransition: Object.freeze({
          direction: 'redo',
          fromDraft: Object.freeze([...state.draft]),
          toDraft: Object.freeze([...draft]),
        }),
        notice: null,
      });
    }

    // Dismiss repair: no mutation of draft
    case ACTION.DISMISS_REPAIR:
    case ACTION.DISMISS_SUGGESTION: {
      if (state.candidate === null) return state;
      return Object.freeze({
        ...state,
        candidate: null,
        isApplied: false,
        notice: Object.freeze({
          kind: 'info',
          title: 'No changes made',
          message: 'Your current timetable has been kept.',
        }),
      });
    }

    // Unknown action - return state unchanged (safe default)
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
  return Boolean(
    state &&
    ((Array.isArray(state.undoStack) && state.undoStack.length > 0) ||
      (state.snapshot !== null && state.snapshot !== undefined))
  );
}

/**
 * Returns true when the state has a valid redo snapshot available for Redo.
 *
 * @param {object} state
 * @returns {boolean}
 */
export function canRedo(state) {
  return Boolean(
    state &&
    ((Array.isArray(state.redoStack) && state.redoStack.length > 0) ||
      (state.redoSnapshot !== null && state.redoSnapshot !== undefined))
  );
}
