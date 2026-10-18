import React, { useState, useEffect, useLayoutEffect, useId, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Users, Undo2, Redo2, RotateCcw, Wrench, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { ACTION, canUndo, canRedo } from '../state/draft-controller.mjs';
import { INITIAL_DRAFT } from '../domain/available-courses.mjs';
import { useKeyboardHints } from '../hooks/useKeyboardHints.js';

import { format24hTime, formatCourseSlot } from '../domain/time.mjs';
import { playSound } from '../audio/optional-sounds.js';
import {
  DT_SECTION_ID,
  POINTER_DRAG_THRESHOLD,
  hasExceededDragThreshold,
  isCardTouchingTimetable,
  isCardOutsidePanel,
  evaluateDrop,
  detectTimeConflict,
  getConflictingSections,
} from '../domain/drop-preview.mjs';

export { formatCourseSlot };

function isSectionFull(item) {
  return item.seat === 'full' ||
    (typeof item.capacity === 'number' && item.enrolled >= item.capacity);
}

/**
 * AvailableCourses
 *
 * Renders the searchable list of available course sections.
 * Features:
 *  - Search input with placeholder "Search..." and Search button on top right of header
 *  - Instant live filtering by course code and course title (case-insensitive)
 *  - Whole card acts as the accessible Add or Switch control
 *  - Displays enrolled/capacity counts and derived seats remaining
 *  - Clear disclosure that all figures are synthetic sample data
 *  - Supports keyboard preview and Enter/Space add or switch actions
 *  - Handles controller dispatch for ADD_SECTION and SWITCH_SECTION
 *  - Empty state when no courses match query
 *  - Neo-brutalist styling built with Tailwind utility classes
 *  - Emits onPreviewSectionChange for keyboard focus and active pointer drags
 *
 * @param {{
 *   availableCourses: object[],
 *   draft: string[],
 *   dispatch: function,
 *   search?: string,
 *   state?: object,
 *   onPreviewSectionChange?: function,
 *   unavailableLinkedLabPreviewId?: string | null,
 *   previewConflictNames?: string[]
 * }} props
 */
export default function AvailableCourses({
  availableCourses = [],
  draft = [],
  dispatch,
  search: controlledSearch = '',
  state = null,
  onPreviewSectionChange,
  selectionResetKey = 0,
  repairPreviewId = null,
  repairLockedIds = [],
  repairInteractionLocked = false,
  unavailableLinkedLabPreviewId = null,
  previewConflictNames = [],
  onRequestSwap,
  animatingReturnId = null,
  returningCardId = null,
  linkedOutlineIds = [],
  animatingSwap = null,
}) {
  const [localSearch, setLocalSearch] = useState(controlledSearch);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [keyboardFocusMode, setKeyboardFocusMode] = useState(false);
  const searchInputId = useId();
  const draggedCardIdRef = useRef(null);
  const previousDraftRef = useRef(draft);
  const inputModalityRef = useRef('keyboard');
  const hasUsedPointerRef = useRef(false);
  const hasStartedKeyboardNavigationRef = useRef(false);
  const keyboardPreviewIdRef = useRef(null);
  const pointerPreviewIdRef = useRef(null);
  const rememberedPreviewIdRef = useRef(null);
  const lastKeyboardCourseIdRef = useRef(null);
  const pendingFocusAdvanceRef = useRef(null);
  const courseStateRef = useRef(null);

  // Shaking card id (briefly set when an unavailable or conflicting section is activated).
  const [shakingId, setShakingId] = useState(null);
  const shakeTimerRef = useRef(null);
  const [qHintBounceId, setQHintBounceId] = useState(null);
  const qHintBounceTimerRef = useRef(null);

  // Pointer drag-and-drop state
  const [heldCard, setHeldCard] = useState(null);
  const [pressedCardId, setPressedCardId] = useState(null);
  const pointerStateRef = useRef(null);
  const isRestoringTimeoutRef = useRef(null);
  const preservePreviewOnBlurRef = useRef(false);
  const pendingHistoryFocusRef = useRef(null);
  const undoButtonRef = useRef(null);
  const redoButtonRef = useRef(null);
  const panelRef = useRef(null);
  const coursesTrackRef = useRef(null);
  const courseScrollHoldRef = useRef(null);
  const courseScrollClickRef = useRef(false);
  const leftCourseScrollButtonRef = useRef(null);
  const rightCourseScrollButtonRef = useRef(null);
  const courseScrollFocusDirectionRef = useRef(null);
  const [courseScrollState, setCourseScrollState] = useState({ left: false, right: false });

  const updatePreview = useCallback((sectionId) => {
    if (inputModalityRef.current === 'keyboard') {
      pointerPreviewIdRef.current = null;
    }
    onPreviewSectionChange?.(sectionId ?? pointerPreviewIdRef.current);
  }, [onPreviewSectionChange]);
  const isRepairPreviewActive = Boolean(state?.candidate && !state?.isApplied);
  const [keyboardHintsEnabled] = useKeyboardHints();
  const [qHintPosition, setQHintPosition] = useState(null);

  function focusTimetableSection(sectionId) {
    const section = document.querySelector(
      `[data-testid="timetable-block-${CSS.escape(sectionId)}"]`
    );
    if (!(section instanceof HTMLElement)) return false;
    section.focus();
    return true;
  }

  // Keep local search in sync when controlled search changes
  useEffect(() => {
    setLocalSearch(controlledSearch);
  }, [controlledSearch]);

  useEffect(() => {
    const focusedDirection = courseScrollFocusDirectionRef.current;
    if (!focusedDirection || courseScrollState[focusedDirection]) return;

    const nextDirection = focusedDirection === 'left' ? 'right' : 'left';
    const nextButton = nextDirection === 'left'
      ? leftCourseScrollButtonRef.current
      : rightCourseScrollButtonRef.current;
    if (nextButton && !nextButton.disabled) {
      courseScrollFocusDirectionRef.current = nextDirection;
      nextButton.focus();
    } else {
      courseScrollFocusDirectionRef.current = null;
    }
  }, [courseScrollState]);

  useEffect(() => {
    const previousDraft = previousDraftRef.current;
    const draftChanged = !arraysEqual(previousDraft, draft);
    const returnedSection = previousDraft.some((id) => !draft.includes(id));
    if (pointerPreviewIdRef.current && draft.includes(pointerPreviewIdRef.current)) {
      pointerPreviewIdRef.current = null;
    }
    if (returnedSection) {
      setPressedCardId(null);
      preservePreviewOnBlurRef.current = false;
      updatePreview(null);
    }

    const pendingFocusAdvance = pendingFocusAdvanceRef.current;
    if (pendingFocusAdvance) {
      if (pendingFocusAdvance.fromId || pendingFocusAdvance.focusTimetable) {
        const swapApplied =
          draft.includes(pendingFocusAdvance.activatedId) &&
          (!pendingFocusAdvance.fromId || !draft.includes(pendingFocusAdvance.fromId));
        if (swapApplied) {
          const track = coursesTrackRef.current;
          const returnedCourseCard = pendingFocusAdvance.fromId
            ? track?.querySelector(`[data-course-card-id="${CSS.escape(pendingFocusAdvance.fromId)}"]`)
            : null;
          let focusRestoredCourse = false;
          if (returnedCourseCard instanceof HTMLButtonElement && !returnedCourseCard.disabled) {
            returnedCourseCard.focus();
            focusRestoredCourse = true;
          }
          const focusIncomingSection = !pendingFocusAdvance.fromId &&
            animatingSwap?.incomingId !== pendingFocusAdvance.activatedId &&
            focusTimetableSection(pendingFocusAdvance.activatedId);
          if (focusRestoredCourse || focusIncomingSection) {
            pendingFocusAdvanceRef.current = null;
          }
        } else if (draftChanged) {
          pendingFocusAdvanceRef.current = null;
        }
      } else if (draft.includes(pendingFocusAdvance.activatedId)) {
        const track = coursesTrackRef.current;
        if (pendingFocusAdvance.focusCourseId) {
          const nextCourseCard = track?.querySelector(
            `[data-course-card-id="${CSS.escape(pendingFocusAdvance.focusCourseId)}"]`
          );
          if (nextCourseCard instanceof HTMLButtonElement && !nextCourseCard.disabled) {
            pendingFocusAdvanceRef.current = null;
            nextCourseCard.focus();
          } else if (draftChanged) {
            pendingFocusAdvanceRef.current = null;
          }
        } else {
          pendingFocusAdvanceRef.current = null;
          const nextCard = pendingFocusAdvance.candidateIds
            .map((id) => track?.querySelector(`[data-course-card-id="${CSS.escape(id)}"]`))
            .find(Boolean);
          const firstAvailableCard = track?.querySelector('[data-course-card-id]:not(:disabled)');
          (nextCard || firstAvailableCard)?.focus();
        }
      } else if (draftChanged) {
        pendingFocusAdvanceRef.current = null;
      }
    }
    previousDraftRef.current = draft;
  }, [draft, animatingSwap, updatePreview, returningCardId]);

  useLayoutEffect(() => {
    setPressedCardId(null);
    preservePreviewOnBlurRef.current = false;
    pointerPreviewIdRef.current = null;
  }, [selectionResetKey]);

  useLayoutEffect(() => {
    if (!isRepairPreviewActive) return;

    setHeldCard(null);
    setPressedCardId(null);
    pointerStateRef.current = null;
    if (isRestoringTimeoutRef.current) {
      clearTimeout(isRestoringTimeoutRef.current);
      isRestoringTimeoutRef.current = null;
    }
  }, [isRepairPreviewActive]);

  // Clean up any pending restoration timer on unmount
  useEffect(() => {
    return () => {
      if (isRestoringTimeoutRef.current) {
        clearTimeout(isRestoringTimeoutRef.current);
      }
      if (shakeTimerRef.current) {
        clearTimeout(shakeTimerRef.current);
      }
      if (qHintBounceTimerRef.current) {
        clearTimeout(qHintBounceTimerRef.current);
      }
      stopCourseScroll();
    };
  }, []);

  /**
   * Trigger shake on a full or conflicting section.
   * Removes the class after the animation completes (420 ms).
   * No-op when prefers-reduced-motion is active (CSS handles it already,
   * but we still want the class added so screen readers get the aria-live ping).
   */
  const triggerShake = useCallback((itemId) => {
    if (shakingId === itemId) return; // already shaking
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    setShakingId(itemId);
    shakeTimerRef.current = setTimeout(() => {
      setShakingId(null);
      shakeTimerRef.current = null;
    }, 450); // slightly longer than 420 ms animation
  }, [shakingId]);

  // Undo / Redo / Reset derivations (only when state is wired in)
  const canUndoRepair = state ? canUndo(state) : false;
  const canRedoRepair = state ? canRedo(state) : false;
  const historyTransitionInProgress = Boolean(state?.historyTransition);
  const canActivateUndo = canUndoRepair && !historyTransitionInProgress;
  const canActivateRedo = canRedoRepair && !historyTransitionInProgress;
  const isDraftChanged = state
    ? !arraysEqual(draft, INITIAL_DRAFT)
    : false;

  useLayoutEffect(() => {
    const pendingAction = pendingHistoryFocusRef.current;
    if (!pendingAction || historyTransitionInProgress) return;

    pendingHistoryFocusRef.current = null;
    if (
      pendingAction.action === 'redo' &&
      !canRedoRepair &&
      canUndoRepair &&
      undoButtonRef.current &&
      !undoButtonRef.current.disabled
    ) {
      undoButtonRef.current.focus();
      return;
    }

    const sectionsAddedByRedo = pendingAction.action === 'redo'
      ? draft.filter((id) => !pendingAction.fromDraft.includes(id))
      : [];
    if (sectionsAddedByRedo.some(focusTimetableSection)) return;

    const focusNextAfterRedo = () => {
      const toolbar = redoButtonRef.current?.parentElement;
      const buttons = [...(toolbar?.querySelectorAll('button') || [])];
      const redoIndex = buttons.indexOf(redoButtonRef.current);
      const nextButton = buttons.slice(redoIndex + 1).find((button) => !button.disabled);
      if (nextButton) {
        nextButton.focus();
        return;
      }
      coursesTrackRef.current
        ?.querySelector('[data-course-card-id]:not(:disabled)')
        ?.focus();
    };

    if (pendingAction.action === 'undo') {
      if (canUndoRepair && undoButtonRef.current && !undoButtonRef.current.disabled) {
        undoButtonRef.current.focus();
      } else if (canRedoRepair && redoButtonRef.current && !redoButtonRef.current.disabled) {
        redoButtonRef.current.focus();
      } else {
        focusNextAfterRedo();
      }
      return;
    }

    if (canRedoRepair && redoButtonRef.current && !redoButtonRef.current.disabled) {
      redoButtonRef.current.focus();
    } else if (canUndoRepair && undoButtonRef.current && !undoButtonRef.current.disabled) {
      undoButtonRef.current.focus();
    } else {
      focusNextAfterRedo();
    }
  }, [canRedoRepair, canUndoRepair, draft, historyTransitionInProgress]);

  const query = localSearch.trim().toLowerCase();

  // Selected sections for checking time conflicts
  const selectedSections = availableCourses.filter((item) => draft.includes(item.id));

  // Filter sections that are not already in draft
  const availableItems = availableCourses.filter((item) => !draft.includes(item.id));

  // Search by course code (e.g. "MATH", "MATH-B", "BIO") and course name (e.g. "Mathematics", "Statistics")
  const filteredCourses = availableItems.filter((item) => {
    if (!query) return true;
    const codeMatch =
      item.id?.toLowerCase().includes(query) ||
      item.course?.toLowerCase().includes(query);
    const nameMatch = item.title?.toLowerCase().includes(query);
    return Boolean(codeMatch || nameMatch);
  });
  courseStateRef.current = { availableItems, filteredCourses, availableCourses };
  const availableCount = filteredCourses.filter((item) => !isSectionFull(item)).length;
  const activeQHintCourseId = repairPreviewId || unavailableLinkedLabPreviewId;
  const activeQHintId = keyboardFocusMode &&
    keyboardPreviewIdRef.current === activeQHintCourseId
    ? activeQHintCourseId
    : null;

  useLayoutEffect(() => {
    if (!keyboardHintsEnabled || !activeQHintId) {
      setQHintPosition(null);
      return undefined;
    }

    const updateHintPosition = () => {
      const anchor = document.querySelector(
        `[data-course-action-for="${CSS.escape(activeQHintId)}"]`
      );
      if (!(anchor instanceof HTMLElement)) {
        setQHintPosition(null);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const ownerWindow = anchor.closest('.nb-window');
      const ownerZIndex = Number(ownerWindow?.style.zIndex) || 0;
      const hintRect = {
        left: rect.left + rect.width / 2 - 7,
        right: rect.left + rect.width / 2 + 7,
        top: rect.top - 14,
        bottom: rect.top - 2,
      };
      const overlappingHigherWindowZ = [...document.querySelectorAll('.nb-window')]
        .filter((candidate) => candidate !== ownerWindow && candidate.getClientRects().length > 0)
        .filter((candidate) => {
          const candidateZIndex = Number(candidate.style.zIndex) || 0;
          const candidateRect = candidate.getBoundingClientRect();
          return candidateZIndex > ownerZIndex &&
            hintRect.left < candidateRect.right &&
            hintRect.right > candidateRect.left &&
            hintRect.top < candidateRect.bottom &&
            hintRect.bottom > candidateRect.top;
        })
        .map((candidate) => Number(candidate.style.zIndex) || 0);
      const position = {
        left: rect.left + rect.width / 2,
        top: rect.top - 14,
        zIndex: overlappingHigherWindowZ.length > 0
          ? Math.min(ownerZIndex + 1, Math.max(...overlappingHigherWindowZ) - 1)
          : ownerZIndex + 1,
      };
      setQHintPosition((current) => (
        current?.left === position.left &&
        current?.top === position.top &&
        current?.zIndex === position.zIndex
          ? current
          : position
      ));
    };

    const windowStackObserver = new MutationObserver(updateHintPosition);
    windowStackObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
    updateHintPosition();
    window.addEventListener('resize', updateHintPosition);
    window.addEventListener('scroll', updateHintPosition, true);
    window.addEventListener('pointermove', updateHintPosition);
    return () => {
      window.removeEventListener('resize', updateHintPosition);
      window.removeEventListener('scroll', updateHintPosition, true);
      window.removeEventListener('pointermove', updateHintPosition);
      windowStackObserver.disconnect();
    };
  }, [activeQHintId, keyboardHintsEnabled]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (event.pointerType !== 'mouse') return;
      inputModalityRef.current = 'pointer';
      keyboardPreviewIdRef.current = null;
      setKeyboardFocusMode(false);
    };

    const handlePointerDown = (event) => {
      hasUsedPointerRef.current = true;
      inputModalityRef.current = 'pointer';
      keyboardPreviewIdRef.current = null;
      setKeyboardFocusMode(false);
      if (event.target?.closest?.('[data-repair-action], [data-preview-alert-action]')) return;

      pendingFocusAdvanceRef.current = null;
      const clickedCardId = event.target?.closest?.('[data-course-card-id]')?.dataset.courseCardId;
      const focusedCardId = document.activeElement?.closest?.('[data-course-card-id]')?.dataset.courseCardId;
      rememberedPreviewIdRef.current =
        clickedCardId ||
        keyboardPreviewIdRef.current ||
        lastKeyboardCourseIdRef.current ||
        focusedCardId ||
        null;
      keyboardPreviewIdRef.current = null;
    };

    const handleKeyDown = (event) => {
      inputModalityRef.current = 'keyboard';
      setKeyboardFocusMode(true);
      setPressedCardId(null);
      const target = event.target;
      const isTextEntry = target instanceof HTMLElement && (
        target.isContentEditable ||
        target.matches('input, textarea, select')
      );
      if (isTextEntry) return;

      const isWindowScrollKey = ['arrowup', 'arrowdown', 'w', 's'].includes(event.key.toLowerCase());
      if (isWindowScrollKey && target instanceof HTMLElement && target.closest('.nb-win-body')) return;

      if (event.key === 'Tab' && !hasStartedKeyboardNavigationRef.current) {
        hasStartedKeyboardNavigationRef.current = true;
        const activeElement = document.activeElement;
        if (
          !hasUsedPointerRef.current &&
          !event.shiftKey &&
          !activeElement?.closest?.('.nb-courses-track, [role="alertdialog"], #window-repair')
        ) {
          const firstCard = coursesTrackRef.current
            ?.querySelector('[data-course-card-id]:not(:disabled)');
          if (firstCard) {
            event.preventDefault();
            firstCard.focus();
          }
        }
      }

      const key = event.key.toLowerCase();
      const isContextualActionShortcut =
        (!event.altKey && !event.ctrlKey && !event.metaKey && key === 'q');
      if (isContextualActionShortcut) {
        const focusedCourseCard = document.activeElement?.closest?.('[data-course-card-id]');
        const focusedCourseId = focusedCourseCard?.dataset.courseCardId;
        const contextualAction = focusedCourseId
          ? document.querySelector(`[data-course-action-for="${CSS.escape(focusedCourseId)}"]`)
          : null;
        if (focusedCourseCard && contextualAction) {
          event.preventDefault();
          setQHintBounceId(focusedCourseId);
          if (qHintBounceTimerRef.current) {
            clearTimeout(qHintBounceTimerRef.current);
          }
          qHintBounceTimerRef.current = window.setTimeout(() => {
            setQHintBounceId(null);
            qHintBounceTimerRef.current = null;
          }, 500);
          window.dispatchEvent(new CustomEvent('courseweft:repair-focus-origin', {
            detail: { element: focusedCourseCard, restorePreview: true },
          }));
          contextualAction.click();
          return;
        }
      }

      const focusedCourseId = target instanceof HTMLElement
        ? target.closest('[data-course-card-id]')?.dataset.courseCardId
        : null;
      const rememberedId = rememberedPreviewIdRef.current;
      if (focusedCourseId && rememberedId && rememberedId !== focusedCourseId) {
        rememberedPreviewIdRef.current = null;
        return;
      }
      if (!rememberedId) return;

      rememberedPreviewIdRef.current = null;
      const { availableItems: currentItems, filteredCourses: visibleItems, availableCourses: catalog } =
        courseStateRef.current || {};
      if (!currentItems || !visibleItems || !catalog) return;

      if (currentItems.some((item) => item.id === rememberedId)) {
        keyboardPreviewIdRef.current = rememberedId;
        lastKeyboardCourseIdRef.current = rememberedId;
        updatePreview(rememberedId);
        if (event.key === 'Tab') {
          event.preventDefault();
          coursesTrackRef.current
            ?.querySelector(`[data-course-card-id="${CSS.escape(rememberedId)}"]`)
            ?.focus();
        }
        return;
      }

      const rememberedIndex = catalog.findIndex((item) => item.id === rememberedId);
      const nextItem = visibleItems.find((item) => (
        catalog.findIndex((section) => section.id === item.id) > rememberedIndex
      )) || visibleItems[0];
      if (!nextItem) {
        updatePreview(null);
        return;
      }
      coursesTrackRef.current
        ?.querySelector(`[data-course-card-id="${CSS.escape(nextItem.id)}"]`)
        ?.focus();
    };

    const handleRestoreCoursePreview = (event) => {
      const courseId = event.detail?.courseId;
      if (!courseStateRef.current?.availableCourses.some((item) => item.id === courseId)) return;

      inputModalityRef.current = 'keyboard';
      setKeyboardFocusMode(true);
      keyboardPreviewIdRef.current = courseId;
      lastKeyboardCourseIdRef.current = courseId;
      rememberedPreviewIdRef.current = null;
      updatePreview(courseId);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('courseweft:restore-course-preview', handleRestoreCoursePreview);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('courseweft:restore-course-preview', handleRestoreCoursePreview);
    };
  }, [onPreviewSectionChange]);

  const updateCourseScrollState = useCallback(() => {
    const track = coursesTrackRef.current;
    if (!track) return;
    const nextState = {
      left: track.scrollLeft > 1,
      right: track.scrollLeft + track.clientWidth < track.scrollWidth - 1,
    };
    setCourseScrollState((current) =>
      current.left === nextState.left && current.right === nextState.right
        ? current
        : nextState
    );
  }, []);

  useEffect(() => {
    const track = coursesTrackRef.current;
    if (!track) return undefined;

    updateCourseScrollState();
    track.addEventListener('scroll', updateCourseScrollState, { passive: true });
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateCourseScrollState);
    resizeObserver?.observe(track);
    window.addEventListener('resize', updateCourseScrollState);
    return () => {
      resizeObserver?.disconnect();
      track.removeEventListener('scroll', updateCourseScrollState);
      window.removeEventListener('resize', updateCourseScrollState);
    };
  }, [filteredCourses.length, updateCourseScrollState]);

  function scrollCourses(direction, amount = 90, smooth = true) {
    const track = coursesTrackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * amount,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  function scrollCourseCard(direction) {
    const track = coursesTrackRef.current;
    const card = track?.querySelector('.nb-course-card');
    if (!track || !card) return;
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0;
    scrollCourses(direction, card.getBoundingClientRect().width + gap);
  }

  function stopCourseScroll() {
    const hold = courseScrollHoldRef.current;
    if (!hold) return;
    window.clearTimeout(hold.startTimer);
    cancelAnimationFrame(hold.frameId);
    window.removeEventListener('pointerup', hold.release);
    window.removeEventListener('pointercancel', hold.release);
    courseScrollClickRef.current = hold.started;
    courseScrollHoldRef.current = null;
    updateCourseScrollState();
  }

  function startCourseScroll(direction) {
    stopCourseScroll();
    courseScrollClickRef.current = false;
    const hold = { frameId: null, lastTime: null, release: null, started: false, startTimer: null };
    hold.release = stopCourseScroll;
    const scrollFrame = (time) => {
      if (courseScrollHoldRef.current !== hold) return;
      const track = coursesTrackRef.current;
      if (!track) {
        stopCourseScroll();
        return;
      }

      const elapsedSeconds = hold.lastTime === null
        ? 0
        : Math.min((time - hold.lastTime) / 1000, 0.05);
      hold.lastTime = time;
      track.scrollLeft += direction * elapsedSeconds * 440;

      const reachedEdge = direction < 0
        ? track.scrollLeft <= 0
        : track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
      if (reachedEdge) {
        stopCourseScroll();
        return;
      }

      hold.frameId = requestAnimationFrame(scrollFrame);
    };

    courseScrollHoldRef.current = hold;
    hold.startTimer = window.setTimeout(() => {
      if (courseScrollHoldRef.current !== hold) return;
      hold.started = true;
      hold.frameId = requestAnimationFrame(scrollFrame);
    }, 180);
    window.addEventListener('pointerup', hold.release);
    window.addEventListener('pointercancel', hold.release);
  }

  function handleCourseArrowClick(direction) {
    if (courseScrollClickRef.current) {
      courseScrollClickRef.current = false;
      return;
    }
    scrollCourseCard(direction);
  }

  function handleSearchSubmit(e) {
    e?.preventDefault();
    if (dispatch) {
      dispatch({ type: ACTION.SET_SEARCH, payload: localSearch });
    }
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setLocalSearch(val);
    if (dispatch) {
      dispatch({ type: ACTION.SET_SEARCH, payload: val });
    }
  }

  function handleClearSearch() {
    setLocalSearch('');
    if (dispatch) {
      dispatch({ type: ACTION.SET_SEARCH, payload: '' });
    }
  }

  function handleCardClick(item, dropInfo = null) {
    if (!dispatch || repairLockedIds.includes(item.id)) return;

    // Check if another section of this course component (or declared alternate) is already in the draft
    const draftedAlternate = draft.find((draftId) => {
      const drafted = availableCourses.find((c) => c.id === draftId);
      if (!drafted) return false;
      return (
        (drafted.course === item.course && drafted.component === item.component) ||
        (Array.isArray(item.alternates) && item.alternates.includes(draftId)) ||
        (Array.isArray(drafted.alternates) && drafted.alternates.includes(item.id))
      );
    });

    if (dropInfo) {
      pendingFocusAdvanceRef.current = {
        activatedId: item.id,
        candidateIds: [],
        fromId: draftedAlternate || null,
        focusTimetable: true,
      };
    }

    if (draftedAlternate) {
      if (onRequestSwap) {
        onRequestSwap({ toId: item.id, fromId: draftedAlternate, dropInfo });
      } else {
        // Dispatches switch to replace currently drafted alternate with this section
        dispatch({
          type: ACTION.SWITCH_SECTION,
          payload: { toId: item.id, fromId: draftedAlternate },
        });
      }
    } else {
      // Dispatches add section
      dispatch({
        type: ACTION.ADD_SECTION,
        payload: item.id,
      });
    }
  }

  function handleKeyboardCardActivation(event, item) {
    if (event.detail !== 0 || !dispatch || repairLockedIds.includes(item.id)) return;
    pendingFocusAdvanceRef.current = null;
    event.preventDefault();
    event.currentTarget.focus();

    if (isSectionFull(item)) {
      triggerShake(item.id);
      dispatch({
        type: ACTION.SET_NOTICE,
        payload: {
          kind: 'error',
          title: 'Section is full',
          message: `${item.title} (${item.id}) has no open seats.`,
        },
      });
      return;
    }

    const draftedAlternate = draft.find((draftId) => {
      const drafted = availableCourses.find((course) => course.id === draftId);
      return Boolean(
        drafted &&
        (
          (drafted.course === item.course && drafted.component === item.component) ||
          item.alternates?.includes(draftId) ||
          drafted.alternates?.includes(item.id)
        )
      );
    });
    const conflictingSections = getConflictingSections(
      item,
      selectedSections.filter((section) => section.id !== draftedAlternate)
    );

    if (conflictingSections.length > 0) {
      triggerShake(item.id);
      const conflicts = conflictingSections
        .map((section) => `${section.id} (${formatCourseSlot(section)})`)
        .join('; ');
      dispatch({
        type: ACTION.SET_NOTICE,
        payload: {
          kind: 'error',
          title: 'Class clash',
          message: `${item.title} (${item.id}) conflicts with ${conflicts}. The timetable has not been changed.`,
          emphasizedCourseIds: [item.id, ...conflictingSections.map((section) => section.id)],
        },
      });
      return;
    }

    const currentIndex = filteredCourses.findIndex((course) => course.id === item.id);
    const candidateIds = [
      ...filteredCourses.slice(currentIndex + 1),
      ...filteredCourses.slice(0, Math.max(0, currentIndex)),
    ].map((course) => course.id);
    const requiredCourse = item.requires
      ?.flatMap((requirement) => availableCourses.filter((course) => (
        course.component === requirement.component &&
        course.linkedGroup === requirement.linkedGroup &&
        !draft.includes(course.id) &&
        !isSectionFull(course) &&
        !repairLockedIds.includes(course.id)
      )))
      .find(Boolean);
    pendingFocusAdvanceRef.current = {
      activatedId: item.id,
      candidateIds,
      fromId: draftedAlternate || null,
      focusCourseId: requiredCourse?.id ?? null,
      focusTimetable: !requiredCourse,
    };
    pointerPreviewIdRef.current = null;
    keyboardPreviewIdRef.current = null;
    onPreviewSectionChange?.(null);
    handleCardClick(item);
  }

  function rememberContextualActionOrigin(courseId) {
    const card = document.querySelector(`[data-course-card-id="${CSS.escape(courseId)}"]`);
    if (!(card instanceof HTMLElement)) return;

    window.dispatchEvent(new CustomEvent('courseweft:repair-focus-origin', {
      detail: {
        element: card,
        restorePreview: inputModalityRef.current === 'keyboard',
      },
    }));
  }

  function handlePointerDown(e, item) {
    if (e.button !== 0) return; // Only primary button

    if (repairLockedIds.includes(item.id)) {
      e.preventDefault();
      return;
    }

    if (isSectionFull(item)) {
      e.preventDefault();
      triggerShake(item.id);
      dispatch?.({
        type: ACTION.SET_NOTICE,
        payload: {
          kind: 'error',
          title: 'Section is full',
          message: `${item.title} (${item.id}) has no open seats.`,
        },
      });
      return;
    }

    setPressedCardId(item.id);

    if (heldCard && heldCard.isSticky) return; // Sticky drop is handled by window listener

    if (isRestoringTimeoutRef.current) {
      clearTimeout(isRestoringTimeoutRef.current);
      isRestoringTimeoutRef.current = null;
    }

    const targetEl = e.currentTarget;
    const rect = targetEl.getBoundingClientRect();

    pointerStateRef.current = {
      item,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      origRect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      pointerId: e.pointerId,
      isDragging: false,
    };

    function onPointerMove(moveEvent) {
      if (!pointerStateRef.current) return;
      const cur = pointerStateRef.current;
      const dx = moveEvent.clientX - cur.startX;
      const dy = moveEvent.clientY - cur.startY;

      if (!cur.isDragging) {
        if (hasExceededDragThreshold(dx, dy, POINTER_DRAG_THRESHOLD)) {
          cur.isDragging = true;

          setHeldCard({
            item: cur.item,
            currentX: moveEvent.clientX,
            currentY: moveEvent.clientY,
            offsetX: cur.offsetX,
            offsetY: cur.offsetY,
            origRect: cur.origRect,
            isRestoring: false,
            isSticky: false,
          });
        }
      }

      if (cur.isDragging) {
        setHeldCard({
          item: cur.item,
          currentX: moveEvent.clientX,
          currentY: moveEvent.clientY,
          offsetX: cur.offsetX,
          offsetY: cur.offsetY,
          origRect: cur.origRect,
          isRestoring: false,
          isSticky: false,
        });

        // Show fixed-slot preview as soon as dragging starts
        updatePreview(cur.item.id);
      }
    }

    function cleanupListeners() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('keydown', onKeyDown);
    }

    function cancelAndRestore() {
      cleanupListeners();
      if (!pointerStateRef.current) return;
      const cur = pointerStateRef.current;
      updatePreview(null);

      if (cur.isDragging) {
        setHeldCard({
          item: cur.item,
          currentX: cur.origRect.left + cur.offsetX,
          currentY: cur.origRect.top + cur.offsetY,
          offsetX: cur.offsetX,
          offsetY: cur.offsetY,
          origRect: cur.origRect,
          isRestoring: true,
          isSticky: false,
        });

        isRestoringTimeoutRef.current = setTimeout(() => {
          setHeldCard(null);
          pointerStateRef.current = null;
          isRestoringTimeoutRef.current = null;
        }, 220);
      } else {
        pointerStateRef.current = null;
      }
    }

    function onPointerCancel() {
      cancelAndRestore();
    }

    function onKeyDown(keyEvent) {
      if (keyEvent.key === 'Escape') {
        cancelAndRestore();
      }
    }

    function onPointerUp(upEvent) {
      cleanupListeners();
      if (!pointerStateRef.current) return;
      const cur = pointerStateRef.current;

      if (!cur.isDragging) {
        // A click selects the card for preview without committing it to the timetable.
        rememberedPreviewIdRef.current = cur.item.id;
        lastKeyboardCourseIdRef.current = cur.item.id;
        pointerPreviewIdRef.current = cur.item.id;
        onPreviewSectionChange?.(cur.item.id);
        pointerStateRef.current = null;
        return;
      }

      // Card was dragged via hold-and-drag: evaluate boundary touch with timetable
      const timetableEl = document.querySelector('.nb-tt');
      const timetableRect = timetableEl?.getBoundingClientRect();
      const cardRect = {
        left: upEvent.clientX - cur.offsetX,
        top: upEvent.clientY - cur.offsetY,
        right: upEvent.clientX - cur.offsetX + cur.origRect.width,
        bottom: upEvent.clientY - cur.offsetY + cur.origRect.height,
        width: cur.origRect.width,
        height: cur.origRect.height,
      };

      const touchesTimetable = isCardTouchingTimetable(cardRect, timetableRect);
      const hasConflict = detectTimeConflict(cur.item, selectedSections);
      const dropResult = evaluateDrop({ touchesTimetable, hasConflict });

      if (dropResult.success) {
        // Drop successful: add or switch section and close gap
        setPressedCardId(null);
        // Capture drop coordinates BEFORE clearing held card (origRect will be gone after)
        const dropInfo = {
          dropPoint: { x: upEvent.clientX, y: upEvent.clientY },
          origRect: { ...cur.origRect },  // Section B's original card position in the tray
        };
        updatePreview(null);
        setHeldCard(null);
        pointerStateRef.current = null;
        handleCardClick(cur.item, dropInfo);
      } else {
        if (touchesTimetable && hasConflict) {
          dispatch({
            type: ACTION.SET_NOTICE,
            payload: {
              kind: 'error',
              title: 'Class clash',
              message: `${cur.item.title} (${cur.item.id}) conflicts with a class already on your timetable.`,
            },
          });
        }

        // Red drop or outside timetable: animate back to original position
        preservePreviewOnBlurRef.current = true;
        onPreviewSectionChange?.(cur.item.id);
        setHeldCard({
          item: cur.item,
          currentX: cur.origRect.left + cur.offsetX,
          currentY: cur.origRect.top + cur.offsetY,
          offsetX: cur.offsetX,
          offsetY: cur.offsetY,
          origRect: cur.origRect,
          isRestoring: true,
          isSticky: false,
        });

        isRestoringTimeoutRef.current = setTimeout(() => {
          setHeldCard(null);
          pointerStateRef.current = null;
          isRestoringTimeoutRef.current = null;
        }, 220);
      }
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('keydown', onKeyDown);
  }



  return (
    <div className="flex items-stretch gap-2 w-full font-mono relative">
      {/* ── Available Courses section box ── */}
      <section
        ref={panelRef}
        aria-labelledby="catalogue-heading"
        className="nb-courses-panel relative !overflow-visible flex-1 min-w-0 border-[2.5px] border-[var(--color-navy)] bg-[var(--color-cream)] shadow-none"
        onDragLeave={(e) => {
          if (draggedCardIdRef.current && !e.currentTarget.contains(e.relatedTarget)) {
            updatePreview(draggedCardIdRef.current);
          }
        }}
        onDragEnter={(e) => {
          if (draggedCardIdRef.current && e.currentTarget.contains(e.target)) {
            updatePreview(null);
          }
        }}
      >
        {/* ── Header Bar: Heading on Left, Search on Right ─────────── */}
        <div className="nb-courses-header relative !overflow-visible flex items-center justify-between min-h-[32px] px-2.5 py-1 bg-[var(--color-yellow)] border-b-2 border-[var(--color-navy)] gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <h2
              id="catalogue-heading"
              className="nb-courses-title font-['Archivo_Black',sans-serif] text-[11px] font-black uppercase text-[var(--color-navy)] tracking-wider m-0"
            >
              Available Courses
            </h2>
            <span
              className="nb-courses-count"
              aria-label={`${availableCount} ${availableCount === 1 ? 'course' : 'courses'} available`}
            >
              {availableCount}
            </span>
            {repairPreviewId && dispatch && (
              <div className="nb-context-action relative">
              <button
                type="button"
                aria-label={`Find a valid repair for ${repairPreviewId}`}
                title={`Find a valid repair for ${repairPreviewId}`}
                data-repair-action
                data-course-action-for={repairPreviewId}
                className="nb-repair-action inline-flex h-6 w-6 items-center justify-center rounded border-2 border-[var(--color-navy)] bg-white p-0 transition-transform active:translate-x-0.5 active:translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-navy)] cursor-pointer shrink-0"
                onClick={() => {
                  rememberContextualActionOrigin(repairPreviewId);
                  updatePreview(repairPreviewId);
                  dispatch({ type: ACTION.SET_REQUEST, payload: repairPreviewId });
                  dispatch({
                    type: ACTION.SET_NOTICE,
                    payload: {
                      kind: 'error',
                      title: 'Review the timetable conflict',
                      message: `A valid repair is available for ${repairPreviewId}. Find a valid repair to review possible changes. Your timetable will not change until you apply the repair.`,
                      emphasizedCourseId: repairPreviewId,
                      action: 'suggest',
                    },
                  });
                }}
              >
                <Wrench size={12} strokeWidth={3} aria-hidden="true" />
              </button>
              </div>
            )}
            {unavailableLinkedLabPreviewId && dispatch && (
              <div className="nb-context-action relative">
              <button
                type="button"
                onClick={() => {
                  rememberContextualActionOrigin(unavailableLinkedLabPreviewId);
                  updatePreview(unavailableLinkedLabPreviewId);
                  const lab = availableCourses.find((item) => item.id === unavailableLinkedLabPreviewId);
                  const parent = availableCourses.find((item) => item.id === lab?.requiredBy);
                  const otherLabs = availableCourses.filter((item) =>
                    item.id !== lab?.id &&
                    (item.requiredBy === parent?.id || item.linkedGroup === lab?.linkedGroup)
                  );
                  const alternativesMessage = otherLabs.length > 0 && otherLabs.every(isSectionFull)
                    ? 'All other linked lab sections are full.'
                    : 'No compatible linked lab placement is currently available.';
                  const conflictsMessage = previewConflictNames.length > 0
                    ? `${lab?.id || 'This lab'} conflicts with ${previewConflictNames.join(', ')}. `
                    : '';

                  dispatch({
                    type: ACTION.SET_NOTICE,
                    payload: {
                      kind: 'error',
                      title: 'No compatible lab placement',
                      message: `${conflictsMessage}${alternativesMessage} Please contact your academic advisor or registration office for help.`,
                      emphasizedCourseIds: [lab?.id, ...previewConflictNames].filter(Boolean),
                      action: 'acknowledge',
                    },
                  });
                }}
                aria-label={`Get help finding a compatible lab for ${unavailableLinkedLabPreviewId}`}
                title="No compatible lab placement - contact your academic advisor or registration office"
                data-preview-alert-action
                data-course-action-for={unavailableLinkedLabPreviewId}
                className="nb-preview-alert-action inline-flex h-6 w-6 items-center justify-center rounded border-2 border-[#dc2626] bg-white p-0 text-[#dc2626] transition-transform active:translate-x-0.5 active:translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-navy)] cursor-pointer shrink-0"
              >
                <AlertTriangle size={12} strokeWidth={3} aria-hidden="true" />
              </button>
              </div>
            )}
          </div>

          {/* Search bar on top right replacing static text */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 ml-auto"
            role="search"
            aria-label="Filter available courses"
          >
            <div className="relative flex items-center">
              <input
                id={searchInputId}
                type="text"
                value={localSearch}
                onChange={handleSearchChange}
                placeholder="Search..."
                maxLength={50}
                className="h-6 w-32 sm:w-44 pl-2 pr-6 text-[10px] font-mono font-bold bg-[#fffdf8] border-2 border-[var(--color-navy)] rounded text-[var(--color-navy)] placeholder:text-[var(--color-navy)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]"
                aria-label="Search courses by code or title"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear course search"
                  className="absolute right-1 text-[var(--color-navy)]/60 hover:text-[var(--color-navy)] p-0.5 cursor-pointer"
                >
                  <X size={11} strokeWidth={2.5} aria-hidden="true" />
                </button>
              )}
            </div>

            <button
              type="submit"
              aria-label="Execute course search"
              className="h-6 px-2 text-[9px] font-black font-mono uppercase bg-[var(--color-navy)] text-[var(--color-cream)] rounded hover:opacity-90 active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Search size={10} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <button
              id="reset-timetable-button"
              type="button"
              disabled={!isDraftChanged}
              onClick={() => {
                playSound('popup');
                setShowResetConfirm(true);
              }}
              aria-label="Reset timetable to starting selections"
              title={isDraftChanged ? 'Reset timetable' : 'Timetable is already at starting selections'}
              className={`flex h-6 w-6 items-center justify-center rounded border-2 transition-all ${isDraftChanged
                ? 'border-[var(--color-navy)] bg-white text-[var(--color-navy)] hover:bg-slate-100 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'
                : 'border-[var(--color-navy)]/30 bg-transparent text-[var(--color-navy)]/35 cursor-not-allowed'
                }`}
            >
              <RotateCcw size={12} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </form>
        </div>

        {/* ── Horizontally scrolling row of Neo-Brutalist cards ─────── */}
        <div
          ref={coursesTrackRef}
          onScroll={updateCourseScrollState}
          className="nb-courses-track nb-courses-scroll flex items-stretch gap-2 p-2 overflow-x-auto min-h-[90px]"
          role="list"
          aria-label="Available course sections list"
        >
          {filteredCourses.length > 0 ? (
            filteredCourses.map((item) => {
              const isHeld = Boolean(heldCard && heldCard.item.id === item.id);
              const isReturning = Boolean((animatingReturnId || returningCardId) === item.id);

              if (isHeld || isReturning) {
                return (
                  <div
                    key={item.id}
                    className="nb-course-placeholder self-stretch w-[195px] min-w-[195px] shrink-0 border-2 border-dashed border-[var(--color-navy)]/35 rounded bg-[var(--color-navy)]/5 transition-opacity duration-150"
                    data-testid={isReturning ? `course-return-placeholder-${item.id}` : `course-placeholder-${item.id}`}
                    aria-hidden="true"
                  />
                );
              }

              const seatsRemaining = Math.max(0, item.capacity - item.enrolled);
              const isSwitch = draft.some((draftId) => {
                const drafted = availableCourses.find((c) => c.id === draftId);
                return (
                  drafted &&
                  ((drafted.course === item.course && drafted.component === item.component) ||
                    item.alternates?.includes(draftId))
                );
              });

              const isFullSection = isSectionFull(item);
              const isRepairLocked = repairInteractionLocked || repairLockedIds.includes(item.id);

              const hasLinkedOutline = Boolean(linkedOutlineIds?.includes(item.id));
              const isShaking = shakingId === item.id;

              return (
                <div
                  key={item.id}
                  className="relative flex w-[195px] min-w-[195px] shrink-0 flex-col items-stretch"
                  role="listitem"
                >
                <button
                  type="button"
                  draggable={!isFullSection && !isRepairLocked}
                  disabled={isRepairLocked}
                  data-course-card-id={item.id}
                  onDragStart={(e) => {
                    if (isFullSection || isRepairLocked) {
                      e.preventDefault();
                      if (isFullSection) triggerShake(item.id);
                      return;
                    }
                    e.preventDefault();
                    draggedCardIdRef.current = item.id;
                    e.dataTransfer?.setData(DT_SECTION_ID, item.id);
                    // Also store as plain text for fallback
                    e.dataTransfer?.setData('text/plain', item.id);
                  }}
                  onDragEnd={() => {
                    draggedCardIdRef.current = null;
                    updatePreview(null);
                  }}
                  onFocus={() => {
                    if (inputModalityRef.current !== 'keyboard') return;
                    const isReturningSwappedSection =
                      pendingFocusAdvanceRef.current?.fromId === item.id;
                    if (
                      lastKeyboardCourseIdRef.current !== item.id &&
                      !isReturningSwappedSection
                    ) {
                      pendingFocusAdvanceRef.current = null;
                    }
                    rememberedPreviewIdRef.current = null;
                    keyboardPreviewIdRef.current = item.id;
                    lastKeyboardCourseIdRef.current = item.id;
                    preservePreviewOnBlurRef.current = false;
                    if (!isFullSection) updatePreview(item.id);
                  }}
                  onBlur={(event) => {
                    const focusMovedToScenarios =
                      event.relatedTarget?.closest?.('#window-scenarios, #dock-scenarios');
                    const focusMovedToNotice = event.relatedTarget?.closest?.('[role="alertdialog"]');
                    if (
                      inputModalityRef.current === 'keyboard' &&
                      !preservePreviewOnBlurRef.current &&
                      !focusMovedToScenarios &&
                      !focusMovedToNotice &&
                      !event.relatedTarget?.closest?.('[data-repair-action], [data-preview-alert-action]')
                    ) {
                      if (keyboardPreviewIdRef.current === item.id) {
                        keyboardPreviewIdRef.current = null;
                      }
                      updatePreview(null);
                    }
                  }}
                  onClick={(event) => handleKeyboardCardActivation(event, item)}
                  onPointerDown={(e) => handlePointerDown(e, item)}
                  className={`nb-course-card h-full w-full min-w-0 shrink-0 bg-[var(--color-cream)] border-2 border-[var(--color-navy)] rounded p-2 flex flex-col justify-between gap-1.5 text-left transition-colors duration-75 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-blue)] touch-none ${
                    isFullSection
                      ? 'nb-full-section'
                      : isRepairLocked
                        ? 'nb-repair-locked'
                      : 'cursor-grab hover:bg-[var(--color-yellow)]'
                  } ${
                    hasLinkedOutline ? 'nb-linked-outline' : ''
                  } ${
                    pressedCardId === item.id ? 'nb-course-card--pressed' : ''
                  } ${
                    isShaking ? 'nb-shake' : ''
                  }`}
                  data-linked-outline={hasLinkedOutline ? 'true' : 'false'}
                  data-full-section={isFullSection ? 'true' : 'false'}
                  data-repair-locked={isRepairLocked ? 'true' : 'false'}
                  aria-label={
                    isFullSection
                      ? `${item.title} (${item.id}), ${formatCourseSlot(item)}, FULL - no seats available`
                      : `${item.title} (${item.id}), ${formatCourseSlot(item)}, ${seatsRemaining} seats remaining - press Enter or Space to ${isSwitch ? 'switch' : 'add'}`
                  }
                  aria-keyshortcuts="Enter Space Q"
                  aria-disabled={isFullSection || isRepairLocked ? 'true' : undefined}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="nb-course-id font-['Archivo_Black',sans-serif] text-[11px] font-black text-[var(--color-navy)] tracking-wide">
                        {item.id}
                      </span>
                      <span className="nb-course-badge text-[8px] font-black uppercase tracking-wider bg-[var(--color-navy)] text-[var(--color-cream)] px-1.5 py-0.5 rounded leading-none">
                        {item.component}
                      </span>
                    </div>

                    <h3
                      className="nb-course-name font-mono text-[10.5px] font-bold text-[var(--color-charcoal)] truncate mt-1 text-left"
                      title={item.title}
                    >
                      {item.title}
                    </h3>
                  </div>

                  <div className="nb-course-footer flex items-center justify-between border-t border-[var(--color-navy)]/15 pt-1 mt-1 text-left w-full">
                    <span className="nb-course-time font-mono text-[9px] font-bold text-[var(--color-navy)] whitespace-nowrap">
                      {formatCourseSlot(item)}
                    </span>
                    <div className="flex items-center gap-1">
                      {isFullSection ? (
                        <span className="nb-full-badge" aria-hidden="true">FULL</span>
                      ) : (
                        <>
                          <span className="nb-course-seats font-mono text-[9px] font-extrabold text-[var(--color-charcoal)] whitespace-nowrap">
                            {item.enrolled}/{item.capacity}
                          </span>
                          <Users size={9} strokeWidth={2.5} className="text-[var(--color-charcoal)]/60 shrink-0" aria-hidden="true" />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Live region for shake announcement */}
                  {isShaking && (
                    <span
                      role="alert"
                      aria-live="assertive"
                      className="sr-only"
                    >
                      {item.id} is full. No seats available.
                    </span>
                  )}
                </button>
                </div>
              );

            })
          ) : (
            <div className="flex items-center w-full gap-3 px-1 py-0 text-[var(--color-navy)] font-mono text-[10px] font-bold">
              <span className="opacity-70">No courses found matching &ldquo;{localSearch}&rdquo;.</span>
              <button
                type="button"
                onClick={handleClearSearch}
                className="ml-auto shrink-0 text-[9px] font-black font-mono uppercase underline underline-offset-2 cursor-pointer hover:opacity-75"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Outside vertical toolbar: history and course-tray controls ── */}
      <div
        className="flex flex-col items-center justify-center gap-1 px-1 py-1 bg-[var(--color-cream)] border-[2.5px] border-[var(--color-navy)] shrink-0 shadow-none"
        aria-label="Scroll available courses and timetable history"
      >
        <button
          ref={undoButtonRef}
          id="undo-repair-button"
          type="button"
          disabled={!canUndoRepair && !historyTransitionInProgress}
          aria-disabled={!canUndoRepair || historyTransitionInProgress || undefined}
          onClick={() => {
            if (historyTransitionInProgress || !canUndoRepair || !dispatch) return;
            pendingHistoryFocusRef.current = { action: 'undo', fromDraft: [...draft] };
            playSound('undo');
            dispatch({ type: ACTION.UNDO_REPAIR });
          }}
          aria-label="Undo last timetable change"
          title={
            historyTransitionInProgress
              ? 'Timetable is updating'
              : canUndoRepair
                ? 'Undo last change'
                : 'Nothing to undo'
          }
          className={`flex items-center justify-center w-5 h-5 border-2 transition-colors ${canActivateUndo
            ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-yellow)] hover:bg-[var(--color-yellow)] hover:text-[var(--color-navy)] cursor-pointer'
            : 'border-[var(--color-navy)]/30 bg-transparent text-[var(--color-navy)]/35 cursor-not-allowed'
            }`}
        >
          <Undo2 size={12} strokeWidth={2.5} aria-hidden="true" />
        </button>

        <button
          ref={redoButtonRef}
          id="redo-repair-button"
          type="button"
          disabled={!canRedoRepair && !historyTransitionInProgress}
          aria-disabled={!canRedoRepair || historyTransitionInProgress || undefined}
          onClick={() => {
            if (historyTransitionInProgress || !canRedoRepair || !dispatch) return;
            pendingHistoryFocusRef.current = { action: 'redo', fromDraft: [...draft] };
            playSound('redo');
            dispatch({ type: ACTION.REDO_REPAIR });
          }}
          aria-label="Redo last timetable change"
          title={
            historyTransitionInProgress
              ? 'Timetable is updating'
              : canRedoRepair
                ? 'Redo last change'
                : 'Nothing to redo'
          }
          className={`flex items-center justify-center w-5 h-5 border-2 transition-colors ${canActivateRedo
            ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-yellow)] hover:bg-[var(--color-yellow)] hover:text-[var(--color-navy)] cursor-pointer'
            : 'border-[var(--color-navy)]/30 bg-transparent text-[var(--color-navy)]/35 cursor-not-allowed'
            }`}
        >
          <Redo2 size={12} strokeWidth={2.5} aria-hidden="true" />
        </button>

        <div className="my-1 h-px w-5 shrink-0 bg-[var(--color-navy)]/50" aria-hidden="true" />

        <button
            ref={leftCourseScrollButtonRef}
            type="button"
            disabled={!courseScrollState.left}
            onFocus={() => { courseScrollFocusDirectionRef.current = 'left'; }}
            onPointerDown={(event) => {
              if (event.button === 0) startCourseScroll(-1);
            }}
            onClick={(event) => {
              handleCourseArrowClick(-1);
            }}
            onBlur={stopCourseScroll}
            aria-label="Scroll courses left"
            title="Previous courses"
            className={`flex h-5 w-5 items-center justify-center border-2 transition-colors ${
              courseScrollState.left
                ? 'border-[var(--color-navy)] bg-white text-[var(--color-navy)] hover:bg-[var(--color-yellow)] cursor-pointer'
                : 'border-[var(--color-navy)]/30 bg-transparent text-[var(--color-navy)]/35 cursor-not-allowed'
            }`}
        >
            <ChevronLeft size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>

        <button
            ref={rightCourseScrollButtonRef}
            type="button"
            disabled={!courseScrollState.right}
            onFocus={() => { courseScrollFocusDirectionRef.current = 'right'; }}
            onPointerDown={(event) => {
              if (event.button === 0) startCourseScroll(1);
            }}
            onClick={(event) => {
              handleCourseArrowClick(1);
            }}
            onBlur={stopCourseScroll}
            aria-label="Scroll courses right"
            title="More courses"
            className={`flex h-5 w-5 items-center justify-center border-2 transition-colors ${
              courseScrollState.right
                ? 'border-[var(--color-navy)] bg-white text-[var(--color-navy)] hover:bg-[var(--color-yellow)] cursor-pointer'
                : 'border-[var(--color-navy)]/30 bg-transparent text-[var(--color-navy)]/35 cursor-not-allowed'
            }`}
        >
            <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      {keyboardHintsEnabled && activeQHintId && qHintPosition &&
        typeof document !== 'undefined' && createPortal(
          <span
            className={`nb-keyboard-hint${qHintBounceId === activeQHintId ? ' nb-keyboard-hint--bounce' : ''}`}
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: `${qHintPosition.top}px`,
              left: `${qHintPosition.left}px`,
              bottom: 'auto',
              zIndex: qHintPosition.zIndex,
            }}
          >
            <span className="nb-keyboard-hint-letter">Q</span>
          </span>,
          document.querySelector('.nb-desktop') || document.body
        )}

      {/* ── Reset Confirmation Dialog ── */}
      {showResetConfirm && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1.5px] p-4 select-none font-mono"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            role="alertdialog"
            aria-labelledby="reset-dialog-title"
            aria-describedby="reset-dialog-desc"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-none border-[3px] border-[var(--color-navy)] bg-[#fffdf8] shadow-[6px_6px_0px_0px_var(--color-navy)] overflow-hidden"
          >
            {/* Title Bar */}
            <div className="flex items-center justify-between px-3.5 py-2 bg-[var(--color-yellow)] text-[var(--color-navy)] border-b-[3px] border-[var(--color-navy)]">
              <div className="flex items-center gap-1.5">
                <RotateCcw size={13} strokeWidth={2.5} aria-hidden="true" />
                <span id="reset-dialog-title" className="font-['Archivo_Black',sans-serif] text-[11px] uppercase tracking-wider font-black">
                  Confirm Reset
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                aria-label="Close dialog"
                className="text-[var(--color-navy)] hover:bg-black/10 p-0.5 cursor-pointer transition-colors"
              >
                <X size={14} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-4">
              <p id="reset-dialog-desc" className="text-xs text-[var(--color-navy)] leading-relaxed font-sans font-medium">
                Are you sure you want to reset your timetable? All added or repaired courses will return to the starting selections.
              </p>

              {/* Actions: Cancel vs Confirm Reset */}
              <div className="mt-4 pt-3 border-t border-[var(--color-navy)]/15 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-2 border-[var(--color-navy)] bg-white text-[var(--color-navy)] hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="confirm-reset-button"
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false);
                    if (dispatch) {
                      dispatch({ type: ACTION.RESET_DRAFT });
                    }
                  }}
                  className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider border-2 border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-yellow)] hover:bg-[var(--color-yellow)] hover:text-[var(--color-navy)] transition-colors cursor-pointer"
                >
                  Reset Timetable
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Lifted/Held course card following pointer ── */}
      {heldCard && (
        typeof document !== 'undefined' && document.body
          ? createPortal(
            <div
              className={`nb-course-card-held fixed pointer-events-none z-[9999] select-none ${heldCard.isRestoring ? 'nb-course-card-held--restoring' : ''
                }`}
              style={{
                left: `${heldCard.currentX - heldCard.offsetX}px`,
                top: `${heldCard.currentY - heldCard.offsetY}px`,
                width: `${heldCard.origRect.width}px`,
                height: `${heldCard.origRect.height}px`,
              }}
              data-testid={`course-held-${heldCard.item.id}`}
              data-is-restoring={heldCard.isRestoring ? 'true' : 'false'}
              aria-hidden="true"
            >
              <HeldCardContent
                item={heldCard.item}
                isSwitch={draft.some((draftId) => {
                  const drafted = availableCourses.find((c) => c.id === draftId);
                  return (
                    drafted &&
                    ((drafted.course === heldCard.item.course && drafted.component === heldCard.item.component) ||
                      heldCard.item.alternates?.includes(draftId))
                  );
                })}
                formatCourseSlot={formatCourseSlot}
                hasLinkedOutline={Boolean(linkedOutlineIds?.includes(heldCard.item.id))}
              />
            </div>,
            document.body
          )
          : null
      )}
    </div>
  );
}

