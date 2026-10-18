import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import Timetable from './components/Timetable.jsx';
import AvailableCourses from './components/AvailableCourses.jsx';
import { formatCourseSlot } from './domain/time.mjs';
import { MAIN_CATALOG, INITIAL_DRAFT } from './domain/available-courses.mjs';
import { ACTION } from './state/draft-controller.mjs';
import {
  evaluateSwap,
  buildFixedPreview,
  getConflictingSections,
} from './domain/drop-preview.mjs';
import { enumerateRepairs } from './domain/repairs.mjs';
import {
  getLinkedOutlineSectionIds,
} from './domain/linked-labs.mjs';

function orderLinkedSections(ids, sectionsById, direction) {
  const labs = ids.filter((id) => Boolean(sectionsById.get(id)?.requiredBy));
  const lectures = ids.filter((id) => Boolean(sectionsById.get(id)?.requires?.length));
  return direction === 'outgoing'
    ? [...labs, ...lectures]
    : [...lectures, ...labs];
}

/**
 * EarlySchedulePreview - main schedule workspace.
 *
 * Renders the weekly Timetable and the Available Courses strip.
 * Undo / Reset icon controls live inline in the AvailableCourses header.
 * Coordinates animated section swaps between AvailableCourses and Timetable.
 * All data is synthetic sample data only (no live registration system).
 */
