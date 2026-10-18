import React, { useLayoutEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { ACTION } from '../state/draft-controller.mjs';
import { playSound } from '../audio/optional-sounds.js';

/**
 * Scenario window content - allows switching between demo test scenarios.
 */
export default function ScenarioWindow({ scenario, dispatch }) {
  const pendingSelectFocusRef = useRef(null);
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
      desc: 'Demonstrates when the biology lab cannot fit: Lab A overlaps MATH-A, Lab B is full. The conflict cannot be resolved. After all, the biology lecture and lab are linked and must be selected together; neither can stand alone.',
      bullet: 'MATH-A: Tue 10:00-11:00 · Lab A: Tue 10:00-12:00 · Lab B: Full',
    },
  ];

  useLayoutEffect(() => {
    const pending = pendingSelectFocusRef.current;
    if (!pending || pending.scenarioId !== scenario) return;
    pendingSelectFocusRef.current = null;

    const cards = [...document.querySelectorAll('.nb-scenario-list [data-scenario-id]')];
    const preferredCards = [
      ...cards.slice(0, pending.index).reverse(),
      ...cards.slice(pending.index + 1),
    ];
    const nextSelect = preferredCards
      .map((card) => card.querySelector('.nb-scenario-select-btn'))
      .find(Boolean);
    nextSelect?.focus();
  }, [scenario]);

  function handleSelect(scenarioId, index) {
    if (scenarioId !== scenario) {
      pendingSelectFocusRef.current = { scenarioId, index };
      playSound('popup');
    }
    dispatch?.({ type: ACTION.SELECT_SCENARIO, payload: scenarioId });
  }

  return (
    <div className="nb-win-section">
      <div className="nb-scenario-intro">
        Select a test scenario to evaluate the Course Weft timetable repair engine.
        Changing scenarios updates the catalog and current schedule draft.
      </div>

      {/* Scenario cards */}
      <div className="nb-scenario-list" role="group" aria-label="Demo scenarios">
        {scenarios.map((sc, index) => {
          const isSelected = scenario === sc.id;
          return (
            <div
              key={sc.id}
              data-scenario-id={sc.id}
              className={`nb-scenario-card${isSelected ? ' nb-scenario-card--active' : ''}`}
              onClick={() => handleSelect(sc.id, index)}
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
                      handleSelect(sc.id, index);
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
