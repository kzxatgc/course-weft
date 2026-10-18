import React, { useEffect, useRef } from 'react';

import Notice from './Notice.jsx';
import RepairPreview from './components/RepairPreview.jsx';
import { ACTION } from './state/draft-controller.mjs';

import { useTheme } from './hooks/useTheme.js';
import { useWindowManager } from './hooks/useWindowManager.js';
import { useZoom } from './hooks/useZoom.js';

import MenuBar from './components/MenuBar.jsx';
import BottomBar from './components/BottomBar.jsx';
import DesktopWindow from './components/DesktopWindow.jsx';

import SettingsWindow from './windows/SettingsWindow.jsx';
import ProfileWindow from './windows/ProfileWindow.jsx';
import CourseDetailsWindow from './windows/CourseDetailsWindow.jsx';
import ScenarioWindow from './windows/ScenarioWindow.jsx';
import WebsiteInfo from './windows/WebsiteInfo.jsx';

function getVisibleWindowTabStops(windowElement) {
  return [...windowElement.querySelectorAll(
    'a[href], button, input, select, textarea, [tabindex]'
  )].filter((element) =>
    element.tabIndex >= 0 &&
    !element.matches(':disabled') &&
    !element.closest('[hidden], [inert]') &&
    element.getClientRects().length > 0
  );
}

function getWindowEntryTarget(windowId, windowElement) {
  const entrySelectors = {
    schedule: '[data-course-card-id]:not(:disabled)',
    scenarios: '.nb-scenario-select-btn',
    settings: '.nb-theme-card',
    profile: '[aria-label^="Minimize "]',
    courseDetails: '#course-details-search',
  };
  const entrySelector = entrySelectors[windowId];
  const entryTarget = entrySelector
    ? windowElement.querySelector(entrySelector)
    : null;
  if (entryTarget instanceof HTMLElement && entryTarget.tabIndex >= 0) {
    return entryTarget;
  }

  if (windowId === 'schedule') {
    const searchTarget = windowElement.querySelector(
      'input[aria-label="Search courses by code or title"]'
    );
    if (searchTarget instanceof HTMLElement && searchTarget.tabIndex >= 0) {
      return searchTarget;
    }
  }

  return getVisibleWindowTabStops(windowElement)[0] || null;
}

/**
 * AppShell — neo-brutalist desktop OS container for Course Weft.
 *
 * Provides:
 * - Fixed top MenuBar (brand + clock)
 * - Cream dot-grid desktop area
 * - Five draggable, resizable, closable DesktopWindows
 *   (Schedule, Settings, Profile, Course Details, Website Info)
 * - Fixed bottom Dock with open/focus/reopen per window
 * - Five-palette theme system (persisted to localStorage)
 * - Accessible: keyboard Skip link, role=dialog windows, aria-labels throughout
 *
 * @param {{ state, dispatch, children }} props
 *   children — the Schedule workspace (EarlySchedulePreview)
 */
