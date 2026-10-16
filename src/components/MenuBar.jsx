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
    <header className="fixed left-0 top-0 z-[2000] flex h-[34px] w-[calc(100%*var(--zoom-factor,1))] origin-top-left flex-nowrap items-center justify-between border-b-2 border-[var(--color-navy)] bg-[var(--color-cream)] px-4 [transform:scale(calc(1/var(--zoom-factor,1)))] [box-sizing:border-box] [user-select:none]" role="banner">
      {/* ── Left: Brand ───────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 items-center gap-[7px] font-['Archivo_Black',sans-serif] text-sm font-black tracking-[0.02em] text-[var(--color-navy)]">
          <span className="grid h-[22px] w-[22px] shrink-0 place-items-center bg-[var(--color-navy)] font-['Archivo_Black',sans-serif] text-xs font-black text-[var(--color-yellow)]" aria-hidden="true">E</span>
          EnrollFix
        </span>
      </div>

      {/* ── Right: Semester + Live Clock ─────────────── */}
      <div className="mr-3 flex shrink-0 items-center gap-2">
        <span className="inline-block whitespace-nowrap border-[1.75px] border-[var(--color-navy)] bg-[var(--color-yellow)] px-[7px] py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-navy)]" aria-label="Current semester: 202520261">
          Semester&nbsp;·&nbsp;202520261
        </span>

        <time
          className="font-mono text-[11px] font-bold tracking-[0.02em] text-[var(--color-navy)]"
          aria-label={`Current time: ${timeStr}`}
          dateTime={now.toISOString()}
        >
          {timeStr}
        </time>
      </div>
    </header>
  );
}
