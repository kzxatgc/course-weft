import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Timetable from './components/Timetable.jsx';
import AvailableCourses from './components/AvailableCourses.jsx';
import { formatCourseSlot } from './domain/time.mjs';
import { MAIN_CATALOG, INITIAL_DRAFT } from './domain/available-courses.mjs';
import { ACTION } from './state/draft-controller.mjs';
import {
  evaluateSwap,
  getEffectiveSwapDuration,
} from './domain/drop-preview.mjs';

/**
 * EarlySchedulePreview — main schedule workspace.
 *
 * Renders the weekly Timetable and the Available Courses strip.
 * Undo / Reset icon controls live inline in the AvailableCourses header.
 * Coordinates animated section swaps between AvailableCourses and Timetable.
 * All data is synthetic sample data only (no live registration system).
 */
export default function EarlySchedulePreview({ state, dispatch }) {
  const availableCourses = state?.availableCourses || MAIN_CATALOG;
  const draft = state?.draft || INITIAL_DRAFT;
  const [previewSectionId, setPreviewSectionId] = useState(null);
  const [animatingSwap, setAnimatingSwap] = useState(null);
  const [returningCard, setReturningCard] = useState(null);
  const [returningCardId, setReturningCardId] = useState(null);

  // Fully hydrated section records for sections currently in the draft
  const selectedSections = availableCourses.filter((item) => draft.includes(item.id));

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

    // Determine animation destination: Section B's original card slot in the Available Courses tray
    // Prefer origRect (Section B's exact card position before it was picked up)
    let toRect;
    if (dropInfo?.origRect) {
      toRect = {
        left: dropInfo.origRect.left,
        top: dropInfo.origRect.top,
        width: dropInfo.origRect.width,
        height: dropInfo.origRect.height,
      };
    } else {
      // Fallback: land at the start of the Available Courses track
      const trackEl = typeof document !== 'undefined'
        ? document.querySelector('.nb-courses-track')
        : null;
      const trackRect = trackEl ? trackEl.getBoundingClientRect() : null;
      if (!trackRect) {
        setReturningCardId(null);
        return;
      }
      toRect = {
        left: trackRect.left + 8,
        top: trackRect.top + 8,
        width: 195,
        height: Math.max(fromRect.height, 56),
      };
    }

    // Launch the animated card flying from the drop point to the Available Courses tray slot
    setReturningCard({
      item: fromItem,
      fromRect,
      toRect,
      isMoving: false,
    });

    // Double RAF: first frame paints at fromRect (no transition), second frame
    // applies --moving class + toRect coords so the CSS transition fires.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setReturningCard((prev) => (prev ? { ...prev, isMoving: true } : null));
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
                SYNTHETIC SAMPLE DATA — NO REAL REGISTRATION IS SUBMITTED
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
            draft={draft}
            dispatch={dispatch}
            search={state?.search || ''}
            state={state}
            onPreviewSectionChange={setPreviewSectionId}
            onRequestSwap={handleRequestSwap}
            animatingReturnId={returningCardId}
            returningCardId={returningCardId}
          />

          {/* ── Weekly Timetable — spans entire window width ── */}
          <div className="w-full min-w-0">
            <Timetable
              selectedSections={selectedSections}
              availableCourses={availableCourses}
              draft={draft}
              dispatch={dispatch}
              fixedPreviewSectionId={previewSectionId}
              animatingSwap={animatingSwap}
              onRequestSwap={handleRequestSwap}
            />
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


