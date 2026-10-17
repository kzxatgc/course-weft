import React from 'react';
import { CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { ACTION } from '../state/draft-controller.mjs';

/**
 * Scenario window content — allows switching between demo test scenarios.
 */
export default function ScenarioWindow({ scenario, dispatch }) {
  const scenarios = [
    {
      id: 'main',
      name: 'Repair available',
      icon: <Sparkles size={18} aria-hidden="true" />,
    },
    {
      id: 'noRepair',
      name: 'No repair available',
      tag: 'Refusal flow',
      icon: <AlertTriangle size={18} aria-hidden="true" />,
      desc: 'Demonstrates when the required biology lab cannot fit: Lab A overlaps MATH-A, Lab B is full, and STAT-B is open but cannot resolve the missing-lab conflict.',
      bullet: 'MATH-A: Tue 10:00–11:00 · Lab A: Tue 10:00–12:00 · Lab B: Full',
    },
  ];

  return (
    <div className="nb-win-section">
      <div className="nb-scenario-intro">
        Select a test scenario to evaluate the Course Weft timetable repair engine.
        Changing scenarios updates the catalog and current schedule draft.
      </div>

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

              {sc.desc && <p className="nb-scenario-card-desc">{sc.desc}</p>}
              {sc.bullet && <div className="nb-scenario-card-bullet">{sc.bullet}</div>}
            </div>
          );
        })}
      </div>

    </div>
  );
}
