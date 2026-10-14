import React from 'react';

export default function App() {
  return (
    <div className="max-w-[1450px] mx-auto px-4 sm:px-8 min-h-screen flex flex-col justify-between">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-50 focus:bg-[#142b49] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-semibold text-sm"
        href="#main-content"
      >
        Skip to main content
      </a>

      {/* Top Header */}
      <header className="h-20 flex items-center justify-between border-b border-slate-200">
        <a href="#top" className="inline-flex items-center gap-3 no-underline" aria-label="EnrollFix student portal home">
          <span className="w-10 h-10 grid place-items-center rounded-xl bg-[#142b49] text-white font-black text-lg shadow-md shadow-[#142b49]/15" aria-hidden="true">
            E
          </span>
          <span className="flex flex-col leading-tight">
            <strong className="text-base tracking-tight text-[#162b48]">Student Portal</strong>
            <small className="text-[10px] tracking-wider text-slate-500 font-bold uppercase">COURSE REGISTRATION</small>
          </span>
        </a>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-full px-3.5 py-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
            Semester 202520261
          </span>
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 text-xs text-slate-600">
            <span className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 font-bold text-slate-700 grid place-items-center text-xs">
              BA
            </span>
            <span className="font-medium text-slate-800">Bill Andrew</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 py-8">
        <section className="pb-8" id="top" aria-labelledby="page-title">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">
            REGISTRATION / BUILD YOUR TIMETABLE
          </p>
          <h1 id="page-title" className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#162b48]">
            Course registration
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-xl">
            Add a class to your timetable. We’ll let you know if it clashes with something you’ve already selected.
          </p>
        </section>

        {/* Workbench Content Area */}
        <section
          className="min-h-64 flex items-center justify-center border border-dashed border-slate-300 rounded-2xl bg-white/60 text-slate-500 text-sm"
          aria-label="Registration timetable and available courses"
        >
          <p>Registration workbench initializing…</p>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
        <span>Student Portal • Course Registration & Academic Planning</span>
        <span className="text-slate-400">Office of the University Registrar • Semester 202520261</span>
      </footer>
    </div>
  );
}
