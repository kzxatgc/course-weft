import React from 'react';

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

/**
 * AppShell — neo-brutalist desktop OS container for EnrollFix.
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
  const { notice, scenario } = state;
  const { themeId, selectTheme, themes } = useTheme();
  const {
    windows,
    bringToFront,
    openWindow,
    closeWindow,
    minimizeWindow,
    moveWindow,
  } = useWindowManager();

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

  const scheduleWin = windows.find((w) => w.id === 'schedule');
  const repairWin = windows.find((w) => w.id === 'repair');
  const isRepairFlowLocked = Boolean(
    state.candidate && !state.isApplied && repairWin?.isOpen && !repairWin.isMinimized
  );

  return (
    <>
      {/* Skip to main content (keyboard) */}
      <a href="#schedule-workspace" className="nb-skip-link">
        Skip to schedule
      </a>

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
            onClose={closeWindow}
            onMinimize={minimizeWindow}
            onFocus={bringToFront}
            onMove={moveWindow}
            inert={isRepairFlowLocked}
          >
            <div id="schedule-workspace">
              {/* Notice banner (conflict alerts, repair prompts, success popups) */}
              <Notice
                notice={notice}
                onDismiss={() => {
                  dispatch({ type: ACTION.CLEAR_NOTICE });
                  if (notice?.action !== 'acknowledge') closeWindow('repair');
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
            onClose={() => closeWindow('repair')}
            onMinimize={minimizeWindow}
            onFocus={bringToFront}
            onMove={moveWindow}
          >
            <RepairPreview
              state={state}
              dispatch={dispatch}
              onClose={() => closeWindow('repair')}
            />
          </DesktopWindow>
        )}

        {/* ── Scenarios Window ─────────────────────────────── */}
        {windows.find((w) => w.id === 'scenarios') && (
          <DesktopWindow
            {...windows.find((w) => w.id === 'scenarios')}
            onClose={closeWindow}
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
            onClose={closeWindow}
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
            onClose={closeWindow}
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
            onClose={closeWindow}
            onMinimize={minimizeWindow}
            onFocus={bringToFront}
            onMove={moveWindow}
            inert={isRepairFlowLocked}
          >
            <CourseDetailsWindow />
          </DesktopWindow>
        )}

        {/* —— Website Info Window ———————————————————————— */}
        {windows.find((w) => w.id === 'websiteInfo') && (
          <DesktopWindow
            {...windows.find((w) => w.id === 'websiteInfo')}
            onClose={closeWindow}
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
