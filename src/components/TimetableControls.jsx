import React from 'react';
import { RotateCcw, Undo2, ShieldCheck } from 'lucide-react';
import { ACTION, canUndo } from '../state/draft-controller.mjs';
import { INITIAL_DRAFT } from '../domain/available-courses.mjs';

/**
 * TimetableControls
 *
 * Renders the Undo and Reset action bar above the timetable.
 * Shows:
 *  - Undo button when a timetable history entry is available (canUndo === true)
 *  - Reset button when the draft differs from INITIAL_DRAFT
 *  - Local-effect disclosure when any modification is active
 *
 * All state transitions are purely local; no network or registration call is made.
 *
 * @param {{
 *   state: object,
 *   dispatch: function,
 * }} props
 */
export default function TimetableControls({ state, dispatch }) {
  const canUndoRepair = canUndo(state);
  const isDraftChanged = !arraysEqual(state?.draft ?? [], INITIAL_DRAFT);
  const isApplied = state?.isApplied ?? false;

  // Only render the bar when there is something actionable to show
  if (!canUndoRepair && !isDraftChanged) return null;

  function handleUndo() {
    dispatch({ type: ACTION.UNDO_REPAIR });
  }

  function handleReset() {
    dispatch({ type: ACTION.RESET_DRAFT });
  }

  return (
    <div
      role="region"
      aria-label="Timetable actions"
      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-2 border-[var(--color-navy)] bg-[var(--color-cream)] shadow-[3px_3px_0_var(--color-navy)] font-mono"
      data-testid="timetable-controls"
    >
      {/* ── Local-effect disclosure ───────────────────────────────── */}
      <div className="flex items-center gap-2 text-[11px] text-slate-700 min-w-0">
        <ShieldCheck
          className="w-3.5 h-3.5 text-[var(--color-navy)] shrink-0"
          aria-hidden="true"
        />
        <span className="leading-tight">
          {isApplied ? (
            <>
              <strong>These changes are saved in this demo only.</strong>
              {' '}You have not enrolled at your university.
            </>
          ) : (
            <>
              <strong>Changes are local to this demo.</strong>
              {' '}No registration is submitted to any university system.
            </>
          )}
        </span>
      </div>

      {/* ── Action buttons ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Undo - only when there is a repair snapshot */}
        {canUndoRepair && (
          <button
            id="undo-repair-button"
            type="button"
            onClick={handleUndo}
            aria-label="Undo last timetable change"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-none border-2 border-[var(--color-navy)] bg-[var(--color-yellow)] text-[var(--color-navy)] hover:brightness-95 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shadow-xs"
          >
            <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
            Undo
          </button>
        )}

        {/* Reset - only when draft differs from the initial starting state */}
        {isDraftChanged && (
          <button
            id="reset-timetable-button"
            type="button"
            onClick={handleReset}
            aria-label="Reset timetable to starting selections"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-none border-2 border-[var(--color-navy)] bg-white text-[var(--color-navy)] hover:bg-slate-100 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shallow array equality (order-sensitive). */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
