import React from 'react';
import {
  CalendarDays,
  FlaskConical,
  Settings2,
  User,
  ClipboardList,
  Info,
} from 'lucide-react';

const ICON_MAP = {
  schedule:      <CalendarDays  size={16} strokeWidth={2.1} />,
  scenarios:     <FlaskConical  size={16} strokeWidth={2.1} />,
  settings:      <Settings2     size={16} strokeWidth={2.1} />,
  profile:       <User          size={16} strokeWidth={2.1} />,
  courseDetails: <ClipboardList size={16} strokeWidth={2.1} />,
  websiteInfo:   <Info          size={16} strokeWidth={2.1} />,
};

/**
 * Bottom Dock — centered floating pill dock with 6 app tiles:
 *   1. Schedule
 *   2. Demo Scenarios
 *   3. Settings (Themes)
 *   4. Profile (Bill Andrew)
 *   5. Course Details
 *   6. Website Info
 *
 * Each tile features:
 *   - 2.5px solid navy border, rounded corners
 *   - 3px hard right+bottom shadow offset
 *   - Yellow fill when window is open
 *   - Thick rectangular underline bar indicator pinned flush inside bottom edge
 */
export default function BottomBar({ windows, onDockClick }) {
  return (
    <nav className="nb-dock" aria-label="Application dock">
      <div className="nb-dock-inner">
        {windows.map((win) => {
          const isActive = win.isOpen && !win.isMinimized;
          const isMinimized = win.isOpen && win.isMinimized;
          return (
            <button
              key={win.id}
              type="button"
              id={`dock-${win.id}`}
              className={`nb-dock-item${isActive ? ' nb-dock-item--active' : ''}${isMinimized ? ' nb-dock-item--minimized' : ''}`}
              onClick={() => onDockClick(win.id)}
              aria-label={isActive ? `Focus ${win.label}` : isMinimized ? `Restore ${win.label}` : `Open ${win.label}`}
              title={win.label}
            >
              <span className="nb-dock-icon" aria-hidden="true">
                {ICON_MAP[win.id] ?? win.icon}
              </span>
              {win.isOpen && (
                <span
                  className={`nb-dock-dot${isMinimized ? ' nb-dock-dot--minimized' : ''}`}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
