import React from 'react';

/**
 * WebsiteInfo window content - Academic Planning Demonstration.
 *
 * Clearly discloses that this application uses synthetic sample data only
 * and does NOT connect to or submit to a real university registration system.
 */
export default function WebsiteInfo() {
  return (
    <div className="nb-win-section" id="website-info-content">
      {/* ── Section header ───────────────────────────────────────── */}
      <div className="nb-win-header">
        <h2 className="nb-win-heading">Academic Planning Demonstration</h2>
        <span className="nb-badge">(Synthetic Data)</span>
      </div>

      {/* ── Synthetic-data disclosure ─────────────────────────────── */}
      <div
        className="nb-info-disclosure"
        role="note"
        aria-label="Synthetic data disclosure"
        id="website-info-disclosure"
      >
        <p className="nb-info-disclosure-heading">
          SYNTHETIC SAMPLE DATA - NO REAL REGISTRATION IS SUBMITTED
        </p>
        <p className="nb-info-disclosure-body">
          Student and lecturer names, course details, meeting times, and seat
          availability shown here are fictional sample data for local
          demonstration only. This portal does not connect to live university
          registration records.
        </p>
      </div>

      {/* ── Description ──────────────────────────────────────────── */}
      <div className="nb-info-section" id="website-info-description">
        <p className="nb-info-section-heading">
          ACADEMIC PLANNING / REGISTRATION WORKSPACE
        </p>
        <p className="nb-win-desc">
          Build your weekly schedule with immediate conflict feedback and
          automated repair suggestions. All changes remain in your local draft
          until submitted.
        </p>
      </div>

      {/* ── Keyboard navigation guide ─────────────────────────────── */}
      <section className="nb-info-section nb-keyboard-guide" aria-labelledby="keyboard-guide-heading">
        <h3 className="nb-info-section-heading" id="keyboard-guide-heading">
          KEYBOARD NAVIGATION
        </h3>
        <p className="nb-win-desc">
          Navigate the workspace without a mouse. The highlighted keys show what to press:
        </p>
        <div
          className="nb-keyboard"
          role="img"
          aria-label="Keyboard diagram highlighting Backspace, Tab, both Shift keys, Enter, Space, Q, W, and S for keyboard navigation, course actions, and scrolling."
        >
          <div className="nb-keyboard-row">
            <span className="nb-keyboard-key nb-keyboard-key--wide">Esc</span>
            {'1234567890'.split('').map((key) => (
              <span className="nb-keyboard-key" key={key}>{key}</span>
            ))}
            <span className="nb-keyboard-key nb-keyboard-key--wide">
              <span className="nb-keyboard-key-label-wide">Backspace</span>
              <span className="nb-keyboard-key-label-compact" aria-hidden="true">←</span>
            </span>
          </div>
          <div className="nb-keyboard-row">
            <span className="nb-keyboard-key nb-keyboard-key--wide nb-keyboard-key--highlight">Tab</span>
            {'QWERTYUIOP'.split('').map((key) => (
              <span
                className={`nb-keyboard-key${key === 'Q' || key === 'W' ? ' nb-keyboard-key--highlight' : ''}`}
                key={key}
              >{key}</span>
            ))}
          </div>
          <div className="nb-keyboard-row">
            <span className="nb-keyboard-key nb-keyboard-key--wide">Caps</span>
            {'ASDFGHJKL'.split('').map((key) => (
              <span
                className={`nb-keyboard-key${key === 'S' ? ' nb-keyboard-key--highlight' : ''}`}
                key={key}
              >{key}</span>
            ))}
            <span className="nb-keyboard-key nb-keyboard-key--wide nb-keyboard-key--highlight">Enter</span>
          </div>
          <div className="nb-keyboard-row">
            <span className="nb-keyboard-key nb-keyboard-key--extra-wide nb-keyboard-key--highlight">Shift</span>
            {'ZXCVBNM'.split('').map((key) => (
              <span
                className="nb-keyboard-key"
                key={key}
              >{key}</span>
            ))}
            <span className="nb-keyboard-key nb-keyboard-key--extra-wide nb-keyboard-key--highlight">Shift</span>
          </div>
          <div className="nb-keyboard-row">
            <span className="nb-keyboard-key nb-keyboard-key--wide">Ctrl</span>
            <span className="nb-keyboard-key">Alt</span>
            <span className="nb-keyboard-key nb-keyboard-key--space nb-keyboard-key--highlight">Space</span>
            <span className="nb-keyboard-key">Alt</span>
            <span className="nb-keyboard-key nb-keyboard-key--wide">Ctrl</span>
          </div>
        </div>
        <ul className="nb-keyboard-shortcuts">
          <li><kbd>Tab</kbd><span>Move focus to the next link, button, or control.</span></li>
          <li><kbd>Shift</kbd> + <kbd>Tab</kbd><span>Move focus to the previous link, button, or control.</span></li>
          <li><kbd>Enter</kbd> or <kbd>Space</kbd><span>Activate the focused course card to add or switch that course.</span></li>
          <li><kbd>W</kbd><span>Scroll up within the active window.</span></li>
          <li><kbd>S</kbd><span>Scroll down within the active window.</span></li>
          <li>
            <kbd>Q</kbd>
            <span>
              With a course card focused, activate its <strong>repair</strong> or{' '}
              <strong className="text-red-600">alert</strong> action when available.
            </span>
          </li>
        </ul>
      </section>

      {/* ── Footer note ──────────────────────────────────────────── */}
      <div className="nb-win-footer-note">
        <span>
          No network requests are made. No data is sent to any external system.
        </span>
      </div>
    </div>
  );
}