// ── Held card floating content───────────────────────────────────

function HeldCardContent({ item, isSwitch, formatCourseSlot, hasLinkedOutline = false }) {
  const seatsRemaining = Math.max(0, item.capacity - item.enrolled);

  return (
    <div
      className={`nb-course-card nb-course-card--lifted w-full h-full bg-[var(--color-cream)] border-2 border-[var(--color-navy)] rounded p-2 flex flex-col justify-between gap-1.5 text-left shadow-[6px_6px_0px_var(--color-navy)] bg-[var(--color-yellow)] cursor-grabbing ${
        hasLinkedOutline ? 'nb-linked-outline' : ''
      }`}
      data-linked-outline={hasLinkedOutline ? 'true' : 'false'}
      aria-hidden="true"
    >
      <div>
        <div className="flex items-center justify-between gap-1.5">
          <span className="nb-course-id font-['Archivo_Black',sans-serif] text-[11px] font-black text-[var(--color-navy)] tracking-wide">
            {item.id}
          </span>
          <span className="nb-course-badge text-[8px] font-black uppercase tracking-wider bg-[var(--color-navy)] text-[var(--color-cream)] px-1.5 py-0.5 rounded leading-none">
            {item.component}
          </span>
        </div>

        <h3
          className="nb-course-name font-mono text-[10.5px] font-bold text-[var(--color-charcoal)] truncate mt-1 text-left"
          title={item.title}
        >
          {item.title}
        </h3>
      </div>

      <div className="nb-course-footer flex items-center justify-between border-t border-[var(--color-navy)]/15 pt-1 mt-1 text-left w-full">
        <span className="nb-course-time font-mono text-[9px] font-bold text-[var(--color-navy)] whitespace-nowrap">
          {formatCourseSlot(item)}
        </span>
        <div className="flex items-center gap-1">
          <span className="nb-course-seats font-mono text-[9px] font-extrabold text-[var(--color-charcoal)] whitespace-nowrap">
            {item.enrolled}/{item.capacity}
          </span>
          <Users size={9} strokeWidth={2.5} className="text-[var(--color-charcoal)]/60 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shallow array equality (order-sensitive). */
function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
