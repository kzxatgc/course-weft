import { useState, useCallback, useEffect, useRef } from 'react';

const COMPACT_VIEWPORT_MAX_WIDTH = 640;

/** Window configurations - order matches the dock left-to-right. */
export const WINDOW_CONFIGS = [
  {
    id: 'schedule',
    title: 'Schedule',
    icon: '📅',
    label: 'Schedule',
    defaultOpen: true,
    defaultPos: { x: 20, y: 40 },
    width: 'fluid',   // uses most viewport width
  },
  {
    id: 'scenarios',
    title: 'Demo Scenarios',
    icon: '🧪',
    label: 'Scenarios',
    defaultOpen: false,
    defaultPos: { x: 740, y: 54 },
    width: 480,
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: '⚙',
    label: 'Settings',
    defaultOpen: false,
    defaultPos: { x: 700, y: 78 },
    width: 500,
  },
  {
    id: 'profile',
    title: 'Profile',
    icon: '👤',
    label: 'Profile',
    defaultOpen: false,
    defaultPos: { x: 760, y: 102 },
    width: 440,
  },
  {
    id: 'courseDetails',
    title: 'Course Details',
    icon: '📋',
    label: 'Courses',
    defaultOpen: false,
    defaultPos: { x: 720, y: 126 },
    width: 480,
  },
  {
    id: 'websiteInfo',
    title: 'Information',
    icon: 'ℹ',
    label: 'Info',
    defaultOpen: false,
    defaultPos: { x: 760, y: 150 },
    width: 520,
  },
];

/** Dynamic windows that appear in the dock only when open/active. */
export const DYNAMIC_WINDOW_CONFIGS = [
  {
    id: 'repair',
    title: 'Schedule Repair',
    icon: '🔧',
    label: 'Repair',
    defaultOpen: false,
    defaultPos: { x: 260, y: 70 },
    width: 720,
    isDynamic: true,
  },
];

/**
 * Manages open/closed, minimized, position, and z-index for all desktop windows.
 * Window positions are stored in React state; drag commits on pointer-up.
 */
export function useWindowManager() {
  const hasMovedSchedule = useRef(false);
  const wideViewportPositions = useRef(null);

  const [windows, setWindows] = useState(() => {
    const initialWindows = [...WINDOW_CONFIGS, ...DYNAMIC_WINDOW_CONFIGS].map((cfg, i) => {
      let initialPos = cfg.defaultPos;
      if (typeof window !== 'undefined') {
        if (cfg.id === 'schedule') {
          const scheduleWidth = Math.min(1280, window.innerWidth - 40);
          const centerX = Math.max(0, Math.round((window.innerWidth - scheduleWidth) / 2));
          initialPos = { x: centerX, y: cfg.defaultPos.y };
        } else if (typeof cfg.width === 'number') {
          // Randomly choose either left or right side for supporting windows
          const isRight = Math.random() < 0.5;
          const offset = 24 + Math.round(Math.random() * 40);
          const posX = isRight
            ? Math.max(20, window.innerWidth - cfg.width - offset)
            : offset;
          const posY = 48 + Math.round(Math.random() * 50);
          initialPos = { x: posX, y: posY };
        }
      }
      return {
        ...cfg,
        isOpen: cfg.defaultOpen,
        isMinimized: false,
        pos: initialPos,
        zIndex: 10 + i,
      };
    });

    wideViewportPositions.current = new Map(
      initialWindows.map(({ id, pos }) => [id, pos])
    );
    if (typeof window === 'undefined' || window.innerWidth > COMPACT_VIEWPORT_MAX_WIDTH) {
      return initialWindows;
    }

    return initialWindows.map((win) => {
      const windowWidth = win.width === 'fluid'
        ? Math.min(1280, window.innerWidth - 40)
        : Math.min(win.width, window.innerWidth - 16);
      return {
        ...win,
        pos: {
          ...win.pos,
          x: Math.max(0, Math.round((window.innerWidth - windowWidth) / 2)),
        },
      };
    });
  });

  // Keep windows centered on compact viewports without replacing their wide-screen layout.
  useEffect(() => {
    function handleResize() {
      const isCompactViewport = window.innerWidth <= COMPACT_VIEWPORT_MAX_WIDTH;
      const widePositions = wideViewportPositions.current;
      setWindows((ws) =>
        ws.map((win) => {
          if (!isCompactViewport) {
            const widePos = widePositions?.get(win.id);
            return widePos ? { ...win, pos: widePos } : win;
          }

          const windowWidth = win.width === 'fluid'
            ? Math.min(1280, window.innerWidth - 40)
            : Math.min(win.width, window.innerWidth - 16);
          return {
            ...win,
            pos: {
              ...win.pos,
              x: Math.max(0, Math.round((window.innerWidth - windowWidth) / 2)),
            },
          };
        })
      );
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /** Bring a specific window to the front without toggling open state. */
  const bringToFront = useCallback((id) => {
    setWindows((ws) => {
      const maxZ = Math.max(...ws.map((w) => w.zIndex));
      return ws.map((w) => (w.id === id ? { ...w, zIndex: maxZ + 1 } : w));
    });
  }, []);

  /** Open a window (or un-minimize it) and bring it to front. */
  const openWindow = useCallback((id) => {
    setWindows((ws) => {
      const maxZ = Math.max(...ws.map((w) => w.zIndex));
      return ws.map((w) => {
        if (w.id !== id) return w;
        return { ...w, isOpen: true, isMinimized: false, zIndex: maxZ + 1 };
      });
    });
  }, []);

  /** Hide a window (dock item can reopen it). */
  const closeWindow = useCallback((id) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, isOpen: false } : w)));
  }, []);

  /** Toggle minimized state (title-bar only / restored body). */
  const minimizeWindow = useCallback((id) => {
    setWindows((ws) =>
      ws.map((w) => (w.id === id ? { ...w, isMinimized: !w.isMinimized } : w))
    );
  }, []);

  /** Commit the drag final position after pointer-up. */
  const moveWindow = useCallback((id, newPos) => {
    if (id === 'schedule') {
      hasMovedSchedule.current = true;
    }
    if (typeof window !== 'undefined' && window.innerWidth > COMPACT_VIEWPORT_MAX_WIDTH) {
      wideViewportPositions.current?.set(id, newPos);
    }
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, pos: newPos } : w)));
  }, []);

  return { windows, bringToFront, openWindow, closeWindow, minimizeWindow, moveWindow };
}
