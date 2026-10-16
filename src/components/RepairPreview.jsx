import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  Users,
  Wrench,
} from 'lucide-react';
import { ACTION } from '../state/draft-controller.mjs';
import { formatCourseSlot } from '../domain/time.mjs';

/**
 * RepairPreview — Task 27
 *
 * Renders the Add / Swap / Keep impact preview panel when a validated
 * repair candidate is available in state (state.candidate !== null).
 *
 * @param {{
 *   state: object,
 *   dispatch: function,
 *   onClose?: function
 * }} props
 */
export default function RepairPreview({ state, dispatch, onClose }) {
  const candidate = state?.candidate || state?.snapshot?.candidate;
  const isApplied = state?.isApplied;
  const availableCourses = state?.availableCourses || [];
  const draft = state?.snapshot?.draft || state?.draft || [];
  const scenario = state?.scenario || 'main';

  const headingRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  // Bring heading into view when preview opens
  useEffect(() => {
    if (candidate && !isApplied && headingRef.current) {
      headingRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [candidate, isApplied]);

  // If no candidate is active and no snapshot candidate, render a clean status note
  if (!candidate) {
    return (
      <div className="p-8 text-center space-y-3 font-mono bg-[#fffdf8]">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 border-2 border-slate-300 text-slate-500 mx-auto">
          <Wrench className="w-6 h-6" aria-hidden="true" />
        </div>
        <h3 className="font-['Archivo_Black',sans-serif] text-sm uppercase text-[var(--color-navy)] m-0">
          No Active Repair Candidate
        </h3>
        <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
          When a course clashes with your timetable, select <strong>"Find valid repair"</strong> in the conflict alert dialog to generate and preview a resolution here.
        </p>
      </div>
    );
  }

  // Fast lookup map for course metadata
  const byId = new Map(availableCourses.map((c) => [c.id, c]));

  // Deriving explicit groups:
  // SWAP: old -> replacement
  const swap = candidate.swap;
  const oldSection = swap?.old ? byId.get(swap.old) : null;
  const replacementSection = swap?.replacement ? byId.get(swap.replacement) : null;

  // ADD: newly added sections (excluding replacement which is shown in SWAP)
  const candidateAdded = candidate.added || candidate.ids.filter((id) => !draft.includes(id));
  const addIds = candidateAdded.filter(
    (id) => !swap || id !== swap.replacement
  );
  const addSections = addIds.map((id) => byId.get(id)).filter(Boolean);

  // KEEP: retained draft sections (excluding swapped-out section)
  const candidateKept = candidate.kept || draft.filter((id) => !swap || id !== swap.old);
  const keepSections = candidateKept.map((id) => byId.get(id)).filter(Boolean);

  // Validation details
  const isPlanA = scenario === 'main';
  const hasLinkedLab = candidate.ids.some((id) => id.includes('L-') || id.includes('LAB'));
  const linkedLabSection = candidate.ids.find((id) => id.includes('L-') || id.includes('LAB'));

  const motionTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: 'easeOut' };

  return (
    <AnimatePresence>
      <motion.section
        key="repair-preview-panel"
        aria-labelledby="repair-preview-heading"
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={motionTransition}
        className="nb-repair-preview my-3 rounded-lg border-[2.5px] border-[var(--color-navy)] bg-[#fffdf8] shadow-[4px_4px_0px_0px_var(--color-navy)] overflow-hidden font-mono"
      >
        {/* ── Panel Header Bar ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[var(--color-yellow)] border-b-2 border-[var(--color-navy)]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--color-navy)] shrink-0" aria-hidden="true" />
            <h2
              ref={headingRef}
              id="repair-preview-heading"
              tabIndex={-1}
              className="font-['Archivo_Black',sans-serif] text-xs sm:text-sm font-black uppercase text-[var(--color-navy)] tracking-wide outline-none m-0"
            >
              Repair Preview · Impact Summary
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {isPlanA ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase rounded border border-emerald-700 bg-emerald-100 text-emerald-900 tracking-wider">
                <Check className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                Plan A · Dynamic Output
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase rounded border border-amber-700 bg-amber-100 text-amber-900 tracking-wider">
                <AlertCircle className="w-3 h-3 text-amber-700" aria-hidden="true" />
                Plan B · Precomputed Example
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                dispatch({ type: ACTION.DISMISS_REPAIR });
                onClose?.();
              }}
              aria-label="Dismiss repair preview"
              className="p-1 rounded text-[var(--color-navy)]/70 hover:text-[var(--color-navy)] hover:bg-[var(--color-navy)]/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ── Core Impact Groups: ADD / SWAP / KEEP ──────────────── */}
        <div className="p-3 sm:p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* ── 1. ADD Group ─────────────────────────────────────── */}
            <div className="flex flex-col rounded border-2 border-emerald-600 bg-emerald-50/40 p-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-600/30 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                    +
                  </span>
                  <span className="font-['Archivo_Black',sans-serif] text-xs uppercase text-emerald-950 font-bold tracking-wider">
                    Add ({addSections.length})
                  </span>
                </div>
                <span className="text-[9px] font-bold text-emerald-800 uppercase">New Sections</span>
              </div>

              <div className="space-y-2 flex-1">
                {addSections.length > 0 ? (
                  addSections.map((sec) => (
                    <div
                      key={sec.id}
                      className="bg-white rounded border border-emerald-500/50 p-2 shadow-xs text-xs"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <strong className="font-['Archivo_Black',sans-serif] text-emerald-950">
                          {sec.id}
                        </strong>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-bold uppercase">
                          {sec.component || 'course'}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-800 truncate mt-0.5">
                        {sec.title}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600 font-mono">
                        <span>{formatCourseSlot(sec)}</span>
                        <span className="flex items-center gap-0.5 text-slate-500">
                          <Users className="w-3 h-3" aria-hidden="true" />
                          {sec.enrolled}/{sec.capacity}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-emerald-800/80 italic p-2 text-center">
                    No direct additions
                  </div>
                )}
              </div>
            </div>

            {/* ── 2. SWAP Group ────────────────────────────────────── */}
            <div className="flex flex-col rounded border-2 border-amber-600 bg-amber-50/40 p-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-amber-600/30 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-black">
                    ⇄
                  </span>
                  <span className="font-['Archivo_Black',sans-serif] text-xs uppercase text-amber-950 font-bold tracking-wider">
                    Swap ({swap ? 1 : 0})
                  </span>
                </div>
                <span className="text-[9px] font-bold text-amber-800 uppercase">Resolves Clash</span>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                {swap && oldSection && replacementSection ? (
                  <div className="bg-white rounded border border-amber-500/50 p-2 shadow-xs text-xs space-y-2">
                    {/* Old Section (Replaced) */}
                    <div className="border-l-2 border-rose-500 pl-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase text-rose-700 bg-rose-50 px-1 rounded">
                          Swapped Out
                        </span>
                        <span className="line-through font-mono text-[10px] text-slate-500">
                          {oldSection.id}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 line-through truncate">
                        {oldSection.title}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {formatCourseSlot(oldSection)}
                      </div>
                    </div>

                    {/* Arrow Divider */}
                    <div className="flex items-center justify-center py-0.5 text-amber-700">
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </div>

                    {/* Replacement Section */}
                    <div className="border-l-2 border-emerald-500 pl-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase text-emerald-800 bg-emerald-50 px-1 rounded">
                          Alternate Section
                        </span>
                        <strong className="font-['Archivo_Black',sans-serif] text-emerald-950">
                          {replacementSection.id}
                        </strong>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-800 truncate">
                        {replacementSection.title}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-600 font-mono">
                        <span>{formatCourseSlot(replacementSection)}</span>
                        <span className="flex items-center gap-0.5 text-slate-500">
                          <Users className="w-3 h-3" aria-hidden="true" />
                          {replacementSection.enrolled}/{replacementSection.capacity}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-800/80 italic p-2 text-center">
                    No swap required (direct fit)
                  </div>
                )}
              </div>
            </div>

            {/* ── 3. KEEP Group ────────────────────────────────────── */}
            <div className="flex flex-col rounded border-2 border-slate-400 bg-slate-50/60 p-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-300 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-600 text-white text-[10px] font-black">
                    =
                  </span>
                  <span className="font-['Archivo_Black',sans-serif] text-xs uppercase text-slate-900 font-bold tracking-wider">
                    Keep ({keepSections.length})
                  </span>
                </div>
                <span className="text-[9px] font-bold text-slate-600 uppercase">Unchanged</span>
              </div>

              <div className="space-y-2 flex-1">
                {keepSections.length > 0 ? (
                  keepSections.map((sec) => (
                    <div
                      key={sec.id}
                      className="bg-white rounded border border-slate-300 p-2 shadow-xs text-xs"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <strong className="font-['Archivo_Black',sans-serif] text-slate-900">
                          {sec.id}
                        </strong>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold uppercase">
                          {sec.component || 'course'}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-800 truncate mt-0.5">
                        {sec.title}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600 font-mono">
                        <span>{formatCourseSlot(sec)}</span>
                        <span className="flex items-center gap-0.5 text-slate-500">
                          <Users className="w-3 h-3" aria-hidden="true" />
                          {sec.enrolled}/{sec.capacity}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-slate-600 italic p-2 text-center">
                    No existing sections kept
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Encoded Validation Checks Passed ───────────────────── */}
          <div className="rounded border border-emerald-300 bg-emerald-50/70 p-3 text-xs">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <strong className="font-['Archivo_Black',sans-serif] text-[11px] uppercase tracking-wide text-emerald-950">
                Encoded Validation Checks Passed
              </strong>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-emerald-950">
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>Time Conflicts:</strong> None detected across all meetings.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>Linked Lab:</strong> Satisfied{' '}
                  {linkedLabSection ? `(${linkedLabSection})` : 'requirement met'}.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>Synthetic Seats:</strong> Open seats verified in sample data.
                </span>
              </li>
            </ul>
          </div>

          {/* ── Disclaimers & Action Bar ──────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[var(--color-navy)]/15">
            <div className="flex items-center gap-2 text-[11px] text-slate-700">
              <ShieldCheck className="w-4 h-4 text-[var(--color-navy)] shrink-0" aria-hidden="true" />
              <span>
                <strong>Nothing changes before Apply.</strong> No registration is submitted (preview only).
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: ACTION.DISMISS_REPAIR });
                  onClose?.();
                }}
                className="px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-none border-2 border-[var(--color-navy)] bg-white text-[var(--color-navy)] hover:bg-slate-100 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shadow-xs"
              >
                Dismiss
              </button>

              <button
                type="button"
                disabled={isApplied}
                onClick={() => {
                  dispatch({ type: ACTION.APPLY_REPAIR });
                }}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-black uppercase tracking-wider rounded-none border-2 border-[var(--color-navy)] ${
                  isApplied
                    ? 'bg-emerald-700 text-white cursor-default opacity-90'
                    : 'bg-[var(--color-navy)] text-[var(--color-cream)] hover:opacity-90 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer shadow-xs'
                } transition-all`}
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                {isApplied ? 'Applied' : 'Apply repair'}
              </button>
            </div>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}
