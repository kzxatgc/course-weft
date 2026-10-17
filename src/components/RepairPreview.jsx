import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Sparkles,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Wrench,
} from 'lucide-react';
import { ACTION } from '../state/draft-controller.mjs';
import { formatCourseSlot } from '../domain/time.mjs';
import { enumerateRepairs } from '../domain/repairs.mjs';

/**
 * RepairPreview
 *
 * Renders the Add / Swap impact preview panel when a validated
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
  const requestedId = state?.request;
  const plans = candidate && requestedId
    ? enumerateRepairs(draft, availableCourses, requestedId, { firstStep: true })
    : [];
  const activePlanIndex = Math.max(
    0,
    plans.findIndex((plan) => plan.ids.join('|') === candidate?.ids?.join('|'))
  );
  const activePlan = plans[activePlanIndex] || candidate;
  const planLabel = `Plan ${String.fromCharCode(65 + activePlanIndex)}`;

  const headingRef = useRef(null);
  const wasAppliedRef = useRef(isApplied);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (isApplied && !wasAppliedRef.current) onClose?.();
    wasAppliedRef.current = isApplied;
  }, [isApplied, onClose]);

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
  const swaps = activePlan.swaps?.length
    ? activePlan.swaps
    : activePlan.swap
      ? [activePlan.swap]
      : [];
  const replacementIds = new Set(swaps.map((swap) => swap.replacement));

  // ADD: newly added sections (excluding replacement which is shown in SWAP)
  const candidateAdded = activePlan.added || activePlan.ids.filter((id) => !draft.includes(id));
  const addIds = candidateAdded.filter((id) => !replacementIds.has(id));
  const addSections = addIds.map((id) => byId.get(id)).filter(Boolean);

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
        className="nb-repair-preview my-1 rounded-none border-[2.5px] border-[var(--color-navy)] bg-[color-mix(in_srgb,color-mix(in_srgb,var(--color-cream)_65%,var(--color-yellow))_94%,var(--color-charcoal))] shadow-[4px_4px_0px_0px_var(--color-navy)] overflow-hidden font-mono"
      >
        {/* ── Panel Header Bar ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[color-mix(in_srgb,var(--color-yellow)_76%,var(--color-charcoal))] border-b-2 border-[var(--color-navy)]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--color-navy)] shrink-0" aria-hidden="true" />
            <h2
              ref={headingRef}
              id="repair-preview-heading"
              tabIndex={-1}
              className="font-['Archivo_Black',sans-serif] text-xs sm:text-sm font-black uppercase text-[var(--color-navy)] tracking-wide outline-none m-0"
            >
              {planLabel}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5" role="group" aria-label="Repair plans">
              <button
                type="button"
                disabled={activePlanIndex === 0}
                onClick={() => dispatch({ type: ACTION.SET_CANDIDATE, payload: plans[activePlanIndex - 1] })}
                aria-label="Previous repair plan"
                className={`grid h-6 w-6 place-items-center rounded-none border-2 border-[var(--color-navy)] transition-opacity ${
                  activePlanIndex === 0
                    ? 'opacity-30 cursor-default'
                    : 'opacity-100 hover:bg-[var(--color-navy)]/10 cursor-pointer'
                }`}
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={activePlanIndex >= plans.length - 1}
                onClick={() => dispatch({ type: ACTION.SET_CANDIDATE, payload: plans[activePlanIndex + 1] })}
                aria-label="Next repair plan"
                className={`grid h-6 w-6 place-items-center rounded-none border-2 border-[var(--color-navy)] transition-opacity ${
                  activePlanIndex >= plans.length - 1
                    ? 'opacity-30 cursor-default'
                    : 'opacity-100 hover:bg-[var(--color-navy)]/10 cursor-pointer'
                }`}
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

          </div>
        </div>

        {/* ── Repair changes: ADD / SWAP ─────────────────────────── */}
        <div className="p-3 sm:p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* ── 1. ADD Group ─────────────────────────────────────── */}
            <div className="flex flex-col border-2 border-[var(--color-blue)] bg-[var(--color-cream)] p-2.5">
              <div className="mb-2 flex items-center justify-between border-b border-[var(--color-navy)]/20 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center bg-[var(--color-blue)] text-[var(--color-cream)] text-[10px] font-black">
                    +
                  </span>
                  <span className="font-['Archivo_Black',sans-serif] text-xs font-bold uppercase tracking-wider text-[var(--color-navy)]">
                    Add ({addSections.length})
                  </span>
                </div>
                <span className="text-[9px] font-bold uppercase text-[var(--color-blue)]">New Sections</span>
              </div>

              <div className="space-y-2 flex-1">
                {addSections.length > 0 ? (
                  addSections.map((sec) => (
                    <div
                      key={sec.id}
                      className="border border-[var(--color-navy)]/20 bg-white p-2 text-xs shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="font-['Archivo_Black',sans-serif] text-[var(--color-navy)]">
                          {sec.id}
                        </strong>
                        <span className="text-[10px] text-[var(--color-charcoal)]/75">
                          {formatCourseSlot(sec)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-center text-[11px] italic text-[var(--color-charcoal)]/70">
                    No direct additions
                  </div>
                )}
              </div>
            </div>

            {/* ── 2. SWAP Group ────────────────────────────────────── */}
            <div className="flex flex-col border-2 border-[var(--color-navy)] bg-[color-mix(in_srgb,var(--color-cream)_72%,var(--color-yellow))] p-2.5">
              <div className="mb-2 flex items-center justify-between border-b border-[var(--color-navy)]/20 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center bg-[var(--color-navy)] text-[var(--color-yellow)] text-[10px] font-black">
                    ⇄
                  </span>
                  <span className="font-['Archivo_Black',sans-serif] text-xs font-bold uppercase tracking-wider text-[var(--color-navy)]">
                    Swap ({swaps.length})
                  </span>
                </div>
                <span className="text-[9px] font-bold uppercase text-[var(--color-navy)]">
                  {swaps.length > 1 ? 'Resolves Clashes' : 'Resolves Clash'}
                </span>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                {swaps.length > 0 ? (
                  <div className="space-y-2">
                    {swaps.map((swap) => {
                      const oldSection = byId.get(swap.old);
                      const replacementSection = byId.get(swap.replacement);
                      if (!oldSection || !replacementSection) return null;

                      return (
                        <div
                          key={`${swap.old}-${swap.replacement}`}
                          className="flex flex-col items-stretch gap-1 border border-[var(--color-navy)]/25 bg-white p-2 text-xs shadow-xs"
                        >
                          <div className="min-w-0 border-l-2 border-[var(--color-navy)]/30 pl-2">
                            <div className="truncate font-['Archivo_Black',sans-serif] text-[var(--color-charcoal)]/60 line-through">
                              {oldSection.id}
                            </div>
                            <div className="mt-1 text-[10px] font-semibold text-[var(--color-charcoal)]/75">
                              {formatCourseSlot(oldSection)}
                            </div>
                          </div>

                          <ArrowDown className="mx-auto h-4 w-4 text-[var(--color-navy)]" aria-hidden="true" />

                          <div className="min-w-0 border-l-2 border-[var(--color-blue)] pl-2">
                            <div className="truncate font-['Archivo_Black',sans-serif] text-[var(--color-navy)]">
                              {replacementSection.id}
                            </div>
                            <div className="mt-1 text-[10px] font-semibold text-[var(--color-charcoal)]/75">
                              {formatCourseSlot(replacementSection)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-2 text-center text-[11px] italic text-[var(--color-charcoal)]/70">
                    No swap required (direct fit)
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── Disclaimers & Action Bar ──────────────────────────── */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-navy)]/15">
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
