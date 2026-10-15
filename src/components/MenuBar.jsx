import React, { useState, useEffect } from 'react';

/**
 * Top menu bar — fixed 34px edge-to-edge:
 *   Left:  EnrollFix Brand logo
 *   Right: Semester badge + Live Clock
 */
export default function MenuBar() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="nb-menubar" role="banner">
      {/* ── Left: Brand ───────────────────────────────── */}
      <div className="nb-menubar-left">
        <span className="nb-menubar-brand">
          <span className="nb-menubar-brand-icon" aria-hidden="true">E</span>
          EnrollFix
        </span>
      </div>

      {/* ── Right: Semester + Live Clock ─────────────── */}
      <div className="nb-menubar-right">
        <span className="nb-menubar-semester" aria-label="Current semester: 202520261">
          Semester&nbsp;·&nbsp;202520261
        </span>

        <time
          className="nb-menubar-clock"
          aria-label={`Current time: ${timeStr}`}
          dateTime={now.toISOString()}
        >
          {timeStr}
        </time>
      </div>
    </header>
  );
}
