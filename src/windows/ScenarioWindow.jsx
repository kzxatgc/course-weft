import React from 'react';
import { RotateCcw, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { ACTION } from '../state/draft-controller.mjs';

/**
 * Scenario window content — allows switching between demo test scenarios
 * and resetting the timetable draft.
 */
export default function ScenarioWindow({ scenario, dispatch }) {
  const scenarios = [
    {
      id: 'main',
      name: 'Successful repair available',
      tag: 'Primary flow',
      icon: <Sparkles size={18} aria-hidden="true" />,
      desc: 'Demonstrates intelligent schedule conflict repair. When a time overlap occurs between CS 101 Lecture and MATH 201, EnrollFix suggests moving MATH 201 to an open alternate section.',
      bullet: 'Suggested alternate: MATH 201 Section B (Fri 14:00–16:00)',
    },
    {
      id: 'noRepair',
      name: 'No repair available',
      tag: 'Refusal flow',
      icon: <AlertTriangle size={18} aria-hidden="true" />,
      desc: 'Demonstrates graceful refusal and fallback advisory. Alternate sections are filled or produce secondary conflicts, showing clear explanation without mutating the student draft.',
      bullet: 'Advisory guidance: Contact academic advisor or join waitlist',
    },
  ];

  return (
    <div className="nb-win-section">
      <div className="nb-win-header">
        <h2 className="nb-win-heading">Demo Scenarios</h2>
        <span className="nb-badge">Evaluation mode</span>
      </div>

      <p className="nb-win-desc">
        Select a test scenario to evaluate the EnrollFix timetable repair engine.
        Changing scenarios updates the catalog and current schedule draft.
      </p>

      {/* Scenario cards */}
      <div className="nb-scenario-list" role="radiogroup" aria-label="Demo scenarios">
        {scenarios.map((sc) => {
          const isSelected = scenario === sc.id;
          return (
            <div
              key={sc.id}
              className={`nb-scenario-card${isSelected ? ' nb-scenario-card--active' : ''}`}
              onClick={() => dispatch && dispatch({ type: ACTION.SELECT_SCENARIO, payload: sc.id })}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  dispatch && dispatch({ type: ACTION.SELECT_SCENARIO, payload: sc.id });
                }
              }}
            >
              <div className="nb-scenario-card-header">
                <span className="nb-scenario-card-title">
                  {sc.icon}
                  {sc.name}
                </span>
                {isSelected ? (
                  <span className="nb-badge nb-badge--active-scenario">
                    <CheckCircle2 size={11} aria-hidden="true" />
                    Active
                  </span>
                ) : (
                  <button
                    type="button"
                    className="nb-scenario-select-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch && dispatch({ type: ACTION.SELECT_SCENARIO, payload: sc.id });
                    }}
                  >
                    Select
                  </button>
                )}
              </div>

              <p className="nb-scenario-card-desc">{sc.desc}</p>
              <div className="nb-scenario-card-bullet">{sc.bullet}</div>
            </div>
          );
        })}
      </div>

      <div className="nb-divider" />

      {/* Reset button action */}
      <div className="nb-scenario-reset-box">
        <div>
          <strong className="nb-scenario-reset-title">Reset Timetable</strong>
          <p className="nb-win-desc" style={{ marginTop: '2px', marginBottom: 0 }}>
            Restore selections back to initial un-repaired state and clear transient notices.
          </p>
        </div>
        <button
          type="button"
          id="reset-button"
          className="nb-reset-btn"
          onClick={() => dispatch && dispatch({ type: ACTION.RESET_DRAFT })}
          aria-label="Reset timetable to starting selections"
          title="Reset timetable to starting selections"
        >
          <RotateCcw size={12} aria-hidden="true" />
          <span>Reset Draft</span>
        </button>
      </div>
    </div>
  );
}