export default function AppShell({ state, dispatch, children }) {
  useZoom();
  const repairFocusOriginRef = useRef(null);
  const { notice, scenario, availableCourses } = state;
  const { themeId, selectTheme, themes } = useTheme();
  const {
    windows,
    bringToFront,
    openWindow,
    closeWindow,
    minimizeWindow,
    moveWindow,
  } = useWindowManager();

  useEffect(() => {
    const rememberRepairFocusOrigin = (event) => {
      const element = event.detail?.element;
      if (!(element instanceof HTMLElement)) return;

      const cards = [...document.querySelectorAll('[data-course-card-id]')];
      repairFocusOriginRef.current = {
        element,
        index: cards.indexOf(element),
      };
    };

    window.addEventListener('courseweft:repair-focus-origin', rememberRepairFocusOrigin);
    return () => {
      window.removeEventListener('courseweft:repair-focus-origin', rememberRepairFocusOrigin);
    };
  }, []);

  useEffect(() => {
    const focusDockWindowEntry = (event) => {
      if (event.key !== 'Tab') return;

      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;

      const activeWindow = target.closest('.nb-window[id^="window-"]');
      if (activeWindow) {
        const tabStops = getVisibleWindowTabStops(activeWindow);
        const windowId = activeWindow.id.slice('window-'.length);
        const dockButtons = [...document.querySelectorAll('.nb-dock .nb-dock-item:not(:disabled)')];
        const currentDockIndex = dockButtons.findIndex((button) => button.id === `dock-${windowId}`);

        if (windowId === 'profile') {
          if (event.shiftKey) {
            const minimizeButton = activeWindow.querySelector('[aria-label="Minimize Profile"]');
            const closeButton = activeWindow.querySelector('[aria-label="Close Profile"]');
            if (target === minimizeButton && closeButton instanceof HTMLElement) {
              event.preventDefault();
              closeButton.focus();
              return;
            }

            if (target === closeButton) {
              const previousDockButton = currentDockIndex > 0
                ? dockButtons[currentDockIndex - 1]
                : null;
              if (previousDockButton) {
                event.preventDefault();
                previousDockButton.focus();
                return;
              }
            } else if (minimizeButton instanceof HTMLElement) {
              event.preventDefault();
              minimizeButton.focus();
              return;
            }
          } else {
            const nextDockButton = currentDockIndex >= 0
              ? dockButtons[currentDockIndex + 1]
              : null;
            if (nextDockButton) {
              event.preventDefault();
              nextDockButton.focus();
              return;
            }
          }
        }

        if (event.shiftKey) {
          if (tabStops[0] !== target) return;

          const previousDockButton = currentDockIndex > 0
            ? dockButtons[currentDockIndex - 1]
            : null;
          if (previousDockButton) {
            event.preventDefault();
            previousDockButton.focus();
          }
          return;
        }

        if (tabStops[tabStops.length - 1] !== target) return;

        const nextDockButton = currentDockIndex >= 0 ? dockButtons[currentDockIndex + 1] : null;
        if (nextDockButton) {
          event.preventDefault();
          nextDockButton.focus();
        }
        return;
      }

      const dockButton = target.closest('.nb-dock-item');
      const windowId = dockButton?.id.replace(/^dock-/, '');
      const windowState = windows.find((win) => win.id === windowId);
      if (!windowState?.isOpen) return;

      const windowElement = document.getElementById(`window-${windowId}`);
      if (!windowElement) return;
      const targetInWindow = getWindowEntryTarget(windowId, windowElement);
      if (!(targetInWindow instanceof HTMLElement)) return;

      if (windowState.isMinimized) {
        event.preventDefault();
        openWindow(windowId);
        requestAnimationFrame(() => {
          const restoredWindow = document.getElementById(`window-${windowId}`);
          getWindowEntryTarget(windowId, restoredWindow)?.focus();
        });
        return;
      }

      const topZIndex = Math.max(
        0,
        ...windows.filter((win) => win.isOpen && !win.isMinimized).map((win) => win.zIndex)
      );
      if (windowState.zIndex < topZIndex) bringToFront(windowId);
      event.preventDefault();
      targetInWindow.focus();
    };

    document.addEventListener('keydown', focusDockWindowEntry, true);
    return () => document.removeEventListener('keydown', focusDockWindowEntry, true);
  }, [bringToFront, openWindow, windows]);

  function restoreRepairFocusOrigin() {
    const origin = repairFocusOriginRef.current;
    repairFocusOriginRef.current = null;
    if (!origin) return;

    const cards = [...document.querySelectorAll('[data-course-card-id]:not(:disabled)')];
    const fallbackCard = cards[Math.min(Math.max(origin.index, 0), cards.length - 1)];
    const target = origin.element.isConnected && !origin.element.disabled
      ? origin.element
      : fallbackCard;
    focusCourseCard(target);
  }

  function focusCourseCard(card) {
    if (!card) return;

    const courseId = card.dataset.courseCardId;
    if (courseId) {
      window.dispatchEvent(new CustomEvent('courseweft:restore-course-preview', {
        detail: { courseId },
      }));
    }

    requestAnimationFrame(() => {
      if (card.isConnected && !card.disabled) card.focus();
    });
  }

  function closeRepairAfterApply() {
    closeWindow('repair');
  }

  useEffect(() => {
    if (!state.isApplied || notice?.title !== 'Timetable updated') return;

    const origin = repairFocusOriginRef.current;
    if (!origin) return;
    repairFocusOriginRef.current = null;

    const requestedCourse = availableCourses.find(
      (course) => course.id === (state.request || origin.element.dataset.courseCardId)
    );
    const requiredGroups = requestedCourse?.requires?.map((requirement) => requirement.linkedGroup) || [];
    const linkedFollowup = availableCourses.find((course) =>
      !state.draft.includes(course.id) &&
      (
        course.requiredBy === requestedCourse?.id ||
        Boolean(course.linkedGroup && requiredGroups.includes(course.linkedGroup))
      )
    );
    const linkedCard = linkedFollowup
      ? document.querySelector(`[data-course-card-id="${CSS.escape(linkedFollowup.id)}"]:not(:disabled)`)
      : null;
    if (linkedCard) {
      focusCourseCard(linkedCard);
      return;
    }

    const cards = [...document.querySelectorAll('[data-course-card-id]:not(:disabled)')];
    const nextCard = cards[Math.min(Math.max(origin.index, 0), cards.length - 1)];
    focusCourseCard(nextCard);
  }, [availableCourses, notice, state.draft, state.isApplied, state.request]);

  function restoreNoticeFocus() {
    restoreRepairFocusOrigin();
  }

  function closeWindowAndFocusDock(id) {
    closeWindow(id);
    requestAnimationFrame(() => {
      document.getElementById(`dock-${id}`)?.focus();
    });
  }

  function handleDockClick(id) {
    const win = windows.find((w) => w.id === id);
    if (!win) return;

    const openWindows = windows.filter((w) => w.isOpen && !w.isMinimized);
    const topZ = openWindows.length > 0 ? Math.max(...openWindows.map((w) => w.zIndex)) : 0;
    const isCurrentlyOnTop = win.isOpen && !win.isMinimized && win.zIndex === topZ;

    if (isCurrentlyOnTop) {
      // Window is already open and on top — minimize it
      minimizeWindow(id);
    } else if (win.isOpen && !win.isMinimized) {
      // Window is open but behind others — bring to front
      bringToFront(id);
    } else {
      // Window is closed or minimized — open and bring to front
      openWindow(id);
    }
  }

  function handleSaveSchedule() {
    dispatch({
      type: ACTION.SET_NOTICE,
      payload: {
        kind: 'success',
        title: 'Schedule saved',
        message: 'Schedule saved successfully. (Demo confirmation only; nothing was stored or sent.)',
      },
    });
  }

  const scheduleWin = windows.find((w) => w.id === 'schedule');
  const repairWin = windows.find((w) => w.id === 'repair');
  const isRepairFlowLocked = Boolean(
    state.candidate && !state.isApplied && repairWin?.isOpen && !repairWin.isMinimized
  );

  return (
    <>
      {/* ── Top Menu Bar (brand logo left, semester + clock right) ─── */}
      <MenuBar />

      {/* ── Desktop Area ─────────────────────────────────────── */}
      <div className="nb-desktop fixed bottom-0 left-0 right-0 overflow-hidden bg-[var(--color-cream)] [top:calc(34px/var(--zoom-factor,1))]" aria-label="Desktop" role="main">
        {/* polite live region for screen-readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only" id="nb-live" />

        {/* ── Schedule Window ──────────────────────────────── */}
        {scheduleWin && (
          <DesktopWindow
            {...scheduleWin}
            width={Math.min(1280, typeof window !== 'undefined' ? window.innerWidth - 40 : 1280)}
            maxBodyHeight="calc(100vh - 141px)"
            onClose={closeWindowAndFocusDock}
            onMinimize={minimizeWindow}
            onFocus={bringToFront}
            onMove={moveWindow}
            onSave={handleSaveSchedule}
            inert={isRepairFlowLocked}
          >
            <div id="schedule-workspace" className="relative">
              {/* Notice banner (conflict alerts, repair prompts, success popups) */}
              <Notice
                notice={notice}
                onDismiss={() => {
                  dispatch({ type: ACTION.CLEAR_NOTICE });
                  if (notice?.action === 'suggest') {
                    closeWindow('repair');
                  }
                  if (notice?.action === 'suggest' || notice?.action === 'acknowledge') {
                    restoreNoticeFocus();
                  } else {
                    repairFocusOriginRef.current = null;
                  }
                }}
                onAction={() => {
                  dispatch({ type: ACTION.SUGGEST_REPAIR });
                  openWindow('repair');
                }}
              />

              {/* Schedule workspace content (EarlySchedulePreview) */}
              {children}
            </div>
          </DesktopWindow>
        )}

        {/* Schedule Repair Window */}
        {repairWin && (
          isRepairFlowLocked && (
            <div
              className="fixed inset-0 z-[1000]"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-yellow) 22%, transparent)' }}
              aria-hidden="true"
            />
          )
        )}
        {repairWin && (
          <DesktopWindow
            {...repairWin}
            zIndex={isRepairFlowLocked ? 1001 : repairWin.zIndex}
            locked={isRepairFlowLocked}
            allowDragWhenLocked
            centerOn="schedule"
            onClose={() => {
              repairFocusOriginRef.current = null;
              closeWindow('repair');
            }}
            onMinimize={minimizeWindow}
            onFocus={bringToFront}
            onMove={moveWindow}
          >
            <RepairPreview
              state={state}
              dispatch={dispatch}
              onClose={() => {
                if (state.isApplied) closeRepairAfterApply();
                else {
                  closeWindow('repair');
                  restoreRepairFocusOrigin();
                }
              }}
            />
          </DesktopWindow>
        )}

        {/* ── Scenarios Window ─────────────────────────────── */}
        {windows.find((w) => w.id === 'scenarios') && (
          <DesktopWindow
            {...windows.find((w) => w.id === 'scenarios')}
            onClose={closeWindowAndFocusDock}
            onMinimize={minimizeWindow}
            onFocus={bringToFront}
            onMove={moveWindow}
            inert={isRepairFlowLocked}
          >
            <ScenarioWindow
              scenario={scenario}
              dispatch={dispatch}
            />
          </DesktopWindow>
        )}

        {/* ── Settings Window ──────────────────────────────── */}
        {windows.find((w) => w.id === 'settings') && (
          <DesktopWindow
            {...windows.find((w) => w.id === 'settings')}
            onClose={closeWindowAndFocusDock}
            onMinimize={minimizeWindow}
            onFocus={bringToFront}
            onMove={moveWindow}
            inert={isRepairFlowLocked}
          >
            <SettingsWindow
              themes={themes}
              themeId={themeId}
              onSelectTheme={selectTheme}
            />
          </DesktopWindow>
        )}

        {/* ── Profile Window ───────────────────────────────── */}
        {windows.find((w) => w.id === 'profile') && (
          <DesktopWindow
            {...windows.find((w) => w.id === 'profile')}
            onClose={closeWindowAndFocusDock}
            onMinimize={minimizeWindow}
            onFocus={bringToFront}
            onMove={moveWindow}
            inert={isRepairFlowLocked}
          >
            <ProfileWindow />
          </DesktopWindow>
        )}

        {/* ── Course Details Window ────────────────────────── */}
        {windows.find((w) => w.id === 'courseDetails') && (
          <DesktopWindow
            {...windows.find((w) => w.id === 'courseDetails')}
            onClose={closeWindowAndFocusDock}
            onMinimize={minimizeWindow}
            onFocus={bringToFront}
            onMove={moveWindow}
            inert={isRepairFlowLocked}
          >
            <CourseDetailsWindow availableCourses={availableCourses} />
          </DesktopWindow>
        )}

        {/* —— Website Info Window ———————————————————————— */}
        {windows.find((w) => w.id === 'websiteInfo') && (
          <DesktopWindow
            {...windows.find((w) => w.id === 'websiteInfo')}
            onClose={closeWindowAndFocusDock}
            onMinimize={minimizeWindow}
            onFocus={bringToFront}
            onMove={moveWindow}
          >
            <WebsiteInfo />
          </DesktopWindow>
        )}
      </div>

      {/* ── Bottom Dock (6 application tiles) ─────────────── */}
      <BottomBar
        windows={windows}
        onDockClick={handleDockClick}
        disabled={isRepairFlowLocked}
      />
    </>
  );
}