export default function EarlySchedulePreview({ state, dispatch }) {
  const scenarioTransition = state?.scenarioTransition || null;
  const availableCourses = scenarioTransition?.availableCourses || state?.availableCourses || MAIN_CATALOG;
  const draft = state?.draft || INITIAL_DRAFT;
  const [previewSectionId, setPreviewSectionId] = useState(null);
  const [traySelectionResetKey, setTraySelectionResetKey] = useState(0);
  const [animatingSwap, setAnimatingSwap] = useState(null);
  const [repairTransition, setRepairTransition] = useState('idle');
  const [repairDisplayDraft, setRepairDisplayDraft] = useState(null);
  const repairTransitionTimersRef = useRef([]);
  const historyTransitionTimersRef = useRef([]);
  const wasAppliedRef = useRef(false);
  const [returningCard, setReturningCard] = useState(null);
  const [returningCardId, setReturningCardId] = useState(null);
  const displayDraft = scenarioTransition?.phase === 'outgoing'
    ? scenarioTransition.draft
    : repairTransition === 'loading' && state?.snapshot?.draft
      ? state.snapshot.draft
      : repairDisplayDraft ?? draft;
  const repairLockedIds = repairTransition === 'idle' || !state?.snapshot?.candidate
    ? []
    : [...new Set([
      ...(state.snapshot.candidate.swaps || []).flatMap(({ old, replacement }) => [old, replacement]),
      ...(state.snapshot.candidate.added || []),
      ...(state.snapshot.draft || []).filter((id) => !draft.includes(id)),
    ])];
  const repairInteractionLocked = repairTransition !== 'idle' || Boolean(scenarioTransition);
  const activePreviewSectionId = previewSectionId && !draft.includes(previewSectionId)
    ? previewSectionId
    : null;
  const handleTimetableDragStart = () => {
    setPreviewSectionId(null);
    setTraySelectionResetKey((key) => key + 1);
  };

  useLayoutEffect(() => {
    if (scenarioTransition?.phase !== 'outgoing') return;
    setPreviewSectionId(null);
    setTraySelectionResetKey((key) => key + 1);
  }, [scenarioTransition]);

  useLayoutEffect(() => {
    if (state?.isApplied && state?.historyTransition) {
      wasAppliedRef.current = true;
      return undefined;
    }
    if (!state?.isApplied) {
      wasAppliedRef.current = false;
      repairTransitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      repairTransitionTimersRef.current = [];
      setAnimatingSwap(null);
      setRepairDisplayDraft(null);
      setRepairTransition('idle');
      return undefined;
    }
    if (wasAppliedRef.current) return undefined;
    wasAppliedRef.current = true;

    const previousDraft = state.snapshot?.draft || [];
    const incomingIds = draft.filter((id) => !previousDraft.includes(id));
    const outgoingIds = previousDraft.filter((id) => !draft.includes(id));
    const byId = new Map(availableCourses.map((section) => [section.id, section]));
    const isLinkedSection = (id) => Boolean(
      byId.get(id)?.requiredBy || byId.get(id)?.requires?.length
    );
    const candidateSwaps = state.snapshot?.candidate?.swaps || [];
    const swappedOutIds = new Set(candidateSwaps.map(({ old }) => old));
    const swappedInIds = new Set(candidateSwaps.map(({ replacement }) => replacement));
    const outgoingSequence = [
      ...orderLinkedSections(
        outgoingIds.filter((id) => isLinkedSection(id) && !swappedOutIds.has(id)),
        byId,
        'outgoing'
      ),
    ];
    const remainingOutgoingIds = outgoingIds.filter((id) => (
      !isLinkedSection(id) && !swappedOutIds.has(id)
    ));
    const remainingIncomingIds = incomingIds.filter((id) => (
      !isLinkedSection(id) && !swappedInIds.has(id)
    ));
    const linkedIncomingIds = orderLinkedSections(
      incomingIds.filter((id) => isLinkedSection(id) && !swappedInIds.has(id)),
      byId,
      'incoming'
    );
    const timers = repairTransitionTimersRef.current;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const showAppliedNotice = () => {
      dispatch?.({
        type: ACTION.SET_NOTICE,
        payload: {
          kind: 'success',
          title: 'Timetable updated',
          message: 'The timetable changes have been applied.',
        },
      });
    };

    setRepairTransition('loading');
    const loadingTimer = window.setTimeout(() => {
      if (prefersReducedMotion) {
        setRepairDisplayDraft(null);
        setRepairTransition('idle');
        showAppliedNotice();
        return;
      }

      setRepairDisplayDraft([...previousDraft]);
      setRepairTransition('swapping');
      let stageDraft = [...previousDraft];
      const animateSection = (id, direction, onComplete) => {
        setAnimatingSwap(direction === 'outgoing' ? { outgoingId: id } : { incomingId: id });
        if (direction === 'incoming' && !stageDraft.includes(id)) {
          stageDraft = [...stageDraft, id];
          setRepairDisplayDraft([...stageDraft]);
        }
        timers.push(window.setTimeout(() => {
          if (direction === 'outgoing') {
            stageDraft = stageDraft.filter((sectionId) => sectionId !== id);
            setRepairDisplayDraft([...stageDraft]);
          }
          setAnimatingSwap(null);
          timers.push(window.setTimeout(onComplete, 40));
        }, 280));
      };

      const runSections = (ids, direction, onComplete, index = 0) => {
        if (index >= ids.length) {
          onComplete();
          return;
        }
        animateSection(ids[index], direction, () => {
          runSections(ids, direction, onComplete, index + 1);
        });
      };
      const runSwaps = (index = 0) => {
        if (index >= candidateSwaps.length) {
          runSections(remainingOutgoingIds, 'outgoing', () => {
            runSections(remainingIncomingIds, 'incoming', () => {
              runSections(linkedIncomingIds, 'incoming', finishAnimation);
            });
          });
          return;
        }
        const swap = candidateSwaps[index];
        animateSection(swap.old, 'outgoing', () => {
          animateSection(swap.replacement, 'incoming', () => runSwaps(index + 1));
        });
      };
      const finishAnimation = () => {
        setAnimatingSwap(null);
        setRepairDisplayDraft(null);
        setRepairTransition('idle');
        showAppliedNotice();
      };

      runSections(outgoingSequence, 'outgoing', runSwaps);
    }, 1000);
    timers.push(loadingTimer);

    return undefined;
  }, [state?.isApplied, state?.snapshot, draft, availableCourses]);

  useLayoutEffect(() => {
    const transition = state?.historyTransition;
    if (!transition) return undefined;

    historyTransitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    historyTransitionTimersRef.current = [];
    const timers = historyTransitionTimersRef.current;
    const fromDraft = [...transition.fromDraft];
    const toDraft = [...transition.toDraft];
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stageDraft = [...fromDraft];

    const finishTransition = () => {
      setAnimatingSwap(null);
      setRepairDisplayDraft(null);
      setRepairTransition('idle');
      dispatch?.({ type: ACTION.COMPLETE_HISTORY_TRANSITION });
    };

    if (prefersReducedMotion) {
      finishTransition();
      return undefined;
    }

    const removed = fromDraft.filter((id) => !toDraft.includes(id));
    const added = toDraft.filter((id) => !fromDraft.includes(id));

    {
      const byId = new Map(availableCourses.map((section) => [section.id, section]));
      const isLinkedSection = (id) => Boolean(
        byId.get(id)?.requiredBy || byId.get(id)?.requires?.length
      );
      const isLinkedLecture = (id) => Boolean(byId.get(id)?.requires?.length);
      const replacementAdded = new Set(added.filter((id) => !isLinkedLecture(id)));
      const replacementPairs = [];
      for (const oldId of removed.filter((id) => !isLinkedLecture(id))) {
        const oldSection = byId.get(oldId);
        const replacementId = added.find((newId) => {
          if (!replacementAdded.has(newId)) return false;
          const newSection = byId.get(newId);
          return Boolean(
            newSection &&
            (
              oldSection?.alternates?.includes(newId) ||
              newSection.alternates?.includes(oldId) ||
              (oldSection?.course === newSection.course && oldSection?.component === newSection.component)
            )
          );
        });
        if (replacementId) {
          replacementPairs.push({ old: oldId, replacement: replacementId });
          replacementAdded.delete(replacementId);
        }
      }
      replacementPairs.sort((first, second) => (
        Number(isLinkedSection(second.old)) - Number(isLinkedSection(first.old))
      ));
      if (transition.direction === 'undo') replacementPairs.reverse();
      const pairedRemoved = new Set(replacementPairs.map(({ old }) => old));
      const pairedAdded = new Set(replacementPairs.map(({ replacement }) => replacement));
      const linkedRemoved = removed.filter((id) => isLinkedSection(id) && !pairedRemoved.has(id));
      const unmatchedRemoved = removed.filter((id) => !pairedRemoved.has(id) && !isLinkedSection(id));
      const unmatchedAdded = added.filter((id) => replacementAdded.has(id) && !isLinkedSection(id));
      const linkedAdded = added.filter((id) => isLinkedSection(id) && !pairedAdded.has(id));
      const orderLinked = (ids, direction) => {
        const labs = ids.filter((id) => Boolean(byId.get(id)?.requiredBy));
        const lectures = ids.filter((id) => Boolean(byId.get(id)?.requires?.length));
        return direction === 'outgoing'
          ? [...labs, ...lectures]
          : [...lectures, ...labs];
      };
      const animateSection = (id, direction, onComplete) => {
        setAnimatingSwap(direction === 'outgoing' ? { outgoingId: id } : { incomingId: id });
        if (direction === 'incoming' && !stageDraft.includes(id)) {
          stageDraft = [...stageDraft, id];
          setRepairDisplayDraft([...stageDraft]);
        }
        timers.push(window.setTimeout(() => {
          if (direction === 'outgoing') {
            stageDraft = stageDraft.filter((sectionId) => sectionId !== id);
            setRepairDisplayDraft([...stageDraft]);
          }
          setAnimatingSwap(null);
          timers.push(window.setTimeout(onComplete, 40));
        }, 280));
      };
      const runSections = (ids, direction, onComplete, index = 0) => {
        if (index >= ids.length) {
          onComplete();
          return;
        }
        animateSection(ids[index], direction, () => {
          runSections(ids, direction, onComplete, index + 1);
        });
      };
      const runPairs = (index = 0) => {
        if (index >= replacementPairs.length) {
          runSections(unmatchedRemoved, 'outgoing', () => {
            runSections(unmatchedAdded, 'incoming', () => {
              runSections(orderLinked(linkedAdded, 'incoming'), 'incoming', finishTransition);
            });
          });
          return;
        }
        const pair = replacementPairs[index];
        animateSection(pair.old, 'outgoing', () => {
          animateSection(pair.replacement, 'incoming', () => runPairs(index + 1));
        });
      };

      setRepairDisplayDraft(fromDraft);
      setRepairTransition('swapping');
      runSections(orderLinked(linkedRemoved, 'outgoing'), 'outgoing', runPairs);

      return () => {
        timers.forEach((timer) => window.clearTimeout(timer));
      };
    }
  }, [state?.historyTransition, availableCourses, dispatch]);

  useEffect(() => () => {
    repairTransitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    historyTransitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (previewSectionId && draft.includes(previewSectionId)) {
      setPreviewSectionId(null);
    }
  }, [draft, previewSectionId]);

  useEffect(() => {
    if (!scenarioTransition) return undefined;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setRepairTransition('swapping');
    if (scenarioTransition.phase === 'outgoing') {
      if (scenarioTransition.draft.length > 0 && !prefersReducedMotion) {
        setAnimatingSwap({ incomingIds: [], outgoingIds: scenarioTransition.draft });
      }
    } else if (scenarioTransition.phase === 'incoming' && !prefersReducedMotion) {
      setAnimatingSwap({ incomingIds: draft, outgoingIds: [] });
    }

    const transitionTimer = window.setTimeout(() => {
      setAnimatingSwap(null);
      if (scenarioTransition.phase === 'incoming') {
        setRepairTransition('idle');
      }
      dispatch?.({ type: ACTION.COMPLETE_SCENARIO_TRANSITION });
      if (scenarioTransition.phase === 'incoming' && scenarioTransition.showResetNotice) {
        dispatch?.({
          type: ACTION.SET_NOTICE,
          payload: {
            kind: 'success',
            title: 'Timetable reset',
            message: 'Your timetable has been restored to its starting selections.',
          },
        });
      }
    }, prefersReducedMotion ? 0 : 280);

    return () => window.clearTimeout(transitionTimer);
  }, [dispatch, draft, scenarioTransition]);

  // Sections that should show the chasing rainbow outline
  const linkedOutlineIds = getLinkedOutlineSectionIds(displayDraft, availableCourses);

  // Fully hydrated section records for sections currently in the draft
  const selectedSections = availableCourses.filter((item) => displayDraft.includes(item.id));
  const previewSection = availableCourses.find((item) => item.id === activePreviewSectionId);
  const previewReplacedIds = previewSection
    ? selectedSections
      .filter((section) =>
        section.id !== previewSection.id &&
        (
          (section.course === previewSection.course && section.component === previewSection.component) ||
          previewSection.alternates?.includes(section.id) ||
          section.alternates?.includes(previewSection.id)
        )
      )
      .map((section) => section.id)
    : [];
  const previewConflict = previewSection
    ? buildFixedPreview(
      previewSection,
      selectedSections.filter((section) => !previewReplacedIds.includes(section.id))
    )?.hasConflict
    : false;
  const previewRepairs = previewConflict
    ? enumerateRepairs(
      draft,
      availableCourses,
      activePreviewSectionId,
      { firstStep: true }
    )
    : [];
  const previewConflictNames = previewSection
    ? getConflictingSections(
      previewSection,
      selectedSections.filter((section) => !previewReplacedIds.includes(section.id))
    ).map((section) => section.id)
    : [];
  const unavailableLinkedLabPreviewId =
    previewConflict &&
    previewSection?.requiredBy &&
    previewRepairs.length === 0
      ? activePreviewSectionId
      : null;
  const repairPreviewId = previewRepairs.length > 0
    ? activePreviewSectionId
    : null;

  function handleRequestSwap({ toId, fromId, dropInfo = null }) {
    if (!dispatch) return;

    // Check validity before initiating animation
    const result = evaluateSwap({ draft, availableCourses, fromId, toId });
    if (!result.valid) {
      // Dispatch SWITCH_SECTION directly so controller emits appropriate conflict notice and preserves draft
      dispatch({
        type: ACTION.SWITCH_SECTION,
        payload: { toId, fromId },
      });
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Trigger timetable swap animations BEFORE dispatching so Section A is still rendered
    // when nb-tt-swap-outgoing fires (slides up). Section B gets nb-tt-swap-incoming (slides down).
    if (!prefersReducedMotion) {
      setAnimatingSwap({ outgoingId: fromId, incomingId: toId });
      setTimeout(() => setAnimatingSwap(null), 280);
    }

    // Set returningCardId so AvailableCourses displays a gray dashed placeholder for fromId
    // instead of showing a duplicate real card while the return animation is in flight.
    setReturningCardId(fromId);

    // Swap the course on the timetable instantly!
    dispatch({
      type: ACTION.SWITCH_SECTION,
      payload: { toId, fromId },
    });

    if (prefersReducedMotion) {
      setReturningCardId(null);
      return;
    }

    const fromItem = availableCourses.find((c) => c.id === fromId);
    if (!fromItem) {
      setReturningCardId(null);
      return;
    }

    // Determine animation start: prefer the drop point (where user released the card on the timetable)
    // Fallback: Section A's timetable block position
    let fromRect;
    if (dropInfo?.dropPoint) {
      // Start the flying card from the drop point (centered on where user let go)
      const cardW = dropInfo.origRect?.width || 195;
      const cardH = dropInfo.origRect?.height || 56;
      fromRect = {
        left: dropInfo.dropPoint.x - cardW / 2,
        top: dropInfo.dropPoint.y - cardH / 2,
        width: cardW,
        height: cardH,
      };
    } else {
      // Fallback: query Section A's timetable block DOM position
      const fromEl = typeof document !== 'undefined'
        ? document.querySelector(`[data-testid="timetable-block-${fromId}"]`)
        : null;
      const rect = fromEl ? fromEl.getBoundingClientRect() : null;
      if (!rect) {
        setReturningCardId(null);
        return;
      }
      fromRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }

    requestAnimationFrame(() => {
      const returnPlaceholder = document.querySelector(
        `[data-testid="course-return-placeholder-${CSS.escape(fromId)}"]`
      );
      const placeholderRect = returnPlaceholder?.getBoundingClientRect();
      if (!placeholderRect) {
        setReturningCardId(null);
        return;
      }
      const toRect = {
        left: placeholderRect.left,
        top: placeholderRect.top,
        width: placeholderRect.width,
        height: placeholderRect.height,
      };

      setReturningCard({
        item: fromItem,
        fromRect,
        toRect,
        isMoving: false,
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setReturningCard((prev) => (prev ? { ...prev, isMoving: true } : null));
        });
      });
    });

    setTimeout(() => {
      setReturningCard(null);
      setReturningCardId(null);
    }, 350);
  }

  return (
    <>
      <div className="space-y-3 px-1.5 py-1">
        {!state && (
          <div
            role="region"
            aria-label="Demo disclosure notice"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
              <strong className="text-xs sm:text-sm font-bold tracking-wide uppercase">
                SYNTHETIC SAMPLE DATA - NO REAL REGISTRATION IS SUBMITTED
              </strong>
            </div>
            <p className="mt-1 text-xs text-amber-900/90 leading-relaxed">
              All courses, meeting times, and availability counts are fictional sample data for local
              demonstration only. This portal does not connect to university registration systems.
            </p>
          </div>
        )}

        {/* ── Main planning workspace: Available Courses (top) + Timetable (below) ── */}
        <div className="flex flex-col gap-3 w-full">
          {/* ── Available Courses horizontal strip ─────────── */}
          {/* state is passed so AvailableCourses can show inline Undo / Reset icons */}
          <AvailableCourses
            availableCourses={availableCourses}
            draft={displayDraft}
            dispatch={dispatch}
            search={state?.search || ''}
            state={state}
            onPreviewSectionChange={setPreviewSectionId}
            selectionResetKey={traySelectionResetKey}
            repairPreviewId={repairPreviewId}
            unavailableLinkedLabPreviewId={unavailableLinkedLabPreviewId}
            previewConflictNames={previewConflictNames}
            onRequestSwap={handleRequestSwap}
            repairLockedIds={repairLockedIds}
            repairInteractionLocked={repairInteractionLocked}
            onSectionDragStart={handleTimetableDragStart}
            animatingReturnId={returningCardId}
            returningCardId={returningCardId}
            linkedOutlineIds={linkedOutlineIds}
            animatingSwap={animatingSwap}
          />

          {/* ── Weekly Timetable - spans entire window width ── */}
          <div className="relative w-full min-w-0">
            <Timetable
              selectedSections={selectedSections}
              availableCourses={availableCourses}
              draft={displayDraft}
              dispatch={dispatch}
              fixedPreviewSectionId={activePreviewSectionId}
              animatingSwap={animatingSwap}
              onRequestSwap={handleRequestSwap}
              repairLockedIds={repairLockedIds}
              repairInteractionLocked={repairInteractionLocked}
              linkedOutlineIds={linkedOutlineIds}
            />
            {repairTransition === 'loading' && (
              <div
                className="absolute inset-0 z-30 flex items-center justify-center bg-white/50"
                role="status"
                aria-label="Applying timetable repair"
                data-testid="repair-loading-overlay"
              >
                <LoaderCircle className="h-8 w-8 animate-spin text-[var(--color-navy)]" aria-hidden="true" />
                <span className="sr-only">Applying timetable repair</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {returningCard &&
        typeof document !== 'undefined' &&
        document.body
        ? createPortal(
          <div
            className={`nb-card-returning${returningCard.isMoving ? ' nb-card-returning--moving' : ''}`}
            style={{
              left: `${returningCard.isMoving ? returningCard.toRect.left : returningCard.fromRect.left}px`,
              top: `${returningCard.isMoving ? returningCard.toRect.top : returningCard.fromRect.top}px`,
              width: `${returningCard.isMoving ? returningCard.toRect.width : returningCard.fromRect.width}px`,
              height: `${returningCard.isMoving ? returningCard.toRect.height : returningCard.fromRect.height}px`,
              opacity: returningCard.isMoving ? 0.92 : 1,
              transform: returningCard.isMoving ? 'scale(0.97)' : 'scale(1)',
            }}
            aria-hidden="true"
            data-testid={`returning-card-${returningCard.item?.id}`}
          >
            <div className="nb-course-card w-full h-full bg-[var(--color-cream)] border-2 border-[var(--color-navy)] rounded p-2 flex flex-col justify-between gap-1.5 text-left shadow-[4px_4px_0px_var(--color-navy)] cursor-default">
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="nb-course-id font-['Archivo_Black',sans-serif] text-[11px] font-black text-[var(--color-navy)] tracking-wide">
                    {returningCard.item?.id}
                  </span>
                  <span className="nb-course-badge text-[8px] font-black uppercase tracking-wider bg-[var(--color-navy)] text-[var(--color-cream)] px-1.5 py-0.5 rounded leading-none">
                    {returningCard.item?.component}
                  </span>
                </div>
                <h3 className="nb-course-name font-mono text-[10.5px] font-bold text-[var(--color-charcoal)] truncate mt-1 text-left">
                  {returningCard.item?.title}
                </h3>
              </div>
              <div className="nb-course-footer flex items-center justify-between border-t border-[var(--color-navy)]/15 pt-1 mt-1 w-full">
                <span className="nb-course-time font-mono text-[9px] font-bold text-[var(--color-navy)] whitespace-nowrap">
                  {returningCard.item ? formatCourseSlot(returningCard.item) : ''}
                </span>
              </div>
            </div>
          </div>,
          document.body
        )
        : null}
    </>
  );
}
